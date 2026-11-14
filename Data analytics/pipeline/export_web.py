"""Convierte los resultados de data/analisis en archivos ligeros para la app web.

Por cada análisis (data/analisis/<caso>/<sensor_pol>/) genera, en la carpeta de la app:
  public/analysis/<caso>/<sensor>-<pol>_{pre,post,diff,change}.webp   imágenes reducidas
  data/analysis/cases.json                                            metadatos, estadísticas y series

Todo sale de archivos reales: estadisticas.json, diferencia_db.tif, mascara_cambio.tif y las
escenas pre/post de data/collections. No se inventa ningún valor. Lo único derivado es:
  - las estadísticas "en tierra": las mismas máscaras pero sin los píxeles que ya eran agua
    abierta en la imagen pre (umbral por polarización, ver WATER_DB). El agua permanente cambia
    de brillo por viento y oleaje, no por inundación ni incendio.
  - la serie temporal: mediana de dB del área por pasada, tomada de catalog.csv.

Uso:
  python pipeline/export_web.py
  python pipeline/export_web.py --only inundacion_azua
"""
import argparse
import csv
import json
import time
import warnings
from pathlib import Path

import matplotlib
import numpy as np
import rasterio
from PIL import Image
from rasterio.warp import Resampling, reproject
from rasterio.warp import transform as warp_transform

from search_scenes import DATA_DIR

matplotlib.use("Agg")

APP_DIR = Path(__file__).resolve().parents[2] / "ProyectoTal"
MAX_SIDE = 1400
WEBP_QUALITY = 82
# Por debajo de este valor (dB, imagen pre) un píxel se considera agua abierta.
WATER_DB = {"HH": -17.0, "VV": -17.0, "HV": -22.0, "VH": -22.0}
MIN_VALID_PCT_SERIES = 50.0

# Metadatos editoriales de cada caso. Los números salen de los archivos; esto solo nombra el sitio.
CASES = {
    "incendio_pelempito": dict(
        id="pelempito-fire", type="wildfire", name="Pelempito fire analysis",
        region="Sierra de Bahoruco, Pedernales", country="Dominican Republic"),
    "incendio_sierra_bahoruco": dict(
        id="bahoruco-fire", type="wildfire", name="Sierra de Bahoruco fire analysis",
        region="Sierra de Bahoruco", country="Dominican Republic"),
    "inundacion_azua": dict(
        id="azua-flood", type="flood", name="Azua flood analysis",
        region="Azua", country="Dominican Republic"),
    "inundacion_monte_plata": dict(
        id="monte-plata-flood", type="flood", name="Monte Plata flood analysis",
        region="Monte Plata", country="Dominican Republic"),
}
SENSOR_INFO = {
    "nisar": dict(label="NISAR", band="L", resolution_m=10),
    "opera": dict(label="Sentinel-1 (OPERA RTC)", band="C", resolution_m=30),
}


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def read_raster(path: Path):
    with rasterio.open(path) as src:
        data = np.ma.filled(src.read(1, masked=True).astype(np.float32), np.nan)
        return data, src.transform, src.crs


def align_to(src_arr, src_tf, src_crs, dst_shape, dst_tf, dst_crs) -> np.ndarray:
    out = np.full(dst_shape, np.nan, np.float32)
    reproject(src_arr, out, src_transform=src_tf, src_crs=src_crs, dst_transform=dst_tf,
              dst_crs=dst_crs, src_nodata=np.nan, dst_nodata=np.nan, resampling=Resampling.bilinear)
    return out


