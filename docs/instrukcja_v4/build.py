# -*- coding: utf-8 -*-
"""
KalkMate — instrukcja v4 (ulotka A4 poziomo, skladana harmonijkowo na 4 pola).

Jeden szablon + slownik tlumaczen (i18n.py) -> identyczne rysunki i uklad
we wszystkich jezykach.

Uzycie (z katalogu repo):
    python docs/instrukcja_v4/build.py            # HTML + PDF (wszystkie jezyki z i18n.LANGS:
                                                  #   pl en de fr cs sk lt be es pt it)
    python docs/instrukcja_v4/build.py --no-pdf   # tylko HTML
    python docs/instrukcja_v4/build.py pl de      # wybrane jezyki
    python docs/instrukcja_v4/build.py --no-cert  # bez kopii PL do certyfikacja/docs

Wyniki:
    docs/kalkmate_instrukcja_v4_<lang>.html / .pdf
    certyfikacja/docs/kalkmate_instrukcja_v4_pl.html / .pdf   (kopia PL)

PDF drukuje Edge headless; check_pdf.py sprawdza 2 strony, A4 poziomo oraz
czy tekst/rysunki nie wychodza poza pola i nie przechodza przez linie zgiecia.
"""
import html
import os
import random
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from i18n import TEXT, DEV, WEB, LANGS, DEV_SRC  # noqa: E402

REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
DOCS = os.path.join(REPO, "docs")
CERT_DOCS = os.path.join(REPO, "certyfikacja", "docs")
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

# ---------------------------------------------------------------- kolory
INK = "#111111"
ACC = "#D8FF3D"      # limonkowy akcent marki (website: #D8FF3D)
G1 = "#f0f0f0"
G2 = "#d2d2d2"
G3 = "#8f8f8f"
SCR = "#151515"      # OLED
MONO = "'IBM Plex Mono',Consolas,'Courier New',monospace"
SANS = "'IBM Plex Sans',Arial,Helvetica,sans-serif"


def esc(s):
    return html.escape(str(s), quote=True)


# =====================================================================
#  Prymitywy SVG
# =====================================================================
def T(x, y, s, size=8, weight=400, fill=INK, anchor="start", font=SANS, extra=""):
    return (f'<text x="{x:.2f}" y="{y:.2f}" font-size="{size:.2f}" font-weight="{weight}" '
            f'fill="{fill}" text-anchor="{anchor}" font-family="{font}" {extra}>{esc(s)}</text>')


def R(x, y, w, h, r=0, fill="none", stroke=INK, sw=1.0, extra=""):
    st = f'stroke="{stroke}" stroke-width="{sw}"' if stroke != "none" else 'stroke="none"'
    return (f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" rx="{r:.2f}" '
            f'fill="{fill}" {st} {extra}/>')


def L(x1, y1, x2, y2, sw=1.0, stroke=INK, dash=None, cap="round"):
    d = f'stroke-dasharray="{dash}"' if dash else ""
    return (f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="{stroke}" '
            f'stroke-width="{sw}" stroke-linecap="{cap}" {d}/>')


def C(cx, cy, r, fill="none", stroke=INK, sw=1.0):
    st = f'stroke="{stroke}" stroke-width="{sw}"' if stroke != "none" else 'stroke="none"'
    return f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r:.2f}" fill="{fill}" {st}/>'


def P(d, fill="none", stroke=INK, sw=1.0, extra=""):
    st = f'stroke="{stroke}" stroke-width="{sw}"' if stroke != "none" else 'stroke="none"'
    return f'<path d="{d}" fill="{fill}" {st} stroke-linejoin="round" stroke-linecap="round" {extra}/>'


def head(x, y, ang, size=5.0, fill=INK):
    """Grot strzalki w (x,y) skierowany pod katem ang (radiany)."""
    import math
    a1 = ang + math.radians(150)
    a2 = ang - math.radians(150)
    p1 = (x + size * math.cos(a1), y + size * math.sin(a1))
    p2 = (x + size * math.cos(a2), y + size * math.sin(a2))
    return f'<polygon points="{x:.2f},{y:.2f} {p1[0]:.2f},{p1[1]:.2f} {p2[0]:.2f},{p2[1]:.2f}" fill="{fill}"/>'


def A(x1, y1, x2, y2, sw=1.6, size=5.5, stroke=INK, dash=None):
    """Prosta strzalka."""
    import math
    ang = math.atan2(y2 - y1, x2 - x1)
    xe = x2 - (size * 0.6) * math.cos(ang)
    ye = y2 - (size * 0.6) * math.sin(ang)
    return L(x1, y1, xe, ye, sw, stroke, dash) + head(x2, y2, ang, size, stroke)


def AC(x1, y1, cx, cy, x2, y2, sw=1.6, size=5.5, stroke=INK, dash=None):
    """Strzalka po krzywej kwadratowej (kontrolny punkt cx,cy)."""
    import math
    ang = math.atan2(y2 - cy, x2 - cx)
    d = f'stroke-dasharray="{dash}"' if dash else ""
    xe = x2 - (size * 0.6) * math.cos(ang)
    ye = y2 - (size * 0.6) * math.sin(ang)
    return (f'<path d="M{x1:.2f},{y1:.2f} Q{cx:.2f},{cy:.2f} {xe:.2f},{ye:.2f}" fill="none" '
            f'stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round" {d}/>' + head(x2, y2, ang, size, stroke))


def tri(cx, cy, s, direction, fill=INK):
    """Maly trojkat-strzalka (up/down/left/right) o boku ~s."""
    h = s * 0.5
    if direction == "up":
        pts = [(cx, cy - h), (cx - h, cy + h * 0.7), (cx + h, cy + h * 0.7)]
    elif direction == "down":
        pts = [(cx, cy + h), (cx - h, cy - h * 0.7), (cx + h, cy - h * 0.7)]
    elif direction == "left":
        pts = [(cx - h, cy), (cx + h * 0.7, cy - h), (cx + h * 0.7, cy + h)]
    else:
        pts = [(cx + h, cy), (cx - h * 0.7, cy - h), (cx - h * 0.7, cy + h)]
    return '<polygon points="' + " ".join(f"{x:.2f},{y:.2f}" for x, y in pts) + f'" fill="{fill}"/>'


def fit(text, size, maxw, k=0.58):
    """Rozmiar fontu (<= size), przy ktorym tekst miesci sie w maxw (szac. k*em/znak)."""
    return min(size, maxw / max(1, len(text)) / k)


def svg(w, h, body, cls="art", extra=""):
    return (f'<svg class="{cls}" viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg" '
            f'role="img" {extra}>{body}</svg>')


# =====================================================================
#  Komponenty: kalkulator, OLED, klawisz, telefon, ikony
# =====================================================================
# Uklad klawiatury wg zdjecia urzadzenia (Esperanza T8809-2 + KalkMate):
#   rzad maly:  [suwak]  .  [√] [%] [MU]
#   MC  MR  M−  M+  ÷
#   ±   7   8   9   ×
#   ▶   4   5   6   −
#   C/CE 1  2   3   + (wysoki, 2 rzedy)
#   0   00  .   =
KEY_ROWS = [
    ["MC", "MR", "M-", "M+", "/"],
    ["+-", "7", "8", "9", "*"],
    [">", "4", "5", "6", "-"],
    ["CCE", "1", "2", "3", "+"],
    ["0", "00", ".", "=", None],
]
KEY_LABEL = {"M-": "M−", "/": "÷", "+-": "±", "*": "×", ">": "▶", "-": "−", "CCE": "C/CE",
             "sqrt": "√", "%": "%", "MU": "MU"}
DIGITS = {"0", "00", ".", "1", "2", "3", "4", "5", "6", "7", "8", "9"}


