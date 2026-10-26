#pragma once
// =====================================================================
//  tests.h — sprawdziany pobierane z serwera (dev mode)
//
//  Storage: SPIFFS, plik /tests.json
//  Format compact:
//    [{"t":"tytul","c":"tresc"},{"t":"...","c":"..."}]
//
//  Sync: testsSync(licenseCode, apiKey) — GET /api/device/tests
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
#include "i18n_extra.h"   // kalkTrExtra — _testsTr dla jezykow 4..10
#include "notes.h"   // wspolne helpery JSON / UTF-8 / zapisu SPIFFS (_json*, _kalk*)

#ifndef KALK_SERVER_URL
#error "tests.h wymaga KALK_SERVER_URL"
#endif

#define _TESTS_FILE           "/tests.json"
#define _TESTS_TMP_FILE       "/tests.tmp"
#define _TESTS_ENDPOINT       KALK_SERVER_URL "/api/device/tests"
#define _TESTS_HTTP_TIMEOUT   30000
#define _TESTS_MAX_BYTES      (160 * 1024)   // limit pliku na SPIFFS — bezpiecznie < 192 KB
#define _TESTS_MAX_RESPONSE   (256 * 1024)   // bufor odpowiedzi (PSRAM)
#define _TESTS_STALL_MS       10000          // brak nowych danych -> przerwij
#define _TESTS_TOTAL_MS       45000          // twardy limit calego pobierania

struct TestEntry {
    String title;
    String content;
};

static bool _testsFsReady = false;

// === Cache tytulow (do listy w UI) ===
// Lista jest rysowana wiele razy na sekunde (kazdy frame UI) i robienie
// pelnego parsowania pliku SPIFFS dla kazdej ramki jest powodem lagow.
// Buduje sie raz przy wejsciu na ekran, refresh dopiero po sync.
static std::vector<String> _testsTitleCache;
static bool _testsCacheValid = false;

inline bool _testsEnsureFs() {
    if (_testsFsReady) return true;
    if (!SPIFFS.begin(true)) {
        Serial.println("[TESTS] SPIFFS mount failed");
        return false;
    }
    _testsFsReady = true;
    return true;
}

// Zbuduj cache tytulow (czyta plik raz). Wywolaj przy wejsciu w ekran sprawdzianow.
// Tytuly zdekodowane z JSON i przetransliterowane do ASCII (ekran 6x10).
inline void testsBuildTitleCache() {
    _testsTitleCache.clear();
    _testsCacheValid = true;   // nawet pusty cache = "valid" (znamy stan)
    if (!_testsEnsureFs()) return;
    _kalkEntriesScan(_TESTS_FILE, &_testsTitleCache);
}

inline void testsInvalidateCache() {
    _testsCacheValid = false;
    _testsTitleCache.clear();
}

inline uint16_t testsCount() {
    // Jesli mamy cache - uzyj go. Inaczej liczenie obiektow (JSON-aware).
    if (_testsCacheValid) return _testsTitleCache.size();
    if (!_testsEnsureFs()) return 0;
    return (uint16_t)_kalkEntriesScan(_TESTS_FILE, nullptr);
}

// Tytul: ASCII. Tresc: zdekodowana z JSON, ale nadal UTF-8 — transliteracja
// na koncu testsFormat() (po LaTeX), zeby np. "∅" -> "{}" nie zniknelo przy
// usuwaniu nawiasow grupujacych.
inline bool testsGet(uint16_t idx, TestEntry &out) {
    if (!_testsEnsureFs()) return false;
    return _kalkEntryGet(_TESTS_FILE, idx, out.title, out.content, /*asciiContent=*/false);
}

// Szybkie pobranie samego tytulu (z cache, bez parsowania pliku).
inline String testsTitleAt(uint16_t idx) {
    if (_testsCacheValid && idx < _testsTitleCache.size()) {
        return _testsTitleCache[idx];
    }
    // Fallback: pelne testsGet (rzadkie - przed pierwszym build cache)
    TestEntry t;
    if (testsGet(idx, t)) return t.title;
    return String();
}

