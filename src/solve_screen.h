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
#include "input.h"
#include "settings_screen.h"
#include "wifi_persist.h"
#include "wifi_settings.h"  // klawiatura (_runKeyboard, itp.)
#include "panic.h"
#include "power.h"
#include "history.h"
#include "camera.h"         // camBegin / camCapture / camEnd

#ifndef KALK_CAMERA_ENABLED
#define KALK_CAMERA_ENABLED 1
#endif

// Device ID = MAC ESP32 (12 hex znakow, np. "68FE71E43B94"). Stabilny —
// kazdy ESP32 ma fabrycznie inny MAC, niezmienny przez calos zycia chipu.
static String _solDeviceId() {
    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_WIFI_STA);
    char buf[16];
    snprintf(buf, sizeof(buf), "%02X%02X%02X%02X%02X%02X",
             mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    return String(buf);
}

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
#define _SOL_TEXT_MAX        2048   // max znakow zadania (input)

// UTF-8 polskie + typograficzne znaki -> ASCII (font 6x10 nie ma polskich glyphow).
// Sygnatura jak _testsTitleToAscii w tests.h.
inline String _solUtf8ToAscii(String s) {
    s.replace("ą", "a"); s.replace("Ą", "A");
    s.replace("ć", "c"); s.replace("Ć", "C");
    s.replace("ę", "e"); s.replace("Ę", "E");
    s.replace("ł", "l"); s.replace("Ł", "L");
    s.replace("ń", "n"); s.replace("Ń", "N");
    s.replace("ó", "o"); s.replace("Ó", "O");
    s.replace("ś", "s"); s.replace("Ś", "S");
    s.replace("ż", "z"); s.replace("Ż", "Z");
    s.replace("ź", "z"); s.replace("Ź", "Z");
    s.replace("–", "-"); s.replace("—", "-"); s.replace("−", "-");
    s.replace("„", "\""); s.replace("”", "\""); s.replace("“", "\"");
    s.replace("‘", "'"); s.replace("’", "'");
    s.replace("…", "...");
    s.replace("\xC2\xA0", " ");  // non-breaking space
    s.replace("°", "deg");
    s.replace("×", "x");  s.replace("·", "*");
    s.replace("÷", "/");
    return s;
}
#define _SOL_SOLUTION_MAX    16384  // max znakow odpowiedzi AI (16 KB)
#define _SOL_HTTP_TIMEOUT_MS 45000  // 45s timeout HTTP

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
    if (inputBtn(pin) == LOW) {
        unsigned long now = millis();
        if (now - _solLastPress > _SOL_DEBOUNCE_MS) {
            _solLastPress = now;
            return true;
        }
    }
    return false;
}

