#pragma once
// solve_screen.h — Rozwiazywanie zadan AI dla KalkMate
// Wywolanie: showSolveScreen(display);
//
// Tryby:
//   0 = Zdjecie (OV2640 → JPEG → serwer)
//   1 = Tekst    (klawiatura → serwer)
//
// Wymaga:
//   #include "settings_screen.h"    (kalkSettings)
//   #include "wifi_persist.h"       (wifiLoadSaved / wifiGetSavedSSID)
//   WiFi musi byc polaczony lub zostanie podjeta proba polaczenia

#include <Arduino.h>
#include <U8g2lib.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include "input.h"
#include "settings_screen.h"
#include "wifi_persist.h"
#include "kalkmate_certs.h"
#include "wifi_settings.h"  // klawiatura (_runKeyboard, itp.)
#include "panic.h"
#include "power.h"
#include "history.h"
#include "camera.h"         // camBegin / camCapture / camEnd
#include "offline_queue.h"  // kolejka zadan gdy brak WiFi
#include "offline_solver.h" // lokalne solvery (bez WiFi) — rownania, uklady, procenty, pochodne

#ifndef KALK_CAMERA_ENABLED
#define KALK_CAMERA_ENABLED 1
#endif

// Device ID = MAC ESP32 (12 hex znakow, np. "68FE71E43B94"). Stabilny —
// kazdy ESP32 ma fabrycznie inny MAC, niezmienny przez calos zycia chipu.
static String _solDeviceId() {
    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_WIFI_STA);
    char buf[16];
    snprintf(buf, sizeof(buf), "%02X%02X%02X%02X%02X%02X",
             mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    return String(buf);
}

// ---------------------------------------------------------------------------
// Konfiguracja serwera
// ---------------------------------------------------------------------------
#ifndef KALK_SERVER_URL
#define KALK_SERVER_URL "https://twojserwer.pl"
#endif
#ifndef KALK_API_KEY
#define KALK_API_KEY ""
#endif

#define _SOL_SOLVE_ENDPOINT  KALK_SERVER_URL "/api/device/solve"
#define _SOL_TEXT_MAX        2048   // max znakow zadania (input)

// UTF-8 polskie + typograficzne znaki -> ASCII (font 6x10 nie ma polskich glyphow).
// Sygnatura jak _testsTitleToAscii w tests.h.
inline String _solUtf8ToAscii(String s) {
    s.replace("ą", "a"); s.replace("Ą", "A");
    s.replace("ć", "c"); s.replace("Ć", "C");
    s.replace("ę", "e"); s.replace("Ę", "E");
    s.replace("ł", "l"); s.replace("Ł", "L");
    s.replace("ń", "n"); s.replace("Ń", "N");
    s.replace("ó", "o"); s.replace("Ó", "O");
    s.replace("ś", "s"); s.replace("Ś", "S");
    s.replace("ż", "z"); s.replace("Ż", "Z");
    s.replace("ź", "z"); s.replace("Ź", "Z");
    s.replace("–", "-"); s.replace("—", "-"); s.replace("−", "-");
    s.replace("„", "\""); s.replace("”", "\""); s.replace("“", "\"");
    s.replace("‘", "'"); s.replace("’", "'");
    s.replace("…", "...");
    s.replace("\xC2\xA0", " ");  // non-breaking space
    s.replace("°", "deg");
    s.replace("×", "x");  s.replace("·", "*");
    s.replace("÷", "/");
    return s;
}
#define _SOL_SOLUTION_MAX    24576  // max znakow odpowiedzi AI (24 KB, RAM)
#define _SOL_HTTP_TIMEOUT_MS 45000  // 45s timeout HTTP

// ---------------------------------------------------------------------------
// Piny przyciskow
// ---------------------------------------------------------------------------
#ifndef BTN_UP
#define BTN_UP    26
#endif
#ifndef BTN_DOWN
#define BTN_DOWN  12
#endif
#ifndef BTN_LEFT
#define BTN_LEFT  13
#endif
#ifndef BTN_RIGHT
#define BTN_RIGHT 14
#endif
#ifndef BTN_OK
#define BTN_OK    27
#endif

// ---------------------------------------------------------------------------
// Debounce
// ---------------------------------------------------------------------------
static unsigned long _solLastPress = 0;
#define _SOL_DEBOUNCE_MS 200

static bool _solBtn(int pin) {
    if (inputBtn(pin) == LOW) {
        unsigned long now = millis();
        if (now - _solLastPress > _SOL_DEBOUNCE_MS) {
            _solLastPress = now;
            return true;
        }
    }
    return false;
}

static void _solWaitRelease() {
    while (inputBtn(BTN_UP)    == LOW ||
           inputBtn(BTN_DOWN)  == LOW ||
           inputBtn(BTN_LEFT)  == LOW ||
           inputBtn(BTN_RIGHT) == LOW ||
           inputBtn(BTN_OK)    == LOW) {
        delay(10);
    }
    _solLastPress = millis();
}

static const char* _solT(const char* pl, const char* en, const char* de) {
    if (kalkSettings.language == 0) return pl;
    if (kalkSettings.language == 1) return en;
    return de;
}

// ---------------------------------------------------------------------------
// Pomocnik: rysowanie "spinera" ladowania
// ---------------------------------------------------------------------------
static void _solDrawLoading(U8G2 &d, const char* msg, int frame) {
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);
    d.drawStr(2, 20, msg);
    // Prosta animacja: [/ - \ |]
    const char* frames[] = {"/", "-", "\\", "|"};
    char anim[4];
    snprintf(anim, sizeof(anim), "[%s]", frames[frame % 4]);
    d.drawStr(120, 40, anim);
    d.sendBuffer();
}

// ---------------------------------------------------------------------------
// Pomocnik: ekran bledu
// ---------------------------------------------------------------------------
static void _solDrawError(U8G2 &d, const char* line1, const char* line2) {
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);
    d.drawStr(2, 16, _solT("! Blad !", "! Error !", "! Fehler !"));
    d.drawHLine(0, 18, 256);
    // Polskie znaki w komunikatach z serwera -> ASCII (bo font nie ma glyphow)
    String l1 = _solUtf8ToAscii(String(line1 ? line1 : ""));
    String l2 = _solUtf8ToAscii(String(line2 ? line2 : ""));
    d.drawStr(2, 32, l1.c_str());
    if (l2.length() > 0) d.drawStr(2, 46, l2.c_str());
    d.setFont(u8g2_font_5x7_tf);
    d.drawStr(2, 62, _solT("OK = powrot", "OK = back", "OK = zurueck"));
    d.sendBuffer();
    _solWaitRelease();
    while (!_solBtn(BTN_OK) && !_solBtn(BTN_LEFT)) delay(20);
    _solWaitRelease();
}

// ---------------------------------------------------------------------------
// Konwerter LaTeX -> czytelny UTF-8 dla OLED (z polskimi znakami).
// Renderowane czcionka 6x12_te przez drawUTF8 (ma polskie glyphy + greke +
// symbole). Obsluga: \frac, \sqrt, ^ _ (potegi/indeksy), greka, operatory,
// relacje, strzalki. Polskie znaki UTF-8 przepisywane bez zmian.
// ---------------------------------------------------------------------------

// Dlugosc znaku UTF-8 wg bajtu wiodacego.
static inline int _utf8Len(uint8_t b) {
    if (b < 0x80) return 1;
    if ((b >> 5) == 0x6) return 2;
    if ((b >> 4) == 0xE) return 3;
    if ((b >> 3) == 0x1E) return 4;
    return 1;
}

// Tablica komend LaTeX -> UTF-8 (greka, operatory, relacje, strzalki).
struct _SolSym { const char* cmd; const char* utf8; };
static const _SolSym _SOL_SYMS[] = {
    {"alpha","α"},{"beta","β"},{"gamma","γ"},{"delta","δ"},{"epsilon","ε"},
    {"varepsilon","ε"},{"zeta","ζ"},{"eta","η"},{"theta","θ"},{"vartheta","θ"},
    {"iota","ι"},{"kappa","κ"},{"lambda","λ"},{"mu","μ"},{"nu","ν"},{"xi","ξ"},
    {"pi","π"},{"rho","ρ"},{"sigma","σ"},{"tau","τ"},{"upsilon","υ"},
    {"phi","φ"},{"varphi","φ"},{"chi","χ"},{"psi","ψ"},{"omega","ω"},
    {"Gamma","Γ"},{"Delta","Δ"},{"Theta","Θ"},{"Lambda","Λ"},{"Xi","Ξ"},
    {"Pi","Π"},{"Sigma","Σ"},{"Phi","Φ"},{"Psi","Ψ"},{"Omega","Ω"},
    {"cdot","·"},{"times","×"},{"div","÷"},{"pm","±"},{"mp","∓"},{"ast","*"},
    {"leq","≤"},{"le","≤"},{"geq","≥"},{"ge","≥"},{"neq","≠"},{"ne","≠"},
    {"approx","≈"},{"equiv","≡"},{"cong","≅"},{"sim","~"},{"propto","∝"},
    {"infty","∞"},{"partial","∂"},{"nabla","∇"},{"prime","′"},
    {"rightarrow","→"},{"to","→"},{"leftarrow","←"},{"leftrightarrow","↔"},
    {"Rightarrow","⇒"},{"implies","⇒"},{"Leftarrow","⇐"},{"iff","⇔"},
    {"Leftrightarrow","⇔"},{"mapsto","→"},
    {"in","∈"},{"notin","∉"},{"subset","⊂"},{"subseteq","⊆"},{"supset","⊃"},
    {"cup","∪"},{"cap","∩"},{"emptyset","∅"},{"varnothing","∅"},
    {"forall","∀"},{"exists","∃"},{"neg","¬"},{"lnot","¬"},
    {"land","∧"},{"wedge","∧"},{"lor","∨"},{"vee","∨"},
    {"sum","Σ"},{"prod","Π"},{"int","∫"},{"angle","∠"},{"perp","⊥"},
    {"parallel","∥"},{"ldots","…"},{"dots","…"},{"cdots","…"},
    {"deg","°"},{"circ","°"},{"degree","°"},{"mathbb",""},
    {"left",""},{"right",""},{"quad"," "},{"qquad","  "},
};
static const int _SOL_SYM_N = sizeof(_SOL_SYMS) / sizeof(_SOL_SYMS[0]);

// Znajduje koniec klamry. s wskazuje ZA '{'. Zwraca dlugosc zawartosci (do
// pasujacego '}'), z obsluga zagniezdzen.
static int _solBraceSpan(const char* s, int n) {
    int depth = 1, i = 0;
    while (i < n) {
        if (s[i] == '{') depth++;
        else if (s[i] == '}') { if (--depth == 0) return i; }
        i++;
    }
    return n;
}

