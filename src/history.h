#pragma once
// =====================================================================
//  history.h — lokalna historia ostatnich rozwiazan w NVS
//
//  Limit: 5 ostatnich (NVS_KEY_LIMIT). Nowsze nadpisuja najstarsze (FIFO).
//  Format w NVS:
//    Preferences ns="kalkhist"
//    "count" — uint8_t (0..5)
//    "head"  — uint8_t (0..4) — index najstarszego
//    "q0"..."q4" — pytanie (do 200 znakow)
//    "a0"..."a4" — odpowiedz (do 800 znakow)
//    "t0"..."t4" — timestamp (uint32_t — millis() w momencie zapisu lub epoch)
//
//  Reszta historii (starsze) pobierana z serwera przez
//  /api/device/conversations.
// =====================================================================

#include <Arduino.h>
#include <Preferences.h>

#define HIST_NS         "kalkhist"
#define HIST_LIMIT      5
#define HIST_Q_MAX      200
#define HIST_A_MAX      800

struct HistoryEntry {
    String question;
    String answer;
    uint32_t timestamp;   // sekund od epoch jesli WiFi/NTP, inaczej millis()
};

inline void historySave(const String& question, const String& answer) {
    Preferences prefs;
    prefs.begin(HIST_NS, false);

    uint8_t count = prefs.getUChar("count", 0);
    uint8_t head  = prefs.getUChar("head", 0);

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

    char qkey[8], akey[8], tkey[8];
    snprintf(qkey, sizeof(qkey), "q%u", slot);
    snprintf(akey, sizeof(akey), "a%u", slot);
    snprintf(tkey, sizeof(tkey), "t%u", slot);

    String q = question.length() > HIST_Q_MAX
        ? question.substring(0, HIST_Q_MAX) : question;
    String a = answer.length() > HIST_A_MAX
        ? answer.substring(0, HIST_A_MAX) : answer;

    prefs.putString(qkey, q);
    prefs.putString(akey, a);
    prefs.putUInt(tkey, (uint32_t)(millis() / 1000));   // unix-like, uproszczone
    prefs.putUChar("count", count);
    prefs.putUChar("head", head);

    prefs.end();
}

// Zwraca liczbe wpisow (0..HIST_LIMIT)
inline uint8_t historyCount() {
    Preferences prefs;
    prefs.begin(HIST_NS, true);
    uint8_t c = prefs.getUChar("count", 0);
    prefs.end();
    return c;
}

// Pobiera wpis o indeksie 0 = najnowszy, count-1 = najstarszy
inline bool historyGet(uint8_t newestIdx, HistoryEntry& out) {
    Preferences prefs;
    prefs.begin(HIST_NS, true);
    uint8_t count = prefs.getUChar("count", 0);
    uint8_t head  = prefs.getUChar("head", 0);
    if (newestIdx >= count) { prefs.end(); return false; }

    // 0 = najnowszy = (head + count - 1) % LIMIT
    // newestIdx-ty od najnowszego: (head + count - 1 - newestIdx) % LIMIT
    uint8_t slot = (head + count - 1 - newestIdx + HIST_LIMIT) % HIST_LIMIT;

    char qkey[8], akey[8], tkey[8];
    snprintf(qkey, sizeof(qkey), "q%u", slot);
    snprintf(akey, sizeof(akey), "a%u", slot);
    snprintf(tkey, sizeof(tkey), "t%u", slot);

    out.question  = prefs.getString(qkey, "");
    out.answer    = prefs.getString(akey, "");
    out.timestamp = prefs.getUInt(tkey, 0);

    prefs.end();
    return out.question.length() > 0 || out.answer.length() > 0;
}

inline void historyClear() {
    Preferences prefs;
    prefs.begin(HIST_NS, false);
    prefs.clear();
    prefs.end();
}
