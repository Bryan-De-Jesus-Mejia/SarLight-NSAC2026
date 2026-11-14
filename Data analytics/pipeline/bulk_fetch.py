"""Extracción masiva: busca todas las escenas sobre un AOI y guarda el recorte de cada una.

Pensado para juntar series temporales grandes y analizarlas después. Es reanudable: si lo
cortas (Ctrl+C) o algo falla, al relanzar el mismo comando salta lo que ya está guardado.

Salida en data/collections/<name>/:
  <fuente>/<geometría>/<fecha>_<pol>.tif   recorte en dB (EPSG UTM, NaN = sin dato)
  catalog.csv                              una fila por imagen: metadatos + estadísticas
  manifest.json                            parámetros de la extracción
  errors.log                               escenas que fallaron (se reintentan al relanzar)

Ejemplos:
  python pipeline/bulk_fetch.py --name sdq_2026 --bbox -70.0 18.4 -69.8 18.55 --start 2026-06-01
  python pipeline/bulk_fetch.py --name isla_2026 --start 2026-06-01 --min-coverage 0 --nisar-freq B --workers 8
"""
import argparse
import csv
import json
import math
import os
import sys
import time
import traceback
from collections import Counter
from concurrent.futures import FIRST_COMPLETED, ProcessPoolExecutor, wait
from datetime import datetime, timezone

import numpy as np

from sar_io import SarWindow, read_gcov, read_window, write_geotiff
from search_scenes import DATA_DIR, default_bbox, search

CATALOG_FIELDS = [
    "scene", "platform", "group", "date", "pol", "path", "rows", "cols", "crs", "pixel_size_m",
    "valid_pct", "mean_db", "median_db", "p5_db", "p95_db", "aoi_coverage_pct", "fetched_at",
]
HEARTBEAT_S = 60
MAX_NISAR_A_PX = 200_000_000


def slug(group: str) -> str:
    return "_".join(group.split()[1:])


def stamp(date: str) -> str:
    return date.replace("-", "").replace(":", "").rstrip("Z")


def fmt_dur(seconds: float) -> str:
    h, rem = divmod(int(seconds), 3600)
    m, s = divmod(rem, 60)
    return f"{h}h{m:02d}m{s:02d}s" if h else f"{m}m{s:02d}s"


def image_stats(win: SarWindow) -> dict:
    vals = win.db[np.isfinite(win.db)]
    s = {"rows": win.db.shape[0], "cols": win.db.shape[1], "crs": win.crs.to_string(),
         "pixel_size_m": abs(win.transform.a), "valid_pct": round(100 * vals.size / win.db.size, 2)}
    if vals.size:
        p5, med, p95 = np.percentile(vals, [5, 50, 95])
        s.update(mean_db=round(float(vals.mean()), 3), median_db=round(float(med), 3),
                 p5_db=round(float(p5), 3), p95_db=round(float(p95), 3))
    return s


def load_done(catalog_path) -> set[tuple[str, str]]:
    if not catalog_path.exists():
        return set()
    with open(catalog_path, newline="") as f:
        return {(r["scene"], r["pol"]) for r in csv.DictReader(f)}