// Rekurencyjny emiter: przetwarza span [s, s+n) LaTeX -> UTF-8 do dst.
static void _solLatexEmit(const char* s, int n, char* dst, int& di, int cap) {
    int i = 0;
    while (i < n && di < cap - 1) {
        char c = s[i];

        if (c == '\\') {
            // \\ -> nowa linia
            if (i + 1 < n && s[i + 1] == '\\') { if (di < cap - 1) dst[di++] = '\n'; i += 2; continue; }
            // \[ \] \( \) -> usun (delimitery)
            if (i + 1 < n && (s[i+1]=='['||s[i+1]==']'||s[i+1]=='('||s[i+1]==')')) { i += 2; continue; }
            // \{ \} -> dosłowna klamra
            if (i + 1 < n && (s[i+1]=='{'||s[i+1]=='}')) { if (di<cap-1) dst[di++]=s[i+1]; i += 2; continue; }
            // \, \; \: \! -> spacja / nic
            if (i + 1 < n && (s[i+1]==','||s[i+1]==';'||s[i+1]==':')) { if (di<cap-1) dst[di++]=' '; i += 2; continue; }
            if (i + 1 < n && s[i+1]=='!') { i += 2; continue; }
            // slowo komendy
            int j = i + 1;
            while (j < n && ((s[j]>='a'&&s[j]<='z')||(s[j]>='A'&&s[j]<='Z'))) j++;
            int wlen = j - i - 1;
            // \frac{A}{B} -> (A)/(B)
            if (wlen == 4 && strncmp(s+i+1,"frac",4)==0) {
                i = j;
                if (i<n && s[i]=='{') { i++; int a=_solBraceSpan(s+i,n-i); if(di<cap-1)dst[di++]='('; _solLatexEmit(s+i,a,dst,di,cap); if(di<cap-1)dst[di++]=')'; i+=a; if(i<n&&s[i]=='}')i++; }
                if (di<cap-1) dst[di++]='/';
                if (i<n && s[i]=='{') { i++; int b=_solBraceSpan(s+i,n-i); if(di<cap-1)dst[di++]='('; _solLatexEmit(s+i,b,dst,di,cap); if(di<cap-1)dst[di++]=')'; i+=b; if(i<n&&s[i]=='}')i++; }
                continue;
            }
            // \sqrt[n]{x} / \sqrt{x} -> [n]√(x) / √(x)
            if (wlen == 4 && strncmp(s+i+1,"sqrt",4)==0) {
                i = j;
                if (i<n && s[i]=='[') { i++; while(i<n && s[i]!=']'){ if(di<cap-1)dst[di++]=s[i]; i++; } if(i<n&&s[i]==']')i++; }
                const char* r="√"; while(*r && di<cap-1) dst[di++]=*r++;
                if (i<n && s[i]=='{') { i++; int a=_solBraceSpan(s+i,n-i); if(di<cap-1)dst[di++]='('; _solLatexEmit(s+i,a,dst,di,cap); if(di<cap-1)dst[di++]=')'; i+=a; if(i<n&&s[i]=='}')i++; }
                continue;
            }
            // \text{...} \mathrm{...} -> zawartosc
            if ((wlen==4 && strncmp(s+i+1,"text",4)==0) || (wlen==6 && strncmp(s+i+1,"mathrm",6)==0)) {
                i = j;
                if (i<n && s[i]=='{') { i++; int a=_solBraceSpan(s+i,n-i); _solLatexEmit(s+i,a,dst,di,cap); i+=a; if(i<n&&s[i]=='}')i++; }
                continue;
            }
            // tablica symboli
            int found = -1;
            for (int k=0;k<_SOL_SYM_N;k++){ const char* cm=_SOL_SYMS[k].cmd; int cl=(int)strlen(cm); if(cl==wlen && strncmp(s+i+1,cm,cl)==0){ found=k; break; } }
            if (found >= 0) {
                const char* u=_SOL_SYMS[found].utf8; while(*u && di<cap-1) dst[di++]=*u++;
                i = j;
                if (i<n && s[i]==' ') i++; // zjedz spacje po komendzie
                continue;
            }
            // nieznana \komenda -> usun backslash, zostaw slowo
            if (wlen > 0) { for(int k=i+1;k<j && di<cap-1;k++) dst[di++]=s[k]; i = j; continue; }
            i++; continue;  // samotny backslash
        }

        if (c == '$') { i++; continue; }
        if (c == '{' || c == '}') { i++; continue; }  // pojedyncze klamry -> usun
        if (c == '&') { if (di<cap-1) dst[di++]=' '; i++; continue; }  // separator w macierzach
        if (c == '*' && i+1<n && s[i+1]=='*') { i += 2; continue; }    // **bold** markdown -> usun

        // ^ potega
        if (c == '^') {
            i++;
            if (di<cap-1) dst[di++]='^';
            if (i<n && s[i]=='{') { i++; int a=_solBraceSpan(s+i,n-i);
                if (a>1) { if(di<cap-1)dst[di++]='('; _solLatexEmit(s+i,a,dst,di,cap); if(di<cap-1)dst[di++]=')'; }
                else { _solLatexEmit(s+i,a,dst,di,cap); }
                i+=a; if(i<n&&s[i]=='}')i++;
            } else if (i<n) { int cl=_utf8Len((uint8_t)s[i]); for(int q=0;q<cl&&i<n&&di<cap-1;q++) dst[di++]=s[i++]; }
            continue;
        }
        // _ indeks dolny
        if (c == '_') {
            i++;
            if (di<cap-1) dst[di++]='_';
            if (i<n && s[i]=='{') { i++; int a=_solBraceSpan(s+i,n-i); _solLatexEmit(s+i,a,dst,di,cap); i+=a; if(i<n&&s[i]=='}')i++; }
            else if (i<n) { int cl=_utf8Len((uint8_t)s[i]); for(int q=0;q<cl&&i<n&&di<cap-1;q++) dst[di++]=s[i++]; }
            continue;
        }

        // zwykly bajt (w tym UTF-8 wielobajtowy — polskie znaki kopiowane jak sa)
        dst[di++] = c; i++;
    }
}

// Sygnatura jak stary _solFormatMath (zachowane wywolania).
static void _solFormatMath(const char* src, char* dst, int dstSize) {
    int di = 0;
    _solLatexEmit(src, (int)strlen(src), dst, di, dstSize);
    dst[di] = '\0';
}

// ---------------------------------------------------------------------------
// Wyswietlanie rozwiazania (przewijane UP/DOWN, wyjscie LEFT)
// Tekst jest zawijany reczne co ~40 znakow na linie ekranu 6x10
// ---------------------------------------------------------------------------
#define _SOL_LINES_MAX    150   // wiecej linii dla dlugich, szczegolowych rozwiazan
#define _SOL_LINE_LEN     160   // bajty/linie (UTF-8: polskie znaki i symbole 2-3 B)

// Rysuje linie UTF-8 (font 6x12_te przez drawUTF8 — ma polskie glyphy/greke/
// symbole) z obsluga poteg: "e^3" -> "e" + "3" malym fontem wyzej. Iteruje po
// kodpunktach UTF-8 (nie bajtach). Zwraca szerokosc w px.
static int _solDrawMathLine(U8G2 &d, int x, int y, const char* text) {
    int xi = x;
    int len = strlen(text);
    int i = 0;
    while (i < len) {
        if (text[i] == '^' && i + 1 < len) {
            i++; // pominij ^
            char exp[24] = "";
            int elen = 0;
            if (text[i] == '(') {
                i++;
                while (i < len && text[i] != ')' && elen < 22) exp[elen++] = text[i++];
                if (i < len && text[i] == ')') i++;
            } else {
                // jeden kodpunkt (konwerter wstawia ^(...) dla wieloznakowych)
                int cl = _utf8Len((uint8_t)text[i]);
                for (int q = 0; q < cl && i < len && elen < 22; q++) exp[elen++] = text[i++];
            }
            exp[elen] = '\0';
            if (elen > 0) {
                d.setFont(u8g2_font_5x7_tf);
                int w = d.drawUTF8(xi, y - 4, exp);
                xi += (w > 0 ? w : elen * 5) + 1;
            }
        } else {
            int cl = _utf8Len((uint8_t)text[i]);
            char ch[5];
            int q = 0;
            for (; q < cl && i < len; q++) ch[q] = text[i++];
            ch[q] = '\0';
            d.setFont(u8g2_font_6x12_te);
            int w = d.drawUTF8(xi, y, ch);
            xi += (w > 0 ? w : 6);
        }
    }
    return xi - x;
}

static void _solDisplaySolution(U8G2 &d, const char* solution, const char* headerLabel = "AI") {
    // Wylacz auto-sleep — user czyta dluzsza odpowiedz, ekran nie ma sie wylaczyc
    powerSetInhibit(true);

    // Font 6x10, ekran 256x64
    // Uklad: naglowek y=8 (linia 0-9), separtor y=10
    // Linie tekstu: y=21, 33, 45 (3 widoczne, odstep 12px)
    // Pasek dolny: y=57-63
    const int VISIBLE  = 3;   // 3 linie tekstu na raz
    const int LINE_H   = 12;  // wysokosc linii px
    const int LINE_Y0  = 21;  // y bazowe pierwszej linii
    // Maks znakow na linie przy foncie 6px: (256-4)/6 = 42
    const int LINE_CHARS = 41;

    // Konwersja LaTeX -> UTF-8. Polskie znaki ZACHOWANE (font 6x12_te je ma).
    static char _solConverted[_SOL_SOLUTION_MAX + 1];
    _solFormatMath(solution, _solConverted, sizeof(_solConverted));

    // Podziel na linie — liczymy KODPUNKTY UTF-8 (nie bajty), zeby nie urwac w
    // srodku znaku wielobajtowego i zawijac po realnej liczbie widocznych znakow.
    static char _lines[_SOL_LINES_MAX][_SOL_LINE_LEN + 1];
    int lineCount = 0;
    int slen = strlen(_solConverted);
    int pos  = 0;

    while (pos < slen && lineCount < _SOL_LINES_MAX) {
        int end = pos;
        int cols = 0;
        int lastSpace = -1;
        while (end < slen && cols < LINE_CHARS) {
            if (_solConverted[end] == '\n') break;
            if (_solConverted[end] == ' ') lastSpace = end;
            end += _utf8Len((uint8_t)_solConverted[end]);
            cols++;
        }
        // Zawroc do ostatniej spacji jesli urwalismy w srodku slowa
        if (end < slen && _solConverted[end] != '\n' && cols >= LINE_CHARS && lastSpace > pos)
            end = lastSpace;
        int len = end - pos;
        if (len > _SOL_LINE_LEN) len = _SOL_LINE_LEN;
        strncpy(_lines[lineCount], _solConverted + pos, len);
        _lines[lineCount][len] = '\0';
        lineCount++;
        pos = end;
        if (pos < slen && (_solConverted[pos] == '\n' || _solConverted[pos] == ' '))
            pos++;
    }

    Serial.printf("[SOL] lineCount=%d\n", lineCount);

    // Czekaj na puszczenie przyciskow
    while (inputBtn(BTN_UP)    == LOW || inputBtn(BTN_DOWN)  == LOW ||
           inputBtn(BTN_LEFT)  == LOW || inputBtn(BTN_RIGHT) == LOW ||
           inputBtn(BTN_OK)    == LOW) {
        delay(10);
    }
    delay(200);
    _solLastPress = millis();

    bool needRedraw = true;
    int scroll = 0;

    while (true) {
        // Wymuszaj sprawdzenie panic key — sleep jest tu inhibitowany,
        // wiec powerCheckSleep() (gdzie zwykle siedzi panicCheck) zwraca
        // natychmiast i panic nigdy by nie byl wykryty.
        panicCheck();
        if (panicTriggered()) {
            powerSetInhibit(false);
            return;
        }
        if (needRedraw) {
            d.clearBuffer();

            // Naglowek
            d.setFont(u8g2_font_5x7_tf);
            char hdr[32];
            snprintf(hdr, sizeof(hdr), "%s %d-%d/%d", headerLabel,
                     scroll + 1,
                     min(scroll + VISIBLE, lineCount),
                     lineCount);
            d.drawStr(2, 8, hdr);
            // Strzalki w naglowku
            if (scroll > 0)                        d.drawStr(240, 8, "^");
            if (scroll + VISIBLE < lineCount)       d.drawStr(248, 8, "v");
            d.drawHLine(0, 10, 256);

            // Linie tekstu z obsluga poteg
            for (int i = 0; i < VISIBLE; i++) {
                int li = scroll + i;
                if (li >= lineCount) break;
                _solDrawMathLine(d, 2, LINE_Y0 + i * LINE_H, _lines[li]);
            }

            // Stopka
            d.drawHLine(0, 55, 256);
            d.setFont(u8g2_font_5x7_tf);
            d.drawStr(2, 63, _solT("< wyjdz  UP/DN scroll", "< exit  UP/DN scroll", "< raus  UP/DN scroll"));

            d.sendBuffer();
            needRedraw = false;
        }

        unsigned long now = millis();
        if (now - _solLastPress > 180UL) {
            if (inputBtn(BTN_UP) == LOW) {
                _solLastPress = now;
                Serial.println("[SOL] UP");
                if (scroll > 0) { scroll--; needRedraw = true; }
            } else if (inputBtn(BTN_DOWN) == LOW) {
                _solLastPress = now;
                Serial.println("[SOL] DOWN");
                if (scroll + VISIBLE < lineCount) { scroll++; needRedraw = true; }
                else Serial.printf("[SOL] at bottom scroll=%d VISIBLE=%d lineCount=%d\n", scroll, VISIBLE, lineCount);
            } else if (inputBtn(BTN_LEFT) == LOW || inputBtn(BTN_OK) == LOW) {
                _solLastPress = now;
                Serial.println("[SOL] EXIT");
                while (inputBtn(BTN_LEFT) == LOW || inputBtn(BTN_OK) == LOW) delay(10);
                delay(100);
                powerSetInhibit(false);   // przywroc auto-sleep przed wyjsciem
                return;
            }
        }
        delay(10);
    }
}

