"""Detección de agua e inundaciones sobre una colección OPERA RTC-S1 (VV/VH en dB) de bulk_fetch.py.

Fase 1 (water): por cada escena con VV y VH calcula la probabilidad de agua.
  --method model      U-Net SAR_3_band_model.onnx (entrada VV, VH, VV-VH en dB; preprocesado
                      tomado de los metadatos del propio ONNX). Pesado en CPU.
  --method threshold  umbral clásico VV < --vv-max y VH < --vh-max (instantáneo; para comparar).
Fase 2 (floods): por cada burst, frecuencia de agua en toda la serie temporal (occurrence.tif).
  Inundación en una fecha = agua en esa fecha Y normalmente seco (occurrence < --dry-max).

Salida en <colección>/flood_<método>/:
  <burst>/<fecha>_water_prob.tif  probabilidad de agua 0-100 (uint8, 255 = sin dato)
  <burst>/<fecha>_flood.tif       1 = inundado, 0 = no, 255 = sin dato
  <burst>/occurrence.tif          % de fechas en que cada píxel fue agua
  water_catalog.csv               área de agua por escena (fase 1, reanudable)
  flood_summary.csv               área de agua e inundación por burst y fecha (fase 2)

Notas: el modelo se entrenó con Sentinel-1 GRD (sigma0); OPERA es gamma0 RTC a 30 m, ~0.5-1.5 dB más
alto según el ángulo de incidencia. Validar contra OPERA DSWx-S1 (producto oficial de agua, PO.DAAC).

Ejemplos:
  python pipeline/flood_detection.py --collection data/collections/isla_2026
  python pipeline/flood_detection.py --collection data/collections/isla_2026 --group T171_366115 --start 2026-09-01
  python pipeline/flood_detection.py --collection data/collections/isla_2026 --method threshold
"""
import argparse
import csv
import json
import time
import traceback
from collections import defaultdict
from pathlib import Path

import numpy as np
import rasterio
from rasterio.warp import Resampling, reproject

from progress import Heartbeat, Progress, log, setup_stdout
from sar_io import write_geotiff
from search_scenes import ROOT

MODEL_PATH = ROOT / "models" / "SAR_3_band_model.onnx"
NODATA = 255
WATER_FIELDS = ["scene", "group", "date", "path", "valid_km2", "water_km2", "water_pct", "seconds"]


def slug(group: str) -> str:
    return "_".join(group.split()[1:])


def stamp(date: str) -> str:
    return date.replace("-", "").replace(":", "").rstrip("Z")


