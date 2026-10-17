#pragma once
// =====================================================================
//  calculator.h — prosty kalkulator z czcionką 7-segment + unlock code
//
//  Funkcje:
//   - wyswietlacz w stylu LCD kalkulatora (font u8g2 logisoso42), limit
//     wpisu liczony w pikselach (ok. 9 cyfr)
//   - Operacje: + - * /, =, +/-, ., %, sqrt, M+ M- MR MC, C/CE
//   - Pamięć (M)
//   - Sprawdzanie unlock code: jeśli ostatnia wpisana sekwencja cyfr (bez
//     żadnej operacji między) zgadza się z kalkSettings.aiUnlockCode →
//     wyjście do trybu AI (return)
//
//  Wartosc biezaca trzymana jest w double (_calc.value) — ekran to tylko
//  jej sformatowany obraz. Wczesniej kolejne dzialania czytaly liczbe z
//  tekstu na ekranie (atof), wiec obciety zapis (np. "1.4285714e-" dla
//  1/70000) psul dalsze wyniki.
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
#include <stdlib.h>
#include "input.h"
#include "settings_screen.h"
#include "power.h"
#include "panic.h"
#include "battery.h"
#include "factory_reset.h"   // factoryResetRun — wspolny z Ustawienia -> Reset fabryczny

// Fonty wyswietlacza. logisoso42_tn ma TYLKO cyfry, spacje i "*+,-./:" —
// litery (wykladnik "e", napis "Error") rysujemy mniejszym logisoso22_tr.
// Cyfra 42_tn = 27 px, kropka 15 px, minus 28 px.
#define _CALC_FONT_BIG  u8g2_font_logisoso42_tn
#define _CALC_FONT_EXP  u8g2_font_logisoso22_tr
#define _CALC_MAX_W     250    // max szerokosc liczby w px (256 - 4 z prawej - 2 z lewej)
#define _CALC_BASE_Y    60     // linia bazowa duzych cyfr (font 42 px, ekran 64 px)

// Stan kalkulatora
struct _CalcState {
    char    entry[16];        // wpisywana liczba (tekst) — pokazywana gdy !awaitingNext
    double  value;            // biezaca wartosc (pelna precyzja; ekran to tylko jej obraz)
    bool    error;            // ekran "Error" (dzielenie przez 0, sqrt(<0), przepelnienie)
    bool    entered;          // od ostatniego operatora podano nowa wartosc (cyfry, MR, sqrt, %, +/-)
    double  accumulator;      // poprzednia wartość
    char    pendingOp;        // 0 / '+' / '-' / '*' / '/'
    bool    awaitingNext;     // true gdy następna cyfra zaczyna nową liczbę (ekran = value)
    double  memory;           // wartość M
    bool    hasMemory;
    char    unlockBuf[12];    // ostatnio wpisane cyfry (do match z unlock code)
    char    statusFlags[16];  // tekst statusu (M, ERR, itd.)
    // === Powtarzanie operacji przez kolejne "=" ===
    // Po "2 * 3 =" repeat = ('*', 3). Kolejne "=" mnoży wynik przez 3.
    char    repeatOp;         // 0 = brak repeatu
    double  repeatOperand;
};

static _CalcState _calc;

static void _calcReset() {
    strcpy(_calc.entry, "0");
    _calc.value = 0.0;
    _calc.error = false;
    _calc.entered = false;
    _calc.accumulator = 0.0;
    _calc.pendingOp = 0;
    _calc.awaitingNext = true;
    _calc.unlockBuf[0] = '\0';
    _calc.statusFlags[0] = '\0';
    _calc.repeatOp = 0;
    _calc.repeatOperand = 0.0;
}

// Stan "Error" — kasuje oczekujaca operacje (jak w zwyklym kalkulatorze:
// dalej tylko cyfra, MR albo C/CE).
static void _calcSetError() {
    _calc.error = true;
    _calc.value = 0.0;
    _calc.awaitingNext = true;
    _calc.pendingOp = 0;
    _calc.repeatOp = 0;
    _calc.entered = false;
}

// Ustawia wartosc do pokazania (wynik/funkcja) — nastepna cyfra zaczyna nowa liczbe.
static void _calcSetValue(double v) {
    if (!isfinite(v)) { _calcSetError(); return; }
    if (v == 0.0) v = 0.0;   // -0 -> 0
    _calc.value = v;
    _calc.error = false;
    _calc.awaitingNext = true;
}

