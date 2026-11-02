# KalkMate v6, rev. 2026/10: lista zmian

Zmiany względem poprzedniej wersji płytki (ESP32-S3-WROOM-1-N16R8, kamera OV2640).

## Powód zmian

- OV2640: zdjęcia z poziomymi paskami (podejrzenie: szum zasilania lub WiFi, test z wyłączonym WiFi do wykonania), stały fokus (rozmyty tekst z bliska), zauważalna dystorsja obiektywu.
- Cel: lepsze zdjęcia zadań z kartki z odległości 10-25 cm, autofocus, mniej szumu w słabym świetle.

## 1. Kamera: OV2640 zmieniona na OV5640 z autofocusem

- Moduł OV5640 AF, 5 MP, złącze FPC 24 pin, interfejs DVP (8 bitów równolegle + SCCB).
- Wersja modułu z rysunku dostawcy: HS-OV5640-40AF-V2.0: EFL 3.6 mm, F2.5, kąt 70° ±2°, matryca 1/4" (2592x1944), moduł 8.5 x 8.5 mm, wysokość 4.95 mm, FPC 40 mm (końcówka 12.5 x 4.0 mm), sterownik VCM wbudowany w OV5640.
- Dostawca: Lifang Tang. MOQ 5 szt. Plan zamówienia: 20 szt. na start, potem ok. 350 szt. miesięcznie.
- Pinout kamery: standardowy z rysunku dostawcy (bez przeróbek na FPC).
- **AFVDD (pin 23) podłączony do 2.8 V** (wcześniej NC): bez tego autofocus nie działa. Pin 24 w module jest NC (masa silnika AF wewnętrznie), na płytce może zostać GND.
- Do potwierdzenia u dostawcy: strona pinu 1 w widoku od spodu (potrzebne: 24 po lewej, 01 po prawej, jak w OV2640), grubość końcówki FPC 0.30 mm (złącze Molex 5051102491).

### Przypisanie pinów kamery (bez zmian względem poprzedniej wersji)

| Sygnał | Pin ESP32 / źródło |
|---|---|
| SDA / SCL | GPIO40 / GPIO39 (wspólne z MCP23017) |
| VSYNC | GPIO5 |
| HREF | GPIO6 |
| MCLK (XCLK) | GPIO7 |
| PCLK | GPIO10 |
| Y9, Y8, Y7, Y6 | GPIO16, GPIO17, GPIO8, GPIO9 |
| Y5, Y4, Y3, Y2 | GPIO12, GPIO21, GPIO13, GPIO14 |
| RESET | MCP23017 GPA5 |
| PWDN | MCP23017 GPA6 |

## 2. Zasilanie kamery (przebudowane)

Podział na osobne szyny, wejścia z 3.3 V przez koralik ferrytowy i 10 µF, przy każdym LDO 1 µF na wejściu i wyjściu.

| Szyna | Napięcie | Układ | Uwagi |
|---|---|---|---|
| AVDD | 2.8 V | LP5907MFX-2.8 (LCSC C186700) | tylko analog sensora, 10 µF + 100 nF przy złączu |
| DOVDD + pull-upy I2C | 2.8 V | ta sama gałąź przez F1 (koralik 600 Ω) | zakres DOVDD w dokumentacji modułu 1.7-2.8 V |
| AFVDD | 2.8 V | osobny LDO 2.8 V | silnik AF, własny koralik i 4.7 µF |
| DVDD | 1.5 V | TLV75515PDBVR (LCSC C2867152) | wcześniej 1.2 V (XC6206P122MR), zakres 1.2-1.5 V |

- Wszystkie piny EN połączone z VIN.
- Stary XC6206P282MR (2.8 V) wymieniony na LP5907.

## 3. Bateria i ładowanie

### Pomiar stanu baterii: MAX17048 (U6)

