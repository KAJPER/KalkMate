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
#include <esp_sleep.h>
#include <esp_log.h>
#include <esp_system.h>
#include <nvs_flash.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// Konfiguracja serwera AI — ustaw przed kompilacja
#define KALK_SERVER_URL "https://kalkmate.pl"
#define KALK_API_KEY    "<CALCULATOR_API_KEY-REDACTED>"

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
    "2. Ustaw WiFi",
    "3. Informacje",
    "4. Test kamery",
    "5. Test ekranu",
    "6. Ustawienia",
    "7. O programie",
};
const char* menuItemsEN[] = {
    "1. Solve problem",
    "2. WiFi setup",
    "3. Information",
    "4. Camera test",
    "5. Screen test",
    "6. Settings",
    "7. About",
};
const int MENU_COUNT    = 7;
const int VISIBLE_LINES = 4;

int selectedItem = 0;
int scrollOffset = 0;

// Debounce nawigacji w menu (oddzielny od debounce klawiatury matrycowej)
unsigned long lastPress = 0;
#define DEBOUNCE_MS 200

// Auto-sleep
unsigned long lastActivityMs = 0;

static const uint32_t SLEEP_TIMES_MS[] = {
    30000, 60000, 120000, 180000, 240000, 300000,
    600000, 900000, 1200000, 1500000, 1800000
};

// Forward declaration
void drawMenu();

void resetActivity() {
    lastActivityMs = millis();
}

void checkAutoSleep() {
    if (!kalkSettings.autoSleep) return;
    uint8_t idx = kalkSettings.sleepMinutes;
    if (idx > 10) idx = 10;
    uint32_t timeout = SLEEP_TIMES_MS[idx];
    if (millis() - lastActivityMs > timeout) {
        u8g2.setPowerSave(1);
        // Light-sleep: budzenie przez aktywność I2C wymaga osobnej obsługi
        // (MCP23017 INT line). Na razie po prostu czekaj na klawisz w pętli.
        while (true) {
            inputScan();
            if (inputBtn(BTN_UP)    == LOW || inputBtn(BTN_DOWN)  == LOW ||
                inputBtn(BTN_LEFT)  == LOW || inputBtn(BTN_RIGHT) == LOW ||
                inputBtn(BTN_OK)    == LOW || inputBtn(BTN_BACK)  == LOW) {
                break;
            }
            delay(50);
        }
        u8g2.setPowerSave(0);
        resetActivity();
        drawMenu();
    }
}

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
    checkAutoSleep();

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
            case 1: showWifiSettings(u8g2); break;
            case 2: showInfo(u8g2);         break;
            case 4: showScreenTest(u8g2);   break;
            case 5: showSettings(u8g2);     break;
            case 6: showAboutScreen(u8g2);  break;
            default: showSelected();        break;
        }
        resetActivity();
        changed = true;
    }

    if (changed) drawMenu();
}
