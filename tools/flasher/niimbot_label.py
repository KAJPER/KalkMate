"""Etykieta z ID kalkulatora (kod kreskowy Code 128) na drukarce Niimbot B1 / B1 Pro.

ID kalkulatora = MAC Wi-Fi (STA) bez separatorow, 12 znakow hex, wielkie litery
(to samo co Device ID w firmware i w panelu admina). Etykieta 50x30 mm,
naklejana w srodku kalkulatora; skaner (klawiatura HID) zwraca dokladnie ID.

Drukarka nie ma sterownika Windows - mowimy jej protokolem (jak niimprint /
NiimBlue) po Bluetooth SPP (port COM). Bez zaleznosci poza pyserial + Pillow.

Test z linii polecen:
    python niimbot_label.py COM29 14C19F442A48 [wersja_fw]
    python niimbot_label.py --png out.png 14C19F442A48   (podglad bez drukowania)
"""
import re
import struct
import sys
import threading
import time

from PIL import Image, ImageDraw, ImageFont

# ----------------------------------------------------------------------
# Code 128 (zestaw B) - szerokosci kresek/przerw dla wartosci 0..106
# ----------------------------------------------------------------------
_C128 = (
    "212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 "
    "221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 "
    "221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 "
    "212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 "
    "231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 "
    "231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 "
    "314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 "
    "112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 "
    "111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 "
    "214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 "
    "114131 311141 411131 211412 211214 211232 2331112"
).split()
assert len(_C128) == 107 and all(sum(map(int, p)) == 11 for p in _C128[:106])
_START_B, _STOP = 104, 106


def code128b_modules(text):
    """Lista modulow (True = kreska) dla tekstu ASCII 32..126, z suma kontrolna."""
    vals = [ord(c) - 32 for c in text]
    if any(v < 0 or v > 94 for v in vals):
        raise ValueError(f"Znak spoza Code128B w {text!r}")
    check = (_START_B + sum((i + 1) * v for i, v in enumerate(vals))) % 103
    mods = []
    for code in [_START_B, *vals, check, _STOP]:
        for i, w in enumerate(_C128[code]):
            mods.extend([i % 2 == 0] * int(w))
    return mods


# ----------------------------------------------------------------------
# Uklad etykiety
# ----------------------------------------------------------------------
# 50x30 mm @ 300 dpi; 50 mm w poprzek glowicy B1 Pro (48 mm = 576 px),
# 30 mm wzdluz tasmy (354 px). Sprawdzone wydrukiem z ramka.
LABEL_W, LABEL_H = 576, 354
_ID_RE = re.compile(r"^[0-9A-F]{12}$")


def normalize_id(mac):
    dev = re.sub(r"[^0-9A-Fa-f]", "", mac or "").upper()
    if not _ID_RE.match(dev):
        raise ValueError(f"Niepoprawne ID kalkulatora: {mac!r} (oczekiwane 12 znakow hex)")
    return dev


def _font(names, size):
    for n in names:
        try:
            return ImageFont.truetype(n, size)
        except OSError:
            continue
    return ImageFont.load_default()


