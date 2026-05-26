# KalkMate — Opis oprogramowania i protokołów komunikacyjnych

**Dokument:** Specyfikacja techniczna firmware oraz protokołów łączności
**Produkt:** KalkMate v1.0 — kalkulator edukacyjny z funkcją AI
**Wersja firmware:** 1.0.0 (PCB v4, ESP32-S3-WROOM-1-N16R8)
**Data:** 2026-05-26

---

## 1. Architektura systemu

### 1.1 Warstwa sprzętowa

Urządzenie zbudowane jest wokół mikrokontrolera **Espressif ESP32-S3-WROOM-1-N16R8** zawierającego:

- Dwurdzeniowy procesor Xtensa LX7 (240 MHz)
- 16 MB pamięci flash (Quad-SPI)
- 8 MB pamięci PSRAM (Octal-SPI)
- Zintegrowany moduł WiFi IEEE 802.11 b/g/n (2,4 GHz)
- Bluetooth Low Energy 5.0 *(nieużywany w obecnej wersji firmware)*
- Natywny kontroler USB OTG (USB-CDC do programowania i serial monitor)

Peryferia podłączone do MCU:
- Wyświetlacz OLED **SSD1322** 256×64 monochromatyczny — interfejs 4-wire SPI
- Ekspander GPIO **MCP23017** — interfejs I²C (adres `0x20`) — obsługa klawiatury matrycowej 27 klawiszy oraz sterowanie zasilaniem peryferiów
- Moduł aparatu **OmniVision OV2640** (2 Mpx) — interfejs równoległy 8-bit + SCCB (I²C)
- Przetwornica step-up **MT3608** generująca 14,5 V dla wysokonapięciowej szyny zasilania OLED
- Bateria LiPo 3,7 V 2000 mAh z układem ładowania MCP73831 + zabezpieczeniem DW01A/FS8205A

### 1.2 Warstwa firmware

Firmware zbudowany w środowisku **PlatformIO** z użyciem **Arduino ESP32 Core** (frameworku opartego o ESP-IDF i FreeRTOS). Architektura modułowa, header-only — każdy moduł funkcjonalny w osobnym pliku `.h`:

| Moduł | Plik | Funkcjonalność |
|---|---|---|
| Punkt wejścia | `main.cpp` | Inicjalizacja, menu główne, dyspozycja UI |
| Obsługa klawiatury | `input.h` | Skanowanie matrycy 27 klawiszy przez MCP23017, debouncing |
| Wyświetlacz | (U8g2) | Sterowanie OLED SSD1322 przez SPI |
| Kalkulator | `calculator.h` | Tryb kalkulatora 4 działań, unlock-code do trybu AI |
| AI | `solve_screen.h` | Klawiatura ekranowa, wysyłka zapytań HTTPS, wyświetlanie odpowiedzi |
| Notatki | `notes.h` | Pobieranie i wyświetlanie notatek z serwera, magazyn SPIFFS |
| Sprawdziany | `tests.h` | Analogicznie do notatek, plus konwersja LaTeX → ASCII |
| Aktualizacje | `ota_update.h` | Pobieranie i instalacja firmware przez HTTPS |
| WiFi | `wifi_settings.h`, `wifi_persist.h` | Konfiguracja sieci, zapis poświadczeń w NVS |
| Konto użytkownika | `device_account.h` | Komunikacja z serwerem o sparowaniu urządzenia |
| Panic | `panic.h` | Awaryjny powrót do trybu kalkulatora |
| Bezpieczeństwo zasilania | `power.h` | Auto-sleep OLED, oszczędzanie baterii |
| Historia | `history.h` | Cache wcześniejszych zapytań AI w NVS |

Całkowity rozmiar firmware: **~1 MB** (kompresji nie stosuje się).

### 1.3 Magazyn danych

