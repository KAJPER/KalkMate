#pragma once
// =====================================================================
//  notes.h — offline notatki uzytkownika synchronizowane z serwera
//
//  Storage: SPIFFS — partycja 192 KB w min_spiffs.csv
//  Format: jeden plik /notes.json zawiera tablice obiektow:
//    [{"t":"tytul","c":"tresc"},{"t":"...","c":"..."}]
//  (wartosci t/c nadal JSON-encoded — skopiowane 1:1 z odpowiedzi serwera)
//
//  Sync: notesSync(licenseCode) wykonuje GET /api/device/notes,
//  parsuje i zapisuje do SPIFFS. Wywoluj z menu lub przy starcie.
//
//  Read: notesCount(), notesGet(idx, &out) — czytanie do prezentacji.
//
//  Ten plik zawiera tez wspolne helpery JSON / UTF-8 / zapisu SPIFFS
//  uzywane przez tests.h (dolaczany po notes.h).
// =====================================================================

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <FS.h>
#include <SPIFFS.h>
#include <vector>
#include "kalkmate_certs.h"
#include "wifi_persist.h"

#ifndef KALK_SERVER_URL
#error "notes.h wymaga KALK_SERVER_URL"
#endif

#define _NOTES_FILE         "/notes.json"
#define _NOTES_TMP_FILE     "/notes.tmp"
#define _NOTES_ENDPOINT     KALK_SERVER_URL "/api/device/notes"
#define _NOTES_HTTP_TIMEOUT 30000
#define _NOTES_MAX_BYTES    (60 * 1024)    // limit pliku na SPIFFS — bezpiecznie < 192 KB
#define _NOTES_MAX_RESPONSE (256 * 1024)   // limit odpowiedzi serwera w RAM

// Ekrany "do czytania" (notatka / sprawdzian): zamiast trwalej blokady snu
// dluzszy timeout — zapomniane urzadzenie w koncu zasnie.
#define _KALK_READ_TIMEOUT_MS  (10UL * 60UL * 1000UL)

struct NoteEntry {
    String title;
    String content;
};

static bool _notesFsReady = false;

inline bool _notesEnsureFs() {
    if (_notesFsReady) return true;
    if (!SPIFFS.begin(true)) {   // true = format if mount fails
        Serial.println("[NOTES] SPIFFS mount failed");
        return false;
    }
    _notesFsReady = true;
    return true;
}

// =====================================================================
//  JSON-aware helpery (notes + tests). Wszystkie pomijaja zawartosc
//  stringow — nawiasy/cudzyslowy w tresci (LaTeX "\left\{", przedzialy
//  "[a, b)" itp.) nie psuja indeksowania obiektow.
// =====================================================================

// q = indeks otwierajacego ". Zwraca indeks zamykajacego " albo -1.
// Escape (\x) zawsze zajmuje 2 znaki, wiec \\" konczy string poprawnie.
static inline int _jsonSkipStr(const char* s, int len, int q) {
    if (q < 0 || q >= len || s[q] != '"') return -1;
    int i = q + 1;
    while (i < len) {
        char c = s[i];
        if (c == '\\') i += 2;
        else if (c == '"') return i;
        else i++;
    }
    return -1;
}

// Pasujacy nawias zamykajacy dla otwierajacego na openPos. -1 gdy brak.
static inline int _jsonMatch(const char* s, int len, int openPos, char open, char close) {
    int depth = 0;
    for (int i = openPos; i < len; i++) {
        char c = s[i];
        if (c == '"') {
            i = _jsonSkipStr(s, len, i);
            if (i < 0) return -1;
            continue;
        }
        if (c == open) depth++;
        else if (c == close) {
            depth--;
            if (depth == 0) return i;
        }
    }
    return -1;
}

// Nastepny obiekt {...} od pozycji from (pomija stringi). Zwraca indeks '{'
// (objEnd = indeks pasujacego '}') albo -1.
static inline int _jsonNextObj(const char* s, int len, int from, int& objEnd) {
    for (int i = from; i < len; i++) {
        char c = s[i];
        if (c == '"') {
            i = _jsonSkipStr(s, len, i);
            if (i < 0) return -1;
            continue;
        }
        if (c == '{') {
            objEnd = _jsonMatch(s, len, i, '{', '}');
            return objEnd < 0 ? -1 : i;
        }
    }
    return -1;
}