def calc_front(x, y, w, hl=None, screen=None, overlay=None, labels=True, wordmark=True):
    """Kalkulator od frontu. Zwraca (svg, pozycje_klawiszy{id:(cx,cy,kw,kh)}).

    hl:      {key_id: 'acc'|'ring'} — podswietlenie klawiszy
    screen:  funkcja(sx,sy,sw,sh)->svg rysujaca zawartosc wyswietlacza
    overlay: {key_id: 'up'|'down'|'left'|'right'|'OK'|tekst} — maly znak nad etykieta
    """
    hl = hl or {}
    overlay = overlay or {}
    u = w
    H = 1.36 * u
    o = []
    pos = {}
    # korpus
    o.append(R(x, y, w, H, r=0.06 * u, fill=G1, stroke=INK, sw=max(1.0, 0.012 * u)))
    # ramka gorna (czarna)
    bt = 0.40 * u
    r = 0.06 * u
    o.append(P(f"M{x},{y + bt} L{x},{y + r} Q{x},{y} {x + r},{y} L{x + w - r},{y} Q{x + w},{y} {x + w},{y + r} "
               f"L{x + w},{y + bt} Z", fill=INK, stroke=INK, sw=max(1.0, 0.012 * u)))
    if wordmark:
        o.append(T(x + 0.09 * u, y + 0.115 * u, "KalkMate", size=0.075 * u, weight=700, fill="#ffffff"))
    # wyswietlacz
    sx, sy, sw_, sh = x + 0.08 * u, y + 0.16 * u, 0.84 * u, 0.19 * u
    o.append(R(sx, sy, sw_, sh, r=0.015 * u, fill=SCR, stroke="#555555", sw=max(0.5, 0.006 * u)))
    if screen:
        o.append(screen(sx, sy, sw_, sh))
    # siatka klawiszy
    m = 0.06 * u
    kw = 0.15 * u
    pitch = (w - 2 * m - kw) / 4
    kh = 0.12 * u
    rp = 0.153 * u
    y0 = y + 0.565 * u
    fs = 0.075 * u

    def key(kid, cx_, top, kh_, small=False):
        kx = cx_ - kw / 2
        style = hl.get(kid)
        is_digit = kid in DIGITS
        fill = G2 if is_digit else INK
        tcol = INK if is_digit else "#ffffff"
        stw = max(0.6, 0.008 * u)
        if style == "acc":
            fill, tcol, stw = ACC, INK, max(1.2, 0.016 * u)
        o.append(R(kx, top, kw, kh_, r=(kh_ / 2 if small else 0.025 * u), fill=fill, stroke=INK, sw=stw))
        if style == "ring":
            o.append(R(kx - 0.02 * u, top - 0.02 * u, kw + 0.04 * u, kh_ + 0.04 * u, r=0.035 * u,
                       fill="none", stroke=INK, sw=max(1.2, 0.018 * u), extra='stroke-dasharray="3 2"'))
        cy_ = top + kh_ / 2
        if labels:
            lab = KEY_LABEL.get(kid, kid)
            f = fs * (0.62 if len(lab) >= 4 else (0.8 if len(lab) >= 2 else 1.0))
            if small:
                f = fs * 0.75
            ov = overlay.get(kid)
            ty = cy_ + f * 0.36
            if ov:
                ty = top + kh_ * 0.88
                f *= 0.78
            if kid == ">":
                o.append(tri(cx_, (ty - f * 0.36), f * 0.9, "right", tcol))
            else:
                o.append(T(cx_, ty, lab, size=f, weight=700, fill=tcol, anchor="middle"))
            if ov:
                oy = top + kh_ * 0.24 if kid != "+" else top + kh * 0.30
                ocol = INK if style == "acc" else ACC
                if ov in ("up", "down", "left", "right"):
                    o.append(tri(cx_, oy, kh * 0.28, ov, ocol))
                else:
                    o.append(T(cx_, oy + kh * 0.10, ov, size=kh * 0.27, weight=700, fill=ocol, anchor="middle"))
        pos[kid] = (cx_, cy_, kw, kh_)

    # maly rzad
    sr_top = y + 0.445 * u
    sr_h = 0.075 * u
    # suwak (oryginalny przelacznik kalkulatora — tylko ozdoba)
    cx0 = x + m + kw / 2
    o.append(R(cx0 - kw / 2, sr_top + 0.012 * u, kw * 1.2, sr_h * 0.7, r=sr_h * 0.35, fill=INK, stroke=INK, sw=0.5))
    for i, kid in [(2, "sqrt"), (3, "%"), (4, "MU")]:
        key(kid, x + m + kw / 2 + i * pitch, sr_top, sr_h, small=True)
    for ri, row in enumerate(KEY_ROWS):
        for ci, kid in enumerate(row):
            if kid is None:
                continue
            cx_ = x + m + kw / 2 + ci * pitch
            top = y0 + ri * rp
            if kid == "+":
                key(kid, cx_, top, kh + rp, False)
            else:
                key(kid, cx_, top, kh, False)
    return "".join(o), pos


# Ikony 8x8 z firmware (XBM, bit 0 = lewy piksel): main.cpp _MENU_ICO_*, settings_screen.h _SET_ICO_*.
ICO = {
    "camera":  (0x1C, 0xFF, 0x99, 0xA5, 0xA5, 0x99, 0xFF, 0x00),
    "notes":   (0x7E, 0x42, 0x5A, 0x42, 0x5A, 0x42, 0x7E, 0x00),
    "test":    (0x00, 0xC0, 0xE0, 0x70, 0x3B, 0x1F, 0x0E, 0x04),
    "gear":    (0x18, 0x7E, 0x66, 0xC3, 0xC3, 0x66, 0x7E, 0x18),
    "display": (0xFF, 0x81, 0x81, 0x81, 0xFF, 0x18, 0x3C, 0x00),
    "globe":   (0x3C, 0x5A, 0x99, 0xFF, 0x99, 0x5A, 0x3C, 0x00),
    "wifi":    (0x7E, 0x81, 0x3C, 0x42, 0x18, 0x24, 0x00, 0x18),
    "lock":    (0x3C, 0x42, 0x42, 0xFF, 0xE7, 0xE7, 0xFF, 0x00),
    "battery": (0x00, 0x7F, 0x41, 0xDD, 0xDD, 0x41, 0x7F, 0x00),
    "info":    (0x3C, 0x66, 0xFF, 0xE7, 0xE7, 0xE7, 0x7E, 0x3C),
    "pulse":   (0x00, 0x08, 0x14, 0x14, 0xD3, 0x20, 0x00, 0x00),
}
# Menu glowne (fw 2.0.5+): Rozwiaz zadanie, Notatki, Sprawdzian, Ustawienia — ikony jak w main.cpp _MENU_ICONS.
MENU_ICONS = ("camera", "notes", "test", "gear")


def xbm(x, y, size, name, fill="#ffffff"):
    """Ikona 8x8 z firmware jako jedna sciezka z pikseli (size = bok ikony)."""
    px = size / 8
    d = []
    for r, byte in enumerate(ICO[name]):
        c = 0
        while c < 8:
            if byte >> c & 1:
                c0 = c
                while c < 8 and byte >> c & 1:
                    c += 1
                d.append(f"M{x + c0 * px:.2f},{y + r * px:.2f}h{(c - c0) * px:.2f}v{px:.2f}h{-(c - c0) * px:.2f}z")
            else:
                c += 1
    return f'<path d="{"".join(d)}" fill="{fill}" stroke="none"/>' if d else ""


def oled_status(xr, cy, fs, pct="85%"):
    """Pasek stanu menu glownego (main.cpp _menuDrawStatus): WiFi + procent + bateria, do prawej krawedzi xr."""
    bw, bh = fs * 1.45, fs * 0.72
    bx, by = xr - bw - fs * 0.18, cy - bh * 0.95
    o = [R(bx, by, bw, bh, fill="none", stroke="#ffffff", sw=0.55),
         R(bx + bw, by + bh * 0.28, fs * 0.18, bh * 0.44, fill="#ffffff", stroke="none"),
         R(bx + fs * 0.17, by + fs * 0.17, (bw - fs * 0.34) * 0.85, bh - fs * 0.34, fill="#ffffff", stroke="none")]
    ts = fs * 0.78
    tx = bx - fs * 0.3
    o.append(T(tx, cy - fs * 0.05, pct, size=ts, fill="#ffffff", anchor="end", font=MONO))
    isz = fs * 0.8
    o.append(xbm(tx - len(pct) * ts * 0.6 - fs * 0.45 - isz, cy - isz * 0.98, isz, "wifi"))
    return "".join(o)


def oled(x, y, w, h, rows=None, title=None, big=None, foot=None, fs=None, sel=None, big_align="middle", big_fs=None,
         title_r=None, chev=False, icons=None, status=False):
    """Ekran OLED (czarny) z napisami jak na urzadzeniu.
    rows: lista tekstow; sel: indeks wiersza zaznaczonego (inwersja).
    title_r: napis z prawej w naglowku (licznik "4/9"); chev: ">" na koncu wierszy.
    icons: nazwy ikon ICO per wiersz (jak na liscie menu/Ustawien); status: WiFi + bateria w naglowku."""
    o = [R(x, y, w, h, r=2.5, fill=SCR, stroke=INK, sw=1.2)]
    pad = 4
    if big is not None:
        bs = big_fs or h * 0.62
        if big_align == "end":
            o.append(T(x + w - pad - 2, y + h / 2 + bs * 0.36, big, size=bs, weight=600, fill="#ffffff",
                       anchor="end", font=MONO))
        else:
            o.append(T(x + w / 2, y + h / 2 + bs * 0.36, big, size=bs, weight=700, fill="#ffffff",
                       anchor="middle", font=MONO))
        return "".join(o)
    fs = fs or 6.6
    lh = fs * 1.45
    cy = y + pad + fs * 0.95
    if title:
        o.append(T(x + pad, cy, title, size=fs * 0.95, fill="#ffffff", font=MONO))
        if title_r:
            o.append(T(x + w - pad, cy - fs * 0.05, title_r, size=fs * 0.8, fill="#ffffff", anchor="end", font=MONO))
        if status:
            o.append(oled_status(x + w - pad, cy, fs))
        o.append(L(x + 1.5, cy + fs * 0.42, x + w - 1.5, cy + fs * 0.42, sw=0.6, stroke="#ffffff"))
        cy += lh + 1.5
    isz = fs * 0.78
    for i, rtxt in enumerate(rows or []):
        col = SCR if sel == i else "#ffffff"
        tx = x + pad
        if sel == i:
            o.append(R(x + 2, cy - fs * 1.0, w - 4, fs * 1.32, r=0.8, fill="#ffffff", stroke="none"))
        if icons and i < len(icons) and icons[i]:
            o.append(xbm(x + pad, cy - isz * 0.97, isz, icons[i], fill=col))
            tx += isz + fs * 0.55
        if sel == i:
            o.append(T(tx, cy, rtxt, size=fs, weight=700, fill=SCR, font=MONO))
        else:
            o.append(T(tx, cy, rtxt, size=fs, fill="#ffffff", font=MONO))
        if chev:
            o.append(T(x + w - pad, cy, ">", size=fs, weight=700 if sel == i else 400,
                       fill=SCR if sel == i else "#ffffff", anchor="end", font=MONO))
        cy += lh
    if foot:
        o.append(T(x + pad, y + h - pad + 0.5, foot, size=fs * 0.82, fill="#cfcfcf", font=MONO))
    return "".join(o)


