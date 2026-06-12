# Cybersecurity Assessment (Ocena Cyberbezpieczeństwa)

**Dokumentacja techniczna zgodności z Dyrektywą RED 2014/53/UE (Artykuł 3.3 d, e, f)**  
**Norma zharmonizowana:** EN 18031  
**Produkt:** KalkMate v1.0 — kalkulator edukacyjny z asystentem AI  
**Model:** KalkMate-ESP32S3-v1  
**Producent:** KalkMate  
**Data sporządzenia:** 2026-06-12  

---

## 1. Wprowadzenie i zakres dokumentu

Niniejszy dokument stanowi element Teczki Technicznej (Technical File) urządzenia **KalkMate v1.0** i służy wykazaniu zgodności z wymaganiami zasadniczymi dotyczącymi cyberbezpieczeństwa określonymi w **Artykule 3 ust. 3 Dyrektywy RED 2014/53/UE** (obowiązującej dla urządzeń radiowych wprowadzanych do obrotu w Unii Europejskiej).

Ocena została przeprowadzona w oparciu o specyfikację oprogramowania układowego (firmware) urządzenia oraz architekturę serwera centralnego komunikującego się z urządzeniem.

---

## 2. Ochrona sieci i zasobów (Artykuł 3.3 d)

*Wymaganie: Urządzenie radiowe nie może szkodzić sieci ani jej funkcjonowaniu, ani niewłaściwie wykorzystywać zasobów sieciowych, powodując niedopuszczalne pogorszenie jakości usług.*

### Zastosowane środki techniczne w KalkMate v1.0:
1. **Brak trybów nasłuchu (Tryb Station-Only)**:  
   Urządzenie działa wyłącznie w trybie stacji klienckiej (STA). Oprogramowanie układowe nie uruchamia żadnych gniazd nasłuchujących (brak wbudowanego serwera HTTP, Telnet, FTP itp.). Urządzenie nie może przyjmować połączeń przychodzących z sieci zewnętrznej, co całkowicie eliminuje możliwość zdalnego przejęcia kontroli nad urządzeniem drogą sieciową (np. przez port-scanning).
2. **Standardowe protokoły sieciowe**:  
   Łączność bezprzewodowa jest nawiązywana przy użyciu standardowych, certyfikowanych bibliotek stosu sieciowego TCP/IP wbudowanych w framework Espressif ESP-IDF (LwIP). Urządzenie komunikuje się wyłącznie ze zdefiniowanymi adresami IP poprzez standardowe zapytania klient-serwer.
3. **Mitygacja ataków DDoS i spamu (Anty-DoS)**:  
   - Wszystkie zapytania wysyłane z urządzenia do API serwera centralnego są limitowane czasowo po stronie oprogramowania (timeout ustawiony na 8 sekund dla autoryzacji i 45 sekund dla zapytań AI).
   - Serwer centralny Next.js posiada mechanizmy ograniczania częstotliwości żądań (rate limiting) powiązane z kluczem API oraz unikalnym identyfikatorem urządzenia (`x-device-id`), uniemożliwiając wykorzystanie urządzenia do generowania masowego ruchu sieciowego (spamu).
   - Maksymalny rozmiar wysyłanego Base64 obrazu JPEG jest limitowany sprzętowo w pamięci PSRAM urządzenia oraz walidowany na serwerze (maksymalnie 8 MB dla Base64), zapobiegając próbom przeciążenia pamięci serwera.

---

## 3. Ochrona danych osobowych i prywatności (Artykuł 3.3 e)

*Wymaganie: Urządzenie radiowe zawiera zabezpieczenia zapewniające ochronę danych osobowych i prywatności użytkownika oraz abonenta.*

### Zastosowane środki techniczne w KalkMate v1.0:
1. **Szyfrowanie transmisji danych (HTTPS/TLS)**:  
   Wszystkie dane przesyłane z urządzenia (zapytania tekstowe, zdjęcia zadań z aparatu, poświadczenia licencji) są szyfrowane w warstwie transportowej za pomocą protokołu HTTPS przy użyciu bezpiecznych algorytmów szyfrujących TLS 1.2+ (AES-256-GCM, ChaCha20-Poly1305). Szyfrowanie to uniemożliwia podsłuchanie transmisji (sniffing) w sieci lokalnej użytkownika.
2. **Minimalizacja przetwarzanych danych na urządzeniu**:  
   KalkMate v1.0 nie przechowuje lokalnie żadnych danych osobowych użytkownika (takich jak nazwisko, adres e-mail, dane logowania do portalu). Baza danych użytkowników i powiązania kont z urządzeniami przechowywane są wyłącznie na zabezpieczonym serwerze centralnym.
3. **Bezpieczne przechowywanie poświadczeń**:  
   Hasło do sieci WiFi oraz klucz licencyjny są zapisywane w pamięci nieulotnej NVS (Non-Volatile Storage) mikrokontrolera ESP32-S3. Dostęp do tej partycji jest kontrolowany przez sumę kontrolną CRC32, co zapobiega niezauważonej manipulacji danymi.