// ---------------------------------------------------------------------------
// Sprawdz WiFi — polacz jesli nie jest polaczony (uzyj zapisanych danych)
// Zwraca true jesli polaczony
// ---------------------------------------------------------------------------
// Forward decl z device_account.h (zaimplementowane w main.cpp helperze)
extern bool accountRegisterOnce();

static bool _solEnsureWifi(U8G2 &d) {
    if (WiFi.status() == WL_CONNECTED) {
        accountRegisterOnce();
        return true;
    }

    // Sprobuj zaladowac zapisane dane
    char ssid[33] = "";
    char pass[64] = "";
    wifiLoadSaved(ssid, sizeof(ssid), pass, sizeof(pass));

    if (ssid[0] == '\0') {
        _solDrawError(d,
            _solT("Brak WiFi!", "No WiFi!", "Kein WLAN!"),
            _solT("Ustaw siec w menu.", "Set network in menu.", "WLAN im Menue einstellen."));
        return false;
    }

    // Proba polaczenia (z cache BSSID+kanal dla szybszego reconnectu)
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);
    char ln[48];
    snprintf(ln, sizeof(ln), _solT("Lacze z: %s", "Connecting: %s", "Verbinde: %s"), ssid);
    d.drawStr(2, 24, ln);
    d.drawStr(2, 38, "...");
    d.sendBuffer();

    WiFi.mode(WIFI_STA);
    wifiFastBegin(ssid, pass);  // cache BSSID+kanal pomija skan (~1-3s)

    unsigned long start = millis();
    int frame = 0;
    while (WiFi.status() != WL_CONNECTED) {
        if (millis() - start > 15000) {
            _solDrawError(d,
                _solT("Blad WiFi!", "WiFi failed!", "WLAN Fehler!"),
                _solT("Sprawdz haslo.", "Check password.", "Passwort pruefen."));
            return false;
        }
        _solDrawLoading(d, _solT("Laczenie WiFi...", "Connecting WiFi...", "Verbinde WLAN..."), frame++);
        delay(250);
    }
    wifiSaveBssidChannel();      // zapisz BSSID+kanal do NVS na nastepny raz
    accountRegisterOnce();       // zarejestruj device po pierwszym polaczeniu
    return true;
}

// ---------------------------------------------------------------------------
// _solSendText — wyslij zadanie tekstowe do API i pokaz wynik.
// Wymaga aktywnego WiFi. Tekst w taskText (C-string).
// ---------------------------------------------------------------------------
static void _solSendText(U8G2 &d, const char* taskText) {
    char licKey[40];
    wifiLoadLicense(licKey, sizeof(licKey));

    // Zbuduj JSON body
    String jsonBody = "{\"mode\":\"text\",\"text\":\"";
    for (int i = 0; taskText[i]; i++) {
        char c = taskText[i];
        if (c == '"')       jsonBody += "\\\"";
        else if (c == '\\') jsonBody += "\\\\";
        else if (c == '\n') jsonBody += "\\n";
        else                jsonBody += c;
    }
    jsonBody += "\"}";

    WiFiClientSecure client;
    client.setCACert(KALKMATE_CA_CERT);
    client.setTimeout(60);
    HTTPClient http;
    http.begin(client, _SOL_SOLVE_ENDPOINT);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-api-key", KALK_API_KEY);
    http.addHeader("x-device-id", _solDeviceId());
    http.addHeader("x-fw-version", FW_VERSION);
    if (licKey[0]) http.addHeader("x-license-key", licKey);
    http.addHeader("x-solve-mode", String((int)kalkSettings.solveMode));
    { char dt[68]=""; wifiLoadDeviceToken(dt,sizeof(dt)); if(dt[0]) http.addHeader("x-device-token",dt); }
    http.setTimeout(_SOL_HTTP_TIMEOUT_MS);

    Serial.printf("[SOL] POST text %d B\n", jsonBody.length());

    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);
    d.drawStr(2, 24, _solT("AI rozwiazuje zadanie", "AI solving problem", "KI loest die Aufgabe"));
    d.setFont(u8g2_font_5x7_tf);
    d.drawStr(2, 40, _solT("Prosze czekac...", "Please wait...", "Bitte warten..."));
    d.sendBuffer();

    int httpCode = http.POST(jsonBody);
    String resp  = http.getString();
    http.end();

    Serial.printf("[SOL] HTTP %d, resp len=%d\n", httpCode, resp.length());

    if (httpCode == 402) {
        // Serwer zwraca 402 gdy saldo tokenow < 1000 (skonczyly sie).
        _solDrawError(d, _solT("Brak tokenow!", "Out of tokens!", "Keine Tokens mehr!"),
                      _solT("Dokup w sklepie: kalkmate.pl", "Buy more at kalkmate.pl", "Nachkaufen: kalkmate.pl"));
        return;
    }

    if (httpCode != 200) {
        int errIdx = resp.indexOf("\"error\":\"");
        char errMsg[64] = "";
        if (errIdx >= 0) {
            int s2 = errIdx + 9, e2 = resp.indexOf("\"", s2);
            if (e2 > s2) strncpy(errMsg, resp.substring(s2, e2).c_str(), sizeof(errMsg)-1);
        } else {
            snprintf(errMsg, sizeof(errMsg), "HTTP %d", httpCode);
        }
        _solDrawError(d, _solT("Blad API:", "API error:", "API Fehler:"), errMsg);
        return;
    }

    int solIdx = resp.indexOf("\"solution\":\"");
    if (solIdx < 0) { _solDrawError(d, _solT("Brak odpowiedzi", "No answer", "Keine Antwort"), ""); return; }

    int solStart = solIdx + 12;
    static char _stSolution[_SOL_SOLUTION_MAX + 1];
    int spos = 0;
    for (int i = solStart; i < (int)resp.length() && spos < _SOL_SOLUTION_MAX; i++) {
        char c = resp[i];
        if (c == '"' && (i == 0 || resp[i-1] != '\\')) break;
        if (c == '\\' && i + 1 < (int)resp.length()) {
            char nx = resp[i+1];
            if (nx == 'n')       { _stSolution[spos++] = '\n'; i++; }
            else if (nx == '"')  { _stSolution[spos++] = '"';  i++; }
            else if (nx == '\\') { _stSolution[spos++] = '\\'; i++; }
            else                 { _stSolution[spos++] = c; }
        } else {
            _stSolution[spos++] = c;
        }
    }
    _stSolution[spos] = '\0';

    historySave(String(taskText), String(_stSolution));
    _solDisplaySolution(d, _stSolution);
}

