#pragma once
// =====================================================================
//  history.h — lokalna historia ostatnich rozwiazan
//
//  Limit: 5 ostatnich (HIST_LIMIT). Nowsze nadpisuja najstarsze (FIFO).
//
//  Od fw > 1.9.7 tresc wpisow lezy na SPIFFS, a w NVS zostaja tylko male
//  metadane. Wczesniej 5 x (3000 + 500) B tekstu w NVS (partycja ~20 KB)
//  wyczerpywalo miejsce i CICHO psulo zapisy innych ustawien (kod AI,
//  dev_token!).
//    Preferences ns="kalkhist":
//      "v"     — wersja formatu (2 = tresc na SPIFFS)
//      "count" — uint8_t (0..5)
//      "head"  — uint8_t (0..4) — index najstarszego
//    SPIFFS "/histN.bin" (N = slot 0..4):
//      [u32 magic][u32 timestamp][u16 dlugosc pytania][u16 dlugosc odp.]
//      [pytanie][odpowiedz]   (UTF-8, bez NUL)
//  Format v1 (fw <= 1.9.7): "qN"/"aN"/"tN" w NVS — migrowany jednorazowo do
//  plikow przy pierwszym dostepie (gdy SPIFFS jest zamontowany), po czym
//  stare klucze sa kasowane. Do czasu migracji odczyt bierze je z NVS.
//
//  SPIFFS montowany BEZ formatowania (SPIFFS.begin(false)) — jednorazowy
//  format nieuzywanej partycji robi solve_screen.h z komunikatem na ekranie
//  (_solEnsureFs), bo na 16 MB flash trwa dlugo.
//
//  Reszta historii (starsze) pobierana z serwera przez
//  /api/device/conversations.
// =====================================================================

#include <Arduino.h>
#include <Preferences.h>
#include <SPIFFS.h>

#define HIST_NS         "kalkhist"
#define HIST_LIMIT      5
#define HIST_Q_MAX      500    // pytanie do 500 bajtow (UTF-8)
#define HIST_A_MAX      3000   // odpowiedz do 3 KB (UTF-8)
#define _HIST_MAGIC     0x3148534BUL   // "KSH1"
#define _HIST_TMP       "/hist.tmp"

struct HistoryEntry {
    String question;
    String answer;
    uint32_t timestamp;   // sekund od startu (millis()/1000)
};

// Przyciecie do maxBytes bez przecinania znaku UTF-8 (nie zostawia
// urwanego bajtu wiodacego ani osieroconych bajtow kontynuacji).
static String _histUtf8Cut(const String& s, size_t maxBytes) {
    if (s.length() <= maxBytes) return s;
    size_t cut = maxBytes;
    while (cut > 0 && (((uint8_t)s[cut]) & 0xC0) == 0x80) cut--;
    return s.substring(0, cut);
}

static void _histSlotPath(uint8_t slot, char* buf, size_t sz) {
    snprintf(buf, sz, "/hist%u.bin", (unsigned)slot);
}

static inline bool _histFsReady() { return SPIFFS.begin(false); }

// Zapis jednego slotu: najpierw plik tymczasowy, potem podmiana — przerwany
// zapis nie zostawia polowy wpisu pod nazwa slotu.
static bool _histWriteSlot(uint8_t slot, const String& q, const String& a, uint32_t ts) {
    File f = SPIFFS.open(_HIST_TMP, "w");
    if (!f) { Serial.println("[HIST] BLAD: nie mozna utworzyc pliku"); return false; }
    uint32_t hdr32[2] = { _HIST_MAGIC, ts };
    uint16_t hdr16[2] = { (uint16_t)q.length(), (uint16_t)a.length() };
    size_t want = sizeof(hdr32) + sizeof(hdr16) + q.length() + a.length();
    size_t n = f.write((const uint8_t*)hdr32, sizeof(hdr32));
    n += f.write((const uint8_t*)hdr16, sizeof(hdr16));
    n += f.write((const uint8_t*)q.c_str(), q.length());
    n += f.write((const uint8_t*)a.c_str(), a.length());
    f.close();
    if (n != want) {
        Serial.printf("[HIST] BLAD zapisu %u/%u B (pelny SPIFFS?)\n", (unsigned)n, (unsigned)want);
        SPIFFS.remove(_HIST_TMP);
        return false;
    }
    char path[16];
    _histSlotPath(slot, path, sizeof(path));
    if (SPIFFS.exists(path)) SPIFFS.remove(path);
    if (!SPIFFS.rename(_HIST_TMP, path)) {
        Serial.println("[HIST] BLAD: rename pliku");
        SPIFFS.remove(_HIST_TMP);
        return false;
    }
    return true;
}

