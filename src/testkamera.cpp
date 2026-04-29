// =====================================================================
//  testkamera.cpp — bring-up OV2640 (DVP parallel) na ESP32-WROVER
//
//  Cel: zweryfikować czy sensor odpowiada na I2C, odpowiada na
//  esp_camera_init(), i czy zwraca poprawne ramki JPEG. BEZ streamingu,
//  bez HTTP, bez UI — tylko log po Serial.
//
//  Pinout (zgodnie z PCB v3 FINAL):
//   D0=5 (strap), D1=14, D2=19, D3=13, D4=34, D5=35, D6=32, D7=33
//   PCLK=12 (strap, GPIO12 flash voltage!), XCLK=25 (LEDC PWM)
//   VSYNC=27, HREF=26, SDA=21, SCL=22
//   PWDN, RESET — przez MCP23017 (GPA5, GPA6), nie bezpośrednio z ESP32
//
//  Przed pierwszym uruchomieniem:
//    espefuse.py --port COM3 set_flash_voltage 3.3V
//  inaczej GPIO12 strap zepsuje boot przy podpiętej kamerze.
// =====================================================================

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_MCP23X17.h>
#include "esp_camera.h"

// === I2C / MCP23017 ===
#define I2C_SDA    21
#define I2C_SCL    22
#define MCP_ADDR   0x20
#define MCP_GPA5   5    // kamera PWDN  (HIGH = power down)
#define MCP_GPA6   6    // kamera RESET# (LOW = reset)

// === Kamera OV2640 — piny ESP32 ===
// Mapping zweryfikowany ze schematem producenta kamery (FFC pinout):
//   FFC pin 6 = D0, pin 4 = D1, pin 3 = D2, pin 5 = D3
//   FFC pin 7 = D4, pin 9 = D5, pin 11 = D6, pin 13 = D7
// D4-D7 sa fizycznie podpiete na PCB w kolejnosci innej niz CLAUDE.md.
#define CAM_PIN_D0     5
#define CAM_PIN_D1    14
#define CAM_PIN_D2    19
#define CAM_PIN_D3    13
#define CAM_PIN_D4    33   // FFC pin 7  (bylo: 34, ale na PCB pin 7 = GPIO33)
#define CAM_PIN_D5    32   // FFC pin 9  (bylo: 35, ale na PCB pin 9 = GPIO32)
#define CAM_PIN_D6    34   // FFC pin 11 (bylo: 32, ale na PCB pin 11 = GPIO34)
#define CAM_PIN_D7    35   // FFC pin 13 (bylo: 33, ale na PCB pin 13 = GPIO35)
#define CAM_PIN_PCLK  12
#define CAM_PIN_XCLK  25
#define CAM_PIN_VSYNC 27
#define CAM_PIN_HREF  26
#define CAM_PIN_SDA   21
#define CAM_PIN_SCL   22
#define CAM_PIN_PWDN  -1   // przez MCP23017
#define CAM_PIN_RESET -1   // przez MCP23017

#define OV2640_SCCB_ADDR  0x30   // 7-bit I2C adres OV2640

#define CAPTURE_INTERVAL_MS  2000

static Adafruit_MCP23X17 mcp;
static bool cameraInitialized = false;

// ---------------------------------------------------------------------
//  helpery
// ---------------------------------------------------------------------

static const char* errStr(esp_err_t e) {
    switch (e) {
        case ESP_OK:                  return "ESP_OK";
        case ESP_ERR_NOT_FOUND:       return "ESP_ERR_NOT_FOUND — sensor nie wykryty (sprawdz FFC, zasilania 2.8V/1.3V, PWDN/RESET)";
        case ESP_ERR_NO_MEM:          return "ESP_ERR_NO_MEM — brak pamieci PSRAM (sprawdz czy WROVER, nie WROOM)";
        case ESP_ERR_INVALID_ARG:     return "ESP_ERR_INVALID_ARG — niepoprawna konfiguracja pinow";
        case ESP_ERR_INVALID_STATE:   return "ESP_ERR_INVALID_STATE — kamera juz zainicjalizowana / zly stan";
        case ESP_FAIL:                return "ESP_FAIL — init failed (XCLK, parallel data, lub VSYNC/HREF nie dziala)";
        default:                      return "nieznany blad";
    }
}

