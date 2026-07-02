#pragma once
// settings_screen.h — header-only modul ustawien dla KalkMate
// Wywolanie: showSettings(u8g2);
//
// Ustawienia:
//   brightness   — kontrast OLED 0-15
//   language     — 0=Polski, 1=English, 2=Deutsch
//   solveMode    — 0=Szczegolowy, 1=Tylko obliczenia, 2=Tylko wynik
//   autoSleep    — ON/OFF
//   sleepMinutes — indeks 0-10 w tablicy czasow {0.5,1,2,3,4,5,10,15,20,25,30 min}

#include <Arduino.h>
#include <U8g2lib.h>
#include <Preferences.h>
#include <SPIFFS.h>
#include "input.h"
#include "wifi_persist.h"
#include "ota_update.h"
#include "battery.h"
#include "camera.h"

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
    uint8_t language;     // 0=Polski, 1=English, 2=Deutsch
    uint8_t solveMode;    // 0=Szczegolowy, 1=Tylko obliczenia, 2=Tylko wynik
    bool    autoSleep;    // auto sleep ON/OFF
    uint8_t sleepMinutes; // indeks 0-10 w tablicy czasow
    char    aiUnlockCode[12]; // sekwencja cyfr otwierajaca tryb AI (do 11 znakow)
    uint8_t panicKey;     // KalkKey ktory wraca z trybu AI do kalkulatora
};

// Domyslne: jasnosc 8, polski, szczegolowy, autoSleep ON, 4 min,
//           kod "1111", panic = KEY_MU (27)
static KalkMateSettings kalkSettings = {8, 0, 0, true, 4, "1111", /*KEY_MU*/27};

// Zapis/odczyt ustawien w NVS (wszystkie razem). Definicje TUTAJ bo
// musza byc po definicji kalkSettings - wifi_persist.h jest include'owany
// wczesniej z settings_screen.h:17 wiec ma forward dec'a.
static void kalkSaveSettings() {
    Preferences prefs;
    prefs.begin("kalkmate", false);
    prefs.putUChar("bright",    kalkSettings.brightness);
    prefs.putUChar("lang",      kalkSettings.language);
    prefs.putUChar("solveMode", kalkSettings.solveMode);
    prefs.putBool ("autoSleep", kalkSettings.autoSleep);
    prefs.putUChar("sleepMin",  kalkSettings.sleepMinutes);
    prefs.end();
}

static void kalkLoadSettings() {
    Preferences prefs;
    prefs.begin("kalkmate", true);
    kalkSettings.brightness   = prefs.getUChar("bright",    8);
    kalkSettings.language     = prefs.getUChar("lang",      0);
    kalkSettings.solveMode    = prefs.getUChar("solveMode", 0);
    kalkSettings.autoSleep    = prefs.getBool ("autoSleep", true);
    kalkSettings.sleepMinutes = prefs.getUChar("sleepMin",  4);
    if (kalkSettings.brightness > 15)   kalkSettings.brightness = 8;
    if (kalkSettings.language > 2)      kalkSettings.language = 0;
    if (kalkSettings.solveMode > 2)     kalkSettings.solveMode = 0;
    if (kalkSettings.sleepMinutes > 10) kalkSettings.sleepMinutes = 4;
    prefs.end();
}

// Tablica wartosci czasu uśpienia (indeks 0-10)
static const char* _SET_SLEEP_LABELS[11] = {
    "30s", "1min", "2min", "3min", "4min",
    "5min", "10min", "15min", "20min", "25min", "30min"
};

// ---------------------------------------------------------------------------
// Pomocnik dwujezycznosci
// ---------------------------------------------------------------------------
static const char* T(const char* pl, const char* en, const char* de) {
    if (kalkSettings.language == 0) return pl;
    if (kalkSettings.language == 1) return en;
    return de;
}

