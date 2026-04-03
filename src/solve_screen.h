#pragma once
// solve_screen.h — Rozwiazywanie zadan AI dla KalkMate
// Wywolanie: showSolveScreen(display);
//
// Tryby:
//   0 = Zdjecie (OV2640 → JPEG → serwer)
//   1 = Tekst    (klawiatura → serwer)
//
// Wymaga:
//   #include "settings_screen.h"    (kalkSettings)
//   #include "wifi_persist.h"       (wifiLoadSaved / wifiGetSavedSSID)
//   WiFi musi byc polaczony lub zostanie podjeta proba polaczenia

#include <Arduino.h>
#include <U8g2lib.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include "settings_screen.h"
#include "wifi_persist.h"
#include "wifi_settings.h"  // klawiatura (_runKeyboard, itp.)

// ---------------------------------------------------------------------------
// Konfiguracja serwera
// ---------------------------------------------------------------------------
#ifndef KALK_SERVER_URL
#define KALK_SERVER_URL "https://twojserwer.pl"
#endif
#ifndef KALK_API_KEY
#define KALK_API_KEY ""
#endif

#define _SOL_SOLVE_ENDPOINT  KALK_SERVER_URL "/api/device/solve"
#define _SOL_TEXT_MAX        512   // max znakow zadania
#define _SOL_SOLUTION_MAX    900   // max znakow odpowiedzi
#define _SOL_HTTP_TIMEOUT_MS 30000 // 30s timeout HTTP

// ---------------------------------------------------------------------------
// Piny przyciskow
// ---------------------------------------------------------------------------
#ifndef BTN_UP
#define BTN_UP    26
#endif
#ifndef BTN_DOWN
#define BTN_DOWN  12
#endif
#ifndef BTN_LEFT
#define BTN_LEFT  13
#endif
#ifndef BTN_RIGHT
#define BTN_RIGHT 14
#endif
#ifndef BTN_OK
#define BTN_OK    27
#endif

// ---------------------------------------------------------------------------
// Debounce
// ---------------------------------------------------------------------------
static unsigned long _solLastPress = 0;
#define _SOL_DEBOUNCE_MS 200

static bool _solBtn(int pin) {
    if (digitalRead(pin) == LOW) {
        unsigned long now = millis();
        if (now - _solLastPress > _SOL_DEBOUNCE_MS) {
            _solLastPress = now;
            return true;
        }
    }
    return false;
}

static void _solWaitRelease() {
    while (digitalRead(BTN_UP)    == LOW ||
           digitalRead(BTN_DOWN)  == LOW ||
           digitalRead(BTN_LEFT)  == LOW ||
           digitalRead(BTN_RIGHT) == LOW ||
           digitalRead(BTN_OK)    == LOW) {
        delay(10);
    }
    _solLastPress = millis();
}

static const char* _solT(const char* pl, const char* en) {
    return kalkSettings.language == 0 ? pl : en;
}

// ---------------------------------------------------------------------------
// Pomocnik: rysowanie "spinera" ladowania
// ---------------------------------------------------------------------------
static void _solDrawLoading(U8G2 &d, const char* msg, int frame) {
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);
    d.drawStr(2, 20, msg);
    // Prosta animacja: [/ - \ |]
    const char* frames[] = {"/", "-", "\\", "|"};
    char anim[4];
    snprintf(anim, sizeof(anim), "[%s]", frames[frame % 4]);
    d.drawStr(120, 40, anim);
    d.sendBuffer();
}

// ---------------------------------------------------------------------------
// Pomocnik: ekran bledu
// ---------------------------------------------------------------------------
static void _solDrawError(U8G2 &d, const char* line1, const char* line2) {
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);
    d.drawStr(2, 16, _solT("! Blad !", "! Error !"));
    d.drawHLine(0, 18, 256);
    d.drawStr(2, 32, line1);
    if (line2 && line2[0]) d.drawStr(2, 46, line2);
    d.setFont(u8g2_font_5x7_tf);
    d.drawStr(2, 62, _solT("OK = powrot", "OK = back"));
    d.sendBuffer();
    _solWaitRelease();
    while (!_solBtn(BTN_OK) && !_solBtn(BTN_LEFT)) delay(20);
    _solWaitRelease();
}

// ---------------------------------------------------------------------------
// Wyswietlanie rozwiazania (przewijane UP/DOWN, wyjscie LEFT)
// Tekst jest zawijany reczne co ~40 znakow na linie ekranu 6x10
// ---------------------------------------------------------------------------
#define _SOL_LINES_MAX    64
#define _SOL_LINE_LEN     44

