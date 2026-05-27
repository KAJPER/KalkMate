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
#define KALK_API_KEY    "<CALCULATOR_API_KEY-REDACTED>"

// Wersja firmware — INKREMENTUJ przed kazdym buildem ktory chcesz wgrac OTA
#define FW_VERSION "1.2.0"

// ============== KOLEJNOSC INCLUDE'OW JEST WAZNA ==============
// input.h MUSI być przed UI files — definiuje BTN_xx jako wirtualne ID
// (>=200) i funkcję inputBtn(). UI files ze swoimi `#ifndef BTN_xx`
// pominą ponowną definicję.
#include "input.h"

#include "settings_screen.h"   // kalkSettings
#include "wifi_persist.h"      // NVS WiFi + licencja
#include "wifi_settings.h"     // WiFi UI + klawiatura ekranowa
#include "about_screen.h"
#include "info_screen.h"
#include "screen_test.h"
#include "device_account.h"    // Rejestracja kalkulator -> serwer + status konta (przed solve_screen)
#include "solve_screen.h"      // Rozwiazywanie zadan AI
#include "splash_screen.h"     // Ekran powitalny
#include "calculator.h"        // Tryb kalkulatora + unlock code
#include "panic.h"             // Globalny panic button (powrot do kalkulatora)
#include "power.h"             // Auto-sleep OLED — globalny dla wszystkich ekranow
#include "notes.h"             // Offline notatki uzytkownika
#include "tests.h"             // Sprawdziany (dev mode)
#include "battery.h"           // Pomiar baterii LiPo (PCB v4)
#include <qrcode.h>            // QR generator dla device ID (lib ricmoo/QRCode)

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
const int MENU_COUNT = 6;
const int VISIBLE_LINES = 4;

int selectedItem = 0;
int scrollOffset = 0;

// Debounce nawigacji w menu (oddzielny od debounce klawiatury matrycowej)
unsigned long lastPress = 0;
#define DEBOUNCE_MS 200

// Forward declaration
void drawMenu();

// Aktywnosc trzymana w input.h (auto-reset przy kazdym klawiszu).
// Te helpery zostawione jako kompat alias.
inline void resetActivity() { inputActivityReset(); }

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
        const char* label = (kalkSettings.language == 0)
            ? menuItemsPL[itemIndex] : menuItemsEN[itemIndex];
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
    u8g2.drawStr(10, 30, kalkSettings.language == 0 ? "Wybrano:" : "Selected:");
    u8g2.setFont(u8g2_font_6x10_tf);
    const char* label = (kalkSettings.language == 0)
        ? menuItemsPL[selectedItem] : menuItemsEN[selectedItem];
    u8g2.drawStr(10, 50, label);
    u8g2.sendBuffer();
    delay(1500);
}

