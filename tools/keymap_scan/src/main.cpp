// =====================================================================
//  keymap_scan — standalone narzedzie do mapowania klawiatury KalkMate.
//
//  Co robi:
//    1. Inicjalizuje MCP23017 @ 0x20 (I2C SDA=21, SCL=22)
//    2. Skanuje matryce 10 pinow (GPA0..GPA4 + GPB0..GPB4) parami
//    3. Pyta przez Serial: "Nacisnij: 7"
//    4. Czeka az nacisnieta zostanie jedna stabilna para pinow
//    5. Loguje wykryta pare i przechodzi dalej
//    6. Po wszystkich 27 klawiszach drukuje tablice _IN_KALK_MAP do wklejenia
//
//  Uzycie:
//    cd tools/keymap_scan
//    pio run -t upload
//    pio device monitor
//
//  W Serial Monitor postepuj wg promptow. Po zakonczeniu wklej output i wyslij.
// =====================================================================

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_MCP23X17.h>

// === I2C / MCP23017 ===
#define I2C_SDA   21
#define I2C_SCL   22
#define MCP_ADDR  0x20

// 10 pinow MCP23017 podpiętych do FFC klawiatury
static const uint8_t KB_PINS[10] = { 0, 1, 2, 3, 4, 8, 9, 10, 11, 12 };

// Etykiety pinow MCP -> nazwa portowa
static const char* PIN_NAMES[10] = {
    "GPA0", "GPA1", "GPA2", "GPA3", "GPA4",
    "GPB0", "GPB1", "GPB2", "GPB3", "GPB4"
};

// === Lista klawiszy KalkKey (jak w input.h) ===
struct KalkKeyDef {
    const char* enumName;   // identyfikator C++ (do wyplucia tabeli)
    const char* label;      // co pokazac uzytkownikowi
};

// Kolejnosc fizyczna (top-to-bottom, left-to-right)
static const KalkKeyDef KEYS[] = {
    { "KEY_SQRT",      "sqrt"  },
    { "KEY_PERCENT",   "%"     },
    { "KEY_MU",        "MU"    },
    { "KEY_MC",        "MC"    },
    { "KEY_MR",        "MR"    },
    { "KEY_MMINUS",    "M-"    },
    { "KEY_MPLUS",     "M+"    },
    { "KEY_DIV",       "/"     },
    { "KEY_PLUSMINUS", "+/-"   },
    { "KEY_7",         "7"     },
    { "KEY_8",         "8"     },
    { "KEY_9",         "9"     },
    { "KEY_MUL",       "*"     },
    { "KEY_ARROW",     ">"     },
    { "KEY_4",         "4"     },
    { "KEY_5",         "5"     },
    { "KEY_6",         "6"     },
    { "KEY_MINUS",     "-"     },
    { "KEY_CCE",       "C/CE"  },
    { "KEY_1",         "1"     },
    { "KEY_2",         "2"     },
    { "KEY_3",         "3"     },
    { "KEY_PLUS",      "+"     },
    { "KEY_0",         "0"     },
    { "KEY_00",        "00"    },
    { "KEY_DOT",       "."     },
    { "KEY_EQ",        "="     },
};
static const int KEYS_N = sizeof(KEYS) / sizeof(KEYS[0]);

// === Globals ===
Adafruit_MCP23X17 mcp;
bool mcpReady = false;

// Wynik mapowania: para pinow MCP dla kazdego z KEYS_N klawiszy
struct PairResult {
    uint8_t pinA;     // mniejszy
    uint8_t pinB;     // wiekszy
    bool    skipped;
};
static PairResult results[KEYS_N];

// ---------------------------------------------------------------------
// Pelny pair-scan — wypelnia tablice 100 boolow (idx = i*10+j, i<j)
// ---------------------------------------------------------------------
void rawScan(bool pairPressed[100]) {
    for (int k = 0; k < 100; k++) pairPressed[k] = false;
    if (!mcpReady) return;

    for (uint8_t i = 0; i < 10; i++) {
        // Wszystkie INPUT_PULLUP, jeden OUTPUT LOW
        if (i == 0) {
            for (uint8_t k = 0; k < 10; k++) {
                mcp.pinMode(KB_PINS[k], INPUT_PULLUP);
            }
        } else {
            mcp.pinMode(KB_PINS[i - 1], INPUT_PULLUP);
        }
        mcp.pinMode(KB_PINS[i], OUTPUT);
        mcp.digitalWrite(KB_PINS[i], LOW);
        delayMicroseconds(80);

        uint16_t gpio = mcp.readGPIOAB();

        for (uint8_t j = i + 1; j < 10; j++) {
            uint8_t pinJ = KB_PINS[j];
            if (((gpio >> pinJ) & 0x01) == 0) {
                pairPressed[i * 10 + j] = true;
            }
        }
    }
    // Przywroc wszystkie INPUT_PULLUP
    mcp.pinMode(KB_PINS[9], INPUT_PULLUP);
}

