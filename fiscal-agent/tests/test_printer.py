from decimal import Decimal

import pytest
from conftest import receipt
from pydantic import ValidationError

from fiscal_agent.models import ReceiptRequest
from fiscal_agent.posnet.errors import Category, PrinterError


def test_status(printer):
    st = printer.status()
    assert st.online and st.ready and st.fiscal is False and st.last_receipt == 100


def test_status_offline():
    from fiscal_agent.posnet.client import PosnetClient
    from fiscal_agent.printer import Printer
    st = Printer(PosnetClient("127.0.0.1", 1, connect_timeout=0.5)).status()
    assert not st.online and "Brak połączenia" in st.error


def test_vat_map(printer):
    with printer.client as c:
        assert printer.vat_map(c) == {"23": 0, "8": 1, "5": 2, "0": 3, "zw": 6}


def test_print_receipt_happy_path(printer, sim):
    number = printer.print_receipt(ReceiptRequest.model_validate(receipt()))
    assert number == 101
    doc = sim.state.printed[-1]
    assert doc["total"] == 64499 and doc["paid"] == 64499
    assert [ln["na"] for ln in doc["lines"]] == ["KalkMate v3 – kalkulator AI", "Wysyłka"]
    assert doc["lines"][0]["rw"] == 7000


def test_cash_with_change_and_quantity(printer, sim):
    req = ReceiptRequest.model_validate(receipt(
        items=[{"name": "Papier", "unit_price": 333, "quantity": "1.5", "vat": "8"}],
        payments=[{"type": "cash", "amount": 1000}]))
    assert req.total == 500  # 1,5 x 3,33 = 4,995 -> 5,00 (ROUND_HALF_UP)
    printer.print_receipt(req)
    doc = sim.state.printed[-1]
    assert doc["change"] == 500 and doc["lines"][0]["il"] == str(Decimal("1.5"))


def test_paper_out_is_retryable(printer, sim):
    sim.state.mechanism = 5
    with pytest.raises(PrinterError) as e:
        printer.print_receipt(ReceiptRequest.model_validate(receipt()))
    assert e.value.category == Category.PAPER and e.value.retryable
    assert not sim.state.printed


def test_busy_in_menu_is_retryable(printer, sim):
    sim.state.device_state = 1
    with pytest.raises(PrinterError) as e:
        printer.print_receipt(ReceiptRequest.model_validate(receipt()))
    assert e.value.category == Category.BUSY


def test_refuses_fiscal_device_without_flag(printer, sim):
    sim.state.fiscal = True
    with pytest.raises(PrinterError) as e:
        printer.print_receipt(ReceiptRequest.model_validate(receipt()))
    assert e.value.category == Category.FISCAL and not sim.state.printed
    printer.allow_fiscal = True
    assert printer.print_receipt(ReceiptRequest.model_validate(receipt())) == 101


def test_unknown_vat_rate(printer, sim):
    sim.state.vat[1] = "101,00"  # 8% nieaktywna
    req = ReceiptRequest.model_validate(receipt(items=[{"name": "X", "unit_price": 100, "vat": "8"}],
                                                payments=[{"type": "card", "amount": 100}]))
    with pytest.raises(PrinterError) as e:
        printer.print_receipt(req)
    assert e.value.category == Category.INVALID


def test_printer_error_mid_transaction_cancels(printer, sim):
    sim.state.errors["trpayment"] = 2705
    with pytest.raises(PrinterError) as e:
        printer.print_receipt(ReceiptRequest.model_validate(receipt()))
    assert e.value.code == 2705 and not e.value.retryable
    assert sim.state.cancelled == 1 and not sim.state.open and not sim.state.printed


def test_leftover_open_transaction_is_cancelled_first(printer, sim):
    sim.state.open = True
    assert printer.print_receipt(ReceiptRequest.model_validate(receipt())) == 101
    assert sim.state.cancelled == 1


def test_wifi_drop_after_trend_recovered_via_rpt(printer, sim):
    sim.state.drop_after.add("trend")  # paragon wydrukowany, odpowiedź zginęła
    assert printer.print_receipt(ReceiptRequest.model_validate(receipt())) == 101
    assert len(sim.state.printed) == 1


def test_trend_lost_before_execution_cancels_and_retries(printer, sim):
    sim.state.drop_before.add("trend")  # trend nie dotarł: transakcja dalej otwarta
    with pytest.raises(PrinterError) as e:
        printer.print_receipt(ReceiptRequest.model_validate(receipt()))
    assert e.value.category == Category.CONNECTION and e.value.retryable
    assert not sim.state.printed and sim.state.cancelled == 1


def test_trend_executed_but_rpt_buffer_lost(printer, sim):
    sim.state.drop_after.add("trend")
    sim.state.responses.clear()
    orig = sim._remember
    sim._remember = lambda token, frame: frame  # drukarka „zapomniała” odpowiedzi
    try:
        assert printer.print_receipt(ReceiptRequest.model_validate(receipt())) == 101
    finally:
        sim._remember = orig
    assert len(sim.state.printed) == 1


def test_validation():
    with pytest.raises(ValidationError):
        ReceiptRequest.model_validate(receipt(payments=[{"type": "card", "amount": 100}]))
    with pytest.raises(ValidationError):  # nadpłata kartą
        ReceiptRequest.model_validate(receipt(payments=[{"type": "card", "amount": 99999}]))
    with pytest.raises(ValidationError):
        ReceiptRequest.model_validate(receipt(items=[{"name": "X", "unit_price": 100, "vat": "22"}]))
    with pytest.raises(ValidationError):
        ReceiptRequest.model_validate(receipt(items=[{"name": "X", "unit_price": 100, "vat": "23", "discount": 100}]))