def block_reduce(a: np.ndarray, f: int, how: str = "mean") -> np.ndarray:
    if f <= 1:
        return a
    h, w = (a.shape[0] // f) * f, (a.shape[1] // f) * f
    blocks = a[:h, :w].reshape(h // f, f, w // f, f).swapaxes(1, 2).reshape(h // f, w // f, f * f)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        return np.nanmean(blocks, axis=2) if how == "mean" else blocks.mean(axis=2)


def save_webp(rgba: np.ndarray, path: Path) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, "RGBA").save(path, "WEBP", quality=WEBP_QUALITY, method=6)
    return path.stat().st_size


def gray_rgba(db: np.ndarray, lo: float, hi: float) -> np.ndarray:
    norm = np.clip((db - lo) / (hi - lo), 0, 1)
    g = (np.nan_to_num(norm) ** 0.9 * 255).astype(np.uint8)
    alpha = np.where(np.isfinite(db), 255, 0).astype(np.uint8)
    return np.dstack([g, g, g, alpha])


def diff_rgba(diff: np.ndarray, limit: float = 6.0) -> np.ndarray:
    cmap = matplotlib.colormaps["RdBu"]
    rgba = (cmap((np.nan_to_num(diff) + limit) / (2 * limit)) * 255).astype(np.uint8)
    rgba[..., 3] = np.where(np.isfinite(diff), 255, 0)
    return rgba


def change_rgba(diff: np.ndarray, changed: np.ndarray, thr: float, f: int) -> np.ndarray:
    dec = block_reduce((changed & (diff <= -thr)).astype(np.float32), f, "frac")
    inc = block_reduce((changed & (diff >= thr)).astype(np.float32), f, "frac")
    rgba = np.zeros(dec.shape + (4,), np.uint8)
    for frac, colour in ((dec, (255, 107, 61)), (inc, (56, 189, 248))):
        on = frac > 0.12
        alpha = np.clip(110 + 145 * frac, 0, 255).astype(np.uint8)
        for i, c in enumerate(colour):
            rgba[..., i] = np.where(on, c, rgba[..., i])
        rgba[..., 3] = np.where(on, np.maximum(rgba[..., 3], alpha), rgba[..., 3])
    return rgba


def footprint(tf, crs, rows: int, cols: int) -> dict:
    xs = [tf.c, tf.c + tf.a * cols, tf.c + tf.a * cols, tf.c]
    ys = [tf.f, tf.f, tf.f + tf.e * rows, tf.f + tf.e * rows]
    lon, lat = warp_transform(crs, "EPSG:4326", xs, ys)
    ring = [[round(x, 5), round(y, 5)] for x, y in zip(lon, lat)]
    return dict(
        polygon=ring,
        bbox=[min(lon), min(lat), max(lon), max(lat)],
        center=[round(float(np.mean(lon)), 5), round(float(np.mean(lat)), 5)],
    )


def load_series(collections: Path, collection: str, group: str, pol: str) -> list[dict]:
    path = collections / collection / "catalog.csv"
    if not path.exists():
        return []
    rows = []
    with open(path, newline="") as f:
        for r in csv.DictReader(f):
            if r["group"] != group or r["pol"] != pol or not r["median_db"]:
                continue
            valid = float(r["valid_pct"] or 0)
            rows.append(dict(date=r["date"][:10], medianDb=float(r["median_db"]),
                             meanDb=float(r["mean_db"]), validPct=round(valid, 1),
                             usable=valid >= MIN_VALID_PCT_SERIES))
    rows.sort(key=lambda x: x["date"])
    return rows


def process_sensor(case_dir_name: str, sensor_dir: Path, out_public: Path, collections: Path) -> dict | None:
    stats = json.loads((sensor_dir / "estadisticas.json").read_text(encoding="utf-8"))
    pre_s, post_s = stats["pre"], stats["post"]
    sensor = "nisar" if pre_s["group"].startswith("NISAR") else "opera"
    pol = pre_s["pol"].upper()
    key = f"{sensor}-{pol.lower()}"
    log(f"  {key}: {pre_s['date'][:10]} -> {post_s['date'][:10]}  ({pre_s['group']})")

    def locate(src: str) -> Path:
        parts = Path(src.replace("\\", "/")).parts
        return collections.joinpath(*parts[parts.index("collections") + 1:])

    pre_path, post_path = locate(pre_s["source"]), locate(post_s["source"])
    for p in (pre_path, post_path, sensor_dir / "diferencia_db.tif", sensor_dir / "mascara_cambio.tif"):
        if not p.exists():
            log(f"    AVISO: falta {p}; se omite este sensor")
            return None

    pre_db, pre_tf, crs = read_raster(pre_path)
    post_raw, post_tf, post_crs = read_raster(post_path)
    post_db = align_to(post_raw, post_tf, post_crs, pre_db.shape, pre_tf, crs)
    diff, _, _ = read_raster(sensor_dir / "diferencia_db.tif")
    mask, _, _ = read_raster(sensor_dir / "mascara_cambio.tif")
    changed = (mask == 1) & np.isfinite(diff)
    valid = np.isfinite(diff)
    thr = float(stats["threshold_db"])

    px_km2 = abs(pre_tf.a * pre_tf.e) / 1e6
    water = np.isfinite(pre_db) & (pre_db < WATER_DB[pol])
    land = valid & ~water
    changed_land = changed & ~water
    dec = lambda m: round(float((m & (diff <= -thr)).sum()) * px_km2, 3)  # noqa: E731
    inc = lambda m: round(float((m & (diff >= thr)).sum()) * px_km2, 3)  # noqa: E731

    f = max(1, int(np.ceil(max(pre_db.shape) / MAX_SIDE)))
    both = np.concatenate([pre_db[np.isfinite(pre_db)], post_db[np.isfinite(post_db)]])
    lo, hi = np.percentile(both, [2, 98])
    pre_r, post_r, diff_r = (block_reduce(a, f) for a in (pre_db, post_db, diff))
    rel = f"{out_public.name}/{key}"
    size = sum([
        save_webp(gray_rgba(pre_r, lo, hi), out_public / f"{key}_pre.webp"),
        save_webp(gray_rgba(post_r, lo, hi), out_public / f"{key}_post.webp"),
        save_webp(diff_rgba(diff_r), out_public / f"{key}_diff.webp"),
        save_webp(change_rgba(diff, changed, thr, f), out_public / f"{key}_change.webp"),
    ])
    log(f"    imágenes {pre_r.shape[1]}x{pre_r.shape[0]} px (1/{f}), {size / 1024:.0f} KB")

    collection = pre_s["source"].replace("\\", "/").split("collections/")[1].split("/")[0]
    series = load_series(collections, collection, pre_s["group"], pol)
    foot = footprint(pre_tf, crs, *pre_db.shape)
    return dict(
        key=key, sensor=sensor, pol=pol, **SENSOR_INFO[sensor], group=pre_s["group"],
        collection=collection, pre=dict(date=pre_s["date"]), post=dict(date=post_s["date"]),
        method=dict(thresholdDb=thr, direction=stats["direction"], medianFilterPx=stats["median_size"],
                    waterDb=WATER_DB[pol]),
        grid=dict(rows=stats["shape"][0], cols=stats["shape"][1], pixelSizeM=stats["pixel_size"][0],
                  crs=stats["crs"], overlapPct=stats.get("overlap_pct")),
        stats=dict(
            validAreaKm2=stats["valid_area_km2"], changedAreaKm2=stats["changed_area_km2"],
            changedPct=stats["changed_pct"], decreaseAreaKm2=stats["decrease_area_km2"],
            increaseAreaKm2=stats["increase_area_km2"], meanDiffDb=stats["mean_diff_db"],
            medianDiffDb=stats["median_diff_db"], preMeanDb=stats["pre_mean_db"],
            postMeanDb=stats["post_mean_db"],
        ),
        land=dict(
            validAreaKm2=round(float(land.sum()) * px_km2, 3),
            waterAreaKm2=round(float((valid & water).sum()) * px_km2, 3),
            changedAreaKm2=round(float(changed_land.sum()) * px_km2, 3),
            changedPct=round(100 * float(changed_land.sum()) / max(int(land.sum()), 1), 3),
            decreaseAreaKm2=dec(land), increaseAreaKm2=inc(land),
            changedOnWaterKm2=round(float((changed & water).sum()) * px_km2, 3),
        ),
        images={k: f"/analysis/{rel}_{k}.webp" for k in ("pre", "post", "diff", "change")},
        imageSize=[int(pre_r.shape[1]), int(pre_r.shape[0])],
        footprint=foot,
        dbRange=[round(float(lo), 2), round(float(hi), 2)],
        series=series,
    )


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--analysis", type=Path, default=DATA_DIR / "analisis")
    ap.add_argument("--app", type=Path, default=APP_DIR, help="Carpeta de la app web (ProyectoTal)")
    ap.add_argument("--only", nargs="+", help="Solo estos casos (nombre de carpeta en analisis)")
    args = ap.parse_args()

    collections = DATA_DIR / "collections"
    cases = []
    t0 = time.time()
    case_dirs = sorted(d for d in args.analysis.iterdir() if d.is_dir())
    log(f"Exportando {len(case_dirs)} casos desde {args.analysis}")
    for n, case_dir in enumerate(case_dirs, 1):
        if args.only and case_dir.name not in args.only:
            continue
        meta = CASES.get(case_dir.name)
        if meta is None:
            log(f"[{n}/{len(case_dirs)}] {case_dir.name}: sin metadatos en CASES, se omite")
            continue
        log(f"[{n}/{len(case_dirs)}] {case_dir.name}")
        out_public = args.app / "public" / "analysis" / meta["id"]
        sensors = []
        for sensor_dir in sorted(p for p in case_dir.iterdir() if (p / "estadisticas.json").exists()):
            s = process_sensor(case_dir.name, sensor_dir, out_public, collections)
            if s:
                sensors.append(s)
        if not sensors:
            continue
        sensors.sort(key=lambda s: s["sensor"] != "nisar")  # NISAR primero
        first = sensors[0]["footprint"]
        cases.append(dict(
            **meta, source=case_dir.name, lat=first["center"][1], lon=first["center"][0],
            startDate=min(s["pre"]["date"] for s in sensors)[:10],
            endDate=max(s["post"]["date"] for s in sensors)[:10],
            sensors=sensors,
        ))

    out_json = args.app / "data" / "analysis" / "cases.json"
    out_json.parent.mkdir(parents=True, exist_ok=True)
    payload = dict(generatedAt=time.strftime("%Y-%m-%dT%H:%M:%S"), cases=cases)
    out_json.write_text(json.dumps(payload, indent=1, ensure_ascii=False), encoding="utf-8")
    log(f"Listo: {len(cases)} casos, {sum(len(c['sensors']) for c in cases)} análisis -> {out_json} "
        f"({time.time() - t0:.0f}s)")


if __name__ == "__main__":
    main()