// Zwraca: -1 = blad (stare sprawdziany zostaja), 0+ = liczba zapisanych
inline int testsSync(const char* licenseCode, const char* apiKey) {
    if (!_testsEnsureFs()) return -1;
    if (WiFi.status() != WL_CONNECTED) return -1;

    WiFiClientSecure client;
    client.setCACert(KALKMATE_CA_CERT);
    client.setTimeout(30);
    HTTPClient http;
    // HTTP/1.0: serwer nie uzyje chunked transfer — surowy strumien
    // (getStreamPtr) to czyste body bez naglowkow chunkow, a koniec
    // odpowiedzi = Content-Length albo zamkniecie polaczenia.
    http.useHTTP10(true);
    http.begin(client, _TESTS_ENDPOINT);
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
    http.setTimeout(_TESTS_HTTP_TIMEOUT);

    int code = http.GET();
    if (code != 200) {
        Serial.printf("[TESTS] sync HTTP %d\n", code);
        http.end();
        return -1;
    }

    const int expected = http.getSize();   // -1 = nieznany (koniec = zamkniecie polaczenia)
    const size_t bufSize = _TESTS_MAX_RESPONSE + 1;
    if (expected > (int)_TESTS_MAX_RESPONSE) {
        Serial.printf("[TESTS] odpowiedz za duza (%d B)\n", expected);
        http.end();
        return -1;
    }

    // Bufor w PSRAM (8 MB) zamiast getString() do zwyklego heapu —
    // getString() przy 85+ KB potrafil zwrocic uciete body (fragmentacja).
    char* buf = (char*)ps_malloc(bufSize);
    bool usingPsram = (buf != nullptr);
    if (!buf) buf = (char*)malloc(bufSize);   // fallback: zwykly heap
    if (!buf) {
        Serial.println("[TESTS] malloc failed");
        http.end();
        return -1;
    }
    Serial.printf("[TESTS] buf alloc OK (%u B, psram=%d, freeheap=%u, freepsram=%u)\n",
                  (unsigned)bufSize, usingPsram, ESP.getFreeHeap(), ESP.getFreePsram());

    // Czytaj TYLKO tyle ile jest dostepne (jak ota_update.h). Wczesniej
    // readBytes(buf, cala_reszta) czekal Stream timeout po ostatnim bajcie
    // (~30 s "wiszenia" przy kazdej synchronizacji).
    WiFiClient* stream = http.getStreamPtr();
    size_t total = 0;
    bool overflow = false, stalled = false;
    const uint32_t tStart = millis();
    uint32_t lastData = tStart;
    while (true) {
        if (expected >= 0 && total >= (size_t)expected) break;   // komplet wg Content-Length
        uint32_t now = millis();
        if (now - tStart > _TESTS_TOTAL_MS) { stalled = true; break; }
        size_t avail = stream->available();
        if (avail > 0) {
            size_t room = bufSize - 1 - total;
            if (room == 0) { overflow = true; break; }
            size_t want = avail < room ? avail : room;
            int n = stream->readBytes(buf + total, want);   // want <= available -> bez czekania
            if (n <= 0) break;
            total += (size_t)n;
            lastData = millis();
        } else if (!stream->connected()) {
            break;                                           // serwer zamknal polaczenie
        } else {
            if (now - lastData > _TESTS_STALL_MS) { stalled = true; break; }
            delay(5);
        }
    }
    buf[total] = '\0';
    http.end();
    Serial.printf("[TESTS] streamed %u / %d bytes in %lu ms\n", (unsigned)total, expected,
                  (unsigned long)(millis() - tStart));

    // Uciety strumien NIE moze skasowac starych danych.
    if (overflow || stalled || (expected >= 0 && total != (size_t)expected)) {
        Serial.printf("[TESTS] niepelna odpowiedz (overflow=%d stalled=%d) — stare dane zostaja\n",
                      overflow, stalled);
        free(buf);
        return -1;
    }

    std::vector<_KalkEnt> ents;
    size_t outBytes = 0;
    int pr = _kalkParseEntries(buf, (int)total, "tests", _TESTS_MAX_BYTES, ents, outBytes, "TESTS");
    if (pr <= 0) {
        if (pr == 0) Serial.println("[TESTS] no tests field");
        free(buf);
        return pr;   // 0 = brak pola (stary plik zostaje), -1 = uszkodzone
    }

    bool ok = _kalkSpiffsWriteAtomic(_TESTS_FILE, _TESTS_TMP_FILE, outBytes,
                                     [&](File& f) { return _kalkWriteEntries(f, buf, ents); });
    free(buf);
    if (!ok) {
        Serial.println("[TESTS] blad zapisu SPIFFS");
        return -1;
    }
    Serial.printf("[TESTS] parsed %u tests (%u B), freeheap=%u\n",
                  (unsigned)ents.size(), (unsigned)outBytes, ESP.getFreeHeap());
    return (int)ents.size();
}

inline void testsClear() {
    if (!_testsEnsureFs()) return;
    if (SPIFFS.exists(_TESTS_FILE)) SPIFFS.remove(_TESTS_FILE);
    testsInvalidateCache();
}

// ---------------------------------------------------------------------
//  Formatowanie: konwersja markdown/LaTeX -> ASCII dla OLED 6x10 fonta
//
//  Placeholdery (przywracane / obslugiwane na koncu):
//    \x01 = nieskonczonosc (rysowana w testsDrawLine)
//    \x02 / \x03 = doslowne "{" / "}" (z \{ \} i \emptyset — zeby nie
//                  zniknely przy usuwaniu nawiasow grupujacych)
//    \x04 = "\" (\setminus), \x05 = "&" (\&), \x06 = "$" (\$)
// ---------------------------------------------------------------------

static inline bool _texIsAlpha(char c) {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
}

