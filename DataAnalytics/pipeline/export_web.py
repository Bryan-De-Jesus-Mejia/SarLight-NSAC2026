"""Convierte los resultados de data/analisis en archivos ligeros para la app web.

Por cada análisis (data/analisis/<tipo>/<caso>/<sensor_pol>/) genera, en la carpeta de la app:
  public/analysis/<caso>/<sensor>-<pol>_{pre,post,diff,change}.webp   imágenes reducidas
  data/analysis/cases.json                                            metadatos, estadísticas y series

Todo sale de archivos reales: estadisticas.json, diferencia_db.tif, mascara_cambio.tif y las
escenas pre/post de data/collections. No se inventa ningún valor. Lo único derivado es:
  - las estadísticas "en tierra": las mismas máscaras pero sin los píxeles que ya eran agua
    abierta en la imagen pre (umbral por polarización, ver WATER_DB). El agua permanente cambia
    de brillo por viento y oleaje, no por inundación ni incendio.
  - la serie temporal: mediana de dB por pasada, dentro y fuera de la zona marcada, y un
    fotograma en falso color por pasada (R = co-pol, G = cross-pol, B = co - cross).
  - la comparación de polarizaciones: el mismo par de fechas con la otra polarización.
  - la línea base por píxel (si hay >= 7 pasadas): variabilidad normal de cada píxel entre
    pasadas consecutivas, para saber qué parte del cambio marcado la supera 3 veces.
  - la cobertura del suelo de lo marcado: ESA WorldCover 2021 (10 m), leído por rangos HTTP.

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
from rasterio.transform import Affine
from rasterio.warp import transform as warp_transform
from scipy.ndimage import median_filter

from rutas import case_dirs as find_case_dirs
from search_scenes import DATA_DIR

matplotlib.use("Agg")

APP_DIR = Path(__file__).resolve().parents[2] / "nisar-explorer"
MAX_SIDE = 1400
WEBP_QUALITY = 82
# Por debajo de este valor (dB, imagen pre) un píxel se considera agua abierta.
WATER_DB = {"HH": -17.0, "VV": -17.0, "HV": -22.0, "VH": -22.0}
MIN_VALID_PCT_SERIES = 50.0
FRAME_MAX_SIDE = 900
PROBE_MAX_SIDE = 700
THUMB_WIDTH = 360
MIN_BASELINE_PAIRS = 5
PARTNER_POL = {"HV": "HH", "HH": "HV", "VH": "VV", "VV": "VH"}
CO_POLS = ("HH", "VV")

WORLDCOVER_URL = ("https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/"
                  "ESA_WorldCover_10m_2021_v200_{tile}_Map.tif")
WORLDCOVER_CLASSES = {
    10: "Tree cover", 20: "Shrubland", 30: "Grassland", 40: "Cropland", 50: "Built-up",
    60: "Bare or sparse vegetation", 70: "Snow and ice", 80: "Permanent water",
    90: "Herbaceous wetland", 95: "Mangroves", 100: "Moss and lichen",
}
GDAL_HTTP = dict(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_MAX_RETRY="3",
                 GDAL_HTTP_RETRY_DELAY="2", GDAL_HTTP_TIMEOUT="60", VSI_CACHE="TRUE",
                 CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif")

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


def nan_median(a: np.ndarray, size: int) -> np.ndarray:
    """Mismo filtro que sar_change_detection.py."""
    if size <= 1:
        return a
    ok = np.isfinite(a)
    filtered = median_filter(np.where(ok, a, 0), size=size)
    return np.where(ok, filtered, np.nan).astype(np.float32)


def med(values: np.ndarray) -> float | None:
    values = values[np.isfinite(values)]
    return round(float(np.median(values)), 3) if values.size else None


def scene_files(folder: Path, pol: str) -> dict[str, Path]:
    """{YYYY-MM-DD: archivo} de una geometría para una polarización (la primera pasada de cada día)."""
    out: dict[str, Path] = {}
    for path in sorted(folder.glob(f"*_{pol}.tif")):
        stamp = path.name.split("_")[0]
        day = f"{stamp[:4]}-{stamp[4:6]}-{stamp[6:8]}"
        out.setdefault(day, path)
    return out


def stretch(a: np.ndarray, lo: float, hi: float) -> np.ndarray:
    return (np.clip((np.nan_to_num(a, nan=lo) - lo) / max(hi - lo, 1e-6), 0, 1) * 255).astype(np.uint8)


def temporal_products(folder: Path, pol: str, pre_day: str, post_day: str, grid, masks, median_size: int,
                      out_public: Path, key: str) -> tuple[list[dict], dict | None]:
    """Recorre todas las pasadas de la geometría: serie dentro/fuera de la zona marcada,
    fotogramas en falso color y variabilidad por píxel entre pasadas consecutivas."""
    shape, tf, crs = grid
    land, changed_land, diff = masks
    files = scene_files(folder, pol)
    partner = PARTNER_POL[pol]
    partner_files = scene_files(folder, partner)
    co_is_main = pol in CO_POLS

    ff = max(1, int(np.ceil(max(shape) / FRAME_MAX_SIDE)))
    small_shape = (shape[0] // ff, shape[1] // ff)
    small_tf = tf * Affine.scale(ff)
    rest = land & ~changed_land
    rest_sample = np.zeros(shape, bool)
    rest_sample[::5, ::5] = True
    rest_sample &= rest

    series: list[dict] = []
    ranges: dict[str, tuple[float, float]] = {}
    prev: tuple[str, np.ndarray] | None = None
    sum_sq = np.zeros(shape, np.float32)
    count = np.zeros(shape, np.uint8)
    pairs = 0
    days = sorted(files)
    for n, day in enumerate(days, 1):
        raw, raw_tf, raw_crs = read_raster(files[day])
        arr = align_to(raw, raw_tf, raw_crs, shape, tf, crs)
        valid_pct = 100 * float(np.isfinite(arr[land]).mean()) if land.any() else 0.0
        usable = valid_pct >= MIN_VALID_PCT_SERIES
        entry = dict(date=day, validPct=round(valid_pct, 1), usable=usable,
                     insideDb=med(arr[changed_land]) if usable else None,
                     outsideDb=med(arr[rest_sample]) if usable else None, frame=None)

        if usable and day in partner_files:
            main_small = block_reduce(arr, ff)
            p_raw, p_tf, p_crs = read_raster(partner_files[day])
            partner_small = np.full(small_shape, np.nan, np.float32)
            reproject(p_raw, partner_small, src_transform=p_tf, src_crs=p_crs, dst_transform=small_tf,
                      dst_crs=crs, src_nodata=np.nan, dst_nodata=np.nan, resampling=Resampling.average)
            co, cross = (main_small, partner_small) if co_is_main else (partner_small, main_small)
            ratio = co - cross
            if not ranges:  # misma escala de color en todas las fechas
                for name, band in (("co", co), ("cross", cross), ("ratio", ratio)):
                    vals = band[np.isfinite(band)]
                    ranges[name] = tuple(np.percentile(vals, [2, 98])) if vals.size else (0.0, 1.0)
            ok = np.isfinite(co) & np.isfinite(cross)
            rgba = np.dstack([stretch(co, *ranges["co"]), stretch(cross, *ranges["cross"]),
                              stretch(ratio, *ranges["ratio"]), np.where(ok, 255, 0).astype(np.uint8)])
            name = f"{key}_f_{day.replace('-', '')}.webp"
            Image.fromarray(rgba, "RGBA").save(out_public / name, "WEBP", quality=76, method=6)
            entry["frame"] = f"/analysis/{out_public.name}/{name}"

        if usable:
            if prev is not None and not (prev[0] == pre_day and day == post_day):
                step = nan_median(arr - prev[1], median_size)
                ok = np.isfinite(step)
                sum_sq[ok] += step[ok] ** 2
                count[ok] += 1
                pairs += 1
            prev = (day, arr)
        series.append(entry)
        log(f"    pasada {n}/{len(days)} {day}: {valid_pct:.0f}% cubierto"
            f"{'' if usable else ' (parcial, no se usa)'}")

    baseline = None
    if pairs >= MIN_BASELINE_PAIRS:
        enough = count >= MIN_BASELINE_PAIRS
        sigma = np.full(shape, np.nan, np.float32)
        sigma[enough] = np.sqrt(sum_sq[enough] / count[enough])
        px_km2 = abs(tf.a * tf.e) / 1e6
        judged = changed_land & enough
        beyond = judged & (np.abs(diff) >= 3 * sigma)
        baseline = dict(
            passes=sum(1 for e in series if e["usable"]), pairs=pairs,
            sigmaMedianDb=med(sigma[land]),
            judgedAreaKm2=round(float(judged.sum()) * px_km2, 3),
            beyond3SigmaKm2=round(float(beyond.sum()) * px_km2, 3),
            beyond3SigmaPct=round(100 * float(beyond.sum()) / max(int(judged.sum()), 1), 1),
        )
        log(f"    línea base: {pairs} pares, sigma mediana {baseline['sigmaMedianDb']} dB, "
            f"{baseline['beyond3SigmaPct']}% de lo marcado supera 3 sigma")
    else:
        log(f"    línea base: solo {pairs} pares consecutivos (hacen falta {MIN_BASELINE_PAIRS}); se omite")
    return series, baseline


def polarisation_comparison(folder: Path, pol: str, pre_day: str, post_day: str, grid, land, thr: float,
                            direction: str, median_size: int, main_diff: np.ndarray) -> list[dict]:
    """El mismo par de fechas con cada polarización disponible, medido sobre la misma tierra."""
    shape, tf, crs = grid
    px_km2 = abs(tf.a * tf.e) / 1e6
    rows = []
    for name in (pol, PARTNER_POL[pol]):
        if name == pol:
            diff = main_diff
        else:
            files = scene_files(folder, name)
            if pre_day not in files or post_day not in files:
                continue
            a, a_tf, a_crs = read_raster(files[pre_day])
            b, b_tf, b_crs = read_raster(files[post_day])
            diff = nan_median(align_to(b, b_tf, b_crs, shape, tf, crs) - align_to(a, a_tf, a_crs, shape, tf, crs),
                              median_size)
        ok = land & np.isfinite(diff)
        dec = float((ok & (diff <= -thr)).sum()) * px_km2
        inc = float((ok & (diff >= thr)).sum()) * px_km2
        flagged = dec if direction == "decrease" else inc if direction == "increase" else dec + inc
        rows.append(dict(pol=name, analysed=name == pol, flaggedAreaKm2=round(flagged, 3),
                         decreaseAreaKm2=round(dec, 3), increaseAreaKm2=round(inc, 3),
                         medianDiffDb=med(diff[ok][::7])))
    return rows


def worldcover(grid, cache: Path) -> np.ndarray | None:
    """Clase ESA WorldCover 2021 de cada píxel de la malla (0 = sin dato). Se guarda en caché."""
    shape, tf, crs = grid
    if cache.exists():
        return np.load(cache)
    xs = [tf.c, tf.c + tf.a * shape[1]]
    ys = [tf.f, tf.f + tf.e * shape[0]]
    lon, lat = warp_transform(crs, "EPSG:4326", [xs[0], xs[1], xs[0], xs[1]], [ys[0], ys[0], ys[1], ys[1]])
    out = np.zeros(shape, np.uint8)
    tiles = {(int(np.floor(la / 3) * 3), int(np.floor(lo / 3) * 3)) for la, lo in zip(lat, lon)}
    try:
        with rasterio.Env(**GDAL_HTTP):
            for la, lo in sorted(tiles):
                tile = f"{'N' if la >= 0 else 'S'}{abs(la):02d}{'E' if lo >= 0 else 'W'}{abs(lo):03d}"
                log(f"    WorldCover: leyendo tesela {tile}")
                with rasterio.open("/vsicurl/" + WORLDCOVER_URL.format(tile=tile)) as src:
                    part = np.zeros(shape, np.uint8)
                    reproject(rasterio.band(src, 1), part, dst_transform=tf, dst_crs=crs,
                              resampling=Resampling.nearest, src_nodata=0, dst_nodata=0)
                    out = np.where(out == 0, part, out)
    except Exception as e:  # sin red o tesela ausente: la app funciona igual sin esta sección
        log(f"    AVISO: no se pudo leer WorldCover ({str(e).splitlines()[0][:110]})")
        return None
    cache.parent.mkdir(parents=True, exist_ok=True)
    np.save(cache, out)
    return out


def land_cover_stats(cover: np.ndarray, land: np.ndarray, changed_land: np.ndarray, px_km2: float) -> dict | None:
    known = cover > 0
    flagged = changed_land & known
    if not flagged.any():
        return None
    total_flagged, total_land = int(flagged.sum()), max(int((land & known).sum()), 1)
    classes = []
    for code, label in WORLDCOVER_CLASSES.items():
        hit = cover == code
        n_flagged, n_land = int((flagged & hit).sum()), int((land & hit).sum())
        if n_land == 0:
            continue
        classes.append(dict(code=code, label=label, flaggedKm2=round(n_flagged * px_km2, 3),
                            flaggedPct=round(100 * n_flagged / total_flagged, 1),
                            scenePct=round(100 * n_land / total_land, 1),
                            sceneKm2=round(n_land * px_km2, 1)))
    classes.sort(key=lambda c: -c["flaggedKm2"])
    return dict(source="ESA WorldCover 2021 v200 (10 m)", classes=classes)


def save_probe(pre_db, post_db, diff, path: Path) -> dict:
    """PNG sin pérdida para leer valores bajo el cursor: R = diferencia, G = antes, B = después."""
    f = max(1, int(np.ceil(max(diff.shape) / PROBE_MAX_SIDE)))

    def quant(a, scale, offset):
        r = block_reduce(a, f)
        q = np.clip(np.round(np.nan_to_num(r) * scale + offset), 1, 255)
        return np.where(np.isfinite(r), q, 0).astype(np.uint8)

    rgb = np.dstack([quant(diff, 10, 128), quant(pre_db, 5, 200), quant(post_db, 5, 200)])
    Image.fromarray(rgb, "RGB").save(path, "PNG", optimize=True)
    return dict(size=[int(rgb.shape[1]), int(rgb.shape[0])], diff=dict(scale=10, offset=128),
                db=dict(scale=5, offset=200))


def save_thumb(post_rgba: np.ndarray, change: np.ndarray, path: Path) -> None:
    base = Image.fromarray(post_rgba, "RGBA")
    base.alpha_composite(Image.fromarray(change, "RGBA"))
    h = max(1, round(base.height * THUMB_WIDTH / base.width))
    base.resize((THUMB_WIDTH, h), Image.LANCZOS).convert("RGB").save(path, "WEBP", quality=78, method=6)


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
    post_rgba, change_img = gray_rgba(post_r, lo, hi), change_rgba(diff, changed, thr, f)
    size = sum([
        save_webp(gray_rgba(pre_r, lo, hi), out_public / f"{key}_pre.webp"),
        save_webp(post_rgba, out_public / f"{key}_post.webp"),
        save_webp(diff_rgba(diff_r), out_public / f"{key}_diff.webp"),
        save_webp(change_img, out_public / f"{key}_change.webp"),
    ])
    log(f"    imágenes {pre_r.shape[1]}x{pre_r.shape[0]} px (1/{f}), {size / 1024:.0f} KB")
    probe = save_probe(pre_db, post_db, diff, out_public / f"{key}_probe.png")
    save_thumb(post_rgba, change_img, out_public / f"{key}_thumb.webp")

    collection = pre_s["source"].replace("\\", "/").split("collections/")[1].split("/")[0]
    foot = footprint(pre_tf, crs, *pre_db.shape)
    grid = (pre_db.shape, pre_tf, crs)
    pre_day, post_day = pre_s["date"][:10], post_s["date"][:10]
    median_size = int(stats["median_size"])
    series, baseline = temporal_products(pre_path.parent, pol, pre_day, post_day, grid,
                                         (land, changed_land, diff), median_size, out_public, key)
    polarisations = polarisation_comparison(pre_path.parent, pol, pre_day, post_day, grid, land, thr,
                                            stats["direction"], median_size, diff)
    cover = worldcover(grid, DATA_DIR / "cache" / f"worldcover_{case_dir_name}_{key}.npy")
    land_cover = land_cover_stats(cover, land, changed_land, px_km2) if cover is not None else None
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
        images={**{k: f"/analysis/{rel}_{k}.webp" for k in ("pre", "post", "diff", "change", "thumb")},
                "probe": f"/analysis/{rel}_probe.png"},
        probe=probe, baseline=baseline, polarisations=polarisations, landCover=land_cover,
        imageSize=[int(pre_r.shape[1]), int(pre_r.shape[0])],
        footprint=foot,
        dbRange=[round(float(lo), 2), round(float(hi), 2)],
        series=series,
    )


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--analysis", type=Path, default=DATA_DIR / "analisis")
    ap.add_argument("--app", type=Path, default=APP_DIR, help="Carpeta de la app web (nisar-explorer)")
    ap.add_argument("--only", nargs="+", help="Solo estos casos (nombre de carpeta en analisis)")
    args = ap.parse_args()

    collections = DATA_DIR / "collections"
    cases = []
    t0 = time.time()
    case_dirs = find_case_dirs(args.analysis)
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
