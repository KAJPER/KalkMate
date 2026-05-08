#pragma once
// settings_screen.h — header-only modul ustawien dla KalkMate
// Wywolanie: showSettings(u8g2);
//
// Ustawienia:
//   brightness   — kontrast OLED 0-15
//   language     — 0=Polski, 1=English
//   solveMode    — 0=Szczegolowy, 1=Tylko obliczenia, 2=Tylko wynik
//   autoSleep    — ON/OFF
//   sleepMinutes — indeks 0-10 w tablicy czasow {0.5,1,2,3,4,5,10,15,20,25,30 min}

#include <Arduino.h>
#include <U8g2lib.h>
#include "input.h"
#include "wifi_persist.h"
#include "ota_update.h"

// Forward declaration panic flag (definicja w main.cpp). Nie includujemy
// panic.h zeby uniknac circular include z power.h.
extern volatile bool _panicRequested;

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

// ---------------------------------------------------------------------------
// Struktura ustawien
// ---------------------------------------------------------------------------
struct KalkMateSettings {
    uint8_t brightness;   // 0-15 (kontrast OLED)
    uint8_t language;     // 0=Polski, 1=English
    uint8_t solveMode;    // 0=Szczegolowy, 1=Tylko obliczenia, 2=Tylko wynik
    bool    autoSleep;    // auto sleep ON/OFF
    uint8_t sleepMinutes; // indeks 0-10 w tablicy czasow
    char    aiUnlockCode[12]; // sekwencja cyfr otwierajaca tryb AI (do 11 znakow)
    uint8_t panicKey;     // KalkKey ktory wraca z trybu AI do kalkulatora
};

// Domyslne: jasnosc 8, polski, szczegolowy, autoSleep ON, 4 min,
//           kod "1111", panic = KEY_MU (27)
static KalkMateSettings kalkSettings = {8, 0, 0, true, 4, "1111", /*KEY_MU*/27};

// Tablica wartosci czasu uśpienia (indeks 0-10)
static const char* _SET_SLEEP_LABELS[11] = {
    "30s", "1min", "2min", "3min", "4min",
    "5min", "10min", "15min", "20min", "25min", "30min"
};

// ---------------------------------------------------------------------------
// Pomocnik dwujezycznosci
// ---------------------------------------------------------------------------
static const char* T(const char* pl, const char* en) {
    return kalkSettings.language == 0 ? pl : en;
}

// ---------------------------------------------------------------------------
// Stale menu — 16 pozycji
// ---------------------------------------------------------------------------
#define _SET_ITEMS        16
#define _SET_BRIGHTNESS   0
#define _SET_LANGUAGE     1
#define _SET_SOLVEMODE    2
#define _SET_AUTOSLEEP    3
#define _SET_WIFI         4   // WiFi setup (przeniesiony z menu glownego)
#define _SET_SCREENTEST   5   // Test ekranu
#define _SET_CAMTEST      6   // Test kamery
#define _SET_LICENSE      7
#define _SET_AICODE       8
#define _SET_PANICKEY     9
#define _SET_UPDATE       10
#define _SET_DEVICEID     11
#define _SET_KEYTEST      12  // Test klawiatury (siatka klawiszy)
#define _SET_KEYSCAN      13  // Skaner par MCP23017 (debug niedzialajacych)
#define _SET_PINDRIVER    14  // Pin Driver Test (multimetrem na pin chipa)
#define _SET_KEYMAP       15  // Mapowanie klawiatury (kreator)

// Wspolrzedne Y - 4 widoczne, scrollowanie
static const int _SET_ITEM_Y[_SET_ITEMS] = {22, 33, 44, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55};

// ---------------------------------------------------------------------------
// Debounce — osobne zmienne z prefiksem _set
// ---------------------------------------------------------------------------
static unsigned long _setLastPress = 0;
#define _SET_DEBOUNCE_MS 200

// Lokalny panic check (settings_screen.h nie ma include panic.h przez circular)
static inline void _setPanicCheck() {
    KalkKey pk = (KalkKey)kalkSettings.panicKey;
    if (pk == KEY_NONE || pk >= KEY_COUNT) return;
    if (inputKeyConsume(pk)) _panicRequested = true;
}

static bool _setBtn(int pin) {
    _setPanicCheck();   // Przy okazji sprawdz panic key
    if (inputBtn(pin) == LOW) {
        unsigned long now = millis();
        if (now - _setLastPress > _SET_DEBOUNCE_MS) {
            _setLastPress = now;
            return true;
        }
    }
    return false;
}

static void _setWaitRelease() {
    while (inputBtn(BTN_UP)    == LOW ||
           inputBtn(BTN_DOWN)  == LOW ||
           inputBtn(BTN_LEFT)  == LOW ||
           inputBtn(BTN_RIGHT) == LOW ||
           inputBtn(BTN_OK)    == LOW) {
        delay(10);
    }
    _setLastPress = millis();
}

// ---------------------------------------------------------------------------
// Pomocnik: pasek postpu jasnosci "[========  ] 8"
// totalBars=10, fillChar='=', emptyChar=' '
// ---------------------------------------------------------------------------
static void _setBrightnessBar(char* buf, int bufSize, uint8_t val) {
    // val 0-15 → fill 0-10
    int fill = (int)val * 10 / 15;
    int pos  = 0;
    buf[pos++] = '[';
    for (int i = 0; i < 10; i++) {
        buf[pos++] = (i < fill) ? '=' : ' ';
    }
    buf[pos++] = ']';
    buf[pos++] = ' ';
    if (val < 10) {
        buf[pos++] = '0' + val;
    } else {
        buf[pos++] = '1';
        buf[pos++] = '0' + (val - 10);
    }
    buf[pos] = '\0';
    (void)bufSize;
}

