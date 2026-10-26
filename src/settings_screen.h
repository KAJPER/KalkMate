#pragma once
// settings_screen.h — header-only modul ustawien dla KalkMate
// Wywolanie: showSettings(u8g2);
//
// Ustawienia:
//   brightness   — kontrast OLED 0-15
//   language     — 0=Polski, 1=English, 2=Deutsch, 3=Cestina, 4=Slovencina,
//                  5=Lietuviu, 6=Belaruskaja, 7=Espanol, 8=Portugues,
//                  9=Francais, 10=Italiano (4..10: tabela i18n_extra.h)
//   solveMode    — 0=Szczegolowy, 1=Tylko obliczenia, 2=Tylko wynik
//   autoSleep    — ON/OFF
//   sleepMinutes — indeks 0-10 w tablicy czasow {0.5,1,2,3,4,5,10,15,20,25,30 min}

#include <Arduino.h>
#include <U8g2lib.h>
#include "ui_kit.h"      // wspolny wyglad ekranow (naglowek, wiersze listy, dialogi)
#include <Preferences.h>
#include <SPIFFS.h>
#include "input.h"
#include "wifi_persist.h"
#include "i18n_extra.h"   // kalkTrExtra — jezyki 4..10 (przed ota_update.h i T())
#include "ota_update.h"
#include "battery.h"
#include "camera.h"

// Forward declaration panic flag (definicja w main.cpp). Nie includujemy
// panic.h zeby uniknac circular include z power.h.
extern volatile bool _panicRequested;

// === Piny przyciskow ===
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
// Struktura ustawien
// ---------------------------------------------------------------------------
struct KalkMateSettings {
    uint8_t brightness;   // 0-15 (kontrast OLED)
    uint8_t language;     // 0=PL, 1=EN, 2=DE, 3=CS, 4=SK, 5=LT, 6=BE, 7=ES, 8=PT, 9=FR, 10=IT
    uint8_t solveMode;    // 0=Szczegolowy, 1=Tylko obliczenia, 2=Tylko wynik
    bool    autoSleep;    // auto sleep ON/OFF
    uint8_t sleepMinutes; // indeks 0-10 w tablicy czasow
    char    aiUnlockCode[12]; // sekwencja cyfr otwierajaca tryb AI (do 11 znakow)
    uint8_t panicKey;     // KalkKey ktory wraca z trybu AI do kalkulatora
    bool    rotate180;    // obrot ekranu o 180 stopni wzgledem domyslnej orientacji
    uint8_t camWbMode;    // balans bieli kamery: 0=Auto,1=Sloneczny,2=Pochmurno,3=Biuro,4=Dom
    int8_t  camBrightness; // -2..2, korekta jasnosci zdjecia/podgladu kamery
};

// Domyslne: jasnosc 8, english, szczegolowy, autoSleep ON, 4 min,
//           kod "1111", panic = KEY_MU (27), obrot ekranu OFF,
//           kamera: WB auto, jasnosc 0
static KalkMateSettings kalkSettings = {8, 1, 0, true, 4, "1111", /*KEY_MU*/27, false, 0, 0};

// Zapis/odczyt ustawien w NVS (wszystkie razem). Definicje TUTAJ bo
// musza byc po definicji kalkSettings - wifi_persist.h jest include'owany
// wczesniej z settings_screen.h:17 wiec ma forward dec'a.
static void kalkSaveSettings() {
    Preferences prefs;
    prefs.begin("kalkmate", false);
    prefs.putUChar("bright",    kalkSettings.brightness);
    prefs.putUChar("lang",      kalkSettings.language);
    prefs.putUChar("solveMode", kalkSettings.solveMode);
    prefs.putBool ("autoSleep", kalkSettings.autoSleep);
    prefs.putUChar("sleepMin",  kalkSettings.sleepMinutes);
    prefs.putBool ("rotate180", kalkSettings.rotate180);
    prefs.putUChar("camWb",     kalkSettings.camWbMode);
    prefs.putChar ("camBright", kalkSettings.camBrightness);
    prefs.end();
}

static void kalkLoadSettings() {
    Preferences prefs;
    prefs.begin("kalkmate", true);
    kalkSettings.brightness   = prefs.getUChar("bright",    8);
    kalkSettings.language     = prefs.getUChar("lang",      1);
    kalkSettings.solveMode    = prefs.getUChar("solveMode", 0);
    kalkSettings.autoSleep    = prefs.getBool ("autoSleep", true);
    kalkSettings.sleepMinutes = prefs.getUChar("sleepMin",  4);
    kalkSettings.rotate180    = prefs.getBool ("rotate180", false);
    kalkSettings.camWbMode    = prefs.getUChar("camWb",     0);
    kalkSettings.camBrightness = prefs.getChar("camBright", 0);
    if (kalkSettings.brightness > 15)   kalkSettings.brightness = 8;
    if (kalkSettings.language > 10)     kalkSettings.language = 1;
    if (kalkSettings.solveMode > 2)     kalkSettings.solveMode = 0;
    if (kalkSettings.sleepMinutes > 10) kalkSettings.sleepMinutes = 4;
    if (kalkSettings.camWbMode > 4)     kalkSettings.camWbMode = 0;
    if (kalkSettings.camBrightness < -2 || kalkSettings.camBrightness > 2) kalkSettings.camBrightness = 0;
    prefs.end();
}

// Zastosuj biezace ustawienie obrotu ekranu (wywolac po u8g2.begin() na
// starcie, oraz przy kazdej zmianie w ustawieniach dla podgladu na zywo).
// Domyslna orientacja (rotate180=false) to ta z konstruktora u8g2 w main.cpp
// (U8G2_R2 — plytka ma OLED zamontowany "do gory nogami"); U8G2_R0 jest od
// niej odwrocone o dokladnie 180 stopni.
static void kalkApplyRotation(U8G2 &d) {
    d.setDisplayRotation(kalkSettings.rotate180 ? U8G2_R0 : U8G2_R2);
}

// Tablica wartosci czasu uśpienia (indeks 0-10)
static const char* _SET_SLEEP_LABELS[11] = {
    "30s", "1min", "2min", "3min", "4min",
    "5min", "10min", "15min", "20min", "25min", "30min"
};

// ---------------------------------------------------------------------------
// Pomocnik tlumaczen (0=PL, 1=EN, 2=DE, 3=CS). cs == nullptr -> EN
// (kompatybilnosc z wywolaniami 3-argumentowymi). Jezyki 4..10 -> tabela
// wyszukiwana po tekscie EN (i18n_extra.h, generowana z tools/i18n).
// ---------------------------------------------------------------------------
static const char* T(const char* pl, const char* en, const char* de, const char* cs = nullptr) {
    if (kalkSettings.language >= KALK_TR_EXTRA_FIRST) return kalkTrExtra(en, kalkSettings.language);
    switch (kalkSettings.language) {
        case 0:  return pl;
        case 2:  return de;
        case 3:  return cs ? cs : en;
        default: return en;
    }
}

// Jezyki interfejsu: indeks = kalkSettings.language. Nazwy ASCII (fonty OLED
// _tf nie maja diakrytykow/cyrylicy), kody ISO 639-1 dla serwera (x-language)
// i KALKPROV:SETLANG — kolejnosc musi sie zgadzac z LANG_CODES we flasherze
// (tools/flasher/flasher_common.py) i LANGS w tools/i18n/gen_firmware_i18n.py.
#define _LANG_MAX 10
static const char* const _LANG_NAMES[_LANG_MAX + 1] = {
    "Polski", "English", "Deutsch", "Cestina", "Slovencina", "Lietuviu",
    "Belaruskaja", "Espanol", "Portugues", "Francais", "Italiano"
};
static const char* const KALK_LANG_CODES[_LANG_MAX + 1] = {
    "pl", "en", "de", "cs", "sk", "lt", "be", "es", "pt", "fr", "it"
};
static_assert(KALK_TR_EXTRA_FIRST + KALK_TR_EXTRA_LANGS == _LANG_MAX + 1,
              "i18n_extra.h: liczba jezykow != _LANG_MAX + 1");

// Kod jezyka UI ("pl".."it"); poza zakresem -> "en".
static inline const char* kalkLangCode(uint8_t lang) {
    return lang <= _LANG_MAX ? KALK_LANG_CODES[lang] : "en";
}

// Implementacja forward-deklaracji z ota_update.h (patrz komentarz tam) —
// ota_update.h jest wlaczony wyzej w tym pliku, PRZED definicja kalkSettings.
int otaGetLanguage() { return kalkSettings.language; }

// Implementacja forward-deklaracji z camera.h (analogicznie do otaGetLanguage) —
// camera.h jest wlaczony wyzej, PRZED definicja kalkSettings.
uint8_t camGetWbMode()     { return kalkSettings.camWbMode; }
int8_t  camGetBrightness() { return kalkSettings.camBrightness; }

// Zaimplementowane w remote_session.h, wlaczonym w main.cpp PO solve_screen.h
// (potrzebuje _solDrawError). Forward-deklaracja zeby switch w showSettings()
// (dalej w tym pliku) mogl to wywolac.
void _editRemoteHelp(U8G2 &d);

// power.h (auto-sleep w _setBtn) i factory_reset.h wlaczamy DOPIERO TUTAJ —
// po definicji kalkSettings i T(), z ktorych korzystaja. power.h -> panic.h
// -> settings_screen.h to cykl, ale #pragma once go przerywa, a wszystko,
// czego potrzebuja, jest juz zdefiniowane powyzej.
#include "power.h"
#include "factory_reset.h"
#include "offline_queue.h"   // Ustawienia -> Kolejka offline (wyczysc)

// Klawisz panic nie moze byc: cyfra / "00" / kropka (wpisywanie kodu AI
// i liczb — panic z cyfry kodu blokowal wejscie w tryb AI), "=", C/CE ani
// klawiszem nawigacji (+ - +/- >). Dozwolone: * / M+ M- MR MC sqrt % MU.
static bool kalkPanicKeyAllowed(KalkKey k) {
    if (k == KEY_NONE || k >= KEY_COUNT) return false;
    switch (k) {
        case KEY_0: case KEY_1: case KEY_2: case KEY_3: case KEY_4:
        case KEY_5: case KEY_6: case KEY_7: case KEY_8: case KEY_9:
        case KEY_00: case KEY_DOT: case KEY_EQ: case KEY_CCE:
        case KEY_PLUS: case KEY_MINUS: case KEY_PLUSMINUS: case KEY_ARROW:
            return false;
        default:
            return true;
    }
}

// ---------------------------------------------------------------------------
// Ustawienia jak w telefonie: lista kategorii (ikona + nazwa + aktualna
// wartosc + ">"), w srodku lista pozycji (nazwa + wartosc po prawej).
// Kategorie z jedna pozycja (Jezyk, Bateria) otwieraja ja od razu.
// Identyfikatory pozycji (_SET_*) wybieraja ekran edycji w _setOpenItem().
// ---------------------------------------------------------------------------
#define _SET_BRIGHTNESS   0
#define _SET_ROTATION     1
#define _SET_CAMERA       2
#define _SET_LANGUAGE     3
#define _SET_SOLVEMODE    4
#define _SET_AUTOSLEEP    5
#define _SET_AICODE       6
#define _SET_PANICKEY     7
#define _SET_WIFI         8
#define _SET_ACCOUNT      9
#define _SET_DEVICEID     10
#define _SET_REMOTE       11
#define _SET_UPDATE       12
#define _SET_FACTORY      13
#define _SET_OQCLEAR      14
#define _SET_SCREENTEST   15
#define _SET_CAMTEST      16
#define _SET_KEYTEST      17
#define _SET_KEYSCAN      18
#define _SET_PINDRIVER    19
#define _SET_BATTERY      20
#define _SET_DEVINFO      21
#define _SET_HELP         22
#define _SET_ABOUT        23

