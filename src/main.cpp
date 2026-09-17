// =====================================================================
//  main.cpp — integracja UI + OLED SSD1322 + klawiatura matrycowa MCP23017
//
//  Łączy:
//   - OLED SSD1322 256x64 4W SPI (HW VSPI: SCK=18, MOSI=23, CS=15, DC=2, RST=4)
//   - Klawiatura matrycowa kalkulatora 27 klawiszy przez MCP23017 (input.h)
//   - Cały istniejący UI (splash/menu/wifi/info/about/settings/solve)
//
//  Mapowanie klawisze fizyczne -> przyciski UI:
//   "+" / "8"    -> BTN_UP
//   "-" / "2"    -> BTN_DOWN
//   "+/-" / "4"  -> BTN_LEFT
//   "▶" / "6"    -> BTN_RIGHT
//   "=" / "5"    -> BTN_OK
//   "C/CE"       -> BTN_BACK (póki co nieużywany w UI, gotowe na przyszłość)
// =====================================================================

#include <Arduino.h>
#include <U8g2lib.h>
#include <SPI.h>
#include <WiFi.h>
#include <vector>
#include <esp_sleep.h>
#include <esp_log.h>
#include <esp_system.h>
#include <nvs_flash.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// Konfiguracja serwera AI — ustaw przed kompilacja
#define KALK_SERVER_URL "https://kalkmate.pl"
// API key NIE jest w plaintexcie binarki - dekoduje sie z XOR runtime.
// Patrz key_obfuscate.h dla mechanizmu.
#include "key_obfuscate.h"
#define KALK_API_KEY    kalkApiKey()

// Wersja firmware — INKREMENTUJ przed kazdym buildem ktory chcesz wgrac OTA
#define FW_VERSION "1.9.6"

// ============== KOLEJNOSC INCLUDE'OW JEST WAZNA ==============
// input.h MUSI być przed UI files — definiuje BTN_xx jako wirtualne ID
// (>=200) i funkcję inputBtn(). UI files ze swoimi `#ifndef BTN_xx`
// pominą ponowną definicję.
#include "input.h"

#include "settings_screen.h"   // kalkSettings

// Trojjezyczny helper (0=Polski, 1=English, 2=Deutsch) — musi byc
// zdefiniowany TUTAJ (zaraz po kalkSettings), bo notes.h/tests.h/
// account_screen.h wlaczane ponizej go uzywaja, a w C++ include widzi
// tylko to co juz zdefiniowane wczesniej w tym samym pliku.
static inline const char* mT(const char* pl, const char* en, const char* de) {
    if (kalkSettings.language == 0) return pl;
    if (kalkSettings.language == 1) return en;
    return de;
}

// Debounce nawigacji w menu (oddzielny od debounce klawiatury matrycowej).
// Przeniesione tu z tego samego powodu co mT() powyzej — showNotesScreen/
// showTestsScreen (teraz w notes.h/tests.h) go uzywaja.
static unsigned long lastPress = 0;
#define DEBOUNCE_MS 200

// Drop-in replacement dla btnPressed z test_ui.cpp — z debouncem na poziomie
// menu. Wirtualne BTN_xx są aktualizowane przez inputScan() w loop().
bool btnPressed(int pin) {
    if (inputBtn(pin) == LOW) {
        if (millis() - lastPress > DEBOUNCE_MS) {
            lastPress = millis();
            return true;
        }
    }
    return false;
}

#include "wifi_persist.h"      // NVS WiFi + licencja
#include "wifi_settings.h"     // WiFi UI + klawiatura ekranowa
#include "about_screen.h"
#include "info_screen.h"
#include "screen_test.h"
#include "device_account.h"    // Rejestracja kalkulator -> serwer + status konta (przed solve_screen)
#include "solve_screen.h"      // Rozwiazywanie zadan AI
#include "remote_session.h"    // Zdalna pomoc: live podglad ekranu + zdalne klawisze
#include "splash_screen.h"     // Ekran powitalny
#include "calculator.h"        // Tryb kalkulatora + unlock code
#include "panic.h"             // Globalny panic button (powrot do kalkulatora)
#include "power.h"             // Auto-sleep OLED — globalny dla wszystkich ekranow
#include "notes.h"             // Offline notatki uzytkownika
#include "tests.h"             // Sprawdziany (dev mode)
#include "battery.h"           // Pomiar baterii LiPo (PCB v4)
#include <qrcode.h>            // QR generator dla device ID (lib ricmoo/QRCode)
#include "account_screen.h"    // Ekrany "Status konta" + "Device ID + QR"

