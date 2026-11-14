"""Análisis de deformación cosísmica con pares NISAR GUNW descargados por fetch_quake.py.

Por cada par (geometría + fechas):
  1. fase corregida = fase desenvuelta - fase ionosférica (la ionosfera afecta mucho a banda L)
  2. píxeles fiables: coherencia >= --min-coh y componente conectada principal
  3. referencia: mediana de la zona estable (--ref-lonlat) o de toda la imagen
  4. desplazamiento LOS (cm) = --sign * λ/(4π) * fase   (positivo = hacia el satélite)
  5. offsets de píxeles (rango y azimut, cm): miden grandes desplazamientos cerca de la falla,
     donde la fase se decorrelaciona; también sirven para comprobar el signo de la fase
  6. coherencia baja = decorrelación (daño, deslizamientos, ruptura, cambios de superficie)

Salida en data/analisis/<colección>/<geometría>_<ref>_<sec>/:
  desplazamiento_los_cm.tif, offset_rango_los_cm.tif, offset_azimut_cm.tif, decorrelacion.tif,
  mapa_sismo.png (4 paneles), franjas.png, estadisticas.json
y data/analisis/<colección>/resumen_evento.json con todos los pares.

Ejemplo:
  python pipeline/analisis_sismo.py --collection data/collections/terremoto_venezuela
"""
import argparse
import csv
import json
import math
import time
import traceback
import warnings
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import rasterio
from rasterio.warp import transform as warp_transform
from scipy.ndimage import median_filter

from progress import Heartbeat, Progress, log, setup_stdout
from sar_io import write_geotiff
from search_scenes import ROOT

C = 299_792_458.0
DEFAULT_FREQ_HZ = 1.239e9
PLOT_MAX_PX = 2000
warnings.filterwarnings("ignore", category=RuntimeWarning)


def resolve_collection(path: Path) -> Path:
    if not path.is_absolute() and not path.exists():
        path = ROOT / path
    if not (path / "catalog.csv").exists():
        raise SystemExit(f"No encuentro {path / 'catalog.csv'}. ¿Se descargó con fetch_quake.py?")
    return path.resolve()


def read(path: Path):
    if not path.exists():
        return None, None, None
    with rasterio.open(path) as src:
        a = src.read(1).astype(np.float32)
        if src.nodata is not None and not np.isnan(src.nodata):
            a[a == src.nodata] = np.nan
        return a, src.transform, src.crs


def nan_median(a: np.ndarray, size: int) -> np.ndarray:
    if size <= 1:
        return a
    valid = np.isfinite(a)
    return np.where(valid, median_filter(np.where(valid, a, 0), size=size), np.nan).astype(np.float32)


