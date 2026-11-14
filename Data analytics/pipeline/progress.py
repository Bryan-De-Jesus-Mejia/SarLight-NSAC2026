"""Utilidades de progreso para los procesadores (mismo estilo que bulk_fetch.py)."""
import sys
import threading
import time

HEARTBEAT_S = 30


def setup_stdout():
    # Sin esto, con nohup/tee/ssh/IDE la salida queda en buffer y la consola parece colgada.
    sys.stdout.reconfigure(line_buffering=True)


def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def fmt_dur(seconds: float) -> str:
    h, rem = divmod(int(seconds), 3600)
    m, s = divmod(rem, 60)
    return f"{h}h{m:02d}m{s:02d}s" if h else f"{m}m{s:02d}s"


class Progress:
    """Contador [i/N] con %, velocidad y tiempo transcurrido, más un resumen periódico."""

    def __init__(self, total: int, label: str, unit: str = "escenas", summary_every_s: float = 60):
        self.total, self.label, self.unit = total, label, unit
        self.ok = self.failed = self.skipped = 0
        self.t0 = self.last_summary = time.time()
        self.summary_every_s = summary_every_s
        log(f"{label}: {total} {unit} por procesar")

    @property
    def done(self) -> int:
        return self.ok + self.failed + self.skipped

    def _stats(self) -> str:
        elapsed = time.time() - self.t0
        rate = self.done / (elapsed / 60) if elapsed > 0 else 0
        pct = 100 * self.done / self.total if self.total else 100
        return f"{pct:5.1f}% | {rate:.1f} {self.unit}/min | transcurrido {fmt_dur(elapsed)}"

    def step(self, msg: str, status: str = "OK"):
        if status == "OK":
            self.ok += 1
        elif status == "SALTADA":
            self.skipped += 1
        else:
            self.failed += 1
        log(f"[{self.done}/{self.total}] {status:7} {msg} | {self._stats()}")
        if time.time() - self.last_summary >= self.summary_every_s:
            self.summary()

    def summary(self, final: bool = False):
        self.last_summary = time.time()
        head = "FIN" if final else "PROGRESO"
        print(f"\n[{time.strftime('%H:%M:%S')}] {head} {self.label}: {self.done}/{self.total} {self.unit} | "
              f"{self.ok} OK, {self.failed} error, {self.skipped} saltadas | {self._stats()}\n", flush=True)


class Heartbeat:
    """Context manager: imprime '... sigue trabajando' cada N s durante un paso largo."""

    def __init__(self, msg: str, every_s: float = HEARTBEAT_S):
        self.msg, self.every_s = msg, every_s
        self._stop = threading.Event()

    def __enter__(self):
        self.t0 = time.time()
        log(f"{self.msg} ...")
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        return self

    def _run(self):
        while not self._stop.wait(self.every_s):
            log(f"   ... {self.msg}: sigue trabajando ({fmt_dur(time.time() - self.t0)})")

    def __exit__(self, *exc):
        self._stop.set()
        self._thread.join()
        if exc[0] is None:
            log(f"   {self.msg}: listo en {fmt_dur(time.time() - self.t0)}")
        return False
