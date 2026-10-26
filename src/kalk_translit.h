#pragma once
#ifndef KALK_TRANSLIT_H
#define KALK_TRANSLIT_H
// =====================================================================
//  UTF-8 -> ASCII (fonty u8g2 _tf rysuja Latin-1 bajt po bajcie, wiec
//  "a z ogonkiem" (C4 85) wychodzilo jako 2 krzaki). Wspolne dla notatek,
//  sprawdzianow (notes.h / tests.h) i podgladow w solve_screen.h
//  (_solUtf8ToAscii: historia, komunikaty bledow).
//  Nieznany znak -> "?". Wynik czysto ASCII, wiec zawijanie po N znakow
//  nie moze juz przeciac znaku wielobajtowego.
//
//  Jezyki UI: pl/en/de/cs/sk/lt/be/es/pt/fr/it. Cyrylica (be, tez ru/uk)
//  -> lacinka ASCII z dwuznakami (zh/sh/ch/kh/ts/ya/yu/yo), g->h jak w be.
//  Pelne rozwiazanie AI (drawUTF8) NIE przechodzi tedy — tam fonty
//  6x12_te / 6x12_t_cyrillic rysuja oryginalne znaki.
// =====================================================================
#include <Arduino.h>

struct _KalkTranslit { uint16_t cp; const char* ascii; };
static const _KalkTranslit _KALK_TRANSLIT[] = {
    // Polskie
    { 0x0104, "A" }, { 0x0105, "a" }, { 0x0106, "C" }, { 0x0107, "c" },
    { 0x0118, "E" }, { 0x0119, "e" }, { 0x0141, "L" }, { 0x0142, "l" },
    { 0x0143, "N" }, { 0x0144, "n" }, { 0x00D3, "O" }, { 0x00F3, "o" },
    { 0x015A, "S" }, { 0x015B, "s" }, { 0x0179, "Z" }, { 0x017A, "z" },
    { 0x017B, "Z" }, { 0x017C, "z" },
    // Niemieckie (UI ma wersje DE — ta sama konwencja "ue"/"oe" co w napisach)
    { 0x00C4, "Ae" }, { 0x00E4, "ae" }, { 0x00D6, "Oe" }, { 0x00F6, "oe" },
    { 0x00DC, "Ue" }, { 0x00FC, "ue" }, { 0x00DF, "ss" },
    // Inne czeste lacinskie
    { 0x00C9, "E" }, { 0x00E9, "e" }, { 0x00E8, "e" }, { 0x00EA, "e" },
    { 0x00E0, "a" }, { 0x00E1, "a" }, { 0x00ED, "i" }, { 0x00FA, "u" },
    { 0x010C, "C" }, { 0x010D, "c" }, { 0x011B, "e" }, { 0x0159, "r" },
    { 0x0160, "S" }, { 0x0161, "s" }, { 0x017D, "Z" }, { 0x017E, "z" },
    // Czeskie (UI ma wersje CS) — reszta poza powyzszymi
    { 0x00C1, "A" }, { 0x00CD, "I" }, { 0x00DA, "U" }, { 0x00DD, "Y" }, { 0x00FD, "y" },
    { 0x010E, "D" }, { 0x010F, "d" }, { 0x011A, "E" }, { 0x0147, "N" }, { 0x0148, "n" },
    { 0x0158, "R" }, { 0x0164, "T" }, { 0x0165, "t" }, { 0x016E, "U" }, { 0x016F, "u" },
    // Slowackie — reszta poza PL/CS (a z dwiema kropkami: patrz DE)
    { 0x013D, "L" }, { 0x013E, "l" }, { 0x0139, "L" }, { 0x013A, "l" },
    { 0x0154, "R" }, { 0x0155, "r" }, { 0x00D4, "O" }, { 0x00F4, "o" },
    // Litewskie — reszta poza PL/CS
    { 0x0116, "E" }, { 0x0117, "e" }, { 0x012E, "I" }, { 0x012F, "i" },
    { 0x0172, "U" }, { 0x0173, "u" }, { 0x016A, "U" }, { 0x016B, "u" },
    // Hiszpanskie / portugalskie / francuskie / wloskie — reszta
    { 0x00D1, "N" }, { 0x00F1, "n" }, { 0x00BF, "?" }, { 0x00A1, "!" },
    { 0x00AA, "a" }, { 0x00BA, "o" },
    { 0x00C0, "A" }, { 0x00C2, "A" }, { 0x00C3, "A" }, { 0x00E2, "a" }, { 0x00E3, "a" },
    { 0x00C7, "C" }, { 0x00E7, "c" },
    { 0x00C8, "E" }, { 0x00CA, "E" }, { 0x00CB, "E" }, { 0x00EB, "e" },
    { 0x00CC, "I" }, { 0x00CE, "I" }, { 0x00CF, "I" }, { 0x00EC, "i" }, { 0x00EE, "i" }, { 0x00EF, "i" },
    { 0x00D2, "O" }, { 0x00D5, "O" }, { 0x00F2, "o" }, { 0x00F5, "o" },
    { 0x00D9, "U" }, { 0x00DB, "U" }, { 0x00F9, "u" }, { 0x00FB, "u" },
    { 0x0152, "OE" }, { 0x0153, "oe" }, { 0x00C6, "AE" }, { 0x00E6, "ae" },
    { 0x0178, "Y" }, { 0x00FF, "y" },
    // Cyrylica (bialoruska + rosyjska/ukrainska) -> lacinka ASCII
    { 0x0410, "A" },  { 0x0430, "a" },  { 0x0411, "B" },  { 0x0431, "b" },
    { 0x0412, "V" },  { 0x0432, "v" },  { 0x0413, "H" },  { 0x0433, "h" },
    { 0x0490, "G" },  { 0x0491, "g" },  { 0x0414, "D" },  { 0x0434, "d" },
    { 0x0415, "E" },  { 0x0435, "e" },  { 0x0401, "Yo" }, { 0x0451, "yo" },
    { 0x0416, "Zh" }, { 0x0436, "zh" }, { 0x0417, "Z" },  { 0x0437, "z" },
    { 0x0406, "I" },  { 0x0456, "i" },  { 0x0418, "I" },  { 0x0438, "i" },
    { 0x0419, "J" },  { 0x0439, "j" },  { 0x041A, "K" },  { 0x043A, "k" },
    { 0x041B, "L" },  { 0x043B, "l" },  { 0x041C, "M" },  { 0x043C, "m" },
    { 0x041D, "N" },  { 0x043D, "n" },  { 0x041E, "O" },  { 0x043E, "o" },
    { 0x041F, "P" },  { 0x043F, "p" },  { 0x0420, "R" },  { 0x0440, "r" },
    { 0x0421, "S" },  { 0x0441, "s" },  { 0x0422, "T" },  { 0x0442, "t" },
    { 0x0423, "U" },  { 0x0443, "u" },  { 0x040E, "W" },  { 0x045E, "w" },
    { 0x0424, "F" },  { 0x0444, "f" },  { 0x0425, "Kh" }, { 0x0445, "kh" },
    { 0x0426, "Ts" }, { 0x0446, "ts" }, { 0x0427, "Ch" }, { 0x0447, "ch" },
    { 0x0428, "Sh" }, { 0x0448, "sh" }, { 0x0429, "Shch" }, { 0x0449, "shch" },
    { 0x042A, "" },   { 0x044A, "" },   { 0x042B, "Y" },  { 0x044B, "y" },
    { 0x042C, "'" },  { 0x044C, "'" },  { 0x042D, "E" },  { 0x044D, "e" },
    { 0x042E, "Yu" }, { 0x044E, "yu" }, { 0x042F, "Ya" }, { 0x044F, "ya" },
    { 0x0404, "Ye" }, { 0x0454, "ye" }, { 0x0407, "Yi" }, { 0x0457, "yi" },
    { 0x02BC, "'" },  // apostrof bialoruski (modifier letter apostrophe)
    // Typografia / niewidoczne
    { 0x00A0, " " }, { 0x00AD, "" }, { 0x200B, "" }, { 0xFEFF, "" },
    { 0x2013, "-" }, { 0x2014, "-" }, { 0x2212, "-" }, { 0x2026, "..." },
    { 0x201E, "\"" }, { 0x201D, "\"" }, { 0x201C, "\"" },
    { 0x00AB, "\"" }, { 0x00BB, "\"" },
    { 0x2018, "'" }, { 0x2019, "'" }, { 0x201A, "," }, { 0x2022, "*" },
    { 0x2032, "'" }, { 0x2033, "''" },
    // Matematyka / fizyka
    { 0x00D7, "x" }, { 0x00F7, "/" }, { 0x00B0, "deg" }, { 0x00B7, "*" },
    { 0x2264, "<=" }, { 0x2265, ">=" }, { 0x2260, "!=" }, { 0x00B1, "+/-" },
    { 0x2248, "~=" }, { 0x221E, "inf" }, { 0x221A, "sqrt" },
    { 0x2192, "->" }, { 0x2190, "<-" }, { 0x2194, "<->" },
    { 0x21D2, "=>" }, { 0x21D0, "<=" }, { 0x21D4, "<=>" },
    { 0x00B2, "^2" }, { 0x00B3, "^3" }, { 0x00B9, "^1" },
    { 0x00BC, "1/4" }, { 0x00BD, "1/2" }, { 0x00BE, "3/4" },
    { 0x2208, " in " }, { 0x2209, " not in " }, { 0x2205, "{}" },
    { 0x222A, " U " }, { 0x2229, " I " },
    { 0x2211, "SUM" }, { 0x220F, "PROD" }, { 0x222B, "INT" }, { 0x2202, "d" },
    { 0x00B5, "mu" },
    // Greckie
    { 0x0394, "delta" }, { 0x03A3, "SUM" }, { 0x03A9, "Omega" },
    { 0x03B1, "alfa" }, { 0x03B2, "beta" }, { 0x03B3, "gamma" }, { 0x03B4, "delta" },
    { 0x03B5, "eps" }, { 0x03B7, "eta" }, { 0x03B8, "theta" }, { 0x03BB, "lambda" },
    { 0x03BC, "mu" }, { 0x03BD, "nu" }, { 0x03C0, "pi" }, { 0x03C1, "rho" },
    { 0x03C3, "sigma" }, { 0x03C4, "tau" }, { 0x03C6, "fi" }, { 0x03C9, "omega" },
};
static const uint16_t _KALK_TRANSLIT_LEN = sizeof(_KALK_TRANSLIT) / sizeof(_KALK_TRANSLIT[0]);

