// =====================================================================
//  i2c_scan v4 — pure bit-bang I2C scanner.
//  Recznie toggluje GPIO39/40, nie uzywa zadnego peripheral. Nie moze
//  zawisnac. Idealny do diagnozy hardware z poziomu boot.
// =====================================================================

#include <Arduino.h>

#define I2C_SDA  40
#define I2C_SCL  39
#define I2C_DELAY_US 5   // 5us = ~100kHz

// Stan poczatkowy: SDA i SCL jako INPUT (open-drain emulation).
// Aby "wyslac LOW" robimy OUTPUT + LOW. Aby "wyslac HIGH" wracamy do INPUT
// (zewnetrzny pull-up pociagnie linie HIGH). Wewnetrzny pull-up jest backup.

static inline void sdaHigh() { pinMode(I2C_SDA, INPUT_PULLUP); }
static inline void sdaLow()  { pinMode(I2C_SDA, OUTPUT); digitalWrite(I2C_SDA, LOW); }
static inline void sclHigh() { pinMode(I2C_SCL, INPUT_PULLUP); }
static inline void sclLow()  { pinMode(I2C_SCL, OUTPUT); digitalWrite(I2C_SCL, LOW); }
static inline int  sdaRead() { return digitalRead(I2C_SDA); }

void i2cInit() {
    sdaHigh();
    sclHigh();
    delayMicroseconds(20);
}

void i2cStart() {
    sdaHigh();
    sclHigh();
    delayMicroseconds(I2C_DELAY_US);
    sdaLow();
    delayMicroseconds(I2C_DELAY_US);
    sclLow();
}

void i2cStop() {
    sdaLow();
    delayMicroseconds(I2C_DELAY_US);
    sclHigh();
    delayMicroseconds(I2C_DELAY_US);
    sdaHigh();
    delayMicroseconds(I2C_DELAY_US);
}

// Wysylaj bajt, czytaj ACK. Zwraca true = ACK, false = NACK.
bool i2cWriteByte(uint8_t b) {
    for (int i = 7; i >= 0; i--) {
        if ((b >> i) & 1) sdaHigh(); else sdaLow();
        delayMicroseconds(I2C_DELAY_US);
        sclHigh();
        delayMicroseconds(I2C_DELAY_US);
        sclLow();
        delayMicroseconds(1);
    }
    // Czytaj ACK (slave ma trzymac SDA LOW przez 9-ty puls SCL)
    sdaHigh();   // zwolnij SDA (wejscie z pull-up)
    delayMicroseconds(I2C_DELAY_US);
    sclHigh();
    delayMicroseconds(I2C_DELAY_US);
    int ack = sdaRead();   // 0 = ACK, 1 = NACK
    sclLow();
    delayMicroseconds(1);
    return ack == 0;
}

// Probuj adres (7-bit) z bitem W (0). Zwraca true jezeli ACK.
bool probeAddr(uint8_t addr) {
    i2cStart();
    bool ack = i2cWriteByte((addr << 1) | 0);
    i2cStop();
    delayMicroseconds(50);
    return ack;
}

void scanAll() {
    Serial.println("--- Bit-bang scan I2C 0x01-0x7E ---");
    int found = 0;
    for (uint8_t addr = 1; addr < 127; addr++) {
        bool ack = probeAddr(addr);
        if (ack) {
            Serial.printf("  0x%02X ACK", addr);
            if (addr == 0x20) Serial.print("  <- MCP23017 ✓");
            if (addr == 0x30) Serial.print("  <- OV2640 SCCB ✓");
            Serial.println();
            found++;
        }
        if (addr % 32 == 0) { Serial.print("."); Serial.flush(); }
    }
    Serial.println();
    Serial.printf("Znaleziono %d urzadzen.\n", found);
}

void targetedProbe() {
    Serial.println("--- Target probe (znane adresy) ---");
    uint8_t targets[] = { 0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27,   // MCP23017 mozliwe (A0-A2)
                          0x30, 0x3C, 0x3D,                                  // OV2640 / OLED I2C
                          0x50, 0x51, 0x52, 0x53,                            // EEPROM
                          0x68, 0x69                                          // RTC / IMU
                        };
    for (uint8_t a : targets) {
        Serial.printf("  0x%02X: %s\n", a, probeAddr(a) ? "ACK ✓" : "no response");
    }
}

void checkLines() {
    Serial.println("--- Stan linii ---");
    sdaHigh(); sclHigh();
    delay(2);
    Serial.printf("  SDA=GPIO%d -> %s\n", I2C_SDA, sdaRead() ? "HIGH ✓" : "LOW ✗");
    pinMode(I2C_SCL, INPUT_PULLUP);
    Serial.printf("  SCL=GPIO%d -> %s\n", I2C_SCL, digitalRead(I2C_SCL) ? "HIGH ✓" : "LOW ✗");
    Serial.println();
}

void setup() {
    Serial.begin(115200);
    delay(2000);
    Serial.println("\n=== I2C diag v4 (BIT-BANG) ===");
    Serial.printf("SDA=GPIO%d, SCL=GPIO%d\n\n", I2C_SDA, I2C_SCL);

    i2cInit();
    checkLines();
    targetedProbe();
    Serial.println();
    scanAll();
}

void loop() {
    delay(8000);
    Serial.println("\n--- ponowna proba ---");
    targetedProbe();
}