// ---------------------------------------------------------------------
// Czeka na puszczenie wszystkich klawiszy
// ---------------------------------------------------------------------
void waitFullRelease() {
    while (true) {
        bool pairs[100];
        rawScan(pairs);
        bool any = false;
        for (int i = 0; i < 100; i++) if (pairs[i]) { any = true; break; }
        if (!any) return;
        delay(20);
    }
}

// ---------------------------------------------------------------------
// Czeka na stabilny single-pair press + release. Zwraca true gdy detected,
// false gdy user wpisal komende w Serial:
//   's' = skip current
//   'r' = restart whole wizard
//   'q' = quit and dump partial
// ---------------------------------------------------------------------
enum WaitResult { WR_DETECTED, WR_SKIP, WR_RESTART, WR_QUIT };

WaitResult waitForPress(uint8_t& outI, uint8_t& outJ) {
    bool pairs[100];
    int curI = -1, curJ = -1;
    bool pressing = false;

    while (true) {
        // Sprawdz Serial
        if (Serial.available()) {
            char c = Serial.read();
            // Wypij reszte linii
            while (Serial.available() && (Serial.peek() == '\r' || Serial.peek() == '\n')) {
                Serial.read();
            }
            if (c == 's' || c == 'S') return WR_SKIP;
            if (c == 'r' || c == 'R') return WR_RESTART;
            if (c == 'q' || c == 'Q') return WR_QUIT;
        }

        rawScan(pairs);

        // Zlicz aktywne pary
        int actI = -1, actJ = -1, actCount = 0;
        for (uint8_t i = 0; i < 10; i++) {
            for (uint8_t j = i + 1; j < 10; j++) {
                if (pairs[i * 10 + j]) {
                    actCount++;
                    if (actI == -1) { actI = i; actJ = j; }
                }
            }
        }

        if (actCount == 1) {
            if (!pressing || curI != actI || curJ != actJ) {
                // Nowy press — pokaz live feedback
                pressing = true;
                curI = actI;
                curJ = actJ;
                Serial.printf("  [LIVE] %s <-> %s (czekam na puszczenie...)\n",
                              PIN_NAMES[actI], PIN_NAMES[actJ]);
            }
        } else if (actCount == 0 && pressing) {
            // Released — zarejestruj
            outI = curI;
            outJ = curJ;
            return WR_DETECTED;
        } else if (actCount > 1 && !pressing) {
            // Multiple pairs — ignoruj az do single
            // (drukuj ostrzezenie tylko raz)
        }

        delay(30);
    }
}

// ---------------------------------------------------------------------
// Wyswietl wynik pojedynczego klawisza
// ---------------------------------------------------------------------
void printKeyResult(int idx) {
    const PairResult& r = results[idx];
    if (r.skipped) {
        Serial.printf("  %s = SKIPPED\n", KEYS[idx].label);
    } else {
        Serial.printf("  %s = %s <-> %s   (KB_PINS idx %u, %u  =  pin %u, %u)\n",
                      KEYS[idx].label,
                      PIN_NAMES[r.pinA], PIN_NAMES[r.pinB],
                      r.pinA, r.pinB,
                      KB_PINS[r.pinA], KB_PINS[r.pinB]);
    }
}

// ---------------------------------------------------------------------
// Wydrukuj koncowa tabele _IN_KALK_MAP do wklejenia w input.h
// ---------------------------------------------------------------------
void printFinalTable() {
    Serial.println();
    Serial.println("============================================================");
    Serial.println(" GOTOWE! Skopiuj tabele ponizej i wyslij ja chatowi:");
    Serial.println("============================================================");
    Serial.println();
    Serial.println("static const _InKalkMap _IN_KALK_MAP[] = {");

    // Zbierz, posortuj wg pinA, pinB (jak w oryginale w input.h)
    // Najpierw wypisz nieskippowane.
    int order[KEYS_N];
    int orderN = 0;
    for (int i = 0; i < KEYS_N; i++) {
        if (!results[i].skipped) order[orderN++] = i;
    }
    // Bubble-sort wg (pinA, pinB)
    for (int i = 0; i < orderN - 1; i++) {
        for (int j = 0; j < orderN - 1 - i; j++) {
            const PairResult& a = results[order[j]];
            const PairResult& b = results[order[j + 1]];
            uint16_t ka = ((uint16_t)KB_PINS[a.pinA] << 8) | KB_PINS[a.pinB];
            uint16_t kb = ((uint16_t)KB_PINS[b.pinA] << 8) | KB_PINS[b.pinB];
            if (ka > kb) {
                int t = order[j]; order[j] = order[j+1]; order[j+1] = t;
            }
        }
    }

    for (int i = 0; i < orderN; i++) {
        int idx = order[i];
        const PairResult& r = results[idx];
        Serial.printf("    { %2u, %2u, %-14s \"%s\" },\n",
                      KB_PINS[r.pinA], KB_PINS[r.pinB],
                      (String(KEYS[idx].enumName) + ",").c_str(),
                      KEYS[idx].label);
    }
    Serial.println("};");
    Serial.println();

    if (orderN < KEYS_N) {
        Serial.println("// SKIPPED (nie wykryto):");
        for (int i = 0; i < KEYS_N; i++) {
            if (results[i].skipped) {
                Serial.printf("//   %s (%s)\n",
                              KEYS[i].enumName, KEYS[i].label);
            }
        }
        Serial.println();
    }

    // Sanity check: szukaj duplikatow par
    Serial.println("// Sanity check (duplikaty par):");
    bool anyDup = false;
    for (int i = 0; i < KEYS_N; i++) {
        if (results[i].skipped) continue;
        for (int j = i + 1; j < KEYS_N; j++) {
            if (results[j].skipped) continue;
            if (results[i].pinA == results[j].pinA &&
                results[i].pinB == results[j].pinB) {
                Serial.printf("//   DUPLICATE: %s i %s -> %s<->%s\n",
                              KEYS[i].label, KEYS[j].label,
                              PIN_NAMES[results[i].pinA],
                              PIN_NAMES[results[i].pinB]);
                anyDup = true;
            }
        }
    }
    if (!anyDup) Serial.println("//   OK - brak duplikatow.");
    Serial.println("============================================================");
}

