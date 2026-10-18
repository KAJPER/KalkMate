# KalkMate — Przewodnik projektu dla Claude Code

## Czym jest KalkMate

Komercyjny produkt edukacyjny dla polskich uczniów — kalkulator wspomagany AI do rozwiązywania zadań maturalnych (matematyka, fizyka, chemia, biologia). Urządzenie robi zdjęcie zadania kamerą, wysyła je do serwera AI i wyświetla rozwiązanie na ekranie OLED. Alternatywa dla drogich korepetycji.

**Status projektu:** Produkt gotowy i w sprzedaży.

---

## Hardware — co jest na płytce (PCB v4)

> Źródłem prawdy dla pinów i sekwencji init jest kod: `src/main.cpp` (OLED,
> boost), `src/camera.h` (kamera), `src/input.h` (I2C, MCP23017, klawiatura),
> `src/battery.h` (bateria), `platformio.ini` (build). Poniżej skrót.
> Stara płytka ESP32-WROVER-E (PCB v3) nie jest już wspierana — firmware
> buduje się wyłącznie dla ESP32-S3.

### Główny MCU
- **ESP32-S3-WROOM-1-N16R8** (16MB flash QIO + 8MB PSRAM OPI)
- USB-C natywne USB S3 (GPIO19 = D-, GPIO20 = D+, ochrona USBLC6-2SC6), USB-CDC

### Wyświetlacz
- **OLED SSD1322** 256×64, bare glass (chip COF na taśmie FFC)
- Złącze: Molex 505110-3091 (30-pin, 0.5mm, ZIF bottom contact)
- Interfejs: 4-wire SPI (BS0=GND, BS1=GND)
- Zasilanie: 12V z boost MT3608 (EN = GPIO47), logika 3.3V

### Kamera
- **OV2640**, moduł z FFC 24-pin
- Złącze: Molex 505110-2491 (24-pin, 0.5mm, ZIF bottom contact)
- Interfejs: 8-bit parallel + I2C/SCCB (adres 0x30), wspólna magistrala I2C z MCP23017
- PWDN / RESET# przez MCP23017

### Klawiatura
- Membrana kalkulatora (Esperanza T8809-2), 10 ścieżek FFC → MCP23017, 27 klawiszy, pair-scan (patrz `input.h`)
- MCP23017 (ekspander I2C, adres 0x20)

### Zasilanie / bateria
- Bateria LiPo 3.7V, ładowarka MCP73831 + ochrona DW01A + FS8205A
- Boost 12V dla OLED: MT3608, EN bezpośrednio z GPIO47
- Pomiar baterii: MAX17048 (I2C 0x36) + CHRG=GPIO3, VBUS_SENSE=GPIO38;
  na starszych egzemplarzach v4 bez MAX17048 — dzielnik ADC na GPIO3 (`battery.h` wykrywa automatycznie)

---

## GPIO ESP32-S3 — przypisanie (wg kodu)

```
GPIO  2  → OLED DC#
GPIO  3  → MCP73831 CHRG (wariant MAX17048) / ADC dzielnika baterii (wariant bez MAX17048)
GPIO  4  → OLED RES#
GPIO  5  → Kamera VSYNC
GPIO  6  → Kamera HREF
GPIO  7  → Kamera XCLK
GPIO  8  → Kamera D5/Y7
GPIO  9  → Kamera D4/Y6
GPIO 10  → Kamera PCLK
GPIO 11  → OLED MOSI
GPIO 12  → Kamera D3/Y5
GPIO 13  → Kamera D1/Y3
GPIO 14  → Kamera D0/Y2
GPIO 15  → OLED CS#
GPIO 16  → Kamera D7/Y9
GPIO 17  → Kamera D6/Y8
GPIO 18  → OLED SCLK
GPIO 19  → USB D-
GPIO 20  → USB D+
GPIO 21  → Kamera D2/Y4
GPIO 38  → VBUS_SENSE (HIGH = USB wpięte)
GPIO 39  → I2C SCL (MCP23017 + OV2640 SCCB + MAX17048)
GPIO 40  → I2C SDA
GPIO 41  → MAX17048 ALRT (nieużywany)
GPIO 47  → Boost MT3608 EN (HIGH = 12V ON)
```

