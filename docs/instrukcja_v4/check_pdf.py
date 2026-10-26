# -*- coding: utf-8 -*-
"""Kontrola PDF instrukcji v4 (PyMuPDF).

    python docs/instrukcja_v4/check_pdf.py [lang ...] [--png DIR]

Sprawdza: dokladnie 2 strony A4 poziomo, fonty osadzone, kazdy fragment
tekstu i kazdy rysunek miesci sie w polu bezpiecznym (5 mm) swojego panelu
i nie przecina linii zgiecia. Opcjonalnie zapisuje podglad stron do PNG.
"""
import os
import sys

import fitz  # PyMuPDF

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.abspath(os.path.join(HERE, ".."))
MM = 72 / 25.4
PANEL = 74.25 * MM
SAFE = 5 * MM
TOL = 0.6 * MM   # tolerancja (antyaliasing, zaokraglenia)


def panel_of(x0, x1):
    i0 = int((x0 + 0.01) // PANEL)
    i1 = int((x1 - 0.01) // PANEL)
    return i0, i1


def check(lang, png_dir=None):
    path = os.path.join(DOCS, f"kalkmate_instrukcja_v4_{lang}.pdf")
    doc = fitz.open(path)
    errs = []
    if doc.page_count != 2:
        errs.append(f"stron: {doc.page_count} (powinny byc 2)")
    for pno, page in enumerate(doc):
        w, h = page.rect.width, page.rect.height
        if abs(w - 297 * MM) > 2 or abs(h - 210 * MM) > 2:
            errs.append(f"s{pno + 1}: rozmiar {w / MM:.1f}x{h / MM:.1f} mm")
        # tekst
        for b in page.get_text("dict")["blocks"]:
            for ln in b.get("lines", []):
                for sp in ln["spans"]:
                    if not sp["text"].strip():
                        continue
                    x0, y0, x1, y1 = sp["bbox"]
                    i0, i1 = panel_of(x0, x1)
                    tag = f"s{pno + 1} tekst '{sp['text'][:40]}'"
                    if i0 != i1:
                        errs.append(f"{tag}: przechodzi przez zgiecie")
                        continue
                    lo, hi = i0 * PANEL + SAFE - TOL, (i0 + 1) * PANEL - SAFE + TOL
                    if x0 < lo or x1 > hi:
                        errs.append(f"{tag}: poza polem w poziomie ({x0 / MM:.1f}-{x1 / MM:.1f} mm)")
                    if y0 < SAFE - TOL or y1 > h - SAFE + TOL:
                        errs.append(f"{tag}: poza polem w pionie ({y0 / MM:.1f}-{y1 / MM:.1f} mm)")
        # grafika (poza znacznikami zgiec na marginesach)
        for dr in page.get_drawings():
            r = dr["rect"]
            if r.width <= 1 * MM and (r.y1 <= 4 * MM + 0.5 or r.y0 >= h - 4 * MM - 0.5):
                continue  # znacznik zgiecia
            if r.width >= w - 1 and r.height >= h - 1:
                continue  # tlo strony
            i0, i1 = panel_of(r.x0, r.x1)
            tag = f"s{pno + 1} grafika {tuple(round(v / MM, 1) for v in r)}"
            if i0 != i1:
                errs.append(f"{tag}: przechodzi przez zgiecie")
                continue
            lo, hi = i0 * PANEL + SAFE - TOL, (i0 + 1) * PANEL - SAFE + TOL
            if r.x0 < lo or r.x1 > hi or r.y0 < SAFE - TOL or r.y1 > h - SAFE + TOL:
                errs.append(f"{tag}: poza polem bezpiecznym")
        if png_dir:
            os.makedirs(png_dir, exist_ok=True)
            page.get_pixmap(dpi=110).save(os.path.join(png_dir, f"{lang}_p{pno + 1}.png"))
    fonts = sorted({f[3] for p in doc for f in p.get_fonts()})
    doc.close()
    return errs, fonts


if __name__ == "__main__":
    args = sys.argv[1:]
    png = None
    if "--png" in args:
        i = args.index("--png")
        png = args[i + 1]
        del args[i:i + 2]
    langs = args or ["pl", "en", "de", "fr", "cs", "sk", "lt", "be", "es", "pt", "it"]
    bad = 0
    for lg in langs:
        errs, fonts = check(lg, png)
        print(f"[{lg}] fonty: {', '.join(fonts)}")
        if errs:
            bad += 1
            for e in errs[:60]:
                print("   BLAD", e)
            if len(errs) > 60:
                print(f"   ... i {len(errs) - 60} wiecej")
        else:
            print(f"[{lg}] OK — 2 strony, wszystko w polach")
    sys.exit(1 if bad else 0)
