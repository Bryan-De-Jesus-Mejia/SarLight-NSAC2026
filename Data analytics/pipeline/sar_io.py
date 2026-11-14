"""Lectura de una ventana (bbox lon/lat) de escenas SAR locales o remotas, devuelta en dB.

Formatos soportados:
- GeoTIFF / COG (OPERA RTC-S1 `_VV.tif`/`_VH.tif`, o subsets locales ya en dB).
- HDF5 NISAR L2 GCOV (`.h5`): se lee solo el bloque de píxeles del bbox vía rangos HTTP.
"""
import sys
import time
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
# True = imprime el % de lectura de cada capa HDF5 con MB descargados (fetch_quake, fetch_subset...).
# bulk_fetch lo deja en False para no mezclar la salida de varios procesos.
VERBOSE = False


def _vlog(msg: str):
    if VERBOSE:
        print(f"[{time.strftime('%H:%M:%S')}]      {msg}", flush=True)


class _CountingFile:
    """Envuelve el archivo remoto para contar los bytes descargados."""

    def __init__(self, f):
        self._f = f
        self.bytes = 0
        self.t0 = time.time()

    def read(self, n=-1):
        b = self._f.read(n)
        self.bytes += len(b)
        return b

    def readinto(self, buf):
        data = self.read(len(buf))
        memoryview(buf).cast("B")[:len(data)] = data
        return len(data)

    def rate(self) -> str:
        mb = self.bytes / 2**20
        return f"{mb:.0f} MB descargados, {mb / max(time.time() - self.t0, 1e-6):.1f} MB/s"

    def __getattr__(self, name):
        return getattr(self._f, name)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self._f.close()
        return False