// ---------------------------------------------------------------------------
// Stale menu — 15 pozycji, ulozone tematycznie:
//   Preferencje:    Jasnosc, Jezyk, Tryb, Sleep, Kod AI, Panic
//   Konto/siec:     WiFi, Status konta, Device ID + QR
//   System:         Aktualizacje
//   Diagnostyka:    Test ekranu, Test kamery, Test klawiatury, Skaner, Pin Driver
// ---------------------------------------------------------------------------
#define _SET_ITEMS        17
// --- Preferencje ---
#define _SET_BRIGHTNESS   0
#define _SET_LANGUAGE     1
#define _SET_SOLVEMODE    2
#define _SET_AUTOSLEEP    3
#define _SET_AICODE       4
#define _SET_PANICKEY     5
// --- Konto / siec ---
#define _SET_WIFI         6
#define _SET_ACCOUNT      7
#define _SET_DEVICEID     8
// --- System ---
#define _SET_UPDATE       9
#define _SET_FACTORY      10
// --- Diagnostyka ---
#define _SET_SCREENTEST   11
#define _SET_CAMTEST      12
#define _SET_KEYTEST      13
#define _SET_KEYSCAN      14
#define _SET_PINDRIVER    15
#define _SET_BATTERY      16

// Wspolrzedne Y - 4 widoczne, scrollowanie
static const int _SET_ITEM_Y[_SET_ITEMS] = {22, 33, 44, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55};

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
    const char* title = T("=== Ustawienia ===", "=== Settings ===", "=== Einstellungen ===");
    d.drawStr(2, 10, title);
    d.drawHLine(0, 12, 256);

    // Scroll: pokazuj 4 pozycje naraz, kursor wyznacza okno
    const int VISIBLE = 4;
    int scroll = 0;
    if (cursor >= VISIBLE) scroll = cursor - VISIBLE + 1;

    // Przygotuj dane 5 pozycji
    char lines[_SET_ITEMS][56];
    char prefix[3] = "  ";

    // === PREFERENCJE ===
    // 0: Jasnosc
    {
        prefix[0] = (cursor == _SET_BRIGHTNESS) ? '>' : ' ';
        char bar[20];
        _setBrightnessBar(bar, sizeof(bar), kalkSettings.brightness);
        snprintf(lines[_SET_BRIGHTNESS], sizeof(lines[0]), "%s%s %s", prefix,
                 T("Jasnosc:  ", "Bright:   ", "Hell:     "), bar);
    }
    // 1: Jezyk
    {
        prefix[0] = (cursor == _SET_LANGUAGE) ? '>' : ' ';
        static const char* const _LANG_NAMES[3] = {"Polski", "English", "Deutsch"};
        const char* langStr = _LANG_NAMES[kalkSettings.language];
        snprintf(lines[_SET_LANGUAGE], sizeof(lines[0]), "%s%s [%-10s]", prefix,
                 T("Jezyk:    ", "Language: ", "Sprache:  "), langStr);
    }
    // 2: Tryb
    {
        prefix[0] = (cursor == _SET_SOLVEMODE) ? '>' : ' ';
        const char* modeStr;
        if (kalkSettings.solveMode == 0)      modeStr = T("Szczegolowy", "Detailed", "Detailliert");
        else if (kalkSettings.solveMode == 1) modeStr = T("Obliczenia", "Calc only", "Rechnung");
        else                                   modeStr = T("Wynik", "Result", "Ergebnis");
        snprintf(lines[_SET_SOLVEMODE], sizeof(lines[0]), "%s%s [%-12s]", prefix,
                 T("Tryb:     ", "Mode:     ", "Modus:    "), modeStr);
    }
    // 3: Auto-sleep
    {
        prefix[0] = (cursor == _SET_AUTOSLEEP) ? '>' : ' ';
        char slpVal[16];
        if (kalkSettings.autoSleep)
            snprintf(slpVal, sizeof(slpVal), "ON %s", _SET_SLEEP_LABELS[kalkSettings.sleepMinutes]);
        else
            snprintf(slpVal, sizeof(slpVal), "OFF");
        snprintf(lines[_SET_AUTOSLEEP], sizeof(lines[0]), "%sSleep:    [%-10s]", prefix, slpVal);
    }
    // 4: Kod AI
    {
        prefix[0] = (cursor == _SET_AICODE) ? '>' : ' ';
        snprintf(lines[_SET_AICODE], sizeof(lines[0]), "%s%s [%-10s]", prefix,
                 T("Kod AI:   ", "AI code:  ", "KI-Code:  "), kalkSettings.aiUnlockCode);
    }
    // 5: Panic key
    {
        prefix[0] = (cursor == _SET_PANICKEY) ? '>' : ' ';
        const char* lab = kalkKeyLabel((KalkKey)kalkSettings.panicKey);
        snprintf(lines[_SET_PANICKEY], sizeof(lines[0]), "%s%s [%-10s]", prefix,
                 T("Panic:    ", "Panic key:", "Panik:    "), lab);
    }

    // === KONTO / SIEC ===
    // 6: WiFi
    {
        prefix[0] = (cursor == _SET_WIFI) ? '>' : ' ';
        snprintf(lines[_SET_WIFI], sizeof(lines[0]), "%s%s",
                 prefix, T("WiFi (siec + haslo)", "WiFi (network + pass)", "WLAN (Netz + Passwort)"));
    }
    // 7: Status konta
    {
        prefix[0] = (cursor == _SET_ACCOUNT) ? '>' : ' ';
        snprintf(lines[_SET_ACCOUNT], sizeof(lines[0]), "%s%s",
                 prefix, T("Status konta", "Account status", "Kontostatus"));
    }
    // 8: Device ID + QR
    {
        prefix[0] = (cursor == _SET_DEVICEID) ? '>' : ' ';
        snprintf(lines[_SET_DEVICEID], sizeof(lines[0]), "%s%s",
                 prefix, T("Device ID + QR", "Device ID + QR", "Geraete-ID + QR"));
    }

    // === SYSTEM ===
    // 9: Aktualizacje
    {
        prefix[0] = (cursor == _SET_UPDATE) ? '>' : ' ';
        snprintf(lines[_SET_UPDATE], sizeof(lines[0]), "%s%s [v%-8s]", prefix,
                 T("Aktual.:  ", "Updates:  ", "Update:   "), FW_VERSION);
    }
    // 10: Reset fabryczny
    {
        prefix[0] = (cursor == _SET_FACTORY) ? '>' : ' ';
        snprintf(lines[_SET_FACTORY], sizeof(lines[0]), "%s%s",
                 prefix, T("Reset fabryczny", "Factory reset", "Werksreset"));
    }

    // === DIAGNOSTYKA ===
    // 10: Test ekranu
    {
        prefix[0] = (cursor == _SET_SCREENTEST) ? '>' : ' ';
        snprintf(lines[_SET_SCREENTEST], sizeof(lines[0]), "%s%s",
                 prefix, T("Test ekranu", "Screen test", "Bildschirmtest"));
    }
    // 11: Test kamery
    {
        prefix[0] = (cursor == _SET_CAMTEST) ? '>' : ' ';
        snprintf(lines[_SET_CAMTEST], sizeof(lines[0]), "%s%s",
                 prefix, T("Test kamery", "Camera test", "Kameratest"));
    }
    // 12: Test klawiatury
    {
        prefix[0] = (cursor == _SET_KEYTEST) ? '>' : ' ';
        snprintf(lines[_SET_KEYTEST], sizeof(lines[0]), "%s%s",
                 prefix, T("Test klawiatury", "Keyboard test", "Tastaturtest"));
    }
    // 13: Skaner klawiatury
    {
        prefix[0] = (cursor == _SET_KEYSCAN) ? '>' : ' ';
        snprintf(lines[_SET_KEYSCAN], sizeof(lines[0]), "%s%s",
                 prefix, T("Skaner kl. (debug)", "Keyboard scanner", "Tastatur-Scanner"));
    }
    // 14: Pin Driver Test
    {
        prefix[0] = (cursor == _SET_PINDRIVER) ? '>' : ' ';
        snprintf(lines[_SET_PINDRIVER], sizeof(lines[0]), "%s%s",
                 prefix, T("Pin Driver Test", "Pin Driver Test", "Pin-Treiber-Test"));
    }
    // 16: Bateria — bez czytania ADC z listy menu (cache w battery.h trzyma
    // stara wartosc; szczegoly i charging detect dopiero po wejsciu w pozycje)
    {
        prefix[0] = (cursor == _SET_BATTERY) ? '>' : ' ';
        snprintf(lines[_SET_BATTERY], sizeof(lines[0]), "%s%s", prefix,
                 T("Bateria...", "Battery...", "Akku..."));
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
    d.drawStr(2, 63, T("< WSTECZ    OK: edytuj", "< BACK      OK: edit", "< ZURUECK   OK: bearbeiten"));

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
        d.drawStr(2, 10, T("Jasnosc:", "Brightness:", "Helligkeit:"));
        d.drawHLine(0, 12, 256);

        char bar[24];
        _setBrightnessBar(bar, sizeof(bar), val);
        // Pasek z wartoscia X/15
        char barFull[32];
        snprintf(barFull, sizeof(barFull), "%s/%d", bar, 15);
        d.drawStr(2, 35, barFull);

        d.drawHLine(0, 57, 256);
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 63, T("< -   OK: zatwierdz   + >", "< -   OK: confirm   + >", "< -   OK: bestaetigen + >"));
        d.sendBuffer();

        // PCB v4 cap 0-105 (anty-brownout), nie 0-255
        if (_setBtn(BTN_LEFT)) {
            if (val > 0) val--;
            d.setContrast(val * 7); // podglad na zywo (cap S3)
        } else if (_setBtn(BTN_RIGHT)) {
            if (val < 15) val++;
            d.setContrast(val * 7);
        } else if (_setBtn(BTN_OK)) {
            kalkSettings.brightness = val;
            d.setContrast(val * 7);
            kalkSaveSettings();   // persist
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
        d.drawStr(2, 10, T("Jezyk:", "Language:", "Sprache:"));
        d.drawHLine(0, 12, 256);

        static const char* const _LANG_NAMES[3] = {"Polski", "English", "Deutsch"};
        const char* langStr = _LANG_NAMES[val];
        char line[32];
        snprintf(line, sizeof(line), "[%s]", langStr);
        d.drawStr(2, 35, line);

        d.drawHLine(0, 57, 256);
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 63, T("< / > zmien   OK: zatwierdz", "< / > change   OK: confirm", "< / > wechseln OK: bestaetigen"));
        d.sendBuffer();

        kalkSettings.language = prevLang; // przywroc do zatwierdzenia

        bool pressed = false;
        while (!pressed) {
            if (_setBtn(BTN_LEFT)) {
                val = (val == 0) ? 2 : val - 1;
                pressed = true;
            } else if (_setBtn(BTN_RIGHT)) {
                val = (val == 2) ? 0 : val + 1;
                pressed = true;
            } else if (_setBtn(BTN_OK)) {
                kalkSettings.language = val;
                kalkSaveSettings();   // persist
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
        d.drawStr(2, 10, T("Tryb rozwiazan:", "Solve mode:", "Loesungsmodus:"));
        d.drawHLine(0, 12, 256);

        const char* modeStr;
        if (val == 0)      modeStr = T("Szczegolowy",      "Detailed",    "Detailliert");
        else if (val == 1) modeStr = T("Tylko obliczenia", "Calc only",   "Nur Rechnung");
        else               modeStr = T("Tylko wynik",      "Result only", "Nur Ergebnis");

        char line[40];
        snprintf(line, sizeof(line), "[%s]", modeStr);
        d.drawStr(2, 35, line);

        d.drawHLine(0, 57, 256);
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 63, T("< / > zmien   OK: zatwierdz", "< / > change   OK: confirm", "< / > wechseln OK: bestaetigen"));
        d.sendBuffer();

        if (_setBtn(BTN_LEFT)) {
            val = (val == 0) ? 2 : val - 1;
        } else if (_setBtn(BTN_RIGHT)) {
            val = (val == 2) ? 0 : val + 1;
        } else if (_setBtn(BTN_OK)) {
            kalkSettings.solveMode = val;
            kalkSaveSettings();   // persist
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
                     T("Czas", "Time", "Zeit"), _SET_SLEEP_LABELS[idx]);
            d.drawStr(2, 44, timeLine);
        }

        d.drawHLine(0, 57, 256);
        d.setFont(u8g2_font_5x7_tf);
        if (onOff) {
            d.drawStr(2, 63, T("< / > czas   OK: zatwierdz", "< / > time   OK: confirm", "< / > Zeit   OK: bestaetigen"));
        } else {
            d.drawStr(2, 63, T("OK: wlacz   < / > OFF", "OK: enable   < / > OFF", "OK: aktivieren < / > OFF"));
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
                kalkSaveSettings();   // persist
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
        d.drawStr(2, 8, T("Klucz licencji:", "License key:", "Lizenzschluessel:"));

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
        d.drawStr(2, 63, T("< anuluj", "< cancel", "< abbrechen"));
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
                           "AI code (UP/DOWN digit, LEFT/RIGHT pos)",
                           "KI-Code (UP/DOWN Ziffer, LEFT/RIGHT Pos.)"));

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
        d.drawStr(2, 63, T("OK=zapisz  C/CE=anuluj", "OK=save  C/CE=cancel", "OK=speichern C/CE=abbrechen"));
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
                           "Press key for panic:",
                           "Taste fuer Panik druecken:"));
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 30, T("Aktualny:", "Current:", "Aktuell:"));
        d.setFont(u8g2_font_logisoso22_tn);
        d.drawStr(80, 50, kalkKeyLabel((KalkKey)kalkSettings.panicKey));
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 63, T("C/CE=anuluj", "C/CE=cancel", "C/CE=abbrechen"));
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
        d.drawStr(2, 10, T("=== Aktualizacje ===", "=== Updates ===", "=== Updates ==="));

        char line[40];
        snprintf(line, sizeof(line), T("Aktualna wersja: v%s", "Current version: v%s", "Aktuelle Version: v%s"), FW_VERSION);
        d.drawStr(2, 24, line);

        d.setFont(u8g2_font_5x7_tf);
        switch (state) {
            case ST_IDLE:
                d.drawStr(2, 40, T("OK = sprawdz aktualizacje", "OK = check for updates", "OK = nach Updates suchen"));
                d.drawStr(2, 50, T("C/CE = wyjscie", "C/CE = exit", "C/CE = beenden"));
                break;
            case ST_CHECKING:
                d.drawStr(2, 40, T("Sprawdzam serwer...", "Checking server...", "Server wird geprueft..."));
                break;
            case ST_AVAILABLE: {
                char av[40];
                snprintf(av, sizeof(av), T("Dostepna: v%s", "Available: v%s", "Verfuegbar: v%s"),
                         info.latestVersion.c_str());
                d.drawStr(2, 38, av);
                d.drawStr(2, 48, T("OK = zainstaluj", "OK = install", "OK = installieren"));
                d.drawStr(2, 58, T("C/CE = anuluj", "C/CE = cancel", "C/CE = abbrechen"));
                break;
            }
            case ST_NO_UPDATE:
                d.drawStr(2, 40, T("Masz najnowsza wersje :)", "You have the latest :)", "Du hast die neueste Version :)"));
                d.drawStr(2, 50, T("C/CE = wyjscie", "C/CE = exit", "C/CE = beenden"));
                break;
            case ST_ERROR: {
                char eb[60];
                snprintf(eb, sizeof(eb), "Blad: %.40s", info.error.c_str());
                d.drawStr(2, 40, eb);
                d.drawStr(2, 50, T("C/CE = wyjscie", "C/CE = exit", "C/CE = beenden"));
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
                d.drawStr(2, 32, T("Sprawdzam serwer...", "Checking server...", "Server wird geprueft..."));
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
                // Zainstaluj - przekaz sig dla weryfikacji ECDSA
                otaInstall(d, info.url, info.sig);
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
extern void showAccountStatusScreen(U8G2 &d);   // implementacja w main.cpp
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

// ---------------------------------------------------------------------------
// Reset fabryczny — kasuje wszystkie zapisane dane i restartuje kalkulator.
// Co znika:
//   - NVS namespace "kalkmate" (WiFi SSID/haslo, licencja, kod AI, panic key)
//   - NVS namespace "kalkhist" (historia AI requestow)
//   - NVS namespace "kalkmap"  (custom keymap)
//   - SPIFFS: /notes.json, /tests.json
//   - kalkSettings -> defaulty
// Po: ESP.restart()
// ---------------------------------------------------------------------------
static void _editFactoryReset(U8G2 &d) {
    _setWaitRelease();

    // 1. Ekran potwierdzenia
    bool confirmed = false;
    while (!confirmed) {
        if (_panicRequested) return;

        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 10, "=== Reset fabryczny ===");
        d.drawHLine(0, 12, 256);
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 24, "Czy na pewno chcesz przywrocic");
        d.drawStr(2, 33, "ustawienia fabryczne?");
        d.drawStr(2, 45, "Zniknie: WiFi, kod AI, historia,");
        d.drawStr(2, 53, "notatki, sprawdziany, konto.");
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 63, "OK = TAK   < = anuluj");
        d.sendBuffer();

        if (_setBtn(BTN_OK)) { confirmed = true; break; }
        if (_setBtn(BTN_LEFT) || inputKeyConsume(KEY_CCE)) {
            _setWaitRelease();
            return;
        }
        delay(20);
    }
    _setWaitRelease();

    // 2. Pokaz progress
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);
    d.drawStr(2, 14, "Reset fabryczny...");
    d.drawHLine(0, 16, 256);
    d.drawStr(2, 32, "Kasuje dane, prosze czekac...");
    d.sendBuffer();

    Serial.println("[FACTORY] start");

    // 3. NVS - skasuj 3 znane namespacy
    {
        Preferences p;
        if (p.begin("kalkmate", false)) { p.clear(); p.end(); Serial.println("[FACTORY] NVS kalkmate cleared"); }
        if (p.begin("kalkhist", false)) { p.clear(); p.end(); Serial.println("[FACTORY] NVS kalkhist cleared"); }
        if (p.begin("kalkmap",  false)) { p.clear(); p.end(); Serial.println("[FACTORY] NVS kalkmap cleared"); }
    }

    // 4. SPIFFS - format calej partycji (wymaze /notes.json, /tests.json, wszystko)
    if (SPIFFS.begin(true)) {
        if (SPIFFS.exists("/notes.json")) SPIFFS.remove("/notes.json");
        if (SPIFFS.exists("/tests.json")) SPIFFS.remove("/tests.json");
        Serial.println("[FACTORY] SPIFFS files removed");
    }

    // 5. Reset kalkSettings w RAM (zostana wpisane defaulty przy nastepnym boot
    // i tak, ale dla porzadku)
    kalkSettings.brightness   = 8;
    kalkSettings.language     = 0;
    kalkSettings.solveMode    = 0;
    kalkSettings.autoSleep    = true;
    kalkSettings.sleepMinutes = 4;
    strcpy(kalkSettings.aiUnlockCode, "1111");
    kalkSettings.panicKey     = 27;

    Serial.println("[FACTORY] done - restart za 1.5s");

    // 6. Pokaz info i restart
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);
    d.drawStr(2, 14, "=== Gotowe! ===");
    d.drawHLine(0, 16, 256);
    d.drawStr(2, 32, "Restartuje kalkulator...");
    d.sendBuffer();
    delay(1500);
    ESP.restart();
    // niedosiegniete
    while (true) delay(1000);
}

