"""Testy regresyjne audytu 2026-10-16 (agent fiskalny).

Najważniejszy niezmiennik: nigdy dwa paragony dla jednego zlecenia. Po wysłaniu
trend każdy błąd kończy się 'printed' (licznik bn wzrósł dokładnie o 1) albo
'uncertain' — nigdy ponowieniem ani 'failed' bez dowodu, że paragon nie powstał.
"""

import time

import httpx
import pytest
from conftest import receipt
from fastapi.testclient import TestClient

from fiscal_agent.app import create_app
from fiscal_agent.config import Config
from fiscal_agent.models import ReceiptRequest, ReceiptResult
from fiscal_agent.posnet.client import AmbiguousCommand, MemoryTokens, PersistentTokens, PosnetClient
from fiscal_agent.posnet.errors import Category, PrinterError
from fiscal_agent.posnet.frame import encode, printer_text
from fiscal_agent.printer import Printer, ReceiptLimits
from fiscal_agent.service import FiscalService, PlatformClient
from fiscal_agent.store import Store


def req(**over) -> ReceiptRequest:
    return ReceiptRequest.model_validate(receipt(**over))


def run_job(service, request=None):
    request = request or req()
    service.submit(request)
    service.process_one()
    return service.store.get(request.id)


# --- 1. Po trend: printed albo uncertain, nigdy ponowienie ----------------------

def test_scnt_lost_after_trend_does_not_print_twice(service, sim):
    # 1. scnt = status przed paragonem, 2. scnt = odczyt numeru po trend (zerwane, rpt nie zna tokenu).
    sim.state.add_fault("drop_before", "scnt:2")
    res = run_job(service)
    assert res.state == "printed" and res.receipt_number == 101
    assert not service.process_one()
    assert len(sim.state.printed) == 1


def test_busy_error_on_scnt_after_trend_does_not_print_twice(service, sim):
    sim.state.add_fault("error", "scnt:14:2")  # 14 = zapełniona kolejka (BUSY, ponawialne)
    res = run_job(service)
    assert res.state == "printed" and res.receipt_number == 101
    assert not service.process_one()
    assert len(sim.state.printed) == 1


def test_scnt_unreadable_after_trend_is_uncertain_not_retried(service, sim):
    sim.state.add_fault("drop_before", "scnt:2")
    sim.state.add_fault("drop_before", "scnt:3")  # odczyt po ponownym połączeniu też pada
    res = run_job(service)
    assert res.state == "uncertain" and "NAJPRAWDOPODOBNIEJ" in res.error
    assert not service.process_one()
    assert len(sim.state.printed) == 1


def test_bad_crc_on_trend_response_is_printed(service, sim):
    sim.state.add_fault("bad_crc", "trend")  # paragon wydrukowany, odpowiedź przekłamana
    res = run_job(service)
    assert res.state == "printed" and res.receipt_number == 101
    assert len(sim.state.printed) == 1 and sim.state.cancelled == 0


def test_counter_jump_after_trend_is_uncertain(service, sim):
    sim.state.trend_jump = 1  # licznik skacze o 2 — nie wiadomo, który paragon jest nasz
    res = run_job(service)
    assert res.state == "uncertain" and res.receipt_number is None
    assert not service.process_one()
    assert len(sim.state.printed) == 1


def test_trend_rejected_by_printer_is_cancelled_and_failed(service, sim):
    sim.state.add_fault("error", "trend:2805")  # drukarka czytelnie odrzuca trend
    res = run_job(service)
    assert res.state == "failed" and res.error_code == 2805
    assert not sim.state.printed and sim.state.cancelled == 1 and not sim.state.open


def test_trend_lost_and_cancel_fails_is_uncertain(service, sim):
    sim.state.add_fault("drop_before", "trend")
    sim.state.add_fault("error", "prncancel:2060")
    res = run_job(service)
    assert res.state == "uncertain"
    assert not service.process_one()
    assert not sim.state.printed


