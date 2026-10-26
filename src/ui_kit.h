#pragma once
// ui_kit.h — wspolny wyglad ekranow KalkMate (OLED 256x64), styl "telefon".
//
// Uklad ekranu:
//   y 0..12   naglowek: tytul (6x10) z lewej, "<" przed tytulem gdy LEFT
//             wraca poziom wyzej, z prawej maly tekst 5x7 (licznik "3/9",
//             status); linia pozioma y=12. BEZ "=== Tytul ===".
//   y 13..63  tresc. Listy: wiersze po 12 px (baseline 24, 36, 48, 60),
//             zaznaczenie = pelny jasny pasek, wartosc wyrownana do prawej,
//             ">" gdy pozycja otwiera kolejny ekran, pasek przewijania x=253.
//   y 55..63  opcjonalna stopka z podpowiedziami klawiszy (uiFooter) —
//             tylko gdy akcje nie sa oczywiste; lista ma wtedy 3 wiersze.
//
// Czcionki: UI_FONT (6x10) tresc/tytuly, UI_FONT_SMALL (5x7) stopki/liczniki,
// UI_FONT_BIG (10x20) duze liczby/komunikaty. Wszystkie _tf = tylko ASCII/
// Latin-1 (bez polskich znakow i cyrylicy w napisach UI).
//
// Funkcje rysuja do bufora — sendBuffer() robi wywolujacy.

#include <Arduino.h>
#include <U8g2lib.h>

#define UI_FONT        u8g2_font_6x10_tf
#define UI_FONT_SMALL  u8g2_font_5x7_tf
#define UI_FONT_BIG    u8g2_font_10x20_tf

#define UI_W           256
#define UI_H           64
#define UI_HEADER_LINE 12
#define UI_ROW_Y0      24      // baseline pierwszego wiersza listy
#define UI_ROW_H       12
#define UI_ROWS        4       // wierszy listy bez stopki
#define UI_ROWS_FOOTER 3       // wierszy listy ze stopka
#define UI_VALUE_R     240     // prawa krawedz wartosci (przed ">")
#define UI_CHEVRON_X   243
#define UI_FOOTER_LINE 55

// Ikony 8x8 (XBM: bit 0 = lewy piksel wiersza).
static const uint8_t UI_ICO_DISPLAY[8] = {0xFF, 0x81, 0x81, 0x81, 0xFF, 0x18, 0x3C, 0x00};
static const uint8_t UI_ICO_CAMERA[8]  = {0x1C, 0xFF, 0x99, 0xA5, 0xA5, 0x99, 0xFF, 0x00};
static const uint8_t UI_ICO_GLOBE[8]   = {0x3C, 0x5A, 0x99, 0xFF, 0x99, 0x5A, 0x3C, 0x00};
static const uint8_t UI_ICO_WIFI[8]    = {0x7E, 0x81, 0x3C, 0x42, 0x18, 0x24, 0x00, 0x18};
static const uint8_t UI_ICO_LOCK[8]    = {0x3C, 0x42, 0x42, 0xFF, 0xE7, 0xE7, 0xFF, 0x00};
static const uint8_t UI_ICO_BATTERY[8] = {0x00, 0x7F, 0x41, 0xDD, 0xDD, 0x41, 0x7F, 0x00};
static const uint8_t UI_ICO_GEAR[8]    = {0x18, 0x7E, 0x66, 0xC3, 0xC3, 0x66, 0x7E, 0x18};
static const uint8_t UI_ICO_PULSE[8]   = {0x00, 0x08, 0x14, 0x14, 0xD3, 0x20, 0x00, 0x00};
static const uint8_t UI_ICO_INFO[8]    = {0x3C, 0x66, 0xFF, 0xE7, 0xE7, 0xE7, 0x7E, 0x3C};
static const uint8_t UI_ICO_NOTES[8]   = {0x7E, 0x42, 0x5A, 0x42, 0x5A, 0x42, 0x7E, 0x00};
static const uint8_t UI_ICO_CHECK[8]   = {0x00, 0xC0, 0xE0, 0x70, 0x3B, 0x1F, 0x0E, 0x04};
static const uint8_t UI_ICO_CROSS[8]   = {0x00, 0x42, 0x24, 0x18, 0x18, 0x24, 0x42, 0x00};
static const uint8_t UI_ICO_WARN[8]    = {0x18, 0x18, 0x3C, 0x24, 0x66, 0x7E, 0xE7, 0xFF};
static const uint8_t UI_ICO_CLOUD[8]   = {0x00, 0x18, 0x3C, 0x7E, 0xFF, 0xFF, 0x7E, 0x00};
static const uint8_t UI_ICO_KEY[8]     = {0x0E, 0x11, 0x11, 0x0E, 0x04, 0x0C, 0x04, 0x0C};
static const uint8_t UI_ICO_CLOCK[8]   = {0x3C, 0x42, 0x89, 0x89, 0xB9, 0x81, 0x42, 0x3C};