// Usuwa zera konczace czesc ulamkowa (i sama kropke). Wolac TYLKO na
// zapisie bez wykladnika — mantyse z %e obcinamy przed doklejeniem
// wykladnika (wczesniej "1.5e+10" stawalo sie "1.5e+1").
static void _calcStripZeros(char* s) {
    char* dot = strchr(s, '.');
    if (!dot) return;
    char* end = s + strlen(s) - 1;
    while (end > dot && *end == '0') *end-- = '\0';
    if (end == dot) *end = '\0';
}

// Formatuje v do wyswietlenia: mant = czesc rysowana duzym fontem (cyfry,
// '.', '-'), ex = wykladnik ("e-5", pusty dla zapisu stalego) rysowany
// _CALC_FONT_EXP. Dobiera najwieksza precyzje, ktora miesci sie w
// _CALC_MAX_W px (mierzone getStrWidth). Bez rzutowania na long long
// (UB dla |v| > 9.2e18).
static void _calcFormatFit(U8G2& u8g2, double v, char* mant, size_t mantSz, char* ex, size_t exSz) {
    ex[0] = '\0';
    const double av = fabs(v);
    char buf[48];

    // 1) Zapis staly. >= 1e10 i tak sie nie zmiesci (10 cyfr = 270 px).
    if (av < 1e10) {
        u8g2.setFont(_CALC_FONT_BIG);
        for (int dec = 9; dec >= 0; dec--) {
            snprintf(buf, sizeof(buf), "%.*f", dec, v);
            _calcStripZeros(buf);
            if (u8g2.getStrWidth(buf) > _CALC_MAX_W) continue;
            // Bardzo male liczby (np. 1/70000 -> "0.0000143") traca w zapisie
            // stalym cyfry znaczace — wtedy wykladnik, chyba ze zapis jest dokladny.
            bool zero = (strcmp(buf, "0") == 0 || strcmp(buf, "-0") == 0);
            if (v != 0.0 && (zero || (av < 1e-3 && fabs(strtod(buf, nullptr) - v) > av * 1e-9))) break;
            strncpy(mant, buf, mantSz - 1);
            mant[mantSz - 1] = '\0';
            return;
        }
    }

    // 2) Zapis wykladniczy: mantysa duzym fontem + "eN" malym.
    for (int prec = 8; prec >= 0; prec--) {
        snprintf(buf, sizeof(buf), "%.*e", prec, v);
        char* e = strchr(buf, 'e');
        int expo = 0;
        if (e) { expo = atoi(e + 1); *e = '\0'; }
        _calcStripZeros(buf);   // tylko mantysa
        char eb[12];
        snprintf(eb, sizeof(eb), "e%d", expo);
        u8g2.setFont(_CALC_FONT_EXP);
        int we = u8g2.getStrWidth(eb);
        u8g2.setFont(_CALC_FONT_BIG);
        int wm = u8g2.getStrWidth(buf);
        if (wm + 2 + we <= _CALC_MAX_W || prec == 0) {
            strncpy(mant, buf, mantSz - 1);
            mant[mantSz - 1] = '\0';
            strncpy(ex, eb, exSz - 1);
            ex[exSz - 1] = '\0';
            return;
        }
    }
}