def test_trend_lost_is_retried_only_after_proof(printer, sim):
    sim.state.drop_before.add("trend")
    with pytest.raises(PrinterError) as e:
        printer.print_receipt(req())
    assert e.value.category == Category.CONNECTION
    i = len(sim.state.commands) - 1 - sim.state.commands[::-1].index("prncancel")
    assert sim.state.commands[i + 1:] == ["strns", "scnt"]  # po prncancel: to=0 i bn == przed


def test_ambiguous_before_trinit_is_retryable(printer, sim):
    sim.state.open = True                       # przerwana transakcja -> prncancel przed trinit
    sim.state.add_fault("drop_before", "prncancel")
    with pytest.raises(PrinterError) as e:
        printer.print_receipt(req())
    assert e.value.category == Category.CONNECTION and e.value.retryable
    assert "trinit" not in sim.state.commands


def test_stray_ambiguous_command_in_service_is_uncertain(service, monkeypatch):
    def boom(_req):
        raise AmbiguousCommand("trend", 1)
    monkeypatch.setattr(service.printer, "print_receipt", boom)
    res = run_job(service)
    assert res.state == "uncertain"
    assert not service.process_one()


# --- 7. Bezpieczniki protokołu ----------------------------------------------------

@pytest.mark.parametrize("raw", ["-", "X", ""])  # "-" = brak pola fs
def test_unknown_fiscal_flag_is_treated_as_fiscal(printer, sim, raw):
    sim.state.fs_raw = raw
    st = printer.status()
    assert st.fiscal is True and st.fiscal_unknown
    with pytest.raises(PrinterError) as e:
        printer.print_receipt(req())
    assert e.value.category == Category.FISCAL and not sim.state.printed
    printer.allow_fiscal = True
    assert printer.print_receipt(req()) == 101


def test_unknown_transaction_flag_is_protocol_error(printer, sim):
    sim.state.to_raw = "?"
    assert not printer.status().online
    with pytest.raises(PrinterError) as e:
        printer.print_receipt(req())
    assert e.value.category == Category.PROTOCOL and "trinit" not in sim.state.commands


def test_rpt_answer_for_other_command_is_ambiguous(sim):
    client = PosnetClient("127.0.0.1", sim.port, timeout=2, connect_timeout=1, token_source=MemoryTokens(500))
    sim.state.responses[500] = encode("sid", [("nm", "Obca")], 500)  # stara odpowiedź pod tym tokenem
    sim.state.drop_before.add("scnt")
    with client as c, pytest.raises(AmbiguousCommand):
        c.call("scnt")


def test_tokens_persist_across_restart(tmp_path):
    store = Store(str(tmp_path / "a.db"))
    first = PersistentTokens(store.load_token, store.save_token, block=8)
    used = [first() for _ in range(5)]
    second = PersistentTokens(store.load_token, store.save_token, block=8)
    nxt = second()
    assert nxt not in used and nxt == (used[0] + 8 - 1) % 9999 + 1
    assert all(1 <= t <= 9999 for t in used)


def test_agent_id_is_persistent(tmp_path):
    path = str(tmp_path / "a.db")
    a = Store(path).agent_id()
    assert a.startswith("py-") and Store(path).agent_id() == a


# --- 7. Teksty spoza strony kodowej --------------------------------------------------

def test_emoji_in_name_is_invalid_before_trinit(service, sim):
    r = req(items=[{"name": "Kalkulator 🚀", "unit_price": 100, "vat": "23"}],
            payments=[{"type": "card", "amount": 100}])
    res = run_job(service, r)
    assert res.state == "failed" and res.category == "invalid" and "U+1F680" in res.error
    assert sim.state.commands == [] and not sim.state.printed


def test_transliteration_for_latin2():
    assert printer_text("KalkMate v3 – „AI”", 40, "iso8859_2") == 'KalkMate v3 - "AI"'
    assert printer_text("Żółć – ok", 40, "cp1250") == "Żółć – ok"  # cp1250 ma półpauzę
    assert printer_text("Piñata", 40, "iso8859_2") == "Pinata"


