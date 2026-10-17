#pragma once
// =====================================================================
//  battery.h — pomiar baterii LiPo i status ladowania (ESP32-S3).
//
//  Dwa warianty PCB, rozpoznawane automatycznie przy starcie przez
//  batteryInit() (sonda I2C na adres 0x36):
//
//  A) PCB z fuel gauge MAX17048 (wspolna magistrala I2C z MCP23017):
//       napiecie + procent : rejestry VCELL / SOC
//       GPIO3  = CHRG       (MCP73831 STAT przez BAT54; LOW = laduje)
//       GPIO38 = VBUS_SENSE (dzielnik 100k/150k; HIGH = USB wpiete)
//       GPIO41 = ALRT       (nieuzywany)
//
//  B) PCB bez MAX17048 (starsze v4): dzielnik na GPIO3 (ADC1_CH2)
//       VBAT ── R15 100k ──┬── R16 100k ── GND
//                          └── GPIO3
//       Dzielnik 1:2, max VBAT 4.2V → ADC widzi 2.1V. Napiecie z
//       analogReadMilliVolts() (kalibracja eFuse, ~±15mV), procent z krzywej
//       LiPo, ladowanie z detekcji nachylenia napiecia (brak pinu STAT).
//
//  UWAGA: GPIO3 znaczy w A i B cos innego (CHRG vs wyjscie dzielnika),
//  dlatego ADC jest czytane WYLACZNIE gdy MAX17048 nie zostal wykryty.
//
//  Publiczne API (batteryReadMillivolts/Percent/IsCharging/...) jest takie
//  samo w obu wariantach.
// =====================================================================

#include <Arduino.h>

#ifdef KALK_HW_LEGACY
  // Stary PCB nie ma dzielnika baterii — wszystkie funkcje zwracaja "unknown"
  inline bool     batteryInit()             { return false; }
  inline uint16_t batteryReadMillivolts()   { return 0; }
  inline uint8_t  batteryReadPercent()      { return 100; }   // bez pomiaru => "OK"
  inline bool     batteryIsCritical()       { return false; }
  inline bool     batteryIsLow()            { return false; }
  inline bool     batteryIsAvailable()      { return false; }
  inline bool     batteryIsUsbPresent()     { return false; }
  inline bool     batteryIsChargeComplete() { return false; }
  inline const char* batterySourceName()    { return "-"; }
  inline void     batteryTick()             {}
#else

#include <Wire.h>
#include "input.h"      // I2C_SDA / I2C_SCL — ta sama magistrala co MCP23017

#define BATTERY_PIN          3       // GPIO3 = ADC1_CH2 (wariant B); w wariancie A to CHRG
#define BATTERY_DIVIDER      2       // 100k + 100k -> 1:2
#define BATTERY_SAMPLES      16      // oversampling - ADC jest szumiacy

// Wariant A (MAX17048)
#define BATTERY_GAUGE_ADDR   0x36
#define BATTERY_CHRG_PIN     3       // LOW = laduje; HIGH = naladowana albo brak USB
#define BATTERY_VBUS_PIN     38      // HIGH = USB wpiete (odroznia "naladowana" od "brak USB")
#define _BAT_REG_VCELL       0x02
#define _BAT_REG_SOC         0x04

// Progi napiec (mV)
#define BATTERY_VMAX_MV      4200    // 100% - LiPo pelna
#define BATTERY_VMIN_MV      3000    // 0% - DW01A obetnie ponizej 2.7V
#define BATTERY_SHUTDOWN_MV  3200    // watchdog safe-shutdown — za niskie na boost+WiFi
#define BATTERY_CRITICAL_MV  3100    // ponizej shutdown, rezerwa DW01A
#define BATTERY_LOW_MV       3400    // ostrzezenie low battery (~10%)
#define BATTERY_PRESENT_MV   500     // ponizej = brak baterii / nieznany odczyt (USB-only)

