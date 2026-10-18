#pragma once
// =====================================================================
//  power.h — auto-sleep OLED + ESP32 light sleep
//
//  Po czasie bezczynnosci (kalkSettings.sleepMinutes):
//    1. OLED off         (u8g2.setPowerSave), potem boost 12V OFF (PCB v4)
//    2. WiFi off         (~80mA oszczednosci)
//    3. ESP32 light sleep co _PWR_POLL_US (~80ms)
//       ESP32 budzi sie, sprawdza MCP23017 przez I2C (I2C zachowany
//       w light sleep), jesli brak klawisza — zasypia znowu.
//       Co _PWR_VBAT_CHECK_MS sprawdza tez VBAT (krytyczna -> wylaczenie).
//    4. Klawisz wykryty → boost ON, OLED on, klawisz budzacy jest polykany
//       (bez akcji). WiFi wraca TYLKO jesli bylo wlaczone przed snem i nie
//       jestesmy w trybie kalkulatora (powerSetCalculatorMode).
//
//  Light sleep zamiast delay(50):
//    active ~20mA → light sleep ~0.8mA (~25x oszczednosc).
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
#include "wifi_persist.h"   // wifiLoadSaved / wifiFastBegin / wifiStaOnLimited — reconnect po wybudzeniu
#include "panic.h"
#include "battery.h"        // VBAT watchdog w trybie kalkulatora i w uspieniu

// Pin EN boosta MT3608 (12V dla OLED). MUSI byc rowny KALK_BOOST_EN_PIN
// z main.cpp — tamto makro jest definiowane dopiero PO wszystkich include,
// wiec power.h go nie widzi.
//   PCB v4 (S3): GPIO47 bezposrednio.
#define _PWR_BOOST_EN_PIN  47

static bool     _powerInhibit    = false;
static U8G2*    _powerU8g2       = nullptr;
static bool     _powerCalcMode   = false;   // tryb kalkulatora: po wybudzeniu bez WiFi
static uint32_t _powerMinTimeout = 0;       // >0: ekran "do czytania" — dluzszy timeout snu

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

// Tryb kalkulatora (wolane z calculator.h przy wejsciu/wyjsciu z
// runCalculator). W trybie kalkulatora wybudzenie NIE wlacza WiFi —
// kalkulator go nie potrzebuje, a radio to ~80mA i peak pradu (brownout).
inline void powerSetCalculatorMode(bool on) { _powerCalcMode = on; }

// Minimalny czas bezczynnosci przed snem dla ekranow "do czytania"
// (notatki, sprawdziany) — zamiast trwalej blokady snu (powerSetInhibit),
// ktora przy zapomnianym urzadzeniu rozladowywala baterie. 0 = wylacz.
// Efektywny timeout = max(ustawienie uzytkownika, ms).
inline void powerSetMinTimeout(uint32_t ms) {
    _powerMinTimeout = ms;
    inputActivityReset();
}

// =====================================================================
//  VBAT watchdog (PCB v4). main.cpp ma _vbatWatchdogLoop(), ale dziala on
//  tylko w loop() menu AI — w trybie kalkulatora (gdzie urzadzenie spedza
//  wiekszosc czasu) i w petli uspienia nikt nie sprawdzal baterii, a
//  brownout detector jest wylaczony w setup(). Tu: co _PWR_VBAT_CHECK_MS,
//  przy 2 kolejnych odczytach < BATTERY_SHUTDOWN_MV -> bezpieczne wylaczenie
//  (ta sama sekwencja co w main.cpp: OLED off -> boost off -> deep sleep).
// =====================================================================
#define _PWR_VBAT_CHECK_MS    30000UL
#define _PWR_VBAT_CONFIRM_MS  6000UL    // > BATTERY_CACHE_MS, zeby drugi odczyt byl swiezy
static uint32_t _powerVbatLast     = 0;
static uint8_t  _powerVbatLowCount = 0;

static void _powerCriticalShutdown(uint16_t mv, bool displayOn) {
    Serial.printf("[POWER] VBAT=%u mV - CRITICAL, shutdown\n", mv);
    Serial.flush();

    if (displayOn && _powerU8g2) {
        U8G2 &d = *_powerU8g2;
        d.clearBuffer();
        d.setFont(u8g2_font_10x20_tf);
        d.drawStr(35, 22, "NISKA BATERIA");
        d.setFont(u8g2_font_6x10_tf);
        char buf[40];
        snprintf(buf, sizeof(buf), "VBAT = %u.%02u V", mv / 1000, (mv % 1000) / 10);
        d.drawStr(80, 40, buf);
        d.drawStr(40, 55, "Podlacz ladowarke USB-C");
        d.sendBuffer();
        delay(3000);
    }

    if (_powerU8g2) _powerU8g2->setPowerSave(1);
    delay(20);
    digitalWrite(_PWR_BOOST_EN_PIN, LOW);
    delay(20);
    // Timer z petli light sleep jest nadal uzbrojony — bez tego deep sleep
    // obudzilby uklad po 80 ms (restart zamiast wylaczenia).
    esp_sleep_disable_wakeup_source(ESP_SLEEP_WAKEUP_ALL);
    esp_deep_sleep_start();
}

