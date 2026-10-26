"""Wyciaga teksty UI z firmware (wywolania helperow tlumaczen T/mT/_solT/...)
do tools/i18n/firmware_strings.json — klucz = tekst EN, wartosci = pl/de/cs
oraz pliki, w ktorych tekst wystepuje. Uruchamiac z katalogu glownego repo:
    python tools/i18n/extract_firmware_strings.py
"""
import glob
import json
import re

HELPERS = re.compile(
    r"(?<![A-Za-z0-9_])(T|mT|_solT|_wifiT|_infoT|_otaT|_abT|_notesTr|_testsTr|_stT|_powT)\s*\(")
LIT = re.compile(r'"((?:[^"\\]|\\.)*)"')


def parse_args(s, i):
    args, cur = [], None
    while i < len(s):
        c = s[i]
        if c.isspace():
            i += 1
            continue
        if c == '"':
            m = LIT.match(s, i)
            cur = (cur or "") + m.group(1)
            i = m.end()
            continue
        if c == ",":
            args.append(cur)
            cur = None
            i += 1
            continue
        if c == ")":
            args.append(cur)
            return args
        args.append(None)  # argument nie-literal (zmienna) - koniec
        return args
    return args


# Tablice napisow per jezyk poza helperami, np. menuItemsEN[] / _WB_NAMES_EN[5]
# (rodzenstwo: ta sama nazwa z PL/DE/CS zamiast EN). W firmware dla jezyka
# >= 4 tlumaczone przez kalkTrExtra(<element tablicy EN>, lang).
ARRAY_EN = re.compile(r"(?<![A-Za-z0-9_])([A-Za-z0-9_]*)EN\s*\[[^\]]*\]\s*=\s*\{")


def array_items(s, name):
    m = re.search(r"(?<![A-Za-z0-9_])" + re.escape(name) + r"\s*\[[^\]]*\]\s*=\s*\{", s)
    if not m:
        return []
    end = s.index("}", m.end())
    return [x.group(1) for x in LIT.finditer(s, m.end(), end)]


def main():
    out, files = {}, {}
    for f in sorted(glob.glob("src/*.h")) + ["src/main.cpp"]:
        s = open(f, encoding="utf-8").read()
        fname = f.replace("\\", "/").split("/")[-1]
        for m in HELPERS.finditer(s):
            a = parse_args(s, m.end())
            if len(a) >= 2 and a[1]:
                en = a[1]
                out.setdefault(en, {"pl": a[0],
                                    "de": a[2] if len(a) > 2 else None,
                                    "cs": a[3] if len(a) > 3 else None})
                files.setdefault(en, set()).add(fname)
        for m in ARRAY_EN.finditer(s):
            pre = m.group(1)
            ens = array_items(s, pre + "EN")
            pls, des, css = (array_items(s, pre + x) for x in ("PL", "DE", "CS"))
            for i, en in enumerate(ens):
                if not en:
                    continue
                out.setdefault(en, {"pl": pls[i] if i < len(pls) else None,
                                    "de": des[i] if i < len(des) else None,
                                    "cs": css[i] if i < len(css) else None})
                files.setdefault(en, set()).add(fname)
    for k in out:
        out[k]["files"] = sorted(files[k])
    with open("tools/i18n/firmware_strings.json", "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
    print(len(out), "unikalnych tekstow EN,", sum(len(k) for k in out), "znakow")


if __name__ == "__main__":
    main()