// Ikony kategorii — z ui_kit.h.
#define _SET_ICO_DISPLAY UI_ICO_DISPLAY
#define _SET_ICO_CAMERA  UI_ICO_CAMERA
#define _SET_ICO_GLOBE   UI_ICO_GLOBE
#define _SET_ICO_WIFI    UI_ICO_WIFI
#define _SET_ICO_LOCK    UI_ICO_LOCK
#define _SET_ICO_BATTERY UI_ICO_BATTERY
#define _SET_ICO_GEAR    UI_ICO_GEAR
#define _SET_ICO_PULSE   UI_ICO_PULSE
#define _SET_ICO_INFO    UI_ICO_INFO

static const uint8_t _SET_IT_DISPLAY[]  = {_SET_BRIGHTNESS, _SET_ROTATION, _SET_AUTOSLEEP};
static const uint8_t _SET_IT_SOLVE[]    = {_SET_SOLVEMODE, _SET_CAMERA};
static const uint8_t _SET_IT_LANG[]     = {_SET_LANGUAGE};
static const uint8_t _SET_IT_NET[]      = {_SET_WIFI, _SET_ACCOUNT, _SET_DEVICEID, _SET_REMOTE};
static const uint8_t _SET_IT_SECURITY[] = {_SET_AICODE, _SET_PANICKEY};
static const uint8_t _SET_IT_BATTERY[]  = {_SET_BATTERY};
static const uint8_t _SET_IT_SYSTEM[]   = {_SET_UPDATE, _SET_OQCLEAR, _SET_FACTORY};
static const uint8_t _SET_IT_INFO[]     = {_SET_DEVINFO, _SET_HELP, _SET_ABOUT};
static const uint8_t _SET_IT_DIAG[]     = {_SET_SCREENTEST, _SET_CAMTEST, _SET_KEYTEST, _SET_KEYSCAN, _SET_PINDRIVER};

struct _SetCategory {
    const uint8_t* icon;
    const uint8_t* items;
    uint8_t        count;
};
#define _SET_CAT(ico, arr) { ico, arr, (uint8_t)sizeof(arr) }
static const _SetCategory _SET_CATS[] = {
    _SET_CAT(_SET_ICO_DISPLAY, _SET_IT_DISPLAY),
    _SET_CAT(_SET_ICO_CAMERA,  _SET_IT_SOLVE),
    _SET_CAT(_SET_ICO_GLOBE,   _SET_IT_LANG),
    _SET_CAT(_SET_ICO_WIFI,    _SET_IT_NET),
    _SET_CAT(_SET_ICO_LOCK,    _SET_IT_SECURITY),
    _SET_CAT(_SET_ICO_BATTERY, _SET_IT_BATTERY),
    _SET_CAT(_SET_ICO_GEAR,    _SET_IT_SYSTEM),
    _SET_CAT(_SET_ICO_INFO,    _SET_IT_INFO),
    _SET_CAT(_SET_ICO_PULSE,   _SET_IT_DIAG),
};
#define _SET_CAT_COUNT ((int)(sizeof(_SET_CATS) / sizeof(_SET_CATS[0])))
enum { _SET_C_DISPLAY, _SET_C_SOLVE, _SET_C_LANG, _SET_C_NET,
       _SET_C_SECURITY, _SET_C_BATTERY, _SET_C_SYSTEM, _SET_C_INFO, _SET_C_DIAG };

// ---------------------------------------------------------------------------
// Debounce — osobne zmienne z prefiksem _set
// ---------------------------------------------------------------------------
static unsigned long _setLastPress = 0;
#define _SET_DEBOUNCE_MS 200

// Lokalny panic check (settings_screen.h nie ma include panic.h przez circular)
static inline void _setPanicCheck() {
    KalkKey pk = (KalkKey)kalkSettings.panicKey;
    if (pk == KEY_NONE || pk >= KEY_COUNT) return;
    if (inputKeyConsume(pk)) _panicRequested = true;
}

// Czeka na puszczenie klawiszy nawigacji — max 2 s (zablokowany/zwarty
// klawisz membrany nie moze zawiesic menu na zawsze).
static void _setWaitRelease() {
    unsigned long t0 = millis();
    while ((inputBtn(BTN_UP)    == LOW ||
            inputBtn(BTN_DOWN)  == LOW ||
            inputBtn(BTN_LEFT)  == LOW ||
            inputBtn(BTN_RIGHT) == LOW ||
            inputBtn(BTN_OK)    == LOW) &&
           millis() - t0 < 2000) {
        delay(10);
    }
    _setLastPress = millis();
}

// Ekrany z wlaczona kamera (podglad) nie moga usypiac — light sleep przy
// pracujacym esp_camera (DMA/XCLK) nie jest sprawdzony. Ustawiane przez
// _SetNoSleepGuard na czas takiego ekranu.
static bool _setNoSleep = false;
struct _SetNoSleepGuard {
    _SetNoSleepGuard()  { _setNoSleep = true; }
    ~_SetNoSleepGuard() { _setNoSleep = false; }
};

static bool _setBtn(int pin) {
    _setPanicCheck();   // Przy okazji sprawdz panic key
    // Auto-sleep tez w ustawieniach (jak _wifiBtn w wifi_settings.h) —
    // wczesniej petle ustawien nigdy nie usypialy ekranu ani radia. Po
    // wybudzeniu: odswiez ostatnia klatke (bufor u8g2 nadal ja trzyma)
    // i nie traktuj klawisza budzacego jako akcji.
    if (!_setNoSleep && powerCheckSleep()) {
        if (_powerU8g2) _powerU8g2->sendBuffer();
        _setWaitRelease();
        return false;
    }
    if (inputBtn(pin) == LOW) {
        unsigned long now = millis();
        if (now - _setLastPress > _SET_DEBOUNCE_MS) {
            _setLastPress = now;
            return true;
        }
    }
    return false;
}

// ---------------------------------------------------------------------------
// Pomocnik: pasek postpu jasnosci "[========  ] 8"
// totalBars=10, fillChar='=', emptyChar=' '
// ---------------------------------------------------------------------------
static void _setBrightnessBar(char* buf, int bufSize, uint8_t val) {
    // val 0-15 → fill 0-10
    int fill = (int)val * 10 / 15;
    int pos  = 0;
    buf[pos++] = '[';
    for (int i = 0; i < 10; i++) {
        buf[pos++] = (i < fill) ? '=' : ' ';
    }
    buf[pos++] = ']';
    buf[pos++] = ' ';
    if (val < 10) {
        buf[pos++] = '0' + val;
    } else {
        buf[pos++] = '1';
        buf[pos++] = '0' + (val - 10);
    }
    buf[pos] = '\0';
    (void)bufSize;
}

// ---------------------------------------------------------------------------
// Rysowanie list ustawien (kategorie i pozycje) — wspolny wyglad:
// naglowek z tytulem i licznikiem "3/8", 4 wiersze po 12 px, zaznaczenie
// pelnym paskiem, wartosc wyrownana do prawej, ">" przy pozycjach, ktore
// otwieraja ekran, pasek przewijania z prawej (jak w menu glownym).
// ---------------------------------------------------------------------------
#define _SET_VISIBLE   4
#define _SET_ROW_Y0    24     // baseline pierwszego wiersza
#define _SET_ROW_H     12
#define _SET_VALUE_R   240    // prawa krawedz wartosci
#define _SET_CHEVRON_X 243

// Dane do podsumowan na liscie kategorii — czytane raz przy wejsciu i po
// powrocie z ekranu edycji, nie w kazdej klatce (NVS/ADC co 20 ms to zbedny
// koszt, a cache w battery.h i tak trzymalby stara wartosc).
static struct {
    char    ssid[33];
    bool    batOk;
    uint8_t batPct;
    bool    batCharging;
} _setSum;

static void _setRefreshSummary() {
    char pass[64];
    _setSum.ssid[0] = '\0';
    wifiLoadSaved(_setSum.ssid, sizeof(_setSum.ssid), pass, sizeof(pass));
    memset(pass, 0, sizeof(pass));
    _setSum.batOk = batteryIsAvailable();
    _setSum.batPct = _setSum.batOk ? batteryReadPercent() : 0;
    _setSum.batCharging = _setSum.batOk && batteryIsCharging();
}

static const char* _setCatLabel(int c) {
    switch (c) {
        case _SET_C_DISPLAY:  return T("Ekran", "Display", "Anzeige", "Displej");
        case _SET_C_SOLVE:    return T("Rozwiazywanie", "Problem solving", "Aufgaben loesen", "Reseni uloh");
        case _SET_C_LANG:     return T("Jezyk", "Language", "Sprache", "Jazyk");
        case _SET_C_NET:      return T("WiFi i konto", "WiFi & account", "WLAN & Konto", "WiFi a ucet");
        case _SET_C_SECURITY: return T("Bezpieczenstwo", "Security", "Sicherheit", "Zabezpeceni");
        case _SET_C_BATTERY:  return T("Bateria", "Battery", "Akku", "Baterie");
        case _SET_C_SYSTEM:   return T("System", "System", "System", "System");
        case _SET_C_INFO:     return T("Informacje", "Information", "Informationen", "Informace");
        default:              return T("Diagnostyka", "Diagnostics", "Diagnose", "Diagnostika");
    }
}

static const char* _setSolveModeName() {
    if (kalkSettings.solveMode == 0) return T("Szczegolowy", "Detailed", "Detailliert", "Podrobny");
    if (kalkSettings.solveMode == 1) return T("Obliczenia", "Calc only", "Rechnung", "Jen vypocet");
    return T("Wynik", "Result", "Ergebnis", "Vysledek");
}

static const char* _setLangName() {
    return _LANG_NAMES[kalkSettings.language <= _LANG_MAX ? kalkSettings.language : 1];
}

// Wartosc pokazywana obok kategorii (pusty napis = brak).
static void _setCatValue(int c, char* buf, size_t n) {
    buf[0] = '\0';
    switch (c) {
        case _SET_C_SOLVE: snprintf(buf, n, "%s", _setSolveModeName()); break;
        case _SET_C_LANG:  snprintf(buf, n, "%s", _setLangName()); break;
        case _SET_C_NET:
            if (WiFi.status() == WL_CONNECTED) snprintf(buf, n, "%s", WiFi.SSID().c_str());
            else if (_setSum.ssid[0])          snprintf(buf, n, "%s", _setSum.ssid);
            else snprintf(buf, n, "%s", T("brak sieci", "no network", "kein Netz", "zadna sit"));
            break;
        case _SET_C_BATTERY:
            if (!_setSum.batOk) snprintf(buf, n, "--");
            else if (_setSum.batCharging)
                snprintf(buf, n, "%u%% %s", (unsigned)_setSum.batPct, T("ladowanie", "charging", "laedt", "nabiji"));
            else snprintf(buf, n, "%u%%", (unsigned)_setSum.batPct);
            break;
        case _SET_C_SYSTEM: snprintf(buf, n, "v%s", FW_VERSION); break;
    }
}