// ---------------------------------------------------------------------------
// _solSendJpeg — wyslij JPEG do API przez multipart/form-data i pokaz wynik.
// Wymaga aktywnego WiFi. jpegBuf zarzadzany przez wywolujacego (nie zwalniany tu).
// ---------------------------------------------------------------------------
static void _solSendJpeg(U8G2 &d, const uint8_t* jpegBuf, size_t jpegLen) {
    char licKey[40];
    wifiLoadLicense(licKey, sizeof(licKey));

    // Zbuduj multipart body w PSRAM
    static const char _mpHdr[] =
        "--KalkMateB\r\n"
        "Content-Disposition: form-data; name=\"image\"; filename=\"photo.jpg\"\r\n"
        "Content-Type: image/jpeg\r\n"
        "\r\n";
    static const char _mpFtr[] = "\r\n--KalkMateB--\r\n";
    const size_t hdrLen  = sizeof(_mpHdr) - 1;
    const size_t ftrLen  = sizeof(_mpFtr) - 1;
    size_t bodySize = hdrLen + jpegLen + ftrLen;
    uint8_t* bodyBuf = (uint8_t*)ps_malloc(bodySize);
    if (!bodyBuf) {
        _solDrawError(d, _solT("Brak pamieci!", "Out of memory!", "Kein Speicher!"), "");
        return;
    }
    memcpy(bodyBuf,                   _mpHdr, hdrLen);
    memcpy(bodyBuf + hdrLen,          jpegBuf, jpegLen);
    memcpy(bodyBuf + hdrLen + jpegLen, _mpFtr, ftrLen);

    WiFiClientSecure client;
    client.setCACert(KALKMATE_CA_CERT);
    client.setTimeout(60);
    HTTPClient http;
    http.begin(client, _SOL_SOLVE_ENDPOINT);
    http.addHeader("Content-Type", "multipart/form-data; boundary=KalkMateB");
    http.addHeader("x-api-key", KALK_API_KEY);
    http.addHeader("x-device-id", _solDeviceId());
    http.addHeader("x-fw-version", FW_VERSION);
    if (licKey[0]) http.addHeader("x-license-key", licKey);
    http.addHeader("x-solve-mode", String((int)kalkSettings.solveMode));
    { char dt[68]=""; wifiLoadDeviceToken(dt,sizeof(dt)); if(dt[0]) http.addHeader("x-device-token",dt); }
    http.setTimeout(_SOL_HTTP_TIMEOUT_MS);

    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);
    d.drawStr(2, 24, _solT("AI rozwiazuje zadanie", "AI solving problem", "KI loest die Aufgabe"));
    d.setFont(u8g2_font_5x7_tf);
    d.drawStr(2, 40, _solT("Prosze czekac...", "Please wait...", "Bitte warten..."));
    d.sendBuffer();

    int httpCode = http.POST(bodyBuf, (int)bodySize);
    free(bodyBuf);

    if (httpCode <= 0) {
        http.end();
        _solDrawError(d, _solT("Blad polaczenia", "Connection error", "Verbindungsfehler"), "");
        return;
    }

    String resp = http.getString();
    http.end();

    if (httpCode == 402) {
        // Serwer zwraca 402 gdy saldo tokenow < 1000 (skonczyly sie).
        _solDrawError(d, _solT("Brak tokenow!", "Out of tokens!", "Keine Tokens mehr!"),
                      _solT("Dokup w sklepie: kalkmate.pl", "Buy more at kalkmate.pl", "Nachkaufen: kalkmate.pl"));
        return;
    }

    if (httpCode != 200) {
        int errIdx = resp.indexOf("\"error\":\"");
        char errMsg[64] = "";
        if (errIdx >= 0) {
            int s2 = errIdx + 9, e2 = resp.indexOf("\"", s2);
            if (e2 > s2) strncpy(errMsg, resp.substring(s2, e2).c_str(), sizeof(errMsg)-1);
        } else {
            snprintf(errMsg, sizeof(errMsg), "HTTP %d", httpCode);
        }
        _solDrawError(d, _solT("Blad API:", "API error:", "API Fehler:"), errMsg);
        return;
    }

    int solIdx = resp.indexOf("\"solution\":\"");
    if (solIdx < 0) { _solDrawError(d, _solT("Brak odpowiedzi", "No answer", "Keine Antwort"), ""); return; }

    int solStart = solIdx + 12;
    static char _jpSolution[_SOL_SOLUTION_MAX + 1];
    int spos = 0;
    for (int i = solStart; i < (int)resp.length() && spos < _SOL_SOLUTION_MAX; i++) {
        char c = resp[i];
        if (c == '"' && (i == 0 || resp[i-1] != '\\')) break;
        if (c == '\\' && i + 1 < (int)resp.length()) {
            char nx = resp[i+1];
            if (nx == 'n')       { _jpSolution[spos++] = '\n'; i++; }
            else if (nx == '"')  { _jpSolution[spos++] = '"';  i++; }
            else if (nx == '\\') { _jpSolution[spos++] = '\\'; i++; }
            else                 { _jpSolution[spos++] = c; }
        } else {
            _jpSolution[spos++] = c;
        }
    }
    _jpSolution[spos] = '\0';

    historySave(String("[Zdjecie]"), String(_jpSolution));
    _solDisplaySolution(d, _jpSolution);
}

// ---------------------------------------------------------------------------
// Tryb TEXT: klawiatura → wyslij do API → pokaz wynik
// ---------------------------------------------------------------------------
// Opcjonalny prefill — gdy != nullptr, klawiatura otwiera sie z tym tekstem
// (uzywane przy "edytuj pytanie" z historii).
static void _solRunTextMode(U8G2 &d, const char* prefill = nullptr) {
    // Klawiatura: label "Zadanie:" zamiast "Haslo:"
    static char taskText[_SOL_TEXT_MAX + 1];
    if (prefill && prefill[0]) {
        strncpy(taskText, prefill, sizeof(taskText) - 1);
        taskText[sizeof(taskText) - 1] = '\0';
    } else {
        taskText[0] = '\0';
    }

    // Uzyj klawiatury z wifi_settings.h, zmien tylko naglowek
    // _runKeyboard rysuje "Haslo:" — tutaj nadpiszemy przez wlasny wrapper
    // Zamiast kopiowac cala klawiature, skorzystamy z tej samej funkcji
    // i po prostu akceptujemy naglowek "Haslo:" (jezyk-agnostycznie OK)
    bool saved = _runKeyboard(d, taskText, sizeof(taskText),
                              _solT("Zadanie: ", "Problem: ", "Aufgabe: "));
    if (!saved || taskText[0] == '\0') return;

    if (!_solEnsureWifi(d)) {
        // Brak WiFi — zakolejkuj zadanie
        if (offlineQueueAddText(taskText)) {
            d.clearBuffer();
            d.setFont(u8g2_font_6x10_tf);
            d.drawStr(2, 18, _solT("Brak WiFi.", "No WiFi.", "Kein WLAN."));
            d.drawStr(2, 32, _solT("Zadanie w kolejce.", "Task queued.", "Aufgabe in Warteschlange."));
            d.setFont(u8g2_font_5x7_tf);
            d.drawStr(2, 48, _solT("Wysylka po polaczeniu WiFi.", "Will send when WiFi available.", "Senden nach WLAN-Verbindung."));
            d.sendBuffer();
            _solWaitRelease();
            delay(2000);
        }
        return;
    }
    _solSendText(d, taskText);
}

// ---------------------------------------------------------------------------
// Pomocnik: bramki kadrowania (narozniki L) w trybie XOR — widoczne na kazdym tle
// ---------------------------------------------------------------------------
static void _solDrawCorners(U8G2 &d, int x, int y, int w, int h) {
    const int L = 8;            // dlugosc ramienia narożnika
    d.setDrawColor(2);          // XOR — narozniki widoczne i na jasnym, i na ciemnym
    d.drawHLine(x, y, L);                  d.drawVLine(x, y, L);                  // gora-lewo
    d.drawHLine(x + w - L, y, L);          d.drawVLine(x + w - 1, y, L);          // gora-prawo
    d.drawHLine(x, y + h - 1, L);          d.drawVLine(x, y + h - L, L);          // dol-lewo
    d.drawHLine(x + w - L, y + h - 1, L);  d.drawVLine(x + w - 1, y + h - L, L);  // dol-prawo
    d.setDrawColor(1);          // przywroc normalny tryb
}

// ---------------------------------------------------------------------------
// Podglad na zywo (mono viewfinder) przed zdjeciem.
// Kamera musi byc juz w trybie GRAYSCALE QQVGA (camBeginPreview()). Bierzemy
// srodkowy pas 160x64 z klatki 160x120, ditherujemy do 1-bit (ordered Bayer
// 4x4) i rysujemy 1:1 na lewej polowie OLED. Po prawej: pasek ostrosci +
// podpowiedzi. Zwraca true = rob zdjecie, false = anuluj.
// ---------------------------------------------------------------------------
static bool _solPreviewAndConfirm(U8G2 &d) {
    static const int PV_W = 160;                 // szerokosc viewfinder = szerokosc QQVGA
    static const int PV_H = 64;                  // wysokosc viewfinder = wysokosc OLED
    static const int XBM_STRIDE = (PV_W + 7) / 8; // 20 B/wiersz
    static uint8_t xbm[XBM_STRIDE * PV_H];        // 20*64 = 1280 B (BSS, nie stos)

    // Ordered Bayer 4x4 (wartosci 0..15)
    static const uint8_t bayer4[4][4] = {
        {  0,  8,  2, 10},
        { 12,  4, 14,  6},
        {  3, 11,  1,  9},
        { 15,  7, 13,  5}
    };

    float sharpMax = 1.0f;   // adaptacyjne maksimum metryki ostrosci (normalizacja paska)

    _solWaitRelease();
    while (true) {
        if (panicTriggered()) return false;

        camera_fb_t* fb = esp_camera_fb_get();
        if (!fb) { delay(10); continue; }

        const int sw = fb->width;    // 160
        const int sh = fb->height;   // 120
        if (sw < PV_W || sh < PV_H || !fb->buf) {
            esp_camera_fb_return(fb);
            delay(10);
            continue;
        }
        const int row0 = (sh - PV_H) / 2;   // srodkowy pas w pionie (= 28 dla 120)

        uint32_t sharp = 0;
        memset(xbm, 0, sizeof(xbm));
        for (int y = 0; y < PV_H; y++) {
            const uint8_t* row  = fb->buf + (size_t)(row0 + y) * sw;
            uint8_t*       xrow = xbm + (size_t)y * XBM_STRIDE;
            const uint8_t* brow = bayer4[y & 3];
            for (int x = 0; x < PV_W; x++) {
                // Dithering: piksel ON (papier jasny) gdy jasnosc > prog Bayera.
                // XBM: LSB w bajcie = lewy piksel, wiec bit = (x & 7).
                uint8_t thr = (uint8_t)(brow[x & 3] * 16);   // 0..240
                if (row[x] > thr) xrow[x >> 3] |= (1 << (x & 7));
                // Metryka ostrosci: suma |poziomego gradientu|
                if (x + 1 < PV_W) {
                    int g = (int)row[x] - (int)row[x + 1];
                    sharp += (g < 0 ? -g : g);
                }
            }
        }
        esp_camera_fb_return(fb);

        // Normalizacja ostrosci do adaptacyjnego maksimum -> pasek 0..100%
        float sf = (float)sharp;
        if (sf > sharpMax) sharpMax = sf;
        else               sharpMax = sharpMax * 0.97f + sf * 0.03f;  // powolny zanik
        int pct = (sharpMax > 1.0f) ? (int)(sf * 100.0f / sharpMax) : 0;
        if (pct > 100) pct = 100;

        // === Rysowanie ===
        d.clearBuffer();
        d.drawXBM(0, 0, PV_W, PV_H, xbm);     // obraz na lewej polowie
        _solDrawCorners(d, 0, 0, PV_W, PV_H); // bramki kadrowania (XOR)

        // Prawy panel (x:164..255)
        d.setDrawColor(1);
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(166, 8,  _solT("PODGLAD", "PREVIEW", "VORSCHAU"));
        d.drawStr(166, 24, _solT("Ostrosc", "Sharp", "Schaerfe"));
        // Pasek ostrosci 84px
        const int bx = 166, by = 28, bw = 84, bh = 8;
        d.drawFrame(bx, by, bw, bh);
        d.drawBox(bx + 1, by + 1, (bw - 2) * pct / 100, bh - 2);
        char pctbuf[8];
        snprintf(pctbuf, sizeof(pctbuf), "%d%%", pct);
        d.drawStr(166, 44, pctbuf);
        d.drawStr(166, 53, _solT("OK = foto", "OK = photo", "OK = Foto"));
        d.drawStr(166, 62, _solT("< = wyjdz", "< = exit", "< = raus"));
        d.sendBuffer();

        // Przyciski — po wolnej klatce kamery (~80ms) robimy krotki burst
        // skanowania na kadencji ~35ms. Debounce klawiatury wymaga 2 kolejnych
        // skanow (~60ms); bez tego burst'u petla skanowala raz na ~80ms i
        // POJEDYNCZE nacisniecie OK/LEFT sie gubilo — trzeba bylo TRZYMAC.
        // Uzywamy inputBtn()==LOW (bez throttle 200ms z _solBtn) dla responsywnosci.
        for (int k = 0; k < 3; k++) {
            if (inputBtn(BTN_OK)   == LOW) { _solWaitRelease(); return true; }
            if (inputBtn(BTN_LEFT) == LOW) { _solWaitRelease(); return false; }
            delay(35);
        }
    }
}

