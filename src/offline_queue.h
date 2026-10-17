#pragma once
// =====================================================================
//  offline_queue.h — kolejka zadan do ponowienia (metadane NVS + tresc SPIFFS)
//
//  Przechowuje zadania, ktorych nie udalo sie wyslac (brak WiFi, blad
//  transportu, HTTP 5xx, 429), i ponawia je przy nastepnym wejsciu
//  w "Rozwiaz zadanie" (solve_screen.h: _solProcessQueue). Bledy trwale
//  (4xx: brak tokenow, licencja, za duze...) NIE trafiaja do kolejki.
//
//  NVS "kalkoq" — od v2 tylko male metadane (tresc NIE lezy w NVS, ktory
//  ma ~20 KB i trzyma tez kod AI oraz dev_token):
//    "v"     — wersja formatu (2)
//    "count" — liczba zadan (0.._OQ_MAX)
//    "gen"   — licznik do unikalnych nazw plikow
//    "tN"    — typ (0 = tekst, 1 = zdjecie)
//    "qN"    — sciezka pliku SPIFFS z trescia (/oqXX.txt albo /oqXX.jpg)
//    "rN"    — x-request-id (16 hex). TO SAMO przy kazdej probie — serwer
//              w ciagu ~20 min zwraca zapisany wynik zamiast liczyc (i
//              pobierac tokeny) drugi raz.
//    "aN"    — liczba nieudanych prob (po _OQ_MAX_ATTEMPTS pozycja usuwana)
//  Format v1 (fw <= 1.9.7): "qN" dla tekstu trzymal cala tresc w NVS —
//  migrowany jednorazowo do pliku przy pierwszym dostepie (_oqMigrate).
//
//  API:
//    offlineMakeRequestId(buf17)               — nowy losowy x-request-id
//    offlineQueueCount()                       — ile zadan czeka
//    offlineQueueAddText(text, rid, attempts)  — dodaj tekst   -> OQ_ADDED/OQ_FULL/OQ_ERROR
//    offlineQueueAddPhoto(buf, len, rid, att)  — dodaj zdjecie -> OQ_ADDED/OQ_FULL/OQ_ERROR
//    offlineQueuePeek(idx, task)               — podglad (tekst wczytany z pliku)
//    offlineQueueBumpAttempts()                — +1 proba dla pierwszej pozycji
//    offlineQueueRemoveFirst()                 — usun pierwsze zadanie (FIFO)
//    offlineQueueClear()                       — wyczysc wszystko
// =====================================================================

#include <Arduino.h>
#include <Preferences.h>
#include <SPIFFS.h>
#include <esp_system.h>   // esp_random

#define _OQ_NS            "kalkoq"
#define _OQ_MAX           3          // max zadan w kolejce
#define _OQ_MAX_ATTEMPTS  3          // nieudanych prob, po ktorych pozycja jest usuwana
#define _OQ_TEXT_MAX      2048       // max bajtow tekstu zadania (UTF-8)

enum OqAddResult : uint8_t { OQ_ADDED = 0, OQ_FULL = 1, OQ_ERROR = 2 };

struct OfflineTask {
    uint8_t type;      // 0 = text, 1 = photo
    String  text;      // tresc dla type==0 (wczytana z pliku)
    String  path;      // sciezka pliku SPIFFS (oba typy)
    String  reqId;     // x-request-id
    uint8_t attempts;  // nieudane proby do tej pory
};

// Nowy x-request-id: 16 znakow hex (serwer przyjmuje 8-64 znaki [A-Za-z0-9_-]).
inline void offlineMakeRequestId(char* out /* min. 17 B */) {
    uint32_t a = esp_random(), b = esp_random();
    snprintf(out, 17, "%08lx%08lx", (unsigned long)a, (unsigned long)b);
}

static void _oqKey(char* buf, size_t sz, char prefix, uint8_t idx) {
    snprintf(buf, sz, "%c%u", prefix, (unsigned)idx);
}

static String _oqUtf8Cut(const String& s, size_t maxBytes) {
    if (s.length() <= maxBytes) return s;
    size_t cut = maxBytes;
    while (cut > 0 && (((uint8_t)s[cut]) & 0xC0) == 0x80) cut--;
    return s.substring(0, cut);
}

