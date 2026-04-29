#pragma once
// info_screen.h — header-only modul informacyjny dla KalkMate
// Wywolanie: showInfo(display);
//
// 5 stron: Jak uzywac / Wskazowki / Przedmioty / Status serwera / FAQ
// Nawigacja: LEFT/RIGHT lub UP/DOWN, BTN_LEFT na stronie 1 = wyjscie

#include <Arduino.h>
#include <U8g2lib.h>
#include <WiFi.h>
#include "input.h"
#include "settings_screen.h"

// === Piny przyciskow (INPUT_PULLUP, LOW = wcisniety) ===
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
// Debounce — zmienne z prefiksem _info
// ---------------------------------------------------------------------------
static unsigned long _infoLastPress = 0;
#define _INFO_DEBOUNCE_MS 200

static bool _infoBtn(int pin) {
    if (inputBtn(pin) == LOW) {
        unsigned long now = millis();
        if (now - _infoLastPress > _INFO_DEBOUNCE_MS) {
            _infoLastPress = now;
            return true;
        }
    }
    return false;
}

static void _infoWaitRelease() {
    while (inputBtn(BTN_UP)    == LOW ||
           inputBtn(BTN_DOWN)  == LOW ||
           inputBtn(BTN_LEFT)  == LOW ||
           inputBtn(BTN_RIGHT) == LOW ||
           inputBtn(BTN_OK)    == LOW) {
        delay(10);
    }
    _infoLastPress = millis();
}

// ---------------------------------------------------------------------------
// Pomocnik dwujezycznosci
// ---------------------------------------------------------------------------
static const char* _infoT(const char* pl, const char* en) {
    return kalkSettings.language == 0 ? pl : en;
}

// ---------------------------------------------------------------------------
// Stale
// ---------------------------------------------------------------------------
#define _INFO_TOTAL_PAGES 5

// Wspolrzedne Y linii tresci
static const int _INFO_CONTENT_Y[4] = {22, 32, 42, 52};

// ---------------------------------------------------------------------------
// Rysowanie pojedynczej strony ze stala trescia
// ---------------------------------------------------------------------------
static void _infoDrawStaticPage(U8G2 &d, int page,
                                 const char* title,
                                 const char* line0,
                                 const char* line1,
                                 const char* line2,
                                 const char* line3) {
    d.clearBuffer();

    // Tytul (y=10, font 6x10)
    d.setFont(u8g2_font_6x10_tf);
    d.drawStr(2, 10, title);

    // Linia pod tytulem (y=12)
    d.drawHLine(0, 12, 256);

    // 4 linie tresci (y=22,32,42,52)
    const char* lines[4] = {line0, line1, line2, line3};
    for (int i = 0; i < 4; i++) {
        if (lines[i] && lines[i][0] != '\0') {
            d.drawStr(2, _INFO_CONTENT_Y[i], lines[i]);
        }
    }

    // Linia nad paskiem nawigacji (y=54)
    d.drawHLine(0, 54, 256);

    // Pasek nawigacji (y=63, font 5x7)
    d.setFont(u8g2_font_5x7_tf);

    // Lewa strona: WSTECZ / BACK
    const char* backLabel = _infoT("< WSTECZ", "< BACK");
    d.drawStr(2, 63, backLabel);

    // Srodek: X/5
    char pageStr[8];
    snprintf(pageStr, sizeof(pageStr), "%d/%d", page + 1, _INFO_TOTAL_PAGES);
    int pageStrW = (int)strlen(pageStr) * 5;
    int pageStrX = (256 - pageStrW) / 2;
    d.drawStr(pageStrX, 63, pageStr);

    // Prawa strona: DALEJ / NEXT — nie na ostatniej stronie
    if (page < _INFO_TOTAL_PAGES - 1) {
        const char* nextLabel = _infoT("DALEJ >", "NEXT >");
        d.drawStr(256 - 37 - 2, 63, nextLabel);
    }

    d.sendBuffer();
}

// ---------------------------------------------------------------------------
// Strona 4 (indeks 3): Status serwera — dynamiczna
// ---------------------------------------------------------------------------
static void _infoDrawServerPage(U8G2 &d, int page) {
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);

    const char* title = _infoT("=== Status serwera (4/5) ===",
                                "=== Server status (4/5) ===");
    d.drawStr(2, 10, title);
    d.drawHLine(0, 12, 256);

    if (WiFi.status() == WL_CONNECTED) {
        // WiFi polaczone
        d.drawStr(2, _INFO_CONTENT_Y[0], _infoT("WiFi: Polaczono", "WiFi: Connected"));
        d.drawStr(2, _INFO_CONTENT_Y[1], _infoT("Serwer: OK (sprawdz w app)",
                                                  "Server: OK (check in app)"));

        // IP
        char ipLine[40];
        snprintf(ipLine, sizeof(ipLine), "IP: %s",
                 WiFi.localIP().toString().c_str());
        d.drawStr(2, _INFO_CONTENT_Y[2], ipLine);

        // RSSI
        char rssiLine[32];
        snprintf(rssiLine, sizeof(rssiLine), "RSSI: %d dBm", (int)WiFi.RSSI());
        d.drawStr(2, _INFO_CONTENT_Y[3], rssiLine);
    } else {
        // Brak polaczenia
        d.drawStr(2, _INFO_CONTENT_Y[0], _infoT("WiFi: Brak polaczenia",
                                                  "WiFi: Not connected"));
        d.drawStr(2, _INFO_CONTENT_Y[1], _infoT("Polacz sie z WiFi w",
                                                  "Connect to WiFi in"));
        d.drawStr(2, _INFO_CONTENT_Y[2], _infoT("Ustawieniach aby korzystac",
                                                  "Settings to use"));
        d.drawStr(2, _INFO_CONTENT_Y[3], _infoT("z funkcji AI",
                                                  "AI features"));
    }

    d.drawHLine(0, 54, 256);
    d.setFont(u8g2_font_5x7_tf);

    const char* backLabel = _infoT("< WSTECZ", "< BACK");
    d.drawStr(2, 63, backLabel);

    char pageStr[8];
    snprintf(pageStr, sizeof(pageStr), "%d/%d", page + 1, _INFO_TOTAL_PAGES);
    int pageStrW = (int)strlen(pageStr) * 5;
    int pageStrX = (256 - pageStrW) / 2;
    d.drawStr(pageStrX, 63, pageStr);

    // Nie ostatnia strona — pokaz DALEJ
    if (page < _INFO_TOTAL_PAGES - 1) {
        const char* nextLabel = _infoT("DALEJ >", "NEXT >");
        d.drawStr(256 - 37 - 2, 63, nextLabel);
    }

    d.sendBuffer();
}

