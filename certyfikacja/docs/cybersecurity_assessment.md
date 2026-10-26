# Cybersecurity Assessment (Ocena Cyberbezpieczeństwa)

**Dokumentacja techniczna zgodności z Dyrektywą RED 2014/53/UE — art. 3 ust. 3 lit. d), e), f)**
**Podstawa:** Rozporządzenie delegowane Komisji (UE) 2022/30 (stosowane od 1.08.2025)
**Normy zharmonizowane:** EN 18031-1:2024 (art. 3(3)(d)), EN 18031-2:2024 (art. 3(3)(e)); EN 18031-3:2024 (art. 3(3)(f)) — nie dotyczy
**Produkt:** KalkMate v1.0 — kalkulator edukacyjny z asystentem AI
**Model:** KalkMate-ESP32S3-v1
**Sprzęt / firmware:** PCB v4, ESP32-S3-WROOM-1-N16R8 / firmware 2.0.2
**Producent:** KAJPA Kacper Popko
**Data sporządzenia:** 2026-10-25 (rewizja 2; zastępuje wersję z 2026-06-12)

---

## 1. Zakres i metoda

Dokument stanowi element Teczki Technicznej urządzenia KalkMate i dokumentuje ocenę wymagań zasadniczych art. 3 ust. 3 lit. d), e) i f) dyrektywy RED w zakresie określonym rozporządzeniem delegowanym (UE) 2022/30.

Ocena oparta jest na przeglądzie kodu źródłowego firmware 2.0.2 (`src/main.cpp`, `src/*.h`, `platformio.ini`), narzędzia produkcyjnego (`tools/flasher`) oraz — w zakresie interfejsu urządzenie–serwer — kodu serwera `kalkmate.pl`. Opisano wyłącznie mechanizmy faktycznie obecne w kodzie. Znane ograniczenia wymieniono w rozdziale 7 jako ryzyka rezydualne.

Przypisanie do mechanizmów norm EN 18031 (ACM, AUM, SUM, SSM, SCM, RLM, NMM, TCM, CCK, GEC, CRY, LGM, DLM, UNM) ma charakter orientacyjny i wymaga weryfikacji z pełnym tekstem norm (p. 8).

## 2. Opis urządzenia z punktu widzenia bezpieczeństwa

### 2.1 Interfejsy

| Interfejs | Opis | Ekspozycja |
|---|---|---|
| WiFi 2,4 GHz (802.11 b/g/n) | Wyłącznie tryb klienta (STA); brak trybu AP; moc TX ograniczona do 8,5 dBm | Tylko połączenia wychodzące do `kalkmate.pl` (HTTPS), DNS, NTP |
| Bluetooth LE | Sprzętowo obecny w module, stos BT nie jest uruchamiany | Brak |
| USB-C (USB-CDC) | Ładowanie, log diagnostyczny (poziom błędów), jednorazowe okno prowizjonowania 3 s przy pierwszym starcie | Fizyczny dostęp |
| Klawiatura / OLED | Interfejs użytkownika | Fizyczny dostęp |
| Kamera OV2640 | Zdjęcie zadania na żądanie użytkownika | Lokalnie; obraz wysyłany wyłącznie do `kalkmate.pl` |

Urządzenie **nie uruchamia żadnych usług nasłuchujących** (brak serwera HTTP/Telnet/FTP, brak gniazd nasłuchujących TCP/UDP; w kodzie nie występują `WiFiServer`, `WebServer`, `softAP`). Wszystkie połączenia są inicjowane przez urządzenie.

### 2.2 Aktywa chronione