def append_rows(catalog_path, rows: list[dict]):
    new = not catalog_path.exists()
    with open(catalog_path, "a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CATALOG_FIELDS)
        if new:
            w.writeheader()
        w.writerows(rows)


def fetch_scene(rec: dict, pols: list[str], bbox, root, nisar_freq, max_z_error):
    """Corre en un proceso aparte. Devuelve las filas del catálogo y los bytes escritos."""
    t0 = time.time()
    if rec["platform"] == "NISAR":
        wins = read_gcov(rec["urls"][pols[0]], bbox, pols, freq=nisar_freq)
    else:
        wins = {p: read_window(rec["urls"][p], bbox, p) for p in pols}

    source = "nisar" if rec["platform"] == "NISAR" else "opera"
    out_dir = root / source / slug(rec["group"])
    out_dir.mkdir(parents=True, exist_ok=True)
    rows, written = [], 0
    for pol, win in wins.items():
        stats = image_stats(win)
        rel = ""
        if stats["valid_pct"] > 0:
            path = out_dir / f"{stamp(rec['date'])}_{pol}.tif"
            tmp = path.with_suffix(".tmp.tif")
            write_geotiff(tmp, win.db, win.transform, win.crs, max_z_error=max_z_error,
                          units="dB", pol=pol, scene=rec["scene"], date=rec["date"],
                          group=rec["group"], bbox_lonlat=",".join(map(str, bbox)))
            tmp.replace(path)
            written += path.stat().st_size
            rel = str(path.relative_to(root))
        rows.append({
            "scene": rec["scene"], "platform": rec["platform"], "group": rec["group"],
            "date": rec["date"], "pol": pol, "path": rel,
            "aoi_coverage_pct": rec["aoi_coverage_pct"],
            "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), **stats,
        })
    return rows, written, time.time() - t0


def bbox_pixels_at_10m(bbox) -> float:
    lon0, lat0, lon1, lat1 = bbox
    km_x = (lon1 - lon0) * 111.32 * math.cos(math.radians((lat0 + lat1) / 2))
    km_y = (lat1 - lat0) * 110.57
    return km_x * km_y * 1e4


class Progress:
    def __init__(self, total: int, already: int):
        self.total, self.already = total, already
        self.ok = self.failed = self.images = self.bytes = 0
        self.t0 = time.time()
        self.last_beat = self.t0

    def done(self) -> int:
        return self.ok + self.failed

    def line(self, running: int) -> str:
        elapsed = time.time() - self.t0
        rate = self.done() / (elapsed / 60) if elapsed > 0 else 0
        pct = 100 * self.done() / self.total if self.total else 100
        return (f"{self.done()}/{self.total} escenas ({pct:.1f}%) | {self.ok} OK, {self.failed} error | "
                f"{self.images} imágenes, {self.bytes / 2**30:.2f} GB | {rate:.1f} escenas/min | "
                f"en curso: {running} | transcurrido {fmt_dur(elapsed)}")

    def heartbeat(self, running: int, force=False):
        if force or time.time() - self.last_beat >= HEARTBEAT_S:
            print(f"\n[{time.strftime('%H:%M:%S')}] PROGRESO: {self.line(running)}\n", flush=True)
            self.last_beat = time.time()


def main():
    # Sin esto, con nohup/tee/ssh/IDE la salida queda en buffer y la consola parece colgada.
    sys.stdout.reconfigure(line_buffering=True)
    print(f"[{time.strftime('%H:%M:%S')}] bulk_fetch iniciado", flush=True)
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--name", required=True, help="Nombre de la colección (carpeta en data/collections/)")
    ap.add_argument("--source", nargs="+", choices=["opera", "nisar"], default=["opera", "nisar"])
    ap.add_argument("--bbox", nargs=4, type=float, metavar=("LON_MIN", "LAT_MIN", "LON_MAX", "LAT_MAX"),
                    default=None, help="Por defecto AOI_BBOX del .env")
    ap.add_argument("--start", help="YYYY-MM-DD")
    ap.add_argument("--end", help="YYYY-MM-DD")
    ap.add_argument("--pol", nargs="+", help="Solo estas polarizaciones (por defecto todas las de cada escena)")
    ap.add_argument("--min-coverage", type=float, default=30,
                    help="%% mínimo del AOI que debe cubrir la escena (def. 30; usa 0 para áreas grandes)")
    ap.add_argument("--group", nargs="+", help="Solo geometrías cuyo nombre contenga este texto (p.ej. T171_366115 o P083)")
    ap.add_argument("--nisar-freq", choices=["A", "B"], default="A",
                    help="NISAR: A = ~10 m (zonas pequeñas), B = ~80 m (áreas grandes / isla completa)")
    ap.add_argument("--lossless", action="store_true",
                    help="Sin compresión con pérdida (por defecto LERC con error máx. 0.01 dB, ~2.5x menos disco)")
    ap.add_argument("--workers", type=int, default=4, help="Escenas en paralelo (def. 4)")
    ap.add_argument("--max", type=int, default=20000, help="Máximo de resultados por búsqueda")
    ap.add_argument("--limit", type=int, help="Procesar como mucho N escenas (para probar)")
    ap.add_argument("--dry-run", action="store_true", help="Solo muestra qué se descargaría")
    args = ap.parse_args()

    bbox = args.bbox or default_bbox()
    if "nisar" in args.source and args.nisar_freq == "A" and bbox_pixels_at_10m(bbox) > MAX_NISAR_A_PX:
        raise SystemExit("Área demasiado grande para NISAR a 10 m (varios GB de RAM por imagen). "
                         "Usa --nisar-freq B (~80 m) o un --bbox más pequeño.")
    root = DATA_DIR / "collections" / args.name
    catalog_path = root / "catalog.csv"
    wanted = [p.upper() for p in args.pol] if args.pol else None
    max_z_error = None if args.lossless else 0.01

    recs = []
    for source in args.source:
        t = time.time()
        print(f"Buscando {source} en ASF...", flush=True)
        found = search(source, bbox, args.start, args.end, None, args.max, verbose=True)
        print(f"  {len(found)} escenas en {time.time() - t:.0f}s", flush=True)
        if len(found) >= args.max:
            print(f"  Aviso: se alcanzó --max {args.max}; puede haber más escenas. Sube --max.")
        recs += found
    recs = [r for r in recs if r["aoi_coverage_pct"] >= args.min_coverage]
    if args.group:
        recs = [r for r in recs if any(g in r["group"].replace(" ", "_") for g in args.group)]

    done = load_done(catalog_path)
    tasks = []
    for r in recs:
        pols = [p for p in r["pols"] if (wanted is None or p in wanted) and (r["scene"], p) not in done]
        if pols:
            tasks.append((r, pols))
    tasks.sort(key=lambda t: t[0]["date"])
    if args.limit:
        tasks = tasks[: args.limit]

    by_source = Counter("NISAR" if r["platform"] == "NISAR" else "OPERA" for r, _ in tasks)
    by_group = Counter(r["group"] for r, _ in tasks)
    print(f"\n{len(recs)} escenas encontradas | {len(done)} imágenes ya guardadas | "
          f"{len(tasks)} escenas pendientes ({dict(by_source)}) en {len(by_group)} geometrías")
    if args.dry_run:
        for g, n in sorted(by_group.items()):
            print(f"  {g:40} {n}")
        return
    if not tasks:
        print("Nada pendiente.")
        return

    root.mkdir(parents=True, exist_ok=True)
    manifest = root / "manifest.json"
    meta = json.loads(manifest.read_text()) if manifest.exists() else {"created": time.strftime("%Y-%m-%dT%H:%M:%S")}
    meta.update(bbox=bbox, sources=args.source, start=args.start, end=args.end, pols=wanted,
                min_coverage=args.min_coverage, groups=args.group, nisar_freq=args.nisar_freq,
                max_z_error_db=max_z_error, updated=time.strftime("%Y-%m-%dT%H:%M:%S"))
    manifest.write_text(json.dumps(meta, indent=2))

    print(f"Iniciando con {args.workers} procesos. Salida: {root}")
    print(f"Ctrl+C para parar; relanza el mismo comando para continuar.\n", flush=True)
    prog = Progress(len(tasks), len(done))
    pool = ProcessPoolExecutor(max_workers=args.workers)
    pending = {pool.submit(fetch_scene, r, pols, bbox, root, args.nisar_freq, max_z_error): r
               for r, pols in tasks}
    try:
        while pending:
            finished, _ = wait(pending, timeout=HEARTBEAT_S, return_when=FIRST_COMPLETED)
            for fut in finished:
                r = pending.pop(fut)
                tag = f"{r['date'][:10]} {r['group']}"
                try:
                    rows, written, secs = fut.result()
                    append_rows(catalog_path, rows)
                    prog.ok += 1
                    prog.images += sum(1 for x in rows if x["path"])
                    prog.bytes += written
                    pols = "/".join(x["pol"] for x in rows if x["path"]) or "sin datos en AOI"
                    print(f"[{prog.done()}/{prog.total}] OK    {tag:44} {pols:8} "
                          f"{written / 2**20:6.1f} MB {secs:5.1f}s", flush=True)
                except BaseException as e:
                    prog.failed += 1
                    print(f"[{prog.done()}/{prog.total}] ERROR {tag:44} {str(e).splitlines()[0][:120]}", flush=True)
                    with open(root / "errors.log", "a") as f:
                        f.write(f"{time.strftime('%Y-%m-%dT%H:%M:%S')} {r['scene']}\n"
                                f"{''.join(traceback.format_exception(e))}\n")
            prog.heartbeat(min(len(pending), args.workers))
    except KeyboardInterrupt:
        print("\nInterrumpido. Relanza el mismo comando para continuar donde quedó.")
        prog.heartbeat(0, force=True)
        pool.shutdown(wait=False, cancel_futures=True)
        os._exit(1)
    pool.shutdown()

    prog.heartbeat(0, force=True)
    print(f"Catálogo: {catalog_path}")
    if prog.failed:
        print(f"Errores en {root / 'errors.log'} (relanza el comando para reintentarlas).")


if __name__ == "__main__":
    main()
