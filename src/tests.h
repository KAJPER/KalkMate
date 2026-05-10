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

#ifndef KALK_SERVER_URL
#error "tests.h wymaga KALK_SERVER_URL"
#endif

#define _TESTS_FILE         "/tests.json"
#define _TESTS_ENDPOINT     KALK_SERVER_URL "/api/device/tests"
#define _TESTS_HTTP_TIMEOUT 30000
#define _TESTS_MAX_BYTES    (160 * 1024)   // bezpiecznie < 192 KB SPIFFS

struct TestEntry {
    String title;
    String content;
};

static bool _testsFsReady = false;

inline bool _testsEnsureFs() {
    if (_testsFsReady) return true;
    if (!SPIFFS.begin(true)) {
        Serial.println("[TESTS] SPIFFS mount failed");
        return false;
    }
    _testsFsReady = true;
    return true;
}

inline uint16_t testsCount() {
    if (!_testsEnsureFs()) return 0;
    if (!SPIFFS.exists(_TESTS_FILE)) return 0;
    File f = SPIFFS.open(_TESTS_FILE, "r");
    if (!f) return 0;
    uint16_t count = 0;
    int depth = 0;
    while (f.available()) {
        char c = f.read();
        if (c == '{') {
            if (depth == 0) count++;
            depth++;
        } else if (c == '}') {
            depth--;
        }
    }
    f.close();
    return count;
}

inline bool testsGet(uint16_t idx, TestEntry &out) {
    if (!_testsEnsureFs()) return false;
    if (!SPIFFS.exists(_TESTS_FILE)) return false;

    File f = SPIFFS.open(_TESTS_FILE, "r");
    if (!f) return false;

    String body;
    body.reserve(f.size() + 1);
    while (f.available()) body += (char)f.read();
    f.close();

    int depth = 0;
    int objStart = -1;
    uint16_t cur = 0;
    for (int i = 0; i < (int)body.length(); i++) {
        char c = body[i];
        if (c == '{') {
            if (depth == 0) objStart = i;
            depth++;
        } else if (c == '}') {
            depth--;
            if (depth == 0 && objStart >= 0) {
                if (cur == idx) {
                    String obj = body.substring(objStart, i + 1);
                    out.title = "";
                    out.content = "";
                    int tIdx = obj.indexOf("\"t\":\"");
                    if (tIdx >= 0) {
                        int s = tIdx + 5;
                        int e = s;
                        while (e < (int)obj.length()) {
                            if (obj[e] == '"' && obj[e-1] != '\\') break;
                            e++;
                        }
                        out.title = obj.substring(s, e);
                    }
                    int cIdx = obj.indexOf("\"c\":\"");
                    if (cIdx >= 0) {
                        int s = cIdx + 5;
                        int e = s;
                        while (e < (int)obj.length()) {
                            if (obj[e] == '"' && obj[e-1] != '\\') break;
                            e++;
                        }
                        out.content = obj.substring(s, e);
                    }
                    out.title.replace("\\n", "\n");
                    out.title.replace("\\\"", "\"");
                    out.title.replace("\\\\", "\\");
                    out.content.replace("\\n", "\n");
                    out.content.replace("\\\"", "\"");
                    out.content.replace("\\\\", "\\");
                    return true;
                }
                cur++;
                objStart = -1;
            }
        }
    }
    return false;
}

// _jsonSkipString, _jsonMatchBracket, _jsonGetStringField — zdefiniowane w notes.h
// (notes.h jest dolaczony przed tests.h w main.cpp).