def keychip(cx, cy, label, acc=False, w=None, h=15, sym=None, fs=None):
    """Pojedynczy klawisz (chip) do rysunkow. sym: up/down/left/right nad etykieta."""
    w = w or max(16, 6.2 * len(label) + 8)
    fill, tcol = (ACC, INK) if acc else (INK, "#ffffff")
    o = [R(cx - w / 2, cy - h / 2, w, h, r=2.5, fill=fill, stroke=INK, sw=1.3 if acc else 1.0)]
    fs = fs or (h * 0.55 if len(label) < 3 else h * 0.45)
    if sym:
        o.append(tri(cx - w / 2 + 6.5, cy, h * 0.42, sym, tcol))
        o.append(T(cx + 3.5, cy + fs * 0.36, label, size=fs, weight=700, fill=tcol, anchor="middle"))
    else:
        o.append(T(cx, cy + fs * 0.36, label, size=fs, weight=700, fill=tcol, anchor="middle"))
    return "".join(o)


def fake_qr(x, y, s, n=21, seed=7, on="#ffffff", off=None):
    """Dekoracyjny (nieskanowalny) wzor QR — tylko ilustracja ekranu."""
    rnd = random.Random(seed)
    c = s / n
    o = []
    if off:
        o.append(R(x, y, s, s, fill=off, stroke="none"))

    def finder(fx, fy):
        o.append(R(x + fx * c, y + fy * c, 7 * c, 7 * c, fill=on, stroke="none"))
        o.append(R(x + (fx + 1) * c, y + (fy + 1) * c, 5 * c, 5 * c, fill=off or SCR, stroke="none"))
        o.append(R(x + (fx + 2) * c, y + (fy + 2) * c, 3 * c, 3 * c, fill=on, stroke="none"))
    for i in range(n):
        for j in range(n):
            inf = (i < 8 and j < 8) or (i < 8 and j >= n - 8) or (i >= n - 8 and j < 8)
            if inf:
                continue
            if rnd.random() < 0.48:
                o.append(R(x + j * c, y + i * c, c + 0.05, c + 0.05, fill=on, stroke="none"))
    finder(0, 0)
    finder(n - 7, 0)
    finder(0, n - 7)
    return "".join(o)


def real_qr(x, y, s, data, fg=INK):
    """Prawdziwy, skanowalny QR (biblioteka qrcode)."""
    import qrcode
    q = qrcode.QRCode(border=0, error_correction=qrcode.constants.ERROR_CORRECT_M)
    q.add_data(data)
    q.make(fit=True)
    mtx = q.get_matrix()
    n = len(mtx)
    c = s / n
    o = [R(x - c * 1.5, y - c * 1.5, s + 3 * c, s + 3 * c, fill="#ffffff", stroke="none")]
    d = []
    for i, row in enumerate(mtx):
        for j, v in enumerate(row):
            if v:
                d.append(f"M{x + j * c:.3f},{y + i * c:.3f}h{c + 0.02:.3f}v{c + 0.02:.3f}h-{c + 0.02:.3f}z")
    o.append(f'<path d="{"".join(d)}" fill="{fg}"/>')
    return "".join(o)


def phone(x, y, w, h):
    """Obrys telefonu; zwraca (svg, (sx,sy,sw,sh) ekranu)."""
    o = [R(x, y, w, h, r=7, fill="#ffffff", stroke=INK, sw=1.6)]
    o.append(R(x + w / 2 - 8, y + 3.5, 16, 3, r=1.5, fill=INK, stroke="none"))
    sx, sy, sw_, sh = x + 4, y + 10, w - 8, h - 16
    o.append(R(sx, sy, sw_, sh, r=2, fill="#ffffff", stroke=G3, sw=0.6))
    return "".join(o), (sx, sy, sw_, sh)


def url_bar(x, y, w, text, fs=5.6):
    return (R(x, y, w, fs * 2.0, r=fs, fill=G1, stroke=G3, sw=0.5) +
            T(x + fs * 0.9, y + fs * 1.38, text, size=fs, weight=600, fill=INK, font=MONO))


def wifi_icon(cx, cy, r, acc=True):
    o = []
    for k, rr in enumerate([r, r * 0.68, r * 0.36]):
        o.append(P(f"M{cx - rr * 0.78:.2f},{cy - rr * 0.62:.2f} A{rr:.2f},{rr:.2f} 0 0 1 {cx + rr * 0.78:.2f},{cy - rr * 0.62:.2f}",
                   stroke=INK, sw=r * 0.16))
    o.append(C(cx, cy - r * 0.06, r * 0.11, fill=INK, stroke="none"))
    if acc:
        o.insert(0, C(cx, cy - r * 0.45, r * 0.95, fill=ACC, stroke="none"))
    return "".join(o)


def battery(x, y, w, h, frac=0.6, bolt=True):
    o = [R(x, y, w, h, r=2.5, fill="#ffffff", stroke=INK, sw=1.5),
         R(x + w, y + h * 0.3, w * 0.07, h * 0.4, r=1, fill=INK, stroke="none"),
         R(x + 2.5, y + 2.5, (w - 5) * frac, h - 5, r=1.2, fill=ACC, stroke=INK, sw=0.6)]
    if bolt:
        cx, cy = x + w / 2, y + h / 2
        s = h * 0.36
        o.append(P(f"M{cx + s * 0.25},{cy - s * 1.1} L{cx - s * 0.55},{cy + s * 0.15} L{cx},{cy + s * 0.15} "
                   f"L{cx - s * 0.25},{cy + s * 1.1} L{cx + s * 0.55},{cy - s * 0.15} L{cx},{cy - s * 0.15} Z",
                   fill=INK, stroke="none"))
    return "".join(o)


def clock(cx, cy, r, label=None):
    o = [C(cx, cy, r, fill="#ffffff", stroke=INK, sw=1.3),
         L(cx, cy, cx, cy - r * 0.62, sw=1.3), L(cx, cy, cx + r * 0.45, cy + r * 0.2, sw=1.3)]
    if label:
        o.append(T(cx + r + 3, cy + 3, label, size=8.5, weight=700))
    return "".join(o)


def weee(x, y, s):
    """Przekreslony kosz na kolkach (symbol WEEE) z belka."""
    o = []
    bw = s * 0.62
    bx = x + (s - bw) / 2
    top = y + s * 0.16
    o.append(L(bx - s * 0.05, top, bx + bw + s * 0.05, top, sw=s * 0.06, cap="butt"))
    o.append(R(bx + bw * 0.38, top - s * 0.07, bw * 0.24, s * 0.06, fill=INK, stroke="none"))
    o.append(P(f"M{bx},{top + s * 0.03} L{bx + bw * 0.08},{y + s * 0.74} L{bx + bw * 0.92},{y + s * 0.74} L{bx + bw},{top + s * 0.03}",
               stroke=INK, sw=s * 0.05))
    o.append(C(bx + bw * 0.22, y + s * 0.79, s * 0.05, fill=INK, stroke="none"))
    o.append(C(bx + bw * 0.78, y + s * 0.79, s * 0.05, fill=INK, stroke="none"))
    o.append(L(x + s * 0.12, y + s * 0.04, x + s * 0.88, y + s * 0.86, sw=s * 0.055, cap="butt"))
    o.append(L(x + s * 0.88, y + s * 0.04, x + s * 0.12, y + s * 0.86, sw=s * 0.055, cap="butt"))
    o.append(R(x + s * 0.14, y + s * 0.9, s * 0.72, s * 0.1, fill=INK, stroke="none"))
    return "".join(o)


def ce_mark(x, y, h):
    """Oficjalny znak CE (geometria z Conformite_Europeenne_(logo).svg,
    Wikimedia Commons, viewBox 280x200) przeskalowany do wysokosci h."""
    k = h / 200.0
    c = ("M110,199.498744A100,100 0 0 1 100,200A100,100 0 0 1 100,0A100,100 0 0 1 110,0.501256"
         "L110,30.501256A70,70 0 0 0 100,30A70,70 0 0 0 100,170A70,70 0 0 0 110,169.498744Z")
    e = ("M280,199.498744A100,100 0 0 1 270,200A100,100 0 0 1 270,0A100,100 0 0 1 280,0.501256"
         "L280,30.501256A70,70 0 0 0 270,30A70,70 0 0 0 201.620283,85L260,85L260,115L201.620283,115"
         "A70,70 0 0 0 270,170A70,70 0 0 0 280,169.498744Z")
    return (f'<g transform="translate({x:.2f},{y:.2f}) scale({k:.5f})">'
            f'<path d="{c}" fill="{INK}"/><path d="{e}" fill="{INK}"/></g>')


