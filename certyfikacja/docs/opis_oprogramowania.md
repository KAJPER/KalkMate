# KalkMate — Opis oprogramowania i protokołów komunikacyjnych

**Dokument:** Specyfikacja techniczna oprogramowania układowego (firmware) oraz protokołów łączności — element Teczki Technicznej (Technical File)
**Produkt:** KalkMate v1.0 — kalkulator edukacyjny z asystentem AI
**Model:** KalkMate-ESP32S3-v1
**Wersja firmware:** 2.0.2 (`FW_VERSION` w `src/main.cpp`)
**Sprzęt:** PCB v4, ESP32-S3-WROOM-1-N16R8 (jedyny wspierany wariant; płytka PCB v3 z ESP32-WROVER-E nie jest już wspierana)
**Producent:** KAJPA Kacper Popko
**Data:** 2026-10-25 (zastępuje wersję z 2026-06-12, opisującą fw 1.0.0)

> Dokument opisuje wyłącznie funkcje i mechanizmy obecne w kodzie źródłowym firmware 2.0.2
> (`src/main.cpp`, `src/*.h`, `platformio.ini`). Części serwerowe opisano tylko w zakresie,
> w jakim dotyczą komunikacji z urządzeniem.

---

## 1. Architektura systemu

### 1.1 Warstwa sprzętowa (PCB v4)

Mikrokontroler **Espressif ESP32-S3-WROOM-1-N16R8**:
- dwurdzeniowy procesor Xtensa LX7 (240 MHz),
- 16 MB pamięci flash (Quad-SPI) + 8 MB PSRAM (Octal-SPI),
- zintegrowane radio WiFi IEEE 802.11 b/g/n 2,4 GHz z anteną PCB modułu,
- Bluetooth LE — **nieużywany**: firmware nie inicjalizuje stosu Bluetooth (brak odwołań do BT/BLE w kodzie),
- natywny kontroler USB (USB-CDC; GPIO19/20, ochrona USBLC6-2SC6).

Peryferia:
- wyświetlacz OLED **SSD1322** 256×64, 4-wire SPI, zasilanie ~12 V z przetwornicy **MT3608** (EN = GPIO47),
- ekspander I²C **MCP23017** (0x20) — klawiatura membranowa 27 klawiszy (pair-scan) oraz linie PWDN/RESET kamery,
- kamera **OmniVision OV2640** — interfejs równoległy 8-bit + SCCB (I²C 0x30),
- akumulator LiPo 3,7 V 1500 mAh, ładowarka MCP73831, zabezpieczenie DW01A + FS8205A,
- pomiar baterii: **MAX17048** (I²C 0x36) lub — na starszych egzemplarzach PCB v4 — dzielnik ADC na GPIO3 (wykrywane automatycznie w `battery.h`).

### 1.2 Środowisko i framework

| Element | Wartość |
|---|---|
| Środowisko budowania | PlatformIO, jedyne środowisko `esp32s3` (board `esp32-s3-devkitc-1`) |
| Platforma | `espressif32` 6.9.0 |
| Framework | **Arduino-ESP32 core 2.0.17** (na bazie ESP-IDF 4.4 i FreeRTOS) |
| Tablica partycji | `default_16MB.csv` |
| Pamięć | `board_build.arduino.memory_type = qio_opi` |
| Flagi bezpieczeństwa | `-DKALK_REQUIRE_SIGNED_OTA=1` (odrzucanie niepodpisanych aktualizacji) |
| Poziom logów | `CORE_DEBUG_LEVEL=1` (tylko błędy), logi bootloadera wyłączone |
| Biblioteki zewnętrzne | U8g2 ≥ 2.35, Adafruit MCP23017 ≥ 2.3, esp32-camera (Espressif), ricmoo/QRCode |

### 1.3 Moduły oprogramowania

