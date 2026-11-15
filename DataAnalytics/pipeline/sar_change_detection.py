"""Detección de cambio SAR por diferencia logarítmica de backscatter (post - pre, en dB).

--pre/--post aceptan: GeoTIFF local (admite comodines * entre comillas o sin ellas), URL https/s3
(COG o NISAR GCOV .h5) o nombre de escena ASF. Las rutas relativas se buscan desde la carpeta
actual y, si no, desde "DataAnalytics/". La escena post se remuestrea a la malla pre.

Salidas en --out: diferencia_db.tif, mascara_cambio.tif, visualizacion.png, estadisticas.json

Ejemplo (colección de bulk_fetch.py):
  python pipeline/sar_change_detection.py \\
      --pre  "data/collections/incendio_pelempito/nisar/P083_F079_DESC/20260911T*_HV.tif" \\
      --post "data/collections/incendio_pelempito/nisar/P083_F079_DESC/20260923T*_HV.tif" \\
      --out data/analisis/incendios/incendio_pelempito/nisar_HV
Ejemplo (streaming directo):
  python pipeline/sar_change_detection.py --pol VH --bbox -70.1 18.3 -69.7 18.6 \\
      --pre OPERA_L2_RTC-S1_..._v1.0 --post OPERA_L2_RTC-S1_..._v1.0
"""
import argparse
import glob
import json
import math
import time
from datetime import datetime
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import rasterio
from rasterio.warp import Resampling, reproject
from scipy.ndimage import median_filter

import sar_io
from progress import Heartbeat, log, setup_stdout
from sar_io import SarWindow, is_remote, read_window, write_geotiff
from search_scenes import DATA_DIR, ROOT, resolve_scene_url

GLOB_CHARS = "*?["
PLOT_MAX_PX = 2000
TOTAL_STEPS = 6


def step(n: int, msg: str):
    print()
    log(f"PASO {n}/{TOTAL_STEPS}: {msg}")


def _candidates(source: str) -> list[Path]:
    p = Path(source).expanduser()
    return [p] if p.is_absolute() else [Path.cwd() / p, ROOT / p]


def _not_found(source: str) -> str:
    lines = [f"No existe ningún archivo que coincida con: {source}",
             f"  Buscado desde: {Path.cwd()}",
             f"  y desde:       {ROOT}"]
    for cand in _candidates(source):
        parent = cand.parent
        while not parent.exists() and parent != parent.parent:
            parent = parent.parent
        if parent.exists() and parent != Path("/"):
            entries = sorted(x.name + ("/" if x.is_dir() else "") for x in parent.iterdir())
            lines.append(f"Lo que sí hay en {parent}:")
            lines += [f"  {e}" for e in entries[:60]]
            if len(entries) > 60:
                lines.append(f"  ... y {len(entries) - 60} más")
            break
    lines.append("Revisa la fecha/órbita del nombre (ls de esa carpeta) o que estés en 'DataAnalytics/'.")
    return "\n".join(lines)


def resolve_source(source: str) -> str:
    """Devuelve una ruta local existente, una URL, o el texto tal cual si parece nombre de escena ASF."""
    if is_remote(source):
        return source
    has_glob = any(c in source for c in GLOB_CHARS)
    looks_like_path = has_glob or "/" in source or source.endswith((".tif", ".tiff", ".h5"))
    if not looks_like_path:
        return source
    for cand in _candidates(source):
        matches = sorted(glob.glob(str(cand))) if has_glob else ([str(cand)] if cand.exists() else [])
        matches = [m for m in matches if not m.endswith(".tmp.tif")]
        if len(matches) == 1:
            return matches[0]
        if len(matches) > 1:
            raise SystemExit(f"'{source}' coincide con {len(matches)} archivos; especifica uno:\n  "
                             + "\n  ".join(matches))
    raise SystemExit(_not_found(source))


def local_tags(path: str) -> dict:
    if is_remote(path) or not Path(path).exists():
        return {}
    with rasterio.open(path) as src:
        return src.tags()


def load(label: str, source: str, bbox, pol) -> tuple[SarWindow, dict]:
    resolved = resolve_source(source)
    if not is_remote(resolved) and not Path(resolved).exists():
        if not pol:
            raise SystemExit(f"'{source}' no es un archivo ni una URL. Si es un nombre de escena ASF, "
                             f"indica --pol (VV, VH, HH o HV).")
        log(f"[{label}] Resolviendo escena ASF {resolved} ...")
        resolved = resolve_scene_url(resolved, pol)
    log(f"[{label}] Archivo: {resolved}")
    t0 = time.time()
    with Heartbeat(f"[{label}] Leyendo imagen"):
        win = read_window(resolved, bbox, pol)
    meta = local_tags(resolved)
    meta["resolved"] = resolved
    vals = win.db[np.isfinite(win.db)]
    valid_pct = 100 * vals.size / win.db.size if win.db.size else 0
    median = f"{np.median(vals):.1f} dB" if vals.size else "n/a"
    log(f"[{label}] fecha={meta.get('date', '?')} órbita={meta.get('group', '?')} pol={win.pol} | "
        f"{win.db.shape[0]}x{win.db.shape[1]} px a {abs(win.transform.a):.0f} m ({win.crs.to_string()}) | "
        f"válidos {valid_pct:.1f}% | mediana {median} | {time.time() - t0:.1f}s")
    if not vals.size:
        raise SystemExit(f"[{label}] La imagen no tiene píxeles válidos: {resolved}")
    return win, meta


