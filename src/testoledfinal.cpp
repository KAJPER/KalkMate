// =====================================================================
//  testoledfinal.cpp — bare-metal test SSD1322 256x64 (4-wire SPI)
//  Inicjalizacja 1:1 wg datasheet producenta panela.
//  Bez U8g2 — czysty SPI, zeby zweryfikowac sprzet.
//
//  Pinout (zgodnie z FFC ekranu):
//   Pin 12 ekranu  D1 (MOSI/SDIN)  -> ESP32 GPIO23  (VSPI MOSI)
//   Pin 13 ekranu  D0 (SCLK)       -> ESP32 GPIO18  (VSPI SCK)
//   Pin 18 ekranu  DC#             -> ESP32 GPIO2
//   Pin 19 ekranu  CS#             -> ESP32 GPIO15
//   Pin 20 ekranu  RES#            -> ESP32 GPIO4
//
//  12V dla VCC ekranu — przez Boost MT3608, EN = MCP23017 GPA7.
// =====================================================================

#include <Arduino.h>
#include <SPI.h>
#include <Wire.h>
#include <Adafruit_MCP23X17.h>

// === OLED SSD1322 (HW VSPI) ===
#define OLED_CLK   18
#define OLED_MOSI  23
#define OLED_CS    15
#define OLED_DC     2
#define OLED_RST    4

// === I2C / MCP23017 ===
#define I2C_SDA    21
#define I2C_SCL    22
#define MCP_ADDR   0x20
#define MCP_GPA7   7   // Boost MT3608 EN

// SSD1322: column address offset = 28 (SEG28 to start), 256 px szerokosci
//   1 column address = 4 pixele = 2 bajty (4-bit grayscale)
//   64 col addr * 2 B = 128 B/row,  64 rows -> 8192 B framebuffer
#define COL_OFFSET   28
#define COL_START    0
#define COL_END      63
#define ROW_START    0
#define ROW_END      63

static Adafruit_MCP23X17 mcp;
static SPIClass oledSPI(VSPI);

static inline void csLow()  { digitalWrite(OLED_CS, LOW);  }
static inline void csHigh() { digitalWrite(OLED_CS, HIGH); }
static inline void dcCmd()  { digitalWrite(OLED_DC, LOW);  }
static inline void dcData() { digitalWrite(OLED_DC, HIGH); }

static void cmd(uint8_t c) {
    dcCmd();
    csLow();
    oledSPI.transfer(c);
    csHigh();
}

static void dat(uint8_t d) {
    dcData();
    csLow();
    oledSPI.transfer(d);
    csHigh();
}

// Strumieniowe pisanie pixel-data (CS trzymane LOW, szybciej)
static void streamBegin() { dcData(); csLow(); }
static void streamEnd()   { csHigh(); }

static void initSSD1322() {
    // Hardware reset — RES# LOW MUSI byc >= 100us, dajemy 100ms
    digitalWrite(OLED_RST, LOW);
    delay(100);
    digitalWrite(OLED_RST, HIGH);
    delay(100);

    cmd(0xFD); dat(0x12);              // Command Lock — odblokuj MCU interfejs
    cmd(0xAE);                         // Display OFF (sleep)
    cmd(0xB3); dat(0x91);              // Clock divide / Fosc -> ~135 FPS
    cmd(0xCA); dat(0x3F);              // Multiplex ratio = 64-1
    cmd(0xA2); dat(0x00);              // Display offset = 0
    cmd(0xA1); dat(0x00);              // Start line = 0
    cmd(0xA0); dat(0x14); dat(0x11);   // Re-Map & Dual COM Line Mode
    cmd(0xB5); dat(0x00);              // GPIO disable
    cmd(0xAB); dat(0x01);              // Function Select — VDD regulator wlaczony
    cmd(0xB4); dat(0xA0); dat(0xFD);   // Display Enhancement A — VSL external
    cmd(0xC1); dat(0xFF);              // Contrast current = max
    cmd(0xC7); dat(0x0F);              // Master Contrast = max
    // Gray scale table
    cmd(0xB8);
    dat(0x00); dat(0x00); dat(0x00); dat(0x03);
    dat(0x06); dat(0x10); dat(0x1D); dat(0x2A);
    dat(0x37); dat(0x46); dat(0x58); dat(0x6A);
    dat(0x7F); dat(0x96); dat(0xB4);
    cmd(0xB1); dat(0xE8);              // Phase length
    cmd(0xD1); dat(0x82); dat(0x20);   // Display Enhancement B
    cmd(0xBB); dat(0x1F);              // Pre-charge voltage
    cmd(0xB6); dat(0x08);              // Second pre-charge period
    cmd(0xBE); dat(0x07);              // VCOMH
    cmd(0xA9);                         // Exit partial display
    cmd(0xA6);                         // Normal display mode
    delay(1);
    cmd(0xAF);                         // Display ON
    delay(200);
}

