#pragma once
// wifi_settings.h — header-only modul UI WiFi dla KalkMate
// Wywolanie: showWifiSettings(u8g2);
//
// Przeplyw:
//   1. Ekran statusu (polaczony/nie + IP + RSSI) → OK → skanowanie
//   2. Lista sieci (WiFi.scanNetworks()) → strzalki → OK → klawiatura hasla
//   3. Klawiatura hasla → ZAPISZ → laczenie → sukces/blad → powrot do statusu

#include <Arduino.h>
#include <U8g2lib.h>
#include <WiFi.h>
#include "input.h"
#include "settings_screen.h"
#include "wifi_persist.h"

// Pomocnik tlumaczen — zwraca polski lub angielski napis
// w zaleznosci od kalkSettings.language (0=Polski, 1=English)
static const char* _wifiT(const char* pl, const char* en) {
    return kalkSettings.language == 0 ? pl : en;
}

// === Piny przyciskow ===
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

#define WIFI_DEBOUNCE_MS      200
#define WIFI_CONNECT_TIMEOUT_MS 15000
#define WIFI_INPUT_MAX_LEN    63   // maks. dlugosc hasla WPA2
#define WIFI_SCAN_VISIBLE     4    // ile sieci widocznych na raz

// ---------------------------------------------------------------------------
// Tryby klawiatury
// ---------------------------------------------------------------------------
#define _KB_MODE_LOWER 0   // male litery
#define _KB_MODE_UPPER 1   // duze litery (CAPS)
#define _KB_MODE_NUMS  2   // cyfry i znaki specjalne

// Rzedy znakow dla kazdego trybu
// Tryb LOWER (male)
static const char* const _KB_LOWER[4] = {
    "abcdefghijklm",   // 13
    "nopqrstuvwxyz",   // 13
    "0123456789",      // 10
    "!@#$%^&*()-_=+",  // 14
};
static const int _KB_LOWER_COUNTS[4] = {13, 13, 10, 14};

// Tryb UPPER (duze)
static const char* const _KB_UPPER[4] = {
    "ABCDEFGHIJKLM",   // 13
    "NOPQRSTUVWXYZ",   // 13
    "0123456789",      // 10
    "!@#$%^&*()-_=+",  // 14
};
static const int _KB_UPPER_COUNTS[4] = {13, 13, 10, 14};

// Tryb NUMS (cyfry+specjalne)
static const char* const _KB_NUMS[4] = {
    "0123456789",      // 10
    "!@#$%^&*()",      // 10
    "-_=+[]{}|;",      // 10
    ":'\"<>,.?/\\",    // 10
};
static const int _KB_NUMS_COUNTS[4] = {10, 10, 10, 10};

#define _KB_ACTION_ROW   4   // rzad akcji jest zawsze 5. (indeks 4)
#define _KB_ACTION_COUNT 4   // [BKSP][CAPS/abc/123][SPACJA][ZAPISZ]

// Geometria klawiatury
static const int _KB_CELL_W  = 18;
static const int _KB_CELL_H  = 10;
static const int _KB_START_Y = 11;

static const int _KB_ACT_Y  = 54;
static const int _KB_ACT_H  = 10;
// 4 bloki: 60+64+68+64 = 256
static const int _KB_ACT_XS[4] = {0, 60, 124, 192};
static const int _KB_ACT_WS[4] = {59, 63, 67, 64};

// ---------------------------------------------------------------------------
// Debounce
// ---------------------------------------------------------------------------
static unsigned long _wifiLastPress = 0;

static bool _wifiBtn(int pin) {
    if (inputBtn(pin) == LOW) {
        unsigned long now = millis();
        if (now - _wifiLastPress > WIFI_DEBOUNCE_MS) {
            _wifiLastPress = now;
            return true;
        }
    }
    return false;
}

static void _wifiWaitRelease() {
    while (inputBtn(BTN_UP)    == LOW ||
           inputBtn(BTN_DOWN)  == LOW ||
           inputBtn(BTN_LEFT)  == LOW ||
           inputBtn(BTN_RIGHT) == LOW ||
           inputBtn(BTN_OK)    == LOW) {
        delay(10);
    }
    _wifiLastPress = millis();
}