| Moduł | Plik | Funkcja |
|---|---|---|
| Punkt wejścia | `main.cpp` | Sekwencja startu (bateria → boost → OLED → NVS → OTA boot-check → klawiatura → prowizjonowanie → ustawienia → kalkulator), pętla menu AI, zadania w tle (auto-WiFi, NTP, DNS, walidacja OTA, watchdog VBAT) |
| Kalkulator | `calculator.h` | Kalkulator offline (+ − × ÷, %, √, ±, pamięć M+/M−/MR/MC); wejście do trybu AI po wpisaniu kodu AI; przytrzymanie C/CE 5 s = reset fabryczny |
| Klawiatura | `input.h` | Skanowanie 27 klawiszy przez MCP23017, debouncing, mapowanie klawiszy, wstrzykiwanie klawiszy w sesji zdalnej pomocy |
| Rozwiązywanie AI | `solve_screen.h` | Menu: zdjęcie kamery / wpisanie tekstu / historia / solvery offline; wysyłka HTTPS, kolejka offline, wyświetlanie odpowiedzi (konwersja LaTeX → tekst) |
| Solvery offline | `offline_solver.h` | Lokalnie, bez sieci: równania liniowe i kwadratowe, układy 2 równań, procenty/proporcje, pochodne wielomianów |
| Kamera | `camera.h` | Inicjalizacja OV2640 (JPEG UXGA, jakość 10; podgląd w skali szarości QQVGA), sterowanie PWDN/RESET, wyłączanie kamery i zegara XCLK przed użyciem WiFi |
| Kolejka offline | `offline_queue.h` | Do 3 zadań (tekst lub zdjęcie) do ponowienia, maks. 3 próby, idempotentny identyfikator `x-request-id` |
| Historia | `history.h` | 5 ostatnich pytań i odpowiedzi lokalnie (metadane w NVS, treść na SPIFFS); starsza historia pobierana z serwera |
| Notatki | `notes.h` | Synchronizacja notatek z konta (GET `/api/device/notes`) do `/notes.json` na SPIFFS, przeglądanie offline |
| Sprawdziany | `tests.h` | Synchronizacja sprawdzianów (GET `/api/device/tests`) do `/tests.json`, przeglądanie offline |
| Konto urządzenia | `device_account.h`, `account_screen.h` | Rejestracja urządzenia, token urządzenia, status konta i salda, ekran Device ID + kod QR |
| Zdalna pomoc | `remote_session.h` | Sesja uruchamiana przez użytkownika: podgląd ekranu i zdalne klawisze z panelu wsparcia |
| Aktualizacje | `ota_update.h` | OTA przez HTTPS z weryfikacją podpisu ECDSA P-256, mechanizm rollback |
| Certyfikaty TLS | `kalkmate_certs.h` | Przypięte certyfikaty główne Let's Encrypt (ISRG Root X1, X2, YR, YE) |
| Reset fabryczny | `factory_reset.h` | Wspólna procedura dla menu Ustawień i przytrzymania C/CE |
| WiFi | `wifi_settings.h`, `wifi_persist.h` | Skanowanie i wybór sieci, do 8 zapamiętanych sieci, limit mocy TX, odporny DNS |
| Zarządzanie energią | `power.h`, `battery.h` | Auto-uśpienie ekranu i light sleep, odcięcie boosta OLED, wyłączanie WiFi, deep sleep przy krytycznej baterii |
| Panic key | `panic.h` | Natychmiastowy powrót z dowolnego ekranu do trybu kalkulatora |
| Log zdarzeń | `event_log.h` | Bufor ≤ 3 KB zdarzeń diagnostycznych (błędy, resety, problemy z łącznością), wysyłany przy rejestracji |
| Ustawienia | `settings_screen.h` | Jasność, obrót, kamera, język (PL/EN/DE), tryb rozwiązywania, auto-sleep, kod AI, panic key, WiFi, konto, zdalna pomoc, aktualizacje, reset fabryczny, czyszczenie kolejki, diagnostyka |
| Obfuskacja klucza | `key_obfuscate.h` | Klucz API floty przechowywany w binarce w postaci XOR (obfuskacja, nie szyfrowanie) |
| Ekrany informacyjne | `about_screen.h`, `info_screen.h`, `splash_screen.h`, `screen_test.h` | O programie, informacje, ekran powitalny, testy diagnostyczne |

