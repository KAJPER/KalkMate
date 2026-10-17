"""Klient TCP drukarki POSNET.

Każdy rozkaz dostaje token (@XXXX). Gdy połączenie zerwie się po wysłaniu
rozkazu (typowe przy WiFi), klient łączy się ponownie i prosi o powtórzenie
odpowiedzi rozkazem `rpt` z tym samym tokenem (DBC-I-DEV-45, „[rpt]”). Bufor
drukarki pamięta do 32 odpowiedzi — jeśli odpowiedzi już nie ma (błąd ramki 13),
rozkaz uznajemy za *niepewny* i decyzję podejmuje warstwa wyżej (sprawdza
liczniki i stan transakcji).
"""

from __future__ import annotations

import logging
import random
import socket
import threading
from typing import Callable

from .errors import Category, PrinterError
from .frame import FrameError, FrameReader, Response, decode, encode

log = logging.getLogger(__name__)

TOKEN_MAX = 9999  # token to 4 cyfry; 0 pomijamy


def _wrap(n: int) -> int:
    return (n - 1) % TOKEN_MAX + 1


class AmbiguousCommand(Exception):
    """Rozkaz mógł zostać wykonany, ale nie mamy odpowiedzi."""

    def __init__(self, command: str, token: int) -> None:
        super().__init__(f"brak odpowiedzi na {command} (token {token})")
        self.command = command
        self.token = token


class MemoryTokens:
    """Tokeny w pamięci (testy, jednorazowe narzędzia)."""

    def __init__(self, start: int | None = None) -> None:
        self._next = _wrap(start if start else random.randint(1, TOKEN_MAX))
        self._lock = threading.Lock()

    def __call__(self) -> int:
        with self._lock:
            tok = self._next
            self._next = _wrap(tok + 1)
            return tok


class PersistentTokens:
    """Tokeny ramek rosnące także między restartami agenta.

    Losowy początek po restarcie mógł trafić na token, którego odpowiedź na INNY
    rozkaz wciąż leży w buforze drukarki — wtedy `rpt` oddałby cudzą odpowiedź.
    Rezerwujemy bloki tokenów i zapisujemy koniec bloku; po restarcie zaczynamy
    za nim. Błąd zapisu nie blokuje druku (tylko log) — unikalność w obrębie
    procesu zostaje, a weryfikacja `resp.command` w rpt łapie resztę.
    """

    def __init__(self, load: Callable[[], int | None], save: Callable[[int], None], block: int = 32) -> None:
        self._save = save
        self._block = block
        self._left = 0
        self._lock = threading.Lock()
        try:
            start = load()
        except Exception as e:  # noqa: BLE001
            log.error("nie udało się odczytać licznika tokenów: %s", e)
            start = None
        self._next = _wrap(int(start)) if isinstance(start, int) and start > 0 else random.randint(1, TOKEN_MAX)

    def __call__(self) -> int:
        with self._lock:
            if self._left <= 0:
                try:
                    self._save(_wrap(self._next + self._block))
                except Exception as e:  # noqa: BLE001
                    log.error("nie udało się zapisać licznika tokenów: %s", e)
                self._left = self._block
            tok = self._next
            self._next = _wrap(tok + 1)
            self._left -= 1
            return tok