| Aktywo | Lokalizacja | Klasa |
|---|---|---|
| Hasła zapamiętanych sieci WiFi (do 8) | NVS `kalkmate` | Dane wrażliwe użytkownika / zasób sieciowy |
| Token urządzenia (64 hex) | NVS `kalkid` | Poświadczenie urządzenia |
| Klucz licencji, kod AI, ustawienia | NVS `kalkmate` | Dane konfiguracyjne / poświadczenie lokalne |
| Historia (5 wpisów), notatki, sprawdziany, kolejka offline (w tym zdjęcia), log zdarzeń | SPIFFS | Dane użytkownika (mogą zawierać dane osobowe w treści) |
| Firmware | Partycje `app0`/`app1` | Integralność urządzenia |
| Klucz publiczny weryfikacji OTA, certyfikaty główne TLS | Firmware | Zasoby zabezpieczające (publiczne, integralność wymagana) |
| Klucz API floty (obfuskowany) | Firmware | Wspólny sekret — traktowany jako jawny (p. 7) |
| Zdjęcia/teksty zadań w transmisji | Sieć | Dane użytkownika |

Klucz prywatny podpisywania firmware i klucz Flash Encryption **nie znajdują się na urządzeniu** (odpowiednio: serwer producenta oraz nośniki offline narzędzia produkcyjnego).

## 3. Art. 3 ust. 3 lit. d) — ochrona sieci (EN 18031-1)

*Wymaganie: urządzenie nie szkodzi sieci ani jej funkcjonowaniu i nie wykorzystuje niewłaściwie zasobów sieci.*

1. **Brak powierzchni ataku od strony sieci (GEC, TCM):** tryb STA, brak usług nasłuchujących, brak trybu AP; komunikacja wyłącznie z jednym, stałym serwerem `https://kalkmate.pl` (stała w firmware). Sesja zdalnej pomocy także jest wyłącznie odpytywaniem serwera przez urządzenie (p. 4.4).
2. **Ograniczenie emisji i zużycia medium:** moc nadawania ograniczona programowo do 8,5 dBm przy każdym włączeniu STA (`wifiStaOnLimited()`); radio wyłączane w trybie kalkulatora, w uśpieniu, podczas pracy kamery i po zakończeniu operacji sieciowych.
3. **Kontrola ruchu i odporność (RLM):**
   - limity czasu wszystkich połączeń (rejestracja 8 s, status 8 s, rozwiązywanie 65 s, notatki/sprawdziany 30 s, OTA: 15 s bez danych / 10 min łącznie, zdalna pomoc 4 s),
   - maks. 2 próby połączenia przy wysyłce zadania; przy błędach zdalnej pomocy wykładniczy backoff 2–30 s,
   - kolejka offline ograniczona do 3 zadań i 3 prób na zadanie, ponawianie tylko przy ponownym wejściu użytkownika w ekran; błędy trwałe (4xx) nie są ponawiane,
   - idempotentny `x-request-id` — ponowienie nie powoduje ponownego przetwarzania po stronie serwera,
   - jedno skojarzenie WiFi naraz (blokada ponownego `WiFi.begin()` w trakcie łączenia — zapobiega „burzy” prób skojarzenia z punktem dostępowym).
4. **Ograniczenia po stronie serwera:** rate-limity (`/solve` 30/min na urządzenie, `/register` 60/10 min na IP i 10/10 min na urządzenie, pobieranie firmware 120/h na IP) i limity rozmiaru żądań (10 MB, obraz 6 MB, tekst 50 kB) uniemożliwiają wykorzystanie pojedynczego urządzenia do generowania masowego ruchu wobec usługi.
5. **Uwierzytelnienie wobec usługi (AUM):** unikalny token urządzenia (p. 4.2).
6. **Bezpieczna aktualizacja (SUM):** p. 6.1.

## 4. Art. 3 ust. 3 lit. e) — ochrona danych osobowych i prywatności (EN 18031-2)

### 4.1 Bezpieczna komunikacja (SCM, CRY)

- Wszystkie połączenia z serwerem używają HTTPS (`WiFiClientSecure`, mbedTLS, TLS 1.2) z **weryfikacją łańcucha certyfikatów i nazwy hosta** wobec przypiętego pakietu certyfikatów głównych Let's Encrypt: ISRG Root X1, ISRG Root X2, ISRG Root YR, ISRG Root YE (`kalkmate_certs.h`, `setCACert()`). W firmware nie występuje `setInsecure()`.
- Obraz aktualizacji może być pobrany wyłącznie z adresu `https://kalkmate.pl/`.
- Zdjęcia, teksty zadań, poświadczenia i token urządzenia nie są przesyłane żadnym kanałem nieszyfrowanym. Ruchem nieszyfrowanym są jedynie zapytania DNS (do serwera z DHCP lub zapasowo 8.8.8.8 / 1.1.1.1) oraz NTP.

