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
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include "esp_heap_caps.h"
#include "input.h"
#include "settings_screen.h"
#include "i18n_extra.h"     // kalkTrExtra — _solT dla jezykow 4..10
#include "kalk_translit.h"  // _kalkUtf8ToAscii — wspolna transliteracja UTF-8 -> ASCII
#include "wifi_persist.h"
#include "kalkmate_certs.h"
#include "event_log.h"      // logEvent* — bufor zdarzen wysylany do serwera
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

// UTF-8 -> ASCII dla fontow 6x10/5x7 (drawStr — nie maja diakrytykow ani
// cyrylicy): podglad historii, komunikaty bledow. Wspolna tabela z notatkami
// (kalk_translit.h): PL/DE/CS/SK/LT/ES/PT/FR/IT + cyrylica (BE) -> lacinka,
// typografia, symbole matematyczne; nieznany znak -> "?".
// Sygnatura jak _testsTitleToAscii w tests.h.
inline String _solUtf8ToAscii(String s) {
    return _kalkUtf8ToAscii(s);
}
#define _SOL_SOLUTION_MAX    24576  // max znakow odpowiedzi AI (24 KB, RAM)
#define _SOL_HTTP_TIMEOUT_MS 65000  // max HTTPClient (uint16); Gemini 2.5 Pro bywa >45s (2026-10-18: 71s)

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

// Czeka na puszczenie klawiszy nawigacji — max 2 s (zablokowany/zwarty
// klawisz membrany nie moze zawiesic ekranu na zawsze).
static void _solWaitRelease() {
    unsigned long t0 = millis();
    while ((inputBtn(BTN_UP)    == LOW ||
            inputBtn(BTN_DOWN)  == LOW ||
            inputBtn(BTN_LEFT)  == LOW ||
            inputBtn(BTN_RIGHT) == LOW ||
            inputBtn(BTN_OK)    == LOW) &&
           millis() - t0 < 2000) {
        delay(10);
    }
    _solLastPress = millis();
}

// Wspolny "tick" petli UI w tym pliku: skan klawiatury + panic key +
// auto-sleep, jak w reszcie UI. Wczesniej czesc petli sprawdzala tylko
// panicTriggered(), a samo wykrywanie klawisza panic (panicCheck) siedzi
// w powerCheckSleep() — wiec panic i sen tam nie dzialaly.
// Zwraca true, gdy urzadzenie wlasnie sie obudzilo: wolajacy przerysowuje
// ekran (klawisz budzacy polyka input.h — nie wywola akcji).
// NIE wolac przy wlaczonej kamerze (light sleep z esp_camera niesprawdzony).
static bool _solTick() {
    inputScan();
    panicCheck();
    if (powerCheckSleep()) {
        _solWaitRelease();
        return true;
    }
    return false;
}

// 0=PL, 1=EN, 2=DE, 3=CS (czeski bez diakrytykow); brak cs -> EN
static const char* _solT(const char* pl, const char* en, const char* de, const char* cs = nullptr) {
    if (kalkSettings.language >= KALK_TR_EXTRA_FIRST) return kalkTrExtra(en, kalkSettings.language);  // 4..10
    if (kalkSettings.language == 0) return pl;
    if (kalkSettings.language == 1) return en;
    if (kalkSettings.language == 3) return cs ? cs : en;
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
// Pomocnik: ekran bledu. line3 (opcjonalna, mniejszy font) — np. co sie
// stalo z zadaniem (w kolejce / utracone). Wyjscie: OK, <, C/CE, panic;
// auto-sleep dziala (wczesniej petla czekala tylko na OK/<).
// ---------------------------------------------------------------------------
static void _solDrawError(U8G2 &d, const char* line1, const char* line2, const char* line3 = nullptr) {
    if (panicTriggered()) return;
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);
    d.drawStr(2, 16, _solT("! Blad !", "! Error !", "! Fehler !", "! Chyba !"));
    d.drawHLine(0, 18, 256);
    // Polskie znaki w komunikatach z serwera -> ASCII (bo font nie ma glyphow)
    String l1 = _solUtf8ToAscii(String(line1 ? line1 : ""));
    String l2 = _solUtf8ToAscii(String(line2 ? line2 : ""));
    d.drawStr(2, 31, l1.c_str());
    if (l2.length() > 0) d.drawStr(2, 43, l2.c_str());
    d.setFont(u8g2_font_5x7_tf);
    if (line3 && line3[0]) d.drawStr(2, 53, _solUtf8ToAscii(String(line3)).c_str());
    d.drawStr(2, 62, _solT("OK = powrot", "OK = back", "OK = zurueck", "OK = zpet"));
    d.sendBuffer();
    _solWaitRelease();
    while (true) {
        if (_solTick()) d.sendBuffer();   // po wybudzeniu: ta sama klatka
        if (panicTriggered()) return;
        if (_solBtn(BTN_OK) || _solBtn(BTN_LEFT) || inputKeyConsume(KEY_CCE)) break;
        delay(20);
    }
    _solWaitRelease();
}

// Pomocnik: krotki komunikat informacyjny (OK / < / C/CE albo ms).
static void _solShowInfo(U8G2 &d, const char* l1, const char* l2, const char* l3, uint32_t ms) {
    if (panicTriggered()) return;
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);
    if (l1) d.drawStr(2, 18, l1);
    if (l2) d.drawStr(2, 32, l2);
    d.setFont(u8g2_font_5x7_tf);
    if (l3) d.drawStr(2, 48, l3);
    d.sendBuffer();
    _solWaitRelease();
    uint32_t t0 = millis();
    while (millis() - t0 < ms) {
        if (_solTick()) break;
        if (panicTriggered()) return;
        if (_solBtn(BTN_OK) || _solBtn(BTN_LEFT) || inputKeyConsume(KEY_CCE)) break;
        delay(20);
    }
    _solWaitRelease();
}

// ---------------------------------------------------------------------------
// Konwerter LaTeX -> czytelny UTF-8 dla OLED (z polskimi znakami).
// Renderowane czcionka 6x12_te przez drawUTF8. UWAGA: ten font to okrojony
// font terminalowy — NIE MA greki ani wiekszosci symboli matematycznych
// Unicode (sprawdzone narzedziem dekodujacym dane fontu). Ma tylko:
// · × ÷ ± ~ ¬ ° * oraz Latin-1 (w tym ¹²³, ₀-₉). Grecki DZIALA mimo to —
// litery greckie dostaja prawdziwy Unicode (patrz tabela nizej), a
// _solDrawMathLine() przelacza font na u8g2_font_unifont_t_greek TYLKO dla
// znakow z bloku greckiego (dokladnie ta sama technika co dla wykladnikow:
// przelaczenie fontu w trakcie rysowania jednej linii). Wybrany po
// wizualnym teście 3 kandydatow na prawdziwym OLED (tools/greek_font_test).
// "Egzotyczne" symbole matematyczne (bez dedykowanego fontu) nadal
// zamieniane na czytelne ASCII — font ich nie ma i nie ma dla nich osobnej
// czcionki. Obsluga: \frac, \sqrt, ^ _ (potegi/indeksy), operatory,
// relacje, strzalki. Polskie znaki UTF-8 (font JE MA) przepisywane bez
// zmian.
// ---------------------------------------------------------------------------

// Dlugosc znaku UTF-8 wg bajtu wiodacego.
static inline int _utf8Len(uint8_t b) {
    if (b < 0x80) return 1;
    if ((b >> 5) == 0x6) return 2;
    if ((b >> 4) == 0xE) return 3;
    if ((b >> 3) == 0x1E) return 4;
    return 1;
}

// Kodpunkt Unicode + dlugosc w bajtach (do wykrywania bloku greckiego).
static uint32_t _utf8Decode(const char* s, int& len) {
    uint8_t b0 = (uint8_t)s[0];
    if (b0 < 0x80) { len = 1; return b0; }
    if ((b0 >> 5) == 0x6) { len = 2; return ((b0 & 0x1F) << 6) | ((uint8_t)s[1] & 0x3F); }
    if ((b0 >> 4) == 0xE) { len = 3; return ((b0 & 0x0F) << 12) | (((uint8_t)s[1] & 0x3F) << 6) | ((uint8_t)s[2] & 0x3F); }
    if ((b0 >> 3) == 0x1E) { len = 4; return ((b0 & 0x07) << 18) | (((uint8_t)s[1] & 0x3F) << 12) | (((uint8_t)s[2] & 0x3F) << 6) | ((uint8_t)s[3] & 0x3F); }
    len = 1; return b0;
}
static inline bool _isGreek(uint32_t cp) { return cp >= 0x0370 && cp <= 0x03FF; }
static inline bool _isCyrillic(uint32_t cp) { return cp >= 0x0400 && cp <= 0x04FF; }

// Literalny Unicode superscript (model czasem wypisuje wprost, bez ^, np.
// kopiujac zapis "10⁻⁵" ze zdjecia zadania) -> zwykly znak ASCII, albo 0
// gdy cp nie jest supersriptem. Uzywane do awaryjnego "podniesienia" takich
// znakow w _solDrawMathLine, gdyby jednak ominely normalizacje na serwerze
// (device_account/offline solver itp.) — font OLED ma tylko ¹²³ z tego
// zakresu, reszta (w tym sam minus ⁻) byla niewidoczna.
static inline char _supToAscii(uint32_t cp) {
    switch (cp) {
        case 0x2070: return '0'; case 0x00B9: return '1'; case 0x00B2: return '2';
        case 0x00B3: return '3'; case 0x2074: return '4'; case 0x2075: return '5';
        case 0x2076: return '6'; case 0x2077: return '7'; case 0x2078: return '8';
        case 0x2079: return '9'; case 0x207A: return '+'; case 0x207B: return '-';
        case 0x207D: return '('; case 0x207E: return ')'; case 0x207F: return 'n';
        case 0x2071: return 'i';
        default: return 0;
    }
}

