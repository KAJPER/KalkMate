#pragma once
// =====================================================================
//  notes.h — offline notatki uzytkownika synchronizowane z serwera
//
//  Storage: SPIFFS — partycja 192 KB w min_spiffs.csv
//  Format: jeden plik /notes.json zawiera tablice obiektow:
//    [{"t":"tytul","c":"tresc"},{"t":"...","c":"..."}]
//
//  Sync: notesSync(licenseCode) wykonuje GET /api/device/notes,
//  parsuje i zapisuje do SPIFFS. Wywoluj z menu lub przy starcie.
//
//  Read: notesCount(), notesGet(idx, &out) — czytanie do prezentacji.
// =====================================================================

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <FS.h>
#include <SPIFFS.h>

#ifndef KALK_SERVER_URL
#error "notes.h wymaga KALK_SERVER_URL"
#endif

#define _NOTES_FILE         "/notes.json"
#define _NOTES_ENDPOINT     KALK_SERVER_URL "/api/device/notes"
#define _NOTES_HTTP_TIMEOUT 30000
#define _NOTES_MAX_BYTES    (60 * 1024)   // bezpiecznie < 192 KB SPIFFS

struct NoteEntry {
    String title;
    String content;
};

static bool _notesFsReady = false;

inline bool _notesEnsureFs() {
    if (_notesFsReady) return true;
    if (!SPIFFS.begin(true)) {   // true = format if mount fails
        Serial.println("[NOTES] SPIFFS mount failed");
        return false;
    }
    _notesFsReady = true;
    return true;
}

// Liczba notatek aktualnie zapisanych offline. Czyta plik i liczy "{".
inline uint16_t notesCount() {
    if (!_notesEnsureFs()) return 0;
    if (!SPIFFS.exists(_NOTES_FILE)) return 0;
    File f = SPIFFS.open(_NOTES_FILE, "r");
    if (!f) return 0;
    uint16_t count = 0;
    int depth = 0;
    while (f.available()) {
        char c = f.read();
        if (c == '{') {
            if (depth == 0) count++;
            depth++;
        } else if (c == '}') {
            depth--;
        }
    }
    f.close();
    return count;
}

// Pobiera string ze SPIFFS na bazie indeksu (0-based, kolejnosc z JSON-a).
// Bardzo prosty parser bez ArduinoJson — szuka "t":"..." i "c":"..."
inline bool notesGet(uint16_t idx, NoteEntry &out) {
    if (!_notesEnsureFs()) return false;
    if (!SPIFFS.exists(_NOTES_FILE)) return false;

    File f = SPIFFS.open(_NOTES_FILE, "r");
    if (!f) return false;

    String body;
    body.reserve(f.size() + 1);
    while (f.available()) body += (char)f.read();
    f.close();

    // Skanuj obiekty {…}
    int depth = 0;
    int objStart = -1;
    uint16_t cur = 0;
    for (int i = 0; i < (int)body.length(); i++) {
        char c = body[i];
        if (c == '{') {
            if (depth == 0) objStart = i;
            depth++;
        } else if (c == '}') {
            depth--;
            if (depth == 0 && objStart >= 0) {
                if (cur == idx) {
                    String obj = body.substring(objStart, i + 1);
                    // Wyciagnij "t":"..." i "c":"..."
                    out.title = "";
                    out.content = "";
                    int tIdx = obj.indexOf("\"t\":\"");
                    if (tIdx >= 0) {
                        int s = tIdx + 5;
                        int e = s;
                        while (e < (int)obj.length()) {
                            if (obj[e] == '"' && obj[e-1] != '\\') break;
                            e++;
                        }
                        out.title = obj.substring(s, e);
                    }
                    int cIdx = obj.indexOf("\"c\":\"");
                    if (cIdx >= 0) {
                        int s = cIdx + 5;
                        int e = s;
                        while (e < (int)obj.length()) {
                            if (obj[e] == '"' && obj[e-1] != '\\') break;
                            e++;
                        }
                        out.content = obj.substring(s, e);
                    }
                    // Decoder JSON escape: \\n -> \n, \\\" -> \"
                    out.title.replace("\\n", "\n");
                    out.title.replace("\\\"", "\"");
                    out.title.replace("\\\\", "\\");
                    out.content.replace("\\n", "\n");
                    out.content.replace("\\\"", "\"");
                    out.content.replace("\\\\", "\\");
                    return true;
                }
                cur++;
                objStart = -1;
            }
        }
    }
    return false;
}