// Dopisuje cyfre/kropke do wpisu. Limit z PIKSELI (szerokosc na ekranie),
// nie ze znakow. Cyfry ZAWSZE trafiaja do bufora kodu AI — takze gdy ekran
// jest juz pelny (kod moze miec do 11 cyfr).
static void _calcAppendDigit(U8G2& u8g2, char d) {
    if (_calc.awaitingNext) {
        if (d == '.') strcpy(_calc.entry, "0.");
        else { _calc.entry[0] = d; _calc.entry[1] = '\0'; }
        _calc.awaitingNext = false;
        _calc.error = false;
    } else {
        size_t len = strlen(_calc.entry);
        bool zeroOnly = (len == 1 && _calc.entry[0] == '0') ||
                        (len == 2 && _calc.entry[0] == '-' && _calc.entry[1] == '0');
        if (d == '.' && strchr(_calc.entry, '.')) {
            // tylko jedna kropka
        } else if (d != '.' && zeroOnly) {
            _calc.entry[len - 1] = d;   // bez wiodacych zer: "0" + "5" -> "5"
        } else if (len + 1 < sizeof(_calc.entry)) {
            _calc.entry[len] = d;
            _calc.entry[len + 1] = '\0';
            u8g2.setFont(_CALC_FONT_BIG);
            if (u8g2.getStrWidth(_calc.entry) > _CALC_MAX_W) _calc.entry[len] = '\0';   // nie miesci sie
        }
    }
    _calc.value = strtod(_calc.entry, nullptr);
    _calc.entered = true;

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

// Pomocnicza: wykonuje "lhs OP rhs" i zwraca wynik. Bledy ustawia "Error".
static double _calcApply(double lhs, char op, double rhs, bool &err) {
    err = false;
    switch (op) {
        case '+': return lhs + rhs;
        case '-': return lhs - rhs;
        case '*': return lhs * rhs;
        case '/':
            if (rhs == 0.0) { err = true; return 0.0; }
            return lhs / rhs;
        default:  return rhs;
    }
}

static void _calcCompute() {
    if (_calc.error) return;
    char  op;
    double lhs, rhs;

    if (_calc.pendingOp != 0) {
        // Pierwsze "=" po wpisaniu liczby (mamy aktywna operacje)
        // Format: accumulator OP value = wynik
        op  = _calc.pendingOp;
        lhs = _calc.accumulator;
        rhs = _calc.value;
        // Zapamietaj do powtarzania: rhs i op
        _calc.repeatOp = op;
        _calc.repeatOperand = rhs;
    } else if (_calc.repeatOp != 0) {
        // Kolejne "=" — powtorz ostatnia operacje
        // Format: value OP repeatOperand = wynik
        op  = _calc.repeatOp;
        lhs = _calc.value;
        rhs = _calc.repeatOperand;
    } else {
        // Brak pendingOp i brak repeat — nic do zrobienia, "=" w pustce
        return;
    }

    bool err = false;
    double result = _calcApply(lhs, op, rhs, err);
    if (err || !isfinite(result)) {
        _calcSetError();
        return;
    }
    _calcSetValue(result);
    _calc.accumulator = result;
    _calc.pendingOp = 0;
    _calc.entered = false;
}

static void _calcSetOp(char op) {
    if (_calc.error) return;
    // Lancuch "2 + 3 *" -> 5 *. Liczy tez po funkcjach jednoargumentowych
    // (sqrt, %, MR, +/-): "2 + 9 sqrt * 3 =" -> 15 (wczesniej 9 — sqrt
    // gubil oczekujace "2 +").
    if (_calc.pendingOp != 0 && _calc.entered) {
        _calcCompute();
        if (_calc.error) return;
    }
    // Bez oczekujacej operacji: biezaca wartosc staje sie lewym argumentem.
    // Z oczekujaca, ale bez nowej wartosci ("2 + *"): tylko zmiana operatora.
    if (_calc.pendingOp == 0) _calc.accumulator = _calc.value;
    _calc.pendingOp = op;
    _calc.awaitingNext = true;
    _calc.entered = false;
    // Nowy operator — porzuc dotychczasowy repeat (zostanie nadpisany przy '=')
    _calc.repeatOp = 0;
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

    if (_calc.error) {
        // 42_tn nie ma liter — "Error" mniejszym fontem, wyrownane do prawej
        u8g2.setFont(_CALC_FONT_EXP);
        const char* t = "Error";
        u8g2.drawStr(256 - u8g2.getStrWidth(t) - 4, _CALC_BASE_Y - 10, t);
    } else if (!_calc.awaitingNext) {
        // Wpis uzytkownika — dokladnie to, co wpisal (limit szerokosci w _calcAppendDigit)
        u8g2.setFont(_CALC_FONT_BIG);
        int x = 256 - u8g2.getStrWidth(_calc.entry) - 4;
        if (x < 0) x = 0;
        u8g2.drawStr(x, _CALC_BASE_Y, _calc.entry);
    } else {
        // Wartosc (wynik) — sformatowana tak, zeby sie zmiescila
        char mant[48], ex[12];
        _calcFormatFit(u8g2, _calc.value, mant, sizeof(mant), ex, sizeof(ex));
        int we = 0;
        if (ex[0]) { u8g2.setFont(_CALC_FONT_EXP); we = u8g2.getStrWidth(ex) + 2; }
        u8g2.setFont(_CALC_FONT_BIG);
        int wm = u8g2.getStrWidth(mant);
        int x = 256 - (wm + we) - 4;
        if (x < 0) x = 0;
        u8g2.drawStr(x, _CALC_BASE_Y, mant);
        if (ex[0]) {
            // Wykladnik jak na kalkulatorze naukowym: maly, wyrownany do gory cyfr
            u8g2.setFont(_CALC_FONT_EXP);
            u8g2.drawStr(x + wm + 2, _CALC_BASE_Y - 20, ex);
        }
    }

    // v1.1.4: ikonka baterii calkowicie wylaczona w kalkulatorze (zero ADC
    // w czasie wpisywania). Bateria dostepna w Settings -> Bateria.

    u8g2.sendBuffer();
}

// ---------------------------------------------------------------------
//  Główna pętla kalkulatora
//  Wraca gdy:
//   - wpisano sekwencję zgadzającą się z aiUnlockCode → return
//  Ratunkowy reset fabryczny: przytrzymaj C/CE 5 s — menu potwierdzenia
//  (factory_reset.h) pojawia sie od razu, jeszcze w trakcie trzymania.
//  Dostepne bez wpisywania kodu AI — inaczej wadliwy klawisz uzyty w kodzie
//  blokowalby jedyna droge do jego zmiany.
// ---------------------------------------------------------------------
static void runCalculator(U8G2& u8g2) {
    powerSetCalculatorMode(true);   // po wybudzeniu bez WiFi (power.h)
    _calcReset();
    _calc.memory = 0.0;
    _calc.hasMemory = false;
    _calcUpdateFlags();
    _calcDraw(u8g2);

    // Lokalne (wczesniej static) — zerowane przy kazdym wejsciu.
    bool     cceHeld      = false;
    uint32_t cceHoldStart = 0;

    while (true) {
        inputScan();
        if (powerCheckSleep()) _calcDraw(u8g2);

        // --- Ratunkowy reset fabryczny: przytrzymaj C/CE 5s ---
        if (inputKeyDown(KEY_CCE)) {
            if (!cceHeld) { cceHeld = true; cceHoldStart = millis(); }
            if (millis() - cceHoldStart >= 5000) {
                factoryResetRun(u8g2, /*honorPanic=*/false);   // wraca tylko po anulowaniu
                cceHeld = false;
                _calcReset();
                _calcUpdateFlags();
                _calcDraw(u8g2);
                continue;
            }
        } else {
            cceHeld = false;
        }

        // v1.1.4: auto-shutdown wylaczony (early-battery-check w setup ten
        // sam efekt daje dla niskiej baterii — ten check w petli kalkulatora
        // mogl falszywie ssac ADC i powodowac glitche).

        // --- Sprawdź unlock code ---
        // Jeśli unlock buffer kończy się dokładnie tą samą sekwencją co
        // aiUnlockCode → wyjdź z kalkulatora
        size_t ulen = strlen(_calc.unlockBuf);
        size_t clen = strlen(kalkSettings.aiUnlockCode);
        if (clen > 0 && ulen >= clen) {
            const char* tail = _calc.unlockBuf + (ulen - clen);
            if (strcmp(tail, kalkSettings.aiUnlockCode) == 0) {
                u8g2.clearBuffer();
                u8g2.setFont(u8g2_font_logisoso22_tn);
                u8g2.drawStr(60, 40, "AI");
                u8g2.sendBuffer();
                delay(600);
                // Flaga panic mogla zostac ustawiona w kalkulatorze (panicCheck
                // w powerCheckSleep) — np. gdy klawisz panic to cyfra z kodu.
                // Bez skasowania main.cpp od razu wracalby do kalkulatora i tryb
                // AI bylby nieosiagalny.
                panicClear();
                powerSetCalculatorMode(false);
                return;
            }
        }

        // --- Cyfry ---
        if (inputKeyConsume(KEY_0))   { _calcAppendDigit(u8g2, '0'); _calcDraw(u8g2); continue; }
        if (inputKeyConsume(KEY_1))   { _calcAppendDigit(u8g2, '1'); _calcDraw(u8g2); continue; }
        if (inputKeyConsume(KEY_2))   { _calcAppendDigit(u8g2, '2'); _calcDraw(u8g2); continue; }
        if (inputKeyConsume(KEY_3))   { _calcAppendDigit(u8g2, '3'); _calcDraw(u8g2); continue; }
        if (inputKeyConsume(KEY_4))   { _calcAppendDigit(u8g2, '4'); _calcDraw(u8g2); continue; }
        if (inputKeyConsume(KEY_5))   { _calcAppendDigit(u8g2, '5'); _calcDraw(u8g2); continue; }
        if (inputKeyConsume(KEY_6))   { _calcAppendDigit(u8g2, '6'); _calcDraw(u8g2); continue; }
        if (inputKeyConsume(KEY_7))   { _calcAppendDigit(u8g2, '7'); _calcDraw(u8g2); continue; }
        if (inputKeyConsume(KEY_8))   { _calcAppendDigit(u8g2, '8'); _calcDraw(u8g2); continue; }
        if (inputKeyConsume(KEY_9))   { _calcAppendDigit(u8g2, '9'); _calcDraw(u8g2); continue; }
        if (inputKeyConsume(KEY_00))  { _calcAppendDigit(u8g2, '0'); _calcAppendDigit(u8g2, '0'); _calcDraw(u8g2); continue; }
        if (inputKeyConsume(KEY_DOT)) { _calcAppendDigit(u8g2, '.'); _calcDraw(u8g2); continue; }

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
            if (_calc.error) continue;
            if (!_calc.awaitingNext) {
                // W trakcie wpisu: przelacz znak w tekscie (zachowuje "0.50" itp.)
                size_t len = strlen(_calc.entry);
                if (_calc.entry[0] == '-') {
                    memmove(_calc.entry, _calc.entry + 1, len);   // razem z NUL
                } else if (len + 1 < sizeof(_calc.entry)) {
                    memmove(_calc.entry + 1, _calc.entry, len + 1);
                    _calc.entry[0] = '-';
                    u8g2.setFont(_CALC_FONT_BIG);
                    if (u8g2.getStrWidth(_calc.entry) > _CALC_MAX_W) memmove(_calc.entry, _calc.entry + 1, len + 1);
                }
                _calc.value = strtod(_calc.entry, nullptr);
            } else {
                _calcSetValue(-_calc.value);
            }
            _calc.entered = true;
            _calcDraw(u8g2);
            continue;
        }
        if (inputKeyConsume(KEY_PERCENT)) {
            // Jak w typowym kalkulatorze: a + b% = a + a*b/100,
            // a * b% = a*b/100 (a / b% = a/(b/100)), samo b% = b/100.
            if (_calc.error) continue;
            double v = _calc.value;
            if (_calc.pendingOp == '+' || _calc.pendingOp == '-') v = _calc.accumulator * v / 100.0;
            else                                                  v = v / 100.0;
            _calcSetValue(v);
            _calc.entered = true;
            _calcDraw(u8g2);
            continue;
        }
        if (inputKeyConsume(KEY_SQRT)) {
            if (_calc.error) continue;
            if (_calc.value < 0) {
                _calcSetError();
            } else {
                _calcSetValue(sqrt(_calc.value));
                _calc.entered = true;   // oczekujace "a OP" zostaje (licz przy = / operatorze)
            }
            _calcDraw(u8g2);
            continue;
        }

        // --- Pamięć ---
        // M+/M- jak w typowym kalkulatorze: najpierw dokoncz oczekujace
        // dzialanie ("2 + 3 M+" dodaje 5), potem dodaj wynik do pamieci.
        bool mPlus  = inputKeyConsume(KEY_MPLUS);
        bool mMinus = !mPlus && inputKeyConsume(KEY_MMINUS);
        if (mPlus || mMinus) {
            if (_calc.error) continue;
            if (_calc.pendingOp != 0) {
                _calcCompute();
                if (_calc.error) { _calcDraw(u8g2); continue; }
            }
            if (mMinus) _calc.memory -= _calc.value;
            else       _calc.memory += _calc.value;
            _calc.hasMemory = true;
            _calc.awaitingNext = true;
            _calcUpdateFlags();
            _calcDraw(u8g2);
            continue;
        }
        if (inputKeyConsume(KEY_MR)) {
            _calcSetValue(_calc.memory);   // awaitingNext = true: cyfra nadpisze, nie dopisze
            _calc.entered = true;
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

        // --- KEY_ARROW (▶) = backspace — kasuje ostatnia cyfre ---
        if (inputKeyConsume(KEY_ARROW)) {
            if (_calc.error || _calc.awaitingNext) {
                // Po operatorze / sqrt / bledzie — backspace czysci wartosc do 0
                strcpy(_calc.entry, "0");
                _calc.value = 0.0;
                _calc.error = false;
                _calc.awaitingNext = true;
                _calc.entered = true;
            } else {
                size_t len = strlen(_calc.entry);
                char removed = len > 0 ? _calc.entry[len - 1] : '\0';
                if (len > 0) _calc.entry[--len] = '\0';
                if (len == 0 || strcmp(_calc.entry, "-") == 0) {
                    strcpy(_calc.entry, "0");
                    _calc.value = 0.0;
                    _calc.awaitingNext = true;
                } else {
                    _calc.value = strtod(_calc.entry, nullptr);
                }
                // Skroc tez unlock buffer — tylko gdy skasowano cyfre (kropki tam nie ma)
                size_t ul = strlen(_calc.unlockBuf);
                if (removed >= '0' && removed <= '9' && ul > 0) _calc.unlockBuf[ul - 1] = '\0';
            }
            _calcDraw(u8g2);
            continue;
        }

        // --- KEY_MU — ignorujemy (zarezerwowany na panic) ---
        if (inputKeyConsume(KEY_MU)) {
            // ignoruj
        }

        delay(15);
    }
}