class PosnetClient:
    def __init__(self, host: str, port: int, *, timeout: float = 10.0,
                 connect_timeout: float = 5.0, encoding: str = "cp1250",
                 token_source: Callable[[], int] | None = None) -> None:
        self.host = host
        self.port = port
        self.timeout = timeout
        self.connect_timeout = connect_timeout
        self.encoding = encoding
        self._sock: socket.socket | None = None
        self._reader = FrameReader()
        self._pending: list[bytes] = []
        self._tokens = token_source or MemoryTokens()
        self.lock = threading.RLock()

    # --- połączenie -------------------------------------------------------
    def connect(self) -> None:
        self.close()
        try:
            s = socket.create_connection((self.host, self.port), timeout=self.connect_timeout)
        except OSError as e:
            raise PrinterError(Category.CONNECTION,
                               f"Brak połączenia z drukarką {self.host}:{self.port} ({e})") from e
        s.settimeout(self.timeout)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
        self._sock = s
        self._reader = FrameReader()
        self._pending = []

    def close(self) -> None:
        if self._sock is not None:
            try:
                self._sock.close()
            except OSError:
                pass
        self._sock = None

    def __enter__(self) -> "PosnetClient":
        self.lock.acquire()
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()
        self.lock.release()

    # --- wymiana ramek ------------------------------------------------------
    def _next_token(self) -> int:
        tok = _wrap(int(self._tokens()))
        return tok

    def _read_frame(self) -> Response:
        assert self._sock is not None
        while not self._pending:
            chunk = self._sock.recv(4096)
            if not chunk:
                raise ConnectionError("drukarka zamknęła połączenie")
            self._pending.extend(self._reader.feed(chunk))
        return decode(self._pending.pop(0), self.encoding)

    def _exchange(self, frame: bytes, token: int) -> Response:
        if self._sock is None:
            self.connect()
        assert self._sock is not None
        self._sock.sendall(frame)
        while True:
            resp = self._read_frame()
            # Odpowiedzi z innym tokenem (np. spóźniona po poprzednim zerwaniu) pomijamy.
            if resp.token is None or resp.token == token:
                return resp
            log.warning("pominięto odpowiedź z obcym tokenem %s", resp.token)

    def raw(self, command: str, params: list[tuple[str, str]] | None = None) -> Response:
        """Wysyła rozkaz; przy zerwaniu odzyskuje odpowiedź przez rpt."""
        token = self._next_token()
        try:
            # Kodowanie PRZED wysłaniem: znak spoza strony kodowej nie może
            # przerwać transakcji w połowie (nic jeszcze nie wyszło do drukarki).
            frame = encode(command, params, token, self.encoding)
        except ValueError as e:  # także UnicodeEncodeError
            raise PrinterError(Category.INVALID, f"Nie da się zakodować rozkazu {command} "
                               f"(strona kodowa {self.encoding}): {e}", command=command) from e
        try:
            return self._exchange(frame, token)
        except FrameError as e:
            raise PrinterError(Category.PROTOCOL, f"Nieczytelna odpowiedź na {command}: {e}",
                               command=command, garbled=True) from e
        except (OSError, ConnectionError) as first:
            log.warning("zerwane połączenie przy %s: %s — próba rpt", command, first)
            # Rozkaz mógł dojść. Łączymy się ponownie i pytamy o odpowiedź.
            try:
                self.connect()
                resp = self._exchange(encode("rpt", None, token, self.encoding), token)
            except PrinterError:
                raise AmbiguousCommand(command, token) from first
            except (OSError, ConnectionError, FrameError) as e:
                raise AmbiguousCommand(command, token) from e
            if resp.frame_error:
                if resp.error == 13 or resp.fields.get("cm") != command:
                    # 13: drukarka nie zna tokenu (rozkaz nie dotarł albo wypadł z bufora);
                    # inny błąd ramki bez naszego cm dotyczy samego rpt.
                    raise AmbiguousCommand(command, token) from first
                return resp  # błąd ramki zgłoszony dla NASZEGO rozkazu — nie został wykonany
            if resp.command.lstrip("!") != command.lstrip("!"):
                # Token trafił na odpowiedź innego rozkazu — nie wolno jej użyć.
                log.error("rpt %s: odpowiedź dotyczy rozkazu %s, nie %s", token, resp.command, command)
                raise AmbiguousCommand(command, token) from first
            return resp

    def call(self, command: str, params: list[tuple[str, str]] | None = None) -> Response:
        """Jak raw(), ale błąd z drukarki zamienia na PrinterError."""
        resp = self.raw(command, params)
        if not resp.ok:
            raise PrinterError.from_code(resp.error or 0, command, resp.frame_error)
        return resp