- Fuel gauge, 1 ogniwo, I2C, adres 0x36 (bez kolizji z MCP23017 0x20).
- VDD i CELL do VBAT, C44 100 nF przy VDD, CTG, GND i QSTRT do GND.
- SDA/SCL: GPIO40/GPIO39 (istniejąca magistrala z pull-upami 2.8 V).
- **ALRT: BAT_ALRT na IO41**, pull-up R21 10 kΩ do 3.3 V (przerwanie niskiego stanu baterii).
- **Usunięty dzielnik 100 kΩ / 100 kΩ na GPIO3** (pomiar napięcia przez ADC).

### Status ładowania (MCP73831)

- Sygnał **CHRG na IO3**: STAT przez diodę D4 (BAT54, katoda do STAT, anoda do CHRG) i pull-up R15 10 kΩ do 3.3 V. Dioda blokuje 5 V ze STAT w stanie "naładowana".
  - LOW = ładowanie, HIGH = naładowana lub brak USB.
- Dioda LED (VBAT, LED1, R4 1 kΩ, STAT) świeci podczas ładowania.
- **VBUS_SENSE na IO38**: dzielnik R16 100 kΩ / R20 150 kΩ z VBUS (ok. 3.0 V przy 5 V). Pozwala odróżnić "naładowana" od "brak USB".
- Zmiany wartości przy MCP73831: R3 z 1 kΩ na 2.2 kΩ (prąd ładowania ok. 450 mA), C2 ze 100 nF na 4.7 µF.

## 4. Zajęte i wolne GPIO (nowe w tej wersji)

| Pin | Funkcja |
|---|---|
| IO3 | CHRG (status ładowania) |
| IO38 | VBUS_SENSE |
| IO41 | BAT_ALRT |
| IO42, IO48 | wolne |
| IO35, IO36, IO37 | **niedostępne** na module N16R8 (PSRAM Octal), nic tam nie podłączać |

## 5. Wpływ na firmware (do zrobienia)

- `camera.h`: sterownik OV5640 w esp32-camera, wgranie firmware AF po init, ustawienie zakresu ostrości, dobór `framesize` i `jpeg_quality`. RESET i PWDN nadal przez MCP23017 (`pin_reset = -1`, `pin_pwdn = -1`).
- Test pasków: zdjęcie z `WiFi.mode(WIFI_OFF)` przed `camBegin()`.
- Procent baterii z MAX17048 (np. biblioteka espp/max1704x), przerwanie na BAT_ALRT, odczyt CHRG i VBUS_SENSE jako GPIO.
- Aktualizacja `CLAUDE.md` (opisuje starą wersję z ESP32-WROVER i OV2640).

## 6. Do zweryfikowania przed zamówieniem

- ERC w Fusion bez błędów, brak powtórzonych oznaczeń (R15, R16 użyte w nowym układzie, stary dzielnik baterii musi być usunięty).
- W schemacie symbole LP5907 są opisane jako -2.85, a w BOM ma być **LP5907MFX-2.8/NOPB** (C186700). Dla DOVDD dokumentacja modułu podaje max 2.8 V.
- Wybór układu LDO 2.8 V dla AFVDD (drugi LP5907 albo inny) i jego prąd. Zapytać dostawcę o prąd i napięcie VCM.
- Pinout SOT-23-5 (EN, NC) dla LP5907, TLV75515 i pozostałych LDO sprawdzony w datasheetach.
- Stany magazynowe na LCSC (LP5907, TLV75515, MAX17048G+T10 C2682616, BAT54 C85084).
- Zakres prądu MCP73831 (R3) i napięcia STAT w oficjalnym datasheecie DS20001984.
- Zapytanie do dostawcy: minimalna odległość ostrzenia AF (potrzeba 8-10 cm), możliwość jaśniejszego obiektywu (F2.0), długość FPC, wolumeny i próbki.
- Kolejność włączania zasilania OV5640 względem PWDN i RESET (według datasheetu sensora).