// =====================================================================
//  Ekran Notatki — lista offline + sync z serwera
// =====================================================================
static void showNotesScreen() {
    inputWaitRelease();

    auto drawList = [&](int cursor, int count) {
        u8g2.clearBuffer();
        u8g2.setFont(u8g2_font_6x10_tf);
        char hdr[40];
        snprintf(hdr, sizeof(hdr),
                 kalkSettings.language == 0 ? "Notatki (%d)" : "Notes (%d)",
                 count);
        u8g2.drawStr(2, 10, hdr);
        u8g2.drawHLine(0, 12, 256);

        if (count == 0) {
            u8g2.drawStr(2, 30,
                kalkSettings.language == 0
                    ? "Brak notatek. Dodaj je"
                    : "No notes. Add them");
            u8g2.drawStr(2, 42,
                kalkSettings.language == 0
                    ? "w panelu klienta i zsynchron."
                    : "in user panel and sync.");
            u8g2.setFont(u8g2_font_5x7_tf);
            u8g2.drawStr(2, 62,
                kalkSettings.language == 0
                    ? "OK = sync   < = wyjscie"
                    : "OK = sync   < = exit");
        } else {
            // Pokaz 4 widoczne tytuly
            int scroll = (cursor < 4) ? 0 : cursor - 3;
            u8g2.setFont(u8g2_font_6x10_tf);
            for (int i = 0; i < 4 && (scroll + i) < count; i++) {
                int idx = scroll + i;
                int y = 25 + i * 10;
                NoteEntry n;
                if (notesGet(idx, n)) {
                    String t = n.title;
                    if (t.length() == 0) t = "(bez tytulu)";
                    if (t.length() > 38) t = t.substring(0, 36) + "..";
                    if (idx == cursor) {
                        u8g2.setDrawColor(1);
                        u8g2.drawBox(0, y - 9, 256, 11);
                        u8g2.setDrawColor(0);
                        u8g2.drawStr(4, y, t.c_str());
                        u8g2.setDrawColor(1);
                    } else {
                        u8g2.drawStr(4, y, t.c_str());
                    }
                }
            }
            u8g2.setFont(u8g2_font_5x7_tf);
            u8g2.drawStr(2, 62,
                kalkSettings.language == 0
                    ? "OK = otworz   v = sync   < = wyjscie"
                    : "OK = open   v = sync   < = exit");
        }
        u8g2.sendBuffer();
    };

    auto drawDetail = [&](const NoteEntry& n) {
        powerSetInhibit(true);   // user czyta — bez sleep
        // Strony scrollowane
        int scrollLine = 0;
        // Rozbij content na linie po 40 znakow
        std::vector<String> lines;
        String content = n.content;
        while (content.length() > 0) {
            int nl = content.indexOf('\n');
            String chunk = nl >= 0 ? content.substring(0, nl) : content;
            content = nl >= 0 ? content.substring(nl + 1) : "";
            // Wrap po ~42 znaki dla czcionki 6x10
            while (chunk.length() > 42) {
                lines.push_back(chunk.substring(0, 42));
                chunk = chunk.substring(42);
            }
            lines.push_back(chunk);
        }

        while (true) {
            powerCheckSleep();
            if (panicTriggered()) { powerSetInhibit(false); return; }
            u8g2.clearBuffer();
            u8g2.setFont(u8g2_font_6x10_tf);
            String t = n.title.length() == 0 ? "(bez tytulu)" : n.title;
            if (t.length() > 40) t = t.substring(0, 38) + "..";
            u8g2.drawStr(2, 10, t.c_str());
            u8g2.drawHLine(0, 12, 256);

            for (int i = 0; i < 4; i++) {
                int idx = scrollLine + i;
                if (idx >= (int)lines.size()) break;
                u8g2.drawStr(2, 24 + i * 11, lines[idx].c_str());
            }

            u8g2.setFont(u8g2_font_5x7_tf);
            char info[24];
            snprintf(info, sizeof(info), "%d/%d", scrollLine + 1, (int)lines.size());
            u8g2.drawStr(220, 62, info);
            u8g2.drawStr(2, 62,
                kalkSettings.language == 0
                    ? "^/v scroll   < = wstecz"
                    : "^/v scroll   < = back");
            u8g2.sendBuffer();

            inputScan();
            if (inputKeyConsume(KEY_PLUS) || inputKeyConsume(KEY_8)) {
                if (scrollLine > 0) scrollLine--;
            }
            if (inputKeyConsume(KEY_MINUS) || inputKeyConsume(KEY_2)) {
                if (scrollLine < (int)lines.size() - 4) scrollLine++;
            }
            if (inputKeyConsume(KEY_PLUSMINUS) || inputKeyConsume(KEY_4) ||
                inputKeyConsume(KEY_CCE)) {
                powerSetInhibit(false);
                inputWaitRelease();
                return;
            }
            delay(20);
        }
    };

    auto syncFromServer = [&]() {
        u8g2.clearBuffer();
        u8g2.setFont(u8g2_font_6x10_tf);
        u8g2.drawStr(2, 24,
            kalkSettings.language == 0
                ? "Synchronizacja..."
                : "Syncing...");
        u8g2.drawStr(2, 38,
            kalkSettings.language == 0
                ? "Lacze z serwerem"
                : "Connecting to server");
        u8g2.sendBuffer();

        // Ensure WiFi connected (uzyj zapisanego SSID/pass)
        if (WiFi.status() != WL_CONNECTED) {
            char ssid[33] = "", pass[64] = "";
            if (wifiLoadSaved(ssid, sizeof(ssid), pass, sizeof(pass))) {
                WiFi.mode(WIFI_STA);
                WiFi.begin(ssid, pass);
                uint32_t t0 = millis();
                while (WiFi.status() != WL_CONNECTED && millis() - t0 < 10000) {
                    delay(100);
                }
            }
        }
        if (WiFi.status() != WL_CONNECTED) {
            u8g2.clearBuffer();
            u8g2.setFont(u8g2_font_6x10_tf);
            u8g2.drawStr(2, 30,
                kalkSettings.language == 0 ? "Brak WiFi" : "No WiFi");
            u8g2.sendBuffer();
            delay(2000);
            return -1;
        }

        // Licencja opcjonalna - nowy model uzywa deviceId. Stara licencja
        // moze byc dalej obecna jako fallback.
        char licKey[40];
        wifiLoadLicense(licKey, sizeof(licKey));
        int n = notesSync(licKey, KALK_API_KEY);
        u8g2.clearBuffer();
        u8g2.setFont(u8g2_font_6x10_tf);
        if (n < 0) {
            u8g2.drawStr(2, 30,
                kalkSettings.language == 0
                    ? "Blad synchronizacji"
                    : "Sync error");
        } else {
            char buf[40];
            snprintf(buf, sizeof(buf),
                kalkSettings.language == 0
                    ? "Pobrano: %d notatek"
                    : "Downloaded: %d notes",
                n);
            u8g2.drawStr(2, 30, buf);
        }
        u8g2.sendBuffer();
        delay(1500);
        return n;
    };

    int cursor = 0;
    int count = (int)notesCount();
    drawList(cursor, count);

    while (true) {
        powerCheckSleep();
        if (panicTriggered()) return;
        if (btnPressed(BTN_UP)) {
            if (cursor > 0) cursor--;
            drawList(cursor, count);
        }
        if (btnPressed(BTN_DOWN)) {
            if (count == 0) {
                // gdy lista pusta i naciskasz DOWN — sync
                syncFromServer();
                count = (int)notesCount();
                cursor = 0;
                drawList(cursor, count);
            } else {
                if (cursor < count - 1) cursor++;
                else {
                    // ostatnia pozycja + DOWN = sync
                    syncFromServer();
                    count = (int)notesCount();
                    if (cursor >= count) cursor = count > 0 ? count - 1 : 0;
                }
                drawList(cursor, count);
            }
        }
        if (btnPressed(BTN_OK)) {
            if (count == 0) {
                syncFromServer();
                count = (int)notesCount();
                cursor = 0;
                drawList(cursor, count);
            } else {
                NoteEntry n;
                if (notesGet(cursor, n)) drawDetail(n);
                drawList(cursor, count);
            }
        }
        if (btnPressed(BTN_LEFT)) {
            return;
        }
        delay(20);
    }
}