| Pamięć | Rozmiar | Zawartość |
|---|---|---|
| Flash (program) | 6,25 MB × 2 (OTA A/B) | Firmware (aktywny + zapasowy do rollbacku) |
| Flash (NVS) | 24 KB | Konfiguracja: SSID/hasło WiFi, kod licencji, ustawienia użytkownika, historia zapytań, mapowanie klawiatury |
| Flash (SPIFFS) | ~2 MB | Notatki użytkownika, sprawdziany (LaTeX/markdown) |
| RAM (SRAM) | 320 KB | Stos i sterta wykonawcza |
| PSRAM | 8 MB | Bufory ramki JPEG z aparatu, parsing dużych odpowiedzi JSON |

Wszystkie dane przechowywane lokalnie są zapisane w pamięci flash i przetrwują wyłączenie zasilania. Brak nielotnego magazynu dla danych szczególnie wrażliwych (np. nie przechowujemy haseł użytkowników).

---

## 2. Łączność WiFi (IEEE 802.11)

### 2.1 Standardy

Urządzenie obsługuje:
- **IEEE 802.11 b/g/n** (2,4 GHz, pasmo ISM 2400–2483,5 MHz)
- Kanały 1–13 (Europa, CEPT)
- Sieci 5 GHz **nie są obsługiwane** (limitacja modułu radia ESP32-S3)
- Tryb pracy: **Station (STA)** — kalkulator jako klient WiFi
- Tryb Access Point nie jest aktywowany w produkcji

### 2.2 Bezpieczeństwo

Obsługiwane mechanizmy uwierzytelniania i szyfrowania:

| Standard | Wsparcie | Komentarz |
|---|---|---|
| **WPA2-PSK (CCMP/AES)** | ✓ Pełne | Główny tryb używany w domach i szkołach |
| WPA-PSK (TKIP) | ✓ Tylko legacy | Zalecane przejście na WPA2 |
| WEP | ✓ Tylko legacy | Niezalecane — niezgodny ze współczesnymi standardami bezpieczeństwa |
| WPA3-SAE | ⚠ Częściowe | Wymaga aktualizacji frameworku |
| Sieci otwarte | ✓ | Dopuszczalne, np. hotspoty |

Hasło WiFi przechowywane lokalnie w pamięci NVS (partycja `kalkmate`, klucz `wifi_pass`). Pamięć NVS chroniona przez sumę kontrolną CRC32 — modyfikacja zawartości flash bez znajomości algorytmu jest wykrywana. Hasło nie jest szyfrowane sprzętowo (brak flash encryption w obecnej wersji), zakładamy fizyczne bezpieczeństwo urządzenia.

### 2.3 Moc nadawcza

Konfiguracja firmware ustawia maksymalną moc nadawczą TX na **11 dBm** (~12,5 mW EIRP):
```cpp
WiFi.setTxPower(WIFI_POWER_11dBm);
```

Wartość znajduje się znacząco poniżej limitów regulacyjnych CEPT/UE (100 mW = 20 dBm) i pozwala uniknąć spadków napięcia baterii podczas transmisji.

### 2.4 Auto-łączenie

Po pomyślnym podłączeniu się do sieci WiFi (akcja użytkownika w menu konfiguracji), poświadczenia są zapisywane w NVS i przy kolejnych włączeniach urządzenia kalkulator próbuje automatycznie połączyć się z ostatnio użytą siecią. W przypadku niedostępności sieci użytkownik może uruchomić ponowne skanowanie (Menu → Ustawienia → WiFi).

---

## 3. Łączność serwerowa (HTTPS)

Wszystkie zapytania do serwera centralnego (**kalkmate.pl**) odbywają się wyłącznie po HTTPS — ruch w warstwie aplikacyjnej jest szyfrowany.

### 3.1 Standardy kryptograficzne

