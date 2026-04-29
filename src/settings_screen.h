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
};

static KalkMateSettings kalkSettings = {8, 0, 0, true, 4}; // domyslnie 4 min (indeks 4)

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
// Stale menu — 5 pozycji
// ---------------------------------------------------------------------------
#define _SET_ITEMS        5
#define _SET_BRIGHTNESS   0
#define _SET_LANGUAGE     1
#define _SET_SOLVEMODE    2
#define _SET_AUTOSLEEP    3
#define _SET_LICENSE      4

// Wspolrzedne Y 5 pozycji menu (4 widoczne, scrollowanie)
static const int _SET_ITEM_Y[_SET_ITEMS] = {22, 33, 44, 55, 55};

// ---------------------------------------------------------------------------
// Debounce — osobne zmienne z prefiksem _set
// ---------------------------------------------------------------------------
static unsigned long _setLastPress = 0;
#define _SET_DEBOUNCE_MS 200

static bool _setBtn(int pin) {
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
    // 4: Licencja
    {
        prefix[0] = (cursor == _SET_LICENSE) ? '>' : ' ';
        char licKey[40];
        wifiLoadLicense(licKey, sizeof(licKey));
        char licShort[12] = "";
        if (licKey[0]) {
            // Pokaz pierwsze 8 znakow + "..."
            strncpy(licShort, licKey, 8);
            licShort[8] = '.';
            licShort[9] = '.';
            licShort[10] = '.';
            licShort[11] = '\0';
        } else {
            strncpy(licShort, T("brak", "none"), sizeof(licShort) - 1);
        }
        snprintf(lines[4], sizeof(lines[4]), "%s%s [%-10s]", prefix,
                 T("Licencja: ", "License:  "), licShort);
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
            }
        }

        delay(20);
    }
}
