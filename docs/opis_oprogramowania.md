# KalkMate — Opis oprogramowania i protokołów komunikacyjnych

**Dokument:** Specyfikacja techniczna oprogramowania układowego (firmware) oraz protokołów łączności  
**Produkt:** KalkMate v1.0 — kalkulator edukacyjny z asystentem AI  
**Wersja firmware:** 1.0.0 (PCB v4, ESP32-S3-WROOM-1-N16R8)  
**Data:** 2026-06-12  

---

## 1. Architektura systemu

### 1.1 Warstwa sprzętowa

Urządzenie zbudowane jest wokół mikrokontrolera **Espressif ESP32-S3-WROOM-1-N16R8** zawierającego:
- Dwurdzeniowy procesor Xtensa LX7 (240 MHz)
- 16 MB pamięci flash (Quad-SPI)
- 8 MB pamięci PSRAM (Octal-SPI)
- Zintegrowany moduł WiFi IEEE 802.11 b/g/n (2,4 GHz)
- Bluetooth Low Energy 5.0 *(nieużywany w obecnej wersji oprogramowania)*
- Natywny kontroler USB OTG (USB-CDC do programowania i serial monitor)

Peryferia podłączone do MCU:
- Wyświetlacz OLED **SSD1322** 256×64 monochromatyczny — interfejs 4-wire SPI
- Ekspander GPIO **MCP23017** — interfejs I²C (adres `0x20`) — obsługa klawiatury matrycowej 27 klawiszy oraz sterowanie zasilaniem peryferiów
- Moduł aparatu **OmniVision OV2640** (2 Mpx) — interfejs równoległy 8-bit + SCCB (I²C)
- Przetwornica step-up **MT3608** generująca 14,5 V dla szyny zasilania OLED
- Bateria LiPo 3,7 V 2000 mAh z układem ładowania MCP73831 + zabezpieczeniem DW01A/FS8205A

### 1.2 Warstwa oprogramowania układowego (Firmware)

Firmware został zbudowany w środowisku **PlatformIO** z użyciem **Arduino ESP32 Core** (framework oparty o ESP-IDF i FreeRTOS). Kod ma strukturę modułową i składa się z następujących plików:

| Moduł | Plik | Funkcjonalność |
|---|---|---|
| **Punkt wejścia** | `main.cpp` | Inicjalizacja FreeRTOS, pętla główna, obsługa menu i dyspozycja UI |
| **Klawiatura** | `input.h` | Skanowanie matrycy 27 klawiszy przez MCP23017, eliminowanie drgań styków (debouncing) |
| **Bateria** | `battery.h` | Odczyt napięcia akumulatora przez ADC, obliczanie procentu naładowania i stanu ładowania |
| **Aparat** | `camera.h` | Inicjalizacja sensora OV2640, obsługa sygnałów PWDN/RESET i przechwytywanie klatek JPEG |
| **Konto urządzenia** | `device_account.h` | Rejestracja urządzenia na serwerze i synchronizacja statusu licencji oraz sparowania z kontem |
| **Notatki** | `notes.h` | Pobieranie i wyświetlanie notatek użytkownika z pamięci SPIFFS (notatki synchronizowane z serwerem) |
| **Sprawdziany** | `tests.h` | Odczyt i wyświetlanie sprawdzianów użytkownika, konwersja podstawowych elementów LaTeX na ASCII |
| **Aktualizacje** | `ota_update.h` | Bezpieczna aktualizacja oprogramowania przez HTTPS z weryfikacją podpisu cyfrowego |
| **Zarządzanie energią** | `power.h` | Przejście mikrokontrolera w tryb Light Sleep, wyłączanie OLED, aparatu oraz radia WiFi |
| **Tryb kalkulatora** | `calculator.h` | Tradycyjny kalkulator biurowy, blokada kodu dostępu do funkcji AI |
| **Rozwiązywanie AI** | `solve_screen.h` | Klawiatura ekranowa, przechwytywanie obrazu, wysyłanie zapytań HTTPS i renderowanie odpowiedzi AI |
| **Historia** | `history.h` | Magazyn kołowy ostatnich 5 zapytań i odpowiedzi AI, zapisywany lokalnie w NVS |
| **Ustawienia** | `settings_screen.h` | Menu konfiguracji jasności OLED, języka, trybu rozwiązywania, haseł oraz funkcji diagnostycznych |
| **WiFi** | `wifi_settings.h` | Interfejs wyboru sieci WiFi, wprowadzania haseł i łączenia |
| **Trwałość WiFi** | `wifi_persist.h` | Odczyt/zapis poświadczeń sieciowych i klucza licencyjnego w pamięci nieulotnej NVS |
| **Obfuskacja kluczy** | `key_obfuscate.h` | Ochrona przed statyczną analizą pliku binarnego (zabezpieczenie klucza API przed strings) |
| **Panic Key** | `panic.h` | Natychmiastowe przerwanie pracy bota AI i powrót do tradycyjnego kalkulatora |
| **Ekrany UI** | `about_screen.h`, `info_screen.h`, `splash_screen.h`, `screen_test.h` | Ekrany informacyjne, powitalne, testowe i diagnostyczne |