def remove_plane(a: np.ndarray) -> np.ndarray:
    """Resta el plano a + b·x + c·y ajustado por mínimos cuadrados (rampa geométrica/orbital de los offsets)."""
    rows, cols = np.nonzero(np.isfinite(a))
    if rows.size < 100:
        return a - np.nanmedian(a)
    step = max(1, rows.size // 200_000)
    r, c = rows[::step].astype(np.float64), cols[::step].astype(np.float64)
    coef, *_ = np.linalg.lstsq(np.column_stack([np.ones_like(r), c, r]), a[rows[::step], cols[::step]], rcond=None)
    yy, xx = np.mgrid[:a.shape[0], :a.shape[1]]
    return (a - (coef[0] + coef[1] * xx + coef[2] * yy)).astype(np.float32)


def lonlat_to_rc(lon, lat, transform, crs):
    xs, ys = warp_transform("EPSG:4326", crs, [lon], [lat])
    col, row = ~transform * (xs[0], ys[0])
    return int(row), int(col)


def analyze_pair(pair_dir: Path, out: Path, meta: dict, args) -> dict:
    unw, transform, crs = read(pair_dir / "fase_desenvuelta.tif")
    coh, _, _ = read(pair_dir / "coherencia.tif")
    comp, _, _ = read(pair_dir / "componentes.tif")
    iono, _, _ = read(pair_dir / "ionosfera.tif")
    rng, _, _ = read(pair_dir / "offset_rango.tif")
    azi, _, _ = read(pair_dir / "offset_azimut.tif")
    ocorr, _, _ = read(pair_dir / "correlacion_offsets.tif")
    freq = float(meta.get("center_frequency_hz") or DEFAULT_FREQ_HZ)
    wavelength = C / freq
    px_km2 = abs(transform.a * transform.e) / 1e6
    log(f"   {unw.shape[0]}x{unw.shape[1]} px a {abs(transform.a):.0f} m | λ = {wavelength * 100:.2f} cm "
        f"(1 franja = {wavelength * 50:.2f} cm LOS)")

    phase = unw.copy()
    iono_used = False
    if iono is not None and not args.no_iono:
        frac = np.isfinite(iono[np.isfinite(unw)]).mean() if np.isfinite(unw).any() else 0
        if frac >= 0.9:
            phase = unw - iono
            iono_used = True
            log(f"   Ionosfera restada (rango {np.nanpercentile(iono, 1):.1f} a {np.nanpercentile(iono, 99):.1f} rad)")
        else:
            log(f"   AVISO: ionosfera solo válida en {100 * frac:.0f}% de la imagen; no se resta")

    valid = np.isfinite(phase)
    if coh is not None:
        valid &= np.nan_to_num(coh, nan=0) >= args.min_coh
    main_comp = None
    if comp is not None:
        valid &= np.isfinite(comp) & (comp > 0)
        if not args.all_components and valid.any():
            ids, counts = np.unique(comp[valid], return_counts=True)
            main_comp = int(ids[counts.argmax()])
            log(f"   Componente principal {main_comp}: {100 * counts.max() / counts.sum():.0f}% de los píxeles "
                f"fiables ({len(ids)} componentes)")
            valid &= comp == main_comp
    if not valid.any():
        raise RuntimeError("no quedan píxeles fiables (baja --min-coh o usa --all-components)")
    log(f"   Píxeles fiables: {100 * valid.mean():.1f}% (coherencia >= {args.min_coh})")

    if args.ref_lonlat:
        r, c = lonlat_to_rc(*args.ref_lonlat, transform, crs)
        win = phase[max(0, r - 3):r + 4, max(0, c - 3):c + 4][valid[max(0, r - 3):r + 4, max(0, c - 3):c + 4]]
        if not win.size:
            raise RuntimeError(f"el punto de referencia {args.ref_lonlat} no tiene píxeles fiables")
        ref = float(np.median(win))
        ref_desc = f"punto {args.ref_lonlat}"
    else:
        ref = float(np.median(phase[valid]))
        ref_desc = "mediana de la imagen"
    los_cm = np.where(valid, args.sign * wavelength / (4 * np.pi) * (phase - ref) * 100, np.nan).astype(np.float32)

    rng_cm = azi_cm = None
    consistency = None
    if rng is not None and azi is not None:
        good = np.isfinite(rng) & np.isfinite(azi)
        if ocorr is not None:
            good &= np.nan_to_num(ocorr, nan=0) >= args.min_offset_corr
        rng_f = nan_median(np.where(good, rng, np.nan), args.offset_median)
        azi_f = nan_median(np.where(good, azi, np.nan), args.offset_median)
        # Los offsets traen una rampa de geometría/órbita de decenas de cm en toda la escena: se resta un plano.
        # Offset de rango positivo = alejamiento del satélite; se invierte para la misma convención que la fase.
        rng_cm = (-remove_plane(rng_f) * 100).astype(np.float32)
        azi_cm = (remove_plane(azi_f) * 100).astype(np.float32)
        both = valid & np.isfinite(rng_cm)
        if both.sum() > 1000 and np.nanstd(los_cm[both]) > 0 and np.nanstd(rng_cm[both]) > 0:
            consistency = float(np.corrcoef(los_cm[both], rng_cm[both])[0, 1])
            verdict = "coherentes" if consistency > 0.2 else ("SIGNO OPUESTO: prueba --sign 1" if consistency < -0.2
                                                               else "sin señal común clara")
            log(f"   Comprobación de signo fase vs offsets: correlación {consistency:+.2f} ({verdict})")

    decor = np.zeros(unw.shape, np.uint8)
    land = np.isfinite(coh) if coh is not None else np.isfinite(unw)
    if coh is not None:
        decor[land & (coh < args.decor_coh)] = 1
    decor[~land] = 255

    vals = los_cm[np.isfinite(los_cm)]
    stats = {
        **{k: meta.get(k) for k in ("group", "ref", "sec", "days", "direction", "track", "frame", "pol",
                                    "look_direction", "cov")},
        "wavelength_cm": round(wavelength * 100, 3), "fringe_cm": round(wavelength * 50, 3),
        "pixel_size_m": abs(transform.a), "crs": crs.to_string(),
        "convention": "positivo = acercamiento al satélite (levantamiento y/o movimiento hacia el satélite)",
        "sign": args.sign, "ionosphere_removed": iono_used, "reference": ref_desc, "main_component": main_comp,
        "reliable_pct": round(100 * float(valid.mean()), 2),
        "los_toward_max_cm": round(float(np.percentile(vals, 99.5)), 2),
        "los_away_max_cm": round(float(np.percentile(vals, 0.5)), 2),
        "area_abs_los_gt_5cm_km2": round(int((np.abs(vals) > 5).sum()) * px_km2, 2),
        "area_abs_los_gt_10cm_km2": round(int((np.abs(vals) > 10).sum()) * px_km2, 2),
        "area_abs_los_gt_20cm_km2": round(int((np.abs(vals) > 20).sum()) * px_km2, 2),
        "coherence_median": round(float(np.nanmedian(coh)), 3) if coh is not None else None,
        "decorrelated_area_km2": round(int((decor == 1).sum()) * px_km2, 2),
        "offset_range_los_abs_p99_cm": round(float(np.nanpercentile(np.abs(rng_cm), 99)), 1) if rng_cm is not None else None,
        "offset_azimuth_abs_p99_cm": round(float(np.nanpercentile(np.abs(azi_cm), 99)), 1) if azi_cm is not None else None,
        "phase_vs_offset_correlation": round(consistency, 3) if consistency is not None else None,
    }

    out.mkdir(parents=True, exist_ok=True)
    with Heartbeat("Escribiendo GeoTIFFs"):
        write_geotiff(out / "desplazamiento_los_cm.tif", los_cm, transform, crs, units="cm",
                      convention=stats["convention"])
        if rng_cm is not None:
            write_geotiff(out / "offset_rango_los_cm.tif", rng_cm, transform, crs, units="cm")
            write_geotiff(out / "offset_azimut_cm.tif", azi_cm, transform, crs, units="cm")
        write_geotiff(out / "decorrelacion.tif", decor, transform, crs, nodata=255,
                      classes=f"1=coherencia<{args.decor_coh}")
    with Heartbeat("Generando mapas"):
        plot_pair(out, phase - ref, los_cm, coh, rng_cm, transform, crs, stats, args)
    (out / "estadisticas.json").write_text(json.dumps(stats, indent=2, ensure_ascii=False))
    return stats


def plot_pair(out, phase_ref, los_cm, coh, rng_cm, transform, crs, stats, args):
    step = max(1, math.ceil(max(los_cm.shape) / PLOT_MAX_PX))
    h, w = los_cm.shape
    extent = [transform.c / 1000, (transform.c + w * transform.a) / 1000,
              (transform.f + h * transform.e) / 1000, transform.f / 1000]
    epi = None
    if args.epicenter:
        xs, ys = warp_transform("EPSG:4326", crs, [args.epicenter[0]], [args.epicenter[1]])
        epi = (xs[0] / 1000, ys[0] / 1000)

    lim = max(1.0, float(np.nanpercentile(np.abs(los_cm), 98)))
    fringe_cm = args.fringe_cm or stats["fringe_cm"]
    wrapped = np.where(np.isfinite(los_cm), np.mod(los_cm, fringe_cm), np.nan)
    panels = [
        (los_cm, "RdBu_r", -lim, lim, "Desplazamiento LOS (cm, + hacia el satélite)"),
        (wrapped, "hsv", 0, fringe_cm, f"Franjas (1 ciclo = {fringe_cm:.1f} cm)"),
        (coh, "gray", 0, 1, "Coherencia (oscuro = decorrelación)"),
        (rng_cm, "RdBu_r", -max(lim, 20), max(lim, 20), "Offsets en rango (cm, + hacia el satélite)"),
    ]
    fig, axs = plt.subplots(2, 2, figsize=(13, 11), constrained_layout=True)
    for ax, (arr, cmap, vmin, vmax, title) in zip(axs.flat, panels):
        if arr is None:
            ax.set_axis_off()
            ax.set_title(title + " (no disponible)")
            continue
        im = ax.imshow(arr[::step, ::step], cmap=cmap, vmin=vmin, vmax=vmax, extent=extent,
                       interpolation="nearest")
        fig.colorbar(im, ax=ax, shrink=0.8)
        ax.set_title(title, fontsize=10)
        ax.set_xlabel("E (km)")
        ax.set_ylabel("N (km)")
        if epi:
            ax.plot(*epi, marker="*", color="k", markersize=16, markeredgecolor="w")
    fig.suptitle(f"{stats['group']}  {stats['ref']} → {stats['sec']} ({stats['days']} días) | "
                 f"máx. +{stats['los_toward_max_cm']} / {stats['los_away_max_cm']} cm LOS")
    fig.savefig(out / "mapa_sismo.png", dpi=110)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(10, 9), constrained_layout=True)
    ax.imshow(wrapped[::step, ::step], cmap="hsv", vmin=0, vmax=fringe_cm, extent=extent, interpolation="nearest")
    if epi:
        ax.plot(*epi, marker="*", color="k", markersize=18, markeredgecolor="w")
    ax.set_title(f"Interferograma NISAR {stats['group']} {stats['ref']} → {stats['sec']} "
                 f"(cada ciclo de color = {fringe_cm:.1f} cm)")
    ax.set_axis_off()
    fig.savefig(out / "franjas.png", dpi=120)
    plt.close(fig)