// Implementacja helpera z device_account.h (potrzebuje pelnej def kalkSettings).
const char* _accGetUnlockCode() { return kalkSettings.aiUnlockCode; }

// === OLED — piny PCB v4 (ESP32-S3) ===
//   Legacy (WROVER):  SCK=18, MOSI=23, CS=15, DC=2, RST=4
//   S3 (nowy PCB):    SCK=18, MOSI=11, CS=15, DC=2, RST=4
// U8g2 hardware SPI uzywa domyslnego SPI peripheral. Na ESP32-S3 musimy
// zmusic SPI.begin() do wlasciwych pinow PRZED u8g2.begin() — patrz setup().
#ifdef KALK_HW_LEGACY
  // Stary PCB: MOSI=23
  #define OLED_PIN_MOSI 23
#else
  // Nowy PCB v4: MOSI=11
  #define OLED_PIN_MOSI 11
#endif
#define OLED_PIN_SCK   18
#define OLED_PIN_CS    15
#define OLED_PIN_DC     2
#define OLED_PIN_RST    4

U8G2_SSD1322_NHD_256X64_F_4W_HW_SPI u8g2(
    U8G2_R2, /*cs=*/OLED_PIN_CS, /*dc=*/OLED_PIN_DC, /*reset=*/OLED_PIN_RST
);

// Implementacja forward-deklaracji z input.h (patrz komentarz tam) —
// remote_session.h potrzebuje surowego bufora ekranu, ale u8g2 jest
// zdefiniowany dopiero tutaj.
uint8_t* remoteGetScreenBuffer() { return u8g2.getBufferPtr(); }
void     remoteSendBuffer()      { u8g2.sendBuffer(); }

// === Boost MT3608 EN ===
//   Legacy: MCP23017 GPA7 (przez ekspander)
//   v4:     GPIO47 ESP32-S3 (bezposrednio)
#ifdef KALK_HW_LEGACY
  #define KALK_BOOST_EN_PIN -1   // sterowane przez MCP (input.h)
#else
  #define KALK_BOOST_EN_PIN 47
#endif

// === Menu ===
const char* menuItemsPL[] = {
    "1. Rozwiaz zadanie",
    "2. Notatki",
    "3. Sprawdzian",
    "4. Informacje",
    "5. Ustawienia",
    "6. O programie",
};
const char* menuItemsEN[] = {
    "1. Solve problem",
    "2. Notes",
    "3. Test mode",
    "4. Information",
    "5. Settings",
    "6. About",
};
const char* menuItemsDE[] = {
    "1. Aufgabe loesen",
    "2. Notizen",
    "3. Testmodus",
    "4. Informationen",
    "5. Einstellungen",
    "6. Ueber",
};
const int MENU_COUNT = 6;
const int VISIBLE_LINES = 4;

// mT() zdefiniowane wczesniej w pliku (zaraz po include settings_screen.h) —
// patrz komentarz tam.
static inline const char* mMenuItem(int idx) {
    if (kalkSettings.language == 0) return menuItemsPL[idx];
    if (kalkSettings.language == 1) return menuItemsEN[idx];
    return menuItemsDE[idx];
}

int selectedItem = 0;
int scrollOffset = 0;

// Forward declaration
void drawMenu();

// === Lazy WiFi auto-connect — state (definicje pozniej) ===
static uint32_t _wifiAutoStart = 0;
static bool     _wifiAutoTried = false;
static void _wifiAutoConnectLazy();

// Aktywnosc trzymana w input.h (auto-reset przy kazdym klawiszu).
// Te helpery zostawione jako kompat alias.
inline void resetActivity() { inputActivityReset(); }