// Pole "name":"..." na PIERWSZYM poziomie obiektu [objS..objE] (objS = '{').
// vS/vE = zakres wartosci bez cudzyslowow (vE wylacznie), nadal JSON-encoded.
// false gdy brak pola albo wartosc nie jest stringiem (np. null).
static inline bool _jsonFindField(const char* s, int objS, int objE,
                                  const char* name, int& vS, int& vE) {
    const int nameLen = (int)strlen(name);
    const int lim = objE + 1;
    int depth = 0;
    for (int i = objS; i <= objE; i++) {
        char c = s[i];
        if (c == '"') {
            int e = _jsonSkipStr(s, lim, i);
            if (e < 0) return false;
            if (depth == 1 && e - i - 1 == nameLen && memcmp(s + i + 1, name, nameLen) == 0) {
                int j = e + 1;
                while (j <= objE && (s[j] == ' ' || s[j] == '\t' || s[j] == '\r' || s[j] == '\n')) j++;
                if (j <= objE && s[j] == ':') {   // klucz (wartosc nigdy nie ma ':' po sobie)
                    j++;
                    while (j <= objE && (s[j] == ' ' || s[j] == '\t' || s[j] == '\r' || s[j] == '\n')) j++;
                    if (j > objE || s[j] != '"') return false;
                    int ve = _jsonSkipStr(s, lim, j);
                    if (ve < 0) return false;
                    vS = j + 1;
                    vE = ve;
                    return true;
                }
            }
            i = e;
            continue;
        }
        if (c == '{' || c == '[') depth++;
        else if (c == '}' || c == ']') depth--;
    }
    return false;
}

// Dopisuje code point jako UTF-8 (\u0000 pomijamy — ucialby C-string).
static inline void _kalkAppendUtf8(String& out, uint32_t cp) {
    if (cp == 0) return;
    if (cp < 0x80) {
        out += (char)cp;
    } else if (cp < 0x800) {
        out += (char)(0xC0 | (cp >> 6));
        out += (char)(0x80 | (cp & 0x3F));
    } else if (cp < 0x10000) {
        out += (char)(0xE0 | (cp >> 12));
        out += (char)(0x80 | ((cp >> 6) & 0x3F));
        out += (char)(0x80 | (cp & 0x3F));
    } else {
        out += (char)(0xF0 | (cp >> 18));
        out += (char)(0x80 | ((cp >> 12) & 0x3F));
        out += (char)(0x80 | ((cp >> 6) & 0x3F));
        out += (char)(0x80 | (cp & 0x3F));
    }
}

// 4 cyfry hex -> wartosc, -1 gdy niepoprawne.
static inline int _kalkHex4(const char* s) {
    int v = 0;
    for (int k = 0; k < 4; k++) {
        char c = s[k];
        v <<= 4;
        if (c >= '0' && c <= '9') v |= c - '0';
        else if (c >= 'a' && c <= 'f') v |= c - 'a' + 10;
        else if (c >= 'A' && c <= 'F') v |= c - 'A' + 10;
        else return -1;
    }
    return v;
}