// ---------------------------------------------------------------------------
// Rysowanie glownej listy ustawien (z przewijaniem — 4 widoczne z 5)
// ---------------------------------------------------------------------------
static void _drawSettingsList(U8G2 &d, int cursor) {
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);

    // Naglowek
    const char* title = T("=== Ustawienia ===", "=== Settings ===");
    d.drawStr(2, 10, title);
    d.drawHLine(0, 12, 256);

    // Scroll: pokazuj 4 pozycje naraz, kursor wyznacza okno
    const int VISIBLE = 4;
    int scroll = 0;
    if (cursor >= VISIBLE) scroll = cursor - VISIBLE + 1;

    // Przygotuj dane 5 pozycji
    char lines[_SET_ITEMS][56];
    char prefix[3] = "  ";

    // 0: Jasnosc
    {
        prefix[0] = (cursor == _SET_BRIGHTNESS) ? '>' : ' ';
        char bar[20];
        _setBrightnessBar(bar, sizeof(bar), kalkSettings.brightness);
        snprintf(lines[0], sizeof(lines[0]), "%s%s %s", prefix,
                 T("Jasnosc:  ", "Bright:   "), bar);
    }
    // 1: Jezyk
    {
        prefix[0] = (cursor == _SET_LANGUAGE) ? '>' : ' ';
        const char* langStr = (kalkSettings.language == 0) ? "Polski" : "English";
        snprintf(lines[1], sizeof(lines[1]), "%s%s [%-10s]", prefix,
                 T("Jezyk:    ", "Language: "), langStr);
    }
    // 2: Tryb
    {
        prefix[0] = (cursor == _SET_SOLVEMODE) ? '>' : ' ';
        const char* modeStr;
        if (kalkSettings.solveMode == 0)      modeStr = T("Szczegolowy", "Detailed");
        else if (kalkSettings.solveMode == 1) modeStr = T("Obliczenia", "Calc only");
        else                                   modeStr = T("Wynik", "Result");
        snprintf(lines[2], sizeof(lines[2]), "%s%s [%-12s]", prefix,
                 T("Tryb:     ", "Mode:     "), modeStr);
    }
    // 3: Auto-sleep
    {
        prefix[0] = (cursor == _SET_AUTOSLEEP) ? '>' : ' ';
        char slpVal[16];
        if (kalkSettings.autoSleep)
            snprintf(slpVal, sizeof(slpVal), "ON %s", _SET_SLEEP_LABELS[kalkSettings.sleepMinutes]);
        else
            snprintf(slpVal, sizeof(slpVal), "OFF");
        snprintf(lines[3], sizeof(lines[3]), "%sSleep:    [%-10s]", prefix, slpVal);
    }
    // 4: WiFi setup (przeniesione z menu glownego)
    {
        prefix[0] = (cursor == _SET_WIFI) ? '>' : ' ';
        snprintf(lines[4], sizeof(lines[4]), "%s%s",
                 prefix, T("Ustaw WiFi (siec, haslo)", "Set WiFi (network, pass)"));
    }
    // 5: Test ekranu
    {
        prefix[0] = (cursor == _SET_SCREENTEST) ? '>' : ' ';
        snprintf(lines[5], sizeof(lines[5]), "%s%s",
                 prefix, T("Test ekranu", "Screen test"));
    }
    // 6: Test kamery
    {
        prefix[0] = (cursor == _SET_CAMTEST) ? '>' : ' ';
        snprintf(lines[6], sizeof(lines[6]), "%s%s",
                 prefix, T("Test kamery", "Camera test"));
    }
    // 7: Licencja
    {
        prefix[0] = (cursor == _SET_LICENSE) ? '>' : ' ';
        char licKey[40];
        wifiLoadLicense(licKey, sizeof(licKey));
        char licShort[12] = "";
        if (licKey[0]) {
            strncpy(licShort, licKey, 8);
            licShort[8] = '.';
            licShort[9] = '.';
            licShort[10] = '.';
            licShort[11] = '\0';
        } else {
            strncpy(licShort, T("brak", "none"), sizeof(licShort) - 1);
        }
        snprintf(lines[7], sizeof(lines[7]), "%s%s [%-10s]", prefix,
                 T("Licencja: ", "License:  "), licShort);
    }
    // 8: Kod AI
    {
        prefix[0] = (cursor == _SET_AICODE) ? '>' : ' ';
        snprintf(lines[8], sizeof(lines[8]), "%s%s [%-10s]", prefix,
                 T("Kod AI:   ", "AI code:  "), kalkSettings.aiUnlockCode);
    }
    // 9: Panic key
    {
        prefix[0] = (cursor == _SET_PANICKEY) ? '>' : ' ';
        const char* lab = kalkKeyLabel((KalkKey)kalkSettings.panicKey);
        snprintf(lines[9], sizeof(lines[9]), "%s%s [%-10s]", prefix,
                 T("Panic:    ", "Panic key:"), lab);
    }
    // 10: Aktualizacje (firmware update OTA)
    {
        prefix[0] = (cursor == _SET_UPDATE) ? '>' : ' ';
        snprintf(lines[10], sizeof(lines[10]), "%s%s [v%-8s]", prefix,
                 T("Aktual.:  ", "Updates:  "), FW_VERSION);
    }
    // 11: Device ID + QR
    {
        prefix[0] = (cursor == _SET_DEVICEID) ? '>' : ' ';
        snprintf(lines[11], sizeof(lines[11]), "%s%s",
                 prefix, T("Device ID + QR (podlacz)", "Device ID + QR (link)"));
    }
    // 12: Test klawiatury
    {
        prefix[0] = (cursor == _SET_KEYTEST) ? '>' : ' ';
        snprintf(lines[12], sizeof(lines[12]), "%s%s",
                 prefix, T("Test klawiatury", "Keyboard test"));
    }
    // 13: Skaner par MCP23017
    {
        prefix[0] = (cursor == _SET_KEYSCAN) ? '>' : ' ';
        snprintf(lines[13], sizeof(lines[13]), "%s%s",
                 prefix, T("Skaner kl. (debug)", "Keyboard scanner"));
    }
    // 14: Pin Driver Test
    {
        prefix[0] = (cursor == _SET_PINDRIVER) ? '>' : ' ';
        snprintf(lines[14], sizeof(lines[14]), "%s%s",
                 prefix, T("Pin Driver Test", "Pin Driver Test"));
    }
    // 15: Mapowanie klawiatury
    {
        prefix[0] = (cursor == _SET_KEYMAP) ? '>' : ' ';
        snprintf(lines[15], sizeof(lines[15]), "%s%s",
                 prefix, T("Mapowanie klawiatury", "Keyboard mapping"));
    }

    // Rysuj widoczne pozycje
    for (int i = 0; i < VISIBLE; i++) {
        int idx = scroll + i;
        if (idx >= _SET_ITEMS) break;
        int y = 22 + i * 11;
        bool sel = (idx == cursor);
        if (sel) {
            d.drawBox(0, y - 9, 256, 11);
            d.setDrawColor(0);
            d.drawStr(2, y, lines[idx]);
            d.setDrawColor(1);
        } else {
            d.drawStr(2, y, lines[idx]);
        }
    }

    // Strzalki przewijania
    if (scroll > 0)
        d.drawStr(248, 18, "^");
    if (scroll + VISIBLE < _SET_ITEMS)
        d.drawStr(248, 56, "v");

    // Separator i pasek dolny
    d.drawHLine(0, 57, 256);
    d.setFont(u8g2_font_5x7_tf);
    d.drawStr(2, 63, T("< WSTECZ    OK: edytuj", "< BACK      OK: edit"));

    d.sendBuffer();
}