// Programowe odblokowanie zablokowanego I2C bus'a:
// 9 dummy clocków na SCL z SDA jako INPUT — zwalnia slave'a który zawiesił
// transakcję trzymając SDA LOW (typowo po brownoucie sensora).
static void i2cBusRescue() {
    pinMode(I2C_SDA, INPUT_PULLUP);
    pinMode(I2C_SCL, OUTPUT);
    delay(2);

    int sdaState = digitalRead(I2C_SDA);
    if (sdaState == LOW) {
        Serial.println("[WARN] SDA trzymane LOW przed startem — proba odblokowania bus'a");
    }

    for (int i = 0; i < 9; i++) {
        digitalWrite(I2C_SCL, LOW);
        delayMicroseconds(5);
        digitalWrite(I2C_SCL, HIGH);
        delayMicroseconds(5);
    }
    // STOP condition: SDA LOW -> HIGH przy SCL HIGH
    pinMode(I2C_SDA, OUTPUT);
    digitalWrite(I2C_SDA, LOW);
    delayMicroseconds(5);
    digitalWrite(I2C_SCL, HIGH);
    delayMicroseconds(5);
    digitalWrite(I2C_SDA, HIGH);
    delayMicroseconds(5);

    // wroc do INPUT zeby Wire.begin mogl przejac kontrole
    pinMode(I2C_SDA, INPUT);
    pinMode(I2C_SCL, INPUT);
}

static void i2cScan() {
    Serial.println();
    Serial.println("--- I2C scan ---");
    int found = 0;
    bool ov2640Present = false;

    for (uint8_t addr = 0x01; addr < 0x7F; addr++) {
        Wire.beginTransmission(addr);
        uint8_t err = Wire.endTransmission();
        if (err == 0) {
            Serial.printf("  found 0x%02X", addr);
            if (addr == MCP_ADDR)        Serial.print("  (MCP23017)");
            if (addr == OV2640_SCCB_ADDR) { Serial.print("  (OV2640)"); ov2640Present = true; }
            Serial.println();
            found++;
        }
    }
    Serial.printf("  razem znaleziono %d urzadzen\n", found);
    if (!ov2640Present) {
        Serial.println("  [WARN] OV2640 (0x30) NIE odpowiada na I2C — esp_camera_init prawdopodobnie zwroci ESP_ERR_NOT_FOUND.");
        Serial.println("         Diagnoza: sprawdz AVDD=2.8V, DOVDD=2.8V, DVDD=1.3V, XCLK na pin 25,");
        Serial.println("         linie SDA/SCL na FFC kamery, PWDN/RESET przez MCP23017.");
    } else {
        Serial.println("  [OK] OV2640 wykryty na 0x30 — sensor zywy");
    }
    Serial.println();
}

// Uruchom XCLK 20 MHz na GPIO25 przez LEDC PWM — OV2640 wymaga aktywnego
// clocka zeby odpowiedziec na SCCB (i nie pozerac pradu przez ESD).
static void startXclk20MHz() {
    Serial.println("--- Start XCLK 20 MHz na GPIO25 (LEDC PWM) ---");
    ledcSetup(0, 20000000, 1);   // channel 0, 20 MHz, 1-bit = 50% duty
    ledcAttachPin(CAM_PIN_XCLK, 0);
    ledcWrite(0, 1);
    delay(10);
    Serial.println("  [OK] XCLK 20 MHz uruchomione");
}

static bool powerSequenceCamera() {
    Serial.println("--- Power sequencing kamery (przez MCP23017) ---");

    mcp.pinMode(MCP_GPA5, OUTPUT);
    mcp.pinMode(MCP_GPA6, OUTPUT);

    // 1. PWDN HIGH (shutdown), RESET LOW (held in reset)
    mcp.digitalWrite(MCP_GPA5, HIGH);
    mcp.digitalWrite(MCP_GPA6, LOW);
    Serial.println("  PWDN=HIGH, RESET=LOW (kamera w shutdown + reset)");
    delay(10);

    // 2. PWDN LOW — wybudzenie
    mcp.digitalWrite(MCP_GPA5, LOW);
    Serial.println("  PWDN=LOW (wybudzenie)");
    delay(10);

    // 3. XCLK musi byc aktywne ZANIM zwolnimy RESET, inaczej sensor utyka
    startXclk20MHz();

    // 4. RESET HIGH — wyjscie z resetu, sensor boot
    mcp.digitalWrite(MCP_GPA6, HIGH);
    Serial.println("  RESET=HIGH (sensor PLL settle z aktywnym XCLK...)");
    delay(100);  // troche dluzej, sensor potrzebuje pelnego cyklu PLL

    Serial.println("  [OK] Sensor power-on sequence zakonczona");
    return true;
}

