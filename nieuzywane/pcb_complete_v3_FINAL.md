# ESP32-WROVER-E — KOMPLETNY PRZEWODNIK POŁĄCZEŃ I ROZMIESZCZENIA PCB

## Wersja 3.0 FINAL — wszystkie korekty z erraty v2.1 naniesione

> Ten dokument jest JEDYNYM obowiązującym źródłem prawdy.
> Zastępuje: gpio_plan_v2.md + gpio_plan_errata_v2.1.md
> Data: 2026-02-15

---

## SPIS TREŚCI

1. [Przegląd projektu](#1-przegląd-projektu)
2. [GPIO ESP32 — ograniczenia i finalne przypisanie](#2-gpio)
3. [OLED SSD1322 — połączenia FFC 30-pin](#3-oled-ffc)
4. [OLED SSD1322 — zasilanie (4 szyny)](#4-oled-zasilanie)
5. [Boost converter MT3608 — schemat](#5-boost)
6. [Kamera OV2640 — połączenia FFC 24-pin](#6-kamera-ffc)
7. [Kamera OV2640 — zasilanie (3 szyny + LDO)](#7-kamera-zasilanie)
8. [MCP23017 — ekspander I2C](#8-mcp23017)
9. [I2C Bus — magistrala współdzielona](#9-i2c)
10. [Klawiatura matrycowa 5×5](#10-klawiatura)
11. [Sekwencja włączania zasilania](#11-sekwencja)
12. [Rozmieszczenie komponentów na PCB](#12-placement)
13. [Zasady routingu PCB](#13-routing)
14. [BOM — kompletna lista komponentów](#14-bom)
15. [Uwagi końcowe i pułapki](#15-uwagi)

---

## 1. Przegląd projektu {#1-przegląd-projektu}

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ESP32-WROVER-E                               │
│                                                                     │
│   ┌──────────┐    SPI (3 linie + 2 ctrl)    ┌────────────────────┐ │
│   │   OLED   │◄────────────────────────────── │                    │ │
│   │ SSD1322  │    GPIO 18,23,2,4,15          │                    │ │
│   │ 256×64   │                                │    ESP32-WROVER-E  │ │
│   │ bare glass│                               │                    │ │
│   └──────────┘                                │    GPIO 21/22      │ │
│   FFC 30-pin                                  │    (I2C bus)       │ │
│   0.5mm                                       │         │          │ │
│                                               │         │          │ │
│   ┌──────────┐    8-bit parallel (14 linii)  │         │          │ │
│   │  Kamera  │◄────────────────────────────── │         │          │ │
│   │ OV2640   │    GPIO 5,12,13,14,19,        │         │          │ │
│   │          │    25,26,27,32,33,34,35        │         │          │ │
│   └──────────┘                                └─────────┼──────────┘ │
│   FFC 24-pin                                            │            │
│   0.5mm                                                 │ I2C       │
│                                                         │            │
│   ┌──────────┐    I2C (adres 0x20)                     │            │
│   │ MCP23017 │◄─────────────────────────────────────────┘            │
│   │ ekspander│                                                       │
│   │ I/O ×16  │──→ Klawiatura 5×5 (10 pinów)                        │
│   │          │──→ Kamera PWDN/RESET (2 piny)                        │
│   │          │──→ Boost EN, LED, buzzer (3 piny)                    │
│   └──────────┘                                                       │
│                                                                      │
│   ┌──────────┐    3.3V → 12-15V                                    │
│   │  MT3608  │──→ VCC panel OLED                                    │
│   │  Boost   │    Sterowany z MCP23017 GPA7 (EN)                    │
│   └──────────┘                                                       │
│                                                                      │
│   ┌──────────┐    3.3V → 2.8V        ┌──────────┐  3.3V → 1.3V    │
│   │AP2112K   │──→ AVDD + DOVDD       │XC6206P132│──→ DVDD kamery   │
│   │LDO 2.8V  │    kamery              │LDO 1.3V  │                  │
│   └──────────┘                        └──────────┘                   │
└─────────────────────────────────────────────────────────────────────┘
```

**Komponenty główne:**
- ESP32-WROVER-E (WiFi + BT + 8MB PSRAM)
- OLED 3.12" 256×64 SSD1322 (bare glass, COF na taśmie FFC)
- Kamera OV2640 (moduł z FFC 24-pin)
- MCP23017-E/SO (ekspander I2C 16-bit, SOIC-28)
- Klawiatura matrycowa 5×5 (25 klawiszy)

---

## 2. GPIO ESP32 — ograniczenia i finalne przypisanie {#2-gpio}

### 2.1 Piny ZAKAZANE (nigdy nie używać):

| GPIO | Powód |
|------|-------|
| 1, 3 | TX0/RX0 — UART programowanie |
| 6, 7, 8, 9, 10, 11 | Flash SPI — wewnętrzne |
| 16, 17 | PSRAM — zajęte na WROVER-E |
| 36, 39 | Input-only + glitche hall sensor — NIESTABILNE |
| 37, 38 | Nie wyprowadzone na module |

### 2.2 Strapping pins (używamy, ale ostrożnie):

| GPIO | Wymagany stan przy boot | Nasze użycie | Bezpieczeństwo |
|------|------------------------|--------------|----------------|
| 0 | HIGH (wew. pullup) | **NIE UŻYWAMY** | — |
| 2 | LOW (wew. pulldown) | OLED DC# | ✅ OLED nie wymusza stanu |
| 5 | HIGH (wew. pullup) | Kamera D0 | ✅ input po boot |
| 12 | LOW (wew. pulldown) | Kamera PCLK | ✅ input, nie ciągnie HIGH |
| 15 | HIGH (wew. pullup) | OLED CS# | ✅ CS# idle = HIGH |

### 2.3 FINALNE PRZYPISANIE GPIO:

```
┌──────┬───────────────┬────────────────────┬──────────┐
│ GPIO │ Urządzenie    │ Sygnał             │ Kierunek │
├──────┼───────────────┼────────────────────┼──────────┤
│  2   │ OLED SSD1322  │ DC# (Data/Command) │ OUTPUT   │
│  4   │ OLED SSD1322  │ RES# (Reset)       │ OUTPUT   │
│  5   │ Kamera OV2640 │ D0 (Y2)            │ INPUT    │
│ 12   │ Kamera OV2640 │ PCLK               │ INPUT    │
│ 13   │ Kamera OV2640 │ D3 (Y5)            │ INPUT    │
│ 14   │ Kamera OV2640 │ D1 (Y3)            │ INPUT    │
│ 15   │ OLED SSD1322  │ CS# (Chip Select)  │ OUTPUT   │
│ 18   │ OLED SSD1322  │ SCLK (HW VSPI)     │ OUTPUT   │
│ 19   │ Kamera OV2640 │ D2 (Y4)            │ INPUT    │
│ 21   │ I2C Bus       │ SDA                │ I/O      │
│ 22   │ I2C Bus       │ SCL                │ OUTPUT   │
│ 23   │ OLED SSD1322  │ MOSI (HW VSPI)     │ OUTPUT   │
│ 25   │ Kamera OV2640 │ XCLK (20MHz LEDC)  │ OUTPUT   │
│ 26   │ Kamera OV2640 │ HREF               │ INPUT    │
│ 27   │ Kamera OV2640 │ VSYNC              │ INPUT    │
│ 32   │ Kamera OV2640 │ D6 (Y8)            │ INPUT    │
│ 33   │ Kamera OV2640 │ D7 (Y9)            │ INPUT    │
│ 34   │ Kamera OV2640 │ D4 (Y6)            │ INPUT *  │
│ 35   │ Kamera OV2640 │ D5 (Y7)            │ INPUT *  │
└──────┴───────────────┴────────────────────┴──────────┘
  * GPIO 34, 35 = input-only (brak pullup wewnętrznego)

Użyto: 19 z 19 dostępnych GPIO.
Wolne: 0 (GPIO 0 zarezerwowany na boot, nie przypisany).
```

---

## 3. OLED SSD1322 — połączenia FFC 30-pin {#3-oled-ffc}

**Złącze:** Molex 505110-3091 (30-pin, 0.5mm pitch, ZIF, bottom contact)
**Tryb:** 4-wire SPI (BS0=GND, BS1=GND)
**Sterownik:** COF na taśmie (chip SSD1322 zalany żywicą na FFC)

> ⚠️ Jeśli moduł przyszedł w trybie 8080 parallel (fabryczny) —
> musisz przestawić rezystory 0Ω BS0/BS1 na taśmie na pozycje "00".

### 3.1 Tabela połączeń — KAŻDY pin FFC:

```
┌─────┬────────────────┬──────────────────────────────────────────────┐
│ Pin │ Sygnał         │ Podłączenie na PCB                          │
├─────┼────────────────┼──────────────────────────────────────────────┤
│  1  │ N.C. (GND)     │ GND                                         │
│  2  │ VSS            │ GND                                         │
│  3  │ VCC            │ 12-15V (z boost MT3608) ─── SZYNA "VCC_OLED"│
│  4  │ VCOMH          │ 4.7µF do GND                                │
│  5  │ VLSS           │ GND                                         │
│  6  │ D7             │ GND (nie używane w SPI)                     │
│  7  │ D6             │ GND                                         │
│  8  │ D5             │ GND                                         │
│  9  │ D4             │ GND                                         │
│ 10  │ D3             │ GND                                         │
│ 11  │ D2             │ GND                                         │
│ 12  │ D1 → SDIN      │ GPIO 23 (MOSI) ──── sygnał SPI             │
│ 13  │ D0 → SCLK      │ GPIO 18 (SCLK) ──── sygnał SPI             │
│ 14  │ E/RD#          │ GND ─── KRYTYCZNE! (nie VCC!)               │
│ 15  │ R/W# (WR#)     │ GND                                         │
│ 16  │ BS0            │ GND (= tryb 4-wire SPI)                     │
│ 17  │ BS1            │ GND (= tryb 4-wire SPI)                     │
│ 18  │ DC#            │ GPIO 2 ──── sygnał Data/Command             │
│ 19  │ CS#            │ GPIO 15 ──── sygnał Chip Select             │
│ 20  │ RES#           │ GPIO 4 ──── sygnał Reset (active LOW)       │
│ 21  │ FR             │ NC (niepodłączony)                           │
│ 22  │ IREF           │ 910kΩ do GND ──── ustawia prąd segmentów   │
│ 23  │ N.C.           │ NC (niepodłączony)                           │
│ 24  │ VDDIO          │ 3.3V + 10µF + 100nF do GND ── SZYNA "3V3"  │
│ 25  │ VDD            │ 1µF do GND (wew. regulator ~2.5V)           │
│ 26  │ VCI            │ 3.3V + 1µF + 100nF do GND ─── SZYNA "3V3"  │
│ 27  │ VSL            │ NC (niepodłączony!) ── NIE podłączaj do GND! │
│ 28  │ VLSS           │ GND                                         │
│ 29  │ VCC            │ 12-15V (z boost MT3608) ─── SZYNA "VCC_OLED"│
│ 30  │ N.C. (GND)     │ GND                                         │
└─────┴────────────────┴──────────────────────────────────────────────┘
```

### 3.2 Schemat podłączenia SPI do ESP32:

```
ESP32-WROVER-E                              FFC 30-pin OLED
                                            (złącze Molex 505110-3091)
GPIO 18 (VSPI CLK)  ──────────────────────→ Pin 13 (D0/SCLK)
GPIO 23 (VSPI MOSI) ──────────────────────→ Pin 12 (D1/SDIN)
GPIO 15             ──────────────────────→ Pin 19 (CS#)
GPIO 2              ──────────────────────→ Pin 18 (DC#)
GPIO 4              ──────────────────────→ Pin 20 (RES#)

Piny stałe (na PCB, nie do ESP32):
Pin 14 (E/RD#)  → GND
Pin 15 (R/W#)   → GND
Pin 16 (BS0)    → GND
Pin 17 (BS1)    → GND
Pin 6-11 (D2-D7)→ GND
```

---

## 4. OLED SSD1322 — zasilanie (4 szyny) {#4-oled-zasilanie}

### 4.1 Schemat zasilania OLED:

```
                         3.3V (z ESP32 / regulatora płytki)
                           │
           ┌───────────────┼────────────────┐
           │               │                │
     ┌─────┴─────┐   ┌────┴────┐     ┌─────┴─────┐
     │[10µF][100nF]│  │[1µF][100nF]│  │  [1µF]    │
     │     │     │  │    │    │     │     │      │
     │    GND    │  │   GND   │     │    GND     │
     └───────────┘  └─────────┘     └────────────┘
           │               │                │
      Pin 24 VDDIO    Pin 26 VCI       Pin 25 VDD
      (logika SPI)     (analog)        (wew. reg. ~2.5V)
                                       Włączony komendą ABh A[0]=1


     Pin 22 IREF:                    Pin 4 VCOMH:
     ────────┐                       ────────┐
          [910kΩ]                         [4.7µF]
             │                               │
            GND                             GND


     Pin 27 VSL:
     ──── NC (OTWARTY! Nie podłączaj!)
     Używamy wewnętrzny VSL.


     Pin 3, 29 VCC:
     ────────── 12-15V (z boost convertera MT3608)
                Patrz sekcja 5.
```

### 4.2 Tabela kondensatorów OLED:

| Pin FFC | Sygnał | Kondensator | Odległość od pinu |
|---------|--------|-------------|-------------------|
| 24 | VDDIO | **10µF + 100nF** ceramika | ≤5mm |
| 26 | VCI | 1µF + 100nF ceramika | ≤5mm |
| 25 | VDD | 1µF ceramika | ≤5mm |
| 4 | VCOMH | 4.7µF ceramika | ≤5mm |
| 22 | IREF | 910kΩ rezystor do GND | ≤10mm |

### 4.3 Rezystor IREF — obliczenie:

```
IREF = (VCC - 3V) / R

Dla VCC = 12V:  R = 9V / 10µA = 900kΩ  → użyj 910kΩ (E24)  → IREF ≈ 9.9µA ✅
Dla VCC = 15V:  R = 12V / 10µA = 1.2MΩ → użyj 1.2MΩ (E24) → IREF = 10µA  ✅

Zakres tolerancji IREF: 10µA ± 2µA (8-12µA OK)
```

---

## 5. Boost converter MT3608 — schemat {#5-boost}

### 5.1 Cel: 3.3V → 12V (lub 15V) dla panelu OLED

**IC:** MT3608 (SOT-23-6), switching ~1.2MHz, Vout do 28V, 2A switch

### 5.2 Schemat połączeń:

```
                    MT3608 (SOT-23-6)
                  ┌──────────────────┐
                  │    ┌────────┐    │
    3.3V ─────────┤IN  │MT3608 │ SW ├───┐
                  │    │       │    │   │
    MCP23017 ─────┤EN  │       │ GND├───┤── GND
    GPA7          │    │       │    │   │
                  │    │       │ FB ├───┤── dzielnik napięcia
                  │    └────────┘    │   │
                  └──────────────────┘   │
                                         │
    Schemat zewnętrzny:                  │
                                         │
    3.3V ──┬──[L 22µH]──────────────── SW│(pin 4)
           │                              │
        [100µF]                      [SS14 Schottky]
        ceramika                          │
           │                              ├──── VCC_OLED (12-15V)
          GND                             │     → do FFC pin 3 i 29
                                       [22µF]
                                       ceramika
                                          │
                                         GND

    Dzielnik FB (pin 3 MT3608):

    VCC_OLED ──[R1]──┬──[R2]── GND
                      │
                     FB (pin 3)

    Vout = 0.6V × (1 + R1/R2)

    ┌──────────────┬──────────┬──────────┐
    │ Vout żądane   │ R1       │ R2       │
    ├──────────────┼──────────┼──────────┤
    │ 12V           │ 380kΩ    │ 20kΩ     │
    │ 15V           │ 480kΩ    │ 20kΩ     │
    └──────────────┴──────────┴──────────┘
```

### 5.3 Pinout MT3608:

```
       ┌───────────┐
 IN  1─┤           ├─6 OUT (N.C. — wewnętrzny)
 GND 2─┤  MT3608   ├─5 EN
 FB  3─┤           ├─4 SW
       └───────────┘

Pin 1 (IN):  3.3V
Pin 2 (GND): GND
Pin 3 (FB):  Dzielnik napięcia (środek R1/R2)
Pin 4 (SW):  Induktor 22µH → 3.3V, Dioda SS14 → VCC_OLED
Pin 5 (EN):  MCP23017 GPA7 (sterowanie ON/OFF) lub 3.3V (zawsze ON)
Pin 6 (OUT): NC (nie podłączaj — pin wewnętrzny!)
```

### 5.4 Lista części boost:

| Komponent | Wartość | Obudowa | Uwagi |
|-----------|---------|---------|-------|
| L1 | 22µH, ≥1A | 1210 lub 4x4mm | Shielded preferred |
| D1 | SS14 (1A 40V Schottky) | SMA | Musi być Schottky! |
| C_in | 100µF ceramika | 1206 | Blisko IN/GND MT3608 |
| C_out | 22µF ceramika | 0805-1206 | Blisko wyjścia, ≥25V rating |
| R1 | 380kΩ (12V) lub 480kΩ (15V) | 0603 | Dzielnik FB → Vout |
| R2 | 20kΩ | 0603 | Dzielnik FB → GND |

---

## 6. Kamera OV2640 — połączenia FFC 24-pin {#6-kamera-ffc}

**Złącze:** Molex 505110-2491 (24-pin, 0.5mm pitch, ZIF, bottom contact)
**Interfejs danych:** 8-bit parallel (D0-D7 + PCLK + VSYNC + HREF)
**Interfejs konfiguracji:** I2C/SCCB (adres 0x30)
**Zegar:** XCLK 20MHz z ESP32 LEDC PWM

> ⚠️ WAŻNE: Pinout FFC 24-pin RÓŻNI SIĘ między producentami modułów!
> Poniższy układ to TYPOWY pinout. ZWERYFIKUJ z datasheet TWOJEGO modułu!
> Użyj multimetru w trybie ciągłości aby potwierdzić mapowanie.

### 6.1 Tabela połączeń FFC 24-pin kamery:

```
┌─────┬────────────┬──────────────────────────────────────────────────┐
│ Pin │ Sygnał     │ Podłączenie                                     │
├─────┼────────────┼──────────────────────────────────────────────────┤
│  1  │ GND        │ GND                                              │
│  2  │ DOVDD      │ 2.8V (z LDO AP2112K-2.8) + 10µF + 100nF        │
│  3  │ SDA        │ GPIO 21 ── magistrala I2C                       │
│  4  │ SCL        │ GPIO 22 ── magistrala I2C                       │
│  5  │ VSYNC      │ GPIO 27                                          │
│  6  │ HREF       │ GPIO 26                                          │
│  7  │ PCLK       │ GPIO 12                                          │
│  8  │ XCLK       │ GPIO 25 (LEDC PWM 20MHz)                        │
│  9  │ D7         │ GPIO 33                                          │
│ 10  │ D6         │ GPIO 32                                          │
│ 11  │ D5         │ GPIO 35 (input-only)                             │
│ 12  │ D4         │ GPIO 34 (input-only)                             │
│ 13  │ D3         │ GPIO 13                                          │
│ 14  │ D2         │ GPIO 19                                          │
│ 15  │ D1         │ GPIO 14                                          │
│ 16  │ D0         │ GPIO 5                                           │
│ 17  │ RESET      │ MCP23017 GPA6 (+ pullup 10kΩ do 2.8V)          │
│ 18  │ PWDN       │ MCP23017 GPA5 (HIGH = power down)               │
│ 19  │ GND        │ GND                                              │
│ 20  │ AVDD       │ 2.8V (z LDO AP2112K-2.8) + 10µF + 100nF        │
│ 21  │ DVDD       │ 1.3V (z LDO XC6206P132MR) + 1µF + 100nF        │
│ 22  │ GND        │ GND                                              │
│ 23  │ N.C.       │ NC                                               │
│ 24  │ N.C.       │ NC                                               │
└─────┴────────────┴──────────────────────────────────────────────────┘
```

### 6.2 Mapowanie sygnałów kamery na ESP32:

```
ESP32-WROVER-E                    OV2640 (FFC 24-pin)

GPIO 5  (strapping!) ────────────→ D0  (Y2)   dane pikseli bit 0
GPIO 14              ────────────→ D1  (Y3)
GPIO 19              ────────────→ D2  (Y4)
GPIO 13              ────────────→ D3  (Y5)
GPIO 34  (input-only)────────────→ D4  (Y6)
GPIO 35  (input-only)────────────→ D5  (Y7)
GPIO 32              ────────────→ D6  (Y8)
GPIO 33              ────────────→ D7  (Y9)   dane pikseli bit 7

GPIO 12  (strapping!) ───────────→ PCLK       zegar pikseli (input)
GPIO 25              ────────────→ XCLK       zegar master 20MHz (output)
GPIO 27              ────────────→ VSYNC      synchronizacja pionowa
GPIO 26              ────────────→ HREF       synchronizacja pozioma

GPIO 21              ────────────→ SDA        I2C/SCCB konfiguracja
GPIO 22              ────────────→ SCL        I2C/SCCB konfiguracja

MCP23017 GPA5        ────────────→ PWDN       power down (HIGH=off)
MCP23017 GPA6        ──┬─────────→ RESET      reset (LOW=reset)
                       [10kΩ]
                        │
                       2.8V (DOVDD)
```

---

## 7. Kamera OV2640 — zasilanie (3 szyny + LDO) {#7-kamera-zasilanie}

### 7.1 Szyny zasilania kamery:

```
┌────────┬───────────┬───────────┬───────────────────────────────────┐
│ Szyna  │ Napięcie  │ Prąd max  │ Opis                             │
├────────┼───────────┼───────────┼───────────────────────────────────┤
│ AVDD   │ 2.8V      │ ~25mA     │ Analog (sensor obrazu)           │
│ DOVDD  │ 2.8V      │ ~15mA     │ Digital I/O (interfejs)          │
│ DVDD   │ 1.3V      │ ~40mA     │ Digital core (DSP, SRAM)         │
└────────┴───────────┴───────────┴───────────────────────────────────┘

AVDD i DOVDD = wspólne 2.8V (jeden LDO AP2112K-2.8, 600mA max)
DVDD = osobne 1.3V (LDO XC6206P132MR, 200mA max)
```

### 7.2 Schemat zasilania kamery:

```
    3.3V (z ESP32)
      │
      ├──────────────────────────────────────────────┐
      │                                              │
   [1µF]  ← bypass wejściowy LDO                 [1µF]  ← bypass wejściowy LDO
      │                                              │
  ┌───┴───────────┐                             ┌────┴──────────┐
  │ AP2112K-2.8   │                             │ XC6206P132MR  │
  │ IN        OUT─┤                             │ IN        OUT─┤
  │ GND   EN(3.3V)│                             │ GND           │
  └───┬───────┬───┘                             └───┬───────┬───┘
      │       │                                     │       │
     GND      │                                    GND      │
              │                                             │
         ┌────┴────[FB 600Ω]────┐                      ┌────┴────┐
         │    (opcjonalny)      │                      │         │
         │                      │                   [1µF]    [100nF]
    ┌────┴────┐            ┌────┴────┐                 │         │
 [10µF]   [100nF]      [10µF]   [100nF]              GND       GND
    │         │            │         │                      │
   GND       GND          GND      GND                     │
    │         │            │         │                      │
    ├─────────┘            ├─────────┘                      │
    │                      │                                │
    └──→ AVDD              └──→ DOVDD                       └──→ DVDD
    (FFC pin 20)           (FFC pin 2)                      (FFC pin 21)
         kamera                 kamera                       kamera
```

### 7.3 Ferrite bead (opcjonalny ale zalecany):

```
Między wyjściem LDO 2.8V a rozgałęzieniem AVDD/DOVDD:

LDO OUT ──[FB 600Ω@100MHz]──┬── AVDD (+ 10µF + 100nF)
                              │
                              └── DOVDD (+ 10µF + 100nF)

Rekomendowany: BLM18PG601SN1 (Murata) — 0603, 600Ω @ 100MHz
Tłumi szum HF z boost convertera MT3608 i WiFi ESP32.
```

### 7.4 Tabela LDO kamery:

| LDO | Vout | Imax | Obudowa | Part Number |
|-----|------|------|---------|-------------|
| LDO 2.8V | 2.8V | 600mA | SOT-23-5 | **AP2112K-2.8TRG1** |
| LDO 1.3V | 1.3V | 200mA | SOT-23 | **XC6206P132MR** |

### 7.5 Pinout AP2112K-2.8 (SOT-23-5):

```
       ┌───────────┐
 VIN 1─┤           ├─5 EN (→ 3.3V = zawsze ON)
 GND 2─┤ AP2112K   ├─4 N.C.
VOUT 3─┤           │
       └───────────┘
```

### 7.6 Pinout XC6206P132MR (SOT-23):

```
       ┌───────────┐
 VSS 1─┤           ├─3 VIN
VOUT 2─┤ XC6206    │
       └───────────┘
```

---

## 8. MCP23017 — ekspander I2C {#8-mcp23017}

**IC:** MCP23017-E/SO (SOIC-28)
**Adres I2C:** 0x20 (A0=A1=A2=GND)
**Zasilanie:** 3.3V

### 8.1 Schemat podłączenia MCP23017:

```
                         MCP23017-E/SO (SOIC-28)
                    ┌──────────────────────────────┐
                    │         ┌──────────┐         │
    GPB0 ← Col 0 ──┤1  GPB0  │          │ GPA7  28├── Boost EN (MT3608)
    GPB1 ← Col 1 ──┤2  GPB1  │          │ GPA6  27├── Kamera RESET#
    GPB2 ← Col 2 ──┤3  GPB2  │          │ GPA5  26├── Kamera PWDN
    GPB3 ← Col 3 ──┤4  GPB3  │          │ GPA4  25├── Row 4 klawiatury
    GPB4 ← Col 4 ──┤5  GPB4  │          │ GPA3  24├── Row 3 klawiatury
    GPB5 ← LED     ─┤6  GPB5  │ MCP23017 │ GPA2  23├── Row 2 klawiatury
    GPB6 ← Buzzer  ─┤7  GPB6  │          │ GPA1  22├── Row 1 klawiatury
    GPB7 ← Spare   ─┤8  GPB7  │          │ GPA0  21├── Row 0 klawiatury
    3.3V ───────────┤9  VDD   │          │ INTA  20├── NC (opcja: GPIO 33)
    GND ────────────┤10 VSS   │          │ INTB  19├── NC
    (NC) ───────────┤11 N.C.  │          │ RESET#18├── 3.3V + 100nF do GND
    GPIO 22 (SCL) ──┤12 SCL   │          │ A2    17├── GND
    GPIO 21 (SDA) ──┤13 SDA   │          │ A1    16├── GND
    (NC) ───────────┤14 N.C.  │          │ A0    15├── GND
                    │         └──────────┘         │
                    └──────────────────────────────┘

    Bypass: 100nF + 10µF między pin 9 (VDD) a pin 10 (VSS)
    RESET#: 3.3V (pullup, zawsze aktywny) + 100nF filtr do GND
```

### 8.2 Przypisanie portów MCP23017:

```
PORT A (GPA0-GPA7) — konfiguracja: OUTPUT
┌──────┬─────────────────────────────────────────────┐
│ Pin  │ Funkcja                                     │
├──────┼─────────────────────────────────────────────┤
│ GPA0 │ Klawiatura ROW 0 (output, skanowanie)       │
│ GPA1 │ Klawiatura ROW 1 (output)                   │
│ GPA2 │ Klawiatura ROW 2 (output)                   │
│ GPA3 │ Klawiatura ROW 3 (output)                   │
│ GPA4 │ Klawiatura ROW 4 (output)                   │
│ GPA5 │ Kamera PWDN (output, HIGH = power down)     │
│ GPA6 │ Kamera RESET# (output, LOW = reset)         │
│ GPA7 │ Boost MT3608 EN (output, HIGH = VCC ON)     │
└──────┴─────────────────────────────────────────────┘

PORT B (GPB0-GPB7) — konfiguracja: INPUT z wewn. pullup
┌──────┬─────────────────────────────────────────────┐
│ Pin  │ Funkcja                                     │
├──────┼─────────────────────────────────────────────┤
│ GPB0 │ Klawiatura COL 0 (input + pullup wewn.)     │
│ GPB1 │ Klawiatura COL 1 (input + pullup)           │
│ GPB2 │ Klawiatura COL 2 (input + pullup)           │
│ GPB3 │ Klawiatura COL 3 (input + pullup)           │
│ GPB4 │ Klawiatura COL 4 (input + pullup)           │
│ GPB5 │ 🆓 LED status (output, przez rezystor)      │
│ GPB6 │ 🆓 Buzzer (output, przez N-MOSFET)          │
│ GPB7 │ 🆓 Zapasowy                                 │
└──────┴─────────────────────────────────────────────┘
```

---

## 9. I2C Bus — magistrala współdzielona {#9-i2c}

### 9.1 Urządzenia na magistrali:

```
                    3.3V
                     │
                 [4.7kΩ] [4.7kΩ]    ← pullup BLISKO ESP32 (≤5mm)
                     │       │
    GPIO 21 (SDA) ───┴───────┤───────┬──────────┬── SDA
                             │       │          │
    GPIO 22 (SCL) ───────────┴───────┤──────────┤── SCL
                                     │          │
                              ┌──────┴───┐ ┌────┴──────┐
                              │ MCP23017 │ │  OV2640   │
                              │ addr 0x20│ │ addr 0x30 │
                              └──────────┘ │ (SCCB)    │
                                           └───────────┘

    Pullup: 4.7kΩ do 3.3V (NIE do 2.8V!)
    Prędkość: 400kHz (Fast Mode)
    Długość linii: max 30cm (im krócej tym lepiej)
```

### 9.2 Uwagi I2C:

- Pullup 4.7kΩ umieść **blisko ESP32** (nie blisko MCP23017 czy kamery)
- Adresy 0x20 i 0x30 — brak konfliktu ✅
- OV2640 używa SCCB (kompatybilny z I2C, ale bez clock stretching)
- Jeśli I2C się zawiesza → dodaj 100nF ceramikę na SDA i SCL do GND
  (blisko każdego urządzenia slave) jako filtr EMI

---

## 10. Klawiatura matrycowa 5×5 {#10-klawiatura}

### 10.1 Schemat matrycy:

```
                COL0    COL1    COL2    COL3    COL4
                GPB0    GPB1    GPB2    GPB3    GPB4
                 │       │       │       │       │
    ROW0 GPA0 ───┼───[K]─┼───[K]─┼───[K]─┼───[K]─┼───[K]
                 │       │       │       │       │
    ROW1 GPA1 ───┼───[K]─┼───[K]─┼───[K]─┼───[K]─┼───[K]
                 │       │       │       │       │
    ROW2 GPA2 ───┼───[K]─┼───[K]─┼───[K]─┼───[K]─┼───[K]
                 │       │       │       │       │
    ROW3 GPA3 ───┼───[K]─┼───[K]─┼───[K]─┼───[K]─┼───[K]
                 │       │       │       │       │
    ROW4 GPA4 ───┼───[K]─┼───[K]─┼───[K]─┼───[K]─┼───[K]
                 │       │       │       │       │

    [K] = przycisk tact switch (normalnie otwarty)

    Skanowanie:
    1. Ustaw GPA0 = LOW, GPA1-4 = HIGH
    2. Odczytaj GPB0-4 (pullup wewnętrzny MCP23017)
    3. Jeśli GPBx = LOW → klawisz wciśnięty w ROW0, COLx
    4. Powtórz dla GPA1, GPA2... itd.

    Diody zabezpieczające (opcjonalnie, dla N-key rollover):
    Dodaj diodę 1N4148 w szereg z każdym klawiszem
    (katoda od strony ROW).
```

### 10.2 Opcjonalny LED status i buzzer:

```
    GPB5 (LED):
    GPB5 ──[330Ω]──[LED]── GND
    (prąd: ~10mA przy 3.3V, MCP23017 source max 25mA/pin)

    GPB6 (Buzzer przez N-MOSFET):
    GPB6 ──[10kΩ]── Gate ┐
                          │ N-MOSFET (np. 2N7002)
    3.3V ──[Buzzer]──── Drain │
                        Source── GND
    (MCP23017 pin max 25mA — za mało dla buzzera, dlatego MOSFET)
```

---

## 11. Sekwencja włączania zasilania {#11-sekwencja}

### 11.1 Kolejność (KRYTYCZNA!):

```
t=0ms     Włącz 3.3V (główne zasilanie ESP32)
          → automatycznie startują LDO 2.8V i 1.3V (kamera)
          → automatycznie startują VDDIO, VCI (OLED logika)
          → VDD SSD1322 reguluje się wewnętrznie z VCI
          │
t=1ms     Poczekaj min 1ms (VDD wewnętrzny SSD1322 stabilizuje)
          │
t=2ms     RES# OLED → LOW (GPIO 4 = LOW)
          │
t=2.2ms   Trzymaj RES# LOW przez MINIMUM 100µs (nie 3µs!!!)
          Bezpiecznie: 200µs
          │
t=2.4ms   RES# OLED → HIGH (GPIO 4 = HIGH)
          │
t=2.6ms   Poczekaj min 100µs po RES# HIGH
          │
t=3ms     Włącz VCC 12V (MCP23017 GPA7 → HIGH → EN boost MT3608)
          │
t=50ms    VCC ustabilizowane
          │
t=55ms    Wyślij komendy inicjalizacyjne SSD1322:
          • ABh (VDD regulator enable)
          • A0h/A1h (re-map)
          • Kontrast, multiplex, itp.
          • AFh (Display ON)
          │
t=60ms    OLED gotowy. Inicjalizuj kamerę (esp_camera_init).
          │
t=100ms   System gotowy. Skanuj klawiaturę.
```

### 11.2 Sekwencja wyłączania:

```
1. Komenda AEh (Display OFF)
2. Wyłącz VCC (MCP23017 GPA7 → LOW → EN boost OFF)
3. Poczekaj 100ms
4. Opcjonalnie: PWDN kamery HIGH (MCP23017 GPA5 → HIGH)
5. ESP32 deep sleep (lub wyłącz 3.3V)

⚠️ NIGDY nie ściągaj VCC do GND! Boost OFF = VCC floating (OK).
```

---

## 12. Rozmieszczenie komponentów na PCB {#12-placement}

### 12.1 Mapa stref PCB (widok z góry):

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│   STREFA A: BOOST MT3608              STREFA B: ESP32-WROVER-E  │
│   ┌─────────────────────┐             ┌──────────────────────┐  │
│   │                     │             │                      │  │
│   │  MT3608   L1  D1    │             │   ESP32-WROVER-E     │  │
│   │  C_in    C_out      │             │   (moduł)            │  │
│   │  R1  R2             │             │                      │  │
│   │                     │             │   Antena WiFi →      │  │
│   │  ⚡ GND POLYGON     │             │   (nie blokować!)    │  │
│   │  (osobny, 1-point   │             │                      │  │
│   │   connect do main)  │             └──────────────────────┘  │
│   └─────────────────────┘                     │                  │
│          │ VCC_OLED (12V)                     │ GPIO             │
│          │                                    │                  │
│   STREFA C: OLED FFC + bypass        STREFA D: LDO kamery      │
│   ┌─────────────────────┐             ┌──────────────────────┐  │
│   │                     │             │                      │  │
│   │  [FFC 30-pin ZIF]   │             │  AP2112K   XC6206    │  │
│   │                     │             │  (2.8V)    (1.3V)    │  │
│   │  C_VDDIO  C_VCI     │             │  C_in/out  C_in/out  │  │
│   │  C_VDD    C_VCOMH   │             │  FB (opcja)          │  │
│   │  R_IREF             │             │                      │  │
│   │                     │             └──────────────────────┘  │
│   └─────────────────────┘                     │ 2.8V / 1.3V    │
│                                               │                  │
│   STREFA E: KAMERA FFC + bypass      STREFA F: MCP23017        │
│   ┌─────────────────────┐             ┌──────────────────────┐  │
│   │                     │             │                      │  │
│   │  [FFC 24-pin ZIF]   │             │  MCP23017 (SOIC-28)  │  │
│   │                     │             │  C_bypass (100nF+10µF)│  │
│   │  C_AVDD  C_DOVDD    │             │  R_pullup I2C        │  │
│   │  C_DVDD             │             │                      │  │
│   │                     │             └──────────────────────┘  │
│   └─────────────────────┘                     │                  │
│                                               │                  │
│   STREFA G: KLAWIATURA                        │                  │
│   ┌───────────────────────────────────────────┘                  │
│   │  5×5 tact switches + opcja diody 1N4148                     │
│   │  LED + rezystor, Buzzer + MOSFET                            │
│   └─────────────────────────────────────────────────────────────┘
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 12.2 Zasady rozmieszczenia:

**STREFA A — Boost MT3608 (IZOLOWANA):**
- Umieść w ROGU PCB, najdalej od kamery i ESP32
- Induktor L1, dioda D1, MT3608 — trójkąt z krótkimi ścieżkami
- Osobny GND polygon, połączony z głównym GND w JEDNYM punkcie
- C_in (100µF) bezpośrednio przy IN/GND MT3608
- C_out (22µF) bezpośrednio przy wyjściu za diodą

**STREFA B — ESP32-WROVER-E:**
- Środek PCB lub na jednej krawędzi
- Antena WiFi na krawędzi PCB! Nie kładź miedzi/GND pod anteną
- Pullup I2C (2× 4.7kΩ) blisko pinów GPIO 21/22 (≤5mm)

**STREFA C — OLED FFC + bypass:**
- Złącze FFC na krawędzi PCB
- Kondensatory bypass (VDDIO, VCI, VDD, VCOMH) w odległości ≤5mm od złącza
- R_IREF (910kΩ) blisko pinu 22 FFC

**STREFA D — LDO kamery:**
- Między ESP32 a złączem kamery
- C_in na wejściu każdego LDO (≤3mm od pinu IN)
- C_out na wyjściu każdego LDO (≤3mm od pinu OUT)
- Opcjonalny ferrite bead za LDO 2.8V (przed rozgałęzieniem AVDD/DOVDD)

**STREFA E — Kamera FFC + bypass:**
- Złącze FFC na krawędzi PCB
- Kondensatory AVDD, DOVDD, DVDD bezpośrednio przy złączu (≤3mm!)
- Im bliżej tym lepiej — szum na AVDD = szum na obrazie

**STREFA F — MCP23017:**
- Blisko ESP32 (krótkie linie I2C)
- Bypass 100nF + 10µF przy VDD/VSS

**STREFA G — Klawiatura:**
- Może być daleko od reszty (sygnały wolne, przez I2C)
- Ścieżki do MCP23017 mogą być długie (do 20cm OK)

---

## 13. Zasady routingu PCB {#13-routing}

### 13.1 Warstwy (minimum 2-warstwowa PCB):

```
Warstwa TOP:    Komponenty + sygnały
Warstwa BOTTOM: GND plane (ciągły!) + krótkie jumpy sygnałowe
```

### 13.2 Priorytet routingu (od najważniejszego):

```
1. GND PLANE — ciągły na BOTTOM, bez przerw pod sygnałami szybkimi
2. Boost MT3608 — krótka pętla: L1 → SW → D1 → C_out → GND
3. SPI OLED (SCLK/MOSI) — para ścieżek, GND plane pod spodem
4. Dane kamery D0-D7 — length matching ±5mm (PCLK do 20MHz)
5. I2C (SDA/SCL) — krótkie, blisko siebie
6. Zasilanie (3.3V, 2.8V, 1.3V, 12V) — szerokie ścieżki
7. Klawiatura — dowolnie (sygnały DC)
```

### 13.3 Szerokości ścieżek:

| Sygnał | Szerokość min | Uwagi |
|--------|--------------|-------|
| GND plane | Ciągły polygon | Bez przerw pod SPI i kamerą! |
| 3.3V zasilanie | 0.5mm (20mil) | |
| 12V VCC_OLED | 0.3mm (12mil) | Prąd ~50mA |
| 2.8V / 1.3V LDO | 0.3mm (12mil) | |
| SPI (SCLK, MOSI) | 0.2mm (8mil) | Z ciągłym GND pod spodem |
| Dane kamery D0-D7 | 0.2mm (8mil) | Length matching ±5mm |
| I2C (SDA, SCL) | 0.2mm (8mil) | |
| Klawiatura (rows/cols) | 0.15mm (6mil) | Bez wymagań |

### 13.4 Krytyczne zasady:

```
✅ NIE przecinaj ścieżek SPI liniami 12V boost
✅ NIE prowadź linii 12V pod ESP32 lub kamerą
✅ NIE przerywaj GND plane pod SCLK/MOSI OLED
✅ NIE przerywaj GND plane pod liniami danych kamery D0-D7
✅ Pullup I2C (4.7kΩ) ← blisko ESP32, NIE blisko slave'ów
✅ Kondensatory bypass ← zawsze blisko pinów zasilania IC (≤5mm)
✅ Via GND przy każdym bypass cap (jeśli cap na TOP, via do GND BOTTOM)
```

---

## 14. BOM — kompletna lista komponentów {#14-bom}

### 14.1 Złącza:

| # | Komponent | Part Number | Ilość |
|---|-----------|-------------|-------|
| 1 | FFC 30-pin 0.5mm ZIF bottom | **Molex 505110-3091** | 1 |
| 2 | FFC 24-pin 0.5mm ZIF bottom | **Molex 505110-2491** | 1 |

### 14.2 Układy scalone:

| # | Komponent | Part Number | Obudowa | Ilość |
|---|-----------|-------------|---------|-------|
| 3 | Ekspander I2C 16-bit | **MCP23017-E/SO** | SOIC-28 | 1 |
| 4 | LDO 2.8V 600mA | **AP2112K-2.8TRG1** | SOT-23-5 | 1 |
| 5 | LDO 1.3V 200mA | **XC6206P132MR** | SOT-23 | 1 |
| 6 | Boost converter | **MT3608** | SOT-23-6 | 1 |

### 14.3 Rezystory (0603 SMD):

| # | Wartość | Ilość | Przeznaczenie |
|---|---------|-------|---------------|
| 7 | 910kΩ | 1 | IREF SSD1322 (pin 22 → GND) |
| 8 | 4.7kΩ | 2 | Pullup I2C (SDA + SCL → 3.3V) |
| 9 | 10kΩ | 1 | Pullup RESET kamery (→ 2.8V DOVDD) |
| 10 | 380kΩ | 1 | Dzielnik FB boost R1 (FB→Vout) [12V] |
| 11 | 20kΩ | 1 | Dzielnik FB boost R2 (FB→GND) |
| 12 | 330Ω | 1 | Rezystor LED (opcja) |
| 13 | 10kΩ | 1 | Gate rezystor MOSFET buzzera (opcja) |

> Jeśli VCC = 15V zamiast 12V: zamień R1 (poz. 10) na **480kΩ**
> i R_IREF (poz. 7) na **1.2MΩ**

### 14.4 Kondensatory (ceramika MLCC):

| # | Wartość | Rating | Obudowa | Ilość | Przeznaczenie |
|---|---------|--------|---------|-------|---------------|
| 14 | 100nF | 16V+ | 0402/0603 | 10 | Bypass: VCI, VDDIO, MCP23017, LDO×4, RESET# MCP, zapas |
| 15 | 1µF | 16V+ | 0603 | 5 | VDD SSD1322, VCI, LDO 1.3V in+out, LDO 2.8V in |
| 16 | 4.7µF | 16V+ | 0805 | 1 | VCOMH SSD1322 |
| 17 | 10µF | 10V+ X5R | 0805 | 5 | VDDIO SSD1322, AVDD cam, DOVDD cam, MCP23017, zapas |
| 18 | 22µF | **25V+** | 0805/1206 | 1 | Wyjście boost MT3608 (MUSI być ≥25V!) |
| 19 | 100µF | 10V+ | 1206 | 1 | Wejście boost MT3608 |

> ⚠️ C_out boost (poz. 18) MUSI mieć rating ≥25V! 
> Przy 12V wyjściu i ceramice X5R → derating = potrzebujesz 25V cap.

### 14.5 Induktor:

| # | Wartość | Prąd sat. | Obudowa | Ilość | Przeznaczenie |
|---|---------|-----------|---------|-------|---------------|
| 20 | 22µH | ≥1A | 1210 / 4×4mm | 1 | Boost MT3608 |

### 14.6 Dioda:

| # | Part Number | Ilość | Przeznaczenie |
|---|-------------|-------|---------------|
| 21 | SS14 (Schottky 1A 40V) | 1 | Boost MT3608 |

### 14.7 Ferrite bead (opcjonalny):

| # | Part Number | Ilość | Przeznaczenie |
|---|-------------|-------|---------------|
| 22 | BLM18PG601SN1 (600Ω@100MHz) | 1 | Filtr HF na 2.8V AVDD/DOVDD kamery |

### 14.8 Opcjonalne (LED, buzzer):

| # | Komponent | Ilość | Przeznaczenie |
|---|-----------|-------|---------------|
| 23 | LED 0805 (dowolny kolor) | 1 | Status (GPB5) |
| 24 | Buzzer pasywny 3.3V | 1 | Dźwięk (GPB6) |
| 25 | 2N7002 N-MOSFET | 1 | Driver buzzera |
| 26 | 1N4148 (opcja N-key rollover) | 25 | Diody klawiatury |

---

## 15. Uwagi końcowe i pułapki {#15-uwagi}

### 15.1 GPIO 12 — flash voltage (JEDNORAZOWE!)

GPIO 12 (MTDI) kontroluje napięcie flash przy boot (1.8V vs 3.3V).
Jeśli kamera (PCLK) ściągnie GPIO 12 HIGH przy starcie → flash = 1.8V → CRASH.

**Rozwiązanie (nieodwracalne, jednorazowe):**
```bash
espefuse.py --port /dev/ttyUSB0 set_flash_voltage 3.3V
```
To permanentnie ustala flash na 3.3V niezależnie od stanu GPIO 12.
Wykonaj to PRZED podłączeniem kamery.

### 15.2 Tryb SPI wyświetlacza (BS0/BS1)

```
┌────────────────┬─────┬─────┐
│ Tryb           │ BS1 │ BS0 │
├────────────────┼─────┼─────┤
│ 6800 parallel  │  1  │  0  │
│ 8080 parallel  │  1  │  1  │  ← fabryczny (prawdopodobnie)
│ 4-wire SPI     │  0  │  0  │  ← POTRZEBUJEMY TEN
│ 3-wire SPI     │  0  │  1  │
└────────────────┴─────┴─────┘
```

Na PCB: piny 16 (BS0) i 17 (BS1) → GND.
Na taśmie FPC: sprawdź czy rezystory 0Ω są w pozycjach "00".
Jeśli nie — przestaw je (lub usuń + zewrzyj odpowiednie pady).

### 15.3 Pinout kamery — SPRAWDŹ SWÓJ MODUŁ!

Tabela w sekcji 6 to TYPOWY pinout 24-pin OV2640.
Kolejność pinów D0-D7, zasilania i sygnałów kontrolnych
RÓŻNI SIĘ między producentami (AliExpress, Arducam, Waveshare...).

**Przed lutowaniem:**
1. Zdobądź datasheet TWOJEGO konkretnego modułu kamery
2. Użyj multimetru (ciągłość) aby zweryfikować pin 1 orientację
3. Sprawdź czy zasilanie jest na właściwych pinach!

### 15.4 VCC OLED — nigdy do GND!

Gdy wyłączasz wyświetlacz, VCC musi być **floating** (odcięty), NIE ściągnięty do masy.
Boost OFF (EN=LOW) = wyjście floating → OK.
NIE dodawaj rezystora pull-down na VCC!

### 15.5 Biblioteki firmware:

| Biblioteka | Wersja | Przeznaczenie |
|-----------|--------|---------------|
| **U8g2** | ≥2.35 | SSD1322 256×64 SPI (HW SPI!) |
| **esp_camera** | ESP-IDF | OV2640 driver (8-bit parallel + PSRAM) |
| **Adafruit MCP23017** | ≥2.3 | Ekspander I2C |

### 15.6 Definicje pinów w kodzie (PlatformIO / Arduino):

```cpp
// === OLED SSD1322 (HW VSPI) ===
#define OLED_CLK   18   // VSPI SCK
#define OLED_MOSI  23   // VSPI MOSI
#define OLED_CS    15
#define OLED_DC     2
#define OLED_RST    4

// === Kamera OV2640 ===
#define CAM_D0      5   // Y2 (strapping pin!)
#define CAM_D1     14   // Y3
#define CAM_D2     19   // Y4
#define CAM_D3     13   // Y5
#define CAM_D4     34   // Y6 (input-only)
#define CAM_D5     35   // Y7 (input-only)
#define CAM_D6     32   // Y8
#define CAM_D7     33   // Y9
#define CAM_PCLK   12   // (strapping pin!)
#define CAM_XCLK   25   // LEDC PWM 20MHz
#define CAM_VSYNC  27
#define CAM_HREF   26
#define CAM_SDA    21   // I2C
#define CAM_SCL    22   // I2C
#define CAM_PWDN   -1   // Przez MCP23017 GPA5
#define CAM_RESET  -1   // Przez MCP23017 GPA6

// === I2C Bus ===
#define I2C_SDA    21
#define I2C_SCL    22

// === MCP23017 ===
#define MCP_ADDR   0x20  // A0=A1=A2=GND
```

### 15.7 Komenda init VDD regulator SSD1322:

```cpp
// Po resecie, przed Display ON:
// Włącz wewnętrzny VDD regulator
u8g2.sendCommand(0xAB);  // Set VDD regulator
u8g2.sendCommand(0x01);  // A[0]=1 → enable internal VDD
```

---

## KONIEC DOKUMENTU

> Wersja: 3.0 FINAL
> Źródła: gpio_plan_v2.md + gpio_plan_errata_v2.1.md
> Wszystkie korekty z erraty naniesione.
> Gotowe do wdrożenia w Fusion 360 PCB.