### 1.4 Pamięć flash i dane lokalne

Tablica partycji `default_16MB.csv`:

| Partycja | Rozmiar | Zawartość |
|---|---|---|
| `nvs` | 20 KB | Ustawienia i dane konfiguracyjne (Preferences) |
| `otadata` | 8 KB | Wskaźnik aktywnej partycji aplikacji |
| `app0` / `app1` | 2 × 6,25 MB | Dwie partycje firmware (OTA A/B) |
| `spiffs` | 3,375 MB | Pliki danych użytkownika |
| `coredump` | 64 KB | Zrzut awarii |

Przestrzenie NVS:
- `kalkmate` — zapamiętane sieci WiFi (do 8 par SSID/hasło), klucz licencji, kod AI (`ai_code`), panic key, ustawienia (jasność, język, tryb, uśpienie, kamera), podpowiedź BSSID/kanał dla szybkiego łączenia,
- `kalkid` — token urządzenia (`dev_token`, 64 znaki hex) oraz flaga `unpair`; **nie jest kasowana przez reset fabryczny**,
- `kalkhist` — metadane historii (treść w plikach `/histN.bin` na SPIFFS),
- `kalkmap` — mapowanie klawiatury,
- `kalkoq` — metadane kolejki offline (treść w plikach `/oqXX.txt` / `/oqXX.jpg` na SPIFFS),
- `ota_rb` — stan walidacji po aktualizacji OTA (licznik bootów, flaga oczekiwania),
- `kalkprov` — znacznik jednorazowego prowizjonowania fabrycznego.

SPIFFS: `/notes.json`, `/tests.json`, `/histN.bin`, pliki kolejki offline, `/evlog.txt` (log zdarzeń).

---

## 2. Funkcje urządzenia

### 2.1 Kalkulator offline (tryb domyślny)

Po włączeniu urządzenie startuje w trybie zwykłego kalkulatora (wyświetla „0” zaraz po uruchomieniu ekranu). Tryb działa całkowicie bez sieci — radio WiFi pozostaje wyłączone. Pozostałe funkcje (tryb AI, notatki, sprawdziany, ustawienia) są dostępne dopiero po wpisaniu na klawiaturze kalkulatora **kodu AI** (sekwencja 1–11 cyfr).

- Kod AI ustawiany jest przy produkcji na kod wybrany przez klienta w zamówieniu (prowizjonowanie przez USB, p. 6.1). Jeśli klient nie wybrał kodu albo po resecie fabrycznym, obowiązuje kod domyślny **1111**. Kod można zmienić w Ustawieniach.
- **Panic key** (domyślnie klawisz MU, konfigurowalny) — z dowolnego ekranu natychmiast wraca do widoku kalkulatora.

### 2.2 Tryb AI — rozwiązywanie zadań

Menu „Rozwiąż zadanie”:
1. **Zdjęcie kamery** — podgląd na żywo w skali szarości, zdjęcie JPEG (UXGA), wyłączenie kamery, dopiero potem włączenie WiFi i wysyłka.
2. **Wpisz tekst** — klawiatura ekranowa, do 2048 znaków.
3. **Historia** — 5 ostatnich rozwiązań lokalnie; starsze pobierane z konta.
4. **Offline** — lokalne solvery bez sieci (równania liniowe/kwadratowe, układy równań, procenty, pochodne).

Tryb rozwiązywania (Ustawienia): szczegółowy / tylko obliczenia / tylko wynik. Język interfejsu i odpowiedzi: polski, angielski, niemiecki.

Zadanie wysyłane jest do `https://kalkmate.pl/api/device/solve` (HTTPS): tekst jako JSON, zdjęcie jako `multipart/form-data` (JPEG). Odpowiedź (do 24 KB tekstu) jest wyświetlana na OLED z konwersją zapisu LaTeX na znaki tekstowe i zapisywana w historii. Serwer przekazuje zadanie do zewnętrznego modelu językowego (po stronie serwera, przez OpenRouter; model domyślny `google/gemini-2.5-pro`, model może być ustawiony per konto) — urządzenie nie łączy się z dostawcą AI bezpośrednio.

