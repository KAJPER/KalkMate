"""Obsługa kolejki: drukowanie zleceń po kolei + synchronizacja z platformą.

Platforma (kalkmate.pl) jest w chmurze, drukarka w sieci lokalnej. Agent sam
łączy się z platformą (wychodzące HTTPS) — nie trzeba otwierać portów na
routerze ani wystawiać drukarki do internetu.

Protokół z serwerem (website/src/lib/fiscal.ts, kontrakt K6):
- claim i raporty niosą trwały agentId (body.agentId + nagłówek x-fiscal-agent-id),
  serwer oddaje pobrane zlecenie tylko temu samemu agentowi;
- odpowiedź raportu {ok, state, accepted}: accepted=false albo stan
  cancelled/cancel_requested/superseded = porzuć zlecenie BEZ drukowania
  (jeśli mogło się wydrukować — zachowaj i oznacz konflikt); 404 = serwer nie zna
  zlecenia (osierocone: nie drukujemy, ostrzeżenie w /status);
- przed drukiem zlecenia z platformy agent potwierdza je raportem 'printing' —
  tak dowiaduje się o anulowaniu zlecenia, które czekało w kolejce.
"""

from __future__ import annotations

import logging
import threading
import time
from urllib.parse import quote

import httpx
from pydantic import ValidationError

from . import __version__
from .config import Config
from .models import ReceiptRequest, ReceiptResult
from .posnet.errors import Category, PrinterError
from .printer import Printer, PrinterStatus
from .store import Store

log = logging.getLogger(__name__)

REJECTED_STATES = {"cancelled", "cancel_requested", "superseded"}
CONFIRM_RETRY_S = 30.0


class PlatformClient:
    def __init__(self, cfg: Config, agent_id: str | None = None, http: httpx.Client | None = None) -> None:
        self.agent_id = agent_id
        headers = {"x-fiscal-agent-token": cfg.platform_token,
                   "user-agent": f"kalkmate-fiscal-agent/{__version__}"}
        if agent_id:
            headers["x-fiscal-agent-id"] = agent_id
        self._http = http or httpx.Client(base_url=cfg.platform_url, timeout=20, headers=headers)

    def _body(self, data: dict) -> dict:
        return {**data, "agentId": self.agent_id} if self.agent_id else data

    def claim(self, printer: dict | None) -> dict | None:
        r = self._http.post("/api/fiscal/agent/claim", json=self._body({"version": __version__, "printer": printer}))
        r.raise_for_status()
        return r.json().get("job")

    def report(self, result: ReceiptResult) -> dict:
        """Zwraca odpowiedź serwera {ok, state, accepted}; nieznane zlecenie -> {found: False, state: 'unknown'}."""
        r = self._http.post(f"/api/fiscal/agent/jobs/{quote(result.id, safe='')}",
                            json=self._body(result.model_dump()))
        if r.status_code == 404:
            try:
                body = r.json()
            except ValueError:
                body = None
            # Tylko odpowiedź API ({state: 'unknown'}) — 404 z proxy (zły adres) to zwykły błąd.
            if isinstance(body, dict) and body.get("state") == "unknown":
                return {"found": False, "state": "unknown", "accepted": False}
        r.raise_for_status()
        data = r.json()
        return data if isinstance(data, dict) else {}