def warn_tri(cx, cy, s):
    h = s * 0.87
    o = [P(f"M{cx},{cy - h / 2} L{cx + s / 2},{cy + h / 2} L{cx - s / 2},{cy + h / 2} Z", fill=ACC, stroke=INK, sw=s * 0.08),
         L(cx, cy - h * 0.14, cx, cy + h * 0.18, sw=s * 0.1, cap="round"),
         C(cx, cy + h * 0.33, s * 0.055, fill=INK, stroke="none")]
    return "".join(o)


# ---------------------------------------------------------------- ikony 40x40 (sekcja "Wiecej")
def icon_text():
    o = [R(3, 9, 34, 22, r=3, fill="#ffffff", stroke=INK, sw=1.6)]
    for r_ in range(2):
        for c_ in range(5):
            o.append(R(6.5 + c_ * 6, 12.5 + r_ * 6, 4.4, 4.2, r=0.8, fill=INK if (r_, c_) != (0, 2) else ACC,
                       stroke=INK, sw=0.5))
    o.append(R(12.5, 24.5, 15, 3.6, r=0.8, fill=INK, stroke="none"))
    return "".join(o)


def icon_history():
    return (C(20, 20, 13, fill=ACC, stroke=INK, sw=1.6) +
            L(20, 20, 20, 12, sw=1.8) + L(20, 20, 26, 23, sw=1.8) +
            P("M7,8 L7.5,14 L13,13", stroke=INK, sw=1.6))


def icon_offline():
    o = [P("M9,25 Q3,25 4,19 Q5,14 11,15 Q13,8 21,9 Q28,10 29,16 Q36,16 35,22 Q34,26 29,25 Z",
           fill="#ffffff", stroke=INK, sw=1.6),
         L(6, 33, 34, 6, sw=1.8)]
    for i in range(3):
        o.append(R(9 + i * 8, 30, 6, 6, r=1, fill=ACC if i == 0 else "#ffffff", stroke=INK, sw=1.1))
    return "".join(o)


def icon_code():
    o = [R(3, 11, 34, 18, r=3, fill=SCR, stroke=INK, sw=1.4)]
    for i, d in enumerate("1111"):
        o.append(T(9 + i * 7.5, 24.5, d, size=11, weight=700, fill="#ffffff", font=MONO, anchor="middle"))
    o.append(R(3 + 1 * 7.5 + 2.6, 26, 6, 1.6, fill=ACC, stroke="none"))
    return "".join(o)


def icon_update():
    return (P("M31,14 A12,12 0 1 0 32,24", stroke=INK, sw=1.8) +
            head(31.5, 13.5, -1.0, 6) +
            C(20, 20, 6.5, fill=ACC, stroke=INK, sw=1.2) +
            L(20, 16.5, 20, 23, sw=1.5) + head(20, 24, 1.5708, 4.5))


def icon_battery():
    return battery(3, 12, 30, 16, frac=0.55, bolt=True)


def icon_lang():
    o = [C(20, 20, 14, fill="#ffffff", stroke=INK, sw=1.5),
         P("M20,6 Q11,20 20,34 Q29,20 20,6", stroke=INK, sw=1.1),
         L(6, 20, 34, 20, sw=1.1), P("M8,13 Q20,16 32,13", stroke=INK, sw=1.0),
         P("M8,27 Q20,24 32,27", stroke=INK, sw=1.0),
         R(22, 22, 17, 13, r=2, fill=ACC, stroke=INK, sw=1.1),
         T(30.5, 31.5, "EN", size=7, weight=700, anchor="middle")]
    return "".join(o)


def icon_reset():
    return (R(1, 5, 24, 17, r=3, fill=INK, stroke=INK, sw=1) +
            T(13, 16.6, "C/CE", size=6.8, weight=700, fill="#ffffff", anchor="middle") +
            C(29, 29, 9.5, fill=ACC, stroke=INK, sw=1.4) +
            T(29, 32.3, "5s", size=8.5, weight=700, anchor="middle"))


# =====================================================================
#  Rysunki krokow (viewBox 240 x h)
# =====================================================================
def art_charge(t, d):
    o = []
    cs, _ = calc_front(4, 10, 112, screen=None, labels=False)
    o.append(cs)
    # wtyczka USB-C przy krawedzi
    o.append(R(116, 38, 16, 12, r=2.5, fill=G2, stroke=INK, sw=1.3))
    o.append(R(132, 40, 11, 8, r=2, fill=INK, stroke=INK, sw=0.8))
    o.append(P("M143,44 C182,44 170,120 194,120", stroke=INK, sw=2.8))
    o.append(T(146, 32, t["lbl_usb"], size=11, weight=700))
    # ladowarka
    o.append(R(186, 100, 40, 44, r=6, fill="#ffffff", stroke=INK, sw=1.7))
    o.append(L(226, 112, 236, 112, sw=2.8, cap="butt"))
    o.append(L(226, 132, 236, 132, sw=2.8, cap="butt"))
    o.append(T(206, 127, t["lbl_5v"], size=12, weight=700, anchor="middle"))
    # bateria + czas
    o.append(battery(128, 158, 52, 26, frac=0.62))
    o.append(clock(201, 171, 9))
    o.append(T(213, 175, t["lbl_2h"], size=9.5, weight=700))
    return svg(240, 190, "".join(o))


def art_power(t, d):
    o = []
    # bok urzadzenia z suwakiem (zblizenie)
    o.append(R(4, 18, 150, 42, r=10, fill=G1, stroke=INK, sw=1.7))
    o.append(R(36, 29, 70, 20, r=10, fill=INK, stroke=INK, sw=1))
    o.append(R(80, 25, 28, 28, r=5, fill=ACC, stroke=INK, sw=1.6))
    o.append(T(44, 12, t["lbl_off"], size=9, weight=600, fill=G3))
    o.append(T(94, 12, t["lbl_on"], size=11, weight=700, anchor="middle"))
    o.append(A(40, 74, 104, 74, sw=2.2, size=7))
    # kalkulator z "0"
    scr = lambda sx, sy, sw_, sh: T(sx + sw_ - 5, sy + sh * 0.82, "0", size=sh * 0.8, weight=600,
                                     fill="#ffffff", anchor="end", font=MONO)
    cs, _ = calc_front(18, 90, 74, screen=scr, labels=False)
    o.append(cs)
    # ekran startowy -> kalkulator
    o.append(oled(166, 92, 70, 30, big="KalkMate", big_fs=11.5))
    o.append(A(201, 126, 201, 140, sw=1.6))
    o.append(oled(166, 144, 70, 30, big="0", big_align="end"))
    o.append(AC(158, 39, 201, 39, 201, 88, sw=1.6))
    return svg(240, 194, "".join(o))


def art_code(t, d):
    o = []
    scr = lambda sx, sy, sw_, sh: T(sx + sw_ - 4, sy + sh * 0.8, "1111", size=sh * 0.74, weight=600,
                                     fill="#ffffff", anchor="end", font=MONO)
    cs, pos = calc_front(2, 6, 118, hl={"1": "acc"}, screen=scr)
    o.append(cs)
    # AI -> menu
    o.append(A(122, 34, 132, 34, sw=1.6))
    o.append(oled(134, 14, 102, 42, big="AI"))
    o.append(A(185, 60, 185, 72, sw=1.6))
    # menu glowne fw 2.0.5+: 4 pozycje z ikonami, w naglowku WiFi + bateria
    o.append(oled(134, 76, 102, 54, rows=[d["m1"], d["m2"], d["m3"], d["m4"]], title=d["menu_title"], sel=0,
                  fs=5.9, icons=MENU_ICONS, status=True, chev=True))
    # sekwencja klawiszy
    for i in range(4):
        o.append(keychip(147 + i * 25.5, 160, "1", True, w=21, h=20))
    return svg(240, 176, "".join(o))


def art_wifi(t, d):
    # menu glowne (Ustawienia = 4. pozycja) -> Ustawienia (9 kategorii z ikonami, "WiFi i konto" = 4/9)
    # -> podmenu -> lista sieci
    set_title = d["m4"]
    o = []
    o.append(oled(4, 2, 150, 26, rows=[d["m4"]], title=d["menu_title"], sel=0, fs=6.4,
                  icons=[MENU_ICONS[3]], status=True, chev=True))
    o.append(A(79, 30, 79, 38, sw=1.4, size=4.6))
    o.append(oled(4, 41, 150, 36, rows=[d["cat_lang"], d["cat_net"]], title=set_title, title_r="4/9",
                  sel=1, fs=6.4, chev=True, icons=["globe", "wifi"]))
    o.append(A(79, 79, 79, 87, sw=1.4, size=4.6))
    o.append(oled(4, 90, 150, 36, rows=[d["it_wifi"], d["it_acct"]], title="< " + d["cat_net"], title_r="1/4",
                  sel=0, fs=6.4, chev=True))
    o.append(A(79, 128, 79, 136, sw=1.4, size=4.6))
    o.append(oled(4, 139, 150, 36, rows=[t["ssid1"], t["ssid2"]], title=d["wifi_pick"], sel=0, fs=6.4))
    for i in range(3):
        o.append(R(136 + i * 4.5, 158 - i * 1.7, 2.8, 2.5 + i * 1.7, fill=SCR, stroke="none"))
    o.append(wifi_icon(200, 46, 32))
    o.append(R(178, 56, 44, 13, r=3, fill="#ffffff", stroke=INK, sw=1.5))
    o.append(C(186, 62.5, 1.7, fill=INK, stroke="none"))
    o.append(C(192, 62.5, 1.7, fill=INK, stroke="none"))
    o.append(T(200, 84, "2.4 GHz" if t["html_lang"] == "en" else "2,4 GHz", size=9.5,
               weight=700, anchor="middle"))
    # klawisze nawigacji
    o.append(tri(180, 106, 6.5, "up"))
    o.append(keychip(180, 120, "8", True, w=20, h=17))
    o.append(keychip(180, 143, "2", True, w=20, h=17))
    o.append(tri(180, 157, 6.5, "down"))
    o.append(keychip(216, 131, "OK", False, w=28, h=19))
    o.append(T(216, 151, "5 / =", size=7.5, weight=600, anchor="middle", fill=G3))
    return svg(240, 176, "".join(o))