### 4.2 Uwierzytelnianie i kontrola dostępu (AUM, ACM)

- **Token urządzenia:** przy rejestracji serwer nadaje unikalny 64-znakowy token, przechowywany w NVS `kalkid` i wysyłany jako `x-device-token`. Serwer przechowuje wyłącznie skrót SHA-256 tokenu i porównuje go w stałym czasie; urządzenie, które ma przypisany token, musi go przesłać.
- **Dostęp do danych konta** (notatki, sprawdziany, historia, saldo) z urządzenia możliwy jest tylko dla urządzenia powiązanego z kontem; powiązanie odbywa się w panelu użytkownika (Device ID / QR), a reset fabryczny je zrywa (p. 4.5).
- **Brak domyślnych haseł sieciowych:** urządzenie nie posiada żadnego konta, hasła ani usługi dostępnej z sieci, dla której istniałoby hasło domyślne.
- **Kod AI (lokalna blokada interfejsu):** dostęp do trybu AI, ustawień (w tym konfiguracji WiFi), notatek i sprawdzianów wymaga wpisania kodu AI na klawiaturze urządzenia. Kod ustawiany jest przy produkcji na wartość wybraną przez klienta; **jeśli klient nie wybrał kodu, a także po resecie fabrycznym, obowiązuje kod domyślny `1111`**. Kod jest mechanizmem lokalnym (wymaga fizycznego dostępu) i nie jest poświadczeniem sieciowym; ocenę ryzyka zawiera p. 7.

### 4.3 Bezpieczne przechowywanie (SSM, CCK)

- Na egzemplarzach produkcyjnych (wgranych w trybie PROD_DEV/PROD_REL narzędzia `tools/flasher`) włączone jest **sprzętowe szyfrowanie pamięci flash ESP32-S3 (Flash Encryption) z kluczem XTS-AES-256** (64 B w eFuse `BLOCK_KEY0`, przeznaczenie XTS_AES_256_KEY_1/2, `SPI_BOOT_CRYPT_CNT`). W trybie PROD_REL wypalany jest `DIS_DOWNLOAD_MANUAL_ENCRYPT` (tryb Release). Klucz nie jest generowany przez narzędzie automatycznie, jego odcisk SHA-256 jest przypięty, a kopia przechowywana offline. Szyfrowaniem objęte są partycje firmware (bootloader, tablica partycji, aplikacja).
- **Partycje danych NVS i SPIFFS nie są szyfrowane** (brak NVS encryption / partycji `nvs_keys`; SPIFFS bez flagi `encrypted`) — ryzyko rezydualne R2.
- Klucz publiczny OTA i certyfikaty główne są częścią obrazu firmware (integralność chroniona podpisem OTA).

### 4.4 Minimalizacja danych i przejrzystość (UNM, GEC)

- Urządzenie nie przechowuje danych identyfikujących właściciela (imię, e-mail, hasło konta). Ekran „Status konta” pobiera e-mail konta z serwera do wyświetlenia, bez zapisu.
- Do serwera wysyłane są: treść zadania (tekst lub zdjęcie JPEG), Device ID (MAC WiFi), wersja firmware, klucz licencji, kod AI (przy rejestracji), tryb i język rozwiązania, bufor zdarzeń diagnostycznych (≤ 3 KB: przyczyny restartu, kody błędów, RSSI, adresy DNS/bramy — bez SSID, BSSID, haseł i tokenów).
- Logi USB-CDC na poziomie błędów, bez wartości sekretów.
- **Kamera:** aktywna wyłącznie na żądanie użytkownika, z podglądem na ekranie; poza tym sensor w trybie sprzętowego power-down (PWDN), sterownik zdeinicjalizowany, zegar XCLK zatrzymany.
- **Zdalna pomoc:** może ją uruchomić wyłącznie użytkownik na urządzeniu; przez cały czas sesji na ekranie jest widoczny wskaźnik; sesja ma lokalny limit 15 min i kończy się po stronie urządzenia także przy odpowiedziach 401/403/404. W trakcie sesji do serwera trafia obraz ekranu (2048 B co ~500 ms), a serwer może przekazać naciśnięcia klawiszy.

