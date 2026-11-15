"""Dónde se guardan los análisis: data/analisis/<tipo>/<colección>/.

El tipo sale del prefijo del nombre de la colección (terremoto_venezuela -> terremotos) o de --tipo.
"""
from pathlib import Path

# Sin dependencias externas: GitHub Actions lo usa para ver si hay trabajos pendientes antes de instalar nada.
ROOT = Path(__file__).resolve().parent.parent
ANALISIS = ROOT / "data" / "analisis"
TIPOS = {
    "agricola": "agricultura",
    "calor": "calor_extremo",
    "colapso": "deslizamientos",
    "deslizamiento": "deslizamientos",
    "embalse": "embalses_y_lagos",
    "glaciar": "glaciares",
    "incendio": "incendios",
    "inundacion": "inundaciones",
    "lago": "embalses_y_lagos",
    "sequia": "sequias",
    "terremoto": "terremotos",
    "viento": "vientos",
}


def tipo_de(collection: str) -> str:
    return TIPOS.get(collection.split("_")[0], "otros")


def analysis_dir(collection: str, tipo: str | None = None) -> Path:
    return ANALISIS / (tipo or tipo_de(collection)) / collection


def case_dirs(root: Path = ANALISIS) -> list[Path]:
    """Carpetas de caso (colección) en data/analisis, tanto <tipo>/<caso> como el formato antiguo <caso>."""
    out = []
    for d in sorted(p for p in root.iterdir() if p.is_dir()):
        if d.name in TIPOS.values() or d.name == "otros":
            out += sorted(p for p in d.iterdir() if p.is_dir())
        else:
            out.append(d)
    return out
