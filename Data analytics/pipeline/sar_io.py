"""Lectura de una ventana (bbox lon/lat) de escenas SAR locales o remotas, devuelta en dB.

Formatos soportados:
- GeoTIFF / COG (OPERA RTC-S1 `_VV.tif`/`_VH.tif`, o subsets locales ya en dB).
- HDF5 NISAR L2 GCOV (`.h5`): se lee solo el bloque de píxeles del bbox vía rangos HTTP.
"""
import sys
from dataclasses import dataclass

import fsspec
import h5py
import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.transform import Affine
from rasterio.warp import transform_bounds
from rasterio.windows import Window

from earthdata_auth import s3_credentials, sign_url

GDAL_REMOTE_OPTS = dict(
    GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
    # Las URLs S3 prefirmadas solo aceptan GET; con HEAD devuelven 403.
    CPL_VSIL_CURL_USE_HEAD="NO",
    GDAL_HTTP_MERGE_CONSECUTIVE_RANGES="YES",
    GDAL_HTTP_MAX_RETRY="4",
    GDAL_HTTP_RETRY_DELAY="2",
    VSI_CACHE="TRUE",
)
H5_BLOCK = 4 * 2**20
GCOV_GRIDS = "science/LSAR/GCOV/grids"
LARGE_WINDOW_PX = 100_000_000


@dataclass
class SarWindow:
    db: np.ndarray  # float32, NaN = sin dato
    transform: Affine
    crs: CRS
    source: str
    pol: str | None


def is_remote(source: str) -> bool:
    return source.startswith(("http://", "https://", "s3://"))


def to_db(linear: np.ndarray) -> np.ndarray:
    linear = linear.astype(np.float32)
    out = np.full(linear.shape, np.nan, np.float32)
    ok = np.isfinite(linear) & (linear > 0)
    out[ok] = 10 * np.log10(linear[ok])
    return out


def read_window(source: str, bbox=None, pol: str | None = None) -> SarWindow:
    if is_remote(source) and bbox is None:
        raise SystemExit("Para fuentes remotas hace falta --bbox (no se descarga la escena completa).")
    if source.split("?")[0].endswith(".h5"):
        return _read_gcov(source, bbox, pol)
    return _read_raster(source, bbox, pol)


def _check_size(rows: int, cols: int):
    if rows * cols > LARGE_WINDOW_PX:
        print(f"Aviso: ventana grande ({rows}x{cols} px). Considera un --bbox más pequeño.", file=sys.stderr)


def _read_raster(source: str, bbox, pol) -> SarWindow:
    env = {}
    if source.startswith("s3://"):
        path, env = "/vsis3/" + source[5:], s3_credentials(source)
    elif is_remote(source):
        path = "/vsicurl/" + sign_url(source)[0]
    else:
        path = source
    with rasterio.Env(**GDAL_REMOTE_OPTS, **env), rasterio.open(path) as src:
        win = Window(0, 0, src.width, src.height)
        if bbox:
            left, bottom, right, top = transform_bounds("EPSG:4326", src.crs, *bbox, densify_pts=21)
            t = src.transform
            c0, c1 = _index_range(left, right, t.c, t.a, src.width)
            r0, r1 = _index_range(bottom, top, t.f, t.e, src.height)
            if r1 <= r0 or c1 <= c0:
                raise SystemExit(f"El bbox {bbox} no se solapa con {source}")
            win = Window.from_slices((r0, r1), (c0, c1))
        _check_size(int(win.height), int(win.width))
        data = np.ma.filled(src.read(1, window=win, masked=True).astype(np.float32), np.nan)
        tags = src.tags()
        transform, crs = src.window_transform(win), src.crs
    db = data if tags.get("units") == "dB" else to_db(data)
    return SarWindow(db, transform, crs, source, pol or tags.get("pol"))