// Normalnie SPIFFS jest juz zamontowany przez _solEnsureFs() (solve_screen.h,
// raz na boot, z ekranem formatowania). Ale zaobserwowano w logu zdalnym
// przypadek gdzie SPIFFS.begin(false) tu failowal mimo to (mount failed,
// -10025) — bez wlasnego fallbacku kolejka offline byla trwale niedostepna
// na reszte sesji (zdjecie po nieudanym DNS po prostu przepadalo, zamiast
// trafic do retry). Jeden dodatkowy, samodzielny format+mount jako ostatnia
// szansa — SPIFFS.begin(true) jest no-op gdy juz zamontowane poprawnie.
static bool _oqFormatTried = false;
static inline bool _oqFsReady() {
    if (SPIFFS.begin(false)) return true;
    if (_oqFormatTried) return false;
    _oqFormatTried = true;
    Serial.println("[OQ] mount nieudany, probuje format (ostatnia szansa)...");
    bool ok = SPIFFS.begin(true);
    Serial.printf("[OQ] format: %s\n", ok ? "OK" : "BLAD");
    return ok;
}

// Wolna nazwa pliku /oqNN.<ext> (licznik "gen" w NVS). false = brak.
static bool _oqNewPath(Preferences& p, const char* ext, char* path, size_t sz) {
    uint8_t gen = p.getUChar("gen", 0);
    for (int i = 0; i < 100; i++) {
        snprintf(path, sz, "/oq%02u.%s", (unsigned)(gen % 100), ext);
        gen++;
        if (!SPIFFS.exists(path)) {
            p.putUChar("gen", gen);
            return true;
        }
    }
    return false;
}

// Dopisuje metadane na koniec kolejki. Plik musi juz istniec.
static uint8_t _oqAppendMeta(Preferences& p, uint8_t type, const char* path,
                             const char* rid, uint8_t attempts) {
    uint8_t n = p.getUChar("count", 0);
    if (n > _OQ_MAX) n = 0;
    if (n >= _OQ_MAX) return OQ_FULL;
    char tk[6], qk[6], rk[6], ak[6];
    _oqKey(tk, sizeof(tk), 't', n);
    _oqKey(qk, sizeof(qk), 'q', n);
    _oqKey(rk, sizeof(rk), 'r', n);
    _oqKey(ak, sizeof(ak), 'a', n);
    bool ok = p.putUChar(tk, type) == 1;
    ok = ok && p.putString(qk, path) == strlen(path);
    ok = ok && p.putString(rk, rid) == strlen(rid);
    ok = ok && p.putUChar(ak, attempts) == 1;
    ok = ok && p.putUChar("count", n + 1) == 1;
    if (!ok) {
        Serial.println("[OQ] BLAD zapisu metadanych NVS");
        // count nie zostal podbity (albo sie nie zapisal) — slot n niewazny
        return OQ_ERROR;
    }
    return OQ_ADDED;
}

static bool _oqWriteFile(const char* path, const uint8_t* buf, size_t len) {
    File f = SPIFFS.open(path, "w");
    if (!f) { Serial.printf("[OQ] SPIFFS open failed: %s\n", path); return false; }
    size_t written = f.write(buf, len);
    f.close();
    if (written != len) {
        Serial.printf("[OQ] SPIFFS partial write %u/%u — abort\n", (unsigned)written, (unsigned)len);
        SPIFFS.remove(path);
        return false;
    }
    return true;
}

// Dodaje pozycje: tresc do pliku, potem metadane. Wspolne dla tekstu/zdjecia.
static uint8_t _oqAdd(uint8_t type, const uint8_t* buf, size_t len,
                      const char* rid, uint8_t attempts) {
    if (!_oqFsReady()) { Serial.println("[OQ] SPIFFS unavailable"); return OQ_ERROR; }
    Preferences p;
    if (!p.begin(_OQ_NS, false)) return OQ_ERROR;
    uint8_t n = p.getUChar("count", 0);
    if (n == _OQ_MAX) { p.end(); return OQ_FULL; }   // > _OQ_MAX = smieci, _oqAppendMeta zaczyna od 0
    char path[16];
    if (!_oqNewPath(p, type == 0 ? "txt" : "jpg", path, sizeof(path))) { p.end(); return OQ_ERROR; }
    if (!_oqWriteFile(path, buf, len)) { p.end(); return OQ_ERROR; }
    char ridBuf[17];
    if (!rid || !rid[0]) { offlineMakeRequestId(ridBuf); rid = ridBuf; }
    uint8_t r = _oqAppendMeta(p, type, path, rid, attempts);
    p.end();
    if (r != OQ_ADDED) SPIFFS.remove(path);
    else Serial.printf("[OQ] %s queued slot=%u path=%s size=%u\n",
                       type == 0 ? "text" : "photo", (unsigned)n, path, (unsigned)len);
    return r;
}

