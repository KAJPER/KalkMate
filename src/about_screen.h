#pragma once
#include <U8g2lib.h>
#include "input.h"
#include "settings_screen.h"
#include "power.h"

// Fallback gdy FW_VERSION nie jest zdefiniowany w main.cpp
#ifndef FW_VERSION
#define FW_VERSION "?.?.?"
#endif

// === Przyciski (INPUT_PULLUP, LOW = wcisniety) ===
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
// showAboutScreen — wyswietla ekran "O programie" (3 strony, nawigacja przyciskami)
// Powraca do callera po nacisnieciu BTN_OK na stronie 1
// lub BTN_LEFT na stronie 1.
// ---------------------------------------------------------------------------
void showAboutScreen(U8G2 &display) {

    // --- dane stron -----------------------------------------------------------
    // Wybor jezyka: 0 = Polski, 1 = English, 2 = Deutsch
    uint8_t _lang = kalkSettings.language;
    // Pomocniczy helper 3-jezyczny lokalny dla tego ekranu
    auto _abT = [_lang](const char* pl, const char* en, const char* de) -> const char* {
        if (_lang == 0) return pl;
        if (_lang == 1) return en;
        return de;
    };

    const char* const _about_titles[3] = {
        _abT("=== O programie ===", "=== About ===", "=== Ueber ==="),
        _abT("=== Tworcy ===", "=== Authors ===", "=== Autoren ==="),
        _abT("=== Wersja ===", "=== Version ===", "=== Version ===")
    };

    // Linie z dynamiczna wersja firmware — z FW_VERSION zdefiniowanego w main.cpp
    static char _aboutHeaderLine[40];
    static char _aboutFwLine[40];
    snprintf(_aboutHeaderLine, sizeof(_aboutHeaderLine), "KalkMate v%s", FW_VERSION);
    snprintf(_aboutFwLine, sizeof(_aboutFwLine),
             _abT("Wersja firmware: %s", "Firmware version: %s", "Firmware-Version: %s"),
             FW_VERSION);

    // 4 linie tresci na strone (puste ciagi == pusta linia)
    const char* const _about_lines[3][4] = {
        {
            _aboutHeaderLine,
            _abT("Kalkulator AI dla maturzystow", "AI calculator for students", "KI-Rechner fuer Schueler"),
            _abT("Obsluguje: matematyke, fizyke,", "Supports: math, physics,", "Unterstuetzt: Mathe, Physik,"),
            _abT("chemie i biologie", "chemistry and biology", "Chemie und Biologie")
        },
        {
            _abT("Projekt i hardware:", "Project and hardware:", "Projekt und Hardware:"),
            "  KAJPA",
            _abT("Oprogramowanie:", "Software:", "Software:"),
            "  KAJPA"
        },
        {
            _aboutFwLine,
            "Chip: ESP32-WROVER-E",
            "Flash: 16MB, PSRAM: 8MB",
            _abT("Wyswietlacz: OLED 256x64", "Display: OLED 256x64", "Display: OLED 256x64")
        }
    };

    // dodatkowa 5. linia na stronie 2 (silnik AI) — wyswietlana jako linia 4
    // (strona 2 ma 5 pozycji, ale layout ma tylko 4 sloty — pomijamy ostatnia)
    // Zamiast tego upakuj w 4 linie jak powyzej; "Silnik AI" trafia do linii 4
    // na stronie 2 zamieniajac puste miejsce:
    // (juz jest upakowane powyzej, linia 4 strony 2 = "  Kacper + Claude AI")
    // Strona 2 linia 5 "Silnik AI: Anthropic Claude" nie miesci sie w layoucie —
    // dodajemy ja jako nadpisanie linii [1][3]:
    // (zrobione statycznie powyzej — linia [1][3] = "  Kacper + Claude AI",
    //  a "Silnik AI: Anthropic Claude" ladujemy do linii [1][2] + [1][3])
    // Ostateczna kolejnosc linii strony 2:
    //   [1][0] "Projekt i hardware:"
    //   [1][1] "  Kacper"
    //   [1][2] "Oprogramowanie i AI:"
    //   [1][3] "  Kacper + Claude AI"
    // Silnik AI zmiesci sie tylko jesli zmniejszymy ilosc linii lub font;
    // zgodnie ze specyfikacja layout ma dokladnie 4 linie — pomijamy 5. pozycje.

    static const int  _about_total_pages = 3;

    // --- zmienne stanu --------------------------------------------------------
    static int  _about_cur_page  = 0;
    static unsigned long _about_last_press = 0;

    // Reset stanu przy wejsciu
    _about_cur_page  = 0;
    _about_last_press = 0;

    // Czekaj az user puscil OK po wybraniu "O programie" w menu — bez tego
    // pierwsza iteracja petli wykrywa nadal wcisniety BTN_OK i od razu
    // wychodzi z about screen.
    inputWaitRelease();
    _about_last_press = millis();

    // Upewnij sie ze piny sa skonfigurowane
    // pinMode(BTN_UP,    INPUT_PULLUP);
    // pinMode(BTN_DOWN,  INPUT_PULLUP);
    // pinMode(BTN_LEFT,  INPUT_PULLUP);
    // pinMode(BTN_RIGHT, INPUT_PULLUP);
    // pinMode(BTN_OK,    INPUT_PULLUP);

    // --- lambdy pomocnicze ----------------------------------------------------
    // Rysuj aktualna strone
    auto drawPage = [&]() {
        display.clearBuffer();

        // --- Tytul (y=10, font 6x10) ---
        display.setFont(u8g2_font_6x10_tf);
        display.drawStr(2, 10, _about_titles[_about_cur_page]);

        // --- Linia pozioma pod tytulem (y=12) ---
        display.drawHLine(0, 12, 256);

        // --- 4 linie tresci (y=22,32,42,52) ---
        const int content_y[4] = {22, 32, 42, 52};
        display.setFont(u8g2_font_6x10_tf);
        for (int i = 0; i < 4; i++) {
            if (_about_lines[_about_cur_page][i][0] != '\0') {
                display.drawStr(2, content_y[i],
                                _about_lines[_about_cur_page][i]);
            }
        }

        // --- Linia pozioma nad nawigacja (y=54) ---
        display.drawHLine(0, 54, 256);

        // --- Pasek nawigacji (y=63, font 5x7) ---
        display.setFont(u8g2_font_5x7_tf);

        // "< WSTECZ" / "< BACK" / "< ZURUECK" — lewa strona
        const char* backLabel = _abT("< WSTECZ", "< BACK", "< ZURUECK");
        display.drawStr(2, 63, backLabel);

        // "X/3" — srodek (szerokosc ekranu 256, napis ~3 znaki*5+odst = ~18px)
        char pageStr[8];
        snprintf(pageStr, sizeof(pageStr), "%d/%d",
                 _about_cur_page + 1, _about_total_pages);
        // wycentruj: szerokosc glifa 5x7 = 5px/znak
        int pageStrW = (int)strlen(pageStr) * 5;
        int pageStrX = (256 - pageStrW) / 2;
        display.drawStr(pageStrX, 63, pageStr);

        // "DALEJ >" / "NEXT >" / "WEITER >" — prawa strona (nie na ostatniej stronie)
        if (_about_cur_page < _about_total_pages - 1) {
            const char* nextLabel = _abT("DALEJ >", "NEXT >", "WEITER>");
            // szerokosc max 7 znakow * 5px = 35px
            display.drawStr(256 - 35 - 2, 63, nextLabel);
        }

        display.sendBuffer();
    };

    // Debounce helper: zwraca true jesli przycisk jest wcisniety i minelo 200ms
    auto btnPressed = [&](int pin) -> bool {
        if (inputBtn(pin) == LOW) {
            unsigned long now = millis();
            if (now - _about_last_press >= 200UL) {
                _about_last_press = now;
                return true;
            }
        }
        return false;
    };

    // --- Petla glowna modulu --------------------------------------------------
    drawPage();

    while (true) {
        if (powerCheckSleep()) drawPage();
        if (panicTriggered()) return;

        bool changed = false;

        // Nastepna strona
        if (btnPressed(BTN_RIGHT) || btnPressed(BTN_DOWN)) {
            if (_about_cur_page < _about_total_pages - 1) {
                _about_cur_page++;
                changed = true;
            }
        }

        // Poprzednia strona / wyjscie
        if (btnPressed(BTN_LEFT) || btnPressed(BTN_UP)) {
            if (_about_cur_page > 0) {
                _about_cur_page--;
                changed = true;
            } else {
                // Strona 1 + BTN_LEFT/BTN_UP = wyjscie
                return;
            }
        }

        // BTN_OK na stronie 1 = wyjscie
        if (btnPressed(BTN_OK)) {
            if (_about_cur_page == 0) {
                return;
            }
        }

        if (changed) {
            drawPage();
        }

        delay(10);  // odciaz CPU
    }
}