// Dekoder escape'ow JSON — JEDNOPRZEBIEGOWY, znak po znaku. Poprzednia
// wersja (seria String::replace) zamieniala "\n" takze wewnatrz "\\neq",
// "\\nu", "\\nabla", "\\notin", "\\neg" (LaTeX) i psula je.
// Wynik: UTF-8 (\uXXXX zamieniane na bajty UTF-8; transliteracja do ASCII
// osobno w _kalkUtf8ToAscii). \t -> spacja (OLED nie ma tabulatora), \r pomijane.
static inline String _jsonUnescape(const char* s, int len) {
    String out;
    out.reserve(len);
    for (int i = 0; i < len; i++) {
        char c = s[i];
        if (c != '\\' || i + 1 >= len) { out += c; continue; }
        char e = s[++i];
        switch (e) {
            case '"':  out += '"';  break;
            case '\\': out += '\\'; break;
            case '/':  out += '/';  break;
            case 'n':  out += '\n'; break;
            case 't':  out += ' ';  break;
            case 'r':  break;
            case 'b':  break;
            case 'f':  break;
            case 'u': {
                int cp = (i + 4 < len) ? _kalkHex4(s + i + 1) : -1;
                if (cp < 0) { out += '?'; break; }      // uszkodzone \u
                i += 4;
                uint32_t full = (uint32_t)cp;
                if (cp >= 0xD800 && cp <= 0xDBFF) {     // para surogatow (np. emoji)
                    int lo = -1;
                    if (i + 6 < len && s[i + 1] == '\\' && s[i + 2] == 'u') lo = _kalkHex4(s + i + 3);
                    if (lo >= 0xDC00 && lo <= 0xDFFF) {
                        full = 0x10000 + (((uint32_t)cp - 0xD800) << 10) + ((uint32_t)lo - 0xDC00);
                        i += 6;
                    } else {
                        full = '?';
                    }
                } else if (cp >= 0xDC00 && cp <= 0xDFFF) {
                    full = '?';                          // samotny surogat
                }
                _kalkAppendUtf8(out, full);
                break;
            }
            default:   out += e; break;                  // nieznany escape — zostaw znak
        }
    }
    return out;
}

// =====================================================================
//  UTF-8 -> ASCII (fonty u8g2 _tf rysuja Latin-1 bajt po bajcie, wiec
//  "a z ogonkiem" (C4 85) wychodzilo jako 2 krzaki). Wspolne dla notatek i sprawdzianow.
//  Nieznany znak -> "?". Wynik czysto ASCII, wiec zawijanie po N znakow
//  nie moze juz przeciac znaku wielobajtowego.
// =====================================================================
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

// =====================================================================
//  Pliki wpisow [{"t":"..","c":".."},...] na SPIFFS (notes + tests)
// =====================================================================

// Caly plik do bufora (PSRAM gdy jest). nullptr gdy blad. Zwolnic free().
static inline char* _kalkLoadFile(const char* path, int& outLen) {
    outLen = 0;
    File f = SPIFFS.open(path, "r");
    if (!f) return nullptr;
    size_t sz = f.size();
    char* buf = (char*)ps_malloc(sz + 1);
    if (!buf) buf = (char*)malloc(sz + 1);
    if (!buf) { f.close(); return nullptr; }
    size_t n = sz ? f.read((uint8_t*)buf, sz) : 0;
    f.close();
    buf[n] = '\0';
    outLen = (int)n;
    return buf;
}

// Liczba wpisow; gdy titles != nullptr — takze tytuly (zdekodowane, ASCII).
static inline int _kalkEntriesScan(const char* path, std::vector<String>* titles) {
    if (titles) titles->clear();
    if (!SPIFFS.exists(path)) return 0;
    int len = 0;
    char* buf = _kalkLoadFile(path, len);
    if (!buf) return 0;
    int count = 0, pos = 0, objE = 0;
    while (true) {
        int objS = _jsonNextObj(buf, len, pos, objE);
        if (objS < 0) break;
        if (titles) {
            int vS = 0, vE = 0;
            String t;
            if (_jsonFindField(buf, objS, objE, "t", vS, vE)) {
                t = _kalkUtf8ToAscii(_jsonUnescape(buf + vS, vE - vS));
            }
            titles->push_back(t);
        }
        count++;
        pos = objE + 1;
    }
    free(buf);
    return count;
}

// Wpis nr idx: tytul (zdekodowany, ASCII) + tresc (zdekodowana; ASCII gdy
// asciiContent — sprawdziany transliteruja dopiero po testsFormat, bo
// np. "∅" -> "{}" zniknalby przy usuwaniu nawiasow grupujacych LaTeX).
static inline bool _kalkEntryGet(const char* path, int idx, String& title, String& content,
                                 bool asciiContent = true) {
    title = "";
    content = "";
    if (!SPIFFS.exists(path)) return false;
    int len = 0;
    char* buf = _kalkLoadFile(path, len);
    if (!buf) return false;
    int pos = 0, objE = 0, cur = 0;
    bool found = false;
    while (true) {
        int objS = _jsonNextObj(buf, len, pos, objE);
        if (objS < 0) break;
        if (cur == idx) {
            int vS = 0, vE = 0;
            if (_jsonFindField(buf, objS, objE, "t", vS, vE)) {
                title = _kalkUtf8ToAscii(_jsonUnescape(buf + vS, vE - vS));
            }
            if (_jsonFindField(buf, objS, objE, "c", vS, vE)) {
                content = _jsonUnescape(buf + vS, vE - vS);
                if (asciiContent) content = _kalkUtf8ToAscii(content);
            }
            found = true;
            break;
        }
        cur++;
        pos = objE + 1;
    }
    free(buf);
    return found;
}