// ---------------------------------------------------------------------------
// Rysowanie dowolnej strony (dispatcher)
// ---------------------------------------------------------------------------
static void _infoDrawPage(U8G2 &d, int page) {
    switch (page) {

        case 0: // Jak uzywac (1/5)
            _infoDrawStaticPage(d, page,
                _infoT("=== Jak uzywac (1/5) ===",
                        "=== How to use (1/5) ==="),
                _infoT("1. Zrob zdjecie zadania",
                        "1. Take a photo of task"),
                _infoT("2. Nacisnij OK aby wyslac",
                        "2. Press OK to send"),
                _infoT("3. Poczekaj na odpowiedz",
                        "3. Wait for response"),
                _infoT("4. Czytaj rozwiazanie",
                        "4. Read the solution")
            );
            break;

        case 1: // Wskazowki (2/5)
            _infoDrawStaticPage(d, page,
                _infoT("=== Wskazowki (2/5) ===",
                        "=== Tips (2/5) ==="),
                _infoT("Dobre oswietlenie zadania",
                        "Good lighting on the task"),
                _infoT("Trzymaj rowno, bez rozmazania",
                        "Hold steady, no blur"),
                _infoT("Zadanie musi byc czytelne",
                        "Task must be readable"),
                _infoT("Unikaj cieni na papierze",
                        "Avoid shadows on paper")
            );
            break;

        case 2: // Obsługiwane przedmioty (3/5)
            _infoDrawStaticPage(d, page,
                _infoT("=== Przedmioty (3/5) ===",
                        "=== Subjects (3/5) ==="),
                _infoT("Matematyka - wszystkie dzialy",
                        "Math - all topics"),
                _infoT("Fizyka - zadania obliczeniowe",
                        "Physics - calculations"),
                _infoT("Chemia - rownania, obliczenia",
                        "Chemistry - equations"),
                _infoT("Biologia - pytania opisowe",
                        "Biology - descriptive")
            );
            break;

        case 3: // Status serwera (4/5) — dynamiczny
            _infoDrawServerPage(d, page);
            break;

        case 4: // FAQ (5/5)
            _infoDrawStaticPage(d, page,
                _infoT("=== FAQ (5/5) ===",
                        "=== FAQ (5/5) ==="),
                _infoT("Brak odpowiedzi? Sprawdz WiFi",
                        "No response? Check WiFi"),
                _infoT("Zle rozwiazanie? Sprobuj znowu",
                        "Wrong answer? Try again"),
                _infoT("Blad kamery? Uruchom ponownie",
                        "Camera error? Restart device"),
                "Kontakt: kacper@kajpa.pl"
            );
            break;

        default:
            break;
    }
}

// ---------------------------------------------------------------------------
// Publiczna funkcja — glowny punkt wejscia
// ---------------------------------------------------------------------------
void showInfo(U8G2 &display) {
    // pinMode(BTN_UP,    INPUT_PULLUP);
    // pinMode(BTN_DOWN,  INPUT_PULLUP);
    // pinMode(BTN_LEFT,  INPUT_PULLUP);
    // pinMode(BTN_RIGHT, INPUT_PULLUP);
    // pinMode(BTN_OK,    INPUT_PULLUP);

    _infoWaitRelease();

    int curPage = 0;
    _infoDrawPage(display, curPage);

    while (true) {
        bool changed = false;

        // Nastepna strona: RIGHT lub DOWN
        if (_infoBtn(BTN_RIGHT) || _infoBtn(BTN_DOWN)) {
            if (curPage < _INFO_TOTAL_PAGES - 1) {
                curPage++;
                changed = true;
            }
        }

        // Poprzednia strona / wyjscie: LEFT lub UP
        if (_infoBtn(BTN_LEFT) || _infoBtn(BTN_UP)) {
            if (curPage > 0) {
                curPage--;
                changed = true;
            } else {
                // Strona 1 + BTN_LEFT = wyjscie
                _infoWaitRelease();
                return;
            }
        }

        if (changed) {
            _infoDrawPage(display, curPage);
        }

        delay(10);
    }
}
