"""Detección de cambio SAR por diferencia logarítmica de backscatter (post - pre, en dB).

--pre/--post aceptan: GeoTIFF local, URL https/s3 (COG o NISAR GCOV .h5) o nombre de escena ASF.
Para fuentes remotas solo se lee la ventana del --bbox. La escena post se remuestrea a la malla pre.

Salidas en --out: diferencia_db.tif, mascara_cambio.tif, visualizacion.png, estadisticas.json

Ejemplo (subsets locales ya descargados con fetch_subset.py):
  python pipeline/sar_change_detection.py --pre data/subsets/A_VH.tif --post data/subsets/B_VH.tif
Ejemplo (streaming directo):
  python pipeline/sar_change_detection.py --pol VH --bbox -70.1 18.3 -69.7 18.6 \\
      --pre OPERA_L2_RTC-S1_..._v1.0 --post OPERA_L2_RTC-S1_..._v1.0
"""
import argparse
import json
from datetime import datetime
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from rasterio.warp import Resampling, reproject
from scipy.ndimage import median_filter

from sar_io import SarWindow, is_remote, read_window, write_geotiff
from search_scenes import DATA_DIR, resolve_scene_url


def load(source: str, bbox, pol) -> SarWindow:
    if not (is_remote(source) or Path(source).exists()):
        if not pol:
            raise SystemExit(f"'{source}' parece un nombre de escena: indica --pol")
        source = resolve_scene_url(source, pol)
    return read_window(source, bbox, pol)


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
    finite = np.concatenate([pre_db[np.isfinite(pre_db)], post_db[np.isfinite(post_db)]])
    vmin, vmax = np.percentile(finite, [2, 98]) if finite.size else (-25, 0)
    fig, axs = plt.subplots(2, 2, figsize=(12, 10), constrained_layout=True)
    for ax, img, title in [(axs[0, 0], pre_db, "Pre (dB)"), (axs[0, 1], post_db, "Post (dB)")]:
        fig.colorbar(ax.imshow(img, cmap="gray", vmin=vmin, vmax=vmax), ax=ax, shrink=0.8)
        ax.set_title(title)
    fig.colorbar(axs[1, 0].imshow(diff, cmap="RdBu", vmin=-6, vmax=6), ax=axs[1, 0], shrink=0.8)
    axs[1, 0].set_title("Post - Pre (dB)")
    axs[1, 1].imshow(post_db, cmap="gray", vmin=vmin, vmax=vmax)
    axs[1, 1].imshow(np.ma.masked_equal(mask, 0), cmap="autumn", alpha=0.7)
    axs[1, 1].set_title(f"Cambio: {stats['changed_area_km2']} km² ({stats['changed_pct']}%)")
    for ax in axs.flat:
        ax.set_xticks([])
        ax.set_yticks([])
    fig.savefig(path, dpi=120)
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pre", required=True)
    ap.add_argument("--post", required=True)
    ap.add_argument("--pol", help="Polarización (obligatoria para .h5 NISAR o nombres de escena)")
    ap.add_argument("--bbox", nargs=4, type=float, metavar=("LON_MIN", "LAT_MIN", "LON_MAX", "LAT_MAX"))
    ap.add_argument("--threshold", type=float, default=3.0, help="Umbral |post-pre| en dB (def. 3)")
    ap.add_argument("--direction", choices=["decrease", "increase", "both"], default="decrease",
                    help="decrease: caída de backscatter (agua, quema); increase: subida")
    ap.add_argument("--median", type=int, default=5, help="Tamaño del filtro de mediana (0 = sin filtro)")
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args()

    out = args.out or DATA_DIR / "change" / datetime.now().strftime("%Y%m%d_%H%M%S")
    out.mkdir(parents=True, exist_ok=True)

    pre = load(args.pre, args.bbox, args.pol)
    post = load(args.post, args.bbox, args.pol)
    post_db = align(post, pre)

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

    px_km2 = pixel_area_km2(pre)
    n_valid, n_changed = int(valid.sum()), int(changed.sum())
    vals = diff[valid]
    stats = {
        "pre": {"source": args.pre, "pol": pre.pol},
        "post": {"source": args.post, "pol": post.pol},
        "crs": pre.crs.to_string(),
        "pixel_size": [abs(pre.transform.a), abs(pre.transform.e)],
        "shape": list(pre.db.shape),
        "threshold_db": args.threshold,
        "direction": args.direction,
        "median_size": args.median,
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

    write_geotiff(out / "diferencia_db.tif", diff, pre.transform, pre.crs, units="dB")
    write_geotiff(out / "mascara_cambio.tif", mask, pre.transform, pre.crs, nodata=255)
    (out / "estadisticas.json").write_text(json.dumps(stats, indent=2, ensure_ascii=False))
    plot(pre.db, post_db, diff, mask, stats, out / "visualizacion.png")

    print(json.dumps({k: stats[k] for k in ("changed_area_km2", "changed_pct", "valid_area_km2",
                                            "mean_diff_db")}, ensure_ascii=False))
    print(f"Resultados en {out}")


if __name__ == "__main__":
    main()