static inline const char* _kalkTranslitCp(uint32_t cp) {
    if (cp <= 0xFFFF) {
        for (uint16_t k = 0; k < _KALK_TRANSLIT_LEN; k++) {
            if (_KALK_TRANSLIT[k].cp == cp) return _KALK_TRANSLIT[k].ascii;
        }
    }
    return "?";
}

static inline String _kalkUtf8ToAscii(const String& in) {
    const char* s = in.c_str();
    const int len = (int)in.length();
    String out;
    out.reserve(len);
    int i = 0;
    while (i < len) {
        uint8_t c = (uint8_t)s[i];
        if (c < 0x80) { out += (char)c; i++; continue; }
        uint32_t cp;
        int n;
        if      ((c & 0xE0) == 0xC0) { cp = c & 0x1F; n = 1; }
        else if ((c & 0xF0) == 0xE0) { cp = c & 0x0F; n = 2; }
        else if ((c & 0xF8) == 0xF0) { cp = c & 0x07; n = 3; }
        else { out += '?'; i++; continue; }      // bajt kontynuacji bez poczatku
        bool ok = (i + n < len);
        for (int k = 1; ok && k <= n; k++) {
            uint8_t cc = (uint8_t)s[i + k];
            if ((cc & 0xC0) != 0x80) ok = false;
            else cp = (cp << 6) | (cc & 0x3F);
        }
        if (!ok) { out += '?'; i++; continue; }  // uciety / zly ciag
        i += n + 1;
        out += _kalkTranslitCp(cp);
    }
    return out;
}

#endif // KALK_TRANSLIT_H
