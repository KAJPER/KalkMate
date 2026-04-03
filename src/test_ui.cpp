#include <Arduino.h>
#include <U8g2lib.h>
#include <SPI.h>
#include "settings_screen.h"
#include "wifi_settings.h"
#include "about_screen.h"

// OLED
U8G2_SSD1322_NHD_256X64_F_4W_HW_SPI u8g2(U8G2_R0, /*cs=*/5, /*dc=*/17, /*reset=*/16);

// Przyciski
#define BTN_DOWN   12
#define BTN_LEFT   13
#define BTN_RIGHT  14
#define BTN_UP     26
#define BTN_OK     27

// Menu
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
const int MENU_COUNT = 7;
const int VISIBLE_LINES = 4;  // ile pozycji widac na raz

int selectedItem = 0;  // aktualnie zaznaczona pozycja
int scrollOffset = 0;  // od ktorej pozycji zaczynamy wyswietlac

// Debounce
unsigned long lastPress = 0;
#define DEBOUNCE_MS 200

bool btnPressed(int pin) {
    if (digitalRead(pin) == LOW) {
        if (millis() - lastPress > DEBOUNCE_MS) {
            lastPress = millis();
            return true;
        }
    }
    return false;
}

void drawMenu() {
    u8g2.clearBuffer();

    // Naglowek
    u8g2.setFont(u8g2_font_6x10_tf);
    u8g2.drawStr(2, 10, "=== KalkMate ===");
    u8g2.drawHLine(0, 12, 256);

    // Pozycje menu
    u8g2.setFont(u8g2_font_6x10_tf);
    for (int i = 0; i < VISIBLE_LINES; i++) {
        int itemIndex = scrollOffset + i;
        if (itemIndex >= MENU_COUNT) break;

        int y = 25 + i * 13;

        const char* label = (kalkSettings.language == 0) ? menuItemsPL[itemIndex] : menuItemsEN[itemIndex];
        if (itemIndex == selectedItem) {
            // Zaznaczona pozycja — invertowane tlo
            u8g2.setDrawColor(1);
            u8g2.drawBox(0, y - 9, 256, 12);
            u8g2.setDrawColor(0);
            u8g2.drawStr(4, y, label);
            u8g2.setDrawColor(1);
        } else {
            u8g2.drawStr(4, y, label);
        }
    }

    // Scrollbar
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
    u8g2.drawStr(10, 30, "Wybrano:");
    u8g2.setFont(u8g2_font_6x10_tf);
    u8g2.drawStr(10, 50, menuItems[selectedItem]);
    u8g2.sendBuffer();
    delay(1500);
}

void showButtonTest() {
    u8g2.clearBuffer();
    u8g2.setFont(u8g2_font_10x20_tf);
    u8g2.drawStr(50, 20, "TEST BTN");
    u8g2.setFont(u8g2_font_6x10_tf);

    // Strzalki
    u8g2.drawStr(110, 45, digitalRead(BTN_UP)    == LOW ? "[^]" : " ^ ");
    u8g2.drawStr(80,  55, digitalRead(BTN_LEFT)  == LOW ? "[<]" : " < ");
    u8g2.drawStr(140, 55, digitalRead(BTN_RIGHT) == LOW ? "[>]" : " > ");
    u8g2.drawStr(110, 65, digitalRead(BTN_DOWN)  == LOW ? "[v]" : " v ");
    u8g2.drawStr(200, 55, digitalRead(BTN_OK)    == LOW ? "[OK]" : " OK ");

    u8g2.sendBuffer();
}

void setup() {
    Serial.begin(115200);

    // Przyciski z wewnetrznym pullupem
    pinMode(BTN_UP,    INPUT_PULLUP);
    pinMode(BTN_DOWN,  INPUT_PULLUP);
    pinMode(BTN_LEFT,  INPUT_PULLUP);
    pinMode(BTN_RIGHT, INPUT_PULLUP);
    pinMode(BTN_OK,    INPUT_PULLUP);

    u8g2.begin();
    Serial.println("UI start");

    drawMenu();
}

bool inButtonTest = false;

void loop() {
    // Tryb testu przyciskow - lewo+prawo jednoczesnie
    if (digitalRead(BTN_LEFT) == LOW && digitalRead(BTN_RIGHT) == LOW) {
        inButtonTest = !inButtonTest;
        delay(500);
    }

    if (inButtonTest) {
        showButtonTest();
        delay(50);
        return;
    }

    bool changed = false;

    if (btnPressed(BTN_UP)) {
        if (selectedItem > 0) {
            selectedItem--;
            if (selectedItem < scrollOffset) scrollOffset--;
        }
        changed = true;
        Serial.println("BTN UP");
    }

    if (btnPressed(BTN_DOWN)) {
        if (selectedItem < MENU_COUNT - 1) {
            selectedItem++;
            if (selectedItem >= scrollOffset + VISIBLE_LINES) scrollOffset++;
        }
        changed = true;
        Serial.println("BTN DOWN");
    }

    if (btnPressed(BTN_LEFT)) {
        Serial.println("BTN LEFT");
    }

    if (btnPressed(BTN_RIGHT)) {
        Serial.println("BTN RIGHT");
    }

    if (btnPressed(BTN_OK)) {
        Serial.printf("BTN OK - wybrano: %s\n", menuItems[selectedItem]);
        switch (selectedItem) {
            case 1: showWifiSettings(u8g2);  break;  // Ustaw WiFi
            case 5: showSettings(u8g2);      break;  // Ustawienia
            case 6: showAboutScreen(u8g2);   break;  // O programie
            default: showSelected();         break;
        }
        changed = true;
    }

    if (changed) drawMenu();
}
