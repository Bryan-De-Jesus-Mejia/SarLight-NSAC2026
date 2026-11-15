"""
People living in each analysed area, and on the land that changed.

Crosses our own change masks with the GHSL population grid (GHS-POP R2023A,
epoch 2025, 30 arc-seconds, European Commission JRC, CC BY 4.0) and writes
nisar-explorer/data/analysis/people.json, read by the app.

  areaPeople     everyone living inside the analysed area
  exposedPeople  people living on the pixels our analysis flagged (water that
                 appeared, slopes or crops whose echo dropped, burned land).
                 Each flagged 20 m pixel takes the population density of the
                 1 km cell it falls in, so this is an estimate, not a count.
                 Where several orbits cover a place we keep the largest one
                 (they overlap, adding them would count people twice).

Usage (needs rasterio, pyproj, numpy; GHSL tiles are downloaded once):
  python pipeline/export_people.py [--cache data/cache/ghsl]
"""

from __future__ import annotations

import argparse
import glob
import io
import json
import os
import urllib.request
import zipfile

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.merge import merge
from rasterio.windows import from_bounds

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
ANALYSIS = os.path.join(ROOT, "DataAnalytics", "data", "analisis")
APP_DATA = os.path.join(ROOT, "nisar-explorer", "data", "analysis")
TILE_URL = (
    "https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/GHS_POP_GLOBE_R2023A/"
    "GHS_POP_E2025_GLOBE_R2023A_4326_30ss/V1-0/tiles/GHS_POP_E2025_GLOBE_R2023A_4326_30ss_V1_0_R{r}_C{c}.zip"
)
# The tile grid: 10 degree tiles, row 1 starts at 89.0996 N, column 1 at 180.0079 W.
TOP, LEFT = 89.09958345, -180.00791637

