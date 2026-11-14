"""Busca escenas SAR en ASF sobre un AOI y las agrupa por geometría para elegir pares pre/post.

Fuentes:
  nisar  -> NISAR L2 GCOV (banda L, HDF5, ~20 m). Casi todo es HH/HV (DHDH); algo VV/VH (NADV).
  opera  -> OPERA L2 RTC-S1 (Sentinel-1 banda C, COG por polarización, 30 m, VV/VH).

La búsqueda no necesita credenciales. Ejemplo:
  python pipeline/search_scenes.py --source opera --start 2026-10-01 --bbox -70.1 18.3 -69.7 18.6
"""
import argparse
import json
import os
from collections import defaultdict
from pathlib import Path

import asf_search as asf
from shapely.geometry import box, shape

from earthdata_auth import ROOT, access_mode

DATA_DIR = ROOT / "data"
DEFAULT_BBOX = "-74.7289,17.4873,-68.1135,20.1331"


def default_bbox() -> list[float]:
    return [float(v) for v in os.getenv("AOI_BBOX", DEFAULT_BBOX).split(",")]


def _pols(pr: dict) -> list[str]:
    if pr.get("polarization"):
        return list(pr["polarization"])
    code = pr["fileID"].split("_")[9]  # p.ej. DHDH, NADV
    return {"DH": ["HH", "HV"], "DV": ["VV", "VH"], "SH": ["HH"], "SV": ["VV"]}.get(
        code[:2] if code[:2] != "NA" else code[2:], [code]
    )


def data_urls(product) -> dict[str, str]:
    """URL del archivo de datos por polarización, según SAR_ACCESS_MODE (https o s3)."""
    pr = product.properties
    use_s3 = access_mode() == "s3"
    if pr["platform"] == "NISAR":
        url = pr["url"]
        if use_s3:
            url = next(u for u in pr["s3Urls"] if u.endswith("/" + pr["fileName"]))
        return {p: url for p in _pols(pr)}
    pool = pr["s3Urls"] if use_s3 else [pr["url"], *pr.get("additionalUrls", [])]
    return {p: u for p in _pols(pr) for u in pool if u.endswith(f"_{p}.tif")}


def record(product, aoi) -> dict:
    pr = product.properties
    geom = shape(product.geometry)
    if pr["platform"] == "NISAR":
        key = f"NISAR P{pr['pathNumber']:03d} F{pr['frameNumber']:03d} {pr['flightDirection'][:4]}"
        size = next((v["bytes"] for k, v in pr["bytes"].items() if k == pr["fileName"]), None)
    else:
        key = f"OPERA {pr['operaBurstID']} {pr['flightDirection'][:4]}"
        size = None
    return {
        "scene": pr["sceneName"],
        "date": pr["startTime"],
        "group": key,
        "platform": pr["platform"],
        "pols": _pols(pr),
        "aoi_coverage_pct": round(100 * geom.intersection(aoi).area / aoi.area, 1),
        "size_mb": round(size / 2**20) if size else None,
        "urls": data_urls(product),
    }


def resolve_scene_url(scene: str, pol: str) -> str:
    results = asf.granule_search([scene])
    product = next((p for p in results if p.properties["sceneName"] == scene), None)
    if product is None:
        raise SystemExit(f"No se encontró la escena {scene} en ASF")
    urls = data_urls(product)
    if pol.upper() not in urls:
        raise SystemExit(f"{scene} no tiene {pol}. Disponibles: {sorted(urls)}")
    return urls[pol.upper()]


def search(source: str, bbox, start=None, end=None, pol=None, max_results=500):
    aoi = box(*bbox)
    kw = dict(intersectsWith=aoi.wkt, start=start, end=end, maxResults=max_results)
    if source == "nisar":
        results = asf.search(dataset=asf.DATASET.NISAR, processingLevel="GCOV", **kw)
    else:
        results = asf.search(dataset=asf.DATASET.OPERA_S1, processingLevel="RTC", **kw)
    rows = [record(p, aoi) for p in results]
    if pol:
        rows = [r for r in rows if pol.upper() in r["pols"]]
    return sorted(rows, key=lambda r: (r["group"], r["date"]))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--source", choices=["nisar", "opera"], default="nisar")
    ap.add_argument("--bbox", nargs=4, type=float, metavar=("LON_MIN", "LAT_MIN", "LON_MAX", "LAT_MAX"),
                    default=None, help="Por defecto AOI_BBOX del .env")
    ap.add_argument("--start", help="YYYY-MM-DD")
    ap.add_argument("--end", help="YYYY-MM-DD")
    ap.add_argument("--pol", help="Filtra escenas que tengan esta polarización (HH, HV, VV, VH)")
    ap.add_argument("--min-coverage", type=float, default=0, help="%% mínimo del AOI cubierto por la escena")
    ap.add_argument("--max", type=int, default=500)
    ap.add_argument("--out", type=Path, help="JSON de salida (por defecto data/scenes_<source>.json)")
    args = ap.parse_args()

    bbox = args.bbox or default_bbox()
    rows = search(args.source, bbox, args.start, args.end, args.pol, args.max)
    rows = [r for r in rows if r["aoi_coverage_pct"] >= args.min_coverage]

    groups = defaultdict(list)
    for r in rows:
        groups[r["group"]].append(r)
    for key, items in groups.items():
        print(f"\n== {key}  ({len(items)} escenas, cubre {max(i['aoi_coverage_pct'] for i in items)}% del AOI)")
        for r in items:
            size = f"{r['size_mb']} MB" if r["size_mb"] else ""
            print(f"  {r['date'][:16]}  {'/'.join(r['pols']):6}  {size:>8}  {r['scene']}")
    print(f"\n{len(rows)} escenas en {len(groups)} geometrías. Pre/post: elige dos fechas del mismo grupo.")

    out = args.out or DATA_DIR / f"scenes_{args.source}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"bbox": bbox, "source": args.source, "scenes": rows}, indent=2))
    print(f"Guardado: {out}")


if __name__ == "__main__":
    main()