// ---------------------------------------------------------------------
// Glowny przebieg kreatora (jeden cykl)
// ---------------------------------------------------------------------
void runWizard() {
restart:
    // Reset wynikow
    for (int i = 0; i < KEYS_N; i++) {
        results[i].pinA = 0xFF;
        results[i].pinB = 0xFF;
        results[i].skipped = false;
    }

    Serial.println();
    Serial.println("============================================================");
    Serial.println(" KalkMate — kreator mapowania klawiatury (Serial)");
    Serial.println("============================================================");
    Serial.println(" Komendy w Serial (wpisz literke + Enter):");
    Serial.println("   s = pomin biezacy klawisz");
    Serial.println("   r = restart calego kreatora");
    Serial.println("   q = przerwij i wydrukuj czesciowy wynik");
    Serial.println();
    Serial.printf(" Lacznie %d klawiszy. Postepuj wg promptow.\n", KEYS_N);
    Serial.println("============================================================");

    waitFullRelease();
    delay(500);

    for (int idx = 0; idx < KEYS_N; idx++) {
        Serial.println();
        Serial.printf("[%d/%d] Nacisnij klawisz: %s\n",
                      idx + 1, KEYS_N, KEYS[idx].label);

        waitFullRelease();

        uint8_t i, j;
        WaitResult wr = waitForPress(i, j);

        if (wr == WR_SKIP) {
            results[idx].skipped = true;
            Serial.printf("  -> SKIPPED %s\n", KEYS[idx].label);
            continue;
        }
        if (wr == WR_RESTART) {
            Serial.println("  -> RESTART");
            goto restart;
        }
        if (wr == WR_QUIT) {
            // Mark resztę jako skipped i wyjdz
            for (int k = idx; k < KEYS_N; k++) results[k].skipped = true;
            Serial.println("  -> QUIT");
            break;
        }

        results[idx].pinA = i;
        results[idx].pinB = j;
        results[idx].skipped = false;
        Serial.printf("  -> %s = %s<->%s\n",
                      KEYS[idx].label, PIN_NAMES[i], PIN_NAMES[j]);
    }

    printFinalTable();

    Serial.println();
    Serial.println("Aby uruchomic ponownie, wpisz 'r' + Enter.");
    while (true) {
        if (Serial.available()) {
            char c = Serial.read();
            while (Serial.available() && (Serial.peek() == '\r' || Serial.peek() == '\n')) {
                Serial.read();
            }
            if (c == 'r' || c == 'R') {
                goto restart;
            }
        }
        delay(50);
    }
}

void setup() {
    Serial.begin(115200);
    delay(800);
    Serial.println();
    Serial.println(">> keymap_scan: starting");

    Wire.begin(I2C_SDA, I2C_SCL);
    Wire.setClock(400000);

    if (!mcp.begin_I2C(MCP_ADDR)) {
        Serial.println("BLAD: nie znaleziono MCP23017 @ 0x20!");
        Serial.println("Sprawdz I2C (SDA=21, SCL=22) i zasilanie 3.3V chipa.");
        while (true) delay(1000);
    }
    mcpReady = true;
    Serial.println("MCP23017 OK.");

    // Wszystkie KB piny -> INPUT_PULLUP
    for (uint8_t i = 0; i < 10; i++) {
        mcp.pinMode(KB_PINS[i], INPUT_PULLUP);
    }

    runWizard();
}

void loop() {
    // runWizard nigdy nie wraca (ma wlasna petle nieskonczona)
}
