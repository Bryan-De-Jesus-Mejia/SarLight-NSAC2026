"""Corre en la nube (GitHub Codespaces) los trabajos de cloud/trabajos.txt y empaqueta los resultados.

La PC local tiene ~1 MB/s de internet; en la nube la descarga desde ASF es mucho más rápida. Aquí se
baja y se analiza todo, y solo se trae a casa un .tar.gz con el ANÁLISIS (los datos crudos se quedan en la nube):
  - data/analisis/<colección>/            (mapas PNG, estadísticas JSON, GeoTIFF de resultados)
  - catalog.csv / manifest.json / errors.log de cada colección (sin las imágenes)
  - cloud/logs/ (un log por trabajo)
Si una colección no tiene análisis, se avisa y queda fuera del paquete.

Uso (desde "Data analytics"):
  python cloud/run_jobs.py --solo agricola_ --commit   # baja, analiza y sube SOLO data/analisis a GitHub
  python cloud/run_jobs.py --solo glaciar_jakobshavn colapso_langtang
  python cloud/run_jobs.py --solo-empaquetar           # vuelve a crear el .tar.gz con lo que ya hay
--solo acepta nombres completos o prefijos (agricola_, glaciar_, ...).
Con --commit: en la PC local basta con git pull. Sin él: descarga resultados/resultados_<fecha>.tar.gz
(clic derecho > Download en VS Code) y en la PC local:  tar -xzf resultados_<fecha>.tar.gz -C "Data analytics"
"""
import argparse
import os
import subprocess
import sys
import tarfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT / "pipeline"))

from progress import Progress, fmt_dur, log, setup_stdout  # noqa: E402
from rutas import case_dirs  # noqa: E402

LOGS = HERE / "logs"
DATA = ROOT / "data"
GITHUB_MAX_MB = 95  # GitHub rechaza archivos de más de 100 MB