def test_transliterated_name_reaches_printer(sim):
    client = PosnetClient("127.0.0.1", sim.port, timeout=2, connect_timeout=1, encoding="iso8859_2")
    r = req(items=[{"name": "Kalkulator – AI", "unit_price": 100, "vat": "23"}],
            payments=[{"type": "card", "amount": 100}])
    assert Printer(client).print_receipt(r) == 101
    assert sim.state.printed[-1]["lines"][0]["na"] == "Kalkulator - AI"


# --- 8. Limity kwot --------------------------------------------------------------------

@pytest.mark.parametrize("over", [
    {"items": [{"name": "Drogie", "unit_price": 400001, "vat": "23"}], "payments": [{"type": "card", "amount": 400001}]},
    {"items": [{"name": f"P{i}", "unit_price": 100, "vat": "23"} for i in range(6)],
     "payments": [{"type": "card", "amount": 600}]},
    {"reference": None},
    {"reference": "  "},
])
def test_limits_reject_without_printing(service, sim, over):
    res = run_job(service, req(**over))
    assert res.state == "failed" and res.category == "invalid"
    assert sim.state.commands == []


def test_config_default_limit_fits_five_units(monkeypatch):
    # 5 sztuk × 699 zł − rabat + wysyłka musi zmieścić się w domyślnym limicie.
    monkeypatch.delenv("FISCAL_MAX_TOTAL", raising=False)
    cfg = Config()
    assert cfg.max_total == 400000
    r = req(items=[{"name": "KalkMate v3 kalkulator AI", "quantity": "5", "unit_price": 69900, "vat": "23",
                    "discount": 7000},
                   {"name": "Wysyłka", "unit_price": 3500, "vat": "23"}],
            payments=[{"type": "transfer", "amount": 349500 - 7000 + 3500, "name": "Przelewy24"}])
    assert r.items[0].total == 349500 - 7000
    ReceiptLimits(max_total=cfg.max_total, max_items=cfg.max_items).check(r)


def test_limits_configurable(sim, monkeypatch):
    monkeypatch.setenv("FISCAL_MAX_TOTAL", "1000")
    cfg = Config()
    p = Printer(PosnetClient("127.0.0.1", sim.port, timeout=2, connect_timeout=1),
                limits=ReceiptLimits(max_total=cfg.max_total))
    with pytest.raises(PrinterError) as e:
        p.print_receipt(req())
    assert e.value.category == Category.INVALID and "10.00" in str(e.value)


# --- 7. Store / API ------------------------------------------------------------------------

def test_mark_printing_is_compare_and_set(service):
    r = req()
    service.submit(r)
    service.store.finish(r.id, "failed", error="x")
    assert not service.store.mark_printing(r.id)
    assert service.store.get(r.id).state == "failed"


def test_retry_only_from_failed_or_uncertain(service, sim):
    app = create_app(service, service.cfg)
    http = TestClient(app)  # bez lifespan: worker nie rusza, zlecenie zostaje 'queued'
    h = {"Authorization": "Bearer secret"}
    assert http.post("/receipts", json=receipt(), headers=h).json()["state"] == "queued"
    assert http.post("/receipts/KM-TEST-1/retry", headers=h).status_code == 409
    service.store.finish("KM-TEST-1", "failed", error="x")
    r = http.post("/receipts/KM-TEST-1/retry", headers=h)
    assert r.status_code == 200 and r.json()["state"] == "queued"


def test_worker_survives_exception_and_reports_it(sim, tmp_path, monkeypatch):
    monkeypatch.setenv("PRINTER_PORT", str(sim.port))
    monkeypatch.setenv("PRINTER_HOST", "127.0.0.1")
    monkeypatch.setenv("POLL_INTERVAL", "0.05")
    cfg = Config()
    client = PosnetClient(cfg.printer_host, cfg.printer_port, timeout=2, connect_timeout=1)

    class Boom:
        calls = 0

        def report(self, result):
            return None

        def claim(self, printer):
            Boom.calls += 1
            raise RuntimeError("awaria")

    svc = FiscalService(cfg, Store(str(tmp_path / "w.db")), Printer(client), Boom())
    svc.start()
    try:
        deadline = time.time() + 5
        while Boom.calls < 3 and time.time() < deadline:
            time.sleep(0.05)
        assert Boom.calls >= 3  # pętla żyje po wyjątku
        assert svc.worker_info()["alive"] and "awaria" in (svc.worker_info()["error"] or "")
        assert any("awaria" in a for a in svc.alerts())
    finally:
        svc.stop()