// ---------------------------------------------------------------------------
// Tryb ZDJECIE: zrob zdjecie → wyslij do API → pokaz wynik
// ---------------------------------------------------------------------------
static void _solRunPhotoMode(U8G2 &d) {
    // === Faza 1: podglad na zywo (mono viewfinder) ===
    // Kamera w trybie GRAYSCALE QQVGA — uzytkownik kadruje zadanie i ustawia
    // odleglosc (pasek ostrosci pomaga trafic w sweet-spot stalej ostrosci).
    _solDrawLoading(d, _solT("Uruchamiam podglad...", "Starting preview...", "Starte Vorschau..."), 0);

    if (camBeginPreview()) {
        bool go = _solPreviewAndConfirm(d);
        camEnd();                 // KONIECZNE: zwolnij preview, inaczej camBegin() (JPEG) zrobi early-return
        if (!go) return;          // anulowano w podgladzie
    } else {
        // Fallback (KALK_HW_LEGACY albo blad preview): statyczny ekran jak dawniej
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 16, _solT("Tryb: Zdjecie", "Mode: Photo", "Modus: Foto"));
        d.drawHLine(0, 18, 256);
        d.drawStr(2, 32, _solT("Skieruj na zadanie.", "Point at the problem.", "Auf Aufgabe richten."));
        d.drawStr(2, 46, _solT("OK = zrob zdjecie", "OK = take photo", "OK = Foto machen"));
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 62, _solT("< = anuluj", "< = cancel", "< = abbrechen"));
        d.sendBuffer();

        _solWaitRelease();
        while (true) {
            if (panicTriggered()) return;
            if (_solBtn(BTN_OK)) break;
            if (_solBtn(BTN_LEFT)) { _solWaitRelease(); return; }
            delay(20);
        }
        _solWaitRelease();
    }

    // === Faza 2: finalne zdjecie JPEG/UXGA ===
    // camBegin: PWDN low, RESET pulse (przez MCP23017), esp_camera_init().
    // I2C dzielony z MCP23017 (sccb_i2c_port=0 w camera.h).
    _solDrawLoading(d, _solT("Wlaczam kamere...", "Powering camera...", "Kamera wird gestartet..."), 0);

    if (!camBegin()) {
        _solDrawError(d, _solT("Init kamery!", "Camera init!", "Kamera-Init!"), "esp_camera_init");
        return;
    }

    // Warm-up - po switchu z podgladu AEC/AGC zbiega na nowo (3 klatki)
    camWarmup(3);

    _solDrawLoading(d, _solT("Robie zdjecie...", "Taking photo...", "Foto wird gemacht..."), 0);
    camera_fb_t* fb = camCapture();
    if (!fb) {
        camEnd();
        _solDrawError(d, _solT("Blad zdjecia!", "Capture error!", "Fotofehler!"), "");
        return;
    }
    // Skopiuj JPEG do PSRAM, potem zwolnij bufor kamery i wylacz kamere
    // PRZED WiFi (XCLK 10MHz kamery zaklocaja 2.4GHz radio).
    size_t jpegLen = fb->len;
    uint8_t* jpegBuf = (uint8_t*)ps_malloc(jpegLen);
    if (!jpegBuf) {
        esp_camera_fb_return(fb);
        camEnd();
        _solDrawError(d, _solT("Brak pamieci!", "Out of memory!", "Kein Speicher!"), "PSRAM");
        return;
    }
    memcpy(jpegBuf, fb->buf, jpegLen);
    esp_camera_fb_return(fb);
    camEnd();   // OFF kamery PRZED WiFi (anty-interference)

    // Teraz mozemy bezpiecznie wlaczyc WiFi
    if (!_solEnsureWifi(d)) {
        // Brak WiFi — zakolejkuj zdjecie w SPIFFS
        if (offlineQueueAddPhoto(jpegBuf, jpegLen)) {
            d.clearBuffer();
            d.setFont(u8g2_font_6x10_tf);
            d.drawStr(2, 18, _solT("Brak WiFi.", "No WiFi.", "Kein WLAN."));
            d.drawStr(2, 32, _solT("Zdjecie w kolejce.", "Photo queued.", "Foto in Warteschlange."));
            d.setFont(u8g2_font_5x7_tf);
            d.drawStr(2, 48, _solT("Wysylka po polaczeniu WiFi.", "Will send when WiFi available.", "Senden nach WLAN-Verbindung."));
            d.sendBuffer();
            _solWaitRelease();
            delay(2000);
        }
        free(jpegBuf);
        return;
    }

    _solSendJpeg(d, jpegBuf, jpegLen);
    free(jpegBuf);
}

// ---------------------------------------------------------------------------
// Ekran wyboru trybu (zdjecie / tekst)
// ---------------------------------------------------------------------------
static void _solModeSelect(U8G2 &d, int &mode) {
    // mode: 0 = zdjecie, 1 = tekst, 2 = historia, 3 = offline (lokalne solvery)
    _solWaitRelease();

    while (true) {
        if (panicTriggered()) return;
        powerCheckSleep();
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 10, _solT("=== Rozwiaz zadanie ===", "=== Solve problem ===", "=== Aufgabe loesen ==="));
        d.drawHLine(0, 12, 256);

        const char* labels[4][2] = {
            { "  [1] Zdjecie kamery", "  [1] Camera photo" },
            { "  [2] Wpisz tekst",    "  [2] Enter text"    },
            { "  [3] Historia",       "  [3] History"       },
            { "  [4] Offline",        "  [4] Offline"        },
        };
        const char* labelsSel[4][2] = {
            { "> [1] Zdjecie kamery", "> [1] Camera photo" },
            { "> [2] Wpisz tekst",    "> [2] Enter text"    },
            { "> [3] Historia",       "> [3] History"       },
            { "> [4] Offline",        "> [4] Offline"        },
        };

        const int Y[4] = {13, 23, 33, 43};   // top y kazdej pozycji (4 widoczne)
        const int TEXT_Y[4] = {22, 32, 42, 52};
        bool en = (kalkSettings.language == 1);

        for (int i = 0; i < 4; i++) {
            if (mode == i) {
                d.drawBox(0, Y[i], 256, 10);
                d.setDrawColor(0);
                d.drawStr(4, TEXT_Y[i], labelsSel[i][en ? 1 : 0]);
                d.setDrawColor(1);
            } else {
                d.drawStr(4, TEXT_Y[i], labels[i][en ? 1 : 0]);
            }
        }

        d.drawHLine(0, 53, 256);
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 62, _solT("^/v wybor   OK: start   < wstecz",
                                "^/v select   OK: start   < back",
                                "^/v waehlen  OK: Start  < zurueck"));
        d.sendBuffer();

        if (_solBtn(BTN_UP)) {
            if (mode > 0) mode--;
        } else if (_solBtn(BTN_DOWN)) {
            if (mode < 3) mode++;
        } else if (_solBtn(BTN_OK)) {
            _solWaitRelease();
            return;
        } else if (_solBtn(BTN_LEFT)) {
            mode = -1;  // sygnalizuje wyjscie
            _solWaitRelease();
            return;
        }
        delay(20);
    }
}

// ---------------------------------------------------------------------------
// Generyczne menu wyboru z listy (uzywane przez podmenu Offline).
// Zwraca wybrany indeks (0..count-1), albo -1 jesli uzytkownik wyszedl (LEFT).
// ---------------------------------------------------------------------------
static int _solListMenu(U8G2 &d, const char* title, const char* const* items, int count) {
    _solWaitRelease();
    int sel = 0;
    int scroll = 0;
    const int VISIBLE = 4;   // wiersze widoczne na raz (13..53 / 10px = 4)
    const int ROW_H = 10;

    while (true) {
        if (panicTriggered()) return -1;
        powerCheckSleep();

        if (sel < scroll) scroll = sel;
        if (sel >= scroll + VISIBLE) scroll = sel - VISIBLE + 1;

        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 10, title);
        d.drawHLine(0, 12, 256);

        for (int row = 0; row < VISIBLE; row++) {
            int i = scroll + row;
            if (i >= count) break;
            int y = 13 + row * ROW_H;
            int textY = y + ROW_H - 2;
            if (i == sel) {
                d.drawBox(0, y, 256, ROW_H);
                d.setDrawColor(0);
                d.drawStr(4, textY, items[i]);
                d.setDrawColor(1);
            } else {
                d.drawStr(4, textY, items[i]);
            }
        }

        d.drawHLine(0, 53, 256);
        d.setFont(u8g2_font_5x7_tf);
        if (scroll > 0)                  d.drawStr(240, 8, "^");
        if (scroll + VISIBLE < count)     d.drawStr(248, 8, "v");
        d.drawStr(2, 62, _solT("^/v wybor   OK: start   < wstecz",
                                "^/v select   OK: start   < back",
                                "^/v waehlen  OK: Start  < zurueck"));
        d.sendBuffer();

        if (_solBtn(BTN_UP)) {
            if (sel > 0) sel--;
        } else if (_solBtn(BTN_DOWN)) {
            if (sel < count - 1) sel++;
        } else if (_solBtn(BTN_OK)) {
            _solWaitRelease();
            return sel;
        } else if (_solBtn(BTN_LEFT)) {
            _solWaitRelease();
            return -1;
        }
        delay(20);
    }
}

// ---------------------------------------------------------------------------
// Dopisuje znak do bufora edycji pola liczbowego (styl _calcAppendDigit
// z calculator.h, ale na lokalnym buforze zamiast globalnego stanu _calc).
// ---------------------------------------------------------------------------
static void _numAppendChar(char* buf, size_t bufSize, bool &awaitingFirst, char c) {
    if (awaitingFirst) {
        buf[0] = (c == '.') ? '0' : c;
        buf[1] = '\0';
        if (c == '.') strcat(buf, ".");
        awaitingFirst = false;
    } else {
        size_t len = strlen(buf);
        if (len + 1 >= bufSize) return;
        if (c == '.' && strchr(buf, '.')) return;
        buf[len] = c;
        buf[len + 1] = '\0';
    }
}

