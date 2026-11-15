"""Velocidad de flujo de glaciares con series de pares NISAR GUNW descargados por fetch_glacier.py.

En 12 días el hielo rápido se mueve decenas o cientos de metros y la fase interferométrica se pierde, así
que la velocidad sale de los offsets de píxeles (correlación de amplitud entre las dos fechas):
  1. offsets en rango oblicuo y en azimut (m), filtrados por calidad y con mediana espacial
  2. se resta una rampa (plano) ajustada solo sobre terreno estable (ajuste robusto que ignora el hielo)
  3. rango oblicuo -> rango en el suelo: / sin(ángulo de incidencia)   (supone flujo horizontal)
  4. velocidad (m/día) = sqrt(rango_suelo² + azimut²) / días del par
El resultado es la magnitud de la velocidad horizontal; la dirección no se resuelve sin el rumbo de la órbita.
El ángulo de incidencia real de NISAR varía ~33-47° a lo ancho de la franja: con el valor fijo por defecto
(37°) la velocidad tiene un error de ~±15 %.

Salida en data/analisis/<colección>/:
  <geometría>/velocidad_mediana_m_dia.tif, mapa_velocidad.png    composición (mediana) de todos los pares
  <geometría>/frames/<fecha>.png                                  un mapa por par, misma escala (para animar)
  <geometría>/pares/<ref>_<sec>/velocidad_m_dia.tif, estadisticas.json
  serie_velocidad.csv, serie_velocidad.png, resumen_glaciar.json

Ejemplo:
  python pipeline/analisis_glaciar.py --collection data/collections/glaciar_jakobshavn
"""
import argparse
import csv
import json
import math
import time
import traceback
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import LogNorm

from analisis_sismo import PLOT_MAX_PX, lonlat_to_rc, nan_median, read, resolve_collection
from progress import Progress, log, setup_stdout
from sar_io import write_geotiff
from search_scenes import ROOT


