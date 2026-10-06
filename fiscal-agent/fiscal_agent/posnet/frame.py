"""Ramki protokołu POSNET (drukarki fiskalne).

Źródło: „Specyfikacja protokołu POSNET” DBC-I-DEV-45 wersja 021, rozdział
„Ogólny opis protokołu” (budowa ramki, suma kontrolna, odpowiedzi, błędy ramki).

    STX  id_polecenia TAB  [pp<wartość> TAB]...  [@TOKEN TAB]  #CRC16  ETX

- STX = 0x02, ETX = 0x03, TAB = 0x09.
- Parametr = dwuznakowy mnemonik + wartość, po każdym TAB.
- Token: '@' + 4 cyfry dziesiętne, opcjonalny, odsyłany w odpowiedzi.
- CRC16-CCITT (wariant XMODEM: poly 0x1021, init 0x0000) liczone ze wszystkich
  bajtów między STX a '#', zapisane szesnastkowo (4 znaki).
- Odpowiedź OK:     STX id TAB [pola] #CRC ETX
- Błąd polecenia:   STX id TAB ?nnnn TAB #CRC ETX
- Błąd ramki:       STX ERR TAB [@TOKEN TAB] ?nn|ernn TAB [cmID TAB [fdPOLE TAB]] #CRC ETX
  (specyfikacja w opisie podaje „?ERR_NO”, a w przykładzie rozkazu rpt „er13” —
  parser akceptuje oba zapisy).
"""

from __future__ import annotations

from dataclasses import dataclass, field

STX = 0x02
ETX = 0x03
TAB = 0x09

# Znaki, których nie wolno przesłać w wartości pola (rozbiłyby ramkę).
_FORBIDDEN = {chr(STX), chr(ETX), chr(TAB), "\r", "\n"}


def crc16_xmodem(data: bytes) -> int:
    crc = 0
    for b in data:
        crc ^= b << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) if crc & 0x8000 else (crc << 1)
            crc &= 0xFFFF
    return crc


class FrameError(Exception):
    """Ramka nie do odczytania (zły CRC, brak STX/ETX, zły format)."""


def clean_text(value: str, max_len: int | None = None) -> str:
    """Usuwa znaki sterujące ramki z tekstu (nazwy towarów itp.).

    '#' też zamieniamy: parser drukarki szuka sumy kontrolnej po '#', a
    specyfikacja nie mówi wprost, czy '#' wewnątrz wartości jest bezpieczny.
    """
    out = "".join(" " if ch in _FORBIDDEN else ch for ch in value).replace("#", "nr ")
    out = " ".join(out.split())
    return out[:max_len] if max_len else out


def encode(command: str, params: list[tuple[str, str]] | None = None,
           token: int | None = None, encoding: str = "cp1250") -> bytes:
    parts = [command]
    for name, value in params or []:
        if len(name) != 2:
            raise ValueError(f"mnemonik parametru musi mieć 2 znaki: {name!r}")
        if any(ch in _FORBIDDEN for ch in value):
            raise ValueError(f"niedozwolony znak w polu {name}: {value!r}")
        parts.append(name + value)
    if token is not None:
        parts.append(f"@{token:04d}")
    body = ("\t".join(parts) + "\t").encode(encoding)
    crc = crc16_xmodem(body)
    return bytes([STX]) + body + f"#{crc:04X}".encode("ascii") + bytes([ETX])


@dataclass
class Response:
    command: str
    fields: dict[str, str] = field(default_factory=dict)
    token: int | None = None
    error: int | None = None          # kod błędu (?nnnn / ernn)
    frame_error: bool = False         # odpowiedź "ERR" = błąd ramki protokołu
    raw: bytes = b""

    @property
    def ok(self) -> bool:
        return self.error is None and not self.frame_error


def decode(frame: bytes, encoding: str = "cp1250") -> Response:
    if len(frame) < 8 or frame[0] != STX or frame[-1] != ETX:
        raise FrameError(f"brak STX/ETX: {frame!r}")
    hash_pos = frame.rfind(b"#")
    if hash_pos < 1:
        raise FrameError("brak sumy kontrolnej")
    body = frame[1:hash_pos]
    crc_txt = frame[hash_pos + 1:-1]
    try:
        crc_rx = int(crc_txt.decode("ascii"), 16)
    except ValueError as e:
        raise FrameError(f"zła suma kontrolna: {crc_txt!r}") from e
    if crc_rx != crc16_xmodem(body):
        raise FrameError(f"CRC się nie zgadza (odebrano {crc_rx:04X})")

    items = [p for p in body.decode(encoding, errors="replace").split("\t") if p != ""]
    if not items:
        raise FrameError("pusta ramka")
    resp = Response(command=items[0], raw=frame, frame_error=items[0] == "ERR")
    for item in items[1:]:
        if item.startswith("@") and item[1:].isdigit():
            resp.token = int(item[1:])
        elif item.startswith("?") and item[1:].isdigit():
            resp.error = int(item[1:])
        elif resp.frame_error and item.startswith("er") and item[2:].isdigit():
            resp.error = int(item[2:])
        elif len(item) >= 2:
            resp.fields[item[:2]] = item[2:]
    return resp


class FrameReader:
    """Składa ramki z kawałków odczytanych z gniazda TCP."""

    def __init__(self) -> None:
        self._buf = bytearray()

    def feed(self, data: bytes) -> list[bytes]:
        self._buf.extend(data)
        frames: list[bytes] = []
        while True:
            start = self._buf.find(bytes([STX]))
            if start < 0:
                self._buf.clear()
                return frames
            end = self._buf.find(bytes([ETX]), start + 1)
            if end < 0:
                del self._buf[:start]
                return frames
            frames.append(bytes(self._buf[start:end + 1]))
            del self._buf[:end + 1]
