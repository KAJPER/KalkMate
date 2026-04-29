// =====================================================================
//  testkeyboard.cpp — driver klawiatury Esperanza T8809-2 (27 klawiszy)
//
//  Klawiatura kalkulatora używa 10 ścieżek FFC podpiętych do MCP23017:
//   GPA0..GPA4  (piny biblioteki  0..4)
//   GPB0..GPB4  (piny biblioteki  8..12)
//
//  Topologia: NIE jest klasycznym 5x5. Każdy klawisz to UNIKALNA PARA
//  z 10 pinów (10*9/2 = 45 możliwych par, klawiatura używa 27 z nich).
//  Klawisze wykorzystują pary GPA↔GPB, GPA↔GPA i GPB↔GPB.
//
//  Mapa zbudowana eksperymentalnie (discovery + ręczne notatki).
//
//  Skanowanie: dla każdego pinu test -> OUTPUT LOW, reszta INPUT_PULLUP,
//  odczyt całego 16-bit GPIO. Sprawdzamy wszystkie 45 par i zamieniamy
//  zwarcia na klawisze logiczne przez KEY_MAP[].
//
//  Output:
//   [PRESS]   "7"
//   [RELEASE] "7"
// =====================================================================

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_MCP23X17.h>

#define I2C_SDA   21
#define I2C_SCL   22
#define MCP_ADDR  0x20

// 10 pinów MCP23017 podłączonych do FFC
static const uint8_t KB_PINS[10]  = { 0, 1, 2, 3, 4, 8, 9, 10, 11, 12 };
static const uint8_t KB_COUNT     = 10;

#define SCAN_INTERVAL_MS  40
#define DEBOUNCE_SCANS    2

// Etykieta logicznego klawisza klawiatury kalkulatora
enum KalkKey : uint8_t {
    KEY_NONE = 0,
    KEY_0, KEY_00, KEY_DOT, KEY_EQ, KEY_PLUS,
    KEY_CCE, KEY_1, KEY_2, KEY_3, KEY_ARROW,
    KEY_4, KEY_5, KEY_6, KEY_MINUS, KEY_PLUSMINUS,
    KEY_7, KEY_8, KEY_9, KEY_MUL, KEY_MC,
    KEY_MR, KEY_MMINUS, KEY_MPLUS, KEY_DIV, KEY_SQRT,
    KEY_PERCENT, KEY_MU,
    KEY_COUNT
};

struct KeyMap {
    uint8_t pinA;       // pin MCP (mniejszy numer)
    uint8_t pinB;       // pin MCP (większy numer)
    KalkKey key;
    const char* label;
};

// Mapa zbudowana z logu discovery (zob. PR opis):
//  GPA0=0  GPA1=1  GPA2=2  GPA3=3  GPA4=4
//  GPB0=8  GPB1=9  GPB2=10 GPB3=11 GPB4=12
static const KeyMap KEY_MAP[] = {
    { 0, 11, KEY_CCE,        "C/CE" },   // GPA0 <-> GPB3
    { 1,  2, KEY_5,          "5"    },   // GPA1 <-> GPA2
    { 1,  3, KEY_4,          "4"    },   // GPA1 <-> GPA3
    { 1,  4, KEY_3,          "3"    },   // GPA1 <-> GPA4
    { 1,  8, KEY_2,          "2"    },   // GPA1 <-> GPB0
    { 1,  9, KEY_1,          "1"    },   // GPA1 <-> GPB1
    { 1, 10, KEY_0,          "0"    },   // GPA1 <-> GPB2
    { 1, 11, KEY_00,         "00"   },   // GPA1 <-> GPB3
    { 1, 12, KEY_DOT,        "."    },   // GPA1 <-> GPB4
    { 2,  3, KEY_MU,         "MU"   },   // GPA2 <-> GPA3
    { 2,  4, KEY_PERCENT,    "%"    },   // GPA2 <-> GPA4
    { 2,  8, KEY_EQ,         "="    },   // GPA2 <-> GPB0
    { 2,  9, KEY_DIV,        "/"    },   // GPA2 <-> GPB1  (÷)
    { 2, 10, KEY_MUL,        "*"    },   // GPA2 <-> GPB2  (×)
    { 2, 11, KEY_MINUS,      "-"    },   // GPA2 <-> GPB3
    { 2, 12, KEY_PLUS,       "+"    },   // GPA2 <-> GPB4
    { 3,  8, KEY_PLUSMINUS,  "+/-"  },   // GPA3 <-> GPB0
    { 3,  9, KEY_SQRT,       "sqrt" },   // GPA3 <-> GPB1  (√)
    { 3, 11, KEY_ARROW,      ">"    },   // GPA3 <-> GPB3  (▶)
    { 4,  8, KEY_MC,         "MC"   },   // GPA4 <-> GPB0
    { 4,  9, KEY_MR,         "MR"   },   // GPA4 <-> GPB1
    { 4, 11, KEY_MMINUS,     "M-"   },   // GPA4 <-> GPB3
    { 4, 12, KEY_MPLUS,      "M+"   },   // GPA4 <-> GPB4
    { 8,  9, KEY_9,          "9"    },   // GPB0 <-> GPB1
    { 8, 10, KEY_8,          "8"    },   // GPB0 <-> GPB2
    { 8, 11, KEY_7,          "7"    },   // GPB0 <-> GPB3
    { 8, 12, KEY_6,          "6"    },   // GPB0 <-> GPB4
};
static const uint8_t KEY_MAP_LEN = sizeof(KEY_MAP) / sizeof(KEY_MAP[0]);

static Adafruit_MCP23X17 mcp;