// Indeks pasujacego '}' dla '{' na pozycji open, -1 gdy niedomkniete.
static int _texGroupEnd(const String& s, int open) {
    int depth = 0;
    for (int i = open; i < (int)s.length(); i++) {
        char c = s[i];
        if (c == '{') depth++;
        else if (c == '}') {
            if (--depth == 0) return i;
        }
    }
    return -1;
}

// Argument komendy od pozycji pos (po spacjach): {grupa}, \komenda albo
// pojedynczy znak (np. \frac12). argS/argE = tresc (argE wylacznie),
// next = pozycja za argumentem. false gdy brak argumentu.
static bool _texArg(const String& s, int pos, int& argS, int& argE, int& next) {
    const int len = (int)s.length();
    while (pos < len && s[pos] == ' ') pos++;
    if (pos >= len) return false;
    char c = s[pos];
    if (c == '{') {
        int e = _texGroupEnd(s, pos);
        if (e < 0) return false;
        argS = pos + 1; argE = e; next = e + 1;
        return true;
    }
    if (c == '}') return false;
    if (c == '\\') {
        int e = pos + 1;
        while (e < len && _texIsAlpha(s[e])) e++;
        if (e == pos + 1 && e < len) e++;   // \, \{ itp. — jeden znak
        argS = pos; argE = e; next = e;
        return true;
    }
    int e = pos + 1;
    if ((uint8_t)c >= 0xC0) {               // caly znak UTF-8
        while (e < len && ((uint8_t)s[e] & 0xC0) == 0x80) e++;
    }
    argS = pos; argE = e; next = e;
    return true;
}

// Zamienia CALA komende LaTeX (z backslashem) na rep. Gdy nazwa konczy sie
// litera, znak po niej nie moze byc litera — "\in" nie trafia w "\int",
// "\dot" w "\dots", "\right" w "\rightarrow", "\cdot" w "\cdots" itd.
static void _texReplaceCmd(String& s, const char* cmd, const char* rep) {
    const int cmdLen = (int)strlen(cmd);
    const int repLen = (int)strlen(rep);
    const bool needBoundary = cmdLen > 0 && _texIsAlpha(cmd[cmdLen - 1]);
    int from = 0;
    while (true) {
        int idx = s.indexOf(cmd, from);
        if (idx < 0) break;
        int after = idx + cmdLen;
        if (needBoundary && after < (int)s.length() && _texIsAlpha(s[after])) {
            from = idx + 1;
            continue;
        }
        s = s.substring(0, idx) + rep + s.substring(after);
        from = idx + repLen;
    }
}

// "\<name>{<content>}" -> "<content>" (z dopasowaniem zagniezdzonych {}).
// Bez { — usuwa samo polecenie. Ta sama ochrona granicy nazwy co wyzej.
static void _stripBracedCommand(String& s, const char* cmdWithSlash) {
    const int cmdLen = (int)strlen(cmdWithSlash);
    int from = 0;
    while (true) {
        int idx = s.indexOf(cmdWithSlash, from);
        if (idx < 0) break;
        int after = idx + cmdLen;
        if (after < (int)s.length() && _texIsAlpha(s[after])) { from = idx + 1; continue; }
        int braceStart = after;
        while (braceStart < (int)s.length() &&
               (s[braceStart] == ' ' || s[braceStart] == '\t')) braceStart++;
        if (braceStart >= (int)s.length() || s[braceStart] != '{') {
            s = s.substring(0, idx) + s.substring(after);
            from = idx;
            continue;
        }
        int end = _texGroupEnd(s, braceStart);
        if (end < 0) break;  // niedomkniete {} — wyjdz
        s = s.substring(0, idx) + s.substring(braceStart + 1, end) + s.substring(end + 1);
        from = idx;
    }
}

// Komenda z 1 argumentem: cmd{a} -> pre + a + post.
static void _texOneArg(String& s, const char* cmd, const char* pre, const char* post) {
    const int cmdLen = (int)strlen(cmd);
    int from = 0;
    while (true) {
        int idx = s.indexOf(cmd, from);
        if (idx < 0) break;
        int a = idx + cmdLen;
        if (a < (int)s.length() && _texIsAlpha(s[a])) { from = idx + 1; continue; }
        int aS, aE, next;
        if (!_texArg(s, a, aS, aE, next)) { from = idx + 1; continue; }
        s = s.substring(0, idx) + pre + s.substring(aS, aE) + post + s.substring(next);
        from = idx;   // w argumencie moga byc kolejne wystapienia
    }
}

