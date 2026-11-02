#pragma once
// =====================================================================
//  camera.h — OV2640 / OV5640 (AF) driver dla KalkMate PCB v4 (ESP32-S3)
//
//  Oba sensory na tym samym 24-pin FFC i tych samych pinach. esp_camera
//  sam rozpoznaje sensor (OV2640 SCCB 0x30, OV5640 0x3C). Ustawienie
//  "Model kamery" (Auto/OV2640/OV5640) wybiera parametry: rozdzielczosc
//  JPEG i autofocus OV5640 (firmware AF z ov5640_af_fw.h, wymaga AFVDD
//  2.8 V na pinie 23 FFC — PCB v6).
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
#include <driver/ledc.h>
#include <driver/gpio.h>
#include "input.h"   // _inMcp (MCP23017) dla PWDN/RESET
#include "event_log.h"   // logEvent* — bufor zdarzen wysylany do serwera
#include <Wire.h>
#include "ov5640_af_fw.h"

// kalkSettings jest zdefiniowany dopiero w settings_screen.h, ktory jest
// includowany PO camera.h — analogicznie do otaGetLanguage()/_accGetUnlockCode().
extern uint8_t camGetWbMode();      // 0=Auto,1=Sloneczny,2=Pochmurno,3=Biuro,4=Dom
extern int8_t  camGetBrightness();  // -2..2
extern uint8_t camGetModelPref();   // CAM_MODEL_* (ustawienie "Model kamery")

#define CAM_MODEL_AUTO    0
#define CAM_MODEL_OV2640  1
#define CAM_MODEL_OV5640  2

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

// PWDN i RESET — przez ekspander MCP23017 (wg schematu PCB v4)
#define CAM_MCP_PWDN       6    // MCP GPA6 (pin 8 FFC)
#define CAM_MCP_RESET      5    // MCP GPA5 (pin 6 FFC)

static bool _camReady = false;
static uint8_t _camDetected = CAM_MODEL_AUTO;   // ostatnio wykryty sensor (AUTO = jeszcze nie)
static bool _camAfReady = false;                // firmware AF OV5640 wgrany po init

// Sensor wykryty przy ostatnim esp_camera_init() (CAM_MODEL_AUTO = kamera
// jeszcze nie byla wlaczona od startu).
inline uint8_t camDetectedModel() { return _camDetected; }

inline const char* camModelName(uint8_t m) {
    return m == CAM_MODEL_OV5640 ? "OV5640" : m == CAM_MODEL_OV2640 ? "OV2640" : "Auto";
}

// Model, wg ktorego dobieramy parametry: wymuszony w ustawieniach albo
// wykryty. Auto przed pierwszym wykryciem -> OV2640 (UXGA dziala na obu).
static uint8_t _camModel() {
    uint8_t p = camGetModelPref();
    if (p == CAM_MODEL_OV2640 || p == CAM_MODEL_OV5640) return p;
    return _camDetected != CAM_MODEL_AUTO ? _camDetected : CAM_MODEL_OV2640;
}

// Po esp_camera_init(): zapamietaj, jaki sensor faktycznie odpowiedzial.
static void _camNoteDetected() {
    sensor_t* s = esp_camera_sensor_get();
    if (!s) return;
    uint8_t m = s->id.PID == OV5640_PID ? CAM_MODEL_OV5640
              : s->id.PID == OV2640_PID ? CAM_MODEL_OV2640 : CAM_MODEL_AUTO;
    if (m != _camDetected) logEventf("CAM", "sensor PID 0x%x", s->id.PID);
    _camDetected = m;
    uint8_t p = camGetModelPref();
    if (p != CAM_MODEL_AUTO && m != CAM_MODEL_AUTO && p != m)
        Serial.printf("[CAM] UWAGA: wymuszony %s, wykryty %s\n", camModelName(p), camModelName(m));
}

// --- Autofocus OV5640 -------------------------------------------------
// Rejestry komend firmware AF (OV5640 AF application note).
#define _CAM_AF_MAIN       0x3022
#define _CAM_AF_ACK        0x3023
#define _CAM_AF_FW_STATUS  0x3029
#define _CAM_AF_SINGLE     0x03
#define _CAM_AF_CONTINUOUS 0x04
#define _CAM_AF_RELEASE    0x08
#define _CAM_AF_ST_FOCUSED 0x10
#define _CAM_AF_ST_IDLE    0x70