### 4.5 Usuwanie danych (DLM)

Reset fabryczny dostępny jest z Ustawień oraz — bez znajomości kodu AI — przez przytrzymanie **C/CE przez 5 s** w trybie kalkulatora (z potwierdzeniem OK). Usuwa: sieci WiFi i hasła, klucz licencji, kod AI, panic key, ustawienia, historię, mapowanie klawiatury, kolejkę offline (NVS `kalkmate`, `kalkhist`, `kalkmap`, `kalkoq`), wszystkie pliki SPIFFS (notatki, sprawdziany, historia, zdjęcia z kolejki, log zdarzeń) oraz wewnętrzną konfigurację WiFi ESP-IDF. Ustawia flagę `unpair` — przy następnym połączeniu serwer odpina urządzenie od konta użytkownika. Zachowywany jest wyłącznie token urządzenia (tożsamość sprzętu, nie dane użytkownika), stan walidacji OTA i znacznik prowizjonowania.

Dane przechowywane po stronie serwera (konto, notatki, historia, zdjęcia zadań zapisywane na serwerze z przypisaniem do właściciela urządzenia) podlegają Polityce Prywatności i RODO; administrator: KAJPA Kacper Popko, kontakt@kajpa.pl. Okres przechowywania zdjęć zadań na serwerze: **[DO UZUPEŁNIENIA]**.

## 5. Art. 3 ust. 3 lit. f) — ochrona przed oszustwami (EN 18031-3)

Urządzenie nie umożliwia przekazywania pieniędzy, wartości pieniężnej ani walut wirtualnych: nie posiada funkcji płatności, dostępu do bankowości ani portfela. Saldo tokenów AI jest prowadzone wyłącznie po stronie serwera na koncie użytkownika; zakup licencji/tokenów odbywa się w serwisie internetowym, nie na urządzeniu. Wymaganie art. 3(3)(f) w rozumieniu art. 1 ust. 3 rozporządzenia 2022/30 uznaje się za **nie dotyczy**.

## 6. Integralność oprogramowania i zarządzanie podatnościami

### 6.1 Podpisane aktualizacje OTA (SUM, CRY)

- Obraz firmware jest podpisywany przez producenta kluczem prywatnym **ECDSA P-256** (SHA-256); klucz publiczny jest wbudowany w firmware.
- Firmware budowany z `KALK_REQUIRE_SIGNED_OTA=1` **odrzuca aktualizacje bez podpisu**.
- Obraz jest strumieniowo zapisywany do nieaktywnej partycji z równoczesnym liczeniem SHA-256; **podpis jest weryfikowany przed aktywacją** (przed przełączeniem partycji startowej). Przy niepoprawnym podpisie zapis jest przerywany, a urządzenie pozostaje na dotychczasowej wersji.
- Pobranie obrazu wymaga uwierzytelnienia urządzenia, połączenia TLS z `kalkmate.pl` i adresu w domenie `https://kalkmate.pl/`; serwer dobiera obraz do wariantu sprzętu (`x-hw-variant: s3`).
- **Rollback:** nowa wersja jest „oczekująca walidacji”; po 3 nieudanych uruchomieniach urządzenie wraca do poprzedniej partycji. Zatwierdzenie następuje dopiero po pierwszej udanej odpowiedzi HTTPS 200 z serwera.
- Aktualizacja wymaga baterii ≥ 3,7 V lub zasilania USB; jest uruchamiana przez użytkownika (Ustawienia → Aktualizacje).
- Fizyczna ochrona firmware: na egzemplarzach produkcyjnych Flash Encryption XTS-AES-256 w trybie Release (p. 4.3).

### 6.2 Zarządzanie podatnościami

