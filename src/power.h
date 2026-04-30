#pragma once
// =====================================================================
//  power.h — globalny auto-sleep dla OLED
//
//  Po czasie bezczynnosci (kalkSettings.sleepMinutes) wywoluje
//  u8g2.setPowerSave(1) — wylacza panel OLED. Czeka na klawisz, potem
//  wybudza setPowerSave(0).
//
//  Kazdy ekran UI woluje powerCheckSleep(u8g2) w swojej petli — wtedy
//  sleep dziala globalnie. Aby tymczasowo wylaczyc (np. dla wyswietlania
//  rozwiazania AI gdzie user czyta dlugo): powerSetInhibit(true).
// =====================================================================

#include <Arduino.h>
#include <U8g2lib.h>
#include "input.h"
#include "settings_screen.h"

static bool   _powerInhibit = false;
static U8G2*  _powerU8g2    = nullptr;   // globalny pointer ustawiony w main.cpp

// Indeks 0-10 -> czas w ms (zgodnie z kalkSettings.sleepMinutes)
static const uint32_t _PWR_SLEEP_TIMES_MS[] = {
    30000UL, 60000UL, 120000UL, 180000UL, 240000UL, 300000UL,
    600000UL, 900000UL, 1200000UL, 1500000UL, 1800000UL
};

// Ustaw globalny pointer do OLED — wolane raz w main.cpp setup()
inline void powerSetU8g2(U8G2 *p) { _powerU8g2 = p; }

// Wylacz/wlacz auto-sleep w ramach biezacego ekranu (np. wyswietlanie
// dlugiej odpowiedzi AI gdzie user czyta dluzszy czas bez klikania)
inline void powerSetInhibit(bool b) {
    _powerInhibit = b;
    if (!b) inputActivityReset();
}

// Sprawdza czy nadszedl czas snu. Jesli tak — wylacza OLED, czeka
// na klawisz, wybudza. Wraca true gdy spal/wybudzil sie.
inline bool powerCheckSleep() {
    if (!_powerU8g2) return false;
    if (!kalkSettings.autoSleep) return false;
    if (_powerInhibit) return false;

    uint8_t idx = kalkSettings.sleepMinutes;
    if (idx > 10) idx = 10;
    uint32_t timeout = _PWR_SLEEP_TIMES_MS[idx];

    if (millis() - inputLastActivity() < timeout) return false;

    Serial.println("[POWER] OLED sleep");
    _powerU8g2->setPowerSave(1);

    while (true) {
        inputScan();
        bool any = false;
        for (uint8_t i = 1; i < KEY_COUNT; i++) {
            if (inputKeyDown((KalkKey)i)) { any = true; break; }
        }
        if (any) break;
        delay(50);
    }

    _powerU8g2->setPowerSave(0);
    inputActivityReset();
    Serial.println("[POWER] OLED wake");
    return true;
}
