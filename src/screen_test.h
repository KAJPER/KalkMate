#pragma once
// screen_test.h — test wizualny ekranu OLED SSD1322 256x64
// Wywolanie: showScreenTest(display);

#include <Arduino.h>
#include <U8g2lib.h>
#include "settings_screen.h"

#ifndef BTN_OK
#define BTN_OK 27
#endif
#ifndef BTN_LEFT
#define BTN_LEFT 13
#endif
#ifndef BTN_RIGHT
#define BTN_RIGHT 14
#endif
#ifndef BTN_UP
#define BTN_UP 26
#endif
#ifndef BTN_DOWN
#define BTN_DOWN 12
#endif

static unsigned long _stLastPress = 0;

static bool _stBtn(int pin) {
    if (digitalRead(pin) == LOW) {
        unsigned long now = millis();
        if (now - _stLastPress > 200) {
            _stLastPress = now;
            return true;
        }
    }
    return false;
}

static void _stWaitBtn() {
    // Czeka na OK lub LEFT zeby przejsc dalej / wyjsc
    while (true) {
        if (_stBtn(BTN_OK) || _stBtn(BTN_RIGHT)) return;
        if (_stBtn(BTN_LEFT)) return;
        delay(20);
    }
}

static const char* _stT(const char* pl, const char* en) {
    return kalkSettings.language == 0 ? pl : en;
}

// ---------------------------------------------------------------------------
// Test 1: Caly ekran bialy (wszystkie piksele ON)
// ---------------------------------------------------------------------------
static void _stFullWhite(U8G2 &d) {
    d.clearBuffer();
    d.setDrawColor(1);
    d.drawBox(0, 0, 256, 64);
    d.sendBuffer();
}

// ---------------------------------------------------------------------------
// Test 2: Caly ekran czarny (wszystkie piksele OFF)
// ---------------------------------------------------------------------------
static void _stFullBlack(U8G2 &d) {
    d.clearBuffer();
    d.sendBuffer();
}

// ---------------------------------------------------------------------------
// Test 3: Szachownica 8x8 (sprawdza czy piksele nie krzywia sie)
// ---------------------------------------------------------------------------
static void _stCheckerboard(U8G2 &d) {
    d.clearBuffer();
    for (int y = 0; y < 64; y++) {
        for (int x = 0; x < 256; x++) {
            if ((x / 8 + y / 8) % 2 == 0) {
                d.drawPixel(x, y);
            }
        }
    }
    d.sendBuffer();
}

// ---------------------------------------------------------------------------
// Test 4: Poziome pasy gradientowe (sprawdza rownomiernosc swiecenia)
// ---------------------------------------------------------------------------
static void _stHorizontalBands(U8G2 &d) {
    d.clearBuffer();
    // 4 pasy po 16px
    d.drawBox(0,  0, 256, 16);  // pelny bialy
    // drugi pas — co drugi piksel poziomo
    for (int x = 0; x < 256; x += 2) d.drawVLine(x, 16, 16);
    // trzeci pas — co czwarty piksel
    for (int x = 0; x < 256; x += 4) d.drawVLine(x, 32, 16);
    // czwarty — czarny (pusty)
    d.sendBuffer();
}

// ---------------------------------------------------------------------------
// Test 5: Pionowe pasy
// ---------------------------------------------------------------------------
static void _stVerticalBands(U8G2 &d) {
    d.clearBuffer();
    for (int x = 0; x < 256; x += 16) {
        if ((x / 16) % 2 == 0) d.drawBox(x, 0, 16, 64);
    }
    d.sendBuffer();
}

// ---------------------------------------------------------------------------
// Test 6: Ramka + przekatne (sprawdza geometrie)
// ---------------------------------------------------------------------------
static void _stGeometry(U8G2 &d) {
    d.clearBuffer();
    d.drawFrame(0, 0, 256, 64);
    d.drawFrame(2, 2, 252, 60);
    d.drawLine(0, 0, 255, 63);
    d.drawLine(255, 0, 0, 63);
    d.drawLine(128, 0, 128, 63);  // pionowa srodkowa
    d.drawLine(0, 32, 255, 32);   // pozioma srodkowa
    d.sendBuffer();
}