def test_status_has_worker_flag_and_alerts(service, sim):
    app = create_app(service, service.cfg)
    body = TestClient(app).get("/status", headers={"Authorization": "Bearer secret"}).json()
    assert body["worker_alive"] is False and body["alerts"] == []
    assert body["limits"]["max_total"] == 400000


# --- 2-4. Protokół z serwerem ----------------------------------------------------------------

class Platform:
    """Atrapa serwera: odpowiedzi raportów z kolejki `answers` (domyślnie accepted=True)."""

    def __init__(self, jobs=(), answers=None):
        self.jobs = list(jobs)
        self.answers = answers or {}
        self.reports: list[ReceiptResult] = []
        self.claims = 0

    def claim(self, printer):
        self.claims += 1
        return self.jobs.pop(0) if self.jobs else None

    def report(self, result):
        self.reports.append(result)
        a = self.answers.get((result.id, result.state))
        if isinstance(a, Exception):
            raise a
        return a if a is not None else {"ok": True, "state": "sent", "accepted": True}


def platform_job(job_id="fj_1"):
    payload = receipt()
    payload.pop("id")
    return {"id": job_id, "receipt": payload}


@pytest.mark.parametrize("answer", [
    {"ok": True, "state": "cancelled", "accepted": False},
    {"ok": True, "state": "cancel_requested", "accepted": True},
    {"ok": True, "state": "superseded", "accepted": False},
])
def test_cancelled_on_server_is_dropped_without_printing(service, sim, answer):
    service.platform = Platform([platform_job()], {("fj_1", "printing"): answer})
    service.sync_platform()
    assert service.store.get("fj_1").state == "queued"
    assert service.process_one()
    assert service.store.get("fj_1") is None  # porzucone lokalnie
    assert not sim.state.printed and "trinit" not in sim.state.commands


def test_waiting_job_cancelled_while_in_backoff(service, sim):
    service.platform = Platform([platform_job()])
    service.sync_platform()
    sim.state.mechanism = 5  # brak papieru -> czeka w kolejce
    service.process_one()
    assert service.store.get("fj_1").state == "queued"
    service.platform.answers[("fj_1", "queued")] = {"ok": True, "state": "cancelled", "accepted": False}
    service.sync_platform()  # raport 'queued' -> serwer: anulowane
    assert service.store.get("fj_1") is None and not sim.state.printed


def test_rejected_after_print_keeps_job_and_flags_conflict(service, sim):
    service.platform = Platform([platform_job()],
                                {("fj_1", "printed"): {"ok": True, "state": "superseded", "accepted": False}})
    service.sync_platform()
    service.process_one()
    service.sync_platform()
    res = service.store.get("fj_1")
    assert res.state == "printed" and res.receipt_number == 101
    alerts = service.alerts()
    assert any("KONFLIKT" in a and "101" in a for a in alerts)
    n = len(service.platform.reports)
    service.sync_platform()
    assert len(service.platform.reports) == n  # nie raportuje w kółko


def test_unknown_job_404_is_orphaned_not_printed(service, sim):
    service.platform = Platform([platform_job()],
                                {("fj_1", "printing"): {"found": False, "state": "unknown", "accepted": False}})
    service.sync_platform()
    service.process_one()
    assert service.store.get("fj_1").state == "queued"
    assert service.store.next_due() is None and not sim.state.printed
    assert any("404" in a for a in service.alerts())
    service.sync_platform()  # kontynuuje: claim dalej działa
    assert service.platform.claims == 2


def test_server_unreachable_before_print_defers(service, sim):
    service.platform = Platform([platform_job()], {("fj_1", "printing"): httpx.ConnectError("offline")})
    service.sync_platform()
    service.process_one()
    res = service.store.get("fj_1")
    assert res.state == "queued" and "potwierdzenia" in res.error and res.attempts == 0
    assert not sim.state.printed