- Poprawki bezpieczeństwa dystrybuowane są przez podpisane OTA. Przeglądy bezpieczeństwa kodu urządzenia i serwera przeprowadzono w czerwcu 2026 (audyt i naprawy — `docs/security/`) oraz w październiku 2026 (m.in. wprowadzenie weryfikacji TLS, wymogu podpisu OTA, tokenu urządzenia, rate-limitów, usunięcia sekretów z logów).
- Kontakt w sprawie zgłaszania podatności: kontakt@kajpa.pl.
- Deklarowany okres wsparcia aktualizacjami bezpieczeństwa: **[DO UZUPEŁNIENIA]**.

## 7. Ryzyka rezydualne i znane ograniczenia

| ID | Ograniczenie | Wpływ | Ocena / środki łagodzące |
|---|---|---|---|
| R1 | **Wspólny klucz API floty** (`x-api-key`) zapisany w każdej binarce, jedynie obfuskowany XOR; dekodowany do statycznego bufora RAM bez nadpisywania. | Klucz należy uznać za jawny — nie identyfikuje urządzenia. | Uwierzytelnienie opiera się na tokenie urządzenia (R6). Ryzyko akceptowalne pod warunkiem, że serwer nie przyznaje uprawnień na podstawie samego klucza. |
| R2 | **NVS i SPIFFS nieszyfrowane** — hasła WiFi, token urządzenia, klucz licencji, kod AI, historia, notatki, zdjęcia z kolejki są zapisane w postaci jawnej; Flash Encryption chroni tylko firmware. Usuwanie w NVS jest logiczne (dane mogą fizycznie pozostać do czasu wymazania strony). | Osoba z fizycznym dostępem i odczytem pamięci (np. przez USB w trybie pobierania) może odczytać hasła WiFi i token. | Wymaga fizycznego dostępu. Zalecenie: NVS encryption + szyfrowanie SPIFFS w kolejnej rewizji. |
| R3 | **Kod AI domyślny `1111`**, gdy klient nie wybrał własnego, oraz po resecie fabrycznym; brak limitu prób wpisania kodu (4 cyfry). | Osoba z fizycznym dostępem może wejść w menu (konfiguracja WiFi, notatki, sprawdziany). | Kod nie jest poświadczeniem sieciowym; funkcja ma charakter blokady interfejsu. Klient może wybrać kod przy zamówieniu i zmienić go w Ustawieniach. Zalecenie: wymuszenie zmiany kodu przy pierwszym uruchomieniu lub losowy kod per urządzenie. |
| R4 | **Brak Secure Boot**. | Brak kryptograficznej weryfikacji bootloadera/aplikacji przy starcie. | Na egzemplarzach produkcyjnych Flash Encryption Release uniemożliwia uruchomienie obrazu wgranego bez klucza producenta; OTA wymaga podpisu. |
| R5 | **TLS bez kontroli dat ważności i odwołań** (mbedTLS core 2.0.17 bez `CONFIG_MBEDTLS_HAVE_TIME_DATE`, brak CRL/OCSP). | Przeterminowany lub odwołany certyfikat wystawiony pod pinowanymi rootami ISRG zostałby zaakceptowany. | Zaufanie ograniczone do 4 rootów Let's Encrypt; weryfikacja nazwy hosta. |
| R6 | **Tryb przejściowy uwierzytelniania na serwerze:** urządzenia bez tokenu (stary firmware) są akceptowane, dopóki serwer nie działa w trybie ścisłym (`DEVICE_AUTH_STRICT=1`). | Możliwość podszycia się pod urządzenie, które nigdy nie otrzymało tokenu, przy znajomości jego Device ID (MAC). | Stan trybu ścisłego w produkcji: **[DO POTWIERDZENIA]**. Urządzenie z tokenem zawsze musi go przesłać. |
| R7 | **Brak ochrony przed powrotem do starszej podpisanej wersji** — numer wersji z serwera nie jest objęty podpisem. | Przy przejęciu serwera możliwe podanie starszego, poprawnie podpisanego obrazu jako „nowszego”. | Wymaga przejęcia serwera producenta; obraz nadal musi być podpisany kluczem producenta. |
| R8 | **Interfejsy debug / pobierania na USB** — narzędzie produkcyjne nie wypala `DIS_USB_JTAG` / `DIS_PAD_JTAG` ani wyłączenia trybu pobierania. | Fizyczny dostęp do debugowania/odczytu pamięci. | Do weryfikacji stanu eFuse na egzemplarzu produkcyjnym: **[DO POTWIERDZENIA]**. |
| R9 | **Zapasowy publiczny DNS (8.8.8.8 / 1.1.1.1) i NTP bez uwierzytelnienia.** | Ujawnienie operatorom DNS nazw zapytań (`kalkmate.pl`); możliwość podstawienia czasu. | TLS nie zależy od czasu systemowego; nazwa hosta weryfikowana w TLS. |
| R10 | **Egzemplarze wcześniejszych serii** — narzędzie produkcyjne rozpoznaje stary klucz Flash Encryption 32 B (XTS-AES-128) jako skompromitowany. | Egzemplarze zaszyfrowane starym kluczem nie mają ochrony firmware przed odczytem. | Czy takie egzemplarze trafiły do klientów: **[DO POTWIERDZENIA]** (`production_log.csv`). |
| R11 | **Wyłączony detektor brownout** (`RTC_CNTL_BROWN_OUT_REG = 0`). | Przy spadkach napięcia możliwa niestabilna praca radia zamiast resetu. | Programowy watchdog VBAT (wyłączenie przy napięciu krytycznym), limit mocy TX 8,5 dBm zmniejsza spadki napięcia. |