static const char* _setItemLabel(int id) {
    switch (id) {
        case _SET_BRIGHTNESS: return T("Jasnosc", "Brightness", "Helligkeit", "Jas");
        case _SET_ROTATION:   return T("Obrot ekranu", "Screen rotation", "Bilddrehung", "Otoceni displeje");
        case _SET_AUTOSLEEP:  return T("Usypianie", "Auto sleep", "Auto-Ruhe", "Uspani");
        case _SET_SOLVEMODE:  return T("Tryb rozwiazan", "Solution mode", "Loesungsmodus", "Rezim reseni");
        case _SET_CAMERA:     return T("Obraz kamery", "Camera image", "Kamerabild", "Obraz kamery");
        case _SET_LANGUAGE:   return T("Jezyk", "Language", "Sprache", "Jazyk");
        case _SET_WIFI:       return T("Siec WiFi", "WiFi network", "WLAN-Netz", "Sit WiFi");
        case _SET_ACCOUNT:    return T("Status konta", "Account status", "Kontostatus", "Stav uctu");
        case _SET_DEVICEID:   return T("Device ID + QR", "Device ID + QR", "Geraete-ID + QR", "ID zarizeni + QR");
        case _SET_REMOTE:     return T("Zdalna pomoc", "Remote help", "Fernhilfe", "Vzdalena pomoc");
        case _SET_AICODE:     return T("Kod AI", "AI code", "KI-Code", "Kod AI");
        case _SET_PANICKEY:   return T("Klawisz panic", "Panic key", "Panik-Taste", "Panik klavesa");
        case _SET_BATTERY:    return T("Bateria", "Battery", "Akku", "Baterie");
        case _SET_DEVINFO:    return T("O urzadzeniu", "About device", "Geraeteinfo", "O zarizeni");
        case _SET_HELP:       return T("Pomoc i porady", "Help & tips", "Hilfe & Tipps", "Napoveda a tipy");
        case _SET_ABOUT:      return T("O programie", "About KalkMate", "Ueber KalkMate", "O programu");
        case _SET_UPDATE:     return T("Aktualizacja", "Software update", "Software-Update", "Aktualizace");
        case _SET_OQCLEAR:    return T("Kolejka offline", "Offline queue", "Offline-Warteschlange", "Offline fronta");
        case _SET_FACTORY:    return T("Reset fabryczny", "Factory reset", "Werksreset", "Tovarni reset");
        case _SET_SCREENTEST: return T("Test ekranu", "Screen test", "Bildschirmtest", "Test displeje");
        case _SET_CAMTEST:    return T("Test kamery", "Camera test", "Kameratest", "Test kamery");
        case _SET_KEYTEST:    return T("Test klawiatury", "Keyboard test", "Tastaturtest", "Test klavesnice");
        case _SET_KEYSCAN:    return T("Skaner klawiatury", "Keyboard scanner", "Tastatur-Scanner", "Skener klavesnice");
        default:              return T("Pin Driver Test", "Pin Driver Test", "Pin-Treiber-Test", "Pin Driver Test");
    }
}

// Wartosc pozycji (pusty napis = sama strzalka ">"). Jasnosc rysowana
// osobno jako pasek (zwraca true w *bar).
static void _setItemValue(int id, char* buf, size_t n, bool* bar) {
    buf[0] = '\0';
    *bar = false;
    switch (id) {
        case _SET_BRIGHTNESS: *bar = true; break;
        case _SET_ROTATION:   snprintf(buf, n, "%s\xb0", kalkSettings.rotate180 ? "180" : "0"); break;
        case _SET_AUTOSLEEP:
            if (kalkSettings.autoSleep) snprintf(buf, n, "%s", _SET_SLEEP_LABELS[kalkSettings.sleepMinutes]);
            else snprintf(buf, n, "%s", T("wylaczone", "off", "aus", "vypnuto"));
            break;
        case _SET_SOLVEMODE:  snprintf(buf, n, "%s", _setSolveModeName()); break;
        case _SET_LANGUAGE:   snprintf(buf, n, "%s", _setLangName()); break;
        case _SET_WIFI:
            if (WiFi.status() == WL_CONNECTED) snprintf(buf, n, "%s", WiFi.SSID().c_str());
            else if (_setSum.ssid[0])          snprintf(buf, n, "%s", _setSum.ssid);
            break;
        case _SET_REMOTE:
            snprintf(buf, n, "%s", remoteSessionActive() ? T("AKTYWNA", "ACTIVE", "AKTIV", "AKTIVNI")
                                                         : T("wylaczona", "off", "aus", "vypnuto"));
            break;
        case _SET_AICODE: {
            // Kod zamaskowany — lista bywa widoczna dla osob obok.
            size_t len = strlen(kalkSettings.aiUnlockCode);
            if (len >= n) len = n - 1;
            memset(buf, '*', len);
            buf[len] = '\0';
            break;
        }
        case _SET_PANICKEY: snprintf(buf, n, "%s", kalkKeyLabel((KalkKey)kalkSettings.panicKey)); break;
        case _SET_UPDATE:   snprintf(buf, n, "v%s", FW_VERSION); break;
    }
}

// Rysowanie list — cienkie nakladki na ui_kit.h (ten sam wyglad wszedzie).
static void _setDrawHeader(U8G2 &d, const char* title, bool sub, int pos, int count) {
    uiHeaderCount(d, title, sub, pos, count);
}
static void _setDrawRow(U8G2 &d, int row, bool sel, const uint8_t* icon, const char* label,
                        const char* value, bool chevron, int barVal) {
    uiRow(d, row, sel, icon, label, value, chevron, barVal, 15);
}
static void _setDrawScrollbar(U8G2 &d, int scroll, int count) { uiScrollbar(d, scroll, count); }
static void _setFitScroll(int cursor, int count, int &scroll) { uiFitScroll(cursor, count, scroll); }

static void _drawSettingsCategories(U8G2 &d, int cursor, int scroll) {
    d.clearBuffer();
    d.setBitmapMode(1);   // ikony przezroczyste (na zaznaczonym pasku rysowane kolorem 0)
    _setDrawHeader(d, T("Ustawienia", "Settings", "Einstellungen", "Nastaveni"), false, cursor, _SET_CAT_COUNT);
    char val[40];
    for (int r = 0; r < _SET_VISIBLE; r++) {
        int c = scroll + r;
        if (c >= _SET_CAT_COUNT) break;
        _setCatValue(c, val, sizeof(val));
        _setDrawRow(d, r, c == cursor, _SET_CATS[c].icon, _setCatLabel(c), val, true, -1);
    }
    _setDrawScrollbar(d, scroll, _SET_CAT_COUNT);
    d.setBitmapMode(0);
    d.sendBuffer();
}

static void _drawSettingsItems(U8G2 &d, int cat, int cursor, int scroll) {
    const _SetCategory &C = _SET_CATS[cat];
    d.clearBuffer();
    _setDrawHeader(d, _setCatLabel(cat), true, cursor, C.count);
    char val[40];
    bool bar;
    for (int r = 0; r < _SET_VISIBLE; r++) {
        int i = scroll + r;
        if (i >= C.count) break;
        int id = C.items[i];
        _setItemValue(id, val, sizeof(val), &bar);
        _setDrawRow(d, r, i == cursor, nullptr, _setItemLabel(id), val, true,
                    bar ? (int)kalkSettings.brightness : -1);
    }
    _setDrawScrollbar(d, scroll, C.count);
    d.sendBuffer();
}

// ---------------------------------------------------------------------------
// Wspolne elementy ekranow edycji (wyglad z ui_kit.h): podpowiedzi stopki,
// wiersz listy wyboru ("picker" jak w telefonie), ekran "trwa...".
// ---------------------------------------------------------------------------
static const uint8_t _SET_ICO_BLANK[8] = {0, 0, 0, 0, 0, 0, 0, 0};

static const char* _setTxtSave()   { return T("OK zapisz", "OK save", "OK speichern", "OK ulozit"); }
static const char* _setTxtCancel() { return T("C/CE anuluj", "C/CE cancel", "C/CE abbrechen", "C/CE zrusit"); }
static const char* _setTxtExit()   { return T("C/CE wyjscie", "C/CE exit", "C/CE beenden", "C/CE konec"); }
static const char* _setTxtBack()   { return T("< wstecz", "< back", "< zurueck", "< zpet"); }
static const char* _setTxtSelect() { return T("^/v wybierz", "^/v select", "^/v waehlen", "^/v vybrat"); }

// Wiersz listy wyboru: znaczek przy zapisanej opcji (checked), pasek przy
// kursorze (sel). Pusta ikona trzyma etykiety w jednej kolumnie.
static void _setPickRow(U8G2 &d, int row, bool sel, bool checked, const char* label,
                        const char* value = nullptr) {
    uiRow(d, row, sel, checked ? UI_ICO_CHECK : _SET_ICO_BLANK, label, value, false, -1);
}

// Cala lista wyboru (3 wiersze + stopka). label(i)/value(i) — opcje.
static void _setDrawPicker(U8G2 &d, const char* title, int count, int cursor, int checked,
                           int &scroll, const char* (*label)(int), const char* (*value)(int),
                           const char* footL, const char* footR) {
    uiFitScroll(cursor, count, scroll, UI_ROWS_FOOTER);
    d.clearBuffer();
    if (count > UI_ROWS_FOOTER) uiHeaderCount(d, title, false, cursor, count);
    else                        uiHeader(d, title, false);
    for (int r = 0; r < UI_ROWS_FOOTER; r++) {
        int i = scroll + r;
        if (i >= count) break;
        _setPickRow(d, r, i == cursor, i == checked, label(i), value ? value(i) : nullptr);
    }
    uiScrollbar(d, scroll, count, UI_ROWS_FOOTER);
    uiFooter(d, footL, footR);
    d.sendBuffer();
}

// Tekst z ikona 8x8, wysrodkowany razem (aktualna czcionka).
static void _setIconLine(U8G2 &d, int y, const uint8_t* icon, const char* s) {
    int w = d.getStrWidth(s);
    int x = (UI_W - (w + 12)) / 2;
    d.setBitmapMode(1);
    d.drawXBM(x, y - 8, 8, 8, icon);
    d.setBitmapMode(0);
    d.drawStr(x + 12, y, s);
}

// Ekran "trwa..." (operacja blokujaca): naglowek, tekst, kropki.
static void _setBusy(U8G2 &d, const char* title, const char* text) {
    d.clearBuffer();
    uiHeader(d, title, false);
    d.setFont(UI_FONT);
    uiCenter(d, 33, text);
    uiSpinner(d, UI_W / 2, 44);
    d.sendBuffer();
}

// ---------------------------------------------------------------------------
// Edycja: Jasnosc — duza liczba + pasek, podglad na zywo
// ---------------------------------------------------------------------------
static void _editBrightness(U8G2 &d) {
    uint8_t val = kalkSettings.brightness;
    _setWaitRelease();

    while (true) {
        if (_panicRequested) return;
        d.clearBuffer();
        uiHeader(d, _setItemLabel(_SET_BRIGHTNESS), false);

        char num[4];
        snprintf(num, sizeof(num), "%u", (unsigned)val);
        d.setFont(UI_FONT_BIG);
        int nw = d.getStrWidth(num);
        d.setFont(UI_FONT_SMALL);
        int sw = d.getStrWidth("/15");
        int x = (UI_W - (nw + 2 + sw)) / 2;
        d.setFont(UI_FONT_BIG);
        d.drawStr(x, 35, num);
        d.setFont(UI_FONT_SMALL);
        d.drawStr(x + nw + 2, 35, "/15");

        d.setFont(UI_FONT);
        d.drawStr(26, 49, "-");
        d.drawStr(225, 49, "+");
        uiProgress(d, 38, 42, 180, (int)val * 100 / 15);

        uiFooter(d, T("</> zmien", "</> change", "</> aendern", "</> zmenit"), _setTxtSave());
        d.sendBuffer();

        // PCB v4 cap 0-105 (anty-brownout), nie 0-255
        if (_setBtn(BTN_LEFT)) {
            if (val > 0) val--;
            d.setContrast(val * 7); // podglad na zywo (cap S3)
        } else if (_setBtn(BTN_RIGHT)) {
            if (val < 15) val++;
            d.setContrast(val * 7);
        } else if (_setBtn(BTN_OK)) {
            kalkSettings.brightness = val;
            d.setContrast(val * 7);
            kalkSaveSettings();   // persist
            _setWaitRelease();
            return;
        }

        delay(20);
    }
}

// ---------------------------------------------------------------------------
// Edycja: Obrot ekranu o 180 stopni (lista 2 opcji, podglad na zywo)
// ---------------------------------------------------------------------------
static const char* _setRotLabel(int i) {
    return i ? T("Odwrocony", "Upside down", "Kopfueber", "Obraceny")
             : T("Normalnie", "Normal", "Normal", "Normalne");
}
static const char* _setRotValue(int i) { return i ? "180\xb0" : "0\xb0"; }