// ---------------------------------------------------------------------------
// Ekran statusu WiFi
// Zwraca true = OK (skanuj/zmien), false = BACK (powrot do menu)
// ---------------------------------------------------------------------------
static void _drawWifiStatus(U8G2 &d) {
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);

    d.drawStr(2, 10, _wifiT("=== Ustawienia WiFi ===", "=== WiFi Settings ==="));
    d.drawHLine(0, 12, 256);

    bool connected = (WiFi.status() == WL_CONNECTED);

    if (connected) {
        d.drawStr(2, 23, _wifiT("Stan: Polaczono", "Status: Connected"));

        char line[52];
        snprintf(line, sizeof(line), "SSID: %s", WiFi.SSID().c_str());
        d.drawStr(2, 33, line);

        snprintf(line, sizeof(line), "IP: %s", WiFi.localIP().toString().c_str());
        d.drawStr(2, 43, line);

        snprintf(line, sizeof(line), "RSSI: %d dBm", WiFi.RSSI());
        d.drawStr(2, 53, line);
    } else {
        d.drawStr(2, 25, _wifiT("Stan: Rozlaczone", "Status: Disconnected"));
        d.drawStr(2, 40, _wifiT("Brak polaczenia z siecia.", "No network connection."));
    }

    // Dwa przyciski na dole: [< WSTECZ]  [OK: Zmien siec >]
    d.drawHLine(0, 54, 256);
    d.setFont(u8g2_font_5x7_tf);
    d.drawStr(2,  63, _wifiT("< WSTECZ", "< BACK"));
    d.drawStr(connected ? 140 : 130, 63, _wifiT("OK: Zmien siec >", "OK: Change network >"));

    d.sendBuffer();
}

// ---------------------------------------------------------------------------
// Ekran skanowania sieci
// ---------------------------------------------------------------------------
static void _drawScanning(U8G2 &d) {
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);
    d.drawStr(2, 20, _wifiT("Skanowanie...", "Scanning..."));
    d.sendBuffer();
}

// Rysuje liste sieci WiFi.
//   networks  — wynik WiFi.scanNetworks() (liczba znalezionych)
//   scroll    — indeks pierwszej widocznej sieci
//   selected  — indeks zaznaczonej sieci (absolutny)
static void _drawNetworkList(U8G2 &d, int networks, int scroll, int selected) {
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);

    d.drawStr(2, 10, _wifiT("Wybierz siec WiFi:", "Select WiFi network:"));
    d.drawHLine(0, 12, 256);

    if (networks == 0) {
        d.drawStr(2, 36, _wifiT("Brak sieci.", "No networks found."));
        d.drawStr(2, 50, _wifiT("OK = skanuj ponownie", "OK = scan again"));
        d.sendBuffer();
        return;
    }

    // Rzedy: y=14,25,36,47 (4 widoczne, odstep 11px)
    for (int i = 0; i < WIFI_SCAN_VISIBLE; i++) {
        int idx = scroll + i;
        if (idx >= networks) break;

        int y = 23 + i * 11;  // baseline wiersza

        char lineBuf[52];
        int32_t rssi = WiFi.RSSI(idx);
        snprintf(lineBuf, sizeof(lineBuf), "%s (%d dBm)",
                 WiFi.SSID(idx).c_str(), (int)rssi);
        // Przytnij do max 40 znakow aby nie wyjsc poza ekran
        lineBuf[40] = '\0';

        bool sel = (idx == selected);
        if (sel) {
            int tw = (int)strlen(lineBuf) * 6;
            int bw = (tw + 4 < 254) ? tw + 4 : 254;
            d.drawBox(0, y - 9, bw, 11);
            d.setDrawColor(0);
            d.drawStr(2, y, lineBuf);
            d.setDrawColor(1);
        } else {
            d.drawStr(2, y, lineBuf);
        }
    }

    // Wskazniki przewijania
    if (scroll > 0) {
        // Strzalka gora (trojkat)
        d.drawStr(248, 18, "^");
    }
    if (scroll + WIFI_SCAN_VISIBLE < networks) {
        // Strzalka dol
        d.drawStr(248, 58, "v");
    }

    d.sendBuffer();
}