static void _solWaitRelease() {
    while (inputBtn(BTN_UP)    == LOW ||
           inputBtn(BTN_DOWN)  == LOW ||
           inputBtn(BTN_LEFT)  == LOW ||
           inputBtn(BTN_RIGHT) == LOW ||
           inputBtn(BTN_OK)    == LOW) {
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
    // Polskie znaki w komunikatach z serwera -> ASCII (bo font nie ma glyphow)
    String l1 = _solUtf8ToAscii(String(line1 ? line1 : ""));
    String l2 = _solUtf8ToAscii(String(line2 ? line2 : ""));
    d.drawStr(2, 32, l1.c_str());
    if (l2.length() > 0) d.drawStr(2, 46, l2.c_str());
    d.setFont(u8g2_font_5x7_tf);
    d.drawStr(2, 62, _solT("OK = powrot", "OK = back"));
    d.sendBuffer();
    _solWaitRelease();
    while (!_solBtn(BTN_OK) && !_solBtn(BTN_LEFT)) delay(20);
    _solWaitRelease();
}

// ---------------------------------------------------------------------------
// Konwerter notacji matematycznej na czytelny tekst ASCII dla OLED
// Zamienia: x^2 -> x^2(=x kwadrat), sqrt(x) -> v(x), itp.
// ---------------------------------------------------------------------------
static void _solFormatMath(const char* src, char* dst, int dstSize) {
    int si = 0, di = 0;
    int slen = strlen(src);

    while (si < slen && di < dstSize - 1) {
        char c = src[si];

        // --- sqrt( ... ) -> zostawiam bez zmian, ladnie wyglada ---
        // (brak konwersji sqrt)

        // --- \sqrt{ -> sqrt( ---
        if (si + 5 < slen && src[si]=='\\' &&
            src[si+1]=='s' && src[si+2]=='q' && src[si+3]=='r' && src[si+4]=='t' && src[si+5]=='{') {
            const char* rep = "sqrt(";
            for (int k = 0; rep[k] && di < dstSize-1; k++) dst[di++] = rep[k];
            si += 6;
            // Zamien zamykajacy } na )
            // (zostanie skopiowany jako } normalnie, pozniej go zastapmy)
            continue;
        }

        // --- x^{n} lub x^n -> potega ---
        if (c == '^' && si + 1 < slen) {
            si++; // pominij ^
            char next = src[si];
            // Zbierz wykladnik
            char exp[16] = "";
            int ei = 0;
            bool brace = (next == '{');
            if (brace) si++; // pominij {
            while (si < slen && ei < 14) {
                char ec = src[si];
                if (brace && ec == '}') { si++; break; }
                if (!brace && (ec == ' ' || ec == '+' || ec == '-' || ec == '*' || ec == '/' || ec == ')' || ec == '\n')) break;
                exp[ei++] = ec;
                si++;
            }
            exp[ei] = '\0';

            // Zamien cyfre na superscript Unicode (jesli jeden znak)
            if (ei == 1) {
                char sup = exp[0];
                const char* supMap = "0123456789";
                const char* supUni[] = {"0","1","2","3","4","5","6","7","8","9"};
                // Uzyj ASCII: ^2 -> ^2 ale dodaj nawiasy dla dlugich
                if (sup == '2' && di < dstSize - 2) { dst[di++] = '^'; dst[di++] = '2'; }
                else if (sup == '3' && di < dstSize - 2) { dst[di++] = '^'; dst[di++] = '3'; }
                else {
                    if (di < dstSize - 1) dst[di++] = '^';
                    for (int k = 0; k < ei && di < dstSize - 1; k++) dst[di++] = exp[k];
                }
            } else if (ei > 1) {
                if (di < dstSize - 1) dst[di++] = '^';
                dst[di++] = '(';
                for (int k = 0; k < ei && di < dstSize - 1; k++) dst[di++] = exp[k];
                if (di < dstSize - 1) dst[di++] = ')';
            }
            continue;
        }

        // --- x_{n} lub x_n -> indeks dolny ---
        if (c == '_' && si + 1 < slen) {
            si++;
            char next = src[si];
            char sub[16] = "";
            int ei = 0;
            bool brace = (next == '{');
            if (brace) si++;
            while (si < slen && ei < 14) {
                char ec = src[si];
                if (brace && ec == '}') { si++; break; }
                if (!brace && (ec == ' ' || ec == '+' || ec == '-' || ec == ')' || ec == '\n')) break;
                sub[ei++] = ec;
                si++;
            }
            sub[ei] = '\0';
            if (di < dstSize - 1) dst[di++] = '_';
            for (int k = 0; k < ei && di < dstSize - 1; k++) dst[di++] = sub[k];
            continue;
        }

        // --- \frac{a}{b} -> a/b ---
        if (c == '\\' && si + 4 < slen &&
            src[si+1]=='f' && src[si+2]=='r' && src[si+3]=='a' && src[si+4]=='c') {
            si += 5;
            // Zbierz licznik {a}
            char num[32] = "", den[32] = "";
            if (si < slen && src[si] == '{') {
                si++;
                int k = 0;
                while (si < slen && src[si] != '}' && k < 30) num[k++] = src[si++];
                num[k] = '\0';
                if (si < slen) si++; // pominij }
            }
            if (si < slen && src[si] == '{') {
                si++;
                int k = 0;
                while (si < slen && src[si] != '}' && k < 30) den[k++] = src[si++];
                den[k] = '\0';
                if (si < slen) si++; // pominij }
            }
            // Wypisz jako (num/den)
            dst[di++] = '(';
            for (int k = 0; num[k] && di < dstSize-1; k++) dst[di++] = num[k];
            dst[di++] = '/';
            for (int k = 0; den[k] && di < dstSize-1; k++) dst[di++] = den[k];
            dst[di++] = ')';
            continue;
        }

        // --- Pomijaj znaki LaTeX: $, \[ \], \( \) ---
        if (c == '$') { si++; continue; }
        if (c == '\\' && si + 1 < slen) {
            char n = src[si+1];
            if (n == '[' || n == ']' || n == '(' || n == ')') { si += 2; continue; }
            if (n == ' ') { dst[di++] = ' '; si += 2; continue; }
            // \cdot -> *
            if (si+4<slen && src[si+1]=='c' && src[si+2]=='d' && src[si+3]=='o' && src[si+4]=='t') {
                dst[di++] = '*'; si += 5; continue;
            }
            // \times -> x
            if (si+5<slen && src[si+1]=='t' && src[si+2]=='i' && src[si+3]=='m' && src[si+4]=='e' && src[si+5]=='s') {
                dst[di++] = 'x'; si += 6; continue;
            }
            // \pi -> pi
            if (si+2<slen && src[si+1]=='p' && src[si+2]=='i') {
                if(di<dstSize-2){dst[di++]='p';dst[di++]='i';} si+=3; continue;
            }
            // \alpha -> alpha, \beta -> beta, itp.
            // Pominij backslash, skopiuj slowo
            si++;
            while (si < slen && src[si] >= 'a' && src[si] <= 'z' && di < dstSize-1)
                dst[di++] = src[si++];
            continue;
        }

        // Zwykly znak
        dst[di++] = c;
        si++;
    }
    dst[di] = '\0';
}

// ---------------------------------------------------------------------------
// Wyswietlanie rozwiazania (przewijane UP/DOWN, wyjscie LEFT)
// Tekst jest zawijany reczne co ~40 znakow na linie ekranu 6x10
// ---------------------------------------------------------------------------
#define _SOL_LINES_MAX    64
#define _SOL_LINE_LEN     44

// Rysuje tekst z obsluga poteg: "e^3" -> "e" normalnie + "3" malym fontem wyzej
// Zwraca szerokosc narysowanego tekstu w px
static int _solDrawMathLine(U8G2 &d, int x, int y, const char* text) {
    int xi = x;
    int len = strlen(text);
    for (int i = 0; i < len; ) {
        if (text[i] == '^' && i + 1 < len) {
            i++; // pominij ^
            char exp[16] = "";
            int elen = 0;
            if (text[i] == '(') {
                // Wykladnik wieloznakowy w nawiasach: ^(abc) -> wszystko do ')'
                i++; // pominij '('
                while (i < len && text[i] != ')' && elen < 14)
                    exp[elen++] = text[i++];
                if (i < len && text[i] == ')') i++; // pominij ')'
            } else {
                // Wykladnik bez nawiasow: tylko cyfry i litery
                // zatrzymaj sie na wszystkich operatorach: + - * / = spacja itp.
                while (i < len && elen < 14 &&
                       isalnum((unsigned char)text[i])) {
                    exp[elen++] = text[i++];
                }
            }
            exp[elen] = '\0';
            if (elen > 0) {
                d.setFont(u8g2_font_5x7_tf);
                d.drawStr(xi, y - 4, exp);
                xi += elen * 5 + 1;
                d.setFont(u8g2_font_6x10_tf);
            }
        } else {
            char ch[2] = {text[i], '\0'};
            d.setFont(u8g2_font_6x10_tf);
            d.drawStr(xi, y, ch);
            xi += 6;
            i++;
        }
    }
    return xi - x;
}

static void _solDisplaySolution(U8G2 &d, const char* solution) {
    // Wylacz auto-sleep — user czyta dluzsza odpowiedz, ekran nie ma sie wylaczyc
    powerSetInhibit(true);

    // Font 6x10, ekran 256x64
    // Uklad: naglowek y=8 (linia 0-9), separtor y=10
    // Linie tekstu: y=21, 33, 45 (3 widoczne, odstep 12px)
    // Pasek dolny: y=57-63
    const int VISIBLE  = 3;   // 3 linie tekstu na raz
    const int LINE_H   = 12;  // wysokosc linii px
    const int LINE_Y0  = 21;  // y bazowe pierwszej linii
    // Maks znakow na linie przy foncie 6px: (256-4)/6 = 42
    const int LINE_CHARS = 41;

    // UTF-8 polskie -> ASCII (font 6x10 nie ma polskich glyphow).
    // Robione PRZED _solFormatMath bo math format moze dorzucic znaki ktore
    // by zlapaly UTF-8 multi-byte (lepiej wyczyscic na wejsciu).
    String asciiSol = _solUtf8ToAscii(String(solution));

    // Przetworz tekst przez konwerter matematyki
    static char _solConverted[_SOL_SOLUTION_MAX + 1];
    _solFormatMath(asciiSol.c_str(), _solConverted, sizeof(_solConverted));

    // Podziel na linie
    static char _lines[_SOL_LINES_MAX][_SOL_LINE_LEN + 1];
    int lineCount = 0;
    int slen = strlen(_solConverted);
    int pos  = 0;

    while (pos < slen && lineCount < _SOL_LINES_MAX) {
        int end = pos;
        int lastSpace = -1;
        while (end < slen && (end - pos) < LINE_CHARS) {
            if (_solConverted[end] == '\n') break;
            if (_solConverted[end] == ' ')  lastSpace = end;
            end++;
        }
        // Zawroc do ostatniej spacji jesli nie koniec
        if (end < slen && _solConverted[end] != '\n' && lastSpace > pos)
            end = lastSpace;
        int len = end - pos;
        if (len > _SOL_LINE_LEN) len = _SOL_LINE_LEN;
        strncpy(_lines[lineCount], _solConverted + pos, len);
        _lines[lineCount][len] = '\0';
        lineCount++;
        pos = end;
        if (pos < slen && (_solConverted[pos] == '\n' || _solConverted[pos] == ' '))
            pos++;
    }

    Serial.printf("[SOL] lineCount=%d\n", lineCount);

    // Czekaj na puszczenie przyciskow
    while (inputBtn(BTN_UP)    == LOW || inputBtn(BTN_DOWN)  == LOW ||
           inputBtn(BTN_LEFT)  == LOW || inputBtn(BTN_RIGHT) == LOW ||
           inputBtn(BTN_OK)    == LOW) {
        delay(10);
    }
    delay(200);
    _solLastPress = millis();

    bool needRedraw = true;
    int scroll = 0;

    while (true) {
        // Wymuszaj sprawdzenie panic key — sleep jest tu inhibitowany,
        // wiec powerCheckSleep() (gdzie zwykle siedzi panicCheck) zwraca
        // natychmiast i panic nigdy by nie byl wykryty.
        panicCheck();
        if (panicTriggered()) {
            powerSetInhibit(false);
            return;
        }
        if (needRedraw) {
            d.clearBuffer();

            // Naglowek
            d.setFont(u8g2_font_5x7_tf);
            char hdr[32];
            snprintf(hdr, sizeof(hdr), "AI %d-%d/%d",
                     scroll + 1,
                     min(scroll + VISIBLE, lineCount),
                     lineCount);
            d.drawStr(2, 8, hdr);
            // Strzalki w naglowku
            if (scroll > 0)                        d.drawStr(240, 8, "^");
            if (scroll + VISIBLE < lineCount)       d.drawStr(248, 8, "v");
            d.drawHLine(0, 10, 256);

            // Linie tekstu z obsluga poteg
            for (int i = 0; i < VISIBLE; i++) {
                int li = scroll + i;
                if (li >= lineCount) break;
                _solDrawMathLine(d, 2, LINE_Y0 + i * LINE_H, _lines[li]);
            }

            // Stopka
            d.drawHLine(0, 55, 256);
            d.setFont(u8g2_font_5x7_tf);
            d.drawStr(2, 63, _solT("< wyjdz  UP/DN scroll", "< exit  UP/DN scroll"));

            d.sendBuffer();
            needRedraw = false;
        }

        unsigned long now = millis();
        if (now - _solLastPress > 180UL) {
            if (inputBtn(BTN_UP) == LOW) {
                _solLastPress = now;
                Serial.println("[SOL] UP");
                if (scroll > 0) { scroll--; needRedraw = true; }
            } else if (inputBtn(BTN_DOWN) == LOW) {
                _solLastPress = now;
                Serial.println("[SOL] DOWN");
                if (scroll + VISIBLE < lineCount) { scroll++; needRedraw = true; }
                else Serial.printf("[SOL] at bottom scroll=%d VISIBLE=%d lineCount=%d\n", scroll, VISIBLE, lineCount);
            } else if (inputBtn(BTN_LEFT) == LOW || inputBtn(BTN_OK) == LOW) {
                _solLastPress = now;
                Serial.println("[SOL] EXIT");
                while (inputBtn(BTN_LEFT) == LOW || inputBtn(BTN_OK) == LOW) delay(10);
                delay(100);
                powerSetInhibit(false);   // przywroc auto-sleep przed wyjsciem
                return;
            }
        }
        delay(10);
    }
}

// ---------------------------------------------------------------------------
// Sprawdz WiFi — polacz jesli nie jest polaczony (uzyj zapisanych danych)
// Zwraca true jesli polaczony
// ---------------------------------------------------------------------------
// Forward decl z device_account.h (zaimplementowane w main.cpp helperze)
extern bool accountRegisterOnce();

static bool _solEnsureWifi(U8G2 &d) {
    if (WiFi.status() == WL_CONNECTED) {
        accountRegisterOnce();
        return true;
    }

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
    accountRegisterOnce();   // zarejestruj device po pierwszym polaczeniu
    return true;
}

// ---------------------------------------------------------------------------
// Tryb TEXT: klawiatura → wyslij do API → pokaz wynik
// ---------------------------------------------------------------------------
// Opcjonalny prefill — gdy != nullptr, klawiatura otwiera sie z tym tekstem
// (uzywane przy "edytuj pytanie" z historii).
static void _solRunTextMode(U8G2 &d, const char* prefill = nullptr) {
    // Klawiatura: label "Zadanie:" zamiast "Haslo:"
    static char taskText[_SOL_TEXT_MAX + 1];
    if (prefill && prefill[0]) {
        strncpy(taskText, prefill, sizeof(taskText) - 1);
        taskText[sizeof(taskText) - 1] = '\0';
    } else {
        taskText[0] = '\0';
    }

    // Uzyj klawiatury z wifi_settings.h, zmien tylko naglowek
    // _runKeyboard rysuje "Haslo:" — tutaj nadpiszemy przez wlasny wrapper
    // Zamiast kopiowac cala klawiature, skorzystamy z tej samej funkcji
    // i po prostu akceptujemy naglowek "Haslo:" (jezyk-agnostycznie OK)
    bool saved = _runKeyboard(d, taskText, sizeof(taskText),
                              _solT("Zadanie: ", "Problem: "));
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
    // KLUCZOWE: WiFiClientSecure ma domyslny socket timeout ~5-10 s.
    // Gdy Gemini myśli długo, socket sie zamyka i HTTPClient zwraca -11
    // (HTTPC_ERROR_READ_TIMEOUT). Ustawiamy 60 s.
    client.setTimeout(60);  // sekundy
    HTTPClient http;
    http.begin(client, _SOL_SOLVE_ENDPOINT);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-api-key", KALK_API_KEY);
    http.addHeader("x-device-id", _solDeviceId());
    http.addHeader("x-fw-version", FW_VERSION);
    if (licKey[0]) http.addHeader("x-license-key", licKey);
    http.setTimeout(_SOL_HTTP_TIMEOUT_MS);

    // Log wysylanego requestu — diagnostyka HTTP 400/401 itd.
    Serial.printf("[SOL] POST %s\n", _SOL_SOLVE_ENDPOINT);
    Serial.printf("[SOL] x-api-key=%s\n", KALK_API_KEY);
    Serial.printf("[SOL] x-license-key=%s\n", licKey[0] ? licKey : "(none)");
    Serial.printf("[SOL] Body (%d B): %s\n", jsonBody.length(), jsonBody.c_str());

    // Pokaz "AI rozwiazuje zadanie" OD RAZU, nie po POST.
    // POST blokuje 5-20 s czekajac na odpowiedz Gemini — przez ten czas
    // user widzi "AI rozwiazuje zadanie / Prosze czekac" zamiast martwego
    // "Wysylam zadanie".
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);
    d.drawStr(2, 24, _solT("AI rozwiazuje zadanie", "AI solving problem"));
    d.setFont(u8g2_font_5x7_tf);
    d.drawStr(2, 40, _solT("Prosze czekac...", "Please wait..."));
    d.sendBuffer();

    // POST blokujacy — Gemini moze odpowiadac do 30 s, klient czeka.
    int httpCode = http.POST(jsonBody);

    String resp = http.getString();
    http.end();

    Serial.printf("[SOL] HTTP %d, response len=%d\n", httpCode, resp.length());
    Serial.printf("[SOL] Response: %s\n", resp.c_str());

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
    Serial.printf("[SOL] solIdx=%d respLen=%d\n", solIdx, resp.length());
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

    Serial.printf("[SOL] Parsed solution len=%d:\n%s\n---END---\n", spos, solution);

    // Zapisz do lokalnej historii (NVS, FIFO 5 ostatnich)
    historySave(String(taskText), String(solution));

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
        if (panicTriggered()) return;
        if (_solBtn(BTN_OK)) break;
        if (_solBtn(BTN_LEFT)) { _solWaitRelease(); return; }
        delay(20);
    }
    _solWaitRelease();

    // === Init kamery przez nasz wrapper ===
    // camBegin: PWDN low, RESET pulse (przez MCP23017), esp_camera_init().
    // I2C dzielony z MCP23017 (sccb_i2c_port=0 w camera.h).
    _solDrawLoading(d, _solT("Wlaczam kamere...", "Powering camera..."), 0);

    if (!camBegin()) {
        _solDrawError(d, _solT("Init kamery!", "Camera init!"), "esp_camera_init");
        return;
    }

    // Warm-up - wyrzuc 2 pierwsze klatki (zwykle przeswiecone po power-on)
    camWarmup(2);

    _solDrawLoading(d, _solT("Robie zdjecie...", "Taking photo..."), 0);
    camera_fb_t* fb = camCapture();
    if (!fb) {
        camEnd();
        _solDrawError(d, _solT("Blad zdjecia!", "Capture error!"), "");
        return;
    }
    // Buffer fb wazny — najpierw zakoduj base64, potem zwolnij + wylacz kamere
    // PRZED WiFi (XCLK 10MHz kamery zaklocaja 2.4GHz radio).

    _solDrawLoading(d, _solT("Koduje obraz...", "Encoding image..."), 0);

    // Zakoduj obraz jako base64
    // Base64 potrzebuje ok 4/3 rozmiaru wejscia
    size_t b64len = ((fb->len + 2) / 3) * 4 + 1;
    char* b64buf = (char*)ps_malloc(b64len);  // PSRAM
    if (!b64buf) {
        esp_camera_fb_return(fb);
        camEnd();
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
    camEnd();   // OFF kamery PRZED WiFi (anty-interference)

    // Teraz mozemy bezpiecznie wlaczyc WiFi
    if (!_solEnsureWifi(d)) {
        free(b64buf);
        return;
    }

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

    WiFiClientSecure client;
    client.setInsecure();
    client.setTimeout(60);  // socket timeout 60s — vs domyslny 5-10s
    HTTPClient http;
    http.begin(client, _SOL_SOLVE_ENDPOINT);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-api-key", KALK_API_KEY);
    http.addHeader("x-device-id", _solDeviceId());
    http.addHeader("x-fw-version", FW_VERSION);
    if (licKey[0]) http.addHeader("x-license-key", licKey);
    http.setTimeout(_SOL_HTTP_TIMEOUT_MS);

    // Pokaz "AI rozwiazuje zadanie" OD RAZU — przed blokujacym POST
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);
    d.drawStr(2, 24, _solT("AI rozwiazuje zadanie", "AI solving problem"));
    d.setFont(u8g2_font_5x7_tf);
    d.drawStr(2, 40, _solT("Prosze czekac...", "Please wait..."));
    d.sendBuffer();

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

    // Zapisz do historii (image mode)
    historySave(String("[Zdjecie kamery]"), String(solution));

    _solDisplaySolution(d, solution);
}