def _read_strips(ds, r0: int, r1: int, c0: int, c1: int, label: str, fobj) -> np.ndarray:
    """Lee ds[r0:r1, c0:c1] por franjas alineadas a los chunks, imprimiendo el % si VERBOSE."""
    rows = r1 - r0
    chunk_rows = ds.chunks[0] if ds.chunks else 512
    step = chunk_rows * max(1, round(rows / 10 / chunk_rows))
    bounds = [r0] + list(range((r0 // step + 1) * step, r1, step)) + [r1]
    out = np.empty((rows, c1 - c0), ds.dtype)
    t0 = time.time()
    _vlog(f"{label}: leyendo {rows}x{c1 - c0} px ...")
    for a, b in zip(bounds[:-1], bounds[1:]):
        out[a - r0:b - r0] = ds[a:b, c0:c1]
        rate = fobj.rate() if isinstance(fobj, _CountingFile) else ""
        _vlog(f"{label}: {100 * (b - r0) / rows:5.1f}% ({b - r0}/{rows} filas) | {rate} | {time.time() - t0:.0f}s")
    return out


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


def _open_h5(source: str) -> _CountingFile:
    if source.startswith("s3://"):
        import s3fs  # opcional: solo para SAR_ACCESS_MODE=s3

        c = s3_credentials(source)
        fs = s3fs.S3FileSystem(
            key=c["AWS_ACCESS_KEY_ID"], secret=c["AWS_SECRET_ACCESS_KEY"],
            token=c["AWS_SESSION_TOKEN"], client_kwargs={"region_name": c["AWS_REGION"]},
        )
        return _CountingFile(fs.open(source, "rb", block_size=H5_BLOCK, cache_type="blockcache"))
    if is_remote(source):
        _vlog("Autenticando y firmando URL en ASF ...")
        signed, size = sign_url(source)
        _vlog(f"Archivo remoto de {size / 2**20:.0f} MB; se leerán solo los bloques del bbox")
        return _CountingFile(fsspec.filesystem("http").open(
            signed, "rb", size=size, block_size=H5_BLOCK, cache_type="blockcache"
        ))
    return _CountingFile(open(source, "rb"))


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


def read_gcov(source: str, bbox, pols: list[str], freq: str | None = None) -> dict[str, SarWindow]:
    """Lee varias polarizaciones de un NISAR GCOV abriendo el HDF5 una sola vez.

    freq: 'A' (~10 m) o 'B' (~80 m) como preferencia; si la escena no la tiene, usa la otra.
    """
    out = {}
    with _open_h5(source) as fobj, h5py.File(fobj, "r") as f:
        grids = f[GCOV_GRIDS]
        order = sorted(grids, key=lambda k: (k != f"frequency{freq}", k))
        for pol in (p.upper() for p in pols):
            term = pol * 2 if len(pol) == 2 else pol
            freq_key = next((k for k in order if term in grids[k]), None)
            if freq_key is None:
                raise SystemExit(f"{term} no está en {source}. Disponibles: {gcov_terms(f)}")
            grp = grids[freq_key]
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
            data = _read_strips(grp[term], r0, r1, c0, c1, f"{term} ({freq_key})", fobj)
            transform = Affine(dx, 0, x_edge + c0 * dx, 0, dy, y_edge + r0 * dy)
            out[pol] = SarWindow(to_db(data), transform, crs, source, pol)
    return out


def read_h5_layers(source: str, layers: dict[str, str], bbox, meta: dict[str, str] | None = None):
    """Lee el recorte bbox de varias capas geocodificadas de un HDF5 NISAR (GUNW, GOFF...) en una apertura.

    layers: {nombre: ruta_dataset}; las coordenadas se toman del grupo padre de cada dataset.
    Devuelve ({nombre: (array, transform, crs)}, {clave_meta: valor}). Las capas que no existen se omiten.
    """
    out, values = {}, {}
    with _open_h5(source) as fobj, h5py.File(fobj, "r") as f:
        _vlog("Leyendo metadatos del producto ...")
        for key, path in (meta or {}).items():
            if path in f:
                v = f[path][()]
                values[key] = v.decode() if isinstance(v, bytes) else (v.item() if hasattr(v, "item") else v)
        _vlog(f"Metadatos listos | {fobj.rate()}")
        for i, (name, path) in enumerate(layers.items(), 1):
            if path not in f:
                print(f"   Aviso: {path} no está en el producto; se omite '{name}'", file=sys.stderr)
                continue
            _vlog(f"Capa {i}/{len(layers)}: {name}")
            grp = f[path.rsplit("/", 1)[0]]
            x, y = grp["xCoordinates"][()], grp["yCoordinates"][()]
            crs = CRS.from_epsg(int(np.asarray(grp["projection"][()]).item()))
            dx, dy = float(x[1] - x[0]), float(y[1] - y[0])
            x_edge, y_edge = float(x[0]) - dx / 2, float(y[0]) - dy / 2
            left, bottom, right, top = transform_bounds("EPSG:4326", crs, *bbox, densify_pts=21)
            c0, c1 = _index_range(left, right, x_edge, dx, len(x))
            r0, r1 = _index_range(bottom, top, y_edge, dy, len(y))
            if r1 <= r0 or c1 <= c0:
                raise SystemExit(f"El bbox {bbox} no se solapa con {source}")
            _check_size(r1 - r0, c1 - c0)
            data = _read_strips(f[path], r0, r1, c0, c1, f"capa {i}/{len(layers)} {name}", fobj)
            out[name] = (data, Affine(dx, 0, x_edge + c0 * dx, 0, dy, y_edge + r0 * dy), crs)
    return out, values


def write_geotiff(path, array: np.ndarray, transform, crs, nodata=np.nan, max_z_error=None, **tags):
    """max_z_error: si se da, compresión LERC con ese error máximo (p.ej. 0.01 dB), ~2.5x menos disco."""
    count = 1 if array.ndim == 2 else array.shape[0]
    compression = (dict(compress="lerc_zstd", max_z_error=max_z_error) if max_z_error
                   else dict(compress="deflate"))
    profile = dict(
        driver="GTiff", height=array.shape[-2], width=array.shape[-1], count=count,
        dtype=array.dtype, crs=crs, transform=transform, nodata=nodata,
        tiled=True, blockxsize=256, blockysize=256, BIGTIFF="IF_SAFER", **compression,
    )
    with rasterio.open(path, "w", **profile) as dst:
        dst.write(array if array.ndim == 3 else array[np.newaxis])
        dst.update_tags(**{k: str(v) for k, v in tags.items()})