// =====================================================================
//  Ekran "Device ID + QR" — w ustawieniach pozycja "Device ID + QR"
//  Pokazuje MAC ESP32 jako device ID + QR code z linkiem do claim'u.
//  Skanowanie -> /claim?d=<MAC>&c=<licencja>
// =====================================================================
static String _mainDeviceMac() {
    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_WIFI_STA);
    char buf[16];
    snprintf(buf, sizeof(buf), "%02X%02X%02X%02X%02X%02X",
             mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    return String(buf);
}

// Pokazuje status sparowania urzadzenia z kontem (Settings -> Status konta).
// Wymaga WiFi. Pyta serwer GET /api/device/account-status.
void showAccountStatusScreen(U8G2 &d) {
    inputWaitRelease();
    powerSetInhibit(true);

    auto exitWait = [&]() {
        inputWaitRelease();
        powerSetInhibit(false);
    };

    // Render: laczenie / rejestracja
    auto drawBusy = [&](const char* msg) {
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 10, "Status konta");
        d.drawHLine(0, 12, 256);
        d.drawStr(2, 32, msg);
        d.sendBuffer();
    };

    drawBusy("Sprawdzam WiFi...");
    if (WiFi.status() != WL_CONNECTED) {
        char ssid[33] = "", pass[64] = "";
        wifiLoadSaved(ssid, sizeof(ssid), pass, sizeof(pass));
        if (ssid[0] == '\0') {
            d.clearBuffer();
            d.setFont(u8g2_font_6x10_tf);
            d.drawStr(2, 10, "Status konta");
            d.drawHLine(0, 12, 256);
            d.drawStr(2, 32, "Brak zapisanego WiFi.");
            d.drawStr(2, 44, "Settings -> Ustaw WiFi");
            d.setFont(u8g2_font_5x7_tf);
            d.drawStr(2, 62, "C/CE = wyjscie");
            d.sendBuffer();
            while (true) {
                if (_panicRequested) { exitWait(); return; }
                if (inputKeyConsume(KEY_CCE) || _setBtn(BTN_LEFT)) { exitWait(); return; }
                delay(20);
            }
        }
        drawBusy("Lacze z WiFi...");
        WiFi.mode(WIFI_STA);
        WiFi.begin(ssid, pass);
        unsigned long t0 = millis();
        while (WiFi.status() != WL_CONNECTED && millis() - t0 < 12000) delay(150);
    }

    if (WiFi.status() != WL_CONNECTED) {
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 10, "Status konta");
        d.drawHLine(0, 12, 256);
        d.drawStr(2, 32, "Brak polaczenia z WiFi.");
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 62, "C/CE = wyjscie");
        d.sendBuffer();
        while (true) {
            if (_panicRequested) { exitWait(); return; }
            if (inputKeyConsume(KEY_CCE) || _setBtn(BTN_LEFT)) { exitWait(); return; }
            delay(20);
        }
    }

    // Zarejestruj device (zaktualizuj unlock code) + pobierz status
    drawBusy("Rejestruje urzadzenie...");
    accountRegister();

    drawBusy("Pobieram status...");
    AccountStatus st;
    bool ok = accountFetchStatus(st);

    // Render
    while (true) {
        if (_panicRequested) { exitWait(); return; }
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 10, "Status konta");
        d.drawHLine(0, 12, 256);

        d.setFont(u8g2_font_5x7_tf);
        char line[80];
        if (!ok) {
            d.drawStr(2, 22, "Blad pobierania:");
            snprintf(line, sizeof(line), "%s", st.error.c_str());
            d.drawStr(2, 32, line);
        } else if (!st.paired) {
            d.drawStr(2, 22, "Status:  NIEPODLACZONE");
            d.drawStr(2, 34, "Sparuj na stronie:");
            d.drawStr(2, 44, "kalkmate.pl/panel -> Kalkulator");
            d.drawStr(2, 54, "Wpisz Device ID + kod odblokowania.");
        } else {
            d.drawStr(2, 22, "Status:  PODLACZONE");
            snprintf(line, sizeof(line), "Konto: %s", st.userEmail.c_str());
            d.drawStr(2, 32, line);
            if (st.hasLicense) {
                if (st.licenseStatus == "active" || st.licenseStatus == "trial") {
                    snprintf(line, sizeof(line), "Licencja: %.16s (%s)",
                             st.licenseCode.c_str(), st.licenseStatus.c_str());
                } else {
                    snprintf(line, sizeof(line), "Licencja: WYGASLA");
                }
                d.drawStr(2, 42, line);
                if (st.daysLeft >= 0) {
                    snprintf(line, sizeof(line), "Dni pozostalo: %d", st.daysLeft);
                    d.drawStr(2, 52, line);
                }
            } else {
                d.drawStr(2, 42, "Brak licencji na koncie");
            }
        }

        d.drawStr(2, 63, "C/CE = wyjscie   OK = odswiez");
        d.sendBuffer();

        if (inputKeyConsume(KEY_CCE) || _setBtn(BTN_LEFT)) { exitWait(); return; }
        if (_setBtn(BTN_OK)) {
            drawBusy("Odswiezam...");
            accountRegister();
            ok = accountFetchStatus(st);
            inputWaitRelease();
        }
        delay(30);
    }
}

