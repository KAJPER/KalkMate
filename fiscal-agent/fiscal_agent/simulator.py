"""Symulator drukarki POSNET (TCP) do testów bez urządzenia.

Zbudowany WYŁĄCZNIE na podstawie specyfikacji DBC-I-DEV-45 — nie jest
odwzorowaniem prawdziwego firmware'u. Służy do testów logiki agenta (kolejka,
błędy, zerwane połączenia), NIE zastępuje testu na prawdziwej drukarce.

Uruchomienie ręczne:  python -m fiscal_agent.simulator --port 6666
"""

from __future__ import annotations

import argparse
import socketserver
import threading
from collections import OrderedDict
from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal

from .posnet.frame import ETX, STX, FrameError, FrameReader, crc16_xmodem, decode, encode

VAT_FIELDS = ["va", "vb", "vc", "vd", "ve", "vf", "vg"]


@dataclass
class SimState:
    fiscal: bool = False
    mechanism: int = 0                     # sprn.pr
    device_state: int = 0                  # sdev.ds
    vat: list[str] = field(default_factory=lambda: ["23,00", "8,00", "5,00", "0,00", "101,00", "101,00", "100,00"])
    receipt_no: int = 100
    open: bool = False
    lines: list[dict] = field(default_factory=list)
    paid: int = 0
    change: int = 0
    printed: list[dict] = field(default_factory=list)
    cancelled: int = 0
    # wstrzykiwanie awarii
    drop_after: set[str] = field(default_factory=set)    # wykonaj i zerwij połączenie (raz)
    drop_before: set[str] = field(default_factory=set)   # zerwij przed wykonaniem (raz)
    errors: dict[str, int] = field(default_factory=dict)  # komenda -> kod błędu (raz)
    responses: "OrderedDict[int, bytes]" = field(default_factory=OrderedDict)
    lock: threading.Lock = field(default_factory=threading.Lock)


class _Drop(Exception):
    pass


def _q(v: str) -> Decimal:
    return Decimal(v.replace(",", ".")) if v else Decimal(1)


class Handler(socketserver.BaseRequestHandler):
    server: "Simulator"

    def handle(self) -> None:
        reader = FrameReader()
        while True:
            try:
                data = self.request.recv(4096)
            except OSError:
                return
            if not data:
                return
            for raw in reader.feed(data):
                try:
                    out = self.server.execute(raw)
                except _Drop:
                    self.request.close()
                    return
                if out:
                    self.request.sendall(out)


