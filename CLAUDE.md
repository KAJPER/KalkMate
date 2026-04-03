# KalkMate — Przewodnik projektu dla Claude Code

## Czym jest KalkMate

Komercyjny produkt edukacyjny dla polskich uczniów — kalkulator wspomagany AI do rozwiązywania zadań maturalnych (matematyka, fizyka, chemia, biologia). Urządzenie robi zdjęcie zadania kamerą, wysyła je do serwera AI i wyświetla rozwiązanie na ekranie OLED. Alternatywa dla drogich korepetycji.

**Status projektu:** Pierwsza płytka zlutowana, trwa bring-up i debugowanie.

---

## Hardware — co jest na płytce

### Główny MCU
- **ESP32-WROVER-E** (WiFi + BT + 8MB PSRAM)
- Programowanie przez CH340C (USB-UART)
- USB-C przez kontroler USB4110GFA (QFN)

### Wyświetlacz
- **OLED SSD1322** 256×64, bare glass (chip COF na taśmie FFC)
- Złącze: Molex 505110-3091 (30-pin, 0.5mm, ZIF bottom contact)
- Interfejs: 4-wire SPI (BS0=GND, BS1=GND)
- Zasilanie: 12V z boost MT3608, logika 3.3V

### Kamera
- **OV2640**, moduł z FFC 24-pin
- Złącze: Molex 505110-2491 (24-pin, 0.5mm, ZIF bottom contact)
- Interfejs: 8-bit parallel + I2C/SCCB (adres 0x30)
- Zasilanie: AVDD/DOVDD=2.8V (AP2112K-2.8), DVDD=1.3V (XC6206P132MR)

### Klawiatura
- Matryca 5×5 (25 klawiszy), membranowa
- Sterowana przez MCP23017 (ekspander I2C, adres 0x20)

### Zasilanie
- Bateria LiPo 3.7V
- Ładowarka MCP73831 + ochrona DW01A + FS8205A
- LDO 3.3V: AP2112K-3.3
- Boost 12V: MT3608 + SS14 + induktor 22µH + dzielnik R1=380kΩ/R2=20kΩ
- LDO 2.8V: AP2112K-2.8 (kamera AVDD+DOVDD)
- LDO 1.3V: XC6206P132MR (kamera DVDD)

---

## GPIO ESP32 — finalne przypisanie

```
GPIO  2  → OLED DC#
GPIO  4  → OLED RES#
GPIO  5  → Kamera D0/Y2        (strapping pin!)
GPIO 12  → Kamera PCLK         (strapping pin!)
GPIO 13  → Kamera D3/Y5
GPIO 14  → Kamera D1/Y3
GPIO 15  → OLED CS#            (strapping pin)
GPIO 18  → OLED SCLK (VSPI)
GPIO 19  → Kamera D2/Y4
GPIO 21  → I2C SDA (MCP23017 + OV2640)
GPIO 22  → I2C SCL
GPIO 23  → OLED MOSI (VSPI)
GPIO 25  → Kamera XCLK (LEDC PWM 20MHz)
GPIO 26  → Kamera HREF
GPIO 27  → Kamera VSYNC
GPIO 32  → Kamera D6/Y8
GPIO 33  → Kamera D7/Y9
GPIO 34  → Kamera D4/Y6        (input-only, brak pullup)
GPIO 35  → Kamera D5/Y7        (input-only, brak pullup)
```

**Piny zakazane:** 1,3 (UART), 6-11 (Flash SPI), 16,17 (PSRAM), 36,37,38,39

**GPIO 0** — zarezerwowany na BOOT, nie przypisany do niczego.

### MCP23017 port mapping

```
GPA0-GPA4 → Klawiatura ROW 0-4 (OUTPUT, skanowanie)
GPA5      → Kamera PWDN (HIGH = power down)
GPA6      → Kamera RESET# (LOW = reset) + pullup 10kΩ → 2.8V
GPA7      → Boost MT3608 EN (HIGH = 12V ON)
GPB0-GPB4 → Klawiatura COL 0-4 (INPUT + pullup wewnętrzny)
GPB5      → LED status
GPB6      → Buzzer (przez N-MOSFET 2N7002)
GPB7      → wolny
```

---

## Środowisko deweloperskie

