"""Błędy drukarki POSNET i ich klasyfikacja dla kolejki.

Kody i opisy: DBC-I-DEV-45 v021, rozdział „Opisy błędów” (str. 156-163)
oraz statusy rozkazów sprn/sdev (str. 135-136). Kategorie (retry / człowiek)
są nasze — specyfikacja ich nie definiuje.
"""

from __future__ import annotations

from enum import Enum


class Category(str, Enum):
    CONNECTION = "connection"      # brak połączenia / zerwane WiFi -> ponów później
    BUSY = "busy"                  # drukarka w menu / czeka na klawisz -> ponów później
    PAPER = "paper"                # brak papieru, otwarta pokrywa -> ponów po interwencji
    FISCAL = "fiscal"              # stan urządzenia blokuje sprzedaż -> człowiek
    INVALID = "invalid"            # błędne dane paragonu -> człowiek (popraw dane)
    PROTOCOL = "protocol"          # błąd ramki / nieobsługiwana komenda -> człowiek
    UNCERTAIN = "uncertain"        # nie wiadomo, czy paragon się wydrukował -> człowiek
    INTERNAL = "internal"


RETRYABLE = {Category.CONNECTION, Category.BUSY, Category.PAPER}

# Wybrane kody z tabeli „Błędy poleceń”.
ERROR_TEXT: dict[int, str] = {
    1: "Nierozpoznana komenda",
    2: "Brak obowiązkowego pola",
    3: "Błąd konwersji pola",
    5: "Zła suma kontrolna",
    11: "Zapełniony bufor odbiorczy",
    13: "Nie znaleziono rozkazu o podanym tokenie",
    14: "Zapełniona kolejka wejściowa",
    15: "Błąd budowy ramki",
    323: "Funkcja zablokowana w konfiguracji",
    383: "Brak raportu dobowego",
    484: "Minął czas pracy kasy, sprzedaż zablokowana",
    1950: "Przekroczony zakres totalizerów paragonu",
    2000: "Błąd pola VAT",
    2002: "Brak nagłówka",
    2004: "Brak aktywnych stawek VAT",
    2005: "Brak trybu transakcji",
    2006: "Błąd pola cena (cena <= 0)",
    2007: "Błąd pola ilość (ilość <= 0)",
    2008: "Błąd kwoty total",
    2010: "Przekroczony zakres totalizerów dobowych",
    2034: "Urządzenie w trybie niefiskalnym",
    2036: "Urządzenie w stanie tylko do odczytu",
    2038: "Urządzenie w trybie transakcji",
    2041: "Próba zakończenia paragonu z wartością 0",
    2052: "Brak pamięci w buforze transakcji",
    2054: "Formy płatności nie pokrywają kwoty do zapłaty lub reszty",
    2055: "Błędna linia",
    2060: "Błędny stan transakcji",
    2062: "Jest wydrukowana część jakiegoś dokumentu",
    2063: "Błąd parametru",
    2103: "Nieprawidłowa stawka VAT",
    2104: "Błąd nazwy",
    2106: "Towar zablokowany w bazie drukarkowej",
    2701: "Błąd identyfikatora stawki podatkowej",
    2704: "Zbyt słaby akumulator",
    2705: "Błędny identyfikator typu formy płatności",
    2802: "Błąd weryfikacji wartości linii sprzedaży",
    2805: "Błąd weryfikacji wartości fiskalnej",
    2808: "Błąd weryfikacji wartości form płatności",
    2900: "Stan kopii elektronicznej nie pozwala na wydruk",
    2901: "Brak nośnika kopii elektronicznej lub operacja trwa",
}

_BUSY = {11, 14, 2038, 2062, 2901}
_FISCAL = {323, 383, 484, 1950, 2002, 2004, 2010, 2036, 2052, 2704, 2900}
_PROTOCOL = {1, 4, 5, 6, 7, 8, 9, 10, 12, 13, 15}

# sprn — status mechanizmu (pr)
PRINTER_MECH_TEXT = {
    0: "brak błędu",
    1: "podniesiona dźwignia",
    2: "brak dostępu do mechanizmu",
    3: "podniesiona pokrywa",
    4: "brak papieru – kopia",
    5: "brak papieru – oryginał",
    6: "nieodpowiednia temperatura lub zasilanie",
    7: "chwilowy zanik zasilania",
    8: "błąd obcinacza",
    9: "błąd zasilacza",
    10: "podniesiona pokrywa przy obcinaniu",
}

# sdev — status urządzenia (ds)
DEVICE_STATE_TEXT = {
    0: "gotowość",
    1: "w menu",
    2: "oczekiwanie na klawisz",
    3: "oczekiwanie na reakcję użytkownika (wystąpił błąd)",
}


def classify_code(code: int, frame_error: bool = False) -> Category:
    if frame_error or code in _PROTOCOL:
        return Category.PROTOCOL
    if code in _BUSY:
        return Category.BUSY
    if code in _FISCAL or 1000 <= code < 1100:
        return Category.FISCAL
    return Category.INVALID


class PrinterError(Exception):
    def __init__(self, category: Category, message: str, code: int | None = None,
                 command: str | None = None) -> None:
        super().__init__(message)
        self.category = category
        self.code = code
        self.command = command

    @property
    def retryable(self) -> bool:
        return self.category in RETRYABLE

    @classmethod
    def from_code(cls, code: int, command: str, frame_error: bool = False) -> "PrinterError":
        text = ERROR_TEXT.get(code, "błąd drukarki")
        prefix = "Błąd ramki" if frame_error else "Błąd"
        return cls(classify_code(code, frame_error), f"{prefix} {code} ({command}): {text}",
                   code=code, command=command)