### 2.3 Kolejka offline

Gdy wysyłka się nie powiedzie z przyczyny przejściowej (brak WiFi, błąd transportu, HTTP 429 lub 5xx), zadanie trafia do kolejki (maks. 3 zadania, maks. 3 próby na zadanie) i jest ponawiane przy następnym wejściu w „Rozwiąż zadanie”. Błędy trwałe (np. 402 — brak tokenów, 403, 413) nie są kolejkowane. Każde zadanie ma stały identyfikator `x-request-id` (16 znaków hex z `esp_random()`), dzięki któremu serwer w ciągu ok. 20 minut zwraca zapisany wynik zamiast przetwarzać zadanie (i pobierać tokeny) ponownie. Kolejkę można wyczyścić w Ustawieniach.

### 2.4 Notatki i sprawdziany

Notatki i sprawdziany tworzone w panelu użytkownika na kalkmate.pl są pobierane na urządzenie (GET `/api/device/notes`, `/api/device/tests`), zapisywane na SPIFFS i dostępne do przeglądania bez sieci.

### 2.5 Zdalna pomoc

Ustawienia → Zdalna pomoc uruchamia sesję wsparcia technicznego:
- sesję może rozpocząć **wyłącznie użytkownik** na urządzeniu; serwer nigdy nie inicjuje połączenia do kalkulatora (urządzenie jest klientem za NAT),
- w trakcie sesji urządzenie co ~500 ms wysyła do `/api/device/remote/checkin` kopię bufora ekranu (2048 B) i może odebrać jeden „wciśnięty” klawisz,
- przez cały czas sesji w prawym górnym rogu ekranu widoczny jest wskaźnik aktywnej sesji,
- sesja kończy się: na żądanie serwera/panelu, po twardym limicie lokalnym 15 minut, przy odpowiedzi 401/403/404; przy błędach sieci stosowany jest backoff 2–30 s; po zakończeniu WiFi jest wyłączane.

### 2.6 Konto, licencja i model tokenowy

- Przy pierwszym połączeniu urządzenie rejestruje się (POST `/api/device/register`) i otrzymuje od serwera **unikalny token urządzenia** (64 znaki hex), zapisywany w NVS `kalkid` i dołączany do kolejnych zapytań (`x-device-token`).
- Dostęp do AI rozliczany jest **w tokenach z salda konta użytkownika** — bez subskrypcji ani licencji czasowych. Nowe konto otrzymuje 200 tys. tokenów; aktywacja licencji z pudełka kalkulatora doładowuje jednorazowo 2 mln tokenów (stałe `SIGNUP_TOKENS` / `LICENSE_TOKENS` po stronie serwera). Przy braku tokenów serwer zwraca HTTP 402, a urządzenie wyświetla „Brak tokenów!”.
- Ekran „Status konta” pokazuje powiązane konto (e-mail), stan dostępu i wybrany model AI; ekran „Device ID” — identyfikator urządzenia z kodem QR do powiązania z kontem.

### 2.7 Aktualizacje OTA

Sprawdzanie i instalacja aktualizacji następuje na żądanie użytkownika (Ustawienia → Aktualizacje). Mechanizm opisano w p. 5.1.

---

## 3. Łączność bezprzewodowa WiFi