// ---------------------------------------------------------------------------
// Edytor pojedynczego pola liczbowego (offline solver) — wpisywanie cyfr
// bezposrednio klawiszami 0-9/./+-  (jak w trybie kalkulatora), a nie przez
// UP/DOWN inkrementacje jak w _editAiCode. C/CE kasuje biezacy wpis; na
// nietknietym polu (nic wpisane) wychodzi z calego flow (return false).
// = (KEY_EQ) zatwierdza pole i przechodzi dalej (return true).
// ---------------------------------------------------------------------------
static bool _numEditField(U8G2 &d, const char* label, double &outValue) {
    char buf[16] = "0";
    bool awaitingFirst = true;
    _solWaitRelease();

    uint32_t blink = millis();
    bool blinkOn = true;

    while (true) {
        if (panicTriggered()) return false;
        if (millis() - blink > 400) { blinkOn = !blinkOn; blink = millis(); }

        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 10, label);
        d.drawHLine(0, 12, 256);

        d.setFont(u8g2_font_logisoso22_tn);
        int textW = d.getStrWidth(buf);
        int x = 256 - textW - 8;
        if (x < 4) x = 4;
        d.drawStr(x, 45, buf);
        if (blinkOn) d.drawBox(x + textW + 2, 32, 10, 3);

        d.drawHLine(0, 53, 256);
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 62, _solT("+/- znak   =: dalej   C: kasuj/wyjdz",
                                "+/- sign   =: next   C: clear/exit",
                                "+/- Vorz.  =: weiter  C: loesch/raus"));
        d.sendBuffer();

        if (inputKeyConsume(KEY_0))   { _numAppendChar(buf, sizeof(buf), awaitingFirst, '0'); continue; }
        if (inputKeyConsume(KEY_1))   { _numAppendChar(buf, sizeof(buf), awaitingFirst, '1'); continue; }
        if (inputKeyConsume(KEY_2))   { _numAppendChar(buf, sizeof(buf), awaitingFirst, '2'); continue; }
        if (inputKeyConsume(KEY_3))   { _numAppendChar(buf, sizeof(buf), awaitingFirst, '3'); continue; }
        if (inputKeyConsume(KEY_4))   { _numAppendChar(buf, sizeof(buf), awaitingFirst, '4'); continue; }
        if (inputKeyConsume(KEY_5))   { _numAppendChar(buf, sizeof(buf), awaitingFirst, '5'); continue; }
        if (inputKeyConsume(KEY_6))   { _numAppendChar(buf, sizeof(buf), awaitingFirst, '6'); continue; }
        if (inputKeyConsume(KEY_7))   { _numAppendChar(buf, sizeof(buf), awaitingFirst, '7'); continue; }
        if (inputKeyConsume(KEY_8))   { _numAppendChar(buf, sizeof(buf), awaitingFirst, '8'); continue; }
        if (inputKeyConsume(KEY_9))   { _numAppendChar(buf, sizeof(buf), awaitingFirst, '9'); continue; }
        if (inputKeyConsume(KEY_00))  {
            _numAppendChar(buf, sizeof(buf), awaitingFirst, '0');
            _numAppendChar(buf, sizeof(buf), awaitingFirst, '0');
            continue;
        }
        if (inputKeyConsume(KEY_DOT)) { _numAppendChar(buf, sizeof(buf), awaitingFirst, '.'); continue; }

        if (inputKeyConsume(KEY_PLUSMINUS)) {
            double v = atof(buf);
            offlineFmtNum(-v, buf, sizeof(buf));
            awaitingFirst = false;
            continue;
        }
        if (inputKeyConsume(KEY_CCE)) {
            if (awaitingFirst) { _solWaitRelease(); return false; }  // nietkniete -> wyjscie
            strcpy(buf, "0");
            awaitingFirst = true;
            continue;
        }
        if (inputKeyConsume(KEY_EQ)) {
            outValue = atof(buf);
            _solWaitRelease();
            return true;
        }
        delay(15);
    }
}

// ---------------------------------------------------------------------------
// Offline: rownanie liniowe ax+b=0
// ---------------------------------------------------------------------------
static void _solOfflineLinear(U8G2 &d) {
    double a, b;
    if (!_numEditField(d, _solT("Rownanie liniowe: a =", "Linear equation: a =", "Lineare Gleichung: a ="), a)) return;
    if (!_numEditField(d, "b =", b)) return;

    LinearResult r = offlineSolveLinear(a, b);
    char aS[24], bS[24];
    offlineFmtNum(a, aS, sizeof(aS));
    offlineFmtNum(b, bS, sizeof(bS));

    String result = String("a = ") + aS + ", b = " + bS + "\n\n";
    if (r.infinite) {
        result += _solT("Nieskonczenie wiele rozwiazan", "Infinitely many solutions", "Unendlich viele Loesungen");
    } else if (r.none) {
        result += _solT("Brak rozwiazan", "No solution", "Keine Loesung");
    } else {
        char xS[24];
        offlineFmtNum(r.x, xS, sizeof(xS));
        result += String("x = ") + xS;
    }

    historySave(String("[Offline] a=") + aS + " b=" + bS, result);
    _solDisplaySolution(d, result.c_str(), "OFFLINE");
}

// ---------------------------------------------------------------------------
// Offline: rownanie kwadratowe ax^2+bx+c=0
// ---------------------------------------------------------------------------
static void _solOfflineQuadratic(U8G2 &d) {
    double a, b, c;
    if (!_numEditField(d, _solT("Rown. kwadratowe: a =", "Quadratic equation: a =", "Quadr. Gleichung: a ="), a)) return;
    if (!_numEditField(d, "b =", b)) return;
    if (!_numEditField(d, "c =", c)) return;

    QuadraticResult r = offlineSolveQuadratic(a, b, c);
    char aS[24], bS[24], cS[24];
    offlineFmtNum(a, aS, sizeof(aS));
    offlineFmtNum(b, bS, sizeof(bS));
    offlineFmtNum(c, cS, sizeof(cS));

    String result = String("a=") + aS + " b=" + bS + " c=" + cS + "\n\n";

    if (r.usedLinear) {
        result += _solT("a=0 -> rownanie liniowe\n", "a=0 -> linear equation\n", "a=0 -> lineare Gleichung\n");
        if (r.linear.infinite) {
            result += _solT("Nieskonczenie wiele rozwiazan", "Infinitely many solutions", "Unendlich viele Loesungen");
        } else if (r.linear.none) {
            result += _solT("Brak rozwiazan", "No solution", "Keine Loesung");
        } else {
            char xS[24];
            offlineFmtNum(r.linear.x, xS, sizeof(xS));
            result += String("x = ") + xS;
        }
    } else {
        char dS[24];
        offlineFmtNum(r.delta, dS, sizeof(dS));
        result += String("\\Delta = ") + dS + "\n";
        if (r.realRoots == 2) {
            char x1S[24], x2S[24];
            offlineFmtNum(r.x1, x1S, sizeof(x1S));
            offlineFmtNum(r.x2, x2S, sizeof(x2S));
            result += String("x_1 = ") + x1S + "\n" + "x_2 = " + x2S;
        } else if (r.realRoots == 1) {
            char xS[24];
            offlineFmtNum(r.x1, xS, sizeof(xS));
            result += String(_solT("x (podwojny) = ", "x (double) = ", "x (doppelt) = ")) + xS;
        } else {
            char reS[24], imS[24];
            offlineFmtNum(r.reP, reS, sizeof(reS));
            offlineFmtNum(fabs(r.imP), imS, sizeof(imS));
            result += _solT("Brak pierwiastkow rzeczywistych\n", "No real roots\n", "Keine reellen Nullstellen\n");
            result += String("x = ") + reS + " \\pm " + imS + "i";
        }
    }

    historySave(String("[Offline] a=") + aS + " b=" + bS + " c=" + cS, result);
    _solDisplaySolution(d, result.c_str(), "OFFLINE");
}

// ---------------------------------------------------------------------------
// Offline: uklad 2 rownan liniowych (metoda Cramera)
// ---------------------------------------------------------------------------
static void _solOfflineSystem(U8G2 &d) {
    double a1, b1, c1, a2, b2, c2;
    if (!_numEditField(d, _solT("Rown.1: a1 =", "Eq.1: a1 =", "Gl.1: a1 ="), a1)) return;
    if (!_numEditField(d, "b1 =", b1)) return;
    if (!_numEditField(d, "c1 =", c1)) return;
    if (!_numEditField(d, _solT("Rown.2: a2 =", "Eq.2: a2 =", "Gl.2: a2 ="), a2)) return;
    if (!_numEditField(d, "b2 =", b2)) return;
    if (!_numEditField(d, "c2 =", c2)) return;

    System2x2Result r = offlineSolveSystem2x2(a1, b1, c1, a2, b2, c2);
    String result;
    if (r.infinite) {
        result = _solT("Nieskonczenie wiele rozwiazan", "Infinitely many solutions", "Unendlich viele Loesungen");
    } else if (r.none) {
        result = _solT("Uklad sprzeczny (brak rozwiazan)", "Inconsistent system (no solution)", "Widerspruechliches System (keine Loesung)");
    } else {
        char xS[24], yS[24];
        offlineFmtNum(r.x, xS, sizeof(xS));
        offlineFmtNum(r.y, yS, sizeof(yS));
        result = String("x = ") + xS + "\ny = " + yS;
    }

    char eq[96];
    snprintf(eq, sizeof(eq), "a1=%.4g b1=%.4g c1=%.4g / a2=%.4g b2=%.4g c2=%.4g", a1, b1, c1, a2, b2, c2);
    historySave(String("[Offline] ") + eq, result);
    _solDisplaySolution(d, result.c_str(), "OFFLINE");
}

// ---------------------------------------------------------------------------
// Offline: procenty i proporcje (podmenu 2 pozycji)
// ---------------------------------------------------------------------------
static void _solOfflinePercent(U8G2 &d) {
    const char* items[2] = {
        _solT("X% z Y", "X% of Y", "X% von Y"),
        _solT("Proporcja a:b=c:x", "Proportion a:b=c:x", "Verhaeltnis a:b=c:x"),
    };
    int sel = _solListMenu(d, _solT("=== Procenty ===", "=== Percentages ===", "=== Prozente ==="), items, 2);
    if (sel < 0) return;

    if (sel == 0) {
        double pct, base;
        if (!_numEditField(d, "X (%) =", pct)) return;
        if (!_numEditField(d, "Y =", base)) return;
        double v = offlinePercentOf(pct, base);
        char pS[24], bS[24], vS[24];
        offlineFmtNum(pct, pS, sizeof(pS));
        offlineFmtNum(base, bS, sizeof(bS));
        offlineFmtNum(v, vS, sizeof(vS));
        String result = String(pS) + "% z " + bS + " = " + vS;
        historySave(String("[Offline] ") + pS + "% z " + bS, result);
        _solDisplaySolution(d, result.c_str(), "OFFLINE");
    } else {
        double a, b, c;
        if (!_numEditField(d, "a =", a)) return;
        if (!_numEditField(d, "b =", b)) return;
        if (!_numEditField(d, "c =", c)) return;
        double x = offlineProportion(a, b, c);
        char aS[24], bS[24], cS[24], xS[24];
        offlineFmtNum(a, aS, sizeof(aS));
        offlineFmtNum(b, bS, sizeof(bS));
        offlineFmtNum(c, cS, sizeof(cS));
        offlineFmtNum(x, xS, sizeof(xS));
        String result = String(aS) + ":" + bS + " = " + cS + ":x\n\nx = " + xS;
        historySave(String("[Offline] ") + aS + ":" + bS + "=" + cS + ":x", result);
        _solDisplaySolution(d, result.c_str(), "OFFLINE");
    }
}