static void _solDisplaySolution(U8G2 &d, const char* solution) {
    // Podziel tekst na linie ~40 znakow
    static char _lines[_SOL_LINES_MAX][_SOL_LINE_LEN + 1];
    int lineCount = 0;

    int slen = strlen(solution);
    int pos  = 0;
    while (pos < slen && lineCount < _SOL_LINES_MAX) {
        // Znajdz koniec linii: newline lub dlugosc _SOL_LINE_LEN
        int end = pos;
        int lastSpace = -1;
        while (end < slen && end - pos < _SOL_LINE_LEN) {
            if (solution[end] == '\n') break;
            if (solution[end] == ' ') lastSpace = end;
            end++;
        }
        if (end < slen && solution[end] != '\n' && lastSpace > pos) {
            // Zawroc do ostatniej spacji zeby nie przerwac w srodku slowa
            end = lastSpace;
        }
        int len = end - pos;
        strncpy(_lines[lineCount], solution + pos, len);
        _lines[lineCount][len] = '\0';
        lineCount++;
        pos = end;
        if (pos < slen && (solution[pos] == '\n' || solution[pos] == ' '))
            pos++;
    }

    // Wyswietlacz 256x64, font 6x10 → 4 linie widoczne (y=13,24,35,46)
    const int VISIBLE = 4;
    int scroll = 0;
    _solWaitRelease();

    while (true) {
        d.clearBuffer();
        d.setFont(u8g2_font_5x7_tf);
        // Naglowek
        char hdr[32];
        snprintf(hdr, sizeof(hdr), _solT("Rozwiazanie (%d/%d):", "Solution (%d/%d):"),
                 scroll + 1, lineCount);
        d.drawStr(2, 8, hdr);
        d.drawHLine(0, 10, 256);

        d.setFont(u8g2_font_6x10_tf);
        for (int i = 0; i < VISIBLE; i++) {
            int li = scroll + i;
            if (li >= lineCount) break;
            d.drawStr(2, 20 + i * 12, _lines[li]);
        }

        // Strzalki przewijania
        d.setFont(u8g2_font_5x7_tf);
        if (scroll > 0)
            d.drawStr(248, 16, "^");
        if (scroll + VISIBLE < lineCount)
            d.drawStr(248, 60, "v");
        d.drawStr(2, 63, _solT("< wyjdz   ^/v przewijaj", "< exit   ^/v scroll"));

        d.sendBuffer();

        if (_solBtn(BTN_UP)) {
            if (scroll > 0) scroll--;
        } else if (_solBtn(BTN_DOWN)) {
            if (scroll + VISIBLE < lineCount) scroll++;
        } else if (_solBtn(BTN_LEFT) || _solBtn(BTN_OK)) {
            _solWaitRelease();
            return;
        }
        delay(20);
    }
}

// ---------------------------------------------------------------------------
// Sprawdz WiFi — polacz jesli nie jest polaczony (uzyj zapisanych danych)
// Zwraca true jesli polaczony
// ---------------------------------------------------------------------------
static bool _solEnsureWifi(U8G2 &d) {
    if (WiFi.status() == WL_CONNECTED) return true;

    // Sprobuj zaladowac zapisane dane
    char ssid[33] = "";
    char pass[64] = "";
    wifiLoadSaved(ssid, sizeof(ssid), pass, sizeof(pass));

    if (ssid[0] == '\0') {
        _solDrawError(d,
            _solT("Brak WiFi!", "No WiFi!"),
            _solT("Ustaw siec w menu.", "Set network in menu."));
        return false;
    }

    // Proba polaczenia
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);
    char ln[48];
    snprintf(ln, sizeof(ln), _solT("Lacze z: %s", "Connecting: %s"), ssid);
    d.drawStr(2, 24, ln);
    d.drawStr(2, 38, "...");
    d.sendBuffer();

    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, pass);

    unsigned long start = millis();
    int frame = 0;
    while (WiFi.status() != WL_CONNECTED) {
        if (millis() - start > 15000) {
            _solDrawError(d,
                _solT("Blad WiFi!", "WiFi failed!"),
                _solT("Sprawdz haslo.", "Check password."));
            return false;
        }
        _solDrawLoading(d, _solT("Laczenie WiFi...", "Connecting WiFi..."), frame++);
        delay(250);
    }
    return true;
}