// Naglowek. back=true -> "<" przed tytulem (LEFT wraca). right: maly tekst
// z prawej (np. "3/9", "v2.0.5", "OK") albo nullptr.
static void uiHeader(U8G2 &d, const char* title, bool back, const char* right = nullptr) {
    d.setDrawColor(1);
    d.setFont(UI_FONT);
    if (back) {
        d.drawStr(2, 10, "<");
        d.drawStr(12, 10, title);
    } else {
        d.drawStr(2, 10, title);
    }
    if (right && right[0]) {
        d.setFont(UI_FONT_SMALL);
        d.drawStr(250 - d.getStrWidth(right), 9, right);
        d.setFont(UI_FONT);
    }
    d.drawHLine(0, UI_HEADER_LINE, UI_W);
}

// Naglowek z licznikiem pozycji "pos+1/count".
static void uiHeaderCount(U8G2 &d, const char* title, bool back, int pos, int count) {
    char cnt[10];
    snprintf(cnt, sizeof(cnt), "%d/%d", pos + 1, count);
    uiHeader(d, title, back, cnt);
}

// Stopka z podpowiedziami: left z lewej, right z prawej (np. "OK zapisz").
static void uiFooter(U8G2 &d, const char* left, const char* right = nullptr) {
    d.setDrawColor(1);
    d.drawHLine(0, UI_FOOTER_LINE, UI_W);
    d.setFont(UI_FONT_SMALL);
    if (left && left[0])   d.drawStr(2, 63, left);
    if (right && right[0]) d.drawStr(254 - d.getStrWidth(right), 63, right);
    d.setFont(UI_FONT);
}

// Wiersz listy (row = 0..3 od gory). icon == nullptr -> bez ikony.
// value: tekst z prawej (ucinany ".." gdy sie nie miesci). chevron: ">".
// barVal 0..barMax >= 0 -> zamiast value pasek z liczba (np. jasnosc).
static void uiRow(U8G2 &d, int row, bool sel, const uint8_t* icon, const char* label,
                  const char* value = nullptr, bool chevron = false, int barVal = -1, int barMax = 15) {
    const int y = UI_ROW_Y0 + row * UI_ROW_H;
    d.setFont(UI_FONT);
    d.setBitmapMode(1);
    if (sel) {
        d.setDrawColor(1);
        d.drawBox(0, y - 9, 251, UI_ROW_H);
        d.setDrawColor(0);
    } else {
        d.setDrawColor(1);
    }
    int x = 4;
    if (icon) {
        d.drawXBM(4, y - 8, 8, 8, icon);
        x = 17;
    }
    d.drawStr(x, y, label);
    const int labelEnd = x + d.getStrWidth(label) + 8;

    const int right = chevron ? UI_VALUE_R : UI_CHEVRON_X + 6;
    if (chevron) d.drawStr(UI_CHEVRON_X, y, ">");
    if (barVal >= 0) {
        char num[6];
        snprintf(num, sizeof(num), "%d", barVal);
        int nw = d.getStrWidth(num);
        d.drawStr(right - nw, y, num);
        int bx = right - nw - 6 - 52;
        if (bx > labelEnd) {
            d.drawFrame(bx, y - 7, 52, 7);
            int fill = barMax > 0 ? barVal * 48 / barMax : 0;
            if (fill > 0) d.drawBox(bx + 2, y - 5, fill, 3);
        }
    } else if (value && value[0]) {
        char v[48];
        snprintf(v, sizeof(v), "%s", value);
        int len = strlen(v);
        while (len > 0 && labelEnd + d.getStrWidth(v) > right) {
            len--;
            if (len >= 2) { v[len - 2] = '.'; v[len - 1] = '.'; }
            v[len] = '\0';
        }
        if (len > 0) d.drawStr(right - d.getStrWidth(v), y, v);
    }
    d.setDrawColor(1);
    d.setBitmapMode(0);
}