// ---------------------------------------------------------------------------
// Offline: pochodna wielomianu (stopien 2 lub 3)
// ---------------------------------------------------------------------------
static void _solOfflineDerivative(U8G2 &d) {
    const char* items[2] = {
        _solT("Stopien 2 (ax^2+bx+c)", "Degree 2 (ax^2+bx+c)", "Grad 2 (ax^2+bx+c)"),
        _solT("Stopien 3 (ax^3+bx^2+cx+d)", "Degree 3 (ax^3+bx^2+cx+d)", "Grad 3 (ax^3+bx^2+cx+d)"),
    };
    int sel = _solListMenu(d, _solT("=== Pochodna ===", "=== Derivative ===", "=== Ableitung ==="), items, 2);
    if (sel < 0) return;

    int degree = (sel == 0) ? 2 : 3;
    double coeffs[4] = {0, 0, 0, 0};   // coeffs[0]=wyraz wolny ... coeffs[degree]=najwyzsza potega
    const char* labelsHi[4] = {"a =", "b =", "c =", "d ="};   // od najwyzszej potegi w dol

    for (int i = degree; i >= 0; i--) {
        if (!_numEditField(d, labelsHi[degree - i], coeffs[i])) return;
    }

    double deriv[4] = {0, 0, 0, 0};
    int dDeg = offlinePolyDerivative(coeffs, degree, deriv);

    String fx = "f(x) = ";
    for (int i = degree; i >= 0; i--) {
        char cS[24];
        offlineFmtNum(coeffs[i], cS, sizeof(cS));
        if (i < degree && coeffs[i] >= 0) fx += "+";
        fx += cS;
        if (i > 0) { fx += "x"; if (i > 1) { fx += "^"; fx += String(i); } }
    }

    String fpx = "f'(x) = ";
    if (dDeg >= 0) {
        for (int i = dDeg; i >= 0; i--) {
            char cS[24];
            offlineFmtNum(deriv[i], cS, sizeof(cS));
            if (i < dDeg && deriv[i] >= 0) fpx += "+";
            fpx += cS;
            if (i > 0) { fpx += "x"; if (i > 1) { fpx += "^"; fpx += String(i); } }
        }
    } else {
        fpx += "0";
    }

    String result = fx + "\n\n" + fpx;
    historySave(String("[Offline] ") + fx, result);
    _solDisplaySolution(d, result.c_str(), "OFFLINE");
}

// ---------------------------------------------------------------------------
// Offline: punkty na plaszczyznie — odleglosc |AB| + srodek odcinka
// ---------------------------------------------------------------------------
static void _solOfflinePoints(U8G2 &d) {
    double x1, y1, x2, y2;
    if (!_numEditField(d, _solT("Punkt A: x1 =", "Point A: x1 =", "Punkt A: x1 ="), x1)) return;
    if (!_numEditField(d, "y1 =", y1)) return;
    if (!_numEditField(d, _solT("Punkt B: x2 =", "Point B: x2 =", "Punkt B: x2 ="), x2)) return;
    if (!_numEditField(d, "y2 =", y2)) return;

    PointsResult r = offlinePointsCalc(x1, y1, x2, y2);
    char x1S[24], y1S[24], x2S[24], y2S[24], dS[24], mxS[24], myS[24];
    offlineFmtNum(x1, x1S, sizeof(x1S));
    offlineFmtNum(y1, y1S, sizeof(y1S));
    offlineFmtNum(x2, x2S, sizeof(x2S));
    offlineFmtNum(y2, y2S, sizeof(y2S));
    offlineFmtNum(r.distance, dS, sizeof(dS));
    offlineFmtNum(r.midX, mxS, sizeof(mxS));
    offlineFmtNum(r.midY, myS, sizeof(myS));

    String result = String("|AB| = ") + dS + "\n" +
                     _solT("Srodek S = (", "Midpoint S = (", "Mittelpunkt S = (") + mxS + ", " + myS + ")";

    historySave(String("[Offline] A(") + x1S + "," + y1S + ") B(" + x2S + "," + y2S + ")", result);
    _solDisplaySolution(d, result.c_str(), "OFFLINE");
}

// ---------------------------------------------------------------------------
// Offline: twierdzenie Pitagorasa (podmenu 2 pozycji)
// ---------------------------------------------------------------------------
static void _solOfflinePythagoras(U8G2 &d) {
    const char* items[2] = {
        _solT("Znam obie przyprostokatne", "Know both legs", "Kenne beide Katheten"),
        _solT("Znam przeciwprost.+bok", "Know hypotenuse+leg", "Kenne Hypotenuse+Kathete"),
    };
    int sel = _solListMenu(d, _solT("=== Pitagoras ===", "=== Pythagoras ===", "=== Pythagoras ==="), items, 2);
    if (sel < 0) return;

    if (sel == 0) {
        double a, b;
        if (!_numEditField(d, _solT("Przyprost.: a =", "Leg: a =", "Kathete: a ="), a)) return;
        if (!_numEditField(d, "b =", b)) return;
        PythagorasResult r = offlinePythagorasHypotenuse(a, b);
        char aS[24], bS[24], cS[24];
        offlineFmtNum(a, aS, sizeof(aS));
        offlineFmtNum(b, bS, sizeof(bS));
        offlineFmtNum(r.result, cS, sizeof(cS));
        String result = String("a=") + aS + " b=" + bS + "\n\nc = " + cS;
        historySave(String("[Offline] Pitagoras a=") + aS + " b=" + bS, result);
        _solDisplaySolution(d, result.c_str(), "OFFLINE");
    } else {
        double c, a;
        if (!_numEditField(d, _solT("Przeciwprost.: c =", "Hypotenuse: c =", "Hypotenuse: c ="), c)) return;
        if (!_numEditField(d, _solT("Przyprost.: a =", "Leg: a =", "Kathete: a ="), a)) return;
        PythagorasResult r = offlinePythagorasLeg(c, a);
        char cS[24], aS[24];
        offlineFmtNum(c, cS, sizeof(cS));
        offlineFmtNum(a, aS, sizeof(aS));
        String result;
        if (!r.valid) {
            result = _solT("Blad: c musi byc dluzsze niz a", "Error: c must be longer than a", "Fehler: c muss laenger als a sein");
        } else {
            char bS[24];
            offlineFmtNum(r.result, bS, sizeof(bS));
            result = String("c=") + cS + " a=" + aS + "\n\nb = " + bS;
        }
        historySave(String("[Offline] Pitagoras c=") + cS + " a=" + aS, result);
        _solDisplaySolution(d, result.c_str(), "OFFLINE");
    }
}

// ---------------------------------------------------------------------------
// Offline: ciagi arytmetyczne i geometryczne (podmenu 2 pozycji)
// ---------------------------------------------------------------------------
static void _solOfflineSequence(U8G2 &d) {
    const char* items[2] = {
        _solT("Arytmetyczny", "Arithmetic", "Arithmetisch"),
        _solT("Geometryczny", "Geometric", "Geometrisch"),
    };
    int sel = _solListMenu(d, _solT("=== Ciagi ===", "=== Sequences ===", "=== Folgen ==="), items, 2);
    if (sel < 0) return;

    double a1, diffOrRatio, nD;
    if (!_numEditField(d, "a1 =", a1)) return;
    if (!_numEditField(d, sel == 0 ? "r =" : "q =", diffOrRatio)) return;
    if (!_numEditField(d, "n =", nD)) return;
    int n = (int)(nD >= 0 ? nD + 0.5 : nD - 0.5);
    if (n < 1) n = 1;

    SequenceResult res = (sel == 0)
        ? offlineArithmeticSeq(a1, diffOrRatio, n)
        : offlineGeometricSeq(a1, diffOrRatio, n);

    char a1S[24], drS[24], anS[24], snS[24];
    offlineFmtNum(a1, a1S, sizeof(a1S));
    offlineFmtNum(diffOrRatio, drS, sizeof(drS));
    offlineFmtNum(res.nthTerm, anS, sizeof(anS));
    offlineFmtNum(res.sumN, snS, sizeof(snS));

    String result = String("a_") + n + " = " + anS + "\n" + "S_" + n + " = " + snS;
    historySave(String("[Offline] a1=") + a1S + (sel == 0 ? " r=" : " q=") + drS + " n=" + n, result);
    _solDisplaySolution(d, result.c_str(), "OFFLINE");
}

// ---------------------------------------------------------------------------
// Offline: pola i obwody podstawowych figur (podmenu 4 pozycji)
// ---------------------------------------------------------------------------
static void _solOfflineArea(U8G2 &d) {
    const char* items[4] = {
        _solT("Prostokat", "Rectangle", "Rechteck"),
        _solT("Trojkat (3 boki)", "Triangle (3 sides)", "Dreieck (3 Seiten)"),
        _solT("Kolo", "Circle", "Kreis"),
        _solT("Trapez", "Trapezoid", "Trapez"),
    };
    int sel = _solListMenu(d, _solT("=== Pola i obwody ===", "=== Areas ===", "=== Flaechen ==="), items, 4);
    if (sel < 0) return;

    String result, histLabel;

    if (sel == 0) {
        double a, b;
        if (!_numEditField(d, _solT("Prostokat: a =", "Rectangle: a =", "Rechteck: a ="), a)) return;
        if (!_numEditField(d, "b =", b)) return;
        AreaResult r = offlineRectangle(a, b);
        char aS[24], bS[24], pS[24], oS[24];
        offlineFmtNum(a, aS, sizeof(aS));
        offlineFmtNum(b, bS, sizeof(bS));
        offlineFmtNum(r.area, pS, sizeof(pS));
        offlineFmtNum(r.perimeter, oS, sizeof(oS));
        result = String(_solT("Pole = ", "Area = ", "Flaeche = ")) + pS + "\n" +
                 _solT("Obwod = ", "Perimeter = ", "Umfang = ") + oS;
        histLabel = String("Prostokat a=") + aS + " b=" + bS;
    } else if (sel == 1) {
        double a, b, c;
        if (!_numEditField(d, _solT("Trojkat: a =", "Triangle: a =", "Dreieck: a ="), a)) return;
        if (!_numEditField(d, "b =", b)) return;
        if (!_numEditField(d, "c =", c)) return;
        AreaResult r = offlineTriangleHeron(a, b, c);
        char aS[24], bS[24], cS[24];
        offlineFmtNum(a, aS, sizeof(aS));
        offlineFmtNum(b, bS, sizeof(bS));
        offlineFmtNum(c, cS, sizeof(cS));
        if (!r.valid) {
            result = _solT("Blad: takie boki nie tworza trojkata", "Error: these sides don't form a triangle", "Fehler: diese Seiten bilden kein Dreieck");
        } else {
            char pS[24], oS[24];
            offlineFmtNum(r.area, pS, sizeof(pS));
            offlineFmtNum(r.perimeter, oS, sizeof(oS));
            result = String(_solT("Pole = ", "Area = ", "Flaeche = ")) + pS + "\n" +
                     _solT("Obwod = ", "Perimeter = ", "Umfang = ") + oS;
        }
        histLabel = String("Trojkat a=") + aS + " b=" + bS + " c=" + cS;
    } else if (sel == 2) {
        double rad;
        if (!_numEditField(d, _solT("Kolo: r =", "Circle: r =", "Kreis: r ="), rad)) return;
        AreaResult r = offlineCircle(rad);
        char rS[24], pS[24], oS[24];
        offlineFmtNum(rad, rS, sizeof(rS));
        offlineFmtNum(r.area, pS, sizeof(pS));
        offlineFmtNum(r.perimeter, oS, sizeof(oS));
        result = String(_solT("Pole = ", "Area = ", "Flaeche = ")) + pS + "\n" +
                 _solT("Obwod = ", "Perimeter = ", "Umfang = ") + oS;
        histLabel = String("Kolo r=") + rS;
    } else {
        double a, b, h;
        if (!_numEditField(d, _solT("Trapez: a =", "Trapezoid: a =", "Trapez: a ="), a)) return;
        if (!_numEditField(d, "b =", b)) return;
        if (!_numEditField(d, "h =", h)) return;
        AreaResult r = offlineTrapezoid(a, b, h);
        char aS[24], bS[24], hS[24], pS[24];
        offlineFmtNum(a, aS, sizeof(aS));
        offlineFmtNum(b, bS, sizeof(bS));
        offlineFmtNum(h, hS, sizeof(hS));
        offlineFmtNum(r.area, pS, sizeof(pS));
        result = String(_solT("Pole = ", "Area = ", "Flaeche = ")) + pS + "\n" +
                 _solT("(obwod wymaga dlugosci ramion)", "(perimeter needs leg lengths)", "(Umfang braucht Schenkellaengen)");
        histLabel = String("Trapez a=") + aS + " b=" + bS + " h=" + hS;
    }

    historySave(String("[Offline] ") + histLabel, result);
    _solDisplaySolution(d, result.c_str(), "OFFLINE");
}