class Simulator(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

    def __init__(self, host: str = "127.0.0.1", port: int = 0, state: SimState | None = None) -> None:
        super().__init__((host, port), Handler)
        self.state = state or SimState()

    @property
    def port(self) -> int:
        return self.server_address[1]

    def start(self) -> "Simulator":
        threading.Thread(target=self.serve_forever, daemon=True).start()
        return self

    # --- wykonanie rozkazu --------------------------------------------------
    def execute(self, raw: bytes) -> bytes:
        s = self.state
        try:
            req = decode(raw)
        except FrameError:
            return _err_frame(5)
        cmd = req.command.lstrip("!")
        token = req.token
        with s.lock:
            if cmd == "rpt":
                if token in s.responses:
                    return s.responses[token]
                return _err_frame(13, token, "rpt")
            if cmd in s.drop_before:
                s.drop_before.discard(cmd)
                raise _Drop()
            if cmd in s.errors:
                code = s.errors.pop(cmd)
                return self._remember(token, _cmd_err(cmd, code, token))
            out = self._run(cmd, req.fields, token)
            self._remember(token, out)
            if cmd in s.drop_after:
                s.drop_after.discard(cmd)
                raise _Drop()
            return out

    def _remember(self, token: int | None, frame: bytes) -> bytes:
        if token is not None:
            self.state.responses[token] = frame
            while len(self.state.responses) > 32:
                self.state.responses.popitem(last=False)
        return frame

    def _run(self, cmd: str, f: dict[str, str], token: int | None) -> bytes:
        s = self.state

        def ok(fields: list[tuple[str, str]] | None = None) -> bytes:
            return encode(cmd, fields or [], token)

        def err(code: int) -> bytes:
            return _cmd_err(cmd, code, token)

        if cmd == "simset":
            # Komenda TYLKO symulatora (nie ma jej w drukarce): wstrzykiwanie stanu
            # i awarii z testów w innym procesie (np. testy agenta w aplikacji Electron).
            if "pr" in f:
                s.mechanism = int(f["pr"])
            if "ds" in f:
                s.device_state = int(f["ds"])
            if "fs" in f:
                s.fiscal = f["fs"] in {"1", "T"}
            if "da" in f:
                s.drop_after.add(f["da"])
            if "db" in f:
                s.drop_before.add(f["db"])
            if "er" in f:
                name, code = f["er"].split(":")
                s.errors[name] = int(code)
            return ok([("bn", str(s.receipt_no)), ("np", str(len(s.printed))), ("nc", str(s.cancelled))])
        if cmd == "sid":
            return ok([("nm", "POSNET Simulator"), ("vr", "0.1")])
        if cmd == "sdev":
            return ok([("ds", str(s.device_state)), ("cp", "1"), ("qe", "1")])
        if cmd == "sprn":
            return ok([("pr", str(s.mechanism))])
        if cmd == "scomm":
            return ok([("fs", "T" if s.fiscal else "N"), ("tz", "N"), ("ts", "17" if s.open else "0"),
                       ("hr", "T"), ("nu", "SIM00000001")])
        if cmd == "strns":
            return ok([("to", "1" if s.open else "0"), ("ts", "17")])
        if cmd == "scnt":
            return ok([("rd", "1"), ("hn", "1"), ("bn", str(s.receipt_no)), ("fn", "0"), ("nu", "SIM00000001")])
        if cmd == "vatget":
            return ok(list(zip(VAT_FIELDS, s.vat)))
        if cmd in {"prncancel", "trcancel"}:
            if s.open:
                s.cancelled += 1
            s.open, s.lines, s.paid, s.change = False, [], 0, 0
            return ok()
        if s.mechanism:
            return err(50)
        if cmd == "trinit":
            if s.open:
                return err(2038)
            s.open, s.lines, s.paid, s.change = True, [], 0, 0
            return ok()
        if not s.open and cmd in {"trline", "trpayment", "trend"}:
            return err(2005)
        if cmd == "trline":
            if "na" not in f or "vt" not in f or "pr" not in f:
                return err(2)
            vt = int(f["vt"])
            if not 0 <= vt <= 6 or s.vat[vt] == "101,00":
                return err(2000)
            pr = int(f["pr"])
            if pr <= 0:
                return err(2006)
            qty = _q(f.get("il", "1"))
            total = int((qty * pr).quantize(Decimal(1), rounding=ROUND_HALF_UP))
            if "wa" in f and int(f["wa"]) != total:
                return err(2802)
            disc = int(f.get("rw", "0"))
            s.lines.append({"na": f["na"], "vt": vt, "pr": pr, "il": str(qty), "wa": total, "rw": disc})
            return ok()
        if cmd == "trpayment":
            amount = int(f.get("wa", "0"))
            if amount <= 0:
                return err(1962)
            if f.get("re") == "1":
                s.change += amount
            else:
                s.paid += amount
            return ok()
        if cmd == "trend":
            fiscal_total = sum(line["wa"] - line["rw"] for line in s.lines)
            if fiscal_total <= 0:
                return err(2041)
            if "to" in f and int(f["to"]) != fiscal_total:
                return err(2805)
            if "fp" in f and int(f["fp"]) != s.paid:
                return err(2808)
            if s.paid - s.change != fiscal_total and not (s.paid > fiscal_total and s.change == 0):
                return err(2054)
            s.receipt_no += 1
            s.printed.append({"number": s.receipt_no, "lines": s.lines, "total": fiscal_total,
                              "paid": s.paid, "change": s.change, "fiscal": s.fiscal})
            s.open, s.lines, s.paid, s.change = False, [], 0, 0
            return ok()
        return err(1)


def _cmd_err(cmd: str, code: int, token: int | None) -> bytes:
    """Błąd polecenia: STX cmd TAB ?nnnn TAB #CRC ETX (pole '?' nie ma 2-znakowego mnemonika)."""
    parts = [cmd, f"?{code}"] + ([f"@{token:04d}"] if token is not None else [])
    body = ("\t".join(parts) + "\t").encode("cp1250")
    return bytes([STX]) + body + f"#{crc16_xmodem(body):04X}".encode() + bytes([ETX])


def _err_frame(code: int, token: int | None = None, cmd: str | None = None) -> bytes:
    """Błąd ramki: STX ERR TAB [@TOKEN TAB] ernn TAB [cmID TAB] #CRC ETX (jak przykład rpt w spec.)."""
    parts = ["ERR"] + ([f"@{token:04d}"] if token is not None else []) + [f"er{code}"] + ([f"cm{cmd}"] if cmd else [])
    body = ("\t".join(parts) + "\t").encode("cp1250")
    return bytes([STX]) + body + f"#{crc16_xmodem(body):04X}".encode() + bytes([ETX])


def main() -> None:
    ap = argparse.ArgumentParser(description="Symulator drukarki POSNET (tylko do testów)")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=6666)
    ap.add_argument("--fiscal", action="store_true", help="udawaj tryb fiskalny")
    args = ap.parse_args()
    sim = Simulator(args.host, args.port, SimState(fiscal=args.fiscal))
    print(f"Symulator POSNET na {args.host}:{sim.port} (tryb {'fiskalny' if args.fiscal else 'niefiskalny'})", flush=True)
    sim.serve_forever()


if __name__ == "__main__":
    main()
