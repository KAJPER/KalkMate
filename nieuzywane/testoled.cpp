// =====================================================================
//  testoled.cpp — test OLED SSD1322 256x64 + boost MT3608
//
//  Sekwencja:
//   1. MCP23017 init + GPA7 HIGH (boost MT3608 -> 12V)
//   2. U8g2 OLED init (CS=15, DC=2, RST=4, SCK=18, MOSI=23)
//   3. Cykl wzorow testowych co 2s:
//      - Pelny ekran zapalony (sprawdz wszystkie piksele)
//      - Pusty (sprawdz brak duchow)
//      - Border + krzyz + przekatne (geometria/wyrownanie)
//      - 4 strefy gradientu jasnosci
//      - Test tekstu (rozne fonty)
//      - Counter / animacja (sprawdz odswiezanie)
//
//  Wynik na Serial. OLED jest aktywnym wynikiem testu.
// =====================================================================

#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <U8g2lib.h>
#include <Adafruit_MCP23X17.h>

#define I2C_SDA   21
#define I2C_SCL   22
#define MCP_ADDR  0x20
#define MCP_GPA7  7   // Boost MT3608 EN (active HIGH)

#define OLED_CS   15
#define OLED_DC   2
#define OLED_RST  4

static Adafruit_MCP23X17 mcp;

// U8G2 SSD1322 256x64 4-wire SPI
U8G2_SSD1322_NHD_256X64_F_4W_HW_SPI u8g2(
    U8G2_R0, /*cs=*/OLED_CS, /*dc=*/OLED_DC, /*reset=*/OLED_RST
);

// Pojedyncza klatka — wzor "all pixels on"
static void patternAllOn(uint8_t contrast) {
    u8g2.setContrast(contrast);
    u8g2.clearBuffer();
    for (int y = 0; y < 64; y++) {
        u8g2.drawHLine(0, y, 256);
    }
    u8g2.sendBuffer();
}

static void patternAllOff() {
    u8g2.clearBuffer();
    u8g2.sendBuffer();
}

static void patternBorderCross() {
    u8g2.clearBuffer();
    u8g2.drawFrame(0, 0, 256, 64);              // ramka 1px
    u8g2.drawFrame(2, 2, 252, 60);              // wewn. ramka
    u8g2.drawHLine(0, 32, 256);                 // pozioma srodkiem
    u8g2.drawVLine(128, 0, 64);                 // pionowa srodkiem
    u8g2.drawLine(0, 0, 256, 64);               // przekatna
    u8g2.drawLine(0, 64, 256, 0);               // anty-przekatna
    u8g2.drawCircle(128, 32, 28);               // okrag w srodku
    u8g2.sendBuffer();
}

static void patternGradient() {
    u8g2.clearBuffer();
    // 4 strefy o roznej intensywnosci wzoru (im gestszy raster tym jasniejszy)
    for (int x = 0; x < 64; x++) {
        // Strefa 1 (0-63): kazdy 8 px
        if ((x % 8) == 0) u8g2.drawVLine(x, 0, 64);
    }
    for (int x = 64; x < 128; x++) {
        // Strefa 2: kazdy 4 px
        if ((x % 4) == 0) u8g2.drawVLine(x, 0, 64);
    }
    for (int x = 128; x < 192; x++) {
        // Strefa 3: kazdy 2 px
        if ((x % 2) == 0) u8g2.drawVLine(x, 0, 64);
    }
    for (int x = 192; x < 256; x++) {
        // Strefa 4: kazdy 1 px (full)
        u8g2.drawVLine(x, 0, 64);
    }
    u8g2.sendBuffer();
}

static void patternText() {
    u8g2.clearBuffer();
    u8g2.setFont(u8g2_font_6x10_tf);
    u8g2.drawStr(2, 10, "=== KalkMate OLED test ===");
    u8g2.drawHLine(0, 12, 256);
    u8g2.drawStr(2, 24, "256 x 64 px, SSD1322 4W SPI");
    u8g2.drawStr(2, 36, "Font test: ABCDEFGHIJKLMNOP 0123456789");
    u8g2.setFont(u8g2_font_5x7_tf);
    u8g2.drawStr(2, 48, "Maly font 5x7: abcdefghijklmnop !@#$%^&*()");
    u8g2.setFont(u8g2_font_logisoso22_tn);
    u8g2.drawStr(180, 62, "OK");
    u8g2.sendBuffer();
}

static void patternCounter(int n) {
    u8g2.clearBuffer();
    u8g2.setFont(u8g2_font_logisoso42_tn);
    char buf[12];
    snprintf(buf, sizeof(buf), "%d", n);
    int w = u8g2.getStrWidth(buf);
    u8g2.drawStr((256 - w) / 2, 56, buf);
    u8g2.sendBuffer();
}

void setup() {
    Serial.begin(115200);
    delay(300);
    Serial.println("\n========================================");
    Serial.println("=== TEST OLED SSD1322 256x64 ===");
    Serial.println("========================================");

    // 1. I2C + MCP23017 + boost ON
    Wire.begin(I2C_SDA, I2C_SCL);
    Wire.setClock(400000);
    if (mcp.begin_I2C(MCP_ADDR)) {
        Serial.println("[OK] MCP23017 OK");
        mcp.pinMode(MCP_GPA7, OUTPUT);
        mcp.digitalWrite(MCP_GPA7, HIGH);
        Serial.println("[OK] Boost MT3608 -> ON (12V VCC OLED)");
        delay(100);   // boost ustabilizuj
    } else {
        Serial.println("[FATAL] MCP23017 nie odpowiada — boost wylaczony");
        Serial.println("        OLED prawdopodobnie nie zaswieci");
    }

    // 2. OLED init
    Serial.println("[INFO] Init OLED...");
    u8g2.setBusClock(8000000);
    u8g2.begin();
    u8g2.setContrast(255);   // max kontrast
    Serial.println("[OK] OLED zainicjalizowany");

    // Splash
    u8g2.clearBuffer();
    u8g2.setFont(u8g2_font_logisoso22_tn);
    u8g2.drawStr(80, 38, "TEST");
    u8g2.sendBuffer();
    delay(1500);
}

void loop() {
    static int phase = 0;
    static int counter = 0;

    switch (phase) {
        case 0:
            Serial.println("[PHASE 1] All pixels ON (kontrast max)");
            patternAllOn(255);
            break;
        case 1:
            Serial.println("[PHASE 2] All pixels OFF");
            patternAllOff();
            break;
        case 2:
            Serial.println("[PHASE 3] Border + cross + diagonals");
            patternBorderCross();
            break;
        case 3:
            Serial.println("[PHASE 4] Gradient (4 strefy)");
            patternGradient();
            break;
        case 4:
            Serial.println("[PHASE 5] Text rendering");
            patternText();
            break;
        case 5:
        case 6:
        case 7:
        case 8:
            Serial.printf("[PHASE 6] Counter %d (animacja)\n", counter);
            patternCounter(counter++);
            delay(500);
            phase++;
            return;     // szybsza zmiana dla licznika
    }

    phase = (phase + 1) % 9;
    delay(2000);
}