// Tablica komend LaTeX -> UTF-8/ASCII.
struct _SolSym { const char* cmd; const char* utf8; };
static const _SolSym _SOL_SYMS[] = {
    // Litery greckie — prawdziwy Unicode, renderowane osobnym fontem
    // (u8g2_font_unifont_t_greek) przez _solDrawMathLine().
    {"alpha","α"},{"beta","β"},{"gamma","γ"},{"delta","δ"},{"epsilon","ε"},
    {"varepsilon","ε"},{"zeta","ζ"},{"eta","η"},{"theta","θ"},{"vartheta","θ"},
    {"iota","ι"},{"kappa","κ"},{"lambda","λ"},{"mu","μ"},{"nu","ν"},{"xi","ξ"},
    {"pi","π"},{"rho","ρ"},{"sigma","σ"},{"tau","τ"},{"upsilon","υ"},
    {"phi","φ"},{"varphi","φ"},{"chi","χ"},{"psi","ψ"},{"omega","ω"},
    {"Gamma","Γ"},{"Delta","Δ"},{"Theta","Θ"},{"Lambda","Λ"},{"Xi","Ξ"},
    {"Pi","Π"},{"Sigma","Σ"},{"Phi","Φ"},{"Psi","Ψ"},{"Omega","Ω"},
    // Operatory obecne w foncie OLED — prawdziwy Unicode.
    {"cdot","·"},{"times","×"},{"div","÷"},{"pm","±"},{"ast","*"},
    {"sim","~"},{"neg","¬"},{"lnot","¬"},{"deg","°"},{"circ","°"},{"degree","°"},
    // Reszta — font ich nie ma, zamiana na czytelne ASCII.
    {"mp","-+"},
    {"leq","<="},{"le","<="},{"geq",">="},{"ge",">="},{"neq","!="},{"ne","!="},
    {"approx","~="},{"equiv","==="},{"cong","~="},
    {"infty","inf"},{"partial","d"},{"prime","'"},
    {"rightarrow","->"},{"to","->"},{"leftarrow","<-"},{"leftrightarrow","<->"},
    {"Rightarrow","=>"},{"implies","=>"},{"Leftarrow","<-"},{"iff","<=>"},
    {"Leftrightarrow","<=>"},{"mapsto","->"},
    {"notin","not in"},{"emptyset","{}"},{"varnothing","{}"},{"forall","for all"},
    {"land","AND"},{"wedge","AND"},{"lor","OR"},{"vee","OR"},
    {"cup","union"},{"cap","intersect"},
    {"parallel","||"},{"ldots","..."},{"dots","..."},{"cdots","..."},
    {"mathbb",""},{"left",""},{"right",""},{"quad"," "},{"qquad","  "},
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
            // \sqrt[n]{x} -> root_n(x) ; \sqrt{x} -> sqrt(x) — "√" (U+221A)
            // nie istnieje w foncie OLED (6x12_te), byla niewidoczna.
            if (wlen == 4 && strncmp(s+i+1,"sqrt",4)==0) {
                i = j;
                bool hasIdx = (i<n && s[i]=='[');
                const char* r = hasIdx ? "root_" : "sqrt"; while(*r && di<cap-1) dst[di++]=*r++;
                if (hasIdx) {
                    i++; while(i<n && s[i]!=']'){ if(di<cap-1)dst[di++]=s[i]; i++; } if(i<n&&s[i]==']')i++;
                }
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
            } else if (i<n && (s[i]=='-' || (s[i]>='0'&&s[i]<='9'))) {
                // wykladnik bez klamer: "10^-12"/"10^12" (cyfry) ORAZ
                // "e^-x"/"2^-n" (ujemna zmienna, bez cyfr) — zjedz caly
                // ciag (opcjonalny minus + cyfry, LUB minus + jeden znak gdy
                // po minusie nie ma cyfr) jako jedna grupe. Inaczej tylko
                // "-" trafialoby do exponentu, a reszta zostawala na linii.
                int j2 = i;
                bool neg = false;
                if (s[j2]=='-') { neg = true; j2++; }
                int digitsStart = j2;
                while (j2<n && s[j2]>='0' && s[j2]<='9') j2++;
                if (neg && j2 == digitsStart && j2<n) {
                    int cl = _utf8Len((uint8_t)s[j2]); j2 += cl;
                }
                if (j2 - i > 1) { if(di<cap-1)dst[di++]='('; while(i<j2&&di<cap-1) dst[di++]=s[i++]; if(di<cap-1)dst[di++]=')'; }
                else { while(i<j2&&di<cap-1) dst[di++]=s[i++]; }
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
// JSON bez ArduinoJson (jak w innych modulach), ale z kompletna obsluga
// stringow: escapowanie tresci zadania w body + dekodowanie odpowiedzi.
// ---------------------------------------------------------------------------
// Dopisuje s do out jako zawartosc stringu JSON (bez cudzyslowow). Znaki
// kontrolne -> \n \r \t albo \u00XX (wczesniej surowy tab/CR psul JSON).
static void _solJsonEscapeAppend(String& out, const char* s) {
    for (; *s; s++) {
        uint8_t c = (uint8_t)*s;
        switch (c) {
            case '"':  out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n";  break;
            case '\r': out += "\\r";  break;
            case '\t': out += "\\t";  break;
            default:
                if (c < 0x20) {
                    char u[8];
                    snprintf(u, sizeof(u), "\\u%04x", (unsigned)c);
                    out += u;
                } else {
                    out += (char)c;   // UTF-8 bez zmian (poprawny JSON)
                }
                break;
        }
    }
}

static int _solHex4(const char* p) {
    int v = 0;
    for (int i = 0; i < 4; i++) {
        char c = p[i];
        int dg;
        if (c >= '0' && c <= '9')      dg = c - '0';
        else if (c >= 'a' && c <= 'f') dg = c - 'a' + 10;
        else if (c >= 'A' && c <= 'F') dg = c - 'A' + 10;
        else return -1;   // takze NUL — nie czytamy za koncem
        v = (v << 4) | dg;
    }
    return v;
}

static int _solUtf8Encode(uint32_t cp, char* out) {
    if (cp < 0x80)    { out[0] = (char)cp; return 1; }
    if (cp < 0x800)   { out[0] = (char)(0xC0 | (cp >> 6));
                        out[1] = (char)(0x80 | (cp & 0x3F)); return 2; }
    if (cp < 0x10000) { out[0] = (char)(0xE0 | (cp >> 12));
                        out[1] = (char)(0x80 | ((cp >> 6) & 0x3F));
                        out[2] = (char)(0x80 | (cp & 0x3F)); return 3; }
    out[0] = (char)(0xF0 | (cp >> 18));
    out[1] = (char)(0x80 | ((cp >> 12) & 0x3F));
    out[2] = (char)(0x80 | ((cp >> 6) & 0x3F));
    out[3] = (char)(0x80 | (cp & 0x3F));
    return 4;
}

// Dekoduje string JSON. src = PIERWSZY znak tresci (za otwierajacym '"').
// Koniec na pierwszym NIEzescapowanym '"' — sekwencje sa zjadane po kolei,
// wiec `\\"` poprawnie konczy string (stary parser patrzyl tylko na
// poprzedni bajt i przy `\\"` czytal dalej). Obsluga: \" \\ \/ \n \t (->
// spacja) \r \b \f (pomijane), \uXXXX z parami surogatow -> UTF-8 (ten sam
// tor co surowe UTF-8 z serwera: fonty OLED / _solUtf8ToAscii; NUL
// i niesparowane surogaty -> '?', znaki kontrolne -> spacja).
// Wynik w dst (max cap-1 bajtow + NUL), bez urwanego znaku wielobajtowego.
// Zwraca false, gdy tresc obcieto do cap.
static bool _solJsonUnescape(const char* src, char* dst, size_t cap) {
    size_t di = 0;
    bool fit = true;
    const char* p = src;
    while (*p && *p != '"') {
        char tmp[4];
        int tn = 0;
        if (*p == '\\') {
            char e = p[1];
            if (e == '\0') break;   // urwany JSON
            p += 2;
            switch (e) {
                case 'n': tmp[tn++] = '\n'; break;
                case 't': tmp[tn++] = ' ';  break;
                case 'r': case 'b': case 'f': break;
                case 'u': {
                    int hi = _solHex4(p);
                    if (hi < 0) { tmp[tn++] = '?'; break; }
                    p += 4;
                    uint32_t cp = (uint32_t)hi;
                    if (cp >= 0xD800 && cp <= 0xDBFF) {
                        int lo = (p[0] == '\\' && p[1] == 'u') ? _solHex4(p + 2) : -1;
                        if (lo >= 0xDC00 && lo <= 0xDFFF) {
                            cp = 0x10000 + ((cp - 0xD800) << 10) + ((uint32_t)lo - 0xDC00);
                            p += 6;
                        } else {
                            cp = '?';
                        }
                    } else if (cp >= 0xDC00 && cp <= 0xDFFF) {
                        cp = '?';
                    }
                    if (cp == 0)        cp = '?';
                    else if (cp < 0x20) cp = (cp == '\n') ? '\n' : ' ';
                    tn = _solUtf8Encode(cp, tmp);
                    break;
                }
                default: tmp[tn++] = e; break;   // \" \\ \/ i nieznane: sam znak
            }
        } else {
            tmp[tn++] = *p++;
        }
        if (di + (size_t)tn > cap - 1) { fit = false; break; }
        memcpy(dst + di, tmp, tn);
        di += tn;
    }
    if (!fit) {
        // Surowe UTF-8 kopiujemy bajt po bajcie — nie zostawiaj urwanego znaku.
        size_t k = di;
        while (k > 0 && (((uint8_t)dst[k - 1]) & 0xC0) == 0x80) k--;
        if (k > 0 && (uint8_t)dst[k - 1] >= 0xC0 &&
            (int)(di - (k - 1)) < _utf8Len((uint8_t)dst[k - 1])) di = k - 1;
    }
    dst[di] = '\0';
    return fit;
}

// Znajduje "key": "..." w odpowiedzi i dekoduje wartosc do dst.
// false = brak klucza (albo wartosc nie jest stringiem).
static bool _solJsonGetString(const String& resp, const char* key, char* dst, size_t cap,
                              bool* truncated = nullptr) {
    String pat = String("\"") + key + "\":";
    int i = resp.indexOf(pat);
    if (i < 0) return false;
    i += pat.length();
    const int n = (int)resp.length();
    while (i < n && (resp[i] == ' ' || resp[i] == '\t' || resp[i] == '\r' || resp[i] == '\n')) i++;
    if (i >= n || resp[i] != '"') return false;
    bool fit = _solJsonUnescape(resp.c_str() + i + 1, dst, cap);
    if (truncated) *truncated = !fit;
    return true;
}

// ---------------------------------------------------------------------------
// Bufory rozwiazania — w PSRAM, alokowane raz przy pierwszym uzyciu (bez
// PSRAM: zwykly malloc). Wczesniej ~96 KB statycznych tablic w wewnetrznym
// SRAM (_solConverted, _stSolution, _jpSolution, _lines) konkurowalo
// z mbedTLS. Odpowiedz tekstowa i ze zdjecia dziela jeden bufor (nigdy nie
// sa uzywane naraz), a linie to tylko offsety w tekscie po konwersji.
// ---------------------------------------------------------------------------
#define _SOL_CONV_MAX     (_SOL_SOLUTION_MAX + 4096)   // LaTeX -> UTF-8 bywa nieco dluzsze
#define _SOL_LINES_MAX    1200  // linii ekranu (wczesniej 150 — dluzsze rozwiazania ucinane po cichu)
#define _SOL_LINE_LEN     160   // bajty/linie (UTF-8: polskie znaki i symbole 2-3 B)
#define _SOL_MARK_ROOM    48    // zapas na znacznik obciecia

struct _SolBufs {
    char     resp[_SOL_SOLUTION_MAX + _SOL_MARK_ROOM];   // rozwiazanie z odpowiedzi serwera
    char     conv[_SOL_CONV_MAX + _SOL_MARK_ROOM];       // po konwersji LaTeX -> UTF-8
    uint16_t lineStart[_SOL_LINES_MAX];                  // offset linii w conv
    uint8_t  lineLen[_SOL_LINES_MAX];                    // dlugosc linii w bajtach
};
static _SolBufs* _solBufs = nullptr;

static _SolBufs* _solGetBufs() {
    if (!_solBufs) {
        _solBufs = (_SolBufs*)ps_malloc(sizeof(_SolBufs));
        if (!_solBufs) _solBufs = (_SolBufs*)malloc(sizeof(_SolBufs));
        if (_solBufs) Serial.printf("[SOL] bufory rozwiazania: %u B\n", (unsigned)sizeof(_SolBufs));
        else          Serial.println("[SOL] BLAD: brak pamieci na bufory rozwiazania");
    }
    return _solBufs;
}

// Znacznik konca obcietego rozwiazania (ASCII — font OLED nie ma "…").
static const char* _solTruncMark() {
    return _solT("...(obcieto)", "...(truncated)", "...(gekuerzt)", "...(zkraceno)");
}

// ---------------------------------------------------------------------------
// Wyswietlanie rozwiazania (przewijane UP/DOWN, wyjscie LEFT)
// Tekst jest zawijany reczne co ~40 znakow na linie ekranu 6x10
// ---------------------------------------------------------------------------

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
            int cl;
            uint32_t cp = _utf8Decode(text + i, cl);
            char supAscii = _supToAscii(cp);
            if (supAscii) {
                // Awaryjne podniesienie literalnego superscriptu (patrz komentarz
                // przy _supToAscii) — ta sama technika co dla "^(...)".
                i += cl;
                char exp1[2] = { supAscii, '\0' };
                d.setFont(u8g2_font_5x7_tf);
                int w = d.drawUTF8(xi, y - 4, exp1);
                xi += (w > 0 ? w : 5) + 1;
                continue;
            }
            char ch[5];
            int q = 0;
            for (; q < cl && i < len; q++) ch[q] = text[i++];
            ch[q] = '\0';
            // Litery greckie -> osobny font (u8g2_font_6x12_te ich nie ma).
            // Ten sam kodpunkt, ta sama linia bazowa — dokladnie jak w
            // tools/greek_font_test, gdzie wizualnie zweryfikowano ze tak
            // wygenerowany mix czyta sie dobrze mimo wiekszej wysokosci glifu.
            // Cyrylica (odpowiedzi po bialorusku, jezyk 6) -> 6x12_t_cyrillic:
            // ten sam font bazowy (Misc-Fixed 6x12) co 6x12_te, wiec identyczna
            // szerokosc/linia bazowa; 6x12_te nie ma bloku U+0400..04FF, a
            // 6x12_t_cyrillic nie ma Latin-ext (polskie/czeskie) — stad
            // przelaczanie per znak zamiast jednego fontu dla calego tekstu.
            d.setFont(_isGreek(cp) ? u8g2_font_unifont_t_greek
                    : _isCyrillic(cp) ? u8g2_font_6x12_t_cyrillic
                    : u8g2_font_6x12_te);
            int w = d.drawUTF8(xi, y, ch);
            xi += (w > 0 ? w : 6);
        }
    }
    return xi - x;
}

// Czytanie rozwiazania: auto-sleep najwczesniej po 10 min bez klawisza
// (wczesniej trwala blokada snu — zapomniany kalkulator rozladowywal sie).
#define _SOL_READ_SLEEP_MS  (10UL * 60UL * 1000UL)

static void _solDisplaySolution(U8G2 &d, const char* solution, const char* headerLabel = "AI") {
    _SolBufs* B = _solGetBufs();
    if (!B) {
        _solDrawError(d, _solT("Brak pamieci!", "Out of memory!", "Kein Speicher!", "Malo pameti!"), "");
        return;
    }

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
    int di = 0;
    _solLatexEmit(solution, (int)strlen(solution), B->conv, di, _SOL_CONV_MAX);
    B->conv[di] = '\0';
    bool truncated = (di >= _SOL_CONV_MAX - 1);   // konwerter doszedl do konca bufora

    // Podziel na linie — liczymy KODPUNKTY UTF-8 (nie bajty), zeby nie urwac w
    // srodku znaku wielobajtowego i zawijac po realnej liczbie widocznych znakow.
    // Linia = offset + dlugosc w B->conv (bez kopiowania tekstu).
    int lineCount = 0;
    const int slen = di;
    int pos  = 0;

    while (pos < slen && lineCount < _SOL_LINES_MAX - 1) {   // -1: miejsce na znacznik
        int end = pos;
        int cols = 0;
        int lastSpace = -1;
        while (end < slen && cols < LINE_CHARS) {
            if (B->conv[end] == '\n') break;
            if (B->conv[end] == ' ') lastSpace = end;
            end += _utf8Len((uint8_t)B->conv[end]);
            cols++;
        }
        if (end > slen) end = slen;
        // Zawroc do ostatniej spacji jesli urwalismy w srodku slowa
        if (end < slen && B->conv[end] != '\n' && cols >= LINE_CHARS && lastSpace > pos)
            end = lastSpace;
        int len = end - pos;
        if (len > _SOL_LINE_LEN) len = _SOL_LINE_LEN;
        B->lineStart[lineCount] = (uint16_t)pos;
        B->lineLen[lineCount]   = (uint8_t)len;
        lineCount++;
        pos = end;
        if (pos < slen && (B->conv[pos] == '\n' || B->conv[pos] == ' '))
            pos++;
    }
    if (pos < slen) truncated = true;
    if (truncated) {
        // Znacznik za koncem tekstu (zapas _SOL_MARK_ROOM w conv) — wczesniej
        // dluga odpowiedz byla ucinana po cichu.
        int mpos = di + 1;
        strncpy(B->conv + mpos, _solTruncMark(), _SOL_MARK_ROOM - 2);
        B->conv[mpos + _SOL_MARK_ROOM - 2] = '\0';
        B->lineStart[lineCount] = (uint16_t)mpos;
        B->lineLen[lineCount]   = (uint8_t)strlen(B->conv + mpos);
        lineCount++;
    }

    Serial.printf("[SOL] lineCount=%d%s\n", lineCount, truncated ? " (obcieto)" : "");

    // Czekaj na puszczenie przyciskow (max 2 s)
    _solWaitRelease();
    delay(200);
    _solLastPress = millis();

    powerSetMinTimeout(_SOL_READ_SLEEP_MS);
    bool needRedraw = true;
    int scroll = 0;

    while (true) {
        // panicCheck + sen (po _SOL_READ_SLEEP_MS bez klawisza) w _solTick()
        if (_solTick()) needRedraw = true;
        if (panicTriggered()) {
            powerSetMinTimeout(0);
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
                char lb[_SOL_LINE_LEN + 1];
                int ll = B->lineLen[li];
                memcpy(lb, B->conv + B->lineStart[li], ll);
                lb[ll] = '\0';
                _solDrawMathLine(d, 2, LINE_Y0 + i * LINE_H, lb);
            }

            // Stopka
            d.drawHLine(0, 55, 256);
            d.setFont(u8g2_font_5x7_tf);
            d.drawStr(2, 63, _solT("< wyjdz  UP/DN scroll", "< exit  UP/DN scroll", "< raus  UP/DN scroll", "< konec  UP/DN posun"));

            d.sendBuffer();
            needRedraw = false;
        }

        unsigned long now = millis();
        if (now - _solLastPress > 180UL) {
            if (inputBtn(BTN_UP) == LOW) {
                _solLastPress = now;
                if (scroll > 0) { scroll--; needRedraw = true; }
            } else if (inputBtn(BTN_DOWN) == LOW) {
                _solLastPress = now;
                if (scroll + VISIBLE < lineCount) { scroll++; needRedraw = true; }
            } else if (inputBtn(BTN_LEFT) == LOW || inputBtn(BTN_OK) == LOW) {
                _solLastPress = now;
                Serial.println("[SOL] EXIT");
                _solWaitRelease();
                delay(100);
                powerSetMinTimeout(0);   // przywroc zwykly czas auto-sleep
                return;
            }
        }
        delay(10);
    }
}