// Pasek przewijania z prawej. rows = ile wierszy miesci sie na ekranie.
static void uiScrollbar(U8G2 &d, int scroll, int count, int rows = UI_ROWS) {
    if (count <= rows) return;
    const int top = 14;
    const int h = (rows == UI_ROWS) ? 50 : 40;
    int barH = h * rows / count;
    if (barH < 4) barH = 4;
    int barY = top + (h - barH) * scroll / (count - rows);
    d.setDrawColor(1);
    d.drawVLine(254, top, h);
    d.drawBox(253, barY, 3, barH);
}

// Utrzymuje kursor w widocznym oknie listy.
static void uiFitScroll(int cursor, int count, int &scroll, int rows = UI_ROWS) {
    if (cursor < scroll) scroll = cursor;
    if (cursor >= scroll + rows) scroll = cursor - rows + 1;
    if (scroll > count - rows) scroll = count - rows;
    if (scroll < 0) scroll = 0;
}

// Tekst wysrodkowany w poziomie (aktualna czcionka).
static void uiCenter(U8G2 &d, int y, const char* s) {
    d.drawStr((UI_W - d.getStrWidth(s)) / 2, y, s);
}

// Pasek postepu: ramka w x,y o szerokosci w (wys. 8), pct 0..100.
static void uiProgress(U8G2 &d, int x, int y, int w, int pct) {
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;
    d.setDrawColor(1);
    d.drawRFrame(x, y, w, 8, 2);
    int fill = (w - 4) * pct / 100;
    if (fill > 0) d.drawBox(x + 2, y + 2, fill, 4);
}

// Wskaznik "trwa..." — 3 kropki, aktywna wedlug millis(); x,y = srodek.
static void uiSpinner(U8G2 &d, int cx, int cy) {
    int phase = (millis() / 250) % 3;
    for (int i = 0; i < 3; i++) {
        int x = cx - 8 + i * 8;
        if (i == phase) d.drawBox(x - 2, cy - 2, 5, 5);
        else            d.drawFrame(x - 1, cy - 1, 3, 3);
    }
}

// Ekran komunikatu: naglowek + ikona 8x8 (opcjonalna) i do 3 linii tresci
// wysrodkowanych w obszarze 13..54, opcjonalna stopka. Rysuje caly ekran
// (clearBuffer + sendBuffer).
static void uiMessage(U8G2 &d, const char* title, const uint8_t* icon,
                      const char* l1, const char* l2 = nullptr, const char* l3 = nullptr,
                      const char* footL = nullptr, const char* footR = nullptr) {
    d.clearBuffer();
    uiHeader(d, title, false);
    const char* lines[3] = {l1, l2, l3};
    int n = 0;
    for (int i = 0; i < 3; i++) if (lines[i] && lines[i][0]) n++;
    const bool foot = (footL && footL[0]) || (footR && footR[0]);
    const int areaTop = 14, areaBot = foot ? 54 : 63;
    int y = areaTop + ((areaBot - areaTop) - n * 11) / 2 + 9;
    d.setFont(UI_FONT);
    int k = 0;
    for (int i = 0; i < 3; i++) {
        const char* s = lines[i];
        if (!s || !s[0]) continue;
        int w = d.getStrWidth(s);
        int x = (UI_W - w) / 2;
        if (icon && k == 0) {
            x = (UI_W - (w + 12)) / 2;
            d.setBitmapMode(1);
            d.drawXBM(x, y - 8, 8, 8, icon);
            d.setBitmapMode(0);
            x += 12;
        }
        d.drawStr(x, y, s);
        y += 11;
        k++;
    }
    if (foot) uiFooter(d, footL, footR);
    d.sendBuffer();
}

// Przycisk-etykieta w ramce (np. stopka dialogu): zwraca szerokosc.
static int uiButton(U8G2 &d, int x, int y, const char* label, bool filled) {
    d.setFont(UI_FONT_SMALL);
    int w = d.getStrWidth(label) + 8;
    d.setDrawColor(1);
    if (filled) {
        d.drawRBox(x, y - 7, w, 9, 2);
        d.setDrawColor(0);
        d.drawStr(x + 4, y, label);
        d.setDrawColor(1);
    } else {
        d.drawRFrame(x, y - 7, w, 9, 2);
        d.drawStr(x + 4, y, label);
    }
    d.setFont(UI_FONT);
    return w;
}