def art_pair(t, d, w):
    o = []
    # ekran Device ID + QR
    o.append(T(4, 12, d["set_dev"], size=8.5, weight=700, font=MONO))
    ox, oy, ow, oh = 4, 18, 150, 76
    o.append(R(ox, oy, ow, oh, r=2.5, fill=SCR, stroke=INK, sw=1.2))
    o.append(T(ox + 5, oy + 13, "Device ID:", size=6.6, fill="#ffffff", font=MONO))
    o.append(T(ox + 5, oy + 26, "3C84A1F0B2E4", size=7.6, weight=700, fill="#ffffff", font=MONO))
    o.append(T(ox + 5, oy + 44, d["qr_hint1"], size=6.4, fill="#ffffff", font=MONO))
    o.append(T(ox + 5, oy + 54, d["qr_hint2"], size=6.4, fill="#ffffff", font=MONO))
    o.append(fake_qr(ox + ow - 58, oy + 9, 54, n=25, seed=3, on="#ffffff", off=SCR))
    # konto na kalkmate.pl
    hx, hy = 22, 136
    o.append(C(hx, hy - 9, 7, fill=ACC, stroke=INK, sw=1.4))
    o.append(P(f"M{hx - 12},{hy + 13} Q{hx - 12},{hy} {hx},{hy} Q{hx + 12},{hy} {hx + 12},{hy + 13} Z",
               fill=ACC, stroke=INK, sw=1.4))
    o.append(R(42, 122, 92, 20, r=10, fill="#ffffff", stroke=INK, sw=1.4))
    o.append(T(88, 136, "kalkmate.pl", size=9.5, weight=700, anchor="middle"))
    o.append(R(42, 148, 92, 18, r=9, fill=ACC, stroke=INK, sw=1.2))
    o.append(T(88, 160.5, t["lbl_signup"], size=9, weight=700, anchor="middle"))
    # telefon
    ps, (sx, sy, sw_, sh) = phone(166, 4, 70, 178)
    o.append(ps)
    o.append(url_bar(sx + 2, sy + 3, sw_ - 4, "kalkmate.pl/claim", fs=4.6))
    words = w["claim_h"].split(" ")
    l1, l2 = (" ".join(words[:-1]), words[-1]) if len(words) >= 2 else (w["claim_h"], "")
    hs = fit(max(l1, l2, key=len), 8.4, sw_ - 6, k=0.6)
    o.append(T(sx + 3, sy + 30, l1, size=hs, weight=700))
    if l2:
        o.append(T(sx + 3, sy + 41, l2, size=hs, weight=700))
    o.append(T(sx + 3, sy + 60, w["claim_code"], size=fit(w["claim_code"], 4.9, sw_ - 6, k=0.54), fill="#444444"))
    o.append(R(sx + 3, sy + 64, sw_ - 6, 18, r=2, fill="#ffffff", stroke=INK, sw=1.2))
    o.append(T(sx + sw_ / 2, sy + 77, "1 1 1 1", size=10, weight=700, anchor="middle", font=MONO))
    o.append(R(sx + 3, sy + 90, sw_ - 6, 18, r=2, fill=ACC, stroke=INK, sw=1.2))
    o.append(T(sx + sw_ / 2, sy + 102.5, w["claim_btn"], size=fit(w["claim_btn"], 7, sw_ - 12, k=0.6),
               weight=700, anchor="middle"))
    o.append(P(f"M{sx + sw_ / 2 - 12},{sy + 132} l8,8 l16,-17", stroke=INK, sw=2.8))
    # skanowanie
    o.append(L(168, 26, 154, 27, sw=1.2, dash="3 2"))
    o.append(L(168, 26, 154, 90, sw=1.2, dash="3 2"))
    o.append(T(150, 112, t["lbl_scan"], size=8.5, weight=700, anchor="end"))
    o.append(A(138, 132, 160, 132, sw=1.6))
    return svg(240, 186, "".join(o))


def art_box(t, d, w):
    o = []
    # karta z kodem wysunieta z pudelka
    o.append(f'<g transform="rotate(-7 62 50)">'
             + R(14, 24, 96, 56, r=3, fill="#ffffff", stroke=INK, sw=1.5)
             + T(21, 39, t["lbl_box_code"], size=fit(t["lbl_box_code"], 7, 82, k=0.66), weight=700, fill=G3)
             + T(62, 60, "XXXX-XXXX", size=12, weight=700, anchor="middle", font=MONO)
             + R(21, 66, 82, 2.6, fill=ACC, stroke="none") + "</g>")
    o.append(P("M4,74 L114,74 L114,150 L4,150 Z", fill=G1, stroke=INK, sw=1.7))
    o.append(P("M4,74 L18,60 L128,60 L114,74", fill="#ffffff", stroke=INK, sw=1.5))
    o.append(P("M114,74 L128,60 L128,136 L114,150", fill=G2, stroke=INK, sw=1.5))
    o.append(T(59, 118, "KalkMate", size=15, weight=700, anchor="middle"))
    o.append(A(131, 96, 141, 96, sw=1.6))
    # okno panelu
    bx, by, bw, bh = 143, 4, 93, 140
    o.append(R(bx, by, bw, bh, r=4, fill="#ffffff", stroke=INK, sw=1.6))
    o.append(url_bar(bx + 4, by + 4, bw - 8, "kalkmate.pl/panel", fs=5.3))
    o.append(T(bx + 6, by + 30, w["tab_calc"], size=fit(w["tab_calc"], 6.6, bw - 40, k=0.56), fill="#555555"))
    tw = 22
    o.append(R(bx + bw - tw - 5, by + 21, tw, 13, r=2, fill=ACC, stroke=INK, sw=1.2))
    o.append(T(bx + bw - tw / 2 - 5, by + 30.5, w["tab_ai"], size=7.6, weight=700, anchor="middle"))
    o.append(L(bx + 4, by + 38, bx + bw - 4, by + 38, sw=0.6, stroke=G3))
    o.append(R(bx + 6, by + 50, bw - 12, 19, r=2, fill="#ffffff", stroke=INK, sw=1.2))
    o.append(T(bx + bw / 2, by + 63, "XXXX-XXXX", size=9, weight=700, anchor="middle", font=MONO))
    o.append(R(bx + 6, by + 76, bw - 12, 19, r=2, fill=INK, stroke=INK, sw=1))
    o.append(T(bx + bw / 2, by + 89, w["redeem"], size=fit(w["redeem"], 7.8, bw - 18, k=0.6), weight=700,
               fill="#ffffff", anchor="middle"))
    o.append(P(f"M{bx + bw / 2 - 12},{by + 112} l8,8 l16,-17", stroke=INK, sw=2.8))
    # odznaka tokenow
    o.append(R(60, 158, 176, 24, r=12, fill=ACC, stroke=INK, sw=1.5))
    o.append(T(148, 174.5, t["lbl_tokens"], size=fit(t["lbl_tokens"], 11, 160, k=0.6), weight=700, anchor="middle"))
    o.append(A(190, 148, 190, 156, sw=1.4, size=4.5))
    return svg(240, 186, "".join(o))