// ---------------------------------------------------------------------------
// Sprawdz WiFi — polacz jesli nie jest polaczony (uzyj zapisanych danych)
// Zwraca true jesli polaczony. false takze po C/CE (anuluj) i panic —
// wolajacy kolejkuje wtedy zadanie jak przy braku WiFi.
// ---------------------------------------------------------------------------
// Forward decl z device_account.h (zaimplementowane w main.cpp helperze)
extern bool accountRegisterOnce();

// "Lacze z serwerem..." z kreconym [/-\|] — rejestracja (HTTPS, do kilkunastu
// sekund przy slabym lacu) biegnie w osobnym zadaniu na Core 0, a watek UI
// w tym czasie odswieza animacje. Wczesniej accountRegisterOnce() blokowalo
// petle UI i znaczek stal w miejscu (zgloszenie wlasciciela 2026-10-18).
struct _SolRegCtx { volatile bool done; };
static void _solRegTaskFn(void* arg) {
    accountRegisterOnce();
    ((_SolRegCtx*)arg)->done = true;
    vTaskDelete(nullptr);
}
static void _solRegisterWithSpinner(U8G2 &d) {
    const char* msg = _solT("Lacze z serwerem...", "Contacting server...", "Verbinde mit Server...", "Pripojuji k serveru...");
    _SolRegCtx ctx;
    ctx.done = false;
    TaskHandle_t t = nullptr;
    if (xTaskCreatePinnedToCore(_solRegTaskFn, "solReg", 16384, &ctx, 1, &t, 0) != pdPASS) {
        _solDrawLoading(d, msg, 0);
        accountRegisterOnce();   // brak pamieci na zadanie — po staremu (blokujaco)
        return;
    }
    int frame = 0;
    uint32_t last = 0;
    while (!ctx.done) {
        panicCheck();
        if (last == 0 || millis() - last >= 150) {
            last = millis();
            _solDrawLoading(d, msg, frame++);
        }
        delay(10);
    }
}

// Ustawiane przez _solNetTaskFn gdy wysylka nie dostala zadnej odpowiedzi HTTP
// (-1) — patrz komentarz tam. Kasowane po swiezym polaczeniu.
static volatile bool _solLinkSuspect = false;

static bool _solEnsureWifi(U8G2 &d) {
    if (WiFi.status() == WL_CONNECTED) {
        const bool hasIp = WiFi.localIP() != IPAddress(0, 0, 0, 0);
        if (hasIp && !_solLinkSuspect) {
            _solRegisterWithSpinner(d);
            return true;
        }
        // WL_CONNECTED, ale brak IP albo poprzednia wysylka padla na transporcie:
        // zerwij skojarzenie i polacz od nowa (nizej, normalna sciezka).
        Serial.printf("[WiFi] lacze podejrzane (ip=%d suspect=%d) -> reconnect\n", (int)hasIp, (int)_solLinkSuspect);
        logEventf("WIFI", "reconnect: ip=%d suspect=%d rssi=%d", (int)hasIp, (int)_solLinkSuspect, WiFi.RSSI());
        WiFi.disconnect(false, false);
        for (int i = 0; i < 40 && WiFi.status() == WL_CONNECTED; i++) delay(25);   // begin() jest no-op, dopoki status==CONNECTED
        _solLinkSuspect = false;
        _wifiBeginAt = 0;   // swiadome rozlaczenie — nowy begin MA sie wykonac (nie "laczenie trwa")
    }

    // Sprobuj zaladowac zapisane dane
    char ssid[33] = "";
    char pass[64] = "";
    wifiLoadSaved(ssid, sizeof(ssid), pass, sizeof(pass));

    if (ssid[0] == '\0') {
        _solDrawError(d,
            _solT("Brak WiFi!", "No WiFi!", "Kein WLAN!", "Neni WiFi!"),
            _solT("Ustaw siec w menu.", "Set network in menu.", "WLAN im Menue einstellen.", "Nastavte sit v menu."));
        return false;
    }

    // Proba polaczenia (z cache BSSID+kanal dla szybszego reconnectu)
    char ln[48];
    snprintf(ln, sizeof(ln), _solT("Lacze z: %s", "Connecting: %s", "Verbinde: %s", "Pripojuji: %s"), ssid);

    // Auto-connect z loop() (3 s po wejsciu w menu) moze wlasnie trwac —
    // drugi WiFi.begin zerwalby swiezo nawiazane skojarzenie (ASSOC_LEAVE) i
    // hotspot iPhone odrzucalby kolejne proby przez kilkanascie sekund.
    const bool joining = wifiJoinInProgress();
    if (joining) {
        Serial.println("[WiFi] dolaczam do trwajacego laczenia (bez nowego begin)");
    } else {
        wifiStaOnLimited();         // STA + TxPower (KALK_WIFI_TX_POWER)
        wifiFastBegin(ssid, pass);  // cache BSSID+kanal pomija skan (~1-3s)
    }

    (void)inputKeyConsume(KEY_CCE);   // stare zbocze C/CE nie moze od razu anulowac
    unsigned long start = joining ? (unsigned long)_wifiBeginAt : millis();
    unsigned long lastFrame = 0;
    int frame = 0;
    bool fellBack = false;
    while (WiFi.status() != WL_CONNECTED) {
        unsigned long elapsed = millis() - start;
        // Panic / C/CE (anuluj) sprawdzane w trakcie czekania — bez snu:
        // to tylko kilkanascie sekund tuz po nacisnieciu klawisza.
        inputScan();
        panicCheck();
        if (panicTriggered() || inputKeyConsume(KEY_CCE)) {
            memset(pass, 0, sizeof(pass));
            return false;
        }
        // Hint (BSSID+kanal) moze byc nieaktualny nawet dla tej samej sieci
        // (AP zmienil kanal, restart routera). Jesli po 6s wciaz nic — raz
        // sprobuj zwyklego begin bez hinta, zamiast czekac caly timeout i
        // oddawac "zle haslo" mimo poprawnych danych.
        // Tylko gdy hint faktycznie byl uzyty — bez niego fallback to tylko
        // zbedny disconnect+begin, ktory drazni AP.
        if (!fellBack && _wifiHintUsed && elapsed > 6000) {
            fellBack = true;
            Serial.println("[WiFi] fast begin nie polaczyl w 6s, fallback bez hinta");
            WiFi.disconnect(false, false);
            delay(50);
            WiFi.begin(ssid, pass);
            _wifiHintUsed = false;
        }
        if (elapsed > 20000) {
            memset(pass, 0, sizeof(pass));
            logEvent("WIFI", "connect timeout 20s");
            _solDrawError(d,
                _solT("Blad WiFi!", "WiFi failed!", "WLAN Fehler!", "Chyba WiFi!"),
                _solT("Sprawdz haslo.", "Check password.", "Passwort pruefen.", "Zkontrolujte heslo."));
            return false;
        }
        if (lastFrame == 0 || millis() - lastFrame >= 250) {
            lastFrame = millis();
            d.clearBuffer();
            d.setFont(u8g2_font_6x10_tf);
            d.drawStr(2, 20, ln);
            const char* frames[] = {"/", "-", "\\", "|"};
            char anim[4];
            snprintf(anim, sizeof(anim), "[%s]", frames[frame++ % 4]);
            d.drawStr(120, 40, anim);
            d.setFont(u8g2_font_5x7_tf);
            d.drawStr(2, 62, _solT("C/CE = anuluj (zadanie do kolejki)", "C/CE = cancel (task to queue)", "C/CE = abbrechen (in Warteschlange)", "C/CE = zrusit (uloha do fronty)"));
            d.sendBuffer();
        }
        delay(30);
    }
    memset(pass, 0, sizeof(pass));
    wifiSaveBssidChannel();      // zapisz BSSID+kanal do NVS na nastepny raz
    wifiApplyDnsFallback();      // zapasowy DNS (slot 1), DHCP nietkniete
    _solRegisterWithSpinner(d);  // zarejestruj device po pierwszym polaczeniu
    return true;
}

// ---------------------------------------------------------------------------
// Wysylka zadania do /api/device/solve — JEDNA wspolna sciezka dla tekstu
// i zdjecia (wczesniej dwie kopie z osobnymi parserami).
//
// Wynik:
//   _SOL_RES_OK    — rozwiazanie dotarlo, zapisane w historii i pokazane,
//   _SOL_RES_RETRY — blad przejsciowy: transport (httpCode <= 0), 429, 5xx
//                    -> zadanie moze trafic do kolejki offline,
//   _SOL_RES_FATAL — blad trwaly: pozostale 4xx (402 tokeny, 403 licencja/
//                    blokada, 413 za duze...), 200 bez rozwiazania
//                    -> ponawianie nic nie da, NIE kolejkowac.
// Bledow nie rysuje (robi to wolajacy — wie, co sie stalo z zadaniem).
//
// x-request-id: to samo id przy pierwszej wysylce i przy kazdym ponowieniu
// z kolejki — serwer w ciagu ~20 min zwraca zapisany wynik bez ponownego
// pobierania tokenow (np. gdy odpowiedz zginela po stronie sieci).
// ---------------------------------------------------------------------------
enum : uint8_t { _SOL_RES_OK = 0, _SOL_RES_RETRY = 1, _SOL_RES_FATAL = 2 };
#define _SOL_HTTP_NOMEM  (-1000)   // lokalny brak pamieci (nie kod HTTP)

struct _SolSendRes {
    uint8_t kind;      // _SOL_RES_*
    int     http;      // kod HTTP (<= 0 = blad transportu, _SOL_HTTP_NOMEM)
    char    msg[64];   // komunikat bledu z serwera ("error"), moze byc pusty
};

// Kontekst dla _solNetTaskFn — http.POST() biegnie na Core 0, zeby petla UI
// (Core 1, main.cpp) mogla sprawdzac panic w trakcie najdluzszego czekania
// (serwer generuje odpowiedz AI — bywa to kilka-kilkanascie sekund). Watek
// glowny ZAWSZE czeka na ctx.done przed wyjsciem z _solPostSolve (zero
// wspoldzielonych buforow po powrocie — body/http/client zyja tylko
// wewnatrz tej funkcji, nigdy nie "uciekaja" do tla po jej zakonczeniu).
struct _SolNetTaskCtx {
    HTTPClient* http;
    const uint8_t* body;
    size_t bodyLen;
    volatile bool done;
    volatile bool abort;   // panic — przerwij miedzy probami DNS
    int httpCode;
};

static void _solNetTaskFn(void* arg) {
    _SolNetTaskCtx* ctx = (_SolNetTaskCtx*)arg;
    // Najpierw realny DNS (z 3 strategiami) — wczesniej "-1 connection
    // refused" bralo sie z "hostByName(): DNS Failed" w srodku HTTPClient::POST
    // po ~13 s; teraz gdy DNS naprawde nie dziala, od razu oddajemy blad
    // transportu (zadanie idzie do kolejki) zamiast czekac drugi raz.
    // Do 2 prob polaczenia: -1 oznacza, ze nic jeszcze nie poszlo do serwera
    // (timeout polaczenia / TLS), wiec powtorka nie dubluje zadania. Przy
    // slabym lacu (hotspot z telefonu, RSSI -60..-70) pierwsze SYN-y gina.
    int code = -1;
    for (int attempt = 0; attempt < 2 && !ctx->abort; attempt++) {
        if (!wifiEnsureDns(KALKMATE_HOST, &ctx->abort)) break;
        if (ctx->abort) break;
        code = ctx->http->POST((uint8_t*)ctx->body, ctx->bodyLen);
        if (code != -1) break;
        Serial.printf("[SOL] polaczenie nieudane (proba %d/2)\n", attempt + 1);
        logEventf("SOL", "connect fail try %d/2 rssi=%d", attempt + 1, WiFi.RSSI());
    }
    // Zero odpowiedzi HTTP mimo WL_CONNECTED = lacze prawdopodobnie martwe
    // (polowiczne skojarzenie, brak IP po DHCP). Oznacz, zeby nastepne
    // _solEnsureWifi() zerwalo i odnowilo polaczenie zamiast ufac fladze
    // WL_CONNECTED — wczesniej siec zostawala martwa do restartu.
    if (code == -1 && !ctx->abort) _solLinkSuspect = true;
    ctx->httpCode = code;
    ctx->done = true;
    vTaskDelete(nullptr);
}