// ---------------------------------------------------------------------------
// Edycja: Jasnosc
// ---------------------------------------------------------------------------
static void _editBrightness(U8G2 &d) {
    uint8_t val = kalkSettings.brightness;
    _setWaitRelease();

    while (true) {
        if (_panicRequested) return;
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 10, T("Jasnosc:", "Brightness:"));
        d.drawHLine(0, 12, 256);

        char bar[24];
        _setBrightnessBar(bar, sizeof(bar), val);
        // Pasek z wartoscia X/15
        char barFull[32];
        snprintf(barFull, sizeof(barFull), "%s/%d", bar, 15);
        d.drawStr(2, 35, barFull);

        d.drawHLine(0, 57, 256);
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 63, T("< -   OK: zatwierdz   + >", "< -   OK: confirm   + >"));
        d.sendBuffer();

        if (_setBtn(BTN_LEFT)) {
            if (val > 0) val--;
            d.setContrast(val * 17); // podglad na zywo
        } else if (_setBtn(BTN_RIGHT)) {
            if (val < 15) val++;
            d.setContrast(val * 17); // podglad na zywo
        } else if (_setBtn(BTN_OK)) {
            kalkSettings.brightness = val;
            d.setContrast(val * 17);
            _setWaitRelease();
            return;
        }

        delay(20);
    }
}

// ---------------------------------------------------------------------------
// Edycja: Jezyk
// ---------------------------------------------------------------------------
static void _editLanguage(U8G2 &d) {
    uint8_t val = kalkSettings.language;
    _setWaitRelease();

    while (true) {
        if (_panicRequested) return;
        // Po zmianie jezyka rysuj od razu w nowym jezyku
        uint8_t prevLang = kalkSettings.language;
        kalkSettings.language = val; // tymczasowo ustaw aby T() dzialalo poprawnie

        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 10, T("Jezyk:", "Language:"));
        d.drawHLine(0, 12, 256);

        const char* langStr = (val == 0) ? "Polski" : "English";
        char line[32];
        snprintf(line, sizeof(line), "[%s]", langStr);
        d.drawStr(2, 35, line);

        d.drawHLine(0, 57, 256);
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 63, T("< / > zmien   OK: zatwierdz", "< / > change   OK: confirm"));
        d.sendBuffer();

        kalkSettings.language = prevLang; // przywroc do zatwierdzenia

        bool pressed = false;
        while (!pressed) {
            if (_setBtn(BTN_LEFT) || _setBtn(BTN_RIGHT)) {
                val = (val == 0) ? 1 : 0;
                pressed = true;
            } else if (_setBtn(BTN_OK)) {
                kalkSettings.language = val;
                _setWaitRelease();
                return;
            }
            delay(20);
        }
    }
}

// ---------------------------------------------------------------------------
// Edycja: Tryb rozwiazan (3 tryby)
// ---------------------------------------------------------------------------
static void _editSolveMode(U8G2 &d) {
    uint8_t val = kalkSettings.solveMode;
    _setWaitRelease();

    while (true) {
        if (_panicRequested) return;
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 10, T("Tryb rozwiazan:", "Solve mode:"));
        d.drawHLine(0, 12, 256);

        const char* modeStr;
        if (val == 0)      modeStr = T("Szczegolowy",      "Detailed");
        else if (val == 1) modeStr = T("Tylko obliczenia", "Calc only");
        else               modeStr = T("Tylko wynik",      "Result only");

        char line[40];
        snprintf(line, sizeof(line), "[%s]", modeStr);
        d.drawStr(2, 35, line);

        d.drawHLine(0, 57, 256);
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 63, T("< / > zmien   OK: zatwierdz", "< / > change   OK: confirm"));
        d.sendBuffer();

        if (_setBtn(BTN_LEFT)) {
            val = (val == 0) ? 2 : val - 1;
        } else if (_setBtn(BTN_RIGHT)) {
            val = (val == 2) ? 0 : val + 1;
        } else if (_setBtn(BTN_OK)) {
            kalkSettings.solveMode = val;
            _setWaitRelease();
            return;
        }

        delay(20);
    }
}

// ---------------------------------------------------------------------------
// Edycja: Auto-sleep (toggle ON/OFF + czas gdy ON)
// ---------------------------------------------------------------------------
static void _editAutoSleep(U8G2 &d) {
    bool    onOff = kalkSettings.autoSleep;
    uint8_t idx   = kalkSettings.sleepMinutes;
    _setWaitRelease();

    while (true) {
        if (_panicRequested) return;
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 10, "Auto-sleep:");
        d.drawHLine(0, 12, 256);

        // Wiersz 1: [ON ] lub [OFF]
        d.drawStr(2, 30, onOff ? "[ON ]" : "[OFF]");

        // Wiersz 2 (tylko gdy ON): czas
        if (onOff) {
            char timeLine[32];
            snprintf(timeLine, sizeof(timeLine), "%s: %s",
                     T("Czas", "Time"), _SET_SLEEP_LABELS[idx]);
            d.drawStr(2, 44, timeLine);
        }

        d.drawHLine(0, 57, 256);
        d.setFont(u8g2_font_5x7_tf);
        if (onOff) {
            d.drawStr(2, 63, T("< / > czas   OK: zatwierdz", "< / > time   OK: confirm"));
        } else {
            d.drawStr(2, 63, T("OK: wlacz   < / > OFF", "OK: enable   < / > OFF"));
        }
        d.sendBuffer();

        if (_setBtn(BTN_OK)) {
            if (!onOff) {
                // Toggle do ON
                onOff = true;
            } else {
                // Zatwierdz
                kalkSettings.autoSleep    = onOff;
                kalkSettings.sleepMinutes = idx;
                _setWaitRelease();
                return;
            }
        } else if (_setBtn(BTN_LEFT)) {
            if (onOff) {
                // Zmniejsz czas lub toggle OFF gdy idx==0 i jeszcze raz lewo
                if (idx > 0) {
                    idx--;
                } else {
                    onOff = false;
                }
            }
        } else if (_setBtn(BTN_RIGHT)) {
            if (onOff) {
                if (idx < 10) idx++;
            } else {
                onOff = true;
            }
        }

        delay(20);
    }
}

// ---------------------------------------------------------------------------
// Edycja: Klucz licencji (klawiatura — 16-znakowy kod)
// ---------------------------------------------------------------------------
// Uwaga: klawiatura jest zdefiniowana w wifi_settings.h
// settings_screen.h jest dolaczany przed wifi_settings.h wiec deklarujemy
// _runKeyboard jako forward declaration (definicja bedzie pozniej)
// Zamiast tego robimy wlasna mini-klawiature inline dla 16-znakowego kodu.

