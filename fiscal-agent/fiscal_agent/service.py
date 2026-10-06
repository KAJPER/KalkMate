"""Obsługa kolejki: drukowanie zleceń po kolei + synchronizacja z platformą.

Platforma (kalkmate.pl) jest w chmurze, drukarka w sieci lokalnej. Agent sam
łączy się z platformą (wychodzące HTTPS) — nie trzeba otwierać portów na
routerze ani wystawiać drukarki do internetu.
"""

from __future__ import annotations

import logging
import threading
import time

import httpx
from pydantic import ValidationError

from . import __version__
from .config import Config
from .models import ReceiptRequest, ReceiptResult
from .posnet.client import AmbiguousCommand
from .posnet.errors import Category, PrinterError
from .printer import Printer, PrinterStatus
from .store import Store

log = logging.getLogger(__name__)


class PlatformClient:
    def __init__(self, cfg: Config) -> None:
        self._http = httpx.Client(base_url=cfg.platform_url, timeout=20,
                                  headers={"x-fiscal-agent-token": cfg.platform_token,
                                           "user-agent": f"kalkmate-fiscal-agent/{__version__}"})

    def claim(self, printer: dict | None) -> dict | None:
        r = self._http.post("/api/fiscal/agent/claim", json={"version": __version__, "printer": printer})
        r.raise_for_status()
        return r.json().get("job")

    def report(self, result: ReceiptResult) -> None:
        r = self._http.post(f"/api/fiscal/agent/jobs/{result.id}", json=result.model_dump())
        r.raise_for_status()


class FiscalService:
    def __init__(self, cfg: Config, store: Store, printer: Printer,
                 platform: PlatformClient | None = None) -> None:
        self.cfg = cfg
        self.store = store
        self.printer = printer
        self.platform = platform
        self._wake = threading.Event()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._status: PrinterStatus | None = None
        self._status_at = 0.0
        self.last_platform_error: str | None = None

    # --- API ------------------------------------------------------------------
    def submit(self, req: ReceiptRequest, source: str = "local") -> ReceiptResult:
        result, created = self.store.add(req, source)
        if created:
            self._wake.set()
        return result

    def wait(self, job_id: str, timeout: float) -> ReceiptResult | None:
        deadline = time.monotonic() + timeout
        while True:
            res = self.store.get(job_id)
            if res is None or res.state in {"printed", "failed", "uncertain"} or time.monotonic() >= deadline:
                return res
            time.sleep(0.2)

    def printer_status(self, max_age: float | None = None) -> PrinterStatus:
        max_age = self.cfg.status_interval if max_age is None else max_age
        if self._status is None or time.monotonic() - self._status_at > max_age:
            self._status = self.printer.status()
            self._status_at = time.monotonic()
        return self._status

    def retry(self, job_id: str) -> ReceiptResult | None:
        if self.store.get(job_id) is None:
            return None
        self.store.requeue(job_id)
        self._wake.set()
        return self.store.get(job_id)

    # --- przetwarzanie --------------------------------------------------------
    def process_one(self) -> bool:
        job_id = self.store.next_due()
        if not job_id:
            return False
        req = self.store.payload(job_id)
        self.store.mark_printing(job_id)
        attempts = self.store.get(job_id).attempts  # type: ignore[union-attr]
        try:
            number = self.printer.print_receipt(req)
        except AmbiguousCommand as e:
            # Rozkaz statusu bez odpowiedzi przed rozpoczęciem paragonu — nic nie wydrukowano.
            self._retry(job_id, attempts, PrinterError(Category.CONNECTION, f"Brak odpowiedzi drukarki ({e})"))
        except PrinterError as e:
            if e.retryable:
                self._retry(job_id, attempts, e)
            else:
                state = "uncertain" if e.category == Category.UNCERTAIN else "failed"
                log.error("zlecenie %s: %s", job_id, e)
                self.store.finish(job_id, state, error=str(e), error_code=e.code, category=e.category.value)
        except Exception as e:  # noqa: BLE001 — nieznany błąd: nie ponawiamy w ciemno
            log.exception("zlecenie %s: nieoczekiwany błąd", job_id)
            self.store.finish(job_id, "uncertain", error=f"Nieoczekiwany błąd agenta: {e}",
                              category=Category.INTERNAL.value)
        else:
            log.info("zlecenie %s: paragon nr %s", job_id, number)
            self.store.finish(job_id, "printed", receipt_number=number)
        self._status_at = 0  # odśwież status przy następnym zapytaniu
        return True

    def _retry(self, job_id: str, attempts: int, e: PrinterError) -> None:
        delay = min(self.cfg.max_backoff, 5 * 2 ** max(0, attempts - 1))
        log.warning("zlecenie %s: %s — ponowienie za %.0fs", job_id, e, delay)
        self.store.finish(job_id, "queued", error=str(e), error_code=e.code,
                          category=e.category.value, retry_in=delay)

    def sync_platform(self) -> None:
        if not self.platform:
            return
        try:
            for res in self.store.unreported():
                stamp = self.store.updated_at(res.id)
                self.platform.report(res)
                self.store.mark_reported(res.id, stamp)
            status = self.printer_status().as_dict()
            job = self.platform.claim(status)
            if job:
                try:
                    req = ReceiptRequest.model_validate(job["receipt"] | {"id": job["id"]})
                except ValidationError as e:
                    # Błędne dane z platformy — odsyłamy błąd, żeby zlecenie nie wracało w kółko.
                    self.platform.report(ReceiptResult(id=job["id"], state="failed",
                                                       error=f"Błędne dane paragonu: {e}",
                                                       category=Category.INVALID.value))
                    return
                res, created = self.store.add(req, "platform")
                if not created:
                    # Znamy już to zlecenie (np. raport się nie udał) — tylko odeślij stan.
                    self.store.mark_unreported(res.id)
                self._wake.set()
            self.last_platform_error = None
        except (httpx.HTTPError, ValueError, KeyError) as e:
            self.last_platform_error = str(e)
            log.warning("synchronizacja z platformą: %s", e)

    # --- pętla ----------------------------------------------------------------
    def start(self) -> None:
        recovered = self.store.recover()
        if recovered:
            log.error("%d zleceń przerwanych w trakcie druku oznaczono jako niepewne", recovered)
        self._thread = threading.Thread(target=self._run, name="fiscal-worker", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._wake.set()
        if self._thread:
            self._thread.join(timeout=30)

    def _run(self) -> None:
        while not self._stop.is_set():
            self.sync_platform()
            while not self._stop.is_set() and self.process_one():
                self.sync_platform()
            self._wake.wait(self.cfg.poll_interval)
            self._wake.clear()
