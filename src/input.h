#pragma once
// =====================================================================
//  input.h — wirtualne przyciski UI na bazie matrycy 27 klawiszy
//
//  Klawiatura kalkulatora Esperanza T8809-2 (10 ścieżek FFC -> MCP23017)
//  ma 27 unikalnych klawiszy w nietrywialnej topologii (pary GPA↔GPB,
//  GPA↔GPA i GPB↔GPB). Aby istniejący UI (info_screen.h, wifi_settings.h
//  itd.) działał bez przepisywania, ten moduł:
//
//   1. Skanuje matrycę pełnym pair-scanem (45 par).
//   2. Mapuje fizyczne klawisze kalkulatora na wirtualne BTN_UP/DOWN/
//      LEFT/RIGHT/OK/BACK.
//   3. Udostępnia inputBtn(int btn) — drop-in replacement dla
//      digitalRead(BTN_xx) (zwraca LOW gdy wciśnięty, HIGH inaczej).
//
//  Mapowanie klawisz fizyczny -> BTN_xx (działa równolegle):
//     +     | 8     -> BTN_UP
//     -     | 2     -> BTN_DOWN
//     +/-   | 4     -> BTN_LEFT
//     ▶     | 6     -> BTN_RIGHT
//     =     | 5     -> BTN_OK
//     C/CE          -> BTN_BACK
// =====================================================================

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_MCP23X17.h>

// === Wirtualne ID przycisków UI (poza zakresem GPIO ESP32) ===
#define BTN_UP     200
#define BTN_DOWN   201
#define BTN_LEFT   202
#define BTN_RIGHT  203
#define BTN_OK     204
#define BTN_BACK   205

// === Pełna lista 27 klawiszy fizycznych kalkulatora ===
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

// Mapowanie para pinów MCP -> KalkKey (z testkeyboard.cpp discovery)
struct _InKalkMap {
    uint8_t pinA;     // mniejszy
    uint8_t pinB;     // większy
    KalkKey key;
    const char* label;
};

static const _InKalkMap _IN_KALK_MAP[] = {
    { 0, 11, KEY_CCE,        "C/CE" },
    { 1,  2, KEY_5,          "5"    },
    { 1,  3, KEY_4,          "4"    },
    { 1,  4, KEY_3,          "3"    },
    { 1,  8, KEY_2,          "2"    },
    { 1,  9, KEY_1,          "1"    },
    { 1, 10, KEY_0,          "0"    },
    { 1, 11, KEY_00,         "00"   },
    { 1, 12, KEY_DOT,        "."    },
    { 2,  3, KEY_MU,         "MU"   },
    { 2,  4, KEY_PERCENT,    "%"    },
    { 2,  8, KEY_EQ,         "="    },
    { 2,  9, KEY_DIV,        "/"    },
    { 2, 10, KEY_MUL,        "*"    },
    { 2, 11, KEY_MINUS,      "-"    },
    { 2, 12, KEY_PLUS,       "+"    },
    { 3,  8, KEY_PLUSMINUS,  "+/-"  },
    { 3,  9, KEY_SQRT,       "sqrt" },
    { 3, 11, KEY_ARROW,      ">"    },
    { 4,  8, KEY_MC,         "MC"   },
    { 4,  9, KEY_MR,         "MR"   },
    { 4, 11, KEY_MMINUS,     "M-"   },
    { 4, 12, KEY_MPLUS,      "M+"   },
    { 8,  9, KEY_9,          "9"    },
    { 8, 10, KEY_8,          "8"    },
    { 8, 11, KEY_7,          "7"    },
    { 8, 12, KEY_6,          "6"    },
};
static const uint8_t _IN_KALK_MAP_LEN =
    sizeof(_IN_KALK_MAP) / sizeof(_IN_KALK_MAP[0]);

// Stan klawiszy fizycznych — ostatni stabilny + edge consume
static bool _kalkKeyDown[KEY_COUNT];        // czy aktualnie wciśnięty
static bool _kalkKeyConsumed[KEY_COUNT];    // czy edge został odczytany

// === I2C / MCP23017 ===
#ifndef I2C_SDA
#define I2C_SDA   21
#endif
#ifndef I2C_SCL
#define I2C_SCL   22
#endif
#ifndef MCP_ADDR
#define MCP_ADDR  0x20
#endif

// 10 pinów MCP23017 podpiętych do FFC klawiatury
static const uint8_t _IN_KB_PINS[10] = { 0, 1, 2, 3, 4, 8, 9, 10, 11, 12 };

#define _IN_SCAN_INTERVAL_MS  30
#define _IN_DEBOUNCE_SCANS    2

// Stan wirtualnych przycisków (true = wciśnięty)
static bool _virtBtn[6] = { false, false, false, false, false, false };

// MCP23017 — instancja prywatna modułu
static Adafruit_MCP23X17 _inMcp;
static bool              _inMcpReady = false;

// Stan każdej z 45 par; indeks = i*10 + j (i<j)
static bool    _inStatePair[100];
static bool    _inRawPrev[100];
static uint8_t _inStreak[100];

static uint32_t _inLastScan = 0;