static bool _camReg(sensor_t* s, int reg, uint8_t v) { return s->set_reg(s, reg, 0xff, v) >= 0; }

// Wgraj firmware AF. Rejestry 0x8000.. maja autoinkrementacje, wiec piszemy
// paczkami przez Wire (bufor 128 B = 2 B adresu + 126 B danych) — ~0.1 s
// zamiast ~2 s bajt po bajcie przez s->set_reg (4077 transakcji).
static bool _camAfLoad(sensor_t* s) {
    _camAfReady = false;
    if (!_camReg(s, 0x3000, 0x20)) return false;   // reset MCU AF
    const size_t CHUNK = 126;
    for (size_t off = 0; off < sizeof(_ov5640AfFw); off += CHUNK) {
        size_t n = sizeof(_ov5640AfFw) - off;
        if (n > CHUNK) n = CHUNK;
        uint16_t addr = 0x8000 + off;
        Wire.beginTransmission(s->slv_addr);
        Wire.write((uint8_t)(addr >> 8));
        Wire.write((uint8_t)addr);
        Wire.write(_ov5640AfFw + off, n);
        if (Wire.endTransmission() != 0) return false;
    }
    for (int r = 0x3022; r <= 0x3028; r++) _camReg(s, r, 0x00);   // komenda/ACK/parametry
    _camReg(s, _CAM_AF_FW_STATUS, 0x7f);
    _camReg(s, 0x3000, 0x00);                       // start MCU AF
    unsigned long t0 = millis();
    while (millis() - t0 < 1000) {
        if (s->get_reg(s, _CAM_AF_FW_STATUS, 0xff) == _CAM_AF_ST_IDLE) {
            _camAfReady = true;
            return true;
        }
        delay(5);
    }
    return false;
}

// Wyslij komende do firmware AF i czekaj na potwierdzenie (ACK -> 0).
static bool _camAfCmd(sensor_t* s, uint8_t cmd, uint32_t timeoutMs) {
    if (!_camReg(s, _CAM_AF_ACK, 0x01) || !_camReg(s, _CAM_AF_MAIN, cmd)) return false;
    unsigned long t0 = millis();
    while (millis() - t0 < timeoutMs) {
        if (s->get_reg(s, _CAM_AF_ACK, 0xff) == 0) return true;
        delay(5);
    }
    return false;
}

// Po init: dla OV5640 wgraj firmware AF i (podglad) wlacz ciagly AF.
static void _camAfSetup(bool continuous) {
    _camAfReady = false;
    if (_camModel() != CAM_MODEL_OV5640) return;
    sensor_t* s = esp_camera_sensor_get();
    if (!s) return;
    unsigned long t0 = millis();
    if (!_camAfLoad(s)) {
        Serial.println("[CAM] AF firmware load FAILED");
        logEventf("CAM", "AF fw load failed");
        return;
    }
    // Ciagly AF bez czekania na ACK — firmware przyjmuje komendy co klatke,
    // a czekanie (do 1 s) tylko opoznialo start podgladu.
    if (continuous && !(_camReg(s, _CAM_AF_ACK, 0x01) && _camReg(s, _CAM_AF_MAIN, _CAM_AF_CONTINUOUS)))
        Serial.println("[CAM] AF continuous FAILED");
    Serial.printf("[CAM] AF ready (%lu ms)\n", millis() - t0);
}

// Pojedyncze ustawienie ostrosci przed zdjeciem. true = ostro.
// Przy SINGLE firmware zeruje ACK dopiero PO calym przeszukaniu zakresu
// soczewki (kroki co klatke, slychac tykanie VCM). W QXGA przy ~4 kl/s nie
// konczylo sie nawet w 5 s — stad podwojony PLL w camBegin() (~9 kl/s).
static bool _camAfFocusOnce() {
    sensor_t* s = esp_camera_sensor_get();
    if (!_camAfReady || !s) return false;
    unsigned long t0 = millis();
    bool acked = _camAfCmd(s, _CAM_AF_RELEASE, 500) && _camAfCmd(s, _CAM_AF_SINGLE, 5000);
    int st = s->get_reg(s, _CAM_AF_FW_STATUS, 0xff);
    bool ok = acked && st == _CAM_AF_ST_FOCUSED;
    Serial.printf("[CAM] AF %s (%lu ms, status 0x%02x)\n",
                  ok ? "focused" : acked ? "NOT FOCUSED" : "TIMEOUT", millis() - t0, st);
    if (!ok) logEventf("CAM", "AF %s %lums st=0x%02x", acked ? "nofocus" : "timeout", millis() - t0, st);
    return ok;
}

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