class WaterModel:
    def __init__(self, path: Path, chip: int, overlap: int):
        import onnx
        import onnxruntime as ort

        meta = {p.key: p.value for p in onnx.load(str(path), load_external_data=False).metadata_props}
        assert json.loads(meta["channel_order"]) == ["VV", "VH", "VV-VH"], meta["channel_order"]
        assert meta["input_scale"] == "dB"
        self.mean = np.array(json.loads(meta["normalization_mean"]), np.float32)[:, None, None]
        self.std = np.array(json.loads(meta["normalization_std"]), np.float32)[:, None, None]
        self.stride_mult = int(meta["output_stride"])
        self.session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
        self.chip, self.overlap = chip, overlap

    def predict(self, vv: np.ndarray, vh: np.ndarray) -> np.ndarray:
        """Probabilidad de agua [0,1] por píxel (NaN donde no hay dato)."""
        valid = np.isfinite(vv) & np.isfinite(vh)
        x = np.stack([vv, vh, vv - vh]).astype(np.float32)
        x = np.where(valid, x, self.mean)  # inválidos = media del canal (=> 0 tras normalizar)
        x = (x - self.mean) / self.std
        h, w = vv.shape
        c, step = self.chip, self.chip - self.overlap
        ph, pw = max(h, c), max(w, c)
        ph += (-ph) % self.stride_mult
        pw += (-pw) % self.stride_mult
        x = np.pad(x, ((0, 0), (0, ph - h), (0, pw - w)))
        acc = np.zeros((ph, pw), np.float32)
        cnt = np.zeros((ph, pw), np.float32)
        rows = sorted({min(r, ph - c) for r in range(0, ph, step)})
        cols = sorted({min(q, pw - c) for q in range(0, pw, step)})
        total = len(rows) * len(cols)
        report_every = max(1, total // 10)
        t0, n = time.time(), 0
        for r in rows:
            for q in cols:
                prob = self.session.run(["water_prob"], {"image": x[None, :, r:r + c, q:q + c]})[0][0, 0]
                acc[r:r + c, q:q + c] += prob
                cnt[r:r + c, q:q + c] += 1
                n += 1
                if total >= 10 and (n % report_every == 0 or n == total):
                    log(f"     modelo: tile {n}/{total} ({100 * n / total:.0f}%) | {time.time() - t0:.0f}s")
        out = (acc / cnt)[:h, :w]
        out[~valid] = np.nan
        return out


def threshold_prob(vv, vh, vv_max, vh_max) -> np.ndarray:
    valid = np.isfinite(vv) & np.isfinite(vh)
    out = ((vv < vv_max) & (vh < vh_max)).astype(np.float32)
    out[~valid] = np.nan
    return out


def pixel_km2(transform) -> float:
    return abs(transform.a * transform.e) / 1e6


def read_db(path: Path):
    with rasterio.open(path) as src:
        return src.read(1).astype(np.float32), src.transform, src.crs


def opera_scenes(collection: Path, groups, start, end) -> list[dict]:
    by_scene = defaultdict(dict)
    with open(collection / "catalog.csv", newline="") as f:
        for r in csv.DictReader(f):
            if r["platform"] == "NISAR" or not r["path"] or r["pol"] not in ("VV", "VH"):
                continue
            by_scene[r["scene"]].update(scene=r["scene"], group=r["group"], date=r["date"])
            by_scene[r["scene"]][r["pol"]] = collection / r["path"]
    scenes = [s for s in by_scene.values() if "VV" in s and "VH" in s]
    if groups:
        scenes = [s for s in scenes if any(g in s["group"].replace(" ", "_") for g in groups)]
    if start:
        scenes = [s for s in scenes if s["date"][:10] >= start]
    if end:
        scenes = [s for s in scenes if s["date"][:10] <= end]
    return sorted(scenes, key=lambda s: (s["group"], s["date"]))


def stage_water(scenes, out_root: Path, args):
    catalog = out_root / "water_catalog.csv"
    done = set()
    if catalog.exists():
        with open(catalog, newline="") as f:
            done = {r["scene"] for r in csv.DictReader(f)}
    todo = [s for s in scenes if s["scene"] not in done]
    log(f"Fase 1 (agua, método {args.method}): {len(scenes)} escenas con VV+VH, {len(done)} ya hechas, "
        f"{len(todo)} pendientes")
    if not todo:
        return
    model = None
    if args.method == "model":
        with Heartbeat(f"Cargando modelo {MODEL_PATH.name}"):
            model = WaterModel(MODEL_PATH, args.chip, args.overlap)
    prog = Progress(len(todo), "Fase 1 agua")
    for s in todo:
        tag = f"{s['date'][:10]} {s['group']:34}"
        try:
            row = water_scene(s, model, out_root, catalog, args)
            prog.step(f"{tag} agua {row['water_km2']:8.2f} km² ({row['water_pct']:.1f}%) {row['seconds']:5.1f}s")
        except SkipScene as e:
            prog.step(f"{tag} {e}", status="SALTADA")
        except Exception as e:
            prog.step(f"{tag} {type(e).__name__}: {e}", status="ERROR")
            with open(out_root / "errors.log", "a") as f:
                f.write(f"{time.strftime('%Y-%m-%dT%H:%M:%S')} {s['scene']}\n{traceback.format_exc()}\n")
    prog.summary(final=True)
    if prog.failed:
        log(f"Errores en {out_root / 'errors.log'} (relanza el comando para reintentarlas).")


class SkipScene(Exception):
    pass


def water_scene(s: dict, model, out_root: Path, catalog: Path, args) -> dict:
    t0 = time.time()
    log(f"   {s['date'][:10]} {s['group']}: leyendo VV y VH ...")
    vv, transform, crs = read_db(s["VV"])
    vh, t_vh, _ = read_db(s["VH"])
    if vh.shape != vv.shape or t_vh != transform:
        raise SkipScene("VV y VH con mallas distintas")
    if model:
        log(f"   inferencia del modelo sobre {vv.shape[0]}x{vv.shape[1]} px ...")
        prob = model.predict(vv, vh)
    else:
        prob = threshold_prob(vv, vh, args.vv_max, args.vh_max)
    valid = np.isfinite(prob)
    out = np.full(prob.shape, NODATA, np.uint8)
    out[valid] = np.round(prob[valid] * 100).astype(np.uint8)
    out_dir = out_root / slug(s["group"])
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{stamp(s['date'])}_water_prob.tif"
    write_geotiff(path, out, transform, crs, nodata=NODATA, units="percent",
                  method=args.method, scene=s["scene"], date=s["date"], group=s["group"])
    px = pixel_km2(transform)
    n_valid, n_water = int(valid.sum()), int((prob[valid] >= args.prob).sum())
    row = {"scene": s["scene"], "group": s["group"], "date": s["date"],
           "path": str(path.relative_to(out_root)), "valid_km2": round(n_valid * px, 3),
           "water_km2": round(n_water * px, 3),
           "water_pct": round(100 * n_water / n_valid, 3) if n_valid else 0,
           "seconds": round(time.time() - t0, 1)}
    new = not catalog.exists()
    with open(catalog, "a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=WATER_FIELDS)
        if new:
            w.writeheader()
        w.writerow(row)
    return row


def stage_floods(out_root: Path, args):
    catalog = out_root / "water_catalog.csv"
    if not catalog.exists():
        log("Fase 2: no hay water_catalog.csv; corre primero la fase 1.")
        return
    by_group = defaultdict(list)
    with open(catalog, newline="") as f:
        for r in csv.DictReader(f):
            by_group[r["group"]].append(r)

    summary = []
    print()
    prog = Progress(len(by_group), "Fase 2 inundaciones", unit="bursts")
    for group, rows in sorted(by_group.items()):
        rows.sort(key=lambda r: r["date"])
        if len(rows) < args.min_dates:
            prog.step(f"{group:34} solo {len(rows)} fechas (< {args.min_dates})", status="SALTADA")
            continue
        log(f"   {group}: apilando {len(rows)} fechas ...")
        with rasterio.open(out_root / rows[0]["path"]) as ref:
            shape, transform, crs = (ref.height, ref.width), ref.transform, ref.crs
        stack = np.full((len(rows), *shape), NODATA, np.uint8)
        for k, r in enumerate(rows):
            with rasterio.open(out_root / r["path"]) as src:
                reproject(src.read(1), stack[k], src_transform=src.transform, src_crs=src.crs,
                          dst_transform=transform, dst_crs=crs, src_nodata=NODATA,
                          dst_nodata=NODATA, resampling=Resampling.nearest)
        valid = stack != NODATA
        water = valid & (stack >= args.prob * 100)
        n_obs = valid.sum(0)
        occurrence = np.where(n_obs > 0, water.sum(0) / np.maximum(n_obs, 1), np.nan).astype(np.float32)
        group_dir = out_root / slug(group)
        occ = np.full(shape, NODATA, np.uint8)
        occ[n_obs > 0] = np.round(occurrence[n_obs > 0] * 100).astype(np.uint8)
        write_geotiff(group_dir / "occurrence.tif", occ, transform, crs, nodata=NODATA,
                      units="percent", n_dates=len(rows), group=group)

        normally_dry = (n_obs >= args.min_dates) & (occurrence < args.dry_max)
        px = pixel_km2(transform)
        for k, r in enumerate(rows):
            flood = water[k] & normally_dry
            out = np.where(valid[k], flood, NODATA).astype(np.uint8)
            write_geotiff(group_dir / f"{stamp(r['date'])}_flood.tif", out, transform, crs,
                          nodata=NODATA, date=r["date"], group=group, dry_max=args.dry_max)
            summary.append({"group": group, "date": r["date"],
                            "valid_km2": round(int(valid[k].sum()) * px, 3),
                            "water_km2": round(int(water[k].sum()) * px, 3),
                            "permanent_water_km2": round(int((water[k] & ~normally_dry).sum()) * px, 3),
                            "flood_km2": round(int(flood.sum()) * px, 3)})
        top = max(summary[-len(rows):], key=lambda x: x["flood_km2"])
        prog.step(f"{group:34} {len(rows)} fechas | máx. inundación {top['flood_km2']:.2f} km² "
                  f"el {top['date'][:10]}")
    prog.summary(final=True)

    if summary:
        with open(out_root / "flood_summary.csv", "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(summary[0]))
            w.writeheader()
            w.writerows(summary)
        print(f"\nResumen: {out_root / 'flood_summary.csv'}")
        print("Mayores inundaciones detectadas:")
        for x in sorted(summary, key=lambda x: -x["flood_km2"])[:10]:
            print(f"  {x['date'][:10]}  {x['group']:34} {x['flood_km2']:8.2f} km²")


def main():
    setup_stdout()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--collection", type=Path, required=True, help="Carpeta de bulk_fetch (con catalog.csv)")
    ap.add_argument("--stage", choices=["water", "floods", "all"], default="all")
    ap.add_argument("--method", choices=["model", "threshold"], default="model")
    ap.add_argument("--group", nargs="+", help="Solo bursts cuyo nombre contenga este texto")
    ap.add_argument("--start", help="YYYY-MM-DD")
    ap.add_argument("--end", help="YYYY-MM-DD")
    ap.add_argument("--prob", type=float, default=0.5, help="Probabilidad mínima para considerar agua (def. 0.5)")
    ap.add_argument("--dry-max", type=float, default=0.25,
                    help="Un píxel es 'normalmente seco' si fue agua en menos de esta fracción de fechas (def. 0.25)")
    ap.add_argument("--min-dates", type=int, default=4, help="Fechas mínimas por burst para la fase 2 (def. 4)")
    ap.add_argument("--vv-max", type=float, default=-15.0, help="Umbral VV en dB (método threshold)")
    ap.add_argument("--vh-max", type=float, default=-22.0, help="Umbral VH en dB (método threshold)")
    ap.add_argument("--chip", type=int, default=512, help="Tamaño de tile para el modelo (def. 512)")
    ap.add_argument("--overlap", type=int, default=64, help="Solape entre tiles (def. 64)")
    args = ap.parse_args()

    collection = args.collection
    if not collection.is_absolute() and not collection.exists():
        collection = ROOT / collection
    collection = collection.resolve()
    if not (collection / "catalog.csv").exists():
        raise SystemExit(f"No encuentro {collection / 'catalog.csv'}. ¿Se descargó esa colección con "
                         f"bulk_fetch.py? Colecciones disponibles: "
                         f"{sorted(p.name for p in (ROOT / 'data' / 'collections').glob('*') if p.is_dir())}")
    log(f"Colección: {collection}")
    out_root = collection / f"flood_{args.method}"
    out_root.mkdir(parents=True, exist_ok=True)
    if args.stage in ("water", "all"):
        stage_water(opera_scenes(collection, args.group, args.start, args.end), out_root, args)
    if args.stage in ("floods", "all"):
        stage_floods(out_root, args)


if __name__ == "__main__":
    main()
