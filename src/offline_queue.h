#pragma once
// =====================================================================
//  offline_queue.h — kolejka zadan offline (NVS + SPIFFS)
//
//  Przechowuje zadania gdy WiFi niedostepne; wysyla przy nastepnym
//  polaczeniu (wywolywane z showSolveScreen na wejsciu).
//
//  Tekst:  NVS namespace "kalkoq" (do _OQ_MAX zadan, max 2000 znakow)
//  Zdjecia: SPIFFS /oqXX.jpg (unikalny numer przez klucz "gen" w NVS)
//  Metadane: NVS "count", "tN" (typ), "qN" (tekst lub sciezka SPIFFS)
//
//  API:
//    offlineQueueCount()              — ile zadan czeka
//    offlineQueueAddText(text)        — dodaj zadanie tekstowe
//    offlineQueueAddPhoto(buf, len)   — zapisz JPEG do SPIFFS, dodaj do kolejki
//    offlineQueuePeek(idx, task)      — podglad bez usuwania
//    offlineQueueRemoveFirst()        — usun pierwsze zadanie (FIFO)
//    offlineQueueClear()              — wyczysc wszystko
// =====================================================================

#include <Arduino.h>
#include <Preferences.h>
#include <SPIFFS.h>

#define _OQ_NS   "kalkoq"
#define _OQ_MAX  3          // max zadania w kolejce

struct OfflineTask {
    uint8_t type;   // 0 = text, 1 = photo (SPIFFS)
    String  text;   // zawartosc dla type==0
    String  path;   // sciezka SPIFFS dla type==1
};

// Ilosc zadan w kolejce (0 gdy brak lub blad NVS)
inline uint8_t offlineQueueCount() {
    Preferences p;
    p.begin(_OQ_NS, true);
    uint8_t n = p.getUChar("count", 0);
    p.end();
    return (n <= _OQ_MAX) ? n : 0;
}

// Dodaj zadanie tekstowe. Zwraca true jesli zakolejkowano.
inline bool offlineQueueAddText(const char* text) {
    if (!text || !text[0]) return false;
    Preferences p;
    p.begin(_OQ_NS, false);
    uint8_t n = p.getUChar("count", 0);
    if (n >= _OQ_MAX) { p.end(); return false; }
    char tkey[4], qkey[4];
    snprintf(tkey, sizeof(tkey), "t%u", (unsigned)n);
    snprintf(qkey, sizeof(qkey), "q%u", (unsigned)n);
    p.putUChar(tkey, 0);
    p.putString(qkey, text);
    p.putUChar("count", n + 1);
    p.end();
    Serial.printf("[OQ] text queued slot=%u len=%u\n", n, strlen(text));
    return true;
}

// Dodaj zdjecie JPEG. Zapisuje do SPIFFS, metadane do NVS. Zwraca true jesli ok.
inline bool offlineQueueAddPhoto(const uint8_t* jpegBuf, size_t jpegLen) {
    if (!jpegBuf || jpegLen == 0) return false;

    Preferences p;
    p.begin(_OQ_NS, false);
    uint8_t n = p.getUChar("count", 0);
    if (n >= _OQ_MAX) { p.end(); return false; }
    // Unikalny numer pliku — klucz "gen" inkrementowany niezaleznie od kolejki
    uint8_t gen = p.getUChar("gen", 0);
    p.putUChar("gen", (uint8_t)(gen + 1));
    p.end();

    if (!SPIFFS.begin(false)) {
        Serial.println("[OQ] SPIFFS unavailable");
        return false;
    }

    char path[20];
    snprintf(path, sizeof(path), "/oq%02u.jpg", (unsigned)(gen & 0x0F));

    File f = SPIFFS.open(path, "w");
    if (!f) {
        Serial.printf("[OQ] SPIFFS open failed: %s\n", path);
        return false;
    }
    size_t written = f.write(jpegBuf, jpegLen);
    f.close();

    if (written != jpegLen) {
        Serial.printf("[OQ] SPIFFS partial write %u/%u — abort\n", written, jpegLen);
        SPIFFS.remove(path);
        return false;
    }

    p.begin(_OQ_NS, false);
    n = p.getUChar("count", 0);  // re-read po I/O
    if (n >= _OQ_MAX) { p.end(); SPIFFS.remove(path); return false; }
    char tkey[4], qkey[4];
    snprintf(tkey, sizeof(tkey), "t%u", (unsigned)n);
    snprintf(qkey, sizeof(qkey), "q%u", (unsigned)n);
    p.putUChar(tkey, 1);
    p.putString(qkey, path);
    p.putUChar("count", n + 1);
    p.end();

    Serial.printf("[OQ] photo queued slot=%u path=%s size=%u\n", n, path, jpegLen);
    return true;
}