// Wspolne pola configu (piny, SCCB, XCLK, lokalizacja bufora) — identyczne dla
// trybu JPEG (camBegin) i podgladu grayscale (camBeginPreview). pixel_format,
// frame_size, jpeg_quality, fb_count i grab_mode ustawia wolajacy.
static void _camFillCommonConfig(camera_config_t& config) {
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
    // 10 MHz - stabilniej z WiFi (vs 20MHz). OV5640 przy 20 MHz na taśmie
    // (fw 2.1.2) dawal wyrazne pionowe paski — szybkosc odzyskujemy PLL-em
    // w sensorze (camBegin), a zegar na FFC zostaje 10 MHz.
    config.xclk_freq_hz  = 10000000;
    config.fb_location   = CAMERA_FB_IN_PSRAM; // PSRAM (8MB) dla buforow
}

// Wspolne ustawienia sensora (AEC/AGC/AWB + orientacja 180°). Wywolac po
// esp_camera_init(). Te same wartosci dla podgladu i finalnego zdjecia, zeby
// ekspozycja i orientacja kadru sie zgadzaly.
static void _camApplyCommonSensor() {
    sensor_t* s = esp_camera_sensor_get();
    if (!s) return;
    const bool ov5640 = s->id.PID == OV5640_PID;
    s->set_brightness(s,    camGetBrightness());  // -2..2, korekta z ustawien
    s->set_contrast(s,      0);   // -2..2
    s->set_saturation(s,    0);   // -2..2
    s->set_special_effect(s, 0);  // 0=none, 1=negative, 2=grayscale...
    s->set_whitebal(s,      1);   // AWB on - elimnuje zielony tint
    s->set_awb_gain(s,      1);
    s->set_wb_mode(s,       camGetWbMode());  // 0=auto, wg ustawien
    s->set_exposure_ctrl(s, 1);   // AEC on - auto-ekspozycja
    s->set_ae_level(s,      0);   // -2..2
    s->set_gain_ctrl(s,     1);   // AGC on - auto-wzmocnienie
    s->set_agc_gain(s,      0);
    if (ov5640) {
        // Sterownik OV5640 interpretuje te wywolania inaczej niz OV2640:
        //  - set_gainceiling wpisuje surowa wartosc do 0x3A18/19 (gain = x/16),
        //    wiec "2" dawalo sufit ~0.1x = brak wzmocnienia -> ciemne zdjecia.
        //    0x40 = 4x (8x dawalo widoczny szum kolumn — pionowe paski).
        //  - set_aec2 to tryb nocny (0x3A00 bit2): obniza klatki/s, a AF robi
        //    krok co klatke — wylaczony.
        //  - set_aec_value to reczny czas naswietlania — przy AEC zbedny.
        s->set_aec2(s, 0);
        s->set_gainceiling(s, (gainceiling_t)0x40);
        // Pomiar ekspozycji wazony srodkiem (siatka 4x4, wagi 0x5688..0x568F,
        // po 4 bity na strefe): kartka z zadaniem w srodku kadru, wokol ciemne
        // biurko. Przy sredniej z calego kadru kartka byla przepalona na biel,
        // a AF (kontrastowy) nie mial na czym ostrzyc z bliska.
        static const uint8_t aecWeights[8] = {0x11, 0x11, 0x81, 0x18, 0x81, 0x18, 0x11, 0x11};
        for (int i = 0; i < 8; i++) s->set_reg(s, 0x5688 + i, 0xff, aecWeights[i]);
    } else {
        s->set_aec2(s,      1);   // AEC algorithm v2 (lepszy)
        s->set_aec_value(s, 300); // 0..1200, "target brightness"
        s->set_gainceiling(s, (gainceiling_t)2);  // GAINCEILING_8X
    }
    s->set_bpc(s,           1);   // black pixel correction
    s->set_wpc(s,           1);   // white pixel correction
    s->set_raw_gma(s,       1);   // gamma correction
    s->set_lenc(s,          1);   // lens correction (winietowanie)
    // UWAGA: poprzednio ustawione hmirror=1+vflip=1 (obrot 180°) zakladalo
    // sensor zamontowany do gory nogami — to zalozenie bylo bledne (podglad
    // i zdjecie wychodzily obrocone o 180° w zla strone). Natywna orientacja
    // sensora jest juz poprawna, bez korekty.
    // OV5640 (PCB v6) natywnie daje obraz odbity w pionie (do gory nogami
    // i lustrzanie) — wystarczy samo vflip; hmirror=1 dawal lustro lewo-prawo.
    s->set_hmirror(s,       0);
    s->set_vflip(s,         ov5640 ? 1 : 0);
    s->set_dcw(s,           1);   // downsize crop window
    s->set_colorbar(s,      0);   // 1 = test pattern (tylko debug)
}

