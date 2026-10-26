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
#include "i18n_extra.h"   // kalkTrExtra — _notesTr dla jezykow 4..10
#include "ui_kit.h"       // wspolny wyglad ekranow (naglowek, wiersze, komunikaty)

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

// UTF-8 -> ASCII (_KALK_TRANSLIT / _kalkTranslitCp / _kalkUtf8ToAscii)
// przeniesione do kalk_translit.h — wspolne z solve_screen.h.
#include "kalk_translit.h"

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
// starych danych. Gdy na druga kopie brak miejsca (np. mala partycja
// SPIFFS) — dane sa juz kompletne i zwalidowane w RAM, wiec zapis wprost.
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
//  swoim plikiem). Uzywa btnPressed() zdefiniowanego w main.cpp
//  zaraz po include settings_screen.h — notes.h jest wlaczany PO tym
//  punkcie, wiec sa juz widoczne.
// =====================================================================
// Lokalny helper tlumaczen: 0=PL, 1=EN, 2=DE, 3=CS (bez diakrytykow).
// Wlasny (nie mT() z main.cpp), zeby ten plik obslugiwal 4 jezyki niezaleznie.
static inline const char* _notesTr(const char* pl, const char* en, const char* de, const char* cs) {
    if (kalkSettings.language >= KALK_TR_EXTRA_FIRST) return kalkTrExtra(en, kalkSettings.language);  // 4..10
    switch (kalkSettings.language) {
        case 0:  return pl;
        case 2:  return de;
        case 3:  return cs;
        default: return en;
    }
}

// =====================================================================
//  Wspolne elementy UI list wpisow (notatki + sprawdziany, styl ui_kit.h)
// =====================================================================

static inline const char* _kalkUntitled() {
    return _notesTr("(bez tytulu)", "(no title)", "(ohne Titel)", "(bez nazvu)");
}

// Tekst przyciety do maxW px (aktualna czcionka), z ".." na koncu.
static inline String _kalkFitText(U8G2 &d, const String& s, int maxW) {
    if (d.getStrWidth(s.c_str()) <= maxW) return s;
    String t = s;
    while (t.length() > 0) {
        t.remove(t.length() - 1);
        while (t.length() > 0 && t[t.length() - 1] == ' ') t.remove(t.length() - 1);
        String c = t + "..";
        if (d.getStrWidth(c.c_str()) <= maxW) return c;
    }
    return String("..");
}

// Lista tytulow: naglowek z licznikiem, 3 wiersze z ">", pasek przewijania,
// stopka z podpowiedzia (sync = DOWN na ostatniej pozycji — nieoczywiste).
// titleAt(idx) -> String. scroll trzymany przez wywolujacego.
template <typename TitleAt>
static inline void _kalkDrawEntryList(U8G2 &d, const char* title, int cursor, int count,
                                      int& scroll, TitleAt titleAt, const char* foot) {
    d.clearBuffer();
    uiHeaderCount(d, title, false, cursor, count);
    uiFitScroll(cursor, count, scroll, UI_ROWS_FOOTER);
    d.setFont(UI_FONT);
    for (int r = 0; r < UI_ROWS_FOOTER; r++) {
        int idx = scroll + r;
        if (idx >= count) break;
        String t = titleAt(idx);
        if (t.length() == 0) t = _kalkUntitled();
        t = _kalkFitText(d, t, UI_CHEVRON_X - 4 - 8);
        uiRow(d, r, idx == cursor, nullptr, t.c_str(), nullptr, true);
    }
    uiScrollbar(d, scroll, count, UI_ROWS_FOOTER);
    uiFooter(d, foot);
    d.sendBuffer();
}

// Naglowek czytnika: "< Tytul" + pozycja "linia/linii" z prawej.
static inline void _kalkViewerHeader(U8G2 &d, const String& title, int pos, int total) {
    char cnt[16] = "";
    if (total > 0) snprintf(cnt, sizeof(cnt), "%d/%d", pos + 1, total);
    d.setFont(UI_FONT_SMALL);
    const int cw = cnt[0] ? d.getStrWidth(cnt) : 0;
    d.setFont(UI_FONT);
    String t = _kalkFitText(d, title.length() ? title : String(_kalkUntitled()),
                            250 - cw - 10 - 12);
    uiHeader(d, t.c_str(), true, cnt);
}

// Cienki pasek przewijania czytnika (x 254..255) — tekst zawijany na 42
// znaki (x 2..253) zostaje nietkniety.
static inline void _kalkViewerScrollbar(U8G2 &d, int scroll, int total, int rows) {
    if (total <= rows) return;
    const int top = 14, h = 50;
    int barH = h * rows / total;
    if (barH < 4) barH = 4;
    const int maxScroll = total - rows;
    if (scroll > maxScroll) scroll = maxScroll;
    if (scroll < 0) scroll = 0;
    const int barY = top + (h - barH) * scroll / maxScroll;
    d.setDrawColor(1);
    for (int y = top; y < top + h; y += 2) d.drawPixel(255, y);
    d.drawBox(254, barY, 2, barH);
}

// Baseline linii tresci czytnika (4 linie po 12 px: 24, 36, 48, 60).
#define _KALK_VIEW_Y(i)  (UI_ROW_Y0 + (i) * UI_ROW_H)

