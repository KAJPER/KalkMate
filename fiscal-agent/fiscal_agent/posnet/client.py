"""Klient TCP drukarki POSNET.

Każdy rozkaz dostaje token (@XXXX). Gdy połączenie zerwie się po wysłaniu
rozkazu (typowe przy WiFi), klient łączy się ponownie i prosi o powtórzenie
odpowiedzi rozkazem `rpt` z tym samym tokenem (DBC-I-DEV-45, „[rpt]”). Bufor
drukarki pamięta do 32 odpowiedzi — jeśli odpowiedzi już nie ma (błąd ramki 13),
rozkaz uznajemy za *niepewny* i decyzję podejmuje warstwa wyżej (sprawdza
liczniki i stan transakcji).
"""

from __future__ import annotations

import itertools
import logging
import random
import socket
import threading

from .errors import Category, PrinterError
from .frame import FrameError, FrameReader, Response, decode, encode

log = logging.getLogger(__name__)


class AmbiguousCommand(Exception):
    """Rozkaz mógł zostać wykonany, ale nie mamy odpowiedzi."""

    def __init__(self, command: str, token: int) -> None:
        super().__init__(f"brak odpowiedzi na {command} (token {token})")
        self.command = command
        self.token = token


class PosnetClient:
    def __init__(self, host: str, port: int, *, timeout: float = 10.0,
                 connect_timeout: float = 5.0, encoding: str = "cp1250") -> None:
        self.host = host
        self.port = port
        self.timeout = timeout
        self.connect_timeout = connect_timeout
        self.encoding = encoding
        self._sock: socket.socket | None = None
        self._reader = FrameReader()
        self._pending: list[bytes] = []
        self._tokens = itertools.cycle(range(random.randint(1, 9000), 10000))
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
        tok = next(self._tokens)
        if tok == 0:
            tok = next(self._tokens)
        return tok

    def _read_frame(self) -> Response:
        assert self._sock is not None
        while not self._pending:
            chunk = self._sock.recv(4096)
            if not chunk:
                raise ConnectionError("drukarka zamknęła połączenie")
            self._pending.extend(self._reader.feed(chunk))
        return decode(self._pending.pop(0), self.encoding)

    def _exchange(self, command: str, params: list[tuple[str, str]] | None, token: int) -> Response:
        if self._sock is None:
            self.connect()
        assert self._sock is not None
        self._sock.sendall(encode(command, params, token, self.encoding))
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
            return self._exchange(command, params, token)
        except FrameError as e:
            raise PrinterError(Category.PROTOCOL, f"Nieczytelna odpowiedź na {command}: {e}",
                               command=command) from e
        except (OSError, ConnectionError) as first:
            log.warning("zerwane połączenie przy %s: %s — próba rpt", command, first)
            # Rozkaz mógł dojść. Łączymy się ponownie i pytamy o odpowiedź.
            try:
                self.connect()
                resp = self._exchange("rpt", None, token)
            except PrinterError:
                raise AmbiguousCommand(command, token) from first
            except (OSError, ConnectionError, FrameError) as e:
                raise AmbiguousCommand(command, token) from e
            if resp.frame_error and resp.error == 13:
                # Drukarka nie zna tokenu: albo rozkaz nie dotarł, albo wypadł z bufora.
                raise AmbiguousCommand(command, token) from first
            return resp

    def call(self, command: str, params: list[tuple[str, str]] | None = None) -> Response:
        """Jak raw(), ale błąd z drukarki zamienia na PrinterError."""
        resp = self.raw(command, params)
        if not resp.ok:
            raise PrinterError.from_code(resp.error or 0, command, resp.frame_error)
        return resp
