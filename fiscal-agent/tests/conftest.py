import pytest

from fiscal_agent.config import Config
from fiscal_agent.posnet.client import PosnetClient
from fiscal_agent.printer import Printer
from fiscal_agent.service import FiscalService
from fiscal_agent.simulator import SimState, Simulator
from fiscal_agent.store import Store


@pytest.fixture
def sim():
    s = Simulator(state=SimState()).start()
    yield s
    s.shutdown()
    s.server_close()


@pytest.fixture
def printer(sim):
    return Printer(PosnetClient("127.0.0.1", sim.port, timeout=2, connect_timeout=1))


@pytest.fixture
def service(sim, tmp_path, monkeypatch):
    monkeypatch.setenv("PRINTER_PORT", str(sim.port))
    monkeypatch.setenv("PRINTER_HOST", "127.0.0.1")
    monkeypatch.setenv("AGENT_DB", str(tmp_path / "agent.db"))
    monkeypatch.setenv("AGENT_API_TOKEN", "secret")
    cfg = Config()
    client = PosnetClient(cfg.printer_host, cfg.printer_port, timeout=2, connect_timeout=1)
    return FiscalService(cfg, Store(cfg.db_path), Printer(client))


def receipt(**over):
    data = {
        "id": "KM-TEST-1",
        "items": [
            {"name": "KalkMate v3 – kalkulator AI", "unit_price": 69900, "vat": "23", "discount": 7000},
            {"name": "Wysyłka", "unit_price": 1599, "vat": "23"},
        ],
        "payments": [{"type": "transfer", "amount": 64499, "name": "Przelewy24"}],
    }
    data.update(over)
    return data
