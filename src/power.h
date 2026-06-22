#pragma once
// =====================================================================
//  power.h — auto-sleep OLED + ESP32 light sleep
//
//  Po czasie bezczynnosci (kalkSettings.sleepMinutes):
//    1. OLED off         (u8g2.setPowerSave)
//    2. WiFi off         (~80mA oszczednosci)
//    3. ESP32 light sleep co _PWR_POLL_US (~80ms)
//       ESP32 budzi sie, sprawdza MCP23017 przez I2C (I2C zachowany
//       w light sleep), jesli brak klawisza — zasypia znowu.
//    4. Klawisz wykryty → OLED on, WiFi reconnect lazily, powrot.
//
//  Light sleep zamiast delay(50):
//    active ~20mA → light sleep ~0.8mA (~25x oszczednosc).
//    WiFi reconnect nastepuje automatycznie przy nastepnej probie
//    rozwiazania zadania (_solEnsureWifi).
//
//  Dlaczego nie deep sleep:
//    Klawiatura przez MCP23017 (I2C expander) — brak bezposredniego
//    GPIO do ESP32. ext0/ext1 wymaga direct GPIO. Na nastepnym PCB:
//    podlacz MCP23017 INTA do wolnego GPIO i uzyj ext1 wakeup.
// =====================================================================

#include <Arduino.h>
#include <U8g2lib.h>
#include <WiFi.h>
#include <esp_sleep.h>
#include "input.h"
#include "settings_screen.h"
#include "wifi_persist.h"   // wifiLoadSaved / wifiFastBegin — reconnect po wybudzeniu
#include "panic.h"

static bool   _powerInhibit = false;
static U8G2*  _powerU8g2    = nullptr;

// Indeks 0-10 → czas w ms (zgodnie z kalkSettings.sleepMinutes)
static const uint32_t _PWR_SLEEP_TIMES_MS[] = {
    30000UL, 60000UL, 120000UL, 180000UL, 240000UL, 300000UL,
    600000UL, 900000UL, 1200000UL, 1500000UL, 1800000UL
};

// Co 80ms budzimy sie z light sleep i odpytujemy MCP23017 przez I2C.
// 80ms = 12.5 sondowan/s — opoznienie wejscia praktycznie niezauwazalne.
static const uint64_t _PWR_POLL_US = 80000ULL;

// Ustaw globalny pointer do OLED — wolane raz w main.cpp setup()
inline void powerSetU8g2(U8G2 *p) { _powerU8g2 = p; }

// Wylacz/wlacz auto-sleep w ramach biezacego ekranu (np. wyswietlanie
// dlugiej odpowiedzi AI gdzie user czyta dluzszy czas bez klikania)
inline void powerSetInhibit(bool b) {
    _powerInhibit = b;
    if (!b) inputActivityReset();
}

// Sprawdza czy nadszedl czas snu. Jesli tak:
//   - Wylacza OLED i WiFi
//   - Wchodzi w petle light sleep (ESP32 spi co 80ms, sprawdza klawiature)
//   - Po klawiszu: budzi OLED, zwraca true (main.cpp przerysuje menu)
inline bool powerCheckSleep() {
    panicCheck();
    if (!_powerU8g2) return false;
    if (!kalkSettings.autoSleep) return false;
    if (_powerInhibit) return false;

    uint8_t idx = kalkSettings.sleepMinutes;
    if (idx > 10) idx = 10;
    if (millis() - inputLastActivity() < _PWR_SLEEP_TIMES_MS[idx]) return false;

    // === Wejscie w tryb czuwania ===
    Serial.println("[POWER] sleep: OLED off + WiFi off + light sleep");

    _powerU8g2->setPowerSave(1);

    // WiFi off — oszczednosc ~80mA. Po wybudzeniu WiFi pozostaje OFF;
    // _solEnsureWifi() w solve_screen.h polaczy ponownie gdy potrzeba.
    if (WiFi.getMode() != WIFI_OFF) {
        WiFi.disconnect(true);
        WiFi.mode(WIFI_OFF);
    }

    // Krotka chwila na dokonczenie transakcji I2C/SPI zanim ESP32 zasnie
    delay(5);

    // === Petla light sleep ===
    // ESP32 w light sleep: CPU stop, I2C/SPI zachowane, RAM OK.
    // Pobor pradu: ~0.8mA (vs ~20mA active bez WiFi).
    // I2C (Wire) dziala normalnie po wybudzeniu z light sleep —
    // jesli nie (stary bootloader/core), dodaj Wire.begin(21,22) po esp_light_sleep_start().
    while (true) {
        esp_sleep_enable_timer_wakeup(_PWR_POLL_US);
        esp_light_sleep_start();
        // Kontynuacja tu po ~80ms (timer wakeup)

        inputScan();
        bool any = false;
        for (uint8_t i = 1; i < KEY_COUNT; i++) {
            if (inputKeyDown((KalkKey)i)) { any = true; break; }
        }
        if (any) break;
        if (panicTriggered()) break;
    }

    // === Wybudzenie ===
    _powerU8g2->setPowerSave(0);
    inputActivityReset();
    // Auto-reconnect WiFi do zapisanej sieci (creds w NVS) — po wybudzeniu user
    // NIE traci polaczenia. TxPower ograniczony (anty-brownout, jak przy boot).
    {
        char ssid[33] = "", pass[64] = "";
        if (wifiLoadSaved(ssid, sizeof(ssid), pass, sizeof(pass))) {
            WiFi.mode(WIFI_STA);
            WiFi.setTxPower(WIFI_POWER_8_5dBm);
            delay(30);
            wifiFastBegin(ssid, pass);
            Serial.printf("[POWER] wake -> WiFi reconnect: %s\n", ssid);
        }
    }
    Serial.println("[POWER] wake");
    return true;
}