def test_one_failed_report_does_not_block_others_or_claim(service, sim):
    for jid in ("fj_a", "fj_b"):
        service.store.add(ReceiptRequest.model_validate(platform_job(jid)["receipt"] | {"id": jid}), "platform")
        service.store.finish(jid, "failed", error="x")
    service.platform = Platform(answers={("fj_a", "failed"): httpx.ConnectError("zerwane")})
    service.sync_platform()
    assert service.platform.claims == 1
    assert {r.id for r in service.platform.reports} == {"fj_a", "fj_b"}
    assert "fj_a" in service.last_platform_error
    assert service.store.unreported()[0].id == "fj_a"  # ponowi tylko nieudany


def test_no_claim_when_printer_offline(service, sim):
    service.platform = Platform([platform_job()])
    sim.shutdown()
    sim.server_close()
    service.sync_platform()
    assert service.platform.claims == 0 and "niedostępna" in service.claim_blocked


def test_no_claim_when_printer_not_ready(service, sim):
    service.platform = Platform([platform_job()])
    sim.state.mechanism = 5
    service.sync_platform()
    assert service.platform.claims == 0 and "nie jest gotowa" in service.claim_blocked
    sim.state.mechanism = 0
    service._status_at -= service.cfg.poll_interval + 1  # niegotowa: status odświeżany co poll_interval
    service.sync_platform()
    assert service.platform.claims == 1 and service.claim_blocked is None


def test_no_claim_when_printer_in_fiscal_mode_and_blocked(service, sim):
    service.platform = Platform([platform_job()])
    sim.state.fiscal = True
    service.sync_platform()
    assert service.platform.claims == 0 and "FISKALNYM" in service.claim_blocked


def test_no_claim_while_local_job_waits_after_error(service, sim):
    service.platform = Platform([platform_job("fj_1"), platform_job("fj_2")])
    service.sync_platform()
    sim.state.mechanism = 4
    service.process_one()            # fj_1 czeka po błędzie papieru
    sim.state.mechanism = 0
    service._status_at = 0
    service.sync_platform()
    assert service.platform.claims == 1 and "czeka" in service.claim_blocked


def test_platform_client_sends_agent_id_and_handles_404(monkeypatch):
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if request.url.path.endswith("/claim"):
            return httpx.Response(200, json={"job": None})
        if request.url.path.endswith("/fj_gone"):
            return httpx.Response(404, json={"error": "Not found", "state": "unknown"})
        if request.url.path.endswith("/fj_proxy"):
            return httpx.Response(404, text="<html>nginx</html>")
        return httpx.Response(200, json={"ok": True, "state": "printed", "accepted": True})

    monkeypatch.setenv("PLATFORM_URL", "https://example.invalid")
    monkeypatch.setenv("PLATFORM_AGENT_TOKEN", "t")
    cfg = Config()
    headers = {"x-fiscal-agent-token": "t", "x-fiscal-agent-id": "py-1"}
    pc = PlatformClient(cfg, "py-1", http=httpx.Client(base_url=cfg.platform_url, headers=headers,
                                                       transport=httpx.MockTransport(handler)))
    assert pc.claim({"online": True}) is None
    assert pc.report(ReceiptResult(id="fj_1", state="printed", receipt_number=5))["accepted"] is True
    assert pc.report(ReceiptResult(id="fj_gone", state="queued"))["state"] == "unknown"
    with pytest.raises(httpx.HTTPStatusError):
        pc.report(ReceiptResult(id="fj_proxy", state="queued"))
    import json
    for r in seen:
        assert r.headers["x-fiscal-agent-id"] == "py-1"
        assert json.loads(r.content)["agentId"] == "py-1"


def test_platform_client_default_headers_carry_agent_id(monkeypatch):
    monkeypatch.setenv("PLATFORM_URL", "https://example.invalid")
    monkeypatch.setenv("PLATFORM_AGENT_TOKEN", "t")
    pc = PlatformClient(Config(), "py-abc")
    assert pc._http.headers["x-fiscal-agent-id"] == "py-abc"