// Synchronizacja z serwera. Wymaga aktywnego WiFi + licencji.
// Zwraca: -1 = blad polaczenia, 0+ = liczba pobranych notatek
inline int notesSync(const char* licenseCode, const char* apiKey) {
    if (!_notesEnsureFs()) return -1;
    if (WiFi.status() != WL_CONNECTED) return -1;

    WiFiClientSecure client;
    client.setInsecure();
    client.setTimeout(30);
    HTTPClient http;
    http.begin(client, _NOTES_ENDPOINT);
    http.addHeader("x-api-key", apiKey);
    if (licenseCode && licenseCode[0])
        http.addHeader("x-license-key", licenseCode);
    http.setTimeout(_NOTES_HTTP_TIMEOUT);

    Serial.printf("[NOTES] sync GET %s\n", _NOTES_ENDPOINT);
    int code = http.GET();
    if (code != 200) {
        Serial.printf("[NOTES] sync HTTP %d\n", code);
        http.end();
        return -1;
    }

    String body = http.getString();
    http.end();

    // Wyciagnij "notes":[...]
    int notesIdx = body.indexOf("\"notes\":");
    if (notesIdx < 0) return 0;
    int arrStart = body.indexOf('[', notesIdx);
    if (arrStart < 0) return 0;

    // Znajdz pasujacy ']'
    int depth = 0;
    int arrEnd = -1;
    for (int i = arrStart; i < (int)body.length(); i++) {
        if (body[i] == '[') depth++;
        else if (body[i] == ']') {
            depth--;
            if (depth == 0) { arrEnd = i; break; }
        }
    }
    if (arrEnd < 0) return 0;

    String arr = body.substring(arrStart, arrEnd + 1);
    if (arr.length() > _NOTES_MAX_BYTES) {
        Serial.printf("[NOTES] dump too large: %d B\n", arr.length());
        return -1;
    }

    // Konwertuj format z serwera ({"id":...,"title":...,"content":...,...})
    // do compact format ({"t":"tytul","c":"tresc"})
    String compact = "[";
    bool first = true;
    int cursor = 0;
    int nDepth = 0;
    int nStart = -1;
    while (cursor < (int)arr.length()) {
        char c = arr[cursor];
        if (c == '{') {
            if (nDepth == 0) nStart = cursor;
            nDepth++;
        } else if (c == '}') {
            nDepth--;
            if (nDepth == 0 && nStart >= 0) {
                String obj = arr.substring(nStart, cursor + 1);
                String t = "", co = "";
                int tIdx = obj.indexOf("\"title\":\"");
                if (tIdx >= 0) {
                    int s = tIdx + 9;
                    int e = s;
                    while (e < (int)obj.length()) {
                        if (obj[e] == '"' && obj[e-1] != '\\') break;
                        e++;
                    }
                    t = obj.substring(s, e);
                }
                int cIdx = obj.indexOf("\"content\":\"");
                if (cIdx >= 0) {
                    int s = cIdx + 11;
                    int e = s;
                    while (e < (int)obj.length()) {
                        if (obj[e] == '"' && obj[e-1] != '\\') break;
                        e++;
                    }
                    co = obj.substring(s, e);
                }
                if (!first) compact += ",";
                compact += "{\"t\":\"" + t + "\",\"c\":\"" + co + "\"}";
                first = false;
                nStart = -1;
            }
        }
        cursor++;
    }
    compact += "]";

    File f = SPIFFS.open(_NOTES_FILE, "w");
    if (!f) {
        Serial.println("[NOTES] cannot open notes file for write");
        return -1;
    }
    size_t written = f.print(compact);
    f.close();
    Serial.printf("[NOTES] saved %u bytes\n", (unsigned)written);

    return notesCount();
}

inline void notesClear() {
    if (!_notesEnsureFs()) return;
    if (SPIFFS.exists(_NOTES_FILE)) SPIFFS.remove(_NOTES_FILE);
}