static void _editLicense(U8G2 &d) {
    _setWaitRelease();

    // Wczytaj aktualny klucz
    static char licBuf[40];
    wifiLoadLicense(licBuf, sizeof(licBuf));
    int inputLen = strlen(licBuf);

    // Znaki dozwolone w licencji: a-z, 0-9, -+=% (16 znakow)
    // Uzyj uproszczonej klawiatury: 3 rzedy
    static const char* const _LIC_ROWS[3] = {
        "abcdefghijklmnopqrstuvwxyz",  // 26
        "0123456789",                   // 10
        "-+=%",                         // 4
    };
    static const int _LIC_COUNTS[3] = {26, 10, 4};

    // Rzad akcji: [BKSP][CAPS][SPC-NIE][OK]
    // (spacja nie jest dozwolona w kodzie licencji)
    static const char* _LIC_ACTS[3] = {"BKSP", "CAPS", "SAVE"};

    int curRow = 1; // Zacznij od cyfr
    int curCol = 0;
    bool capsMode = false;
    unsigned long blinkStart = millis();

    while (true) {
        if (_panicRequested) return;
        // Rysuj ekran
        d.clearBuffer();
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 8, T("Klucz licencji:", "License key:"));

        // Pole tekstowe
        char dispBuf[20] = "";
        if (inputLen > 0) {
            int si = inputLen > 16 ? inputLen - 16 : 0;
            strncpy(dispBuf, licBuf + si, sizeof(dispBuf) - 1);
        }
        bool showCur = ((millis() - blinkStart) % 800) < 400;
        if (showCur && inputLen < 39)
            strncat(dispBuf, "_", sizeof(dispBuf) - strlen(dispBuf) - 1);
        d.drawStr(96, 8, dispBuf);
        d.drawHLine(0, 10, 256);

        // Rzedy znakow
        for (int row = 0; row < 3; row++) {
            int count = _LIC_COUNTS[row];
            for (int col = 0; col < count; col++) {
                int x = col * 9;
                int y = 12 + row * 10;
                char ch = _LIC_ROWS[row][col];
                if (capsMode && row == 0 && ch >= 'a' && ch <= 'z')
                    ch = ch - 'a' + 'A';
                char s[2] = {ch, '\0'};
                bool sel = (curRow == row && curCol == col);
                if (sel) {
                    d.drawBox(x, y, 8, 9);
                    d.setDrawColor(0);
                    d.drawStr(x + 1, y + 7, s);
                    d.setDrawColor(1);
                } else {
                    d.drawStr(x + 1, y + 7, s);
                }
            }
        }

        // Rzad akcji (row=3)
        const int actXs[3] = {0, 60, 170};
        const int actWs[3] = {58, 58, 85};
        for (int col = 0; col < 3; col++) {
            const char* lbl = _LIC_ACTS[col];
            if (col == 1) lbl = capsMode ? "abc" : "CAPS";
            bool sel = (curRow == 3 && curCol == col);
            int x = actXs[col];
            int w = actWs[col];
            int y = 43;
            int tw = strlen(lbl) * 5;
            int tx = x + (w - tw) / 2;
            if (sel) {
                d.drawBox(x, y, w - 1, 9);
                d.setDrawColor(0);
                d.drawStr(tx, y + 7, lbl);
                d.setDrawColor(1);
            } else {
                d.drawFrame(x, y, w - 1, 9);
                d.drawStr(tx, y + 7, lbl);
            }
        }

        d.drawHLine(0, 54, 256);
        d.drawStr(2, 63, T("< anuluj", "< cancel"));
        char lenInfo[12];
        snprintf(lenInfo, sizeof(lenInfo), "%d/16", inputLen > 16 ? 16 : inputLen);
        d.drawStr(210, 63, lenInfo);

        d.sendBuffer();

        // Przyciski
        if (_setBtn(BTN_UP)) {
            if (curRow > 0) {
                curRow--;
                int maxC = (curRow < 3) ? _LIC_COUNTS[curRow] - 1 : 2;
                if (curCol > maxC) curCol = maxC;
            }
        } else if (_setBtn(BTN_DOWN)) {
            if (curRow < 3) {
                curRow++;
                int maxC = (curRow < 3) ? _LIC_COUNTS[curRow] - 1 : 2;
                if (curCol > maxC) curCol = maxC;
            }
        } else if (_setBtn(BTN_LEFT)) {
            if (curCol > 0) {
                curCol--;
            } else {
                _setWaitRelease();
                return;  // anuluj
            }
        } else if (_setBtn(BTN_RIGHT)) {
            int maxC = (curRow < 3) ? _LIC_COUNTS[curRow] - 1 : 2;
            if (curCol < maxC) curCol++;
        } else if (_setBtn(BTN_OK)) {
            if (curRow < 3) {
                // Dodaj znak
                if (inputLen < 39) {
                    char ch = _LIC_ROWS[curRow][curCol];
                    if (capsMode && curRow == 0 && ch >= 'a' && ch <= 'z')
                        ch = ch - 'a' + 'A';
                    licBuf[inputLen++] = ch;
                    licBuf[inputLen] = '\0';
                    blinkStart = millis();
                }
            } else {
                switch (curCol) {
                    case 0:  // BKSP
                        if (inputLen > 0) licBuf[--inputLen] = '\0';
                        break;
                    case 1:  // CAPS toggle
                        capsMode = !capsMode;
                        break;
                    case 2:  // SAVE
                        // Normalizuj: lowercase + trim
                        for (int i = 0; licBuf[i]; i++)
                            licBuf[i] = tolower((unsigned char)licBuf[i]);
                        wifiSaveLicense(licBuf);
                        _setWaitRelease();
                        return;
                }
            }
        }

        delay(20);
    }
}