def render_id_label(device_id, fw_version=None, w=LABEL_W, h=LABEL_H):
    """Obraz 1-bit etykiety: naglowek, kod kreskowy ID, ID czytelne, FW + data."""
    dev = normalize_id(device_id)
    img = Image.new("1", (w, h), 1)
    d = ImageDraw.Draw(img)
    small = _font(["arial.ttf", "DejaVuSans.ttf"], 26)
    big = _font(["consolab.ttf", "courbd.ttf", "DejaVuSansMono-Bold.ttf"], 54)

    d.text((w // 2, 24), "KalkMate ID", font=small, fill=0, anchor="mm")

    mods = code128b_modules(dev)
    # Najszerszy modul, ktory miesci kod + strefy ciszy 10 modulow z kazdej strony
    mw = max(1, min(4, w // (len(mods) + 20)))
    bw = len(mods) * mw
    x0, y0, y1 = (w - bw) // 2, 46, 236
    for i, bar in enumerate(mods):
        if bar:
            d.rectangle([x0 + i * mw, y0, x0 + (i + 1) * mw - 1, y1], fill=0)

    d.text((w // 2, 274), dev, font=big, fill=0, anchor="mm")
    foot = time.strftime("%Y-%m-%d")
    if fw_version:
        foot = f"FW {fw_version}   {foot}"
    d.text((w // 2, 328), foot, font=small, fill=0, anchor="mm")
    return img


# ----------------------------------------------------------------------
# Etykieta na tyl kalkulatora (CE / RoHS / producent / WEEE / SN)
# ----------------------------------------------------------------------
BACK_LINES = {
    "model": "KalkMate v3",
    "maker": "KAJPA Kacper Popko",
    "address": "Zastawie I 37, 16-070 Choroszcz",
    "spec1": "Made in Poland · Li-Po 3.7V 1500mAh,",
    "spec2": "USB-C 5V",
}


def _supersampled(w, h, inside, ss=4):
    """Bitmapa 1-bit z funkcji inside(x, y) w ukladzie [0..1]x[0..1] (antyaliasing ss x ss)."""
    img = Image.new("1", (w, h), 1)
    px = img.load()
    n = ss * ss
    for y in range(h):
        for x in range(w):
            hit = 0
            for sy in range(ss):
                for sx in range(ss):
                    if inside((x + (sx + 0.5) / ss) / w, (y + (sy + 0.5) / ss) / h):
                        hit += 1
            if hit * 2 >= n:
                px[x, y] = 0
    return img


def _ce_mark(width):
    """Znak CE wg oficjalnej geometrii (viewBox 280x200: pierscienie R=100/r=70)."""
    def inside(u, v):
        x, y = u * 280, v * 200
        for cx, right in ((100, 110), (270, 280)):
            d2 = (x - cx) ** 2 + (y - 100) ** 2
            if x <= right and 70 ** 2 <= d2 <= 100 ** 2:
                return True
        return 201.62 <= x <= 260 and 85 <= y <= 115
    return _supersampled(width, round(width * 200 / 280), inside)


def _weee_mark(width):
    """Przekreslony kosz na kolkach z belka (EN 50419), viewBox 40x44."""
    s = width / 40
    h = round(44 * s)
    img = Image.new("L", (width * 4, h * 4), 255)
    d = ImageDraw.Draw(img)
    k = 4 * s

    def P(x, y):
        return (x * k, y * k)
    d.line([P(8.2, 6.4), P(31.8, 6.4)], fill=0, width=round(2.4 * k))
    d.rectangle([P(17.4, 3.6), P(22.6, 6.0)], fill=0)
    d.line([P(10.2, 7.6), P(12.2, 29.6), P(27.8, 29.6), P(29.8, 7.6)], fill=0, width=round(2 * k), joint="curve")
    for cx in (14.6, 25.4):
        d.ellipse([P(cx - 2, 29.6), P(cx + 2, 33.6)], fill=0)
    d.line([P(4.8, 1.6), P(35.2, 34.4)], fill=0, width=round(2.2 * k))
    d.line([P(35.2, 1.6), P(4.8, 34.4)], fill=0, width=round(2.2 * k))
    d.rectangle([P(5.6, 38), P(34.4, 42)], fill=0)
    return img.resize((width, h), Image.LANCZOS).point(lambda p: 0 if p < 128 else 255, "1")


def _fit(d, text, names, size, max_w):
    f = _font(names, size)
    while size > 10 and d.textlength(text, font=f) > max_w:
        size -= 1
        f = _font(names, size)
    return f


def render_back_label(sn, w=LABEL_W, h=LABEL_H, lines=None):
    """Etykieta 50x30 mm na tyl kalkulatora; sn = numer seryjny (dowolny tekst)."""
    L = {**BACK_LINES, **(lines or {})}
    img = Image.new("1", (w, h), 1)
    d = ImageDraw.Draw(img)
    REG, BOLD = ["arial.ttf", "DejaVuSans.ttf"], ["arialbd.ttf", "DejaVuSans-Bold.ttf"]

    # lewa kolumna: CE + RoHS (srodek w pionie ~ y=170)
    ce = _ce_mark(104)
    cx0, cy0 = 12, 108
    img.paste(ce, (cx0, cy0))
    d.text((cx0 + 52, cy0 + ce.height + 30), "RoHS", font=_font(BOLD, 28), fill=0, anchor="mm")

    # prawa kolumna: WEEE
    weee = _weee_mark(84)
    img.paste(weee, (w - 12 - weee.width, 170 - weee.height // 2))

    # srodek: tekst (blok ~ y 28..318)
    x, maxw = 132, w - 12 - weee.width - 14 - 132
    y = 74
    d.text((x, y), L["model"], font=_fit(d, L["model"], BOLD, 42, maxw), fill=0, anchor="ls")
    y += 38
    d.text((x, y), "Manufacturer:", font=_font(REG, 23), fill=0, anchor="ls")
    y += 40
    d.text((x, y), L["maker"], font=_fit(d, L["maker"], BOLD, 34, maxw), fill=0, anchor="ls")
    fr = min((_fit(d, L[k], REG, 25, maxw) for k in ("address", "spec1", "spec2")), key=lambda f: f.size)
    y += 4
    for k in ("address", "spec1", "spec2"):
        y += 32
        d.text((x, y), L[k], font=fr, fill=0, anchor="ls")
    # SN w ramce
    y += 14
    fs = _font(BOLD, 28)
    txt = f"SN: {sn}"
    tw = d.textlength(txt, font=fs)
    d.rectangle([x, y, x + max(160, tw + 24), y + 42], outline=0, width=3)
    d.text((x + 12, y + 21), txt, font=fs, fill=0, anchor="lm")
    return img


def print_image_on(port, img, copies=1):
    """Drukuje ten sam obraz copies razy (osobne zadania na jednym polaczeniu)."""
    with _print_lock, NiimbotPrinter(port) as p:
        for _ in range(max(1, int(copies))):
            p.print_image(img)


# ----------------------------------------------------------------------
# Protokol Niimbot (B1 / B1 Pro) po porcie szeregowym
# ----------------------------------------------------------------------
_print_lock = threading.Lock()


class NiimbotError(RuntimeError):
    pass


def _pkt(cmd, data=b""):
    chk = cmd ^ len(data)
    for b in data:
        chk ^= b
    return b"\x55\x55" + bytes([cmd, len(data)]) + data + bytes([chk]) + b"\xaa\xaa"


class NiimbotPrinter:
    def __init__(self, port, baud=115200):
        import serial  # pyserial - jest w paczce flashera
        try:
            self.s = serial.Serial(port, baud, timeout=1, write_timeout=10)
        except serial.SerialException as e:
            msg = str(e)
            if "121" in msg or "semafor" in msg.lower() or "semaphore" in msg.lower():
                raise NiimbotError(f"Drukarka na {port} nie odpowiada - wlaczona i w zasiegu Bluetooth?") from e
            if "None, 52)" in msg:
                raise NiimbotError(f"Drukarka na {port} odrzucila polaczenie - polaczona z telefonem "
                                   "(aplikacja Niimbot) albo usypia; wylacz/wlacz ja i sprobuj ponownie") from e
            raise NiimbotError(f"Nie moge otworzyc {port}: {msg}") from e

    def close(self):
        try:
            self.s.close()
        except Exception:  # noqa: BLE001
            pass

    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()

    def _read(self, timeout=2.0):
        end = time.time() + timeout
        buf = b""
        while time.time() < end:
            n = self.s.in_waiting
            if n:
                buf += self.s.read(n)
                i = buf.find(b"\x55\x55")
                if i >= 0 and len(buf) >= i + 4:
                    ln = buf[i + 3]
                    if len(buf) >= i + 4 + ln + 3:
                        return buf[i + 2], buf[i + 4:i + 4 + ln]
            time.sleep(0.01)
        return None, b""

    def cmd(self, c, data=b"", timeout=2.0):
        self.s.reset_input_buffer()
        self.s.write(_pkt(c, data))
        self.s.flush()
        return self._read(timeout)

    def _expect_ok(self, name, c, data, wait=12.0):
        """Komenda musi dostac 01. Odpowiedz 00 = drukarka jeszcze zajeta
        (konczy poprzednia etykiete / po wybudzeniu / urwane zadanie) - wtedy
        zamknij ewentualne stare zadanie (F3) i ponawiaj do `wait` s."""
        end = time.time() + wait
        while True:
            rc, rd = self.cmd(c, data)
            if rc is not None and rd[:1] == b"\x01":
                return
            if time.time() > end:
                if rc is None:
                    raise NiimbotError(f"Brak odpowiedzi drukarki ({name})")
                raise NiimbotError(f"Drukarka odrzucila {name} (odp. {rc:#04x} {rd.hex()}) - "
                                   "zajeta, brak etykiet albo otwarta klapka?")
            self.cmd(0xF3, b"\x01", timeout=0.5)
            time.sleep(0.5)

    def info(self):
        out = {}
        for key, name in ((8, "device_type"), (10, "battery"), (11, "serial")):
            _, d = self.cmd(0x40, bytes([key]))
            out[name] = d.decode("ascii", "replace") if key == 11 else int.from_bytes(d or b"\0", "big")
        return out

    def print_image(self, img, density=3, timeout=30.0):
        img = img.convert("1")
        w, h = img.size
        if w % 8:
            raise ValueError("Szerokosc obrazu musi byc wielokrotnoscia 8")
        self._expect_ok("gestosc", 0x21, bytes([density]))
        self._expect_ok("typ etykiety", 0x23, b"\x01")
        self._expect_ok("start druku", 0x01, struct.pack(">H", 1) + b"\x00\x00\x00\x00\x00")
        try:
            self._expect_ok("start strony", 0x03, b"\x01")
            self._expect_ok("rozmiar strony", 0x13, struct.pack(">HHH", h, w, 1))
            px = img.load()
            for y in range(h):
                row = bytearray(w // 8)
                for x in range(w):
                    if px[x, y] == 0:
                        row[x // 8] |= 0x80 >> (x % 8)
                if any(row):
                    self.s.write(_pkt(0x85, struct.pack(">H3BB", y, 0, 0, 0, 1) + bytes(row)))
                else:
                    self.s.write(_pkt(0x84, struct.pack(">HB", y, 1)))
            self.s.flush()
            end = time.time() + 5
            while True:
                _, d = self.cmd(0xE3, b"\x01")
                if d[:1] == b"\x01":
                    break
                if time.time() > end:
                    raise NiimbotError("Drukarka nie przyjela strony")
                time.sleep(0.1)
            end = time.time() + timeout
            while True:
                rc, d = self.cmd(0xA3, b"\x01")
                if rc == 0xB3 and len(d) >= 2 and struct.unpack(">H", d[:2])[0] >= 1:
                    break
                if time.time() > end:
                    raise NiimbotError("Przekroczony czas druku (brak etykiet? otwarta klapka?)")
                time.sleep(0.2)
        finally:
            self.cmd(0xF3, b"\x01")


def print_id_label(port, device_id, fw_version=None):
    """Drukuje etykiete ID; rzuca NiimbotError/ValueError z czytelnym opisem."""
    img = render_id_label(device_id, fw_version)
    with _print_lock, NiimbotPrinter(port) as p:
        p.print_image(img)


def bluetooth_ports():
    """Porty COM po Bluetooth (kandydaci na Niimbot), np. ['COM29', 'COM30']."""
    from serial.tools import list_ports
    out = []
    for p in list_ports.comports():
        hwid = (p.hwid or "").upper()
        if "BTHENUM" in hwid or "bluetooth" in (p.description or "").lower():
            # Port przychodzacy Windows (adres 000000000000) to nie drukarka - na koniec
            out.append((1 if "&000000000000_" in hwid else 0, int(re.sub(r"\D", "", p.device) or 0), p.device))
    return [d for _, _, d in sorted(out)]


if __name__ == "__main__":
    if len(sys.argv) >= 4 and sys.argv[1] == "--png":
        render_id_label(sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else None).save(sys.argv[2])
        print("zapisano", sys.argv[2])
    elif len(sys.argv) >= 3:
        print_id_label(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
        print("wydrukowano")
    else:
        print(__doc__)