- **IDE:** PlatformIO (VSCode)
- **Board:** `esp32dev` (jedyne działające ID w PlatformIO; `esp32wrover` nie istnieje jako board ID)
- **Framework:** Arduino (ESP32 Arduino core)
- **Monitor/upload port:** COM4 (CH340C)
- **Baud rate:** 115200

### platformio.ini (bazowy)
```ini
[env:esp32wrover]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200
upload_port = COM4
monitor_port = COM4
board_build.partitions = huge_app.csv
board_build.flash_mode = qio
board_upload.flash_size = 4MB
lib_ldf_mode = deep+
lib_deps =
    olikraus/U8g2@>=2.35.0
    adafruit/Adafruit MCP23017 Arduino Library@>=2.3.0
    https://github.com/espressif/esp32-camera.git
build_flags =
    -DBOARD_HAS_PSRAM
    -mfix-esp32-psram-cache-issue
    -DCORE_DEBUG_LEVEL=1
```

### Tryb flash ESP32
Przytrzymaj BOOT → naciśnij RESET → puść RESET → puść BOOT.
CH340C ma DTR/RTS więc zazwyczaj auto-reset działa.

---

## Biblioteki

| Biblioteka | Przeznaczenie |
|-----------|---------------|
| U8g2 ≥2.35 | SSD1322 256×64, HW SPI |
| esp_camera (ESP-IDF) | OV2640 driver, 8-bit parallel + PSRAM |
| Adafruit MCP23017 Arduino Library ≥2.3 | Ekspander I2C |

---

## Definicje pinów (wklej do kodu)

```cpp
// === OLED SSD1322 (HW VSPI) ===
#define OLED_CLK   18
#define OLED_MOSI  23
#define OLED_CS    15
#define OLED_DC     2
#define OLED_RST    4

// === Kamera OV2640 ===
#define CAM_D0      5
#define CAM_D1     14
#define CAM_D2     19
#define CAM_D3     13
#define CAM_D4     34   // input-only
#define CAM_D5     35   // input-only
#define CAM_D6     32
#define CAM_D7     33
#define CAM_PCLK   12
#define CAM_XCLK   25
#define CAM_VSYNC  27
#define CAM_HREF   26
#define CAM_SDA    21
#define CAM_SCL    22
#define CAM_PWDN   -1   // przez MCP23017 GPA5
#define CAM_RESET  -1   // przez MCP23017 GPA6

// === I2C ===
#define I2C_SDA    21
#define I2C_SCL    22

// === MCP23017 ===
#define MCP_ADDR   0x20   // A0=A1=A2=GND
// Numery pinów Adafruit MCP23X17: GPA0=0..GPA7=7, GPB0=8..GPB7=15
#define MCP_GPA5   5   // kamera PWDN
#define MCP_GPA6   6   // kamera RESET#
#define MCP_GPA7   7   // Boost EN
#define MCP_GPB5   13  // LED status
#define MCP_GPB6   14  // Buzzer
// OV2640 SCCB adres: 0x30
```

---

## Inicjalizacja OLED SSD1322

```cpp
// U8G2 konstruktor (HW SPI):
U8G2_SSD1322_NHD_256X64_F_4W_HW_SPI u8g2(
    U8G2_R0, /* cs=*/ 15, /* dc=*/ 2, /* reset=*/ 4
);

// Kolejność power-on (KRYTYCZNA!):
// 1. Boost ON (MCP GPA7 = HIGH) → czekaj 50ms
// 2. u8g2.begin()
// 3. Włącz wewnętrzny VDD regulator:
u8g2.sendCommand(0xAB);
u8g2.sendCommand(0x01);
// 4. Wyślij komendy init, na końcu AFh (Display ON)

// RES# LOW musi trwać MINIMUM 100µs (nie 3µs!)
// Pin 14 FFC (E/RD#) = GND (nie VCC!)
// Pin 27 FFC (VSL) = NC (nie podłączony!)
// IREF (pin 22) = 910kΩ do GND (przy VCC=12V)
```

---

## Inicjalizacja kamery OV2640