// ---------------------------------------------------------------------------
// Edycja: Kod AI (1-11 cyfr)
// LEFT/RIGHT — zmień pozycję, UP/DOWN — zmień cyfrę 0-9, OK — zapisz, BACK — anuluj
// ---------------------------------------------------------------------------
static void _editAiCode(U8G2 &d) {
    char buf[12];
    strncpy(buf, kalkSettings.aiUnlockCode, sizeof(buf) - 1);
    buf[sizeof(buf) - 1] = '\0';
    if (!buf[0]) strcpy(buf, "0000");

    int len = strlen(buf);
    int pos = 0;

    uint32_t blink = millis();
    bool blinkOn = true;

    while (true) {
        if (_panicRequested) return;
        if (millis() - blink > 400) { blinkOn = !blinkOn; blink = millis(); }

        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 10, T("Kod AI (UP/DOWN cyfra, LEFT/RIGHT pozycja)",
                           "AI code (UP/DOWN digit, LEFT/RIGHT pos)"));

        d.setFont(u8g2_font_logisoso22_tn);
        int charW = d.getStrWidth("0");
        int totalW = charW * len;
        int x0 = (256 - totalW) / 2;
        for (int i = 0; i < len; i++) {
            char ch[2] = { buf[i], '\0' };
            d.drawStr(x0 + i * charW, 50, ch);
            if (i == pos && blinkOn) {
                d.drawHLine(x0 + i * charW, 53, charW - 2);
            }
        }

        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 63, T("OK=zapisz  C/CE=anuluj", "OK=save  C/CE=cancel"));
        d.sendBuffer();

        if (_setBtn(BTN_OK)) {
            strncpy(kalkSettings.aiUnlockCode, buf, sizeof(kalkSettings.aiUnlockCode) - 1);
            kalkSettings.aiUnlockCode[sizeof(kalkSettings.aiUnlockCode) - 1] = '\0';
            saveAiCode(buf);
            _setWaitRelease();
            return;
        }
        if (inputKeyConsume(KEY_CCE)) {
            _setWaitRelease();
            return;
        }
        if (_setBtn(BTN_LEFT)) {
            pos = (pos - 1 + len) % len;
        }
        if (_setBtn(BTN_RIGHT)) {
            pos = (pos + 1) % len;
        }
        if (_setBtn(BTN_UP)) {
            char c = buf[pos];
            if (c >= '0' && c < '9')      buf[pos] = c + 1;
            else if (c == '9')            buf[pos] = '0';
            else                          buf[pos] = '0';
        }
        if (_setBtn(BTN_DOWN)) {
            char c = buf[pos];
            if (c > '0' && c <= '9')      buf[pos] = c - 1;
            else if (c == '0')            buf[pos] = '9';
            else                          buf[pos] = '0';
        }
        delay(20);
    }
}

// ---------------------------------------------------------------------------
// Edycja: Panic key — naciśnij dowolny klawisz fizyczny
// ---------------------------------------------------------------------------
static void _editPanicKey(U8G2 &d) {
    _setWaitRelease();
    // Czekamy na puszczenie wszystkich KalkKey (żeby nie złapać nadal
    // wciśniętego OK z wejścia w edycję)
    uint32_t releaseStart = millis();
    while (millis() - releaseStart < 300) {
        inputScan();
        delay(10);
    }

    while (true) {
        if (_panicRequested) return;
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 10, T("Naciśnij klawisz na panic:",
                           "Press key for panic:"));
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 30, T("Aktualny:", "Current:"));
        d.setFont(u8g2_font_logisoso22_tn);
        d.drawStr(80, 50, kalkKeyLabel((KalkKey)kalkSettings.panicKey));
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 63, T("C/CE=anuluj", "C/CE=cancel"));
        d.sendBuffer();

        // Anulowanie przez C/CE — ale tylko jeśli aktualny panic to nie C/CE
        if (kalkSettings.panicKey != KEY_CCE && inputKeyConsume(KEY_CCE)) {
            _setWaitRelease();
            return;
        }

        KalkKey k = inputAnyKeyConsume();
        if (k != KEY_NONE) {
            kalkSettings.panicKey = (uint8_t)k;
            savePanicKey((uint8_t)k);
            _setWaitRelease();
            return;
        }
        delay(20);
    }
}

// ---------------------------------------------------------------------------
// Edycja: Aktualizacje firmware (OTA)
//   - Pokazuje aktualna wersje
//   - Sprawdz: pyta serwer o najnowsza
//   - Zainstaluj: pobiera + flashuje + restart
// ---------------------------------------------------------------------------
static void _editUpdate(U8G2 &d) {
    _setWaitRelease();

    enum { ST_IDLE, ST_CHECKING, ST_AVAILABLE, ST_NO_UPDATE, ST_ERROR };
    int state = ST_IDLE;
    OtaInfo info;

    while (true) {
        if (_panicRequested) return;
        // Render
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 10, T("=== Aktualizacje ===", "=== Updates ==="));

        char line[40];
        snprintf(line, sizeof(line), T("Aktualna wersja: v%s", "Current version: v%s"), FW_VERSION);
        d.drawStr(2, 24, line);

        d.setFont(u8g2_font_5x7_tf);
        switch (state) {
            case ST_IDLE:
                d.drawStr(2, 40, T("OK = sprawdz aktualizacje", "OK = check for updates"));
                d.drawStr(2, 50, T("C/CE = wyjscie", "C/CE = exit"));
                break;
            case ST_CHECKING:
                d.drawStr(2, 40, T("Sprawdzam serwer...", "Checking server..."));
                break;
            case ST_AVAILABLE: {
                char av[40];
                snprintf(av, sizeof(av), T("Dostepna: v%s", "Available: v%s"),
                         info.latestVersion.c_str());
                d.drawStr(2, 38, av);
                d.drawStr(2, 48, T("OK = zainstaluj", "OK = install"));
                d.drawStr(2, 58, T("C/CE = anuluj", "C/CE = cancel"));
                break;
            }
            case ST_NO_UPDATE:
                d.drawStr(2, 40, T("Masz najnowsza wersje :)", "You have the latest :)"));
                d.drawStr(2, 50, T("C/CE = wyjscie", "C/CE = exit"));
                break;
            case ST_ERROR: {
                char eb[60];
                snprintf(eb, sizeof(eb), "Blad: %.40s", info.error.c_str());
                d.drawStr(2, 40, eb);
                d.drawStr(2, 50, T("C/CE = wyjscie", "C/CE = exit"));
                break;
            }
        }
        d.sendBuffer();

        // Klawisze
        if (inputKeyConsume(KEY_CCE)) {
            _setWaitRelease();
            return;
        }
        if (_setBtn(BTN_LEFT)) {
            _setWaitRelease();
            return;
        }
        if (_setBtn(BTN_OK)) {
            _setWaitRelease();
            if (state == ST_IDLE || state == ST_NO_UPDATE || state == ST_ERROR) {
                // Sprawdz aktualizacje
                state = ST_CHECKING;
                d.clearBuffer();
                d.setFont(u8g2_font_6x10_tf);
                d.drawStr(2, 32, T("Sprawdzam serwer...", "Checking server..."));
                d.sendBuffer();

                info = otaCheck();
                if (!info.error.isEmpty()) {
                    state = ST_ERROR;
                } else if (info.available) {
                    state = ST_AVAILABLE;
                } else {
                    state = ST_NO_UPDATE;
                }
            } else if (state == ST_AVAILABLE) {
                // Zainstaluj
                otaInstall(d, info.url);
                // Po sukcesie restart, w przeciwnym wypadku zwraca false
                state = ST_ERROR;
                info.error = "Install failed";
            }
        }

        delay(20);
    }
}