// ---------------------------------------------------------------------------
// Tryb TEXT: klawiatura → wyslij do API → pokaz wynik
// ---------------------------------------------------------------------------
static void _solRunTextMode(U8G2 &d) {
    // Klawiatura: label "Zadanie:" zamiast "Haslo:"
    static char taskText[_SOL_TEXT_MAX + 1];
    taskText[0] = '\0';

    // Uzyj klawiatury z wifi_settings.h, zmien tylko naglowek
    // _runKeyboard rysuje "Haslo:" — tutaj nadpiszemy przez wlasny wrapper
    // Zamiast kopiowac cala klawiature, skorzystamy z tej samej funkcji
    // i po prostu akceptujemy naglowek "Haslo:" (jezyk-agnostycznie OK)
    bool saved = _runKeyboard(d, taskText, sizeof(taskText));
    if (!saved || taskText[0] == '\0') return;

    // Upewnij sie ze jest WiFi
    if (!_solEnsureWifi(d)) return;

    // Wyslij do API
    char licKey[40];
    wifiLoadLicense(licKey, sizeof(licKey));

    // Zbuduj JSON
    // {"mode":"text","text":"..."}
    // Escapowanie cudzyslowow w taskText
    String jsonBody = "{\"mode\":\"text\",\"text\":\"";
    for (int i = 0; taskText[i]; i++) {
        char c = taskText[i];
        if (c == '"')  jsonBody += "\\\"";
        else if (c == '\\') jsonBody += "\\\\";
        else if (c == '\n') jsonBody += "\\n";
        else jsonBody += c;
    }
    jsonBody += "\"}";

    int frame = 0;
    unsigned long sendStart = millis();

    WiFiClientSecure client;
    client.setInsecure();  // akceptuj kazdy cert (dla uproszczenia)
    HTTPClient http;
    http.begin(client, _SOL_SOLVE_ENDPOINT);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-api-key", KALK_API_KEY);
    if (licKey[0]) http.addHeader("x-license-key", licKey);
    http.setTimeout(_SOL_HTTP_TIMEOUT_MS);

    // Animacja podczas wysylania
    _solDrawLoading(d, _solT("Wysylam zadanie...", "Sending task..."), frame++);

    int httpCode = http.POST(jsonBody);

    if (httpCode <= 0) {
        http.end();
        _solDrawError(d,
            _solT("Blad polaczenia", "Connection error"),
            http.errorToString(httpCode).c_str());
        return;
    }

    String resp = http.getString();
    http.end();

    if (httpCode != 200) {
        // Sprobuj wyciagnac error z JSON
        int errIdx = resp.indexOf("\"error\":\"");
        char errMsg[64] = "HTTP ";
        if (errIdx >= 0) {
            int start2 = errIdx + 9;
            int end2   = resp.indexOf("\"", start2);
            if (end2 > start2) {
                String e = resp.substring(start2, end2);
                strncpy(errMsg, e.c_str(), sizeof(errMsg) - 1);
            }
        } else {
            snprintf(errMsg, sizeof(errMsg), "HTTP %d", httpCode);
        }
        _solDrawError(d, _solT("Blad API:", "API error:"), errMsg);
        return;
    }

    // Wyciagnij solution z JSON {"ok":true,"solution":"..."}
    int solIdx = resp.indexOf("\"solution\":\"");
    if (solIdx < 0) {
        _solDrawError(d, _solT("Brak odpowiedzi", "No answer"), "");
        return;
    }

    int solStart = solIdx + 12;
    // Proste unescapowanie
    static char solution[_SOL_SOLUTION_MAX + 1];
    int spos = 0;
    for (int i = solStart; i < (int)resp.length() && spos < _SOL_SOLUTION_MAX; i++) {
        char c = resp[i];
        if (c == '"' && (i == 0 || resp[i-1] != '\\')) break;
        if (c == '\\' && i + 1 < (int)resp.length()) {
            char next = resp[i+1];
            if (next == 'n') { solution[spos++] = '\n'; i++; }
            else if (next == '"') { solution[spos++] = '"'; i++; }
            else if (next == '\\') { solution[spos++] = '\\'; i++; }
            else { solution[spos++] = c; }
        } else {
            solution[spos++] = c;
        }
    }
    solution[spos] = '\0';

    _solDisplaySolution(d, solution);
}

