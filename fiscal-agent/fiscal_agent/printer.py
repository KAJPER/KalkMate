"""Operacje wysokiego poziomu: status drukarki i wystawienie paragonu.

Sekwencja paragonu (DBC-I-DEV-45): trinit -> trline... -> trpayment... -> trend.
Numer paragonu: specyfikacja nie zwraca go w odpowiedzi na trend, więc czytamy
licznik `bn` („numer ostatnio wydrukowanego paragonu”) rozkazem scnt przed
i po transakcji.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from decimal import Decimal

from .models import PAYMENT_DEFAULT_NAME, PAYMENT_TY, ReceiptRequest
from .posnet.client import AmbiguousCommand, PosnetClient
from .posnet.errors import (DEVICE_STATE_TEXT, PRINTER_MECH_TEXT, Category,
                            PrinterError)
from .posnet.frame import clean_text

log = logging.getLogger(__name__)

VAT_FIELDS = ["va", "vb", "vc", "vd", "ve", "vf", "vg"]  # stawki A..G = indeksy 0..6
VAT_EXEMPT = Decimal(100)
VAT_INACTIVE = Decimal(101)


def _num(value: str) -> Decimal:
    return Decimal(value.replace(",", ".")) if value else Decimal(0)


def _bool(value: str | None) -> bool:
    return (value or "").strip().upper() in {"1", "T", "Y"}


@dataclass
class PrinterStatus:
    online: bool
    model: str | None = None
    version: str | None = None
    fiscal: bool | None = None
    device_state: int | None = None
    mechanism: int | None = None
    transaction_open: bool | None = None
    last_receipt: int | None = None
    error: str | None = None

    @property
    def ready(self) -> bool:
        return self.online and self.device_state == 0 and self.mechanism == 0

    def describe(self) -> str:
        if not self.online:
            return self.error or "drukarka niedostępna"
        parts = [f"{self.model or '?'} {self.version or ''}".strip(),
                 "tryb FISKALNY" if self.fiscal else "tryb niefiskalny (szkoleniowy)"]
        if self.device_state:
            parts.append(DEVICE_STATE_TEXT.get(self.device_state, f"stan {self.device_state}"))
        if self.mechanism:
            parts.append(PRINTER_MECH_TEXT.get(self.mechanism, f"mechanizm {self.mechanism}"))
        return ", ".join(parts)

    def as_dict(self) -> dict:
        return {**self.__dict__, "ready": self.ready, "description": self.describe()}


class Printer:
    def __init__(self, client: PosnetClient, *, allow_fiscal: bool = False) -> None:
        self.client = client
        self.allow_fiscal = allow_fiscal

    # --- status -----------------------------------------------------------
    def status(self) -> PrinterStatus:
        with self.client as c:
            try:
                return self._status(c)
            except (PrinterError, AmbiguousCommand) as e:
                return PrinterStatus(online=False, error=str(e))

    def _status(self, c: PosnetClient) -> PrinterStatus:
        sid = c.call("sid")
        dev = c.call("sdev")
        prn = c.call("sprn")
        comm = c.call("scomm")
        trns = c.call("strns")
        cnt = c.call("scnt")
        return PrinterStatus(
            online=True,
            model=sid.fields.get("nm"),
            version=sid.fields.get("vr"),
            fiscal=_bool(comm.fields.get("fs")),
            device_state=int(dev.fields.get("ds", "0") or 0),
            mechanism=int(prn.fields.get("pr", "0") or 0),
            transaction_open=trns.fields.get("to") == "1",
            last_receipt=int(cnt.fields["bn"]) if cnt.fields.get("bn", "").isdigit() else None,
        )

    def vat_map(self, c: PosnetClient) -> dict[str, int]:
        resp = c.call("vatget")
        out: dict[str, int] = {}
        for idx, fld in enumerate(VAT_FIELDS):
            if fld not in resp.fields:
                continue
            rate = _num(resp.fields[fld])
            if rate == VAT_INACTIVE:
                continue
            key = "zw" if rate == VAT_EXEMPT else format(rate.normalize(), "f")
            out.setdefault(key, idx)
        return out

    # --- paragon ------------------------------------------------------------
    def print_receipt(self, req: ReceiptRequest) -> int:
        """Drukuje paragon i zwraca jego numer. Rzuca PrinterError."""
        with self.client as c:
            st = self._status(c)
            if st.mechanism:
                raise PrinterError(Category.PAPER, "Drukarka: " + PRINTER_MECH_TEXT.get(st.mechanism, str(st.mechanism)))
            if st.device_state:
                raise PrinterError(Category.BUSY, "Drukarka zajęta: " + DEVICE_STATE_TEXT.get(st.device_state, str(st.device_state)))
            if st.fiscal and not self.allow_fiscal:
                raise PrinterError(Category.FISCAL, "Drukarka jest w trybie FISKALNYM, a agent działa w trybie testowym "
                                   "(ustaw FISCAL_ALLOW_REAL=1 dopiero po testach na urządzeniu niefiskalnym).")
            if st.transaction_open:
                log.warning("otwarta transakcja z poprzedniej próby — anuluję (prncancel)")
                c.call("prncancel")
                bn = c.call("scnt").fields.get("bn", "")
                st.last_receipt = int(bn) if bn.isdigit() else st.last_receipt
            before = st.last_receipt or 0

            vat = self.vat_map(c)
            commands = self._commands(req, vat)
            try:
                for cmd, params in commands[:-1]:
                    c.call(cmd, params)
            except AmbiguousCommand as e:
                self._cancel_quietly(c)
                raise PrinterError(Category.CONNECTION, f"Zerwane połączenie w trakcie paragonu ({e}); "
                                   "transakcja anulowana, zlecenie zostanie ponowione.") from e
            except PrinterError:
                self._cancel_quietly(c)
                raise

            end_cmd, end_params = commands[-1]
            try:
                c.call(end_cmd, end_params)
            except AmbiguousCommand as e:
                return self._resolve_after_ambiguous_end(c, before, e)
            except PrinterError:
                self._cancel_quietly(c)
                raise
            return self._receipt_number(c, before)

    def _commands(self, req: ReceiptRequest, vat: dict[str, int]) -> list[tuple[str, list[tuple[str, str]]]]:
        cmds: list[tuple[str, list[tuple[str, str]]]] = [("trinit", [("bm", "1")])]
        for item in req.items:
            if item.vat not in vat:
                raise PrinterError(Category.INVALID, f"Drukarka nie ma aktywnej stawki VAT {item.vat}"
                                   f"{'' if item.vat == 'zw' else '%'} (dostępne: {', '.join(vat) or 'brak'})")
            params = [("na", clean_text(item.name, 40)), ("vt", str(vat[item.vat])),
                      ("pr", str(item.unit_price)), ("il", format(item.quantity.normalize(), "f")),
                      ("wa", str(item.gross))]
            if item.discount:
                params += [("rw", str(item.discount)), ("rn", "Rabat")]
            if item.description:
                params.append(("op", clean_text(item.description, 35)))
            cmds.append(("trline", params))
        change = req.paid - req.total
        for p in req.payments:
            params = [("ty", str(PAYMENT_TY[p.type])), ("wa", str(p.amount))]
            name = p.name or PAYMENT_DEFAULT_NAME.get(p.type)
            if name:
                params.append(("na", clean_text(name, 25)))
            cmds.append(("trpayment", params))
        if change:
            cmds.append(("trpayment", [("ty", "0"), ("wa", str(change)), ("re", "1")]))
        end = [("to", str(req.total)), ("fp", str(req.paid))]
        if change:
            end.append(("re", str(change)))
        cmds.append(("trend", end))
        return cmds

    def _receipt_number(self, c: PosnetClient, before: int) -> int:
        bn = c.call("scnt").fields.get("bn", "")
        number = int(bn) if bn.isdigit() else before + 1
        if number != before + 1:
            log.warning("licznik paragonów: przed %s, po %s", before, number)
        return number

    def _cancel_quietly(self, c: PosnetClient) -> None:
        try:
            if c.call("strns").fields.get("to") == "1":
                c.call("prncancel")
        except Exception as e:  # noqa: BLE001 — anulowanie to najlepsza próba
            log.error("nie udało się anulować transakcji: %s", e)

    def _resolve_after_ambiguous_end(self, c: PosnetClient, before: int, err: AmbiguousCommand) -> int:
        """trend wysłany, odpowiedzi brak. Sprawdzamy, czy paragon powstał."""
        try:
            c.connect()
            trns = c.call("strns")
            bn = c.call("scnt").fields.get("bn", "")
        except Exception as e:  # noqa: BLE001
            raise PrinterError(Category.UNCERTAIN, "Nie wiadomo, czy paragon został wydrukowany "
                               f"(brak połączenia po wysłaniu trend: {e}). Sprawdź drukarkę.") from err
        if trns.fields.get("to") == "1":
            # trend nie dotarł — transakcja dalej otwarta, można ją bezpiecznie anulować.
            self._cancel_quietly(c)
            raise PrinterError(Category.CONNECTION, "trend nie dotarł do drukarki; transakcja anulowana, "
                               "zlecenie zostanie ponowione.") from err
        if bn.isdigit() and int(bn) > before:
            return int(bn)
        raise PrinterError(Category.UNCERTAIN, "Transakcja zamknięta, ale licznik paragonów się nie zmienił — "
                           "sprawdź drukarkę i kopię elektroniczną.") from err