// Forward declarations — implementacje w innych plikach
extern void showDeviceIdQrScreen(U8G2 &d);
// Z innych UI files (wifi_settings.h, screen_test.h):
void showWifiSettings(U8G2 &display);
void showScreenTest(U8G2 &display);

// ---------------------------------------------------------------------------
// Test klawiatury — wszystkie 27 klawiszy w siatce, podswietlenie wcisnietego
// ---------------------------------------------------------------------------
static void _editKeyTest(U8G2 &d) {
    _setWaitRelease();

    // Layout 6 wierszy x 5 kolumn (max 30 slotow). Uklad jak na kalkulatorze.
    // Lewy gorny rog = wiersz 0. Pusty slot = -1.
    static const int8_t LAYOUT[6][5] = {
        // wiersz 0: gora
        { -1,         (int8_t)KEY_SQRT, (int8_t)KEY_PERCENT, (int8_t)KEY_MU, -1 },
        // wiersz 1
        { (int8_t)KEY_MC, (int8_t)KEY_MR, (int8_t)KEY_MMINUS, (int8_t)KEY_MPLUS, (int8_t)KEY_DIV },
        // wiersz 2
        { (int8_t)KEY_PLUSMINUS, (int8_t)KEY_7, (int8_t)KEY_8, (int8_t)KEY_9, (int8_t)KEY_MUL },
        // wiersz 3
        { (int8_t)KEY_ARROW, (int8_t)KEY_4, (int8_t)KEY_5, (int8_t)KEY_6, (int8_t)KEY_MINUS },
        // wiersz 4
        { (int8_t)KEY_CCE, (int8_t)KEY_1, (int8_t)KEY_2, (int8_t)KEY_3, (int8_t)KEY_PLUS },
        // wiersz 5: dol
        { (int8_t)KEY_0, (int8_t)KEY_00, (int8_t)KEY_DOT, (int8_t)KEY_EQ, -1 },
    };

    const int CELL_W = 256 / 5;     // 51 px
    const int CELL_H = 64 / 6;      // 10 px

    while (true) {
        if (_panicRequested) return;
        d.clearBuffer();
        d.setFont(u8g2_font_5x7_tf);

        for (int r = 0; r < 6; r++) {
            for (int c = 0; c < 5; c++) {
                int8_t k = LAYOUT[r][c];
                if (k < 0) continue;
                int x = c * CELL_W;
                int y = r * CELL_H;

                bool down = inputKeyDown((KalkKey)k);
                if (down) {
                    // Wcisniety -> bialy box, czarna litera
                    d.setDrawColor(1);
                    d.drawBox(x, y, CELL_W - 1, CELL_H - 1);
                    d.setDrawColor(0);
                } else {
                    // Niewcisniety -> ramka, biala litera
                    d.setDrawColor(1);
                    d.drawFrame(x, y, CELL_W - 1, CELL_H - 1);
                }

                const char* label = kalkKeyLabel((KalkKey)k);
                int tw = strlen(label) * 5;
                int tx = x + (CELL_W - 1 - tw) / 2;
                int ty = y + CELL_H - 2;
                d.drawStr(tx, ty, label);
                d.setDrawColor(1);
            }
        }
        d.sendBuffer();

        // Wyjscie: dluzsze przytrzymanie LEFT (BTN_LEFT to KEY_4 / KEY_PLUSMINUS,
        // co jest klawiszem testowanym) — uzywamy CCE jako exit.
        if (inputKeyConsume(KEY_CCE)) {
            _setWaitRelease();
            return;
        }
        delay(15);
    }
}

// ---------------------------------------------------------------------------
// Pin Driver Test — ustawia po kolei kazdy z 10 pinow MCP jako OUTPUT LOW
// na 2s. User multimetrem sprawdza fizycznie czy pin idzie do GND.
// Jesli nie — uszkodzony pin chipa lub cold solder.
// ---------------------------------------------------------------------------
static void _editPinDriver(U8G2 &d) {
    _setWaitRelease();
    static const uint8_t KB_PINS[10] = { 0, 1, 2, 3, 4, 8, 9, 10, 11, 12 };
    static const char* NAMES[10] = {
        "GPA0","GPA1","GPA2","GPA3","GPA4","GPB0","GPB1","GPB2","GPB3","GPB4"
    };

    int idx = 0;
    bool dirty = true;
    while (true) {
        if (_panicRequested) return;

        if (dirty) {
            // Wszystkie INPUT_PULLUP, wybrany OUTPUT LOW
            for (int i = 0; i < 10; i++) {
                _inMcp.pinMode(KB_PINS[i], INPUT_PULLUP);
            }
            _inMcp.pinMode(KB_PINS[idx], OUTPUT);
            _inMcp.digitalWrite(KB_PINS[idx], LOW);

            d.clearBuffer();
            d.setFont(u8g2_font_6x10_tf);
            d.drawStr(2, 10, "Pin Driver Test");
            d.drawHLine(0, 12, 256);
            d.setFont(u8g2_font_logisoso22_tn);
            d.drawStr(60, 40, NAMES[idx]);
            d.setFont(u8g2_font_5x7_tf);
            d.drawStr(2, 53, "Multimetr na ten pin MCP -> 0V");
            d.drawStr(2, 62, "^/v=zmien   C/CE=wyjscie");
            d.sendBuffer();
            dirty = false;
        }

        if (_setBtn(BTN_UP)) {
            if (idx > 0) { idx--; dirty = true; }
        }
        if (_setBtn(BTN_DOWN)) {
            if (idx < 9) { idx++; dirty = true; }
        }
        if (inputKeyConsume(KEY_CCE)) {
            // Przywroc wszystkie INPUT_PULLUP zeby skaner dalej dzialal
            for (int i = 0; i < 10; i++) {
                _inMcp.pinMode(KB_PINS[i], INPUT_PULLUP);
            }
            _setWaitRelease();
            return;
        }
        delay(20);
    }
}

