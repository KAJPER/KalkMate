<p align="center">
  <img src="website/public/kalkmate_logo.svg" alt="KalkMate logo" width="220">
</p>

<h1 align="center">KalkMate</h1>

<p align="center">
  🌐 <b>Język:</b> Polski · <a href="README.en.md">English</a>
</p>

<p align="center">
  <b>Kalkulator wspomagany AI dla polskich maturzystów.</b><br>
  Zrób zdjęcie zadania — dostań rozwiązanie na ekranie, bez telefonu i bez rozpraszaczy.
</p>

<p align="center">
  <img src="website/public/galeria/kalkulator-naukowy-kalkmate-ukryta-kamera.jpg" alt="KalkMate na stołówce szkolnej, ekran wyświetla nazwę urządzenia" width="640">
</p>

> **Status projektu:** pierwsza płytka (PCB v4, ESP32-S3) zlutowana i przechodzi bring-up/debugowanie. Firmware, backend AI i sklep internetowy rozwijane są równolegle. Obudowa w prototypie to zaadaptowana obudowa gotowego kalkulatora — docelowa, własna obudowa jest projektowana (patrz `docs/dol obudowy kalkulator.stl`).

---

## Spis treści

- [Czym jest KalkMate](#czym-jest-kalkmate)
- [Jak to działa](#jak-to-działa)
- [Galeria](#galeria)
- [Sprzęt](#sprzęt)
- [Firmware](#firmware-esp32-carduino)
- [Backend i strona](#backend-i-strona-website)
- [Narzędzia produkcyjne](#narzędzia-tools)
- [Stack technologiczny](#stack-technologiczny)
- [Struktura repozytorium](#struktura-repozytorium)
- [Bezpieczeństwo](#bezpieczeństwo)
- [Rozwój projektu](#rozwój-projektu)
- [Mapa drogowa](#mapa-drogowa)
- [FAQ](#faq)
- [Licencja](#licencja)
- [Autor](#autor)

---

## Czym jest KalkMate

Komercyjny produkt edukacyjny skierowany do polskich uczniów przygotowujących się do matury — kalkulator naukowy do nauki w domu, z kompaktowo zintegrowaną kamerą (bez wystającego obiektywu) i łącznością WiFi. Gdy uczeń utknie przy odrabianiu zadań, robi zdjęcie treści, a urządzenie w kilka sekund zwraca pełne, wytłumaczone rozwiązanie — bez telefonu, bez przeglądarki, bez powiadomień i rozpraszaczy typowych dla korzystania z aplikacji AI na smartfonie.

Celem jest tania, wygodna alternatywa dla drogich korepetycji i chaotycznego szukania rozwiązań w internecie — narzędzie do samodzielnej nauki, które pomaga **zrozumieć** zadanie (pełny tok rozumowania), a nie tylko podaje wynik. To nie jest urządzenie do użytku podczas nadzorowanych sprawdzianów czy egzaminów — jego miejsce jest przy biurku, w domu.

Obsługiwane przedmioty: **matematyka, fizyka, chemia, biologia** — system prompt AI oparty jest na arkuszach CKE i oficjalnych standardach oceniania maturalnego.

### Dla kogo

- Uczniów liceum/technikum, którzy przygotowują się do matury i utykają na konkretnych zadaniach podczas samodzielnej nauki.
- Rodziców szukających tańszej, dostępnej 24/7 alternatywy dla korepetycji na konkretny przedmiot.
- Każdego, kto woli zrozumieć tok rozwiązania niż dostać goły wynik z kalkulatora czy wyszukiwarki.

## Jak to działa

```
  ┌──────────────┐      zdjęcie (JPEG)      ┌──────────────────┐      obraz + prompt      ┌─────────────┐
  │   KalkMate   │ ───────────────────────▶ │  Backend Next.js │ ───────────────────────▶ │ Gemini API  │
  │ (ESP32-S3 +  │        HTTPS             │  (kalkmate.pl)    │   gemini-2.5-pro          │  (Google)   │
  │  OV2640 kam.)│ ◀─────────────────────── │                   │ ◀─────────────────────── │             │
  └──────────────┘   rozwiązanie (tekst)    └──────────────────┘   fallback: 2.5-flash      └─────────────┘
        │
        ▼
  ┌──────────────┐
  │  OLED SSD1322 │  wyświetla pełny tok rozumowania
  └──────────────┘
```

1. **Zdjęcie** — kamera OV2640, kompaktowo zintegrowana z obudową, fotografuje zadanie.
2. **Wysyłka** — urządzenie łączy się przez WiFi i wysyła zdjęcie (Base64 JPEG, ≤8MB) do własnego backendu przez HTTPS, autoryzując się nagłówkami `x-api-key` / `x-device-id` / `x-license-key`.
3. **AI** — backend przekazuje zadanie do **Google Gemini** (`gemini-2.5-pro`, z automatycznym fallbackiem do `gemini-2.5-flash` przy przeciążeniu) razem z system promptem dopasowanym pod polską maturę.
4. **Wyświetlenie** — rozwiązanie renderuje się na ekranie OLED 256×64 — z pełnym tokiem rozumowania, nie tylko końcowym wynikiem.
5. **Offline** — brak WiFi? Zapytanie ląduje w kolejce lokalnej (NVS/SPIFFS) i wysyła się automatycznie po odzyskaniu połączenia.
6. **Prywatność** — jeden klawisz („panika") natychmiast wraca do trybu zwykłego kalkulatora, np. gdy ktoś podchodzi do biurka i uczeń woli nie tłumaczyć, z czego korzysta.

## Galeria

<table>
<tr>
<td width="50%">
<img src="website/public/galeria/kalkulator-kalkmate-platforma-pcb-elektronika.png" alt="Ekran OLED z napisem KalkMate na obudowie kalkulatora Esperanza">
<p align="center"><sub>Splash screen na wyświetlaczu OLED SSD1322</sub></p>
</td>
<td width="50%">
<img src="website/public/galeria/kalkulator-graficzny-ai-ekran-lcd.png" alt="KalkMate używany do nauki wieczorem, obok laptop i notatki">
<p align="center"><sub>Nauka w praktyce — notatki, podręcznik, KalkMate</sub></p>
</td>
</tr>
<tr>
<td width="50%">
<img src="website/public/kalkulator-kalkmate-ukryta-kamera-zamknieta.png" alt="Tył obudowy kalkulatora, kamera dyskretnie zintegrowana z obudową">
<p align="center"><sub>Tył obudowy — kamera dyskretnie zintegrowana, bez wystającego obiektywu</sub></p>
</td>
<td width="50%">
<img src="website/public/galeria/kalkulator-ai-interfejs-uzytkownika.png" alt="Interfejs panelu klienta na stronie internetowej">
<p align="center"><sub>Panel klienta na kalkmate.pl</sub></p>
</td>
</tr>
</table>

## Sprzęt

Pierwsza wersja płytki (v3) oparta była na ESP32-WROVER-E, kolejna (v4, aktualna) migruje na ESP32-S3. Pełna dokumentacja pinout/schematów: [`CLAUDE.md`](CLAUDE.md).

| Podzespół | Opis |
|---|---|
| **MCU** | ESP32-S3-WROOM-1-N16R8 (16MB flash, 8MB PSRAM) · starsze płytki: ESP32-WROVER-E |
| **Ekran** | OLED SSD1322 256×64, bare glass (COF na taśmie FFC), 4-wire SPI |
| **Kamera** | OV2640, interfejs 8-bit parallel + I2C/SCCB, kompaktowo zintegrowana z obudową |
| **Klawiatura** | Matryca 5×5 (25 klawiszy), sterowana ekspanderem I2C MCP23017 |
| **Zasilanie** | LiPo 3.7V, ładowarka MCP73831 + ochrona DW01A/FS8205A, boost 12V (OLED), LDO 2.8V/1.3V (kamera) |
| **Programowanie** | USB-C (kontroler USB4110GFA) + CH340C (USB-UART) |
| **Zgodność** | CE self-declaration przygotowana (RED / RoHS II / LVD) — proces certyfikacji w toku; moduł radiowy ESP32-S3-WROOM-1 posiada własny certyfikat RED od Espressif |

### Zarządzanie energią

Urządzenie agresywnie wyłącza nieużywane peryferia, żeby wycisnąć jak najwięcej z małego akumulatora LiPo:

```
Boost 12V (OLED) OFF   → ~140 mA oszczędności
Kamera PWDN (power-down) → ~50 mA oszczędności
WiFi OFF                → ~80 mA oszczędności

Kolejność: kamera ON → zdjęcie → kamera OFF → WiFi ON → upload → WiFi OFF
(XCLK kamery zakłóca WiFi 2.4GHz, dlatego nigdy nie działają jednocześnie)
```

## Firmware (ESP32, C/Arduino)

Moduły w [`src/`](src/):

| Plik | Funkcja |
|---|---|
| `main.cpp` | punkt wejścia, główna pętla, dispatch menu |
| `camera.h` | inicjalizacja OV2640, przechwytywanie JPEG |
| `solve_screen.h` | klawiatura ekranowa, przechwycenie zdjęcia, zapytanie do AI, render odpowiedzi |
| `calculator.h` | tryb zwykłego kalkulatora (8-cyfrowy, M+/M-/MR/MC) z blokadą PIN na tryb AI |
| `wifi_settings.h` / `wifi_persist.h` | konfiguracja i zapamiętywanie sieci WiFi |
| `offline_queue.h` | kolejkowanie zapytań (tekst/zdjęcie) gdy brak WiFi, wysyłka po reconnect |
| `ota_update.h` | aktualizacje OTA z weryfikacją podpisu (ECDSA P-256 + SHA-256) |
| `device_account.h` | parowanie urządzenia i synchronizacja licencji z serwerem |
| `history.h` | ostatnie 5 par pytanie/odpowiedź (NVS) |
| `notes.h` / `tests.h` | notatki i sprawdziany synchronizowane z serwera |
| `battery.h` / `power.h` | pomiar baterii, light-sleep, power-down peryferiów |
| `panic.h` | klawisz prywatności — natychmiastowy powrót do zwykłego kalkulatora |
| `settings_screen.h` / `about_screen.h` / `info_screen.h` / `screen_test.h` | ustawienia, ekran „o programie", pomoc, test wyświetlacza |

**Build:** PlatformIO, środowisko `esp32s3` (aktualne PCB v4) lub `esp32wrover_legacy` (starsze płytki), framework Arduino. Zależności: `U8g2` (SSD1322), `Adafruit MCP23017`, `esp32-camera`, `QRCode`.

```bash
pio run -e esp32s3 -t upload
```

## Backend i strona (`website/`)

Next.js (App Router) + Prisma + Tailwind CSS, wdrożone na VPS pod `kalkmate.pl`:

- **API urządzenia** (`/api/device/*`) — rejestracja, status licencji, `/solve` (tekst lub zdjęcie → Gemini), notatki, sprawdziany, dystrybucja OTA (`/firmware/check`, `/firmware/download/[version]`).
- **Panel klienta** (`/panel`) — logowanie przez NextAuth, historia rozwiązań i notatek zsynchronizowana z urządzenia, zarządzanie subskrypcją.
- **Panel admina** (`/admin`) — logowanie z 2FA (TOTP/Google Authenticator), zarządzanie użytkownikami/urządzeniami/licencjami, magazyn, podgląd zużycia Gemini API.
- **Sklep** — landing page, koszyk, wybór Paczkomatu InPost (Geowidget), płatności **Stripe** oraz **Przelewy24** (BLIK), maile transakcyjne przez Resend.

## Narzędzia (`tools/`)

- `flasher/` — narzędzie produkcyjne do flashowania gotowych urządzeń (GUI + CLI), z checklistą wysyłkową.
- `i2c_scan/` — skaner magistrali I2C do bring-up nowych płytek.
- `keymap_scan/` — narzędzie do mapowania i weryfikacji matrycy klawiatury.

## Stack technologiczny

| Warstwa | Technologie |
|---|---|
| Firmware | C++ / Arduino (ESP32 core), PlatformIO, U8g2, esp32-camera |
| Backend | Next.js 16 (App Router), React 19, Prisma + SQLite, NextAuth |
| Płatności | Stripe, Przelewy24 (BLIK) |
| AI | Google Gemini (`gemini-2.5-pro` / `gemini-2.5-flash`) |
| Infrastruktura | Ubuntu VPS, nginx, PM2, self-hosted (pull-based OTA) |
| Inne | KaTeX (render wzorów), Resend (e-mail), TOTP 2FA |

## Struktura repozytorium

```
├── src/                 # firmware ESP32 (C++/Arduino)
├── include/             # config.h, nagłówki wspólne
├── website/             # Next.js — backend, panel klienta/admina, sklep
├── tools/                # flasher produkcyjny, i2c_scan, keymap_scan
├── certyfikacja/        # BOM, certyfikaty komponentów, deklaracja zgodności CE
├── docs/                 # dokumentacja techniczna, model 3D obudowy
└── CLAUDE.md             # pełny przewodnik pinout/schematów dla tej płytki
```

## Bezpieczeństwo

Aktualizacje OTA są podpisywane (ECDSA P-256 + SHA-256) i weryfikowane przed instalacją — urządzenie odrzuca niepodpisany lub błędnie podpisany firmware. Znane obszary do dalszego utwardzenia (współdzielony klucz API urządzeń, brak Flash Encryption/Secure Boot na starszych płytkach) są świadomie udokumentowane w `SECURITY_AUDIT.md` i `security-repairs.md` — traktuj je jako plan rozwoju, nie jako gotowy stan produkcyjny.

## Rozwój projektu

Firmware jest rozwijany iteracyjnie od pierwszego działającego prototypu — poniżej wybrane kamienie milowe (pełna lista w `tools/firmware-releases.seed.json`):

| Wersja | Co się zmieniło |
|---|---|
| `0.1.0` | Pierwsza działająca wersja: kalkulator + WiFi |
| `0.2.0` | Aktualizacje OTA przez HTTPS |
| `0.3.0` | Tryb AI: zdjęcie / tekst / historia zapytań |
| `0.4.0` | Notatki i sprawdziany synchronizowane przez WiFi |
| `0.5.0` | Parowanie urządzenia (deviceId + unlockCode) i status konta |
| `0.6.x` | Obsługa LaTeX w odpowiedziach AI (wzory, funkcje matematyczne, macierze) |
| `1.0.0` | Migracja na PCB v4 (ESP32-S3-WROOM-1-N16R8, natywny USB-C) |
| `1.1.x` | Pomiar i zarządzanie baterią LiPo, ochrona przed brownoutem |
| `1.3.x` | Stabilizacja kamery OV2640 (ekspozycja, balans bieli, orientacja) |
| `1.4.x` | Podpisywane OTA (ECDSA P-256) + obfuskacja klucza API w binarce |
| `1.5.0` | Podgląd na żywo (viewfinder) z paskiem ostrości przed zdjęciem |
| `1.6.9` | Aktualna wersja produkcyjna |

## Mapa drogowa

Kierunki rozwoju firmware, nad którymi trwają prace lub które są zaplanowane:

- **Deep sleep** urządzenia w bezczynności, wybudzanie klawiszem — znaczące wydłużenie czasu pracy na baterii.
- **Kalibracja krzywej baterii LiPo** — dokładniejszy wskaźnik % naładowania.
- **Szybszy reconnect WiFi** — cache BSSID/kanału ostatniej sieci, pominięcie pełnego skanu.
- **Multipart upload zdjęć** zamiast Base64-w-JSON — mniej zużycia PSRAM, szybszy transfer na słabym WiFi.
- **Auto-capture** — automatyczne zdjęcie po wykryciu stabilnej, ostrej klatki w podglądzie na żywo.
- **OLED grayscale (4-bit)** — płynniejszy, antyaliasowany interfejs zamiast trybu 1-bit.
- **Własna obudowa** — docelowo dedykowany projekt obudowy zamiast adaptacji gotowego kalkulatora (model bazowy: `docs/dol obudowy kalkulator.stl`).

## FAQ

**Czy KalkMate zastępuje naukę?**
Nie — celem jest pokazanie pełnego toku rozwiązania, żeby uczeń zrozumiał metodę, a nie tylko przepisał wynik. To narzędzie do nauki w domu, nie do użytku na sprawdzianach czy egzaminach.

**Co się dzieje bez internetu?**
Zapytania (tekstowe lub ze zdjęciem) trafiają do kolejki lokalnej i wysyłają się automatycznie, gdy urządzenie odzyska WiFi.

**Jakie przedmioty są obsługiwane?**
Matematyka, fizyka, chemia i biologia — zakres i poziom trudności dopasowany do polskiej matury (arkusze CKE, oficjalne standardy oceniania).

**Czy mogę zbudować własne urządzenie na bazie tego repozytorium?**
Kod i schematy są udostępnione do wglądu (portfolio/edukacja), ale repo jest objęte licencją proprietary — użycie komercyjne lub produkcja własnych urządzeń wymaga zgody autora. Szczegóły w sekcji [Licencja](#licencja).

## Licencja

Kod i materiały w tym repozytorium są udostępnione publicznie **wyłącznie do wglądu** (portfolio, cele edukacyjne, przejrzystość bezpieczeństwa). Wszelkie prawa zastrzeżone — szczegóły w [`LICENSE`](LICENSE). Kopiowanie, modyfikacja i użycie komercyjne (w tym produkcja urządzeń na bazie tego projektu) wymaga pisemnej zgody autora.

## Autor

**KAJPA Kacper Popko** — [kalkmate.pl](https://kalkmate.pl)
