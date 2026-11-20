# -*- coding: utf-8 -*-
"""
KalkMate — karta do pudelka „Nowy wyglad / jak naladowac” (A4 poziomo, PL / EN / DE).

Rysunki z build.py (te same co w instrukcji v4: tyl obudowy, otwarta obudowa,
srubki), teksty ponizej. Uzycie (z katalogu repo, PowerShell — Edge headless):
    python docs/instrukcja_v4/karta_ladowanie.py           # HTML + PDF
    python docs/instrukcja_v4/karta_ladowanie.py --no-pdf  # tylko HTML
Wynik: docs/kalkmate_karta_ladowanie.html / .pdf
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build import (  # noqa: E402
    ACC, G1, G2, INK, A, AC, C, L, P, R, T, calc_back, calc_open, clock, esc, font_faces,
    logo_svg, print_pdf, screw, svg, warn_tri, DOCS,
)

LANGS = ("pl", "en", "de")

TX = {
    "title": {
        "pl": "Nie bój się — to nowy wygląd naszego kalkulatora!",
        "en": "Don’t worry — this is the new look of our calculator!",
        "de": "Keine Sorge — das ist das neue Aussehen unseres Rechners!",
    },
    "sub": {
        "pl": "Port ładowania USB-C jest teraz schowany pod tylną obudową. Tak go naładujesz:",
        "en": "The USB-C charging port is now under the back cover. Here’s how to charge it:",
        "de": "Der USB-C-Ladeanschluss sitzt jetzt unter dem hinteren Gehäuse. So lädst du ihn auf:",
    },
    "steps": [
        {
            "pl": ("Odkręć 2 śrubki", "Odwróć kalkulator. Małym śrubokrętem odkręć dwie śrubki u góry tylnej obudowy."),
            "en": ("Undo the 2 screws", "Turn the calculator over. Use a small screwdriver to remove the two screws at the top of the back cover."),
            "de": ("2 Schrauben lösen", "Rechner umdrehen. Mit einem kleinen Schraubendreher die zwei Schrauben oben am hinteren Gehäuse herausdrehen."),
        },
        {
            "pl": ("Zdejmij obudowę", "Delikatnie podważ obudowę paznokciem lub palcami i zdejmij ją. Bez siły i bez ostrych narzędzi."),
            "en": ("Lift the cover off", "Gently lift the cover with a fingernail or your fingers and take it off. No force, no sharp tools."),
            "de": ("Gehäuse abnehmen", "Das Gehäuse vorsichtig mit dem Fingernagel oder den Fingern anheben und abnehmen. Ohne Gewalt, ohne spitzes Werkzeug."),
        },
        {
            "pl": ("Podłącz USB-C", "Podłącz kabel USB-C do widocznego portu i do ładowarki USB 5 V. Pełne ładowanie trwa ok. 2 h."),
            "en": ("Plug in USB-C", "Connect the USB-C cable to the port you can now see and to a 5 V USB charger. A full charge takes about 2 h."),
            "de": ("USB-C anschließen", "USB-C-Kabel an den sichtbaren Anschluss und an ein 5-V-USB-Ladegerät stecken. Volle Ladung dauert ca. 2 h."),
        },
        {
            "pl": ("Złóż z powrotem", "Odłącz kabel, załóż obudowę i przykręć obie śrubki — bez dokręcania na siłę."),
            "en": ("Close it again", "Unplug the cable, put the cover back on and screw both screws in — don’t overtighten."),
            "de": ("Wieder schließen", "Kabel abziehen, Gehäuse aufsetzen und beide Schrauben eindrehen — nicht zu fest anziehen."),
        },
    ],
    "warn_t": {"pl": "Uwaga", "en": "Caution", "de": "Achtung"},
    "warn": {
        "pl": "W środku dotykaj wyłącznie portu USB-C. Nie ruszaj płytki, przewodów, taśm ani akumulatora — możesz trwale uszkodzić kalkulator.",
        "en": "Inside, touch only the USB-C port. Do not touch the circuit board, wires, ribbon cables or battery — you could permanently damage the calculator.",
        "de": "Im Inneren nur den USB-C-Anschluss berühren. Platine, Kabel, Flachbandkabel und Akku nicht anfassen — der Rechner kann dauerhaft beschädigt werden.",
    },
    "help": {"pl": "Pytania?", "en": "Questions?", "de": "Fragen?"},
}


# ---------------------------------------------------------------- rysunki (viewBox 200 x 180)
def art_screws():
    o = []
    bs, pos = calc_back(46, 38, 100, screws="ring")
    o.append(bs)
    (lx, ly, _), (rx, ry, _) = pos
    o.append(T(96, 20, "2×", size=14, weight=700, anchor="middle"))
    o.append(L(88, 22, lx + 6, ly - 7, sw=1.2))
    # srubokret przy prawej srubce
    o.append(L(rx + 2, ry - 2, rx + 20, ry - 20, sw=3.2, cap="butt"))
    o.append(L(rx + 20, ry - 20, rx + 34, ry - 34, sw=13))
    o.append(L(rx + 21.5, ry - 21.5, rx + 33, ry - 33, sw=9.5, stroke=ACC))
    # obrot w lewo (odkrecanie)
    o.append(AC(rx - 12, ry + 10, rx - 20, ry - 14, rx - 4, ry - 18, sw=1.6, size=5.5))
    return svg(200, 180, "".join(o))


def art_lift():
    o = []
    base, _ = calc_open(22, 52, 96, plug=False)
    o.append(base)
    # zdejmowana obudowa — uniesiona i obrocona
    cover, _ = calc_back(0, 0, 96, screws=None, label=False)
    o.append(f'<g transform="translate(92 14) rotate(14)">{cover}</g>')
    # palec z paznokciem przy szczelinie
    fx, fy = 120, 150
    o.append(f'<g transform="rotate(-32 {fx} {fy})">'
             + R(fx - 10, fy - 6, 20, 46, r=10, fill="#ffffff", stroke=INK, sw=1.4)
             + R(fx - 6.5, fy - 3, 13, 12, r=5, fill=G2, stroke=INK, sw=1.0) + "</g>")
    o.append(AC(150, 128, 174, 112, 178, 82, sw=2, size=6.5))
    return svg(200, 180, "".join(o))


def art_plug():
    o = []
    os_, (pcx, ptop) = calc_open(46, 62, 96)
    o.append(os_)
    o.append(T(pcx - 24, ptop - 12, "USB-C", size=11, weight=700, anchor="end"))
    # ladowarka 5 V (kabel z calc_open konczy sie przy (pcx+34.6, ptop-48))
    bx, by = pcx + 18, ptop - 72
    o.append(R(bx, by, 44, 26, r=5, fill="#ffffff", stroke=INK, sw=1.6))
    o.append(L(bx + 44, by + 8, bx + 52, by + 8, sw=2.4, cap="butt"))
    o.append(L(bx + 44, by + 18, bx + 52, by + 18, sw=2.4, cap="butt"))
    o.append(T(bx + 22, by + 17.5, "5 V", size=11.5, weight=700, anchor="middle"))
    o.append(clock(20, 22, 9))
    o.append(T(33, 26.5, "~2 h", size=12, weight=700))
    return svg(200, 180, "".join(o))


def art_close():
    o = []
    bs, pos = calc_back(46, 38, 100, screws="ring")
    o.append(bs)
    for cx, cy, _ in pos:
        # obrot w prawo (dokrecanie)
        o.append(AC(cx - 9, cy + 13, cx - 17, cy - 9, cx - 2, cy - 15, sw=1.5, size=5))
    o.append(A(96, 6, 96, 30, sw=2.2, size=7))
    # znaczek OK
    o.append(C(170, 150, 15, fill=ACC, stroke=INK, sw=1.6))
    o.append(P("M162,150 L168,157 L179,143", stroke=INK, sw=3))
    return svg(200, 180, "".join(o))


def art_warn():
    o = []
    os_, (pcx, ptop) = calc_open(10, 8, 72, plug=False)
    o.append(os_)
    # krzyzyk na plytce i akumulatorze, ptaszek przy porcie
    o.append(L(22, 40, 70, 88, sw=4))
    o.append(L(70, 40, 22, 88, sw=4))
    o.append(C(pcx + 26, ptop + 2, 8, fill=ACC, stroke=INK, sw=1.3))
    o.append(P(f"M{pcx + 22},{ptop + 2} L{pcx + 25},{ptop + 5.5} L{pcx + 30.5},{ptop - 1.5}", stroke=INK, sw=2))
    o.append(warn_tri(120, 58, 52))
    return svg(150, 112, "".join(o), cls="warnart")


ARTS = (art_screws, art_lift, art_plug, art_close)

CSS = r"""
@page { size: A4 landscape; margin: 0; }
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff}
body{font-family:'IBM Plex Sans',Arial,Helvetica,sans-serif;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{width:297mm;height:210mm;padding:9mm 10mm 7mm;display:flex;flex-direction:column;gap:4mm;overflow:hidden}
.head{display:flex;gap:7mm;align-items:center}
.head .logo{flex:0 0 auto}
.titles{display:flex;flex-direction:column;gap:1.2mm}
.t{display:flex;align-items:baseline;gap:2.4mm;line-height:1.08;letter-spacing:-.01em}
.t.pl{font-size:21pt;font-weight:700}
.t.en,.t.de{font-size:12.5pt;font-weight:600;color:#222}
.chip{font-family:'IBM Plex Mono',Consolas,monospace;font-weight:700;font-size:7.4pt;line-height:1;letter-spacing:.04em;
  border:0.35mm solid #111;border-radius:1mm;padding:0.7mm 1.3mm;flex:0 0 auto;transform:translateY(-0.6mm);color:#111;background:#fff}
.t.pl .chip{background:#D8FF3D}
.band{display:flex;gap:6mm;background:#111;color:#fff;border-radius:2.4mm;padding:2.6mm 4mm;font-size:8.6pt;line-height:1.25}
.band div{flex:1 1 0}
.band b{color:#D8FF3D;font-family:'IBM Plex Mono',Consolas,monospace;font-size:7.2pt;margin-right:1.4mm}
.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:5mm;flex:1 1 auto;min-height:0}
.step{display:flex;flex-direction:column;gap:2mm;border:0.35mm solid #cfcfcf;border-radius:3mm;padding:3mm;min-height:0}
.sh{display:flex;align-items:center;gap:2.4mm}
.num{width:8.6mm;height:8.6mm;border-radius:50%;background:#111;color:#D8FF3D;font-family:'IBM Plex Mono',Consolas,monospace;
  font-weight:700;font-size:13.5pt;display:flex;align-items:center;justify-content:center;line-height:1;flex:0 0 auto}
.sh h3{font-size:11.5pt;font-weight:700;line-height:1.1}
.art{width:100%;height:auto;max-height:56mm;display:block}
.cap{display:flex;flex-direction:column;gap:1.4mm}
.cap p{font-size:7.5pt;line-height:1.28;display:flex;gap:1.6mm}
.cap p .chip{font-size:6pt;padding:0.5mm 1mm;transform:none;align-self:flex-start;margin-top:0.2mm}
.cap p b{font-weight:700}
.warn{display:flex;gap:5mm;align-items:center;border:0.6mm solid #111;border-radius:3mm;padding:2.6mm 4mm;background:#fff}
.warnart{flex:0 0 30mm;width:30mm;height:auto}
.warn .wx{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm;flex:1 1 auto}
.warn .wx p{font-size:8pt;line-height:1.3}
.warn .wx b{display:block;font-size:9.5pt;margin-bottom:0.6mm}
.foot{display:flex;justify-content:space-between;font-family:'IBM Plex Mono',Consolas,monospace;font-size:7pt;color:#444}
"""


def build_html():
    titles = "".join(
        f'<div class="t {lg}"><span class="chip">{lg.upper()}</span><span>{esc(TX["title"][lg])}</span></div>'
        for lg in LANGS)
    band = "".join(f'<div><b>{lg.upper()}</b>{esc(TX["sub"][lg])}</div>' for lg in LANGS)
    steps = []
    for i, (st, art) in enumerate(zip(TX["steps"], ARTS), start=1):
        caps = "".join(
            f'<p><span class="chip">{lg.upper()}</span><span><b>{esc(st[lg][0])}.</b> {esc(st[lg][1])}</span></p>'
            for lg in LANGS)
        steps.append(f'<div class="step"><div class="sh"><span class="num">{i}</span><h3>{esc(st["pl"][0])}</h3></div>'
                     f'{art()}<div class="cap">{caps}</div></div>')
    warn = "".join(f'<p><b>{esc(TX["warn_t"][lg])}!</b>{esc(TX["warn"][lg])}</p>' for lg in LANGS)
    helps = " · ".join(TX["help"][lg] for lg in LANGS)
    return f"""<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<title>KalkMate — nowy wygląd / jak naładować (PL · EN · DE)</title>
<!-- Wygenerowano przez docs/instrukcja_v4/karta_ladowanie.py — nie edytuj recznie. -->
<style>
{font_faces()}
{CSS}</style>
</head>
<body>
<div class="sheet">
  <div class="head"><div class="logo">{logo_svg(24)}</div><div class="titles">{titles}</div></div>
  <div class="band">{band}</div>
  <div class="steps">{''.join(steps)}</div>
  <div class="warn">{art_warn()}<div class="wx">{warn}</div></div>
  <div class="foot"><span>KalkMate v3</span><span>{esc(helps)} kontakt@kalkmate.pl · kalkmate.pl</span></div>
</div>
</body>
</html>
"""


def main(argv):
    h = os.path.join(DOCS, "kalkmate_karta_ladowanie.html")
    with open(h, "w", encoding="utf-8", newline="\n") as f:
        f.write(build_html())
    print("HTML", h)
    if "--no-pdf" not in argv:
        p = os.path.join(DOCS, "kalkmate_karta_ladowanie.pdf")
        print_pdf(h, p)
        print("PDF ", p)


if __name__ == "__main__":
    main(sys.argv[1:])