// Ekran "trwa synchronizacja": naglowek, tekst, kropki, maly podpis.
static inline void _kalkDrawSyncing(U8G2 &d, const char* title, const char* l1, const char* l2) {
    d.clearBuffer();
    uiHeader(d, title, false);
    d.setFont(UI_FONT);
    d.setBitmapMode(1);
    const int w = d.getStrWidth(l1);
    const int x = (UI_W - (w + 12)) / 2;
    d.drawXBM(x, 23, 8, 8, UI_ICO_CLOUD);
    d.setBitmapMode(0);
    d.drawStr(x + 12, 31, l1);
    uiSpinner(d, UI_W / 2, 43);
    if (l2 && l2[0]) {
        d.setFont(UI_FONT_SMALL);
        uiCenter(d, 59, l2);
        d.setFont(UI_FONT);
    }
    d.sendBuffer();
}

inline void showNotesScreen(U8G2 &d) {
    inputWaitRelease();
    notesBuildTitleCache();   // raz na wejscie — lista bez czytania pliku co klatke

    const char* screenTitle = _notesTr("Notatki", "Notes", "Notizen", "Poznamky");
    int listScroll = 0;

    auto drawList = [&](int cursor, int count) {
        if (count == 0) {
            uiMessage(d, screenTitle, UI_ICO_NOTES,
                _notesTr("Brak notatek. Dodaj je",
                   "No notes. Add them",
                   "Keine Notizen. Fuege sie",
                   "Zadne poznamky. Pridejte je"),
                _notesTr("w panelu klienta i zsynchron.",
                   "in user panel and sync.",
                   "im Kundenpanel hinzu und sync.",
                   "v zakaznickem panelu a synch."),
                nullptr,
                _notesTr("OK = sync   < = wyjscie",
                   "OK = sync   < = exit",
                   "OK = sync   < = beenden",
                   "OK = sync   < = konec"));
            return;
        }
        // Tytuly z cache — bez I/O
        _kalkDrawEntryList(d, screenTitle, cursor, count, listScroll,
            [&](int idx) {
                return (idx < (int)_notesTitleCache.size()) ? _notesTitleCache[idx] : String();
            },
            _notesTr("OK = otworz   v = sync   < = wyjscie",
               "OK = open   v = sync   < = exit",
               "OK = oeffnen  v = sync  < = beenden",
               "OK = otevrit   v = sync   < = konec"));
    };

    auto drawDetail = [&](const NoteEntry& n) {
        // User czyta — dluzszy timeout snu zamiast trwalej blokady
        powerSetMinTimeout(_KALK_READ_TIMEOUT_MS);
        // Rozbij content na linie (~42 znaki dla czcionki 6x10). Tresc jest
        // juz ASCII (notesGet), wiec ciecie nie trafi w srodek znaku UTF-8.
        std::vector<String> lines;
        _kalkWrapLines(n.content, 42, lines);
        int scrollLine = 0;
        bool needRedraw = true;   // rysuj tylko po zmianie (bez sendBuffer co 20 ms)
        while (true) {
            if (powerCheckSleep()) needRedraw = true;
            if (panicTriggered()) { powerSetMinTimeout(0); return; }

            if (needRedraw) {
                needRedraw = false;
                d.clearBuffer();
                _kalkViewerHeader(d, n.title, scrollLine, (int)lines.size());

                d.setFont(UI_FONT);
                for (int i = 0; i < 4; i++) {
                    int idx = scrollLine + i;
                    if (idx >= (int)lines.size()) break;
                    d.drawStr(2, _KALK_VIEW_Y(i), lines[idx].c_str());
                }
                _kalkViewerScrollbar(d, scrollLine, (int)lines.size(), 4);
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
        auto drawSyncing = [&]() {
            _kalkDrawSyncing(d, screenTitle,
                _notesTr("Synchronizacja...", "Syncing...", "Synchronisiere...", "Synchronizace..."),
                _notesTr("Lacze z serwerem", "Connecting to server", "Verbinde mit Server", "Pripojuji k serveru"));
        };
        drawSyncing();

        // Ensure WiFi connected (uzyj zapisanego SSID/pass)
        if (WiFi.status() != WL_CONNECTED) {
            char ssid[33] = "", pass[64] = "";
            if (wifiLoadSaved(ssid, sizeof(ssid), pass, sizeof(pass))) {
                wifiConnectStart(ssid, pass);   // STA + TxPower; nie restartuje trwajacego laczenia
                uint32_t t0 = millis();
                while (WiFi.status() != WL_CONNECTED && millis() - t0 < 10000) {
                    delay(100);
                    drawSyncing();   // animacja kropek
                }
            }
            memset(pass, 0, sizeof(pass));
        }
        if (WiFi.status() != WL_CONNECTED) {
            uiMessage(d, screenTitle, UI_ICO_WIFI,
                _notesTr("Brak WiFi", "No WiFi", "Kein WLAN", "Bez WiFi"),
                _notesTr("Ustawienia -> WiFi i konto", "Settings -> WiFi & account",
                         "Einstellungen -> WLAN & Konto", "Nastaveni -> WiFi a ucet"));
            delay(2000);
            return -1;
        }

        // Licencja opcjonalna - nowy model uzywa deviceId. Stara licencja
        // moze byc dalej obecna jako fallback.
        char licKey[40];
        wifiLoadLicense(licKey, sizeof(licKey));
        int n = notesSync(licKey, KALK_API_KEY);
        notesBuildTitleCache();   // plik (moze) sie zmienil
        if (n < 0) {
            uiMessage(d, screenTitle, UI_ICO_WARN,
                _notesTr("Blad synchronizacji", "Sync error", "Sync-Fehler", "Chyba synchronizace"));
        } else {
            char buf[40];
            snprintf(buf, sizeof(buf),
                _notesTr("Pobrano: %d notatek", "Downloaded: %d notes", "Geladen: %d Notizen", "Stazeno: %d poznamek"),
                n);
            uiMessage(d, screenTitle, UI_ICO_CHECK, buf);
        }
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
