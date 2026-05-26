#pragma once
// =====================================================================
//  camera.h — OV2640 driver dla KalkMate PCB v4 (ESP32-S3)
//
//  Mapowanie pinow z OV2640 24-pin FFC (Sensor 2640):
//
//   FFC pin  | OV2640    | ESP32-S3 GPIO
//   ---------+-----------+----------------
//   3        | SIO_D     | GPIO40 (I2C SDA)
//   5        | SIO_C     | GPIO39 (I2C SCL)
//   6        | RESET     | MCP23017 GPA6
//   7        | VSYNC     | GPIO5
//   8        | PWDN      | MCP23017 GPA5
//   9        | HREF      | GPIO6
//   12       | Y9 (D7)   | GPIO16
//   13       | XCLK      | GPIO7
//   14       | Y8 (D6)   | GPIO17
//   16       | Y7 (D5)   | GPIO8
//   17       | PCLK      | GPIO10
//   18       | Y6 (D4)   | GPIO9
//   19       | Y2 (D0)   | GPIO14
//   20       | Y5 (D3)   | GPIO12
//   21       | Y3 (D1)   | GPIO13
//   22       | Y4 (D2)   | GPIO21
//
//  PWDN i RESET sa za ekspanderem MCP — sterujemy je przez input.h gdy
//  inputBegin() juz zainicjalizowalo MCP. Zatem camBegin() MUSI byc po
//  inputBegin().
// =====================================================================

#include <Arduino.h>
#include <esp_camera.h>
#include "input.h"   // _inMcp (MCP23017) dla PWDN/RESET

#ifdef KALK_HW_LEGACY
  // Stary PCB nie ma kamery — wszystkie pinout-y do -1, camBegin zwraca false
  #define CAM_PIN_VSYNC     -1
  #define CAM_PIN_HREF      -1
  #define CAM_PIN_PCLK      -1
  #define CAM_PIN_XCLK      -1
  #define CAM_PIN_D0        -1
  #define CAM_PIN_D1        -1
  #define CAM_PIN_D2        -1
  #define CAM_PIN_D3        -1
  #define CAM_PIN_D4        -1
  #define CAM_PIN_D5        -1
  #define CAM_PIN_D6        -1
  #define CAM_PIN_D7        -1
  #define CAM_PIN_SIOD      -1
  #define CAM_PIN_SIOC      -1
#else
  // PCB v4 (ESP32-S3) — wg schematu
  #define CAM_PIN_VSYNC      5
  #define CAM_PIN_HREF       6
  #define CAM_PIN_PCLK      10
  #define CAM_PIN_XCLK       7
  #define CAM_PIN_D0        14   // Y2 - LSB
  #define CAM_PIN_D1        13   // Y3
  #define CAM_PIN_D2        21   // Y4
  #define CAM_PIN_D3        12   // Y5
  #define CAM_PIN_D4         9   // Y6
  #define CAM_PIN_D5         8   // Y7
  #define CAM_PIN_D6        17   // Y8
  #define CAM_PIN_D7        16   // Y9 - MSB
  #define CAM_PIN_SIOD      40   // SDA
  #define CAM_PIN_SIOC      39   // SCL
#endif

// PWDN i RESET — przez ekspander MCP23017 (GPA5 i GPA6)
#define CAM_MCP_PWDN       5    // MCP GPA5
#define CAM_MCP_RESET      6    // MCP GPA6

static bool _camReady = false;

// Wlacza zasilanie kamery i wybudza ja:
//   PWDN = LOW (kamera ON), RESET pulse, czekamy 20ms
static void _camPowerOn() {
    if (!_inMcpReady) return;
    _inMcp.pinMode(CAM_MCP_PWDN, OUTPUT);
    _inMcp.pinMode(CAM_MCP_RESET, OUTPUT);
    // PWDN: HIGH = power down, LOW = active
    _inMcp.digitalWrite(CAM_MCP_PWDN, LOW);
    delay(10);
    // RESET pulse: aktywny LOW
    _inMcp.digitalWrite(CAM_MCP_RESET, LOW);
    delay(5);
    _inMcp.digitalWrite(CAM_MCP_RESET, HIGH);
    delay(20);  // czas na stabilizacje po reset
}