void drawMenu() {
    u8g2.clearBuffer();

    u8g2.setFont(u8g2_font_6x10_tf);
    u8g2.drawStr(2, 10, "=== KalkMate ===");
    u8g2.drawHLine(0, 12, 256);

    u8g2.setFont(u8g2_font_6x10_tf);
    for (int i = 0; i < VISIBLE_LINES; i++) {
        int itemIndex = scrollOffset + i;
        if (itemIndex >= MENU_COUNT) break;
        int y = 25 + i * 13;
        const char* label = mMenuItem(itemIndex);
        if (itemIndex == selectedItem) {
            u8g2.setDrawColor(1);
            u8g2.drawBox(0, y - 9, 256, 12);
            u8g2.setDrawColor(0);
            u8g2.drawStr(4, y, label);
            u8g2.setDrawColor(1);
        } else {
            u8g2.drawStr(4, y, label);
        }
    }

    if (MENU_COUNT > VISIBLE_LINES) {
        int barHeight = 52 * VISIBLE_LINES / MENU_COUNT;
        int barY = 13 + 52 * scrollOffset / MENU_COUNT;
        u8g2.drawBox(253, barY, 3, barHeight);
    }

    u8g2.sendBuffer();
}

void showSelected() {
    u8g2.clearBuffer();
    u8g2.setFont(u8g2_font_10x20_tf);
    u8g2.drawStr(10, 30, mT("Wybrano:", "Selected:", "Ausgewaehlt:"));
    u8g2.setFont(u8g2_font_6x10_tf);
    const char* label = mMenuItem(selectedItem);
    u8g2.drawStr(10, 50, label);
    u8g2.sendBuffer();
    delay(1500);
}