def art_photo(t, d):
    o = []
    # kartka z zadaniem
    o.append(P("M14,140 L120,140 L134,188 L0,188 Z", fill="#ffffff", stroke=INK, sw=1.4))
    o.append(T(67, 168, "2x² + 3x − 5 = 0", size=11.5, weight=600, anchor="middle"))
    o.append(L(26, 178, 108, 178, sw=0.8, stroke=G3))
    # kalkulator od tylu
    o.append(R(22, 4, 90, 112, r=8, fill=INK, stroke=INK, sw=1))
    o.append(R(30, 26, 74, 84, r=5, fill="#2a2a2a", stroke="#555555", sw=0.8))
    o.append(C(33, 11, 2, fill="#444444", stroke="none"))
    o.append(C(101, 11, 2, fill="#444444", stroke="none"))
    o.append(R(50, 76, 34, 22, r=1.5, fill="#3a3a3a", stroke="#666666", sw=0.6))
    o.append(C(67, 87, 6, fill="#000000", stroke=ACC, sw=2.8))
    # pole widzenia
    o.append(L(62, 93, 18, 142, sw=1.1, dash="3 2"))
    o.append(L(72, 93, 118, 142, sw=1.1, dash="3 2"))
    # podpis kamery
    o.append(L(74, 87, 118, 70, sw=1.1))
    cw = max(48, len(t["lbl_camera"]) * 8.4 * 0.6 + 12)
    o.append(R(112, 60, cw, 17, r=8.5, fill=ACC, stroke=INK, sw=1.2))
    o.append(T(112 + cw / 2, 72, t["lbl_camera"], size=8.4, weight=700, anchor="middle"))
    # OK
    o.append(keychip(206, 22, "OK", True, w=34, h=22))
    o.append(T(206, 44, "5 / =", size=7.5, weight=600, anchor="middle", fill=G3))
    o.append(A(206, 48, 206, 84, sw=1.5, size=5))
    # podglad na ekranie
    px, py, pw, ph = 138, 88, 98, 72
    o.append(R(px, py, pw, ph, r=2.5, fill=SCR, stroke=INK, sw=1.2))
    ix, iy, iw, ih = px + 3, py + 3, 56, ph - 6
    o.append(R(ix, iy, iw, ih, fill="#9a9a9a", stroke="none"))
    o.append(T(ix + iw / 2, iy + ih / 2 + 2.5, "2x²+3x−5=0", size=7.4, weight=700, fill=SCR, anchor="middle"))
    cl = 8
    for (cx_, cy_, dx, dy) in [(ix + 2, iy + 2, 1, 1), (ix + iw - 2, iy + 2, -1, 1),
                               (ix + 2, iy + ih - 2, 1, -1), (ix + iw - 2, iy + ih - 2, -1, -1)]:
        o.append(P(f"M{cx_ + dx * cl},{cy_} L{cx_},{cy_} L{cx_},{cy_ + dy * cl}", stroke=ACC, sw=2.2))
    rx_ = ix + iw + 3
    o.append(T(rx_, py + 12, d["pv_title"], size=fit(d["pv_title"], 5.4, 34, k=0.6), fill="#ffffff", font=MONO))
    o.append(T(rx_, py + 25, d["pv_sharp"], size=fit(d["pv_sharp"], 5.4, 34, k=0.6), fill="#ffffff", font=MONO))
    o.append(R(rx_, py + 29, 31, 7, fill="none", stroke="#ffffff", sw=0.7))
    o.append(R(rx_ + 1, py + 30, 23, 5, fill="#ffffff", stroke="none"))
    o.append(T(rx_, py + 52, "OK =", size=5.6, fill="#ffffff", font=MONO))
    o.append(T(rx_, py + 61, d["pv_ok"].split("= ")[-1], size=fit(d["pv_ok"].split("= ")[-1], 5.6, 34, k=0.6),
               fill="#ffffff", font=MONO))
    o.append(A(116, 124, 134, 124, sw=1.4, size=5))
    return svg(240, 190, "".join(o))


def art_result(t, d):
    o = []
    o.append(R(4, 6, 178, 98, r=2.5, fill=SCR, stroke=INK, sw=1.2))
    dec = "." if t["html_lang"] == "en" else ","
    lines = ["2x^2+3x-5=0", "D = 9 + 40 = 49", "x1 = 1", f"x2 = -2{dec}5"]
    for i, ln in enumerate(lines):
        o.append(T(11, 23 + i * 15, ln, size=9.6, weight=700 if i == 3 else 400, fill="#ffffff", font=MONO))
    o.append(L(6, 86, 180, 86, sw=0.6, stroke="#ffffff"))
    o.append(T(11, 97, d["res_foot"], size=6.8, fill="#cfcfcf", font=MONO))
    o.append(R(175, 12, 3, 26, fill="#ffffff", stroke="none"))
    # klawisze
    o.append(tri(211, 10, 7.5, "up"))
    o.append(keychip(211, 26, "8", True, w=26, h=20))
    o.append(keychip(211, 58, "2", True, w=26, h=20))
    o.append(tri(211, 74, 7.5, "down"))
    o.append(keychip(216, 98, "4", False, w=20, h=17))
    o.append(tri(199, 98, 6.5, "left"))
    # historia
    o.append(f'<g transform="translate(4,118) scale(1.15)">{icon_history()}</g>')
    o.append(A(54, 141, 66, 141, sw=1.5, size=5))
    o.append(oled(70, 122, 166, 38, rows=[d["sol_m1"], d["sol_hist"]], sel=1, fs=7.4))
    return svg(240, 166, "".join(o))


def art_keys(t, d):
    hl = {"8": "acc", "2": "acc", "4": "acc", "6": "acc", "5": "acc", "MU": "acc", "CCE": "ring"}
    ov = {"8": "up", "2": "down", "4": "left", "6": "right", "5": "OK",
          "+": "up", "-": "down", "+-": "left", "=": "OK"}
    def scr(sx, sy, sw_, sh):
        # menu glowne: naglowek "KalkMate" + WiFi/bateria, zaznaczona 1. pozycja z ikona
        fs = sh * 0.27
        isz = fs * 0.78
        return (T(sx + 5, sy + sh * 0.42, d["menu_title"], size=fs, fill="#ffffff", font=MONO)
                + oled_status(sx + sw_ - 5, sy + sh * 0.42, fs)
                + R(sx + 3, sy + sh * 0.53, sw_ - 6, sh * 0.36, r=1, fill="#ffffff", stroke="none")
                + xbm(sx + 5, sy + sh * 0.81 - isz * 0.97, isz, MENU_ICONS[0], fill=SCR)
                + T(sx + 5 + isz + fs * 0.55, sy + sh * 0.81, d["m1"], size=fs, weight=700, fill=SCR, font=MONO)
                + T(sx + sw_ - 5, sy + sh * 0.81, ">", size=fs, weight=700, fill=SCR, anchor="end", font=MONO))
    cs, pos = calc_front(20, 4, 200, hl=hl, overlay=ov, screen=scr)
    return svg(240, 280, cs)


def art_panic(t, d):
    o = []
    o.append(oled(2, 10, 92, 40, rows=[d["m1"]], sel=0, fs=6.4, title=d["menu_title"],
                  icons=[MENU_ICONS[0]], status=True, chev=True))
    o.append(A(98, 30, 108, 30, sw=1.5, size=4.5))
    o.append(keychip(124, 30, "MU", True, w=28, h=20))
    o.append(A(140, 30, 150, 30, sw=1.5, size=4.5))
    o.append(oled(154, 10, 84, 40, big="0", big_align="end"))
    return svg(240, 58, "".join(o))


def art_cover(t, d):
    scr = lambda sx, sy, sw_, sh: T(sx + sw_ / 2, sy + sh * 0.72, "KalkMate", size=sh * 0.62, weight=700,
                                     fill="#ffffff", anchor="middle", font=MONO)
    cs, pos = calc_front(30, 6, 180, screen=scr, hl={"MU": None})
    o = [R(14, 150, 212, 120, r=14, fill=ACC, stroke="none"), cs]
    return svg(240, 254, "".join(o))


# =====================================================================
#  HTML
# =====================================================================
def fmt(s):
    s = esc(s).replace("&lt;br&gt;", "<br>")
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)

    def chip(m):
        k = m.group(1)
        acc = k.startswith("!")
        k = k.lstrip("!")
        return f'<span class="k{" acc" if acc else ""}">{k}</span>'
    s = re.sub(r"\[\[(.+?)\]\]", chip, s)
    return s


def step(n, title, art, text, tip=None, cls=""):
    tip_html = f'<p class="tip">{fmt(tip)}</p>' if tip else ""
    return (f'<section class="step {cls}"><div class="sh"><span class="num">{n}</span><h3>{fmt(title)}</h3></div>'
            f'{art}<p class="tx">{fmt(text)}</p>{tip_html}</section>')


def logo_svg(height_mm):
    with open(os.path.join(HERE, "assets", "kalkmate_logo.svg"), encoding="utf-8") as f:
        s = f.read()
    s = s[s.index("<svg"):]
    s = re.sub(r'<metadata>.*?</metadata>', "", s, flags=re.S)
    s = re.sub(r'width="[^"]*"\s+height="[^"]*"\s+viewBox="[^"]*"',
               f'viewBox="370 570 1260 860" style="height:{height_mm}mm;width:auto;display:block"', s, count=1)
    return s


_UR = {
    "latin": "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,"
             "U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
    "latin-ext": "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,"
                 "U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
    "cyrillic": "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116",
}


def font_faces():
    """IBM Plex (OFL) — statyczne woff2 z fontsource, osadzone base64 -> HTML
    samowystarczalny, PDF z prawdziwymi fontami TrueType (nie Type3).
    latin (U+0000-00FF): ä ô ñ ã õ ç à è é ì ò ù ... (sk/es/pt/fr/it),
    latin-ext (U+0100-02BA): ą ę ł ż / č ď ě ň ř š ť ů ž / ľ ĺ ŕ / ė į ų ū
    (pl/cs/sk/lt), cyrillic (U+0400-045F): bialoruski (і ў ё) — tekst ulotki
    BE oraz nazwa "Беларуская" na liscie jezykow we WSZYSTKICH wersjach.
    Pokrycie sprawdzone fontTools (getBestCmap) dla kazdej wagi."""
    import base64
    out = []
    fdir = os.path.join(HERE, "assets", "fonts")
    for fam, name, weights in (("sans", "IBM Plex Sans", (400, 500, 600, 700)),
                               ("mono", "IBM Plex Mono", (400, 600, 700))):
        for wgt in weights:
            for sub in ("cyrillic", "latin-ext", "latin"):
                fn = os.path.join(fdir, f"ibm-plex-{fam}-{sub}-{wgt}-normal.woff2")
                with open(fn, "rb") as f:
                    b64 = base64.b64encode(f.read()).decode("ascii")
                out.append(f"@font-face{{font-family:'{name}';font-style:normal;font-weight:{wgt};font-display:block;"
                           f"src:url(data:font/woff2;base64,{b64}) format('woff2');unicode-range:{_UR[sub]}}}")
    return "\n".join(out)