// Jednorazowa migracja v1 -> v2. Wymaga SPIFFS (zwraca false bez niego —
// stare pozycje zostaja nietkniete do nastepnej proby).
static bool _oqMigrate() {
    static bool done = false;
    if (done) return true;
    if (!_oqFsReady()) return false;
    Preferences p;
    if (!p.begin(_OQ_NS, false)) return false;
    if (p.getUChar("v", 1) >= 2) { p.end(); done = true; return true; }

    uint8_t n = p.getUChar("count", 0);
    if (n > _OQ_MAX) n = 0;
    uint8_t types[_OQ_MAX];
    String  vals[_OQ_MAX];
    for (uint8_t i = 0; i < n; i++) {
        char tk[6], qk[6];
        _oqKey(tk, sizeof(tk), 't', i);
        _oqKey(qk, sizeof(qk), 'q', i);
        types[i] = p.getUChar(tk, 0);
        vals[i]  = p.isKey(qk) ? p.getString(qk, "") : String("");
    }
    uint8_t gen = p.getUChar("gen", 0);
    p.clear();                       // zwalnia tez duze teksty v1 z NVS
    p.putUChar("gen", gen);
    p.putUChar("count", 0);
    p.putUChar("v", 2);

    int kept = 0;
    for (uint8_t i = 0; i < n; i++) {
        char rid[17];
        offlineMakeRequestId(rid);
        if (types[i] == 0) {
            if (vals[i].length() == 0) continue;
            String t = _oqUtf8Cut(vals[i], _OQ_TEXT_MAX);
            char path[16];
            if (_oqNewPath(p, "txt", path, sizeof(path)) &&
                _oqWriteFile(path, (const uint8_t*)t.c_str(), t.length())) {
                if (_oqAppendMeta(p, 0, path, rid, 0) == OQ_ADDED) kept++;
                else SPIFFS.remove(path);
            }
        } else {
            if (vals[i].startsWith("/oq") && SPIFFS.exists(vals[i]) &&
                _oqAppendMeta(p, 1, vals[i].c_str(), rid, 0) == OQ_ADDED) kept++;
        }
    }
    p.end();
    done = true;
    Serial.printf("[OQ] migracja v1 -> v2: %d/%u pozycji\n", kept, (unsigned)n);
    return true;
}

// Ilosc zadan w kolejce (0 gdy brak lub blad NVS)
inline uint8_t offlineQueueCount() {
    _oqMigrate();
    Preferences p;
    if (!p.begin(_OQ_NS, true)) return 0;   // namespace jeszcze nie istnieje
    uint8_t n = p.getUChar("count", 0);
    p.end();
    return (n <= _OQ_MAX) ? n : 0;
}

// Dodaj zadanie tekstowe (tresc na SPIFFS). rid = x-request-id uzyty przy
// pierwszej probie (pusty -> nowy). attempts = ile prob juz sie nie udalo.
inline uint8_t offlineQueueAddText(const char* text, const char* rid, uint8_t attempts) {
    if (!text || !text[0]) return OQ_ERROR;
    if (!_oqMigrate()) return OQ_ERROR;
    String t = _oqUtf8Cut(String(text), _OQ_TEXT_MAX);
    return _oqAdd(0, (const uint8_t*)t.c_str(), t.length(), rid, attempts);
}

// Dodaj zdjecie JPEG (kopiowane do SPIFFS od razu — bufor mozna zwolnic).
inline uint8_t offlineQueueAddPhoto(const uint8_t* jpegBuf, size_t jpegLen,
                                    const char* rid, uint8_t attempts) {
    if (!jpegBuf || jpegLen == 0) return OQ_ERROR;
    if (!_oqMigrate()) return OQ_ERROR;
    return _oqAdd(1, jpegBuf, jpegLen, rid, attempts);
}

