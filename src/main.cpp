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
#define FW_VERSION "0.3.3"

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
#include "solve_screen.h"      // Rozwiazywanie zadan AI
#include "splash_screen.h"     // Ekran powitalny
#include "calculator.h"        // Tryb kalkulatora + unlock code
#include "power.h"             // Auto-sleep OLED — globalny dla wszystkich ekranow
#include "notes.h"             // Offline notatki uzytkownika

// === OLED — finalne piny PCB v3 ===
//   SCK  = GPIO18 (VSPI)
//   MOSI = GPIO23 (VSPI)
//   CS   = GPIO15
//   DC   = GPIO2
//   RST  = GPIO4
U8G2_SSD1322_NHD_256X64_F_4W_HW_SPI u8g2(
    U8G2_R2, /*cs=*/15, /*dc=*/2, /*reset=*/4
);

// === Menu ===
const char* menuItemsPL[] = {
    "1. Rozwiaz zadanie",
    "2. Notatki",
    "3. Ustaw WiFi",
    "4. Informacje",
    "5. Test kamery",
    "6. Test ekranu",
    "7. Ustawienia",
    "8. O programie",
};
const char* menuItemsEN[] = {
    "1. Solve problem",
    "2. Notes",
    "3. WiFi setup",
    "4. Information",
    "5. Camera test",
    "6. Screen test",
    "7. Settings",
    "8. About",
};
const int MENU_COUNT    = 8;
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

        char licKey[40];
        wifiLoadLicense(licKey, sizeof(licKey));
        if (!licKey[0]) {
            u8g2.clearBuffer();
            u8g2.setFont(u8g2_font_6x10_tf);
            u8g2.drawStr(2, 30,
                kalkSettings.language == 0
                    ? "Brak licencji"
                    : "No license");
            u8g2.sendBuffer();
            delay(2000);
            return -1;
        }

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

void setup() {
    // Wylacz brownout detector — zapobiega resetowaniu chipu gdy bateria
    // chwilowo spada (np. peak pradu przy WiFi.begin). Trade-off: jesli
    // napiecie naprawde spadnie zbyt nisko, chip moze sie zawiesic w
    // nieokreslonym stanie. Praktyka pokazuje ze w projektach na LiPo z
    // ladowarka MCP73831 to bezpieczne — bateria nie spadnie nizej 3.0V
    // dzieki zabezpieczeniu DW01A, a 3.0V przez AP2112K-3.3 dalej daje
    // 3.3V na wyjsciu LDO.
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

    // === FAZA 1: tylko to co trzeba zeby pokazac "0" na ekranie ===
    // OLED najpierw — to jedyne co user widzi w pierwszej chwili.
    u8g2.setBusClock(8000000);
    u8g2.begin();
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
    Serial.begin(115200);
    Serial.println("\n=== KalkMate startup ===");

    // Reset reason (diagnostyka — gdyby cos sie znowu resetowalo)
    {
        esp_reset_reason_t r = esp_reset_reason();
        const char* rname = "?";
        switch (r) {
            case ESP_RST_POWERON:  rname = "POWERON";  break;
            case ESP_RST_BROWNOUT: rname = "BROWNOUT"; break;
            case ESP_RST_SW:       rname = "SW";       break;
            case ESP_RST_PANIC:    rname = "PANIC";    break;
            default: break;
        }
        Serial.printf("[BOOT] reset=%s\n", rname);
    }

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
        loadAiCode(buf, sizeof(buf), "1234");
        strncpy(kalkSettings.aiUnlockCode, buf, sizeof(kalkSettings.aiUnlockCode) - 1);
        kalkSettings.aiUnlockCode[sizeof(kalkSettings.aiUnlockCode) - 1] = '\0';
        kalkSettings.panicKey = loadPanicKey(KEY_MU);
    }

    // === FAZA 3: pelen kalkulator (przejmuje renderowanie) ===
    runCalculator(u8g2);

    // === Tryb AI === (bez splash, od razu menu)

    // Auto-reconnect WiFi w tle — z obnizeniem mocy nadawczej zeby
    // zmniejszyc peak pradu (z ~280 mA na ~150 mA). Domyslna moc 19.5dBm
    // potrafi powodowac brownout na slabym zasilaniu (bateria + cienkie
    // sciezki). 11 dBm dalej daje przyzwoity zasieg.
    {
        char ssid[33] = "";
        char pass[64] = "";
        if (wifiLoadSaved(ssid, sizeof(ssid), pass, sizeof(pass))) {
            Serial.printf("Auto-WiFi: lacze z %s\n", ssid);
            WiFi.mode(WIFI_STA);
            WiFi.setTxPower(WIFI_POWER_11dBm);
            delay(50);  // pozwol zasilaniu ustabilizowac sie
            WiFi.begin(ssid, pass);
        }
    }

    resetActivity();
    drawMenu();
}

// Sprawdz czy panic key zostal wcisniety -> wroc do kalkulatora
static void checkPanicKey() {
    KalkKey pk = (KalkKey)kalkSettings.panicKey;
    if (pk == KEY_NONE || pk >= KEY_COUNT) return;
    if (inputKeyConsume(pk)) {
        Serial.printf("PANIC! key=%s -> tryb kalkulatora\n", kalkKeyLabel(pk));
        runCalculator(u8g2);
        // Po wyjsciu z kalkulatora od razu menu (bez splash)
        resetActivity();
        drawMenu();
    }
}

void loop() {
    inputScan();        // skanuj matrycę co iterację (max raz na 30 ms)
    checkPanicKey();    // panic -> kalkulator
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
            case 2: showWifiSettings(u8g2); break;
            case 3: showInfo(u8g2);         break;
            case 5: showScreenTest(u8g2);   break;
            case 6: showSettings(u8g2);     break;
            case 7: showAboutScreen(u8g2);  break;
            default: showSelected();        break;   // 4 = test kamery (TODO)
        }
        resetActivity();
        changed = true;
    }

    if (changed) drawMenu();
}