| Element | Standard |
|---|---|
| Protokół transportu | **TLS 1.2** (minimum), TLS 1.3 (jeśli serwer wspiera) |
| Wymiana klucza | ECDHE (Elliptic Curve Diffie-Hellman, krzywe P-256/P-384) |
| Algorytm szyfrowania | AES-256-GCM, ChaCha20-Poly1305 |
| Hash | SHA-256 / SHA-384 |
| Certyfikat serwera | ECDSA, **Let's Encrypt** (ISRG Root X1) |
| Walidacja | `WiFiClientSecure.setInsecure()` — *uwaga, patrz pkt 3.7* |

### 3.2 Endpoint'y API

Wszystkie endpoint'y dostępne są pod prefiksem `https://kalkmate.pl/api/`:

| Endpoint | Metoda | Cel |
|---|---|---|
| `/device/register` | POST | Rejestracja urządzenia (deviceId + unlockCode) |
| `/device/account-status` | GET | Sprawdzenie sparowania z kontem użytkownika |
| `/device/solve` | POST | Wysłanie pytania do AI (tekst lub obraz JPEG) |
| `/device/notes` | GET | Pobranie notatek przypisanych do konta |
| `/device/tests` | GET | Pobranie sprawdzianów |
| `/device/conversations` | GET | Historia rozwiązań AI |
| `/firmware/latest` | GET | Sprawdzenie najnowszej wersji firmware (do OTA) |
| `/firmware/v{wersja}.bin` | GET | Pobranie binariów firmware do aktualizacji |

### 3.3 Uwierzytelnianie

Każde zapytanie HTTP zawiera nagłówki:

```
x-api-key: <statyczny klucz API kalkulatora>
x-device-id: <12-znakowy MAC adres modułu WiFi, hex bez separatorów>
x-fw-version: <wersja firmware, np. "1.0.0">
```

Pole `x-api-key` jest globalnym sekretem aplikacji, identyfikującym żądania pochodzące z prawdziwego urządzenia KalkMate (vs. ruch bot/spam). Konkretne urządzenie identyfikowane jest przez `x-device-id` — odpytanie bazy `Device.userId` zwraca przypisanego użytkownika.

Klucz API w obecnej wersji jest **wspólny dla wszystkich urządzeń** i jest umieszczony statycznie w firmware. Stanowi to teoretyczny wektor ataku w przypadku reverse-engineeringu binariów (chip ESP32-S3 wspiera flash encryption — opcjonalnie do wdrożenia w kolejnych iteracjach produktu).

### 3.4 Format danych

| Strona | Format |
|---|---|
| Zapytania (body POST) | JSON (`application/json; charset=utf-8`) |
| Odpowiedzi | JSON |
| Obrazy z aparatu | `multipart/form-data` z polem `image` typu JPEG |

Parsowanie JSON na ESP32 odbywa się własnym parserem (nie ArduinoJson) — zoptymalizowanym pod kątem niskiego zużycia pamięci. Duże odpowiedzi (>50 KB) są strumieniowane z TCP socketu bezpośrednio do bufora w PSRAM, parsowane "w locie" i zapisywane do SPIFFS, bez bufora pośredniego w stosie SRAM.

### 3.5 Sesja AI (przykładowy przebieg)

1. Użytkownik wpisuje treść zadania na klawiaturze ekranowej lub robi zdjęcie aparatem
2. Firmware łączy się z `kalkmate.pl/api/device/solve` przez HTTPS (`POST`)
3. Body zawiera: `{deviceId, mode: "text" | "image", question | image_base64, subject?}`
4. Serwer pośredniczy przez **Cloudflare Worker** (kalkmate.gordulek.workers.dev) do **Google Gemini API** — Worker służy do ominięcia geo-blokady (serwer fizyczny w OVH Italy)
5. Odpowiedź (~5-30 sekund) zwracana w polu `answer` (treść tekstowa do 16 KB)
6. Kalkulator zapisuje pytanie+odpowiedź w lokalnej historii (NVS) i wyświetla wynik

Limit czasu pojedynczego zapytania: **45 sekund** (`HTTPClient.setTimeout(45000)`).

