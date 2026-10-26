"""Generator src/i18n_extra.h — tlumaczenia UI firmware dla jezykow 4..10.

Jezyki 0..3 (PL/EN/DE/CS) siedza bezposrednio w wywolaniach helperow
(T/mT/_solT/...). Kolejne jezyki NIE dopisuja argumentow do wywolan — helper
przy kalkSettings.language >= 4 wola kalkTrExtra(en, lang), ktora szuka
tlumaczenia po tekscie EN w tabeli wygenerowanej przez ten skrypt.

Wejscie (uruchamiac z katalogu glownego repo):
    tools/i18n/firmware_strings.json  — klucz = tekst EN (forma z kodu C,
                                        np. "\\n"); generuje extract_firmware_strings.py
    tools/i18n/fw_<kod>.json          — {"<tekst EN>": "<tlumaczenie>"}; brak
                                        pliku = jezyk pomijany (fallback EN)
Wyjscie:
    src/i18n_extra.h

    python tools/i18n/gen_firmware_i18n.py

Ostrzezenia (nie bledy — naglowek i tak powstaje):
  - brakujace / nadmiarowe klucze wzgledem firmware_strings.json,
  - tlumaczenia z nie-ASCII (fonty OLED _tf nie maja tych glyphow),
  - tlumaczenia dluzsze niz max(len(en), len(de)) + 2 (bufory/szerokosc ekranu),
  - rozne spacje na poczatku/koncu niz w EN (wyrownanie kolumn w menu).
Tlumaczenie z INNYMI specyfikatorami printf niz EN (%s/%d/...) jest POMIJANE
(fallback EN) — zly specyfikator w snprintf to crash, nie kosmetyka.
"""
import json
import os
import re
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC_JSON = os.path.join(ROOT, "tools", "i18n", "firmware_strings.json")
OUT_H = os.path.join(ROOT, "src", "i18n_extra.h")

# Kolejnosc = kalkSettings.language - 4 (4=sk ... 10=it)
LANGS = ("sk", "lt", "be", "es", "pt", "fr", "it")
FIRST_LANG = 4

_ESC = {"n": "\n", "t": "\t", "r": "\r", "\\": "\\", '"': '"', "'": "'",
        "0": "\0", "a": "\a", "b": "\b", "f": "\f", "v": "\v", "?": "?"}
# Bez flagi ' ' — "X% of Y" (zwykly tekst przekazywany jako %s) nie jest "% o".
_FMT = re.compile(r"%(?:%|[-+#0]*(?:\d+|\*)?(?:\.(?:\d+|\*))?(?:hh|h|ll|l|z|j|t|L)?[diouxXeEfFgGcspn])")


def c_unescape(s):
    """Tekst w formie literalu C (jak w kluczach firmware_strings.json) -> realny tekst.
    Prawdziwe znaki sterujace (np. tlumacz wpisal \n w JSON jako nowa linie)
    zostaja bez zmian, wiec obie formy daja to samo."""
    out, i = [], 0
    while i < len(s):
        c = s[i]
        if c != "\\" or i + 1 >= len(s):
            out.append(c)
            i += 1
            continue
        n = s[i + 1]
        if n == "x":
            m = re.match(r"[0-9a-fA-F]{1,2}", s[i + 2:])
            if m:
                out.append(chr(int(m.group(0), 16)))
                i += 2 + len(m.group(0))
                continue
        if n in "01234567":
            m = re.match(r"[0-7]{1,3}", s[i + 1:])
            out.append(chr(int(m.group(0), 8)))
            i += 1 + len(m.group(0))
            continue
        out.append(_ESC.get(n, n))
        i += 2
    return "".join(out)