## 8. Wnioski i elementy do potwierdzenia

Na podstawie przeglądu kodu firmware 2.0.2 stwierdza się, że KalkMate (model KalkMate-ESP32S3-v1, PCB v4):
- nie udostępnia usług sieciowych, komunikuje się wyłącznie z serwerem producenta przez HTTPS z weryfikacją certyfikatu, ogranicza moc nadawania i ruch sieciowy (art. 3(3)(d)),
- chroni dane użytkownika w transmisji (TLS z przypiętymi rootami), uwierzytelnia się unikalnym tokenem, minimalizuje dane, zapewnia widoczną kontrolę nad kamerą i zdalną pomocą oraz pełne usunięcie danych resetem fabrycznym (art. 3(3)(e)),
- nie posiada funkcji finansowych (art. 3(3)(f) — nie dotyczy),
- zapewnia integralność oprogramowania przez podpisane OTA (ECDSA P-256) z weryfikacją przed aktywacją i rollbackiem, a na egzemplarzach produkcyjnych — przez Flash Encryption XTS-AES-256.

Ryzyka rezydualne R1–R11 oceniono jako akceptowalne dla urządzenia edukacyjnego tej klasy, z zaleceniami do kolejnych rewizji (R2, R3, R4, R8).

**Do potwierdzenia przez producenta przed podpisaniem deklaracji:**
1. Pełna ocena według EN 18031-1:2024 i EN 18031-2:2024 (drzewa decyzyjne mechanizmów) — powyższe przypisanie jest orientacyjne. Należy sprawdzić **ograniczenia, z jakimi normy EN 18031 zostały opublikowane w Dz.U. UE** (decyzja wykonawcza Komisji (UE) 2025/138): jeżeli któreś z ograniczeń dotyczy produktu (np. w zakresie mechanizmów uwierzytelniania/haseł), zastosowanie samej normy nie daje domniemania zgodności, a ocena art. 3(3)(d)(e) może wymagać udziału jednostki notyfikowanej (moduł B+C lub H) zamiast modułu A.
2. Stan trybu `DEVICE_AUTH_STRICT` na serwerze produkcyjnym (R6).
3. Stan eFuse (Flash Encryption Release, JTAG, tryb pobierania) na losowym egzemplarzu z bieżącej produkcji (R8) oraz brak w obrocie egzemplarzy ze starym kluczem (R10).
4. Okres przechowywania zdjęć na serwerze i deklarowany okres wsparcia aktualizacjami.

Podpisano w imieniu producenta:
*Kacper Popko — Właściciel KAJPA* — podpis: ______________________ data: __________
