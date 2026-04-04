#pragma once

#include <Arduino.h>
#include <U8g2lib.h>

// ============================================================
//  KALKMATE_LOGO — bitmapa XBM 48x56 pikseli
//  Format: U8g2 XBM, LSB first, 6 bajtów na wiersz (48px / 8)
//  Łączna liczba bajtów: 6 × 56 = 336
//
//  Anatomia pikseli (preview ASCII):
//    - Obudowa kalkulatora: ramka 2px, zaokrąglone rogi (r=3)
//    - Ekran: wypełniony prostokąt 38×12px, od (5,4)
//    - Klawiatura: 3 kolumny × 4 rzędy, przycisk 8×6px, odstęp 2px
//      start X=5, Y=20; kolejne co 10px (X) i 8px (Y)
//
//  Układ bajtów — każdy wiersz ma 6 bajtów:
//    byte0 = kolumny 0-7, byte1 = 8-15, ..., byte5 = 40-47
//    bit 0 bajtu = piksel leftmost (LSB first)
// ============================================================

static const uint8_t KALKMATE_LOGO[] U8X8_PROGMEM = {
  // ---- row 0 ----  obudowa – górna krawędź (z zaokrąglonymi rogami)
  0xFC, 0xFF, 0xFF, 0xFF, 0xFF, 0x3F,
  // ---- row 1 ----
  0xFE, 0xFF, 0xFF, 0xFF, 0xFF, 0x7F,
  // ---- row 2 ----  lewa/prawa krawędź
  0x03, 0x00, 0x00, 0x00, 0x00, 0xC0,
  // ---- row 3 ----
  0x03, 0x00, 0x00, 0x00, 0x00, 0xC0,
  // ---- row 4-15 ---- ekran (38×12px od x=5)
  0xE3, 0xFF, 0xFF, 0xFF, 0xFF, 0xC7,
  0xE3, 0xFF, 0xFF, 0xFF, 0xFF, 0xC7,
  0xE3, 0xFF, 0xFF, 0xFF, 0xFF, 0xC7,
  0xE3, 0xFF, 0xFF, 0xFF, 0xFF, 0xC7,
  0xE3, 0xFF, 0xFF, 0xFF, 0xFF, 0xC7,
  0xE3, 0xFF, 0xFF, 0xFF, 0xFF, 0xC7,
  0xE3, 0xFF, 0xFF, 0xFF, 0xFF, 0xC7,
  0xE3, 0xFF, 0xFF, 0xFF, 0xFF, 0xC7,
  0xE3, 0xFF, 0xFF, 0xFF, 0xFF, 0xC7,
  0xE3, 0xFF, 0xFF, 0xFF, 0xFF, 0xC7,
  0xE3, 0xFF, 0xFF, 0xFF, 0xFF, 0xC7,
  0xE3, 0xFF, 0xFF, 0xFF, 0xFF, 0xC7,
  // ---- row 16-19 ---- odstęp między ekranem a klawiszami
  0x03, 0x00, 0x00, 0x00, 0x00, 0xC0,
  0x03, 0x00, 0x00, 0x00, 0x00, 0xC0,
  0x03, 0x00, 0x00, 0x00, 0x00, 0xC0,
  0x03, 0x00, 0x00, 0x00, 0x00, 0xC0,
  // ---- row 20-25 ---- rząd przycisków 0 (y=20..25)
  // 3 przyciski 8×6px: col0 x=5..12, col1 x=15..22, col2 x=25..32
  // Bajty: xx=0..47
  //  byte0 (b0-b7):  bity 0-1 = krawędź L, bity 2-4 = krawędź ramki, 5..7=btn0
  //  Liczymy wprost z mapy pikseli wygenerowanej skryptem
  0xE3, 0x9F, 0x7F, 0xFE, 0x01, 0xC0,
  0xE3, 0x9F, 0x7F, 0xFE, 0x01, 0xC0,
  0xE3, 0x9F, 0x7F, 0xFE, 0x01, 0xC0,
  0xE3, 0x9F, 0x7F, 0xFE, 0x01, 0xC0,
  0xE3, 0x9F, 0x7F, 0xFE, 0x01, 0xC0,
  0xE3, 0x9F, 0x7F, 0xFE, 0x01, 0xC0,
  // ---- row 26-27 ---- odstęp między rzędami przycisków
  0x03, 0x00, 0x00, 0x00, 0x00, 0xC0,
  0x03, 0x00, 0x00, 0x00, 0x00, 0xC0,
  // ---- row 28-33 ---- rząd przycisków 1
  0xE3, 0x9F, 0x7F, 0xFE, 0x01, 0xC0,
  0xE3, 0x9F, 0x7F, 0xFE, 0x01, 0xC0,
  0xE3, 0x9F, 0x7F, 0xFE, 0x01, 0xC0,
  0xE3, 0x9F, 0x7F, 0xFE, 0x01, 0xC0,
  0xE3, 0x9F, 0x7F, 0xFE, 0x01, 0xC0,
  0xE3, 0x9F, 0x7F, 0xFE, 0x01, 0xC0,
  // ---- row 34-35 ---- odstęp
  0x03, 0x00, 0x00, 0x00, 0x00, 0xC0,
  0x03, 0x00, 0x00, 0x00, 0x00, 0xC0,
  // ---- row 36-41 ---- rząd przycisków 2
  0xE3, 0x9F, 0x7F, 0xFE, 0x01, 0xC0,
  0xE3, 0x9F, 0x7F, 0xFE, 0x01, 0xC0,
  0xE3, 0x9F, 0x7F, 0xFE, 0x01, 0xC0,
  0xE3, 0x9F, 0x7F, 0xFE, 0x01, 0xC0,
  0xE3, 0x9F, 0x7F, 0xFE, 0x01, 0xC0,
  0xE3, 0x9F, 0x7F, 0xFE, 0x01, 0xC0,
  // ---- row 42-43 ---- odstęp
  0x03, 0x00, 0x00, 0x00, 0x00, 0xC0,
  0x03, 0x00, 0x00, 0x00, 0x00, 0xC0,
  // ---- row 44-49 ---- rząd przycisków 3
  0xE3, 0x9F, 0x7F, 0xFE, 0x01, 0xC0,
  0xE3, 0x9F, 0x7F, 0xFE, 0x01, 0xC0,
  0xE3, 0x9F, 0x7F, 0xFE, 0x01, 0xC0,
  0xE3, 0x9F, 0x7F, 0xFE, 0x01, 0xC0,
  0xE3, 0x9F, 0x7F, 0xFE, 0x01, 0xC0,
  0xE3, 0x9F, 0x7F, 0xFE, 0x01, 0xC0,
  // ---- row 50-53 ---- dolny margines wewnątrz obudowy
  0x03, 0x00, 0x00, 0x00, 0x00, 0xC0,
  0x03, 0x00, 0x00, 0x00, 0x00, 0xC0,
  0x03, 0x00, 0x00, 0x00, 0x00, 0xC0,
  0x03, 0x00, 0x00, 0x00, 0x00, 0xC0,
  // ---- row 54 ----  dolna krawędź obudowy
  0xFE, 0xFF, 0xFF, 0xFF, 0xFF, 0x7F,
  // ---- row 55 ----
  0xFC, 0xFF, 0xFF, 0xFF, 0xFF, 0x3F
};