### 3.6 Aktualizacje firmware (OTA)

Mechanizm aktualizacji "over-the-air" wykorzystuje partycję dual-app A/B:

1. Użytkownik wybiera **Ustawienia → Aktualizacje → OK**
2. Kalkulator pobiera `GET /firmware/latest` — odpowiedź zawiera najnowszą dostępną wersję i URL pliku binarnego
3. Jeśli wersja jest nowsza niż lokalna — kalkulator pyta użytkownika o potwierdzenie
4. Pobiera plik (`firmware.bin`, ~1 MB) przez HTTPS i zapisuje do nieaktywnej partycji (np. `app1` jeśli aktualnie uruchomiony z `app0`)
5. Po pomyślnej weryfikacji checksumy oznacza nową partycję jako rozruchową i wywołuje restart
6. W przypadku awarii nowego firmware'u (np. trzykrotny boot loop) bootloader ESP32 automatycznie wraca do poprzedniej, działającej partycji

### 3.7 Walidacja certyfikatów

W obecnej wersji firmware używany jest `WiFiClientSecure.setInsecure()` — **walidacja łańcucha certyfikatów X.509 jest wyłączona**. To pragmatyczny kompromis na rzecz:
- Mniejszego rozmiaru firmware (eliminacja pełnego store CA — ~50 KB)
- Eliminacji konieczności aktualizacji bundles CA wraz z firmware
- Możliwości pracy w sieciach z corporate proxy

Konsekwencje:
- Ruch pozostaje **szyfrowany** (kanał TLS jest negocjowany prawidłowo, klucze sesyjne ustanawiane)
- Aplikacja jest podatna na atak **MITM** (Man-in-the-Middle) w przypadku pełnego kontroli infrastruktury sieci przez napastnika (np. fałszywy access point + DNS spoofing)
- Mitygacja: dane przesyłane do AI nie zawierają informacji wrażliwych (treść zadania matematycznego, nie dane osobowe / finansowe)

Pełna walidacja certyfikatu jest rozważana w przyszłych wersjach firmware z mechanizmem auto-aktualizacji listy CA.

---

## 4. Komunikacja peryferiów wewnątrz urządzenia

### 4.1 SPI (Wyświetlacz OLED)

| Parametr | Wartość |
|---|---|
| Protokół | 4-wire SPI (SCK, MOSI, CS, DC) |
| Tryb | Mode 0 (CPOL=0, CPHA=0) |
| Częstotliwość | 8 MHz |
| Sterownik | SSD1322 (256×64 monochromatyczny OLED) |
| Biblioteka | U8g2 ≥ 2.35 |

### 4.2 I²C (Ekspander GPIO + Aparat)

| Parametr | Wartość |
|---|---|
| Protokół | I²C (Inter-Integrated Circuit) |
| Częstotliwość | 400 kHz (Fast Mode) |
| Adresy | MCP23017: `0x20` (7-bit), OV2640 SCCB: `0x30` |
| Pull-up | 10 kΩ na liniach SDA/SCL |

Adresy `0x20` (MCP) i `0x30` (kamera) nie kolidują — komunikacja na wspólnej magistrali jest możliwa.

### 4.3 Skanowanie matrycy klawiatury

Klawiatura membranowa Esperanza T8809-2 wyprowadza 27 klawiszy przez 10-pinowy elastyczny przewód FFC. Każde naciśnięcie zwiera parę z 10 dostępnych linii. Algorytm skanowania:

1. Wszystkie 10 linii ustawione jako wejścia z wewnętrznym pull-up (MCP23017)
2. Iteracyjnie jedna linia ustawiana na wyjście, wartość `LOW`
3. Odczyt stanu pozostałych 9 linii — jeśli któraś jest `LOW`, oznacza zwarcie (klawisz naciśnięty)
4. Pełen skan = 10 iteracji × ~80 µs = ~1 ms
5. Debouncing programowy: 2 kolejne identyczne odczyty wymagane do uznania stanu za stabilny

