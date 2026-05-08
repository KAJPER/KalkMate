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
    http.setTimeout(_TESTS_HTTP_TIMEOUT);

    int code = http.GET();
    if (code != 200) {
        Serial.printf("[TESTS] sync HTTP %d\n", code);
        http.end();
        return -1;
    }

    String body = http.getString();
    http.end();

    int testsIdx = body.indexOf("\"tests\":");
    if (testsIdx < 0) return 0;
    int arrStart = body.indexOf('[', testsIdx);
    if (arrStart < 0) return 0;

    int depth = 0;
    int arrEnd = -1;
    for (int i = arrStart; i < (int)body.length(); i++) {
        if (body[i] == '[') depth++;
        else if (body[i] == ']') {
            depth--;
            if (depth == 0) { arrEnd = i; break; }
        }
    }
    if (arrEnd < 0) return 0;

    String arr = body.substring(arrStart, arrEnd + 1);
    if (arr.length() > _TESTS_MAX_BYTES) {
        Serial.printf("[TESTS] dump too large: %d B\n", arr.length());
        return -1;
    }

    String compact = "[";
    bool first = true;
    int cursor = 0;
    int nDepth = 0;
    int nStart = -1;
    while (cursor < (int)arr.length()) {
        char c = arr[cursor];
        if (c == '{') {
            if (nDepth == 0) nStart = cursor;
            nDepth++;
        } else if (c == '}') {
            nDepth--;
            if (nDepth == 0 && nStart >= 0) {
                String obj = arr.substring(nStart, cursor + 1);
                String t = "", co = "";
                int tIdx = obj.indexOf("\"title\":\"");
                if (tIdx >= 0) {
                    int s = tIdx + 9;
                    int e = s;
                    while (e < (int)obj.length()) {
                        if (obj[e] == '"' && obj[e-1] != '\\') break;
                        e++;
                    }
                    t = obj.substring(s, e);
                }
                int cIdx = obj.indexOf("\"content\":\"");
                if (cIdx >= 0) {
                    int s = cIdx + 11;
                    int e = s;
                    while (e < (int)obj.length()) {
                        if (obj[e] == '"' && obj[e-1] != '\\') break;
                        e++;
                    }
                    co = obj.substring(s, e);
                }
                if (!first) compact += ",";
                compact += "{\"t\":\"" + t + "\",\"c\":\"" + co + "\"}";
                first = false;
                nStart = -1;
            }
        }
        cursor++;
    }
    compact += "]";

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

    // LaTeX commands -> ASCII
    s.replace("\\Delta", "delta");
    s.replace("\\delta", "delta");
    s.replace("\\sqrt{", "sqrt(");
    s.replace("\\sqrt", "sqrt");
    s.replace("\\frac{", "(");
    s.replace("}{", ")/(");      // koncowka pierwszego {} + start drugiego
    s.replace("\\cdot", "*");
    s.replace("\\times", "x");
    s.replace("\\div", "/");
    s.replace("\\geq", ">=");
    s.replace("\\leq", "<=");
    s.replace("\\neq", "!=");
    s.replace("\\infty", "inf");
    s.replace("\\in", " in ");
    s.replace("\\cup", " U ");
    s.replace("\\cap", " I ");
    s.replace("\\left(", "(");
    s.replace("\\right)", ")");
    s.replace("\\left[", "[");
    s.replace("\\right]", "]");
    s.replace("\\left", "");
    s.replace("\\right", "");
    s.replace("\\pi", "pi");
    s.replace("\\alpha", "alfa");
    s.replace("\\beta", "beta");
    s.replace("\\gamma", "gamma");
    s.replace("\\theta", "theta");
    s.replace("\\lambda", "lambda");
    s.replace("\\sum", "SUM");
    s.replace("\\int", "INT");
    s.replace("\\to", "->");
    s.replace("\\rightarrow", "->");
    s.replace("\\Rightarrow", "=>");
    s.replace("\\implies", "=>");

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

    // Wielokrotne newlines -> max 2
    while (s.indexOf("\n\n\n") >= 0) s.replace("\n\n\n", "\n\n");

    return s;
}