// Wpis z odpowiedzi serwera: zakresy wartosci "title"/"content" (-1 = brak).
struct _KalkEnt { int tS, tE, cS, cE; };

// Parsuje "<key>":[{"title":"..","content":".."},...] z odpowiedzi serwera.
// Zatrzymuje sie przed wpisem, ktory przekroczylby maxBytes pliku wyjsciowego
// (zapisuje pelne wpisy, nigdy uciety JSON). outBytes = dokladny rozmiar pliku.
// Zwraca: 1 = OK, 0 = brak pola key, -1 = uszkodzona / niepelna tablica.
static inline int _kalkParseEntries(const char* b, int len, const char* key, size_t maxBytes,
                                    std::vector<_KalkEnt>& ents, size_t& outBytes,
                                    const char* tag) {
    ents.clear();
    outBytes = 2;   // "[" + "]"
    char pat[24];
    snprintf(pat, sizeof(pat), "\"%s\":", key);
    const char* p = (const char*)memmem(b, len, pat, strlen(pat));
    if (!p) return 0;
    int arrStart = -1;
    for (int i = (int)(p - b); i < len; i++) {
        if (b[i] == '[') { arrStart = i; break; }
    }
    if (arrStart < 0) return 0;
    // JSON-aware koniec tablicy — brak = ucieta odpowiedz
    int arrEnd = _jsonMatch(b, len, arrStart, '[', ']');
    if (arrEnd < 0) {
        Serial.printf("[%s] brak konca tablicy (ucieta odpowiedz?)\n", tag);
        return -1;
    }
    int cursor = arrStart + 1;
    while (true) {
        while (cursor < arrEnd &&
               (b[cursor] == ' ' || b[cursor] == '\t' || b[cursor] == '\n' ||
                b[cursor] == '\r' || b[cursor] == ',')) cursor++;
        if (cursor >= arrEnd) break;                 // koniec tablicy
        if (b[cursor] != '{') {
            Serial.printf("[%s] nieoczekiwany znak w tablicy @%d\n", tag, cursor);
            return -1;
        }
        int objEnd = _jsonMatch(b, len, cursor, '{', '}');
        if (objEnd < 0 || objEnd > arrEnd) {
            Serial.printf("[%s] obj parse fail @%d\n", tag, cursor);
            return -1;
        }
        _KalkEnt e = { -1, -1, -1, -1 };
        if (!_jsonFindField(b, cursor, objEnd, "title", e.tS, e.tE)) e.tS = e.tE = -1;
        if (!_jsonFindField(b, cursor, objEnd, "content", e.cS, e.cE)) e.cS = e.cE = -1;
        // {"t":"<t>","c":"<c>"} = 15 znakow + wartosci (+ przecinek)
        size_t entBytes = 15 + (e.tS >= 0 ? (size_t)(e.tE - e.tS) : 0)
                             + (e.cS >= 0 ? (size_t)(e.cE - e.cS) : 0)
                             + (ents.empty() ? 0 : 1);
        if (outBytes + entBytes > maxBytes) {
            Serial.printf("[%s] limit %u B — pomijam dalsze wpisy (zapisano %u)\n",
                          tag, (unsigned)maxBytes, (unsigned)ents.size());
            break;
        }
        outBytes += entBytes;
        ents.push_back(e);
        cursor = objEnd + 1;
    }
    return 1;
}

static inline bool _kalkPutN(File& f, const char* s, size_t n) {
    return n == 0 || f.write((const uint8_t*)s, n) == n;
}
static inline bool _kalkPut(File& f, const char* s) { return _kalkPutN(f, s, strlen(s)); }

