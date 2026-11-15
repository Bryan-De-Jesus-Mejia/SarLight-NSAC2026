"""Lee solo la ventana del AOI de una o varias escenas ASF (streaming) y la guarda como GeoTIFF en dB.

No descarga la escena completa: usa lecturas por rango HTTP sobre COG (OPERA) o HDF5 (NISAR).
Necesita credenciales Earthdata en .env. Ejemplo:
  python pipeline/fetch_subset.py --pol VV VH --bbox -70.1 18.3 -69.7 18.6 \\
      --scene OPERA_L2_RTC-S1_T171-366117-IW3_20261114T103043Z_20261114T140658Z_S1D_30_v1.0
"""
import argparse
import time
from pathlib import Path

import sar_io
from progress import Progress, log, setup_stdout
from sar_io import read_window, write_geotiff
from search_scenes import DATA_DIR, default_bbox, resolve_scene_url


def fetch(scene: str, pol: str, bbox, out_dir: Path) -> str:
    log(f"   {scene} {pol}: resolviendo URL en ASF ...")
    url = resolve_scene_url(scene, pol)
    t0 = time.time()
    win = read_window(url, bbox, pol)
    out = out_dir / f"{scene}_{pol.upper()}.tif"
    write_geotiff(out, win.db, win.transform, win.crs, units="dB", pol=pol.upper(),
                  scene=scene, source_url=url, bbox_lonlat=",".join(map(str, bbox)))
    h, w = win.db.shape
    return f"{h}x{w} px en {time.time() - t0:.1f}s -> {out}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--scene", nargs="+", required=True, help="Nombre(s) de escena ASF (de search_scenes.py)")
    ap.add_argument("--pol", nargs="+", required=True, help="Polarizaciones: VV VH (OPERA) o HH HV / VV VH (NISAR)")
    ap.add_argument("--bbox", nargs=4, type=float, metavar=("LON_MIN", "LAT_MIN", "LON_MAX", "LAT_MAX"),
                    default=None, help="Por defecto AOI_BBOX del .env")
    ap.add_argument("--out", type=Path, default=DATA_DIR / "subsets")
    args = ap.parse_args()

    setup_stdout()
    sar_io.VERBOSE = True
    bbox = args.bbox or default_bbox()
    args.out.mkdir(parents=True, exist_ok=True)
    prog = Progress(len(args.scene) * len(args.pol), "Descarga de recortes", unit="imágenes")
    for scene in args.scene:
        for pol in args.pol:
            try:
                prog.step(f"{scene} {pol}: {fetch(scene, pol, bbox, args.out)}")
            except (Exception, SystemExit) as e:
                prog.step(f"{scene} {pol}: {e}", status="ERROR")
    prog.summary(final=True)


if __name__ == "__main__":
    main()
