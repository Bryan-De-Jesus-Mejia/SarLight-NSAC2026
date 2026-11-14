"""Descarga (streaming, solo el bbox) los interferogramas NISAR GUNW cosísmicos de un terremoto.

Busca pares GUNW cuya imagen de referencia es ANTERIOR al sismo y la secundaria POSTERIOR. Por cada
geometría (track + frame + dirección) se queda con el par de menor separación temporal.

Capas que guarda por par (GeoTIFF, 80 m, UTM):
  fase_desenvuelta.tif   fase interferométrica desenvuelta (rad)
  coherencia.tif         coherencia 0-1 (baja = decorrelación: daño, deslizamientos, vegetación, agua)
  componentes.tif        componentes conectadas del desenvolvimiento (0 = no fiable)
  ionosfera.tif          fase ionosférica estimada (rad), se resta en el análisis
  offset_rango.tif       desplazamiento por correlación de píxeles en rango oblicuo (m)
  offset_azimut.tif      desplazamiento por correlación de píxeles en azimut (m)
  correlacion_offsets.tif calidad de los offsets (0-1)

Salida en data/collections/<name>/gunw/<track_frame_dir>/<ref>_<sec>/ + catalog.csv + manifest.json.
Reanudable: si un par ya está completo, se salta.

Ejemplo:
  python pipeline/fetch_quake.py --name terremoto_venezuela --event-date 2026-06-24 --bbox -69.4 10.0 -67.6 11.0
"""
import argparse
import csv
import json
import time
import traceback
from datetime import date, timedelta

import asf_search as asf
import numpy as np
from shapely.geometry import box, shape

import sar_io
from progress import Heartbeat, Progress, log, setup_stdout
from sar_io import read_h5_layers, write_geotiff
from search_scenes import DATA_DIR

BASE = "science/LSAR/GUNW/grids/frequencyA"
IDENT = "science/LSAR/identification"
LAYERS = {
    "fase_desenvuelta": "unwrappedInterferogram/{pol}/unwrappedPhase",
    "coherencia": "unwrappedInterferogram/{pol}/coherenceMagnitude",
    "componentes": "unwrappedInterferogram/{pol}/connectedComponents",
    "ionosfera": "unwrappedInterferogram/{pol}/ionospherePhaseScreen",
    "offset_rango": "pixelOffsets/{pol}/slantRangeOffset",
    "offset_azimut": "pixelOffsets/{pol}/alongTrackOffset",
    "correlacion_offsets": "pixelOffsets/{pol}/correlationSurfacePeak",
}
META = {
    "ref_time": f"{IDENT}/referenceZeroDopplerStartTime",
    "sec_time": f"{IDENT}/secondaryZeroDopplerStartTime",
    "direction": f"{IDENT}/orbitPassDirection",
    "look_direction": f"{IDENT}/lookDirection",
    "track": f"{IDENT}/trackNumber",
    "frame": f"{IDENT}/frameNumber",
    "center_frequency_hz": f"{BASE}/centerFrequency",
}
CATALOG_FIELDS = ["pair", "group", "scene", "ref_date", "sec_date", "days", "direction", "track", "frame",
                  "pol", "aoi_coverage_pct", "center_frequency_hz", "rows", "cols", "path", "fetched_at"]


def parse_pair(file_id: str) -> dict:
    f = file_id.split("_")
    return {"track": int(f[5]), "direction": {"A": "ASC", "D": "DESC"}.get(f[6], f[6]), "frame": int(f[7]),
            "ref": f[11][:8], "sec": f[13][:8]}


def find_pairs(bbox, event: date, max_days: int, min_cov: float, per_group: int) -> list[dict]:
    aoi = box(*bbox)
    log(f"Buscando GUNW en ASF alrededor de {event} (±{max_days} días) ... "
        f"(el servidor de la NASA puede tardar varios minutos)")
    t0 = time.time()
    results = []
    with Heartbeat("Búsqueda en ASF/CMR"):
        for page_no, page in enumerate(asf.search_generator(
                dataset=asf.DATASET.NISAR, processingLevel="GUNW", intersectsWith=aoi.wkt,
                start=(event - timedelta(days=max_days)).isoformat(),
                end=(event + timedelta(days=max_days)).isoformat(), maxResults=2000), 1):
            results += list(page)
            log(f"   página {page_no}: {len(results)} productos GUNW acumulados ({time.time() - t0:.0f}s)")
    ev = event.strftime("%Y%m%d")
    best = {}
    for p in results:
        pr = p.properties
        info = parse_pair(pr["fileID"])
        if not (info["ref"] < ev < info["sec"]):
            continue
        days = (date.fromisoformat(f"{info['sec'][:4]}-{info['sec'][4:6]}-{info['sec'][6:]}")
                - date.fromisoformat(f"{info['ref'][:4]}-{info['ref'][4:6]}-{info['ref'][6:]}")).days
        if days > max_days:
            continue
        cov = round(100 * shape(p.geometry).intersection(aoi).area / aoi.area, 1)
        if cov < min_cov:
            continue
        pol = (pr.get("mainBandPolarization") or ["HH"])[0]
        rec = {**info, "days": days, "cov": cov, "pol": pol, "scene": pr["sceneName"],
               "url": pr["url"], "processed": pr.get("processingDate") or ""}
        key = (info["track"], info["frame"], info["direction"], info["ref"], info["sec"])
        if key not in best or rec["processed"] > best[key]["processed"]:
            best[key] = rec  # misma pareja reprocesada: la versión más reciente
    by_group = {}
    for rec in best.values():
        g = f"T{rec['track']:03d}_F{rec['frame']:03d}_{rec['direction']}"
        by_group.setdefault(g, []).append(rec)
    pairs = []
    for g, recs in by_group.items():
        for rec in sorted(recs, key=lambda r: (r["days"], -r["cov"]))[:per_group]:
            pairs.append({**rec, "group": g, "pair": f"{rec['ref']}_{rec['sec']}"})
    return sorted(pairs, key=lambda r: -r["cov"])


