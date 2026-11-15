"""Exporta las huellas reales de NISAR de un ciclo de 12 días para animarlas en la app web.

Consulta el catálogo público de NASA (CMR, no necesita credenciales) y guarda, por cada escena
L2 GCOV, la hora de adquisición y sus cuatro esquinas. La app dibuja esas huellas en orden
cronológico sobre el globo ("el baile del satélite").

Salida: nisar-explorer/public/geo/nisar-cycle.json
  { start, end, collection, count, scenes: [minutos_desde_start, lon1, lat1, ..., lon4, lat4, asc] }

Uso:
  python pipeline/export_passes.py
  python pipeline/export_passes.py --start 2026-10-22 --days 12
"""
import argparse
import json
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

APP_DIR = Path(__file__).resolve().parents[2] / "nisar-explorer"
CMR = "https://cmr.earthdata.nasa.gov/search/granules.json"
PAGE = 2000


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def corners(polygon: str) -> list[float] | None:
    """'lat lon lat lon ...' (anillo cerrado) -> [lon1, lat1, ..., lon4, lat4]."""
    v = [float(x) for x in polygon.split()]
    pts = [(v[i + 1], v[i]) for i in range(0, len(v) - 1, 2)]
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts = pts[:-1]
    if len(pts) < 4:
        return None
    if len(pts) > 4:  # anillos con más vértices: cuatro puntos repartidos
        step = len(pts) / 4
        pts = [pts[int(i * step)] for i in range(4)]
    return [round(c, 2) for p in pts for c in p]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--collection", default="NISAR_L2_GCOV_V1")
    ap.add_argument("--start", default="2026-10-22", help="Primer día del ciclo (UTC)")
    ap.add_argument("--days", type=int, default=12)
    ap.add_argument("--out", type=Path, default=APP_DIR / "public" / "geo" / "nisar-cycle.json")
    args = ap.parse_args()

    start = datetime.strptime(args.start, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    end = start + timedelta(days=args.days)
    temporal = f"{start:%Y-%m-%dT%H:%M:%SZ},{end:%Y-%m-%dT%H:%M:%SZ}"
    log(f"Consultando {args.collection} del {start:%Y-%m-%d} al {end:%Y-%m-%d}")

    scenes, page, hits = [], 1, None
    while True:
        r = None
        for attempt in range(1, 5):
            try:
                r = requests.get(CMR, params=dict(short_name=args.collection, temporal=temporal,
                                                  page_size=PAGE, page_num=page, sort_key="start_date"),
                                 timeout=120)
                r.raise_for_status()
                break
            except requests.RequestException as e:
                log(f"  página {page}: intento {attempt}/4 falló ({str(e)[:80]}); reintentando")
                time.sleep(5 * attempt)
                r = None
        if r is None:
            raise SystemExit("No se pudo consultar el catálogo de NASA. Revisa la conexión y reintenta.")
        hits = int(r.headers.get("cmr-hits", 0))
        entries = r.json()["feed"]["entry"]
        for e in entries:
            poly = (e.get("polygons") or [[None]])[0][0]
            quad = corners(poly) if poly else None
            if quad is None:
                continue
            t = datetime.strptime(e["time_start"][:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
            minutes = round((t - start).total_seconds() / 60)
            # El nombre lleva la dirección de órbita: ..._<track>_<A|D>_<frame>_...
            parts = e["title"].split("_")
            asc = 1 if len(parts) > 6 and parts[6] == "A" else 0
            scenes.append([minutes, *quad, asc])
        log(f"  página {page}: {len(scenes)}/{hits} escenas")
        if len(entries) < PAGE or page * PAGE >= hits:
            break
        page += 1

    scenes.sort(key=lambda s: s[0])
    args.out.parent.mkdir(parents=True, exist_ok=True)
    payload = dict(start=f"{start:%Y-%m-%d}", end=f"{end:%Y-%m-%d}", days=args.days,
                   collection=args.collection, count=len(scenes),
                   generatedAt=time.strftime("%Y-%m-%dT%H:%M:%S"), scenes=scenes)
    args.out.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    log(f"Listo: {len(scenes)} escenas -> {args.out} ({args.out.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