def check_pair(pre: SarWindow, post: SarWindow, mpre: dict, mpost: dict):
    if pre.pol and post.pol and pre.pol != post.pol:
        log(f"AVISO: polarizaciones distintas (pre {pre.pol}, post {post.pol}); el cambio no es comparable.")
    if mpre.get("group") and mpost.get("group") and mpre["group"] != mpost["group"]:
        log(f"AVISO: órbitas/geometrías distintas ({mpre['group']} vs {mpost['group']}); "
            f"el ángulo de visión cambia y puede dar falsos cambios.")
    if mpre.get("date") and mpost.get("date") and mpre["date"] >= mpost["date"]:
        log(f"AVISO: la fecha pre ({mpre['date']}) no es anterior a la post ({mpost['date']}).")
    if abs(abs(pre.transform.a) - abs(post.transform.a)) > 1:
        log(f"AVISO: resoluciones distintas ({abs(pre.transform.a):.0f} m vs {abs(post.transform.a):.0f} m); "
            f"se remuestrea la post a la malla pre.")


def align(post: SarWindow, pre: SarWindow) -> np.ndarray:
    out = np.full(pre.db.shape, np.nan, np.float32)
    reproject(post.db, out, src_transform=post.transform, src_crs=post.crs,
              dst_transform=pre.transform, dst_crs=pre.crs, src_nodata=np.nan,
              dst_nodata=np.nan, resampling=Resampling.bilinear)
    return out


def nan_median(a: np.ndarray, size: int) -> np.ndarray:
    if size <= 1:
        return a
    valid = np.isfinite(a)
    filtered = median_filter(np.where(valid, a, 0), size=size)
    return np.where(valid, filtered, np.nan).astype(np.float32)


def pixel_area_km2(win: SarWindow) -> float:
    t = win.transform
    area = abs(t.a * t.e - t.b * t.d)
    if win.crs.is_geographic:
        lat = t.f + t.e * win.db.shape[0] / 2
        area *= (111.32e3**2) * np.cos(np.radians(lat))
    return area / 1e6


def plot(pre_db, post_db, diff, mask, stats, path):
    step = max(1, math.ceil(max(pre_db.shape) / PLOT_MAX_PX))
    pre_db, post_db, diff, mask = (a[::step, ::step] for a in (pre_db, post_db, diff, mask))
    finite = np.concatenate([pre_db[np.isfinite(pre_db)], post_db[np.isfinite(post_db)]])
    vmin, vmax = np.percentile(finite, [2, 98]) if finite.size else (-25, 0)
    fig, axs = plt.subplots(2, 2, figsize=(12, 10), constrained_layout=True)
    for ax, img, title in [(axs[0, 0], pre_db, "Pre (dB)"), (axs[0, 1], post_db, "Post (dB)")]:
        fig.colorbar(ax.imshow(img, cmap="gray", vmin=vmin, vmax=vmax), ax=ax, shrink=0.8)
        ax.set_title(title)
    fig.colorbar(axs[1, 0].imshow(diff, cmap="RdBu", vmin=-6, vmax=6), ax=axs[1, 0], shrink=0.8)
    axs[1, 0].set_title("Post - Pre (dB)")
    axs[1, 1].imshow(post_db, cmap="gray", vmin=vmin, vmax=vmax)
    axs[1, 1].imshow(np.ma.masked_where(mask != 1, mask), cmap="autumn", alpha=0.7)
    axs[1, 1].set_title(f"Cambio: {stats['changed_area_km2']} km² ({stats['changed_pct']}%)")
    for ax in axs.flat:
        ax.set_xticks([])
        ax.set_yticks([])
    fig.savefig(path, dpi=120)
    plt.close(fig)