- **Standard:** IEEE 802.11 b/g/n, 2,4 GHz. Sieci 5 GHz nie są obsługiwane.
- **Tryb pracy:** wyłącznie stacja kliencka (STA). Firmware nie uruchamia trybu punktu dostępowego (AP) ani żadnych usług nasłuchujących (brak serwera HTTP/Telnet/FTP, brak gniazd nasłuchujących TCP/UDP).
- **Zabezpieczenia sieci:** obsługa przez stos WiFi ESP-IDF (WPA/WPA2-PSK, sieci otwarte). Hasła sieci przechowywane są w NVS `kalkmate`; `WiFi.persistent(false)` — konfiguracja nie jest dodatkowo zapisywana w wewnętrznej partycji WiFi ESP-IDF.
- **Ograniczenie mocy nadawania:** każde włączenie trybu STA przechodzi przez `wifiStaOnLimited()`, które ustawia maksymalną moc nadawania na **8,5 dBm** (`WIFI_POWER_8_5dBm`, stała `KALK_WIFI_TX_POWER`) i czeka na zdarzenie `STA_START`, aby ustawienie zostało faktycznie zastosowane. Wartość jest istotnie niższa od wartości certyfikowanej modułu (19,9 dBm EIRP wg certyfikatu RED modułu) i od limitu 20 dBm EIRP dla pasma 2,4 GHz.
- **Radio wyłączane, gdy niepotrzebne:** w trybie kalkulatora, w uśpieniu, przed uruchomieniem kamery (zegar XCLK kamery zakłóca radio), po sesji zdalnej pomocy i po resecie fabrycznym (`WiFi.mode(WIFI_OFF)`).
- **DNS:** serwer DNS z DHCP; jako zapasowe — publiczne 8.8.8.8 i 1.1.1.1 (używane, gdy DNS sieci nie odpowiada). **NTP:** `pool.ntp.org`, `time.google.com` (zegar nie jest wykorzystywany do bezpieczeństwa — p. 4.1).

---

## 4. Łączność z serwerem (HTTPS)

### 4.1 TLS z przypiętymi certyfikatami głównymi

Wszystkie połączenia sieciowe firmware kierowane są wyłącznie do `https://kalkmate.pl` (stała `KALK_SERVER_URL`). Każde połączenie używa `WiFiClientSecure` z `setCACert(KALKMATE_CA_CERT)` — w kodzie nie występuje `setInsecure()`. Pakiet zaufanych certyfikatów (`kalkmate_certs.h`) zawiera wyłącznie certyfikaty główne Let's Encrypt:

| Certyfikat główny | Algorytm | Ważny do |
|---|---|---|
| ISRG Root X1 | RSA 4096 | 2035-06-04 |
| ISRG Root X2 | ECDSA P-384 | 2040-09-17 |
| ISRG Root YR | RSA 4096 | 2045-09-02 |
| ISRG Root YE | ECDSA P-384 | 2045-09-02 |

Łańcuch certyfikatów serwera i nazwa hosta są weryfikowane przez mbedTLS (ESP-IDF 4.4, TLS 1.2). Ograniczenie: mbedTLS w core 2.0.17 jest zbudowany bez `CONFIG_MBEDTLS_HAVE_TIME_DATE`, więc **daty ważności certyfikatów nie są sprawdzane**, a urządzenie nie sprawdza odwołań certyfikatów (CRL/OCSP).

### 4.2 Endpointy wykorzystywane przez urządzenie

Adres bazowy: `https://kalkmate.pl/api/device/`

| Endpoint | Metoda | Zastosowanie | Timeout po stronie urządzenia |
|---|---|---|---|
| `/register` | POST | Rejestracja: Device ID, kod AI, wersja firmware, bufor logu zdarzeń; zwraca token urządzenia; obsługa flagi resetu fabrycznego | 8 s (connect 12 s) |
| `/account-status` | GET | Status konta, dostęp do AI, model AI, synchronizacja klucza licencji do NVS | 8 s (connect 12 s) |
| `/solve` | POST | Zadanie tekstowe (JSON) lub zdjęcie (multipart JPEG) | 65 s (connect 12 s), maks. 2 próby połączenia |
| `/notes`, `/tests` | GET | Synchronizacja notatek i sprawdzianów | 30 s |
| `/conversations` | GET | Starsza historia rozwiązań z konta | — |
| `/remote/checkin` | POST | Zdalna pomoc (tylko w aktywnej sesji uruchomionej przez użytkownika) | 4 s |
| `/firmware/check` | GET | Informacja o najnowszym firmware (wersja, URL, podpis); wysyłany wariant sprzętu `x-hw-variant: s3` | 30 s |
| `/firmware/download/[version]` | GET | Pobranie obrazu firmware (wymaga uwierzytelnienia urządzenia) | 60 s; przerwanie po 15 s bez danych lub 10 min łącznie |

