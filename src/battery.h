#pragma once
// =====================================================================
//  battery.h — pomiar napiecia baterii LiPo na PCB v4 (ESP32-S3).
//
//  Hardware:
//    VBAT ── R15 100k ──┬── R16 100k ── GND
//                       │
//                     GPIO3 (ADC1_CH2)
//
//    Stosunek dzielnika 1:2. Maksymalny VBAT 4.2V → ADC widzi 2.1V (bezpieczne).
//
//  Wykorzystuje analogReadMilliVolts() ktore na ESP32-S3 jest skalibrowane
//  fabryczne przez eFuse (dokladnosc ~±15mV).
// =====================================================================

#include <Arduino.h>

#ifdef KALK_HW_LEGACY
  // Stary PCB nie ma dzielnika baterii — wszystkie funkcje zwracaja "unknown"
  inline uint16_t batteryReadMillivolts() { return 0; }
  inline uint8_t  batteryReadPercent()    { return 100; }   // bez pomiaru => "OK"
  inline bool     batteryIsCritical()     { return false; }
  inline bool     batteryIsAvailable()    { return false; }
#else

#define BATTERY_PIN          3       // GPIO3 = ADC1_CH2 na ESP32-S3
#define BATTERY_DIVIDER      2       // 100k + 100k -> 1:2
#define BATTERY_SAMPLES      16      // oversampling - ADC jest szumiacy

// Progi napiec (mV)
#define BATTERY_VMAX_MV      4200    // 100% - LiPo pelna
#define BATTERY_VMIN_MV      3000    // 0% - DW01A obetnie ponizej 2.7V
#define BATTERY_CRITICAL_MV  3100    // auto-shutdown - zostaw zapas dla DW01A
#define BATTERY_LOW_MV       3400    // ostrzezenie low battery (15%)

// Cache - ADC moze byc wolny (~ms na sample). Update raz na ~5s wystarczy.
static uint16_t _batCachedMv = 0;
static uint32_t _batCacheTime = 0;
#define BATTERY_CACHE_MS  5000

// Surowy odczyt ADC w milliVoltach (po skalibrowaniu fabrycznym).
// 16 sampli + sredniaq dla stabilizacji.
inline uint16_t batteryReadMillivoltsRaw() {
    // ESP32-S3 ma fabryczna kalibracje ADC w eFuse - analogReadMilliVolts
    // zwraca prawdziwe mV (~15mV dokladnosci)
    uint32_t sum = 0;
    for (int i = 0; i < BATTERY_SAMPLES; i++) {
        sum += analogReadMilliVolts(BATTERY_PIN);
        delayMicroseconds(100);
    }
    uint32_t adcMv = sum / BATTERY_SAMPLES;
    return (uint16_t)(adcMv * BATTERY_DIVIDER);
}

// Cached read — szybkie, zwraca wartosc z bufora jezeli odswiezana w ostatnich 5s.
inline uint16_t batteryReadMillivolts() {
    uint32_t now = millis();
    if (_batCachedMv == 0 || (now - _batCacheTime) > BATTERY_CACHE_MS) {
        _batCachedMv = batteryReadMillivoltsRaw();
        _batCacheTime = now;
    }
    return _batCachedMv;
}

// Krzywa rozladowania LiPo (typowa, nielineara — napiecie spada szybciej przy konncu)
inline uint8_t batteryReadPercent() {
    uint16_t mv = batteryReadMillivolts();
    if (mv >= BATTERY_VMAX_MV) return 100;
    if (mv <= BATTERY_VMIN_MV) return 0;

    // Punkty kontrolne (mV, %) — interpolacja liniowa miedzy nimi
    struct Pt { uint16_t mv; uint8_t pct; };
    static const Pt curve[] = {
        { 4200, 100 }, { 4150,  95 }, { 4050,  85 }, { 3950,  75 },
        { 3870,  65 }, { 3800,  55 }, { 3750,  50 }, { 3700,  40 },
        { 3650,  30 }, { 3600,  20 }, { 3500,  15 }, { 3400,  10 },
        { 3300,   5 }, { 3200,   2 }, { 3000,   0 },
    };
    static const int N = sizeof(curve) / sizeof(curve[0]);

    for (int i = 0; i < N - 1; i++) {
        if (mv >= curve[i + 1].mv) {
            uint16_t mvLo = curve[i + 1].mv;
            uint16_t mvHi = curve[i].mv;
            uint16_t pLo  = curve[i + 1].pct;
            uint16_t pHi  = curve[i].pct;
            return (uint8_t)(pLo + (uint32_t)(mv - mvLo) * (pHi - pLo) / (mvHi - mvLo));
        }
    }
    return 0;
}

inline bool batteryIsCritical() {
    return batteryReadMillivolts() < BATTERY_CRITICAL_MV;
}

inline bool batteryIsLow() {
    return batteryReadMillivolts() < BATTERY_LOW_MV;
}

inline bool batteryIsAvailable() {
    return true;
}

#endif // !KALK_HW_LEGACY

// ---------------------------------------------------------------------
// Rysowanie ikonki baterii na ekranie OLED.
// Wymaga U8G2&. Rysuje w prawym gornym rogu (x=237, y=0, rozmiar 18×8 px).
// ---------------------------------------------------------------------
inline void batteryDrawIcon(class U8G2 &d) {
#ifdef KALK_HW_LEGACY
    (void)d;
    return;
#else
    if (!batteryIsAvailable()) return;

    const int X = 237;       // pozycja X (prawo gorny rog)
    const int Y = 0;         // pozycja Y
    const int W = 16;        // szerokosc obwodki
    const int H = 8;         // wysokosc obwodki

    // Obwodka baterii
    d.drawFrame(X, Y, W, H);
    // "Nub" na prawym koncu (positive terminal)
    d.drawBox(X + W, Y + 2, 2, H - 4);

    // Wypelnienie wg procentu (max szerokosc W-2, padding 1 piksel)
    uint8_t pct = batteryReadPercent();
    int fillW = ((W - 2) * pct) / 100;
    if (fillW > 0) {
        d.drawBox(X + 1, Y + 1, fillW, H - 2);
    }

    // Migajacy "low" indykator jezeli <15%
    if (batteryIsLow()) {
        static uint32_t lastBlink = 0;
        static bool blinkState = false;
        if (millis() - lastBlink > 500) {
            blinkState = !blinkState;
            lastBlink = millis();
        }
        if (blinkState) {
            // Wyczysc bateryjke + pokaz "!" obok
            d.setDrawColor(0);
            d.drawBox(X, Y, W + 2, H);
            d.setDrawColor(1);
            d.drawFrame(X, Y, W, H);
            d.drawBox(X + W, Y + 2, 2, H - 4);
            d.setFont(u8g2_font_5x7_tf);
            d.drawStr(X + 5, Y + 7, "!");
        }
    }
#endif
}