void setup() {
    // Wylacz brownout detector
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

    // Serial wcześniej (przed cokolwiek co może crashnac) — żeby zlapac log
    // jeszcze przed init OLED/boost
    Serial.begin(115200);
    delay(150);  // pozwol USB-CDC enumeracji u hosta
    Serial.println("\n=== KalkMate startup ===");
    Serial.printf("[FW] v%s build %s %s\n", FW_VERSION, __DATE__, __TIME__);
    {
        esp_reset_reason_t r = esp_reset_reason();
        const char* rname = "?";
        switch (r) {
            case ESP_RST_POWERON:  rname = "POWERON";  break;
            case ESP_RST_BROWNOUT: rname = "BROWNOUT"; break;
            case ESP_RST_SW:       rname = "SW";       break;
            case ESP_RST_PANIC:    rname = "PANIC";    break;
            case ESP_RST_DEEPSLEEP:rname = "DEEPSLEEP"; break;
            default: break;
        }
        Serial.printf("[BOOT] reset=%s\n", rname);
        Serial.flush();
    }

#if KALK_BOOST_EN_PIN >= 0
    // === EARLY BATTERY CHECK — przed włączeniem boost (12V/~150mA) ===
    // Boost ssie spory pradu i razem z reszta moze przyciagnac LiPo
    // ponizej progu pracy chipu => brownout/POWERON loop.
    // Stąd: czytamy VBAT bez boost, i jezeli za niskie -> pokazujemy
    // splash "NISKA BATERIA" przez 3s i wchodzimy w deep sleep.
    //
    // Threshold:
    //   < 500 mV   -> najprawdopodobniej brak baterii (USB-only), idz dalej
    //   < 3300 mV  -> LiPo zbyt nisko zeby bezpiecznie odpalic boost+WiFi
    //   >= 3300 mV -> OK, normalny boot
    {
        uint32_t adcSum = 0;
        for (int i = 0; i < 8; i++) {
            adcSum += analogReadMilliVolts(3);
        }
        uint16_t vbatMv = (uint16_t)((adcSum / 8) * 2);  // *2 = dzielnik 1:2
        Serial.printf("[EARLY] VBAT = %u mV\n", vbatMv);
        Serial.flush();

        if (vbatMv >= 500 && vbatMv < 3300) {
            Serial.println("[EARLY] LOW BATTERY -> splash + deep sleep");
            Serial.flush();

            // Wlacz boost krotko zeby OLED dzialal
            pinMode(KALK_BOOST_EN_PIN, OUTPUT);
            digitalWrite(KALK_BOOST_EN_PIN, HIGH);
            delay(30);

            // Init OLED minimalnie
            SPI.begin(OLED_PIN_SCK, -1, OLED_PIN_MOSI, OLED_PIN_CS);
            u8g2.setBusClock(8000000);
            u8g2.begin();
            u8g2.setContrast(40);   // zmniejsz jasność -> mniej pradu OLED

            u8g2.clearBuffer();
            u8g2.setFont(u8g2_font_10x20_tf);
            u8g2.drawStr(35, 22, "NISKA BATERIA");
            u8g2.setFont(u8g2_font_6x10_tf);
            char buf[40];
            snprintf(buf, sizeof(buf), "VBAT = %u.%02u V", vbatMv/1000, (vbatMv%1000)/10);
            u8g2.drawStr(80, 40, buf);
            u8g2.drawStr(40, 55, "Podlacz ladowarke USB-C");
            u8g2.sendBuffer();

            delay(3000);

            // OLED off + boost off zeby zaoszczedzic LiPo
            u8g2.sleepOn();
            delay(20);
            digitalWrite(KALK_BOOST_EN_PIN, LOW);
            delay(20);

            // Deep sleep — chip wybudzi się dopiero po resecie (lub podlaczeniu USB
            // jezeli host enumeruje, ale to nie jest configured wakeup)
            Serial.println("[EARLY] deep sleep");
            Serial.flush();
            esp_deep_sleep_start();
        }
        // else: bateria OK albo brak (USB-only) -> idź dalej
    }

    // === Boost EN przez bezposredni GPIO ESP32-S3 ===
    // Wlaczamy NAJPIERW, bo OLED VCC (14.5V) musi byc obecne zanim
    // u8g2.begin() wyslalo komendy. Bez tego ekran nie zareaguje.
    pinMode(KALK_BOOST_EN_PIN, OUTPUT);
    digitalWrite(KALK_BOOST_EN_PIN, HIGH);
    delay(20);  // MT3608 startup ~10ms, zapas
#endif

    // === FAZA 1: tylko to co trzeba zeby pokazac "0" na ekranie ===
    // ESP32-S3: musimy zainicjalizowac SPI z konkretnymi pinami przed u8g2.begin()
    // bo U8G2 _4W_HW_SPI uzywa globalnego SPI bez kontroli pinow.
    SPI.begin(OLED_PIN_SCK, /*MISO=*/-1, OLED_PIN_MOSI, OLED_PIN_CS);

    // OLED najpierw — to jedyne co user widzi w pierwszej chwili.
    u8g2.setBusClock(8000000);
    u8g2.begin();
    // PCB v4: OLED przez MT3608 ssie bezposrednio z VBAT. Kontrast 60 to
    // sprawdzony "sweet spot" — wystarczajaco jasny do czytania, jednoczesnie
    // pobor pradu boost mieści się w peakowym budżecie LiPo razem z WiFi.
    // Wyzej (>=100) widzielismy brownouty przy WiFi.begin nawet na pelnej baterii.
    u8g2.setContrast(60);
    powerSetU8g2(&u8g2);  // power.h dostaje pointer do auto-sleep

    // Pierwsza klatka kalkulatora: "0" wyrownane do prawej.
    u8g2.clearBuffer();
    u8g2.setFont(u8g2_font_logisoso42_tn);
    {
        int w = u8g2.getStrWidth("0");
        u8g2.drawStr(256 - w - 4, 60, "0");
    }
    u8g2.sendBuffer();

    // === FAZA 2: reszta init w tle (user juz widzi "0") ===
    // (Serial.begin + reset reason zrobione na początku setup, przed boost EN)

    esp_log_level_set("nvs", ESP_LOG_NONE);

    // NVS init z obsługa bledu — konieczne po wlaczeniu flash encryption
    // (stare dane w NVS sa "szyfrowane" innym kluczem i wygladaja jak smieci).
    // Bez erase+reinit Preferences.putString() cicho nie zapisuje niczego.
    {
        esp_err_t nvs_ret = nvs_flash_init();
        if (nvs_ret == ESP_ERR_NVS_NO_FREE_PAGES || nvs_ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
            Serial.println("[NVS] korupcja — czyszcze i reinicjalizuje");
            nvs_flash_erase();
            nvs_flash_init();
        }
    }

    // OTA rollback check — wykrywa boot loop po aktualizacji (>= 3 proby = rollback)
    otaBootCheck();

    // Klawiatura matrycowa
    if (!inputBegin()) {
        Serial.println("[FATAL] MCP23017 brak — klawiatura nie dziala");
    }

    // === Prowizjonowanie fabryczne (flasher.py) ===
    // Jednorazowe okno nasluchu na porcie USB tuz po zaflashowaniu, zeby
    // wgrac kod odblokowania AI wybrany przez klienta w zamowieniu — bez
    // recznego wpisywania go na klawiaturze 5x5 na linii produkcyjnej.
    // Protokol (linia tekstowa zakonczona \n):
    //   PC wysyla:  KALKPROV:SETCODE:1234
    //   ESP32 odp:  KALKPROV:OK               (albo KALKPROV:ERR:BADCODE)
    // Gate na fladze "done" w NVS ("kalkprov") — dziala TYLKO przy
    // pierwszym boocie po flashu (swiezy NVS). Dla kazdego kolejnego bootu
    // (czyli realnie caly czas u klienta) ten blok jest pomijany calkowicie,
    // zero opoznienia/zero ryzyka ze przypadkowe dane na UART cos zmienia.
    {
        Preferences provPrefs;
        provPrefs.begin("kalkprov", false);
        if (!provPrefs.getBool("done", false)) {
            Serial.println("[PROV] Pierwszy boot — okno 3s na KALKPROV:SETCODE:XXXX");
            unsigned long provT0 = millis();
            String provLine = "";
            while (millis() - provT0 < 3000) {
                while (Serial.available()) {
                    char c = (char)Serial.read();
                    if (c == '\n') {
                        provLine.trim();
                        if (provLine.startsWith("KALKPROV:SETCODE:")) {
                            String code = provLine.substring(18);
                            code.trim();
                            bool ok = (code.length() == 4);
                            for (int i = 0; ok && i < 4; i++) {
                                if (!isDigit((unsigned char)code[i])) ok = false;
                            }
                            if (ok) {
                                saveAiCode(code.c_str());
                                Serial.println("KALKPROV:OK");
                                Serial.printf("[PROV] Kod AI ustawiony: %s\n", code.c_str());
                            } else {
                                Serial.println("KALKPROV:ERR:BADCODE");
                            }
                        }
                        provLine = "";
                    } else if (c != '\r') {
                        provLine += c;
                    }
                }
                delay(5);
            }
            provPrefs.putBool("done", true);
        }
        provPrefs.end();
    }

    // Wczytaj wszystkie zapisane ustawienia z NVS
    {
        char buf[12];
        loadAiCode(buf, sizeof(buf), "1111");
        strncpy(kalkSettings.aiUnlockCode, buf, sizeof(kalkSettings.aiUnlockCode) - 1);
        kalkSettings.aiUnlockCode[sizeof(kalkSettings.aiUnlockCode) - 1] = '\0';
        kalkSettings.panicKey = loadPanicKey(KEY_MU);
        // Brightness / language / solveMode / autoSleep / sleepMinutes
        kalkLoadSettings();
        // Aplikuj wczytaną jasność do OLED.
        // Na PCB v4 (boost ssie z VBAT) cap przy ~100 - powyzej widzimy
        // brownout pod WiFi peakiem. Skalowanie: 0-15 -> 0-100 (zamiast 0-255).
        uint16_t c = (uint16_t)kalkSettings.brightness * 7;  // max 15*7=105
        if (c < 25) c = 25;   // minimum zeby ekran byl widoczny
        u8g2.setContrast((uint8_t)c);
        kalkApplyRotation(u8g2);   // obrot ekranu 180 (Ustawienia -> Obrot)
        Serial.printf("[CFG] bright=%u lang=%u solveMode=%u sleep=%d/%u\n",
                      kalkSettings.brightness, kalkSettings.language,
                      kalkSettings.solveMode, (int)kalkSettings.autoSleep,
                      kalkSettings.sleepMinutes);
    }

    // === FAZA 3: pelen kalkulator (przejmuje renderowanie) ===
    // Ratunkowy reset fabryczny — przytrzymaj C/CE 5s w trybie kalkulatora
    // (nie trzeba lapac momentu wlaczania) — patrz _calcFactoryResetFlow
    // w calculator.h.
    runCalculator(u8g2);

    // === Tryb AI ===
    // Auto-WiFi: laczy sie do zapisanej sieci z 3-sekundowym opoznieniem
    // PO drawMenu (delay daje OLED + boost czas na ustabilizowanie,
    // co eliminuje brownout). Sama proba laczenia w _wifiAutoConnectLazy
    // robi WiFi.setTxPower(8.5dBm) zeby zmniejszyc peak pradu radia.
    delay(50);  // chwila zeby OLED dokonczyl ostatni refresh po splash AI
    resetActivity();
    drawMenu();
    _wifiAutoStart = millis();  // odpalamy lazy auto-connect w loop()
}