def report_verdict(info: object) -> str:
    """'ok' | 'orphan' | 'rejected' — jak agent ma potraktować odpowiedź raportu."""
    if not isinstance(info, dict):
        return "ok"  # stary serwer / brak treści
    if info.get("found") is False or info.get("state") == "unknown":
        return "orphan"
    if info.get("accepted") is False or info.get("state") in REJECTED_STATES:
        return "rejected"
    return "ok"


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
        self.claim_blocked: str | None = None
        self.last_loop_at: float | None = None
        self.last_loop_error: str | None = None

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

    def retry(self, job_id: str) -> bool:
        """Ręczne ponowienie — tylko z failed/uncertain. False = stan na to nie pozwala."""
        if not self.store.requeue(job_id):
            return False
        self._wake.set()
        return True

    def worker_info(self) -> dict:
        alive = bool(self._thread and self._thread.is_alive())
        return {"alive": alive, "last_loop_at": self.last_loop_at, "error": self.last_loop_error}

    def alerts(self) -> list[str]:
        out: list[str] = []
        if self._thread is not None and not self._thread.is_alive() and not self._stop.is_set():
            out.append("Wątek agenta nie działa — zrestartuj usługę.")
        if self.last_loop_error:
            out.append(f"Błąd pętli agenta: {self.last_loop_error}")
        for a in self.store.alerts():
            out.append(f"{a['id']}: {a['note']}")
        return out

    # --- przetwarzanie --------------------------------------------------------
    def process_one(self) -> bool:
        job_id = self.store.next_due()
        if not job_id:
            return False
        try:
            req = self.store.payload(job_id)
        except Exception as e:  # noqa: BLE001 — uszkodzony wpis w bazie, nic nie drukujemy
            log.error("zlecenie %s: nieczytelne dane w lokalnej bazie: %s", job_id, e)
            self.store.finish(job_id, "failed", error=f"Nieczytelne dane zlecenia w lokalnej bazie: {e}",
                              category=Category.INVALID.value)
            return True
        if not self._confirm_with_platform(job_id):
            return True
        if not self.store.mark_printing(job_id):
            log.warning("zlecenie %s: stan zmienił się tuż przed drukiem — pomijam", job_id)
            return True
        attempts = self.store.get(job_id).attempts  # type: ignore[union-attr]
        try:
            number = self.printer.print_receipt(req)
        except PrinterError as e:
            if e.retryable:
                self._retry(job_id, attempts, e)
            else:
                state = "uncertain" if e.category == Category.UNCERTAIN else "failed"
                log.error("zlecenie %s: %s", job_id, e)
                self.store.finish(job_id, state, error=str(e), error_code=e.code, category=e.category.value)
        except Exception as e:  # noqa: BLE001 — w tym AmbiguousCommand: printer.py zamienia je na
            # PrinterError, więc tutaj to błąd w kodzie. Nie ponawiamy w ciemno.
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

    def _confirm_with_platform(self, job_id: str) -> bool:
        """Zlecenie z platformy: tuż przed drukiem pytamy serwer, czy wciąż jest nasze."""
        if self.platform is None or self.store.source(job_id) != "platform":
            return True
        res = self.store.get(job_id)
        if res is None:
            return False
        stamp = self.store.updated_at(job_id)
        try:
            info = self.platform.report(res.model_copy(update={"state": "printing"}))
        except Exception as e:  # noqa: BLE001
            log.warning("zlecenie %s: brak potwierdzenia z serwera (%s) — czeka", job_id, e)
            self.store.defer(job_id, f"Brak potwierdzenia zlecenia z serwera przed drukiem ({e}) — ponowię.",
                             CONFIRM_RETRY_S)
            return False
        if report_verdict(info) == "ok":
            return True
        self._handle_report(res, info, stamp)
        return False

    def _handle_report(self, res: ReceiptResult, info: object, stamp: float) -> None:
        verdict = report_verdict(info)
        if verdict == "ok":
            self.store.mark_reported(res.id, stamp)
            return
        server_state = info.get("state") if isinstance(info, dict) else None
        if verdict == "orphan":
            note = ("Serwer nie zna tego zlecenia (404) — agent go nie drukuje i nie raportuje; sprawdź w panelu."
                    if res.state != "printed" else
                    f"Paragon nr {res.receipt_number} wydrukowany, ale serwer nie zna zlecenia (404) — wpisz go ręcznie.")
            self.store.mark_orphaned(res.id, note)
            log.error("zlecenie %s osierocone: %s", res.id, note)
            return
        if self.store.abandon(res.id):
            log.warning("zlecenie %s porzucone bez drukowania (serwer: stan %s)", res.id, server_state)
            return
        cur = self.store.get(res.id)
        if cur is None:
            return
        note = (f"KONFLIKT: serwer odrzucił raport '{res.state}' (stan na serwerze: {server_state}), a lokalnie "
                f"zlecenie jest '{cur.state}'"
                + (f" z paragonem nr {cur.receipt_number}" if cur.receipt_number else "")
                + " — możliwy niechciany lub podwójny paragon, sprawdź w panelu.")
        self.store.mark_conflict(res.id, note, stamp)
        log.error("zlecenie %s: %s", res.id, note)

    def _claim_block_reason(self) -> tuple[str | None, PrinterStatus | None]:
        pending = self.store.pending_with_error()
        if pending:
            return f"{pending} zleceń czeka na ponowienie po błędzie — nowe nie są pobierane", None
        # Niegotowa drukarka: sprawdzaj częściej, żeby szybko wznowić pobieranie.
        not_ready = self._status is not None and not self._status.ready
        st = self.printer_status(self.cfg.poll_interval if not_ready else None)
        if not st.online:
            return f"drukarka niedostępna ({st.describe()})", st
        if not st.ready:
            return f"drukarka nie jest gotowa ({st.describe()})", st
        if st.fiscal and not self.printer.allow_fiscal:
            return "drukarka w trybie FISKALNYM, a druk fiskalny jest zablokowany (FISCAL_ALLOW_REAL=0)", st
        return None, st

    def sync_platform(self) -> None:
        if not self.platform:
            return
        errors: list[str] = []
        for res in self.store.unreported():
            stamp = self.store.updated_at(res.id)
            try:
                info = self.platform.report(res)
            except Exception as e:  # noqa: BLE001 — błąd jednego raportu nie blokuje reszty ani claim
                errors.append(f"raport {res.id}: {e}")
                log.warning("raport %s: %s", res.id, e)
                continue
            self._handle_report(res, info, stamp)

        # Nie pobieramy nowych zleceń, gdy i tak nie da się ich wydrukować.
        # UWAGA: claim jest też heartbeatem — przy niegotowej drukarce serwer
        # przestaje widzieć agenta jako online (stan widać w /status).
        reason, st = self._claim_block_reason()
        self.claim_blocked = reason
        if reason is None and st is not None:
            try:
                self._claim(st)
            except (httpx.HTTPError, ValueError, KeyError, TypeError) as e:
                errors.append(f"claim: {e}")
                log.warning("synchronizacja z platformą: %s", e)
        self.last_platform_error = "; ".join(errors) or None

    def _claim(self, st: PrinterStatus) -> None:
        assert self.platform is not None
        job = self.platform.claim(st.as_dict())
        if not job:
            return
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

    def _iteration(self) -> None:
        self.sync_platform()
        while not self._stop.is_set() and self.process_one():
            self.sync_platform()

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                self._iteration()
                self.last_loop_error = None
            except Exception as e:  # noqa: BLE001 — wątek workera nie może umrzeć po cichu
                log.exception("pętla agenta: nieoczekiwany błąd")
                self.last_loop_error = f"{type(e).__name__}: {e}"
            self.last_loop_at = time.time()
            self._wake.wait(self.cfg.poll_interval)
            self._wake.clear()