// Zapis wpisow w formacie pliku. false = blad zapisu (np. brak miejsca).
static inline bool _kalkWriteEntries(File& f, const char* b, const std::vector<_KalkEnt>& ents) {
    if (!_kalkPut(f, "[")) return false;
    for (size_t k = 0; k < ents.size(); k++) {
        const _KalkEnt& e = ents[k];
        if (k && !_kalkPut(f, ",")) return false;
        if (!_kalkPut(f, "{\"t\":\"")) return false;
        if (e.tS >= 0 && !_kalkPutN(f, b + e.tS, (size_t)(e.tE - e.tS))) return false;
        if (!_kalkPut(f, "\",\"c\":\"")) return false;
        if (e.cS >= 0 && !_kalkPutN(f, b + e.cS, (size_t)(e.cE - e.cS))) return false;
        if (!_kalkPut(f, "\"}")) return false;
    }
    return _kalkPut(f, "]");
}

// Zapis "atomowy": najpierw plik tymczasowy, podmiana (remove+rename) dopiero
// gdy calosc zapisana i rozmiar sie zgadza. Ucieta synchronizacja nie kasuje
// starych danych. Gdy na druga kopie brak miejsca (legacy: min_spiffs
// ~192 KB) — dane sa juz kompletne i zwalidowane w RAM, wiec zapis wprost.
template <typename Writer>
static inline bool _kalkSpiffsWriteAtomic(const char* path, const char* tmpPath,
                                          size_t expected, Writer writer) {
    auto writeTo = [&](const char* dst) -> bool {
        File f = SPIFFS.open(dst, "w");
        if (!f) return false;
        bool ok = writer(f);
        f.close();
        if (ok) {
            File r = SPIFFS.open(dst, "r");
            ok = r && (size_t)r.size() == expected;
            if (r) r.close();
        }
        return ok;
    };
    if (SPIFFS.exists(tmpPath)) SPIFFS.remove(tmpPath);
    if (writeTo(tmpPath)) {
        if (SPIFFS.exists(path)) SPIFFS.remove(path);   // rename nie nadpisuje
        if (SPIFFS.rename(tmpPath, path)) return true;
    }
    Serial.printf("[FS] zapis przez %s nieudany — zapis wprost do %s\n", tmpPath, path);
    if (SPIFFS.exists(tmpPath)) SPIFFS.remove(tmpPath);
    if (SPIFFS.exists(path)) SPIFFS.remove(path);
    if (writeTo(path)) return true;
    if (SPIFFS.exists(path)) SPIFFS.remove(path);       // nie zostawiaj polowki
    return false;
}

// Zawijanie tekstu ASCII do linii po maxCols znakow (lamanie na spacji gdy
// sie da). Tekst musi byc juz po _kalkUtf8ToAscii.
static inline void _kalkWrapLines(const String& text, int maxCols, std::vector<String>& lines) {
    lines.clear();
    String content = text;
    while (content.length() > 0) {
        int nl = content.indexOf('\n');
        String chunk = nl >= 0 ? content.substring(0, nl) : content;
        content = nl >= 0 ? content.substring(nl + 1) : "";
        while ((int)chunk.length() > maxCols) {
            int breakPos = maxCols;
            int spacePos = chunk.lastIndexOf(' ', maxCols);
            if (spacePos > maxCols * 3 / 4) breakPos = spacePos;
            lines.push_back(chunk.substring(0, breakPos));
            chunk = chunk.substring(breakPos);
            if (chunk.length() > 0 && chunk[0] == ' ') chunk = chunk.substring(1);
        }
        lines.push_back(chunk);
    }
}

// =====================================================================
//  API notatek
// =====================================================================

// Cache tytulow (lista rysowana bez czytania pliku). Budowany przy wejsciu
// na ekran i po synchronizacji.
static std::vector<String> _notesTitleCache;

inline void notesBuildTitleCache() {
    _notesTitleCache.clear();
    if (!_notesEnsureFs()) return;
    _kalkEntriesScan(_NOTES_FILE, &_notesTitleCache);
}