def read_jobs(path: Path) -> dict[str, str]:
    jobs = {}
    for n, line in enumerate(path.read_text().splitlines(), 1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        name, sep, cmd = line.partition(":")
        if not sep or not cmd.strip():
            raise SystemExit(f"{path}:{n}: formato esperado 'nombre: comando'")
        jobs[name.strip()] = cmd.strip()
    return jobs


def last_line(path: Path) -> str:
    try:
        lines = [l for l in path.read_text(errors="replace").splitlines() if l.strip()]
        return lines[-1][-110:] if lines else "(sin salida aún)"
    except FileNotFoundError:
        return "(esperando turno)"


def run_job(name: str, cmd: str) -> tuple[int, float]:
    env = {**os.environ, "PYTHONUNBUFFERED": "1",
           "PATH": f"{Path(sys.executable).parent}{os.pathsep}{os.environ.get('PATH', '')}"}
    t0 = time.time()
    with open(LOGS / f"{name}.log", "w") as f:
        code = subprocess.run(["bash", "-c", cmd], cwd=ROOT, stdout=f, stderr=subprocess.STDOUT, env=env).returncode
    return code, time.time() - t0


def package(include_raw: list[str]) -> Path:
    out_dir = ROOT / "resultados"
    out_dir.mkdir(exist_ok=True)
    out = out_dir / f"resultados_{time.strftime('%Y%m%d_%H%M')}.tar.gz"
    analyzed = {p.name for p in case_dirs(DATA / "analisis")}
    files = [p for p in sorted((DATA / "analisis").rglob("*")) if p.is_file()]
    for coll in sorted(p for p in (DATA / "collections").glob("*") if p.is_dir()):
        if coll.name not in analyzed:
            log(f"   AVISO: {coll.name} no tiene análisis en data/analisis; sus datos se quedan en la nube")
        raw = coll.name in include_raw
        for p in sorted(coll.rglob("*")):
            if p.is_file() and (raw or p.name in ("catalog.csv", "manifest.json", "errors.log")):
                files.append(p)
    files += sorted(LOGS.glob("*.log"))
    total = sum(p.stat().st_size for p in files)
    log(f"Empaquetando {len(files)} archivos ({total / 2**20:.0f} MB) ...")
    with tarfile.open(out, "w:gz", compresslevel=6) as tar:
        for p in files:
            tar.add(p, arcname=str(p.relative_to(ROOT)))
    log(f"Paquete: {out} ({out.stat().st_size / 2**20:.0f} MB)")
    return out


def git(*args: str, check: bool = True) -> subprocess.CompletedProcess:
    r = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    if check and r.returncode:
        raise RuntimeError(f"git {' '.join(args)} falló:\n{r.stdout}{r.stderr}")
    return r


def commit_analysis(names: list[str]):
    """Commit + push SOLO de data/analisis (los datos crudos y los logs nunca se suben)."""
    analysis = DATA / "analisis"
    big = [p for p in analysis.rglob("*") if p.is_file() and p.stat().st_size > GITHUB_MAX_MB * 2**20]
    git("add", "-A", "--", str(analysis))
    for p in big:
        git("reset", "-q", "--", str(p))
        log(f"   AVISO: {p.relative_to(ROOT)} pesa {p.stat().st_size / 2**20:.0f} MB; no se sube (límite GitHub)")
    if not git("diff", "--cached", "--quiet", "--", str(analysis), check=False).returncode:
        log("No hay cambios en data/analisis que subir.")
        return
    files = git("diff", "--cached", "--name-only", "--", str(analysis)).stdout.splitlines()
    msg = f"Resultados de la nube: {', '.join(names)}" if len(names) <= 6 else f"Resultados de la nube: {len(names)} trabajos"
    git("commit", "-q", "-m", msg, "--", str(analysis))
    log(f"Commit con {len(files)} archivos de data/analisis: {msg}")
    git("pull", "-q", "--rebase", "--autostash")
    git("push", "-q", "origin", "HEAD")
    log("Push hecho. En la PC local: git pull")


def main():
    setup_stdout()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--jobs-file", type=Path, default=HERE / "trabajos.txt")
    ap.add_argument("--solo", nargs="+", help="Solo estos trabajos (por nombre)")
    ap.add_argument("--paralelo", type=int, default=3, help="Trabajos a la vez (def. 3)")
    ap.add_argument("--incluir-datos", nargs="*", default=[],
                    help="Meter también los datos crudos de estas colecciones (por defecto no van; pesan mucho)")
    ap.add_argument("--solo-empaquetar", action="store_true")
    ap.add_argument("--commit", action="store_true",
                    help="Al terminar, commit + push de data/analisis (en vez de crear el .tar.gz)")
    args = ap.parse_args()

    if args.solo_empaquetar:
        package(args.incluir_datos)
        return

    jobs = read_jobs(args.jobs_file)
    if args.solo:
        missing = [s for s in args.solo if not any(k.startswith(s) for k in jobs)]
        if missing:
            raise SystemExit(f"No están en {args.jobs_file.name}: {missing}. Hay: {sorted(jobs)}")
        jobs = {k: v for k, v in jobs.items() if any(k.startswith(s) for s in args.solo)}

    from earthdata_auth import get_token
    get_token()  # falla aquí, y no a mitad de camino, si faltan los secretos de Earthdata
    log("Credenciales de Earthdata OK")

    LOGS.mkdir(exist_ok=True)
    log(f"{len(jobs)} trabajos, {args.paralelo} a la vez. Logs en {LOGS}/<trabajo>.log")
    running: dict[str, float] = {}
    lock = threading.Lock()
    stop = threading.Event()

    def status_loop():
        while not stop.wait(60):
            with lock:
                for name, t0 in running.items():
                    log(f"   ... {name} ({fmt_dur(time.time() - t0)}): {last_line(LOGS / f'{name}.log')}")

    def task(name: str):
        with lock:
            running[name] = time.time()
        try:
            return run_job(name, jobs[name])
        finally:
            with lock:
                running.pop(name, None)

    threading.Thread(target=status_loop, daemon=True).start()
    prog = Progress(len(jobs), "Trabajos en la nube", unit="trabajos")
    with ThreadPoolExecutor(args.paralelo) as pool:
        futures = {pool.submit(task, name): name for name in jobs}
        for fut in as_completed(futures):
            name = futures[fut]
            code, dt = fut.result()
            status = "OK" if code == 0 else "ERROR"
            prog.step(f"{name} en {fmt_dur(dt)} | {last_line(LOGS / f'{name}.log')}", status=status)
    stop.set()
    prog.summary(final=True)
    if args.commit:
        commit_analysis(list(jobs))
    else:
        package(args.incluir_datos)


if __name__ == "__main__":
    main()