// ---------------------------------------------------------------------
//  Mapowanie pary pinów MCP -> wirtualny BTN
//  Z wcześniejszego discovery klawiatury (zob. testkeyboard.cpp).
// ---------------------------------------------------------------------
struct _InKeyMap {
    uint8_t pinA;       // mniejszy (numer pinu MCP)
    uint8_t pinB;       // większy
    int8_t  virtBtn;    // 0=UP, 1=DOWN, 2=LEFT, 3=RIGHT, 4=OK, 5=BACK, -1=ignoruj
};

static const _InKeyMap _IN_KEY_MAP[] = {
    // klawisze nawigacyjne (operatory)
    { 2, 12, 0 },   // GPA2<->GPB4 = "+"     -> BTN_UP
    { 2, 11, 1 },   // GPA2<->GPB3 = "-"     -> BTN_DOWN
    { 3,  8, 2 },   // GPA3<->GPB0 = "+/-"   -> BTN_LEFT
    { 3, 11, 3 },   // GPA3<->GPB3 = "▶"     -> BTN_RIGHT
    { 2,  8, 4 },   // GPA2<->GPB0 = "="     -> BTN_OK
    { 0, 11, 5 },   // GPA0<->GPB3 = "C/CE"  -> BTN_BACK

    // numpad jako alternatywna nawigacja
    { 8, 10, 0 },   // GPB0<->GPB2 = "8"     -> BTN_UP
    { 1,  8, 1 },   // GPA1<->GPB0 = "2"     -> BTN_DOWN
    { 1,  3, 2 },   // GPA1<->GPA3 = "4"     -> BTN_LEFT
    { 8, 12, 3 },   // GPB0<->GPB4 = "6"     -> BTN_RIGHT
    { 1,  2, 4 },   // GPA1<->GPA2 = "5"     -> BTN_OK
};
static const uint8_t _IN_KEY_MAP_LEN =
    sizeof(_IN_KEY_MAP) / sizeof(_IN_KEY_MAP[0]);

// ---------------------------------------------------------------------
//  Init: I2C + MCP23017 + matryca w stan idle
// ---------------------------------------------------------------------
inline bool inputBegin() {
    Wire.begin(I2C_SDA, I2C_SCL);
    Wire.setClock(400000);

    if (!_inMcp.begin_I2C(MCP_ADDR)) {
        _inMcpReady = false;
        return false;
    }
    _inMcpReady = true;

    // Wszystkie KB piny -> INPUT_PULLUP w idle (skanowanie zmienia jeden
    // pin na OUTPUT LOW, potem przywraca)
    for (uint8_t i = 0; i < 10; i++) {
        _inMcp.pinMode(_IN_KB_PINS[i], INPUT_PULLUP);
    }

    for (uint16_t k = 0; k < 100; k++) {
        _inStatePair[k] = false;
        _inRawPrev[k] = false;
        _inStreak[k] = 0;
    }
    for (uint8_t i = 0; i < 6; i++) _virtBtn[i] = false;

    return true;
}

// Surowy skan matrycy: dla każdego z 10 pinów -> OUTPUT LOW, reszta
// INPUT_PULLUP, czyta cały 16-bit GPIO.
inline void _inRawScan(bool pairPressed[100]) {
    for (uint16_t k = 0; k < 100; k++) pairPressed[k] = false;
    if (!_inMcpReady) return;

    for (uint8_t i = 0; i < 10; i++) {
        if (i == 0) {
            for (uint8_t k = 0; k < 10; k++) {
                _inMcp.pinMode(_IN_KB_PINS[k], INPUT_PULLUP);
            }
        } else {
            _inMcp.pinMode(_IN_KB_PINS[i - 1], INPUT_PULLUP);
        }
        _inMcp.pinMode(_IN_KB_PINS[i], OUTPUT);
        _inMcp.digitalWrite(_IN_KB_PINS[i], LOW);
        delayMicroseconds(80);

        uint16_t gpio = _inMcp.readGPIOAB();

        for (uint8_t j = i + 1; j < 10; j++) {
            uint8_t pinJ = _IN_KB_PINS[j];
            if (((gpio >> pinJ) & 0x01) == 0) {
                pairPressed[i * 10 + j] = true;
            }
        }
    }
    _inMcp.pinMode(_IN_KB_PINS[9], INPUT_PULLUP);
}

// Helper: indeks KB_PINS dla numeru pinu MCP (0,1,2,3,4,8,9,10,11,12 -> 0..9)
inline uint8_t _inPinIdx(uint8_t mcpPin) {
    for (uint8_t n = 0; n < 10; n++) {
        if (_IN_KB_PINS[n] == mcpPin) return n;
    }
    return 0;
}