// Liczba notatek aktualnie zapisanych offline (JSON-aware).
inline uint16_t notesCount() {
    if (!_notesEnsureFs()) return 0;
    return (uint16_t)_kalkEntriesScan(_NOTES_FILE, nullptr);
}

// Notatka nr idx (0-based, kolejnosc z JSON-a). Tytul/tresc zdekodowane
// z JSON i przetransliterowane do ASCII (ekran nie ma polskich glyphow).
inline bool notesGet(uint16_t idx, NoteEntry &out) {
    if (!_notesEnsureFs()) return false;
    return _kalkEntryGet(_NOTES_FILE, idx, out.title, out.content);
}

// Synchronizacja z serwera. Wymaga aktywnego WiFi + licencji.
// Zwraca: -1 = blad (stare notatki zostaja), 0+ = liczba zapisanych notatek
inline int notesSync(const char* licenseCode, const char* apiKey) {
    if (!_notesEnsureFs()) return -1;
    if (WiFi.status() != WL_CONNECTED) return -1;

    WiFiClientSecure client;
    client.setCACert(KALKMATE_CA_CERT);
    client.setTimeout(30);
    HTTPClient http;
    http.begin(client, _NOTES_ENDPOINT);
    http.addHeader("x-api-key", apiKey);
    if (licenseCode && licenseCode[0])
        http.addHeader("x-license-key", licenseCode);
    {
        uint8_t mac[6];
        esp_read_mac(mac, ESP_MAC_WIFI_STA);
        char did[16];
        snprintf(did, sizeof(did), "%02X%02X%02X%02X%02X%02X",
                 mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
        http.addHeader("x-device-id", did);
    }
    { char dt[68]=""; wifiLoadDeviceToken(dt,sizeof(dt)); if(dt[0]) http.addHeader("x-device-token",dt); }
    http.setTimeout(_NOTES_HTTP_TIMEOUT);

    Serial.printf("[NOTES] sync GET %s\n", _NOTES_ENDPOINT);
    int code = http.GET();
    if (code != 200) {
        Serial.printf("[NOTES] sync HTTP %d\n", code);
        http.end();
        return -1;
    }

    const int expected = http.getSize();   // -1 = nieznany (chunked)
    if (expected > (int)_NOTES_MAX_RESPONSE) {
        Serial.printf("[NOTES] odpowiedz za duza (%d B)\n", expected);
        http.end();
        return -1;
    }
    String body = http.getString();
    http.end();
    // Ucieta / nieudana alokacja -> nie ruszaj starych notatek
    if (body.length() > _NOTES_MAX_RESPONSE ||
        (expected > 0 && (int)body.length() != expected)) {
        Serial.printf("[NOTES] niepelna odpowiedz (%u / %d B)\n",
                      (unsigned)body.length(), expected);
        return -1;
    }

    const char* b = body.c_str();
    const int blen = (int)body.length();
    std::vector<_KalkEnt> ents;
    size_t outBytes = 0;
    int pr = _kalkParseEntries(b, blen, "notes", _NOTES_MAX_BYTES, ents, outBytes, "NOTES");
    if (pr == 0) return 0;     // brak pola "notes" — jak dotad: stary plik zostaje
    if (pr < 0) return -1;     // uszkodzone dane — stary plik zostaje

    bool ok = _kalkSpiffsWriteAtomic(_NOTES_FILE, _NOTES_TMP_FILE, outBytes,
                                     [&](File& f) { return _kalkWriteEntries(f, b, ents); });
    if (!ok) {
        Serial.println("[NOTES] blad zapisu SPIFFS");
        return -1;
    }
    Serial.printf("[NOTES] zapisano %u notatek (%u B)\n",
                  (unsigned)ents.size(), (unsigned)outBytes);
    return (int)ents.size();
}

inline void notesClear() {
    if (!_notesEnsureFs()) return;
    if (SPIFFS.exists(_NOTES_FILE)) SPIFFS.remove(_NOTES_FILE);
    _notesTitleCache.clear();
}

// =====================================================================
//  Ekran Notatki — lista offline + sync z serwera
//
//  Przeniesione tu z main.cpp (bylo jedynym ekranem UI trzymanym poza
//  swoim plikiem). Uzywa mT()/btnPressed() zdefiniowanych w main.cpp
//  zaraz po include settings_screen.h — notes.h jest wlaczany PO tym
//  punkcie, wiec sa juz widoczne.
// =====================================================================
inline void showNotesScreen(U8G2 &d) {
    inputWaitRelease();
    notesBuildTitleCache();   // raz na wejscie — lista bez czytania pliku co klatke

    auto drawList = [&](int cursor, int count) {
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        char hdr[40];
        snprintf(hdr, sizeof(hdr),
                 mT("Notatki (%d)", "Notes (%d)", "Notizen (%d)"),
                 count);
        d.drawStr(2, 10, hdr);
        d.drawHLine(0, 12, 256);

        if (count == 0) {
            d.drawStr(2, 30,
                mT("Brak notatek. Dodaj je",
                   "No notes. Add them",
                   "Keine Notizen. Fuege sie"));
            d.drawStr(2, 42,
                mT("w panelu klienta i zsynchron.",
                   "in user panel and sync.",
                   "im Kundenpanel hinzu und sync."));
            d.setFont(u8g2_font_5x7_tf);
            d.drawStr(2, 62,
                mT("OK = sync   < = wyjscie",
                   "OK = sync   < = exit",
                   "OK = sync   < = beenden"));
        } else {
            // Pokaz 4 widoczne tytuly (z cache — bez I/O)
            int scroll = (cursor < 4) ? 0 : cursor - 3;
            d.setFont(u8g2_font_6x10_tf);
            for (int i = 0; i < 4 && (scroll + i) < count; i++) {
                int idx = scroll + i;
                int y = 25 + i * 10;
                String t = (idx < (int)_notesTitleCache.size()) ? _notesTitleCache[idx] : String();
                if (t.length() == 0) t = "(bez tytulu)";
                if (t.length() > 38) t = t.substring(0, 36) + "..";
                if (idx == cursor) {
                    d.setDrawColor(1);
                    d.drawBox(0, y - 9, 256, 11);
                    d.setDrawColor(0);
                    d.drawStr(4, y, t.c_str());
                    d.setDrawColor(1);
                } else {
                    d.drawStr(4, y, t.c_str());
                }
            }
            d.setFont(u8g2_font_5x7_tf);
            d.drawStr(2, 62,
                mT("OK = otworz   v = sync   < = wyjscie",
                   "OK = open   v = sync   < = exit",
                   "OK = oeffnen  v = sync  < = beenden"));
        }
        d.sendBuffer();
    };

    auto drawDetail = [&](const NoteEntry& n) {
        // User czyta — dluzszy timeout snu zamiast trwalej blokady
        powerSetMinTimeout(_KALK_READ_TIMEOUT_MS);
        // Rozbij content na linie (~42 znaki dla czcionki 6x10). Tresc jest
        // juz ASCII (notesGet), wiec ciecie nie trafi w srodek znaku UTF-8.
        std::vector<String> lines;
        _kalkWrapLines(n.content, 42, lines);
        String t = n.title.length() == 0 ? String("(bez tytulu)") : n.title;
        if (t.length() > 40) t = t.substring(0, 38) + "..";

        int scrollLine = 0;
        bool needRedraw = true;   // rysuj tylko po zmianie (bez sendBuffer co 20 ms)
        while (true) {
            if (powerCheckSleep()) needRedraw = true;
            if (panicTriggered()) { powerSetMinTimeout(0); return; }

            if (needRedraw) {
                needRedraw = false;
                d.clearBuffer();
                d.setFont(u8g2_font_6x10_tf);
                d.drawStr(2, 10, t.c_str());
                d.drawHLine(0, 12, 256);

                for (int i = 0; i < 4; i++) {
                    int idx = scrollLine + i;
                    if (idx >= (int)lines.size()) break;
                    d.drawStr(2, 24 + i * 11, lines[idx].c_str());
                }

                d.setFont(u8g2_font_5x7_tf);
                char info[24];
                snprintf(info, sizeof(info), "%d/%d", scrollLine + 1, (int)lines.size());
                d.drawStr(220, 62, info);
                d.drawStr(2, 62,
                    mT("^/v scroll   < = wstecz",
                       "^/v scroll   < = back",
                       "^/v scroll   < = zurueck"));
                d.sendBuffer();
            }

            inputScan();
            if (inputKeyConsume(KEY_PLUS) || inputKeyConsume(KEY_8)) {
                if (scrollLine > 0) { scrollLine--; needRedraw = true; }
            }
            if (inputKeyConsume(KEY_MINUS) || inputKeyConsume(KEY_2)) {
                if (scrollLine < (int)lines.size() - 4) { scrollLine++; needRedraw = true; }
            }
            if (inputKeyConsume(KEY_PLUSMINUS) || inputKeyConsume(KEY_4) ||
                inputKeyConsume(KEY_CCE)) {
                powerSetMinTimeout(0);
                inputWaitRelease();
                return;
            }
            delay(20);
        }
    };

    auto syncFromServer = [&]() {
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 24,
            mT("Synchronizacja...", "Syncing...", "Synchronisiere..."));
        d.drawStr(2, 38,
            mT("Lacze z serwerem", "Connecting to server", "Verbinde mit Server"));
        d.sendBuffer();

        // Ensure WiFi connected (uzyj zapisanego SSID/pass)
        if (WiFi.status() != WL_CONNECTED) {
            char ssid[33] = "", pass[64] = "";
            if (wifiLoadSaved(ssid, sizeof(ssid), pass, sizeof(pass))) {
                wifiStaOnLimited();   // STA + TxPower 8.5 dBm (anty-brownout)
                WiFi.begin(ssid, pass);
                uint32_t t0 = millis();
                while (WiFi.status() != WL_CONNECTED && millis() - t0 < 10000) {
                    delay(100);
                }
            }
            memset(pass, 0, sizeof(pass));
        }
        if (WiFi.status() != WL_CONNECTED) {
            d.clearBuffer();
            d.setFont(u8g2_font_6x10_tf);
            d.drawStr(2, 30,
                mT("Brak WiFi", "No WiFi", "Kein WLAN"));
            d.sendBuffer();
            delay(2000);
            return -1;
        }

        // Licencja opcjonalna - nowy model uzywa deviceId. Stara licencja
        // moze byc dalej obecna jako fallback.
        char licKey[40];
        wifiLoadLicense(licKey, sizeof(licKey));
        int n = notesSync(licKey, KALK_API_KEY);
        notesBuildTitleCache();   // plik (moze) sie zmienil
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        if (n < 0) {
            d.drawStr(2, 30,
                mT("Blad synchronizacji", "Sync error", "Sync-Fehler"));
        } else {
            char buf[40];
            snprintf(buf, sizeof(buf),
                mT("Pobrano: %d notatek", "Downloaded: %d notes", "Geladen: %d Notizen"),
                n);
            d.drawStr(2, 30, buf);
        }
        d.sendBuffer();
        delay(1500);
        return n;
    };

    int cursor = 0;
    int count = (int)_notesTitleCache.size();
    drawList(cursor, count);

    while (true) {
        if (powerCheckSleep()) drawList(cursor, count);
        if (panicTriggered()) return;
        if (btnPressed(BTN_UP)) {
            if (cursor > 0) cursor--;
            drawList(cursor, count);
        }
        if (btnPressed(BTN_DOWN)) {
            if (count == 0) {
                // gdy lista pusta i naciskasz DOWN — sync
                syncFromServer();
                count = (int)_notesTitleCache.size();
                cursor = 0;
                drawList(cursor, count);
            } else {
                if (cursor < count - 1) cursor++;
                else {
                    // ostatnia pozycja + DOWN = sync
                    syncFromServer();
                    count = (int)_notesTitleCache.size();
                    if (cursor >= count) cursor = count > 0 ? count - 1 : 0;
                }
                drawList(cursor, count);
            }
        }
        if (btnPressed(BTN_OK)) {
            if (count == 0) {
                syncFromServer();
                count = (int)_notesTitleCache.size();
                cursor = 0;
                drawList(cursor, count);
            } else {
                NoteEntry n;
                if (notesGet(cursor, n)) drawDetail(n);
                drawList(cursor, count);
            }
        }
        if (btnPressed(BTN_LEFT) || btnPressed(BTN_BACK)) {
            return;
        }
        delay(20);
    }
}