static _SolSendRes _solPostSolve(U8G2 &d, const char* contentType,
                                 const uint8_t* body, size_t bodyLen,
                                 const char* reqId, const String& histQuestion) {
    _SolSendRes res;
    res.kind = _SOL_RES_FATAL;
    res.http = 0;
    res.msg[0] = '\0';

    _SolBufs* B = _solGetBufs();
    if (!B) { res.kind = _SOL_RES_RETRY; res.http = _SOL_HTTP_NOMEM; return res; }

    char licKey[40];
    wifiLoadLicense(licKey, sizeof(licKey));

    // Diagnostyka start_ssl_client: -1 (2026-10-17) — TLS po 2x camera init/deinit
    // bywa failuje; sprawdzamy czy to faktycznie brak pamieci DMA-zdolnej (internal),
    // nie PSRAM (oba bufory, kamery i solve, juz sa w PSRAM).
    Serial.printf("[SOL] heap free=%u largest_internal=%u psram_free=%u\n",
        (unsigned)ESP.getFreeHeap(),
        (unsigned)heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL),
        (unsigned)ESP.getFreePsram());

    WiFiClientSecure client;
    client.setCACert(KALKMATE_CA_CERT);
    client.setTimeout(60);
    HTTPClient http;
    http.begin(client, _SOL_SOLVE_ENDPOINT);
    http.addHeader("Content-Type", contentType);
    http.addHeader("x-api-key", KALK_API_KEY);
    http.addHeader("x-device-id", _solDeviceId());
    http.addHeader("x-fw-version", FW_VERSION);
    if (licKey[0]) http.addHeader("x-license-key", licKey);
    http.addHeader("x-solve-mode", String((int)kalkSettings.solveMode));
    http.addHeader("x-language", kalkLangCode(kalkSettings.language));   // pl..it (settings_screen.h)
    { char dt[68]=""; wifiLoadDeviceToken(dt,sizeof(dt)); if(dt[0]) http.addHeader("x-device-token",dt); memset(dt,0,sizeof(dt)); }
    if (reqId && reqId[0]) http.addHeader("x-request-id", reqId);
    http.setTimeout(_SOL_HTTP_TIMEOUT_MS);
    http.setConnectTimeout(12000);   // domyslnie 5000 ms -> "start_ssl_client: -1" na slabym lacu

    Serial.printf("[SOL] POST %u B, req=%s\n", (unsigned)bodyLen, (reqId && reqId[0]) ? reqId : "-");

    // POST na Core 0 — watek UI tu nizej tylko czeka i co ~30ms sprawdza
    // panic + odswieza animacje, zamiast siedziec zablokowany w http.POST()
    // (poprzednio: panic byl martwy przez caly czas generowania odpowiedzi
    // AI, czesto najdluzszy moment calego dzialania kalkulatora).
    _SolNetTaskCtx ctx;
    ctx.http = &http;
    ctx.body = body;
    ctx.bodyLen = bodyLen;
    ctx.done = false;
    ctx.abort = false;
    ctx.httpCode = 0;
    TaskHandle_t netTask = nullptr;
    // 12288 B (jak w remote_session.h) wystarcza na malutka ramke (~2.7KB) —
    // tu TLS obsluguje payload do ~190KB (zdjecie), duzo wiecej wewnetrznego
    // buforowania w HTTPClient/mbedTLS. 12KB realnie przepelnialo stos i
    // korumpowalo pamiec (Guru Meditation "Stack canary watchpoint triggered
    // (loopTask)", zdjecie 2026-10-18, zero zwiazku z panic — crash przy
    // normalnym solve). Dajemy duzy zapas, ESP32-S3 ma na to miejsce.
    BaseType_t taskOk = xTaskCreatePinnedToCore(_solNetTaskFn, "solPost", 32768, &ctx, 1, &netTask, 0);
    if (taskOk != pdPASS) {
        // Brak pamieci na zadanie (bardzo malo prawdopodobne, ale bez tego
        // ponizsza petla czekalaby na ctx.done w nieskonczonosc) — wracamy
        // do zwyklego, blokujacego POST na tym samym watku.
        Serial.println("[SOL] xTaskCreate failed — fallback na blokujacy POST");
        logEvent("SOL", "xTaskCreate failed, fallback blocking POST");
        ctx.httpCode = wifiEnsureDns() ? http.POST((uint8_t*)body, bodyLen) : -1;
        ctx.done = true;
    }

    bool panicAborted = false;
    uint32_t lastFrame = 0;
    int frame = 0;
    while (!ctx.done) {
        panicCheck();
        if (panicTriggered() && !panicAborted) {
            panicAborted = true;
            ctx.abort = true;   // przerwie petle prob DNS miedzy strategiami
            client.stop();      // odblokuje http.POST() w tasku prawie od razu
        }
        if (!panicAborted && millis() - lastFrame >= 400) {
            lastFrame = millis();
            d.clearBuffer();
            d.setFont(u8g2_font_6x10_tf);
            d.drawStr(2, 24, _solT("AI rozwiazuje zadanie", "AI solving problem", "KI loest die Aufgabe", "AI resi ulohu"));
            d.setFont(u8g2_font_5x7_tf);
            const char* frames[] = {".", "..", "...", ""};
            char ln[32];
            snprintf(ln, sizeof(ln), "%s%s", _solT("Prosze czekac", "Please wait", "Bitte warten", "Prosim cekejte"), frames[frame++ % 4]);
            d.drawStr(2, 40, ln);
            d.sendBuffer();
        }
        delay(30);
    }
    // UWAGA: petla czeka na ctx.done BEZ WYJATKU (zaden "safety break") —
    // ctx jest na stosie tej funkcji; task pisze do niej az do vTaskDelete().
    // Przedwczesny return zostawilby wskaznik-zombie dla wciaz dzialajacego
    // taska = realna korupcja stosu. client.stop() w praktyce odblokowuje
    // blokujace gniazdo lwIP niemal od razu; w najgorszym razie i tak czeka
    // sie nie dluzej niz standardowy timeout HTTPClienta sprzed tej zmiany.

    int httpCode = ctx.httpCode;
    res.http = httpCode;
    if (httpCode <= 0) {
        http.end();
        if (panicAborted) {
            Serial.println("[SOL] przerwano przyciskiem panic");
            logEvent("SOL", "aborted by panic");
        } else {
            // RSSI dolaczony do diagnozy "start_ssl_client: -1" (2026-10-18) —
            // slaby sygnal to jeden z podejrzanych o powtarzalne zrywanie
            // polaczenia TLS mimo ze WiFi pokazuje "polaczone".
            Serial.printf("[SOL] blad transportu %d, RSSI=%d\n", httpCode, WiFi.RSSI());
            logEventf("SOL", "transport %d (body %u B) RSSI=%d", httpCode, (unsigned)bodyLen, WiFi.RSSI());
        }
        res.kind = _SOL_RES_RETRY;
        return res;
    }

    bool hasSol = false, solTrunc = false;
    {
        String resp = http.getString();
        http.end();
        Serial.printf("[SOL] HTTP %d, resp len=%d\n", httpCode, resp.length());
        if (httpCode == 200) {
            hasSol = _solJsonGetString(resp, "solution", B->resp, _SOL_SOLUTION_MAX + 1, &solTrunc);
        } else {
            _solJsonGetString(resp, "error", res.msg, sizeof(res.msg));
        }
    }   // resp (do ~25 KB) zwolniony przed zapisem historii i wyswietlaniem

    if (httpCode == 200) {
        if (!hasSol) return res;   // FATAL: "Brak odpowiedzi"
        if (solTrunc) {
            size_t l = strlen(B->resp);
            snprintf(B->resp + l, _SOL_MARK_ROOM, "\n%s", _solTruncMark());
        }
        res.kind = _SOL_RES_OK;
        if (!historySave(histQuestion, String(B->resp))) Serial.println("[SOL] historia: wpis pominiety");
        _solDisplaySolution(d, B->resp);
        return res;
    }
    if (httpCode == 429 || (httpCode >= 500 && httpCode <= 599)) res.kind = _SOL_RES_RETRY;
    return res;
}

static _SolSendRes _solSendText(U8G2 &d, const char* taskText, const char* reqId) {
    String body;
    body.reserve(strlen(taskText) + 48);
    body = "{\"mode\":\"text\",\"text\":\"";
    _solJsonEscapeAppend(body, taskText);
    body += "\"}";
    return _solPostSolve(d, "application/json", (const uint8_t*)body.c_str(), body.length(),
                         reqId, String(taskText));
}

// jpegBuf zarzadzany przez wywolujacego (nie zwalniany tu).
static _SolSendRes _solSendJpeg(U8G2 &d, const uint8_t* jpegBuf, size_t jpegLen, const char* reqId) {
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
        _SolSendRes r;
        r.kind = _SOL_RES_RETRY;
        r.http = _SOL_HTTP_NOMEM;
        r.msg[0] = '\0';
        return r;
    }
    memcpy(bodyBuf,                    _mpHdr, hdrLen);
    memcpy(bodyBuf + hdrLen,           jpegBuf, jpegLen);
    memcpy(bodyBuf + hdrLen + jpegLen, _mpFtr, ftrLen);

    _SolSendRes r = _solPostSolve(d, "multipart/form-data; boundary=KalkMateB",
                                  bodyBuf, bodySize, reqId, String("[Zdjecie]"));
    free(bodyBuf);
    return r;
}

// Ekran bledu wysylki: tytul wg kodu HTTP, komunikat serwera, note = co sie
// stalo z zadaniem (np. "w kolejce").
static void _solShowSendError(U8G2 &d, const _SolSendRes& r, const char* note) {
    if (panicTriggered()) return;
    const int c = r.http;
    const char* l1;
    const char* l2 = r.msg;
    if (c == _SOL_HTTP_NOMEM)       l1 = _solT("Brak pamieci!", "Out of memory!", "Kein Speicher!", "Malo pameti!");
    else if (c <= 0)                l1 = _solT("Blad polaczenia", "Connection error", "Verbindungsfehler", "Chyba pripojeni");
    else if (c == 200)              l1 = _solT("Brak odpowiedzi", "No answer", "Keine Antwort", "Zadna odpoved");
    else if (c == 402) {            l1 = _solT("Brak tokenow!", "Out of tokens!", "Keine Tokens mehr!", "Dosly tokeny!");
                                    l2 = _solT("Dokup w sklepie: kalkmate.pl", "Buy more at kalkmate.pl", "Nachkaufen: kalkmate.pl", "Dokupte na kalkmate.pl"); }
    else if (c == 403)              l1 = _solT("Brak dostepu (licencja/blokada)", "Access denied (license/lock)", "Kein Zugriff (Lizenz/Sperre)", "Pristup odepren (licence/zamek)");
    else if (c == 413)              l1 = _solT("Zadanie za duze", "Request too large", "Anfrage zu gross", "Uloha je prilis velka");
    else if (c == 429)              l1 = _solT("Limit zapytan - sprobuj pozniej", "Rate limit - try later", "Limit erreicht - spaeter", "Limit dotazu - zkuste pozdeji");
    else if (c >= 500)              l1 = _solT("Blad serwera / AI", "Server / AI error", "Server-/KI-Fehler", "Chyba serveru / AI");
    else                            l1 = _solT("Blad API:", "API error:", "API Fehler:", "Chyba API:");
    char codeBuf[24];
    if (!l2 || !l2[0]) {
        codeBuf[0] = '\0';
        if (c > 0)                               snprintf(codeBuf, sizeof(codeBuf), "HTTP %d", c);
        else if (c < 0 && c != _SOL_HTTP_NOMEM)  snprintf(codeBuf, sizeof(codeBuf), "(%d)", c);
        l2 = codeBuf;
    }
    _solDrawError(d, l1, l2, note);
}

// Co sie stalo z zadaniem po probie zakolejkowania (3. linia ekranu bledu).
static const char* _solQueueNote(uint8_t q) {
    if (q == OQ_ADDED) return _solT("Zadanie w kolejce - wysle ponownie pozniej",
                                    "Task queued - will retry later",
                                    "In Warteschlange - spaeter erneut",
                                    "Uloha ve fronte - odesle se pozdeji");
    if (q == OQ_FULL)  return _solT("Kolejka pelna (3) - zadanie NIE zapisane",
                                    "Queue full (3) - task NOT saved",
                                    "Warteschlange voll - NICHT gespeichert",
                                    "Fronta plna (3) - uloha NEULOZENA");
    return _solT("Blad zapisu kolejki - zadanie NIE zapisane",
                 "Queue write error - task NOT saved",
                 "Speicherfehler - NICHT gespeichert",
                 "Chyba zapisu fronty - uloha NEULOZENA");
}