// ---------------------------------------------------------------------------
// Test 7: Wszystkie dostepne czcionki
// ---------------------------------------------------------------------------
static void _stFonts(U8G2 &d) {
    d.clearBuffer();
    d.setFont(u8g2_font_5x7_tf);
    d.drawStr(2, 8,  "Font 5x7: AaBbCc 0123");
    d.setFont(u8g2_font_6x10_tf);
    d.drawStr(2, 20, "Font 6x10: AaBbCc 012");
    d.setFont(u8g2_font_8x13_tf);
    d.drawStr(2, 34, "Font 8x13: AaBb");
    d.setFont(u8g2_font_10x20_tf);
    d.drawStr(2, 55, "Font 10x20");
    d.sendBuffer();
}

// ---------------------------------------------------------------------------
// Test 8: Logo KalkMate
// ---------------------------------------------------------------------------
static void _stLogo(U8G2 &d) {
    d.clearBuffer();

    // Ramka dekoracyjna
    d.drawBox(0, 0, 256, 4);
    d.drawBox(0, 60, 256, 4);
    d.drawBox(0, 0, 4, 64);
    d.drawBox(252, 0, 4, 64);

    // Duza nazwa
    d.setFont(u8g2_font_10x20_tf);
    d.drawStr(52, 38, "KalkMate");

    // Podtytul
    d.setFont(u8g2_font_5x7_tf);
    d.drawStr(72, 52, "AI Math Solver");

    // Wersja
    d.drawStr(210, 14, "v1.0");

    // Ikona kalkulatora po lewej (rysowana recznie)
    d.drawFrame(8, 10, 32, 44);   // obudowa
    d.drawBox(11, 13, 26, 10);    // wyswietlacz
    // Przyciski 3x4
    for (int row = 0; row < 4; row++) {
        for (int col = 0; col < 3; col++) {
            d.drawBox(11 + col * 9, 26 + row * 7, 7, 5);
        }
    }

    d.sendBuffer();
}

// ---------------------------------------------------------------------------
// Test 9: Efekt cienia — bialy tekst na ciemnym tle z obryсем
// SSD1322 jest monochromem wiec cien = obrys (outline) wokol liter
// ---------------------------------------------------------------------------
static void _stShadowText(U8G2 &d) {
    d.clearBuffer();

    // --- Tekst z obwodka (outline) = efekt cienia ---
    // Technika: najpierw rysuj tekst bialy na wszystkich 8 kierunkach (+1px)
    // potem rysuj czarny w srodku — daje efekt grubego obrysu
    d.setFont(u8g2_font_10x20_tf);

    // Krok 1: duzy bialy blok pod tekstem (symulacja jasnego tla pod cieniem)
    d.setDrawColor(1);
    d.drawBox(25, 14, 210, 24);  // tlo pod tekstem

    // Krok 2: czarny tekst na bialym tle — glowny tekst
    d.setDrawColor(0);
    d.drawStr(28, 35, "KalkMate");

    // Krok 3: bialy obrys wokol czarnego tekstu (+1px we wszystkich kierunkach)
    // rysujemy bialy tekst z offsetem przed i po czarnym
    // Nie mozemy — juz narysowalismy czarny. Uzyjemy innej techniki:
    // Rysuj caly tekst jako XOR przez setDrawColor(2)
    d.setDrawColor(2);  // XOR mode
    for (int dx = -1; dx <= 1; dx++) {
        for (int dy = -1; dy <= 1; dy++) {
            if (dx == 0 && dy == 0) continue;
            d.drawStr(28 + dx, 35 + dy, "KalkMate");
        }
    }
    d.setDrawColor(1);

    // --- Drugi tekst: inwersja (bialy na czarnym tle) ---
    d.setFont(u8g2_font_8x13_tf);
    // Tlo pod drugim tekstem — czarne (domyslne)
    d.setDrawColor(1);
    d.drawStr(50, 55, "Outline / Shadow effect");

    // --- Ramka i opis ---
    d.drawFrame(0, 0, 256, 64);
    d.setFont(u8g2_font_5x7_tf);
    d.drawStr(2, 8, "Test 9: Shadow/Outline");

    d.sendBuffer();
}