static void _editRotation(U8G2 &d) {
    bool val = kalkSettings.rotate180;
    const bool saved = kalkSettings.rotate180;
    int scroll = 0;
    _setWaitRelease();

    while (true) {
        if (_panicRequested) return;
        kalkSettings.rotate180 = val;
        kalkApplyRotation(d);   // podglad na zywo, jak przy jasnosci

        _setDrawPicker(d, _setItemLabel(_SET_ROTATION), 2, val ? 1 : 0, saved ? 1 : 0, scroll,
                       _setRotLabel, _setRotValue, _setTxtSelect(), _setTxtSave());

        if (_setBtn(BTN_LEFT) || _setBtn(BTN_RIGHT) || _setBtn(BTN_UP) || _setBtn(BTN_DOWN)) {
            val = !val;
        } else if (_setBtn(BTN_OK)) {
            kalkSettings.rotate180 = val;
            kalkApplyRotation(d);
            kalkSaveSettings();   // persist
            _setWaitRelease();
            return;
        }

        delay(20);
    }
}

// Wiersz panelu obok podgladu kamery (x0..255, 5x7): etykieta + wartosc,
// zaznaczony = jasny pasek, wartosc w "<...>" (LEFT/RIGHT zmienia).
static void _setPanelRow(U8G2 &d, int x0, int y, bool sel, const char* label, const char* value) {
    d.setFont(UI_FONT_SMALL);
    if (sel) {
        d.setDrawColor(1);
        d.drawRBox(x0, y - 8, UI_W - x0, 11, 2);
        d.setDrawColor(0);
    }
    d.drawStr(x0 + 3, y, label);
    char v[24];
    snprintf(v, sizeof(v), sel ? "<%s>" : "%s", value);
    if (x0 + 3 + d.getStrWidth(label) + 4 + d.getStrWidth(v) > UI_W - 2) snprintf(v, sizeof(v), "%s", value);
    d.drawStr(UI_W - 3 - d.getStrWidth(v), y, v);
    d.setDrawColor(1);
}

// Podpowiedzi klawiszy na dole panelu kamery (4x6): w jednej linii, a gdy
// sie nie mieszcza — w dwoch.
static void _setPanelHints(U8G2 &d, int x0, const char* a, const char* b) {
    d.setDrawColor(1);
    d.setFont(u8g2_font_4x6_tf);
    int wa = d.getStrWidth(a), wb = d.getStrWidth(b);
    if (x0 + 2 + wa + 6 + wb <= UI_W - 1) {
        d.drawHLine(x0, 52, UI_W - x0);
        d.drawStr(x0 + 2, 62, a);
        d.drawStr(UI_W - 1 - wb, 62, b);
    } else {
        d.drawHLine(x0, 50, UI_W - x0);
        d.drawStr(x0 + 2, 57, a);
        d.drawStr(x0 + 2, 63, b);
    }
}

// ---------------------------------------------------------------------------
// Edycja: Kamera (balans bieli + korekta jasnosci), z zywym podgladem —
// pomaga w trudnym oswietleniu i na plytkach ze starszym auto-AWB/AEC.
// Wlasna, uproszczona kopia dithering-podgladu z _setCamPreviewLoop (bez
// paska ostrosci — tu nie jest potrzebny), zeby miec wlasny prawy panel.
// ---------------------------------------------------------------------------
static void _editCameraTuning(U8G2 &d) {
    _SetNoSleepGuard noSleep;   // kamera pracuje — bez auto-sleep na tym ekranie
    uint8_t wbVal = kalkSettings.camWbMode;
    int8_t  brVal = kalkSettings.camBrightness;
    int field = 0; // 0 = balans bieli, 1 = jasnosc
    _setWaitRelease();

    static const char* const _WB_NAMES_PL[5] = {"Auto", "Sloneczny", "Pochmurno", "Biuro", "Dom"};
    static const char* const _WB_NAMES_EN[5] = {"Auto", "Sunny", "Cloudy", "Office", "Home"};
    static const char* const _WB_NAMES_DE[5] = {"Auto", "Sonnig", "Bewoelkt", "Buero", "Zuhause"};
    static const char* const _WB_NAMES_CS[5] = {"Auto", "Slunecno", "Zatazeno", "Kancelar", "Doma"};

    _setBusy(d, _setItemLabel(_SET_CAMERA),
             T("Uruchamiam podglad...", "Starting preview...", "Starte Vorschau...", "Spoustim nahled..."));

    if (!camBeginPreview()) {
        uiMessage(d, _setItemLabel(_SET_CAMERA), UI_ICO_WARN,
                  T("Kamera nie odpowiada", "Camera not responding", "Kamera antwortet nicht", "Kamera neodpovida"),
                  T("Init NIEUDANY", "Init FAILED", "Init FEHLGESCHLAGEN", "Init SELHAL"), nullptr,
                  _setTxtBack());
        _setWaitRelease();
        while (true) {
            if (_panicRequested) return;
            if (_setBtn(BTN_LEFT) || inputKeyConsume(KEY_CCE)) { _setWaitRelease(); return; }
            delay(20);
        }
    }

    sensor_t* s = esp_camera_sensor_get();

    static const int PV_W = 160, PV_H = 64;
    static const int XBM_STRIDE = (PV_W + 7) / 8;
    static uint8_t xbm[XBM_STRIDE * PV_H];
    static const uint8_t bayer4[4][4] = {
        {  0,  8,  2, 10},
        { 12,  4, 14,  6},
        {  3, 11,  1,  9},
        { 15,  7, 13,  5}
    };

    while (true) {
        if (_panicRequested) { camEnd(); return; }

        if (s) {
            s->set_wb_mode(s, wbVal);
            s->set_brightness(s, brVal);
        }

        camera_fb_t* fb = esp_camera_fb_get();
        if (fb && fb->buf && fb->width >= PV_W && fb->height >= PV_H) {
            const int sw = fb->width, sh = fb->height;
            const int row0 = (sh - PV_H) / 2;
            memset(xbm, 0, sizeof(xbm));
            for (int y = 0; y < PV_H; y++) {
                const uint8_t* row  = fb->buf + (size_t)(row0 + y) * sw;
                uint8_t*       xrow = xbm + (size_t)y * XBM_STRIDE;
                const uint8_t* brow = bayer4[y & 3];
                for (int x = 0; x < PV_W; x++) {
                    uint8_t thr = (uint8_t)(brow[x & 3] * 16);
                    if (row[x] > thr) xrow[x >> 3] |= (1 << (x & 7));
                }
            }
        }
        if (fb) esp_camera_fb_return(fb);

        d.clearBuffer();
        d.drawXBM(0, 0, PV_W, PV_H, xbm);
        d.drawFrame(0, 0, PV_W, PV_H);

        // Prawy panel (x 164..255): tytul, 2 pola, podpowiedzi
        const int PX = 164;
        d.setFont(UI_FONT_SMALL);
        d.drawStr(PX + 2, 8, _setItemLabel(_SET_CAMERA));
        d.drawHLine(PX, 11, UI_W - PX);

        const char* const* wbNames = (kalkSettings.language == 0) ? _WB_NAMES_PL
                                    : (kalkSettings.language == 2) ? _WB_NAMES_DE
                                    : (kalkSettings.language == 3) ? _WB_NAMES_CS : _WB_NAMES_EN;
        const char* wbName = (kalkSettings.language >= KALK_TR_EXTRA_FIRST)
                           ? kalkTrExtra(_WB_NAMES_EN[wbVal], kalkSettings.language) : wbNames[wbVal];
        char brStr[6];
        if (brVal == 0) snprintf(brStr, sizeof(brStr), "0");
        else            snprintf(brStr, sizeof(brStr), "%+d", brVal);
        _setPanelRow(d, PX, 23, field == 0, "WB", wbName);
        _setPanelRow(d, PX, 35, field == 1, T("Jasn", "Bright", "Hell", "Jas"), brStr);

        // Skala jasnosci -2..+2 (5 kropek) pod polami
        for (int i = 0; i < 5; i++) {
            int cx = PX + 26 + i * 10;
            if (i == brVal + 2) d.drawBox(cx - 2, 43, 5, 5);
            else                d.drawFrame(cx - 1, 44, 3, 3);
        }

        _setPanelHints(d, PX, _setTxtCancel(), _setTxtSave());
        d.sendBuffer();

        if (_setBtn(BTN_OK)) {
            kalkSettings.camWbMode     = wbVal;
            kalkSettings.camBrightness = brVal;
            kalkSaveSettings();   // persist
            camEnd();
            _setWaitRelease();
            return;
        }
        if (inputKeyConsume(KEY_CCE)) {
            camEnd();   // odrzuc zmiany (kalkSettings nietkniete)
            _setWaitRelease();
            return;
        }
        if (_setBtn(BTN_UP))   field = 0;
        if (_setBtn(BTN_DOWN)) field = 1;
        if (_setBtn(BTN_LEFT)) {
            if (field == 0) wbVal = (wbVal == 0) ? 4 : wbVal - 1;
            else            brVal = (brVal <= -2) ? -2 : brVal - 1;
        }
        if (_setBtn(BTN_RIGHT)) {
            if (field == 0) wbVal = (wbVal >= 4) ? 0 : wbVal + 1;
            else            brVal = (brVal >= 2) ? 2 : brVal + 1;
        }

        delay(20);
    }
}

// ---------------------------------------------------------------------------
// Edycja: Jezyk — lista jezykow, znaczek przy zapisanym
// ---------------------------------------------------------------------------
static const char* _setLangLabel(int i) { return _LANG_NAMES[i]; }

static void _editLanguage(U8G2 &d) {
    uint8_t val = kalkSettings.language;
    const int saved = kalkSettings.language;
    int scroll = 0;
    _setWaitRelease();

    while (true) {
        if (_panicRequested) return;
        // Po zmianie jezyka rysuj od razu w nowym jezyku
        uint8_t prevLang = kalkSettings.language;
        kalkSettings.language = val; // tymczasowo ustaw aby T() dzialalo poprawnie

        _setDrawPicker(d, _setItemLabel(_SET_LANGUAGE), _LANG_MAX + 1, val, saved, scroll,
                       _setLangLabel, nullptr, _setTxtSelect(), _setTxtSave());

        kalkSettings.language = prevLang; // przywroc do zatwierdzenia

        bool pressed = false;
        while (!pressed) {
            if (_setBtn(BTN_LEFT) || _setBtn(BTN_UP)) {
                val = (val == 0) ? _LANG_MAX : val - 1;
                pressed = true;
            } else if (_setBtn(BTN_RIGHT) || _setBtn(BTN_DOWN)) {
                val = (val >= _LANG_MAX) ? 0 : val + 1;
                pressed = true;
            } else if (_setBtn(BTN_OK)) {
                kalkSettings.language = val;
                kalkSaveSettings();   // persist
                _setWaitRelease();
                return;
            }
            delay(20);
        }
    }
}

// ---------------------------------------------------------------------------
// Edycja: Tryb rozwiazan (3 tryby)
// ---------------------------------------------------------------------------
static const char* _setSolveLabel(int i) {
    if (i == 0) return T("Szczegolowy",      "Detailed",    "Detailliert",  "Podrobny");
    if (i == 1) return T("Tylko obliczenia", "Calc only",   "Nur Rechnung", "Jen vypocet");
    return             T("Tylko wynik",      "Result only", "Nur Ergebnis", "Jen vysledek");
}

static void _editSolveMode(U8G2 &d) {
    uint8_t val = kalkSettings.solveMode;
    int scroll = 0;
    _setWaitRelease();

    while (true) {
        if (_panicRequested) return;
        _setDrawPicker(d, _setItemLabel(_SET_SOLVEMODE), 3, val, kalkSettings.solveMode, scroll,
                       _setSolveLabel, nullptr, _setTxtSelect(), _setTxtSave());

        if (_setBtn(BTN_LEFT) || _setBtn(BTN_UP)) {
            val = (val == 0) ? 2 : val - 1;
        } else if (_setBtn(BTN_RIGHT) || _setBtn(BTN_DOWN)) {
            val = (val == 2) ? 0 : val + 1;
        } else if (_setBtn(BTN_OK)) {
            kalkSettings.solveMode = val;
            kalkSaveSettings();   // persist
            _setWaitRelease();
            return;
        }

        delay(20);
    }
}