def c_literal(s):
    """Realny tekst -> literal C (UTF-8; hex-escape dla znakow sterujacych,
    rozdzielony od nastepnej cyfry hex przez zamkniecie/otwarcie literalu)."""
    out = ['"']
    b = s.encode("utf-8")
    prev_hex = False
    for byte in b:
        ch = chr(byte)
        if prev_hex and ch in "0123456789abcdefABCDEF":
            out.append('""')
        prev_hex = False
        if ch == "\\":
            out.append("\\\\")
        elif ch == '"':
            out.append('\\"')
        elif ch == "\n":
            out.append("\\n")
        elif ch == "\t":
            out.append("\\t")
        elif ch == "\r":
            out.append("\\r")
        elif byte < 0x20 or byte == 0x7F or byte >= 0x80:
            out.append("\\x%02x" % byte)
            prev_hex = True
        elif ch == "?" and out[-1].endswith("?"):
            out.append("\\?")   # bez trigrafow
        else:
            out.append(ch)
    out.append('"')
    return "".join(out)


def load_json(path, warn):
    try:
        with open(path, encoding="utf-8-sig") as fh:
            d = json.load(fh)
    except (OSError, ValueError) as e:
        warn(f"{os.path.basename(path)}: nie da sie wczytac ({e}) — jezyk pominiety")
        return None
    if not isinstance(d, dict):
        warn(f"{os.path.basename(path)}: oczekiwano obiektu JSON — jezyk pominiety")
        return None
    return d


