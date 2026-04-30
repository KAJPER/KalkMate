#pragma once
// =====================================================================
//  calculator.h — prosty kalkulator z czcionką 7-segment + unlock code
//
//  Funkcje:
//   - 8-cyfrowy wyświetlacz w stylu LCD kalkulatora (font u8g2 7Segments)
//   - Operacje: + - * /, =, +/-, ., %, sqrt, M+ M- MR MC, C/CE
//   - Pamięć (M)
//   - Sprawdzanie unlock code: jeśli ostatnia wpisana sekwencja cyfr (bez
//     żadnej operacji między) zgadza się z kalkSettings.aiUnlockCode →
//     wyjście do trybu AI (return)
//
//  Uruchomienie:
//     runCalculator(u8g2);
//
//  Funkcja jest blokująca dopóki user nie wpisze prawidłowego unlock code.
// =====================================================================

#include <Arduino.h>
#include <U8g2lib.h>
#include <math.h>
#include <string.h>
#include "input.h"
#include "settings_screen.h"
#include "power.h"

// Stan kalkulatora
struct _CalcState {
    char    display[12];      // tekst aktualnie wyświetlany (max 11 znaków + NUL)
    double  accumulator;      // poprzednia wartość
    char    pendingOp;        // 0 / '+' / '-' / '*' / '/'
    bool    awaitingNext;     // true gdy następna cyfra zaczyna nową liczbę
    double  memory;           // wartość M
    bool    hasMemory;
    char    unlockBuf[12];    // ostatnio wpisane cyfry (do match z unlock code)
    char    statusFlags[16];  // tekst statusu (M, ERR, itd.)
};

static _CalcState _calc;

static void _calcReset() {
    strcpy(_calc.display, "0");
    _calc.accumulator = 0.0;
    _calc.pendingOp = 0;
    _calc.awaitingNext = true;
    _calc.unlockBuf[0] = '\0';
    _calc.statusFlags[0] = '\0';
}

// Konwersja double -> string z odpowiednim formatowaniem
static void _calcFormat(double v, char* buf, size_t bufSize) {
    if (isnan(v) || isinf(v)) {
        strncpy(buf, "Error", bufSize - 1);
        buf[bufSize - 1] = '\0';
        return;
    }
    // Jeśli to liczba całkowita, wyświetl bez kropki
    if (v == (long long)v && fabs(v) < 1e10) {
        snprintf(buf, bufSize, "%lld", (long long)v);
        return;
    }
    // Inaczej: użyj %g z precyzją 8
    snprintf(buf, bufSize, "%.8g", v);
    // Usuń trailing zeros po kropce
    char* dot = strchr(buf, '.');
    if (dot) {
        char* end = buf + strlen(buf) - 1;
        while (end > dot && *end == '0') *end-- = '\0';
        if (end == dot) *end = '\0';
    }
}

static double _calcDisplayValue() {
    return atof(_calc.display);
}

static void _calcShowValue(double v) {
    _calcFormat(v, _calc.display, sizeof(_calc.display));
}

static void _calcAppendDigit(char d) {
    if (_calc.awaitingNext) {
        _calc.display[0] = (d == '.') ? '0' : '\0';
        _calc.display[1] = '\0';
        if (d == '.') {
            strcat(_calc.display, ".");
        } else {
            _calc.display[0] = d;
            _calc.display[1] = '\0';
        }
        _calc.awaitingNext = false;
    } else {
        size_t len = strlen(_calc.display);
        if (len >= 11) return;          // limit cyfr
        if (d == '.' && strchr(_calc.display, '.')) return;  // tylko jedna kropka
        _calc.display[len] = d;
        _calc.display[len + 1] = '\0';
    }

    // unlock buffer (tylko cyfry, kropka nie wpływa)
    if (d >= '0' && d <= '9') {
        size_t ulen = strlen(_calc.unlockBuf);
        if (ulen >= 11) {
            // shift left
            memmove(_calc.unlockBuf, _calc.unlockBuf + 1, 10);
            _calc.unlockBuf[10] = d;
            _calc.unlockBuf[11] = '\0';
        } else {
            _calc.unlockBuf[ulen] = d;
            _calc.unlockBuf[ulen + 1] = '\0';
        }
    }
}