// ---------------------------------------------------------------------------
// Edycja: Auto-sleep — lista: "Wylaczone" + 11 czasow. Logika jak dawniej
// (onOff + idx): LEFT/UP przy pierwszym czasie -> wylaczone, OK na
// "Wylaczone" wlacza (kursor na czas), OK na czasie zapisuje.
// ---------------------------------------------------------------------------
static const char* _setSleepLabel(int i) {
    return i == 0 ? T("Wylaczone", "Off", "Aus", "Vypnuto") : _SET_SLEEP_LABELS[i - 1];
}

static void _editAutoSleep(U8G2 &d) {
    bool    onOff = kalkSettings.autoSleep;
    uint8_t idx   = kalkSettings.sleepMinutes;
    const int saved = kalkSettings.autoSleep ? kalkSettings.sleepMinutes + 1 : 0;
    int scroll = 0;
    _setWaitRelease();

    while (true) {
        if (_panicRequested) return;
        _setDrawPicker(d, _setItemLabel(_SET_AUTOSLEEP), 12, onOff ? idx + 1 : 0, saved, scroll,
                       _setSleepLabel, nullptr, _setTxtSelect(),
                       onOff ? _setTxtSave() : T("OK wlacz", "OK enable", "OK aktivieren", "OK zapnout"));

        if (_setBtn(BTN_OK)) {
            if (!onOff) {
                // Toggle do ON
                onOff = true;
            } else {
                // Zatwierdz
                kalkSettings.autoSleep    = onOff;
                kalkSettings.sleepMinutes = idx;
                kalkSaveSettings();   // persist
                _setWaitRelease();
                return;
            }
        } else if (_setBtn(BTN_LEFT) || _setBtn(BTN_UP)) {
            if (onOff) {
                // Zmniejsz czas lub toggle OFF gdy idx==0 i jeszcze raz lewo
                if (idx > 0) {
                    idx--;
                } else {
                    onOff = false;
                }
            }
        } else if (_setBtn(BTN_RIGHT) || _setBtn(BTN_DOWN)) {
            if (onOff) {
                if (idx < 10) idx++;
            } else {
                onOff = true;
            }
        }

        delay(20);
    }
}

// ---------------------------------------------------------------------------
// Edycja: Kod AI (1-11 cyfr) — cyfry w ramkach, kursor = odwrocona ramka
// LEFT/RIGHT — zmień pozycję, UP/DOWN — zmień cyfrę 0-9, OK — zapisz, BACK — anuluj
// ---------------------------------------------------------------------------
static void _editAiCode(U8G2 &d) {
    char buf[12];
    strncpy(buf, kalkSettings.aiUnlockCode, sizeof(buf) - 1);
    buf[sizeof(buf) - 1] = '\0';
    if (!buf[0]) strcpy(buf, "0000");

    int len = strlen(buf);
    int pos = 0;

    while (true) {
        if (_panicRequested) return;

        d.clearBuffer();
        uiHeaderCount(d, _setItemLabel(_SET_AICODE), false, pos, len);

        const int BW = 18, BH = 24, GAP = 4, BY = 20;
        const int x0 = (UI_W - (len * BW + (len - 1) * GAP)) / 2;
        d.setFont(UI_FONT_BIG);
        for (int i = 0; i < len; i++) {
            int x = x0 + i * (BW + GAP);
            d.setDrawColor(1);
            if (i == pos) {
                d.drawRBox(x, BY, BW, BH, 3);
                d.setDrawColor(0);
            } else {
                d.drawRFrame(x, BY, BW, BH, 3);
            }
            char ch[2] = { buf[i], '\0' };
            d.drawStr(x + (BW - d.getStrWidth(ch)) / 2, BY + BH - 5, ch);
            d.setDrawColor(1);
        }
        // Strzalki nad/pod kursorem: UP/DOWN zmienia cyfre
        const int cx = x0 + pos * (BW + GAP) + BW / 2;
        d.drawTriangle(cx - 3, BY - 2, cx + 3, BY - 2, cx, BY - 5);
        d.drawTriangle(cx - 3, BY + BH + 1, cx + 3, BY + BH + 1, cx, BY + BH + 4);

        uiFooter(d, _setTxtCancel(), _setTxtSave());
        d.sendBuffer();

        if (_setBtn(BTN_OK)) {
            strncpy(kalkSettings.aiUnlockCode, buf, sizeof(kalkSettings.aiUnlockCode) - 1);
            kalkSettings.aiUnlockCode[sizeof(kalkSettings.aiUnlockCode) - 1] = '\0';
            saveAiCode(buf);
            _setWaitRelease();
            return;
        }
        if (inputKeyConsume(KEY_CCE)) {
            _setWaitRelease();
            return;
        }
        if (_setBtn(BTN_LEFT)) {
            pos = (pos - 1 + len) % len;
        }
        if (_setBtn(BTN_RIGHT)) {
            pos = (pos + 1) % len;
        }
        if (_setBtn(BTN_UP)) {
            char c = buf[pos];
            if (c >= '0' && c < '9')      buf[pos] = c + 1;
            else if (c == '9')            buf[pos] = '0';
            else                          buf[pos] = '0';
        }
        if (_setBtn(BTN_DOWN)) {
            char c = buf[pos];
            if (c > '0' && c <= '9')      buf[pos] = c - 1;
            else if (c == '0')            buf[pos] = '9';
            else                          buf[pos] = '0';
        }
        delay(20);
    }
}

// ---------------------------------------------------------------------------
// Edycja: Panic key — naciśnij dowolny dozwolony klawisz fizyczny.
// Dozwolone klawisze pokazane jako "chipy", aktualny wypelniony.
// ---------------------------------------------------------------------------
static void _editPanicKey(U8G2 &d) {
    _setWaitRelease();
    // Czekamy na puszczenie wszystkich KalkKey (żeby nie złapać nadal
    // wciśniętego OK z wejścia w edycję)
    uint32_t releaseStart = millis();
    while (millis() - releaseStart < 300) {
        inputScan();
        delay(10);
    }

    static const KalkKey CHIPS[] = { KEY_MUL, KEY_DIV, KEY_PERCENT, KEY_SQRT,
                                     KEY_MPLUS, KEY_MMINUS, KEY_MR, KEY_MC, KEY_MU };
    const int NCH = (int)(sizeof(CHIPS) / sizeof(CHIPS[0]));

    uint32_t rejectUntil = 0;   // > millis(): pokazuj komunikat "niedozwolony"
    while (true) {
        if (_panicRequested) return;
        d.clearBuffer();
        char cur[24];
        snprintf(cur, sizeof(cur), "%s %s", T("Aktualny:", "Current:", "Aktuell:", "Aktualni:"),
                 kalkKeyLabel((KalkKey)kalkSettings.panicKey));
        uiHeader(d, _setItemLabel(_SET_PANICKEY), false, cur);

        d.setFont(UI_FONT);
        if ((int32_t)(rejectUntil - millis()) > 0) {
            _setIconLine(d, 27, UI_ICO_WARN,
                         T("Ten klawisz jest niedozwolony", "This key is not allowed",
                           "Diese Taste ist nicht erlaubt", "Tato klavesa neni povolena"));
        } else {
            uiCenter(d, 27, T("Nacisnij nowy klawisz", "Press the new key",
                              "Neue Taste druecken", "Stisknete novou klavesu"));
        }

        // Chipy dozwolonych klawiszy
        d.setFont(UI_FONT_SMALL);
        const int CH = 11, GAP = 4, CY = 35;
        int total = 0;
        for (int i = 0; i < NCH; i++) total += d.getStrWidth(kalkKeyLabel(CHIPS[i])) + 10 + (i ? GAP : 0);
        int x = (UI_W - total) / 2;
        for (int i = 0; i < NCH; i++) {
            const char* lab = kalkKeyLabel(CHIPS[i]);
            int w = d.getStrWidth(lab) + 10;
            d.setDrawColor(1);
            if (CHIPS[i] == (KalkKey)kalkSettings.panicKey) {
                d.drawRBox(x, CY, w, CH, 2);
                d.setDrawColor(0);
            } else {
                d.drawRFrame(x, CY, w, CH, 2);
            }
            d.drawStr(x + 5, CY + 8, lab);
            d.setDrawColor(1);
            x += w + GAP;
        }

        uiFooter(d, _setTxtCancel(), nullptr);
        d.sendBuffer();

        // Anulowanie przez C/CE — ale tylko jeśli aktualny panic to nie C/CE
        // (stary zapis sprzed walidacji mogl go tak ustawic)
        if (kalkSettings.panicKey != KEY_CCE && inputKeyConsume(KEY_CCE)) {
            _setWaitRelease();
            return;
        }

        KalkKey k = inputAnyKeyConsume();
        if (k != KEY_NONE) {
            if (!kalkPanicKeyAllowed(k)) {
                // Cyfry (kod AI!), "=", C/CE i nawigacja odrzucone — patrz
                // kalkPanicKeyAllowed().
                rejectUntil = millis() + 2000;
            } else {
                kalkSettings.panicKey = (uint8_t)k;
                savePanicKey((uint8_t)k);
                _setWaitRelease();
                return;
            }
        }
        delay(20);
    }
}

// ---------------------------------------------------------------------------
// Edycja: Aktualizacje firmware (OTA)
//   - Pokazuje aktualna wersje
//   - Sprawdz: pyta serwer o najnowsza
//   - Zainstaluj: pobiera + flashuje + restart (postep rysuje otaInstall)
// ---------------------------------------------------------------------------
static void _editUpdate(U8G2 &d) {
    _setWaitRelease();

    enum { ST_IDLE, ST_CHECKING, ST_AVAILABLE, ST_NO_UPDATE, ST_ERROR };
    int state = ST_IDLE;
    OtaInfo info;
    const char* okCheck = nullptr;

    while (true) {
        if (_panicRequested) return;
        okCheck = T("OK sprawdz", "OK check", "OK pruefen", "OK zkontrolovat");
        // Render
        d.clearBuffer();
        uiHeader(d, _setItemLabel(_SET_UPDATE), true);

        char cur[40];
        snprintf(cur, sizeof(cur), T("Aktualna wersja: v%s", "Current version: v%s", "Aktuelle Version: v%s", "Aktualni verze: v%s"), FW_VERSION);

        switch (state) {
            case ST_IDLE:
            case ST_CHECKING: {
                char v[24];
                snprintf(v, sizeof(v), "v%s", FW_VERSION);
                d.setFont(UI_FONT_SMALL);
                uiCenter(d, 22, T("Firmware", "Firmware", "Firmware", "Firmware"));
                d.setFont(UI_FONT_BIG);
                uiCenter(d, 41, v);
                uiFooter(d, _setTxtBack(), okCheck);
                break;
            }
            case ST_AVAILABLE: {
                char av[40];
                snprintf(av, sizeof(av), T("Dostepna: v%s", "Available: v%s", "Verfuegbar: v%s", "Dostupna: v%s"),
                         info.latestVersion.c_str());
                d.setFont(UI_FONT);
                _setIconLine(d, 29, UI_ICO_CLOUD, av);
                d.setFont(UI_FONT_SMALL);
                uiCenter(d, 42, cur);
                uiFooter(d, _setTxtCancel(), T("OK zainstaluj", "OK install", "OK installieren", "OK instalovat"));
                break;
            }
            case ST_NO_UPDATE:
                d.setFont(UI_FONT);
                _setIconLine(d, 29, UI_ICO_CHECK, T("Masz najnowsza wersje :)", "You have the latest :)", "Du hast die neueste Version :)", "Mate nejnovejsi verzi :)"));
                d.setFont(UI_FONT_SMALL);
                uiCenter(d, 42, cur);
                uiFooter(d, _setTxtBack(), okCheck);
                break;
            case ST_ERROR: {
                char eb[60];
                snprintf(eb, sizeof(eb), T("Blad: %.40s", "Error: %.40s", "Fehler: %.40s", "Chyba: %.40s"), info.error.c_str());
                d.setFont(UI_FONT_SMALL);
                _setIconLine(d, 29, UI_ICO_WARN, eb);
                uiCenter(d, 42, cur);
                uiFooter(d, _setTxtBack(), okCheck);
                break;
            }
        }
        d.sendBuffer();

        // Klawisze
        if (inputKeyConsume(KEY_CCE)) {
            _setWaitRelease();
            return;
        }
        if (_setBtn(BTN_LEFT)) {
            _setWaitRelease();
            return;
        }
        if (_setBtn(BTN_OK)) {
            _setWaitRelease();
            if (state == ST_IDLE || state == ST_NO_UPDATE || state == ST_ERROR) {
                // Sprawdz aktualizacje
                state = ST_CHECKING;
                _setBusy(d, _setItemLabel(_SET_UPDATE),
                         T("Sprawdzam serwer...", "Checking server...", "Server wird geprueft...", "Kontroluji server..."));

                info = otaCheck();
                if (!info.error.isEmpty()) {
                    state = ST_ERROR;
                } else if (info.available) {
                    state = ST_AVAILABLE;
                } else {
                    state = ST_NO_UPDATE;
                }
            } else if (state == ST_AVAILABLE) {
                // Zainstaluj - przekaz sig dla weryfikacji ECDSA
                otaInstall(d, info.url, info.sig);
                // Po sukcesie restart, w przeciwnym wypadku zwraca false
                state = ST_ERROR;
                info.error = "Install failed";
            }
        }

        delay(20);
    }
}

