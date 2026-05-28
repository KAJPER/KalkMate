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
//   6        | RESET     | MCP23017 GPA5
//   7        | VSYNC     | GPIO5
//   8        | PWDN      | MCP23017 GPA6
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

// PWDN i RESET — przez ekspander MCP23017 (wg schematu PCB v4)
#define CAM_MCP_PWDN       6    // MCP GPA6 (pin 8 FFC)
#define CAM_MCP_RESET      5    // MCP GPA5 (pin 6 FFC)

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
    // I2C kamery WSPOLDZIELONY z MCP23017 (oba na GPIO40+GPIO39).
    // pin_sccb_sda=-1 + sccb_i2c_port=0 mowi driver'owi: "nie inicjalizuj
    // swojego I2C, uzyj istniejacego Wire (I2C_NUM_0)". Bez tego kamera
    // przejmuje peripheral i Wire.requestFrom() na MCP23017 zwraca
    // Error 263 (ESP_FAIL) -> klawiatura przestaje dzialac.
    config.pin_sccb_sda  = -1;
    config.pin_sccb_scl  = -1;
    config.sccb_i2c_port = 0;     // I2C_NUM_0 = Arduino Wire
    config.pin_pwdn      = -1;    // przez MCP, nie GPIO
    config.pin_reset     = -1;    // przez MCP, nie GPIO
    config.xclk_freq_hz = 10000000;            // 10 MHz - stabilniej z WiFi (vs 20MHz)
    config.pixel_format = PIXFORMAT_JPEG;
    // UXGA 1600x1200 - max rozdzielczosc OV2640 (2MP). Dla matury wazne
    // zeby drobny druk i ulamki byly czytelne dla AI. JPEG ~150-250KB w PSRAM.
    config.frame_size   = FRAMESIZE_UXGA;
    config.jpeg_quality = 10;                  // 0-63, mniej = lepiej (10 = wysoka jakosc)
    // fb_count=1 + GRAB_WHEN_EMPTY => brak background task ssacy CPU.
    // Wczesniej (fb_count=2 + GRAB_LATEST) klatki ciagle laczyly sie w tle
    // przez co OLED i debounce klawiszy lagowaly i ekran zamarzal.
    config.fb_count     = 1;
    config.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;
    config.fb_location  = CAMERA_FB_IN_PSRAM;  // PSRAM (8MB) dla JPEG buffers

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
        Serial.printf("[CAM] esp_camera_init failed: 0x%x\n", err);
        _camPowerOff();
        return false;
    }

    // === Konfiguracja sensora ===
    // Domyslnie po esp_camera_init AEC/AGC/AWB sa wylaczone, stad jedna klatka
    // byla totalnie przepalona, druga prawie czarna. Wlaczamy automatyke +
    // standardowe parametry ktore daja dobra ekspozycje dla rozne oswietlenia.
    sensor_t* s = esp_camera_sensor_get();
    if (s) {
        s->set_brightness(s,    0);   // -2..2
        s->set_contrast(s,      0);   // -2..2
        s->set_saturation(s,    0);   // -2..2
        s->set_special_effect(s, 0);  // 0=none, 1=negative, 2=grayscale...
        s->set_whitebal(s,      1);   // AWB on - elimnuje zielony tint
        s->set_awb_gain(s,      1);
        s->set_wb_mode(s,       0);   // 0=auto
        s->set_exposure_ctrl(s, 1);   // AEC on - auto-ekspozycja
        s->set_aec2(s,          1);   // AEC algorithm v2 (lepszy)
        s->set_ae_level(s,      0);   // -2..2
        s->set_aec_value(s,     300); // 0..1200, "target brightness"
        s->set_gain_ctrl(s,     1);   // AGC on - auto-wzmocnienie
        s->set_agc_gain(s,      0);
        s->set_gainceiling(s, (gainceiling_t)2);  // max gain 4x (mniej szumu)
        s->set_bpc(s,           1);   // black pixel correction
        s->set_wpc(s,           1);   // white pixel correction
        s->set_raw_gma(s,       1);   // gamma correction
        s->set_lenc(s,          1);   // lens correction (winietowanie)
        // PCB v4: probujemy rozne kombinacje flips. v1.3.9: tylko vflip=1.
        // Jezeli to mirror face -> trzeba dodac hmirror=1. Jezeli 180° -> obie 0.
        s->set_hmirror(s,       0);
        s->set_vflip(s,         1);
        Serial.println("[CAM] flips: hmirror=0 vflip=1 (v1.3.9 test)");
        s->set_dcw(s,           1);   // downsize crop window
        s->set_colorbar(s,      0);   // 1 = test pattern (tylko debug)
    }

    _camReady = true;
    Serial.println("[CAM] OK (AEC/AGC/AWB enabled)");
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

// Warm-up — wyrzuc N klatek. AEC/AGC potrzebuje ~3-5 klatek zeby zbiec
// na docelowa ekspozycje, inaczej pierwsze zdjecie jest przepalone lub czarne.
// 5 klatek przy 15fps UXGA = ~333ms.
inline void camWarmup(int frames = 5) {
    if (!_camReady) return;
    for (int i = 0; i < frames; i++) {
        camera_fb_t* fb = esp_camera_fb_get();
        if (fb) esp_camera_fb_return(fb);
    }
}

// Zrob zdjecie. Zwraca pointer do JPEG buffer (lub nullptr przy bledzie).
// WAZNE: po uzyciu wywolaj esp_camera_fb_return(fb).
inline camera_fb_t* camCapture() {
    if (!_camReady) return nullptr;
    return esp_camera_fb_get();
}