def main():
    warnings = []
    warn = warnings.append

    with open(SRC_JSON, encoding="utf-8") as fh:
        src = json.load(fh)
    # klucz (forma C) -> (tekst EN, tekst DE)
    keys = {k: (c_unescape(k), c_unescape(v.get("de") or "") if isinstance(v, dict) else "")
            for k, v in src.items()}
    by_en = {}
    for k, (en, _de) in keys.items():
        by_en.setdefault(en, k)

    table = {}          # en (realny tekst) -> [tlumaczenie albo None] * len(LANGS)
    present = []
    stats = {}
    for li, lang in enumerate(LANGS):
        path = os.path.join(ROOT, "tools", "i18n", f"fw_{lang}.json")
        if not os.path.exists(path):
            stats[lang] = "brak pliku (fallback EN)"
            continue
        d = load_json(path, warn)
        if d is None:
            stats[lang] = "blad pliku (fallback EN)"
            continue
        present.append(lang)
        used = skipped = 0
        seen = set()
        for tk, tv in d.items():
            en = c_unescape(tk)
            k = tk if tk in keys else by_en.get(en)
            if k is None:
                warn(f"[{lang}] nadmiarowy klucz (nie ma go w firmware_strings.json): {tk!r}")
                continue
            seen.add(k)
            if not isinstance(tv, str) or not tv.strip():
                warn(f"[{lang}] puste tlumaczenie: {tk!r}")
                continue
            en, de = keys[k]
            tr = c_unescape(tv)
            if _FMT.findall(tr) != _FMT.findall(en):
                warn(f"[{lang}] POMINIETE — inne specyfikatory printf niz EN "
                     f"{_FMT.findall(en)} vs {_FMT.findall(tr)}: {tk!r} -> {tv!r}")
                skipped += 1
                continue
            if not tr.isascii():
                bad = "".join(sorted({c for c in tr if not c.isascii()}))
                warn(f"[{lang}] nie-ASCII ({bad}): {tk!r} -> {tv!r}")
            limit = max(len(en), len(de)) + 2
            if len(tr) > limit:
                warn(f"[{lang}] za dlugie ({len(tr)} > {limit}): {tk!r} -> {tv!r}")
            lead_en, lead_tr = len(en) - len(en.lstrip(" ")), len(tr) - len(tr.lstrip(" "))
            trail_en, trail_tr = len(en) - len(en.rstrip(" ")), len(tr) - len(tr.rstrip(" "))
            if (lead_en > 0) != (lead_tr > 0) or (trail_en > 0) != (trail_tr > 0):
                warn(f"[{lang}] inne spacje na poczatku/koncu niz EN: {tk!r} -> {tv!r}")
            table.setdefault(en, [None] * len(LANGS))[li] = tr
            used += 1
        missing = [k for k in keys if k not in seen]
        for k in missing:
            warn(f"[{lang}] brak klucza: {k!r}")
        stats[lang] = f"{used} tlumaczen, {len(missing)} brakujacych, {skipped} pominietych"

    entries = sorted(table.items(), key=lambda kv: kv[0].encode("utf-8"))  # = strcmp

    lines = [
        "// AUTOGENEROWANE przez tools/i18n/gen_firmware_i18n.py — NIE EDYTUJ RECZNIE.",
        "// Zrodla: tools/i18n/firmware_strings.json + tools/i18n/fw_<kod>.json.",
        "//",
        "// Tlumaczenia UI dla jezykow 4..10 (kalkSettings.language):",
        "//   " + ", ".join(f"{FIRST_LANG + i}={l}" for i, l in enumerate(LANGS)),
        "// Helpery 4-argumentowe (T, mT, _solT, ...) przy language >= 4 zwracaja",
        "// kalkTrExtra(en, language): wyszukiwanie binarne po tekscie EN (strcmp)",
        "// w tablicy posortowanej bajtowo. Brak tlumaczenia / brak pliku jezyka -> en.",
        f"// Jezyki z plikiem: {', '.join(present) if present else '(zaden)'}; wpisow: {len(entries)}.",
        "#pragma once",
        "#ifndef KALK_I18N_EXTRA_H",
        "#define KALK_I18N_EXTRA_H",
        "",
        "#include <stdint.h>",
        "#include <string.h>",
        "",
        f"#define KALK_TR_EXTRA_FIRST {FIRST_LANG}",
        f"#define KALK_TR_EXTRA_LANGS {len(LANGS)}",
        f"#define KALK_TR_EXTRA_N     {len(entries)}",
        "",
        "struct KalkTrExtraEntry {",
        "    const char* en;",
        "    const char* tr[KALK_TR_EXTRA_LANGS];   // nullptr = brak -> en",
        "};",
        "",
    ]
    if entries:
        lines.append("// const -> .rodata (flash). Kolejnosc wierszy = strcmp(en) rosnaco.")
        lines.append("static const KalkTrExtraEntry _KALK_TR_EXTRA[KALK_TR_EXTRA_N] = {")
        for en, trs in entries:
            cells = ", ".join(c_literal(t) if t is not None else "nullptr" for t in trs)
            lines.append(f"    {{ {c_literal(en)},")
            lines.append(f"      {{ {cells} }} }},")
        lines.append("};")
        lines.append("")
    lines += [
        "// Tlumaczenie tekstu EN na jezyk `lang` (4..10). Zawsze zwraca niepusty",
        "// wskaznik: tlumaczenie albo `en` (fallback).",
        "static inline const char* kalkTrExtra(const char* en, uint8_t lang) {",
        "    if (!en || lang < KALK_TR_EXTRA_FIRST || lang >= KALK_TR_EXTRA_FIRST + KALK_TR_EXTRA_LANGS) return en;",
    ]
    if entries:
        lines += [
            "    int lo = 0, hi = KALK_TR_EXTRA_N - 1;",
            "    while (lo <= hi) {",
            "        const int mid = (lo + hi) >> 1;",
            "        const int c = strcmp(en, _KALK_TR_EXTRA[mid].en);",
            "        if (c == 0) {",
            "            const char* t = _KALK_TR_EXTRA[mid].tr[lang - KALK_TR_EXTRA_FIRST];",
            "            return t ? t : en;",
            "        }",
            "        if (c < 0) hi = mid - 1; else lo = mid + 1;",
            "    }",
        ]
    lines += [
        "    return en;",
        "}",
        "",
        "#endif // KALK_I18N_EXTRA_H",
        "",
    ]
    with open(OUT_H, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(lines))

    for w in warnings:
        print("UWAGA:", w)
    print(f"\n{os.path.relpath(OUT_H, ROOT)}: {len(entries)} wpisow (z {len(keys)} tekstow EN), "
          f"{len(warnings)} ostrzezen")
    for lang in LANGS:
        print(f"  {FIRST_LANG + LANGS.index(lang):2d} {lang}: {stats[lang]}")
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(main())