// Komenda z 2 argumentami: cmd{a}{b} -> pre + a + mid + b + post.
// \frac{1}{2}x -> (1)/(2)x  (wczesniej "(1)/(2x" — zgubiony nawias).
static void _texTwoArg(String& s, const char* cmd, const char* pre, const char* mid, const char* post) {
    const int cmdLen = (int)strlen(cmd);
    int from = 0;
    while (true) {
        int idx = s.indexOf(cmd, from);
        if (idx < 0) break;
        int a = idx + cmdLen;
        if (a < (int)s.length() && _texIsAlpha(s[a])) { from = idx + 1; continue; }
        int aS, aE, aNext, bS, bE, bNext;
        if (!_texArg(s, a, aS, aE, aNext) || !_texArg(s, aNext, bS, bE, bNext)) {
            from = idx + 1;
            continue;
        }
        s = s.substring(0, idx) + pre + s.substring(aS, aE) + mid + s.substring(bS, bE) + post
          + s.substring(bNext);
        from = idx;   // zagniezdzone \frac w argumentach
    }
}

// \sqrt{x} -> sqrt(x), \sqrt[n]{x} -> n-rt(x)  (wczesniej gubil ')').
static void _texSqrt(String& s) {
    int from = 0;
    while (true) {
        int idx = s.indexOf("\\sqrt", from);
        if (idx < 0) break;
        int a = idx + 5;
        if (a < (int)s.length() && _texIsAlpha(s[a])) { from = idx + 1; continue; }
        while (a < (int)s.length() && s[a] == ' ') a++;
        String deg;
        if (a < (int)s.length() && s[a] == '[') {
            int c = s.indexOf(']', a);
            if (c > a) {
                deg = s.substring(a + 1, c);
                a = c + 1;
            }
        }
        int aS, aE, next;
        if (!_texArg(s, a, aS, aE, next)) {
            s = s.substring(0, idx) + "sqrt" + s.substring(idx + 5);
            from = idx + 4;
            continue;
        }
        String head = "sqrt(";
        if (deg.length()) { head = deg; head += "-rt("; }
        s = s.substring(0, idx) + head + s.substring(aS, aE) + ")" + s.substring(next);
        from = idx;
    }
}

// x^{n+1} -> x^(n+1), x^{2} -> x^2 (tak samo dla "_"). Bez tego po usunieciu
// nawiasow "x^{n+1}" czytalo sie jak "x^n + 1".
static void _texScript(String& s, char mark) {
    int from = 0;
    while (true) {
        int idx = s.indexOf(mark, from);
        if (idx < 0) break;
        int b = idx + 1;
        if (b >= (int)s.length() || s[b] != '{') { from = idx + 1; continue; }
        int e = _texGroupEnd(s, b);
        if (e < 0) { from = idx + 1; continue; }
        String rep = s.substring(b + 1, e);
        if (rep.length() > 1) { rep = "(" + rep; rep += ")"; }
        s = s.substring(0, b) + rep + s.substring(e + 1);
        from = idx + 1;
    }
}