def main():
    setup_stdout()
    sar_io.VERBOSE = True
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pre", required=True)
    ap.add_argument("--post", required=True)
    ap.add_argument("--pol", help="Polarización (solo para .h5 NISAR remotos o nombres de escena ASF)")
    ap.add_argument("--bbox", nargs=4, type=float, metavar=("LON_MIN", "LAT_MIN", "LON_MAX", "LAT_MAX"))
    ap.add_argument("--threshold", type=float, default=3.0, help="Umbral |post-pre| en dB (def. 3)")
    ap.add_argument("--direction", choices=["decrease", "increase", "both"], default="decrease",
                    help="decrease: caída de backscatter (agua, quema); increase: subida")
    ap.add_argument("--median", type=int, default=5, help="Tamaño del filtro de mediana (0 = sin filtro)")
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args()

    t_start = time.time()
    log(f"Detección de cambio | carpeta actual: {Path.cwd()}")
    out = args.out or DATA_DIR / "change" / datetime.now().strftime("%Y%m%d_%H%M%S")
    if not out.is_absolute():
        out = ROOT / out

    step(1, "Imagen PRE")
    pre, mpre = load("PRE ", args.pre, args.bbox, args.pol)
    step(2, "Imagen POST")
    post, mpost = load("POST", args.post, args.bbox, args.pol)
    check_pair(pre, post, mpre, mpost)

    step(3, "Alineación")
    with Heartbeat("Alineando la imagen post a la malla pre"):
        post_db = align(post, pre)
    both = np.isfinite(pre.db) & np.isfinite(post_db)
    overlap = 100 * both.sum() / max(1, np.isfinite(pre.db).sum())
    log(f"Solape pre/post: {overlap:.1f}% de los píxeles válidos de la pre")
    if not both.any():
        raise SystemExit("Las imágenes pre y post no se solapan. ¿Son de la misma zona y órbita?")
    if overlap < 50:
        log("AVISO: solape menor al 50%; el resultado solo cubre parte de la zona.")

    step(4, "Diferencia y filtro de speckle")
    with Heartbeat(f"Diferencia post-pre y filtro de mediana {args.median}x{args.median}"):
        diff = nan_median(post_db - pre.db, args.median)
    valid = np.isfinite(diff)
    if args.direction == "decrease":
        changed = diff <= -args.threshold
    elif args.direction == "increase":
        changed = diff >= args.threshold
    else:
        changed = np.abs(diff) >= args.threshold
    changed &= valid
    mask = changed.astype(np.uint8)
    mask[~valid] = 255

    px_km2 = pixel_area_km2(pre)
    n_valid, n_changed = int(valid.sum()), int(changed.sum())
    vals = diff[valid]
    stats = {
        "pre": {"source": mpre["resolved"], "date": mpre.get("date"), "group": mpre.get("group"), "pol": pre.pol},
        "post": {"source": mpost["resolved"], "date": mpost.get("date"), "group": mpost.get("group"), "pol": post.pol},
        "crs": pre.crs.to_string(),
        "pixel_size": [abs(pre.transform.a), abs(pre.transform.e)],
        "shape": list(pre.db.shape),
        "threshold_db": args.threshold,
        "direction": args.direction,
        "median_size": args.median,
        "overlap_pct": round(float(overlap), 2),
        "valid_pixels": n_valid,
        "changed_pixels": n_changed,
        "valid_area_km2": round(n_valid * px_km2, 3),
        "changed_area_km2": round(n_changed * px_km2, 3),
        "changed_pct": round(100 * n_changed / n_valid, 3) if n_valid else 0.0,
        "decrease_area_km2": round(int((vals <= -args.threshold).sum()) * px_km2, 3),
        "increase_area_km2": round(int((vals >= args.threshold).sum()) * px_km2, 3),
        "mean_diff_db": round(float(vals.mean()), 3) if vals.size else None,
        "median_diff_db": round(float(np.median(vals)), 3) if vals.size else None,
        "pre_mean_db": round(float(np.nanmean(pre.db)), 3),
        "post_mean_db": round(float(np.nanmean(post_db)), 3),
    }
    step(5, "Resultados")
    log(f"Área válida {stats['valid_area_km2']} km² | cambio ({args.direction}, ±{args.threshold} dB): "
        f"{stats['changed_area_km2']} km² ({stats['changed_pct']}%) | caída {stats['decrease_area_km2']} km², "
        f"subida {stats['increase_area_km2']} km² | diferencia media {stats['mean_diff_db']} dB")

    step(6, f"Guardando en {out}")
    out.mkdir(parents=True, exist_ok=True)
    with Heartbeat("Escribiendo GeoTIFFs"):
        write_geotiff(out / "diferencia_db.tif", diff, pre.transform, pre.crs, units="dB")
        write_geotiff(out / "mascara_cambio.tif", mask, pre.transform, pre.crs, nodata=255)
    (out / "estadisticas.json").write_text(json.dumps(stats, indent=2, ensure_ascii=False))
    with Heartbeat("Generando visualizacion.png"):
        plot(pre.db, post_db, diff, mask, stats, out / "visualizacion.png")
    for name in ("diferencia_db.tif", "mascara_cambio.tif", "visualizacion.png", "estadisticas.json"):
        log(f"  {out / name}")
    log(f"Listo en {time.time() - t_start:.1f}s")


if __name__ == "__main__":
    main()