// ---------------------------------------------------------------------------
// Mapowanie klawiatury — kreator. Iteruje przez wszystkie 27 klawiszy i prosi
// uzytkownika o nacisniecie. Zapisuje par pinow do _kalkMap (NVS).
//
// Sterowanie:
//   - krotki klik dowolnego klawisza => zapis do biezacego KalkKey, advance
//   - przytrzymanie 2s => pomin biezacy klawisz (zostanie nieprzypisany)
//   - przytrzymanie 5s => abort, nie zapisuj (przywroc poprzednia mape)
// ---------------------------------------------------------------------------
static void _editKeyMap(U8G2 &d) {
    _setWaitRelease();

    // Kolejnosc fizyczna (top-to-bottom, left-to-right wg LAYOUT z _editKeyTest)
    static const KalkKey ORDER[] = {
        KEY_SQRT, KEY_PERCENT, KEY_MU,
        KEY_MC, KEY_MR, KEY_MMINUS, KEY_MPLUS, KEY_DIV,
        KEY_PLUSMINUS, KEY_7, KEY_8, KEY_9, KEY_MUL,
        KEY_ARROW, KEY_4, KEY_5, KEY_6, KEY_MINUS,
        KEY_CCE, KEY_1, KEY_2, KEY_3, KEY_PLUS,
        KEY_0, KEY_00, KEY_DOT, KEY_EQ
    };
    const int N = sizeof(ORDER) / sizeof(ORDER[0]);

    // Backup mapy aktualnej (na wypadek aborta)
    _KalkKeyMap backup[KEY_COUNT];
    for (int i = 0; i < KEY_COUNT; i++) backup[i] = _kalkMap[i];

    // Robocza mapa — start z czystej, zeby nie bylo "ducha" starych mapowan
    _KalkKeyMap working[KEY_COUNT];
    for (int i = 0; i < KEY_COUNT; i++) {
        working[i].pinA = _KALK_MAP_NONE;
        working[i].pinB = _KALK_MAP_NONE;
    }

    // Intro screen
    {
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 10, "Mapowanie klawiatury");
        d.drawHLine(0, 12, 256);
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 24, "Kreator zapyta o kazdy z 27 klawiszy.");
        d.drawStr(2, 33, "- klik = zapisz pare pinow");
        d.drawStr(2, 42, "- przytrzymaj 2s = pomin (nieprzyp.)");
        d.drawStr(2, 51, "- przytrzymaj 5s = abort (bez zapisu)");
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 63, "Nacisnij dowolny klawisz aby start");
        d.sendBuffer();

        // Wait for any press to begin
        bool pairs[100];
        while (true) {
            if (_panicRequested) return;
            inputDebugRawScan(pairs);
            bool any = false;
            for (int i = 0; i < 100; i++) if (pairs[i]) { any = true; break; }
            if (any) {
                // Wait for release before starting
                while (true) {
                    inputDebugRawScan(pairs);
                    bool a = false;
                    for (int i = 0; i < 100; i++) if (pairs[i]) { a = true; break; }
                    if (!a) break;
                    delay(20);
                }
                break;
            }
            delay(20);
        }
    }

    bool aborted = false;

    for (int idx = 0; idx < N && !aborted; idx++) {
        KalkKey k = ORDER[idx];

        // Wait for full release before each key
        {
            bool pairs[100];
            while (true) {
                if (_panicRequested) return;
                inputDebugRawScan(pairs);
                bool a = false;
                for (int i = 0; i < 100; i++) if (pairs[i]) { a = true; break; }
                if (!a) break;
                delay(20);
            }
        }

        // Step state
        bool done = false;
        bool skip = false;
        uint32_t pressStart = 0;
        bool pressing = false;
        int curI = -1, curJ = -1;
        bool warnDup = false;
        KalkKey dupKey = KEY_NONE;

        while (!done && !skip && !aborted) {
            if (_panicRequested) return;

            // Render
            d.clearBuffer();
            d.setFont(u8g2_font_6x10_tf);
            char hdr[40];
            snprintf(hdr, sizeof(hdr), "Mapowanie %d/%d", idx + 1, N);
            d.drawStr(2, 10, hdr);
            d.drawHLine(0, 12, 256);
            d.setFont(u8g2_font_5x7_tf);
            d.drawStr(2, 22, "Nacisnij klawisz:");

            d.setFont(u8g2_font_logisoso22_tn);
            const char* lab = kalkKeyLabel(k);
            int tw = d.getStrWidth(lab);
            d.drawStr((256 - tw) / 2, 50, lab);

            d.setFont(u8g2_font_5x7_tf);
            if (warnDup) {
                char w[40];
                snprintf(w, sizeof(w), "ZAJETY przez %s, wybierz inny",
                         kalkKeyLabel(dupKey));
                d.drawStr(2, 62, w);
            } else if (pressing) {
                uint32_t e = millis() - pressStart;
                char p[40];
                if (e >= 5000) snprintf(p, sizeof(p), "trzymasz %lus -> abort", e/1000);
                else if (e >= 2000) snprintf(p, sizeof(p), "trzymasz %lus -> pomin", e/1000);
                else snprintf(p, sizeof(p), "trzymasz %lus", e/1000);
                d.drawStr(2, 62, p);
            } else {
                d.drawStr(2, 62, "2s=pomin  5s=abort");
            }
            d.sendBuffer();

            // Scan
            bool pairs[100];
            inputDebugRawScan(pairs);
            int actI = -1, actJ = -1, actCount = 0;
            for (uint8_t i = 0; i < 10; i++) {
                for (uint8_t j = i + 1; j < 10; j++) {
                    if (pairs[i * 10 + j]) {
                        actCount++;
                        if (actI == -1) { actI = i; actJ = j; }
                    }
                }
            }

            if (actCount == 1) {
                if (!pressing || curI != actI || curJ != actJ) {
                    pressing = true;
                    curI = actI;
                    curJ = actJ;
                    pressStart = millis();
                    warnDup = false;
                } else {
                    uint32_t e = millis() - pressStart;
                    if (e >= 5000) {
                        // Abort: wait for full release
                        while (true) {
                            inputDebugRawScan(pairs);
                            bool a = false;
                            for (int i = 0; i < 100; i++) if (pairs[i]) { a = true; break; }
                            if (!a) break;
                            delay(20);
                        }
                        aborted = true;
                    } else if (e >= 2000) {
                        // Skip: wait for release
                        while (true) {
                            inputDebugRawScan(pairs);
                            bool a = false;
                            for (int i = 0; i < 100; i++) if (pairs[i]) { a = true; break; }
                            if (!a) break;
                            delay(20);
                        }
                        skip = true;
                    }
                }
            } else if (actCount == 0 && pressing) {
                // Released — record this pair, ale sprawdz duplikat
                uint8_t pinA = _IN_KB_PINS[curI];
                uint8_t pinB = _IN_KB_PINS[curJ];
                // Sprawdz czy juz jest przypisany do innego KalkKey
                KalkKey dup = KEY_NONE;
                for (int i = 1; i < KEY_COUNT; i++) {
                    if (working[i].pinA == pinA && working[i].pinB == pinB) {
                        dup = (KalkKey)i;
                        break;
                    }
                }
                if (dup != KEY_NONE) {
                    warnDup = true;
                    dupKey = dup;
                    pressing = false;
                    curI = curJ = -1;
                } else {
                    working[k].pinA = pinA;
                    working[k].pinB = pinB;
                    done = true;
                }
            }

            delay(30);
        }

        if (aborted) break;
    }

    if (aborted) {
        // Przywroc poprzednia mape
        for (int i = 0; i < KEY_COUNT; i++) _kalkMap[i] = backup[i];
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(40, 30, "Anulowano");
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(20, 45, "Mapa nie zmieniona.");
        d.sendBuffer();
        delay(1500);
    } else {
        // Zapisz nowa mape
        for (int i = 0; i < KEY_COUNT; i++) _kalkMap[i] = working[i];
        inputKeyMapSave();
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(60, 30, "Zapisano!");
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(20, 45, "Mapa zapisana w NVS.");
        d.sendBuffer();
        delay(1500);
    }

    _setWaitRelease();
}