static void _calcCompute() {
    double current = _calcDisplayValue();
    double result = _calc.accumulator;
    switch (_calc.pendingOp) {
        case '+': result = _calc.accumulator + current; break;
        case '-': result = _calc.accumulator - current; break;
        case '*': result = _calc.accumulator * current; break;
        case '/':
            if (current == 0.0) {
                strcpy(_calc.display, "Error");
                _calc.awaitingNext = true;
                _calc.pendingOp = 0;
                return;
            }
            result = _calc.accumulator / current;
            break;
        default: result = current; break;
    }
    _calcShowValue(result);
    _calc.accumulator = result;
    _calc.pendingOp = 0;
    _calc.awaitingNext = true;
}

static void _calcSetOp(char op) {
    if (_calc.pendingOp != 0 && !_calc.awaitingNext) {
        _calcCompute();
    } else {
        _calc.accumulator = _calcDisplayValue();
    }
    _calc.pendingOp = op;
    _calc.awaitingNext = true;
}

// Aktualizuj wyświetlone flagi statusu (np. M)
static void _calcUpdateFlags() {
    _calc.statusFlags[0] = '\0';
    if (_calc.hasMemory) strcat(_calc.statusFlags, "M");
}

// ---------------------------------------------------------------------
//  Renderowanie
// ---------------------------------------------------------------------
static void _calcDraw(U8G2& u8g2) {
    u8g2.clearBuffer();

    // Pasek statusu na górze (małe litery: M, kod...)
    u8g2.setFont(u8g2_font_6x10_tf);
    if (_calc.statusFlags[0]) {
        u8g2.drawStr(2, 8, _calc.statusFlags);
    }

    // Główny wyświetlacz — czcionka 7-segment
    // u8g2_font_logisoso42_tn ma 32px szerokości znaku, 42px wysokości
    u8g2.setFont(u8g2_font_logisoso42_tn);
    int charW = u8g2.getStrWidth("8");   // szerokość typowej cyfry
    int textW = u8g2.getStrWidth(_calc.display);

    // Wyrównaj do prawej z marginesem 4px
    int x = 256 - textW - 4;
    if (x < 0) x = 0;

    // Y = baseline, font 42px wysoki, ekran 64px → baseline ~58
    int y = 60;
    u8g2.drawStr(x, y, _calc.display);

    u8g2.sendBuffer();
}

