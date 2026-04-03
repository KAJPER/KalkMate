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
// Stale menu — 4 pozycje (bez dzwieku)
// ---------------------------------------------------------------------------
#define _SET_ITEMS        4
#define _SET_BRIGHTNESS   0
#define _SET_LANGUAGE     1
#define _SET_SOLVEMODE    2
#define _SET_AUTOSLEEP    3

// Wspolrzedne Y 4 pozycji menu
static const int _SET_ITEM_Y[_SET_ITEMS] = {22, 33, 44, 55};

// ---------------------------------------------------------------------------
// Debounce — osobne zmienne z prefiksem _set
// ---------------------------------------------------------------------------
static unsigned long _setLastPress = 0;
#define _SET_DEBOUNCE_MS 200

static bool _setBtn(int pin) {
    if (digitalRead(pin) == LOW) {
        unsigned long now = millis();
        if (now - _setLastPress > _SET_DEBOUNCE_MS) {
            _setLastPress = now;
            return true;
        }
    }
    return false;
}

static void _setWaitRelease() {
    while (digitalRead(BTN_UP)    == LOW ||
           digitalRead(BTN_DOWN)  == LOW ||
           digitalRead(BTN_LEFT)  == LOW ||
           digitalRead(BTN_RIGHT) == LOW ||
           digitalRead(BTN_OK)    == LOW) {
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
// Rysowanie glownej listy ustawien
// ---------------------------------------------------------------------------
static void _drawSettingsList(U8G2 &d, int cursor) {
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);

    // Naglowek
    const char* title = T("=== Ustawienia ===", "=== Settings ===");
    d.drawStr(2, 10, title);
    d.drawHLine(0, 12, 256);

    char prefix[3];

    // --- Pozycja 0: Jasnosc ---
    {
        prefix[0] = (cursor == _SET_BRIGHTNESS) ? '>' : ' ';
        prefix[1] = ' ';
        prefix[2] = '\0';
        char bar[20];
        _setBrightnessBar(bar, sizeof(bar), kalkSettings.brightness);
        char line[56];
        const char* label = T("Jasnosc:    ", "Brightness: ");
        snprintf(line, sizeof(line), "%s%s %s", prefix, label, bar);
        d.drawStr(2, _SET_ITEM_Y[0], line);
    }

    // --- Pozycja 1: Jezyk ---
    {
        prefix[0] = (cursor == _SET_LANGUAGE) ? '>' : ' ';
        prefix[1] = ' ';
        prefix[2] = '\0';
        const char* langStr = (kalkSettings.language == 0) ? "Polski" : "English";
        char line[56];
        const char* label = T("Jezyk:      ", "Language:   ");
        snprintf(line, sizeof(line), "%s%s [%-12s]", prefix, label, langStr);
        d.drawStr(2, _SET_ITEM_Y[1], line);
    }

    // --- Pozycja 2: Tryb rozwiazan ---
    {
        prefix[0] = (cursor == _SET_SOLVEMODE) ? '>' : ' ';
        prefix[1] = ' ';
        prefix[2] = '\0';
        const char* modeStr;
        if (kalkSettings.solveMode == 0)      modeStr = T("Szczegolowy", "Detailed");
        else if (kalkSettings.solveMode == 1) modeStr = T("Tylko oblicz", "Calc only");
        else                                   modeStr = T("Tylko wynik", "Result only");
        char line[56];
        const char* label = T("Tryb:       ", "Mode:       ");
        snprintf(line, sizeof(line), "%s%s [%-14s]", prefix, label, modeStr);
        d.drawStr(2, _SET_ITEM_Y[2], line);
    }

    // --- Pozycja 3: Auto-sleep ---
    {
        prefix[0] = (cursor == _SET_AUTOSLEEP) ? '>' : ' ';
        prefix[1] = ' ';
        prefix[2] = '\0';
        char slpVal[16];
        if (kalkSettings.autoSleep) {
            snprintf(slpVal, sizeof(slpVal), "ON  %s",
                     _SET_SLEEP_LABELS[kalkSettings.sleepMinutes]);
        } else {
            snprintf(slpVal, sizeof(slpVal), "OFF");
        }
        char line[56];
        const char* label = T("Auto-sleep: ", "Auto-sleep: ");
        snprintf(line, sizeof(line), "%s%s [%-12s]", prefix, label, slpVal);
        d.drawStr(2, _SET_ITEM_Y[3], line);
    }

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
// Publiczna funkcja — glowny punkt wejscia
// ---------------------------------------------------------------------------
void showSettings(U8G2 &display) {
    pinMode(BTN_UP,    INPUT_PULLUP);
    pinMode(BTN_DOWN,  INPUT_PULLUP);
    pinMode(BTN_LEFT,  INPUT_PULLUP);
    pinMode(BTN_RIGHT, INPUT_PULLUP);
    pinMode(BTN_OK,    INPUT_PULLUP);

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
            }
        }

        delay(20);
    }
}
