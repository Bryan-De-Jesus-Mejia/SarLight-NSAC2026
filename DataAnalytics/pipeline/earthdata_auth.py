"""Autenticación NASA Earthdata Login (EDL) para leer datos de ASF por streaming."""
import os
from pathlib import Path
from urllib.parse import urlparse

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

EDL_TOKEN_URL = "https://urs.earthdata.nasa.gov/api/users/find_or_create_token"
S3_CREDENTIAL_ENDPOINTS = {
    "nisar": "https://nisar.asf.earthdatacloud.nasa.gov/s3credentials",
    "cumulus": "https://cumulus.asf.earthdatacloud.nasa.gov/s3credentials",
}

_token_cache: str | None = None


def access_mode() -> str:
    mode = os.getenv("SAR_ACCESS_MODE", "https").strip().lower()
    if mode not in ("https", "s3"):
        raise SystemExit(f"SAR_ACCESS_MODE debe ser 'https' o 's3', no '{mode}'")
    return mode


def get_token() -> str:
    global _token_cache
    if _token_cache:
        return _token_cache
    token = os.getenv("EARTHDATA_TOKEN", "").strip()
    if not token:
        user = os.getenv("EARTHDATA_USERNAME", "").strip()
        pwd = os.getenv("EARTHDATA_PASSWORD", "").strip()
        if not (user and pwd):
            raise SystemExit(
                f"Faltan credenciales: rellena EARTHDATA_TOKEN o "
                f"EARTHDATA_USERNAME + EARTHDATA_PASSWORD en {ROOT / '.env'}"
            )
        r = requests.post(EDL_TOKEN_URL, auth=(user, pwd), timeout=30)
        if r.status_code == 401:
            raise SystemExit("Earthdata Login rechazó usuario/contraseña (401).")
        r.raise_for_status()
        token = r.json()["access_token"]
    _token_cache = token
    return token


def sign_url(url: str) -> tuple[str, int]:
    """Resuelve una URL de descarga de ASF a una URL S3 prefirmada (~1h) y su tamaño.

    La URL prefirmada admite lecturas por rango sin cabeceras de auth, que es lo que
    necesitan GDAL (/vsicurl/) y h5py. Solo admite GET: no se le puede hacer HEAD.
    """
    headers = {"Authorization": f"Bearer {get_token()}", "Range": "bytes=0-0"}
    with requests.get(url, headers=headers, stream=True, allow_redirects=True, timeout=60) as r:
        final = urlparse(r.url)
        if r.status_code in (401, 403) or "urs.earthdata.nasa.gov" in final.netloc:
            raise SystemExit(
                f"Acceso denegado ({r.status_code}) a {url}\n"
                "Revisa el token y que tu cuenta Earthdata tenga autorizada la app "
                "'Alaska Satellite Facility Data Access' (entra una vez a "
                "https://search.asf.alaska.edu y descarga cualquier archivo desde el navegador)."
            )
        r.raise_for_status()
        if "Content-Range" in r.headers:
            size = int(r.headers["Content-Range"].split("/")[-1])
        else:
            size = int(r.headers["Content-Length"])
        return r.url, size


def s3_credentials(s3_url: str) -> dict:
    """Credenciales S3 temporales (1h). Solo sirven desde AWS us-west-2."""
    bucket = urlparse(s3_url).netloc
    endpoint = S3_CREDENTIAL_ENDPOINTS["nisar" if "nisar" in bucket else "cumulus"]
    r = requests.get(endpoint, headers={"Authorization": f"Bearer {get_token()}"}, timeout=30)
    r.raise_for_status()
    c = r.json()
    return {
        "AWS_ACCESS_KEY_ID": c["accessKeyId"],
        "AWS_SECRET_ACCESS_KEY": c["secretAccessKey"],
        "AWS_SESSION_TOKEN": c["sessionToken"],
        "AWS_REGION": "us-west-2",
    }