// Inicjalizacja kamery. Zwraca true gdy OK. Wywolac PO inputBegin().
inline bool camBegin() {
    if (_camReady) return true;

    if (!_inMcpReady) {
        Serial.println("[CAM] MCP not ready - call inputBegin() first");
        return false;
    }

    _camPowerOn();

    camera_config_t config;
    _camFillCommonConfig(config);
    config.pixel_format = PIXFORMAT_JPEG;
    const bool ov5640 = _camModel() == CAM_MODEL_OV5640;
    if (ov5640) {
        // QXGA 2048x1536 (3MP) z 5MP OV5640 — wiecej detalu niz UXGA, a JPEG
        // (~300-500KB) miesci sie w buforze kamery (w*h/5 = 629KB), kolejce
        // offline (SPIFFS) i limicie serwera (6MB). Jakosc 12 zamiast 10, zeby
        // gesta kartka nie przepelnila bufora.
        config.frame_size   = FRAMESIZE_QXGA;
        config.jpeg_quality = 12;
    } else {
        // UXGA 1600x1200 - max rozdzielczosc OV2640 (2MP). Dla matury wazne
        // zeby drobny druk i ulamki byly czytelne dla AI. JPEG ~150-250KB w PSRAM.
        // (Driver przycina frame_size do max sensora, wiec zle wymuszony model
        // nie psuje inicjalizacji.)
        config.frame_size   = FRAMESIZE_UXGA;
        config.jpeg_quality = 10;              // 0-63, mniej = lepiej (10 = wysoka jakosc)
    }
    // fb_count=1 + GRAB_WHEN_EMPTY => brak background task ssacy CPU.
    // Wczesniej (fb_count=2 + GRAB_LATEST) klatki ciagle laczyly sie w tle
    // przez co OLED i debounce klawiszy lagowaly i ekran zamarzal.
    config.fb_count     = 1;
    config.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;

    unsigned long t0 = millis();
    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
        Serial.printf("[CAM] esp_camera_init failed: 0x%x\n", err);
        logEventf("CAM", "init UXGA failed 0x%x", err);
        _camPowerOff();
        return false;
    }

    // === Konfiguracja sensora ===
    // Domyslnie po esp_camera_init AEC/AGC/AWB sa wylaczone, stad jedna klatka
    // byla totalnie przepalona, druga prawie czarna. Wlaczamy automatyke +
    // standardowe parametry ktore daja dobra ekspozycje dla rozne oswietlenia.
    _camApplyCommonSensor();
    _camNoteDetected();
    if (_camDetected == CAM_MODEL_OV5640) {
        // PLL drivera dla JPEG zaklada XCLK 20 MHz (pre_div 2). Przy 10 MHz
        // sensor chodzil o polowe wolniej (QXGA ~4 kl/s), a AF robi krok co
        // klatke — ostrzenie >5 s. pre_div 1 daje te same zegary wewnatrz
        // sensora co 20 MHz (~9 kl/s), bez szybszego sygnalu na tasmie.
        sensor_t* s = esp_camera_sensor_get();
        if (s) s->set_pll(s, 0, 200, 4, 0, 1, 2, 1, 4);
    }
    _camAfSetup(false);   // OV5640: firmware AF; ostrzenie w camWarmup()

    _camReady = true;
    Serial.printf("[CAM] OK JPEG/%s %s (AEC/AGC/AWB enabled, %lu ms)\n",
                  ov5640 ? "QXGA" : "UXGA", camModelName(_camDetected), millis() - t0);
    return true;
}

