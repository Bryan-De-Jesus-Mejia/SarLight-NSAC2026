"""Análisis de series temporales SAR para fenómenos agrícolas sobre una colección de bulk_fetch.py.

Modos:
  cosecha     Fecha de cosecha (o tala) por píxel = mayor caída de la polarización cruzada (HV/VH)
              entre dos fechas consecutivas. Curva de % del área con vegetación ya cosechada.
              Ej.: Punjab (arroz + quema de rastrojo), Iowa (maíz/soya).
  inundacion  Cada fecha frente a una línea base seca (fechas <= --baseline-end):
              1 = agua nueva (co-pol muy bajo), 2 = vegetación inundada (co-pol sube por doble
              rebote agua-tallo, típico de banda L), 3 = agua permanente. Ej.: Bangladesh.
  cambio      Cada fecha frente a la mediana de las fechas anteriores a --event-date:
              1 = caída (co o cross bajan >= --threshold dB: cultivo tumbado, vegetación seca o
              arrancada, cicatriz de deslizamiento), 2 = subida (escombros, suelo húmedo, agua
              somera). Ej.: ventarrón, deslizamiento, ola de calor, sequía.
  agua        Superficie de agua abierta (co-pol <= --water-max) en cada fecha: nivel de embalses
              y lagos a lo largo del tiempo (sequía, recarga).

Cada órbita (nisar/<órbita>, opera/<burst>) se analiza por separado: mezclar geometrías da falsos cambios.
Umbrales por defecto pensados para NISAR banda L (HH/HV); para OPERA banda C ajusta --water-max (~ -15).

Salida en data/analisis/<tipo>/<colección>/<fuente>_<órbita>/  (agricola_* -> agricultura):
  serie_temporal.csv / .png   estadísticas por fecha
  resumen.json                cifras clave (para la app / chatbot)
  frames/<fecha>.png          falso color por fecha (R = co-pol, G = cross-pol, B = co - cross)
  cosecha:    fecha_cosecha.tif (día del año, 0 = sin cosecha), caida_max_db.tif, mapa_cosecha.png
  inundacion: clase_<fecha>.tif, extension_maxima.tif, frecuencia_inundacion.tif, mapa_inundacion.png
  cambio:     cambio_<fecha>.tif (fechas posteriores al evento), mapa_cambio.png
  agua:       frecuencia_agua.tif (% de fechas con agua), agua_minima.tif, agua_maxima.tif, mapa_agua.png

Ejemplos:
  python pipeline/analisis_temporal.py --collection data/collections/quema_rastrojo_punjab --mode cosecha
  python pipeline/analisis_temporal.py --collection data/collections/cosecha_sequia_iowa --mode cosecha
  python pipeline/analisis_temporal.py --collection data/collections/inundacion_cultivos_bangladesh \\
      --mode inundacion --baseline-end 2026-07-05
"""
import argparse
import csv
import json
import math
import time
import traceback
import warnings
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import rasterio
from matplotlib.colors import ListedColormap
from rasterio.transform import Affine
from rasterio.warp import Resampling, reproject
from scipy.ndimage import median_filter

from progress import Heartbeat, Progress, log, setup_stdout
from rutas import TIPOS, analysis_dir
from sar_io import write_geotiff
from search_scenes import ROOT

FRAME_MAX_PX = 1500
warnings.filterwarnings("ignore", category=RuntimeWarning)


def resolve_collection(path: Path) -> Path:
    if not path.is_absolute() and not path.exists():
        path = ROOT / path
    if not (path / "catalog.csv").exists():
        raise SystemExit(f"No encuentro {path / 'catalog.csv'}. ¿Se descargó la colección con bulk_fetch.py?")
    return path.resolve()