// Test kamery — inicjalizuje OV2640, robi zdjecie, pokazuje info na OLED.
// OK = nowe zdjecie, < = wyjscie (z deinit + power off).
static void _editCamTest(U8G2 &d) {
    _setWaitRelease();

    // Komunikat "Inicjalizacja..."
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);
    d.drawStr(2, 14, T("=== Test kamery ===", "=== Camera test ===", "=== Kameratest ==="));
    d.drawHLine(0, 16, 256);
    d.drawStr(2, 32, T("Init OV2640...", "Initializing OV2640...", "OV2640 wird initialisiert..."));
    d.sendBuffer();

    bool ok = camBegin();

    if (ok) {
        // Warm-up: 2 pierwsze klatki sa zwykle przeswiecone. Wyrzuc je
        // teraz zeby _setBtn nie czekal na nie podczas user-initiated capture.
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 14, T("=== Test kamery ===", "=== Camera test ===", "=== Kameratest ==="));
        d.drawHLine(0, 16, 256);
        d.drawStr(2, 32, T("Rozgrzewam sensor...", "Warming sensor...", "Sensor wird aufgewaermt..."));
        d.sendBuffer();
        camWarmup(2);
    }

    uint32_t lastShot = 0;
    uint32_t shotCount = 0;
    uint32_t lastSize = 0;
    int lastW = 0, lastH = 0;
    char errBuf[40] = "";

    auto draw = [&]() {
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 10, T("=== Test kamery ===", "=== Camera test ===", "=== Kameratest ==="));
        d.drawHLine(0, 12, 256);

        if (!ok) {
            d.drawStr(2, 28, T("Init NIEUDANY", "Init FAILED", "Init FEHLGESCHLAGEN"));
            d.drawStr(2, 40, errBuf);
            d.setFont(u8g2_font_5x7_tf);
            d.drawStr(2, 62, T("< = wyjscie", "< = exit", "< = beenden"));
        } else {
            char buf[48];
            snprintf(buf, sizeof(buf), "Zdjec: %lu", (unsigned long)shotCount);
            d.drawStr(2, 26, buf);
            if (shotCount > 0) {
                snprintf(buf, sizeof(buf), "Rozdz: %dx%d", lastW, lastH);
                d.drawStr(2, 38, buf);
                snprintf(buf, sizeof(buf), "JPEG: %lu B (%lu KB)",
                         (unsigned long)lastSize, (unsigned long)(lastSize/1024));
                d.drawStr(2, 50, buf);
            } else {
                d.drawStr(2, 38, T("Nacisnij OK aby zrobic zdjecie",
                                   "Press OK to capture",
                                   "OK druecken zum Aufnehmen"));
            }
            d.setFont(u8g2_font_5x7_tf);
            d.drawStr(2, 62, T("OK = zdjecie    < = wyjscie",
                              "OK = capture    < = exit",
                              "OK = Aufnahme   < = beenden"));
        }
        d.sendBuffer();
    };

    draw();

    while (true) {
        if (_panicRequested) {
            camEnd();
            return;
        }

        if (_setBtn(BTN_LEFT) || inputKeyConsume(KEY_CCE)) {
            camEnd();
            _setWaitRelease();
            return;
        }

        if (ok && _setBtn(BTN_OK)) {
            d.clearBuffer();
            d.setFont(u8g2_font_6x10_tf);
            d.drawStr(2, 30, T("Robie zdjecie...", "Capturing...", "Aufnahme laeuft..."));
            d.sendBuffer();

            camera_fb_t* fb = camCapture();
            if (fb) {
                shotCount++;
                lastSize = fb->len;
                lastW = fb->width;
                lastH = fb->height;
                Serial.printf("[CAM] frame %lu: %dx%d, %lu B\n",
                              (unsigned long)shotCount, lastW, lastH,
                              (unsigned long)lastSize);
                esp_camera_fb_return(fb);
            } else {
                Serial.println("[CAM] capture FAILED");
                snprintf(errBuf, sizeof(errBuf), "Capture failed");
                ok = false;
            }
            draw();
            _setWaitRelease();
        }

        delay(20);
    }
}

