"""Descarga (streaming, solo el bbox) series de interferogramas NISAR GUNW para medir el flujo de un glaciar.

A diferencia de fetch_quake.py (un par que cruza la fecha del sismo), aquí se bajan TODOS los pares
consecutivos de corta separación (12 días) dentro de un rango de fechas, para las N geometrías que
mejor cubren el bbox. Así se obtiene una serie temporal de velocidad del hielo.

En glaciares rápidos la fase se decorrelaciona en 12 días; la velocidad sale de los offsets de píxeles
(offset_rango / offset_azimut, en metros por par). En el hielo lento y las márgenes sirve la fase.
Capas, carpetas y catalog.csv son los mismos que en fetch_quake.py. Reanudable.

Ejemplo:
  python pipeline/fetch_glacier.py --name glaciar_jakobshavn --bbox -50.6 69.0 -48.8 69.35 --start 2026-06-01
"""
import argparse
import json
import time
from datetime import date

import sar_io
from fetch_quake import download, search_gunw
from progress import log, setup_stdout
from search_scenes import DATA_DIR


def main():
    setup_stdout()
    sar_io.VERBOSE = True
    log("fetch_glacier iniciado")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--name", required=True, help="Nombre de la colección (p.ej. glaciar_jakobshavn)")
    ap.add_argument("--bbox", nargs=4, type=float, required=True,
                    metavar=("LON_MIN", "LAT_MIN", "LON_MAX", "LAT_MAX"))
    ap.add_argument("--start", required=True, help="YYYY-MM-DD")
    ap.add_argument("--end", default=date.today().isoformat(), help="YYYY-MM-DD (def. hoy)")
    ap.add_argument("--max-days", type=int, default=12, help="Separación máxima ref-sec en días (def. 12)")
    ap.add_argument("--min-coverage", type=float, default=60, help="%% mínimo del bbox cubierto (def. 60)")
    ap.add_argument("--groups", type=int, default=2,
                    help="Geometrías a bajar, las de mejor cobertura y más pares (def. 2: idealmente asc + desc)")
    ap.add_argument("--group", nargs="+", help="Solo geometrías cuyo nombre contenga este texto (p.ej. T131)")
    ap.add_argument("--workers", type=int, default=1, help="Pares en paralelo (def. 1; en la nube usa 3-4)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    by_group = search_gunw(args.bbox, date.fromisoformat(args.start), date.fromisoformat(args.end),
                           args.max_days, args.min_coverage)
    if args.group:
        by_group = {g: r for g, r in by_group.items() if any(s in g for s in args.group)}
    ranked = sorted(by_group.items(), key=lambda kv: (-min(r["cov"] for r in kv[1]), -len(kv[1])))
    # Prioriza una ascendente y una descendente: dos direcciones de mirada permiten separar componentes.
    chosen, dirs = [], set()
    for g, recs in ranked:
        if len(chosen) < args.groups and (recs[0]["direction"] not in dirs or len(dirs) == 2):
            chosen.append(g)
            dirs.add(recs[0]["direction"])
    for g, recs in ranked:
        if len(chosen) < args.groups and g not in chosen:
            chosen.append(g)

    log(f"{len(by_group)} geometrías con cobertura >= {args.min_coverage}%:")
    for g, recs in ranked:
        mark = "->" if g in chosen else "  "
        log(f"  {mark} {g:20} {len(recs):3} pares | cubre {min(r['cov'] for r in recs)}-"
            f"{max(r['cov'] for r in recs)}% | {min(r['ref'] for r in recs)} .. {max(r['sec'] for r in recs)}")
    pairs = sorted((r for g in chosen for r in by_group[g]), key=lambda r: (r["group"], r["ref"]))
    log(f"{len(pairs)} pares seleccionados en {len(chosen)} geometrías")
    if args.dry_run or not pairs:
        return

    root = DATA_DIR / "collections" / args.name
    root.mkdir(parents=True, exist_ok=True)
    (root / "manifest.json").write_text(json.dumps(
        {"type": "glacier", "bbox": args.bbox, "start": args.start, "end": args.end, "max_days": args.max_days,
         "min_coverage": args.min_coverage, "groups": chosen,
         "updated": time.strftime("%Y-%m-%dT%H:%M:%S")}, indent=2))
    download(pairs, args.bbox, root, args.name, args.workers)


if __name__ == "__main__":
    main()
