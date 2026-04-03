#pragma once

// === WERSJA FIRMWARE ===
#define FW_VERSION  1

// === OLED SSD1322 (HW VSPI) ===
#define OLED_CLK   18
#define OLED_MOSI  23
#define OLED_CS    15
#define OLED_DC     2
#define OLED_RST    4

// === Kamera OV2640 ===
#define CAM_D0      5
#define CAM_D1     14
#define CAM_D2     19
#define CAM_D3     13
#define CAM_D4     34   // input-only
#define CAM_D5     35   // input-only
#define CAM_D6     32
#define CAM_D7     33
#define CAM_PCLK   12
#define CAM_XCLK   25
#define CAM_VSYNC  27
#define CAM_HREF   26
#define CAM_SDA    21
#define CAM_SCL    22
#define CAM_PWDN   -1   // przez MCP23017 GPA5
#define CAM_RESET  -1   // przez MCP23017 GPA6

// === I2C ===
#define I2C_SDA    21
#define I2C_SCL    22

// === MCP23017 ===
#define MCP_ADDR   0x20   // A0=A1=A2=GND
// Numery pinów w bibliotece Adafruit MCP23X17: GPA0=0..GPA7=7, GPB0=8..GPB7=15
#define MCP_GPA0   0
#define MCP_GPA1   1
#define MCP_GPA2   2
#define MCP_GPA3   3
#define MCP_GPA4   4
#define MCP_GPA5   5   // kamera PWDN (HIGH = power down)
#define MCP_GPA6   6   // kamera RESET# (LOW = reset)
#define MCP_GPA7   7   // Boost MT3608 EN (HIGH = 12V ON)
#define MCP_GPB0   8
#define MCP_GPB1   9
#define MCP_GPB2   10
#define MCP_GPB3   11
#define MCP_GPB4   12
#define MCP_GPB5   13  // LED status
#define MCP_GPB6   14  // Buzzer (N-MOSFET 2N7002)
#define MCP_GPB7   15  // wolny

// === OV2640 SCCB adres ===
#define OV2640_ADDR 0x30

// === WiFi (uzupełnij przed użyciem) ===
#define WIFI_SSID   "TWOJE_SSID"
#define WIFI_PASS   "TWOJE_HASLO"

// === Backend API ===
#define API_BASE_URL    "http://TWOJ_VPS_IP"
#define API_SOLVE_URL   API_BASE_URL "/solve"
#define API_OTA_URL     API_BASE_URL "/firmware/latest"

// === Kamera — ustawienia ===
#define CAM_XCLK_FREQ   10000000   // 10MHz (stabilniejsze z WiFi)
#define CAM_JPEG_QUALITY 12
