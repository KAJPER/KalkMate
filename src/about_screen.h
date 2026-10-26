#pragma once
#include <U8g2lib.h>
#include "input.h"
#include "settings_screen.h"
#include "i18n_extra.h"   // kalkTrExtra — _abT dla jezykow 4..10
#include "power.h"

// Fallback gdy FW_VERSION nie jest zdefiniowany w main.cpp
#ifndef FW_VERSION
#define FW_VERSION "?.?.?"
#endif

// === Przyciski: wirtualne BTN_xx z input.h (>=200) ===
// Dawne fallbacki "#define BTN_UP 26" itp. wskazywaly na piny KAMERY
// (GPIO 12/13/14/26/27) — usuniete.
#if !defined(BTN_UP) || !defined(BTN_DOWN) || !defined(BTN_LEFT) || \
    !defined(BTN_RIGHT) || !defined(BTN_OK) || !defined(BTN_BACK)
#error "about_screen.h wymaga BTN_xx z input.h"
#endif

// Dane sprzetowe strony "Wersja" (PCB v4)
#define _ABOUT_CHIP_VALUE  "ESP32-S3 (N16R8)"
#define _ABOUT_MEM_VALUE   "16MB + 8MB PSRAM"
#define _ABOUT_DISP_VALUE  "OLED 256x64"

// ---------------------------------------------------------------------------
// showAboutScreen — wyswietla ekran "O programie" (3 strony, nawigacja przyciskami)
// Powraca do callera po nacisnieciu BTN_OK lub BTN_LEFT/BTN_UP na stronie 1,
// albo C/CE (BTN_BACK) na dowolnej stronie.
// ---------------------------------------------------------------------------
void showAboutScreen(U8G2 &display) {

    // --- dane stron -----------------------------------------------------------
    // Wybor jezyka: 0 = Polski, 1 = English, 2 = Deutsch, 3 = Cestina
    uint8_t _lang = kalkSettings.language;
    // Pomocniczy helper 4-jezyczny lokalny dla tego ekranu
    auto _abT = [_lang](const char* pl, const char* en, const char* de, const char* cs) -> const char* {
        if (_lang >= KALK_TR_EXTRA_FIRST) return kalkTrExtra(en, _lang);   // 4..10
        switch (_lang) {
            case 0:  return pl;
            case 2:  return de;
            case 3:  return cs;
            default: return en;
        }
    };

    const char* const _about_titles[3] = {
        _abT("O programie", "About KalkMate", "Ueber KalkMate", "O programu"),
        _abT("Tworcy", "Authors", "Autoren", "Autori"),
        _abT("Wersja", "Version", "Version", "Verze")
    };

    // Strona 1: duzy napis "KalkMate" + wersja z lewej, opis z prawej
    static char _aboutVer[24];
    snprintf(_aboutVer, sizeof(_aboutVer), "v%s", FW_VERSION);
    const char* const _about_desc[3] = {
        _abT("Kalkulator AI dla maturzystow", "AI calculator for students", "KI-Rechner fuer Schueler", "AI kalkulacka pro maturanty"),
        _abT("Obsluguje: matematyke, fizyke,", "Supports: math, physics,", "Unterstuetzt: Mathe, Physik,", "Podporuje: matematiku, fyziku,"),
        _abT("chemie i biologie", "chemistry and biology", "Chemie und Biologie", "chemii a biologii")
    };

    // Strona 2: tworcy (etykieta -> wartosc)
    const char* const _about_authors[2] = {
        _abT("Projekt i hardware:", "Project and hardware:", "Projekt und Hardware:", "Projekt a hardware:"),
        _abT("Oprogramowanie:", "Software:", "Software:", "Software:")
    };

    // Strona 3: wersja + sprzet (PCB v4) jako wiersze etykieta -> wartosc
    const char* const _about_hw_labels[4] = {
        _abT("Firmware", "Firmware", "Firmware", "Firmware"),
        _abT("Procesor", "Processor", "Prozessor", "Procesor"),
        _abT("Pamiec flash", "Flash memory", "Flash-Speicher", "Pamet flash"),
        _abT("Ekran", "Display", "Anzeige", "Displej")
    };
    const char* const _about_hw_values[4] = {
        _aboutVer, _ABOUT_CHIP_VALUE, _ABOUT_MEM_VALUE, _ABOUT_DISP_VALUE
    };

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

        // --- Naglowek "< Tytul" + licznik "1/3" ---
        uiHeaderCount(display, _about_titles[_about_cur_page], true,
                      _about_cur_page, _about_total_pages);

        if (_about_cur_page == 0) {
            // Lewa kolumna: nazwa duzym fontem + wersja
            display.setFont(UI_FONT_BIG);
            display.drawStr(6, 35, "KalkMate");
            display.setFont(UI_FONT_SMALL);
            display.drawStr(6, 46, _aboutVer);
            display.drawVLine(94, 17, 34);
            // Prawa kolumna: opis (pierwsza linia 6x10, gdy sie miesci)
            for (int i = 0; i < 3; i++) {
                display.setFont(UI_FONT);
                if (i > 0 || display.getStrWidth(_about_desc[i]) > UI_W - 104) display.setFont(UI_FONT_SMALL);
                display.drawStr(102, 26 + i * 10, _about_desc[i]);
            }
        } else if (_about_cur_page == 1) {
            uiInfoRow(display, 30, _about_authors[0], "KAJPA");
            uiInfoRow(display, 42, _about_authors[1], "KAJPA");
        } else {
            for (int i = 0; i < 4; i++) {
                uiInfoRow(display, 22 + i * 10, _about_hw_labels[i], _about_hw_values[i]);
            }
        }

        // --- Stopka: "< Wstecz" / "Dalej >" (bez "Dalej" na ostatniej) ---
        uiFooter(display, _abT("< Wstecz", "< Back", "< Zurueck", "< Zpet"),
                 (_about_cur_page < _about_total_pages - 1) ? _abT("Dalej >", "Next >", "Weiter >", "Dalsi >") : nullptr);
        display.setFont(UI_FONT);

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

        // C/CE = wyjscie z dowolnej strony
        if (btnPressed(BTN_BACK)) {
            inputWaitRelease();
            return;
        }

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