# case id -> (analysis folder, mask kind). Kinds:
#   extent  extension_maxima.tif, any value > 0 (open water or flooded vegetation)
#   mask    mascara_cambio.tif, value 1
#   change  latest cambio_<date>.tif, value 1 (echo dropped)
#   none    only the people living in the area
CASES = {
    "capotillo-flood": ("inundaciones/inundacion_urbana_capotillo", "extent"),
    "ozama-flood": ("inundaciones/inundacion_ozama_sdn", "extent"),
    "san-pedro-flood": ("inundaciones/inundacion_san_pedro_macoris", "extent"),
    "ocoa-flood": ("inundaciones/inundacion_san_jose_ocoa", "extent"),
    "azua-flood": ("inundaciones/inundacion_azua/nisar_HH", "mask"),
    "monte-plata-flood": ("inundaciones/inundacion_monte_plata/nisar_HH", "mask"),
    "bahoruco-fire": ("incendios/incendio_sierra_bahoruco/nisar_HV", "mask"),
    "pelempito-fire": ("incendios/incendio_pelempito/nisar_HV", "mask"),
    "mekong-rice-flood": ("agricultura/agricola_arroz_mekong", "extent"),
    "chattogram-rice-flood": ("agricultura/agricola_inundacion_bangladesh", "extent"),
    "los-cacaos-landslide": ("deslizamientos/deslizamiento_los_cacaos", "change"),
    "miches-landslide": ("deslizamientos/deslizamiento_miches_el_seibo", "change"),
    "cibao-wind": ("vientos/viento_cibao", "change"),
    "valverde-wind": ("vientos/viento_valverde", "change"),
    "noroeste-heat": ("calor_extremo/calor_linea_noroeste", "change"),
    "puerto-plata-flood": ("inundaciones/inundacion_puerto_plata", "extent"),
    "hoya-caimito-flood": ("inundaciones/inundacion_santiago_hoya_caimito", "extent"),
    "tamayo-flood": ("inundaciones/inundacion_tamayo_bahoruco", "extent"),
    "matanzas-flood": ("inundaciones/inundacion_matanzas_peravia", "extent"),
    "cambita-flood": ("inundaciones/inundacion_cambita_san_cristobal", "extent"),
    "les-cayes-flood": ("inundaciones/inundacion_haiti_sud", "extent"),
    "baraderes-flood": ("inundaciones/inundacion_haiti_nippes_baraderes", "extent"),
    "corail-flood": ("inundaciones/inundacion_haiti_grand_anse_corail", "extent"),
    "sula-flood": ("inundaciones/inundacion_honduras_valle_sula", "extent"),
    "santa-barbara-flood": ("inundaciones/inundacion_honduras_santa_barbara", "extent"),
    "tocumen-flood": ("inundaciones/inundacion_panama_tocumen", "extent"),
    "cartagena-flood": ("inundaciones/inundacion_colombia_cartagena", "extent"),
    "santa-marta-flood": ("inundaciones/inundacion_colombia_santa_marta", "extent"),
    "cordoba-flood": ("inundaciones/inundacion_colombia_cordoba", "extent"),
    "muisne-flood": ("inundaciones/inundacion_ecuador_muisne", "extent"),
    "balao-flood": ("inundaciones/inundacion_ecuador_balao", "extent"),
    "babahoyo-flood": ("inundaciones/inundacion_ecuador_babahoyo", "extent"),
    "guayaquil-flood": ("inundaciones/inundacion_ecuador_guayaquil", "extent"),
    "el-guabo-flood": ("inundaciones/inundacion_ecuador_el_guabo", "extent"),
    "machala-flood": ("inundaciones/inundacion_ecuador_machala", "extent"),
    "portoviejo-flood": ("inundaciones/inundacion_ecuador_portoviejo", "extent"),
    "quito-flood": ("inundaciones/inundacion_ecuador_quito", "extent"),
    "galapagos-flood": ("inundaciones/inundacion_ecuador_galapagos_santa_cruz", "extent"),
    "chaco-flood": ("inundaciones/inundacion_argentina_chaco", "extent"),
    "paso-patria-flood": ("inundaciones/inundacion_argentina_paso_patria", "extent"),
    "itati-flood": ("inundaciones/inundacion_argentina_itati", "extent"),
    "ayolas-flood": ("inundaciones/inundacion_paraguay_ayolas", "extent"),
    "guaymas-flood": ("inundaciones/inundacion_mexico_guaymas", "extent"),
    "navojoa-flood": ("inundaciones/inundacion_mexico_navojoa", "extent"),
    "cajeme-flood": ("inundaciones/inundacion_mexico_cajeme", "extent"),
    "ensenada-flood": ("inundaciones/inundacion_mexico_ensenada", "extent"),
    "la-paz-flood": ("inundaciones/inundacion_mexico_la_paz", "extent"),
    "los-cabos-flood": ("inundaciones/inundacion_mexico_los_cabos", "extent"),
    "pagosa-flood": ("inundaciones/inundacion_eeuu_pagosa_springs", "extent"),
    "jammu-flood": ("inundaciones/inundacion_india_jammu", "extent"),
    "gorkha-flood": ("inundaciones/inundacion_nepal_gorkha", "extent"),
    "san-juan-drought": ("sequias/sequia_valle_san_juan", "change"),
    "petapa-landslide": ("deslizamientos/deslizamiento_guatemala_san_miguel_petapa", "change"),
    "yojoa-landslide": ("deslizamientos/deslizamiento_honduras_santa_cruz_yojoa", "change"),
    "santa-maria-wind": ("vientos/viento_brasil_santa_maria", "change"),
    # Reservoirs and lakes have no change mask: only the people living around them.
}