// Po zakolejkowaniu bez WiFi: krotki komunikat; gdy sie nie udalo (pelna
// kolejka / blad zapisu) — ekran bledu do potwierdzenia (wczesniej cisza).
static void _solShowQueued(U8G2 &d, uint8_t q, bool photo) {
    if (panicTriggered()) return;
    if (q != OQ_ADDED) {
        _solDrawError(d, _solT("Brak WiFi.", "No WiFi.", "Kein WLAN.", "Neni WiFi."), "", _solQueueNote(q));
        return;
    }
    _solShowInfo(d,
        _solT("Brak WiFi.", "No WiFi.", "Kein WLAN.", "Neni WiFi."),
        photo ? _solT("Zdjecie w kolejce.", "Photo queued.", "Foto in Warteschlange.", "Foto ve fronte.")
              : _solT("Zadanie w kolejce.", "Task queued.", "Aufgabe in Warteschlange.", "Uloha ve fronte."),
        _solT("Wysylka po polaczeniu WiFi.", "Will send when WiFi available.", "Senden nach WLAN-Verbindung.", "Odeslani po pripojeni WiFi."),
        2500);
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
    bool saved = _runKeyboard(d, taskText, sizeof(taskText),
                              _solT("Zadanie: ", "Problem: ", "Aufgabe: ", "Uloha: "));
    if (!saved || taskText[0] == '\0') return;

    // Jedno x-request-id na cale zycie zadania (pierwsza wysylka + ponowienia).
    char rid[17];
    offlineMakeRequestId(rid);

    if (!_solEnsureWifi(d)) {
        // Brak WiFi (albo anulowano / panic) — zakolejkuj, nic nie ginie
        uint8_t q = offlineQueueAddText(taskText, rid, 0);
        _solShowQueued(d, q, false);
        return;
    }
    _SolSendRes r = _solSendText(d, taskText, rid);
    if (r.kind == _SOL_RES_RETRY) {
        // Blad przejsciowy (siec, 5xx, 429) — do kolejki z TYM SAMYM id
        uint8_t q = offlineQueueAddText(taskText, rid, 1);
        if (panicTriggered()) return;   // nie blokuj powrotu ekranem bledu
        _solShowSendError(d, r, _solQueueNote(q));
    } else if (r.kind == _SOL_RES_FATAL) {
        _solShowSendError(d, r, nullptr);   // trwaly blad — kolejka nic nie da
    }
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
// podpowiedzi.
// Zwraca: 1 = rob zdjecie, 0 = anuluj (<, C/CE, panic, bezczynnosc),
//        -1 = kamera nie daje klatek (wolajacy pokazuje blad PO camEnd()).
// Bez auto-sleep (kamera pracuje) — po _SOL_PREVIEW_IDLE_MS bez klawisza
// podglad sie zamyka, a dalej usypia juz zwykly ekran wyboru trybu.
// ---------------------------------------------------------------------------
#define _SOL_PREVIEW_IDLE_MS  120000UL

static int _solPreviewAndConfirm(U8G2 &d) {
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
    uint32_t lastFrameMs = millis();
    int fails = 0;

    _solWaitRelease();
    while (true) {
        // Klawisze i panic czytane w KAZDEJ iteracji — wczesniej przy padnietej
        // kamerze (fb == NULL) petla robila tylko continue i nie dalo sie wyjsc.
        inputScan();
        panicCheck();
        if (panicTriggered()) return 0;
        if (inputBtn(BTN_LEFT) == LOW || inputKeyConsume(KEY_CCE)) { _solWaitRelease(); return 0; }
        if (millis() - inputLastActivity() > _SOL_PREVIEW_IDLE_MS) {
            Serial.println("[SOL] podglad: bezczynnosc — zamykam kamere");
            return 0;
        }

        camera_fb_t* fb = esp_camera_fb_get();
        if (!fb || !fb->buf || fb->width < PV_W || fb->height < PV_H) {
            if (fb) esp_camera_fb_return(fb);
            // Kilka kolejnych porazek i > 3 s bez klatki = kamera nie dziala
            if (++fails >= 3 && millis() - lastFrameMs > 3000) {
                Serial.println("[SOL] podglad: brak klatek z kamery");
                return -1;
            }
            delay(10);
            continue;
        }
        fails = 0;
        lastFrameMs = millis();

        const int sw = fb->width;    // 160
        const int sh = fb->height;   // 120
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
        d.drawStr(166, 8,  _solT("PODGLAD", "PREVIEW", "VORSCHAU", "NAHLED"));
        d.drawStr(166, 24, _solT("Ostrosc", "Sharp", "Schaerfe", "Ostrost"));
        // Pasek ostrosci 84px
        const int bx = 166, by = 28, bw = 84, bh = 8;
        d.drawFrame(bx, by, bw, bh);
        d.drawBox(bx + 1, by + 1, (bw - 2) * pct / 100, bh - 2);
        char pctbuf[8];
        snprintf(pctbuf, sizeof(pctbuf), "%d%%", pct);
        d.drawStr(166, 44, pctbuf);
        d.drawStr(166, 53, _solT("OK = foto", "OK = photo", "OK = Foto", "OK = foto"));
        d.drawStr(166, 62, _solT("< = wyjdz", "< = exit", "< = raus", "< = konec"));
        d.sendBuffer();

        // Przyciski — po wolnej klatce kamery (~80ms) robimy krotki burst
        // skanowania na kadencji ~35ms. Debounce klawiatury wymaga 2 kolejnych
        // skanow (~60ms); bez tego burst'u petla skanowala raz na ~80ms i
        // POJEDYNCZE nacisniecie OK/LEFT sie gubilo — trzeba bylo TRZYMAC.
        // Uzywamy inputBtn()==LOW (bez throttle 200ms z _solBtn) dla responsywnosci.
        for (int k = 0; k < 3; k++) {
            if (inputBtn(BTN_OK)   == LOW) { _solWaitRelease(); return 1; }
            if (inputBtn(BTN_LEFT) == LOW) { _solWaitRelease(); return 0; }
            delay(35);
        }
    }
}

// ---------------------------------------------------------------------------
// Tryb ZDJECIE: zrob zdjecie → wyslij do API → pokaz wynik
// ---------------------------------------------------------------------------
static void _solRunPhotoMode(U8G2 &d) {
    // WiFi OFF na czas pracy kamery (CLAUDE.md: kamera OFF -> WiFi ON).
    // Diagnoza 2026-10-18 (tcpdump na VPS + log serial): gdy STA bylo
    // skojarzone w trakcie preview/zdjecia, po camEnd() radio przestawalo
    // ODBIERAC (SYN wychodzil, SYN-ACK serwera nie docieral) na >1 min —
    // "Blad polaczenia", a potem nic do restartu. Gdy WiFi laczylo sie
    // dopiero PO wylaczeniu kamery, wysylka zawsze przechodzila.
    // _solEnsureWifi() polaczy od nowa po camEnd() (cache BSSID, ~1-3 s).
    if (WiFi.getMode() != WIFI_OFF) {
        WiFi.disconnect(true, false);
        WiFi.mode(WIFI_OFF);
        _wifiBeginAt = 0;          // swiadome wylaczenie — to nie "laczenie w toku"
        _solLinkSuspect = false;
        delay(50);
    }

    // === Faza 1: podglad na zywo (mono viewfinder) ===
    // Kamera w trybie GRAYSCALE QQVGA — uzytkownik kadruje zadanie i ustawia
    // odleglosc (pasek ostrosci pomaga trafic w sweet-spot stalej ostrosci).
    _solDrawLoading(d, _solT("Uruchamiam podglad...", "Starting preview...", "Starte Vorschau...", "Spoustim nahled..."), 0);

    if (camBeginPreview()) {
        int pv = _solPreviewAndConfirm(d);
        camEnd();                 // KONIECZNE: zwolnij preview, inaczej camBegin() (JPEG) zrobi early-return
        if (pv < 0) {
            _solDrawError(d, _solT("Kamera nie odpowiada", "Camera not responding", "Kamera antwortet nicht", "Kamera neodpovida"),
                          _solT("Brak obrazu z kamery.", "No image from camera.", "Kein Kamerabild.", "Zadny obraz z kamery."));
            return;
        }
        if (pv == 0) return;      // anulowano w podgladzie
    } else {
        // Fallback (blad preview): statyczny ekran jak dawniej
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 16, _solT("Tryb: Zdjecie", "Mode: Photo", "Modus: Foto", "Rezim: Foto"));
        d.drawHLine(0, 18, 256);
        d.drawStr(2, 32, _solT("Skieruj na zadanie.", "Point at the problem.", "Auf Aufgabe richten.", "Namirte na ulohu."));
        d.drawStr(2, 46, _solT("OK = zrob zdjecie", "OK = take photo", "OK = Foto machen", "OK = vyfotit"));
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 62, _solT("< = anuluj", "< = cancel", "< = abbrechen", "< = zrusit"));
        d.sendBuffer();

        _solWaitRelease();
        while (true) {
            if (_solTick()) d.sendBuffer();   // kamera tu wylaczona — sen OK
            if (panicTriggered()) return;
            if (_solBtn(BTN_OK)) break;
            if (_solBtn(BTN_LEFT) || inputKeyConsume(KEY_CCE)) { _solWaitRelease(); return; }
            delay(20);
        }
        _solWaitRelease();
    }

    // === Faza 2: finalne zdjecie JPEG/UXGA ===
    // camBegin: PWDN low, RESET pulse (przez MCP23017), esp_camera_init().
    // I2C dzielony z MCP23017 (sccb_i2c_port=0 w camera.h).
    _solDrawLoading(d, _solT("Wlaczam kamere...", "Powering camera...", "Kamera wird gestartet...", "Zapinam kameru..."), 0);

    if (!camBegin()) {
        _solDrawError(d, _solT("Init kamery!", "Camera init!", "Kamera-Init!", "Init kamery!"), "esp_camera_init");
        return;
    }

    // Warm-up - po switchu z podgladu AEC/AGC zbiega na nowo (3 klatki)
    camWarmup(3);

    _solDrawLoading(d, _solT("Robie zdjecie...", "Taking photo...", "Foto wird gemacht...", "Fotim..."), 0);
    camera_fb_t* fb = camCapture();
    if (!fb) {
        camEnd();
        _solDrawError(d, _solT("Blad zdjecia!", "Capture error!", "Fotofehler!", "Chyba snimku!"), "");
        return;
    }
    // Skopiuj JPEG do PSRAM, potem zwolnij bufor kamery i wylacz kamere
    // PRZED WiFi (XCLK 10MHz kamery zaklocaja 2.4GHz radio).
    size_t jpegLen = fb->len;
    uint8_t* jpegBuf = (uint8_t*)ps_malloc(jpegLen);
    if (!jpegBuf) {
        esp_camera_fb_return(fb);
        camEnd();
        _solDrawError(d, _solT("Brak pamieci!", "Out of memory!", "Kein Speicher!", "Malo pameti!"), "PSRAM");
        return;
    }
    memcpy(jpegBuf, fb->buf, jpegLen);
    esp_camera_fb_return(fb);
    camEnd();   // OFF kamery PRZED WiFi (anty-interference)

    // Jedno x-request-id na cale zycie zadania (pierwsza wysylka + ponowienia).
    char rid[17];
    offlineMakeRequestId(rid);

    // Teraz mozemy bezpiecznie wlaczyc WiFi
    if (!_solEnsureWifi(d)) {
        // Brak WiFi (albo anulowano / panic) — zakolejkuj zdjecie w SPIFFS
        uint8_t q = offlineQueueAddPhoto(jpegBuf, jpegLen, rid, 0);
        free(jpegBuf);
        _solShowQueued(d, q, true);
        return;
    }

    // WiFi "polaczone", ale samo wyslanie moze zawiesc. Bledy przejsciowe
    // (siec, 5xx, 429) -> kolejka z TYM SAMYM id; trwale (4xx) -> komunikat,
    // bez kolejki (ponawianie nic by nie dalo, a blokowalo kolejke).
    // offlineQueueAddPhoto kopiuje bajty do SPIFFS od razu.
    _SolSendRes r = _solSendJpeg(d, jpegBuf, jpegLen, rid);
    uint8_t q = OQ_ERROR;
    if (r.kind == _SOL_RES_RETRY) q = offlineQueueAddPhoto(jpegBuf, jpegLen, rid, 1);
    free(jpegBuf);
    if (panicTriggered()) return;   // nie blokuj powrotu ekranem bledu
    if (r.kind == _SOL_RES_RETRY)      _solShowSendError(d, r, _solQueueNote(q));
    else if (r.kind == _SOL_RES_FATAL) _solShowSendError(d, r, nullptr);
}