// ============================================================
//  KALKMATE_LOGO_WIDTH / HEIGHT — stałe dla U8g2 drawXBM
// ============================================================
static const uint8_t KALKMATE_LOGO_W = 48;
static const uint8_t KALKMATE_LOGO_H = 56;

// ============================================================
//  showSplashScreen
//
//  Wyświetla ekran powitalny KalkMate na wyświetlaczu OLED
//  SSD1322 256×64 (U8G2).
//
//  Układ na ekranie:
//    Logo (48×56):  X=104, Y=4   → wyśrodkowane pionowo i poziomo
//                                   względem lewej połowy (256/2 = 128)
//                                   ale faktycznie trzymamy razem z tekstem
//    Tekst "KalkMate"  (font 10×20): X=160, Y=22
//    Tekst "AI Math Solver" (font 5×7): X=160, Y=44
//
//  Animacja (3 fazy po ~500ms):
//    Faza 1 (0ms):   Logo pojawia się (drawXBM)
//    Faza 2 (500ms): Dodaje się "KalkMate"
//    Faza 3 (1000ms): Dodaje się "AI Math Solver" + pasek postępu
//    Koniec (1500ms): czeka 1000ms, następnie powrót
//
//  Pasek postępu: kreska rosnąca od x=160 do x=250, y=56, grubość 3px.
//  Animacja paska: 20 kroków co 25ms = 500ms łącznie.
// ============================================================