// Forward declarations — implementacje w innych plikach
extern void showDeviceIdQrScreen(U8G2 &d);
extern void showAccountStatusScreen(U8G2 &d);   // implementacja w account_screen.h
// Z innych UI files (wifi_settings.h, screen_test.h):
void showWifiSettings(U8G2 &display);
void showScreenTest(U8G2 &display);
void showInfo(U8G2 &display);          // info_screen.h (Ustawienia -> Informacje -> Pomoc)
void showAboutScreen(U8G2 &display);   // about_screen.h (Ustawienia -> Informacje -> O programie)

// ---------------------------------------------------------------------------
// Test klawiatury — wszystkie 27 klawiszy w siatce, podswietlenie wcisnietego,
// kropka przy klawiszach juz sprawdzonych, licznik "12/27" w wolnym polu.
// ---------------------------------------------------------------------------
static void _editKeyTest(U8G2 &d) {
    _setWaitRelease();

    // Layout 6 wierszy x 5 kolumn (max 30 slotow). Uklad jak na kalkulatorze.
    // Lewy gorny rog = wiersz 0. Pusty slot = -1.
    static const int8_t LAYOUT[6][5] = {
        // wiersz 0: gora
        { -1,         (int8_t)KEY_SQRT, (int8_t)KEY_PERCENT, (int8_t)KEY_MU, -1 },
        // wiersz 1
        { (int8_t)KEY_MC, (int8_t)KEY_MR, (int8_t)KEY_MMINUS, (int8_t)KEY_MPLUS, (int8_t)KEY_DIV },
        // wiersz 2
        { (int8_t)KEY_PLUSMINUS, (int8_t)KEY_7, (int8_t)KEY_8, (int8_t)KEY_9, (int8_t)KEY_MUL },
        // wiersz 3
        { (int8_t)KEY_ARROW, (int8_t)KEY_4, (int8_t)KEY_5, (int8_t)KEY_6, (int8_t)KEY_MINUS },
        // wiersz 4
        { (int8_t)KEY_CCE, (int8_t)KEY_1, (int8_t)KEY_2, (int8_t)KEY_3, (int8_t)KEY_PLUS },
        // wiersz 5: dol
        { (int8_t)KEY_0, (int8_t)KEY_00, (int8_t)KEY_DOT, (int8_t)KEY_EQ, -1 },
    };

    const int CELL_W = 256 / 5;     // 51 px
    const int CELL_H = 64 / 6;      // 10 px
    bool seen[KEY_COUNT] = {false};
    int seenCount = 0;

    while (true) {
        if (_panicRequested) return;
        d.clearBuffer();
        d.setFont(UI_FONT_SMALL);

        for (int r = 0; r < 6; r++) {
            for (int c = 0; c < 5; c++) {
                int8_t k = LAYOUT[r][c];
                if (k < 0) continue;
                int x = c * CELL_W;
                int y = r * CELL_H;

                bool down = inputKeyDown((KalkKey)k);
                if (down && !seen[k]) { seen[k] = true; seenCount++; }
                d.setDrawColor(1);
                if (down) {
                    // Wcisniety -> jasny klawisz, ciemny napis
                    d.drawRBox(x + 1, y, CELL_W - 2, CELL_H - 1, 2);
                    d.setDrawColor(0);
                } else {
                    d.drawRFrame(x + 1, y, CELL_W - 2, CELL_H - 1, 2);
                    if (seen[k]) d.drawBox(x + 4, y + 3, 3, 3);   // juz sprawdzony
                }

                const char* label = kalkKeyLabel((KalkKey)k);
                int tw = d.getStrWidth(label);
                d.drawStr(x + (CELL_W - tw) / 2, y + CELL_H - 2, label);
                d.setDrawColor(1);
            }
        }

        // Wolne pola: licznik sprawdzonych (lewy gorny), wyjscie (prawy dolny)
        char cnt[8];
        snprintf(cnt, sizeof(cnt), "%d/%d", seenCount, (int)KEY_COUNT - 1);
        d.drawStr((CELL_W - d.getStrWidth(cnt)) / 2, CELL_H - 2, cnt);
        d.setFont(u8g2_font_4x6_tf);
        const char* ex = _setTxtExit();
        if (d.getStrWidth(ex) > CELL_W - 2) ex = "C/CE";
        d.drawStr(4 * CELL_W + (CELL_W - d.getStrWidth(ex)) / 2, 5 * CELL_H + CELL_H - 3, ex);
        d.sendBuffer();

        // Wyjscie: dluzsze przytrzymanie LEFT (BTN_LEFT to KEY_4 / KEY_PLUSMINUS,
        // co jest klawiszem testowanym) — uzywamy CCE jako exit.
        if (inputKeyConsume(KEY_CCE)) {
            _setWaitRelease();
            return;
        }
        delay(15);
    }
}

// Rzad 10 "chipow" pinow klawiatury MCP (A0..B4) w y..y+9; on[i] = jasny.
static void _setPinChips(U8G2 &d, int y, const bool* on) {
    d.setFont(UI_FONT_SMALL);
    for (uint8_t i = 0; i < 10; i++) {
        const int x = 4 + i * 25, w = 22;
        const char* lab = kalkPinLabel(i) + 2;   // "GPA0" -> "A0"
        d.setDrawColor(1);
        if (on[i]) {
            d.drawRBox(x, y, w, 10, 2);
            d.setDrawColor(0);
        } else {
            d.drawRFrame(x, y, w, 10, 2);
        }
        d.drawStr(x + (w - d.getStrWidth(lab)) / 2, y + 8, lab);
        d.setDrawColor(1);
    }
}

// ---------------------------------------------------------------------------
// Pin Driver Test — ustawia po kolei kazdy z 10 pinow MCP jako OUTPUT LOW
// na 2s. User multimetrem sprawdza fizycznie czy pin idzie do GND.
// Jesli nie — uszkodzony pin chipa lub cold solder.
// ---------------------------------------------------------------------------
static void _editPinDriver(U8G2 &d) {
    _setWaitRelease();
    static const uint8_t KB_PINS[10] = { 0, 1, 2, 3, 4, 8, 9, 10, 11, 12 };
    static const char* NAMES[10] = {
        "GPA0","GPA1","GPA2","GPA3","GPA4","GPB0","GPB1","GPB2","GPB3","GPB4"
    };

    int idx = 0;
    bool dirty = true;
    while (true) {
        if (_panicRequested) return;

        if (dirty) {
            // Wszystkie INPUT_PULLUP, wybrany OUTPUT LOW
            for (int i = 0; i < 10; i++) {
                _inMcp.pinMode(KB_PINS[i], INPUT_PULLUP);
            }
            _inMcp.pinMode(KB_PINS[idx], OUTPUT);
            _inMcp.digitalWrite(KB_PINS[idx], LOW);

            d.clearBuffer();
            uiHeaderCount(d, _setItemLabel(_SET_PINDRIVER), false, idx, 10);
            bool on[10] = {false};
            on[idx] = true;
            _setPinChips(d, 15, on);
            d.setFont(UI_FONT_BIG);
            uiCenter(d, 42, NAMES[idx]);
            d.setFont(UI_FONT_SMALL);
            uiCenter(d, 51, T("Multimetr na ten pin MCP -> 0V", "Multimeter on this MCP pin -> 0V",
                              "Multimeter an diesen MCP-Pin -> 0V", "Multimetr na tento pin MCP -> 0V"));
            uiFooter(d, T("^/v zmien", "^/v change", "^/v aendern", "^/v zmenit"), _setTxtExit());
            d.sendBuffer();
            dirty = false;
        }

        if (_setBtn(BTN_UP)) {
            if (idx > 0) { idx--; dirty = true; }
        }
        if (_setBtn(BTN_DOWN)) {
            if (idx < 9) { idx++; dirty = true; }
        }
        if (inputKeyConsume(KEY_CCE)) {
            // Przywroc wszystkie INPUT_PULLUP zeby skaner dalej dzialal
            for (int i = 0; i < 10; i++) {
                _inMcp.pinMode(KB_PINS[i], INPUT_PULLUP);
            }
            _setWaitRelease();
            return;
        }
        delay(20);
    }
}

// ---------------------------------------------------------------------------
// Skaner par MCP23017 — pokazuje wszystkie aktualnie zwarte pary pinow
// (debug niedzialajacych klawiszy)
// ---------------------------------------------------------------------------
static void _editKeyScan(U8G2 &d) {
    _setWaitRelease();

    while (true) {
        if (_panicRequested) return;

        bool pairs[100];
        inputDebugRawScan(pairs);

        // Zbierz aktywne pary i flagi pinow
        bool pinActive[10] = {false};
        int activeCount = 0;
        struct ActivePair { uint8_t i, j; };
        ActivePair active[10];
        for (uint8_t i = 0; i < 10; i++) {
            for (uint8_t j = i + 1; j < 10; j++) {
                if (pairs[i * 10 + j]) {
                    pinActive[i] = true;
                    pinActive[j] = true;
                    if (activeCount < 10) {
                        active[activeCount++] = {i, j};
                    }
                }
            }
        }

        d.clearBuffer();
        char hdr[24];
        snprintf(hdr, sizeof(hdr), T("Zwarte: %d", "Shorted: %d", "Kurzschluss: %d", "Zkrat: %d"), activeCount);
        uiHeader(d, _setItemLabel(_SET_KEYSCAN), false, hdr);

        // Pasek pinow GPA0..GPB4 (10 pinow), aktywne na jasno
        _setPinChips(d, 15, pinActive);

        // Aktywne pary: 3 kolumny x 2 wiersze
        d.setFont(UI_FONT_SMALL);
        if (activeCount == 0) {
            uiCenter(d, 43, T("Nacisnij klawisz", "Press any key", "Taste druecken", "Stisknete klavesu"));
        }
        for (int k = 0; k < activeCount && k < 6; k++) {
            char line[24];
            if (k == 5 && activeCount > 6) {
                snprintf(line, sizeof(line), "+%d...", activeCount - 5);
            } else {
                snprintf(line, sizeof(line), "%s - %s",
                         kalkPinLabel(active[k].i), kalkPinLabel(active[k].j));
            }
            d.drawStr(4 + (k % 3) * 84, 38 + (k / 3) * 10, line);
        }

        uiFooter(d, _setTxtExit(), nullptr);
        d.sendBuffer();

        if (inputKeyConsume(KEY_CCE)) {
            _setWaitRelease();
            return;
        }
        delay(50);
    }
}