### 1.3 Struktura magazynu danych (Flash & NVS)

Pamięć Flash została podzielona na partycje obsługujące:
1. **Dwie partycje fabryczne programu (Dual Boot OTA)**: `app0` oraz `app1` (po 6,25 MB każda) pozwalające na bezawaryjną instalację aktualizacji z opcją automatycznego powrotu (rollback) w przypadku błędu rozruchu.
2. **Pamięć nieulotną NVS (Non-Volatile Storage)**:
   - Przestrzeń `"kalkmate"`: Przechowuje dane konfiguracji WiFi (SSID, hasło), kod licencyjny, kod odblokowujący funkcje AI (`ai_code`) oraz zmapowany klawisz bezpieczeństwa (`panic_key`).
   - Przestrzeń `"kalkhist"`: Zawiera magazyn kołowy dla 5 ostatnich sesji AI (klucze `q0`-`q4` dla pytań, `a0`-`a4` dla odpowiedzi oraz timestampy `t0`-`t4`).
   - Przestrzeń `"kalkmap"`: Zapisuje niestandardowe mapowania klawiszy klawiatury użytkownika.
3. **System plików SPIFFS**: Partycja o rozmiarze ok. 2 MB przechowująca lokalny bufor notatek użytkownika (`/notes.json`) oraz sprawdzianów (`/tests.json`).

---

## 2. Łączność bezprzewodowa WiFi

- **Standard**: Urządzenie działa zgodnie z IEEE 802.11 b/g/n w pasmie 2,4 GHz (kanały 1–13 dla Europy). Sieci 5 GHz nie są obsługiwane sprzętowo.
- **Tryb pracy**: Moduł działa wyłącznie jako stacja kliencka (Station - STA). Tryb punktu dostępowego (Access Point - AP) nie jest uruchamiany w kodzie produkcyjnym.
- **Zabezpieczenia sieciowe**: Pełne wsparcie dla WPA2-PSK (szyfrowanie AES/CCMP). Obsługa WPA3-SAE oraz sieci otwartych. Hasła są zapisywane w chronionym sumą kontrolną rejestrze NVS mikrokontrolera.
- **Ograniczenie mocy TX**: Firmware programowo limituje maksymalną moc nadawczą radia do **11 dBm** (~12,5 mW EIRP) przy pomocy funkcji `WiFi.setTxPower(WIFI_POWER_11dBm)`. Minimalizuje to chwilowe spadki napięcia na baterii i utrzymuje emisję znacząco poniżej europejskiego limitu 20 dBm (100 mW).

---

## 3. Łączność serwerowa i API (HTTPS)

Wszystkie połączenia sieciowe z serwerem centralnym `kalkmate.pl` realizowane są szyfrowanym protokołem HTTPS (TLS 1.2 lub TLS 1.3).

### 3.1 Endpointy API serwera (Next.js)

Dedykowany serwer Next.js (zintegrowany z SQLite przez Prisma ORM) udostępnia następujące endpointy pod adresem bazowym `https://kalkmate.pl/api/device/`:

1. **`POST /register`**:
   Służy do sparowania urządzenia. Kalkulator wysyła unikalny `deviceId` (MAC adres) oraz dynamicznie generowany `unlockCode`. Dane te są rejestrowane w bazie danych w tabeli `Device`.
