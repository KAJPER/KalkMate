# KalkMate — propozycje usprawnień firmware

Lista zebrana z przeglądu kodu (`src/*.h`, `main.cpp`, `ota_update.h`, `camera.h`,
`solve_screen.h`, `device_account.h`). Posortowane wg wartości/ryzyka.

## 🔴 Wysoki priorytet (bezpieczeństwo / niezawodność)

1. **OTA: wymuś weryfikację podpisu w release**
   `otaInstall()` instaluje **bez** weryfikacji, gdy serwer zwróci pusty `sig`
   (ota_update.h ~281). Na urządzeniu PROD_REL (signed-only) to luka — atakujący
   z podmienionym serwerem może wgrać niepodpisany firmware. Fix: w buildzie
   produkcyjnym odrzucaj install bez podpisu (flaga `KALK_REQUIRE_SIGNED_OTA`).

2. **OTA: rollback po nieudanym boocie**
   Brak health-check po aktualizacji. Jeśli nowy firmware się wykłada w boot loop,3w
   nie ma powrotu. ESP32 ma `esp_ota_mark_app_valid_cancel_rollback()` — oznacz
   partycję jako „valid" dopiero po udanym boocie + połączeniu WiFi, inaczej
   automatyczny rollback do poprzedniej wersji.

3. **Upload zdjęcia: multipart binarny zamiast base64 w JSON**
   `solve_screen.h` koduje JPEG do base64 (+33% rozmiaru) i pakuje w JSON.
   UXGA ~200KB → ~270KB base64 w PSRAM + wolniejszy upload. Wysyłka jako
   `multipart/form-data` (binarnie) = mniej PSRAM, ~25% szybszy upload na słabym
   WiFi. (Wymaga drobnej zmiany endpointu `/api/device/solve`.)

## 🟡 Średni priorytet (energia / UX)

4. **Deep sleep w bezczynności**
   Dziś tylko `setPowerSave` na OLED (power.h). ESP32 deep sleep z wybudzaniem na
   klawisz (GPIO/ext1) = ogromna oszczędność baterii LiPo gdy urządzenie leży.

5. **Krzywa baterii LiPo**
   Mapowanie napięcie→% jest nieliniowe. Dodać tablicę kalibracyjną + bezpieczne
   wyłączenie PRZED brownoutem boosta (już są watchdogi VBAT — dołożyć krzywą).

6. **Szybszy reconnect WiFi**
   Cache BSSID + kanału ostatniej sieci w NVS → `WiFi.begin(ssid, pass, channel, bssid)`
   pomija skan (oszczędza 1-3 s i prąd przy każdym połączeniu).

7. **Offline queue dla zadań**
   Gdy brak WiFi przy „rozwiąż" — zakolejkuj zadanie (tekst/zdjęcie w PSRAM/SPIFFS)
   i wyślij po połączeniu, zamiast błędu.

8. **Pokaż aktywny model/tryb AI na urządzeniu**
   Po dodaniu wyboru modelu w panelu — `account-status` może zwracać aktywny
   model + tryb, a kalkulator pokazywać go w Ustawieniach (spójność z panelem).

9. **Auto-capture przy ostrości**
   Live preview (v1.5.0) liczy już metrykę ostrości — dołożyć auto-zdjęcie po N
   stabilnych, ostrych klatkach (mniej nieudanych zdjęć).

## 🟢 Niższy priorytet (jakość / kosmetyka)

10. **OLED 4-bit grayscale**
    SSD1322 ma 16 poziomów szarości, U8g2 używa 1-bit. Tryb grayscale = ładniejszy,
    antyaliasowany UI (wymaga innego sterownika/bufora — większy nakład).

11. **Silniejsza ochrona klucza API**
    Obfuskacja XOR (`key_obfuscate.h`) tylko „podnosi poprzeczkę" — klucz da się
    odzyskać z binarki. Realna ochrona = flash encryption (jest w PROD_REL) +
    klucz w zaszyfrowanym NVS. Rozważyć rotację klucza per-build.

12. **Telemetria diagnostyczna**
    Opcja „wyślij log na serwer" (ring buffer ostatnich zdarzeń) — łatwiejszy
    debug urządzeń w terenie bez podłączania UART.

13. **Klawiatura 5×5 bez diod**
    Możliwy ghosting przy 3+ klawiszach (matryca MCP23017). Udokumentować limit
    2-key rollover lub dodać obsługę wykrywania ghostingu.

14. **FW_VERSION z gita**
    Ręczny bump jest błędogenny (deploy.ps1 już to robi). Można generować z tagu
    gita w `build_flags` (`-DFW_VERSION=...`) zamiast edytować `main.cpp`.

## Uwaga o spójności flasher ↔ deploy ↔ serwer (zweryfikowane)

- Klucz publiczny w firmware (`_OTA_PUBLIC_KEY_PEM`) == klucz publiczny serwera
  (`firmware_signing.pem`) → podpisany OTA dla PROD_REL **działa**.
- Workflow: **`deploy.ps1` najpierw** (build + bump FW_VERSION + podpis + wpis do
  `releases.json`), **potem** flash tego samego buildu flasherem (DEV/PROD_DEV/PROD_REL).
- `tools/flasher` flashuje gotowy `.pio/build/esp32s3/firmware.bin` — nie buduje sam.