// ---------------------------------------------------------------------------
// Ekran wyboru trybu (zdjecie / tekst)
// ---------------------------------------------------------------------------
static void _solModeSelect(U8G2 &d, int &mode) {
    // mode: 0 = zdjecie, 1 = tekst, 2 = historia
    _solWaitRelease();

    while (true) {
        if (panicTriggered()) return;
        powerCheckSleep();
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 10, _solT("=== Rozwiaz zadanie ===", "=== Solve problem ==="));
        d.drawHLine(0, 12, 256);

        const char* labels[3][2] = {
            { "  [1] Zdjecie kamery", "  [1] Camera photo" },
            { "  [2] Wpisz tekst",    "  [2] Enter text"    },
            { "  [3] Historia",       "  [3] History"       },
        };
        const char* labelsSel[3][2] = {
            { "> [1] Zdjecie kamery", "> [1] Camera photo" },
            { "> [2] Wpisz tekst",    "> [2] Enter text"    },
            { "> [3] Historia",       "> [3] History"       },
        };

        const int Y[3] = {14, 27, 40};   // top y kazdej pozycji (3 widoczne)
        const int TEXT_Y[3] = {24, 37, 50};
        bool en = (kalkSettings.language == 1);

        for (int i = 0; i < 3; i++) {
            if (mode == i) {
                d.drawBox(0, Y[i], 256, 12);
                d.setDrawColor(0);
                d.drawStr(4, TEXT_Y[i], labelsSel[i][en ? 1 : 0]);
                d.setDrawColor(1);
            } else {
                d.drawStr(4, TEXT_Y[i], labels[i][en ? 1 : 0]);
            }
        }

        d.drawHLine(0, 53, 256);
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 62, _solT("^/v wybor   OK: start   < wstecz",
                                "^/v select   OK: start   < back"));
        d.sendBuffer();

        if (_solBtn(BTN_UP)) {
            if (mode > 0) mode--;
        } else if (_solBtn(BTN_DOWN)) {
            if (mode < 2) mode++;
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
// Tryb HISTORIA — lokalna lista (do 5) + opcjonalnie z serwera (TODO)
// ---------------------------------------------------------------------------
static void _solRunHistoryMode(U8G2 &d) {
    _solWaitRelease();

    uint8_t count = historyCount();
    if (count == 0) {
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 28, _solT("Brak zapisanych zadan", "No saved tasks"));
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 56, _solT("OK / < = powrot", "OK / < = back"));
        d.sendBuffer();
        while (true) {
        if (panicTriggered()) return;
            powerCheckSleep();
            if (_solBtn(BTN_OK) || _solBtn(BTN_LEFT)) {
                _solWaitRelease();
                return;
            }
            delay(20);
        }
    }

    int cursor = 0;   // 0 = najnowszy
    while (true) {
        if (panicTriggered()) return;
        powerCheckSleep();
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        char hdr[32];
        snprintf(hdr, sizeof(hdr), _solT("Historia (%d/%d)", "History (%d/%d)"),
                 cursor + 1, count);
        d.drawStr(2, 10, hdr);
        d.drawHLine(0, 12, 256);

        HistoryEntry entry;
        if (historyGet(cursor, entry)) {
            d.setFont(u8g2_font_6x10_tf);
            String q = entry.question;
            if (q.length() > 40) q = q.substring(0, 38) + "..";
            d.drawStr(2, 24, q.c_str());

            d.setFont(u8g2_font_5x7_tf);
            // Pierwsze 2 linie odpowiedzi
            String a = entry.answer;
            int nl = a.indexOf('\n');
            String l1 = nl >= 0 ? a.substring(0, nl) : a;
            String rest = nl >= 0 ? a.substring(nl + 1) : "";
            int nl2 = rest.indexOf('\n');
            String l2 = nl2 >= 0 ? rest.substring(0, nl2) : rest;
            if (l1.length() > 50) l1 = l1.substring(0, 48) + "..";
            if (l2.length() > 50) l2 = l2.substring(0, 48) + "..";
            d.drawStr(2, 36, l1.c_str());
            d.drawStr(2, 46, l2.c_str());
        }

        d.drawHLine(0, 53, 256);
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 62, _solT("^/v OK:pokaz  >:edytuj+wyslij  <:wstecz",
                                "^/v OK:show  >:edit+resend  <:back"));
        d.sendBuffer();

        if (_solBtn(BTN_UP)) {
            if (cursor > 0) cursor--;
        } else if (_solBtn(BTN_DOWN)) {
            if (cursor < count - 1) cursor++;
        } else if (_solBtn(BTN_OK)) {
            // Pokaz pelne rozwiazanie (wykorzystaj _solDisplaySolution)
            HistoryEntry entry;
            if (historyGet(cursor, entry)) {
                _solDisplaySolution(d, entry.answer.c_str());
            }
            // po wyjsciu — wracamy do listy
        } else if (_solBtn(BTN_RIGHT)) {
            // Edytuj pytanie z historii i wyslij ponownie do AI
            HistoryEntry entry;
            if (historyGet(cursor, entry)) {
                _solWaitRelease();
                _solRunTextMode(d, entry.question.c_str());
                _solWaitRelease();
            }
            // po wyjsciu — wracamy do listy
        } else if (_solBtn(BTN_LEFT)) {
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
    // pinMode(BTN_UP,    INPUT_PULLUP);
    // pinMode(BTN_DOWN,  INPUT_PULLUP);
    // pinMode(BTN_LEFT,  INPUT_PULLUP);
    // pinMode(BTN_RIGHT, INPUT_PULLUP);
    // pinMode(BTN_OK,    INPUT_PULLUP);

    int mode = 1;  // domyslnie tekst (kamera moze byc niedostepna)

    while (true) {
        if (panicTriggered()) return;
        _solModeSelect(display, mode);

        if (mode < 0) return;  // wyjdz do menu

        if (mode == 0) {
            _solRunPhotoMode(display);
        } else if (mode == 1) {
            _solRunTextMode(display);
        } else if (mode == 2) {
            _solRunHistoryMode(display);
        }
        // Po powrocie z trybu → znow wybor trybu
    }
}
