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
#include "kalkmate_certs.h"
#include "wifi_persist.h"

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
    client.setCACert(KALKMATE_CA_CERT);
    client.setTimeout(30);
    HTTPClient http;
    http.begin(client, _NOTES_ENDPOINT);
    http.addHeader("x-api-key", apiKey);
    if (licenseCode && licenseCode[0])
        http.addHeader("x-license-key", licenseCode);
    {
        uint8_t mac[6];
        esp_read_mac(mac, ESP_MAC_WIFI_STA);
        char did[16];
        snprintf(did, sizeof(did), "%02X%02X%02X%02X%02X%02X",
                 mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
        http.addHeader("x-device-id", did);
    }
    { char dt[68]=""; wifiLoadDeviceToken(dt,sizeof(dt)); if(dt[0]) http.addHeader("x-device-token",dt); }
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

    // Iteruj bezposrednio po body (zero kopii arr substring/compact w RAM).
    File f = SPIFFS.open(_NOTES_FILE, "w");
    if (!f) {
        Serial.println("[NOTES] cannot open notes file for write");
        return -1;
    }
    f.print("[");
    bool first = true;
    int cursor = arrStart + 1;
    int noteCount = 0;
    while (cursor < arrEnd) {
        while (cursor < arrEnd &&
               (body[cursor] == ' ' || body[cursor] == '\t' || body[cursor] == '\n' ||
                body[cursor] == '\r' || body[cursor] == ',')) {
            cursor++;
        }
        if (cursor >= arrEnd || body[cursor] != '{') break;

        int objEnd = _jsonMatchBracket(body, cursor, '{', '}');
        if (objEnd < 0 || objEnd > arrEnd) {
            Serial.printf("[NOTES] obj parse fail at %d\n", cursor);
            break;
        }
        {
            String obj = body.substring(cursor, objEnd + 1);
            String t  = _jsonGetStringField(obj, "title");
            String co = _jsonGetStringField(obj, "content");
            obj = "";

            if (!first) f.print(",");
            f.print("{\"t\":\"");
            f.print(t);
            f.print("\",\"c\":\"");
            f.print(co);
            f.print("\"}");
            first = false;
            noteCount++;
        }
        cursor = objEnd + 1;
    }
    f.print("]");
    f.close();
    body = "";

    Serial.printf("[NOTES] parsed %d notes\n", noteCount);
    return noteCount;
}

inline void notesClear() {
    if (!_notesEnsureFs()) return;
    if (SPIFFS.exists(_NOTES_FILE)) SPIFFS.remove(_NOTES_FILE);
}