// ---------------------------------------------------------------------------
// Test 10: Animacja — tekst przesuwajacy sie w prawo, potem miganie
// ---------------------------------------------------------------------------
static void _stAnimation(U8G2 &d) {
    // Faza 1: tekst przesuwa sie od lewej do prawej (scroll)
    for (int x = -100; x < 260; x += 4) {
        if (digitalRead(BTN_OK) == LOW || digitalRead(BTN_LEFT) == LOW) return;
        d.clearBuffer();
        d.setFont(u8g2_font_10x20_tf);
        d.drawStr(x, 30, "KalkMate");
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(60, 55, "< scroll >");
        d.sendBuffer();
        delay(30);
    }

    // Faza 2: miganie przez 3 sekundy
    unsigned long start = millis();
    bool visible = true;
    unsigned long lastToggle = millis();
    while (millis() - start < 3000) {
        if (digitalRead(BTN_OK) == LOW || digitalRead(BTN_LEFT) == LOW) return;
        if (millis() - lastToggle > 350) {
            visible = !visible;
            lastToggle = millis();
            d.clearBuffer();
            if (visible) {
                d.setFont(u8g2_font_10x20_tf);
                d.drawStr(55, 35, "KalkMate!");
            }
            d.setFont(u8g2_font_5x7_tf);
            d.drawStr(65, 55, "< blink >");
            d.sendBuffer();
        }
        delay(20);
    }

    // Faza 3: inwertowany ekran (bialy) z czarnym tekstem
    d.clearBuffer();
    d.setDrawColor(1);
    d.drawBox(0, 0, 256, 64);
    d.setDrawColor(0);
    d.setFont(u8g2_font_10x20_tf);
    d.drawStr(55, 35, "KalkMate!");
    d.setFont(u8g2_font_5x7_tf);
    d.drawStr(60, 55, "< invert >");
    d.setDrawColor(1);
    d.sendBuffer();
    delay(1500);
}

// ---------------------------------------------------------------------------
// Ekran informacyjny o tescie
// ---------------------------------------------------------------------------
static void _stShowInfo(U8G2 &d, int testNum, int total, const char* name) {
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);
    char buf[32];
    snprintf(buf, sizeof(buf), _stT("Test %d/%d:", "Test %d/%d:"), testNum, total);
    d.drawStr(2, 12, buf);
    d.drawStr(2, 26, name);
    d.setFont(u8g2_font_5x7_tf);
    d.drawStr(2, 45, _stT("OK/> = dalej   < = wyjdz", "OK/> = next   < = exit"));
    d.sendBuffer();
    delay(800);
}

// ---------------------------------------------------------------------------
// Publiczna funkcja
// ---------------------------------------------------------------------------
void showScreenTest(U8G2 &display) {
    pinMode(BTN_OK,    INPUT_PULLUP);
    pinMode(BTN_LEFT,  INPUT_PULLUP);
    pinMode(BTN_RIGHT, INPUT_PULLUP);
    pinMode(BTN_UP,    INPUT_PULLUP);
    pinMode(BTN_DOWN,  INPUT_PULLUP);

    // Poczekaj na zwolnienie przyciskow
    delay(300);

    const int TOTAL = 10;

    struct { const char* pl; const char* en; void(*fn)(U8G2&); } tests[] = {
        {"Bialy ekran",     "Full white",       _stFullWhite      },
        {"Czarny ekran",    "Full black",       _stFullBlack      },
        {"Szachownica",     "Checkerboard",     _stCheckerboard   },
        {"Pasy poziome",    "Horiz. bands",     _stHorizontalBands},
        {"Pasy pionowe",    "Vert. bands",      _stVerticalBands  },
        {"Geometria",       "Geometry",         _stGeometry       },
        {"Czcionki",        "Fonts",            _stFonts          },
        {"Logo",            "Logo",             _stLogo           },
        {"Cien tekstu",     "Shadow text",      _stShadowText     },
        {"Animacja",        "Animation",        _stAnimation      },
    };

    for (int i = 0; i < TOTAL; i++) {
        const char* name = kalkSettings.language == 0 ? tests[i].pl : tests[i].en;
        _stShowInfo(display, i + 1, TOTAL, name);

        // Czekaj na przycisk przed uruchomieniem testu
        while (true) {
            if (_stBtn(BTN_LEFT)) return;  // wyjdz z testow
            if (_stBtn(BTN_OK) || _stBtn(BTN_RIGHT)) break;
            delay(20);
        }

        tests[i].fn(display);

        // Czekaj na nastepny / wyjscie
        while (true) {
            if (_stBtn(BTN_LEFT)) return;
            if (_stBtn(BTN_OK) || _stBtn(BTN_RIGHT)) break;
            delay(20);
        }
    }

    // Koniec testow
    display.clearBuffer();
    display.setFont(u8g2_font_6x10_tf);
    display.drawStr(40, 28, _stT("Testy zakonczone!", "Tests complete!"));
    display.drawStr(50, 44, _stT("Ekran dziala OK", "Display OK"));
    display.sendBuffer();
    delay(2000);
}
