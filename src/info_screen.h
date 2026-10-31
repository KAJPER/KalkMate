#pragma once
// info_screen.h — header-only modul informacyjny dla KalkMate
// Wywolanie: showInfo(display);
//
// 5 stron: Jak uzywac / Wskazowki / Przedmioty / Status serwera / FAQ
// Nawigacja: LEFT/RIGHT lub UP/DOWN, BTN_LEFT na stronie 1 = wyjscie,
// C/CE (BTN_BACK) = wyjscie z dowolnej strony

#include <Arduino.h>
#include <U8g2lib.h>
#include <WiFi.h>
#include "input.h"
#include "settings_screen.h"
#include "power.h"

// === Przyciski: wirtualne BTN_xx z input.h (>=200) ===
// Dawne fallbacki "#define BTN_UP 26" itp. wskazywaly na piny KAMERY
// (GPIO 12/13/14/26/27) — usuniete.
#if !defined(BTN_UP) || !defined(BTN_DOWN) || !defined(BTN_LEFT) || \
    !defined(BTN_RIGHT) || !defined(BTN_OK) || !defined(BTN_BACK)
#error "info_screen.h wymaga BTN_xx z input.h"
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
           inputBtn(BTN_OK)    == LOW ||
           inputBtn(BTN_BACK)  == LOW) {
        delay(10);
    }
    _infoLastPress = millis();
}

// ---------------------------------------------------------------------------
// Pomocnik tlumaczen (0=PL, 1=EN, 2=DE, 3=CS)
// ---------------------------------------------------------------------------
static const char* _infoT(const char* pl, const char* en, const char* de, const char* cs = nullptr) {
    return T(pl, en, de, cs);   // 3=Cestina; cs == nullptr -> EN
}

// ---------------------------------------------------------------------------
// Stale
// ---------------------------------------------------------------------------
#define _INFO_TOTAL_PAGES 5

// Wspolrzedne Y linii tresci (miedzy naglowkiem y=12 a stopka y=55)
static const int _INFO_CONTENT_Y[4] = {22, 32, 42, 52};

// ---------------------------------------------------------------------------
// Rama strony: naglowek "< Tytul" + licznik "2/5", stopka "< Wstecz" /
// "Dalej >" (bez "Dalej" na ostatniej stronie). Bez clear/sendBuffer.
// ---------------------------------------------------------------------------
static void _infoDrawChrome(U8G2 &d, int page, const char* title) {
    uiHeaderCount(d, title, true, page, _INFO_TOTAL_PAGES);
    uiFooter(d, _infoT("< Wstecz", "< Back", "< Zurueck", "< Zpet"),
             (page < _INFO_TOTAL_PAGES - 1) ? _infoT("Dalej >", "Next >", "Weiter >", "Dalsi >") : nullptr);
}

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
    _infoDrawChrome(d, page, title);

    // 4 linie tresci (y=22,32,42,52)
    d.setFont(UI_FONT);
    const char* lines[4] = {line0, line1, line2, line3};
    for (int i = 0; i < 4; i++) {
        if (lines[i] && lines[i][0] != '\0') {
            d.drawStr(4, _INFO_CONTENT_Y[i], lines[i]);
        }
    }

    d.sendBuffer();
}