2. **`GET /account-status`**:
   Urządzenie odpytuje serwer o status przypisanego konta. Zwraca informacje o adresie e-mail właściciela, stanie licencji oraz liczbie pozostałych dni. Endpoint ten automatycznie wysyła nowo przypisany kod licencyjny na urządzenie, synchronizując go z pamięcią NVS kalkulatora.
3. **`POST /solve`**:
   Przesyłanie zadania do rozwiązania.
   - Obsługuje tryb tekstowy (`text`) oraz obrazkowy (`image`) – przesyłany jako Base64 JPEG (maksymalny rozmiar obrazu to 8 MB, tekstu 50 KB w celu zabezpieczenia serwera przed atakami typu DoS).
   - Serwer zapisuje przesyłane zdjęcia na dysku poza folderem publicznym w celach diagnostycznych, po czym wysyła zapytanie do Google Gemini API (z automatycznym przełączeniem na model `gemini-2.5-flash` w przypadku przeciążenia głównego modelu `gemini-2.5-pro`).
   - Każde zapytanie zwiększa licznik `requestCount` w rekordzie urządzenia oraz jest rejestrowane w bazie danych w tabeli `DeviceSolve`.
4. **`GET /notes` i `GET /tests`**:
   Pobieranie w formacie JSON notatek i sprawdzianów przypisanych do konta użytkownika. Zwracane dane są zapisywane bezpośrednio do pamięci SPIFFS.
5. **`GET /firmware/check`**:
   Zwraca informacje o najnowszej dostępnej wersji oprogramowania, adresie URL pliku `.bin` oraz cyfrowym podpisie pliku. Dla starszych wersji firmware (poniżej 1.4.0) zwraca publiczny adres URL, natomiast dla wersji nowszych zwraca chroniony endpoint.
6. **`GET /firmware/download/[version]`**:
   Dostępny wyłącznie dla zarejestrowanych urządzeń o prawidłowym nagłówku `x-device-id`. Pliki `.bin` umieszczone są w prywatnym katalogu systemu plików serwera, uniemożliwiając bezpośrednie pobranie oprogramowania bez autoryzacji. Posiada zabezpieczenia przed atakami typu path traversal.

### 3.2 Aplikacja Webowa (Next.js)

Główna infrastruktura serwerowa oparta jest na nowoczesnym stosie technologicznym (T3-stack) w architekturze Server-Side Rendering (SSR) i Server Actions:
- **Framework:** Next.js (App Router)
- **Baza danych:** SQLite + Prisma ORM (tabela `Inventory` obsługiwana przez surowe zapytania SQL)
- **Stylowanie:** Tailwind CSS

#### Moduły aplikacji:
1. **Panel Klienta (`/panel`):**
   - Logowanie i rejestracja (NextAuth.js).
   - Przeglądanie notatek, historii AI i zapisanych sprawdzianów zsynchronizowanych z urządzeniem.
   - Zarządzanie subskrypcją na czat AI.
2. **Panel Administratora (`/admin`):**
   - Uwierzytelnianie dwuskładnikowe (TOTP 2FA via Google Authenticator) w module logowania (`/admin/login`).
   - Zarządzanie użytkownikami, urządzeniami, wygenerowanymi kodami licencji.
   - Obsługa magazynu (stan ilości sztuk KalkMate) i szybki podgląd zapytań do Gemini AI.
3. **Moduł Zamówień (E-commerce):**
   - Landing page z koszykiem zakupowym (komponent `BuyNow.tsx`).
   - Integracja z Paczkomatami (InPost Geowidget) do wyboru punktu odbioru.
   - Procesowanie płatności via Stripe (z uwzględnieniem natywnych webhooków i obsługą zwrotów/refundacji widocznych w panelu `/admin/orders`).
4. **Wysyłka e-maili:** 
   - Moduł powiadomień oparty o Resend API, wykorzystywany m.in. przy weryfikacji adresów e-mail, wysyłce potwierdzeń zamówień oraz komunikacji systemowej.

### 3.3 Nagłówki autoryzacyjne w komunikacji API-Urządzenie

Zapytania wysyłane przez urządzenie do serwera Next.js muszą zawierać zestaw nagłówków:
- `x-api-key`: Klucz uwierzytelniający aplikację kliencką.
- `x-device-id`: MAC adres urządzenia (identyfikator fizyczny).
- `x-fw-version`: Wersja oprogramowania (np. `1.0.0`).
- `x-license-key` *(dla `/solve`)*: Klucz licencyjny pobrany z NVS.