void showDeviceIdQrScreen(U8G2 &d) {
    inputWaitRelease();

    String deviceId = _mainDeviceMac();

    // Sprobuj zarejestrowac device na serwerze (zapisac unlockCode).
    // Robi sie raz — jesli WiFi off, ladujemy zapisane creds i probujemy.
    {
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 10, "Device ID + QR");
        d.drawHLine(0, 12, 256);
        d.drawStr(2, 32, "Rejestruje na serwerze...");
        d.sendBuffer();

        if (WiFi.status() != WL_CONNECTED) {
            char ssid[33] = "", pass[64] = "";
            wifiLoadSaved(ssid, sizeof(ssid), pass, sizeof(pass));
            if (ssid[0]) {
                WiFi.mode(WIFI_STA);
                WiFi.begin(ssid, pass);
                unsigned long t0 = millis();
                while (WiFi.status() != WL_CONNECTED && millis() - t0 < 8000) {
                    delay(150);
                    if (panicTriggered()) return;
                }
            }
        }
        if (WiFi.status() == WL_CONNECTED) {
            accountRegister();   // POST /api/device/register z unlockCode
        }
    }

    // URL: kalkmate.pl/claim?d=<MAC>  (po sparowaniu nie trzeba kodu licencji,
    // user na stronie wpisze unlockCode)
    String url = String(KALK_SERVER_URL) + "/claim?d=" + deviceId;

    // Generuj QR code (wersja 4 = 33x33 modules, mieści się 70+ znakow ASCII)
    QRCode qrcode;
    uint8_t qrcodeBytes[qrcode_getBufferSize(4)];
    qrcode_initText(&qrcode, qrcodeBytes, 4, ECC_LOW, url.c_str());

    while (true) {
        if (panicTriggered()) return;
        d.clearBuffer();

        // Lewa strona: device ID + info
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 8, kalkSettings.language == 0 ? "Device ID:" : "Device ID:");
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 20, deviceId.c_str());
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 32, kalkSettings.language == 0
            ? "Skanuj QR -> podlaczenie"
            : "Scan QR -> link to account");
        d.drawStr(2, 42, kalkSettings.language == 0
            ? "do panelu klienta."
            : "in user panel.");
        d.drawStr(2, 60, kalkSettings.language == 0
            ? "OK / < = wyjscie"
            : "OK / < = exit");

        // Prawa strona: QR (po prawej, 64x64 px max)
        // QR wersja 4 = 33 modules, kazdy 1px = 33x33. Mieści się prawo.
        int qrSize = qrcode.size;   // 33
        int scale = 1;              // 1px per module
        int qrPx = qrSize * scale;
        int xOff = 256 - qrPx - 4;
        int yOff = (64 - qrPx) / 2;
        for (uint8_t y = 0; y < qrSize; y++) {
            for (uint8_t x = 0; x < qrSize; x++) {
                if (qrcode_getModule(&qrcode, x, y)) {
                    d.drawPixel(xOff + x * scale, yOff + y * scale);
                }
            }
        }

        d.sendBuffer();

        if (_panicRequested) return;
        inputScan();
        if (inputBtn(BTN_OK) == LOW || inputBtn(BTN_LEFT) == LOW ||
            inputKeyConsume(KEY_CCE)) {
            inputWaitRelease();
            return;
        }
        delay(30);
    }
}