// ---------------------------------------------------------------------------
// Ekran wyboru trybu (zdjecie / tekst)
// Rysowany tylko po zmianie (wczesniej pelne clearBuffer/sendBuffer co 20 ms).
// ---------------------------------------------------------------------------
static void _solModeSelect(U8G2 &d, int &mode) {
    // mode: 0 = zdjecie, 1 = tekst, 2 = historia, 3 = offline (lokalne solvery)
    _solWaitRelease();

    bool needRedraw = true;
    while (true) {
        if (_solTick()) needRedraw = true;
        if (panicTriggered()) return;
        if (needRedraw) {
            d.clearBuffer();
            d.setFont(u8g2_font_6x10_tf);
            d.drawStr(2, 10, _solT("=== Rozwiaz zadanie ===", "=== Solve problem ===", "=== Aufgabe loesen ===", "=== Resit ulohu ==="));
            d.drawHLine(0, 12, 256);

            // Etykiety przez _solT (jezyki 4..10 -> i18n_extra.h po tekscie EN);
            // prefiks "> " / "  " doklejany przy rysowaniu.
            const char* labels[4] = {
                _solT("[1] Zdjecie kamery", "[1] Camera photo", "[1] Kamerafoto",    "[1] Foto kamerou"),
                _solT("[2] Wpisz tekst",    "[2] Enter text",   "[2] Text eingeben", "[2] Zadat text"),
                _solT("[3] Historia",       "[3] History",      "[3] Verlauf",       "[3] Historie"),
                _solT("[4] Offline",        "[4] Offline",      "[4] Offline",       "[4] Offline"),
            };

            const int Y[4] = {13, 23, 33, 43};   // top y kazdej pozycji (4 widoczne)
            const int TEXT_Y[4] = {22, 32, 42, 52};

            for (int i = 0; i < 4; i++) {
                char lbl[48];
                snprintf(lbl, sizeof(lbl), "%s%s", mode == i ? "> " : "  ", labels[i]);
                if (mode == i) {
                    d.drawBox(0, Y[i], 256, 10);
                    d.setDrawColor(0);
                    d.drawStr(4, TEXT_Y[i], lbl);
                    d.setDrawColor(1);
                } else {
                    d.drawStr(4, TEXT_Y[i], lbl);
                }
            }

            d.drawHLine(0, 53, 256);
            d.setFont(u8g2_font_5x7_tf);
            d.drawStr(2, 62, _solT("^/v wybor   OK: start   < wstecz",
                                    "^/v select   OK: start   < back",
                                    "^/v waehlen  OK: Start  < zurueck",
                                    "^/v vyber   OK: start   < zpet"));
            d.sendBuffer();
            needRedraw = false;
        }

        if (_solBtn(BTN_UP)) {
            if (mode > 0) { mode--; needRedraw = true; }
        } else if (_solBtn(BTN_DOWN)) {
            if (mode < 3) { mode++; needRedraw = true; }
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
// Rysowane tylko po zmianie.
// ---------------------------------------------------------------------------
static int _solListMenu(U8G2 &d, const char* title, const char* const* items, int count) {
    _solWaitRelease();
    int sel = 0;
    int scroll = 0;
    const int VISIBLE = 4;   // wiersze widoczne na raz (13..53 / 10px = 4)
    const int ROW_H = 10;

    bool needRedraw = true;
    while (true) {
        if (_solTick()) needRedraw = true;
        if (panicTriggered()) return -1;

        if (needRedraw) {
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
                                    "^/v waehlen  OK: Start  < zurueck",
                                    "^/v vyber   OK: start   < zpet"));
            d.sendBuffer();
            needRedraw = false;
        }

        if (_solBtn(BTN_UP)) {
            if (sel > 0) { sel--; needRedraw = true; }
        } else if (_solBtn(BTN_DOWN)) {
            if (sel < count - 1) { sel++; needRedraw = true; }
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
        if (c == '.' && strchr(buf, '.')) return;
        // "0" / "-0" + cyfra -> zastap zero (bez "-05")
        if (c != '.' && ((len == 1 && buf[0] == '0') || (len == 2 && buf[0] == '-' && buf[1] == '0'))) {
            buf[len - 1] = c;
            return;
        }
        if (len + 1 >= bufSize) return;
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
// Rysowane po zmianie / mrugnieciu kursora (co 400 ms), nie co 15 ms.
// ---------------------------------------------------------------------------
static bool _numEditField(U8G2 &d, const char* label, double &outValue) {
    char buf[16] = "0";
    bool awaitingFirst = true;
    _solWaitRelease();

    uint32_t blink = millis();
    bool blinkOn = true;
    bool needRedraw = true;

    while (true) {
        if (_solTick()) needRedraw = true;
        if (panicTriggered()) return false;
        if (millis() - blink > 400) { blinkOn = !blinkOn; blink = millis(); needRedraw = true; }

        if (needRedraw) {
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
                                    "+/- Vorz.  =: weiter  C: loesch/raus",
                                    "+/- znam.   =: dale   C: smazat/konec"));
            d.sendBuffer();
            needRedraw = false;
        }

        char add = 0;
        if      (inputKeyConsume(KEY_0))   add = '0';
        else if (inputKeyConsume(KEY_1))   add = '1';
        else if (inputKeyConsume(KEY_2))   add = '2';
        else if (inputKeyConsume(KEY_3))   add = '3';
        else if (inputKeyConsume(KEY_4))   add = '4';
        else if (inputKeyConsume(KEY_5))   add = '5';
        else if (inputKeyConsume(KEY_6))   add = '6';
        else if (inputKeyConsume(KEY_7))   add = '7';
        else if (inputKeyConsume(KEY_8))   add = '8';
        else if (inputKeyConsume(KEY_9))   add = '9';
        else if (inputKeyConsume(KEY_DOT)) add = '.';
        if (add) {
            _numAppendChar(buf, sizeof(buf), awaitingFirst, add);
            needRedraw = true;
            continue;
        }
        if (inputKeyConsume(KEY_00))  {
            _numAppendChar(buf, sizeof(buf), awaitingFirst, '0');
            _numAppendChar(buf, sizeof(buf), awaitingFirst, '0');
            needRedraw = true;
            continue;
        }

        if (inputKeyConsume(KEY_PLUSMINUS)) {
            // Zmiana znaku w tekscie — bez przeformatowania (offlineFmtNum
            // gubil cyfry, a "Error" nie istnieje w foncie logisoso22_tn).
            size_t len = strlen(buf);
            if (buf[0] == '-') {
                memmove(buf, buf + 1, len);              // razem z NUL
            } else if (len + 1 < sizeof(buf)) {
                memmove(buf + 1, buf, len + 1);
                buf[0] = '-';
            }
            awaitingFirst = false;
            needRedraw = true;
            continue;
        }
        if (inputKeyConsume(KEY_CCE)) {
            if (awaitingFirst) { _solWaitRelease(); return false; }  // nietkniete -> wyjscie
            strcpy(buf, "0");
            awaitingFirst = true;
            needRedraw = true;
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
// Postac rownania widoczna przy kazdym polu i w wyniku (wczesniej same
// "a =", "b =" — nie bylo wiadomo, ktory wspolczynnik to ktory).
// ---------------------------------------------------------------------------
static void _solOfflineLinear(U8G2 &d) {
    double a, b;
    if (!_numEditField(d, _solT("Rownanie ax+b=0:   a =", "Linear eq. ax+b=0:   a =", "Lin. Gl. ax+b=0:   a =", "Rovnice ax+b=0: a ="), a)) return;
    if (!_numEditField(d, _solT("Rownanie ax+b=0:   b =", "Linear eq. ax+b=0:   b =", "Lin. Gl. ax+b=0:   b =", "Rovnice ax+b=0: b ="), b)) return;

    LinearResult r = offlineSolveLinear(a, b);
    char aS[24], bS[24];
    offlineFmtNum(a, aS, sizeof(aS));
    offlineFmtNum(b, bS, sizeof(bS));

    String result = String("ax+b=0\na = ") + aS + ", b = " + bS + "\n\n";
    if (r.infinite) {
        result += _solT("Nieskonczenie wiele rozwiazan", "Infinitely many solutions", "Unendlich viele Loesungen", "Nekonecne mnoho reseni");
    } else if (r.none) {
        result += _solT("Brak rozwiazan", "No solution", "Keine Loesung", "Zadne reseni");
    } else {
        char xS[24];
        offlineFmtNum(r.x, xS, sizeof(xS));
        result += String("x = ") + xS;
    }

    historySave(String("[Offline] ax+b=0 a=") + aS + " b=" + bS, result);
    _solDisplaySolution(d, result.c_str(), "OFFLINE");
}

// ---------------------------------------------------------------------------
// Offline: rownanie kwadratowe ax^2+bx+c=0
// ---------------------------------------------------------------------------
static void _solOfflineQuadratic(U8G2 &d) {
    double a, b, c;
    if (!_numEditField(d, _solT("Rown. ax^2+bx+c=0:   a =", "Quadr. ax^2+bx+c=0:   a =", "Quadr. ax^2+bx+c=0:   a =", "Kvadr. ax^2+bx+c=0: a ="), a)) return;
    if (!_numEditField(d, _solT("Rown. ax^2+bx+c=0:   b =", "Quadr. ax^2+bx+c=0:   b =", "Quadr. ax^2+bx+c=0:   b =", "Kvadr. ax^2+bx+c=0: b ="), b)) return;
    if (!_numEditField(d, _solT("Rown. ax^2+bx+c=0:   c =", "Quadr. ax^2+bx+c=0:   c =", "Quadr. ax^2+bx+c=0:   c =", "Kvadr. ax^2+bx+c=0: c ="), c)) return;

    QuadraticResult r = offlineSolveQuadratic(a, b, c);
    char aS[24], bS[24], cS[24];
    offlineFmtNum(a, aS, sizeof(aS));
    offlineFmtNum(b, bS, sizeof(bS));
    offlineFmtNum(c, cS, sizeof(cS));

    String result = String("ax^2+bx+c=0\na=") + aS + " b=" + bS + " c=" + cS + "\n\n";

    if (r.usedLinear) {
        result += _solT("a=0 -> rownanie liniowe\n", "a=0 -> linear equation\n", "a=0 -> lineare Gleichung\n", "a=0 -> linearni rovnice\n");
        if (r.linear.infinite) {
            result += _solT("Nieskonczenie wiele rozwiazan", "Infinitely many solutions", "Unendlich viele Loesungen", "Nekonecne mnoho reseni");
        } else if (r.linear.none) {
            result += _solT("Brak rozwiazan", "No solution", "Keine Loesung", "Zadne reseni");
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
            result += String(_solT("x (podwojny) = ", "x (double) = ", "x (doppelt) = ", "x (dvojnasobny) = ")) + xS;
        } else {
            char reS[24], imS[24];
            offlineFmtNum(r.reP, reS, sizeof(reS));
            offlineFmtNum(fabs(r.imP), imS, sizeof(imS));
            result += _solT("Brak pierwiastkow rzeczywistych\n", "No real roots\n", "Keine reellen Nullstellen\n", "Zadne realne koreny\n");
            result += String("x = ") + reS + " \\pm " + imS + "i";
        }
    }

    historySave(String("[Offline] ax^2+bx+c=0 a=") + aS + " b=" + bS + " c=" + cS, result);
    _solDisplaySolution(d, result.c_str(), "OFFLINE");
}

// ---------------------------------------------------------------------------
// Offline: uklad 2 rownan liniowych (metoda Cramera)
//   a1x + b1y = c1
//   a2x + b2y = c2
// ---------------------------------------------------------------------------
static void _solOfflineSystem(U8G2 &d) {
    double a1, b1, c1, a2, b2, c2;
    if (!_numEditField(d, _solT("Rown.1 a1x+b1y=c1:   a1 =", "Eq.1 a1x+b1y=c1:   a1 =", "Gl.1 a1x+b1y=c1:   a1 =", "Rov.1 a1x+b1y=c1: a1 ="), a1)) return;
    if (!_numEditField(d, _solT("Rown.1 a1x+b1y=c1:   b1 =", "Eq.1 a1x+b1y=c1:   b1 =", "Gl.1 a1x+b1y=c1:   b1 =", "Rov.1 a1x+b1y=c1: b1 ="), b1)) return;
    if (!_numEditField(d, _solT("Rown.1 a1x+b1y=c1:   c1 =", "Eq.1 a1x+b1y=c1:   c1 =", "Gl.1 a1x+b1y=c1:   c1 =", "Rov.1 a1x+b1y=c1: c1 ="), c1)) return;
    if (!_numEditField(d, _solT("Rown.2 a2x+b2y=c2:   a2 =", "Eq.2 a2x+b2y=c2:   a2 =", "Gl.2 a2x+b2y=c2:   a2 =", "Rov.2 a2x+b2y=c2: a2 ="), a2)) return;
    if (!_numEditField(d, _solT("Rown.2 a2x+b2y=c2:   b2 =", "Eq.2 a2x+b2y=c2:   b2 =", "Gl.2 a2x+b2y=c2:   b2 =", "Rov.2 a2x+b2y=c2: b2 ="), b2)) return;
    if (!_numEditField(d, _solT("Rown.2 a2x+b2y=c2:   c2 =", "Eq.2 a2x+b2y=c2:   c2 =", "Gl.2 a2x+b2y=c2:   c2 =", "Rov.2 a2x+b2y=c2: c2 ="), c2)) return;

    System2x2Result r = offlineSolveSystem2x2(a1, b1, c1, a2, b2, c2);
    char eq[160];
    snprintf(eq, sizeof(eq), "a1x+b1y=c1, a2x+b2y=c2\na1=%.6g b1=%.6g c1=%.6g\na2=%.6g b2=%.6g c2=%.6g\n\n",
             a1, b1, c1, a2, b2, c2);
    String result = eq;
    if (r.infinite) {
        result += _solT("Nieskonczenie wiele rozwiazan", "Infinitely many solutions", "Unendlich viele Loesungen", "Nekonecne mnoho reseni");
    } else if (r.none) {
        result += _solT("Uklad sprzeczny (brak rozwiazan)", "Inconsistent system (no solution)", "Widerspruechliches System (keine Loesung)", "Soustava je sporna (bez reseni)");
    } else {
        char xS[24], yS[24];
        offlineFmtNum(r.x, xS, sizeof(xS));
        offlineFmtNum(r.y, yS, sizeof(yS));
        result += String("x = ") + xS + "\ny = " + yS;
    }

    char hq[96];
    snprintf(hq, sizeof(hq), "a1=%.4g b1=%.4g c1=%.4g / a2=%.4g b2=%.4g c2=%.4g", a1, b1, c1, a2, b2, c2);
    historySave(String("[Offline] ") + hq, result);
    _solDisplaySolution(d, result.c_str(), "OFFLINE");
}

// ---------------------------------------------------------------------------
// Offline: procenty i proporcje (podmenu 2 pozycji)
// ---------------------------------------------------------------------------
static void _solOfflinePercent(U8G2 &d) {
    const char* items[2] = {
        _solT("X% z Y", "X% of Y", "X% von Y", "X% z Y"),
        _solT("Proporcja a:b=c:x", "Proportion a:b=c:x", "Verhaeltnis a:b=c:x", "Pomer a:b=c:x"),
    };
    int sel = _solListMenu(d, _solT("=== Procenty ===", "=== Percentages ===", "=== Prozente ===", "=== Procenta ==="), items, 2);
    if (sel < 0) return;

    if (sel == 0) {
        double pct, base;
        if (!_numEditField(d, _solT("X% z Y:   X (%) =", "X% of Y:   X (%) =", "X% von Y:   X (%) =", "X% z Y: X (%) ="), pct)) return;
        if (!_numEditField(d, _solT("X% z Y:   Y =", "X% of Y:   Y =", "X% von Y:   Y =", "X% z Y: Y ="), base)) return;
        double v = offlinePercentOf(pct, base);
        char pS[24], bS[24], vS[24];
        offlineFmtNum(pct, pS, sizeof(pS));
        offlineFmtNum(base, bS, sizeof(bS));
        offlineFmtNum(v, vS, sizeof(vS));
        const char* of = _solT("% z ", "% of ", "% von ", "% z ");   // wczesniej "% z" na sztywno (PL)
        String result = String(pS) + of + bS + " = " + vS;
        historySave(String("[Offline] ") + pS + of + bS, result);
        _solDisplaySolution(d, result.c_str(), "OFFLINE");
    } else {
        double a, b, c;
        if (!_numEditField(d, "a:b=c:x:   a =", a)) return;
        if (!_numEditField(d, "a:b=c:x:   b =", b)) return;
        if (!_numEditField(d, "a:b=c:x:   c =", c)) return;
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
        _solT("Stopien 2 (ax^2+bx+c)", "Degree 2 (ax^2+bx+c)", "Grad 2 (ax^2+bx+c)", "Stupen 2 (ax^2+bx+c)"),
        _solT("Stopien 3 (ax^3+bx^2+cx+d)", "Degree 3 (ax^3+bx^2+cx+d)", "Grad 3 (ax^3+bx^2+cx+d)", "Stupen 3 (ax^3+bx^2+cx+d)"),
    };
    int sel = _solListMenu(d, _solT("=== Pochodna ===", "=== Derivative ===", "=== Ableitung ===", "=== Derivace ==="), items, 2);
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
    if (!_numEditField(d, _solT("Punkt A: x1 =", "Point A: x1 =", "Punkt A: x1 =", "Bod A: x1 ="), x1)) return;
    if (!_numEditField(d, "y1 =", y1)) return;
    if (!_numEditField(d, _solT("Punkt B: x2 =", "Point B: x2 =", "Punkt B: x2 =", "Bod B: x2 ="), x2)) return;
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
                     _solT("Srodek S = (", "Midpoint S = (", "Mittelpunkt S = (", "Stred S = (") + mxS + ", " + myS + ")";

    historySave(String("[Offline] A(") + x1S + "," + y1S + ") B(" + x2S + "," + y2S + ")", result);
    _solDisplaySolution(d, result.c_str(), "OFFLINE");
}

// ---------------------------------------------------------------------------
// Offline: twierdzenie Pitagorasa (podmenu 2 pozycji)
// ---------------------------------------------------------------------------
static void _solOfflinePythagoras(U8G2 &d) {
    const char* items[2] = {
        _solT("Znam obie przyprostokatne", "Know both legs", "Kenne beide Katheten", "Znam obe odvesny"),
        _solT("Znam przeciwprost.+bok", "Know hypotenuse+leg", "Kenne Hypotenuse+Kathete", "Znam preponu+odvesnu"),
    };
    int sel = _solListMenu(d, _solT("=== Pitagoras ===", "=== Pythagoras ===", "=== Pythagoras ===", "=== Pythagoras ==="), items, 2);
    if (sel < 0) return;

    if (sel == 0) {
        double a, b;
        if (!_numEditField(d, _solT("Przyprost.: a =", "Leg: a =", "Kathete: a =", "Odvesna: a ="), a)) return;
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
        if (!_numEditField(d, _solT("Przeciwprost.: c =", "Hypotenuse: c =", "Hypotenuse: c =", "Prepona: c ="), c)) return;
        if (!_numEditField(d, _solT("Przyprost.: a =", "Leg: a =", "Kathete: a =", "Odvesna: a ="), a)) return;
        PythagorasResult r = offlinePythagorasLeg(c, a);
        char cS[24], aS[24];
        offlineFmtNum(c, cS, sizeof(cS));
        offlineFmtNum(a, aS, sizeof(aS));
        String result;
        if (!r.valid) {
            result = _solT("Blad: c musi byc dluzsze niz a", "Error: c must be longer than a", "Fehler: c muss laenger als a sein", "Chyba: c musi byt delsi nez a");
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
        _solT("Arytmetyczny", "Arithmetic", "Arithmetisch", "Aritmeticka"),
        _solT("Geometryczny", "Geometric", "Geometrisch", "Geometricka"),
    };
    int sel = _solListMenu(d, _solT("=== Ciagi ===", "=== Sequences ===", "=== Folgen ===", "=== Posloupnosti ==="), items, 2);
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
        _solT("Prostokat", "Rectangle", "Rechteck", "Obdelnik"),
        _solT("Trojkat (3 boki)", "Triangle (3 sides)", "Dreieck (3 Seiten)", "Trojuhelnik (3 strany)"),
        _solT("Kolo", "Circle", "Kreis", "Kruh"),
        _solT("Trapez", "Trapezoid", "Trapez", "Lichobeznik"),
    };
    int sel = _solListMenu(d, _solT("=== Pola i obwody ===", "=== Areas ===", "=== Flaechen ===", "=== Obsahy a obvody ==="), items, 4);
    if (sel < 0) return;

    String result, histLabel;

    if (sel == 0) {
        double a, b;
        if (!_numEditField(d, _solT("Prostokat: a =", "Rectangle: a =", "Rechteck: a =", "Obdelnik: a ="), a)) return;
        if (!_numEditField(d, "b =", b)) return;
        AreaResult r = offlineRectangle(a, b);
        char aS[24], bS[24], pS[24], oS[24];
        offlineFmtNum(a, aS, sizeof(aS));
        offlineFmtNum(b, bS, sizeof(bS));
        offlineFmtNum(r.area, pS, sizeof(pS));
        offlineFmtNum(r.perimeter, oS, sizeof(oS));
        result = String(_solT("Pole = ", "Area = ", "Flaeche = ", "Obsah = ")) + pS + "\n" +
                 _solT("Obwod = ", "Perimeter = ", "Umfang = ", "Obvod = ") + oS;
        histLabel = String(_solT("Prostokat", "Rectangle", "Rechteck", "Obdelnik")) + " a=" + aS + " b=" + bS;
    } else if (sel == 1) {
        double a, b, c;
        if (!_numEditField(d, _solT("Trojkat: a =", "Triangle: a =", "Dreieck: a =", "Trojuhelnik: a ="), a)) return;
        if (!_numEditField(d, "b =", b)) return;
        if (!_numEditField(d, "c =", c)) return;
        AreaResult r = offlineTriangleHeron(a, b, c);
        char aS[24], bS[24], cS[24];
        offlineFmtNum(a, aS, sizeof(aS));
        offlineFmtNum(b, bS, sizeof(bS));
        offlineFmtNum(c, cS, sizeof(cS));
        if (!r.valid) {
            result = _solT("Blad: takie boki nie tworza trojkata", "Error: these sides don't form a triangle", "Fehler: diese Seiten bilden kein Dreieck", "Chyba: tyto strany netvori trojuhelnik");
        } else {
            char pS[24], oS[24];
            offlineFmtNum(r.area, pS, sizeof(pS));
            offlineFmtNum(r.perimeter, oS, sizeof(oS));
            result = String(_solT("Pole = ", "Area = ", "Flaeche = ", "Obsah = ")) + pS + "\n" +
                     _solT("Obwod = ", "Perimeter = ", "Umfang = ", "Obvod = ") + oS;
        }
        histLabel = String(_solT("Trojkat", "Triangle", "Dreieck", "Trojuhelnik")) + " a=" + aS + " b=" + bS + " c=" + cS;
    } else if (sel == 2) {
        double rad;
        if (!_numEditField(d, _solT("Kolo: r =", "Circle: r =", "Kreis: r =", "Kruh: r ="), rad)) return;
        AreaResult r = offlineCircle(rad);
        char rS[24], pS[24], oS[24];
        offlineFmtNum(rad, rS, sizeof(rS));
        offlineFmtNum(r.area, pS, sizeof(pS));
        offlineFmtNum(r.perimeter, oS, sizeof(oS));
        result = String(_solT("Pole = ", "Area = ", "Flaeche = ", "Obsah = ")) + pS + "\n" +
                 _solT("Obwod = ", "Perimeter = ", "Umfang = ", "Obvod = ") + oS;
        histLabel = String(_solT("Kolo", "Circle", "Kreis", "Kruh")) + " r=" + rS;
    } else {
        double a, b, h;
        if (!_numEditField(d, _solT("Trapez: a =", "Trapezoid: a =", "Trapez: a =", "Lichobeznik: a ="), a)) return;
        if (!_numEditField(d, "b =", b)) return;
        if (!_numEditField(d, "h =", h)) return;
        AreaResult r = offlineTrapezoid(a, b, h);
        char aS[24], bS[24], hS[24], pS[24];
        offlineFmtNum(a, aS, sizeof(aS));
        offlineFmtNum(b, bS, sizeof(bS));
        offlineFmtNum(h, hS, sizeof(hS));
        offlineFmtNum(r.area, pS, sizeof(pS));
        result = String(_solT("Pole = ", "Area = ", "Flaeche = ", "Obsah = ")) + pS + "\n" +
                 _solT("(obwod wymaga dlugosci ramion)", "(perimeter needs leg lengths)", "(Umfang braucht Schenkellaengen)", "(obvod vyzaduje delky ramen)");
        histLabel = String(_solT("Trapez", "Trapezoid", "Trapez", "Lichobeznik")) + " a=" + aS + " b=" + bS + " h=" + hS;
    }

    historySave(String("[Offline] ") + histLabel, result);
    _solDisplaySolution(d, result.c_str(), "OFFLINE");
}

// ---------------------------------------------------------------------------
// Offline — dispatcher: menu 9 narzedzi, wraca do siebie po kazdym policzeniu
// ---------------------------------------------------------------------------
static void runOfflineSolver(U8G2 &d) {
    const char* items[9] = {
        _solT("Rownanie liniowe", "Linear equation", "Lineare Gleichung", "Linearni rovnice"),
        _solT("Rownanie kwadratowe", "Quadratic equation", "Quadratische Gleichung", "Kvadraticka rovnice"),
        _solT("Uklad 2 rownan", "2-eq. system", "2er-Gleichungssystem", "Soustava 2 rovnic"),
        _solT("Procenty / proporcje", "Percentages / proportions", "Prozente / Verhaeltnisse", "Procenta / pomery"),
        _solT("Pochodna wielomianu", "Polynomial derivative", "Polynom-Ableitung", "Derivace polynomu"),
        _solT("Punkty na plaszczyznie", "Points on a plane", "Punkte in der Ebene", "Body v rovine"),
        _solT("Twierdzenie Pitagorasa", "Pythagorean theorem", "Satz des Pythagoras", "Pythagorova veta"),
        _solT("Ciagi (arytm./geom.)", "Sequences (arith./geom.)", "Folgen (arith./geom.)", "Posloupnosti (arit./geom.)"),
        _solT("Pola i obwody figur", "Areas and perimeters", "Flaechen und Umfaenge", "Obsahy a obvody utvaru"),
    };
    while (true) {
        if (panicTriggered()) return;
        int sel = _solListMenu(d, _solT("=== Offline ===", "=== Offline ===", "=== Offline ===", "=== Offline ==="), items, 9);
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
// Wpis czytany z pamieci i konwertowany TYLKO przy zmianie kursora (wczesniej
// co 20 ms: ~3,5 KB z NVS + ~35 replace() na Stringu), ekran rysowany po zmianie.
// ---------------------------------------------------------------------------
// Wpisy, ktorych nie da sie sensownie wyslac ponownie jako tekst do AI.
static bool _solHistResendable(const String& q) {
    if (q.length() == 0) return false;
    if (q == "[Zdjecie]") return false;          // zdjecie — tekstu zadania nie ma
    if (q.startsWith("[Offline]")) return false;  // wynik lokalnego solvera
    return true;
}

static void _solRunHistoryMode(U8G2 &d) {
    _solWaitRelease();

    uint8_t count = historyCount();
    if (count == 0) {
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 28, _solT("Brak zapisanych zadan", "No saved tasks", "Keine gespeicherten Aufgaben", "Zadne ulozene ulohy"));
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 56, _solT("OK / < = powrot", "OK / < = back", "OK / < = zurueck", "OK / < = zpet"));
        d.sendBuffer();
        while (true) {
            if (_solTick()) d.sendBuffer();
            if (panicTriggered()) return;
            if (_solBtn(BTN_OK) || _solBtn(BTN_LEFT)) {
                _solWaitRelease();
                return;
            }
            delay(20);
        }
    }

    int cursor = 0;            // 0 = najnowszy
    int cachedIdx = -1;        // dla ktorego kursora jest cache (-1 = brak)
    bool cachedResend = false;
    String cq, cl1, cl2;       // gotowe do rysowania (ASCII, przyciete)
    bool needRedraw = true;

    while (true) {
        if (_solTick()) needRedraw = true;
        if (panicTriggered()) return;

        if (cursor != cachedIdx) {
            HistoryEntry entry;
            cq = ""; cl1 = ""; cl2 = "";
            cachedResend = false;
            if (historyGet(cursor, entry)) {
                // Polskie znaki UTF-8 -> ASCII (font 6x10/5x7 nie ma glyphow ą/ł/...).
                // Konwersja PRZED obcieciem, zeby nie urwac w srodku znaku wielobajtowego.
                cq = _solUtf8ToAscii(entry.question);
                if (cq.length() > 40) cq = cq.substring(0, 38) + "..";
                // Pierwsze 2 linie odpowiedzi
                String a = _solUtf8ToAscii(entry.answer);
                int nl = a.indexOf('\n');
                cl1 = nl >= 0 ? a.substring(0, nl) : a;
                String rest = nl >= 0 ? a.substring(nl + 1) : "";
                int nl2 = rest.indexOf('\n');
                cl2 = nl2 >= 0 ? rest.substring(0, nl2) : rest;
                if (cl1.length() > 50) cl1 = cl1.substring(0, 48) + "..";
                if (cl2.length() > 50) cl2 = cl2.substring(0, 48) + "..";
                cachedResend = _solHistResendable(entry.question);
            }
            cachedIdx = cursor;
            needRedraw = true;
        }

        if (needRedraw) {
            d.clearBuffer();
            d.setFont(u8g2_font_6x10_tf);
            char hdr[32];
            snprintf(hdr, sizeof(hdr), _solT("Historia (%d/%d)", "History (%d/%d)", "Verlauf (%d/%d)", "Historie (%d/%d)"),
                     cursor + 1, count);
            d.drawStr(2, 10, hdr);
            d.drawHLine(0, 12, 256);

            d.setFont(u8g2_font_6x10_tf);
            d.drawStr(2, 24, cq.c_str());
            d.setFont(u8g2_font_5x7_tf);
            d.drawStr(2, 36, cl1.c_str());
            d.drawStr(2, 46, cl2.c_str());

            d.drawHLine(0, 53, 256);
            d.setFont(u8g2_font_5x7_tf);
            d.drawStr(2, 62, _solT("^/v OK:pokaz  >:edytuj+wyslij  <:wstecz",
                                    "^/v OK:show  >:edit+resend  <:back",
                                    "^/v OK:zeigen >:bearb+senden <:zurueck",
                                    "^/v OK:ukaz  >:upravit+odeslat  <:zpet"));
            d.sendBuffer();
            needRedraw = false;
        }

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
            needRedraw = true;   // po wyjsciu — wracamy do listy
        } else if (_solBtn(BTN_RIGHT)) {
            if (!cachedResend) {
                // "[Zdjecie]" / "[Offline] ..." to nie tresc zadania — nie
                // wysylamy tego jako tekstu do AI (marnowalo tokeny).
                _solShowInfo(d,
                    _solT("Tego wpisu nie mozna", "This entry cannot", "Dieser Eintrag kann", "Tento zaznam nelze"),
                    _solT("wyslac ponownie.", "be resent.", "nicht erneut gesendet werden.", "znovu odeslat."),
                    _solT("(zdjecie / wynik offline)", "(photo / offline result)", "(Foto / Offline-Ergebnis)", "(foto / offline vysledek)"),
                    2000);
                needRedraw = true;
            } else {
                // Edytuj pytanie z historii i wyslij ponownie do AI
                HistoryEntry entry;
                if (historyGet(cursor, entry)) {
                    _solWaitRelease();
                    _solRunTextMode(d, entry.question.c_str());
                    _solWaitRelease();
                }
                if (panicTriggered()) return;
                // Nowy wpis (jesli doszedl) jest najnowszy — odswiez licznik
                // i cache (wczesniej licznik z wejscia zostawal nieaktualny).
                count = historyCount();
                if (count == 0) return;
                cursor = 0;
                cachedIdx = -1;
                needRedraw = true;
            }
        } else if (_solBtn(BTN_LEFT)) {
            _solWaitRelease();
            return;
        }
        delay(20);
    }
}

// ---------------------------------------------------------------------------
// _solProcessQueue — wyslij zadania z kolejki offline, gdy WiFi dostepne.
// Wolana na wejsciu showSolveScreen. Widoczny ekran postepu; C/CE pomija
// wysylke na _SOL_QUEUE_SKIP_MS (wczesniej: do 8 s cichego laczenia + do
// 45 s POST bez mozliwosci przerwania przy KAZDYM wejsciu w "Rozwiaz").
//
// Zasady (offline_queue.h):
//   - sukces                 -> usun pozycje,
//   - blad trwaly (4xx)      -> usun pozycje + komunikat (nie blokuje kolejki),
//   - blad przejsciowy       -> +1 proba; po _OQ_MAX_ATTEMPTS usun; przerwij
//                               drain (siec/serwer i tak teraz nie dziala),
//   - nieczytelna pozycja    -> usun (wczesniej zatrute zadanie blokowalo
//                               kolejke na zawsze).
// Kazda proba wysyla zapisany x-request-id pozycji.
// ---------------------------------------------------------------------------
#define _SOL_QUEUE_SKIP_MS  (10UL * 60UL * 1000UL)
static uint32_t _solQueueSkipAt = 0;   // millis() ostatniego "pomin" (0 = brak)

static void _solQueueDraw(U8G2 &d, const char* status, int idx, int total) {
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);
    char hdr[48];
    snprintf(hdr, sizeof(hdr), _solT("Kolejka offline: %d zadan", "Offline queue: %d tasks", "Offline-Warteschl.: %d Aufg.", "Offline fronta: %d uloh"), total);
    d.drawStr(2, 12, hdr);
    d.drawHLine(0, 15, 256);
    d.drawStr(2, 32, status);
    if (idx > 0) {
        char ln[24];
        snprintf(ln, sizeof(ln), "%d / %d", idx, total);
        d.drawStr(2, 46, ln);
    }
    d.setFont(u8g2_font_5x7_tf);
    d.drawStr(2, 62, _solT("C/CE = pomin (na 10 min)", "C/CE = skip (for 10 min)", "C/CE = ueberspringen (10 Min.)", "C/CE = preskocit (na 10 min)"));
    d.sendBuffer();
}

// Czeka do ms na C/CE (pomin) albo panic. true = przerwac.
static bool _solQueueWaitSkip(uint32_t ms) {
    uint32_t t0 = millis();
    while (millis() - t0 < ms) {
        inputScan();
        panicCheck();
        if (panicTriggered()) return true;
        if (inputKeyConsume(KEY_CCE)) return true;
        delay(20);
    }
    return false;
}

static void _solProcessQueue(U8G2 &d) {
    uint8_t n = offlineQueueCount();
    if (n == 0) return;
    if (_solQueueSkipAt != 0 && millis() - _solQueueSkipAt < _SOL_QUEUE_SKIP_MS) return;
    _solQueueSkipAt = 0;
    if (!SPIFFS.begin(false)) return;   // tresc kolejki niedostepna — niczego nie usuwaj

    (void)inputKeyConsume(KEY_CCE);     // trzymany C/CE z wczesniej nie liczy sie jako "pomin"

    // WL_CONNECTED bez IP albo po nieudanej wysylce = martwe lacze (patrz
    // _solEnsureWifi) — zerwij, zeby ponizszy blok polaczyl od nowa.
    if (WiFi.status() == WL_CONNECTED &&
        (_solLinkSuspect || WiFi.localIP() == IPAddress(0, 0, 0, 0))) {
        Serial.println("[WiFi] kolejka: lacze podejrzane -> reconnect");
        WiFi.disconnect(false, false);
        for (int i = 0; i < 40 && WiFi.status() == WL_CONNECTED; i++) delay(25);
        _solLinkSuspect = false;
        _wifiBeginAt = 0;
    }

    // Polacz z WiFi jesli nie jest polaczony (max 8s, z ekranem i "pomin")
    if (WiFi.status() != WL_CONNECTED) {
        char ssid[33] = "", pass[64] = "";
        wifiLoadSaved(ssid, sizeof(ssid), pass, sizeof(pass));
        if (ssid[0] == '\0') return;    // brak zapisanej sieci — nie ma jak wyslac
        _solQueueDraw(d, _solT("Lacze z WiFi...", "Connecting WiFi...", "Verbinde WLAN...", "Pripojuji WiFi..."), 0, n);
        if (!wifiJoinInProgress()) {    // nie restartuj trwajacego laczenia (patrz _solEnsureWifi)
            wifiStaOnLimited();         // STA + TxPower (KALK_WIFI_TX_POWER)
            wifiFastBegin(ssid, pass);
        }
        unsigned long t = millis();
        bool fellBack = false, skipped = false;
        while (WiFi.status() != WL_CONNECTED && millis() - t < 12000) {
            if (!fellBack && _wifiHintUsed && millis() - t > 5000) {
                fellBack = true;
                WiFi.disconnect(false, false);
                delay(50);
                WiFi.begin(ssid, pass);
                _wifiHintUsed = false;
            }
            if (_solQueueWaitSkip(200)) { skipped = true; break; }
        }
        memset(pass, 0, sizeof(pass));
        if (panicTriggered()) return;
        if (skipped) { _solQueueSkipAt = millis() | 1; return; }
        if (WiFi.status() != WL_CONNECTED) return;   // sprobuje przy nastepnym wejsciu
        wifiSaveBssidChannel();
        wifiApplyDnsFallback();
        _solRegisterWithSpinner(d);
    }

    const int total = n;
    int idx = 0;
    while (offlineQueueCount() > 0) {
        if (panicTriggered()) return;
        idx++;
        _solQueueDraw(d, _solT("Wysylam zadanie...", "Sending task...", "Sende Aufgabe...", "Odesilam ulohu..."), idx, total);
        if (_solQueueWaitSkip(800)) {   // chwila na "pomin" przed kazda pozycja
            if (!panicTriggered()) _solQueueSkipAt = millis() | 1;
            return;
        }

        OfflineTask task;
        if (!offlineQueuePeek(0, task)) {
            Serial.println("[OQ] nieczytelna pozycja — usuwam");
            offlineQueueRemoveFirst();
            continue;
        }

        _SolSendRes r;
        if (task.type == 0) {
            r = _solSendText(d, task.text.c_str(), task.reqId.c_str());
        } else {
            // Wczytaj JPEG z SPIFFS do PSRAM, wyslij, zwolnij
            File f = SPIFFS.open(task.path.c_str(), "r");
            size_t sz = f ? f.size() : 0;
            uint8_t* buf = sz ? (uint8_t*)ps_malloc(sz) : nullptr;
            if (sz > 0 && !buf) {
                // Brak pamieci to nie wina pozycji — zostaw ja na pozniej
                f.close();
                Serial.println("[OQ] brak pamieci na zdjecie — sprobuje pozniej");
                break;
            }
            size_t rd = buf ? f.read(buf, sz) : 0;
            if (f) f.close();
            if (!buf || rd != sz) {
                if (buf) free(buf);
                Serial.println("[OQ] nieczytelne zdjecie — usuwam");
                offlineQueueRemoveFirst();
                continue;
            }
            r = _solSendJpeg(d, buf, sz, task.reqId.c_str());
            free(buf);
        }

        if (panicTriggered()) return;   // nie blokuj powrotu ekranem bledu

        if (r.kind == _SOL_RES_OK) {
            offlineQueueRemoveFirst();
            continue;
        }
        if (r.kind == _SOL_RES_FATAL) {
            offlineQueueRemoveFirst();
            _solShowSendError(d, r, _solT("Zadanie usuniete z kolejki", "Task removed from queue", "Aufgabe aus Warteschlange entfernt", "Uloha odstranena z fronty"));
            continue;
        }
        // Blad przejsciowy — licznik prob; po _OQ_MAX_ATTEMPTS pozycja wypada
        uint8_t att = offlineQueueBumpAttempts();
        if (att >= _OQ_MAX_ATTEMPTS) {
            offlineQueueRemoveFirst();
            _solShowSendError(d, r, _solT("Usuniete po 3 nieudanych probach", "Removed after 3 failed attempts", "Nach 3 Fehlversuchen entfernt", "Odstraneno po 3 neuspesich"));
        } else {
            _solShowSendError(d, r, _solT("Zostaje w kolejce - kolejna proba pozniej", "Stays queued - will retry later", "Bleibt in Warteschlange", "Zustava ve fronte - dalsi pokus pozdeji"));
        }
        break;   // siec/serwer wlasnie nie dziala — reszta tez by nie przeszla
    }
}

// ---------------------------------------------------------------------------
// SPIFFS dla historii i kolejki offline. Nieuzywana jeszcze partycja (nigdy
// nie formatowana) wymaga jednorazowego formatu — na 16 MB flash trwa to
// dlugo, wiec robimy to tu, z komunikatem, a nie po cichu w historySave()
// tuz po odpowiedzi AI. Raz na uruchomienie.
// ---------------------------------------------------------------------------
static bool _solFsFormatTried = false;

static void _solEnsureFs(U8G2 &d) {
    if (SPIFFS.begin(false)) return;
    if (_solFsFormatTried) return;
    _solFsFormatTried = true;
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);
    d.drawStr(2, 20, _solT("Przygotowuje pamiec...", "Preparing storage...", "Speicher wird vorbereitet...", "Pripravuji pamet..."));
    d.setFont(u8g2_font_5x7_tf);
    d.drawStr(2, 36, _solT("Jednorazowo, moze potrwac do 1 min.", "One-time, may take up to 1 min.", "Einmalig, dauert bis zu 1 Min.", "Jednorazove, muze trvat az 1 min."));
    d.drawStr(2, 46, _solT("Nie wylaczaj kalkulatora.", "Do not switch off.", "Nicht ausschalten.", "Nevypinejte kalkulacku."));
    d.sendBuffer();
    uint32_t t0 = millis();
    bool ok = SPIFFS.begin(true);   // format + mount
    Serial.printf("[SOL] SPIFFS format: %s (%lu ms)\n", ok ? "OK" : "BLAD", (unsigned long)(millis() - t0));
    inputActivityReset();
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

    _solEnsureFs(display);

    // Wyslij zadania z kolejki offline jesli WiFi dostepne (ekran + "pomin")
    _solProcessQueue(display);

    int mode = 0;  // domyslnie zdjecie (kamera) — najczestszy wybor

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