def robust_plane(a: np.ndarray, iters: int = 3) -> tuple[np.ndarray, np.ndarray]:
    """Ajusta un plano solo con los píxeles que no se mueven: tras cada ajuste descarta |residuo| > 3·MAD.

    Devuelve (a - plano, máscara de terreno estable usado en el último ajuste).
    """
    rows, cols = np.nonzero(np.isfinite(a))
    step = max(1, rows.size // 200_000)
    r, c = rows[::step], cols[::step]
    v = a[r, c].astype(np.float64)
    keep = np.ones(v.size, bool)
    A = np.column_stack([np.ones(v.size), c, r]).astype(np.float64)
    coef = np.array([np.median(v), 0.0, 0.0])
    for _ in range(iters):
        if keep.sum() < 100:
            break
        coef, *_ = np.linalg.lstsq(A[keep], v[keep], rcond=None)
        res = v - A @ coef
        center = np.median(res[keep])  # el 1er ajuste sale sesgado por el hielo: se centra en la mayoría
        mad = 1.4826 * np.median(np.abs(res[keep] - center))
        keep = np.abs(res - center) < 3 * max(mad, 1e-6)
    yy, xx = np.mgrid[:a.shape[0], :a.shape[1]]
    out = (a - (coef[0] + coef[1] * xx + coef[2] * yy)).astype(np.float32)
    stable = np.zeros(a.shape, bool)
    stable[r[keep], c[keep]] = True
    return out, stable


def ymd(s: str) -> date:
    return date(int(s[:4]), int(s[4:6]), int(s[6:8]))


def analyze_pair(pair_dir: Path, days: int, args) -> dict:
    rng, transform, crs = read(pair_dir / "offset_rango.tif")
    azi, _, _ = read(pair_dir / "offset_azimut.tif")
    corr, _, _ = read(pair_dir / "correlacion_offsets.tif")
    coh, _, _ = read(pair_dir / "coherencia.tif")
    if rng is None or azi is None:
        raise RuntimeError("faltan offset_rango.tif / offset_azimut.tif")
    good = np.isfinite(rng) & np.isfinite(azi)
    if corr is not None:
        good &= np.nan_to_num(corr, nan=0) >= args.min_offset_corr
    if good.mean() < 0.01:
        raise RuntimeError(f"solo {100 * good.mean():.2f}% de offsets fiables")
    rng_f = nan_median(np.where(good, rng, np.nan), args.offset_median)
    azi_f = nan_median(np.where(good, azi, np.nan), args.offset_median)
    rng_d, stable_r = robust_plane(rng_f)
    azi_d, stable_a = robust_plane(azi_f)
    ground = rng_d / math.sin(math.radians(args.incidence))
    speed = (np.hypot(ground, azi_d) / days).astype(np.float32)

    stable = stable_r & stable_a & np.isfinite(speed)
    noise = float(np.median(speed[stable])) if stable.any() else float("nan")  # "velocidad" del terreno quieto
    px_km2 = abs(transform.a * transform.e) / 1e6
    fast = speed[np.isfinite(speed) & (speed >= args.fast)]
    vals = speed[np.isfinite(speed)]
    stats = {
        "days": days, "pixel_size_m": abs(transform.a), "crs": crs.to_string(),
        "incidence_deg_assumed": args.incidence,
        "reliable_pct": round(100 * float(np.isfinite(speed).mean()), 2),
        "noise_stable_ground_m_day": round(noise, 3),
        "speed_p50_m_day": round(float(np.median(vals)), 3),
        "speed_p95_m_day": round(float(np.percentile(vals, 95)), 2),
        "speed_max_m_day": round(float(np.percentile(vals, 99.5)), 2),
        "fast_threshold_m_day": args.fast,
        "fast_area_km2": round(fast.size * px_km2, 2),
        "fast_median_m_day": round(float(np.median(fast)), 2) if fast.size else None,
        "coherence_median": round(float(np.nanmedian(coh)), 3) if coh is not None else None,
    }
    return {"speed": speed, "coh": coh, "transform": transform, "crs": crs, "stats": stats}


def extent_km(shape, transform):
    h, w = shape
    return [transform.c / 1000, (transform.c + w * transform.a) / 1000,
            (transform.f + h * transform.e) / 1000, transform.f / 1000]


def speed_map(ax, fig, speed, transform, vmax, title):
    step = max(1, math.ceil(max(speed.shape) / PLOT_MAX_PX))
    im = ax.imshow(np.where(speed > 0.05, speed, 0.05)[::step, ::step], cmap="turbo",
                   norm=LogNorm(vmin=0.1, vmax=max(vmax, 1.0)), extent=extent_km(speed.shape, transform),
                   interpolation="nearest")
    fig.colorbar(im, ax=ax, shrink=0.8, label="m/día")
    ax.set_title(title, fontsize=10)
    ax.set_xlabel("E (km)")
    ax.set_ylabel("N (km)")


def analyze_group(group: str, pairs: list[dict], collection: Path, out: Path, args, prog) -> list[dict]:
    rows, stack, ref_shape, geo = [], [], None, None
    for p in sorted(pairs, key=lambda r: r["ref_date"]):
        tag = f"{group} {p['pair']}"
        try:
            t0 = time.time()
            r = analyze_pair(collection / p["path"], int(p["days"]), args)
        except Exception as e:
            prog.step(f"{tag}: {type(e).__name__}: {e}", status="ERROR")
            log(traceback.format_exc())
            continue
        s = r["stats"]
        mid = ymd(p["ref_date"]) + timedelta(days=int(p["days"]) / 2)
        s.update({"group": group, "ref": p["ref_date"], "sec": p["sec_date"], "mid_date": mid.isoformat(),
                  "direction": p["direction"]})
        if args.punto:
            row, col = lonlat_to_rc(*args.punto, r["transform"], r["crs"])
            win = r["speed"][max(0, row - 1):row + 2, max(0, col - 1):col + 2]
            s["point_speed_m_day"] = round(float(np.nanmedian(win)), 2) if np.isfinite(win).any() else None
        pdir = out / "pares" / p["pair"]
        pdir.mkdir(parents=True, exist_ok=True)
        write_geotiff(pdir / "velocidad_m_dia.tif", r["speed"], r["transform"], r["crs"],
                      max_z_error=0.01, units="m/dia")
        (pdir / "estadisticas.json").write_text(json.dumps(s, indent=2, ensure_ascii=False))
        rows.append(s)
        if ref_shape is None:
            ref_shape, geo = r["speed"].shape, (r["transform"], r["crs"])
        if r["speed"].shape == ref_shape:
            stack.append((p["ref_date"], r["speed"]))
        else:
            log(f"   AVISO: {p['pair']} tiene otra malla ({r['speed'].shape} vs {ref_shape}); fuera de la composición")
        point = f" | punto {s['point_speed_m_day']} m/día" if args.punto else ""
        prog.step(f"{tag}: p95 {s['speed_p95_m_day']} m/día, máx {s['speed_max_m_day']} m/día, "
                  f">{args.fast} m/día en {s['fast_area_km2']} km², ruido {s['noise_stable_ground_m_day']}"
                  f"{point} | {time.time() - t0:.0f}s")
    if not stack:
        return rows

    transform, crs = geo
    log(f"   {group}: composición mediana de {len(stack)} pares y frames ...")
    median = np.nanmedian(np.stack([s for _, s in stack]), axis=0).astype(np.float32)
    write_geotiff(out / "velocidad_mediana_m_dia.tif", median, transform, crs, max_z_error=0.01, units="m/dia",
                  pairs=str(len(stack)))
    vmax = float(np.nanpercentile(median, 99.5))
    fig, axs = plt.subplots(1, 2, figsize=(15, 7), constrained_layout=True)
    speed_map(axs[0], fig, median, transform, vmax, f"Velocidad mediana ({len(stack)} pares de 12 días)")
    if args.punto:
        row, col = lonlat_to_rc(*args.punto, transform, crs)
        axs[0].plot(transform.c / 1000 + col * transform.a / 1000, transform.f / 1000 + row * transform.e / 1000,
                    marker="o", color="w", markeredgecolor="k")
    d = [date.fromisoformat(s["mid_date"]) for s in rows]
    axs[1].plot(d, [s["speed_p95_m_day"] for s in rows], "o-", label="percentil 95 de la escena")
    axs[1].plot(d, [s["fast_median_m_day"] for s in rows], "s-", label=f"mediana del hielo > {args.fast} m/día")
    if args.punto:
        axs[1].plot(d, [s.get("point_speed_m_day") for s in rows], "^-", label=f"punto {args.punto}")
    axs[1].set_ylabel("m/día")
    axs[1].set_title("Evolución de la velocidad")
    axs[1].legend()
    axs[1].grid(alpha=0.3)
    axs[1].tick_params(axis="x", labelrotation=30)
    fig.suptitle(f"{collection.name} — {group} (NISAR banda L, offsets de píxeles)")
    fig.savefig(out / "mapa_velocidad.png", dpi=110)
    plt.close(fig)

    (out / "frames").mkdir(exist_ok=True)
    for ref, speed in stack:
        fig, ax = plt.subplots(figsize=(9, 8), constrained_layout=True)
        sec = next(s["sec"] for s in rows if s["ref"] == ref)
        speed_map(ax, fig, speed, transform, vmax, f"{group}  {ref} → {sec}")
        fig.savefig(out / "frames" / f"{ref}.png", dpi=100)
        plt.close(fig)
    return rows


def plot_series(rows: list[dict], out: Path, name: str):
    fig, ax = plt.subplots(figsize=(11, 5), constrained_layout=True)
    by_group = defaultdict(list)
    for s in rows:
        by_group[s["group"]].append(s)
    for g, items in sorted(by_group.items()):
        items.sort(key=lambda s: s["mid_date"])
        ax.plot([date.fromisoformat(s["mid_date"]) for s in items], [s["speed_p95_m_day"] for s in items],
                "o-", label=f"{g} (p95)")
    ax.set_ylabel("Velocidad (m/día)")
    ax.set_title(f"{name}: velocidad del hielo por par de 12 días")
    ax.grid(alpha=0.3)
    ax.legend()
    fig.autofmt_xdate()
    fig.savefig(out / "serie_velocidad.png", dpi=110)
    plt.close(fig)


def main():
    setup_stdout()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--collection", type=Path, required=True)
    ap.add_argument("--group", nargs="+", help="Solo geometrías cuyo nombre contenga este texto (p.ej. T131)")
    ap.add_argument("--incidence", type=float, default=37.0, help="Ángulo de incidencia supuesto, grados (def. 37)")
    ap.add_argument("--fast", type=float, default=1.0, help="Umbral de hielo rápido en m/día (def. 1)")
    ap.add_argument("--min-offset-corr", type=float, default=0.1, help="Calidad mínima de offsets (def. 0.1)")
    ap.add_argument("--offset-median", type=int, default=5, help="Filtro de mediana de offsets (def. 5)")
    ap.add_argument("--punto", nargs=2, type=float, metavar=("LON", "LAT"),
                    help="Serie temporal de velocidad en este punto (p.ej. el frente del glaciar)")
    args = ap.parse_args()

    collection = resolve_collection(args.collection)
    with open(collection / "catalog.csv", newline="") as f:
        pairs = [r for r in csv.DictReader(f) if not args.group or any(g in r["group"] for g in args.group)]
    if not pairs:
        raise SystemExit("No hay pares en catalog.csv que cumplan los filtros.")
    groups = defaultdict(list)
    for p in pairs:
        groups[p["group"]].append(p)

    out_root = ROOT / "data" / "analisis" / collection.name
    log(f"Análisis glaciar {collection.name}: {len(pairs)} pares en {len(groups)} geometrías")
    prog = Progress(len(pairs), f"Análisis glaciar {collection.name}", unit="pares", summary_every_s=0)
    rows = []
    for g, items in sorted(groups.items()):
        print()
        log(f"== {g} ({len(items)} pares)")
        rows += analyze_group(g, items, collection, out_root / g, args, prog)
    prog.summary(final=True)
    if not rows:
        raise SystemExit("Ningún par se pudo analizar.")

    out_root.mkdir(parents=True, exist_ok=True)
    fields = list(dict.fromkeys(k for s in rows for k in s))
    with open(out_root / "serie_velocidad.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(sorted(rows, key=lambda s: (s["group"], s["mid_date"])))
    plot_series(rows, out_root, collection.name)
    manifest = collection / "manifest.json"
    info = json.loads(manifest.read_text()) if manifest.exists() else {}
    top = max(rows, key=lambda s: s["speed_max_m_day"])
    summary = {
        "collection": collection.name, "bbox": info.get("bbox"), "period": [min(s["ref"] for s in rows),
                                                                             max(s["sec"] for s in rows)],
        "method": "offsets de píxeles NISAR GUNW, rampa robusta restada, incidencia supuesta "
                  f"{args.incidence}°, flujo horizontal",
        "pairs_analyzed": len(rows), "groups": sorted(groups),
        "max_speed_m_day": top["speed_max_m_day"], "max_speed_pair": f"{top['group']} {top['ref']}->{top['sec']}",
        "median_noise_m_day": round(float(np.nanmedian([s["noise_stable_ground_m_day"] for s in rows])), 3),
        "pairs": rows,
    }
    (out_root / "resumen_glaciar.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False))
    log(f"Resumen: {out_root / 'resumen_glaciar.json'}")


if __name__ == "__main__":
    main()