// Odczytaj zadanie o indeksie idx (0-based) bez usuwania.
// Zwraca false gdy idx poza zakresem lub blad NVS.
inline bool offlineQueuePeek(uint8_t idx, OfflineTask& out) {
    Preferences p;
    p.begin(_OQ_NS, true);
    uint8_t n = p.getUChar("count", 0);
    if (idx >= n || n > _OQ_MAX) { p.end(); return false; }
    char tkey[4], qkey[4];
    snprintf(tkey, sizeof(tkey), "t%u", (unsigned)idx);
    snprintf(qkey, sizeof(qkey), "q%u", (unsigned)idx);
    out.type = p.getUChar(tkey, 0);
    String val = p.getString(qkey, "");
    p.end();
    if (out.type == 0) { out.text = val; out.path = ""; }
    else               { out.text = ""; out.path = val; }
    return true;
}

// Usun pierwsze zadanie z kolejki (FIFO — przesuwa pozostale w gore).
inline void offlineQueueRemoveFirst() {
    Preferences p;
    p.begin(_OQ_NS, false);
    uint8_t n = p.getUChar("count", 0);
    if (n == 0) { p.end(); return; }

    // Zapamietaj pierwsze zadanie (do usuniecia pliku SPIFFS)
    uint8_t t0  = p.getUChar("t0", 0);
    String  q0  = p.getString("q0", "");

    // Przesuń [1..n-1] -> [0..n-2]
    for (uint8_t i = 0; i < (uint8_t)(n - 1); i++) {
        char tk_src[4], qk_src[4], tk_dst[4], qk_dst[4];
        snprintf(tk_src, sizeof(tk_src), "t%u", (unsigned)(i + 1));
        snprintf(qk_src, sizeof(qk_src), "q%u", (unsigned)(i + 1));
        snprintf(tk_dst, sizeof(tk_dst), "t%u", (unsigned)i);
        snprintf(qk_dst, sizeof(qk_dst), "q%u", (unsigned)i);
        p.putUChar(tk_dst, p.getUChar(tk_src, 0));
        p.putString(qk_dst, p.getString(qk_src, ""));
    }
    // Wyczysc ostatni (teraz pusty) slot
    char tk_last[4], qk_last[4];
    snprintf(tk_last, sizeof(tk_last), "t%u", (unsigned)(n - 1));
    snprintf(qk_last, sizeof(qk_last), "q%u", (unsigned)(n - 1));
    p.remove(tk_last);
    p.remove(qk_last);
    p.putUChar("count", n - 1);
    p.end();

    // Usun plik SPIFFS jesli to bylo zdjecie
    if (t0 == 1 && q0.length() > 0 && SPIFFS.begin(false)) {
        SPIFFS.remove(q0.c_str());
        Serial.printf("[OQ] SPIFFS removed: %s\n", q0.c_str());
    }
    Serial.printf("[OQ] dequeued, remaining=%u\n", n - 1);
}

// Wyczysc cala kolejke (NVS + pliki SPIFFS).
inline void offlineQueueClear() {
    Preferences p;
    p.begin(_OQ_NS, true);
    uint8_t n = p.getUChar("count", 0);
    p.end();

    if (SPIFFS.begin(false)) {
        for (uint8_t i = 0; i < n && i < _OQ_MAX; i++) {
            Preferences p2;
            p2.begin(_OQ_NS, true);
            char tk[4], qk[4];
            snprintf(tk, sizeof(tk), "t%u", (unsigned)i);
            snprintf(qk, sizeof(qk), "q%u", (unsigned)i);
            uint8_t t = p2.getUChar(tk, 0);
            String  q = p2.getString(qk, "");
            p2.end();
            if (t == 1 && q.length() > 0) SPIFFS.remove(q.c_str());
        }
    }
    p.begin(_OQ_NS, false);
    p.clear();
    p.end();
    Serial.println("[OQ] queue cleared");
}
