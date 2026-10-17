"""Operacje wysokiego poziomu: status drukarki i wystawienie paragonu.

Sekwencja paragonu (DBC-I-DEV-45): trinit -> trline... -> trpayment... -> trend.
Numer paragonu: specyfikacja nie zwraca go w odpowiedzi na trend, więc czytamy
licznik `bn` („numer ostatnio wydrukowanego paragonu”) rozkazem scnt przed
i po transakcji.

NIEZMIENNIK (paragonu fiskalnego nie da się cofnąć): od chwili wysłania `trend`
każdy wyjątek kończy się numerem paragonu (licznik bn wzrósł dokładnie o 1)
albo kategorią UNCERTAIN. Ponowienie (CONNECTION) albo błąd danych wolno
zgłosić tylko po dowodzie, że paragon nie powstał: transakcja była otwarta,
prncancel, potem to=0 i bn == przed.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from decimal import Decimal

from .models import PAYMENT_DEFAULT_NAME, PAYMENT_TY, ReceiptRequest
from .posnet.client import AmbiguousCommand, PosnetClient
from .posnet.errors import (DEVICE_STATE_TEXT, PRINTER_MECH_TEXT, Category,
                            PrinterError)
from .posnet.frame import Response, UnmappableText, printer_text

log = logging.getLogger(__name__)

VAT_FIELDS = ["va", "vb", "vc", "vd", "ve", "vf", "vg"]  # stawki A..G = indeksy 0..6
VAT_EXEMPT = Decimal(100)
VAT_INACTIVE = Decimal(101)

_TRUE = {"1", "T", "Y", "TRUE"}
_FALSE = {"0", "N", "F", "FALSE"}


def _num(value: str) -> Decimal:
    return Decimal(value.replace(",", ".")) if value else Decimal(0)


def parse_flag(value: str | None) -> bool | None:
    """Jedyny parser flag POSNET (scomm.fs, strns.to): True/False, None = brak/nieznana wartość."""
    v = (value or "").strip().upper()
    if v in _TRUE:
        return True
    if v in _FALSE:
        return False
    return None


def _flag(resp: Response, name: str, command: str) -> bool:
    v = parse_flag(resp.fields.get(name))
    if v is None:
        raise PrinterError(Category.PROTOCOL, f"Nieznana wartość pola {name} w odpowiedzi na {command}: "
                           f"{resp.fields.get(name)!r}", command=command)
    return v


def _digits(value: str | None) -> int | None:
    v = (value or "").strip()
    return int(v) if v and v.isascii() and v.isdigit() else None


def _int_field(resp: Response, name: str, command: str, default: int | None = None) -> int:
    raw = resp.fields.get(name)
    if raw is None or raw.strip() == "":
        if default is not None:
            return default
        raise PrinterError(Category.PROTOCOL, f"Brak pola {name} w odpowiedzi na {command}", command=command)
    v = _digits(raw)
    if v is None:
        raise PrinterError(Category.PROTOCOL, f"Nieczytelne pole {name} w odpowiedzi na {command}: {raw!r}",
                           command=command)
    return v


@dataclass(frozen=True)
class ReceiptLimits:
    """Bezpiecznik kwot w agencie — niezależny od walidacji na serwerze."""
    max_total: int = 400_000          # grosze (4000 zł)
    max_items: int = 5
    require_reference: bool = True

    def check(self, req: ReceiptRequest) -> None:
        if req.total > self.max_total or req.paid > self.max_total:
            raise PrinterError(Category.INVALID, f"Kwota paragonu ({max(req.total, req.paid) / 100:.2f} zł) przekracza "
                               f"limit agenta {self.max_total / 100:.2f} zł (FISCAL_MAX_TOTAL) — nie drukuję.")
        if len(req.items) > self.max_items:
            raise PrinterError(Category.INVALID, f"Paragon ma {len(req.items)} pozycji, limit agenta to "
                               f"{self.max_items} (FISCAL_MAX_ITEMS) — nie drukuję.")
        if self.require_reference and not (req.reference or "").strip():
            raise PrinterError(Category.INVALID, "Zlecenie bez pola reference (np. numeru zamówienia) — nie drukuję.")


@dataclass
class PrinterStatus:
    online: bool
    model: str | None = None
    version: str | None = None
    fiscal: bool | None = None
    fiscal_unknown: bool = False      # scomm.fs brak/nieznane -> traktujemy jak FISKALNĄ
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
        mode = ("tryb nieznany (traktowany jak FISKALNY)" if self.fiscal_unknown
                else "tryb FISKALNY" if self.fiscal else "tryb niefiskalny (szkoleniowy)")
        parts = [f"{self.model or '?'} {self.version or ''}".strip(), mode]
        if self.device_state:
            parts.append(DEVICE_STATE_TEXT.get(self.device_state, f"stan {self.device_state}"))
        if self.mechanism:
            parts.append(PRINTER_MECH_TEXT.get(self.mechanism, f"mechanizm {self.mechanism}"))
        return ", ".join(parts)

    def as_dict(self) -> dict:
        return {**self.__dict__, "ready": self.ready, "description": self.describe()}


def _uncertain(msg: str) -> PrinterError:
    return PrinterError(Category.UNCERTAIN, msg + " Sprawdź drukarkę i kopię elektroniczną, potem rozstrzygnij ręcznie.")


def _garbled(e: Exception) -> bool:
    """Nieczytelna odpowiedź (zły CRC itp.) — błąd łącza, nie drukarki."""
    return isinstance(e, PrinterError) and e.garbled


class Printer:
    def __init__(self, client: PosnetClient, *, allow_fiscal: bool = False,
                 limits: ReceiptLimits | None = None) -> None:
        self.client = client
        self.allow_fiscal = allow_fiscal
        self.limits = limits or ReceiptLimits()

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
        fiscal = parse_flag(comm.fields.get("fs"))
        return PrinterStatus(
            online=True,
            model=sid.fields.get("nm"),
            version=sid.fields.get("vr"),
            # Bezpiecznik: brak/nieznana wartość fs = drukarka FISKALNA.
            fiscal=True if fiscal is None else fiscal,
            fiscal_unknown=fiscal is None,
            device_state=_int_field(dev, "ds", "sdev", default=0),
            mechanism=_int_field(prn, "pr", "sprn", default=0),
            transaction_open=_flag(trns, "to", "strns"),
            last_receipt=_digits(cnt.fields.get("bn")),
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

    def _read_bn(self, c: PosnetClient) -> int:
        return _int_field(c.call("scnt"), "bn", "scnt")

    def _read_state(self, c: PosnetClient) -> tuple[bool, int]:
        """(transakcja otwarta, licznik bn) — ścisłe parsowanie, bez wartości domyślnych."""
        open_ = _flag(c.call("strns"), "to", "strns")
        return open_, self._read_bn(c)

    # --- paragon ------------------------------------------------------------
    def print_receipt(self, req: ReceiptRequest) -> int:
        """Drukuje paragon i zwraca jego numer. Rzuca PrinterError."""
        # Walidacja PRZED połączeniem z drukarką: limity i teksty w stronie kodowej.
        self.limits.check(req)
        texts = self._texts(req)
        with self.client as c:
            before = self._before_trinit(lambda: self._prepare(c))
            vat = self._before_trinit(lambda: self.vat_map(c))
            commands = self._commands(req, vat, texts)
            self._send_body(c, commands[:-1])
            return self._end(c, commands[-1], before)

    @staticmethod
    def _before_trinit(fn):
        """Przed trinit nic nie zostało wydrukowane: zerwane łącze = ponowienie."""
        try:
            return fn()
        except AmbiguousCommand as e:
            raise PrinterError(Category.CONNECTION, f"Brak odpowiedzi drukarki przed rozpoczęciem paragonu ({e}); "
                               "nic nie wydrukowano, zlecenie zostanie ponowione.") from e
        except PrinterError as e:
            if _garbled(e):
                raise PrinterError(Category.CONNECTION, f"{e} — przed rozpoczęciem paragonu, zlecenie zostanie "
                                   "ponowione.", command=e.command) from e
            raise

    def _prepare(self, c: PosnetClient) -> int:
        """Status, bezpieczniki, sprzątanie po przerwanej próbie. Zwraca licznik bn przed paragonem."""
        st = self._status(c)
        if st.mechanism:
            raise PrinterError(Category.PAPER, "Drukarka: " + PRINTER_MECH_TEXT.get(st.mechanism, str(st.mechanism)))
        if st.device_state:
            raise PrinterError(Category.BUSY, "Drukarka zajęta: " + DEVICE_STATE_TEXT.get(st.device_state, str(st.device_state)))
        if st.fiscal and not self.allow_fiscal:
            why = "nie zgłasza trybu pracy (traktuję jak FISKALNĄ)" if st.fiscal_unknown else "jest w trybie FISKALNYM"
            raise PrinterError(Category.FISCAL, f"Drukarka {why}, a agent działa w trybie testowym "
                               "(ustaw FISCAL_ALLOW_REAL=1 dopiero po testach na urządzeniu niefiskalnym).")
        if st.transaction_open:
            # Otwarta transakcja z poprzedniej, przerwanej próby (trend nie wykonany) — anulujemy.
            log.warning("otwarta transakcja z poprzedniej próby — anuluję (prncancel)")
            c.call("prncancel")
            open_, bn = self._read_state(c)
            if open_:
                raise PrinterError(Category.BUSY, "Nie udało się anulować otwartej transakcji w drukarce.")
            return bn
        if st.last_receipt is None:
            raise PrinterError(Category.PROTOCOL, "Drukarka nie podała licznika paragonów (scnt.bn) — bez niego "
                               "nie da się potwierdzić wydruku, nie drukuję.", command="scnt")
        return st.last_receipt

    def _texts(self, req: ReceiptRequest) -> dict[str, str]:
        enc = self.client.encoding
        out: dict[str, str] = {}
        try:
            for i, item in enumerate(req.items):
                out[f"item{i}"] = printer_text(item.name, 40, enc)
                if not out[f"item{i}"]:
                    raise PrinterError(Category.INVALID, f"Pusta nazwa pozycji {i + 1}.")
                if item.description:
                    out[f"desc{i}"] = printer_text(item.description, 35, enc)
            for i, p in enumerate(req.payments):
                name = p.name or PAYMENT_DEFAULT_NAME.get(p.type)
                if name:
                    out[f"pay{i}"] = printer_text(name, 25, enc)
        except UnmappableText as e:
            raise PrinterError(Category.INVALID, f"Błędne dane paragonu: {e}.") from e
        except LookupError as e:  # nieznana strona kodowa w konfiguracji
            raise PrinterError(Category.INVALID, f"Nieznana strona kodowa drukarki {enc!r}: {e}") from e
        return out

    def _commands(self, req: ReceiptRequest, vat: dict[str, int],
                  texts: dict[str, str] | None = None) -> list[tuple[str, list[tuple[str, str]]]]:
        texts = texts if texts is not None else self._texts(req)
        cmds: list[tuple[str, list[tuple[str, str]]]] = [("trinit", [("bm", "1")])]
        for i, item in enumerate(req.items):
            if item.vat not in vat:
                raise PrinterError(Category.INVALID, f"Drukarka nie ma aktywnej stawki VAT {item.vat}"
                                   f"{'' if item.vat == 'zw' else '%'} (dostępne: {', '.join(vat) or 'brak'})")
            params = [("na", texts[f"item{i}"]), ("vt", str(vat[item.vat])),
                      ("pr", str(item.unit_price)), ("il", format(item.quantity.normalize(), "f")),
                      ("wa", str(item.gross))]
            if item.discount:
                params += [("rw", str(item.discount)), ("rn", "Rabat")]
            if f"desc{i}" in texts:
                params.append(("op", texts[f"desc{i}"]))
            cmds.append(("trline", params))
        change = req.paid - req.total
        for i, p in enumerate(req.payments):
            params = [("ty", str(PAYMENT_TY[p.type])), ("wa", str(p.amount))]
            if f"pay{i}" in texts:
                params.append(("na", texts[f"pay{i}"]))
            cmds.append(("trpayment", params))
        if change:
            cmds.append(("trpayment", [("ty", "0"), ("wa", str(change)), ("re", "1")]))
        end = [("to", str(req.total)), ("fp", str(req.paid))]
        if change:
            end.append(("re", str(change)))
        cmds.append(("trend", end))
        return cmds

    def _send_body(self, c: PosnetClient, body: list[tuple[str, list[tuple[str, str]]]]) -> None:
        """trinit, trline…, trpayment… — bez trend nie ma paragonu, więc każdy błąd = anuluj."""
        try:
            for cmd, params in body:
                c.call(cmd, params)
        except AmbiguousCommand as e:
            self._cancel_quietly(c)
            raise PrinterError(Category.CONNECTION, f"Zerwane połączenie w trakcie paragonu ({e}); "
                               "transakcja anulowana, zlecenie zostanie ponowione.") from e
        except PrinterError as e:
            self._cancel_quietly(c)
            if _garbled(e):
                raise PrinterError(Category.CONNECTION, f"{e}; transakcja anulowana, zlecenie zostanie ponowione.",
                                   command=e.command) from e
            raise
        except Exception as e:  # noqa: BLE001 — trend nie wyszedł, więc nic nie wydrukowano
            self._cancel_quietly(c)
            raise PrinterError(Category.INTERNAL, f"Nieoczekiwany błąd przed zakończeniem paragonu: {e}; "
                               "transakcja anulowana.") from e

    def _end(self, c: PosnetClient, end: tuple[str, list[tuple[str, str]]], before: int) -> int:
        cmd, params = end
        try:
            c.call(cmd, params)
        except Exception as e:  # noqa: BLE001 — także zły CRC odpowiedzi i zerwane łącze
            return self._resolve_after_end(c, before, e)
        # Drukarka potwierdziła trend: paragon jest. Zostaje tylko jego numer.
        try:
            number = self._read_bn(c)
        except Exception as e:  # noqa: BLE001
            log.warning("trend potwierdzony, ale odczyt licznika się nie udał (%s) — ponawiam odczyt", e)
            try:
                c.connect()
                number = self._read_bn(c)
            except Exception as e2:  # noqa: BLE001
                raise _uncertain(f"Drukarka potwierdziła zakończenie paragonu, ale nie udało się odczytać jego "
                                 f"numeru ({e}; {e2}). Paragon NAJPRAWDOPODOBNIEJ jest wydrukowany.") from e2
        if number != before + 1:
            raise _uncertain(f"Licznik paragonów po trend: {number}, oczekiwano {before + 1} (przed: {before}) — "
                             "nie wiadomo, który paragon należy do zlecenia.")
        return number

    def _cancel_quietly(self, c: PosnetClient) -> None:
        try:
            if parse_flag(c.call("strns").fields.get("to")) is not False:
                c.call("prncancel")
        except Exception as e:  # noqa: BLE001 — anulowanie to najlepsza próba
            log.error("nie udało się anulować transakcji: %s", e)

    def _resolve_after_end(self, c: PosnetClient, before: int, err: Exception) -> int:
        """trend wysłany, odpowiedzi brak albo jest błędna. Sprawdzamy, czy paragon powstał.

        Wynik: numer (bn == przed+1), ponowienie/błąd tylko po dowodzie (transakcja
        była otwarta -> prncancel -> to=0 i bn == przed), w każdym innym razie UNCERTAIN.
        """
        # Drukarka czytelnie odpowiedziała błędem na NASZ trend (kod błędu w poprawnej ramce).
        explicit = isinstance(err, PrinterError) and err.code is not None
        log.warning("trend: %s — sprawdzam stan drukarki", err)
        try:
            c.connect()  # świeże połączenie: po błędzie ramki strumień mógł się rozjechać
            open_, bn = self._read_state(c)
            if bn == before + 1:
                if open_:
                    log.warning("paragon nr %s wydrukowany, ale drukarka ma otwartą transakcję", bn)
                log.info("paragon nr %s potwierdzony licznikiem po błędzie trend (%s)", bn, err)
                return bn
            proven_not_printed = False
            if open_ and bn == before:
                # Transakcja dalej otwarta = trend nie został wykonany. Anulujemy i sprawdzamy.
                c.call("prncancel")
                open_after, bn_after = self._read_state(c)
                proven_not_printed = not open_after and bn_after == before
                bn = bn_after
        except Exception as e:  # noqa: BLE001
            raise _uncertain(f"Nie wiadomo, czy paragon został wydrukowany (po wysłaniu trend: {err}; "
                             f"sprawdzenie stanu nie powiodło się: {e}).") from err
        if proven_not_printed:
            if explicit:
                raise err  # np. błąd sumy — dane do poprawy, nic nie wydrukowano
            raise PrinterError(Category.CONNECTION, "trend nie został wykonany (transakcja była otwarta, anulowana, "
                               "licznik bez zmian); zlecenie zostanie ponowione.") from err
        raise _uncertain(f"Po błędzie trend ({err}) licznik paragonów = {bn} (przed: {before}), "
                         "a transakcji nie dało się jednoznacznie rozstrzygnąć.") from err