// Cache - odczyt moze byc wolny (ADC ~ms na sample, I2C wspolny z klawiatura).
// Update raz na ~5s wystarczy.
static uint16_t _batCachedMv = 0;
static uint8_t  _batCachedPct = 0;     // tylko wariant A (SOC z fuel gauge)
static uint32_t _batCacheTime = 0;
#define BATTERY_CACHE_MS  5000

enum : uint8_t { _BAT_SRC_UNKNOWN = 0, _BAT_SRC_ADC, _BAT_SRC_GAUGE };
static uint8_t _batSource = _BAT_SRC_UNKNOWN;

// Odczyt 16-bitowego rejestru MAX17048 (MSB first). false = brak ACK / urwana odpowiedz.
static bool _batGaugeRead16(uint8_t reg, uint16_t &out) {
    Wire.beginTransmission(BATTERY_GAUGE_ADDR);
    Wire.write(reg);
    if (Wire.endTransmission() != 0) return false;
    if (Wire.requestFrom((uint8_t)BATTERY_GAUGE_ADDR, (uint8_t)2) != 2) return false;
    uint8_t hi = Wire.read();
    uint8_t lo = Wire.read();
    out = ((uint16_t)hi << 8) | lo;
    return true;
}

// VCELL: 78.125 uV/LSB => mV = raw * 5 / 64.
// SOC:   starszy bajt = pelne procenty, mlodszy = 1/256 %.
// Przy bledzie I2C zostaje poprzednia wartosc w cache.
static bool _batGaugeRefresh() {
    uint16_t vcell, soc;
    if (!_batGaugeRead16(_BAT_REG_VCELL, vcell)) return false;
    if (!_batGaugeRead16(_BAT_REG_SOC, soc)) return false;
    _batCachedMv = (uint16_t)(((uint32_t)vcell * 5) >> 6);
    uint8_t pct = (uint8_t)(soc >> 8);
    _batCachedPct = pct > 100 ? 100 : pct;
    return true;
}

// Wykrywa MAX17048 i wybiera zrodlo pomiaru. Bezpieczne do wielokrotnego
// wolania: gdy gauge juz wykryty, nic nie robi; w przeciwnym razie sonduje
// ponownie (np. drugie wolanie po inputBegin(), gdy magistrala na pewno
// stoi). Zwraca true = pomiar z MAX17048, false = ADC na GPIO3.
inline bool batteryInit() {
    if (_batSource == _BAT_SRC_GAUGE) return true;

    // Wczesny test baterii w setup() jest przed inputBegin(), wiec magistrale
    // podnosimy sami. Drugie Wire.begin() w inputBegin() jest nieszkodliwe
    // (rdzen 2.0.x tylko loguje ostrzezenie).
    Wire.begin(I2C_SDA, I2C_SCL);
    Wire.setClock(400000);

    // ACK + poprawny odczyt VCELL. Nie sprawdzamy zakresu wartosci: tuz po
    // wlaczeniu zasilania gauge potrafi chwile zwracac 0, a nic innego nie
    // odpowiada pod 0x36 (MCP23017 = 0x20, OV2640 = 0x30).
    uint16_t raw;
    bool found = false;
    for (uint8_t i = 0; i < 3 && !found; i++) {
        if (i) delay(5);
        found = _batGaugeRead16(_BAT_REG_VCELL, raw);
    }

    if (found) {
        _batSource = _BAT_SRC_GAUGE;
        pinMode(BATTERY_CHRG_PIN, INPUT);    // pull-up 10k na PCB
        pinMode(BATTERY_VBUS_PIN, INPUT);
        _batGaugeRefresh();
        _batCacheTime = millis();
        Serial.printf("[BAT] MAX17048 wykryty: %u mV, %u%%\n", _batCachedMv, _batCachedPct);
    } else {
        _batSource = _BAT_SRC_ADC;
        Serial.println("[BAT] brak MAX17048 -> pomiar ADC (GPIO3)");
    }
    return found;
}

inline void _batEnsure() {
    if (_batSource == _BAT_SRC_UNKNOWN) batteryInit();
}