### MCP23017 (0x20)

```
GPA0-GPA4, GPB0-GPB4 → klawiatura (10 linii, pair-scan; INPUT_PULLUP w idle)
GPA5                 → Kamera RESET#
GPA6                 → Kamera PWDN
GPA7                 → nieużywany
```

---

## Środowisko deweloperskie

- **IDE:** PlatformIO (VSCode)
- **Jedyne środowisko:** `esp32s3` (board `esp32-s3-devkitc-1`, `default_16MB.csv`,
  `board_build.arduino.memory_type = qio_opi` — bez tego PSRAM nie wstaje)
- **Framework:** Arduino (ESP32 Arduino core)
- **Upload/monitor:** natywne USB-CDC (porty COM w `platformio.ini`)
- **Baud rate:** 115200
- Build: `pio run -e esp32s3`; pełna konfiguracja (build_flags, lib_deps) — patrz `platformio.ini`

---

## Biblioteki

| Biblioteka | Przeznaczenie |
|-----------|---------------|
| U8g2 ≥2.35 | SSD1322 256×64, HW SPI |
| esp_camera (ESP-IDF) | OV2640 driver, 8-bit parallel + PSRAM |
| Adafruit MCP23017 Arduino Library ≥2.3 | Ekspander I2C |
| ricmoo/QRCode | QR z Device ID |

---

## Inicjalizacja OLED SSD1322

```cpp
// main.cpp — U8G2 HW SPI, ekran obrócony (R2):
U8G2_SSD1322_NHD_256X64_F_4W_HW_SPI u8g2(
    U8G2_R2, /*cs=*/15, /*dc=*/2, /*reset=*/4
);

// Kolejność power-on (KRYTYCZNA!):
// 1. Boost ON (GPIO47 = HIGH) → czekaj ~20ms (MT3608 soft-start)
// 2. SPI.begin(18, -1, 11, 15) — na S3 piny SPI trzeba wymusić PRZED u8g2.begin()
// 3. u8g2.begin()

// RES# LOW musi trwać MINIMUM 100µs (nie 3µs!)
// Pin 14 FFC (E/RD#) = GND (nie VCC!)
// Pin 27 FFC (VSL) = NC (nie podłączony!)
// IREF (pin 22) = 910kΩ do GND (przy VCC=12V)
```

---

## Inicjalizacja kamery OV2640

Patrz `src/camera.h` (`camBegin()` — JPEG, `camBeginPreview()` — grayscale QQVGA
dla podglądu). XCLK 10 MHz (stabilniej z WiFi), PWDN/RESET# przez MCP23017,
`camBegin()` wymaga wcześniejszego `inputBegin()` (MCP gotowy).

---

## Backend / OTA

- **Serwer:** FastAPI na Ubuntu VPS, nginx reverse proxy, systemd
- **OTA:** Pull-based — ESP32 odpytuje serwer `/firmware/latest`
- **Moduł OTA:** `ota_update.h` — self-contained, jedna publiczna funkcja
- **WAŻNE:** `FW_VERSION` musi być ręcznie inkrementowany przed każdym buildem
- Postęp OTA wyświetlany na OLED przez U8G2

---

## System prompt AI (matura solver)

Stworzony pod polskie egzaminy maturalne, oparty na arkuszach CKE i standardach oceniania. Obsługuje: matematykę, fizykę, chemię, biologię.

---

## Zarządzanie energią