### 4.4 Aparat OV2640 (interfejs równoległy)

| Parametr | Wartość |
|---|---|
| Interfejs danych | 8-bit równoległy (D0–D7) |
| Sygnały sterujące | VSYNC, HREF, PCLK, XCLK |
| Konfiguracja | I²C/SCCB (oddzielna od głównego I²C — opcjonalnie wspólne) |
| Częstotliwość XCLK | 10 MHz (kalkulator), 20 MHz (datasheet maksymalna) |
| Rozdzielczość kalibracji | SVGA (800×600) — kompromis jakość/pamięć |
| Format wyjściowy | JPEG (kompresja sprzętowa w sensorze) |
| Bufor klatki | 8 MB PSRAM (mieści ~80 klatek SVGA JPEG ~100 KB) |

Sterowanie zasilaniem aparatu:
- `PWDN` (power-down) sygnał: `HIGH` = aparat uśpiony (pobór <50 µA), `LOW` = aparat aktywny (~50 mA przy 2,8 V)
- `RESET` sygnał: aktywny `LOW`, czas trzymania min. 1 ms, po zwolnieniu sensor potrzebuje ~20 ms na stabilizację

Oba sygnały sterowane są przez ekspander MCP23017 (porty GPA5 i GPA6) — pozwala to na pełne wyłączenie aparatu między zapytaniami, oszczędzając ok. 50 mA prądu z baterii.

---

## 5. Zarządzanie zasilaniem

### 5.1 Topologia

```
LiPo 3,7 V ─┬─→ AP2112K-3,3 LDO ──→ 3,3 V (ESP32, MCP, OLED logika)
            │
            ├─→ MT3608 boost ──→ 14,5 V (OLED VCC wysokie napięcie)
            │
            ├─→ AP2112K-2,8 LDO ──→ 2,8 V (OV2640 AVDD, DOVDD)
            │
            └─→ XC6206P132 LDO ──→ 1,2 V (OV2640 DVDD)
```

### 5.2 Stany urządzenia

| Stan | Pobór prądu | Sytuacja |
|---|---|---|
| Active (OLED on, WiFi off) | ~150 mA | Praca w trybie kalkulatora |
| AI request (WiFi TX peak) | do 400 mA | Wysyłanie pytania, pobieranie odpowiedzi |
| Camera active | +50 mA | Robienie zdjęcia (krótkotrwałe) |
| Sleep (OLED off, ESP32 light sleep) | ~10 mA | Po 4 minutach bezczynności (konfigurowalne) |
| Deep sleep | <50 µA | Nieużywane w obecnej wersji firmware |

### 5.3 Algorytm auto-sleep

Po skonfigurowanym czasie bezczynności klawiatury (domyślnie 4 minuty):
1. Kalkulator wyłącza wyjście MT3608 (boost EN → LOW) — gaśnie OLED, zysk ~140 mA
2. Wyłącza WiFi (`WiFi.mode(WIFI_OFF)`) — zysk ~80 mA
3. Wyłącza aparat jeśli był aktywny — zysk ~50 mA
4. ESP32 przechodzi w light sleep z wybudzaniem przez przerwanie z linii MCP23017 (klawiatura)
5. Naciśnięcie dowolnego klawisza powoduje wybudzenie i powrót do poprzedniego stanu

---

## 6. Bezpieczeństwo i zgodność

### 6.1 Dane osobowe

Urządzenie KalkMate nie przechowuje danych osobowych użytkownika w pamięci nielotnej:
- Adres email konta — przechowywany **wyłącznie na serwerze** (baza danych SQLite z polityką prywatności)
- Identyfikator urządzenia — przechowywany lokalnie, jest **MAC adresem WiFi**, deterministyczny dla danego chipu ESP32
- Historia zapytań — treść matematyczna, nieidentyfikowalna osobowo

