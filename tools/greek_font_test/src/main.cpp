// ============================================================================
// greek_font_test — samodzielne narzedzie bring-up do WIZUALNEJ oceny na
// prawdziwym OLED, ktora czcionka grecka nadaje sie do integracji z
// glownym firmware KalkMate.
//
// KONTEKST: font uzywany dzis w solve_screen.h (u8g2_font_6x12_te) NIE MA
// zadnych greckich liter — zweryfikowane dekoderem danych fontu (zero
// glifow alpha..omega). Odpowiedzi AI z grecka literowka (bardzo czeste w
// fizyce/matmie: alfa, beta, theta, pi, Delta, Sigma...) dzis wychodza jako
// niewidoczna luka w tekscie. Obecny fallback (rozwiniecie na slowo, np.
// "pi" zamiast "π") dziala, ale wygladle malo "matematycznie" i wielu
// userow tak pisze/oczekuje prawdziwej litery.
//
// To narzedzie pokazuje 3 kandydackie czcionki u8g2 ktore MAJA caly grecki
// alfabet (zweryfikowane osobno tym samym dekoderem — brakuje im tylko ²/³,
// ktore i tak beda brane z glownego fontu, wiec to bez znaczenia):
//   A) u8g2_font_cu12_t_greek     (~17px, 3660 B)
//   B) u8g2_font_unifont_t_greek  (~16px, 3801 B)
//   C) u8g2_font_10x20_t_greek    (20px,  3749 B)
// Wszystkie sa WYZSZE niz obecna linia tekstu (12px, u8g2_font_6x12_te),
// wiec kluczowe pytanie na ktore to narzedzie ma odpowiedziec: czy ten
// mismatch wysokosci w mieszanym tekscie (np. "Δ = b² - 4ac") wyglada
// akceptowalnie na prawdziwym ekranie, i ktora z 3 czcionek jest
// najmniej rozjezdzona / najbardziej czytelna.
//
// EKRANY (auto-cykl co 6s, albo recznie przyciskiem BOOT/GPIO0):
//   0) BASELINE — ta sama grecka fraza w DZISIEJSZYM foncie 6x12_te,
//      zeby zobaczyc na zywo dzisiejszy blad (puste miejsca).
//   1) Porownanie A/B/C obok siebie (jedna litera-probka na kandydata).
//   2) Font A — pelny alfabet + przykladowa linia wzoru (mieszana:
//      grecka litera z fontu greckiego, reszta z 6x12_te — DOKLADNIE
//      tak jak dzialaloby to w prawdziwym firmware).
//   3) Font B — jw.
//   4) Font C — jw.
//
// Piny / init identyczne jak w src/main.cpp (PCB v4, ESP32-S3, boost EN
// bezposrednio na GPIO47, bez MCP23017 — ten test go nie potrzebuje).
// ============================================================================

#include <Arduino.h>
#include <SPI.h>
#include <U8g2lib.h>

#define OLED_PIN_MOSI 11
#define OLED_PIN_SCK  18
#define OLED_PIN_CS   15
#define OLED_PIN_DC    2
#define OLED_PIN_RST   4
#define BOOST_EN_PIN  47
#define ADVANCE_BTN_PIN 0   // GPIO0 = BOOT button na devkicie, active LOW

U8G2_SSD1322_NHD_256X64_F_4W_HW_SPI u8g2(
    U8G2_R2, /*cs=*/OLED_PIN_CS, /*dc=*/OLED_PIN_DC, /*reset=*/OLED_PIN_RST
);

// ---------------------------------------------------------------------------
// Mini UTF-8 decoder — zwraca kodpunkt i dlugosc w bajtach.
// ---------------------------------------------------------------------------
static uint32_t utf8Decode(const char* s, int& len) {
    uint8_t b0 = (uint8_t)s[0];
    if (b0 < 0x80) { len = 1; return b0; }
    if ((b0 >> 5) == 0x6) { len = 2; return ((b0 & 0x1F) << 6) | ((uint8_t)s[1] & 0x3F); }
    if ((b0 >> 4) == 0xE) { len = 3; return ((b0 & 0x0F) << 12) | (((uint8_t)s[1] & 0x3F) << 6) | ((uint8_t)s[2] & 0x3F); }
    if ((b0 >> 3) == 0x1E) { len = 4; return ((b0 & 0x07) << 18) | (((uint8_t)s[1] & 0x3F) << 12) | (((uint8_t)s[2] & 0x3F) << 6) | ((uint8_t)s[3] & 0x3F); }
    len = 1; return b0;
}

static bool isGreek(uint32_t cp) { return cp >= 0x0370 && cp <= 0x03FF; }

// Rysuje linie mieszajac dwie czcionki: grecki blok Unicode -> greekFont,
// wszystko inne -> baseFont. To jest DOKLADNIE technika ktora trafilaby
// do solve_screen.h (_solDrawMathLine juz robi analogiczny trick dla
// wykladnikow — przelacza font w trakcie rysowania jednej linii).
static int drawMixedLine(int x, int y, const uint8_t* baseFont, const uint8_t* greekFont, const char* text) {
    int xi = x;
    int i = 0, n = strlen(text);
    while (i < n) {
        int len;
        uint32_t cp = utf8Decode(text + i, len);
        char ch[5] = {0};
        memcpy(ch, text + i, len);
        u8g2.setFont(isGreek(cp) ? greekFont : baseFont);
        int w = u8g2.drawUTF8(xi, y, ch);
        xi += (w > 0 ? w : 8);
        i += len;
    }
    return xi - x;
}