// ---------------------------------------------------------------------------
// Tryb ZDJECIE: zrob zdjecie → wyslij do API → pokaz wynik
// ---------------------------------------------------------------------------
static void _solRunPhotoMode(U8G2 &d) {
    // Informacja o przygotowaniu do zdjecia
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);
    d.drawStr(2, 16, _solT("Tryb: Zdjecie", "Mode: Photo"));
    d.drawHLine(0, 18, 256);
    d.drawStr(2, 32, _solT("Skieruj na zadanie.", "Point at the problem."));
    d.drawStr(2, 46, _solT("OK = zrob zdjecie", "OK = take photo"));
    d.setFont(u8g2_font_5x7_tf);
    d.drawStr(2, 62, _solT("< = anuluj", "< = cancel"));
    d.sendBuffer();

    _solWaitRelease();
    while (true) {
        if (_solBtn(BTN_OK)) break;
        if (_solBtn(BTN_LEFT)) { _solWaitRelease(); return; }
        delay(20);
    }
    _solWaitRelease();

    // Inicjalizacja kamery (esp_camera)
    // Zakladamy ze kamera nie jest jeszcze zainicjalizowana
    // (w pelnym projekcie uzyj esp_camera_init z config.h)
#ifdef KALK_CAMERA_ENABLED
    // Zrob zdjecie
    _solDrawLoading(d, _solT("Robie zdjecie...", "Taking photo..."), 0);

    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) {
        _solDrawError(d, _solT("Blad kamery!", "Camera error!"), "");
        return;
    }

    // Upewnij sie ze jest WiFi
    if (!_solEnsureWifi(d)) {
        esp_camera_fb_return(fb);
        return;
    }

    // Zakoduj obraz jako base64
    // Base64 potrzebuje ok 4/3 rozmiaru wejscia
    size_t b64len = ((fb->len + 2) / 3) * 4 + 1;
    char* b64buf = (char*)ps_malloc(b64len);  // PSRAM
    if (!b64buf) {
        esp_camera_fb_return(fb);
        _solDrawError(d, _solT("Brak pamieci!", "Out of memory!"), "PSRAM");
        return;
    }

    // Kodowanie base64
    const char b64chars[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    size_t len = fb->len;
    uint8_t* src = fb->buf;
    size_t bpos = 0;
    for (size_t i = 0; i < len; i += 3) {
        uint32_t val = ((uint32_t)src[i] << 16) |
                       ((i+1 < len ? (uint32_t)src[i+1] : 0) << 8) |
                       (i+2 < len ? (uint32_t)src[i+2] : 0);
        b64buf[bpos++] = b64chars[(val >> 18) & 0x3F];
        b64buf[bpos++] = b64chars[(val >> 12) & 0x3F];
        b64buf[bpos++] = (i+1 < len) ? b64chars[(val >> 6) & 0x3F] : '=';
        b64buf[bpos++] = (i+2 < len) ? b64chars[val & 0x3F] : '=';
    }
    b64buf[bpos] = '\0';
    esp_camera_fb_return(fb);

    char licKey[40];
    wifiLoadLicense(licKey, sizeof(licKey));

    // Zbuduj JSON w PSRAM (duzy bufor)
    // {"mode":"image","mimeType":"image/jpeg","image":"<b64>"}
    size_t jsonSize = b64len + 80;
    char* jsonBuf = (char*)ps_malloc(jsonSize);
    if (!jsonBuf) {
        free(b64buf);
        _solDrawError(d, _solT("Brak pamieci!", "Out of memory!"), "");
        return;
    }
    snprintf(jsonBuf, jsonSize,
             "{\"mode\":\"image\",\"mimeType\":\"image/jpeg\",\"image\":\"%s\"}", b64buf);
    free(b64buf);

    _solDrawLoading(d, _solT("Wysylam zdjecie...", "Sending photo..."), 1);

    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    http.begin(client, _SOL_SOLVE_ENDPOINT);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-api-key", KALK_API_KEY);
    if (licKey[0]) http.addHeader("x-license-key", licKey);
    http.setTimeout(_SOL_HTTP_TIMEOUT_MS);

    int httpCode = http.POST(jsonBuf);
    free(jsonBuf);

    if (httpCode <= 0) {
        http.end();
        _solDrawError(d, _solT("Blad polaczenia", "Connection error"), "");
        return;
    }

    String resp = http.getString();
    http.end();

    if (httpCode != 200) {
        int errIdx = resp.indexOf("\"error\":\"");
        char errMsg[64] = "";
        if (errIdx >= 0) {
            int s2 = errIdx + 9;
            int e2 = resp.indexOf("\"", s2);
            if (e2 > s2) strncpy(errMsg, resp.substring(s2, e2).c_str(), sizeof(errMsg)-1);
        } else {
            snprintf(errMsg, sizeof(errMsg), "HTTP %d", httpCode);
        }
        _solDrawError(d, _solT("Blad API:", "API error:"), errMsg);
        return;
    }

    int solIdx = resp.indexOf("\"solution\":\"");
    if (solIdx < 0) {
        _solDrawError(d, _solT("Brak odpowiedzi", "No answer"), "");
        return;
    }

    int solStart = solIdx + 12;
    static char solution[_SOL_SOLUTION_MAX + 1];
    int spos = 0;
    for (int i = solStart; i < (int)resp.length() && spos < _SOL_SOLUTION_MAX; i++) {
        char c = resp[i];
        if (c == '"' && (i == 0 || resp[i-1] != '\\')) break;
        if (c == '\\' && i + 1 < (int)resp.length()) {
            char next = resp[i+1];
            if (next == 'n') { solution[spos++] = '\n'; i++; }
            else if (next == '"') { solution[spos++] = '"'; i++; }
            else if (next == '\\') { solution[spos++] = '\\'; i++; }
            else { solution[spos++] = c; }
        } else {
            solution[spos++] = c;
        }
    }
    solution[spos] = '\0';

    _solDisplaySolution(d, solution);

#else
    // Kamera niedostepna w tym trybie kompilacji
    _solDrawError(d,
        _solT("Kamera wylaczona", "Camera disabled"),
        _solT("Uzyj trybu tekstu", "Use text mode"));
#endif
}

