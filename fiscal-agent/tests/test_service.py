from conftest import receipt
from fastapi.testclient import TestClient

from fiscal_agent.app import create_app
from fiscal_agent.models import ReceiptRequest


def test_queue_prints_and_is_idempotent(service, sim):
    req = ReceiptRequest.model_validate(receipt())
    assert service.submit(req).state == "queued"
    assert service.process_one()
    res = service.store.get(req.id)
    assert res.state == "printed" and res.receipt_number == 101
    # To samo id drugi raz — bez drugiego paragonu.
    assert service.submit(req).state == "printed"
    assert not service.process_one()
    assert len(sim.state.printed) == 1


def test_paper_out_backoff_then_success(service, sim):
    sim.state.mechanism = 4
    req = ReceiptRequest.model_validate(receipt())
    service.submit(req)
    service.process_one()
    res = service.store.get(req.id)
    assert res.state == "queued" and res.category == "paper" and "papieru" in res.error
    assert service.store.next_due() is None  # czeka na backoff
    sim.state.mechanism = 0
    service.store.requeue(req.id)
    service.process_one()
    assert service.store.get(req.id).state == "printed"


def test_printer_offline_is_retried(service, sim):
    sim.shutdown()
    sim.server_close()
    req = ReceiptRequest.model_validate(receipt())
    service.submit(req)
    service.process_one()
    res = service.store.get(req.id)
    assert res.state == "queued" and res.category == "connection"


def test_crash_during_printing_becomes_uncertain(service):
    req = ReceiptRequest.model_validate(receipt())
    service.submit(req)
    service.store.mark_printing(req.id)  # agent padł w trakcie druku
    assert service.store.recover() == 1
    assert service.store.get(req.id).state == "uncertain"
    assert not service.process_one()  # NIE drukujemy ponownie automatycznie


def test_http_api(service, sim):
    app = create_app(service, service.cfg)
    with TestClient(app) as http:
        assert http.post("/receipts", json=receipt()).status_code == 401
        h = {"Authorization": "Bearer secret"}
        r = http.post("/receipts?wait=10", json=receipt(), headers=h)
        assert r.status_code == 202 and r.json()["state"] == "printed" and r.json()["receipt_number"] == 101
        assert http.get("/receipts/KM-TEST-1", headers=h).json()["receipt_number"] == 101
        assert http.post("/receipts/KM-TEST-1/retry", headers=h).status_code == 409
        bad = dict(receipt(), id="X2", payments=[{"type": "card", "amount": 1}])
        assert http.post("/receipts", json=bad, headers=h).status_code == 422
        st = http.get("/status?refresh=true", headers=h).json()
        assert st["printer"]["online"] and st["queue"]["printed"] == 1


class FakePlatform:
    def __init__(self, jobs):
        self.jobs = list(jobs)
        self.reports = []

    def claim(self, printer):
        self.printer = printer
        return self.jobs.pop(0) if self.jobs else None

    def report(self, result):
        self.reports.append(result)


def test_platform_pull_and_report(service, sim):
    payload = receipt()
    job_id = payload.pop("id")
    service.platform = FakePlatform([{"id": "fj_1", "receipt": payload}, {"id": "fj_bad", "receipt": {"items": []}}])
    service.sync_platform()       # pobiera fj_1
    assert service.process_one()
    service.sync_platform()       # raportuje fj_1, pobiera fj_bad -> raport błędu
    service.sync_platform()
    states = {r.id: r.state for r in service.platform.reports}
    assert states == {"fj_1": "printed", "fj_bad": "failed"}
    assert service.platform.printer["online"]
    assert not service.store.get(job_id)  # lokalne id z conftest nie zostało użyte
