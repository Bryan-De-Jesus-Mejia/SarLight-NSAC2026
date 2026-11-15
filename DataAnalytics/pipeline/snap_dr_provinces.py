"""Alinea el borde exterior de las provincias de la República Dominicana con el contorno del país.

`public/geo/dr-provinces.geojson` (32 provincias, ~1.700 puntos) es mucho más tosco que el contorno de
República Dominicana de `public/geo/countries.geojson` (~2.900 puntos). Dibujados a la vez, el borde
exterior de las provincias y el del país no coinciden y se ven dos líneas (Dajabón, Samaná...).

Este script recorre cada anillo de provincia, encuentra los tramos de vértices que caen sobre el
contorno del país y los reemplaza por el mismo tramo del contorno fino. Los bordes interiores (entre
provincias) no se tocan. Solo Python estándar.

Uso (desde la raíz del repositorio):
  python DataAnalytics/pipeline/snap_dr_provinces.py
  python DataAnalytics/pipeline/snap_dr_provinces.py --tol 0.07 --dry-run
"""
import argparse
import json
import math
from pathlib import Path

APP = Path(__file__).resolve().parents[2] / "nisar-explorer" / "public" / "geo"


def d2(a, b):
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2


def seg_d2(p, a, b):
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    length = dx * dx + dy * dy
    t = 0.0 if length == 0 else max(0.0, min(1.0, ((p[0] - ax) * dx + (p[1] - ay) * dy) / length))
    return (p[0] - ax - t * dx) ** 2 + (p[1] - ay - t * dy) ** 2


def dist_to_ring(p, ring):
    return min(seg_d2(p, ring[i], ring[i + 1]) for i in range(len(ring) - 1)) ** 0.5


def polygons(geometry):
    return geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]


def nearest_index(p, ring):
    return min(range(len(ring)), key=lambda k: d2(p, ring[k]))


def arc(ring, i, j):
    """Vértices del anillo (abierto) yendo de i a j hacia adelante."""
    n = len(ring)
    out = [ring[i]]
    k = i
    while k != j:
        k = (k + 1) % n
        out.append(ring[k])
    return out


def mean_dist(points, reference):
    return sum(dist_to_ring(p, reference) for p in points) / len(points)


def snap_ring(ring, country_rings, tol):
    """Devuelve el anillo con sus tramos exteriores sustituidos por los del contorno fino."""
    pts = ring[:-1] if ring[0] == ring[-1] else ring
    n = len(pts)
    best_ring = []
    for index, country in enumerate(country_rings):
        close = [dist_to_ring(p, country) < tol for p in pts]
        best_ring.append((sum(close), index, close))
    count, which, close = max(best_ring)
    if count < 2:
        return ring, 0
    if all(close):
        return ring, 0
    country = country_rings[which]
    open_country = country[:-1] if country[0] == country[-1] else country

    # Tramos circulares contiguos de vértices "sobre el borde".
    start = next(i for i in range(n) if not close[i])
    order = [(start + k) % n for k in range(n)]
    runs, current = [], []
    for i in order:
        if close[i]:
            current.append(i)
        elif current:
            runs.append(current)
            current = []
    if current:
        runs.append(current)

    replaced = 0
    replacement = {}
    for run in runs:
        if len(run) < 2:
            continue
        a, b = pts[run[0]], pts[run[-1]]
        ia, ib = nearest_index(a, open_country), nearest_index(b, open_country)
        if ia == ib:
            continue
        forward, backward = arc(open_country, ia, ib), arc(open_country, ib, ia)[::-1]
        original = [pts[i] for i in run]
        chosen = min((forward, backward), key=lambda c: mean_dist(c, original))
        # El tramo nuevo no puede alejarse más de `tol` de lo que reemplaza.
        if mean_dist(chosen, original) > tol:
            continue
        replacement[run[0]] = (run, chosen)
        replaced += len(run)

    out = []
    skip = set()
    for i in range(n):
        if i in skip:
            continue
        if i in replacement:
            run, chosen = replacement[i]
            out.extend(chosen)
            skip.update(run)
        else:
            out.append(pts[i])
    if len(out) < 4:
        return ring, 0
    out.append(out[0])
    return out, replaced


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--tol", type=float, default=0.07, help="distancia máxima (grados) para considerar un vértice sobre el borde")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    countries = json.loads((APP / "countries.geojson").read_text(encoding="utf-8"))
    dr = next(f for f in countries["features"] if f["properties"]["iso"] == "DOM")
    country_rings = [poly[0] for poly in polygons(dr["geometry"])]

    path = APP / "dr-provinces.geojson"
    data = json.loads(path.read_text(encoding="utf-8"))
    total_before = total_after = replaced_total = 0
    for feature in data["features"]:
        geometry = feature["geometry"]
        new_polys = []
        for poly in polygons(geometry):
            rings = []
            for k, ring in enumerate(poly):
                total_before += len(ring)
                if k == 0:
                    ring, replaced = snap_ring(ring, country_rings, args.tol)
                    replaced_total += replaced
                else:
                    ring = ring
                rings.append([[round(x, 4), round(y, 4)] for x, y in ring])
                total_after += len(ring)
            new_polys.append(rings)
        geometry["coordinates"] = new_polys if geometry["type"] == "MultiPolygon" else new_polys[0]

    print(f"puntos {total_before} -> {total_after}; vértices exteriores reemplazados: {replaced_total}")
    if args.dry_run:
        return
    path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print("escrito", path)


if __name__ == "__main__":
    main()