// Dialog potwierdzenia: tytul, 1-2 linie, przyciski "cancel" (lewy) i
// "confirm" (prawy, wypelniony). Tylko rysuje — obsluge klawiszy robi
// wywolujacy (zwykle C/CE = anuluj, OK = potwierdz).
static void uiConfirm(U8G2 &d, const char* title, const char* l1, const char* l2,
                      const char* cancel, const char* confirm) {
    d.clearBuffer();
    uiHeader(d, title, false);
    d.setFont(UI_FONT);
    if (l1) uiCenter(d, 28, l1);
    if (l2) uiCenter(d, 40, l2);
    d.setFont(UI_FONT_SMALL);
    int wc = d.getStrWidth(cancel) + 8, wo = d.getStrWidth(confirm) + 8;
    int gap = 16, x = (UI_W - (wc + gap + wo)) / 2;
    uiButton(d, x, 60, cancel, false);
    uiButton(d, x + wc + gap, 60, confirm, true);
    d.sendBuffer();
}

// ---------------------------------------------------------------------------
// Dodatki (ekrany informacyjne / WiFi)
// ---------------------------------------------------------------------------

// Wiersz informacyjny bez zaznaczenia (rozstaw 10 px): etykieta malym
// fontem z lewej, wartosc (UI_FONT) wyrownana do prawej, ucinana "..".
// y = baseline. valueRight = prawa krawedz wartosci (domyslnie 250).
static void uiInfoRow(U8G2 &d, int y, const char* label, const char* value, int valueRight = 250) {
    d.setDrawColor(1);
    d.setFont(UI_FONT_SMALL);
    int labelEnd = 4;
    if (label && label[0]) {
        d.drawStr(4, y, label);
        labelEnd = 4 + d.getStrWidth(label) + 8;
    }
    d.setFont(UI_FONT);
    if (value && value[0]) {
        char v[48];
        snprintf(v, sizeof(v), "%s", value);
        int len = strlen(v);
        while (len > 0 && labelEnd + d.getStrWidth(v) > valueRight) {
            len--;
            if (len >= 2) { v[len - 2] = '.'; v[len - 1] = '.'; }
            v[len] = '\0';
        }
        if (len > 0) d.drawStr(valueRight - d.getStrWidth(v), y, v);
    }
}

// Poziom sygnalu 0..4 z RSSI (dBm). 0 dBm = brak pomiaru -> 0.
static int uiSignalLevel(int rssi) {
    if (rssi >= 0)   return 0;
    if (rssi >= -55) return 4;
    if (rssi >= -65) return 3;
    if (rssi >= -75) return 2;
    if (rssi >= -85) return 1;
    return 0;
}

// Slupki zasiegu jak w telefonie: 4 slupki 2 px (szer. 11 px, wys. 8 px),
// x = lewa krawedz, yBottom = dolny wiersz. Rysuje biezacym kolorem
// (na zaznaczonym pasku wywolujacy ustawia setDrawColor(0)).
static void uiSignalBars(U8G2 &d, int x, int yBottom, int rssi) {
    const int lvl = uiSignalLevel(rssi);
    for (int i = 0; i < 4; i++) {
        const int h = 2 + i * 2;
        const int bx = x + i * 3;
        if (i < lvl) d.drawBox(bx, yBottom - h + 1, 2, h);
        else         d.drawHLine(bx, yBottom, 2);
    }
}

// Ekran "trwa...": naglowek, ikona + 1-2 linie wysrodkowane, kropki
// uiSpinner pod spodem. Rysuje caly ekran (clearBuffer + sendBuffer).
// Przy wywolaniach w petli kropki sie animuja.
static void uiBusy(U8G2 &d, const char* title, const uint8_t* icon,
                   const char* l1, const char* l2 = nullptr) {
    d.clearBuffer();
    uiHeader(d, title, false);
    d.setFont(UI_FONT);
    const bool two = (l2 && l2[0]);
    int y = two ? 29 : 33;
    if (l1 && l1[0]) {
        int w = d.getStrWidth(l1);
        int x = (UI_W - w) / 2;
        if (icon) {
            x = (UI_W - (w + 12)) / 2;
            d.setBitmapMode(1);
            d.drawXBM(x, y - 8, 8, 8, icon);
            d.setBitmapMode(0);
            x += 12;
        }
        d.drawStr(x, y, l1);
    }
    if (two) uiCenter(d, y + 11, l2);
    uiSpinner(d, UI_W / 2, two ? 53 : 48);
    d.sendBuffer();
}