static void setWindow(uint8_t startCol, uint8_t stopCol, uint8_t startRow, uint8_t stopRow) {
    cmd(0x15);
    dat(COL_OFFSET + startCol);
    dat(COL_OFFSET + stopCol);
    cmd(0x75);
    dat(startRow);
    dat(stopRow);
    cmd(0x5C);   // Write RAM
}

// Wypelnij caly ekran jednolitym 4-bit szarym tonem (0x00..0x0F)
static void fillScreen(uint8_t shade4bit) {
    setWindow(COL_START, COL_END, ROW_START, ROW_END);
    uint8_t b = (shade4bit & 0x0F) | ((shade4bit & 0x0F) << 4);
    streamBegin();
    for (uint32_t i = 0; i < 8192; i++) {
        oledSPI.transfer(b);
    }
    streamEnd();
}

// Test pattern: 4 poziome pasy o roznej jasnosci + ramka
static void drawTestPattern() {
    setWindow(COL_START, COL_END, ROW_START, ROW_END);
    streamBegin();
    for (int row = 0; row < 64; row++) {
        uint8_t shade;
        if      (row < 16) shade = 0x00;   // czarny
        else if (row < 32) shade = 0x05;   // ciemnoszary
        else if (row < 48) shade = 0x0A;   // jasnoszary
        else               shade = 0x0F;   // bialy
        uint8_t b = shade | (shade << 4);
        for (int i = 0; i < 128; i++) {
            oledSPI.transfer(b);
        }
    }
    streamEnd();
}

// Animowana "snujaca" kolumna — sprawdza adresowanie kolumn
static void drawSweepingColumn(int colAddr) {
    // Wyczysc poprzednia
    setWindow(0, 63, 0, 63);
    streamBegin();
    for (uint32_t i = 0; i < 8192; i++) oledSPI.transfer(0x00);
    streamEnd();

    // Narysuj 1 col addr (4 pikseli szerokosci) na bialo, na pelnej wysokosci
    setWindow(colAddr, colAddr, 0, 63);
    streamBegin();
    for (int row = 0; row < 64; row++) {
        oledSPI.transfer(0xFF);
        oledSPI.transfer(0xFF);
    }
    streamEnd();
}

void setup() {
    Serial.begin(115200);
    delay(300);
    Serial.println("\n=== TEST OLED FINAL (SSD1322 bare-metal) ===");

    // 1) MCP23017 + Boost ON -> 12V dla VCC ekranu
    Wire.begin(I2C_SDA, I2C_SCL);
    if (!mcp.begin_I2C(MCP_ADDR)) {
        Serial.println("[WARN] MCP23017 nie odpowiada (0x20). Boost MUSI byc wlaczony recznie!");
    } else {
        Serial.println("[OK] MCP23017 znaleziony");
        mcp.pinMode(MCP_GPA7, OUTPUT);
        mcp.digitalWrite(MCP_GPA7, HIGH);
        Serial.println("[OK] Boost MT3608 -> ON (12V VCC)");
    }
    delay(100);  // czekaj az 12V sie ustabilizuje

    // 2) Pinmody dla OLED control
    pinMode(OLED_CS,  OUTPUT);
    pinMode(OLED_DC,  OUTPUT);
    pinMode(OLED_RST, OUTPUT);
    digitalWrite(OLED_CS,  HIGH);
    digitalWrite(OLED_DC,  HIGH);
    digitalWrite(OLED_RST, HIGH);

    // 3) VSPI: SCK=18, MISO=-1, MOSI=23, SS=-1 (CS sterujemy recznie)
    oledSPI.begin(OLED_CLK, -1, OLED_MOSI, -1);
    oledSPI.beginTransaction(SPISettings(8000000, MSBFIRST, SPI_MODE0));
    Serial.println("[OK] VSPI 8 MHz, MODE0");

    // 4) Init SSD1322
    Serial.println("Inicjalizacja SSD1322...");
    initSSD1322();
    Serial.println("[OK] SSD1322 init OK");

    // 5) Sekwencja testow
    Serial.println("Test 1/4: czarny ekran");
    fillScreen(0x00);
    delay(800);

    Serial.println("Test 2/4: bialy ekran (max jasnosc)");
    fillScreen(0x0F);
    delay(1500);

    Serial.println("Test 3/4: rampa szarosci (4 pasy)");
    drawTestPattern();
    delay(2500);

    Serial.println("Test 4/4: animacja kolumn (sweep)");
    for (int c = 0; c < 64; c++) {
        drawSweepingColumn(c);
        delay(30);
    }

    Serial.println("=== KONIEC TESTOW ===");
    Serial.println("Pozostawiam pattern szarosci na ekranie.");
    drawTestPattern();
}

void loop() {
    // Pulsujacy kontrast — widoczne ze panel jest aktywny
    static uint8_t c = 0xFF;
    static int8_t dir = -2;
    cmd(0xC1);
    dat(c);
    c += dir;
    if (c < 0x20 || c > 0xFE) dir = -dir;
    delay(30);
}