### 4.3 Nagłówki identyfikujące urządzenie

- `x-api-key` — wspólny klucz floty (obfuskowany w binarce; serwer traktuje go jako jawny — nie stanowi dowodu tożsamości),
- `x-device-id` — adres MAC interfejsu WiFi STA (12 znaków hex),
- `x-device-token` — unikalny token urządzenia nadany przez serwer (właściwy dowód tożsamości; serwer przechowuje jego skrót SHA-256 i porównuje w stałym czasie),
- `x-fw-version` — wersja firmware,
- `x-license-key` — klucz licencji z NVS (jeśli jest),
- `x-request-id`, `x-solve-mode`, `x-language` — dla `/solve`.

Po stronie serwera stosowane są limity częstotliwości żądań (m.in. `/solve`: 30 żądań/min na urządzenie; `/register`: 60/10 min na adres IP i 10/10 min na urządzenie; pobieranie firmware: 120/h na adres IP) oraz limity rozmiaru (żądanie ≤ 10 MB, obraz ≤ 6 MB, tekst ≤ 50 kB).

---

## 5. Mechanizmy bezpieczeństwa w firmware

### 5.1 Podpisane aktualizacje OTA (ECDSA P-256) z rollbackiem

1. Użytkownik uruchamia sprawdzenie aktualizacji; serwer zwraca wersję, URL obrazu i podpis (`sig`, ECDSA P-256 w DER, base64). Instalacja jest możliwa tylko dla wersji wyższej od bieżącej.
2. Firmware zbudowany z `KALK_REQUIRE_SIGNED_OTA` **odrzuca aktualizację bez podpisu**.
3. URL obrazu musi zaczynać się od `https://kalkmate.pl/` — inne adresy są odrzucane.
4. Aktualizacja wymaga napięcia baterii ≥ 3,7 V lub podłączonego zasilania USB.
5. Obraz jest strumieniowo zapisywany do nieaktywnej partycji OTA, a jednocześnie liczony jest skrót SHA-256.
6. **Przed aktywacją** (zanim `Update.end()` przełączy partycję startową) podpis jest weryfikowany kluczem publicznym producenta wbudowanym w firmware (`mbedtls_pk_verify`). Przy niezgodności podpisu zapis jest przerywany (`Update.abort()`), urządzenie pozostaje na dotychczasowym firmware i wyświetla „PODPIS NIEPOPRAWNY!”. Klucz prywatny znajduje się wyłącznie na serwerze producenta.
7. **Rollback:** po instalacji urządzenie oznacza nowy firmware jako „oczekujący walidacji”. Jeśli nowy firmware trzykrotnie nie uruchomi się poprawnie (licznik bootów; 60 s stabilnej pracy zeruje licznik), urządzenie wraca do poprzedniej partycji. Firmware jest zatwierdzany dopiero po pierwszej udanej odpowiedzi HTTPS 200 z kalkmate.pl — co potwierdza, że nowa wersja nadal potrafi się aktualizować.

### 5.2 Token urządzenia

Unikalny 64-znakowy token nadawany przez serwer przy rejestracji, przechowywany w NVS `kalkid` (przestrzeń niekasowana przez reset fabryczny) i wysyłany w nagłówku `x-device-token`. Token nie jest wypisywany w logach.

### 5.3 Reset fabryczny

Dostępny w Ustawieniach (Reset fabryczny) oraz — bez potrzeby znajomości kodu AI — przez **przytrzymanie C/CE przez 5 s** w trybie kalkulatora. Wymaga potwierdzenia klawiszem OK (C/CE lub brak decyzji przez 30 s = anulowanie). Procedura (`factoryResetWipe()`):
- czyści przestrzenie NVS `kalkmate` (sieci WiFi, licencja, kod AI, panic key, ustawienia), `kalkhist`, `kalkmap`, `kalkoq`,
- usuwa wszystkie pliki z SPIFFS (notatki, sprawdziany, historia, kolejka offline, log zdarzeń); przy błędzie — formatuje partycję,
- czyści wewnętrzną konfigurację WiFi ESP-IDF (`esp_wifi_restore()`) i wyłącza radio,
- zachowuje token urządzenia (`kalkid`), stan walidacji OTA (`ota_rb`) i znacznik prowizjonowania (`kalkprov`),
- ustawia flagę `unpair` — przy następnej rejestracji urządzenie wysyła `x-factory-reset: 1`, a serwer odpina urządzenie od konta użytkownika,
- restartuje urządzenie. Po resecie kod AI wraca do domyślnego 1111.