// Zwraca indeks wybranej sieci lub -1 jesli anulowano (BTN_LEFT).
static int _runNetworkList(U8G2 &d) {
    _drawScanning(d);

    int n = WiFi.scanNetworks();  // blokujace, zwraca liczbe sieci

    int selected = 0;
    int scroll   = 0;

    _wifiWaitRelease();

    while (true) {
        _drawNetworkList(d, n, scroll, selected);

        if (_wifiBtn(BTN_UP)) {
            if (selected > 0) {
                selected--;
                if (selected < scroll) scroll = selected;
            }
        } else if (_wifiBtn(BTN_DOWN)) {
            if (n > 0 && selected < n - 1) {
                selected++;
                if (selected >= scroll + WIFI_SCAN_VISIBLE) {
                    scroll = selected - WIFI_SCAN_VISIBLE + 1;
                }
            }
        } else if (_wifiBtn(BTN_OK)) {
            if (n == 0) {
                // Ponowne skanowanie
                _drawScanning(d);
                n = WiFi.scanNetworks();
                selected = 0;
                scroll   = 0;
                _wifiWaitRelease();
            } else {
                _wifiWaitRelease();
                return selected;
            }
        } else if (_wifiBtn(BTN_LEFT)) {
            // Anuluj — powrot do statusu
            _wifiWaitRelease();
            return -1;
        }

        delay(20);
    }
}

// ---------------------------------------------------------------------------
// Pomocnik: zwraca rzedy/counts dla biezacego trybu
// ---------------------------------------------------------------------------
static const char** _kbGetRows(int mode) {
    if (mode == _KB_MODE_UPPER) return (const char**)_KB_UPPER;
    if (mode == _KB_MODE_NUMS)  return (const char**)_KB_NUMS;
    return (const char**)_KB_LOWER;
}
static const int* _kbGetCounts(int mode) {
    if (mode == _KB_MODE_UPPER) return _KB_UPPER_COUNTS;
    if (mode == _KB_MODE_NUMS)  return _KB_NUMS_COUNTS;
    return _KB_LOWER_COUNTS;
}
// Etykieta przycisku trybu
static const char* _kbModeLabel(int mode) {
    if (mode == _KB_MODE_UPPER) return "CAPS";
    if (mode == _KB_MODE_NUMS)  return "123";
    return "abc";
}

// ---------------------------------------------------------------------------
// Rysowanie klawiatury
// ---------------------------------------------------------------------------
static void _drawKeyboard(U8G2 &d,
                           const char* inputText,
                           int inputLen,
                           int curRow,
                           int curCol,
                           int mode,
                           unsigned long blinkTimer,
                           const char* label = nullptr) {
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);

    // --- Linia 0: label + wpisany tekst ---
    const char* lbl = label ? label : _wifiT("Haslo:", "Password:");
    d.drawStr(2, 8, lbl);
    // Szerokosc etykiety: strlen * 6px (font 6x10) + 4px margines
    int lblW = (int)strlen(lbl) * 6 + 6;
    char disp[40];
    // Ile znakow zmiesci sie po etykiecie (256 - lblW - 2px margines) / 6px
    int maxVis = (256 - lblW - 2) / 6;
    if (maxVis < 1) maxVis = 1;
    int si = (inputLen > maxVis) ? inputLen - maxVis : 0;
    int vl = inputLen - si;
    if (vl > (int)sizeof(disp) - 2) vl = (int)sizeof(disp) - 2;
    strncpy(disp, inputText + si, vl);
    disp[vl] = '\0';
    bool showCursor = ((millis() - blinkTimer) % 800) < 400;
    if (showCursor && inputLen < WIFI_INPUT_MAX_LEN)
        strncat(disp, "_", sizeof(disp) - strlen(disp) - 1);
    d.drawStr(lblW, 8, disp);
    d.drawHLine(0, 10, 256);

    // --- Rzedy znakow (4 rzedy) ---
    const char** rows   = _kbGetRows(mode);
    const int*   counts = _kbGetCounts(mode);

    for (int row = 0; row < 4; row++) {
        int count = counts[row];
        for (int col = 0; col < count; col++) {
            int x = col * _KB_CELL_W;
            int y = _KB_START_Y + row * _KB_CELL_H;
            bool sel = (curRow == row && curCol == col);
            char ch[2] = {rows[row][col], '\0'};
            if (sel) {
                d.drawBox(x, y, _KB_CELL_W - 1, _KB_CELL_H - 1);
                d.setDrawColor(0);
                d.drawStr(x + 6, y + 8, ch);
                d.setDrawColor(1);
            } else {
                d.drawStr(x + 6, y + 8, ch);
            }
        }
    }

    // --- Rzad akcji: [BKSP][CAPS/abc/123][SPACJA][ZAPISZ] ---
    // Etykiety dynamiczne dla przycisku trybu
    const char* actLabels[4] = {
        "BKSP",
        _kbModeLabel(mode),
        "SPC",
        "OK"
    };

    for (int col = 0; col < _KB_ACTION_COUNT; col++) {
        int x  = _KB_ACT_XS[col];
        int w  = _KB_ACT_WS[col];
        int y  = _KB_ACT_Y;
        bool sel = (curRow == _KB_ACTION_ROW && curCol == col);
        const char* lbl = actLabels[col];
        int tw = (int)strlen(lbl) * 6;
        int tx = x + (w - tw) / 2;

        if (sel) {
            d.drawBox(x, y, w - 1, _KB_ACT_H - 1);
            d.setDrawColor(0);
            d.drawStr(tx, y + 8, lbl);
            d.setDrawColor(1);
        } else {
            d.drawFrame(x, y, w - 1, _KB_ACT_H - 1);
            d.drawStr(tx, y + 8, lbl);
        }
    }

    d.sendBuffer();
}