inline String testsFormat(const String& src) {
    String s = src;

    // === Znaki specjalne poprzedzone backslashem -> placeholdery ===
    // (przed markdownem/delimiterami/nawiasami, ktore by je zjadly)
    s.replace("\\{", "\x02");
    s.replace("\\}", "\x03");
    s.replace("\\&", "\x05");
    s.replace("\\$", "\x06");
    s.replace("\\%", "%");
    s.replace("\\_", "_");

    // Bold/italic markdown — usun znaczniki. Pojedyncza '*' ZOSTAJE (mnozenie
    // "2*3"; wczesniej replace("*","") robil z tego "23").
    s.replace("**", "");
    s.replace("__", "");
    s.replace("##", "");
    s.replace("#", "");

    // Math delimiters $$...$$, $...$, \( \), \[ \]
    s.replace("$$", "");
    s.replace("$", "");
    s.replace("\\(", "");
    s.replace("\\)", "");
    s.replace("\\[", "");
    s.replace("\\]", "");

    // LaTeX komendy z argumentem {...} — zachowaj tylko zawartosc.
    // Granica nazwy sprawdzana w _stripBracedCommand (\text nie trafia w \textbf).
    static const char* const kStrip[] = {
        "\\textbf", "\\textit", "\\textrm", "\\texttt", "\\textsf", "\\text",
        "\\mathrm", "\\mathbf", "\\mathit", "\\mathsf", "\\mathtt",
        "\\mathbb", "\\mathcal", "\\mathfrak", "\\boldsymbol", "\\bm",
        "\\boxed", "\\overline", "\\underline",
        "\\overrightarrow", "\\overleftrightarrow", "\\overleftarrow",
        "\\vec", "\\widehat", "\\widetilde", "\\hat", "\\bar", "\\tilde",
        "\\ddot", "\\dot", "\\operatorname", "\\substack", "\\stackrel",
        "\\overset", "\\underset", "\\ce", "\\mbox", "\\displaystyle", "\\textstyle",
    };
    for (size_t k = 0; k < sizeof(kStrip) / sizeof(kStrip[0]); k++) {
        _stripBracedCommand(s, kStrip[k]);
    }

    // Srodowiska \begin{name}...\end{name} - usun znaczniki, zostaw zawartosc.
    // Niektore maja arg {cc} po nazwie (np. \begin{array}{cc}) - tez usun.
    auto _stripBeginEnd = [&]() {
        while (true) {
            int idx = s.indexOf("\\begin{");
            if (idx < 0) break;
            int end = s.indexOf("}", idx);
            if (end < 0) break;
            // Sprawdz czy zaraz po } jest { (dodatkowy argument)
            if (end + 1 < (int)s.length() && s[end + 1] == '{') {
                int end2 = s.indexOf("}", end + 1);
                if (end2 > 0) end = end2;
            }
            s = s.substring(0, idx) + s.substring(end + 1);
        }
        while (true) {
            int idx = s.indexOf("\\end{");
            if (idx < 0) break;
            int end = s.indexOf("}", idx);
            if (end < 0) break;
            s = s.substring(0, idx) + s.substring(end + 1);
        }
    };
    _stripBeginEnd();
    // Separator kolumn w macierzach/tabelach: & -> spacja
    s.replace("&", " ");

    // === Frakcje, dwumian, pierwiastki — z dopasowaniem nawiasow ===
    _texTwoArg(s, "\\dfrac", "(", ")/(", ")");
    _texTwoArg(s, "\\tfrac", "(", ")/(", ")");
    _texTwoArg(s, "\\cfrac", "(", ")/(", ")");
    _texTwoArg(s, "\\frac",  "(", ")/(", ")");
    _texTwoArg(s, "\\binom", "C(", ",", ")");
    _texSqrt(s);
    _texOneArg(s, "\\pmod", " (mod ", ")");
    _texOneArg(s, "\\xrightarrow", "-", "->");

    // Stopnie: ^\circ / ^{\circ} -> deg (pozostale \circ = zlozenie funkcji)
    s.replace("^{\\circ}", "deg");
    s.replace("^\\circ", "deg");

    // === Komendy -> ASCII (cale nazwy, kolejnosc juz nie psuje dluzszych) ===
    static const char* const kRep[][2] = {
        // Strzalki (PRZED \left/\right)
        { "\\rightleftharpoons", " <=> " }, { "\\leftrightharpoons", " <=> " },
        { "\\Longleftrightarrow", "<=>" }, { "\\longleftrightarrow", "<->" },
        { "\\Longrightarrow", "=>" }, { "\\longrightarrow", "->" },
        { "\\Longleftarrow", "<=" },  { "\\longleftarrow", "<-" },
        { "\\Leftrightarrow", "<=>" }, { "\\leftrightarrow", "<->" },
        { "\\Rightarrow", "=>" }, { "\\rightarrow", "->" },
        { "\\Leftarrow", "<=" },  { "\\leftarrow", "<-" }, { "\\gets", "<-" },
        { "\\uparrow", "^" }, { "\\downarrow", "v" },
        { "\\mapsto", "->" }, { "\\implies", "=>" }, { "\\impliedby", "<=" },
        { "\\iff", " <=> " }, { "\\to", "->" },
        // Nawiasy
        { "\\left.", "" }, { "\\right.", "" },
        { "\\langle", "<" }, { "\\rangle", ">" },
        { "\\lfloor", "[" }, { "\\rfloor", "]" }, { "\\lceil", "[" }, { "\\rceil", "]" },
        { "\\lvert", "|" }, { "\\rvert", "|" }, { "\\lVert", "||" }, { "\\rVert", "||" },
        { "\\|", "||" },
        { "\\left", "" }, { "\\right", "" },
        { "\\Biggl", "" }, { "\\Biggr", "" }, { "\\biggl", "" }, { "\\biggr", "" },
        { "\\Bigg", "" }, { "\\bigg", "" }, { "\\Bigl", "" }, { "\\Bigr", "" },
        { "\\bigl", "" }, { "\\bigr", "" }, { "\\Big", "" }, { "\\big", "" },
        // Operatory i relacje
        { "\\cdots", "..." }, { "\\cdot", "*" }, { "\\times", "x" }, { "\\ast", "*" },
        { "\\div", "/" }, { "\\pm", "+/-" }, { "\\mp", "-/+" },
        { "\\geqslant", ">=" }, { "\\leqslant", "<=" },
        { "\\geq", ">=" }, { "\\leq", "<=" }, { "\\ge", ">=" }, { "\\le", "<=" },
        { "\\neq", "!=" }, { "\\ne", "!=" }, { "\\ll", "<<" }, { "\\gg", ">>" },
        { "\\approx", "~=" }, { "\\simeq", "~=" }, { "\\equiv", "==" },
        { "\\sim", "~" }, { "\\propto", "~" }, { "\\cong", " ~= " },
        { "\\circ", " o " }, { "\\degree", "deg" },
        // Zbiory
        { "\\infty", "\x01" },
        { "\\emptyset", "\x02\x03" }, { "\\varnothing", "\x02\x03" },
        { "\\subseteq", " sub= " }, { "\\subset", " sub " },
        { "\\supseteq", " sup= " }, { "\\supset", " sup " },
        { "\\notin", " not in " }, { "\\in", " in " }, { "\\ni", " ni " },
        { "\\bigcup", "U" }, { "\\bigcap", "I" }, { "\\cup", " U " }, { "\\cap", " I " },
        { "\\setminus", " \x04 " },
        // Logika
        { "\\land", " AND " }, { "\\wedge", " AND " }, { "\\lor", " OR " }, { "\\vee", " OR " },
        { "\\lnot", "NOT " }, { "\\neg", "NOT " },
        { "\\forall", "for_each " }, { "\\exists", "exists " },
        // Geometria
        { "\\angle", "kat " }, { "\\triangle", "tr." }, { "\\parallel", " || " },
        { "\\perp", " perp " },
        // Wielkie greckie
        { "\\Delta", "delta" }, { "\\Sigma", "SUM" }, { "\\Pi", "PROD" },
        { "\\Omega", "Omega" }, { "\\Gamma", "Gamma" }, { "\\Lambda", "Lambda" },
        { "\\Theta", "Theta" }, { "\\Phi", "Phi" }, { "\\Psi", "Psi" }, { "\\Xi", "Xi" },
        // Male greckie
        { "\\alpha", "alfa" }, { "\\beta", "beta" }, { "\\gamma", "gamma" },
        { "\\delta", "delta" }, { "\\varepsilon", "eps" }, { "\\epsilon", "eps" },
        { "\\zeta", "dzeta" }, { "\\eta", "eta" }, { "\\iota", "iota" },
        { "\\kappa", "kappa" }, { "\\mu", "mu" }, { "\\nu", "nu" }, { "\\xi", "xi" },
        { "\\rho", "rho" }, { "\\varrho", "rho" }, { "\\sigma", "sigma" },
        { "\\varsigma", "sigma" }, { "\\tau", "tau" }, { "\\upsilon", "upsilon" },
        { "\\varphi", "fi" }, { "\\phi", "fi" }, { "\\chi", "chi" }, { "\\psi", "psi" },
        { "\\omega", "omega" }, { "\\varpi", "pi" }, { "\\pi", "pi" },
        { "\\vartheta", "theta" }, { "\\theta", "theta" }, { "\\lambda", "lambda" },
        // Duze operatory
        { "\\sum", "SUM" }, { "\\prod", "PROD" },
        { "\\iiint", "INT" }, { "\\iint", "INT" }, { "\\oint", "INT" }, { "\\int", "INT" },
        { "\\partial", "d" }, { "\\nabla", "nabla" },
        { "\\limits", "" }, { "\\nolimits", "" },
        // Kropki
        { "\\ldots", "..." }, { "\\dotsc", "..." }, { "\\dotsb", "..." },
        { "\\dots", "..." }, { "\\vdots", ":" }, { "\\ddots", "..." },
        // Mod / wnioskowanie
        { "\\bmod", "mod" }, { "\\mod", "mod" },
        { "\\therefore", "=>" }, { "\\because", "<=" },
        // Funkcje matematyczne — usun backslash, zostaw nazwe
        { "\\arcsin", "arcsin" }, { "\\arccos", "arccos" }, { "\\arctan", "arctan" },
        { "\\arctg", "arctg" }, { "\\arcctg", "arcctg" },
        { "\\sinh", "sinh" }, { "\\cosh", "cosh" }, { "\\tanh", "tanh" },
        { "\\sin", "sin" }, { "\\cos", "cos" }, { "\\tan", "tan" },
        { "\\tg", "tg" }, { "\\ctg", "ctg" }, { "\\cot", "cot" },
        { "\\sec", "sec" }, { "\\csc", "csc" },
        { "\\log", "log" }, { "\\ln", "ln" }, { "\\lg", "lg" }, { "\\exp", "exp" },
        { "\\lim", "lim" }, { "\\max", "max" }, { "\\min", "min" },
        { "\\det", "det" }, { "\\gcd", "gcd" }, { "\\choose", " C " },
        // Odstepy
        { "\\qquad", "  " }, { "\\quad", " " }, { "\\space", " " },
    };
    for (size_t k = 0; k < sizeof(kRep) / sizeof(kRep[0]); k++) {
        _texReplaceCmd(s, kRep[k][0], kRep[k][1]);
    }

    // LaTeX spacing / newline (\\ PRZED "\ ", inaczej "\\ " zostawia "\")
    s.replace("\\\\", "\n");      // \\ = newline w LaTeX
    s.replace("\\,", "");         // mala spacja (\thinspace)
    s.replace("\\:", "");         // medium
    s.replace("\\;", "");         // large
    s.replace("\\!", "");         // negative
    s.replace("\\ ", " ");        // backslash-space = wymuszona spacja

    // Indeksy/wykladniki z grupa: x^{n+1} -> x^(n+1)
    _texScript(s, '^');
    _texScript(s, '_');

    // Wielokrotne newlines -> max 2
    while (s.indexOf("\n\n\n") >= 0) s.replace("\n\n\n", "\n\n");

    // Pozostale luzne nawiasy grupujace LaTeX-a (e^{i\pi} itp.) — usun.
    // Doslowne { } z \{ \} / \emptyset sa w placeholderach i przetrwaja.
    s.replace("{", "");
    s.replace("}", "");
    s.replace("\x02", "{");
    s.replace("\x03", "}");
    s.replace("\x04", "\\");
    s.replace("\x05", "&");
    s.replace("\x06", "$");

    // UTF-8 (polskie znaki, typografia, symbole) -> ASCII — ekran 6x10 jest
    // ASCII-only. Na koncu, zeby nie kolidowalo z obrobka LaTeX.
    return _kalkUtf8ToAscii(s);
}