// ---------------------------------------------------------------------------
// Skaner par MCP23017 — pokazuje wszystkie aktualnie zwarte pary pinow
// (debug niedzialajacych klawiszy)
// ---------------------------------------------------------------------------
static void _editKeyScan(U8G2 &d) {
    _setWaitRelease();

    while (true) {
        if (_panicRequested) return;

        bool pairs[100];
        inputDebugRawScan(pairs);

        // Zbierz aktywne pary i flagi pinow
        bool pinActive[10] = {false};
        int activeCount = 0;
        struct ActivePair { uint8_t i, j; };
        ActivePair active[10];
        for (uint8_t i = 0; i < 10; i++) {
            for (uint8_t j = i + 1; j < 10; j++) {
                if (pairs[i * 10 + j]) {
                    pinActive[i] = true;
                    pinActive[j] = true;
                    if (activeCount < 10) {
                        active[activeCount++] = {i, j};
                    }
                }
            }
        }

        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        char hdr[32];
        snprintf(hdr, sizeof(hdr), "Skaner: %d zwarc", activeCount);
        d.drawStr(2, 9, hdr);
        d.drawHLine(0, 11, 256);

        // Pasek pinow GPA0..GPB4 (10 pinow), aktywne na bialo
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 21, "Pin:");
        for (uint8_t i = 0; i < 10; i++) {
            int x = 30 + i * 23;
            int boxW = 20, boxH = 9;
            const char* lab = kalkPinLabel(i);
            if (pinActive[i]) {
                d.setDrawColor(1);
                d.drawBox(x, 14, boxW, boxH);
                d.setDrawColor(0);
                d.drawStr(x + 1, 21, lab);
                d.setDrawColor(1);
            } else {
                d.drawFrame(x, 14, boxW, boxH);
                d.drawStr(x + 1, 21, lab);
            }
        }

        // Lista aktywnych par (max 4 wiersze)
        for (int k = 0; k < activeCount && k < 4; k++) {
            char line[40];
            snprintf(line, sizeof(line), "%s <-> %s",
                     kalkPinLabel(active[k].i), kalkPinLabel(active[k].j));
            d.drawStr(2, 33 + k * 8, line);
        }
        if (activeCount > 4) {
            d.drawStr(120, 33, "...");
        }

        d.drawStr(2, 63, "C/CE = wyjscie");
        d.sendBuffer();

        if (inputKeyConsume(KEY_CCE)) {
            _setWaitRelease();
            return;
        }
        delay(50);
    }
}

// Placeholder dla testu kamery (kamera nie jest jeszcze podpieta na PCB)
static void _editCamTest(U8G2 &d) {
    _setWaitRelease();
    while (true) {
        if (_panicRequested) return;
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 14, T("=== Test kamery ===", "=== Camera test ==="));
        d.drawHLine(0, 16, 256);
        d.drawStr(2, 30, T("Kamera niezaimplementowana", "Camera not yet wired"));
        d.drawStr(2, 42, T("(PCB v3 — fly-wires TODO)", "(PCB v3 — fly-wires TODO)"));
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 62, T("OK / < = wyjscie", "OK / < = exit"));
        d.sendBuffer();
        if (_setBtn(BTN_OK) || _setBtn(BTN_LEFT) || inputKeyConsume(KEY_CCE)) {
            _setWaitRelease();
            return;
        }
        delay(20);
    }
}

// ---------------------------------------------------------------------------
// Publiczna funkcja — glowny punkt wejscia
// ---------------------------------------------------------------------------
void showSettings(U8G2 &display) {
    // pinMode(BTN_UP,    INPUT_PULLUP);
    // pinMode(BTN_DOWN,  INPUT_PULLUP);
    // pinMode(BTN_LEFT,  INPUT_PULLUP);
    // pinMode(BTN_RIGHT, INPUT_PULLUP);
    // pinMode(BTN_OK,    INPUT_PULLUP);

    _setWaitRelease();

    int cursor = 0; // aktualnie zaznaczona pozycja (0-3)

    while (true) {
        if (_panicRequested) return;
        _drawSettingsList(display, cursor);

        if (_setBtn(BTN_UP)) {
            if (cursor > 0) cursor--;
        } else if (_setBtn(BTN_DOWN)) {
            if (cursor < _SET_ITEMS - 1) cursor++;
        } else if (_setBtn(BTN_LEFT)) {
            // Powrot do menu glownego
            _setWaitRelease();
            return;
        } else if (_setBtn(BTN_OK)) {
            _setWaitRelease();
            switch (cursor) {
                case _SET_BRIGHTNESS: _editBrightness(display); break;
                case _SET_LANGUAGE:   _editLanguage(display);   break;
                case _SET_SOLVEMODE:  _editSolveMode(display);  break;
                case _SET_AUTOSLEEP:  _editAutoSleep(display);  break;
                case _SET_LICENSE:    _editLicense(display);    break;
                case _SET_AICODE:     _editAiCode(display);     break;
                case _SET_PANICKEY:   _editPanicKey(display);   break;
                case _SET_UPDATE:     _editUpdate(display);     break;
                case _SET_DEVICEID:   showDeviceIdQrScreen(display); break;
                case _SET_WIFI:       showWifiSettings(display); break;
                case _SET_SCREENTEST: showScreenTest(display);  break;
                case _SET_CAMTEST:    _editCamTest(display);    break;
                case _SET_KEYTEST:    _editKeyTest(display);    break;
                case _SET_KEYSCAN:    _editKeyScan(display);    break;
                case _SET_PINDRIVER:  _editPinDriver(display);  break;
                case _SET_KEYMAP:     _editKeyMap(display);     break;
            }
        }

        delay(20);
    }
}