// =====================================================================
//  Ekran "Sprawdzian" (dev mode) — analogiczny do Notatek ale z formatowaniem
// =====================================================================
static void showTestsScreen() {
    inputWaitRelease();
    testsBuildTitleCache();   // raz na wejscie - eliminuje lagi listy

    auto drawList = [&](int cursor, int count) {
        u8g2.clearBuffer();
        u8g2.setFont(u8g2_font_6x10_tf);
        char hdr[40];
        snprintf(hdr, sizeof(hdr),
            kalkSettings.language == 0 ? "Sprawdzian (%d)" : "Tests (%d)", count);
        u8g2.drawStr(2, 10, hdr);
        u8g2.drawHLine(0, 12, 256);

        if (count == 0) {
            u8g2.drawStr(2, 30, kalkSettings.language == 0
                ? "Brak sprawdzianow."
                : "No tests.");
            u8g2.drawStr(2, 42, kalkSettings.language == 0
                ? "Dodaj w panelu klienta i sync."
                : "Add in user panel and sync.");
            u8g2.setFont(u8g2_font_5x7_tf);
            u8g2.drawStr(2, 62, kalkSettings.language == 0
                ? "OK = sync   < = wyjscie" : "OK = sync   < = exit");
        } else {
            int scroll = (cursor < 4) ? 0 : cursor - 3;
            for (int i = 0; i < 4 && (scroll + i) < count; i++) {
                int idx = scroll + i;
                int y = 25 + i * 10;
                // Cache tytulow - bez I/O na kazda ramke
                String title = testsTitleAt(idx);
                if (title.length() == 0) title = "(bez tytulu)";
                if (title.length() > 38) title = title.substring(0, 36) + "..";
                if (idx == cursor) {
                    u8g2.setDrawColor(1);
                    u8g2.drawBox(0, y - 9, 256, 11);
                    u8g2.setDrawColor(0);
                    u8g2.drawStr(4, y, title.c_str());
                    u8g2.setDrawColor(1);
                } else {
                    u8g2.drawStr(4, y, title.c_str());
                }
            }
            u8g2.setFont(u8g2_font_5x7_tf);
            u8g2.drawStr(2, 62, kalkSettings.language == 0
                ? "OK=otworz  v=sync  <=wyjscie"
                : "OK=open  v=sync  <=exit");
        }
        u8g2.sendBuffer();
    };

    auto drawDetail = [&](const TestEntry& t) {
        powerSetInhibit(true);
        // Format LaTeX/markdown -> ASCII
        String formatted = testsFormat(t.content);

        // Linie po ~42 znaki dla fontu 6x10
        std::vector<String> lines;
        String content = formatted;
        while (content.length() > 0) {
            int nl = content.indexOf('\n');
            String chunk = nl >= 0 ? content.substring(0, nl) : content;
            content = nl >= 0 ? content.substring(nl + 1) : "";
            while (chunk.length() > 42) {
                int breakPos = 42;
                int spacePos = chunk.lastIndexOf(' ', 42);
                if (spacePos > 30) breakPos = spacePos;
                lines.push_back(chunk.substring(0, breakPos));
                chunk = chunk.substring(breakPos);
                if (chunk.length() > 0 && chunk[0] == ' ') chunk = chunk.substring(1);
            }
            lines.push_back(chunk);
        }

        int scrollLine = 0;
        while (true) {
            panicCheck();
            if (panicTriggered()) { powerSetInhibit(false); return; }

            u8g2.clearBuffer();
            u8g2.setFont(u8g2_font_6x10_tf);
            String title = t.title.length() == 0 ? String("(bez tytulu)") : t.title;
            if (title.length() > 40) title = title.substring(0, 38) + "..";
            u8g2.drawStr(2, 10, title.c_str());
            u8g2.drawHLine(0, 12, 256);

            for (int i = 0; i < 4; i++) {
                int idx = scrollLine + i;
                if (idx >= (int)lines.size()) break;
                testsDrawLine(u8g2, 2, 24 + i * 11, lines[idx]);
            }

            u8g2.setFont(u8g2_font_5x7_tf);
            char info[24];
            snprintf(info, sizeof(info), "%d/%d", scrollLine + 1, (int)lines.size());
            u8g2.drawStr(220, 62, info);
            u8g2.drawStr(2, 62, kalkSettings.language == 0
                ? "^/v scroll  < wstecz"
                : "^/v scroll  < back");
            u8g2.sendBuffer();

            inputScan();
            if (inputKeyConsume(KEY_PLUS) || inputKeyConsume(KEY_8)) {
                if (scrollLine > 0) scrollLine--;
            }
            if (inputKeyConsume(KEY_MINUS) || inputKeyConsume(KEY_2)) {
                if (scrollLine < (int)lines.size() - 4) scrollLine++;
            }
            if (inputKeyConsume(KEY_PLUSMINUS) || inputKeyConsume(KEY_4) ||
                inputKeyConsume(KEY_CCE)) {
                powerSetInhibit(false);
                inputWaitRelease();
                return;
            }
            delay(20);
        }
    };

    auto syncFromServer = [&]() {
        u8g2.clearBuffer();
        u8g2.setFont(u8g2_font_6x10_tf);
        u8g2.drawStr(2, 30, kalkSettings.language == 0
            ? "Synchronizacja..." : "Syncing...");
        u8g2.sendBuffer();

        if (WiFi.status() != WL_CONNECTED) {
            char ssid[33] = "", pass[64] = "";
            if (wifiLoadSaved(ssid, sizeof(ssid), pass, sizeof(pass))) {
                WiFi.mode(WIFI_STA);
                WiFi.begin(ssid, pass);
                uint32_t t0 = millis();
                while (WiFi.status() != WL_CONNECTED && millis() - t0 < 10000) delay(100);
            }
        }
        if (WiFi.status() != WL_CONNECTED) {
            u8g2.clearBuffer();
            u8g2.setFont(u8g2_font_6x10_tf);
            u8g2.drawStr(2, 30, kalkSettings.language == 0 ? "Brak WiFi" : "No WiFi");
            u8g2.sendBuffer();
            delay(2000);
            return -1;
        }
        // Licencja opcjonalna - nowy model uzywa deviceId.
        char licKey[40];
        wifiLoadLicense(licKey, sizeof(licKey));
        int n = testsSync(licKey, KALK_API_KEY);
        // Plik sie zmienil - przebuduj cache tytulow
        testsBuildTitleCache();
        u8g2.clearBuffer();
        u8g2.setFont(u8g2_font_6x10_tf);
        if (n < 0) {
            u8g2.drawStr(2, 30, kalkSettings.language == 0
                ? "Blad synchronizacji" : "Sync error");
        } else {
            char buf[40];
            snprintf(buf, sizeof(buf),
                kalkSettings.language == 0
                    ? "Pobrano: %d sprawdz."
                    : "Downloaded: %d tests", n);
            u8g2.drawStr(2, 30, buf);
        }
        u8g2.sendBuffer();
        delay(1500);
        return n;
    };

    int cursor = 0;
    int count = (int)testsCount();
    drawList(cursor, count);

    while (true) {
        powerCheckSleep();
        if (panicTriggered()) return;

        if (btnPressed(BTN_UP)) {
            if (cursor > 0) cursor--;
            drawList(cursor, count);
        }
        if (btnPressed(BTN_DOWN)) {
            if (count == 0) {
                syncFromServer();
                count = (int)testsCount();
                cursor = 0;
                drawList(cursor, count);
            } else if (cursor >= count - 1) {
                syncFromServer();
                count = (int)testsCount();
                if (cursor >= count) cursor = count > 0 ? count - 1 : 0;
                drawList(cursor, count);
            } else {
                cursor++;
                drawList(cursor, count);
            }
        }
        if (btnPressed(BTN_OK)) {
            if (count == 0) {
                syncFromServer();
                count = (int)testsCount();
                cursor = 0;
                drawList(cursor, count);
            } else {
                TestEntry t;
                if (testsGet(cursor, t)) drawDetail(t);
                drawList(cursor, count);
            }
        }
        if (btnPressed(BTN_LEFT)) return;
        delay(20);
    }
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

    // NVS — Arduino core robi to lazy przy pierwszym Preferences.begin(),
    // ale bezpieczniej zrobic teraz raz, zeby uniknac pierwszego
    // wywolania w hot pathie.
    nvs_flash_init();

    // Klawiatura matrycowa
    if (!inputBegin()) {
        Serial.println("[FATAL] MCP23017 brak — klawiatura nie dziala");
    }

    // Wczytaj zapisany unlock code i panic key
    {
        char buf[12];
        loadAiCode(buf, sizeof(buf), "1111");
        strncpy(kalkSettings.aiUnlockCode, buf, sizeof(kalkSettings.aiUnlockCode) - 1);
        kalkSettings.aiUnlockCode[sizeof(kalkSettings.aiUnlockCode) - 1] = '\0';
        kalkSettings.panicKey = loadPanicKey(KEY_MU);
    }

    // === FAZA 3: pelen kalkulator (przejmuje renderowanie) ===
    runCalculator(u8g2);

    // === Tryb AI ===
    // WiFi NIE laczy sie automatycznie - na PCB v4 (boost ssie z VBAT)
    // peak pradu WiFi.begin podczas wlaczania ekranu menu daje
    // brownout. WiFi laczy sie dopiero gdy user wejdzie w funkcje
    // wymagajaca sieci (Rozwiaz zadanie / Settings -> WiFi).
    delay(50);  // chwila zeby OLED dokonczyl ostatni refresh po splash AI
    resetActivity();
    drawMenu();
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

    uint32_t sum = 0;
    for (int i = 0; i < 4; i++) sum += analogReadMilliVolts(3);
    uint16_t vbatMv = (uint16_t)((sum / 4) * 2);

    if (vbatMv >= 500 && vbatMv < 3200) {
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

void loop() {
    inputScan();        // skanuj matrycę co iterację (max raz na 30 ms)
    panicCheck();       // sprawdz panic key, ustaw flagę gdy nacisnięty
    handlePanicIfRequested();  // jesli flaga -> kalkulator
    _vbatWatchdogLoop();    // anti-brownout: shutdown przy VBAT<3.2V
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
        const char* label = (kalkSettings.language == 0)
            ? menuItemsPL[selectedItem] : menuItemsEN[selectedItem];
        Serial.printf("BTN OK - wybrano: %s\n", label);
        switch (selectedItem) {
            case 0: showSolveScreen(u8g2);  break;
            case 1: showNotesScreen();      break;
            case 2: showTestsScreen();      break;   // Sprawdzian
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
