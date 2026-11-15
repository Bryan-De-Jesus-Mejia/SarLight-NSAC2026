#!/usr/bin/env bash
# Un solo comando en el Codespace: git pull -> descarga + análisis -> commit/push SOLO de data/analisis.
#
#   cloud/correr.sh embalse_sabaneta lago_enriquillo   # trabajos por nombre (o prefijo: embalse_)
#   cloud/correr.sh --grupo meteo_rd                   # un bloque entero de cloud/trabajos.txt
#   cloud/correr.sh                                    # lista lo que hay y sale
set -euo pipefail

cd "$(dirname "$0")/.."            # DataAnalytics
REPO="$(git rev-parse --show-toplevel)"

if [[ $# -eq 0 ]]; then
    echo "Indica qué correr: nombres/prefijos de trabajos o --grupo <grupo>. Disponibles:"
    python cloud/run_jobs.py --listar
    exit 1
fi

echo "[$(date +%H:%M:%S)] git pull ..."
if ! git -C "$REPO" pull --rebase --autostash; then
    echo "git pull falló. Si se queja de archivos de data/analisis que 'would be overwritten'," >&2
    echo "son análisis generados aquí antes de estar en git:  rm -rf $REPO/DataAnalytics/data/analisis" >&2
    exit 1
fi

# Si el primer argumento no es una opción, son nombres de trabajos.
if [[ "$1" != --* ]]; then
    set -- --solo "$@"
fi
exec python cloud/run_jobs.py "$@" --commit