// displayOn: czy OLED + boost sa wlaczone (komunikat na ekranie).
static void _powerVbatTick(bool displayOn) {
    uint32_t now = millis();
    uint32_t interval = _powerVbatLowCount ? _PWR_VBAT_CONFIRM_MS : _PWR_VBAT_CHECK_MS;
    if (_powerVbatLast != 0 && now - _powerVbatLast < interval) return;
    _powerVbatLast = now;

    uint16_t mv = batteryReadMillivolts();
    // < BATTERY_PRESENT_MV = brak baterii / nieznany odczyt (USB-only) — ignoruj
    if (mv >= BATTERY_PRESENT_MV && mv < BATTERY_SHUTDOWN_MV) {
        if (++_powerVbatLowCount >= 2) _powerCriticalShutdown(mv, displayOn);
        Serial.printf("[POWER] VBAT=%u mV nisko — potwierdzam za %lu s\n",
                      mv, (unsigned long)(_PWR_VBAT_CONFIRM_MS / 1000));
    } else {
        _powerVbatLowCount = 0;
    }
}

// Sprawdza czy nadszedl czas snu. Jesli tak:
//   - Wylacza OLED (+ boost na PCB v4) i WiFi
//   - Wchodzi w petle light sleep (ESP32 spi co 80ms, sprawdza klawiature)
//   - Po klawiszu: budzi OLED, zwraca true (caller przerysowuje ekran)
inline bool powerCheckSleep() {
    panicCheck();
    _powerVbatTick(true);   // takze gdy auto-sleep wylaczony / zablokowany
    batteryTick();          // probki do detekcji ladowania (wariant ADC)
    if (!_powerU8g2) return false;
    if (!kalkSettings.autoSleep) return false;
    if (_powerInhibit) return false;
    // Bez klawiatury nie byloby czym wybudzic — nie usypiaj (input.h
    // probuje ponownie wykryc MCP23017 co ~1 s).
    if (!inputIsReady()) return false;

    uint8_t idx = kalkSettings.sleepMinutes;
    if (idx > 10) idx = 10;
    uint32_t limit = _PWR_SLEEP_TIMES_MS[idx];
    if (limit < _powerMinTimeout) limit = _powerMinTimeout;
    if (millis() - inputLastActivity() < limit) return false;

    // === Wejscie w tryb czuwania ===
    Serial.println("[POWER] sleep: OLED off + boost off + WiFi off + light sleep");

    // WiFi wznawiamy po wybudzeniu tylko jesli bylo wlaczone (STA) teraz.
    const bool wifiWasOn = (WiFi.getMode() & WIFI_STA) != 0;

    _powerU8g2->setPowerSave(1);   // AEh: display OFF (RAM ekranu zostaje)
    // Ta sama kolejnosc co sprawdzona sekwencja w main.cpp (niska bateria):
    // najpierw display OFF, potem odciecie VCC (boost EN LOW).
    delay(20);
    digitalWrite(_PWR_BOOST_EN_PIN, LOW);

    // WiFi off — oszczednosc ~80mA.
    if (WiFi.getMode() != WIFI_OFF) {
        WiFi.disconnect(true);
        WiFi.mode(WIFI_OFF);
    }

    // Krotka chwila na dokonczenie transakcji I2C/SPI zanim ESP32 zasnie
    delay(5);

    // === Petla light sleep ===
    // ESP32 w light sleep: CPU stop, I2C/SPI zachowane, RAM OK.
    // Pobor pradu: ~0.8mA (vs ~20mA active bez WiFi).
    // I2C (Wire) dziala normalnie po wybudzeniu z light sleep.
    while (true) {
        esp_sleep_enable_timer_wakeup(_PWR_POLL_US);
        esp_light_sleep_start();
        // Kontynuacja tu po ~80ms (timer wakeup)

        // Pojedynczy surowy skan (bez debounce) — krotkie tapniecie tez budzi,
        // a klawisz budzacy jest polykany (nie wykona akcji).
        if (inputWakeScan()) break;
        if (panicTriggered()) break;
        _powerVbatTick(false);   // ekran wylaczony — bez komunikatu
    }

    // Uspienie trwalo — timer budzacy nie jest juz potrzebny.
    esp_sleep_disable_wakeup_source(ESP_SLEEP_WAKEUP_TIMER);

    // === Wybudzenie ===
    digitalWrite(_PWR_BOOST_EN_PIN, HIGH);
    delay(30);   // MT3608 soft-start — VCC OLED stabilne zanim AFh (display ON)
    _powerU8g2->setPowerSave(0);
    inputActivityReset();

    // Auto-reconnect WiFi do zapisanej sieci (creds w NVS) — tylko gdy radio
    // bylo wlaczone przed snem i nie jestesmy w kalkulatorze. TxPower
    // ograniczony (anty-brownout, jak przy boot).
    if (wifiWasOn && !_powerCalcMode) {
        char ssid[33] = "", pass[64] = "";
        if (wifiLoadSaved(ssid, sizeof(ssid), pass, sizeof(pass))) {
            wifiStaOnLimited();
            delay(30);
            wifiFastBegin(ssid, pass);
            Serial.println("[POWER] wake -> WiFi reconnect");
        }
        memset(pass, 0, sizeof(pass));
    }
    Serial.println("[POWER] wake");
    return true;
}
