// =====================================================================
//  testi2c.cpp — I2C scanner
//
//  Skanuje magistralę I2C (GPIO21 SDA + GPIO22 SCL) co 3 sekundy
//  i wypisuje wszystkie wykryte adresy. Wyróżnia oczekiwane urządzenia:
//   - 0x20 = MCP23017 (klawiatura + boost EN + kamera PWDN/RESET)
//   - 0x30 = OV2640 (sensor kamery, gdy zasilona)
//
//  Wynik na Serial 115200. OLED nie używany — czysta diagnostyka I2C.
// =====================================================================

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_MCP23X17.h>

#define I2C_SDA   21
#define I2C_SCL   22

#define MCP_ADDR    0x20
#define OV2640_ADDR 0x30

#define MCP_GPA7    7   // Boost MT3608 EN (active HIGH)
#define MCP_GPA5    5   // Kamera PWDN (HIGH = power down)
#define MCP_GPA6    6   // Kamera RESET# (LOW = reset)

static Adafruit_MCP23X17 mcp;
static bool mcpReady = false;

void setup() {
    Serial.begin(115200);
    delay(300);
    Serial.println("\n========================================");
    Serial.println("=== I2C Scanner ===");
    Serial.println("SDA=GPIO21  SCL=GPIO22  freq=100 kHz");
    Serial.println("========================================");

    Wire.begin(I2C_SDA, I2C_SCL);
    Wire.setClock(100000);  // 100 kHz - bezpieczne dla diagnostyki

    // === Aktywacja MCP23017 + boost MT3608 (12V dla OLED) ===
    Serial.println();
    Serial.println("--- Konfiguracja MCP23017 + boost MT3608 ---");
    if (mcp.begin_I2C(MCP_ADDR)) {
        mcpReady = true;
        Serial.println("[OK] MCP23017 init");

        // GPA7 = boost EN (active HIGH)
        mcp.pinMode(MCP_GPA7, OUTPUT);
        mcp.digitalWrite(MCP_GPA7, HIGH);
        Serial.println("[OK] MCP GPA7 = HIGH -> Boost MT3608 ON (12V dla OLED)");

        // Power on kamery: PWDN=LOW (active), RESET=HIGH (out of reset)
        mcp.pinMode(MCP_GPA5, OUTPUT);
        mcp.pinMode(MCP_GPA6, OUTPUT);
        mcp.digitalWrite(MCP_GPA5, LOW);
        mcp.digitalWrite(MCP_GPA6, HIGH);
        Serial.println("[OK] MCP GPA5 = LOW (kamera PWDN=off, sensor zywy)");
        Serial.println("[OK] MCP GPA6 = HIGH (kamera RESET=zwolnione)");

        delay(100);  // pozwol boost ustabilizowac sie + sensor obudzic
    } else {
        Serial.println("[FATAL] MCP23017 nie odpowiada na 0x20");
        Serial.println("        Boost nie zostanie wlaczony - sprawdz I2C i zasilanie");
    }
    Serial.println();
}

void loop() {
    Serial.println();
    Serial.printf("[%lu ms] Skanowanie 0x01..0x7E...\n", millis());

    int found = 0;
    bool seenMcp = false;
    bool seenCam = false;

    for (uint8_t addr = 0x01; addr < 0x7F; addr++) {
        Wire.beginTransmission(addr);
        uint8_t err = Wire.endTransmission();

        if (err == 0) {
            // Urzadzenie odpowiedzialo
            Serial.printf("  0x%02X", addr);
            switch (addr) {
                case MCP_ADDR:    Serial.print("  <- MCP23017 (klawiatura/boost/kamera ctrl)"); seenMcp = true; break;
                case OV2640_ADDR: Serial.print("  <- OV2640 (sensor kamery)");                  seenCam = true; break;
                case 0x21:
                case 0x22:
                case 0x23:
                case 0x24:
                case 0x25:
                case 0x26:
                case 0x27: Serial.print("  (mozliwy MCP23017 z A0/A1/A2 != GND)"); break;
                case 0x3C:
                case 0x3D: Serial.print("  (mozliwy OLED SSD1306 — niewlasciwy display?)"); break;
                case 0x68: Serial.print("  (mozliwy DS3231 RTC / MPU6050)"); break;
                default: break;
            }
            Serial.println();
            found++;
        } else if (err == 4) {
            // Inny blad - rzadko, ale warto wiedziec
            Serial.printf("  0x%02X  (blad %d)\n", addr, err);
        }
    }

    Serial.println("----------------------------------------");
    Serial.printf("Znaleziono %d urzadzen.\n", found);
    Serial.printf("MCP23017 (0x20): %s\n", seenMcp ? "OK" : "BRAK");
    Serial.printf("OV2640   (0x30): %s\n", seenCam ? "OK" : "BRAK (kamera moze byc w shutdown)");

    if (!seenMcp) {
        Serial.println();
        Serial.println("Diagnoza braku MCP23017:");
        Serial.println("  - Sprawdz zasilanie 3.3V na pinie VDD MCP23017");
        Serial.println("  - Sprawdz adres: A0=A1=A2=GND -> 0x20");
        Serial.println("  - Sprawdz pull-upy 4.7k na SDA/SCL do 3.3V");
        Serial.println("  - Sprawdz ciaglosc sciezek od ESP32 GPIO21/22 do MCP");
    }

    delay(3000);
}