### 5.4 Obfuskacja klucza API

Wspólny klucz API floty jest zapisany w binarce jako tablica XOR (`key_obfuscate.h`) i dekodowany w czasie działania do statycznego bufora w RAM. Jest to wyłącznie utrudnienie wyszukania klucza w pliku binarnym (np. poleceniem `strings`), a nie zabezpieczenie kryptograficzne. Bezpieczeństwo uwierzytelniania urządzeń opiera się na tokenie urządzenia (p. 5.2).

### 5.5 Szyfrowanie pamięci flash (egzemplarze produkcyjne)

Firmware jest wgrywany narzędziem producenta (`tools/flasher`). W trybach produkcyjnych PROD_DEV / PROD_REL włączane jest sprzętowe **Flash Encryption ESP32-S3 z kluczem XTS-AES-256** (64 B, eFuse `BLOCK_KEY0`, `SPI_BOOT_CRYPT_CNT`), a w PROD_REL dodatkowo wypalany jest eFuse `DIS_DOWNLOAD_MANUAL_ENCRYPT` (tryb Release — brak możliwości wgrania przez USB obrazu, który by się uruchomił bez klucza producenta). Partycje danych NVS i SPIFFS nie są objęte szyfrowaniem (zob. ocena cyberbezpieczeństwa). Secure Boot nie jest włączony.

### 5.6 Higiena logów

Logi na porcie USB-CDC ograniczone są do poziomu błędów; kod AI, hasła WiFi, token urządzenia i BSSID nie są wypisywane. Bufor logu zdarzeń wysyłany do serwera zawiera wyłącznie dane diagnostyczne (przyczyny restartu, kody błędów, RSSI, adresy serwerów DNS/bramy).

### 5.7 Ochrona prywatności — kamera

Kamera jest zasilana i taktowana wyłącznie w czasie podglądu/zdjęcia (oraz testu kamery w diagnostyce) — z obrazem podglądu widocznym na ekranie. Poza tym sensor jest w trybie sprzętowego power-down (PWDN = HIGH przez MCP23017), sterownik jest zdeinicjalizowany (`esp_camera_deinit()`), a zegar XCLK zatrzymany.

---

## 6. Produkcja i zarządzanie energią

### 6.1 Prowizjonowanie fabryczne

Wyłącznie przy pierwszym uruchomieniu po wgraniu firmware (świeży NVS, brak znacznika `kalkprov/done`) urządzenie przez 3 s nasłuchuje na porcie USB-CDC komend `KALKPROV:SETCODE:<4 cyfry>` (kod AI wybrany przez klienta) oraz `KALKPROV:SETLANG:pl|en|de`. Po udanym ustawieniu lub upływie okna bez komend znacznik jest zapisywany i okno nigdy więcej się nie otwiera.

### 6.2 Zarządzanie energią

- Auto-uśpienie po czasie bezczynności (30 s – 30 min, konfigurowalne): wyłączenie OLED i boosta 12 V, wyłączenie WiFi, light sleep z wybudzaniem co ~80 ms w celu sprawdzenia klawiatury.
- Kamera wyłączana (PWDN) poza użyciem; WiFi wyłączane w trybie kalkulatora.
- Kontrola baterii przy starcie (przed włączeniem boosta): poniżej 3,3 V komunikat „NISKA BATERIA” i deep sleep. W pracy watchdog VBAT co 2 s — przy napięciu krytycznym bezpieczne wyłączenie (OLED, boost) i deep sleep.
- Bramka baterii dla OTA (≥ 3,7 V lub zasilanie USB).