---

## 4. Wdrożone mechanizmy bezpieczeństwa

### 4.1 Obfuskacja klucza API (Compile-time XOR)

Aby utrudnić wydobycie globalnego klucza API (`CALCULATOR_API_KEY`) z dystrybuowanych plików binarnych za pomocą prostych poleceń typu `strings firmware.bin`, klucz nie jest zapisany w kodzie jako czytelny łańcuch znaków. 

W module `key_obfuscate.h` zastosowano technikę XOR-owania klucza podczas kompilacji z 16-bajtową losową maską `_OBFK`. Odszyfrowanie klucza następuje wyłącznie w pamięci RAM w czasie rzeczywistym wewnątrz funkcji `kalkApiKey()` bezpośrednio przed wysłaniem zapytania sieciowego. Po użyciu bufor pamięci jest nadpisywany, co uniemożliwia jego łatwy odczyt z pamięci RAM.

### 4.2 Podpis cyfrowy oprogramowania (Signed OTA)

Wdrożony od wersji `1.4.1` mechanizm **Signed OTA** zapobiega instalacji zmodyfikowanego lub złośliwego oprogramowania na urządzeniu:
1. Podczas pobierania pliku `.bin` z serwera, strumień danych jest na bieżąco przekazywany do algorytmu SHA-256 w celu obliczenia sumy kontrolnej pobranego programu.
2. Serwer w odpowiedzi na zapytanie o aktualizację przesyła podpis cyfrowy oprogramowania (`sig` w formacie DER zakodowany jako base64), wygenerowany za pomocą prywatnego klucza ECDSA P-256.
3. Przed sfinalizowaniem zapisu w pamięci flash i wywołaniem restartu, funkcja `otaInstall()` weryfikuje podpis cyfrowy przy użyciu publicznego klucza kryptograficznego `_OTA_PUBLIC_KEY_PEM` wbudowanego na stałe w oprogramowanie kalkulatora. Weryfikacja realizowana jest sprzętowo przy użyciu wbudowanego w ESP-IDF modułu `mbedtls` (`mbedtls_pk_verify`).
4. W przypadku niezgodności podpisu lub braku autentyczności pliku aktualizacja jest natychmiast przerywana, zapobiegając uszkodzeniu urządzenia.

### 4.3 Reset do ustawień fabrycznych (Factory Reset)

Dostępna w panelu ustawień funkcja `_editFactoryReset()` zapewnia całkowite usunięcie danych poufnych użytkownika z pamięci urządzenia przed np. jego odsprzedażą lub zwrotem:
- Wywołuje funkcję `clear()` dla przestrzeni NVS `"kalkmate"` (usuwa SSID i hasło WiFi, klucz licencji, kody zabezpieczające i panic key).
- Czyści przestrzeń NVS `"kalkhist"` (usuwa historię zapytań i odpowiedzi AI).
- Czyści przestrzeń NVS `"kalkmap"` (resetuje własną mapę klawiatury).
- Usuwa z systemu plików SPIFFS pobrane notatki (`/notes.json`) oraz sprawdziany (`/tests.json`).
- Wpisuje wartości domyślne do struktury ustawień w pamięci RAM i wywołuje restart `ESP.restart()`.

---

## 5. Bezpieczeństwo i izolacja wewnętrzna

1. **Magistrale komunikacyjne**: Komunikacja wewnętrzna z ekranem (SPI) oraz ekspanderem MCP23017 i aparatem (I²C) odbywa się lokalnie wewnątrz obudowy urządzenia.
2. **Wyłączenie aparatu**: W stanie czuwania aparat OV2640 jest całkowicie odłączany od zasilania przez ekspander GPIO (stan `PWDN` ustawiany na `HIGH`). Pozwala to na oszczędność ok. 50 mA prądu oraz fizycznie uniemożliwia przechwytywanie obrazu bez wiedzy użytkownika.
3. **Brak nasłuchu sieciowego**: Urządzenie nie uruchamia serwerów HTTP, FTP, Telnet ani żadnych gniazd nasłuchujących (brak funkcji nasłuchu portów TCP/UDP). Wszystkie akcje sieciowe są inicjowane wyłącznie przez klienta (kalkulator) i zamykane natychmiast po zakończeniu transmisji.