CSS = r"""
@page { size: A4 landscape; margin: 0; }
*{box-sizing:border-box;margin:0;padding:0}
:root{--ink:#111;--acc:#D8FF3D;--g:#666;--line:#cfcfcf;--paper:#fff}
html,body{background:#fff}
body{font-family:'IBM Plex Sans',Arial,Helvetica,sans-serif;color:var(--ink);
  -webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:8.6pt;line-height:1.28}
.sheet{width:297mm;height:210mm;position:relative;overflow:hidden;display:flex;break-after:page;page-break-after:always;background:#fff}
.sheet:last-child{break-after:auto;page-break-after:auto}
.panel{width:74.25mm;height:210mm;padding:5mm;display:flex;flex-direction:column;overflow:hidden;position:relative}
/* znaczniki zgiecia — tylko na marginesie (gora/dol), nie przez tresc */
.fold{position:absolute;width:0;border-left:0.25mm dashed #9a9a9a}
.fold.t{top:0;height:3.6mm}.fold.b{bottom:0;height:3.6mm}
.f1{left:74.25mm}.f2{left:148.5mm}.f3{left:222.75mm}
.eyebrow{font-family:'IBM Plex Mono',Consolas,monospace;font-size:6.4pt;font-weight:600;letter-spacing:.12em;
  text-transform:uppercase;color:#555;display:flex;justify-content:space-between;border-bottom:0.35mm solid var(--ink);
  padding-bottom:1.2mm;margin-bottom:2.6mm}
.step{display:flex;flex-direction:column;gap:1.7mm;flex:1 1 0;min-height:0}
.step + .step{border-top:0.3mm solid var(--line);padding-top:3mm;margin-top:2.6mm}
.sh{display:flex;align-items:center;gap:2.4mm}
.num{flex:0 0 auto;width:8.2mm;height:8.2mm;border-radius:50%;background:var(--ink);color:var(--acc);
  font-family:'IBM Plex Mono',Consolas,monospace;font-weight:700;font-size:13pt;display:flex;align-items:center;justify-content:center;line-height:1}
h3{font-size:12pt;font-weight:700;line-height:1.1;letter-spacing:-.01em}
h2{font-size:11.5pt;font-weight:700;line-height:1.1;margin-bottom:2mm}
.art{width:100%;height:auto;display:block}
.tx{font-size:8.8pt;line-height:1.3}
.tip{font-size:7.2pt;line-height:1.28;color:#333;padding-left:2.2mm;border-left:0.9mm solid var(--ink)}
.k{display:inline-block;font-family:'IBM Plex Mono',Consolas,monospace;font-weight:700;font-size:7.4pt;line-height:1;
  padding:0.45mm 1.1mm 0.55mm;border-radius:0.9mm;background:var(--ink);color:#fff;border:0.25mm solid var(--ink);vertical-align:0.15mm;white-space:nowrap}
.k.acc{background:var(--acc);color:var(--ink)}
b{font-weight:700}
/* okladka */
.cover{justify-content:space-between}
.cover .lang{display:inline-block;margin-top:0.8mm;font-family:'IBM Plex Mono',Consolas,monospace;font-weight:700;font-size:8pt;
  border:0.35mm solid var(--ink);border-radius:1mm;padding:0.6mm 1.6mm}
.cover .logo{margin-top:1mm}
.cover .ttl{font-size:21pt;font-weight:700;line-height:1.02;letter-spacing:-.02em;margin-top:4.5mm}
.cover .qs{display:inline-block;background:var(--acc);border:0.35mm solid var(--ink);font-family:'IBM Plex Mono',Consolas,monospace;
  font-weight:700;font-size:11pt;padding:0.8mm 2.4mm;margin-top:2.4mm;letter-spacing:.04em}
.cover .tag{font-size:9.5pt;font-weight:600;margin-top:3mm}
.cover .subj{font-size:7.6pt;color:#444;margin-top:0.8mm}
.cover .unfold{display:flex;align-items:center;gap:2mm;font-size:8pt;font-weight:600;border-top:0.35mm solid var(--ink);padding-top:2mm}
.cover .unfold .arr{font-size:13pt;line-height:1}
.cover .meta{font-family:'IBM Plex Mono',Consolas,monospace;font-size:6.6pt;color:#555;margin-top:1.4mm;display:flex;justify-content:space-between}
/* klawisze — legenda */
.legend{display:grid;grid-template-columns:auto 1fr;gap:1.3mm 2.4mm;align-items:center;font-size:8pt;margin-top:1.5mm}
.legend .ks{display:flex;gap:0.8mm;align-items:center;white-space:nowrap}
.legend .or{font-size:6.4pt;color:#666}
.box{border:0.35mm solid var(--ink);border-radius:2mm;padding:2.4mm 2.6mm;margin-top:auto}
.box h2{display:flex;align-items:center;gap:2mm}
/* wiecej funkcji */
.rows{display:flex;flex-direction:column;flex:1 1 auto;justify-content:space-between}
.row{display:flex;gap:2.6mm;align-items:flex-start}
.row svg{flex:0 0 12.5mm;width:12.5mm;height:12.5mm}
.row .rt{font-size:9pt;font-weight:700;line-height:1.15;margin-bottom:0.5mm}
.row .rx{font-size:7.9pt;line-height:1.27}
.row.hot{background:#fff;border:0.35mm solid var(--ink);border-radius:2mm;padding:1.8mm}
/* tyl — bezpieczenstwo */
.safety ul{list-style:none;display:flex;flex-direction:column;gap:1.1mm}
.safety li{font-size:7.9pt;line-height:1.26;padding-left:3mm;position:relative}
.safety li::before{content:"";position:absolute;left:0;top:1.3mm;width:1.4mm;height:1.4mm;background:var(--ink);border-radius:50%}
.sym{display:flex;gap:2.8mm;align-items:center;font-size:7.7pt;line-height:1.27;margin-top:3.4mm}
.sym svg{flex:0 0 auto}
.sec{margin-top:4.5mm;padding-top:3mm;border-top:0.3mm solid var(--line)}
.back .maker{margin-top:auto}
.sec h4{font-size:9.2pt;font-weight:700;margin-bottom:1mm}
.small{font-size:7.8pt;line-height:1.32}
.tiny{font-size:6.8pt;line-height:1.3;color:#444}
.help{display:flex;gap:2.6mm;align-items:center}
.help svg{flex:0 0 20mm;width:20mm;height:20mm}
"""