inline int testsSync(const char* licenseCode, const char* apiKey) {
    if (!_testsEnsureFs()) return -1;
    if (WiFi.status() != WL_CONNECTED) return -1;

    WiFiClientSecure client;
    client.setInsecure();
    client.setTimeout(30);
    HTTPClient http;
    http.begin(client, _TESTS_ENDPOINT);
    http.addHeader("x-api-key", apiKey);
    if (licenseCode && licenseCode[0])
        http.addHeader("x-license-key", licenseCode);
    // Device ID (MAC) — uzywane w nowym modelu konta (Device.userId)
    {
        uint8_t mac[6];
        esp_read_mac(mac, ESP_MAC_WIFI_STA);
        char did[16];
        snprintf(did, sizeof(did), "%02X%02X%02X%02X%02X%02X",
                 mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
        http.addHeader("x-device-id", did);
    }
    http.setTimeout(_TESTS_HTTP_TIMEOUT);

    int code = http.GET();
    if (code != 200) {
        Serial.printf("[TESTS] sync HTTP %d\n", code);
        http.end();
        return -1;
    }

    String body = http.getString();
    http.end();

    Serial.printf("[TESTS] body length=%d\n", body.length());

    int testsIdx = body.indexOf("\"tests\":");
    if (testsIdx < 0) {
        Serial.println("[TESTS] no tests field");
        return 0;
    }
    int arrStart = body.indexOf('[', testsIdx);
    if (arrStart < 0) return 0;

    int arrEnd = _jsonMatchBracket(body, arrStart, '[', ']');
    if (arrEnd < 0) {
        Serial.println("[TESTS] cannot find array end");
        return -1;
    }

    String arr = body.substring(arrStart, arrEnd + 1);
    if (arr.length() > _TESTS_MAX_BYTES) {
        Serial.printf("[TESTS] dump too large: %d B\n", arr.length());
        return -1;
    }
    Serial.printf("[TESTS] arr length=%d\n", arr.length());

    // Iteruj po obiektach w arr (JSON-aware)
    String compact = "[";
    compact.reserve(arr.length() + 64);
    bool first = true;
    int cursor = 1;  // skip opening [
    int testCount = 0;
    while (cursor < (int)arr.length() - 1) {
        // skip whitespace + przecinki
        while (cursor < (int)arr.length() &&
               (arr[cursor] == ' ' || arr[cursor] == '\t' || arr[cursor] == '\n' ||
                arr[cursor] == '\r' || arr[cursor] == ',')) {
            cursor++;
        }
        if (cursor >= (int)arr.length() - 1 || arr[cursor] != '{') break;

        int objEnd = _jsonMatchBracket(arr, cursor, '{', '}');
        if (objEnd < 0) {
            Serial.printf("[TESTS] obj parse fail at %d\n", cursor);
            break;
        }
        String obj = arr.substring(cursor, objEnd + 1);
        String t  = _jsonGetStringField(obj, "title");
        String co = _jsonGetStringField(obj, "content");

        if (!first) compact += ",";
        compact += "{\"t\":\"";
        compact += t;
        compact += "\",\"c\":\"";
        compact += co;
        compact += "\"}";
        first = false;
        testCount++;

        cursor = objEnd + 1;
    }
    compact += "]";

    Serial.printf("[TESTS] parsed %d tests, compact=%d B\n",
                  testCount, compact.length());

    File f = SPIFFS.open(_TESTS_FILE, "w");
    if (!f) {
        Serial.println("[TESTS] cannot open tests file for write");
        return -1;
    }
    size_t written = f.print(compact);
    f.close();
    Serial.printf("[TESTS] saved %u bytes\n", (unsigned)written);

    return testsCount();
}

inline void testsClear() {
    if (!_testsEnsureFs()) return;
    if (SPIFFS.exists(_TESTS_FILE)) SPIFFS.remove(_TESTS_FILE);
}

// ---------------------------------------------------------------------
//  Formatowanie: konwersja markdown/LaTeX -> ASCII dla OLED 6x10 fonta
// ---------------------------------------------------------------------
// Helper: usun LaTeX-owe komendy typu "\<name>{<content>}" zachowujac
// wewnetrzny <content>. Wywoluje sie z lista znanych nazw (\\text, \\mathrm, ...).
// Brace-matching obsluguje zagniezdzone {}.
static void _stripBracedCommand(String& s, const char* cmdWithSlash) {
    int cmdLen = strlen(cmdWithSlash);
    while (true) {
        int idx = s.indexOf(cmdWithSlash);
        if (idx < 0) break;
        int braceStart = idx + cmdLen;
        // Pomin biale znaki miedzy nazwa a {
        while (braceStart < (int)s.length() &&
               (s[braceStart] == ' ' || s[braceStart] == '\t')) braceStart++;
        if (braceStart >= (int)s.length() || s[braceStart] != '{') {
            // Nie nastepuje { — usun samo polecenie i jedz dalej
            s = s.substring(0, idx) + s.substring(idx + cmdLen);
            continue;
        }
        // Znajdz pasujacy } z licznikiem zagniezdzenia
        int depth = 1;
        int end = braceStart + 1;
        while (end < (int)s.length() && depth > 0) {
            if (s[end] == '{') depth++;
            else if (s[end] == '}') {
                depth--;
                if (depth == 0) break;
            }
            end++;
        }
        if (end >= (int)s.length()) break;  // niedomkniete {} — wyjdz
        // Sklej: prefix + zawartosc {} + suffix
        s = s.substring(0, idx) + s.substring(braceStart + 1, end) + s.substring(end + 1);
    }
}

inline String testsFormat(const String& src) {
    String s = src;
    // Bold/italic markdown — usun znaczniki
    s.replace("**", "");
    s.replace("*", "");
    s.replace("__", "");
    s.replace("##", "");
    s.replace("#", "");

    // Math delimiters $$...$$ i $...$
    s.replace("$$", "");
    s.replace("$", "");

    // LaTeX komendy z argumentem {...} — zachowaj tylko zawartosc
    _stripBracedCommand(s, "\\text");
    _stripBracedCommand(s, "\\textbf");
    _stripBracedCommand(s, "\\textit");
    _stripBracedCommand(s, "\\textrm");
    _stripBracedCommand(s, "\\mathrm");
    _stripBracedCommand(s, "\\mathbf");
    _stripBracedCommand(s, "\\mathit");
    _stripBracedCommand(s, "\\mathbb");        // \mathbb{R} -> R itp.
    _stripBracedCommand(s, "\\mathcal");
    _stripBracedCommand(s, "\\mathfrak");
    _stripBracedCommand(s, "\\boxed");
    _stripBracedCommand(s, "\\overline");
    _stripBracedCommand(s, "\\underline");
    _stripBracedCommand(s, "\\vec");           // wektor: \vec{v} -> v
    _stripBracedCommand(s, "\\overrightarrow"); // \overrightarrow{AB} -> AB
    _stripBracedCommand(s, "\\overleftarrow");
    _stripBracedCommand(s, "\\overleftrightarrow");
    _stripBracedCommand(s, "\\widehat");
    _stripBracedCommand(s, "\\widetilde");
    _stripBracedCommand(s, "\\hat");
    _stripBracedCommand(s, "\\bar");
    _stripBracedCommand(s, "\\tilde");
    _stripBracedCommand(s, "\\dot");
    _stripBracedCommand(s, "\\ddot");
    _stripBracedCommand(s, "\\operatorname");
    _stripBracedCommand(s, "\\substack");
    _stripBracedCommand(s, "\\stackrel");
    _stripBracedCommand(s, "\\overset");
    _stripBracedCommand(s, "\\underset");

    // \sqrt[n]{x} -> n-rt(x): obsluga pierwiastka n-tego stopnia
    // Prosty hack: \sqrt[ -> "" potem ]{ -> "-rt("
    // (musi byc przed \sqrt{ ktore zamienia { na ( )
    while (true) {
        int sqIdx = s.indexOf("\\sqrt[");
        if (sqIdx < 0) break;
        int closeBracket = s.indexOf("]", sqIdx);
        int openBrace = (closeBracket >= 0) ? s.indexOf("{", closeBracket) : -1;
        if (closeBracket < 0 || openBrace < 0) break;
        String n = s.substring(sqIdx + 6, closeBracket);  // np. "3"
        s = s.substring(0, sqIdx) + n + "-rt(" + s.substring(openBrace + 1);
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

    // LaTeX commands -> ASCII

    // === Frakcje (wszystkie warianty) ===
    s.replace("\\dfrac{", "(");      // display fraction
    s.replace("\\tfrac{", "(");      // text fraction
    s.replace("\\frac{", "(");
    s.replace("}{", ")/(");          // koncowka pierwszego {} + start drugiego
    // \binom{n}{k} -> (n)C(k) — uwaga: }{ juz zamienione wczesniej
    s.replace("\\binom{", "C(");
    s.replace("\\choose", " C ");

    // === Pierwiastki ===
    s.replace("\\sqrt{", "sqrt(");
    s.replace("\\sqrt", "sqrt");

    // === Operatory ===
    s.replace("\\cdot", "*");
    s.replace("\\times", "x");
    s.replace("\\div", "/");
    s.replace("\\pm", "+/-");
    s.replace("\\mp", "-/+");
    s.replace("\\geq", ">=");
    s.replace("\\leq", "<=");
    s.replace("\\neq", "!=");
    s.replace("\\approx", "~=");
    s.replace("\\equiv", "==");
    s.replace("\\sim", "~");
    s.replace("\\propto", "~");
    s.replace("\\circ", "deg");     // ^\circ = stopnie

    // === Zbiory ===
    s.replace("\\infty", "\x01");   // placeholder dla symbolu nieskonczonosci ∞
    s.replace("\\emptyset", "{}");
    s.replace("\\varnothing", "{}");
    s.replace("\\subseteq", " sub= ");
    s.replace("\\subset", " sub ");
    s.replace("\\supseteq", " sup= ");
    s.replace("\\supset", " sup ");
    s.replace("\\notin", " not in ");
    s.replace("\\in", " in ");
    s.replace("\\cup", " U ");
    s.replace("\\cap", " I ");
    s.replace("\\setminus", " \\ ");
    s.replace("\\bigcup", "U");
    s.replace("\\bigcap", "I");

    // === Logika ===
    s.replace("\\land", " AND ");
    s.replace("\\wedge", " AND ");
    s.replace("\\lor", " OR ");
    s.replace("\\vee", " OR ");
    s.replace("\\lnot", "NOT ");
    s.replace("\\neg", "NOT ");
    s.replace("\\forall", "for_each ");
    s.replace("\\exists", "exists ");
    s.replace("\\iff", " <=> ");

    // === Geometria ===
    s.replace("\\angle", "kat ");
    s.replace("\\triangle", "tr.");
    s.replace("\\parallel", " || ");
    s.replace("\\perp", " perp ");
    s.replace("\\cong", " ~= ");
    s.replace("\\similar", " ~ ");

    // === Brackety ===
    s.replace("\\left(", "(");
    s.replace("\\right)", ")");
    s.replace("\\left[", "[");
    s.replace("\\right]", "]");
    s.replace("\\left\\{", "{");
    s.replace("\\right\\}", "}");
    s.replace("\\left|", "|");
    s.replace("\\right|", "|");
    s.replace("\\langle", "<");
    s.replace("\\rangle", ">");
    s.replace("\\lfloor", "[");
    s.replace("\\rfloor", "]");
    s.replace("\\lceil", "[");
    s.replace("\\rceil", "]");
    s.replace("\\left", "");
    s.replace("\\right", "");
    s.replace("\\Big", "");
    s.replace("\\big", "");
    s.replace("\\bigg", "");
    s.replace("\\Bigg", "");

    // === Wielkie greckie ===
    s.replace("\\Delta", "delta");
    s.replace("\\Sigma", "SUM");
    s.replace("\\Pi", "PROD");
    s.replace("\\Omega", "Omega");
    s.replace("\\Gamma", "Gamma");
    s.replace("\\Lambda", "Lambda");
    s.replace("\\Theta", "Theta");
    s.replace("\\Phi", "Phi");
    s.replace("\\Psi", "Psi");
    s.replace("\\Xi", "Xi");

    // === Male greckie ===
    s.replace("\\alpha", "alfa");
    s.replace("\\beta", "beta");
    s.replace("\\gamma", "gamma");
    s.replace("\\delta", "delta");
    s.replace("\\epsilon", "eps");
    s.replace("\\varepsilon", "eps");
    s.replace("\\zeta", "dzeta");
    s.replace("\\eta", "eta");
    s.replace("\\iota", "iota");
    s.replace("\\kappa", "kappa");
    s.replace("\\mu", "mu");
    s.replace("\\nu", "nu");
    s.replace("\\xi", "xi");
    s.replace("\\rho", "rho");
    s.replace("\\sigma", "sigma");
    s.replace("\\tau", "tau");
    s.replace("\\upsilon", "upsilon");
    s.replace("\\varphi", "fi");
    s.replace("\\phi", "fi");
    s.replace("\\chi", "chi");
    s.replace("\\psi", "psi");
    s.replace("\\omega", "omega");
    s.replace("\\pi", "pi");
    s.replace("\\theta", "theta");
    s.replace("\\lambda", "lambda");

    // === Duze operatory ===
    s.replace("\\sum", "SUM");
    s.replace("\\prod", "PROD");
    s.replace("\\int", "INT");
    s.replace("\\oint", "INT");
    s.replace("\\partial", "d");
    s.replace("\\nabla", "nabla");

    // === Kropki/wielokropki ===
    s.replace("\\ldots", "...");
    s.replace("\\cdots", "...");
    s.replace("\\vdots", ":");
    s.replace("\\ddots", "...");
    s.replace("\\dots", "...");

    // === Mod ===
    s.replace("\\pmod", "mod");
    s.replace("\\bmod", "mod");
    s.replace("\\mod", "mod");

    // === Therefore/because ===
    s.replace("\\therefore", "=>");
    s.replace("\\because", "<=");

    // === Strzalki ===
    s.replace("\\to", "->");
    s.replace("\\rightarrow", "->");
    s.replace("\\Rightarrow", "=>");
    s.replace("\\leftarrow", "<-");
    s.replace("\\Leftarrow", "<=");
    s.replace("\\leftrightarrow", "<->");
    s.replace("\\Leftrightarrow", "<=>");
    s.replace("\\uparrow", "^");
    s.replace("\\downarrow", "v");
    s.replace("\\mapsto", "->");
    s.replace("\\implies", "=>");
    s.replace("\\impliedby", "<=");

    // Funkcje matematyczne — usun backslash, zostaw nazwe
    s.replace("\\arcsin", "arcsin");
    s.replace("\\arccos", "arccos");
    s.replace("\\arctan", "arctan");
    s.replace("\\arctg", "arctg");
    s.replace("\\sinh", "sinh");
    s.replace("\\cosh", "cosh");
    s.replace("\\tanh", "tanh");
    s.replace("\\sin", "sin");
    s.replace("\\cos", "cos");
    s.replace("\\tan", "tan");
    s.replace("\\tg", "tg");
    s.replace("\\ctg", "ctg");
    s.replace("\\cot", "cot");
    s.replace("\\sec", "sec");
    s.replace("\\csc", "csc");
    s.replace("\\log", "log");
    s.replace("\\ln", "ln");
    s.replace("\\lg", "lg");
    s.replace("\\exp", "exp");
    s.replace("\\lim", "lim");
    s.replace("\\max", "max");
    s.replace("\\min", "min");
    s.replace("\\det", "det");
    s.replace("\\gcd", "gcd");
    s.replace("\\mod", "mod");

    // LaTeX spacing commands -> spacja lub puste
    s.replace("\\qquad", "  ");   // 2em space
    s.replace("\\quad", " ");     // 1em space
    s.replace("\\,", "");          // mala spacja (\\thinspace)
    s.replace("\\:", "");          // medium
    s.replace("\\;", "");          // large
    s.replace("\\!", "");          // negative
    s.replace("\\space", " ");
    s.replace("\\\\", "\n");      // \\ = newline w LaTeX
    s.replace("\\ ", " ");         // backslash-space = wymuszona spacja

    // Niedomkniete } po \\frac{ — zostaw, user zauwazy

    // Polskie znaki -> ASCII (ekran nie ma) — najczestsze
    s.replace("ą", "a"); s.replace("Ą", "A");
    s.replace("ć", "c"); s.replace("Ć", "C");
    s.replace("ę", "e"); s.replace("Ę", "E");
    s.replace("ł", "l"); s.replace("Ł", "L");
    s.replace("ń", "n"); s.replace("Ń", "N");
    s.replace("ó", "o"); s.replace("Ó", "O");
    s.replace("ś", "s"); s.replace("Ś", "S");
    s.replace("ż", "z"); s.replace("Ż", "Z");
    s.replace("ź", "z"); s.replace("Ź", "Z");

    // Unicode punctuation -> ASCII (ekran 6x10 jest ASCII-only)
    s.replace("–", "-");          // en dash (U+2013)
    s.replace("—", "-");          // em dash (U+2014)
    s.replace("−", "-");          // minus sign (U+2212)
    s.replace("…", "...");        // ellipsis (U+2026)
    s.replace("„", "\"");         // double low-9 quote (U+201E)
    s.replace("”", "\"");         // right double quote (U+201D)
    s.replace("“", "\"");         // left double quote (U+201C)
    s.replace("‘", "'");          // left single quote (U+2018)
    s.replace("’", "'");          // right single quote (U+2019)
    s.replace("×", "x");          // multiplication sign (U+00D7)
    s.replace("÷", "/");          // division sign (U+00F7)
    s.replace("°", "deg");        // degree sign (U+00B0)
    s.replace("·", "*");          // middle dot (U+00B7)
    s.replace("≤", "<=");         // less-or-equal (U+2264)
    s.replace("≥", ">=");         // greater-or-equal (U+2265)
    s.replace("≠", "!=");         // not equal (U+2260)
    s.replace("±", "+/-");        // plus-minus (U+00B1)
    s.replace("\xC2\xA0", " ");   // non-breaking space (U+00A0)

    // Wielokrotne newlines -> max 2
    while (s.indexOf("\n\n\n") >= 0) s.replace("\n\n\n", "\n\n");

    // Pozostale luzne nawiasy grupujace LaTeX-a (po \frac, e^{i\pi}, x_{n+1} itp.)
    // sa juz tylko czystymi {} - usun je. Userowy literal {} przepadnie,
    // ale w tekstach matematycznych to rzadkosc.
    s.replace("{", "");
    s.replace("}", "");

    return s;
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
