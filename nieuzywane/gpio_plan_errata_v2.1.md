# KOREKTY do planu GPIO v2 — po weryfikacji z dokumentacjami

## Znalezione błędy i poprawki:

---

### ❌ BŁĄD 1: Sekwencja power-on SSD1322 — WAŻNE!

**W planie v2 napisałem:**
> 1. VDD najpierw → 2. RES# LOW na 3µs → 3. VCC po 100ms

**Poprawna sekwencja (z datasheet SSD1322 rev 1.2, sekcja 8.9):**
1. Włącz VCI i VDDIO (3.3V) — VDD ustabilizuje się z wewnętrznego regulatora
2. Poczekaj **minimum 1ms** (t0) aż VDD wewnętrzny się ustabilizuje
3. RES# → LOW na **minimum 100µs** (t1) — ❌ NIE 3µs jak napisałem!
4. RES# → HIGH
5. Poczekaj **minimum 100µs** (t2)
6. **Dopiero teraz** włącz VCC (12V)
7. Po stabilizacji VCC — wyślij komendy inicjalizacyjne
8. Komenda AFh (Display ON)

**KOREKTA:** t1 (RES# LOW) = min 100µs (nie 3µs!). To był poważny błąd.

---

### ❌ BŁĄD 2: VCC zakres napięciowy

**W planie v2 napisałem:**
> VCC = 12V, zakres 9-15V

**Z datasheet SSD1322 (sekcja 2 Features):**
> VCC = 10.0V – 20.0V (Panel driving power supply)

Ale typowe zastosowania 256×64 używają VCC = 12V–16V.
Producent Winstar (WEO025664D) podaje VCC = 16V typowe.

**KOREKTA:** VCC zakres to 10V–20V (nie 9-15V). 12V to dolna ćwierć zakresu.
Bezpiecznie użyj **13V–15V** dla lepszej jasności, lub 12V jeśli chcesz niższe zużycie.
Zaktualizuj dzielnik MT3608 jeśli chcesz 15V:
- R1 = 480kΩ, R2 = 20kΩ → Vout = 0.6 × (1 + 480/20) = **15V**

---

### ❌ BŁĄD 3: Rezystor IREF — wartość

**W planie v2 napisałem:**
> R_IREF = 820kΩ

**Z datasheet SSD1322 (sekcja 8.5, Figure 8-8):**
> R = (VCC - 3V) / IREF
> IREF powinno = 10µA ± 2µA
> Dla VCC = 12V: R = (12 - 3) / 10µA = **900kΩ**
> Dla VCC = 15V: R = (15 - 3) / 10µA = **1.2MΩ**

**KOREKTA:** Dla VCC=12V użyj **910kΩ** (standardowa wartość E24), nie 820kΩ.
820kΩ dałoby IREF = 11µA — nadal w tolerancji, ale 910kΩ jest dokładniejsze.
Jeśli zmienisz VCC na 15V → użyj **1.2MΩ**.

---

### ❌ BŁĄD 4: Pin 27 VSL — nie podłączaj do GND przez kondensator!

**W planie v2 napisałem:**
> VSL (Pin 27): 1µF do GND

**Z datasheet SSD1322 (Vishay OLED datasheet z SSD1322):**
> "This is segment voltage reference pin. When external VSL is not used,
> this pin should be **left open**."

**KOREKTA:** Jeśli nie używasz zewnętrznego VSL, zostaw pin 27 **NC** (floating).
Podłączenie kondensatora do GND jest opcjonalne i tylko gdy używasz external VSL.
Na bare glass z wewnętrznym VSL → **zostaw otwarty (NC)**.

---

### ⚠️ UWAGA 5: Pin 14 (E/RD#) w trybie 4-wire SPI

**W planie v2 napisałem:**
> Pin 14 E/RD# → 3.3V (tie HIGH)

**Z datasheet SSD1322, Table 8-4 (4-wire serial interface):**
> E/RD# = "Tie to VSS" (GND) w trybie serial

**KOREKTA:** W trybie 4-wire SPI pin 14 (E/RD#) ma być podłączony do **GND (VSS)**, nie VCC!
To ważna poprawka — podłączenie do VCC mogłoby powodować problemy.

Pełna tabela pinów kontrolnych w trybie 4-wire SPI:

| Pin FFC | Sygnał | Funkcja w 4-wire SPI | Podłączenie |
|---------|--------|---------------------|-------------|
| 13 | D0 | SCLK | GPIO 18 |
| 12 | D1 | SDIN (MOSI) | GPIO 23 |
| 14 | E/RD# | Tie LOW | **GND** ← POPRAWIONE |
| 15 | R/W# (WR#) | Tie LOW | **GND** ← OK, bez zmian |
| 18 | DC# | Data/Command | GPIO 2 |
| 19 | CS# | Chip Select | GPIO 15 |

---

### ⚠️ UWAGA 6: Piny D2–D7 (FFC 6–11) w trybie SPI

**W planie v2 napisałem:**
> D2–D7 → GND

**Z datasheet SSD1322, sekcja 7 Pin Descriptions:**
> "Unused data pins should be left unconnected" (NC) — w niektórych wersjach
> Ale w innych: "Unused pins are recommended to tie LOW"

**KOREKTA:** Oba warianty (NC lub GND) działają. Bezpieczniej jest podłączyć
do **GND** jak napisałem — zapobiega to łapaniu zakłóceń. Zostawiam jak jest.

---

### ⚠️ UWAGA 7: OV2640 DVDD = 1.3V nie 1.2V

**W tekście chatu napisałeś:**
> "1.2V jak dobrze pamiętam"

**Z datasheet OV2640 (OmniVision Application Notes):**
> DVDD = **1.3V** (nie 1.2V)

Użyj LDO 1.3V (XC6206P132MR). 1.2V jest za niskie!

---

### ⚠️ UWAGA 8: Kolejność zasilania kamery OV2640 — potwierdzone OK

Z datasheet OV2640 Hardware Application Notes:
> "DOVDD first, DVDD second and AVDD third.
> The 3 powers could be applied simultaneously."

Ponieważ DOVDD = AVDD = 2.8V (jeden LDO), a DVDD = 1.3V (drugi LDO),
i oba LDO włączają się jednocześnie z 3.3V → to jest OK.
Plan v2 jest poprawny w tej kwestii.

---

### ⚠️ UWAGA 9: MCP23017 RESET# pin

**W planie v2 napisałem:**
> RESET# → 3.3V (pullup, zawsze HIGH)

**Z datasheet MCP23017 (Microchip DS20001952):**
> RESET# is active-low. Internal pull-up.
> "If not used, connect directly to VDD"

**KOREKTA:** To jest OK, ale lepiej dodaj **100nF kondensator** między RESET# a GND
(filtr RC z wewnętrznym pullup) dla odporności na zakłócenia.
Opcjonalnie: podłącz RESET# do GPIO 0 ESP32 jeśli chcesz resetować MCP23017
(ale GPIO 0 to strapping pin — nie polecam, zostaw pullup do VDD).

---

### ✅ UWAGA 10: I2C adresy — zweryfikowane, brak konfliktu

| Urządzenie | Adres I2C (7-bit) | Źródło |
|-----------|-------------------|--------|
| OV2640 (SCCB) | 0x30 | Datasheet OV2640 (0x60 write / 0x61 read = 7-bit 0x30) |
| MCP23017 | 0x20 | A0=A1=A2=GND |

Brak konfliktu. ✅

---

### ✅ UWAGA 11: VDD SSD1322 z wewnętrznego regulatora — potwierdzone

Z datasheet SSD1322 sekcja 8.10:
> "VCI should be larger than 2.6V when using the internal VDD regulator"
> VCI = 3.3V > 2.6V → ✅ OK
> "The typical regulated VDD is about 2.5V"
> Komenda ABh z A[0]=1b włącza regulator.

Plan v2 jest poprawny — VCI=3.3V, VDD regulowany wewnętrznie. ✅

---

### ✅ UWAGA 12: GPIO przypisania ESP32 — zweryfikowane

Sprawdziłem wszystkie 19 GPIO:
- Żaden pin Flash SPI (6-11) nie jest użyty ✅
- GPIO 16, 17 (PSRAM) nie użyte ✅
- GPIO 36, 39 (niestabilne) nie użyte ✅
- GPIO 34, 35 użyte jako input → poprawne (input-only) ✅
- Strapping pins (2, 5, 12, 15) użyte z uwzględnieniem ograniczeń ✅
- I2C na GPIO 21/22 (domyślne I2C ESP32) ✅
- SPI na GPIO 18/23 (domyślne VSPI CLK/MOSI) ✅

---

## Zaktualizowana tabela pinów FFC 30-pin OLED (POPRAWIONA):

| Pin | Sygnał | Podłączenie | Zmiana vs v2 |
|-----|--------|-------------|-------------|
| 1 | N.C. (GND) | GND | — |
| 2 | VSS | GND | — |
| 3 | VCC | **12V–15V** (boost) | ⚠️ zakres |
| 4 | VCOMH | 4.7µF do GND | — |
| 5 | VLSS | GND | — |
| 6–11 | D7–D2 | GND | — |
| 12 | D1 → SDIN | GPIO 23 | — |
| 13 | D0 → SCLK | GPIO 18 | — |
| 14 | E/RD# | **GND** | ❌→✅ POPRAWIONE (było 3.3V) |
| 15 | R/W# | GND | — |
| 16 | BS0 | GND | — |
| 17 | BS1 | GND | — |
| 18 | DC# | GPIO 2 | — |
| 19 | CS# | GPIO 15 | — |
| 20 | RES# | GPIO 4 | — |
| 21 | FR | NC | — |
| 22 | IREF | **910kΩ do GND** | ⚠️ POPRAWIONE (było 820kΩ) |
| 23 | N.C. | NC | — |
| 24 | VDDIO | 3.3V + **10µF + 100nF** | ⚠️ bypass zwiększony (było 1µF) |
| 25 | VDD | 1µF do GND (wew. reg.) | — |
| 26 | VCI | 3.3V + 1µF | — |
| 27 | VSL | **NC (otwarty)** | ❌→✅ POPRAWIONE (był 1µF do GND) |
| 28 | VLSS | GND | — |
| 29 | VCC | **12V–15V** (boost) | ⚠️ zakres |
| 30 | N.C. (GND) | GND | — |

---

## Podsumowanie zmian:

| # | Co | Było | Powinno być | Krytyczność |
|---|-----|------|-------------|-------------|
| 1 | RES# czas LOW | 3µs | **100µs minimum** | 🔴 KRYTYCZNE |
| 2 | VCC zakres | 9-15V | **10-20V** (typowo 12-15V) | 🟡 ISTOTNE |
| 3 | IREF rezystor | 820kΩ | **910kΩ** (@12V VCC) | 🟡 ISTOTNE |
| 4 | Pin 27 VSL | 1µF do GND | **NC (otwarty)** | 🟡 ISTOTNE |
| 5 | Pin 14 E/RD# | 3.3V (HIGH) | **GND (LOW)** | 🔴 KRYTYCZNE |
| 6 | OV2640 DVDD | "1.2V" (w chat) | **1.3V** | 🟡 ISTOTNE |

Reszta planu (GPIO mapping, MCP23017, zasilanie kamery, boost converter) jest **poprawna**.

---

## Dodatkowe poprawki (v2.1) — z niezależnej weryfikacji

---

### ⚠️ UWAGA 13: Filtracja AVDD kamery OV2640 — wzmocniona

**W planie v2 było:**
> AVDD = 2.8V LDO + 1µF + 100nF bypass

**Rekomendacja po weryfikacji:**
AVDD to szyna analogowa kamery — szum na niej przekłada się **bezpośrednio**
na szum obrazu (fixed pattern noise, losowe piksele). Na płytce z przetwornicą
boost MT3608 (12V, switching ~1.2MHz) i WiFi ESP32 (piki prądowe do 300mA)
filtracja 1µF + 100nF może być niewystarczająca.

**KOREKTA:** Zmień bypass AVDD kamery na:
- **10µF** (ceramika X5R/X7R, 0805) + **100nF** (ceramika, 0402/0603)
- Oba kondensatory **jak najbliżej** pinu AVDD kamery (≤3mm od złącza FFC)
- Opcjonalnie: ferrite bead 600Ω@100MHz (np. BLM18PG601SN1) w szereg
  między LDO wyjściem a AVDD, po stronie LDO (przed kondensatorami)

```
LDO AP2112K-2.8 OUT ──[FB 600Ω]──┬── AVDD pin kamery (FFC)
                                   │
                                 [10µF]  [100nF]
                                   │       │
                                  GND     GND
```

Ferrite bead tłumi szum HF z boost convertera i WiFi, a 10µF daje
lepszy rezerwuar energii dla pikseli prądowych kamery.

**Dotyczy też DOVDD:** DOVDD współdzieli LDO z AVDD (2.8V), więc
na linii DOVDD też warto dać **10µF + 100nF** blisko pinu FFC kamery.

DVDD (1.3V) zostaje bez zmian — 1µF + 100nF wystarczy (digital core
jest mniej wrażliwy na szum zasilania niż analog).

---

### ⚠️ UWAGA 14: GND plane pod liniami SPI OLED — uwagi do routingu PCB

**Nie było w planie v2** (dotychczas tylko logika pinów, nie routing).

**Rekomendacja:**
Linie SPI OLED (GPIO 18 = SCLK, GPIO 23 = MOSI) taktowane do 10MHz+
wymagają ciągłego GND plane pod ścieżkami. Przerwanie GND plane pod
ścieżką SPI powoduje wzrost impedancji powrotnej i emisję EMI, co może:
- zakłócać ADC kamery (artefakty na obrazie)
- powodować glitche na I2C (bus lockup MCP23017 lub kamery)

**Zasady routingu:**
1. Linie SCLK i MOSI prowadzić jako parę, z GND flood/plane pod nimi
2. **Nie** przecinać ścieżek SPI liniami zasilania VCC 12V (boost)
3. Sekcja boost MT3608 (induktor, dioda SS14, kondensatory) w osobnym
   rogu PCB, z własnym GND polygon połączonym z głównym GND w jednym punkcie
4. Linie danych kamery D0-D7 (8-bit parallel) — length matching ±5mm
   dla PCLK do 20MHz
5. Pullup I2C 4.7kΩ umieścić blisko ESP32 (nie blisko urządzeń slave)

---

### ⚠️ UWAGA 15: Kondensator na VDDIO SSD1322 — wartość zwiększona

**W planie v2 było:**
> VDDIO (Pin 24) = 3.3V + 1µF

**Rekomendacja:**
VDDIO zasila bufor wejściowy SPI sterownika SSD1322. Przy szybkim SPI
(10MHz) prąd chwilowy na przełączanie stanów logicznych może powodować
krótkie spadki napięcia (droop) na VDDIO, co generuje błędy odczytu danych.

**KOREKTA:** Zmień bypass VDDIO na **10µF + 100nF** (zamiast samego 1µF).
Kondensatory umieść blisko pinu 24 FFC (≤5mm).
VCI (Pin 26) zostaje 1µF + 100nF (prąd analog jest mniejszy i bardziej stały).

---

### ✅ UWAGA 16: Potwierdzenie poprawności DOVDD = 2.8V (nie 3.3V)

Przy weryfikacji zewnętrznej pojawiło się założenie, że DOVDD = 3.3V.

**Potwierdzenie naszego planu:**
DOVDD = **2.8V** (współdzielone z AVDD, jeden LDO AP2112K-2.8).
Jest to poprawne — datasheet OV2640 podaje DOVDD = 1.7V–3.3V,
a 2.8V jest wartością typową stosowaną w referencyjnych schematach
OmniVision i w ESP32-CAM AI-Thinker.
3.3V też by zadziałało, ale 2.8V jest bezpieczniejsze dla interfejsu
I2C (SCCB) kamery i daje mniejszy pobór prądu.

---

## Zaktualizowana tabela podsumowania zmian (v2.1):

| # | Co | Było | Powinno być | Krytyczność |
|---|-----|------|-------------|-------------|
| 1 | RES# czas LOW | 3µs | **100µs minimum** | 🔴 KRYTYCZNE |
| 2 | VCC zakres | 9-15V | **10-20V** (typowo 12-15V) | 🟡 ISTOTNE |
| 3 | IREF rezystor | 820kΩ | **910kΩ** (@12V VCC) | 🟡 ISTOTNE |
| 4 | Pin 27 VSL | 1µF do GND | **NC (otwarty)** | 🟡 ISTOTNE |
| 5 | Pin 14 E/RD# | 3.3V (HIGH) | **GND (LOW)** | 🔴 KRYTYCZNE |
| 6 | OV2640 DVDD | "1.2V" (w chat) | **1.3V** | 🟡 ISTOTNE |
| 7 | AVDD bypass | 1µF+100nF | **10µF+100nF + opcja FB** | 🟡 ISTOTNE |
| 8 | DOVDD bypass | 1µF+100nF | **10µF+100nF** | 🟢 ZALECANE |
| 9 | VDDIO SSD1322 bypass | 1µF | **10µF+100nF** | 🟢 ZALECANE |

Poprawki 7-9 dotyczą filtracji zasilania i są **zalecane** (nie krytyczne),
ale znacząco poprawiają stabilność obrazu kamery i niezawodność SPI OLED
w obecności szumów z boost convertera i WiFi.