// =====================================================================
//  Ekran Notatki — lista offline + sync z serwera
//
//  Przeniesione tu z main.cpp (bylo jedynym ekranem UI trzymanym poza
//  swoim plikiem). Uzywa mT()/btnPressed() zdefiniowanych w main.cpp
//  zaraz po include settings_screen.h — notes.h jest wlaczany PO tym
//  punkcie, wiec sa juz widoczne.
// =====================================================================
inline void showNotesScreen(U8G2 &d) {
    inputWaitRelease();

    auto drawList = [&](int cursor, int count) {
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        char hdr[40];
        snprintf(hdr, sizeof(hdr),
                 mT("Notatki (%d)", "Notes (%d)", "Notizen (%d)"),
                 count);
        d.drawStr(2, 10, hdr);
        d.drawHLine(0, 12, 256);

        if (count == 0) {
            d.drawStr(2, 30,
                mT("Brak notatek. Dodaj je",
                   "No notes. Add them",
                   "Keine Notizen. Fuege sie"));
            d.drawStr(2, 42,
                mT("w panelu klienta i zsynchron.",
                   "in user panel and sync.",
                   "im Kundenpanel hinzu und sync."));
            d.setFont(u8g2_font_5x7_tf);
            d.drawStr(2, 62,
                mT("OK = sync   < = wyjscie",
                   "OK = sync   < = exit",
                   "OK = sync   < = beenden"));
        } else {
            // Pokaz 4 widoczne tytuly
            int scroll = (cursor < 4) ? 0 : cursor - 3;
            d.setFont(u8g2_font_6x10_tf);
            for (int i = 0; i < 4 && (scroll + i) < count; i++) {
                int idx = scroll + i;
                int y = 25 + i * 10;
                NoteEntry n;
                if (notesGet(idx, n)) {
                    String t = n.title;
                    if (t.length() == 0) t = "(bez tytulu)";
                    if (t.length() > 38) t = t.substring(0, 36) + "..";
                    if (idx == cursor) {
                        d.setDrawColor(1);
                        d.drawBox(0, y - 9, 256, 11);
                        d.setDrawColor(0);
                        d.drawStr(4, y, t.c_str());
                        d.setDrawColor(1);
                    } else {
                        d.drawStr(4, y, t.c_str());
                    }
                }
            }
            d.setFont(u8g2_font_5x7_tf);
            d.drawStr(2, 62,
                mT("OK = otworz   v = sync   < = wyjscie",
                   "OK = open   v = sync   < = exit",
                   "OK = oeffnen  v = sync  < = beenden"));
        }
        d.sendBuffer();
    };

    auto drawDetail = [&](const NoteEntry& n) {
        powerSetInhibit(true);   // user czyta — bez sleep
        // Strony scrollowane
        int scrollLine = 0;
        // Rozbij content na linie po 40 znakow
        std::vector<String> lines;
        String content = n.content;
        while (content.length() > 0) {
            int nl = content.indexOf('\n');
            String chunk = nl >= 0 ? content.substring(0, nl) : content;
            content = nl >= 0 ? content.substring(nl + 1) : "";
            // Wrap po ~42 znaki dla czcionki 6x10
            while (chunk.length() > 42) {
                lines.push_back(chunk.substring(0, 42));
                chunk = chunk.substring(42);
            }
            lines.push_back(chunk);
        }

        while (true) {
            powerCheckSleep();
            if (panicTriggered()) { powerSetInhibit(false); return; }
            d.clearBuffer();
            d.setFont(u8g2_font_6x10_tf);
            String t = n.title.length() == 0 ? "(bez tytulu)" : n.title;
            if (t.length() > 40) t = t.substring(0, 38) + "..";
            d.drawStr(2, 10, t.c_str());
            d.drawHLine(0, 12, 256);

            for (int i = 0; i < 4; i++) {
                int idx = scrollLine + i;
                if (idx >= (int)lines.size()) break;
                d.drawStr(2, 24 + i * 11, lines[idx].c_str());
            }

            d.setFont(u8g2_font_5x7_tf);
            char info[24];
            snprintf(info, sizeof(info), "%d/%d", scrollLine + 1, (int)lines.size());
            d.drawStr(220, 62, info);
            d.drawStr(2, 62,
                mT("^/v scroll   < = wstecz",
                   "^/v scroll   < = back",
                   "^/v scroll   < = zurueck"));
            d.sendBuffer();

            inputScan();
            if (inputKeyConsume(KEY_PLUS) || inputKeyConsume(KEY_8)) {
                if (scrollLine > 0) scrollLine--;
            }
            if (inputKeyConsume(KEY_MINUS) || inputKeyConsume(KEY_2)) {
                if (scrollLine < (int)lines.size() - 4) scrollLine++;
            }
            if (inputKeyConsume(KEY_PLUSMINUS) || inputKeyConsume(KEY_4) ||
                inputKeyConsume(KEY_CCE)) {
                powerSetInhibit(false);
                inputWaitRelease();
                return;
            }
            delay(20);
        }
    };

    auto syncFromServer = [&]() {
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 24,
            mT("Synchronizacja...", "Syncing...", "Synchronisiere..."));
        d.drawStr(2, 38,
            mT("Lacze z serwerem", "Connecting to server", "Verbinde mit Server"));
        d.sendBuffer();

        // Ensure WiFi connected (uzyj zapisanego SSID/pass)
        if (WiFi.status() != WL_CONNECTED) {
            char ssid[33] = "", pass[64] = "";
            if (wifiLoadSaved(ssid, sizeof(ssid), pass, sizeof(pass))) {
                WiFi.mode(WIFI_STA);
                WiFi.begin(ssid, pass);
                uint32_t t0 = millis();
                while (WiFi.status() != WL_CONNECTED && millis() - t0 < 10000) {
                    delay(100);
                }
            }
        }
        if (WiFi.status() != WL_CONNECTED) {
            d.clearBuffer();
            d.setFont(u8g2_font_6x10_tf);
            d.drawStr(2, 30,
                mT("Brak WiFi", "No WiFi", "Kein WLAN"));
            d.sendBuffer();
            delay(2000);
            return -1;
        }

        // Licencja opcjonalna - nowy model uzywa deviceId. Stara licencja
        // moze byc dalej obecna jako fallback.
        char licKey[40];
        wifiLoadLicense(licKey, sizeof(licKey));
        int n = notesSync(licKey, KALK_API_KEY);
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        if (n < 0) {
            d.drawStr(2, 30,
                mT("Blad synchronizacji", "Sync error", "Sync-Fehler"));
        } else {
            char buf[40];
            snprintf(buf, sizeof(buf),
                mT("Pobrano: %d notatek", "Downloaded: %d notes", "Geladen: %d Notizen"),
                n);
            d.drawStr(2, 30, buf);
        }
        d.sendBuffer();
        delay(1500);
        return n;
    };

    int cursor = 0;
    int count = (int)notesCount();
    drawList(cursor, count);

    while (true) {
        powerCheckSleep();
        if (panicTriggered()) return;
        if (btnPressed(BTN_UP)) {
            if (cursor > 0) cursor--;
            drawList(cursor, count);
        }
        if (btnPressed(BTN_DOWN)) {
            if (count == 0) {
                // gdy lista pusta i naciskasz DOWN — sync
                syncFromServer();
                count = (int)notesCount();
                cursor = 0;
                drawList(cursor, count);
            } else {
                if (cursor < count - 1) cursor++;
                else {
                    // ostatnia pozycja + DOWN = sync
                    syncFromServer();
                    count = (int)notesCount();
                    if (cursor >= count) cursor = count > 0 ? count - 1 : 0;
                }
                drawList(cursor, count);
            }
        }
        if (btnPressed(BTN_OK)) {
            if (count == 0) {
                syncFromServer();
                count = (int)notesCount();
                cursor = 0;
                drawList(cursor, count);
            } else {
                NoteEntry n;
                if (notesGet(cursor, n)) drawDetail(n);
                drawList(cursor, count);
            }
        }
        if (btnPressed(BTN_LEFT)) {
            return;
        }
        delay(20);
    }
}
