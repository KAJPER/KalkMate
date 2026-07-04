# KalkMate 🇵🇱📐

**KalkMate** to kalkulator naukowy wspomagany AI, zaprojektowany dla polskich maturzystów. Robi zdjęcie zadania (matematyka, fizyka, chemia, biologia), wysyła je do serwera AI i wyświetla gotowe, wytłumaczone rozwiązanie na wbudowanym ekranie OLED — bez telefonu, bez przeglądarki, bez rozpraszaczy.

> **Status projektu:** pierwsza płytka (PCB v4, ESP32-S3) zlutowana i przechodzi bring-up/debugowanie. Firmware, backend i sklep internetowy są rozwijane równolegle.

---

## Jak to działa

1. **Zrób zdjęcie** zadania wbudowaną kamerą OV2640 (ukrytą w obudowie kalkulatora).
2. **Urządzenie wysyła zdjęcie** przez WiFi (HTTPS) do własnego backendu.
3. **Backend przekazuje zadanie do Gemini** (`gemini-2.5-pro`, z automatycznym fallbackiem do `gemini-2.5-flash`) wraz z system promptem dopasowanym pod arkusze i standardy oceniania CKE.
4. **Rozwiązanie wraca na ekran OLED** urządzenia — z pełnym tokiem rozumowania, nie tylko wynikiem.
5. Gdy nie ma WiFi, zapytanie trafia do **kolejki offline** i wysyła się automatycznie po odzyskaniu połączenia.

---

## Sprzęt

| Podzespół | Opis |
|---|---|
| MCU | ESP32-S3-WROOM-1-N16R8 (16MB flash, 8MB PSRAM) — starsze płytki: ESP32-WROVER-E |
| Ekran | OLED SSD1322 256×64, bare glass, SPI |
| Kamera | OV2640, interfejs 8-bit parallel + I2C/SCCB |
| Klawiatura | Matryca 5×5, sterowana przez ekspander I2C MCP23017 |
| Zasilanie | Bateria LiPo 3.7V, ładowarka MCP73831, boost 12V do OLED, LDO 2.8V/1.3V dla kamery |
| Zgodność | CE self-declaration przygotowana (RED / RoHS II / LVD) — proces certyfikacji w toku, moduł radiowy ESP32-S3-WROOM-1 posiada własny certyfikat RED od Espressif |

Pełna dokumentacja pinout/schematów PCB: [`CLAUDE.md`](CLAUDE.md).

## Firmware (ESP32, C++/Arduino)

Moduły w [`src/`](src/):

| Plik | Funkcja |
|---|---|
| `main.cpp` | punkt wejścia, główna pętla, dispatch menu |
| `camera.h` | inicjalizacja OV2640, przechwytywanie JPEG |
| `solve_screen.h` | klawiatura ekranowa, przechwycenie zdjęcia, zapytanie do AI, render odpowiedzi |
| `calculator.h` | tryb zwykłego kalkulatora (8-cyfrowy, M+/M-/MR/MC) |
| `wifi_settings.h` / `wifi_persist.h` | konfiguracja i zapamiętywanie sieci WiFi |
| `offline_queue.h` | kolejkowanie zapytań gdy brak WiFi |
| `ota_update.h` | aktualizacje OTA z weryfikacją podpisu (ECDSA P-256 + SHA-256) |
| `device_account.h` | parowanie urządzenia i synchronizacja licencji z serwerem |
| `history.h` | ostatnie 5 par pytanie/odpowiedź (NVS) |
| `notes.h` / `tests.h` | notatki i sprawdziany synchronizowane z serwera |
| `battery.h` / `power.h` | pomiar baterii, zarządzanie energią (light-sleep, power-down) |
| `panic.h` | klawisz paniki — natychmiastowy powrót do zwykłego kalkulatora |
| `settings_screen.h` / `about_screen.h` / `info_screen.h` / `screen_test.h` | ustawienia, ekran "o programie", pomoc, test wyświetlacza |

**Build:** PlatformIO, `esp32dev`/`esp32s3` board, framework Arduino. Zależności: U8g2 (SSD1322), Adafruit MCP23017, `esp32-camera`, QRCode.

```bash
pio run -e esp32s3 -t upload
```

## Backend & strona (`website/`)

Next.js (App Router) + Prisma/SQLite + Tailwind:

- **API urządzenia** (`/api/device/*`) — rejestracja, status licencji, `/solve` (tekst lub zdjęcie → Gemini), notatki, sprawdziany, dystrybucja OTA.
- **Panel klienta** (`/panel`) — logowanie (NextAuth), historia rozwiązań, subskrypcja.
- **Panel admina** (`/admin`) — logowanie z 2FA (TOTP), zarządzanie użytkownikami/urządzeniami/licencjami, magazyn, statystyki zużycia Gemini.
- **Sklep** — landing page, koszyk, wybór Paczkomatu InPost, płatności **Stripe** i **Przelewy24** (BLIK), maile transakcyjne przez Resend.

## Narzędzia (`tools/`)

- `flasher/` — narzędzie produkcyjne do flashowania gotowych urządzeń (GUI + CLI).
- `i2c_scan/` — skaner magistrali I2C do bring-up.
- `keymap_scan/` — narzędzie do mapowania matrycy klawiatury.

---

## Licencja

Projekt komercyjny — brak jeszcze pliku LICENSE. Kod udostępniony publicznie w celach edukacyjnych/portfolio; wszelkie prawa zastrzeżone do czasu dodania formalnej licencji.

## Autor

**KAJPA Kacper Popko** — [kalkmate.pl](https://kalkmate.pl)