// Odczyt slotu z pliku. false = brak/uszkodzony plik.
static bool _histReadSlot(uint8_t slot, HistoryEntry& out) {
    char path[16];
    _histSlotPath(slot, path, sizeof(path));
    if (!SPIFFS.exists(path)) return false;
    File f = SPIFFS.open(path, "r");
    if (!f) return false;
    uint32_t hdr32[2] = { 0, 0 };
    uint16_t hdr16[2] = { 0, 0 };
    bool ok = f.read((uint8_t*)hdr32, sizeof(hdr32)) == sizeof(hdr32) &&
              f.read((uint8_t*)hdr16, sizeof(hdr16)) == sizeof(hdr16) &&
              hdr32[0] == _HIST_MAGIC &&
              hdr16[0] <= HIST_Q_MAX && hdr16[1] <= HIST_A_MAX;
    char* buf = nullptr;
    if (ok) {
        size_t big = hdr16[0] > hdr16[1] ? hdr16[0] : hdr16[1];
        buf = (char*)malloc(big + 1);
        ok = (buf != nullptr);
    }
    if (ok) {
        ok = (f.read((uint8_t*)buf, hdr16[0]) == hdr16[0]);
        buf[ok ? hdr16[0] : 0] = '\0';
        out.question = String(buf);
    }
    if (ok) {
        ok = (f.read((uint8_t*)buf, hdr16[1]) == hdr16[1]);
        buf[ok ? hdr16[1] : 0] = '\0';
        out.answer = String(buf);
    }
    if (buf) free(buf);
    f.close();
    if (!ok) return false;
    out.timestamp = hdr32[1];
    return true;
}

// Jednorazowa migracja v1 (tekst w NVS) -> v2 (pliki). Bez SPIFFS nic nie
// robi (sprobuje przy nastepnym dostepie). Wpis, ktorego nie da sie zapisac
// do pliku, przepada — zwolnienie NVS (kod AI, token) jest wazniejsze.
static void _histMigrate() {
    static bool done = false;
    if (done) return;
    if (!_histFsReady()) return;
    Preferences p;
    if (!p.begin(HIST_NS, false)) return;
    if (p.getUChar("v", 1) >= 2) { p.end(); done = true; return; }

    uint8_t count = p.getUChar("count", 0);
    uint8_t head  = p.getUChar("head", 0);
    if (count > HIST_LIMIT || head >= HIST_LIMIT) { count = 0; head = 0; }
    bool valid[HIST_LIMIT] = { false };
    for (uint8_t i = 0; i < count; i++) valid[(head + i) % HIST_LIMIT] = true;

    int moved = 0;
    for (uint8_t s = 0; s < HIST_LIMIT; s++) {
        char qk[8], ak[8], tk[8];
        snprintf(qk, sizeof(qk), "q%u", (unsigned)s);
        snprintf(ak, sizeof(ak), "a%u", (unsigned)s);
        snprintf(tk, sizeof(tk), "t%u", (unsigned)s);
        bool hasQ = p.isKey(qk), hasA = p.isKey(ak), hasT = p.isKey(tk);
        if (valid[s] && (hasQ || hasA)) {
            String q = hasQ ? p.getString(qk, "") : String("");
            String a = hasA ? p.getString(ak, "") : String("");
            uint32_t ts = hasT ? p.getUInt(tk, 0) : 0;
            if (_histWriteSlot(s, _histUtf8Cut(q, HIST_Q_MAX), _histUtf8Cut(a, HIST_A_MAX), ts)) moved++;
            else Serial.printf("[HIST] migracja: wpis %u utracony\n", (unsigned)s);
        }
        if (hasQ) p.remove(qk);
        if (hasA) p.remove(ak);
        if (hasT) p.remove(tk);
    }
    // Wpisy, ktorych nie udalo sie przeniesc, beda mialy brak pliku —
    // historyGet() je pominie (zwraca false), licznik zostaje.
    p.putUChar("count", count);
    p.putUChar("head", head);
    if (p.putUChar("v", 2) != 1) Serial.println("[HIST] BLAD zapisu wersji");
    p.end();
    done = true;
    Serial.printf("[HIST] migracja NVS -> SPIFFS: %d wpisow\n", moved);
}