// ---------------------------------------------------------------------------
// Offline — dispatcher: menu 9 narzedzi, wraca do siebie po kazdym policzeniu
// ---------------------------------------------------------------------------
static void runOfflineSolver(U8G2 &d) {
    const char* items[9] = {
        _solT("Rownanie liniowe", "Linear equation", "Lineare Gleichung"),
        _solT("Rownanie kwadratowe", "Quadratic equation", "Quadratische Gleichung"),
        _solT("Uklad 2 rownan", "2-eq. system", "2er-Gleichungssystem"),
        _solT("Procenty / proporcje", "Percentages / proportions", "Prozente / Verhaeltnisse"),
        _solT("Pochodna wielomianu", "Polynomial derivative", "Polynom-Ableitung"),
        _solT("Punkty na plaszczyznie", "Points on a plane", "Punkte in der Ebene"),
        _solT("Twierdzenie Pitagorasa", "Pythagorean theorem", "Satz des Pythagoras"),
        _solT("Ciagi (arytm./geom.)", "Sequences (arith./geom.)", "Folgen (arith./geom.)"),
        _solT("Pola i obwody figur", "Areas and perimeters", "Flaechen und Umfaenge"),
    };
    while (true) {
        if (panicTriggered()) return;
        int sel = _solListMenu(d, _solT("=== Offline ===", "=== Offline ===", "=== Offline ==="), items, 9);
        if (sel < 0) return;   // wyjscie do _solModeSelect

        switch (sel) {
            case 0: _solOfflineLinear(d);     break;
            case 1: _solOfflineQuadratic(d);  break;
            case 2: _solOfflineSystem(d);     break;
            case 3: _solOfflinePercent(d);    break;
            case 4: _solOfflineDerivative(d); break;
            case 5: _solOfflinePoints(d);     break;
            case 6: _solOfflinePythagoras(d); break;
            case 7: _solOfflineSequence(d);   break;
            case 8: _solOfflineArea(d);       break;
        }
    }
}

// ---------------------------------------------------------------------------
// Tryb HISTORIA — lokalna lista (do 5) + opcjonalnie z serwera (TODO)
// ---------------------------------------------------------------------------
static void _solRunHistoryMode(U8G2 &d) {
    _solWaitRelease();

    uint8_t count = historyCount();
    if (count == 0) {
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 28, _solT("Brak zapisanych zadan", "No saved tasks", "Keine gespeicherten Aufgaben"));
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 56, _solT("OK / < = powrot", "OK / < = back", "OK / < = zurueck"));
        d.sendBuffer();
        while (true) {
        if (panicTriggered()) return;
            powerCheckSleep();
            if (_solBtn(BTN_OK) || _solBtn(BTN_LEFT)) {
                _solWaitRelease();
                return;
            }
            delay(20);
        }
    }

    int cursor = 0;   // 0 = najnowszy
    while (true) {
        if (panicTriggered()) return;
        powerCheckSleep();
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        char hdr[32];
        snprintf(hdr, sizeof(hdr), _solT("Historia (%d/%d)", "History (%d/%d)", "Verlauf (%d/%d)"),
                 cursor + 1, count);
        d.drawStr(2, 10, hdr);
        d.drawHLine(0, 12, 256);

        HistoryEntry entry;
        if (historyGet(cursor, entry)) {
            d.setFont(u8g2_font_6x10_tf);
            // Polskie znaki UTF-8 -> ASCII (font 6x10/5x7 nie ma glyphow ą/ł/...).
            // Konwersja PRZED obcieciem, zeby nie urwac w srodku znaku wielobajtowego.
            String q = _solUtf8ToAscii(entry.question);
            if (q.length() > 40) q = q.substring(0, 38) + "..";
            d.drawStr(2, 24, q.c_str());

            d.setFont(u8g2_font_5x7_tf);
            // Pierwsze 2 linie odpowiedzi
            String a = _solUtf8ToAscii(entry.answer);
            int nl = a.indexOf('\n');
            String l1 = nl >= 0 ? a.substring(0, nl) : a;
            String rest = nl >= 0 ? a.substring(nl + 1) : "";
            int nl2 = rest.indexOf('\n');
            String l2 = nl2 >= 0 ? rest.substring(0, nl2) : rest;
            if (l1.length() > 50) l1 = l1.substring(0, 48) + "..";
            if (l2.length() > 50) l2 = l2.substring(0, 48) + "..";
            d.drawStr(2, 36, l1.c_str());
            d.drawStr(2, 46, l2.c_str());
        }

        d.drawHLine(0, 53, 256);
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 62, _solT("^/v OK:pokaz  >:edytuj+wyslij  <:wstecz",
                                "^/v OK:show  >:edit+resend  <:back",
                                "^/v OK:zeigen >:bearb+senden <:zurueck"));
        d.sendBuffer();

        if (_solBtn(BTN_UP)) {
            if (cursor > 0) cursor--;
        } else if (_solBtn(BTN_DOWN)) {
            if (cursor < count - 1) cursor++;
        } else if (_solBtn(BTN_OK)) {
            // Pokaz pelne rozwiazanie (wykorzystaj _solDisplaySolution)
            HistoryEntry entry;
            if (historyGet(cursor, entry)) {
                _solDisplaySolution(d, entry.answer.c_str());
            }
            // po wyjsciu — wracamy do listy
        } else if (_solBtn(BTN_RIGHT)) {
            // Edytuj pytanie z historii i wyslij ponownie do AI
            HistoryEntry entry;
            if (historyGet(cursor, entry)) {
                _solWaitRelease();
                _solRunTextMode(d, entry.question.c_str());
                _solWaitRelease();
            }
            // po wyjsciu — wracamy do listy
        } else if (_solBtn(BTN_LEFT)) {
            _solWaitRelease();
            return;
        }
        delay(20);
    }
}

// ---------------------------------------------------------------------------
// _solProcessQueue — wyslij zadania z kolejki offline jesli WiFi dostepne.
// Wolana na wejsciu showSolveScreen (cicha — brak ekranu blokujacego jesli
// WiFi niedostepne).
// ---------------------------------------------------------------------------
static void _solProcessQueue(U8G2 &d) {
    uint8_t n = offlineQueueCount();
    if (n == 0) return;

    // Polacz z WiFi jesli nie jest polaczony (cichy tryb — max 8s)
    if (WiFi.status() != WL_CONNECTED) {
        char ssid[33] = "", pass[64] = "";
        wifiLoadSaved(ssid, sizeof(ssid), pass, sizeof(pass));
        if (ssid[0] == '\0') return;
        WiFi.mode(WIFI_STA);
        wifiFastBegin(ssid, pass);
        unsigned long t = millis();
        while (WiFi.status() != WL_CONNECTED && millis() - t < 8000) delay(200);
        if (WiFi.status() != WL_CONNECTED) return;
        wifiSaveBssidChannel();
        accountRegisterOnce();
    }

    // Poinformuj uzytkownika
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);
    char hdr[40];
    snprintf(hdr, sizeof(hdr), _solT("Kolejka: %d zadan", "Queue: %d tasks", "Warteschl.: %d Aufg."), (int)n);
    d.drawStr(2, 24, hdr);
    d.setFont(u8g2_font_5x7_tf);
    d.drawStr(2, 40, _solT("Wysylam do serwera...", "Sending to server...", "Sende an Server..."));
    d.sendBuffer();
    delay(1000);

    // Wyslij FIFO — _solSendText/_solSendJpeg pokazuja wyniki kolejno
    while (offlineQueueCount() > 0) {
        OfflineTask task;
        if (!offlineQueuePeek(0, task)) break;

        if (task.type == 0) {
            _solSendText(d, task.text.c_str());
        } else {
            // Wczytaj JPEG z SPIFFS do PSRAM, wyslij, zwolnij
            if (!SPIFFS.begin(false)) { offlineQueueRemoveFirst(); continue; }
            File f = SPIFFS.open(task.path.c_str(), "r");
            if (!f)  { offlineQueueRemoveFirst(); continue; }
            size_t sz  = f.size();
            uint8_t* buf = (uint8_t*)ps_malloc(sz);
            if (!buf) { f.close(); offlineQueueRemoveFirst(); continue; }
            f.read(buf, sz);
            f.close();
            _solSendJpeg(d, buf, sz);
            free(buf);
        }
        offlineQueueRemoveFirst();
    }
}

// ---------------------------------------------------------------------------
// Publiczna funkcja — glowny punkt wejscia
// ---------------------------------------------------------------------------
void showSolveScreen(U8G2 &display) {
    // pinMode(BTN_UP,    INPUT_PULLUP);
    // pinMode(BTN_DOWN,  INPUT_PULLUP);
    // pinMode(BTN_LEFT,  INPUT_PULLUP);
    // pinMode(BTN_RIGHT, INPUT_PULLUP);
    // pinMode(BTN_OK,    INPUT_PULLUP);

    // Wyslij zadania z kolejki offline jesli WiFi dostepne (cichy tryb)
    _solProcessQueue(display);

    int mode = 1;  // domyslnie tekst (kamera moze byc niedostepna)

    while (true) {
        if (panicTriggered()) return;
        _solModeSelect(display, mode);

        if (mode < 0) return;  // wyjdz do menu

        if (mode == 0) {
            _solRunPhotoMode(display);
        } else if (mode == 1) {
            _solRunTextMode(display);
        } else if (mode == 2) {
            _solRunHistoryMode(display);
        } else if (mode == 3) {
            runOfflineSolver(display);
        }
        // Po powrocie z trybu → znow wybor trybu
    }
}