static void printSensorInfo() {
    sensor_t* s = esp_camera_sensor_get();
    if (!s) {
        Serial.println("[ERR] esp_camera_sensor_get() zwrocil NULL");
        return;
    }
    Serial.println();
    Serial.println("--- Sensor info ---");
    Serial.printf("  PID  = 0x%02X   (OV2640 oczekiwane 0x26)\n", s->id.PID);
    Serial.printf("  VER  = 0x%02X   (OV2640 oczekiwane 0x42)\n", s->id.VER);
    Serial.printf("  MIDH = 0x%02X\n", s->id.MIDH);
    Serial.printf("  MIDL = 0x%02X\n", s->id.MIDL);
    if (s->id.PID == 0x26) {
        Serial.println("  [OK] PID matches OV2640");
    } else {
        Serial.println("  [WARN] PID nie pasuje do OV2640 — moze inny sensor lub blad SCCB");
    }
}

// ---------------------------------------------------------------------
//  setup
// ---------------------------------------------------------------------

void setup() {
    Serial.begin(115200);
    delay(300);
    Serial.println("\n=========================================");
    Serial.println("=== TEST KAMERA OV2640 (DVP parallel) ===");
    Serial.println("=========================================");

    // Krok 2a — I2C bus rescue (zwalnia zablokowane slave'y typu OV2640 po brownoucie)
    Serial.println("--- I2C bus rescue (9 dummy clocks) ---");
    i2cBusRescue();

    // Krok 2b — Wire init (najpierw 100 kHz dla bezpieczenstwa, potem podbijemy)
    Wire.begin(I2C_SDA, I2C_SCL);
    Wire.setClock(100000);

    // Krok 2c — wczesny scan PRZED MCP init: zobacz co fizycznie odpowiada
    Serial.println("--- I2C scan PRZED MCP init ---");
    {
        int found = 0;
        for (uint8_t addr = 0x01; addr < 0x7F; addr++) {
            Wire.beginTransmission(addr);
            if (Wire.endTransmission() == 0) {
                Serial.printf("  found 0x%02X", addr);
                if (addr == MCP_ADDR)         Serial.print("  (MCP23017)");
                if (addr == OV2640_SCCB_ADDR) Serial.print("  (OV2640)");
                Serial.println();
                found++;
            }
        }
        Serial.printf("  razem: %d urzadzen\n", found);
        if (found == 0) {
            Serial.println("  [FATAL] BUS PUSTY — nikt nie odpowiada.");
            Serial.println("          Mozliwe: brak zasilania MCP, zerwana sciezka SDA/SCL,");
            Serial.println("          brak pull-upow 4.7k na liniach, lub kamera trzyma busa LOW.");
            Serial.println("          Sproboj: 1) odlacz FFC kamery 2) sprawdz 3.3V na MCP VDD");
            Serial.println("                   3) zmierz oporu pull-up SDA/SCL do 3.3V");
            return;
        }
    }
    Serial.println();

    // Krok 2d — init MCP23017
    if (!mcp.begin_I2C(MCP_ADDR)) {
        Serial.println("[FATAL] MCP23017 nie odpowiada na 0x20!");
        Serial.println("        Bez MCP nie mozna sterowac PWDN/RESET kamery — test przerwany.");
        return;
    }
    Serial.println("[OK] MCP23017 OK");

    // Po inicie mozemy podbic do 400 kHz
    Wire.setClock(400000);

    // Krok 3 — power sequencing kamery
    powerSequenceCamera();

    // Krok 4 — I2C scan przed init kamery
    i2cScan();

    // Krok 5 — konfiguracja kamery
    camera_config_t config = {};
    config.ledc_channel = LEDC_CHANNEL_0;
    config.ledc_timer   = LEDC_TIMER_0;

    config.pin_d0 = CAM_PIN_D0;
    config.pin_d1 = CAM_PIN_D1;
    config.pin_d2 = CAM_PIN_D2;
    config.pin_d3 = CAM_PIN_D3;
    config.pin_d4 = CAM_PIN_D4;
    config.pin_d5 = CAM_PIN_D5;
    config.pin_d6 = CAM_PIN_D6;
    config.pin_d7 = CAM_PIN_D7;
    config.pin_xclk     = CAM_PIN_XCLK;
    config.pin_pclk     = CAM_PIN_PCLK;
    config.pin_vsync    = CAM_PIN_VSYNC;
    config.pin_href     = CAM_PIN_HREF;
    config.pin_sccb_sda = CAM_PIN_SDA;
    config.pin_sccb_scl = CAM_PIN_SCL;
    config.pin_pwdn     = CAM_PIN_PWDN;
    config.pin_reset    = CAM_PIN_RESET;

    config.xclk_freq_hz = 20000000;          // 20 MHz
    config.pixel_format = PIXFORMAT_JPEG;
    config.frame_size   = FRAMESIZE_QVGA;    // 320x240 — bezpieczny start
    config.jpeg_quality = 12;
    config.fb_count     = 1;
    config.fb_location  = CAMERA_FB_IN_PSRAM;
    config.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;

    Serial.println("--- esp_camera_init() ---");
    Serial.println("  XCLK = 20 MHz, JPEG, QVGA 320x240, fb=1, PSRAM");

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
        Serial.printf("[FATAL] esp_camera_init failed: 0x%x\n", err);
        Serial.printf("        %s\n", errStr(err));
        return;
    }
    Serial.println("[OK] esp_camera_init OK");
    cameraInitialized = true;

    // Krok 7 — info o sensorze
    printSensorInfo();

    Serial.println();
    Serial.printf("Capture loop: co %u ms\n", CAPTURE_INTERVAL_MS);
    Serial.println();
}