// Odczytaj zadanie o indeksie idx (0-based) bez usuwania. Dla tekstu
// wczytuje tresc z pliku. false = poza zakresem / blad NVS / brak SPIFFS /
// brak lub uszkodzony plik.
inline bool offlineQueuePeek(uint8_t idx, OfflineTask& out) {
    if (!_oqMigrate()) return false;
    Preferences p;
    if (!p.begin(_OQ_NS, true)) return false;
    uint8_t n = p.getUChar("count", 0);
    if (idx >= n || n > _OQ_MAX) { p.end(); return false; }
    char tk[6], qk[6], rk[6], ak[6];
    _oqKey(tk, sizeof(tk), 't', idx);
    _oqKey(qk, sizeof(qk), 'q', idx);
    _oqKey(rk, sizeof(rk), 'r', idx);
    _oqKey(ak, sizeof(ak), 'a', idx);
    out.type     = p.getUChar(tk, 0);
    out.path     = p.isKey(qk) ? p.getString(qk, "") : String("");
    out.reqId    = p.isKey(rk) ? p.getString(rk, "") : String("");
    out.attempts = p.getUChar(ak, 0);
    out.text     = "";
    p.end();

    if (out.reqId.length() < 8) {   // nie powinno sie zdarzyc — awaryjnie nowe id
        char rid[17];
        offlineMakeRequestId(rid);
        out.reqId = rid;
    }
    if (out.path.length() == 0 || !SPIFFS.exists(out.path)) return false;
    if (out.type == 0) {
        File f = SPIFFS.open(out.path, "r");
        if (!f) return false;
        size_t sz = f.size();
        if (sz == 0 || sz > _OQ_TEXT_MAX) { f.close(); return false; }
        char* buf = (char*)malloc(sz + 1);
        if (!buf) { f.close(); return false; }
        size_t rd = f.read((uint8_t*)buf, sz);
        f.close();
        buf[rd] = '\0';
        out.text = String(buf);
        free(buf);
        if (rd != sz) return false;
    }
    return true;
}

// Zwieksza licznik nieudanych prob pierwszej pozycji; zwraca nowa wartosc.
inline uint8_t offlineQueueBumpAttempts() {
    Preferences p;
    if (!p.begin(_OQ_NS, false)) return _OQ_MAX_ATTEMPTS;   // bez NVS: nie probuj w nieskonczonosc
    uint8_t a = p.getUChar("a0", 0);
    if (a < 255) a++;
    if (p.putUChar("a0", a) != 1) Serial.println("[OQ] BLAD zapisu licznika prob");
    p.end();
    return a;
}

// Usun pierwsze zadanie z kolejki (FIFO — przesuwa pozostale w gore).
inline void offlineQueueRemoveFirst() {
    Preferences p;
    if (!p.begin(_OQ_NS, false)) return;
    uint8_t n = p.getUChar("count", 0);
    if (n == 0 || n > _OQ_MAX) { if (n > _OQ_MAX) p.putUChar("count", 0); p.end(); return; }

    // Zapamietaj sciezke pierwszego zadania (plik do usuniecia)
    String q0 = p.isKey("q0") ? p.getString("q0", "") : String("");

    // Przesun [1..n-1] -> [0..n-2]
    static const char kPref[4] = { 't', 'q', 'r', 'a' };
    for (uint8_t i = 0; i + 1 < n; i++) {
        for (uint8_t k = 0; k < 4; k++) {
            char src[6], dst[6];
            _oqKey(src, sizeof(src), kPref[k], i + 1);
            _oqKey(dst, sizeof(dst), kPref[k], i);
            if (kPref[k] == 't' || kPref[k] == 'a') {
                p.putUChar(dst, p.getUChar(src, 0));
            } else if (p.isKey(src)) {
                p.putString(dst, p.getString(src, ""));
            } else if (p.isKey(dst)) {
                p.remove(dst);
            }
        }
    }
    // Wyczysc ostatni (teraz pusty) slot
    for (uint8_t k = 0; k < 4; k++) {
        char key[6];
        _oqKey(key, sizeof(key), kPref[k], n - 1);
        if (p.isKey(key)) p.remove(key);
    }
    if (p.putUChar("count", n - 1) != 1) Serial.println("[OQ] BLAD zapisu licznika kolejki");
    p.end();

    // Usun plik tresci (v2: oba typy; v1: tylko zdjecia mialy sciezke)
    if (q0.startsWith("/oq") && SPIFFS.begin(false)) {
        SPIFFS.remove(q0);
        Serial.printf("[OQ] SPIFFS removed: %s\n", q0.c_str());
    }
    Serial.printf("[OQ] dequeued, remaining=%u\n", (unsigned)(n - 1));
}

// Wyczysc cala kolejke (NVS + wszystkie pliki /oq* na SPIFFS, takze sieroty).
inline void offlineQueueClear() {
    if (SPIFFS.begin(false)) {
        for (int guard = 0; guard < 64; guard++) {
            String victim = "";
            File root = SPIFFS.open("/");
            if (!root) break;
            for (File f = root.openNextFile(); f; f = root.openNextFile()) {
                String path = f.path();
                f.close();
                if (path.startsWith("/oq")) { victim = path; break; }
            }
            root.close();
            if (victim.length() == 0 || !SPIFFS.remove(victim)) break;
        }
    }
    Preferences p;
    if (p.begin(_OQ_NS, false)) {
        uint8_t gen = p.getUChar("gen", 0);
        p.clear();
        p.putUChar("gen", gen);
        p.putUChar("v", 2);
        p.end();
    }
    Serial.println("[OQ] queue cleared");
}