// Wylacza kamere (oszczednosc 50mA):
static void _camPowerOff() {
    if (!_inMcpReady) return;
    _inMcp.digitalWrite(CAM_MCP_PWDN, HIGH);  // power down
}

// Inicjalizacja kamery. Zwraca true gdy OK. Wywolac PO inputBegin().
inline bool camBegin() {
    if (_camReady) return true;

#ifdef KALK_HW_LEGACY
    return false;   // stary PCB bez kamery
#else
    if (!_inMcpReady) {
        Serial.println("[CAM] MCP not ready - call inputBegin() first");
        return false;
    }

    _camPowerOn();

    camera_config_t config;
    config.ledc_channel = LEDC_CHANNEL_0;
    config.ledc_timer   = LEDC_TIMER_0;
    config.pin_d0       = CAM_PIN_D0;
    config.pin_d1       = CAM_PIN_D1;
    config.pin_d2       = CAM_PIN_D2;
    config.pin_d3       = CAM_PIN_D3;
    config.pin_d4       = CAM_PIN_D4;
    config.pin_d5       = CAM_PIN_D5;
    config.pin_d6       = CAM_PIN_D6;
    config.pin_d7       = CAM_PIN_D7;
    config.pin_xclk     = CAM_PIN_XCLK;
    config.pin_pclk     = CAM_PIN_PCLK;
    config.pin_vsync    = CAM_PIN_VSYNC;
    config.pin_href     = CAM_PIN_HREF;
    config.pin_sccb_sda = CAM_PIN_SIOD;
    config.pin_sccb_scl = CAM_PIN_SIOC;
    config.pin_pwdn     = -1;     // przez MCP, nie GPIO
    config.pin_reset    = -1;     // przez MCP, nie GPIO
    config.xclk_freq_hz = 10000000;            // 10 MHz - stabilniej z WiFi (vs 20MHz)
    config.pixel_format = PIXFORMAT_JPEG;
    config.frame_size   = FRAMESIZE_SVGA;      // 800x600 - dobry balans dla matury
    config.jpeg_quality = 12;                  // 0-63, mniej = lepiej
    config.fb_count     = 2;
    config.grab_mode    = CAMERA_GRAB_LATEST;
    config.fb_location  = CAMERA_FB_IN_PSRAM;  // PSRAM (8MB) dla JPEG buffers

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
        Serial.printf("[CAM] esp_camera_init failed: 0x%x\n", err);
        _camPowerOff();
        return false;
    }

    _camReady = true;
    Serial.println("[CAM] OK");
    return true;
#endif
}

// Zwolnij kamere (deinit + power off).
inline void camEnd() {
    if (!_camReady) return;
    esp_camera_deinit();
    _camPowerOff();
    _camReady = false;
    Serial.println("[CAM] deinit");
}

// Zrob zdjecie. Zwraca pointer do JPEG buffer (lub nullptr przy bledzie).
// WAZNE: po uzyciu wywolaj esp_camera_fb_return(fb).
inline camera_fb_t* camCapture() {
    if (!_camReady) return nullptr;
    // Wyrzuc 2 klatki — pierwsze sa zwykle przeswiecone/niedoskonale po power-on
    static bool _firstCapture = true;
    if (_firstCapture) {
        camera_fb_t* warm = esp_camera_fb_get();
        if (warm) esp_camera_fb_return(warm);
        warm = esp_camera_fb_get();
        if (warm) esp_camera_fb_return(warm);
        _firstCapture = false;
    }
    return esp_camera_fb_get();
}