// Zapisuje wpis. Zwraca false przy bledzie (brak SPIFFS, pelna pamiec,
// blad NVS) — historia jest pomocnicza, wolajacy tylko loguje.
inline bool historySave(const String& question, const String& answer) {
    _histMigrate();
    if (!_histFsReady()) { Serial.println("[HIST] brak SPIFFS — wpis pominiety"); return false; }

    Preferences prefs;
    if (!prefs.begin(HIST_NS, false)) { Serial.println("[HIST] BLAD: NVS"); return false; }
    uint8_t count = prefs.getUChar("count", 0);
    uint8_t head  = prefs.getUChar("head", 0);
    if (count > HIST_LIMIT || head >= HIST_LIMIT) { count = 0; head = 0; }

    // Slot do zapisu = (head + count) % LIMIT (jesli count<LIMIT)
    // gdy count == LIMIT, nadpisujemy najstarszy = head, head++
    uint8_t slot;
    if (count < HIST_LIMIT) {
        slot = (head + count) % HIST_LIMIT;
        count++;
    } else {
        slot = head;
        head = (head + 1) % HIST_LIMIT;
    }

    if (!_histWriteSlot(slot, _histUtf8Cut(question, HIST_Q_MAX),
                        _histUtf8Cut(answer, HIST_A_MAX), (uint32_t)(millis() / 1000))) {
        prefs.end();
        return false;
    }
    bool ok = (prefs.putUChar("count", count) == 1) & (prefs.putUChar("head", head) == 1);
    if (prefs.getUChar("v", 1) < 2) prefs.putUChar("v", 2);
    prefs.end();
    if (!ok) Serial.println("[HIST] BLAD zapisu metadanych NVS");
    return ok;
}

// Zwraca liczbe wpisow (0..HIST_LIMIT)
inline uint8_t historyCount() {
    _histMigrate();
    Preferences prefs;
    if (!prefs.begin(HIST_NS, true)) return 0;   // namespace jeszcze nie istnieje
    uint8_t c = prefs.getUChar("count", 0);
    prefs.end();
    return (c <= HIST_LIMIT) ? c : 0;
}

// Pobiera wpis o indeksie 0 = najnowszy, count-1 = najstarszy
inline bool historyGet(uint8_t newestIdx, HistoryEntry& out) {
    _histMigrate();
    out.question = "";
    out.answer = "";
    out.timestamp = 0;

    Preferences prefs;
    if (!prefs.begin(HIST_NS, true)) return false;
    uint8_t count = prefs.getUChar("count", 0);
    uint8_t head  = prefs.getUChar("head", 0);
    if (count > HIST_LIMIT || head >= HIST_LIMIT || newestIdx >= count) { prefs.end(); return false; }

    // 0 = najnowszy = (head + count - 1) % LIMIT
    uint8_t slot = (head + count - 1 - newestIdx + HIST_LIMIT) % HIST_LIMIT;

    if (prefs.getUChar("v", 1) < 2) {
        // Jeszcze przed migracja (brak SPIFFS) — stary format w NVS.
        char qkey[8], akey[8], tkey[8];
        snprintf(qkey, sizeof(qkey), "q%u", (unsigned)slot);
        snprintf(akey, sizeof(akey), "a%u", (unsigned)slot);
        snprintf(tkey, sizeof(tkey), "t%u", (unsigned)slot);
        if (prefs.isKey(qkey)) out.question = prefs.getString(qkey, "");
        if (prefs.isKey(akey)) out.answer   = prefs.getString(akey, "");
        if (prefs.isKey(tkey)) out.timestamp = prefs.getUInt(tkey, 0);
        prefs.end();
        return out.question.length() > 0 || out.answer.length() > 0;
    }
    prefs.end();

    if (!_histFsReady()) return false;
    if (!_histReadSlot(slot, out)) return false;
    return out.question.length() > 0 || out.answer.length() > 0;
}

inline void historyClear() {
    if (_histFsReady()) {
        for (uint8_t s = 0; s < HIST_LIMIT; s++) {
            char path[16];
            _histSlotPath(s, path, sizeof(path));
            if (SPIFFS.exists(path)) SPIFFS.remove(path);
        }
        if (SPIFFS.exists(_HIST_TMP)) SPIFFS.remove(_HIST_TMP);
    }
    Preferences prefs;
    if (prefs.begin(HIST_NS, false)) {
        prefs.clear();
        prefs.putUChar("v", 2);
        prefs.end();
    }
}