```cpp
// WAŻNE: Najpierw ustaw GPIO 12 flash voltage (JEDNORAZOWE):
// espefuse.py --port COM4 set_flash_voltage 3.3V

// Sekwencja power-on kamery:
// mcp.digitalWrite(MCP_GPA5, LOW);   // PWDN = LOW (kamera ON)
// delay(10);
// mcp.digitalWrite(MCP_GPA6, LOW);   // RESET pulse
// delay(5);
// mcp.digitalWrite(MCP_GPA6, HIGH);
// delay(20);

camera_config_t config;
config.ledc_channel = LEDC_CHANNEL_0;
config.ledc_timer   = LEDC_TIMER_0;
config.pin_d0 = 5;  config.pin_d1 = 14; config.pin_d2 = 19;
config.pin_d3 = 13; config.pin_d4 = 34; config.pin_d5 = 35;
config.pin_d6 = 32; config.pin_d7 = 33;
config.pin_xclk     = 25;
config.pin_pclk     = 12;
config.pin_vsync    = 27;
config.pin_href     = 26;
config.pin_sccb_sda = 21;
config.pin_sccb_scl = 22;
config.pin_pwdn     = -1;   // przez MCP23017
config.pin_reset    = -1;   // przez MCP23017
config.xclk_freq_hz = 10000000;  // 10MHz (stabilniejsze z WiFi)
config.pixel_format = PIXFORMAT_JPEG;
config.frame_size   = FRAMESIZE_SVGA;
config.jpeg_quality = 12;
config.fb_count     = 2;
config.grab_mode    = CAMERA_GRAB_LATEST;
```

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
MCP GPA7 HIGH  → Boost ON  → OLED VCC 12V  (~140mA oszczędność gdy OFF)
MCP GPA5 HIGH  → Kamera PWDN              (~50mA oszczędność)
WiFi.mode(WIFI_OFF)                        (~80mA oszczędność)

Workflow kamera → WiFi:
1. Kamera ON (PWDN=LOW, reset, esp_camera_init)
2. Zrób zdjęcie → skopiuj do PSRAM
3. Kamera OFF (PWDN=HIGH, esp_camera_deinit)  ← PRZED WiFi!
4. WiFi ON → upload JPEG → WiFi OFF
(XCLK kamery 10-20MHz zakłóca WiFi 2.4GHz)
```

---

## Pułapki i znane problemy

### GPIO 12 (PCLK kamery) — flash voltage
GPIO 12 = strapping pin MTDI. Jeśli kamera ściągnie go HIGH przy boot → ESP32 ustawi flash na 1.8V → crash. Rozwiązanie (jednorazowe, nieodwracalne):
```bash
espefuse.py --port COM4 set_flash_voltage 3.3V
```

### OLED tryb SPI
Panel może przyjść w trybie 8080 parallel (fabryczny). Piny 16 (BS0) i 17 (BS1) FFC muszą być podłączone do GND. Na taśmie FPC rezystory 0Ω muszą być w pozycji "00".

### USB4110GFA (QFN)
Trudny do ręcznego lutowania. Mostki cyny pod spodem są niewidoczne. Pierwsze podejrzenie przy każdym problemie USB. CC1/CC2 mają pulldown 5.1kΩ do GND — sprawdź opór VBUS↔CC1 i VBUS↔CC2 (powinno być ~5.1kΩ, nie 0Ω).

### Kamera — pinout FFC
Pinout 24-pin różni się między producentami (AliExpress, Arducam, Waveshare). Zawsze weryfikuj multimetrem przed lutowaniem.

### DVDD kamery
DVDD = **1.3V** (nie 1.2V!). XC6206P132MR daje dokładnie 1.3V.

---

## Dostawcy komponentów

- TME (Polska) — główny
- Farnell / Mouser (EU)
- AliExpress / eBay EU — trudniej dostępne części

---

## Pliki w projekcie

| Plik | Co zawiera |
|------|-----------|
| `pcb_complete_v3_FINAL.md` | Kompletny przewodnik połączeń PCB — jedyne obowiązujące źródło prawdy |
| `gpio_plan_errata_v2.1.md` | Korekty do wcześniejszego planu (naniesione w FINAL) |
| `pcb_tutorial_build_guide.md` | Tutorial budowy krok po kroku z testami |
| `CLAUDE.md` | Ten plik |

Schemat PCB: Fusion 360 (projekt kalkulator v47+)
