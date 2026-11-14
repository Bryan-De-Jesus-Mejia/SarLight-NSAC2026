"""Extracción masiva: busca todas las escenas sobre un AOI y guarda el recorte de cada una.

Pensado para juntar series temporales grandes y analizarlas después. Es reanudable: si lo
cortas (Ctrl+C) o algo falla, al relanzar el mismo comando salta lo que ya está guardado.

Salida en data/collections/<name>/:
  <fuente>/<geometría>/<fecha>_<pol>.tif   recorte en dB (EPSG UTM, NaN = sin dato)
  catalog.csv                              una fila por imagen: metadatos + estadísticas
  manifest.json                            parámetros de la extracción
  errors.log                               escenas que fallaron (se reintentan al relanzar)

Ejemplos:
  python pipeline/bulk_fetch.py --name sdq_2026 --bbox -70.0 18.4 -69.8 18.55 --start 2026-06-01 --dry-run
  python pipeline/bulk_fetch.py --name sdq_2026 --bbox -70.0 18.4 -69.8 18.55 --start 2026-06-01
"""
import argparse
import csv
import json
import threading
import time
import traceback
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

import numpy as np

from sar_io import SarWindow, read_gcov, read_window, write_geotiff
from search_scenes import DATA_DIR, default_bbox, search

CATALOG_FIELDS = [
    "scene", "platform", "group", "date", "pol", "path", "rows", "cols", "crs", "pixel_size_m",
    "valid_pct", "mean_db", "median_db", "p5_db", "p95_db", "aoi_coverage_pct", "fetched_at",
]
_lock = threading.Lock()


def slug(group: str) -> str:
    return "_".join(group.split()[1:])


def stamp(date: str) -> str:
    return date.replace("-", "").replace(":", "").rstrip("Z")


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


def append_row(catalog_path, row: dict):
    with _lock:
        new = not catalog_path.exists()
        with open(catalog_path, "a", newline="") as f:
            w = csv.DictWriter(f, fieldnames=CATALOG_FIELDS)
            if new:
                w.writeheader()
            w.writerow(row)


def fetch_scene(rec: dict, pols: list[str], bbox, root, catalog_path) -> list[str]:
    if rec["platform"] == "NISAR":
        wins = read_gcov(rec["urls"][pols[0]], bbox, pols)
    else:
        wins = {p: read_window(rec["urls"][p], bbox, p) for p in pols}

    source = "nisar" if rec["platform"] == "NISAR" else "opera"
    out_dir = root / source / slug(rec["group"])
    out_dir.mkdir(parents=True, exist_ok=True)
    saved = []
    for pol, win in wins.items():
        stats = image_stats(win)
        rel = ""
        if stats["valid_pct"] > 0:
            path = out_dir / f"{stamp(rec['date'])}_{pol}.tif"
            tmp = path.with_suffix(".tmp.tif")
            write_geotiff(tmp, win.db, win.transform, win.crs, units="dB", pol=pol,
                          scene=rec["scene"], date=rec["date"], group=rec["group"],
                          bbox_lonlat=",".join(map(str, bbox)))
            tmp.replace(path)
            rel = str(path.relative_to(root))
            saved.append(pol)
        append_row(catalog_path, {
            "scene": rec["scene"], "platform": rec["platform"], "group": rec["group"],
            "date": rec["date"], "pol": pol, "path": rel,
            "aoi_coverage_pct": rec["aoi_coverage_pct"],
            "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), **stats,
        })
    return saved


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--name", required=True, help="Nombre de la colección (carpeta en data/collections/)")
    ap.add_argument("--source", nargs="+", choices=["opera", "nisar"], default=["opera", "nisar"])
    ap.add_argument("--bbox", nargs=4, type=float, metavar=("LON_MIN", "LAT_MIN", "LON_MAX", "LAT_MAX"),
                    default=None, help="Por defecto AOI_BBOX del .env")
    ap.add_argument("--start", help="YYYY-MM-DD")
    ap.add_argument("--end", help="YYYY-MM-DD")
    ap.add_argument("--pol", nargs="+", help="Solo estas polarizaciones (por defecto todas las de cada escena)")
    ap.add_argument("--min-coverage", type=float, default=30,
                    help="%% mínimo del AOI que debe cubrir la escena (def. 30)")
    ap.add_argument("--group", nargs="+", help="Solo geometrías cuyo nombre contenga este texto (p.ej. T171_366115 o P083)")
    ap.add_argument("--workers", type=int, default=3, help="Escenas en paralelo (def. 3)")
    ap.add_argument("--max", type=int, default=2000, help="Máximo de resultados por búsqueda")
    ap.add_argument("--limit", type=int, help="Procesar como mucho N escenas (para probar)")
    ap.add_argument("--dry-run", action="store_true", help="Solo muestra qué se descargaría")
    args = ap.parse_args()

    bbox = args.bbox or default_bbox()
    root = DATA_DIR / "collections" / args.name
    catalog_path = root / "catalog.csv"
    wanted = [p.upper() for p in args.pol] if args.pol else None

    recs = []
    for source in args.source:
        print(f"Buscando {source}...")
        recs += search(source, bbox, args.start, args.end, None, args.max)
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

    by_group = Counter(r["group"] for r, _ in tasks)
    print(f"\n{len(recs)} escenas encontradas, {len(done)} imágenes ya guardadas, {len(tasks)} escenas pendientes:")
    for g, n in sorted(by_group.items()):
        print(f"  {g:40} {n}")
    if args.dry_run or not tasks:
        return

    root.mkdir(parents=True, exist_ok=True)
    manifest = root / "manifest.json"
    meta = json.loads(manifest.read_text()) if manifest.exists() else {"created": time.strftime("%Y-%m-%dT%H:%M:%S")}
    meta.update(bbox=bbox, sources=args.source, start=args.start, end=args.end, pols=wanted,
                min_coverage=args.min_coverage, groups=args.group, updated=time.strftime("%Y-%m-%dT%H:%M:%S"))
    manifest.write_text(json.dumps(meta, indent=2))

    ok = failed = 0
    t_start = time.time()
    pool = ThreadPoolExecutor(max_workers=args.workers)
    futures = {pool.submit(fetch_scene, r, pols, bbox, root, catalog_path): r for r, pols in tasks}
    try:
        for i, fut in enumerate(as_completed(futures), 1):
            r = futures[fut]
            try:
                saved = fut.result()
                ok += 1
                print(f"[{i}/{len(tasks)}] OK  {r['date'][:10]} {r['group']:32} {'/'.join(saved) or 'sin datos en AOI'}")
            except (Exception, SystemExit) as e:
                failed += 1
                print(f"[{i}/{len(tasks)}] ERROR {r['scene']}: {e}")
                with open(root / "errors.log", "a") as f:
                    f.write(f"{time.strftime('%Y-%m-%dT%H:%M:%S')} {r['scene']}\n{traceback.format_exc()}\n")
    except KeyboardInterrupt:
        print("\nInterrumpido. Relanza el mismo comando para continuar donde quedó.")
        pool.shutdown(wait=False, cancel_futures=True)
        raise SystemExit(1)
    pool.shutdown()

    print(f"\nListo en {(time.time() - t_start) / 60:.1f} min: {ok} escenas OK, {failed} con error.")
    print(f"Catálogo: {catalog_path}")
    if failed:
        print(f"Errores en {root / 'errors.log'} (relanza el comando para reintentarlas).")


if __name__ == "__main__":
    main()
