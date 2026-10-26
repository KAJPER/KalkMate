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
#include "power.h"     // powerCheckSleep — auto-sleep tez w menu WiFi

// Pomocnik tlumaczen — zwraca napis polski, angielski, niemiecki lub czeski
// w zaleznosci od kalkSettings.language (0=Polski, 1=English, 2=Deutsch, 3=Cestina)
static const char* _wifiT(const char* pl, const char* en, const char* de, const char* cs = nullptr) {
    return T(pl, en, de, cs);   // 3=Cestina; cs == nullptr -> EN
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

// Geometria klawiatury: pole wpisywania y 0..12, 4 rzedy znakow po 10 px
// (y 14..53, kazdy rzad wysrodkowany), rzad akcji y 55..63.
static const int _KB_CELL_W  = 18;
static const int _KB_CELL_H  = 10;
static const int _KB_START_Y = 14;

static const int _KB_ACT_Y  = 55;
static const int _KB_ACT_H  = 9;
// 4 klawisze z przerwa 3 px: 52+52+92+51 (+3*3) = 256
static const int _KB_ACT_XS[4] = {0, 55, 110, 205};
static const int _KB_ACT_WS[4] = {52, 52, 92, 51};

#define _WIFI_SAVED_VISIBLE 3   // lista zapamietanych: 3 wiersze + stopka

// ---------------------------------------------------------------------------
// Debounce
// ---------------------------------------------------------------------------
static unsigned long _wifiLastPress = 0;

// extern z main.cpp (definicja flagi panic)
extern volatile bool _panicRequested;

// Lokalny panic check
static inline void _wifiPanicCheck() {
    KalkKey pk = (KalkKey)kalkSettings.panicKey;
    if (pk == KEY_NONE || pk >= KEY_COUNT) return;
    if (inputKeyConsume(pk)) _panicRequested = true;
}

// Czeka na puszczenie klawiszy nawigacji — max 2 s (zablokowany/zwarty
// klawisz membrany nie moze zawiesic menu na zawsze).
static void _wifiWaitRelease() {
    unsigned long t0 = millis();
    while ((inputBtn(BTN_UP)    == LOW ||
            inputBtn(BTN_DOWN)  == LOW ||
            inputBtn(BTN_LEFT)  == LOW ||
            inputBtn(BTN_RIGHT) == LOW ||
            inputBtn(BTN_OK)    == LOW) &&
           millis() - t0 < 2000) {
        delay(10);
    }
    _wifiLastPress = millis();
}

static bool _wifiBtn(int pin) {
    _wifiPanicCheck();
    // Auto-sleep jak w reszcie UI (wczesniej menu WiFi nigdy nie usypialo
    // ekranu ani radia). Po wybudzeniu: odswiez ostatnia klatke (bufor u8g2
    // nadal ja trzyma) i nie traktuj klawisza budzacego jako akcji.
    if (powerCheckSleep()) {
        if (_powerU8g2) _powerU8g2->sendBuffer();
        _wifiWaitRelease();
        return false;
    }
    if (inputBtn(pin) == LOW) {
        unsigned long now = millis();
        if (now - _wifiLastPress > WIFI_DEBOUNCE_MS) {
            _wifiLastPress = now;
            return true;
        }
    }
    return false;
}

// Po anulowanym skanie / nieudanym laczeniu: wroc do sieci, z ktora
// urzadzenie bylo polaczone przed wejsciem w skan. _wifiScanFresh() i
// _doConnect() rozlaczaja radio — bez tego uczen zostawal bez WiFi.
// Haslo z listy zapamietanych (siec, z ktora bylismy polaczeni, jest tam
// praktycznie zawsze; fallback: primary). Laczenie asynchroniczne.
static void _wifiRestorePrev(const String& prevSsid) {
    if (prevSsid.length() == 0) return;
    if (WiFi.status() == WL_CONNECTED && WiFi.SSID() == prevSsid) return;
    char s[33] = "", p[64] = "";
    bool found = false;
    uint8_t cnt = wifiSavedCount();
    for (uint8_t i = 0; i < cnt && !found; i++) {
        if (wifiGetSavedNet(i, s, sizeof(s), p, sizeof(p)) && prevSsid == String(s)) found = true;
    }
    if (!found && wifiLoadSaved(s, sizeof(s), p, sizeof(p)) && prevSsid == String(s)) found = true;
    if (!found) return;
    Serial.println("[WiFi] powrot do poprzedniej sieci");
    WiFi.disconnect(false, false);   // przerwij ewentualna probe laczenia z inna siecia
    delay(50);
    wifiStaOnLimited();
    wifiFastBegin(s, p);
}

// ---------------------------------------------------------------------------
// Ekran statusu WiFi
// Zwraca true = OK (skanuj/zmien), false = BACK (powrot do menu)
// ---------------------------------------------------------------------------
static void _drawWifiStatus(U8G2 &d) {
    d.clearBuffer();
    uiHeader(d, "WiFi", true);

    bool connected = (WiFi.status() == WL_CONNECTED);

    if (connected) {
        char ssid[34], ip[20], rssi[16];
        snprintf(ssid, sizeof(ssid), "%s", WiFi.SSID().c_str());
        snprintf(ip, sizeof(ip), "%s", WiFi.localIP().toString().c_str());
        int r = WiFi.RSSI();
        snprintf(rssi, sizeof(rssi), "%d dBm", r);
        uiInfoRow(d, 24, _wifiT("Siec WiFi", "WiFi network", "WLAN-Netz", "Sit WiFi"), ssid);
        uiInfoRow(d, 36, _wifiT("Adres IP", "IP address", "IP-Adresse", "IP adresa"), ip);
        uiInfoRow(d, 48, _wifiT("Sygnal WiFi", "WiFi signal", "WLAN-Signal", "Signal WiFi"), rssi, 234);
        uiSignalBars(d, 239, 47, r);
    } else {
        const char* st = _wifiT("Stan: Rozlaczone", "Status: Disconnected", "Status: Getrennt", "Stav: Odpojeno");
        d.setFont(UI_FONT);
        int w = d.getStrWidth(st);
        int x = (UI_W - (w + 12)) / 2;
        d.setBitmapMode(1);
        d.drawXBM(x, 25, 8, 8, UI_ICO_WIFI);
        d.setBitmapMode(0);
        d.drawStr(x + 12, 33, st);
        d.setFont(UI_FONT_SMALL);
        uiCenter(d, 45, _wifiT("Brak polaczenia z siecia.", "No network connection.", "Keine Netzwerkverbindung.", "Zadne pripojeni k siti."));
    }

    // Podpowiedzi: OK = skanuj, v = zapamietane (< wstecz — "<" w naglowku)
    char sav[24];
    snprintf(sav, sizeof(sav), _wifiT("v Zapisane(%d)", "v Saved(%d)", "v Gespeichert(%d)", "v Ulozene(%d)"), wifiSavedCount());
    uiFooter(d, _wifiT("OK Skanuj", "OK Scan", "OK Suchen", "OK Hledat"), sav);

    d.sendBuffer();
}

// ---------------------------------------------------------------------------
// Ekran skanowania sieci
// ---------------------------------------------------------------------------
static void _drawScanning(U8G2 &d) {
    uiBusy(d, "WiFi", UI_ICO_WIFI, _wifiT("Skanowanie...", "Scanning...", "Suche laeuft...", "Hledam site..."));
}

// Czy SSID jest na liscie zapamietanych sieci. Cache odswiezany co 3 s —
// lista skanu jest przerysowywana co ~20 ms, a to czyta NVS.
static bool _wifiIsSavedSsid(const char* ssid) {
    static char cache[_WP_MAX_NETS][33];
    static uint8_t cnt = 0;
    static unsigned long at = 0;
    if (at == 0 || millis() - at > 3000) {
        cnt = wifiSavedCount();
        for (uint8_t i = 0; i < cnt; i++) {
            if (!wifiGetSavedNet(i, cache[i], sizeof(cache[i]), nullptr, 0)) cache[i][0] = '\0';
        }
        at = millis();
        if (at == 0) at = 1;
    }
    if (!ssid || !ssid[0]) return false;
    for (uint8_t i = 0; i < cnt; i++) {
        if (strcmp(cache[i], ssid) == 0) return true;
    }
    return false;
}

// Naglowek listy: "Wybierz siec WiFi:" bez koncowego dwukropka.
static void _wifiListTitle(char* out, size_t n) {
    snprintf(out, n, "%s", _wifiT("Wybierz siec WiFi:", "Select WiFi network:", "WiFi-Netzwerk waehlen:", "Vyberte sit WiFi:"));
    int len = strlen(out);
    while (len > 0 && (out[len - 1] == ':' || out[len - 1] == ' ')) out[--len] = '\0';
}

// Rysuje liste sieci WiFi (jak w telefonie): nazwa z lewej, z prawej
// "zapamietana" (check), klodka (zabezpieczona) i slupki zasiegu.
//   networks  — wynik WiFi.scanNetworks() (liczba znalezionych)
//   scroll    — indeks pierwszej widocznej sieci
//   selected  — indeks zaznaczonej sieci (absolutny)
static void _drawNetworkList(U8G2 &d, int networks, int scroll, int selected) {
    if (networks <= 0) {
        uiMessage(d, "WiFi", UI_ICO_WIFI,
                  _wifiT("Brak sieci.", "No networks found.", "Keine Netze gefunden.", "Zadne site nenalezeny."),
                  nullptr, nullptr,
                  _wifiT("OK = skanuj ponownie", "OK = scan again", "OK = erneut suchen", "OK = hledat znovu"));
        return;
    }

    d.clearBuffer();
    char title[40];
    _wifiListTitle(title, sizeof(title));
    uiHeaderCount(d, title, true, selected, networks);

    d.setBitmapMode(1);
    for (int i = 0; i < WIFI_SCAN_VISIBLE; i++) {
        int idx = scroll + i;
        if (idx >= networks) break;

        const int y = UI_ROW_Y0 + i * UI_ROW_H;   // baseline wiersza
        const bool sel = (idx == selected);

        char ssid[34];
        snprintf(ssid, sizeof(ssid), "%s", WiFi.SSID(idx).c_str());
        const bool hidden = (ssid[0] == '\0');
        uiRow(d, i, sel, nullptr,
              hidden ? _wifiT("(ukryta)", "(hidden)", "(versteckt)", "(skryta)") : ssid);

        // Ikony z prawej — na zaznaczonym pasku kolorem 0
        d.setDrawColor(sel ? 0 : 1);
        d.setBitmapMode(1);
        uiSignalBars(d, 238, y - 1, WiFi.RSSI(idx));
        if (WiFi.encryptionType(idx) != WIFI_AUTH_OPEN) d.drawXBM(225, y - 8, 8, 8, UI_ICO_LOCK);
        if (!hidden && _wifiIsSavedSsid(ssid))          d.drawXBM(212, y - 8, 8, 8, UI_ICO_CHECK);
        d.setDrawColor(1);
    }
    d.setBitmapMode(0);
    uiScrollbar(d, scroll, networks);

    d.sendBuffer();
}

// Reset radia WiFi przed skanowaniem. Gdy radio probuje sie laczyc ze stara
// (niedostepna) siecia, scanNetworks() moze zwrocic 0 lub wisiec.
// Dropujemy aktywne polaczenie + ustawiamy STA mode + czyscimy stary skan.
static int _wifiScanFresh() {
    WiFi.disconnect(true, false);  // odlacz, nie kasuj zapisanych kredentcji w NVS
    delay(120);
    wifiStaOnLimited();            // STA + TxPower (KALK_WIFI_TX_POWER)
    delay(120);
    WiFi.scanDelete();
    // Sync scan, pokazuj rowniez ukryte sieci (false=sync, true=show_hidden)
    int n = WiFi.scanNetworks(false, true);
    return n;
}

// Zwraca indeks wybranej sieci lub -1 jesli anulowano (BTN_LEFT).
static int _runNetworkList(U8G2 &d) {
    _drawScanning(d);
    int n = _wifiScanFresh();

    int selected = 0;
    int scroll   = 0;

    _wifiWaitRelease();

    while (true) {
        if (_panicRequested) return -1;

        // Rysowanie: jesli n<0 lub n==0, pokaz info o braku sieci + komunikat
        if (n <= 0) {
            uiMessage(d, "WiFi", n < 0 ? UI_ICO_WARN : UI_ICO_WIFI,
                      n < 0 ? _wifiT("Blad skanu radia.", "Radio scan error.", "Fehler beim Scannen.", "Chyba skenovani.")
                            : _wifiT("Brak sieci w zasiegu.", "No networks in range.", "Keine Netze in Reichweite.", "Zadne site v dosahu."),
                      nullptr, nullptr,
                      _wifiT("OK = skanuj ponownie", "OK = scan again", "OK = erneut suchen", "OK = hledat znovu"),
                      _wifiT("< = wyjscie", "< = cancel", "< = abbrechen", "< = zrusit"));
        } else {
            _drawNetworkList(d, n, scroll, selected);
        }

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
            if (n <= 0) {
                // Ponowne skanowanie z resetem radia
                _drawScanning(d);
                n = _wifiScanFresh();
                selected = 0;
                scroll   = 0;
                _wifiWaitRelease();
            } else {
                _wifiWaitRelease();
                return selected;
            }
        } else if (_wifiBtn(BTN_LEFT)) {
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
// Etykieta przycisku trybu (biezacy tryb)
static const char* _kbModeLabel(int mode) {
    if (mode == _KB_MODE_UPPER) return "ABC";
    if (mode == _KB_MODE_NUMS)  return "123";
    return "abc";
}

// ---------------------------------------------------------------------------
// Rysowanie klawiatury
// ---------------------------------------------------------------------------
// mask=true (haslo WiFi): zamiast znakow '*', tylko ostatni wpisany znak
// widoczny do millis() == revealUntil (1 s po wpisaniu).
static void _drawKeyboard(U8G2 &d,
                           const char* inputText,
                           int inputLen,
                           int curRow,
                           int curCol,
                           int mode,
                           unsigned long blinkTimer,
                           const char* label = nullptr,
                           bool mask = false,
                           unsigned long revealUntil = 0) {
    d.clearBuffer();
    d.setDrawColor(1);

    // --- Pole wpisywania: ramka, etykieta malym fontem, tekst + kursor ---
    d.drawRFrame(0, 0, UI_W, 13, 3);
    const char* lbl = label ? label : _wifiT("Haslo:", "Password:", "Passwort:", "Heslo:");
    d.setFont(UI_FONT_SMALL);
    d.drawStr(5, 9, lbl);
    const int lblW = 5 + d.getStrWidth(lbl) + 5;
    d.setFont(UI_FONT);
    char disp[48];
    // Ile znakow zmiesci sie po etykiecie (6 px/znak, margines na kursor)
    int maxVis = (UI_W - lblW - 8) / 6;
    if (maxVis < 1) maxVis = 1;
    int si = (inputLen > maxVis) ? inputLen - maxVis : 0;
    int vl = inputLen - si;
    if (vl > (int)sizeof(disp) - 2) vl = (int)sizeof(disp) - 2;
    strncpy(disp, inputText + si, vl);
    disp[vl] = '\0';
    if (mask) {
        bool showLast = (inputLen > 0) && (millis() < revealUntil);
        for (int i = 0; i < vl; i++) {
            if (showLast && si + i == inputLen - 1) continue;   // ostatni znak
            disp[i] = '*';
        }
    }
    d.drawStr(lblW, 10, disp);
    bool showCursor = ((millis() - blinkTimer) % 800) < 400;
    if (showCursor && inputLen < WIFI_INPUT_MAX_LEN) {
        d.drawVLine(lblW + d.getStrWidth(disp) + 1, 2, 9);
    }

    // --- Rzedy znakow (4 rzedy, kazdy wysrodkowany) ---
    const char** rows   = _kbGetRows(mode);
    const int*   counts = _kbGetCounts(mode);

    for (int row = 0; row < 4; row++) {
        int count = counts[row];
        int x0 = (UI_W - count * _KB_CELL_W) / 2;
        int y  = _KB_START_Y + row * _KB_CELL_H;
        for (int col = 0; col < count; col++) {
            int x = x0 + col * _KB_CELL_W;
            bool sel = (curRow == row && curCol == col);
            char ch[2] = {rows[row][col], '\0'};
            int cx = x + (_KB_CELL_W - d.getStrWidth(ch)) / 2;
            if (sel) {
                d.drawRBox(x, y, _KB_CELL_W, _KB_CELL_H, 2);
                d.setDrawColor(0);
                d.drawStr(cx, y + 8, ch);
                d.setDrawColor(1);
            } else {
                d.drawStr(cx, y + 8, ch);
            }
        }
    }

    // --- Rzad akcji: [BKSP][abc/ABC/123][SPACE][OK] ---
    const char* actLabels[4] = {
        "BKSP",
        _kbModeLabel(mode),
        "SPACE",
        "OK"
    };

    d.setFont(UI_FONT_SMALL);
    for (int col = 0; col < _KB_ACTION_COUNT; col++) {
        int x  = _KB_ACT_XS[col];
        int w  = _KB_ACT_WS[col];
        int y  = _KB_ACT_Y;
        bool sel = (curRow == _KB_ACTION_ROW && curCol == col);
        const char* al = actLabels[col];
        int tx = x + (w - d.getStrWidth(al)) / 2;

        if (sel) {
            d.drawRBox(x, y, w, _KB_ACT_H, 2);
            d.setDrawColor(0);
            d.drawStr(tx, y + 7, al);
            d.setDrawColor(1);
        } else {
            d.drawRFrame(x, y, w, _KB_ACT_H, 2);
            d.drawStr(tx, y + 7, al);
        }
    }
    d.setFont(UI_FONT);

    d.sendBuffer();
}

// ---------------------------------------------------------------------------
// Glowna petla klawiatury
// ---------------------------------------------------------------------------
static bool _runKeyboard(U8G2 &d, char* outBuf, int bufSize, const char* label = nullptr,
                         bool mask = false) {
    // Jezeli outBuf zawiera juz tekst (prefill), zaczynamy od edycji.
    // Inaczej startujemy z pustym buforem.
    int inputLen = 0;
    if (outBuf[0] != '\0') {
        inputLen = (int)strlen(outBuf);
        if (inputLen >= bufSize) inputLen = bufSize - 1;
        outBuf[inputLen] = '\0';
    } else {
        outBuf[0] = '\0';
    }
    int curRow   = 0;
    int curCol   = 0;
    int mode     = _KB_MODE_LOWER;
    unsigned long blinkStart = millis();
    unsigned long revealUntil = 0;   // mask: do kiedy pokazac ostatni znak

    _wifiWaitRelease();

    while (true) {
        if (_panicRequested) return false;
        _drawKeyboard(d, outBuf, inputLen, curRow, curCol, mode, blinkStart, label,
                      mask, revealUntil);

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
                    revealUntil = millis() + 1000;
                }
            } else {
                // Rzad akcji
                switch (curCol) {
                    case 0: // BKSP
                        if (inputLen > 0) outBuf[--inputLen] = '\0';
                        revealUntil = 0;
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
                            revealUntil = millis() + 1000;
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
    (void)dots;   // animacje robi uiSpinner (wg millis)
    uiBusy(d, "WiFi", UI_ICO_WIFI,
           _wifiT("Laczenie z:", "Connecting to:", "Verbinde mit:", "Pripojuji k:"), ssid);
}

static void _drawConnectError(U8G2 &d) {
    uiMessage(d, "WiFi", UI_ICO_CROSS,
              _wifiT("Blad polaczenia!", "Connection failed!", "Verbindung fehlgeschlagen!", "Pripojeni selhalo!"),
              _wifiT("Sprawdz SSID i haslo.", "Check SSID and password.", "SSID und Passwort pruefen.", "Zkontrolujte SSID a heslo."),
              nullptr,
              _wifiT("OK = powrot", "OK = back", "OK = zurueck", "OK = zpet"));
}

static void _drawConnectOk(U8G2 &d) {
    char ssid[34], ipLine[48];
    snprintf(ssid, sizeof(ssid), "%s", WiFi.SSID().c_str());
    snprintf(ipLine, sizeof(ipLine), "IP: %s", WiFi.localIP().toString().c_str());
    uiMessage(d, "WiFi", UI_ICO_CHECK,
              _wifiT("Polaczono!", "Connected!", "Verbunden!", "Pripojeno!"), ssid, ipLine);
    delay(2000);
}

// ---------------------------------------------------------------------------
// Procedura laczenia z WiFi
// ---------------------------------------------------------------------------
static bool _doConnect(U8G2 &d, const char* ssid, const char* password) {
    WiFi.disconnect(true);
    delay(100);
    wifiStaOnLimited();   // STA + TxPower (KALK_WIFI_TX_POWER)
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
// Ekran zapamietanych sieci (jak w telefonie).
//   OK = polacz (bez wpisywania hasla — uzywa zapisanego)
//   >  = zapomnij siec
//   <  = wstecz
// Zwraca true gdy polaczono (status sie odswiezy).
// ---------------------------------------------------------------------------
static bool _runSavedNetworks(U8G2 &d) {
    int sel = 0, scroll = 0;
    _wifiWaitRelease();
    while (true) {
        if (_panicRequested) return false;
        uint8_t cnt = wifiSavedCount();

        if (cnt == 0) {
            uiMessage(d, _wifiT("Zapamietane sieci", "Saved networks", "Gespeicherte Netze", "Ulozene site"), UI_ICO_WIFI,
                      _wifiT("Brak zapisanych sieci.", "No saved networks.", "Keine gespeicherten Netze.", "Zadne ulozene site."),
                      nullptr, nullptr,
                      _wifiT("< wstecz", "< back", "< zurueck", "< zpet"));
            if (_wifiBtn(BTN_LEFT) || _wifiBtn(BTN_OK)) { _wifiWaitRelease(); return false; }
            delay(20);
            continue;
        }
        if (sel >= cnt) sel = cnt - 1;

        d.clearBuffer();
        uiHeaderCount(d, _wifiT("Zapamietane sieci", "Saved networks", "Gespeicherte Netze", "Ulozene site"), true, sel, cnt);

        String curSsid = (WiFi.status() == WL_CONNECTED) ? WiFi.SSID() : String("");
        d.setBitmapMode(1);
        for (int i = 0; i < _WIFI_SAVED_VISIBLE; i++) {
            int idx = scroll + i;
            if (idx >= cnt) break;
            char s[33];
            wifiGetSavedNet((uint8_t)idx, s, sizeof(s), nullptr, 0);
            bool isCur = (curSsid.length() > 0 && curSsid == String(s));
            bool rowSel = (idx == sel);
            // Aktualna siec: check z prawej (jak w telefonie)
            uiRow(d, i, rowSel, nullptr, s);
            if (isCur) {
                const int y = UI_ROW_Y0 + i * UI_ROW_H;
                d.setDrawColor(rowSel ? 0 : 1);
                d.setBitmapMode(1);
                d.drawXBM(238, y - 8, 8, 8, UI_ICO_CHECK);
                d.setDrawColor(1);
            }
        }
        d.setBitmapMode(0);
        uiScrollbar(d, scroll, cnt, _WIFI_SAVED_VISIBLE);
        uiFooter(d, _wifiT("OK polacz  > zapomnij  < wstecz",
                           "OK connect  > forget  < back",
                           "OK verbind.  > loeschen  < zurueck",
                           "OK pripojit  > zapomenout  < zpet"));
        d.sendBuffer();

        if (_wifiBtn(BTN_UP)) {
            if (sel > 0) { sel--; if (sel < scroll) scroll = sel; }
        } else if (_wifiBtn(BTN_DOWN)) {
            if (sel < cnt - 1) { sel++; if (sel >= scroll + _WIFI_SAVED_VISIBLE) scroll = sel - _WIFI_SAVED_VISIBLE + 1; }
        } else if (_wifiBtn(BTN_OK)) {
            char ssid[33] = "", pass[64] = "";
            wifiGetSavedNet((uint8_t)sel, ssid, sizeof(ssid), pass, sizeof(pass));
            _wifiWaitRelease();
            bool ok = _doConnect(d, ssid, pass);
            if (ok) { wifiAddNetwork(ssid, pass); _drawConnectOk(d); return true; }
            _wifiRestorePrev(curSsid);   // nie zostawiaj urzadzenia bez sieci
            _drawConnectError(d);
            _wifiWaitRelease();
            while (!_panicRequested &&
                   !_wifiBtn(BTN_OK) && !_wifiBtn(BTN_LEFT) && !inputKeyConsume(KEY_CCE)) delay(20);
            _wifiWaitRelease();
        } else if (_wifiBtn(BTN_RIGHT)) {
            wifiForgetNetwork((uint8_t)sel);
            if (sel > 0 && sel >= wifiSavedCount()) sel--;
            if (sel < scroll) scroll = sel;
            _wifiWaitRelease();
        } else if (_wifiBtn(BTN_LEFT)) {
            _wifiWaitRelease();
            return false;
        }
        delay(20);
    }
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
    wifiEnsureListSeeded();   // przenies stara pojedyncza siec do listy zapamietanych

    while (true) {
        if (_panicRequested) return;
        // --- 1. Ekran statusu ---
        _drawWifiStatus(display);

        // Czekaj na OK lub WSTECZ (BTN_LEFT)
        bool goBack = false;
        bool lastConn = (WiFi.status() == WL_CONNECTED);
        while (true) {
        if (_panicRequested) return;
            if (_wifiBtn(BTN_OK))   { break; }
            if (_wifiBtn(BTN_LEFT)) { goBack = true; break; }
            if (_wifiBtn(BTN_DOWN)) { _runSavedNetworks(display); _drawWifiStatus(display); }
            // Przerysuj gdy stan polaczenia sie zmieni (np. asynchroniczny
            // powrot do poprzedniej sieci po anulowanym skanie).
            bool conn = (WiFi.status() == WL_CONNECTED);
            if (conn != lastConn) { lastConn = conn; _drawWifiStatus(display); }
            delay(20);
        }
        _wifiWaitRelease();
        if (goBack) return;  // wyjdz z modulu WiFi do menu glownego

        // Siec, z ktora bylismy polaczeni przed skanem — skan ja rozlacza.
        String prevSsid = (WiFi.status() == WL_CONNECTED) ? WiFi.SSID() : String("");

        // --- 2. Skanowanie i wybor sieci ---
        int netIdx = _runNetworkList(display);
        if (netIdx < 0) {
            // Anulowano — wroc do poprzedniej sieci i do statusu
            _wifiRestorePrev(prevSsid);
            continue;
        }

        // Pobierz SSID wybranej sieci
        char ssid[33];
        strncpy(ssid, WiFi.SSID(netIdx).c_str(), sizeof(ssid) - 1);
        ssid[sizeof(ssid) - 1] = '\0';

        WiFi.scanDelete();  // zwolnij pamiec po skanie

        // --- 3. Klawiatura hasla (maskowana — ekran bywa streamowany
        //        do admina w trybie zdalnej pomocy) ---
        char password[WIFI_INPUT_MAX_LEN + 1] = "";
        bool saved = _runKeyboard(display, password, sizeof(password), nullptr, /*mask=*/true);
        if (!saved) {
            // Anulowano
            _wifiRestorePrev(prevSsid);
            continue;
        }

        // --- 4. Laczenie ---
        bool ok = _doConnect(display, ssid, password);

        if (ok) {
            // Zapisz do listy zapamietanych sieci (jak telefon) + ustaw primary
            wifiAddNetwork(ssid, password);
            _drawConnectOk(display);
            // Petla wróci do ekranu statusu, który pokaze IP
        } else {
            _wifiRestorePrev(prevSsid);   // zle haslo => wroc do poprzedniej sieci
            _drawConnectError(display);
            _wifiWaitRelease();
            // Wyjscie: OK, "<", C/CE albo panic (wczesniej tylko OK)
            while (!_panicRequested &&
                   !_wifiBtn(BTN_OK) && !_wifiBtn(BTN_LEFT) && !inputKeyConsume(KEY_CCE)) {
                delay(20);
            }
            _wifiWaitRelease();
        }
        // Kontynuuj petle — wróc do ekranu statusu
    }
}