```
GPIO47 LOW     → Boost OFF → OLED VCC 12V off (auto-sleep, deep sleep przy niskiej baterii — power.h)
MCP GPA6 HIGH  → Kamera PWDN              (~50mA oszczędność)
WiFi.mode(WIFI_OFF)                        (~80mA oszczędność)

Workflow kamera → WiFi:
1. Kamera ON (PWDN=LOW, reset, esp_camera_init)
2. Zrób zdjęcie → skopiuj do PSRAM
3. Kamera OFF (PWDN=HIGH, esp_camera_deinit)  ← PRZED WiFi!
4. WiFi ON → upload JPEG → WiFi OFF
(XCLK kamery zakłóca WiFi 2.4GHz)
```

---

## Pułapki i znane problemy

### OLED tryb SPI
Panel może przyjść w trybie 8080 parallel (fabryczny). Piny 16 (BS0) i 17 (BS1) FFC muszą być podłączone do GND. Na taśmie FPC rezystory 0Ω muszą być w pozycji "00".

### USB4110GFA (QFN)
Trudny do ręcznego lutowania. Mostki cyny pod spodem są niewidoczne. Pierwsze podejrzenie przy każdym problemie USB. CC1/CC2 mają pulldown 5.1kΩ do GND — sprawdź opór VBUS↔CC1 i VBUS↔CC2 (powinno być ~5.1kΩ, nie 0Ω).

### Kamera — pinout FFC
Pinout 24-pin różni się między producentami (AliExpress, Arducam, Waveshare). Zawsze weryfikuj multimetrem przed lutowaniem.

### DVDD kamery
DVDD = **1.3V** (nie 1.2V!). XC6206P132MR daje dokładnie 1.3V.

### Kod AI zawiera cyfrę na martwym klawiszu → urządzenie zablokowane na dobre
Wejście do JAKIEGOKOLWIEK menu (w tym Ustawień, gdzie dopiero można zmienić
kod) wymaga wpisania obecnego kodu AI. Jeśli klawisz użyty w kodzie się
zepsuje (np. wada membrany), użytkownik nie ma jak zmienić kodu — zamknięte
koło, a na PROD_REL (eFuse Release lock) nie da się też przeflashować przez
USB ani dosięgnąć OTA (ono też jest za tym samym kodem).

**Zabezpieczenie (od fw 1.7.2+):** w trybie kalkulatora (ekran "0", przed
wpisaniem kodu) przytrzymaj **C/CE przez 5s** → menu potwierdzenia → **OK**
= pełny reset fabryczny (WiFi, kod AI, panic key, historia, notatki,
sprawdziany, powiązanie z kontem), **C/CE** = anuluj. Ten sam zakres co
„Ustawienia → Reset fabryczny", tylko dostępny zanim jeszcze da się wejść
do menu — nie trzeba łapać momentu włączania (to była wcześniejsza,
niewygodna wersja z fw 1.7.0-1.7.1). Patrz `factory_reset.h`
(`factoryResetRun()`, wspolne dla kalkulatora i Ustawien) + hold-detection
w `runCalculator()` (`calculator.h`). Od fw 2.0.0 reset czysci tez kolejke
offline i ustawia flage `unpair` w NVS `kalkid` (token urzadzenia zostaje) —
przy nastepnej rejestracji serwer odpina urzadzenie od konta. Nie pomaga
to urządzeniom z firmware sprzed 1.7.0 (nie da się tego dostarczyć wstecz
na już zablokowany egzemplarz — brak ścieżki USB i OTA).

---

## Dostawcy komponentów

- TME (Polska) — główny
- Farnell / Mouser (EU)
- AliExpress / eBay EU — trudniej dostępne części

---

## Pliki w projekcie

| Plik | Co zawiera |
|------|-----------|
| `platformio.ini` | Konfiguracja buildu (jedyne env: `esp32s3`) |
| `src/main.cpp`, `src/*.h` | Firmware — źródło prawdy dla pinów i sekwencji init |
| `CLAUDE.md` | Ten plik |

Schemat PCB: Fusion 360 (projekt kalkulator v47+)