// Stan dla każdej z 45 par; indeks = i*10 + j (i<j, indeksy KB_PINS)
static bool    statePair[100];
static bool    rawPrev[100];
static uint8_t streak[100];

static const char* pinLabel(uint8_t kbIdx) {
    static const char* names[10] = {
        "GPA0","GPA1","GPA2","GPA3","GPA4",
        "GPB0","GPB1","GPB2","GPB3","GPB4"
    };
    return names[kbIdx];
}

// Znajdź klawisz dla pary (pinA, pinB) — pinA < pinB
static const KeyMap* findKey(uint8_t pinA, uint8_t pinB) {
    for (uint8_t i = 0; i < KEY_MAP_LEN; i++) {
        if (KEY_MAP[i].pinA == pinA && KEY_MAP[i].pinB == pinB) {
            return &KEY_MAP[i];
        }
    }
    return nullptr;
}

static void allPinsIdle() {
    for (uint8_t i = 0; i < KB_COUNT; i++) {
        mcp.pinMode(KB_PINS[i], INPUT_PULLUP);
    }
}

static void scanAllPairs(bool pairPressed[100]) {
    for (uint16_t k = 0; k < 100; k++) pairPressed[k] = false;

    for (uint8_t i = 0; i < KB_COUNT; i++) {
        if (i == 0) {
            allPinsIdle();
        } else {
            mcp.pinMode(KB_PINS[i - 1], INPUT_PULLUP);
        }
        mcp.pinMode(KB_PINS[i], OUTPUT);
        mcp.digitalWrite(KB_PINS[i], LOW);
        delayMicroseconds(80);

        uint16_t gpio = mcp.readGPIOAB();

        for (uint8_t j = i + 1; j < KB_COUNT; j++) {
            uint8_t pinJ = KB_PINS[j];
            bool low = ((gpio >> pinJ) & 0x01) == 0;
            if (low) {
                pairPressed[i * 10 + j] = true;
            }
        }
    }
    mcp.pinMode(KB_PINS[KB_COUNT - 1], INPUT_PULLUP);
}

static void printKeyMap() {
    Serial.println();
    Serial.println("=== Mapa klawiatury Esperanza T8809-2 ===");
    Serial.printf("%-10s %-10s  %s\n", "PIN A", "PIN B", "KLAWISZ");
    Serial.println("------------------------------------------");
    for (uint8_t i = 0; i < KEY_MAP_LEN; i++) {
        const KeyMap& k = KEY_MAP[i];
        // pinA, pinB to numery pinów MCP — znajdź ich indeksy w KB_PINS
        uint8_t idxA = 0, idxB = 0;
        for (uint8_t n = 0; n < KB_COUNT; n++) {
            if (KB_PINS[n] == k.pinA) idxA = n;
            if (KB_PINS[n] == k.pinB) idxB = n;
        }
        Serial.printf("%-10s %-10s  \"%s\"\n",
                      pinLabel(idxA), pinLabel(idxB), k.label);
    }
    Serial.printf("Razem: %u klawiszy\n", KEY_MAP_LEN);
    Serial.println();
}

void setup() {
    Serial.begin(115200);
    delay(300);
    Serial.println("\n=== TEST KEYBOARD — driver z mapą logicznych klawiszy ===");

    Wire.begin(I2C_SDA, I2C_SCL);
    Wire.setClock(400000);

    if (!mcp.begin_I2C(MCP_ADDR)) {
        Serial.println("[FATAL] MCP23017 nie odpowiada na 0x20!");
        while (true) { delay(1000); }
    }
    Serial.println("[OK] MCP23017 znaleziony");

    allPinsIdle();

    for (uint16_t k = 0; k < 100; k++) {
        statePair[k] = false;
        rawPrev[k] = false;
        streak[k] = 0;
    }

    printKeyMap();
    Serial.println("Naciskaj klawisze. Format: [PRESS] \"X\" / [RELEASE] \"X\"");
    Serial.println();
}

void loop() {
    static uint32_t lastScan = 0;
    uint32_t now = millis();
    if (now - lastScan < SCAN_INTERVAL_MS) return;
    lastScan = now;

    bool pairNow[100];
    scanAllPairs(pairNow);

    int pressedCount = 0;

    for (uint8_t i = 0; i < KB_COUNT; i++) {
        for (uint8_t j = i + 1; j < KB_COUNT; j++) {
            uint16_t idx = i * 10 + j;
            bool raw = pairNow[idx];

            if (raw == rawPrev[idx]) {
                if (streak[idx] < 255) streak[idx]++;
            } else {
                streak[idx] = 1;
            }
            rawPrev[idx] = raw;

            if (raw) pressedCount++;

            if (streak[idx] >= DEBOUNCE_SCANS && statePair[idx] != raw) {
                statePair[idx] = raw;
                const KeyMap* km = findKey(KB_PINS[i], KB_PINS[j]);
                if (km) {
                    Serial.printf("[%s] \"%s\"\n",
                                  raw ? "PRESS  " : "RELEASE", km->label);
                } else {
                    Serial.printf("[%s] %s <-> %s   (UNMAPPED!)\n",
                                  raw ? "PRESS  " : "RELEASE",
                                  pinLabel(i), pinLabel(j));
                }
            }
        }
    }

    // ostrzeżenie o ghost-key dla matryc bez diod
    static bool warned = false;
    if (pressedCount >= 3 && !warned) {
        Serial.printf("[WARN] %d klawiszy jednocześnie — możliwy ghost-key\n",
                      pressedCount);
        warned = true;
    }
    if (pressedCount < 2) warned = false;
}