def load_series(collection: Path, source: str, groups, start, end) -> dict:
    """{(fuente, carpeta_órbita): {fecha: {pol: ruta}}}"""
    series = defaultdict(lambda: defaultdict(dict))
    with open(collection / "catalog.csv", newline="") as f:
        for r in csv.DictReader(f):
            if not r["path"]:
                continue
            rel = Path(r["path"])
            src, folder = rel.parts[0], rel.parent.name
            if source != "all" and src != source:
                continue
            if groups and not any(g in folder for g in groups):
                continue
            if (start and r["date"][:10] < start) or (end and r["date"][:10] > end):
                continue
            series[(src, folder)][r["date"]][r["pol"]] = collection / rel
    return series


def pick_pols(by_date: dict) -> tuple[str, str]:
    pols = {p for d in by_date.values() for p in d}
    co = "HH" if "HH" in pols else "VV"
    cross = "HV" if "HV" in pols else "VH"
    return co, cross


def block_db(a: np.ndarray, transform, f: int):
    """Promedia bloques f x f en potencia lineal (reduce speckle y memoria)."""
    h, w = (a.shape[0] // f) * f, (a.shape[1] // f) * f
    lin = 10 ** (a[:h, :w] / 10)
    mean = np.nanmean(lin.reshape(h // f, f, w // f, f), axis=(1, 3))
    return (10 * np.log10(mean)).astype(np.float32), transform * Affine.scale(f)


def nan_median(a: np.ndarray, size: int) -> np.ndarray:
    if size <= 1:
        return a
    valid = np.isfinite(a)
    return np.where(valid, median_filter(np.where(valid, a, 0), size=size), np.nan).astype(np.float32)


class Grid:
    def __init__(self, shape, transform, crs):
        self.shape, self.transform, self.crs = shape, transform, crs

    @property
    def px_km2(self) -> float:
        return abs(self.transform.a * self.transform.e) / 1e6


def read_aligned(path: Path, grid: Grid | None, factor: int, median: int):
    with rasterio.open(path) as src:
        a = np.ma.filled(src.read(1, masked=True).astype(np.float32), np.nan)
        transform, crs = src.transform, src.crs
    if factor > 1:
        a, transform = block_db(a, transform, factor)
    if grid is None:
        grid = Grid(a.shape, transform, crs)
    elif a.shape != grid.shape or transform != grid.transform or crs != grid.crs:
        out = np.full(grid.shape, np.nan, np.float32)
        reproject(a, out, src_transform=transform, src_crs=crs, dst_transform=grid.transform,
                  dst_crs=grid.crs, src_nodata=np.nan, dst_nodata=np.nan, resampling=Resampling.bilinear)
        a = out
    return nan_median(a, median), grid


def km2(mask: np.ndarray, grid: Grid) -> float:
    return round(int(mask.sum()) * grid.px_km2, 3)


def save_frames(out: Path, dates, co, cross):
    frames = out / "frames"
    frames.mkdir(exist_ok=True)
    step = max(1, math.ceil(max(co[0].shape) / FRAME_MAX_PX))
    chans0 = [co[0], cross[0], co[0] - cross[0]]
    ranges = [np.nanpercentile(c[::step, ::step], [2, 98]) for c in chans0]
    for d, c, x in zip(dates, co, cross):
        rgb = np.stack([np.clip((ch[::step, ::step] - lo) / (hi - lo), 0, 1)
                        for ch, (lo, hi) in zip([c, x, c - x], ranges)], axis=-1)
        rgb = np.nan_to_num(rgb, nan=0.0)
        plt.imsave(frames / f"{d[:10]}.png", rgb)


def to_dt(d: str) -> datetime:
    return datetime.fromisoformat(d.replace("Z", "+00:00"))


def analyze_cosecha(out, dates, co, cross, grid, args) -> tuple[list, dict]:
    log("Detectando caídas de la polarización cruzada entre fechas consecutivas ...")
    x = np.stack(cross)
    diffs = x[1:] - x[:-1]
    d = np.where(np.isfinite(diffs), diffs, np.inf)
    k = d.argmin(0)
    max_drop = np.take_along_axis(d, k[None], 0)[0]
    before = np.take_along_axis(x[:-1], k[None], 0)[0]
    event = np.isfinite(max_drop) & (max_drop <= -args.threshold) & (before >= args.veg_min)
    event_idx = np.where(event, k + 1, -1)
    ever_veg = np.nanmax(x, 0) >= args.veg_min
    doy = np.array([to_dt(dt).timetuple().tm_yday for dt in dates], np.uint16)

    fecha = np.where(event, doy[np.clip(event_idx, 0, None)], 0).astype(np.uint16)
    write_geotiff(out / "fecha_cosecha.tif", fecha, grid.transform, grid.crs, nodata=0,
                  units="day_of_year", year=dates[0][:4])
    write_geotiff(out / "caida_max_db.tif", np.where(np.isfinite(max_drop), max_drop, np.nan).astype(np.float32),
                  grid.transform, grid.crs, units="dB")

    rows = []
    n_veg = max(1, int(ever_veg.sum()))
    for t, dt in enumerate(dates):
        row = {"date": dt, "co_median_db": round(float(np.nanmedian(co[t])), 3),
               "cross_median_db": round(float(np.nanmedian(cross[t])), 3),
               "valid_pct": round(100 * float(np.isfinite(cross[t]).mean()), 2),
               "drop_since_prev_km2": 0.0, "rise_since_prev_km2": 0.0,
               "harvested_cum_km2": km2(event & (event_idx <= t), grid),
               "harvested_cum_pct": round(100 * int((event & (event_idx <= t)).sum()) / n_veg, 2)}
        if t:
            row["drop_since_prev_km2"] = km2((diffs[t - 1] <= -args.threshold) & (x[t - 1] >= args.veg_min), grid)
            row["rise_since_prev_km2"] = km2(diffs[t - 1] >= args.threshold, grid)
        rows.append(row)
        log(f"  {dt[:10]}  cross {row['cross_median_db']:6.1f} dB | caída vs anterior "
            f"{row['drop_since_prev_km2']:9.2f} km² | cosechado acumulado {row['harvested_cum_pct']:5.1f}%")

    peak = max(rows[1:], key=lambda r: r["drop_since_prev_km2"])
    event_dates = fecha[event]
    summary = {
        "vegetated_area_km2": km2(ever_veg, grid),
        "harvested_area_km2": km2(event, grid),
        "harvested_pct_of_vegetated": round(100 * int(event.sum()) / n_veg, 2),
        "peak_interval_end": peak["date"], "peak_interval_drop_km2": peak["drop_since_prev_km2"],
        "median_harvest_doy": int(np.median(event_dates)) if event_dates.size else None,
        "mean_max_drop_db": round(float(max_drop[event].mean()), 3) if event.any() else None,
    }

    fig, ax = plt.subplots(figsize=(10, 8), constrained_layout=True)
    im = ax.imshow(np.ma.masked_equal(fecha, 0), cmap="viridis", vmin=doy.min(), vmax=doy.max())
    cb = fig.colorbar(im, ax=ax, shrink=0.8)
    cb.set_ticks(doy)
    cb.set_ticklabels([dt[:10] for dt in dates])
    ax.set_title(f"Fecha de cosecha estimada ({summary['harvested_area_km2']} km², "
                 f"{summary['harvested_pct_of_vegetated']}% del área con vegetación)")
    ax.set_xticks([]), ax.set_yticks([])
    fig.savefig(out / "mapa_cosecha.png", dpi=120)
    plt.close(fig)
    return rows, summary


def analyze_inundacion(out, dates, co, cross, grid, args) -> tuple[list, dict]:
    base_idx = [i for i, d in enumerate(dates) if args.baseline_end and d[:10] <= args.baseline_end] or [0]
    if len(base_idx) >= len(dates):
        raise SystemExit("La línea base incluye todas las fechas; ajusta --baseline-end.")
    log(f"Línea base seca: {', '.join(dates[i][:10] for i in base_idx)}")
    base_co = np.nanmedian(np.stack([co[i] for i in base_idx]), 0)
    permanent = base_co <= args.water_max

    rows, classes = [], []
    for t, dt in enumerate(dates):
        valid = np.isfinite(co[t]) & np.isfinite(base_co)
        water = valid & (co[t] <= args.water_max)
        cls = np.zeros(grid.shape, np.uint8)
        cls[water & ~permanent] = 1
        cls[valid & ~water & ~permanent & (co[t] - base_co >= args.threshold)] = 2
        cls[water & permanent] = 3
        cls[~valid] = 255
        classes.append(cls)
        write_geotiff(out / f"clase_{dt[:10]}.tif", cls, grid.transform, grid.crs, nodata=255, date=dt,
                      classes="1=agua nueva,2=vegetacion inundada,3=agua permanente")
        row = {"date": dt, "is_baseline": t in base_idx,
               "co_median_db": round(float(np.nanmedian(co[t])), 3),
               "cross_median_db": round(float(np.nanmedian(cross[t])), 3),
               "valid_pct": round(100 * float(valid.mean()), 2),
               "new_water_km2": km2(cls == 1, grid), "flooded_veg_km2": km2(cls == 2, grid),
               "permanent_water_km2": km2(cls == 3, grid)}
        row["flood_total_km2"] = round(row["new_water_km2"] + row["flooded_veg_km2"], 3)
        rows.append(row)
        log(f"  {dt[:10]}{' (base)' if row['is_baseline'] else '       '} agua nueva {row['new_water_km2']:9.2f} km² | "
            f"veg. inundada {row['flooded_veg_km2']:9.2f} km² | agua permanente {row['permanent_water_km2']:9.2f} km²")

    post = [c for t, c in enumerate(classes) if t not in base_idx]
    stack = np.stack(post)
    any_open, any_veg = (stack == 1).any(0), (stack == 2).any(0)
    extent = np.where(any_open, 1, np.where(any_veg, 2, 0)).astype(np.uint8)
    n_obs = (stack != 255).sum(0)
    freq = np.where(n_obs > 0, 100 * ((stack == 1) | (stack == 2)).sum(0) / np.maximum(n_obs, 1), 255).astype(np.uint8)
    write_geotiff(out / "extension_maxima.tif", extent, grid.transform, grid.crs, nodata=None,
                  classes="1=agua nueva,2=vegetacion inundada")
    write_geotiff(out / "frecuencia_inundacion.tif", freq, grid.transform, grid.crs, nodata=255, units="percent")

    peak = max((r for r in rows if not r["is_baseline"]), key=lambda r: r["flood_total_km2"])
    summary = {
        "baseline_dates": [dates[i] for i in base_idx],
        "peak_date": peak["date"], "peak_flood_km2": peak["flood_total_km2"],
        "peak_new_water_km2": peak["new_water_km2"], "peak_flooded_veg_km2": peak["flooded_veg_km2"],
        "max_extent_km2": km2(extent > 0, grid), "max_extent_open_water_km2": km2(extent == 1, grid),
        "max_extent_flooded_veg_km2": km2(extent == 2, grid),
        "permanent_water_km2": km2(permanent, grid),
    }

    step = max(1, math.ceil(max(grid.shape) / 2000))
    fig, ax = plt.subplots(figsize=(10, 8), constrained_layout=True)
    bg = base_co[::step, ::step]
    ax.imshow(bg, cmap="gray", vmin=np.nanpercentile(bg, 2), vmax=np.nanpercentile(bg, 98))
    ax.imshow(np.ma.masked_equal(extent[::step, ::step], 0), cmap=ListedColormap(["#1f6fff", "#19c37d"]),
              vmin=1, vmax=2, alpha=0.8, interpolation="nearest")
    ax.imshow(np.ma.masked_where(~permanent[::step, ::step], permanent[::step, ::step]),
              cmap=ListedColormap(["#0b1f4d"]), alpha=0.9, interpolation="nearest")
    ax.set_title(f"Extensión máxima: azul = agua nueva ({summary['max_extent_open_water_km2']} km²), "
                 f"verde = vegetación inundada ({summary['max_extent_flooded_veg_km2']} km²)")
    ax.set_xticks([]), ax.set_yticks([])
    fig.savefig(out / "mapa_inundacion.png", dpi=120)
    plt.close(fig)
    return rows, summary


def analyze_cambio(out, dates, co, cross, grid, args) -> tuple[list, dict]:
    if not args.event_date:
        raise SystemExit("El modo cambio necesita --event-date YYYY-MM-DD.")
    base_idx = [i for i, d in enumerate(dates) if d[:10] < args.event_date]
    post_idx = [i for i, d in enumerate(dates) if d[:10] >= args.event_date]
    if not base_idx or not post_idx:
        raise SystemExit(f"Hace falta al menos una fecha antes y otra después de {args.event_date}.")
    log(f"Línea base (antes del evento): {', '.join(dates[i][:10] for i in base_idx)}")
    base_co = np.nanmedian(np.stack([co[i] for i in base_idx]), 0)
    base_x = np.nanmedian(np.stack([cross[i] for i in base_idx]), 0)

    rows, first = [], None
    for t, dt in enumerate(dates):
        d_co, d_x = co[t] - base_co, cross[t] - base_x
        valid = np.isfinite(d_co) & np.isfinite(d_x)
        lo, hi = np.fmin(d_co, d_x), np.fmax(d_co, d_x)
        drop = valid & (lo <= -args.threshold) & (-lo >= hi)
        rise = valid & (hi >= args.threshold) & ~drop
        row = {"date": dt, "is_baseline": t in base_idx,
               "co_median_db": round(float(np.nanmedian(co[t])), 3),
               "cross_median_db": round(float(np.nanmedian(cross[t])), 3),
               "co_change_median_db": round(float(np.nanmedian(d_co)), 3),
               "cross_change_median_db": round(float(np.nanmedian(d_x)), 3),
               "valid_pct": round(100 * float(valid.mean()), 2),
               "drop_km2": km2(drop, grid), "rise_km2": km2(rise, grid)}
        rows.append(row)
        log(f"  {dt[:10]}{' (base)' if row['is_baseline'] else '       '} caída {row['drop_km2']:9.2f} km² | "
            f"subida {row['rise_km2']:9.2f} km² | Δ{args.cross_label} mediana {row['cross_change_median_db']:+.2f} dB")
        if t in post_idx:
            cls = np.where(drop, 1, np.where(rise, 2, 0)).astype(np.uint8)
            cls[~valid] = 255
            write_geotiff(out / f"cambio_{dt[:10]}.tif", cls, grid.transform, grid.crs, nodata=255, date=dt,
                          classes=f"1=caida>={args.threshold}dB,2=subida>={args.threshold}dB",
                          event_date=args.event_date)
            if first is None:
                first = (dt, drop, rise)

    post_rows = [rows[i] for i in post_idx]
    peak = max(post_rows, key=lambda r: r["drop_km2"])
    summary = {
        "event_date": args.event_date, "baseline_dates": [dates[i] for i in base_idx],
        "first_post_date": first[0], "first_post_drop_km2": rows[post_idx[0]]["drop_km2"],
        "first_post_rise_km2": rows[post_idx[0]]["rise_km2"],
        "peak_drop_date": peak["date"], "peak_drop_km2": peak["drop_km2"],
        "last_date": dates[-1], "last_drop_km2": rows[-1]["drop_km2"], "last_rise_km2": rows[-1]["rise_km2"],
    }

    dt, drop, rise = first
    step = max(1, math.ceil(max(grid.shape) / 2000))
    fig, ax = plt.subplots(figsize=(10, 8), constrained_layout=True)
    bg = base_co[::step, ::step]
    ax.imshow(bg, cmap="gray", vmin=np.nanpercentile(bg, 2), vmax=np.nanpercentile(bg, 98))
    overlay = np.where(drop, 1, np.where(rise, 2, 0))[::step, ::step]
    ax.imshow(np.ma.masked_equal(overlay, 0), cmap=ListedColormap(["#e74c3c", "#2e86de"]), vmin=1, vmax=2,
              alpha=0.8, interpolation="nearest")
    ax.set_title(f"Cambio {dt[:10]} vs antes del {args.event_date}: rojo = caída "
                 f"({summary['first_post_drop_km2']} km²), azul = subida ({summary['first_post_rise_km2']} km²)")
    ax.set_xticks([]), ax.set_yticks([])
    fig.savefig(out / "mapa_cambio.png", dpi=120)
    plt.close(fig)
    return rows, summary


def analyze_agua(out, dates, co, cross, grid, args) -> tuple[list, dict]:
    rows, masks = [], []
    for t, dt in enumerate(dates):
        valid = np.isfinite(co[t])
        water = valid & (co[t] <= args.water_max)
        masks.append(np.where(valid, water, False))
        row = {"date": dt, "co_median_db": round(float(np.nanmedian(co[t])), 3),
               "cross_median_db": round(float(np.nanmedian(cross[t])), 3),
               "valid_pct": round(100 * float(valid.mean()), 2), "water_km2": km2(water, grid)}
        rows.append(row)
        log(f"  {dt[:10]}  agua {row['water_km2']:9.3f} km² | válido {row['valid_pct']:5.1f}%")

    stack = np.stack(masks)
    freq = (100 * stack.mean(0)).astype(np.uint8)
    i_min = min(range(len(rows)), key=lambda i: rows[i]["water_km2"])
    i_max = max(range(len(rows)), key=lambda i: rows[i]["water_km2"])
    write_geotiff(out / "frecuencia_agua.tif", freq, grid.transform, grid.crs, nodata=None, units="percent")
    write_geotiff(out / "agua_minima.tif", masks[i_min].astype(np.uint8), grid.transform, grid.crs, nodata=None,
                  date=dates[i_min])
    write_geotiff(out / "agua_maxima.tif", masks[i_max].astype(np.uint8), grid.transform, grid.crs, nodata=None,
                  date=dates[i_max])
    first, last = rows[0]["water_km2"], rows[-1]["water_km2"]
    summary = {
        "first_date": dates[0], "first_water_km2": first, "last_date": dates[-1], "last_water_km2": last,
        "change_km2": round(last - first, 3),
        "change_pct": round(100 * (last - first) / first, 1) if first else None,
        "min_date": dates[i_min], "min_water_km2": rows[i_min]["water_km2"],
        "max_date": dates[i_max], "max_water_km2": rows[i_max]["water_km2"],
        "range_pct_of_max": round(100 * (rows[i_max]["water_km2"] - rows[i_min]["water_km2"])
                                  / rows[i_max]["water_km2"], 1) if rows[i_max]["water_km2"] else None,
    }

    step = max(1, math.ceil(max(grid.shape) / 2000))
    fig, ax = plt.subplots(figsize=(10, 8), constrained_layout=True)
    bg = np.nanmedian(np.stack(co), 0)[::step, ::step]
    ax.imshow(bg, cmap="gray", vmin=np.nanpercentile(bg, 2), vmax=np.nanpercentile(bg, 98))
    both = (masks[i_min] & masks[i_max])[::step, ::step]
    only_max = (masks[i_max] & ~masks[i_min])[::step, ::step]
    ax.imshow(np.ma.masked_equal(np.where(both, 1, np.where(only_max, 2, 0)), 0),
              cmap=ListedColormap(["#0b3d91", "#5dade2"]), vmin=1, vmax=2, alpha=0.85, interpolation="nearest")
    ax.set_title(f"Agua: azul oscuro = en ambas fechas, celeste = solo en {dates[i_max][:10]} "
                 f"({summary['max_water_km2']} km²) y no en {dates[i_min][:10]} ({summary['min_water_km2']} km²)")
    ax.set_xticks([]), ax.set_yticks([])
    fig.savefig(out / "mapa_agua.png", dpi=120)
    plt.close(fig)
    return rows, summary


def plot_series(out, rows, mode, co_pol, cross_pol, title):
    t = [to_dt(r["date"]) for r in rows]
    fig, (a1, a2) = plt.subplots(2, 1, figsize=(10, 7), sharex=True, constrained_layout=True)
    a1.plot(t, [r["co_median_db"] for r in rows], "o-", label=co_pol)
    a1.plot(t, [r["cross_median_db"] for r in rows], "s-", label=cross_pol)
    a1.set_ylabel("Mediana (dB)")
    a1.legend()
    a1.set_title(title)
    if mode == "cosecha":
        a2.plot(t, [r["harvested_cum_pct"] for r in rows], "o-", color="#c0392b")
        a2.set_ylabel("% área cosechada (acumulado)")
    elif mode == "cambio":
        a2.plot(t, [r["drop_km2"] for r in rows], "o-", color="#e74c3c", label="Caída vs antes del evento")
        a2.plot(t, [r["rise_km2"] for r in rows], "s-", color="#2e86de", label="Subida vs antes del evento")
        a2.set_ylabel("km²")
        a2.legend()
    elif mode == "agua":
        a2.plot(t, [r["water_km2"] for r in rows], "o-", color="#1f6fff")
        a2.set_ylabel("Superficie de agua (km²)")
    else:
        a2.plot(t, [r["new_water_km2"] for r in rows], "o-", label="Agua nueva")
        a2.plot(t, [r["flooded_veg_km2"] for r in rows], "s-", label="Vegetación inundada")
        a2.set_ylabel("km²")
        a2.legend()
    a2.xaxis.set_major_formatter(mdates.DateFormatter("%d-%b"))
    for a in (a1, a2):
        a.grid(alpha=0.3)
    fig.savefig(out / "serie_temporal.png", dpi=120)
    plt.close(fig)


def main():
    setup_stdout()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--collection", type=Path, required=True)
    ap.add_argument("--mode", choices=["cosecha", "inundacion", "cambio", "agua"], required=True)
    ap.add_argument("--source", choices=["all", "nisar", "opera"], default="all")
    ap.add_argument("--group", nargs="+", help="Solo órbitas cuyo nombre contenga este texto (p.ej. P084)")
    ap.add_argument("--start", help="YYYY-MM-DD")
    ap.add_argument("--end", help="YYYY-MM-DD")
    ap.add_argument("--downsample", type=int, default=2,
                    help="Promedia bloques NxN (def. 2: 10 m -> 20 m; menos speckle y memoria). 1 = sin reducir")
    ap.add_argument("--median", type=int, default=3, help="Filtro de mediana por fecha (def. 3, 0 = sin filtro)")
    ap.add_argument("--threshold", type=float, default=3.0,
                    help="dB de cambio: caída de cross-pol (cosecha) o subida de co-pol (veg. inundada). Def. 3")
    ap.add_argument("--veg-min", type=float, default=-22.0,
                    help="cosecha: cross-pol mínimo (dB) para considerar que había vegetación. Def. -22")
    ap.add_argument("--water-max", type=float, default=-18.0,
                    help="inundacion/agua: co-pol máximo (dB) para considerar agua abierta. Def. -18 (banda L)")
    ap.add_argument("--baseline-end", help="inundacion: última fecha (YYYY-MM-DD) de la línea base seca. "
                                           "Por defecto solo la primera fecha")
    ap.add_argument("--event-date", help="cambio: fecha del evento (YYYY-MM-DD); la línea base son las fechas "
                                         "anteriores")
    ap.add_argument("--tipo", choices=sorted(set(TIPOS.values())) + ["otros"],
                    help="Carpeta de tipo en data/analisis (por defecto según el prefijo del nombre)")
    ap.add_argument("--no-frames", action="store_true", help="No generar imágenes por fecha")
    args = ap.parse_args()

    collection = resolve_collection(args.collection)
    series = load_series(collection, args.source, args.group, args.start, args.end)
    log(f"Colección {collection.name}: {len(series)} órbitas | modo {args.mode}")
    if not series:
        raise SystemExit("No hay imágenes que cumplan los filtros en catalog.csv.")

    prog = Progress(len(series), f"Análisis {args.mode}", unit="órbitas", summary_every_s=0)
    for (src, folder), by_date in sorted(series.items()):
        tag = f"{src}/{folder}"
        try:
            msg = analyze_orbit(collection, src, folder, by_date, args)
            if msg:
                prog.step(f"{tag}: {msg}")
            else:
                prog.step(f"{tag}: menos de 2 fechas", status="SALTADA")
        except Exception as e:
            prog.step(f"{tag}: {type(e).__name__}: {e}", status="ERROR")
            log(traceback.format_exc())
    prog.summary(final=True)


def analyze_orbit(collection: Path, src: str, folder: str, by_date: dict, args) -> str | None:
    t0 = time.time()
    co_pol, cross_pol = pick_pols(by_date)
    dates = sorted(d for d, p in by_date.items() if co_pol in p and cross_pol in p)
    print()
    log(f"== {src}/{folder}: {len(dates)} fechas con {co_pol}+{cross_pol}")
    if len(dates) < 2:
        return None
    out = analysis_dir(collection.name, args.tipo) / f"{src}_{folder}"
    out.mkdir(parents=True, exist_ok=True)

    grid, co, cross = None, [], []
    load = Progress(len(dates), f"Carga {folder} (downsample {args.downsample}, mediana {args.median})",
                    unit="fechas", summary_every_s=float("inf"))
    for d in dates:
        c, grid = read_aligned(by_date[d][co_pol], grid, args.downsample, args.median)
        x, grid = read_aligned(by_date[d][cross_pol], grid, args.downsample, args.median)
        co.append(c)
        cross.append(x)
        load.step(f"{d[:10]} {c.shape[0]}x{c.shape[1]} px a {abs(grid.transform.a):.0f} m | "
                  f"{co_pol} {np.nanmedian(c):.1f} dB, {cross_pol} {np.nanmedian(x):.1f} dB")

    with Heartbeat(f"Análisis de {args.mode} ({folder})"):
        args.cross_label = cross_pol
        analyze = {"cosecha": analyze_cosecha, "inundacion": analyze_inundacion,
                   "cambio": analyze_cambio, "agua": analyze_agua}[args.mode]
        rows, summary = analyze(out, dates, co, cross, grid, args)

    with open(out / "serie_temporal.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    with Heartbeat("Gráfica de la serie temporal"):
        plot_series(out, rows, args.mode, co_pol, cross_pol, f"{collection.name} — {src} {folder}")
    if not args.no_frames:
        with Heartbeat(f"Imágenes en falso color ({len(dates)} fechas)"):
            save_frames(out, dates, co, cross)

    summary = {"collection": collection.name, "source": src, "orbit": folder, "mode": args.mode,
               "co_pol": co_pol, "cross_pol": cross_pol, "dates": dates,
               "pixel_size_m": abs(grid.transform.a), "crs": grid.crs.to_string(),
               "params": {k: getattr(args, k) for k in ("downsample", "median", "threshold", "veg_min",
                                                         "water_max", "baseline_end", "event_date")},
               **summary}
    (out / "resumen.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False))
    key = {k: v for k, v in summary.items() if k.endswith(("km2", "pct_of_vegetated", "date"))}
    log(f"   Resumen: {json.dumps(key, ensure_ascii=False)}")
    log(f"   Resultados en {out}")
    return f"{len(dates)} fechas en {time.time() - t0:.0f}s"


if __name__ == "__main__":
    main()