### 6.2 Aktualizacje bezpieczeństwa

Mechanizm OTA (sekcja 3.6) pozwala na zdalne wdrażanie poprawek bezpieczeństwa do urządzeń w polu. Producent zobowiązuje się do wydawania aktualizacji w przypadku odkrycia istotnych podatności w kolejnych wersjach Arduino ESP32 Core / TLS / WiFi.

### 6.3 Zgodność z normami

| Norma | Status |
|---|---|
| **CE marking** | W przygotowaniu (dokumentacja kompatybilności EMC) |
| **EN 300 328** (2,4 GHz radio) | Zgodne — moduł ESP32-S3-WROOM-1 posiada certyfikat |
| **EN 301 489** (EMC) | W trakcie testów |
| **EN 62368-1** (bezpieczeństwo elektryczne) | W trakcie testów |
| **RED Directive 2014/53/EU** | W trakcie certyfikacji |
| **RoHS 2** (substancje niebezpieczne) | Zgodne — komponenty SMD z certyfikatami od dostawców |
| **WEEE** (utylizacja) | Zgłoszenie do BDO planowane przed wprowadzeniem do obrotu |

### 6.4 Pamięć krzyżowa / izolacja

ESP32-S3 posiada Memory Protection Unit (MPU) izolujący kod od danych. Nie wykorzystywany w obecnej wersji firmware (Arduino framework nie konfiguruje MPU). Rozważane wdrożenie w wersji 2.0 jako dodatkowa warstwa zabezpieczenia przed atakami typu buffer overflow.

---

## 7. Licencjonowanie oprogramowania

### 7.1 Komponenty open source

Firmware wykorzystuje następujące biblioteki open source:

| Biblioteka | Licencja | Wykorzystanie |
|---|---|---|
| Arduino ESP32 Core | LGPL 2.1+ | Framework |
| ESP-IDF | Apache 2.0 | Bazowy SDK |
| U8g2 (olikraus) | New BSD | Sterownik OLED |
| Adafruit MCP23017 | BSD | Sterownik ekspandera |
| esp32-camera (espressif) | Apache 2.0 | Sterownik OV2640 |
| QRCode (ricmoo) | MIT | Generator kodu QR |

Wszystkie licencje są kompatybilne z dystrybucją binarną — producent KalkMate nie modyfikuje źródeł bibliotek i dołącza ich teksty licencji w dokumentacji urządzenia (zgodnie z LGPL § 6).

### 7.2 Kod własny

Kod aplikacyjny KalkMate (~5000 linii C++) pozostaje własnością intelektualną producenta. Nie jest dystrybuowany publicznie. W przypadku zakończenia działalności producenta zobowiązuje się on do udostępnienia użytkownikom narzędzi pozwalających na samodzielne wgranie alternatywnego firmware (chip ESP32-S3 jest standardowy i dostępne są open source firmware zastępcze).

---

## 8. Diagnostyka i debugowanie

Firmware udostępnia w menu urządzenia panel diagnostyczny (**Ustawienia → Diagnostyka**) zawierający:

- **Test ekranu** — wyświetlenie wzorca testowego (pełen ekran, krata, gradient) do weryfikacji uszkodzeń OLED
- **Test kamery** — pobranie i wyświetlenie miniatury zdjęcia (weryfikacja działania OV2640)
- **Test klawiatury** — wizualizacja stanu wszystkich 27 klawiszy w czasie rzeczywistym
- **Skaner par MCP23017** — wyświetlenie aktywnych zwarć na matrycy klawiszy (debug fizycznych usterek)
- **Pin Driver Test** — wymuszanie stanu OUTPUT/LOW na poszczególnych pinach MCP23017 do weryfikacji multimetrem

Logi systemowe dostępne są przez port USB (USB-CDC, 115200 baud) — dostęp wyłącznie po rozłączeniu obudowy urządzenia, nieaktywny w trybie produkcyjnym.

---

*Koniec dokumentu*