// ---------------------------------------------------------------------------
// Glowna petla klawiatury
// ---------------------------------------------------------------------------
static bool _runKeyboard(U8G2 &d, char* outBuf, int bufSize, const char* label = nullptr) {
    outBuf[0] = '\0';
    int inputLen = 0;
    int curRow   = 0;
    int curCol   = 0;
    int mode     = _KB_MODE_LOWER;
    unsigned long blinkStart = millis();

    _wifiWaitRelease();

    while (true) {
        _drawKeyboard(d, outBuf, inputLen, curRow, curCol, mode, blinkStart, label);

        const int* counts = _kbGetCounts(mode);

        if (_wifiBtn(BTN_UP)) {
            if (curRow > 0) {
                curRow--;
                int maxCol = (curRow < 4) ? counts[curRow] - 1 : _KB_ACTION_COUNT - 1;
                if (curCol > maxCol) curCol = maxCol;
            }
        } else if (_wifiBtn(BTN_DOWN)) {
            if (curRow < _KB_ACTION_ROW) {
                curRow++;
                int maxCol = (curRow < 4) ? counts[curRow] - 1 : _KB_ACTION_COUNT - 1;
                if (curCol > maxCol) curCol = maxCol;
            }
        } else if (_wifiBtn(BTN_LEFT)) {
            if (curCol > 0) {
                curCol--;
            } else {
                _wifiWaitRelease();
                return false;
            }
        } else if (_wifiBtn(BTN_RIGHT)) {
            int maxCol = (curRow < 4) ? counts[curRow] - 1 : _KB_ACTION_COUNT - 1;
            if (curCol < maxCol) curCol++;
        } else if (_wifiBtn(BTN_OK)) {
            if (curRow < 4) {
                // Zwykly znak
                const char** rows = _kbGetRows(mode);
                if (inputLen < bufSize - 1) {
                    outBuf[inputLen++] = rows[curRow][curCol];
                    outBuf[inputLen]   = '\0';
                    blinkStart = millis();
                }
            } else {
                // Rzad akcji
                switch (curCol) {
                    case 0: // BKSP
                        if (inputLen > 0) outBuf[--inputLen] = '\0';
                        break;
                    case 1: // Zmiana trybu: lower→upper→nums→lower
                        mode = (mode + 1) % 3;
                        // Ogranicz kursor do nowego rozmiaru rzadu
                        if (curRow < 4) {
                            const int* nc = _kbGetCounts(mode);
                            if (curCol >= nc[curRow]) curCol = nc[curRow] - 1;
                        }
                        break;
                    case 2: // SPACJA
                        if (inputLen < bufSize - 1) {
                            outBuf[inputLen++] = ' ';
                            outBuf[inputLen]   = '\0';
                        }
                        break;
                    case 3: // ZAPISZ
                        _wifiWaitRelease();
                        return true;
                }
            }
        }

        delay(20);
    }
}