inline const char* batterySourceName() {
    _batEnsure();
    return _batSource == _BAT_SRC_GAUGE ? "MAX17048" : "ADC";
}

// Surowy odczyt ADC w milliVoltach (po skalibrowaniu fabrycznym) — wariant B.
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
// 0 = nieznane (brak baterii / nieudany odczyt) — watchdog w main.cpp to ignoruje.
inline uint16_t batteryReadMillivolts() {
    _batEnsure();
    uint32_t now = millis();
    if (_batCachedMv == 0 || (now - _batCacheTime) > BATTERY_CACHE_MS) {
        if (_batSource == _BAT_SRC_GAUGE) {
            _batGaugeRefresh();
        } else {
            _batCachedMv = batteryReadMillivoltsRaw();
        }
        _batCacheTime = now;
    }
    return _batCachedMv;
}

// Wariant A: procent prosto z fuel gauge (ModelGauge uwzglednia obciazenie).
// Wariant B: krzywa rozladowania LiPo (typowa, nieliniowa — napiecie spada
// szybciej przy koncu).
inline uint8_t batteryReadPercent() {
    uint16_t mv = batteryReadMillivolts();     // odswieza tez _batCachedPct
    if (_batSource == _BAT_SRC_GAUGE) return _batCachedPct;
    if (mv >= BATTERY_VMAX_MV) return 100;
    if (mv <= BATTERY_VMIN_MV) return 0;

    // Punkty kontrolne (mV, %) — interpolacja liniowa miedzy nimi.
    // Krzywa skalibrowana na typowy ogniwo LiPo 3.7V 1C discharge:
    //   Plateau 3.70-3.90V (~60% zakresu napiecia, ~70% pojemnosci)
    //   Kolano przy 3.65V (napięcie spada szybciej)
    //   Strefa krytyczna <3.35V (booster niestabilny)
    struct Pt { uint16_t mv; uint8_t pct; };
    static const Pt curve[] = {
        { 4200, 100 }, { 4100,  90 }, { 4000,  80 }, { 3900,  70 },
        { 3820,  60 }, { 3760,  52 }, { 3720,  45 }, { 3680,  37 },
        { 3650,  28 }, { 3620,  20 }, { 3580,  13 }, { 3520,   8 },
        { 3450,   5 }, { 3350,   2 }, { 3200,   1 }, { 3000,   0 },
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

// 0 / < BATTERY_PRESENT_MV = "nieznane" (brak baterii, nieudany odczyt) —
// to NIE jest niska bateria (inaczej ikonka migala "!" przy zasilaniu z USB).
inline bool batteryIsCritical() {
    uint16_t mv = batteryReadMillivolts();
    return mv >= BATTERY_PRESENT_MV && mv < BATTERY_CRITICAL_MV;
}

inline bool batteryIsLow() {
    uint16_t mv = batteryReadMillivolts();
    return mv >= BATTERY_PRESENT_MV && mv < BATTERY_LOW_MV;
}

inline bool batteryIsAvailable() {
    return true;
}

// ---------------------------------------------------------------------
// Wariant A: status ladowania wprost z pinow (bez zgadywania).
//   CHRG (GPIO3)       LOW  = MCP73831 laduje
//   VBUS_SENSE (GPIO38) HIGH = USB wpiete
//   USB wpiete + CHRG HIGH = naladowana; USB brak = zasilanie z baterii.
// ---------------------------------------------------------------------
inline bool batteryIsUsbPresent() {
    _batEnsure();
    return _batSource == _BAT_SRC_GAUGE && digitalRead(BATTERY_VBUS_PIN) == HIGH;
}

// ---------------------------------------------------------------------
// Wariant B: charging detection BEZ STAT pinu — slope detection + threshold.
//
// Idea: MCP73831 podnosi VBAT o ~0.05-0.15V powyzej napiecia spoczynkowego
// (po dzielniku 1:2 widac tylko polowe roznicy, ale to wciaz ~25-75mV).
// ADC ESP32-S3 ma ~15mV szumu po kalibracji, wiec uzywamy 60s okna —
// porownuje VBAT_now z VBAT_60s_ago.
//
// Dwa progi:
//   1) CV phase: VBAT > 4.18V => prawie zawsze ladowanie (MCP73831 trzyma 4.20V)
//   2) slope: wzrost o > 20mV w 60s => ladowanie
//   3) spadek o > 20mV w 60s => rozladowanie
//   4) flat => zostaw poprzedni stan (debounce, zeby nie skakalo)
// ---------------------------------------------------------------------
#define BATTERY_CHARGE_THRESH_MV  20
#define BATTERY_CV_PHASE_MV       4180

static uint16_t _batSlopeMv[5] = {0, 0, 0, 0, 0};
static uint8_t  _batSlopeIdx = 0;
static uint32_t _batSlopeLast = 0;
static bool     _batCharging = false;

inline bool batteryIsCharging() {
    _batEnsure();
    if (_batSource == _BAT_SRC_GAUGE) return digitalRead(BATTERY_CHRG_PIN) == LOW;

    uint32_t now = millis();
    uint16_t mv = batteryReadMillivolts();

    // Sampluj raz na 12s (5 sampli x 12s = 60s okno)
    if (_batSlopeLast == 0 || now - _batSlopeLast > 12000) {
        // Dluga przerwa w probkowaniu (uspienie, ekran bez batteryTick) —
        // stare probki pochodza z innego obciazenia, porownanie z nimi
        // dawaloby falszywe "laduje"/"nie laduje". Zacznij okno od nowa.
        if (_batSlopeLast != 0 && now - _batSlopeLast > 36000) {
            for (uint8_t i = 0; i < 5; i++) _batSlopeMv[i] = 0;
            _batSlopeIdx = 0;
        }
        _batSlopeLast = now;
        _batSlopeMv[_batSlopeIdx] = mv;
        _batSlopeIdx = (_batSlopeIdx + 1) % 5;

        // Najstarsza probka = ta na ktora wlasnie wskazuje idx
        uint16_t oldest = _batSlopeMv[_batSlopeIdx];

        if (mv >= BATTERY_CV_PHASE_MV) {
            _batCharging = true;
        } else if (oldest > 0 && (int32_t)mv - (int32_t)oldest > BATTERY_CHARGE_THRESH_MV) {
            _batCharging = true;
        } else if (oldest > 0 && (int32_t)oldest - (int32_t)mv > BATTERY_CHARGE_THRESH_MV) {
            _batCharging = false;
        }
        // else flat -> debounce: zostaw _batCharging
    }
    return _batCharging;
}

// Tylko wariant A (wymaga VBUS_SENSE) — w wariancie B zawsze false.
inline bool batteryIsChargeComplete() {
    return batteryIsUsbPresent() && !batteryIsCharging();
}

// Wolac czesto (power.h: powerCheckSleep). Wariant B zbiera probki do
// detekcji ladowania tylko gdy ktos wola batteryIsCharging() — bez tego
// okno 60 s bylo puste/nieaktualne i ekran baterii pokazywal stary stan.
// Tani no-op, dopoki nie minie 12 s od ostatniej probki.
inline void batteryTick() {
    _batEnsure();
    if (_batSource == _BAT_SRC_GAUGE) return;   // wariant A: status wprost z pinu CHRG
    if (_batSlopeLast != 0 && millis() - _batSlopeLast <= 12000) return;
    (void)batteryIsCharging();
}

#endif // !KALK_HW_LEGACY

#ifdef KALK_HW_LEGACY
inline bool batteryIsCharging() { return false; }
#endif

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

    // Mala "blyskawica" w srodku gdy ladowanie
    if (batteryIsCharging()) {
        // Wyczysc wypelnienie i narysuj zygzak (inwersja)
        d.setDrawColor(0);
        d.drawVLine(X + 7, Y + 1, 3);
        d.drawVLine(X + 8, Y + 4, 3);
        d.setDrawColor(1);
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