// Rysuje linie tekstu z obsluga placeholderow:
//   \x01 = symbol nieskonczonosci (rysowany jako 2 male okregi)
// Pozostale znaki przez normalny drawStr. Linia moze byc dlugosci dowolnej.
inline void testsDrawLine(U8G2 &d, int x, int y, const String& line) {
    int start = 0;
    int cur = x;
    for (int i = 0; i < (int)line.length(); i++) {
        if ((unsigned char)line[i] == 0x01) {
            // Wyrenderuj tekst przed placeholderem
            if (i > start) {
                String chunk = line.substring(start, i);
                d.drawStr(cur, y, chunk.c_str());
                cur += d.getStrWidth(chunk.c_str());
            }
            // Bitmapa ∞: dwa kolka 3-px srednicy stykajace sie. Wysokosc ~5px.
            // Centrowane wzdluz baseline (y to dolna krawedz tekstu).
            int cy = y - 4;       // srodek symbolu
            d.drawCircle(cur + 2, cy, 2);
            d.drawCircle(cur + 6, cy, 2);
            cur += 10;
            start = i + 1;
        }
    }
    if (start < (int)line.length()) {
        String chunk = line.substring(start);
        d.drawStr(cur, y, chunk.c_str());
    }
}

// =====================================================================
//  Ekran "Sprawdzian" (dev mode) — analogiczny do Notatek ale z formatowaniem
//
//  Przeniesione tu z main.cpp — patrz komentarz przy showNotesScreen
//  w notes.h (ten sam powod/mechanizm).
// =====================================================================
// Lokalny helper tlumaczen: 0=PL, 1=EN, 2=DE, 3=CS (bez diakrytykow).
// Wlasny (nie mT() z main.cpp), zeby ten plik obslugiwal 4 jezyki niezaleznie.
static inline const char* _testsTr(const char* pl, const char* en, const char* de, const char* cs) {
    if (kalkSettings.language >= KALK_TR_EXTRA_FIRST) return kalkTrExtra(en, kalkSettings.language);  // 4..10
    switch (kalkSettings.language) {
        case 0:  return pl;
        case 2:  return de;
        case 3:  return cs;
        default: return en;
    }
}