// ---------------------------------------------------------------------
//  loop
// ---------------------------------------------------------------------

void loop() {
    if (!cameraInitialized) {
        delay(1000);
        return;
    }

    static uint32_t lastCap = 0;
    uint32_t now = millis();
    if (now - lastCap < CAPTURE_INTERVAL_MS) return;
    lastCap = now;

    static uint32_t frameNum = 0;
    frameNum++;

    uint32_t t0 = millis();
    camera_fb_t* fb = esp_camera_fb_get();
    uint32_t dt = millis() - t0;

    if (!fb) {
        Serial.printf("[ERR] frame #%u — esp_camera_fb_get() zwrocil NULL (capture failed)\n", frameNum);
        return;
    }

    Serial.printf("--- Frame #%u  (capture %u ms) ---\n", frameNum, dt);
    Serial.printf("  %u x %u, size=%u bytes, format=%d\n",
                  fb->width, fb->height, (unsigned)fb->len, (int)fb->format);

    Serial.print("  Header: ");
    for (size_t i = 0; i < 16 && i < fb->len; i++) {
        Serial.printf("%02X ", fb->buf[i]);
    }
    Serial.println();

    if (fb->len >= 2 && fb->buf[0] == 0xFF && fb->buf[1] == 0xD8) {
        // sprawdz tez koncowke EOI 0xFFD9
        bool eoi = (fb->len >= 2
                    && fb->buf[fb->len - 2] == 0xFF
                    && fb->buf[fb->len - 1] == 0xD9);
        if (eoi) {
            Serial.println("  [OK] Valid JPEG (SOI 0xFFD8 + EOI 0xFFD9)");
        } else {
            Serial.println("  [OK] SOI 0xFFD8 obecne, ale brak EOI 0xFFD9 — moze obciety frame");
        }
    } else {
        Serial.println("  [WARN] Invalid JPEG header — sensor moze zle skonfigurowany lub uszkodzona transmisja DVP");
    }

    esp_camera_fb_return(fb);
}