// ---------------------------------------------------------------------------
// Strona 4 (indeks 3): Status serwera — dynamiczna
// ---------------------------------------------------------------------------
static void _infoDrawServerPage(U8G2 &d, int page) {
    d.clearBuffer();
    _infoDrawChrome(d, page, _infoT("Status serwera", "Server status", "Serverstatus", "Stav serveru"));

    if (WiFi.status() == WL_CONNECTED) {
        // WiFi polaczone: siec / IP / zasieg
        char ssid[34], ip[20], rssi[16];
        snprintf(ssid, sizeof(ssid), "%s", WiFi.SSID().c_str());
        snprintf(ip, sizeof(ip), "%s", WiFi.localIP().toString().c_str());
        int r = (int)WiFi.RSSI();
        snprintf(rssi, sizeof(rssi), "%d dBm", r);
        uiInfoRow(d, _INFO_CONTENT_Y[0], _infoT("Siec WiFi", "WiFi network", "WLAN-Netz", "Sit WiFi"), ssid);
        uiInfoRow(d, _INFO_CONTENT_Y[1], _infoT("Adres IP", "IP address", "IP-Adresse", "IP adresa"), ip);
        uiInfoRow(d, _INFO_CONTENT_Y[2], _infoT("Sygnal WiFi", "WiFi signal", "WLAN-Signal", "Signal WiFi"), rssi, 234);
        uiSignalBars(d, 239, _INFO_CONTENT_Y[2] - 1, r);
        // Sam WL_CONNECTED nie dowodzi, ze serwer odpowiada (brak zapytania
        // HTTPS tutaj, zeby nie blokowac UI) — stad etykieta o WiFi, nie serwerze.
        d.setFont(UI_FONT_SMALL);
        d.drawStr(4, _INFO_CONTENT_Y[3], _infoT("WiFi: OK (serwer: sprawdz w app)",
                                                 "WiFi: OK (server: check in app)",
                                                 "WiFi: OK (Server: siehe App)",
                                                 "WiFi: OK (server: viz aplikace)"));
        d.setFont(UI_FONT);
    } else {
        // Brak polaczenia: ikona + komunikat, podpowiedz mniejszym fontem
        const char* l0 = _infoT("WiFi: Brak polaczenia", "WiFi: Not connected", "WiFi: Nicht verbunden", "WiFi: Nepripojeno");
        d.setFont(UI_FONT);
        int w = d.getStrWidth(l0);
        int x = (UI_W - (w + 12)) / 2;
        d.setBitmapMode(1);
        d.drawXBM(x, 17, 8, 8, UI_ICO_WIFI);
        d.setBitmapMode(0);
        d.drawStr(x + 12, 25, l0);
        d.setFont(UI_FONT_SMALL);
        uiCenter(d, 36, _infoT("Polacz sie z WiFi w", "Connect to WiFi in", "WiFi verbinden in", "Pripojte se k WiFi v"));
        uiCenter(d, 44, _infoT("Ustawieniach aby korzystac", "Settings to use", "den Einstellungen fuer", "Nastaveni pro pouziti"));
        uiCenter(d, 52, _infoT("z funkcji AI", "AI features", "KI-Funktionen", "funkci AI"));
        d.setFont(UI_FONT);
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
                _infoT("Jak uzywac", "How to use", "Bedienung", "Jak pouzivat"),
                _infoT("1. Zrob zdjecie zadania",
                        "1. Take a photo of task",
                        "1. Aufgabe fotografieren",
                        "1. Vyfotte ulohu"),
                _infoT("2. Nacisnij OK aby wyslac",
                        "2. Press OK to send",
                        "2. OK druecken zum Senden",
                        "2. Stisknete OK pro odeslani"),
                _infoT("3. Poczekaj na odpowiedz",
                        "3. Wait for response",
                        "3. Auf Antwort warten",
                        "3. Pockejte na odpoved"),
                _infoT("4. Czytaj rozwiazanie",
                        "4. Read the solution",
                        "4. Loesung lesen",
                        "4. Prectete si reseni")
            );
            break;

        case 1: // Wskazowki (2/5)
            _infoDrawStaticPage(d, page,
                _infoT("Wskazowki", "Tips", "Tipps", "Tipy"),
                _infoT("Dobre oswietlenie zadania",
                        "Good lighting on the task",
                        "Aufgabe gut beleuchten",
                        "Dobre osvetleni ulohy"),
                _infoT("Trzymaj rowno, bez rozmazania",
                        "Hold steady, no blur",
                        "Ruhig halten, nicht verwackeln",
                        "Drzte rovne, bez rozmazani"),
                _infoT("Zadanie musi byc czytelne",
                        "Task must be readable",
                        "Aufgabe muss lesbar sein",
                        "Uloha musi byt citelna"),
                _infoT("Unikaj cieni na papierze",
                        "Avoid shadows on paper",
                        "Schatten auf Papier vermeiden",
                        "Bez stinu na papire")
            );
            break;

        case 2: // Obsługiwane przedmioty (3/5)
            _infoDrawStaticPage(d, page,
                _infoT("Przedmioty", "Subjects", "Faecher", "Predmety"),
                _infoT("Matematyka - wszystkie dzialy",
                        "Math - all topics",
                        "Mathematik - alle Themen",
                        "Matematika - vsechna temata"),
                _infoT("Fizyka - zadania obliczeniowe",
                        "Physics - calculations",
                        "Physik - Berechnungen",
                        "Fyzika - vypocetni ulohy"),
                _infoT("Chemia - rownania, obliczenia",
                        "Chemistry - equations",
                        "Chemie - Gleichungen",
                        "Chemie - rovnice, vypocty"),
                _infoT("Biologia - pytania opisowe",
                        "Biology - descriptive",
                        "Biologie - Beschreibungen",
                        "Biologie - popisne otazky")
            );
            break;

        case 3: // Status serwera (4/5) — dynamiczny
            _infoDrawServerPage(d, page);
            break;

        case 4: // FAQ (5/5)
            _infoDrawStaticPage(d, page,
                "FAQ",
                _infoT("Brak odpowiedzi? Sprawdz WiFi",
                        "No response? Check WiFi",
                        "Keine Antwort? WiFi pruefen",
                        "Zadna odpoved? Overte WiFi"),
                _infoT("Zle rozwiazanie? Sprobuj znowu",
                        "Wrong answer? Try again",
                        "Falsche Loesung? Nochmal versuchen",
                        "Spatne reseni? Zkuste znovu"),
                _infoT("Blad kamery? Uruchom ponownie",
                        "Camera error? Restart device",
                        "Kamerafehler? Geraet neu starten",
                        "Chyba kamery? Restartujte"),
                "Kontakt: kontakt@kalkmate.pl"
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
        if (powerCheckSleep()) _infoDrawPage(display, curPage);
        if (panicTriggered()) return;

        bool changed = false;

        // C/CE = wyjscie z dowolnej strony
        if (_infoBtn(BTN_BACK)) {
            _infoWaitRelease();
            return;
        }

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