// ---------------------------------------------------------------------------
// Reset fabryczny — wspolna implementacja w factory_reset.h (ta sama co
// ratunkowe przytrzymanie C/CE 5 s w kalkulatorze). Co znika i co zostaje:
// patrz naglowek factory_reset.h. Po potwierdzeniu: ESP.restart().
// ---------------------------------------------------------------------------
static void _editFactoryReset(U8G2 &d) {
    _setWaitRelease();
    factoryResetRun(d, /*honorPanic=*/true);   // wraca tylko po anulowaniu
    _setWaitRelease();
}

// ---------------------------------------------------------------------------
// Kolejka offline — podglad liczby zadan + wyczyszczenie (np. gdy zadanie
// w kolejce ciagle sie nie wysyla, a uczen nie chce czekac na 3 proby).
// Ekran rysowany raz (nic sie na nim nie zmienia).
// ---------------------------------------------------------------------------
static void _editOfflineQueue(U8G2 &d) {
    _setWaitRelease();
    uint8_t n = offlineQueueCount();
    const char* title = _setItemLabel(_SET_OQCLEAR);

    d.clearBuffer();
    uiHeader(d, title, true);
    char line[48];
    snprintf(line, sizeof(line), T("Zadan w kolejce: %u", "Queued tasks: %u", "Aufgaben in Warteschl.: %u", "Uloh ve fronte: %u"), (unsigned)n);
    if (n > 0) {
        // Dialog jak uiConfirm: ostrzezenie + przyciski
        d.setFont(UI_FONT);
        _setIconLine(d, 27, UI_ICO_WARN, line);
        d.setFont(UI_FONT_SMALL);
        uiCenter(d, 39, T("Niewyslane zadania przepadna.", "Unsent tasks will be lost.", "Ungesendete Aufgaben gehen verloren.", "Neodeslane ulohy budou ztraceny."));
        _frDrawButtons(d, 60, _setTxtCancel(), T("OK wyczysc", "OK clear", "OK leeren", "OK vymazat"));
    } else {
        d.setFont(UI_FONT);
        _setIconLine(d, 33, UI_ICO_CHECK, T("Kolejka jest pusta.", "Queue is empty.", "Warteschlange ist leer.", "Fronta je prazdna."));
        uiFooter(d, _setTxtBack(), nullptr);
    }
    d.sendBuffer();

    while (true) {
        if (_panicRequested) return;
        if (_setBtn(BTN_OK)) {
            if (n > 0) {
                offlineQueueClear();
                uiMessage(d, title, UI_ICO_CHECK,
                          T("Kolejka wyczyszczona", "Queue cleared", "Warteschlange geleert", "Fronta vymazana"));
                delay(1200);
            }
            _setWaitRelease();
            return;
        }
        if (_setBtn(BTN_LEFT) || inputKeyConsume(KEY_CCE)) { _setWaitRelease(); return; }
        delay(20);
    }
}

// Zywy podglad (mono viewfinder) w tescie kamery — ta sama technika co
// _solPreviewAndConfirm w solve_screen.h (dithering ordered-Bayer 4x4 z
// GRAYSCALE QQVGA na 1-bit XBM), ale samodzielna kopia: settings_screen.h
// jest includowany w main.cpp PRZED solve_screen.h, wiec nie moze wywolac
// jego funkcji statycznych. Kamera musi juz byc w trybie camBeginPreview().
// Zwraca: 1 = user wcisnal OK (chce JPEG zdjecie), 0 = wyjscie (< / CCE),
// -1 = panic.
static int _setCamPreviewLoop(U8G2 &d, uint32_t shotCount, uint32_t lastSize, int lastW, int lastH) {
    static const int PV_W = 160, PV_H = 64;
    static const int XBM_STRIDE = (PV_W + 7) / 8;
    static uint8_t xbm[XBM_STRIDE * PV_H];
    static const uint8_t bayer4[4][4] = {
        {  0,  8,  2, 10},
        { 12,  4, 14,  6},
        {  3, 11,  1,  9},
        { 15,  7, 13,  5}
    };
    static float sharpMax = 1.0f;

    _setWaitRelease();
    while (true) {
        if (_panicRequested) return -1;

        camera_fb_t* fb = esp_camera_fb_get();
        if (!fb) { delay(10); continue; }

        const int sw = fb->width, sh = fb->height;
        if (sw < PV_W || sh < PV_H || !fb->buf) {
            esp_camera_fb_return(fb);
            delay(10);
            continue;
        }
        const int row0 = (sh - PV_H) / 2;

        uint32_t sharp = 0;
        memset(xbm, 0, sizeof(xbm));
        for (int y = 0; y < PV_H; y++) {
            const uint8_t* row  = fb->buf + (size_t)(row0 + y) * sw;
            uint8_t*       xrow = xbm + (size_t)y * XBM_STRIDE;
            const uint8_t* brow = bayer4[y & 3];
            for (int x = 0; x < PV_W; x++) {
                uint8_t thr = (uint8_t)(brow[x & 3] * 16);
                if (row[x] > thr) xrow[x >> 3] |= (1 << (x & 7));
                if (x + 1 < PV_W) {
                    int g = (int)row[x] - (int)row[x + 1];
                    sharp += (g < 0 ? -g : g);
                }
            }
        }
        esp_camera_fb_return(fb);

        float sf = (float)sharp;
        if (sf > sharpMax) sharpMax = sf;
        else               sharpMax = sharpMax * 0.97f + sf * 0.03f;
        int pct = (sharpMax > 1.0f) ? (int)(sf * 100.0f / sharpMax) : 0;
        if (pct > 100) pct = 100;

        d.clearBuffer();
        d.drawXBM(0, 0, PV_W, PV_H, xbm);
        d.drawFrame(0, 0, PV_W, PV_H);

        // Prawy panel (x 164..255): tytul, ostrosc (pasek), ostatnie zdjecie
        const int PX = 164;
        d.setFont(UI_FONT_SMALL);
        d.drawStr(PX + 2, 8, _setItemLabel(_SET_CAMTEST));
        d.drawHLine(PX, 11, UI_W - PX);
        char buf[32];
        d.drawStr(PX + 2, 21, T("Ostrosc", "Sharp", "Schaerfe", "Ostrost"));
        snprintf(buf, sizeof(buf), "%d%%", pct);
        d.drawStr(UI_W - 2 - d.getStrWidth(buf), 21, buf);
        uiProgress(d, PX + 1, 24, UI_W - PX - 2, pct);
        d.setFont(UI_FONT_SMALL);
        if (shotCount > 0) {
            snprintf(buf, sizeof(buf), "#%lu  %dx%d", (unsigned long)shotCount, lastW, lastH);
            d.drawStr(PX + 2, 39, buf);
            snprintf(buf, sizeof(buf), "JPEG %lu KB", (unsigned long)(lastSize / 1024));
            d.drawStr(PX + 2, 47, buf);
        } else {
            d.drawStr(PX + 2, 39, T("Brak zdjec", "No shots", "Kein Foto", "Zadne foto"));
        }
        _setPanelHints(d, PX, _setTxtExit(), T("OK zdjecie", "OK photo", "OK Foto", "OK foto"));
        d.sendBuffer();

        for (int k = 0; k < 3; k++) {
            if (inputBtn(BTN_OK)   == LOW) { _setWaitRelease(); return 1; }
            if (inputKeyConsume(KEY_CCE) || inputBtn(BTN_LEFT) == LOW) { _setWaitRelease(); return 0; }
            delay(35);
        }
    }
}

// Test kamery — zywy podglad (GRAYSCALE QQVGA) caly czas, OK robi realne
// zdjecie JPEG (pelna rozdzielczosc UXGA, ten sam tryb co w rozwiazywaniu
// zadania) i pokazuje jego rozmiar/rozdzielczosc, po czym wraca do
// podgladu. CCE/< = wyjscie (deinit + power off).
static void _editCamTest(U8G2 &d) {
    _SetNoSleepGuard noSleep;   // kamera pracuje — bez auto-sleep na tym ekranie
    _setWaitRelease();

    uint32_t shotCount = 0, lastSize = 0;
    int lastW = 0, lastH = 0;
    const char* title = _setItemLabel(_SET_CAMTEST);

    while (true) {
        _setBusy(d, title, T("Uruchamiam podglad...", "Starting preview...", "Starte Vorschau...", "Spoustim nahled..."));

        if (!camBeginPreview()) {
            uiMessage(d, title, UI_ICO_WARN,
                      T("Kamera nie odpowiada", "Camera not responding", "Kamera antwortet nicht", "Kamera neodpovida"),
                      T("Init NIEUDANY", "Init FAILED", "Init FEHLGESCHLAGEN", "Init SELHAL"), nullptr,
                      _setTxtBack());
            _setWaitRelease();
            while (true) {
                if (_panicRequested) return;
                if (_setBtn(BTN_LEFT) || inputKeyConsume(KEY_CCE)) { _setWaitRelease(); return; }
                delay(20);
            }
        }

        int r = _setCamPreviewLoop(d, shotCount, lastSize, lastW, lastH);
        camEnd();   // KONIECZNE przed przelaczeniem na JPEG albo wyjsciem

        if (r <= 0) return;   // 0 = wyjscie, -1 = panic

        // === OK: realne zdjecie JPEG/UXGA (ten sam tryb co w rozwiazywaniu zadania) ===
        _setBusy(d, title, T("Robie zdjecie...", "Capturing...", "Aufnahme laeuft...", "Fotim..."));

        if (camBegin()) {
            camWarmup(2);
            camera_fb_t* fb = camCapture();
            if (fb) {
                shotCount++;
                lastSize = fb->len;
                lastW = fb->width;
                lastH = fb->height;
                Serial.printf("[CAM] frame %lu: %dx%d, %lu B\n",
                              (unsigned long)shotCount, lastW, lastH,
                              (unsigned long)lastSize);
                esp_camera_fb_return(fb);
            } else {
                Serial.println("[CAM] capture FAILED");
            }
        } else {
            Serial.println("[CAM] camBegin (JPEG) FAILED");
        }
        camEnd();   // wracamy do petli -> camBeginPreview() od nowa
    }
}

// ---------------------------------------------------------------------------
// Ekran szczegolow baterii: duzy procent + pasek z lewej, wiersze
// (napiecie, status, USB, zrodlo pomiaru) z prawej.
// Odswiezany ~co 500ms (ADC cache w battery.h przepuszcza tylko raz na 5s).
// ---------------------------------------------------------------------------
static void _setBatRow(U8G2 &d, int y, const char* label, const char* value) {
    const int X0 = 124, XR = 250;
    d.setFont(UI_FONT);
    d.drawStr(X0, y, label);
    char v[24];
    snprintf(v, sizeof(v), "%s", value);
    if (X0 + d.getStrWidth(label) + 6 + d.getStrWidth(v) > XR) d.setFont(UI_FONT_SMALL);
    d.drawStr(XR - d.getStrWidth(v), y, v);
    d.setFont(UI_FONT);
}