def tile_of(lon: float, lat: float) -> tuple[int, int]:
    return int((TOP - lat) // 10) + 1, int((lon - LEFT) // 10) + 1


def tile_path(cache: str, r: int, c: int) -> str | None:
    name = f"R{r}_C{c}.tif"
    out = os.path.join(cache, name)
    if os.path.exists(out):
        return out
    os.makedirs(cache, exist_ok=True)
    try:
        with urllib.request.urlopen(TILE_URL.format(r=r, c=c), timeout=180) as res:
            data = res.read()
    except Exception:  # noqa: BLE001 - tiles over open ocean do not exist
        return None
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        tif = next(n for n in z.namelist() if n.endswith(".tif"))
        with open(out, "wb") as f:
            f.write(z.read(tif))
    return out


class Population:
    """Population per 1 km cell over a lon/lat box, from one or more GHSL tiles."""

    def __init__(self, cache: str, west: float, south: float, east: float, north: float):
        tiles = {tile_of(x, y) for x in (west, east) for y in (south, north)}
        paths = [p for p in (tile_path(cache, r, c) for r, c in sorted(tiles)) if p]
        if not paths:
            self.grid = None
            return
        sources = [rasterio.open(p) for p in paths]
        pad = 0.02
        self.grid, self.transform = merge(sources, bounds=(west - pad, south - pad, east + pad, north + pad), nodata=0)
        self.grid = np.clip(self.grid[0].astype("float64"), 0, None)
        for s in sources:
            s.close()

    def total(self, west: float, south: float, east: float, north: float) -> float:
        if self.grid is None:
            return 0.0
        win = from_bounds(west, south, east, north, self.transform).round_offsets().round_lengths()
        r0, c0 = max(int(win.row_off), 0), max(int(win.col_off), 0)
        return float(self.grid[r0 : r0 + int(win.height), c0 : c0 + int(win.width)].sum())

    def density_at(self, lon: np.ndarray, lat: np.ndarray) -> np.ndarray:
        """People per km² at each point."""
        if self.grid is None:
            return np.zeros_like(lon)
        inv = ~self.transform
        cols, rows = inv * (lon, lat)
        rows = np.clip(rows.astype(int), 0, self.grid.shape[0] - 1)
        cols = np.clip(cols.astype(int), 0, self.grid.shape[1] - 1)
        res_x, res_y = self.transform.a, -self.transform.e
        cell_km2 = (res_y * 111.32) * (res_x * 111.32 * np.cos(np.radians(lat)))
        return self.grid[rows, cols] / cell_km2


def mask_files(folder: str, kind: str) -> list[str]:
    base = os.path.join(ANALYSIS, folder)
    if kind == "extent":
        return sorted(glob.glob(os.path.join(base, "*", "extension_maxima.tif")))
    if kind == "mask":
        return [os.path.join(base, "mascara_cambio.tif")]
    if kind == "change":
        out = []
        for orbit in sorted(glob.glob(os.path.join(base, "*"))):
            dated = sorted(glob.glob(os.path.join(orbit, "cambio_*.tif")))
            if dated:
                out.append(dated[-1])
        return out
    return []


def flagged(path: str, kind: str) -> tuple[np.ndarray, np.ndarray, float, tuple[float, float, float, float]]:
    """Lon/lat of every flagged pixel, the pixel area in km², and the raster's lon/lat bounds."""
    with rasterio.open(path) as r:
        a = r.read(1)
        on = (a > 0) & (a != 255) if kind == "extent" else a == 1
        rows, cols = np.nonzero(on)
        x, y = rasterio.transform.xy(r.transform, rows, cols)
        to_ll = Transformer.from_crs(r.crs, "EPSG:4326", always_xy=True)
        lon, lat = to_ll.transform(np.asarray(x), np.asarray(y))
        b = r.bounds
        bl, bb, br, bt = to_ll.transform_bounds(b.left, b.bottom, b.right, b.top)
        return np.asarray(lon), np.asarray(lat), abs(r.res[0] * r.res[1]) / 1e6, (bl, bb, br, bt)


def bbox_of(case: dict) -> tuple[float, float, float, float] | None:
    fp = case.get("footprint")
    if not fp:
        return None
    xs, ys = [p[0] for p in fp], [p[1] for p in fp]
    return min(xs), min(ys), max(xs), max(ys)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default=os.path.join(ROOT, "DataAnalytics", "data", "cache", "ghsl"))
    args = ap.parse_args()

    cases = []
    for name in ("cases.json", "extra.json"):
        with open(os.path.join(APP_DATA, name), encoding="utf-8") as f:
            cases += json.load(f)["cases"]

    out: dict[str, dict] = {}
    for case in cases:
        cid = case["id"]
        folder, kind = CASES.get(cid, (None, "none"))
        files = [p for p in mask_files(folder, kind) if os.path.exists(p)] if folder else []
        masks = [flagged(p, kind) for p in files]
        box = bbox_of(case) or (masks[0][3] if masks else None)
        if box is None:
            print(f"  {cid}: no area, skipped")
            continue
        pop = Population(args.cache, *box)
        entry: dict = {"areaPeople": round(pop.total(*box))}
        if masks:
            best = 0.0
            for lon, lat, px_km2, _ in masks:
                if lon.size:
                    best = max(best, float((pop.density_at(lon, lat) * px_km2).sum()))
            entry["exposedPeople"] = round(best)
        out[cid] = entry
        print(f"  {cid}: {entry}")

    dest = os.path.join(APP_DATA, "people.json")
    with open(dest, "w", encoding="utf-8") as f:
        json.dump({"source": "GHS-POP R2023A, epoch 2025, 30 arc-seconds (European Commission, JRC), CC BY 4.0", "cases": out}, f, indent=1)
    print(f"{len(out)} cases written to {dest}")


if __name__ == "__main__":
    main()
