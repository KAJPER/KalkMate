# ESP32-WROVER-E — TUTORIAL BUDOWY PCB krok po kroku

## Od baterii do działającego urządzenia

> Ten plik to TUTORIAL — idziesz od góry do dołu, sekcja po sekcji.
> Każda sekcja to jeden podsystem. Budujesz i testujesz po kolei.
> Referencja techniczna: pcb_complete_v3.2_FINAL.md

---

## SPIS TREŚCI

1. [USB-C — jedno złącze do wszystkiego](#1-usbc)
2. [Bateria LiPo + ładowarka MCP73831](#2-bateria)
3. [Regulator 3.3V — główna szyna zasilania](#3-regulator)
4. [CH340C — USB-UART na PCB](#4-ch340c)
5. [ESP32-WROVER-E — serce systemu](#5-esp32)
6. [TEST #1 — Czy ESP32 startuje?](#test-1)
7. [MCP23017 — ekspander I2C](#7-mcp23017)
8. [TEST #2 — Czy I2C działa?](#test-2)
9. [Klawiatura membranowa 5×5](#9-klawiatura)
10. [TEST #3 — Czy klawiatura działa?](#test-3)
11. [Boost converter MT3608 — 12V dla OLED](#11-boost)
12. [TEST #4 — Czy 12V jest stabilne?](#test-4)
13. [OLED SSD1322 — wyświetlacz](#13-oled)
14. [TEST #5 — Czy OLED wyświetla?](#test-5)
15. [LDO kamery — zasilanie 2.8V i 1.3V](#15-ldo-kamera)
16. [Kamera OV2640 — podłączenie](#16-kamera)
17. [TEST #6 — Czy kamera robi zdjęcia?](#test-6)
18. [WiFi + HTTPS API — komunikacja z serwerem](#18-wifi)
19. [TEST #7 — Czy upload działa?](#test-7)
20. [Zarządzanie energią — oszczędzanie baterii](#20-power)
21. [Odczyt napięcia baterii — ADC](#21-adc-bateria)
22. [Layout PCB — 2 warstwy, 77×85mm](#22-layout)
23. [Kompletna lista części (BOM)](#23-bom)

---

# ETAP 1: ZASILANIE

---

## 1. USB-C — jedno złącze do wszystkiego {#1-usbc}

### Koncepcja:

```
    Jedno złącze USB-C (USB4110-GF-A) na PCB obsługuje:
    ✅ Ładowanie baterii LiPo (5V USB → MCP73831T-2ACI/OT → bateria)
    ✅ Programowanie ESP32 (USB D+/D- → CH340C → UART → ESP32)
    ✅ Debug serial monitor (ten sam CH340C)

    Oba działają jednocześnie — podłączasz kabel USB-C i masz
    ładowanie + serial terminal w jednym.

    Potwierdzone part numbery:
    • USB4110-GF-A (GCT) — złącze USB-C, SMD, 16-pin
    • MCP73831T-2ACI/OT (Microchip) — ładowarka LiPo 4.20V, SOT-23-5
    • CH340C (WCH) — USB-UART, SOIC-16, bez kryształu
```

### Złącze USB-C na PCB:

```
    Złącze: USB4110-GF-A (GCT)
    USB 2.0 Type C, 16 kontaktów (+ 8 dummy), SMD, top mount.
    Footprint z SnapEDA (format Fusion 360).

    Symbol SnapEDA ma piny zgrupowane — podłączenie wg symbolu:

    Pin symbolu      │ Sygnał │ Podłączenie
    ──────────────────┼────────┼───────────────────────────────
    VBUS (A4/B9*2)    │ 5V USB │ → MCP73831T VDD + CH340C VCC + [4.7µF]→GND
    GND  (A1/B12*6)   │ GND    │ → GND systemu
    CC1  (A5)          │ CC1    │ → [5.1kΩ] → GND
    CC2  (B5)          │ CC2    │ → [5.1kΩ] → GND
    DP1  (A6)          │ D+     │ ─┬─→ CH340C UD+ (pin 5)
    DP2  (B6)          │ D+     │ ─┘   (połącz DP1 z DP2!)
    DN1  (A7)          │ D-     │ ─┬─→ CH340C UD- (pin 6)
    DN2  (B7)          │ D-     │ ─┘   (połącz DN1 z DN2!)
    SBU1 (A8)          │ SBU1   │ NC (niepodłączony)
    SBU2 (B8)          │ SBU2   │ NC (niepodłączony)

    ⚠️ KLUCZOWE:
    • Rezystory 5.1kΩ na CC1 i CC2 do GND — WYMAGANE!
      Bez nich host/ładowarka nie poda 5V na VBUS.
    • DP1+DP2 razem, DN1+DN2 razem — kabel działa w obu orientacjach.

    Schemat:

    USB4110-GF-A
    ┌──────────────────────────────┐
    │  VBUS (A4/B9) ──────────────┼──┬──[4.7µF bulk]── GND  (blisko USB-C)
    │                              │  │
    │                              │  ├──→ MCP73831T VDD (pin 1)
    │                              │  │    └──[100nF]── GND  (≤3mm od pinu!)
    │                              │  │
    │                              │  └──→ CH340C VCC (pin 16)
    │                              │       └──[100nF]── GND  (≤3mm od pinu!)
    │                              │
    │  CC1 (A5) ──[5.1kΩ]────────┼──── GND
    │  CC2 (B5) ──[5.1kΩ]────────┼──── GND
    │                              │
    │  DP1 (A6) ──┬───────────────┼──→ CH340C UD+ (pin 5)
    │  DP2 (B6) ──┘               │
    │                              │
    │  DN1 (A7) ──┬───────────────┼──→ CH340C UD- (pin 6)
    │  DN2 (B7) ──┘               │
    │                              │
    │  SBU1 (A8) ─── NC           │
    │  SBU2 (B8) ─── NC           │
    │                              │
    │  GND (A1/B12) ──────────────┼──── GND systemu
    └──────────────────────────────┘

    Kondensatory VBUS — 3 sztuki:
    • 4.7µF ceramika blisko USB-C (bulk, stabilizuje VBUS przy wpięciu kabla)
    • 100nF ceramika blisko MCP73831T pin 1 VDD (bypass HF)
    • 100nF ceramika blisko CH340C pin 16 VCC (bypass HF)
```

---

## 2. Bateria LiPo + ładowarka MCP73831 {#2-bateria}

### Bateria:

```
    LiPo 3.7V 2000mAh (minimum) lub 3000mAh (lepiej)
    Ze złączem JST-PH 2.0mm (2-pin)
    Z AliExpress: szukaj "lipo 3.7v 2000mah jst"

    ⚠️ Napięcie: 3.0V (rozładowana) — 4.2V (pełna).
       NIGDY poniżej 3.0V! NIGDY powyżej 4.2V!
       Dlatego MUSISZ mieć układ ochrony (DW01A).
```

### Ładowarka MCP73831 (na PCB, nie moduł):

```
    MCP73831T-2ACI/OT (SOT-23-5)
    Programowalny prąd ładowania do 500mA, VREG = 4.20V.
    Koszt: ~1.50 zł (LCSC), ~$0.37

    Pinout:
           ┌────────────────┐
    VDD  1─┤                ├─5 PROG
    VSS  2─┤ MCP73831T     ├─4 STAT
    VBAT 3─┤  -2ACI/OT     │
           └────────────────┘

    Schemat:

    5V USB ──┬──[4.7µF bulk]── GND    (przy USB-C)
             │
             └──[100nF]──┬── VDD (pin 1)   (≤3mm od MCP73831T!)
                          │
                         GND

                 VSS (pin 2) ── GND

                 VBAT (pin 3) ──┬── → Bateria (+) przez JST
                                │
                              [4.7µF]
                                │
                               GND

                 STAT (pin 4) ──[1kΩ]── LED ── VBAT
                 (LOW = ładowanie, Hi-Z = naładowane/brak baterii)

                 PROG (pin 5) ──[RPROG]── GND
                 (ustawia prąd ładowania)

    Prąd ładowania:
    ┌─────────┬────────────────┐
    │ RPROG   │ Prąd           │
    ├─────────┼────────────────┤
    │ 10kΩ    │ 100mA          │
    │ 5kΩ     │ 200mA          │
    │ 2kΩ     │ 500mA ← ZALECANY (2000mAh / 0.5C)│
    │ 1kΩ     │ 1000mA (szybkie, ale grzeje)      │
    └─────────┴────────────────┘
```

### Ochrona baterii — DW01A + FS8205A:

```
    DW01A (SOT-23-6) — monitoruje napięcie baterii
    FS8205A (TSSOP-8) — dual N-MOSFET, odcina prąd

    Schemat:

    MCP73831T VBAT ──┬── B+ bateria (+) przez JST
                     │
                     │       DW01A (SOT-23-6)
                     ├─── VCC (pin 1)
                     │    OD  (pin 3) ──→ Gate 1 FS8205A
                     │    OC  (pin 4) ──→ Gate 2 FS8205A
                     │    CS  (pin 6) ──→ punkt między MOSFET a GND
                     │    GND (pin 2) ──→ GND systemu (za MOSFET)
                     │    TD  (pin 5) ──→ [100nF] → GND systemu (delay)
                     │
                     │       FS8205A (TSSOP-8, dual N-MOS)
    GND systemu ─────┴── Source 1 ── Drain 1/2 ── Source 2 ── B- bateria (-)
    (OUT-)                                                      przez JST

    Przepływ prądu:
    Bateria (+) → VBAT szyna → LDO 3.3V → system → GND systemu
    → FS8205A → Bateria (-)

    DW01A odcina FS8205A gdy:
    • Napięcie < 2.5V (over-discharge) → chroni baterię
    • Napięcie > 4.3V (over-charge) → chroni baterię
    • Zwarcie (zbyt duży prąd) → chroni wszystko

    ⚠️ WAŻNE: GND systemu ≠ B- baterii!
       GND systemu jest za FS8205A. To jest celowe —
       DW01A może odciąć GND żeby ochronić baterię.
```

### Pełny schemat zasilania:

```
    USB4110-GF-A           MCP73831T-2ACI/OT     DW01A + FS8205A
    VBUS 5V ──┬──[4.7µF]──┬──[100nF]──→ VDD (pin 1)  (ochrona baterii)
              │            │             │                  │
             GND          GND          VBAT (pin 3) ──┬── B+ ← JST ← Bateria (+)
                                         │             │
                                        GND            └── VBAT szyna ──→ LDO 3.3V (sekcja 3)
                                                                        ──→ Dzielnik ADC (sekcja 21)
                            PROG (pin 5) ──[2kΩ]── GND  (= 500mA charge)
                            STAT (pin 4) ──[1kΩ]── LED ── VBAT

    GND systemu ────── FS8205A ────── B- ← JST ← Bateria (-)

    Switch ON/OFF (SPDT slide switch):
    VBAT szyna ──[switch COM→NO]──→ VBAT_SW ──→ wejście LDO 3.3V
    (NC pin switcha niepodłączony = OFF pozycja)
    (ładowanie działa nawet gdy switch OFF)
```

---

## 3. Regulator 3.3V — główna szyna zasilania {#3-regulator}

### LDO AP2112K-3.3 (SOT-23-5):

```
    Pinout:
           ┌───────────┐
    VIN  1─┤           ├─5 EN
    GND  2─┤ AP2112K   ├─4 N.C.
    VOUT 3─┤     3.3   │
           └───────────┘

    VBAT_SW (3.0-4.2V) ──┬──[10µF]── GND
    (z VBAT przez switch) │
                          └── VIN (pin 1)

    EN (pin 5) ← VBAT_SW (zawsze ON gdy switch ON)
    GND (pin 2) ← GND

    VOUT (pin 3) ──┬──[10µF]──┬── 3.3V SZYNA
                   │          │
                  GND      [100nF]
                              │
                             GND

    ⚠️ Dropout: ~250mV → działa do VBAT ≥ 3.55V
       Bateria 3.0V → LDO nie daje 3.3V! Ale DW01A odcina przy 2.5V,
       więc w praktyce cutoff jest ~3.5V (ESP32 brownout).
```

### Szyna 3.3V zasila:

```
    3.3V ──┬──→ ESP32-WROVER-E (VDD)
           ├──→ MCP23017 (VDD)
           ├──→ OLED logika (VDDIO, VCI)
           ├──→ LDO 2.8V XC6206P282MR (→ kamera AVDD/DOVDD)
           ├──→ LDO 1.3V XC6206P132MR (→ kamera DVDD)
           ├──→ Boost MT3608 (VIN → 12V OLED)
           ├──→ Pullup I2C (2× 4.7kΩ)
           └──→ Pullup MCP23017 RESET#

    Max prąd: ~330mA peak (WiFi TX + wszystko ON)
    AP2112K max: 600mA → zapas OK ✅
```

---

## 4. CH340C — USB-UART na PCB {#4-ch340c}

### Po co:

```
    CH340C konwertuje USB (D+/D-) na UART (TX/RX) do ESP32.
    Dzięki temu programujesz ESP32 przez to samo USB-C co ładujesz.
    CH340C nie potrzebuje zewnętrznego kryształu (ma wbudowany)!
    Obudowa: SOIC-16 — łatwa do lutowania.
```

### Schemat CH340C:

```
    CH340C (SOIC-16):

                  ┌──────────────┐
    GND        1 ─┤              ├─ 16 VCC ← 5V USB
    TXD        2 ─┤              ├─ 15 N.C.
    RXD        3 ─┤              ├─ 14 N.C.
    V3 (3.3V)  4 ─┤   CH340C     ├─ 13 N.C.
    UD+        5 ─┤              ├─ 12 N.C.
    UD-        6 ─┤              ├─ 11 N.C.
    N.C.       7 ─┤              ├─ 10 N.C.
    N.C.       8 ─┤              ├─ 9  N.C.
                  └──────────────┘

    Podłączenie:

    VCC (pin 16) ← 5V USB VBUS + [100nF] do GND
    GND (pin 1)  ← GND
    V3  (pin 4)  → [100nF] do GND (wewn. reg. 3.3V, NIE podłączaj do 3.3V szyny!)
    UD+ (pin 5)  ← USB-C D+
    UD- (pin 6)  ← USB-C D-
    TXD (pin 2)  → ESP32 GPIO 3 (RXD0) — TX chipu → RX ESP32
    RXD (pin 3)  ← ESP32 GPIO 1 (TXD0) — RX chipu ← TX ESP32

    ⚠️ TX↔RX SKRZYŻOWANE! CH340C TX → ESP32 RX, CH340C RX ← ESP32 TX.
```

### Auto-reset circuit (programowanie bez przycisków):

```
    PlatformIO/Arduino IDE wysyła sygnały DTR i RTS
    żeby automatycznie wejść w tryb boot i zresetować ESP32.
    Potrzebujesz 2 tranzystory NPN + 2 kondensatory.

    CH340C          tranzystory/kondy              ESP32
    
    DTR# ──[100nF]──┬──────────────────────────── GPIO 0 (BOOT)
                     │
    RTS# ──────────[Q1 NPN kolektor]
                     │
                   [10kΩ] → 3.3V (pullup GPIO 0)
    
    RTS# ──[100nF]──┬──────────────────────────── EN (RESET)
                     │
    DTR# ──────────[Q2 NPN kolektor]
                     │
                   [10kΩ] → 3.3V (pullup EN)

    Uproszczony schemat (sprawdzony, identyczny jak ESP32-DevKitC):

    CH340C                                    ESP32
    DTR (pin 13... ale CH340C nie ma DTR!)

    ⚠️ PROBLEM: CH340C nie ma pinów DTR/RTS!
       CH340C ma tylko TXD i RXD — brak sygnałów kontrolnych.

    ROZWIĄZANIE: Użyj CH340N (SOP-8) lub CH340E (MSOP-10) zamiast CH340C.
    Albo: zostaw przy CH340C i używaj przycisków BOOT + RESET ręcznie.
    Albo: użyj CP2102N (ma DTR/RTS, ale QFN-28 — trudniej lutować).

    REKOMENDACJA DLA TEGO PROJEKTU:
    → CH340C + przyciski BOOT i RESET (najprostsze, działa)
    → Programowanie: trzymaj BOOT → naciśnij RESET → puść BOOT → flash
    → Raz na płytce zaprogramowany, OTA update przez WiFi (bez kabla)
```

### Alternatywa — CH340N (SOP-8) z DTR/RTS:

```
    CH340N (SOP-8) — mały, ma DTR i RTS!
    
                  ┌──────────┐
    UD+        1 ─┤          ├─ 8 VCC ← 5V USB
    UD-        2 ─┤  CH340N  ├─ 7 TXD → ESP32 RXD0 (GPIO 3)
    GND        3 ─┤          ├─ 6 RXD ← ESP32 TXD0 (GPIO 1)
    RTS#       4 ─┤          ├─ 5 DTR# (brak na N... sprawdzić!)
                  └──────────┘

    Hmm, CH340N też nie ma DTR... 

    FAKTYCZNA REKOMENDACJA:
    → CH340E (MSOP-10) — MA DTR# (pin 9) i RTS# (nie ma...) 
    
    OK, prawda jest taka:
    Z rodziny CH340 tylko CH340G (SSOP-20) i CH340K (ESSOP-10) 
    mają pełne sygnały modemowe.
    
    Najprostsze rozwiązanie z auto-reset:
    → CP2102N-A02-GQFN28 (QFN-28) — ma DTR i RTS
    → Ale QFN-28 wymaga hot air / reflow
    
    Najłatwiejsze do lutowania z auto-reset:
    → CH340G (SSOP-20) + kryształ 12MHz zewnętrzny
    → Ma DTR# i RTS# → pełny auto-reset

    DLA TEGO PROJEKTU WYBIERAM:
    ══════════════════════════════════════
    CH340C (SOIC-16) + 2 przyciski (BOOT + RESET)
    ══════════════════════════════════════
    Bo:
    1. Łatwy do lutowania (SOIC-16)
    2. Brak zewnętrznego kryształu
    3. Przyciski BOOT+RESET i tak potrzebujesz do debugowania
    4. Po pierwszym flash → OTA przez WiFi (bez kabla)
    5. Zajmuje mniej miejsca niż CH340G + kryształ
```

### Finalne podłączenie CH340C:

```
    5V USB VBUS ──[100nF]──┬── VCC (pin 16)   (≤3mm od CH340C!)
    (z USB4110 VBUS)        │
                           GND (pin 1) ── GND

    V3 (pin 4) ──[100nF]── GND  (wewnętrzny 3.3V, NIE łącz z szyną!)

    R232 (pin 15) ── GND  (wyłącza tryb RS232, zapobiega inwersji RXD)

    USB4110 DP1+DP2 ── UD+ (pin 5)
    USB4110 DN1+DN2 ── UD- (pin 6)

    TXD (pin 2) ──→ ESP32 GPIO 3 (RXD0)
    RXD (pin 3) ←── ESP32 GPIO 1 (TXD0)

    Nieużywane piny (8,9,10,11,12,13,14) ── NC (niepodłączone)

    Przyciski na PCB (SMD tact 3.5×6mm):
    [BOOT btn]  → GPIO 0 ──[10kΩ]── 3.3V  (przycisk do GND)
    [RESET btn] → EN ──[10kΩ]── 3.3V ──[100nF]── GND  (przycisk do GND)
```

---

## 5. ESP32-WROVER-E — serce systemu {#5-esp32}

### Co podłączyć do modułu:

```
    ESP32-WROVER-E (38-pin moduł)

    ZASILANIE:
    VDD 3.3V (pin 2)  ← 3.3V szyna (z LDO AP2112K)
    GND (pin 1, 15, 38) ← GND — podłącz WSZYSTKIE piny GND!
    Bypass: 10µF + 100nF ceramika między 3.3V a GND, blisko modułu.

    PROGRAMOWANIE (przez CH340C na PCB):
    GPIO 1 (TXD0) → CH340C RXD (pin 3)
    GPIO 3 (RXD0) ← CH340C TXD (pin 2)
    EN             → 10kΩ pullup do 3.3V + 100nF do GND + przycisk RESET do GND
    GPIO 0         → 10kΩ pullup do 3.3V + przycisk BOOT do GND

    ANTENA WiFi:
    Antena jest na module (PCB trace antenna).
    NIE kładź miedzi/GND pod anteną!
    Antena MUSI być na krawędzi PCB.
```

### Schemat podłączenia ESP32 na PCB:

```
                          ESP32-WROVER-E
                    ┌─────────────────────────┐
                    │                         │
    3.3V ──[10µF]──┤ VDD 3.3V           GND  ├── GND
    3.3V ──[100nF]─┤                         │
                    │                         │
    3.3V──[10kΩ]───┤ EN ──[100nF]── GND      │  (+ przycisk RESET)
                    │                         │
    3.3V──[10kΩ]───┤ GPIO 0                  │  (+ przycisk BOOT)
                    │                         │
    CH340C TXD  ───┤ GPIO 3 (RXD0)           │  (USB-UART)
    CH340C RXD  ───┤ GPIO 1 (TXD0)           │
                    │                         │
                    │ GPIO 2  ────────────────┼──→ OLED DC#
                    │ GPIO 4  ────────────────┼──→ OLED RES#
                    │ GPIO 15 ────────────────┼──→ OLED CS#
                    │ GPIO 18 ────────────────┼──→ OLED SCLK
                    │ GPIO 23 ────────────────┼──→ OLED MOSI
                    │                         │
                    │ GPIO 21 ────────────────┼──→ I2C SDA
                    │ GPIO 22 ────────────────┼──→ I2C SCL
                    │                         │
                    │ GPIO 5  ────────────────┼──→ Kamera D0
                    │ GPIO 12 ────────────────┼──→ Kamera PCLK
                    │ GPIO 13 ────────────────┼──→ Kamera D3
                    │ GPIO 14 ────────────────┼──→ Kamera D1
                    │ GPIO 19 ────────────────┼──→ Kamera D2
                    │ GPIO 25 ────────────────┼──→ Kamera XCLK
                    │ GPIO 26 ────────────────┼──→ Kamera HREF
                    │ GPIO 27 ────────────────┼──→ Kamera VSYNC
                    │ GPIO 32 ────────────────┼──→ Kamera D6
                    │ GPIO 33 ────────────────┼──→ Kamera D7
                    │ GPIO 34 ────────────────┼──→ Kamera D4
                    │ GPIO 35 ────────────────┼──→ Kamera D5
                    │                         │
                    │ GPIO 36 ────────────────┼──→ ADC baterii (dzielnik)
                    │                         │
                    │         [ANTENA →]      │  ← krawędź PCB!
                    └─────────────────────────┘
```

---

## 6. TEST #1 — Czy ESP32 startuje? {#test-1}

```
    W tym momencie masz na PCB:
    ✅ USB-C (USB4110-GF-A) → MCP73831T → bateria (ładowanie)
    ✅ USB-C → CH340C → ESP32 UART (programowanie)
    ✅ VBAT → LDO 3.3V → ESP32

    Test:
    1. Podłącz kabel USB-C do komputera
    2. Sprawdź czy system widzi port COM (CH340C)
       Linux: ls /dev/ttyUSB*
       Windows: Device Manager → Ports
       (jeśli nie widzi → zainstaluj driver CH340)
    3. Otwórz PlatformIO Serial Monitor (115200 baud)
    4. Naciśnij przycisk RESET
    5. Powinieneś zobaczyć boot log:
       "rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)"
    6. Wgraj test: trzymaj BOOT → naciśnij RESET → puść BOOT → Upload

    Zmierz multimetrem:
    • VBUS (USB):  5.0V ± 0.25V
    • VBAT:        3.7-4.2V (zależy od naładowania)
    • 3.3V szyna:  3.30V ± 0.05V
    • Prąd:        ~50mA (ESP32 idle + CH340C)

    Sprawdź LED ładowania:
    • LED świeci → bateria się ładuje ✅
    • LED nie świeci → bateria pełna LUB brak baterii

    Jeśli ESP32 nie startuje:
    • Sprawdź czy EN ma pullup do 3.3V
    • Sprawdź czy GPIO 0 ma pullup do 3.3V
    • Sprawdź TX/RX — czy skrzyżowane (CH340C TX → ESP32 RX)
    • Sprawdź polaryzację baterii w złączu JST!
```

---

# ETAP 2: EKSPANDER I KLAWIATURA

---

## 5. MCP23017 — ekspander I2C {#5-mcp23017}

### Podłączenie:

```
    MCP23017-E/SO (SOIC-28)
    ┌──────────────────────────────────────────────────────────────┐
    │                                                              │
    │  Zasilanie:                                                  │
    │  VDD  (pin 9)  ← 3.3V                                      │
    │  VSS  (pin 10) ← GND                                       │
    │  Bypass: 100nF + 10µF między pin 9 a pin 10 (≤3mm od IC!)  │
    │                                                              │
    │  I2C:                                                        │
    │  SCL  (pin 12) ← GPIO 22                                   │
    │  SDA  (pin 13) ← GPIO 21                                   │
    │                                                              │
    │  Adres I2C = 0x20:                                          │
    │  A0   (pin 15) ← GND                                       │
    │  A1   (pin 16) ← GND                                       │
    │  A2   (pin 17) ← GND                                       │
    │                                                              │
    │  Reset:                                                      │
    │  RESET# (pin 18) ← 3.3V (pullup, zawsze aktywny)           │
    │                     + 100nF do GND (filtr glitchy)          │
    │                                                              │
    │  Przerwania (opcjonalne, nie używamy):                       │
    │  INTA (pin 20) ← NC                                        │
    │  INTB (pin 19) ← NC                                        │
    │                                                              │
    │  I2C pullup (BLISKO ESP32, nie blisko MCP!):                │
    │  GPIO 21 (SDA) ──[4.7kΩ]── 3.3V                            │
    │  GPIO 22 (SCL) ──[4.7kΩ]── 3.3V                            │
    │                                                              │
    └──────────────────────────────────────────────────────────────┘

    Fizyczny pinout SOIC-28 (widok z góry):

    GPB0  1 ──┐         ┌── 28 GPA7  → Boost EN
    GPB1  2 ──┤         ├── 27 GPA6  → Kamera RESET#
    GPB2  3 ──┤         ├── 26 GPA5  → Kamera PWDN
    GPB3  4 ──┤         ├── 25 GPA4  → Row 4
    GPB4  5 ──┤MCP23017 ├── 24 GPA3  → Row 3
    GPB5  6 ──┤         ├── 23 GPA2  → Row 2
    GPB6  7 ──┤         ├── 22 GPA1  → Row 1
    GPB7  8 ──┤         ├── 21 GPA0  → Row 0
    VDD   9 ──┤         ├── 20 INTA  → NC
    VSS  10 ──┤         ├── 19 INTB  → NC
    N.C. 11 ──┤         ├── 18 RESET#→ 3.3V
    SCL  12 ──┤         ├── 17 A2    → GND
    SDA  13 ──┤         ├── 16 A1    → GND
    N.C. 14 ──┘         └── 15 A0    → GND
```

---

## 6. TEST #2 — Czy I2C działa? {#test-2}

```
    W tym momencie masz:
    ✅ Bateria → LDO → ESP32 + MCP23017 na I2C

    Wgraj I2C scanner:

    #include <Wire.h>
    void setup() {
        Serial.begin(115200);
        Wire.begin(21, 22);
    }
    void loop() {
        for (uint8_t addr = 1; addr < 127; addr++) {
            Wire.beginTransmission(addr);
            if (Wire.endTransmission() == 0) {
                Serial.printf("Znaleziono I2C: 0x%02X\n", addr);
            }
        }
        Serial.println("---");
        delay(2000);
    }

    Oczekiwany wynik:
    "Znaleziono I2C: 0x20"   ← to MCP23017 ✅

    Jeśli nie znajduje:
    • Sprawdź pullup 4.7kΩ na SDA i SCL
    • Sprawdź A0/A1/A2 → GND
    • Sprawdź VDD MCP → 3.3V, VSS → GND
    • Skrość ścieżki I2C (czy nie przerwane)
```

---

## 7. Klawiatura membranowa 5×5 {#7-klawiatura}

### Podłączenie ribbon cable:

```
    Klawiatura membranowa ma ribbon cable z 10 pinami.
    5 wierszy (ROW) + 5 kolumn (COL).

    ⚠️ ZANIM podłączysz — sprawdź multimetrem!
    Ustaw multimetr na ciągłość (buzzer).
    Wciśnij klawisz w lewym górnym rogu.
    Znajdź które 2 piny ribbon cable się zwierają.
    To da Ci ROW0 i COL0. Powtórz dla reszty.

    Podłączenie do MCP23017:

    Ribbon pin │ Sygnał │ MCP23017 pin │ Port  │ Konfiguracja
    ───────────┼────────┼──────────────┼───────┼──────────────
         1     │ ROW 0  │ pin 21 GPA0  │ OUT   │ Skanowanie
         2     │ ROW 1  │ pin 22 GPA1  │ OUT   │ Skanowanie
         3     │ ROW 2  │ pin 23 GPA2  │ OUT   │ Skanowanie
         4     │ ROW 3  │ pin 24 GPA3  │ OUT   │ Skanowanie
         5     │ ROW 4  │ pin 25 GPA4  │ OUT   │ Skanowanie
         6     │ COL 0  │ pin 1  GPB0  │ IN    │ Pullup wewn.
         7     │ COL 1  │ pin 2  GPB1  │ IN    │ Pullup wewn.
         8     │ COL 2  │ pin 3  GPB2  │ IN    │ Pullup wewn.
         9     │ COL 3  │ pin 4  GPB3  │ IN    │ Pullup wewn.
        10     │ COL 4  │ pin 5  GPB4  │ IN    │ Pullup wewn.

    Na PCB: header żeński 1×10 pin, raster 2.54mm
    (membranówki z AliExpress mają goldpiny 2.54mm)
```

### Jak działa skanowanie:

```
    1. Ustaw GPA0 = LOW, GPA1-4 = HIGH (aktywny ROW 0)
    2. Odczytaj GPB0-4:
       - GPB0 = LOW? → klawisz [ROW0, COL0] wciśnięty
       - GPB1 = LOW? → klawisz [ROW0, COL1] wciśnięty
       - itd.
    3. Ustaw GPA1 = LOW, reszta HIGH (aktywny ROW 1)
    4. Odczytaj GPB0-4 ponownie
    5. Powtarzaj dla wszystkich 5 wierszy
    6. Cały skan zajmuje ~5 odczytów I2C = <1ms
```

---

## 8. TEST #3 — Czy klawiatura działa? {#test-3}

```
    #include <Wire.h>
    #include <Adafruit_MCP23X17.h>
    Adafruit_MCP23X17 mcp;

    // Mapa klawiszy 5×5 (dostosuj do swojej membranówki!)
    char keymap[5][5] = {
        {'1','2','3','4','5'},
        {'6','7','8','9','0'},
        {'A','B','C','D','E'},
        {'F','G','H','I','J'},
        {'K','L','M','N','O'}
    };

    void setup() {
        Serial.begin(115200);
        Wire.begin(21, 22);
        mcp.begin_I2C(0x20);

        // Rows = output (GPA0-4)
        for (int i = 0; i <= 4; i++) {
            mcp.pinMode(i, OUTPUT);
            mcp.digitalWrite(i, HIGH);
        }
        // Cols = input pullup (GPB0-4 = piny 8-12 w Adafruit lib)
        for (int i = 8; i <= 12; i++) {
            mcp.pinMode(i, INPUT_PULLUP);
        }
    }

    void loop() {
        for (int row = 0; row < 5; row++) {
            mcp.digitalWrite(row, LOW);       // aktywuj wiersz
            delayMicroseconds(50);            // stabilizacja

            for (int col = 0; col < 5; col++) {
                if (!mcp.digitalRead(8 + col)) {  // GPB0=pin8, GPB1=pin9...
                    Serial.printf("Klawisz: %c (R%d,C%d)\n",
                                  keymap[row][col], row, col);
                    delay(200);  // debounce
                }
            }
            mcp.digitalWrite(row, HIGH);      // deaktywuj wiersz
        }
    }

    Oczekiwany wynik: wciskasz klawisz → serial wypisuje literę.
    Jeśli litery nie pasują do pozycji → popraw mapowanie ribbon cable.
```

---

# ETAP 3: WYŚWIETLACZ OLED

---

## 9. Boost converter MT3608 — 12V dla OLED {#9-boost}

### Po co:

```
    Panel OLED SSD1322 potrzebuje 12-15V na piny VCC (pin 3 i 29 FFC).
    Bateria daje 3.7V, LDO daje 3.3V → potrzebujemy boost do 12V.

    MT3608 to przetwornica step-up: wejście 3.3V → wyjście 12V.
    Sterujemy ją z MCP23017 GPA7 (pin EN) → możemy wyłączać 12V
    gdy OLED nie jest potrzebny (oszczędność baterii: -140mA!).
```

### Podłączenie MT3608 (SOT-23-6):

```
    Pinout MT3608:
           ┌───────────┐
    IN   1─┤           ├─6 (N.C. — nie podłączaj!)
    GND  2─┤  MT3608   ├─5 EN
    FB   3─┤           ├─4 SW
           └───────────┘

    Schemat na PCB:

    3.3V ──┬──[C_in 100µF]── GND
           │
           └── IN (pin 1)
                              MT3608
           GND ── GND (pin 2)

           MCP23017 GPA7 (pin 28) ── EN (pin 5)
           (HIGH = boost ON, LOW = boost OFF)

           SW (pin 4) ──┬──[L1 22µH]── 3.3V (IN)
                         │
                         └──[D1 SS14 Schottky]──┬── VCC_OLED (12V)
                                                 │
                                              [C_out 22µF/25V]
                                                 │
                                                GND

           FB (pin 3) ──┬──[R2 20kΩ]── GND
                         │
                         └──[R1 380kΩ]── VCC_OLED

           Vout = 0.6V × (1 + R1/R2) = 0.6 × (1 + 19) = 12V

    ⚠️ KRYTYCZNE uwagi:
    • C_out (22µF) MUSI mieć rating ≥25V! (ceramika X5R/X7R)
    • Induktor L1 shielded (ekranowany) — mniej EMI
    • Dioda MUSI być Schottky (szybka)! Zwykła 1N4007 nie zadziała.
    • Pin 6 MT3608 = NC, nie podłączaj!
    • Cała sekcja boost w ROGU PCB, daleko od kamery i anteny WiFi
    • GND polygon boost → połącz z main GND w JEDNYM punkcie
```

### Ścieżka prądu boost (ważne dla layout!):

```
    Prąd płynie w pętli:
    3.3V → L1 → SW → GND → z powrotem do 3.3V
    oraz:
    L1 → SW (przez MT3608) → D1 → C_out → GND

    Ta pętla musi być KRÓTKA i CIASNA!

    ┌─────────────────────┐
    │  3.3V               │
    │   │                 │
    │  [L1]    [MT3608]   │
    │   │       │    │    │
    │   └──── SW    GND   │
    │           │         │
    │         [D1]        │
    │           │         │
    │        [C_out]      │
    │           │         │
    │          GND polygon│
    └─────────────────────┘

    L1, MT3608, D1 i C_out powinny tworzyć trójkąt/prostokąt
    o boku max 10mm. Im ciaśniej tym mniej EMI.
```

---

## 10. TEST #4 — Czy 12V jest stabilne? {#test-4}

```
    W tym momencie masz:
    ✅ Bateria → LDO → ESP32 + MCP23017 + MT3608

    Test:
    1. Wgraj kod który włącza boost:
       mcp.pinMode(7, OUTPUT);         // GPA7
       mcp.digitalWrite(7, HIGH);      // EN boost ON

    2. Zmierz multimetrem napięcie na C_out:
       Powinno być: 12.0V ± 0.5V

    3. Zmierz prąd z baterii:
       Bez obciążenia boost: ~50mA (ESP32 + MCP + boost idle)
       Boost ON bez OLED: ~60mA (quiescent boost ~10mA)

    4. Wyłącz boost:
       mcp.digitalWrite(7, LOW);
       Napięcie na C_out spada powoli (brak obciążenia = wolny discharge)

    Jeśli napięcie złe:
    • Sprawdź R1/R2 dzielnika (380kΩ/20kΩ dla 12V)
    • Sprawdź orientację diody SS14 (katoda → C_out)
    • Sprawdź czy induktor jest podłączony IN→SW (nie odwrotnie!)
    • Sprawdź C_out rating ≥25V (ceramika 10V się przebije!)
```

---

## 11. OLED SSD1322 — wyświetlacz {#11-oled}

### Złącze FFC:

```
    Złącze: Molex 505110-3091 (30-pin, 0.5mm pitch, ZIF, bottom contact)

    ⚠️ "Bottom contact" znaczy że styki taśmy są OD SPODU.
    Przy wkładaniu taśmy: styki w dół (do PCB), plastik w górę.
    Podnieś klapkę ZIF → włóż taśmę → zamknij klapkę.
```

### Tryb SPI (ZRÓB TO NAJPIERW!):

```
    Twój bare glass OLED prawdopodobnie przyszedł w trybie 8080 parallel.
    Musisz zmienić na 4-wire SPI.

    Na taśmie FPC szukaj rezystorów 0Ω przy oznaczeniach BS0/BS1:
    ┌────────────────┬─────┬─────┐
    │ Tryb           │ BS1 │ BS0 │
    ├────────────────┼─────┼─────┤
    │ 8080 parallel  │  1  │  1  │  ← prawdopodobnie tak jest
    │ 4-wire SPI     │  0  │  0  │  ← chcemy to
    └────────────────┴─────┴─────┘

    Przestaw rezystory 0Ω na pozycje "00" (oba do GND).
    Lub na PCB: piny 16 (BS0) i 17 (BS1) FFC → GND (wymuszamy SPI).
```

### Podłączenie KAŻDEGO pinu FFC 30-pin:

```
    Pin │ Sygnał    │ Gdzie podłączyć              │ Uwagi
    ────┼───────────┼──────────────────────────────┼──────────────────
     1  │ N.C.(GND) │ GND                          │
     2  │ VSS       │ GND                          │
     3  │ VCC       │ 12V z MT3608                 │ SZYNA VCC_OLED
     4  │ VCOMH     │ [4.7µF ceramika] → GND       │ ≤5mm od pinu
     5  │ VLSS      │ GND                          │
     6  │ D7        │ GND                          │ nieużywane w SPI
     7  │ D6        │ GND                          │ nieużywane w SPI
     8  │ D5        │ GND                          │ nieużywane w SPI
     9  │ D4        │ GND                          │ nieużywane w SPI
    10  │ D3        │ GND                          │ nieużywane w SPI
    11  │ D2        │ GND                          │ nieużywane w SPI
    12  │ D1=SDIN   │ GPIO 23 (MOSI)               │ dane SPI
    13  │ D0=SCLK   │ GPIO 18 (SCLK)               │ zegar SPI
    14  │ E/RD#     │ GND (!!!)                    │ ❌ NIE 3.3V!
    15  │ R/W# (WR#)│ GND                          │
    16  │ BS0       │ GND                          │ tryb = SPI
    17  │ BS1       │ GND                          │ tryb = SPI
    18  │ DC#       │ GPIO 2                       │ Data/Command
    19  │ CS#       │ GPIO 15                      │ Chip Select
    20  │ RES#      │ GPIO 4                       │ Reset (active LOW)
    21  │ FR        │ NC (niepodłączony)            │
    22  │ IREF      │ [680kΩ rezystor] → GND       │ ustawia prąd (~4µA)
    23  │ N.C.      │ NC                           │
    24  │ VDDIO     │ 3.3V + [10µF] + [100nF] → GND│ logika SPI
    25  │ VDD       │ [1µF] → GND (wew. reg.)     │ core ~2.5V
    26  │ VCI       │ 3.3V + [1µF] + [100nF] → GND│ analog
    27  │ VSL       │ [50Ω] → [1N4148] → GND      │ WYMAGANE! (kat→GND)
    28  │ VLSS      │ GND                          │
    29  │ VCC       │ 12V z MT3608                 │ SZYNA VCC_OLED
    30  │ N.C.(GND) │ GND                          │

    ❌ KRYTYCZNE BŁĘDY do uniknięcia:
    • Pin 14 (E/RD#) = GND, nie VCC! (inaczej SPI nie działa)
    • Pin 27 (VSL)   = [50Ω]→[1N4148]→GND (NIE NC i NIE bezpośrednio do GND!)
    • IREF = 680kΩ (wg referencji datasheetu, daje ~4µA przy VCI=2.8V)
    • RES# LOW min 100µs, nie 3µs!   (inaczej reset się nie wykonuje)
```

### Kondensatory OLED — gdzie i jakie:

```
    Umieść WSZYSTKIE kondensatory w odległości ≤5mm od złącza FFC!

    Pin 24 (VDDIO) ← 10µF + 100nF ← 3.3V
    Pin 25 (VDD)   ← 1µF          ← (wewnętrzny regulator)
    Pin 26 (VCI)   ← 1µF + 100nF  ← 3.3V
    Pin 4  (VCOMH) ← 4.7µF        ← (wewnętrzna regulacja)
    Pin 22 (IREF)  ← 680kΩ        ← GND
    Pin 27 (VSL)   ← [50Ω] → [1N4148 dioda, katoda do GND] ← GND
```

---

## 12. TEST #5 — Czy OLED wyświetla? {#test-5}

```
    W tym momencie masz:
    ✅ Bateria → LDO → ESP32 + MCP23017 + MT3608 + OLED

    Wgraj test code:

    #include <U8g2lib.h>
    #include <SPI.h>
    #include <Wire.h>
    #include <Adafruit_MCP23X17.h>

    Adafruit_MCP23X17 mcp;

    // SSD1322 256×64, Hardware SPI, piny: CS=15, DC=2, RST=4
    U8G2_SSD1322_NHD_256X64_F_4W_HW_SPI u8g2(
        U8G2_R0, /* cs=*/ 15, /* dc=*/ 2, /* reset=*/ 4
    );

    void setup() {
        Serial.begin(115200);
        Wire.begin(21, 22);
        mcp.begin_I2C(0x20);

        // Boost ON
        mcp.pinMode(7, OUTPUT);      // GPA7
        mcp.digitalWrite(7, HIGH);   // EN = HIGH → 12V ON
        delay(50);                   // czekaj na VCC

        // Init OLED
        u8g2.begin();

        // Włącz wewnętrzny VDD regulator
        u8g2.sendCommand(0xAB);
        u8g2.sendCommand(0x01);

        // Test pattern
        u8g2.clearBuffer();
        u8g2.setFont(u8g2_font_ncenB14_tr);
        u8g2.drawStr(10, 30, "Hello OLED!");
        u8g2.drawStr(10, 55, "SSD1322 dziala!");
        u8g2.sendBuffer();

        Serial.println("OLED init OK");
    }

    void loop() {}

    Oczekiwany wynik: na wyświetlaczu pojawia się tekst.

    Jeśli ekran czarny:
    1. Zmierz VCC (pin 3/29 FFC) → powinno być ~12V
    2. Zmierz VDDIO (pin 24) → powinno być 3.3V
    3. Sprawdź pin 14 E/RD# → MUSI być GND (nie VCC!)
    4. Sprawdź BS0/BS1 → oba GND (tryb SPI)
    5. Sprawdź czy RES# (GPIO 4) ma dobry kontakt
    6. Sprawdź orientację taśmy FFC w złączu ZIF
    7. Jeśli ekran świeci ale brak tekstu → problem SPI
       (sprawdź GPIO 18=SCLK, GPIO 23=MOSI)
```

---

# ETAP 4: KAMERA

---

## 13. LDO kamery — zasilanie 2.8V i 1.3V {#13-ldo-kamera}

### Dwa osobne LDO:

```
    Kamera OV2640 potrzebuje:
    • AVDD  = 2.8V (analog sensor) ─┐
    • DOVDD = 2.8V (digital I/O)   ─┤── wspólny LDO 2.8V
    • DVDD  = 1.3V (digital core)  ─── osobny LDO 1.3V
```

### LDO #1: XC6206P282MR (2.8V, AVDD + DOVDD):

```
           ┌───────────┐
    VSS  1─┤           ├─3 VIN ← 3.3V
    VOUT 2─┤ XC6206    │
           │   2.8V    │
           └───────────┘

    3.3V ──[1µF]──┬── VIN (pin 3)
                  │
                 GND

    VSS (pin 1) ← GND

    VOUT (pin 2) ──┬── [1µF] + [100nF] → GND
                   │
                   ├── AVDD (FFC kamera pin 17)
                   │
                   └── DOVDD (FFC kamera pin 14)

    Opcja: ferrite bead BLM18PG601SN1 między VOUT a AVDD
           (filtruje HF szum → czystszy obraz)

    ⚠️ Kondensatory 1µF + 100nF BLISKO pinów kamery na FFC (≤3mm!)
       Szum na AVDD = szum na obrazie kamery!
    ⚠️ Ten sam XC6206 co na 1.3V — identyczny footprint SOT-23-3.
       Różnica: P282 = 2.8V, P132 = 1.3V (oznaczenie na obudowie: 54FK vs 46MG)
```

### LDO #2: XC6206P132MR (1.3V, DVDD):

```
           ┌───────────┐
    VSS  1─┤           ├─3 VIN ← 3.3V
    VOUT 2─┤ XC6206    │
           │   1.3V    │
           └───────────┘

    3.3V ──[1µF]──┬── VIN (pin 3)
                  │
                 GND

    VSS (pin 1) ← GND

    VOUT (pin 2) ──┬── [1µF] + [100nF] → GND
                   │
                   └── DVDD (FFC kamera pin 15)

    ⚠️ DVDD = 1.3V, NIE 1.2V! (zakres: 1.235V - 1.365V)
       XC6206P132MR daje dokładnie 1.3V ✅
```

---

## 14. Kamera OV2640 — podłączenie {#14-kamera}

### Złącze FFC:

```
    Złącze: Molex 505110-2491 (24-pin + P1/P2 mounting, 0.5mm pitch, ZIF)

    Pinout zweryfikowany ze schematem ESP32-CAM AI-Thinker.
    Chińskie moduły OV2640 na taśmie FFC 24-pin używają tego samego
    rozkładu pinów. GPIO dostosowane do ESP32-WROVER-E (unikamy
    konfliktów z OLED SPI, I2C bus, BOOT pin).
```

### Podłączenie FFC 24-pin (pinout AI-Thinker / chiński OV2640):

```
    Pin │ Sygnał    │ Podłączenie                  │ Uwagi
    ────┼───────────┼──────────────────────────────┼──────────────
     1  │ Y0        │ NC                           │ nieużywany (tryb 8-bit)
     2  │ Y1        │ NC                           │ nieużywany (tryb 8-bit)
     3  │ Y4 (D2)   │ GPIO 19                      │
     4  │ Y3 (D1)   │ GPIO 14                      │
     5  │ Y5 (D3)   │ GPIO 13                      │
     6  │ Y2 (D0)   │ GPIO 5                       │ strapping pin!
     7  │ Y6 (D4)   │ GPIO 33                      │
     8  │ PCLK      │ GPIO 12                      │ strapping pin!
     9  │ Y7 (D5)   │ GPIO 32                      │
    10  │ DGND      │ GND                          │ digital ground
    11  │ Y8 (D6)   │ GPIO 34                      │ input-only
    12  │ XCLK      │ GPIO 25 (LEDC 20MHz)         │ zegar kamery
    13  │ Y9 (D7)   │ GPIO 35                      │ input-only
    14  │ DOVDD     │ 2.8V (z LDO XC6206P282MR)   │ digital I/O power
    15  │ DVDD      │ 1.3V (z LDO XC6206P132MR)   │ digital core power
    16  │ HREF      │ GPIO 26                      │
    17  │ AVDD      │ 2.8V (z LDO XC6206P282MR)   │ analog power
    18  │ PWDN      │ MCP23017 GPA5 (pin 26)       │ HIGH = kamera śpi
    19  │ VSYNC     │ GPIO 27                      │
    20  │ RESET     │ MCP23017 GPA6 (pin 27)       │ active LOW + 10kΩ→2.8V
    21  │ SIO_C     │ GPIO 22 (SCL) ← I2C bus      │ wspólny z MCP23017
    22  │ SIO_D     │ GPIO 21 (SDA) ← I2C bus      │ wspólny z MCP23017
    23  │ AGND      │ GND                          │ analog ground
    24  │ NC        │ NC                           │
    P1  │ PAD       │ GND                          │ mounting pad
    P2  │ PAD       │ GND                          │ mounting pad

    ⚠️ UWAGA na kolejność danych! OV2640 ma 10-bit port (D0-D9),
       w trybie 8-bit używamy D2-D9 (Y2-Y9 w kodzie ESP-IDF).
       Y0 i Y1 (pin 1-2) są nieużywane → NC.

    ⚠️ GPIO 12 (PCLK) = strapping pin (flash voltage).
       Kamera musi być w PWDN przy boot! (MCP23017 GPA5 = HIGH domyślnie)
       Wtedy PCLK jest floating → wewnętrzny pulldown trzyma LOW → OK.
```

### Kamera RESET i PWDN — przez MCP23017:

```
    MCP23017 GPA6 (pin 27) ──┬── RESET kamera (FFC pin 20)
                              │
                           [10kΩ]
                              │
                            2.8V (DOVDD)

    Pullup 10kΩ do 2.8V trzyma RESET# HIGH (aktywny = normalny).
    GPA6 = LOW → reset kamery.
    GPA6 = HIGH (lub Hi-Z) → kamera działa.

    MCP23017 GPA5 (pin 26) ── PWDN kamera (FFC pin 18)

    GPA5 = HIGH → kamera w power down (~20µA)
    GPA5 = LOW  → kamera aktywna (~50mA)

    ⚠️ Domyślnie po starcie: GPA5 = HIGH (kamera wyłączona!)
       Włączasz ją dopiero gdy potrzebujesz zdjęcia.
```

### GPIO 12 — flash voltage fix (JEDNORAZOWE!):

```
    GPIO 12 (MTDI) jest strapping pin.
    Kamera PCLK na GPIO 12 może ściągnąć go HIGH przy boot
    → ESP32 ustawi flash na 1.8V → CRASH.

    Rozwiązanie (wykonaj RAZ, przed podłączeniem kamery):

    espefuse.py --port /dev/ttyUSB0 set_flash_voltage 3.3V

    ⚠️ To jest NIEODWRACALNE. Ale bezpieczne — WROVER-E i tak
       używa flash 3.3V. Po tym GPIO 12 jest wolny do użycia.
```

---

## 15. TEST #6 — Czy kamera robi zdjęcia? {#test-6}

```
    W tym momencie masz:
    ✅ Cały system: Bateria → LDO → ESP32 + MCP23017 + OLED + Kamera

    Wgraj test:

    #include <Wire.h>
    #include <Adafruit_MCP23X17.h>
    #include "esp_camera.h"

    Adafruit_MCP23X17 mcp;

    void setup() {
        Serial.begin(115200);
        Wire.begin(21, 22);
        mcp.begin_I2C(0x20);

        // Konfiguruj GPA5, GPA6 jako output
        mcp.pinMode(5, OUTPUT);  // PWDN
        mcp.pinMode(6, OUTPUT);  // RESET

        // Obudź kamerę
        mcp.digitalWrite(5, LOW);    // PWDN = LOW (kamera ON)
        delay(10);
        mcp.digitalWrite(6, LOW);    // RESET pulse
        delay(5);
        mcp.digitalWrite(6, HIGH);
        delay(20);

        // Konfiguracja kamery
        camera_config_t config;
        config.ledc_channel = LEDC_CHANNEL_0;
        config.ledc_timer   = LEDC_TIMER_0;
        config.pin_d0       = 5;     // Y2 → FFC pin 6
        config.pin_d1       = 14;    // Y3 → FFC pin 4
        config.pin_d2       = 19;    // Y4 → FFC pin 3
        config.pin_d3       = 13;    // Y5 → FFC pin 5
        config.pin_d4       = 33;    // Y6 → FFC pin 7
        config.pin_d5       = 32;    // Y7 → FFC pin 9
        config.pin_d6       = 34;    // Y8 → FFC pin 11 (input-only)
        config.pin_d7       = 35;    // Y9 → FFC pin 13 (input-only)
        config.pin_xclk     = 25;
        config.pin_pclk     = 12;
        config.pin_vsync    = 27;
        config.pin_href     = 26;
        config.pin_sccb_sda = 21;
        config.pin_sccb_scl = 22;
        config.pin_pwdn     = -1;    // sterujemy przez MCP
        config.pin_reset    = -1;    // sterujemy przez MCP
        config.xclk_freq_hz = 20000000;  // 20MHz (standard OV2640)
        config.pixel_format = PIXFORMAT_JPEG;
        config.frame_size   = FRAMESIZE_SVGA;  // 800×600
        config.jpeg_quality = 12;
        config.fb_count     = 2;     // PSRAM = 2 bufory
        config.grab_mode    = CAMERA_GRAB_LATEST;

        esp_err_t err = esp_camera_init(&config);
        if (err != ESP_OK) {
            Serial.printf("Kamera init FAIL: 0x%x\n", err);
            return;
        }
        Serial.println("Kamera init OK!");

        // Zrób zdjęcie
        camera_fb_t *fb = esp_camera_fb_get();
        if (fb) {
            Serial.printf("Zdjecie! %dx%d, %d bajtow JPEG\n",
                          fb->width, fb->height, fb->len);
            esp_camera_fb_return(fb);
        } else {
            Serial.println("Brak klatki!");
        }
    }

    void loop() {}

    Oczekiwany wynik:
    "Kamera init OK!"
    "Zdjecie! 800x600, 54321 bajtow JPEG"

    I2C scanner powinien teraz pokazywać DWA urządzenia:
    "Znaleziono I2C: 0x20"   ← MCP23017
    "Znaleziono I2C: 0x30"   ← OV2640 (SCCB) ← NOWY!

    Jeśli init FAIL 0x20001:
    • Sprawdź DVDD = 1.3V (nie 1.2V!)
    • Sprawdź AVDD/DOVDD = 2.8V
    • Sprawdź pullup RESET 10kΩ → 2.8V
    • Sprawdź PWDN = LOW (kamera nie w power down)
    • Sprawdź pinout FFC — czy Twój moduł ma ten sam układ!
    • Czy zrobiłeś espefuse set_flash_voltage 3.3V?
```

---

# ETAP 5: WIFI I API

---

## 16. WiFi + HTTPS API — komunikacja z serwerem {#16-wifi}

### Strategia: connect → send → disconnect

```
    WiFi żre 80-160mA extra. NIE trzymaj go włączonego non-stop!

    Workflow:
    1. Zrób zdjęcie (kamera ON → zdjęcie → kamera OFF)
    2. Włącz WiFi
    3. Wyślij JPEG po HTTPS z Bearer tokenem
    4. Odbierz odpowiedź
    5. Wyłącz WiFi

    ⚠️ Wyłącz kamerę PRZED włączeniem WiFi!
       XCLK kamery (10-20MHz) zakłóca WiFi 2.4GHz.
       Kolejność: kamera OFF → WiFi ON → send → WiFi OFF
```

### Pełny kod WiFi + HTTPS:

```cpp
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include "esp_camera.h"

const char* WIFI_SSID     = "TwojaSiec";
const char* WIFI_PASS     = "TwojeHaslo";
const char* API_URL       = "https://twoj-serwer.pl/api/photo";
const char* API_KEY       = "Bearer twoj_tajny_klucz_api";

// Root CA serwera (Let's Encrypt lub Twój)
// Wygeneruj: openssl s_client -connect twoj-serwer.pl:443 </dev/null 2>/dev/null | openssl x509
const char* ROOT_CA = \
"-----BEGIN CERTIFICATE-----\n" \
"MIIFazCCA1Og...(Twój certyfikat)...\n" \
"-----END CERTIFICATE-----\n";

// ----- WiFi ON/OFF -----

bool wifi_connect(uint32_t timeout_ms = 10000) {
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    uint32_t start = millis();
    while (WiFi.status() != WL_CONNECTED) {
        if (millis() - start > timeout_ms) {
            WiFi.mode(WIFI_OFF);
            return false;
        }
        delay(100);
    }
    return true;
}

void wifi_disconnect() {
    WiFi.disconnect(true);
    WiFi.mode(WIFI_OFF);
}

// ----- Upload zdjęcia -----

int upload_photo(uint8_t* jpeg_buf, size_t jpeg_len) {
    if (!wifi_connect()) return -1;

    WiFiClientSecure client;
    client.setCACert(ROOT_CA);
    // Albo na dev: client.setInsecure();

    HTTPClient http;
    http.begin(client, API_URL);
    http.addHeader("Authorization", API_KEY);
    http.addHeader("Content-Type", "image/jpeg");
    http.setTimeout(15000);

    int code = http.POST(jpeg_buf, jpeg_len);

    if (code > 0) {
        String resp = http.getString();
        Serial.printf("Serwer: %d — %s\n", code, resp.c_str());
    } else {
        Serial.printf("HTTP error: %s\n", http.errorToString(code).c_str());
    }

    http.end();
    wifi_disconnect();
    return code;
}

// ----- Wyślij JSON (status, klawisz) -----

int send_json(const char* endpoint, const char* json) {
    if (!wifi_connect()) return -1;

    WiFiClientSecure client;
    client.setCACert(ROOT_CA);

    HTTPClient http;
    String url = String("https://twoj-serwer.pl") + endpoint;
    http.begin(client, url);
    http.addHeader("Authorization", API_KEY);
    http.addHeader("Content-Type", "application/json");

    int code = http.POST(json);
    http.end();
    wifi_disconnect();
    return code;
}

// ----- Workflow: zdjęcie → upload -----

void capture_and_send() {
    // 1. Kamera ON
    camera_power_on();  // GPA5→LOW, GPA6 reset pulse, esp_camera_init

    // 2. Zrób zdjęcie
    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) { camera_power_off(); return; }

    // 3. Kamera OFF (PRZED WiFi!)
    size_t len = fb->len;
    uint8_t* buf = (uint8_t*)ps_malloc(len);  // kopia do PSRAM
    memcpy(buf, fb->buf, len);
    esp_camera_fb_return(fb);
    camera_power_off();  // GPA5→HIGH, esp_camera_deinit

    // 4. Upload
    int result = upload_photo(buf, len);
    free(buf);

    // 5. Pokaż wynik na OLED
    if (result == 200) {
        // narysuj "Wysłano OK" na OLED
    } else {
        // narysuj "Błąd: {result}"
    }
}
```

### Przechowywanie klucza API w NVS (bezpieczniej niż hardcoded):

```cpp
#include <Preferences.h>

// Zapisz raz (np. przez Serial command):
Preferences prefs;
prefs.begin("api", false);
prefs.putString("key", "Bearer twoj_klucz");
prefs.putString("url", "https://twoj-serwer.pl/api/photo");
prefs.putString("ssid", "TwojaSiec");
prefs.putString("pass", "TwojeHaslo");
prefs.end();

// Odczytuj w kodzie:
prefs.begin("api", true);  // true = read-only
String apiKey = prefs.getString("key", "");
String apiUrl = prefs.getString("url", "");
prefs.end();
```

---

## 17. TEST #7 — Czy upload działa? {#test-7}

```
    Prosty serwer testowy (Python Flask na Twoim PC):

    # test_server.py
    from flask import Flask, request
    app = Flask(__name__)

    @app.route('/api/photo', methods=['POST'])
    def photo():
        auth = request.headers.get('Authorization', '')
        if auth != 'Bearer test123':
            return {'error': 'unauthorized'}, 401

        data = request.data
        with open('received.jpg', 'wb') as f:
            f.write(data)
        return {'status': 'ok', 'size': len(data)}, 200

    app.run(host='0.0.0.0', port=5000)

    Na ESP32 ustaw:
    API_URL = "http://192.168.1.XXX:5000/api/photo"  // IP Twojego PC
    API_KEY = "Bearer test123"

    Uwaga: dla testu HTTP (nie HTTPS) użyj HTTPClient bez SSL:
    WiFiClient client;  // zamiast WiFiClientSecure
    http.begin(client, API_URL);

    Oczekiwany wynik:
    • Serial: "Serwer: 200 — {"status":"ok","size":54321}"
    • Na PC: plik received.jpg z Twoim zdjęciem z kamery!

    Jeśli działa → przejdź na HTTPS z prawdziwym certyfikatem.
```

---

# ETAP 6: ZARZĄDZANIE ENERGIĄ

---

## 18. Zarządzanie energią — oszczędzanie baterii {#18-power}

### Co masz do sterowania:

```
    MCP23017 GPA7 → boost EN  → OLED VCC 12V ON/OFF  (oszczędność: 140mA)
    MCP23017 GPA5 → cam PWDN  → kamera ON/OFF        (oszczędność: 50mA)
    WiFi.mode()   → WiFi radio → WiFi ON/OFF          (oszczędność: 80mA)
    SSD1322 AEh   → Display OFF → pikselele OFF       (oszczędność: ~3mA)
    CPU frequency → 80/160/240MHz                      (oszczędność: 30mA)
    esp_deep_sleep()→ cały ESP32 śpi                   (oszczędność: ~43mA)
```

### Polityka stanów (wklej do main loop):

```cpp
#define OLED_TIMEOUT_MS     30000    // 30s → wyłącz OLED
#define SLEEP_TIMEOUT_MS    300000   // 5min → deep sleep

uint32_t lastActivity = 0;
bool oledActive = false;

void loop() {
    uint32_t now = millis();
    char key = scanKeypad();

    if (key) {
        lastActivity = now;

        if (!oledActive) {
            oled_power_on();        // boost ON, reset, init, display ON
            oledActive = true;
        }

        handleKey(key);             // obsługa klawisza
    }

    // Auto-off OLED po 30s bezczynności
    if (oledActive && (now - lastActivity > OLED_TIMEOUT_MS)) {
        oled_power_off();           // display OFF, boost OFF
        oledActive = false;
    }

    // Deep sleep po 5min bezczynności
    if (!oledActive && (now - lastActivity > SLEEP_TIMEOUT_MS)) {
        camera_power_off();
        wifi_disconnect();
        // budzenie zewnętrznym przyciskiem (opcja):
        // esp_sleep_enable_ext0_wakeup(GPIO_NUM_33, 0);
        esp_sleep_enable_timer_wakeup(60 * 1000000);  // lub timer 60s
        esp_deep_sleep_start();
        // ← po wake = restart od setup()
    }

    delay(50);
}
```

### Ile to oszczędza:

```
    Stan                    │ Prąd   │ Czas pracy 2000mAh
    ────────────────────────┼────────┼────────────────────
    Wszystko ON             │ 327 mA │ ~4.9h
    OLED ON, kamera OFF     │ 190 mA │ ~8.4h
    OLED OFF (idle)         │  43 mA │ ~37h
    Deep sleep              │0.01 mA │ ~6.5 lat (teoretycznie)

    Scenariusz realny (OLED 30%, kamera 5%, WiFi 10s/min):
    Średni prąd: ~112 mA → czas pracy: ~14h z 2000mAh ✅
```

---

## 19. Odczyt napięcia baterii — ADC {#19-adc-bateria}

### Dzielnik napięcia na GPIO 36 (lub inny ADC pin):

```
    ⚠️ GPIO 36 i 39 mają glitche na WROVER-E (hall sensor).
    Użyj GPIO 34 lub 35? — NIE, zajęte przez kamerę!
    
    Rozwiązanie: użyj GPIO 36 LUB GPIO 39 TYLKO do ADC baterii
    (odczyt raz na minutę, glitche nie przeszkadzają przy uśrednianiu).
    
    Albo: wolny MCP23017 pin GPB7 + zewnętrzny ADC (overcomplicated).
    
    Najprostszy wariant — GPIO 36 z dzielnikiem:

    VBAT (3.0-4.2V) ──[100kΩ R1]──┬──[100kΩ R2]── GND
                                    │
                                 GPIO 36 (ADC1_CH0)
                                    
    Napięcie na GPIO 36 = VBAT / 2 → max 2.1V (bezpieczne, ADC max 3.3V)

    Kod:
    float readBatteryVoltage() {
        uint32_t sum = 0;
        for (int i = 0; i < 64; i++) {
            sum += analogRead(36);
        }
        float avg = sum / 64.0;
        float voltage = (avg / 4095.0) * 3.3 * 2.0;  // ×2 = dzielnik
        return voltage;
    }

    // Procent baterii (przybliżony):
    // 4.2V = 100%, 3.7V = 50%, 3.3V = 5%, 3.0V = 0%
    int batteryPercent(float v) {
        if (v >= 4.2) return 100;
        if (v <= 3.0) return 0;
        return (int)((v - 3.0) / 1.2 * 100);
    }
```

---

## 22. Layout PCB — 2 warstwy, 77×85mm {#22-layout}

### Warstwy:

```
    TOP (górna):    GND plane (ciągły!) + krótkie jumpy sygnałowe
    BOTTOM (dolna): WSZYSTKIE komponenty + routing sygnałów + zasilanie

    Membranówka jest ZEWNĘTRZNA — przyklejona na obudowie nad PCB,
    łączy się ribbon cable do headera 1×10 na BOTTOM.
    TOP layer jest wolny → pełny GND plane. To KLUCZOWE dla:
    • Stabilność boost MT3608 (mniej EMI)
    • Stabilność WiFi ESP32 (mniejszy szum)
    • Stabilność SPI OLED (mniej glitchów)

    ⚠️ WYJĄTEK: pod anteną ESP32 — brak miedzi na TOP i BOTTOM!
       Antena na krawędzi PCB, strefa keepout ~10mm.
```

### Rozmieszczenie komponentów (BOTTOM, 77×85mm):

```
    ┌──────────────────────────────────── 77mm ───────────────────┐
    │                                                              │
    │  [USB4110]  [MCP73831T] [DW01A]  [CH340C]  [BOOT] [RESET]    │
    │  [CC R×2]  [RPROG]     [FS8205A]           [btns]            │
    │                                                              │  
    │  [JST bat]  [switch]  [AP2112K 3.3V]                        │  85mm
    │                       [C_in] [C_out]                        │
    │                                                              │
    │  ┌──────────────────────────────────┐     [MT3608]          │
    │  │                                  │     [L1] [D1]         │
    │  │      ESP32-WROVER-E              │     [C_in] [C_out]    │
    │  │      (18 × 25.5mm)              │     [R1] [R2]         │
    │  │                                  │     BOOST CORNER      │
    │  │      antena →                    │     (osobny GND!)     │
    │  └──────────────────────────────────┘                        │
    │                                                              │
    │  [4.7kΩ×2]  [MCP23017 SOIC-28]  [XC6206 2.8V] [XC6206]   │
    │  I2C pullup  [C bypass]           [C bypass]     [C bypass] │
    │                                                              │
    │  [FFC 30-pin OLED]     [FFC 24-pin KAMERA]                  │
    │  [VDDIO caps]          [AVDD DOVDD DVDD caps]               │
    │  [VCI VDD VCOMH caps]  [IREF 680k]  [VSL 50Ω+1N4148]          │
    │  [ferrite bead]                                              │
    │                                              [header 1×10]  │
    │                                              membranówka    │
    │  [LED] [buzzer+MOSFET]  [ADC dzielnik]                      │
    └─────────────────────────────────────────────────────────────┘

    ZASADY:
    1. ESP32 antena na KRAWĘDZI — nic z przodu, keepout na obu warstwach
    2. MT3608 w ROGU — najdalej od ESP32 i FFC kamery
    3. FFC złącza na KRAWĘDZI — taśmy wychodzą na zewnątrz
    4. CH340C + USB-C razem — krótkie ścieżki USB D+/D-
    5. MCP73831 blisko USB-C — krótka ścieżka VBUS
    6. LDO kamery blisko FFC kamery — krótkie zasilanie
    7. I2C pullup blisko ESP32 — nie blisko MCP23017/kamery
```

### Routing — priorytety:

```
    1. GND PLANE na TOP — ciągły, bez przerw (oprócz keepout anteny)
    2. Boost MT3608 pętla — L1→SW→D1→C_out — krótka, ciasna, na BOTTOM
    3. USB D+/D- — krótkie, równe, od USB-C do CH340C
    4. SPI OLED — SCLK/MOSI (GPIO 18/23) jako para na BOTTOM
    5. Dane kamery D0-D7 — length matching ±5mm na BOTTOM
    6. I2C — krótkie, blisko siebie
    7. Zasilanie — szerokie ścieżki (≥0.5mm dla 3.3V, ≥0.3mm reszta)

    ⚠️ GND vias co 5-10mm wzdłuż ścieżek szybkich sygnałów
       (SPI, dane kamery) — łączą BOTTOM GND z TOP GND plane
```

---

## 23. Kompletna lista części (BOM) {#23-bom}

### Zasilanie + ładowanie:

| # | Co | Part Number | Ilość | Cena~ |
|---|-----|-------------|-------|-------|
| 1 | Bateria LiPo 3.7V 2000mAh | JST-PH, 103450 | 1 | ~15 zł |
| 2 | Ładowarka LiPo IC | **MCP73831T-2ACI/OT** (SOT-23-5) | 1 | ~1.50 zł |
| 3 | Ochrona baterii | **DW01A** (SOT-23-6) | 1 | ~0.5 zł |
| 4 | Dual N-MOSFET ochrona | **FS8205A** (TSSOP-8) | 1 | ~0.5 zł |
| 5 | LDO 3.3V 600mA | AP2112K-3.3TRG1 (SOT-23-5) | 1 | ~1 zł |
| 6 | LDO 2.8V 200mA | XC6206P282MR (SOT-23-3) | 1 | ~0.50 zł |
| 7 | LDO 1.3V 200mA | XC6206P132MR (SOT-23) | 1 | ~1 zł |
| 8 | Boost 3.3V→12V | MT3608 (SOT-23-6) | 1 | ~1 zł |

### USB + programowanie:

| # | Co | Part Number | Ilość | Cena~ |
|---|-----|-------------|-------|-------|
| 9 | Złącze USB-C | **USB4110-GF-A** (GCT, SMD 16-pin) | 1 | ~2 zł |
| 10 | USB-UART converter | **CH340C** (SOIC-16) | 1 | ~2 zł |

### Główne IC:

| # | Co | Part Number | Ilość | Cena~ |
|---|-----|-------------|-------|-------|
| 11 | Mikrokontroler | ESP32-WROVER-E (8MB PSRAM) | 1 | ~25 zł |
| 12 | Ekspander I2C | MCP23017-E/SO (SOIC-28) | 1 | ~5 zł |

### Złącza:

| # | Co | Part Number | Ilość | Cena~ |
|---|-----|-------------|-------|-------|
| 13 | FFC 30-pin ZIF 0.5mm | Molex 505110-3091 | 1 | ~3 zł |
| 14 | FFC 24-pin ZIF 0.5mm | Molex 505110-2491 | 1 | ~3 zł |
| 15 | JST-PH 2-pin (bateria) | JST B2B-PH-K-S | 1 | ~1 zł |
| 16 | Header 1×10 żeński 2.54mm | — | 1 | ~1 zł |

### Rezystory (0603 SMD):

| # | Wartość | Ilość | Do czego |
|---|---------|-------|----------|
| 17 | 680kΩ | 1 | IREF OLED (pin 22 → GND) |
| 18 | 50Ω 1/4W | 1 | VSL OLED (pin 27, w serii z 1N4148) |
| 19 | 4.7kΩ | 2 | Pullup I2C (SDA + SCL → 3.3V) |
| 20 | 10kΩ | 3 | Pullup: cam RESET, ESP32 EN, GPIO 0 |
| 21 | 380kΩ | 1 | Dzielnik boost R1 (→ 12V) |
| 22 | 20kΩ | 1 | Dzielnik boost R2 (→ GND) |
| 23 | 100kΩ | 2 | Dzielnik ADC baterii (R1, R2) |
| 24 | 5.1kΩ | 2 | USB-C CC1/CC2 → GND (wymagane!) |
| 25 | 2kΩ | 1 | MCP73831 RPROG (500mA charge) |
| 26 | 1kΩ | 1 | MCP73831 STAT LED |

### Kondensatory (ceramika MLCC):

| # | Wartość | Rating | Obudowa | Ilość | Do czego |
|---|---------|--------|---------|-------|----------|
| 27 | 100nF | 16V | 0402/0603 | 13 | Bypass: ESP32, MCP23017, CH340C VCC, CH340C V3, MCP73831T VDD, LDO 3.3V out, LDO 2.8V out, LDO 1.3V out, LDO 2.8V in (opcja), LDO 1.3V in (opcja), OLED VDDIO, VCI, EN filter, DW01A TD |
| 28 | 1µF | 16V | 0603 | 6 | VDD OLED (pin 25), VCI OLED, LDO 2.8V in, LDO 2.8V out, LDO 1.3V in, LDO 1.3V out |
| 29 | 4.7µF | 16V | 0805 | 3 | VBUS USB bulk, VCOMH OLED, MCP73831T VBAT |
| 30 | 10µF | 10V X5R | 0805 | 5 | VDDIO OLED, LDO 3.3V in+out, MCP23017, ESP32 |
| 31 | 22µF | **25V** X5R | 0805/1206 | 1 | Wyjście boost (MUSI być ≥25V!) |
| 32 | 100µF | 10V | 1206 | 1 | Wejście boost |

### Induktor + dioda (boost):

| # | Co | Wartość | Obudowa | Ilość |
|---|-----|---------|---------|-------|
| 33 | Induktor | 22µH ≥1A shielded | 1210/4x4mm | 1 |
| 34 | Dioda Schottky | SS14 (1A 40V) | SMA | 1 |

### Opcjonalne:

| # | Co | Ilość | Do czego |
|---|-----|-------|----------|
| 35 | Ferrite bead BLM18PG601SN1 | 1 | Filtr HF na 2.8V kamery |
| 36 | LED 0603 (zielona) | 1 | Status klawiatura (MCP GPB5) |
| 37 | LED 0603 (czerwona) | 1 | Ładowanie baterii (MCP73831T STAT) |
| 38 | Rezystor 330Ω | 1 | LED status |
| 39 | Buzzer pasywny 3.3V | 1 | Dźwięk (MCP GPB6) |
| 40 | 2N7002 N-MOSFET | 1 | Driver buzzera |
| 41 | Switch SPDT slide (SS12F15/custom) | 1 | ON/OFF systemu |
| 42 | Przyciski tact SMD 3.5×6mm (TL3305AF260QG compat.) | 2 | BOOT + RESET ESP32 |
| 43 | Dioda 1N4148 | 1 | VSL OLED (pin 27, w serii z 50Ω) |

### Łączny koszt: ~90-130 zł
(bez OLED bare glass i kamery — te masz)

---

## KONIEC TUTORIALU

> Kolejność budowy:
> 1. Bateria + ładowanie + LDO 3.3V
> 2. ESP32 (test: czy bootuje?)
> 3. MCP23017 (test: I2C scan)
> 4. Klawiatura (test: klawisze)
> 5. Boost MT3608 (test: 12V multimetr)
> 6. OLED SSD1322 (test: tekst na ekranie)
> 7. LDO kamery (test: 2.8V i 1.3V multimetr)
> 8. Kamera OV2640 (test: JPEG na serial)
> 9. WiFi + HTTPS (test: upload do serwera)
> 10. Power management (test: czas pracy na baterii)
>
> Każdy etap testuj OSOBNO zanim przejdziesz dalej!