// === Lazy WiFi auto-connect ===
// Probuje raz polaczyc sie do zapisanej sieci po wejsciu w AI menu.
// Throttle 3s zeby OLED/boost ustabilizowal sie po dlugim splash + menu draw.
// Zmienne stanu zadeklarowane wczesniej (forward).
static void _wifiAutoConnectLazy() {
    if (_wifiAutoTried || _wifiAutoStart == 0) return;
    if (millis() - _wifiAutoStart < 3000) return;
    _wifiAutoTried = true;

    char ssid[33] = "", pass[64] = "";
    if (!wifiLoadSaved(ssid, sizeof(ssid), pass, sizeof(pass))) {
        Serial.println("[WiFi-auto] brak zapisanych credentials, pomijam");
        return;
    }
    Serial.println("[WiFi-auto] lacze z zapisanymi danymi");
    Serial.flush();
    WiFi.mode(WIFI_STA);
    WiFi.setTxPower(WIFI_POWER_8_5dBm);  // anty-brownout
    delay(50);
    wifiFastBegin(ssid, pass);  // uzywa cache BSSID+kanal jesli dostepny
    // Nie blokujemy - async connect w tle. _solEnsureWifi w solve_screen
    // sprawdzi status przed POST.
}

// Definicja globalnej flagi panic (extern w panic.h)
volatile bool _panicRequested = false;