def _open_h5(source: str):
    if source.startswith("s3://"):
        import s3fs  # opcional: solo para SAR_ACCESS_MODE=s3

        c = s3_credentials(source)
        fs = s3fs.S3FileSystem(
            key=c["AWS_ACCESS_KEY_ID"], secret=c["AWS_SECRET_ACCESS_KEY"],
            token=c["AWS_SESSION_TOKEN"], client_kwargs={"region_name": c["AWS_REGION"]},
        )
        return fs.open(source, "rb", block_size=H5_BLOCK, cache_type="blockcache")
    if is_remote(source):
        signed, size = sign_url(source)
        return fsspec.filesystem("http").open(
            signed, "rb", size=size, block_size=H5_BLOCK, cache_type="blockcache"
        )
    return open(source, "rb")


def _index_range(lo: float, hi: float, edge: float, step: float, n: int) -> tuple[int, int]:
    a, b = (lo - edge) / step, (hi - edge) / step
    return max(0, int(np.floor(min(a, b)))), min(n, int(np.ceil(max(a, b))))


def gcov_terms(f: h5py.File) -> dict[str, list[str]]:
    grids = f[GCOV_GRIDS]
    return {k: sorted(t for t in grids[k] if len(t) == 4 and t.isupper()) for k in grids}


def _read_gcov(source: str, bbox, pol) -> SarWindow:
    if not pol:
        raise SystemExit("Para NISAR GCOV indica --pol (HH, HV, VV o VH).")
    return read_gcov(source, bbox, [pol])[pol.upper()]


def read_gcov(source: str, bbox, pols: list[str]) -> dict[str, SarWindow]:
    """Lee varias polarizaciones de un NISAR GCOV abriendo el HDF5 una sola vez."""
    out = {}
    with _open_h5(source) as fobj, h5py.File(fobj, "r") as f:
        grids = f[GCOV_GRIDS]
        for pol in (p.upper() for p in pols):
            term = pol * 2 if len(pol) == 2 else pol
            freq = next((k for k in sorted(grids) if term in grids[k]), None)
            if freq is None:
                raise SystemExit(f"{term} no está en {source}. Disponibles: {gcov_terms(f)}")
            grp = grids[freq]
            x, y = grp["xCoordinates"][()], grp["yCoordinates"][()]
            crs = CRS.from_epsg(int(np.asarray(grp["projection"][()]).item()))
            dx, dy = float(x[1] - x[0]), float(y[1] - y[0])
            x_edge, y_edge = float(x[0]) - dx / 2, float(y[0]) - dy / 2
            r0, r1, c0, c1 = 0, len(y), 0, len(x)
            if bbox:
                left, bottom, right, top = transform_bounds("EPSG:4326", crs, *bbox, densify_pts=21)
                c0, c1 = _index_range(left, right, x_edge, dx, len(x))
                r0, r1 = _index_range(bottom, top, y_edge, dy, len(y))
                if r1 <= r0 or c1 <= c0:
                    raise SystemExit(f"El bbox {bbox} no se solapa con {source}")
            _check_size(r1 - r0, c1 - c0)
            data = grp[term][r0:r1, c0:c1]
            transform = Affine(dx, 0, x_edge + c0 * dx, 0, dy, y_edge + r0 * dy)
            out[pol] = SarWindow(to_db(data), transform, crs, source, pol)
    return out


def write_geotiff(path, array: np.ndarray, transform, crs, nodata=np.nan, **tags):
    count = 1 if array.ndim == 2 else array.shape[0]
    profile = dict(
        driver="GTiff", height=array.shape[-2], width=array.shape[-1], count=count,
        dtype=array.dtype, crs=crs, transform=transform, nodata=nodata,
        compress="deflate", tiled=True, blockxsize=256, blockysize=256, BIGTIFF="IF_SAFER",
    )
    with rasterio.open(path, "w", **profile) as dst:
        dst.write(array if array.ndim == 3 else array[np.newaxis])
        dst.update_tags(**{k: str(v) for k, v in tags.items()})