// Aktualizuj stany wirtualnych BTN_xx + stany 27 klawiszy fizycznych
inline void _inUpdateVirtBtns() {
    bool any[6] = { false, false, false, false, false, false };

    for (uint8_t k = 0; k < _IN_KEY_MAP_LEN; k++) {
        const _InKeyMap& m = _IN_KEY_MAP[k];
        uint16_t idx = _inPinIdx(m.pinA) * 10 + _inPinIdx(m.pinB);
        if (_inStatePair[idx] && m.virtBtn >= 0 && m.virtBtn < 6) {
            any[m.virtBtn] = true;
        }
    }
    for (uint8_t i = 0; i < 6; i++) _virtBtn[i] = any[i];

    // Stan klawiszy fizycznych — wszystkie 27
    bool keyNow[KEY_COUNT] = { false };
    for (uint8_t k = 0; k < _IN_KALK_MAP_LEN; k++) {
        const _InKalkMap& m = _IN_KALK_MAP[k];
        uint16_t idx = _inPinIdx(m.pinA) * 10 + _inPinIdx(m.pinB);
        if (_inStatePair[idx]) keyNow[m.key] = true;
    }
    // Reset consumer flag gdy klawisz puszczony
    for (uint8_t i = 0; i < KEY_COUNT; i++) {
        if (!keyNow[i]) _kalkKeyConsumed[i] = false;
        _kalkKeyDown[i] = keyNow[i];
    }
}

// Pełny skan + debounce. Wywoływać często z loop() (max raz na 30 ms).
inline void inputScan() {
    if (!_inMcpReady) return;
    uint32_t now = millis();
    if (now - _inLastScan < _IN_SCAN_INTERVAL_MS) return;
    _inLastScan = now;

    bool raw[100];
    _inRawScan(raw);

    for (uint8_t i = 0; i < 10; i++) {
        for (uint8_t j = i + 1; j < 10; j++) {
            uint16_t idx = i * 10 + j;
            if (raw[idx] == _inRawPrev[idx]) {
                if (_inStreak[idx] < 255) _inStreak[idx]++;
            } else {
                _inStreak[idx] = 1;
            }
            _inRawPrev[idx] = raw[idx];
            if (_inStreak[idx] >= _IN_DEBOUNCE_SCANS) {
                _inStatePair[idx] = raw[idx];
            }
        }
    }
    _inUpdateVirtBtns();
}

// ---------------------------------------------------------------------
//  Drop-in replacement dla digitalRead(BTN_xx)
//  Auto-scan przy każdym wywołaniu (inputScan ma własny throttle 30ms),
//  dzięki czemu UI files w pętli `while (inputBtn(...) == LOW)` działają
//  bez konieczności ręcznego inputScan().
// ---------------------------------------------------------------------
inline int inputBtn(int pin) {
    inputScan();   // auto-update stanu wirtualnych BTN_xx (no-op gdy <30ms)
    if (pin >= 200 && pin < 206) {
        return _virtBtn[pin - 200] ? LOW : HIGH;
    }
    return digitalRead(pin);   // dla "prawdziwych" GPIO (legacy)
}


// Czeka aż wszystkie wirtualne BTN zostaną puszczone — zastępuje typowe
// `while (digitalRead(BTN_xx) == LOW) delay(...);` z plików UI.
inline void inputWaitRelease() {
    while (true) {
        inputScan();
        bool any = false;
        for (uint8_t i = 0; i < 6; i++) {
            if (_virtBtn[i]) { any = true; break; }
        }
        if (!any) break;
        delay(5);
    }
}

// ---------------------------------------------------------------------
//  API klawiszy fizycznych (KalkKey) — używane przez kalkulator i panic
// ---------------------------------------------------------------------

// Zwraca true raz na każde naciśnięcie (edge detect z consume).
// Po naciśnięciu klawisz musi zostać puszczony zanim kolejny edge zadziała.
inline bool inputKeyConsume(KalkKey k) {
    inputScan();
    if (k == KEY_NONE || k >= KEY_COUNT) return false;
    if (_kalkKeyDown[k] && !_kalkKeyConsumed[k]) {
        _kalkKeyConsumed[k] = true;
        return true;
    }
    return false;
}

// Czy klawisz jest aktualnie wciśnięty (level, nie edge).
inline bool inputKeyDown(KalkKey k) {
    inputScan();
    if (k == KEY_NONE || k >= KEY_COUNT) return false;
    return _kalkKeyDown[k];
}

// Zwraca pierwszy klawisz który dał edge (consume), KEY_NONE gdy brak.
// Użyteczne dla "naciśnij dowolny klawisz" / wybór panic key.
inline KalkKey inputAnyKeyConsume() {
    inputScan();
    for (uint8_t i = 1; i < KEY_COUNT; i++) {
        if (_kalkKeyDown[i] && !_kalkKeyConsumed[i]) {
            _kalkKeyConsumed[i] = true;
            return (KalkKey)i;
        }
    }
    return KEY_NONE;
}

// Etykieta tekstowa klawisza
inline const char* kalkKeyLabel(KalkKey k) {
    static const char* names[KEY_COUNT] = {
        "?", "0", "00", ".", "=", "+",
        "C/CE", "1", "2", "3", ">",
        "4", "5", "6", "-", "+/-",
        "7", "8", "9", "*", "MC",
        "MR", "M-", "M+", "/", "sqrt",
        "%", "MU"
    };
    if (k >= KEY_COUNT) return "?";
    return names[k];
}