// Obsluz panic — wywolywane w loop() po wyjsciu z UI screen.
// Jesli flaga ustawiona (przez panicCheck() ktore woluje sie automatycznie
// w powerCheckSleep i przez sprawdzanie w petlach UI), uruchom kalkulator.
static void handlePanicIfRequested() {
    if (_panicRequested) {
        Serial.printf("PANIC! -> tryb kalkulatora\n");
        _panicRequested = false;
        runCalculator(u8g2);
        resetActivity();
        drawMenu();
    }
}

// v1.1.5: VBAT watchdog w loop — co 2s sprawdza czy LiPo nie ssie sie
// pod boost. Jezeli pada ponizej 3.2V to grafully wylacza boost +
// pokazuje komunikat + deep sleep, zeby nie uszkodzic OLED przez
// niestabilne 12V (i nie spalic VDD ESP).
static uint32_t _vbatWatchdogLast = 0;
static void _vbatWatchdogLoop() {
#ifndef KALK_HW_LEGACY
    if (millis() - _vbatWatchdogLast < 2000) return;
    _vbatWatchdogLast = millis();

    // Kalibrowana ADC z battery.h (16 sampli, cache 5s) zamiast surowego odczytu.
    uint16_t vbatMv = batteryReadMillivolts();

    if (vbatMv >= 500 && vbatMv < BATTERY_SHUTDOWN_MV) {
        Serial.printf("[VBAT-WD] VBAT=%u mV - CRITICAL, shutdown\n", vbatMv);
        Serial.flush();

        u8g2.clearBuffer();
        u8g2.setFont(u8g2_font_10x20_tf);
        u8g2.drawStr(35, 22, "NISKA BATERIA");
        u8g2.setFont(u8g2_font_6x10_tf);
        char buf[40];
        snprintf(buf, sizeof(buf), "VBAT = %u.%02u V", vbatMv/1000, (vbatMv%1000)/10);
        u8g2.drawStr(80, 40, buf);
        u8g2.drawStr(40, 55, "Podlacz ladowarke USB-C");
        u8g2.sendBuffer();
        delay(3000);

        u8g2.sleepOn();
        delay(20);
#if KALK_BOOST_EN_PIN >= 0
        digitalWrite(KALK_BOOST_EN_PIN, LOW);
#endif
        delay(20);
        esp_deep_sleep_start();
    }
#endif
}