def build_html(lang):
    t = TEXT[lang]
    d = DEV[lang]
    w = WEB[lang]

    # ------------------------------------------------ STRONA A (zewnetrzna)
    # A1 — tyl ulotki po zlozeniu: bezpieczenstwo / WEEE / CE / producent
    safety_items = "".join(f"<li>{fmt(s)}</li>" for s in t["safety"])
    a1 = f"""
<div class="panel back">
  <div class="eyebrow"><span>KalkMate</span><span>{esc(t['cover_lang'])}</span></div>
  <div class="safety">
    <h2>{svg(40, 36, warn_tri(20, 19, 30), cls="ic", extra='style="width:6mm;height:5.4mm"')}{esc(t['safety_t'])}</h2>
    <ul>{safety_items}</ul>
  </div>
  <div class="sym">{svg(40, 44, weee(2, 2, 40), cls="ic", extra='style="width:12mm;height:13.2mm"')}<span>{fmt(t['weee_x'])}</span></div>
  <div class="sym">{svg(48, 26, ce_mark(2, 2, 22), cls="ic", extra='style="width:12mm;height:6.5mm"')}<span>{fmt(t['ce_x'])}</span></div>
  <div class="sec">
    <h4>{esc(t['help_t'])}</h4>
    <div class="help">{svg(40, 40, real_qr(2, 2, 36, 'https://kalkmate.pl/pomoc'), cls="ic")}
      <div class="small">{fmt(t['help_x'])}<br>{fmt(t['warranty_x'])}<br>{fmt(t['mail_x'])}</div></div>
  </div>
  <div class="sec maker">
    <h4>{esc(t['maker_t'])}</h4>
    <div class="small">{fmt(t['maker'])}</div>
    <p class="tiny" style="margin-top:1.6mm">{fmt(t['tech'])}</p>
    <p class="tiny" style="margin-top:1mm">{esc(t['made_in'])} · {esc(t['cover_meta'])} · 10/2026</p>
  </div>
</div>"""

    # A2 — klawisze + panika
    def ks(*chips):
        return '<span class="ks">' + "".join(chips) + "</span>"
    orr = f'<span class="or">{esc(t["k_or"])}</span>'
    legend = "".join([
        ks('<span class="k acc">▲ 8</span>', orr, '<span class="k">+</span>') + f"<span>{esc(t['k_up'])}</span>",
        ks('<span class="k acc">▼ 2</span>', orr, '<span class="k">−</span>') + f"<span>{esc(t['k_down'])}</span>",
        ks('<span class="k acc">◀ 4</span>', orr, '<span class="k">±</span>') + f"<span>{esc(t['k_left'])}</span>",
        ks('<span class="k acc">▶ 6</span>', orr, '<span class="k">▶</span>') + f"<span>{esc(t['k_right'])}</span>",
        ks('<span class="k acc">OK 5</span>', orr, '<span class="k">=</span>') + f"<span>{esc(t['k_ok'])}</span>",
        ks('<span class="k">C/CE</span>') + f"<span>{esc(t['k_cce'])}</span>",
        ks('<span class="k acc">MU</span>') + f"<span>{esc(t['k_mu'])}</span>",
    ])
    a2 = f"""
<div class="panel keys">
  <div class="eyebrow"><span>{esc(t['keys_t'])}</span><span>AI</span></div>
  {art_keys(t, d)}
  <div class="legend">{legend}</div>
  <div class="box">
    <h2><span class="k acc" style="font-size:9pt">MU</span>{esc(t['panic_t'])}</h2>
    {art_panic(t, d)}
    <p class="tx" style="margin-top:1.6mm">{fmt(t['panic_x'])}</p>
  </div>
</div>"""

    # A3 — wiecej funkcji
    def row(icon, title, text, hot=False):
        return (f'<div class="row{" hot" if hot else ""}">{svg(40, 40, icon, cls="ic")}'
                f'<div><div class="rt">{esc(title)}</div><div class="rx">{fmt(text)}</div></div></div>')
    a3 = f"""
<div class="panel more">
  <div class="eyebrow"><span>{esc(t['more_t'])}</span><span>+</span></div>
  <div class="rows">
    {row(icon_text(), t['text_t'], t['text_x'])}
    {row(icon_history(), t['hist_t'], t['hist_x'])}
    {row(icon_offline(), t['off_t'], t['off_x'])}
    {row(icon_code(), t['code_t'], t['code_x'])}
    {row(icon_update(), t['ota_t'], t['ota_x'])}
    {row(icon_battery(), t['bat_t'], t['bat_x'])}
    {row(icon_lang(), t['lang_t'], t['lang_x'])}
    {row(icon_reset(), t['reset_t'], t['reset_x'], hot=True)}
  </div>
</div>"""

    # A4 — OKLADKA (na wierzchu po zlozeniu)
    a4 = f"""
<div class="panel cover">
  <div>
    <span class="lang">{esc(t['cover_lang'])}</span>
    <div class="logo">{logo_svg(30)}</div>
    <div class="ttl" style="font-size:{21 if len(t['cover_title']) <= 18 else 17}pt">{esc(t['cover_title'])}</div>
    <div class="qs">{esc(t['cover_sub'])}</div>
    <div class="tag">{esc(t['cover_tag'])}</div>
    <div class="subj">{esc(t['cover_subjects'])}</div>
  </div>
  {art_cover(t, d)}
  <div>
    <div class="unfold"><span class="arr">↔</span><span>{esc(t['cover_unfold'])}</span></div>
    <div class="meta"><span>{esc(t['cover_meta'])}</span><span>kalkmate.pl</span></div>
  </div>
</div>"""

    # ------------------------------------------------ STRONA B (wewnetrzna, kroki 1-8)
    b1 = f"""
<div class="panel">
  <div class="eyebrow"><span>{esc(t['eyebrow_start'])}</span><span>1–2</span></div>
  {step(1, t['s1_t'], art_charge(t, d), t['s1_x'])}
  {step(2, t['s2_t'], art_power(t, d), t['s2_x'], t['s2_tip'])}
</div>"""
    b2 = f"""
<div class="panel">
  <div class="eyebrow"><span>{esc(t['eyebrow_start'])}</span><span>3–4</span></div>
  {step(3, t['s3_t'], art_code(t, d), t['s3_x'], t['s3_tip'])}
  {step(4, t['s4_t'], art_wifi(t, d), t['s4_x'])}
</div>"""
    b3 = f"""
<div class="panel">
  <div class="eyebrow"><span>kalkmate.pl</span><span>5–6</span></div>
  {step(5, t['s5_t'], art_pair(t, d, w), t['s5_x'])}
  {step(6, t['s6_t'], art_box(t, d, w), t['s6_x'])}
</div>"""
    b4 = f"""
<div class="panel">
  <div class="eyebrow"><span>AI</span><span>7–8</span></div>
  {step(7, t['s7_t'], art_photo(t, d), t['s7_x'])}
  {step(8, t['s8_t'], art_result(t, d), t['s8_x'])}
</div>"""

    folds = "".join(f'<div class="fold {p} f{i}"></div>' for i in (1, 2, 3) for p in ("t", "b"))

    comment = """
<!--
  KalkMate — instrukcja v4 (ulotka). Wygenerowano przez docs/instrukcja_v4/build.py
  — NIE edytuj recznie, zmieniaj build.py / i18n.py i przebuduj.

  FORMAT: A4 poziomo (297 x 210 mm), druk DWUSTRONNY z obracaniem wzdluz
  KROTSZEJ krawedzi ("flip on short edge" — kartke odwraca sie jak strone
  ksiazki w poziomie). 4 pionowe pola po 74,25 mm, margines bezpieczny 5 mm
  w kazdym polu. Znaczniki zgiecia = krotkie przerywane kreski tylko na
  gornym i dolnym marginesie (x = 74,25 / 148,5 / 222,75 mm).

  Przy takim druku pola sa sklejone plecami tak:
      A1 <-> B4     A2 <-> B3     A3 <-> B2     A4 <-> B1
  (A = strona 1 PDF, B = strona 2 PDF, numeracja od lewej).

  SKLADANIE (harmonijka / zig-zag, 3 zgiecia):
      patrzac na strone B (wnetrze, kroki): B1|B2 dolinka, B2|B3 grzbiet, B3|B4 dolinka
      (= na stronie A: A4|A3 grzbiet, A3|A2 dolinka, A2|A1 grzbiet).
      Skladaj od okladki: A4 na wierzch, reszta harmonijka pod spod.
      -> po zlozeniu na WIERZCHU lezy A4 = OKLADKA (logo, nazwa, "Instrukcja / Quick start"),
         pod spodem (tyl paczki) lezy A1 = bezpieczenstwo, WEEE, CE, producent, pomoc.
         A2 i A3 sa w srodku paczki (widoczne po rozlozeniu i odwroceniu).

  CZYTANIE:
      1. Odchyl okladke A4 w lewo -> widac B1 | B2  (kroki 1-2 | 3-4)
      2. Rozloz reszte w prawo   -> B1 | B2 | B3 | B4 = kroki 1-8 po kolei
         (B1: ladowanie, wlaczanie; B2: kod AI, WiFi; B3: konto+parowanie,
          kod z pudelka; B4: zdjecie zadania, czytanie wyniku)
      3. Odwrocona kartka (strona A): A1 tyl | A2 klawisze + panika |
         A3 wiecej funkcji (tekst, historia, offline, kod AI, OTA, bateria,
         jezyk, reset fabryczny) | A4 okladka

  Strona 1 (A, zewnetrzna):  [A1 tyl/bezpieczenstwo] [A2 klawisze] [A3 wiecej] [A4 OKLADKA]
  Strona 2 (B, wewnetrzna):  [B1 kroki 1-2] [B2 kroki 3-4] [B3 kroki 5-6] [B4 kroki 7-8]
-->"""

    return f"""<!DOCTYPE html>
<html lang="{t['html_lang']}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(t['doc_title'])}</title>{comment}
<style>
{font_faces()}
{CSS}</style>
</head>
<body>
<div class="sheet side-a">{a1}{a2}{a3}{a4}{folds}</div>
<div class="sheet side-b">{b1}{b2}{b3}{b4}{folds}</div>
</body>
</html>
"""


def print_pdf(html_path, pdf_path):
    url = "file:///" + html_path.replace("\\", "/")
    if os.path.exists(pdf_path):
        os.remove(pdf_path)
    cmd = [EDGE, "--headless", "--disable-gpu", "--no-pdf-header-footer",
           "--run-all-compositor-stages-before-draw", "--virtual-time-budget=15000",
           f"--print-to-pdf={pdf_path}", url]
    subprocess.run(cmd, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
    if not os.path.exists(pdf_path):
        raise RuntimeError(f"Edge nie wygenerowal {pdf_path}")


def main(argv):
    do_pdf = "--no-pdf" not in argv
    langs = [a for a in argv if not a.startswith("--")] or LANGS
    for lang in langs:
        own = [k for k, v in DEV_SRC.get(lang, {}).items() if v == "own" and k != "menu_title"]
        if own:
            print(f"[{lang}] napisy ekranu bez tools/i18n/fw_{lang}.json (wlasne): {', '.join(own)}")
    for lang in langs:
        h = os.path.join(DOCS, f"kalkmate_instrukcja_v4_{lang}.html")
        with open(h, "w", encoding="utf-8", newline="\n") as f:
            f.write(build_html(lang))
        print("HTML", h)
        if do_pdf:
            p = os.path.join(DOCS, f"kalkmate_instrukcja_v4_{lang}.pdf")
            print_pdf(h, p)
            print("PDF ", p)
    if "pl" in langs and "--no-cert" not in argv:
        os.makedirs(CERT_DOCS, exist_ok=True)
        for ext in ("html",) + (("pdf",) if do_pdf else ()):
            src = os.path.join(DOCS, f"kalkmate_instrukcja_v4_pl.{ext}")
            dst = os.path.join(CERT_DOCS, f"kalkmate_instrukcja_v4_pl.{ext}")
            shutil.copyfile(src, dst)
            print("COPY", dst)


if __name__ == "__main__":
    main(sys.argv[1:])