def fetch_pair(rec: dict, bbox, root, catalog) -> str:
    out = root / "gunw" / rec["group"] / rec["pair"]
    layers = {k: f"{BASE}/{v.format(pol=rec['pol'])}" for k, v in LAYERS.items()}
    with Heartbeat(f"Leyendo {len(layers)} capas de {rec['group']} {rec['pair']} (streaming)"):
        data, meta = read_h5_layers(rec["url"], layers, bbox, META)
    if "fase_desenvuelta" not in data:
        raise RuntimeError("el producto no trae fase desenvuelta")
    out.mkdir(parents=True, exist_ok=True)
    for name, (arr, transform, crs) in data.items():
        if name == "componentes":
            write_geotiff(out / f"{name}.tif", arr.astype(np.uint16), transform, crs, nodata=65535)
        else:
            write_geotiff(out / f"{name}.tif", arr.astype(np.float32), transform, crs)
    rows, cols = data["fase_desenvuelta"][0].shape
    (out / "meta.json").write_text(json.dumps({**{k: v for k, v in rec.items() if k != "url"}, **meta},
                                              indent=2, default=str))
    row = {"pair": rec["pair"], "group": rec["group"], "scene": rec["scene"], "ref_date": rec["ref"],
           "sec_date": rec["sec"], "days": rec["days"], "direction": rec["direction"], "track": rec["track"],
           "frame": rec["frame"], "pol": rec["pol"], "aoi_coverage_pct": rec["cov"],
           "center_frequency_hz": meta.get("center_frequency_hz", ""), "rows": rows, "cols": cols,
           "path": str(out.relative_to(root)), "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%S")}
    new = not catalog.exists()
    with open(catalog, "a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CATALOG_FIELDS)
        if new:
            w.writeheader()
        w.writerow(row)
    return f"{rows}x{cols} px, {len(data)} capas"


def main():
    setup_stdout()
    sar_io.VERBOSE = True
    log("fetch_quake iniciado")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--name", required=True, help="Nombre de la colección (p.ej. terremoto_venezuela)")
    ap.add_argument("--event-date", required=True, help="Fecha del sismo (UTC), YYYY-MM-DD")
    ap.add_argument("--bbox", nargs=4, type=float, required=True,
                    metavar=("LON_MIN", "LAT_MIN", "LON_MAX", "LAT_MAX"))
    ap.add_argument("--max-days", type=int, default=48, help="Separación máxima ref-sec en días (def. 48)")
    ap.add_argument("--min-coverage", type=float, default=20, help="%% mínimo del bbox cubierto (def. 20)")
    ap.add_argument("--per-group", type=int, default=1,
                    help="Pares por geometría, de menor a mayor separación temporal (def. 1)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    root = DATA_DIR / "collections" / args.name
    catalog = root / "catalog.csv"
    pairs = find_pairs(args.bbox, date.fromisoformat(args.event_date), args.max_days, args.min_coverage,
                       args.per_group)
    log(f"{len(pairs)} pares cosísmicos seleccionados:")
    for p in pairs:
        log(f"   {p['group']:20} {p['ref']} -> {p['sec']} ({p['days']} días) | cubre {p['cov']}% | {p['pol']}")
    if args.dry_run or not pairs:
        return

    done = set()
    if catalog.exists():
        with open(catalog, newline="") as f:
            done = {(r["group"], r["pair"]) for r in csv.DictReader(f)}
    root.mkdir(parents=True, exist_ok=True)
    (root / "manifest.json").write_text(json.dumps(
        {"type": "earthquake", "event_date": args.event_date, "bbox": args.bbox, "max_days": args.max_days,
         "min_coverage": args.min_coverage, "per_group": args.per_group,
         "updated": time.strftime("%Y-%m-%dT%H:%M:%S")}, indent=2))

    prog = Progress(len(pairs), f"Descarga {args.name}", unit="pares")
    for p in pairs:
        tag = f"{p['group']:20} {p['pair']}"
        if (p["group"], p["pair"]) in done:
            prog.step(f"{tag} ya descargado", status="SALTADA")
            continue
        try:
            prog.step(f"{tag} {fetch_pair(p, args.bbox, root, catalog)}")
        except Exception as e:
            prog.step(f"{tag} {type(e).__name__}: {e}", status="ERROR")
            with open(root / "errors.log", "a") as f:
                f.write(f"{time.strftime('%Y-%m-%dT%H:%M:%S')} {p['scene']}\n{traceback.format_exc()}\n")
    prog.summary(final=True)
    log(f"Catálogo: {catalog}")


if __name__ == "__main__":
    main()