// ---------------------------------------------------------------------------
// Ekran wyboru trybu (zdjecie / tekst)
// ---------------------------------------------------------------------------
static void _solModeSelect(U8G2 &d, int &mode) {
    // mode: 0 = zdjecie, 1 = tekst
    _solWaitRelease();

    while (true) {
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 10, _solT("=== Rozwiaz zadanie ===", "=== Solve problem ==="));
        d.drawHLine(0, 12, 256);

        // Pozycja 0: Zdjecie
        if (mode == 0) {
            d.drawBox(0, 14, 256, 12);
            d.setDrawColor(0);
            d.drawStr(4, 24, _solT("> [1] Zdjecie kamery", "> [1] Camera photo"));
            d.setDrawColor(1);
        } else {
            d.drawStr(4, 24, _solT("  [1] Zdjecie kamery", "  [1] Camera photo"));
        }

        // Pozycja 1: Tekst
        if (mode == 1) {
            d.drawBox(0, 27, 256, 12);
            d.setDrawColor(0);
            d.drawStr(4, 37, _solT("> [2] Wpisz tekst", "> [2] Enter text"));
            d.setDrawColor(1);
        } else {
            d.drawStr(4, 37, _solT("  [2] Wpisz tekst", "  [2] Enter text"));
        }

        d.drawHLine(0, 52, 256);
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 62, _solT("^/v wybor   OK: start   < wstecz",
                                "^/v select   OK: start   < back"));
        d.sendBuffer();

        if (_solBtn(BTN_UP)) {
            if (mode > 0) mode--;
        } else if (_solBtn(BTN_DOWN)) {
            if (mode < 1) mode++;
        } else if (_solBtn(BTN_OK)) {
            _solWaitRelease();
            return;
        } else if (_solBtn(BTN_LEFT)) {
            mode = -1;  // sygnalizuje wyjscie
            _solWaitRelease();
            return;
        }
        delay(20);
    }
}

// ---------------------------------------------------------------------------
// Publiczna funkcja — glowny punkt wejscia
// ---------------------------------------------------------------------------
void showSolveScreen(U8G2 &display) {
    pinMode(BTN_UP,    INPUT_PULLUP);
    pinMode(BTN_DOWN,  INPUT_PULLUP);
    pinMode(BTN_LEFT,  INPUT_PULLUP);
    pinMode(BTN_RIGHT, INPUT_PULLUP);
    pinMode(BTN_OK,    INPUT_PULLUP);

    int mode = 1;  // domyslnie tekst (kamera moze byc niedostepna)

    while (true) {
        _solModeSelect(display, mode);

        if (mode < 0) return;  // wyjdz do menu

        if (mode == 0) {
            _solRunPhotoMode(display);
        } else {
            _solRunTextMode(display);
        }
        // Po powrocie z trybu → znow wybor trybu
    }
}