inline void showSplashScreen(U8G2 &display) {
  // Współrzędne logo (wyśrodkowane pionowo na 64px ekranu)
  // Logo ma 56px wysokości → Y_offset = (64-56)/2 = 4
  const int16_t LOGO_X = 104;  // (256 - 48) / 2 = 104, środek ekranu
  const int16_t LOGO_Y =   4;  // (64  - 56) / 2 = 4

  // Pozycje tekstu (na prawo od logo: 104 + 48 + 8 = 160)
  const int16_t TEXT_X  = 160;
  const int16_t TEXT_Y1 =  22;  // baseline "KalkMate"  (font 10x20 → ~20px)
  const int16_t TEXT_Y2 =  44;  // baseline "AI Math Solver"
  const int16_t BAR_X0  = 160;
  const int16_t BAR_X1  = 250;
  const int16_t BAR_Y   =  57;
  const int16_t BAR_H   =   3;

  // ─── FAZA 1: logo ───────────────────────────────────────────
  display.clearBuffer();
  display.drawXBMP(LOGO_X, LOGO_Y, KALKMATE_LOGO_W, KALKMATE_LOGO_H,
                   KALKMATE_LOGO);
  display.sendBuffer();
  delay(500);

  // ─── FAZA 2: logo + "KalkMate" ──────────────────────────────
  display.clearBuffer();
  display.drawXBMP(LOGO_X, LOGO_Y, KALKMATE_LOGO_W, KALKMATE_LOGO_H,
                   KALKMATE_LOGO);
  display.setFont(u8g2_font_10x20_tf);
  display.drawStr(TEXT_X, TEXT_Y1, "KalkMate");
  display.sendBuffer();
  delay(500);

  // ─── FAZA 3: logo + tekst + podtytuł + animowany pasek ──────
  const uint8_t BAR_STEPS = 20;
  const int16_t bar_total = BAR_X1 - BAR_X0;

  for (uint8_t step = 0; step <= BAR_STEPS; step++) {
    display.clearBuffer();

    // Logo
    display.drawXBMP(LOGO_X, LOGO_Y, KALKMATE_LOGO_W, KALKMATE_LOGO_H,
                     KALKMATE_LOGO);

    // Tytuł
    display.setFont(u8g2_font_10x20_tf);
    display.drawStr(TEXT_X, TEXT_Y1, "KalkMate");

    // Podtytuł
    display.setFont(u8g2_font_5x7_tf);
    display.drawStr(TEXT_X, TEXT_Y2, "AI Math Solver");

    // Pasek postępu (tło — kontur)
    display.drawFrame(BAR_X0, BAR_Y - BAR_H - 1,
                      bar_total, BAR_H + 2);

    // Pasek postępu (wypełnienie rosnące)
    int16_t bar_fill = (int16_t)(bar_total * step / BAR_STEPS);
    if (bar_fill > 0) {
      display.drawBox(BAR_X0, BAR_Y - BAR_H,
                      bar_fill, BAR_H);
    }

    display.sendBuffer();
    delay(25);  // 20 kroków × 25ms = 500ms łącznie
  }

  // ─── Czekaj 1 sekundę, potem powrót ─────────────────────────
  delay(1000);
}
