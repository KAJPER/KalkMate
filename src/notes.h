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

// =====================================================================
//  JSON-aware helpers (uzywane przez notesSync i testsSync).
//  Naiwny string-search w body sie wykrzaczal na contentcie z [ ] { }
//  (LaTeX, intervale, etc). Te helpery pomijaja stringi.
// =====================================================================

// Zwraca pozycje znaku zamykajacego "  dla stringa zaczynajacego sie na
// startQuotePos. Pomija \\ ... \" itp. -1 gdy malformed.
static int _jsonSkipString(const String& s, int startQuotePos) {
    if (startQuotePos >= (int)s.length() || s[startQuotePos] != '"') return -1;
    int i = startQuotePos + 1;
    while (i < (int)s.length()) {
        char c = s[i];
        if (c == '\\') {
            i += 2;  // skip escape + nastepny znak
        } else if (c == '"') {
            return i;
        } else {
            i++;
        }
    }
    return -1;
}

// Znajdz pasujacy zamykajacy nawias dla otwierajacego na openPos. Pomija stringi.
static int _jsonMatchBracket(const String& s, int openPos, char open, char close) {
    int depth = 0;
    for (int i = openPos; i < (int)s.length(); i++) {
        char c = s[i];
        if (c == '"') {
            i = _jsonSkipString(s, i);
            if (i < 0) return -1;
            continue;
        }
        if (c == open) depth++;
        else if (c == close) {
            depth--;
            if (depth == 0) return i;
        }
    }
    return -1;
}

// Wyciag wartosc pola "field":"..." z obiektu JSON. Wartosc dalej JSON-encoded.
static String _jsonGetStringField(const String& obj, const char* fieldName) {
    String pat = "\"";
    pat += fieldName;
    pat += "\":";
    int p = 0;
    while (p < (int)obj.length()) {
        int idx = obj.indexOf(pat, p);
        if (idx < 0) return "";
        // Sprawdz czy idx nie jest w innym stringu — policz nieparzystosc "
        int qCount = 0;
        for (int i = 0; i < idx; i++) {
            if (obj[i] == '\\') { i++; continue; }
            if (obj[i] == '"') qCount++;
        }
        if (qCount % 2 != 0) {
            p = idx + pat.length();
            continue;
        }
        int j = idx + pat.length();
        while (j < (int)obj.length() && (obj[j] == ' ' || obj[j] == '\t')) j++;
        if (j >= (int)obj.length() || obj[j] != '"') return "";
        int e = _jsonSkipString(obj, j);
        if (e < 0) return "";
        return obj.substring(j + 1, e);
    }
    return "";
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
    // Device ID (MAC) — uzywane w nowym modelu konta (Device.userId)
    {
        uint8_t mac[6];
        esp_read_mac(mac, ESP_MAC_WIFI_STA);
        char did[16];
        snprintf(did, sizeof(did), "%02X%02X%02X%02X%02X%02X",
                 mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
        http.addHeader("x-device-id", did);
    }
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

    // JSON-aware znajdz koniec tablicy (pomija nawiasy [ ] w stringach)
    int arrEnd = _jsonMatchBracket(body, arrStart, '[', ']');
    if (arrEnd < 0) {
        Serial.println("[NOTES] cannot find array end");
        return -1;
    }

    String arr = body.substring(arrStart, arrEnd + 1);
    if (arr.length() > _NOTES_MAX_BYTES) {
        Serial.printf("[NOTES] dump too large: %d B\n", arr.length());
        return -1;
    }

    // Konwertuj do compact format. JSON-aware: pomija { } w stringach.
    String compact = "[";
    compact.reserve(arr.length() + 64);
    bool first = true;
    int cursor = 1;  // skip [
    while (cursor < (int)arr.length() - 1) {
        while (cursor < (int)arr.length() &&
               (arr[cursor] == ' ' || arr[cursor] == '\t' || arr[cursor] == '\n' ||
                arr[cursor] == '\r' || arr[cursor] == ',')) {
            cursor++;
        }
        if (cursor >= (int)arr.length() - 1 || arr[cursor] != '{') break;

        int objEnd = _jsonMatchBracket(arr, cursor, '{', '}');
        if (objEnd < 0) {
            Serial.printf("[NOTES] obj parse fail at %d\n", cursor);
            break;
        }
        String obj = arr.substring(cursor, objEnd + 1);
        String t  = _jsonGetStringField(obj, "title");
        String co = _jsonGetStringField(obj, "content");

        if (!first) compact += ",";
        compact += "{\"t\":\"";
        compact += t;
        compact += "\",\"c\":\"";
        compact += co;
        compact += "\"}";
        first = false;

        cursor = objEnd + 1;
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