// ---------------------------------------------------------------------
//  Główna pętla kalkulatora
//  Wraca gdy:
//   - wpisano sekwencję zgadzającą się z aiUnlockCode → return
// ---------------------------------------------------------------------
static void runCalculator(U8G2& u8g2) {
    _calcReset();
    _calc.memory = 0.0;
    _calc.hasMemory = false;
    _calcUpdateFlags();
    _calcDraw(u8g2);

    while (true) {
        inputScan();
        if (powerCheckSleep()) _calcDraw(u8g2);

        // --- Sprawdź unlock code ---
        // Jeśli unlock buffer kończy się dokładnie tą samą sekwencją co
        // aiUnlockCode → wyjdź z kalkulatora
        size_t ulen = strlen(_calc.unlockBuf);
        size_t clen = strlen(kalkSettings.aiUnlockCode);
        if (clen > 0 && ulen >= clen) {
            const char* tail = _calc.unlockBuf + (ulen - clen);
            if (strcmp(tail, kalkSettings.aiUnlockCode) == 0) {
                // Krótka informacja na ekranie
                u8g2.clearBuffer();
                u8g2.setFont(u8g2_font_logisoso22_tn);
                u8g2.drawStr(60, 40, "AI");
                u8g2.sendBuffer();
                delay(600);
                return;
            }
        }

        // --- Cyfry ---
        if (inputKeyConsume(KEY_0))   { _calcAppendDigit('0'); _calcDraw(u8g2); continue; }
        if (inputKeyConsume(KEY_1))   { _calcAppendDigit('1'); _calcDraw(u8g2); continue; }
        if (inputKeyConsume(KEY_2))   { _calcAppendDigit('2'); _calcDraw(u8g2); continue; }
        if (inputKeyConsume(KEY_3))   { _calcAppendDigit('3'); _calcDraw(u8g2); continue; }
        if (inputKeyConsume(KEY_4))   { _calcAppendDigit('4'); _calcDraw(u8g2); continue; }
        if (inputKeyConsume(KEY_5))   { _calcAppendDigit('5'); _calcDraw(u8g2); continue; }
        if (inputKeyConsume(KEY_6))   { _calcAppendDigit('6'); _calcDraw(u8g2); continue; }
        if (inputKeyConsume(KEY_7))   { _calcAppendDigit('7'); _calcDraw(u8g2); continue; }
        if (inputKeyConsume(KEY_8))   { _calcAppendDigit('8'); _calcDraw(u8g2); continue; }
        if (inputKeyConsume(KEY_9))   { _calcAppendDigit('9'); _calcDraw(u8g2); continue; }
        if (inputKeyConsume(KEY_00))  { _calcAppendDigit('0'); _calcAppendDigit('0'); _calcDraw(u8g2); continue; }
        if (inputKeyConsume(KEY_DOT)) { _calcAppendDigit('.'); _calcDraw(u8g2); continue; }

        // --- Operatory ---
        if (inputKeyConsume(KEY_PLUS))  { _calc.unlockBuf[0] = '\0'; _calcSetOp('+'); _calcDraw(u8g2); continue; }
        if (inputKeyConsume(KEY_MINUS)) { _calc.unlockBuf[0] = '\0'; _calcSetOp('-'); _calcDraw(u8g2); continue; }
        if (inputKeyConsume(KEY_MUL))   { _calc.unlockBuf[0] = '\0'; _calcSetOp('*'); _calcDraw(u8g2); continue; }
        if (inputKeyConsume(KEY_DIV))   { _calc.unlockBuf[0] = '\0'; _calcSetOp('/'); _calcDraw(u8g2); continue; }
        if (inputKeyConsume(KEY_EQ)) {
            _calc.unlockBuf[0] = '\0';
            _calcCompute();
            _calcDraw(u8g2);
            continue;
        }

        // --- Funkcje ---
        if (inputKeyConsume(KEY_PLUSMINUS)) {
            double v = _calcDisplayValue();
            _calcShowValue(-v);
            _calcDraw(u8g2);
            continue;
        }
        if (inputKeyConsume(KEY_PERCENT)) {
            double v = _calcDisplayValue();
            _calcShowValue(v / 100.0);
            _calcDraw(u8g2);
            continue;
        }
        if (inputKeyConsume(KEY_SQRT)) {
            double v = _calcDisplayValue();
            if (v < 0) {
                strcpy(_calc.display, "Error");
            } else {
                _calcShowValue(sqrt(v));
            }
            _calc.awaitingNext = true;
            _calcDraw(u8g2);
            continue;
        }

        // --- Pamięć ---
        if (inputKeyConsume(KEY_MPLUS)) {
            _calc.memory += _calcDisplayValue();
            _calc.hasMemory = true;
            _calc.awaitingNext = true;
            _calcUpdateFlags();
            _calcDraw(u8g2);
            continue;
        }
        if (inputKeyConsume(KEY_MMINUS)) {
            _calc.memory -= _calcDisplayValue();
            _calc.hasMemory = true;
            _calc.awaitingNext = true;
            _calcUpdateFlags();
            _calcDraw(u8g2);
            continue;
        }
        if (inputKeyConsume(KEY_MR)) {
            _calcShowValue(_calc.memory);
            _calc.awaitingNext = false;  // następna cyfra nadpisze
            _calcDraw(u8g2);
            continue;
        }
        if (inputKeyConsume(KEY_MC)) {
            _calc.memory = 0.0;
            _calc.hasMemory = false;
            _calcUpdateFlags();
            _calcDraw(u8g2);
            continue;
        }

        // --- Czyść ---
        if (inputKeyConsume(KEY_CCE)) {
            _calcReset();
            _calcUpdateFlags();
            _calcDraw(u8g2);
            continue;
        }

        // --- Klawisze których kalkulator nie ma:
        // KEY_ARROW (▶), KEY_MU — ignorujemy ale czyścimy unlock buf żeby
        // przypadkowe wcisniecie nie sztormowalo unlock detection
        if (inputKeyConsume(KEY_ARROW) || inputKeyConsume(KEY_MU)) {
            // ignoruj
        }

        delay(15);
    }
}