static void _editBattery(U8G2 &d) {
    _setWaitRelease();
    while (true) {
        if (_panicRequested) return;

        d.clearBuffer();
        uiHeader(d, _setItemLabel(_SET_BATTERY), true);

        if (!batteryIsAvailable()) {
            d.setFont(UI_FONT);
            _setIconLine(d, 40, UI_ICO_WARN, T("Brak czujnika", "No sensor", "Kein Sensor", "Chybi senzor"));
        } else {
            uint16_t mv   = batteryReadMillivolts();
            uint8_t  pct  = batteryReadPercent();
            bool     chg  = batteryIsCharging();
            bool     full = batteryIsChargeComplete();
            bool     usb  = batteryIsUsbPresent();

            // Lewa kolumna (0..115): duzy procent + bateria
            char buf[24];
            snprintf(buf, sizeof(buf), "%u%%", (unsigned)pct);
            d.setFont(UI_FONT_BIG);
            d.drawStr((116 - d.getStrWidth(buf)) / 2, 36, buf);
            const int BX = 16, BY = 42, BW = 80, BH = 12;
            d.drawRFrame(BX, BY, BW, BH, 2);
            d.drawBox(BX + BW, BY + 3, 3, BH - 6);
            int fillW = ((BW - 4) * pct) / 100;
            if (fillW > 0) d.drawBox(BX + 2, BY + 2, fillW, BH - 4);
            if (chg) {
                // Blyskawica na srodku paska (kolor odwrotny do tla)
                static const uint8_t BOLT[8] = {0x30, 0x18, 0x0C, 0x1E, 0x0C, 0x06, 0x03, 0x00};
                d.setBitmapMode(1);
                d.setDrawColor(2);
                d.drawXBM(BX + BW / 2 - 4, BY + 2, 8, 8, BOLT);
                d.setDrawColor(1);
                d.setBitmapMode(0);
            }
            d.drawVLine(118, 16, 46);

            // Prawa kolumna: wiersze nazwa / wartosc
            snprintf(buf, sizeof(buf), "%u.%02u V", mv / 1000, (mv % 1000) / 10);
            _setBatRow(d, 24, T("Napiecie", "Voltage", "Spannung", "Napeti"), buf);
            _setBatRow(d, 36, T("Status", "Status", "Status", "Stav"),
                       chg  ? T("LADOWANIE", "CHARGING", "LADEN", "NABIJENI")
                     : full ? T("NALADOWANA", "FULL", "VOLL", "NABITO")
                            : (batteryIsLow() ? T("NISKI", "LOW", "NIEDRIG", "NIZKA") : T("OK", "OK", "OK", "OK")));
            _setBatRow(d, 48, T("USB podlaczone", "USB connected", "USB verbunden", "USB pripojeno"),
                       usb ? T("tak", "yes", "ja", "ano") : T("nie", "no", "nein", "ne"));
            // Zrodlo pomiaru: "MAX17048" (fuel gauge) albo "ADC" (dzielnik).
            _setBatRow(d, 60, T("Pomiar", "Gauge", "Messung", "Mereni"), batterySourceName());
        }
        d.sendBuffer();

        // Wyjscie
        uint32_t t0 = millis();
        while (millis() - t0 < 500) {
            if (_setBtn(BTN_OK) || _setBtn(BTN_LEFT) || inputKeyConsume(KEY_CCE)) {
                _setWaitRelease();
                return;
            }
            delay(20);
        }
    }
}

// ---------------------------------------------------------------------------
// Ustawienia -> Informacje -> O urzadzeniu: dane sprzetu i stan na zywo
// (lista nazwa/wartosc jak w telefonie, odswiezana co 0,5 s).
// ---------------------------------------------------------------------------
#define _SET_DI_ROWS 14

static void _setDevInfoRow(int i, const char** label, char* v, size_t n) {
    v[0] = '\0';
    switch (i) {
        case 0: *label = T("Model", "Model", "Modell", "Model"); snprintf(v, n, "KalkMate (PCB v4)"); break;
        case 1: *label = T("Firmware", "Firmware", "Firmware", "Firmware"); snprintf(v, n, "v%s", FW_VERSION); break;
        case 2: {
            *label = T("Device ID", "Device ID", "Geraete-ID", "ID zarizeni");
            uint8_t mac[6];
            esp_read_mac(mac, ESP_MAC_WIFI_STA);
            snprintf(v, n, "%02X%02X%02X%02X%02X%02X", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
            break;
        }
        case 3: *label = T("Jezyk", "Language", "Sprache", "Jazyk"); snprintf(v, n, "%s", _setLangName()); break;
        case 4: *label = T("WiFi", "WiFi", "WLAN", "WiFi");
            if (WiFi.status() == WL_CONNECTED) snprintf(v, n, "%s", WiFi.SSID().c_str());
            else snprintf(v, n, "%s", T("rozlaczone", "disconnected", "getrennt", "odpojeno"));
            break;
        case 5: *label = T("Adres IP", "IP address", "IP-Adresse", "IP adresa");
            if (WiFi.status() == WL_CONNECTED) snprintf(v, n, "%s", WiFi.localIP().toString().c_str());
            else snprintf(v, n, "-");
            break;
        case 6: *label = T("Sygnal WiFi", "WiFi signal", "WLAN-Signal", "Signal WiFi");
            if (WiFi.status() == WL_CONNECTED) snprintf(v, n, "%d dBm", (int)WiFi.RSSI());
            else snprintf(v, n, "-");
            break;
        case 7: *label = T("Bateria", "Battery", "Akku", "Baterie");
            if (batteryIsAvailable())
                snprintf(v, n, "%u%%  %u.%02u V", (unsigned)batteryReadPercent(),
                         batteryReadMillivolts() / 1000, (batteryReadMillivolts() % 1000) / 10);
            else snprintf(v, n, "-");
            break;
        case 8: *label = T("USB podlaczone", "USB connected", "USB verbunden", "USB pripojeno");
            if (!batteryIsUsbPresent()) snprintf(v, n, "%s", T("nie", "no", "nein", "ne"));
            else if (batteryIsCharging()) snprintf(v, n, "%s", T("ladowanie", "charging", "laedt", "nabiji"));
            else snprintf(v, n, "%s", T("tak", "yes", "ja", "ano"));
            break;
        case 9: *label = T("Procesor", "Processor", "Prozessor", "Procesor");
            snprintf(v, n, "%s rev %d", ESP.getChipModel(), (int)ESP.getChipRevision());
            break;
        case 10: *label = T("Pamiec flash", "Flash memory", "Flash-Speicher", "Pamet flash");
            snprintf(v, n, "%u MB", (unsigned)(ESP.getFlashChipSize() / (1024 * 1024)));
            break;
        case 11: *label = T("PSRAM (wolne)", "PSRAM (free)", "PSRAM (frei)", "PSRAM (volne)");
            snprintf(v, n, "%u / %u KB", (unsigned)(ESP.getFreePsram() / 1024), (unsigned)(ESP.getPsramSize() / 1024));
            break;
        case 12: *label = T("RAM (wolne)", "RAM (free)", "RAM (frei)", "RAM (volne)");
            snprintf(v, n, "%u KB", (unsigned)(ESP.getFreeHeap() / 1024));
            break;
        default: {
            *label = T("Czas pracy", "Uptime", "Laufzeit", "Doba behu");
            unsigned long s = millis() / 1000;
            snprintf(v, n, "%lu:%02lu:%02lu", s / 3600, (s / 60) % 60, s % 60);
            break;
        }
    }
}

static void _editDeviceInfo(U8G2 &d) {
    _setWaitRelease();
    int cursor = 0, scroll = 0;
    unsigned long lastDraw = 0;
    bool dirty = true;
    while (true) {
        if (_panicRequested) return;
        if (dirty || millis() - lastDraw > 500) {
            d.clearBuffer();
            _setDrawHeader(d, _setItemLabel(_SET_DEVINFO), true, cursor, _SET_DI_ROWS);
            char v[40];
            const char* label = "";
            for (int r = 0; r < _SET_VISIBLE; r++) {
                int i = scroll + r;
                if (i >= _SET_DI_ROWS) break;
                _setDevInfoRow(i, &label, v, sizeof(v));
                _setDrawRow(d, r, i == cursor, nullptr, label, v, false, -1);
            }
            _setDrawScrollbar(d, scroll, _SET_DI_ROWS);
            d.sendBuffer();
            lastDraw = millis();
            dirty = false;
        }
        if (_setBtn(BTN_UP)) {
            cursor = (cursor > 0) ? cursor - 1 : _SET_DI_ROWS - 1;
            dirty = true;
        } else if (_setBtn(BTN_DOWN)) {
            cursor = (cursor < _SET_DI_ROWS - 1) ? cursor + 1 : 0;
            dirty = true;
        } else if (_setBtn(BTN_LEFT) || inputKeyConsume(KEY_CCE)) {
            _setWaitRelease();
            return;
        }
        _setFitScroll(cursor, _SET_DI_ROWS, scroll);
        delay(20);
    }
}

// ---------------------------------------------------------------------------
// Publiczna funkcja — glowny punkt wejscia
// ---------------------------------------------------------------------------
static void _setOpenItem(U8G2 &display, int id) {
    switch (id) {
        case _SET_BRIGHTNESS: _editBrightness(display); break;
        case _SET_ROTATION:   _editRotation(display);   break;
        case _SET_CAMERA:     _editCameraTuning(display); break;
        case _SET_LANGUAGE:   _editLanguage(display);   break;
        case _SET_REMOTE:     _editRemoteHelp(display); break;
        case _SET_SOLVEMODE:  _editSolveMode(display);  break;
        case _SET_AUTOSLEEP:  _editAutoSleep(display);  break;
        case _SET_AICODE:     _editAiCode(display);     break;
        case _SET_PANICKEY:   _editPanicKey(display);   break;
        case _SET_UPDATE:     _editUpdate(display);     break;
        case _SET_FACTORY:    _editFactoryReset(display); break;
        case _SET_OQCLEAR:    _editOfflineQueue(display); break;
        case _SET_DEVICEID:   showDeviceIdQrScreen(display); break;
        case _SET_WIFI:       showWifiSettings(display); break;
        case _SET_SCREENTEST: showScreenTest(display);  break;
        case _SET_CAMTEST:    _editCamTest(display);    break;
        case _SET_KEYTEST:    _editKeyTest(display);    break;
        case _SET_KEYSCAN:    _editKeyScan(display);    break;
        case _SET_PINDRIVER:  _editPinDriver(display);  break;
        case _SET_ACCOUNT:    showAccountStatusScreen(display); break;
        case _SET_BATTERY:    _editBattery(display);    break;
        case _SET_DEVINFO:    _editDeviceInfo(display); break;
        case _SET_HELP:       showInfo(display);        break;
        case _SET_ABOUT:      showAboutScreen(display); break;
    }
    _setWaitRelease();
}

// Lista pozycji jednej kategorii. Wraca (LEFT) do listy kategorii.
static void _setRunCategory(U8G2 &display, int cat) {
    const _SetCategory &C = _SET_CATS[cat];
    int cursor = 0, scroll = 0;
    while (true) {
        if (_panicRequested) return;
        _drawSettingsItems(display, cat, cursor, scroll);

        if (_setBtn(BTN_UP)) {
            cursor = (cursor > 0) ? cursor - 1 : C.count - 1;   // zawijanie jak w telefonie
        } else if (_setBtn(BTN_DOWN)) {
            cursor = (cursor < C.count - 1) ? cursor + 1 : 0;
        } else if (_setBtn(BTN_LEFT)) {
            _setWaitRelease();
            return;
        } else if (_setBtn(BTN_OK) || _setBtn(BTN_RIGHT)) {
            _setWaitRelease();
            _setOpenItem(display, C.items[cursor]);
        }
        _setFitScroll(cursor, C.count, scroll);
        delay(20);
    }
}

void showSettings(U8G2 &display) {
    _setWaitRelease();
    _setRefreshSummary();

    int cursor = 0, scroll = 0;
    while (true) {
        if (_panicRequested) return;
        _drawSettingsCategories(display, cursor, scroll);

        if (_setBtn(BTN_UP)) {
            cursor = (cursor > 0) ? cursor - 1 : _SET_CAT_COUNT - 1;
        } else if (_setBtn(BTN_DOWN)) {
            cursor = (cursor < _SET_CAT_COUNT - 1) ? cursor + 1 : 0;
        } else if (_setBtn(BTN_LEFT)) {
            // Powrot do menu glownego
            _setWaitRelease();
            return;
        } else if (_setBtn(BTN_OK) || _setBtn(BTN_RIGHT)) {
            _setWaitRelease();
            // Kategoria z jedna pozycja (Jezyk, Bateria) — od razu jej ekran.
            if (_SET_CATS[cursor].count == 1) _setOpenItem(display, _SET_CATS[cursor].items[0]);
            else                              _setRunCategory(display, cursor);
            _setRefreshSummary();
        }
        _setFitScroll(cursor, _SET_CAT_COUNT, scroll);
        delay(20);
    }
}