// OTA walidacja: oznacz firmware jako valid gdy WiFi sie polaczy po raz pierwszy.
// Jezeli to nie nastapi przed 3 rebootami, otaBootCheck() zrobi rollback.
static bool _otaValidated = false;
static void _otaValidateLoop() {
    if (_otaValidated) return;
    if (WiFi.status() == WL_CONNECTED) {
        otaMarkValid();
        _otaValidated = true;
    }
}

// Synchronizacja czasu (NTP) po pierwszym polaczeniu WiFi. ESP32 nie ma RTC
// z bateria, wiec zegar startuje od ~1970 kazdego boota. WiFiClientSecure::
// setCACert() robi pelna walidacje X.509 WLACZNIE z data waznosci certyfikatu
// wzgledem zegara urzadzenia — bez tej synchronizacji KAZDE polaczenie HTTPS
// (OTA check, status konta, wysylka zadan AI) failuje handshake TLS (blad -1),
// bo certyfikat serwera wyglada jakby byl "z przyszlosci" wzgledem roku 1970.
static bool _timeSynced = false;
static void _timeSyncLoop() {
    if (_timeSynced) return;
    if (WiFi.status() != WL_CONNECTED) return;
    configTime(0, 0, "pool.ntp.org", "time.google.com");
    _timeSynced = true;
    Serial.println("[TIME] NTP sync odpalony po polaczeniu WiFi");
}

void loop() {
    inputScan();        // skanuj matrycę co iterację (max raz na 30 ms)
    panicCheck();       // sprawdz panic key, ustaw flagę gdy nacisnięty
    handlePanicIfRequested();  // jesli flaga -> kalkulator
    _vbatWatchdogLoop();    // anti-brownout: shutdown przy VBAT<3.2V
    _wifiAutoConnectLazy(); // auto-WiFi 3s po wejsciu w AI menu
    _otaValidateLoop();     // OTA health-check: waliduj po polaczeniu WiFi
    _timeSyncLoop();        // NTP: zegar musi byc ustawiony zanim HTTPS (TLS daty certyfikatu)
    if (powerCheckSleep()) {
        // Po wybudzeniu — przerysuj menu
        drawMenu();
    }

    bool changed = false;

    if (btnPressed(BTN_UP)) {
        resetActivity();
        if (selectedItem > 0) {
            selectedItem--;
            if (selectedItem < scrollOffset) scrollOffset--;
        }
        changed = true;
        Serial.println("BTN UP");
    }

    if (btnPressed(BTN_DOWN)) {
        resetActivity();
        if (selectedItem < MENU_COUNT - 1) {
            selectedItem++;
            if (selectedItem >= scrollOffset + VISIBLE_LINES) scrollOffset++;
        }
        changed = true;
        Serial.println("BTN DOWN");
    }

    if (btnPressed(BTN_LEFT))  Serial.println("BTN LEFT");
    if (btnPressed(BTN_RIGHT)) Serial.println("BTN RIGHT");

    if (btnPressed(BTN_OK)) {
        resetActivity();
        const char* label = mMenuItem(selectedItem);
        Serial.printf("BTN OK - wybrano: %s\n", label);
        switch (selectedItem) {
            case 0: showSolveScreen(u8g2);  break;
            case 1: showNotesScreen(u8g2);  break;
            case 2: showTestsScreen(u8g2);  break;   // Sprawdzian
            case 3: showInfo(u8g2);         break;
            case 4: showSettings(u8g2);     break;   // WiFi/Test/Camera teraz tutaj
            case 5: showAboutScreen(u8g2);  break;
            default: showSelected();        break;
        }
        // Jesli panic byl wywolany w trakcie ekranu, przejdz do kalkulatora
        handlePanicIfRequested();
        resetActivity();
        changed = true;
    }

    if (changed) drawMenu();
}