inline void showTestsScreen(U8G2 &d) {
    inputWaitRelease();
    testsBuildTitleCache();   // raz na wejscie - eliminuje lagi listy

    auto drawList = [&](int cursor, int count) {
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        char hdr[40];
        snprintf(hdr, sizeof(hdr),
            _testsTr("Sprawdzian (%d)", "Tests (%d)", "Tests (%d)", "Pisemky (%d)"), count);
        d.drawStr(2, 10, hdr);
        d.drawHLine(0, 12, 256);

        if (count == 0) {
            d.drawStr(2, 30, _testsTr("Brak sprawdzianow.",
                                    "No tests.",
                                    "Keine Tests.",
                                    "Zadne pisemky."));
            d.drawStr(2, 42, _testsTr("Dodaj w panelu klienta i sync.",
                                    "Add in user panel and sync.",
                                    "Im Kundenpanel hinzufuegen u. sync.",
                                    "Pridejte v panelu zakaznika a sync."));
            d.setFont(u8g2_font_5x7_tf);
            d.drawStr(2, 62, _testsTr("OK = sync   < = wyjscie",
                                    "OK = sync   < = exit",
                                    "OK = sync   < = beenden",
                                    "OK = sync   < = konec"));
        } else {
            int scroll = (cursor < 4) ? 0 : cursor - 3;
            for (int i = 0; i < 4 && (scroll + i) < count; i++) {
                int idx = scroll + i;
                int y = 25 + i * 10;
                // Cache tytulow - bez I/O na kazda ramke
                String title = testsTitleAt(idx);
                if (title.length() == 0) title = "(bez tytulu)";
                if (title.length() > 38) title = title.substring(0, 36) + "..";
                if (idx == cursor) {
                    d.setDrawColor(1);
                    d.drawBox(0, y - 9, 256, 11);
                    d.setDrawColor(0);
                    d.drawStr(4, y, title.c_str());
                    d.setDrawColor(1);
                } else {
                    d.drawStr(4, y, title.c_str());
                }
            }
            d.setFont(u8g2_font_5x7_tf);
            d.drawStr(2, 62, _testsTr("OK=otworz  v=sync  <=wyjscie",
                                    "OK=open  v=sync  <=exit",
                                    "OK=oeffnen v=sync <=beenden",
                                    "OK=otevrit  v=sync  <=konec"));
        }
        d.sendBuffer();
    };

    auto drawDetail = [&](const TestEntry& t) {
        // User czyta — dluzszy timeout snu zamiast trwalej blokady
        powerSetMinTimeout(_KALK_READ_TIMEOUT_MS);
        // Format LaTeX/markdown -> ASCII, potem linie po ~42 znaki (font 6x10)
        String formatted = testsFormat(t.content);
        std::vector<String> lines;
        _kalkWrapLines(formatted, 42, lines);
        formatted = "";

        // Tytul juz ASCII (testsGet) — polskie znaki nie rysuja sie jako krzaki
        String title = t.title.length() == 0 ? String("(bez tytulu)") : t.title;
        if (title.length() > 40) title = title.substring(0, 38) + "..";

        int scrollLine = 0;
        bool needRedraw = true;   // rysuj tylko po zmianie (bez sendBuffer co 20 ms)
        while (true) {
            if (powerCheckSleep()) needRedraw = true;   // takze panicCheck()
            if (panicTriggered()) { powerSetMinTimeout(0); return; }

            if (needRedraw) {
                needRedraw = false;
                d.clearBuffer();
                d.setFont(u8g2_font_6x10_tf);
                d.drawStr(2, 10, title.c_str());
                d.drawHLine(0, 12, 256);

                for (int i = 0; i < 4; i++) {
                    int idx = scrollLine + i;
                    if (idx >= (int)lines.size()) break;
                    testsDrawLine(d, 2, 24 + i * 11, lines[idx]);
                }

                d.setFont(u8g2_font_5x7_tf);
                char info[24];
                snprintf(info, sizeof(info), "%d/%d", scrollLine + 1, (int)lines.size());
                d.drawStr(220, 62, info);
                d.drawStr(2, 62, _testsTr("^/v scroll  < wstecz",
                                        "^/v scroll  < back",
                                        "^/v scroll  < zurueck",
                                        "^/v posun  < zpet"));
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
        d.drawStr(2, 30, _testsTr("Synchronizacja...", "Syncing...", "Synchronisiere...", "Synchronizace..."));
        d.sendBuffer();

        if (WiFi.status() != WL_CONNECTED) {
            char ssid[33] = "", pass[64] = "";
            if (wifiLoadSaved(ssid, sizeof(ssid), pass, sizeof(pass))) {
                wifiConnectStart(ssid, pass);   // STA + TxPower; nie restartuje trwajacego laczenia
                uint32_t t0 = millis();
                while (WiFi.status() != WL_CONNECTED && millis() - t0 < 10000) delay(100);
            }
            memset(pass, 0, sizeof(pass));
        }
        if (WiFi.status() != WL_CONNECTED) {
            d.clearBuffer();
            d.setFont(u8g2_font_6x10_tf);
            d.drawStr(2, 30, _testsTr("Brak WiFi", "No WiFi", "Kein WLAN", "Bez WiFi"));
            d.sendBuffer();
            delay(2000);
            return -1;
        }
        // Licencja opcjonalna - nowy model uzywa deviceId.
        char licKey[40];
        wifiLoadLicense(licKey, sizeof(licKey));
        int n = testsSync(licKey, KALK_API_KEY);
        // Plik sie zmienil - przebuduj cache tytulow
        testsBuildTitleCache();
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        if (n < 0) {
            d.drawStr(2, 30, _testsTr("Blad synchronizacji", "Sync error", "Sync-Fehler", "Chyba synchronizace"));
        } else {
            char buf[40];
            snprintf(buf, sizeof(buf),
                _testsTr("Pobrano: %d sprawdz.", "Downloaded: %d tests", "Geladen: %d Tests", "Stazeno: %d pisemek"), n);
            d.drawStr(2, 30, buf);
        }
        d.sendBuffer();
        delay(1500);
        return n;
    };

    int cursor = 0;
    int count = (int)testsCount();
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
                syncFromServer();
                count = (int)testsCount();
                cursor = 0;
                drawList(cursor, count);
            } else if (cursor >= count - 1) {
                syncFromServer();
                count = (int)testsCount();
                if (cursor >= count) cursor = count > 0 ? count - 1 : 0;
                drawList(cursor, count);
            } else {
                cursor++;
                drawList(cursor, count);
            }
        }
        if (btnPressed(BTN_OK)) {
            if (count == 0) {
                syncFromServer();
                count = (int)testsCount();
                cursor = 0;
                drawList(cursor, count);
            } else {
                TestEntry t;
                if (testsGet(cursor, t)) drawDetail(t);
                drawList(cursor, count);
            }
        }
        if (btnPressed(BTN_LEFT) || btnPressed(BTN_BACK)) return;
        delay(20);
    }
}