// ---------------------------------------------------------------------------
// Ekran laczenia
// ---------------------------------------------------------------------------
static void _drawConnecting(U8G2 &d, const char* ssid, int dots) {
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);
    d.drawStr(2, 20, _wifiT("Laczenie z:", "Connecting to:"));
    d.drawStr(2, 34, ssid);
    char dotStr[8] = "";
    for (int i = 0; i < dots; i++) strncat(dotStr, ".", sizeof(dotStr) - 1);
    d.drawStr(2, 50, dotStr);
    d.sendBuffer();
}

static void _drawConnectError(U8G2 &d) {
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);
    d.drawStr(2, 18, _wifiT("Blad polaczenia!", "Connection failed!"));
    d.drawStr(2, 32, _wifiT("Sprawdz SSID i haslo.", "Check SSID and password."));
    d.drawStr(2, 48, _wifiT("OK = powrot", "OK = back"));
    d.sendBuffer();
}

static void _drawConnectOk(U8G2 &d) {
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);
    d.drawStr(2, 20, _wifiT("Polaczono!", "Connected!"));
    char ipLine[48];
    snprintf(ipLine, sizeof(ipLine), "IP: %s", WiFi.localIP().toString().c_str());
    d.drawStr(2, 36, ipLine);
    d.drawStr(2, 52, _wifiT("Powrot za chwile...", "Returning shortly..."));
    d.sendBuffer();
    delay(2000);
}

// ---------------------------------------------------------------------------
// Procedura laczenia z WiFi
// ---------------------------------------------------------------------------
static bool _doConnect(U8G2 &d, const char* ssid, const char* password) {
    WiFi.disconnect(true);
    delay(100);
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, password);

    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED) {
        if (millis() - start > WIFI_CONNECT_TIMEOUT_MS) {
            return false;
        }
        int dots = (int)((millis() - start) / 500) % 4;
        _drawConnecting(d, ssid, dots);
        delay(100);
    }
    return true;
}

// ---------------------------------------------------------------------------
// Publiczna funkcja — glowny punkt wejscia
// ---------------------------------------------------------------------------
void showWifiSettings(U8G2 &display) {
    // pinMode(BTN_UP,    INPUT_PULLUP);
    // pinMode(BTN_DOWN,  INPUT_PULLUP);
    // pinMode(BTN_LEFT,  INPUT_PULLUP);
    // pinMode(BTN_RIGHT, INPUT_PULLUP);
    // pinMode(BTN_OK,    INPUT_PULLUP);

    _wifiWaitRelease();

    while (true) {
        // --- 1. Ekran statusu ---
        _drawWifiStatus(display);

        // Czekaj na OK lub WSTECZ (BTN_LEFT)
        bool goBack = false;
        while (true) {
            if (_wifiBtn(BTN_OK))   { break; }
            if (_wifiBtn(BTN_LEFT)) { goBack = true; break; }
            delay(20);
        }
        _wifiWaitRelease();
        if (goBack) return;  // wyjdz z modulu WiFi do menu glownego

        // --- 2. Skanowanie i wybor sieci ---
        int netIdx = _runNetworkList(display);
        if (netIdx < 0) {
            // Anulowano — powrot do statusu
            continue;
        }

        // Pobierz SSID wybranej sieci
        char ssid[33];
        strncpy(ssid, WiFi.SSID(netIdx).c_str(), sizeof(ssid) - 1);
        ssid[sizeof(ssid) - 1] = '\0';

        WiFi.scanDelete();  // zwolnij pamiec po skanie

        // --- 3. Klawiatura hasla ---
        char password[WIFI_INPUT_MAX_LEN + 1] = "";
        bool saved = _runKeyboard(display, password, sizeof(password));
        if (!saved) {
            // Anulowano
            continue;
        }

        // --- 4. Laczenie ---
        bool ok = _doConnect(display, ssid, password);

        if (ok) {
            // Zapisz dane WiFi do NVS zeby auto-reconnect dzialal
            wifiSaveCreds(ssid, password);
            _drawConnectOk(display);
            // Petla wróci do ekranu statusu, który pokaze IP
        } else {
            _drawConnectError(display);
            _wifiWaitRelease();
            while (!_wifiBtn(BTN_OK)) {
                delay(20);
            }
            _wifiWaitRelease();
        }
        // Kontynuuj petle — wróc do ekranu statusu
    }
}