def main():
    setup_stdout()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--collection", type=Path, required=True)
    ap.add_argument("--group", nargs="+", help="Solo geometrías cuyo nombre contenga este texto (p.ej. T162)")
    ap.add_argument("--min-coh", type=float, default=0.3, help="Coherencia mínima para fiarse de la fase (def. 0.3)")
    ap.add_argument("--all-components", action="store_true",
                    help="Usar todas las componentes conectadas (puede haber saltos de 2π entre ellas)")
    ap.add_argument("--no-iono", action="store_true", help="No restar la fase ionosférica")
    ap.add_argument("--ref-lonlat", nargs=2, type=float, metavar=("LON", "LAT"),
                    help="Punto estable de referencia (lejos de la falla). Por defecto la mediana de la imagen")
    ap.add_argument("--sign", type=float, default=-1.0, choices=[-1.0, 1.0],
                    help="Signo de la conversión fase->desplazamiento (def. -1: + = hacia el satélite). "
                         "Si la comprobación con offsets sale opuesta, usa 1")
    ap.add_argument("--min-offset-corr", type=float, default=0.1, help="Calidad mínima de offsets (def. 0.1)")
    ap.add_argument("--offset-median", type=int, default=5, help="Filtro de mediana de offsets (def. 5)")
    ap.add_argument("--decor-coh", type=float, default=0.3, help="Coherencia bajo la cual se marca decorrelación")
    ap.add_argument("--fringe-cm", type=float, help="cm por ciclo de color en franjas (def. λ/2 ≈ 12 cm)")
    ap.add_argument("--epicenter", nargs=2, type=float, metavar=("LON", "LAT"), help="Marca el epicentro")
    args = ap.parse_args()

    collection = resolve_collection(args.collection)
    with open(collection / "catalog.csv", newline="") as f:
        pairs = [r for r in csv.DictReader(f) if not args.group or any(g in r["group"] for g in args.group)]
    if not pairs:
        raise SystemExit("No hay pares en catalog.csv que cumplan los filtros.")

    out_root = ROOT / "data" / "analisis" / collection.name
    prog = Progress(len(pairs), f"Análisis sísmico {collection.name}", unit="pares", summary_every_s=0)
    results = []
    for p in pairs:
        tag = f"{p['group']} {p['pair']}"
        print()
        log(f"== {tag} ({p['direction']}, {p['days']} días)")
        pair_dir = collection / p["path"]
        meta_file = pair_dir / "meta.json"
        meta = json.loads(meta_file.read_text()) if meta_file.exists() else {}
        meta.update({k: p[k] for k in ("group", "direction", "track", "frame", "pol", "days")})
        meta.setdefault("ref", p["ref_date"])
        meta.setdefault("sec", p["sec_date"])
        try:
            t0 = time.time()
            stats = analyze_pair(pair_dir, out_root / f"{p['group']}_{p['pair']}", meta, args)
            results.append(stats)
            prog.step(f"{tag}: LOS +{stats['los_toward_max_cm']} / {stats['los_away_max_cm']} cm | "
                      f">10 cm en {stats['area_abs_los_gt_10cm_km2']} km² | {time.time() - t0:.0f}s")
        except Exception as e:
            prog.step(f"{tag}: {type(e).__name__}: {e}", status="ERROR")
            log(traceback.format_exc())
    prog.summary(final=True)

    if results:
        manifest = collection / "manifest.json"
        event = json.loads(manifest.read_text()) if manifest.exists() else {}
        best = max(results, key=lambda s: abs(s["los_toward_max_cm"]) + abs(s["los_away_max_cm"]))
        summary = {"collection": collection.name, "event_date": event.get("event_date"), "bbox": event.get("bbox"),
                   "pairs": results, "max_signal_pair": f"{best['group']} {best['ref']}->{best['sec']}",
                   "max_los_toward_cm": best["los_toward_max_cm"], "max_los_away_cm": best["los_away_max_cm"]}
        (out_root / "resumen_evento.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False))
        log(f"Resumen del evento: {out_root / 'resumen_evento.json'}")


if __name__ == "__main__":
    main()