// ---------------------------------------------------------------------------
// Ekran szczegolow baterii: napiecie, procent, status ladowania.
// Odswiezany ~co 500ms (ADC cache w battery.h przepuszcza tylko raz na 5s).
// ---------------------------------------------------------------------------
static void _editBattery(U8G2 &d) {
    _setWaitRelease();
    while (true) {
        if (_panicRequested) return;

        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 10, T("=== Bateria ===", "=== Battery ===", "=== Akku ==="));
        d.drawHLine(0, 12, 256);

        if (!batteryIsAvailable()) {
            d.drawStr(2, 30, T("Brak czujnika (legacy HW)", "No sensor (legacy HW)", "Kein Sensor (alte HW)"));
        } else {
            uint16_t mv  = batteryReadMillivolts();
            uint8_t  pct = batteryReadPercent();
            bool     chg = batteryIsCharging();

            char buf[48];
            snprintf(buf, sizeof(buf), "%s %u.%03u V", T("Napiecie:", "Voltage: ", "Spannung:"),
                     mv / 1000, mv % 1000);
            d.drawStr(2, 26, buf);

            snprintf(buf, sizeof(buf), "%s %u %%", T("Procent: ", "Percent: ", "Prozent: "), pct);
            d.drawStr(2, 38, buf);

            snprintf(buf, sizeof(buf), "%s %s", T("Status:  ", "Status:  ", "Status:  "),
                     chg ? T("LADOWANIE", "CHARGING", "LADEN")
                         : (batteryIsLow() ? T("NISKI", "LOW", "NIEDRIG") : T("OK", "OK", "OK")));
            d.drawStr(2, 50, buf);

            // Duza ikonka baterii po prawej (32x14)
            const int X = 200, Y = 22, W = 40, H = 18;
            d.drawFrame(X, Y, W, H);
            d.drawBox(X + W, Y + 4, 3, H - 8);
            int fillW = ((W - 2) * pct) / 100;
            if (fillW > 0) d.drawBox(X + 1, Y + 1, fillW, H - 2);
            if (chg) {
                d.setFont(u8g2_font_5x7_tf);
                d.setDrawColor(0);
                d.drawStr(X + W/2 - 6, Y + H/2 + 4, "CHG");
                d.setDrawColor(1);
                d.setFont(u8g2_font_6x10_tf);
            }
        }

        d.drawHLine(0, 57, 256);
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 63, T("OK / < = wyjscie", "OK / < = exit", "OK / < = beenden"));
        d.sendBuffer();

        // Wyjscie
        uint32_t t0 = millis();
        while (millis() - t0 < 500) {
            if (_setBtn(BTN_OK) || _setBtn(BTN_LEFT) || inputKeyConsume(KEY_CCE)) {
                _setWaitRelease();
                return;
            }
            delay(20);
        }
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
                case _SET_AICODE:     _editAiCode(display);     break;
                case _SET_PANICKEY:   _editPanicKey(display);   break;
                case _SET_UPDATE:     _editUpdate(display);     break;
                case _SET_FACTORY:    _editFactoryReset(display); break;
                case _SET_DEVICEID:   showDeviceIdQrScreen(display); break;
                case _SET_WIFI:       showWifiSettings(display); break;
                case _SET_SCREENTEST: showScreenTest(display);  break;
                case _SET_CAMTEST:    _editCamTest(display);    break;
                case _SET_KEYTEST:    _editKeyTest(display);    break;
                case _SET_KEYSCAN:    _editKeyScan(display);    break;
                case _SET_PINDRIVER:  _editPinDriver(display);  break;
                case _SET_ACCOUNT:    showAccountStatusScreen(display); break;
                case _SET_BATTERY:    _editBattery(display);    break;
            }
        }

        delay(20);
    }
}