static void hline(int y) { u8g2.drawHLine(0, y, 256); }

// ---------------------------------------------------------------------------
// Ekrany
// ---------------------------------------------------------------------------
static const char* GREEK_LOWER = "αβγδεζηθικλμνξοπρστυφχψω";
static const char* GREEK_UPPER = "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ";
static const char* FORMULA1 = "Δ = b² - 4ac";
static const char* FORMULA2 = "α = 30°, β = 60°, π·r²";

static void screenBaseline() {
    u8g2.clearBuffer();
    u8g2.setFont(u8g2_font_6x10_tf);
    u8g2.drawStr(2, 10, "[0/4] BASELINE - dzisiejszy font 6x12_te");
    hline(12);
    u8g2.setFont(u8g2_font_6x12_te);
    u8g2.drawUTF8(4, 28, GREEK_LOWER);
    u8g2.drawUTF8(4, 42, GREEK_UPPER);
    u8g2.setFont(u8g2_font_6x10_tf);
    u8g2.drawStr(4, 58, "^ tu powinny byc greckie litery. Widzisz luki?");
    u8g2.sendBuffer();
}

static void screenCompare() {
    u8g2.clearBuffer();
    u8g2.setFont(u8g2_font_6x10_tf);
    u8g2.drawStr(2, 10, "[1/4] Porownanie A / B / C");
    hline(12);
    u8g2.drawStr(2, 24, "A cu12:");
    u8g2.setFont(u8g2_font_cu12_t_greek);
    u8g2.drawUTF8(58, 26, "αβγδεζ ΑΒΓΔ");

    u8g2.setFont(u8g2_font_6x10_tf);
    u8g2.drawStr(2, 42, "B unifont:");
    u8g2.setFont(u8g2_font_unifont_t_greek);
    u8g2.drawUTF8(70, 44, "αβγδεζ ΑΒΓΔ");

    u8g2.setFont(u8g2_font_6x10_tf);
    u8g2.drawStr(2, 61, "C 10x20:");
    u8g2.setFont(u8g2_font_10x20_t_greek);
    u8g2.drawUTF8(62, 63, "αβγδ");
    u8g2.sendBuffer();
}

static void screenFontDetail(const char* label, const uint8_t* greekFont) {
    u8g2.clearBuffer();
    u8g2.setFont(u8g2_font_6x10_tf);
    u8g2.drawStr(2, 10, label);
    hline(12);

    u8g2.setFont(greekFont);
    u8g2.drawUTF8(4, 28, GREEK_LOWER);
    u8g2.drawUTF8(4, 44, GREEK_UPPER);

    // Linia mieszana — to jest realistyczny podglad jak wygladaloby to w
    // prawdziwej odpowiedzi AI na ekranie kalkulatora (font bazowy 6x12_te
    // + font grecki tylko dla liter greckich).
    drawMixedLine(4, 60, u8g2_font_6x12_te, greekFont, FORMULA1);
    u8g2.setFont(u8g2_font_5x7_tf);
    char buf[48];
    snprintf(buf, sizeof(buf), "%s", FORMULA2);
    drawMixedLine(140, 60, u8g2_font_6x12_te, greekFont, buf);

    u8g2.sendBuffer();
}

// ---------------------------------------------------------------------------
static int screenIdx = 0;
static const int SCREEN_COUNT = 5;
static uint32_t lastSwitch = 0;
static const uint32_t AUTO_MS = 6000;

static void drawScreen(int idx) {
    switch (idx) {
        case 0: screenBaseline(); break;
        case 1: screenCompare(); break;
        case 2: screenFontDetail("[2/4] A: u8g2_font_cu12_t_greek (~17px, 3660 B)", u8g2_font_cu12_t_greek); break;
        case 3: screenFontDetail("[3/4] B: u8g2_font_unifont_t_greek (~16px, 3801 B)", u8g2_font_unifont_t_greek); break;
        case 4: screenFontDetail("[4/4] C: u8g2_font_10x20_t_greek (20px, 3749 B)", u8g2_font_10x20_t_greek); break;
    }
    Serial.printf("[SCREEN] %d/%d\n", idx, SCREEN_COUNT - 1);
}

void setup() {
    Serial.begin(115200);
    delay(200);
    Serial.println("\n=== greek_font_test ===");
    Serial.println("Auto-cykl co 6s. Przycisk BOOT (GPIO0) = nastepny ekran recznie.");

    pinMode(ADVANCE_BTN_PIN, INPUT_PULLUP);

    pinMode(BOOST_EN_PIN, OUTPUT);
    digitalWrite(BOOST_EN_PIN, HIGH);
    delay(20);

    SPI.begin(OLED_PIN_SCK, /*MISO=*/-1, OLED_PIN_MOSI, OLED_PIN_CS);
    u8g2.setBusClock(8000000);
    u8g2.begin();
    u8g2.setContrast(60);

    drawScreen(screenIdx);
    lastSwitch = millis();
}

void loop() {
    bool advance = false;

    static bool btnWasDown = false;
    bool btnDown = (digitalRead(ADVANCE_BTN_PIN) == LOW);
    if (btnDown && !btnWasDown) {
        advance = true;
        delay(30); // debounce
    }
    btnWasDown = btnDown;

    if (millis() - lastSwitch >= AUTO_MS) advance = true;

    if (advance) {
        screenIdx = (screenIdx + 1) % SCREEN_COUNT;
        drawScreen(screenIdx);
        lastSwitch = millis();
    }

    delay(20);
}