4. **Fizyczne wyłączanie kamery (Privacy by Design)**:  
   Moduł aparatu OV2640 jest zasilany wyłącznie podczas aktywnego korzystania z trybu rozwiązywania zadań ze zdjęcia. W stanie czuwania (gdy użytkownik korzysta z trybu tekstowego lub tradycyjnego kalkulatora), aparat jest wprowadzany w tryb sprzętowego power-down (`PWDN` na `HIGH`), co fizycznie odcina zasilanie od sensora obrazu i uniemożliwia potajemne przechwytywanie obrazu.
5. **Procedura pełnego usuwania danych (Factory Reset)**:  
   Użytkownik ma możliwość wywołania funkcji przywracania ustawień fabrycznych bezpośrednio z menu urządzenia. Procedura ta bezpowrotnie usuwa wszystkie dane konfiguracji WiFi, klucze licencji, kody AI, lokalną historię zapytań AI oraz pobrane z serwera notatki/sprawdziany poprzez wyczyszczenie przestrzeni NVS oraz sformatowanie partycji systemowej SPIFFS.

---

## 4. Zabezpieczenie przed oszustwami finansowymi (Artykuł 3.3 f)

*Wymaganie: Urządzenie radiowe wspiera określone funkcje zapewniające ochronę przed oszustwami.*

### Ocena ryzyka dla KalkMate v1.0:
Urządzenie KalkMate v1.0 służy celom edukacyjnym i nie posiada żadnych funkcji związanych z realizacją transakcji płatniczych, dostępem do bankowości elektronicznej, przelewami środków ani przetwarzaniem instrumentów finansowych. W związku z tym wymaganie to uznaje się za **nie dotyczy** (brak wektorów ataku w tym obszarze).

---

## 5. Integralność oprogramowania i zarządzanie podatnościami

### Zastosowane środki techniczne w KalkMate v1.0:
1. **Bezpieczna aktualizacja oprogramowania układowego (Signed OTA)**:  
   W celu ochrony przed wgraniem zmodyfikowanego lub złośliwego oprogramowania (które mogłoby np. podsłuchiwać sieć użytkownika), wdrożono mechanizm weryfikacji podpisu cyfrowego:
   - Pliki binarne oprogramowania (.bin) publikowane na serwerze są podpisywane kluczem prywatnym ECDSA P-256 należącym wyłącznie do producenta.
   - Mikrokontroler podczas pobierania aktualizacji oblicza skrót SHA-256 z pobranego strumienia danych.
   - Przed dokonaniem restartu urządzenia, oprogramowanie układowe weryfikuje podpis cyfrowy z użyciem wbudowanego na stałe klucza publicznego producenta za pomocą modułu `mbedtls`. Aktualizacje bez poprawnego podpisu są odrzucane i kasowane z pamięci.
2. **Autoryzacja pobierania firmware (Next.js backend)**:  
   Serwer Next.js udostępnia pliki oprogramowania za pośrednictwem prywatnego endpointu `/api/device/firmware/download/[version]`, który wymaga uwierzytelnienia kluczem API oraz sprawdzenia, czy żądający `x-device-id` jest zarejestrowany w bazie danych. Zapobiega to publicznemu pobieraniu oprogramowania układowego przez osoby nieuprawnione i utrudnia inżynierię wsteczną.
3. **Zabezpieczenie przed wyodrębnieniem klucza API (Obfuskacja)**:  
   Globalny klucz komunikacyjny API jest ukryty w binariach oprogramowania za pomocą algorytmu XOR-owania podczas kompilacji (module `key_obfuscate.h`). Klucz jest rekonstruowany w pamięci RAM wyłącznie na czas trwania zapytania HTTPS, a bufor jest natychmiast nadpisywany.

---

## 6. Podsumowanie i oświadczenie o zgodności

Na podstawie przeprowadzonej analizy technicznej stwierdza się, że urządzenie **KalkMate v1.0** (Model: **KalkMate-ESP32S3-v1**):
- Posiada wdrożone adekwatne środki techniczne zapobiegające zakłócaniu pracy sieci oraz nieautoryzowanemu wykorzystaniu jej zasobów (zgodność z RED Art. 3.3 d).
- Chroni prywatność użytkowników poprzez szyfrowanie danych protokołem HTTPS/TLS, minimalizację danych osobowych na urządzeniu, fizyczne wyłączanie sensora kamery oraz mechanizm Factory Reset (zgodność z RED Art. 3.3 e).
- Nie przetwarza płatności ani danych finansowych, w związku z czym nie generuje ryzyk w obszarze nadużyć finansowych (zgodność z RED Art. 3.3 f).
- Gwarantuje integralność kodu poprzez kryptograficzną weryfikację podpisu oprogramowania ECDSA P-256 podczas aktualizacji OTA.

Wdrożone zabezpieczenia są w pełni adekwatne do klasy ryzyka urządzenia IoT o charakterze edukacyjnym i spełniają wymagania normy **EN 18031**.

Podpisano w imieniu producenta:  
*KalkMate Compliance Team*