// Inicjalizacja kamery w trybie PODGLADU: grayscale QQVGA (160x120), 1 B/px,
// bezposredni dostep do pikseli dla live viewfinder na OLED. Te same piny i
// sensor co camBegin() — zmienia sie tylko format/rozdzielczosc.
// Po podgladzie wywolaj camEnd() PRZED camBegin() (JPEG), bo camBegin ma
// early-return gdy _camReady=true.
inline bool camBeginPreview() {
    if (_camReady) return true;

    if (!_inMcpReady) {
        Serial.println("[CAM] MCP not ready - call inputBegin() first");
        return false;
    }

    _camPowerOn();

    camera_config_t config;
    _camFillCommonConfig(config);
    config.pixel_format = PIXFORMAT_GRAYSCALE;  // 1 bajt/piksel — bezposredni dostep
    config.frame_size   = FRAMESIZE_QQVGA;      // 160x120 = 19200 B w PSRAM
    config.jpeg_quality = 12;                   // ignorowane przy GRAYSCALE, ale pole musi byc ustawione
    config.fb_count     = 1;
    config.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
        Serial.printf("[CAM] preview init failed: 0x%x\n", err);
        _camPowerOff();
        return false;
    }

    _camApplyCommonSensor();
    _camNoteDetected();
    _camAfSetup(true);    // OV5640: ciagly AF — ostry podglad przy kadrowaniu

    _camReady = true;
    Serial.printf("[CAM] OK GRAYSCALE/QQVGA (preview) %s\n", camModelName(_camDetected));
    return true;
}

// Zwolnij kamere (deinit + power off).
inline void camEnd() {
    if (!_camReady) return;
    esp_camera_deinit();
    _camPowerOff();
    // Diagnoza 2026-10-18 (tcpdump na VPS, takze na fw 1.9.7): po uzyciu kamery
    // radio WiFi gubi pakiety w obie strony az do restartu. Harmoniczne XCLK
    // trafiaja w pasmo 2.4 GHz (np. 246 x 10 MHz = 2460 MHz = kanal 10).
    // Na S3 XCLK daje peryferium LCD_CAM (nie LEDC — stare ledc_timer_pause/
    // rst tylko sypaly bledami "LEDC is not initialized"), wiec odpinamy piny
    // kamery (wejscia bez podciagania) — esp_camera_init() i tak ustawi je od nowa.
    const int camPins[] = { CAM_PIN_XCLK, CAM_PIN_PCLK, CAM_PIN_VSYNC, CAM_PIN_HREF,
                            CAM_PIN_D0, CAM_PIN_D1, CAM_PIN_D2, CAM_PIN_D3,
                            CAM_PIN_D4, CAM_PIN_D5, CAM_PIN_D6, CAM_PIN_D7 };
    for (int pin : camPins) {
        gpio_reset_pin((gpio_num_t)pin);
        gpio_set_direction((gpio_num_t)pin, GPIO_MODE_INPUT);
        gpio_set_pull_mode((gpio_num_t)pin, GPIO_FLOATING);
    }
    _camReady = false;
    _camAfReady = false;   // reset sensora przy nastepnym init kasuje firmware AF
    Serial.println("[CAM] deinit");
}

// Warm-up — wyrzuc N klatek. AEC/AGC potrzebuje ~3-5 klatek zeby zbiec
// na docelowa ekspozycje, inaczej pierwsze zdjecie jest przepalone lub czarne.
// 5 klatek przy 15fps UXGA = ~333ms.
// OV5640: po ekspozycji ustaw ostrosc (pojedynczy AF) i wyrzuc jeszcze jedna
// klatke — mogla sie naswietlac, gdy soczewka jeszcze jechala.
// (fw 2.1.2: ostrzenie w VGA i powrot do QXGA dawalo nieostre zdjecia —
// AF musi pracowac w tej samej rozdzielczosci co zdjecie.)
static void _camDiscard(int frames) {
    for (int i = 0; i < frames; i++) {
        camera_fb_t* fb = esp_camera_fb_get();
        if (fb) esp_camera_fb_return(fb);
    }
}

inline void camWarmup(int frames = 5) {
    if (!_camReady) return;
    unsigned long t0 = millis();
    _camDiscard(frames);
    if (_camAfReady) {
        _camAfFocusOnce();
        _camDiscard(1);
    }
    Serial.printf("[CAM] warmup+AF %lu ms\n", millis() - t0);
}

// Zrob zdjecie. Zwraca pointer do JPEG buffer (lub nullptr przy bledzie).
// WAZNE: po uzyciu wywolaj esp_camera_fb_return(fb).
inline camera_fb_t* camCapture() {
    if (!_camReady) return nullptr;
    return esp_camera_fb_get();
}
