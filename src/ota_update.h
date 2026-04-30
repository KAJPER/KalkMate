#pragma once
// =====================================================================
//  ota_update.h — Over-The-Air firmware update przez HTTPS
//
//  Workflow:
//   1. otaCheck()   — pyta serwer o najnowsza wersje
//                     GET /api/device/firmware/check?current=<FW_VERSION>
//                     Response: {"version":"0.2.0","url":"...","notes":"..."}
//   2. Jesli version > FW_VERSION -> mozna zainstalowac
//   3. otaInstall() — pobiera .bin, wpisuje do nowej partycji,
//                     pokazuje progress na OLED, restart po sukcesie
//
//  Wymaga FW_VERSION i KALK_SERVER_URL zdefiniowanych przed include'em.
//  Uzywa Update.h (built-in ESP32) + HTTPClient + WiFiClientSecure.
// =====================================================================

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Update.h>
#include <U8g2lib.h>

#ifndef KALK_SERVER_URL
#error "ota_update.h wymaga zdefiniowania KALK_SERVER_URL przed include"
#endif
#ifndef FW_VERSION
#error "ota_update.h wymaga zdefiniowania FW_VERSION przed include"
#endif

#define _OTA_CHECK_ENDPOINT  KALK_SERVER_URL "/api/device/firmware/check"
#define _OTA_HTTP_TIMEOUT_MS 30000

struct OtaInfo {
    bool   available;     // true gdy nowa wersja > FW_VERSION
    String latestVersion; // wersja zwrocona przez serwer (lub pusta)
    String url;           // URL do .bin
    String notes;         // changelog / opis
    String error;         // pusty gdy OK, inaczej komunikat bledu
};

// ---------------------------------------------------------------------
//  Helper: porownanie wersji semver (np. "0.1.0" vs "0.2.0")
//  Zwraca: 1 gdy a > b, 0 gdy a == b, -1 gdy a < b
// ---------------------------------------------------------------------
static int _otaVerCmp(const String& a, const String& b) {
    int ai = 0, bi = 0;
    while (ai < (int)a.length() || bi < (int)b.length()) {
        int an = 0, bn = 0;
        while (ai < (int)a.length() && a[ai] != '.') {
            if (a[ai] >= '0' && a[ai] <= '9') an = an * 10 + (a[ai] - '0');
            ai++;
        }
        while (bi < (int)b.length() && b[bi] != '.') {
            if (b[bi] >= '0' && b[bi] <= '9') bn = bn * 10 + (b[bi] - '0');
            bi++;
        }
        if (an != bn) return an > bn ? 1 : -1;
        ai++; bi++;
    }
    return 0;
}

// ---------------------------------------------------------------------
//  Wyciagniecie pola JSON: np. _otaJsonField(resp, "version")
//  Bardzo prosty parser — wystarczy dla naszego endpointu
// ---------------------------------------------------------------------
static String _otaJsonField(const String& json, const char* key) {
    String pat = "\"";
    pat += key;
    pat += "\":\"";
    int s = json.indexOf(pat);
    if (s < 0) return "";
    s += pat.length();
    int e = json.indexOf("\"", s);
    if (e < 0) return "";
    return json.substring(s, e);
}

// ---------------------------------------------------------------------
//  otaCheck — pyta serwer o najnowsza wersje
// ---------------------------------------------------------------------
inline OtaInfo otaCheck() {
    OtaInfo info;
    info.available = false;
    info.latestVersion = "";

    if (WiFi.status() != WL_CONNECTED) {
        info.error = "Brak WiFi";
        return info;
    }

    WiFiClientSecure client;
    client.setInsecure();
    client.setTimeout(30);
    HTTPClient http;
    String url = String(_OTA_CHECK_ENDPOINT) + "?current=" + FW_VERSION;
    http.begin(client, url);
    http.addHeader("x-api-key", KALK_API_KEY);
    http.setTimeout(_OTA_HTTP_TIMEOUT_MS);

    Serial.printf("[OTA] check: %s\n", url.c_str());
    int code = http.GET();
    String body = http.getString();
    http.end();

    Serial.printf("[OTA] HTTP %d: %s\n", code, body.c_str());

    if (code != 200) {
        info.error = String("HTTP ") + code;
        return info;
    }

    info.latestVersion = _otaJsonField(body, "version");
    info.url           = _otaJsonField(body, "url");
    info.notes         = _otaJsonField(body, "notes");

    if (info.latestVersion.isEmpty()) {
        info.error = "Brak wersji w odp.";
        return info;
    }

    info.available = (_otaVerCmp(info.latestVersion, FW_VERSION) > 0);
    return info;
}

// ---------------------------------------------------------------------
//  Render postepu OTA na OLED
// ---------------------------------------------------------------------
static void _otaDrawProgress(U8G2 &d, const char* line1, int percent) {
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);
    d.drawStr(2, 14, line1);

    char pctStr[16];
    snprintf(pctStr, sizeof(pctStr), "%d%%", percent);
    d.drawStr(220, 14, pctStr);

    // Pasek postepu
    int barW = 240;
    int barH = 12;
    int barX = 8;
    int barY = 32;
    d.drawFrame(barX, barY, barW, barH);
    int fill = (percent * (barW - 4)) / 100;
    if (fill > 0) d.drawBox(barX + 2, barY + 2, fill, barH - 4);

    d.setFont(u8g2_font_5x7_tf);
    d.drawStr(2, 60, "Nie wylaczaj urzadzenia!");

    d.sendBuffer();
}

// ---------------------------------------------------------------------
//  otaInstall — pobiera .bin i wpisuje przez Update API
//  Pokazuje postep na OLED. Po sukcesie wywoluje ESP.restart().
// ---------------------------------------------------------------------
inline bool otaInstall(U8G2 &d, const String& binUrl) {
    Serial.printf("[OTA] install: %s\n", binUrl.c_str());

    if (WiFi.status() != WL_CONNECTED) {
        _otaDrawProgress(d, "Blad: brak WiFi", 0);
        delay(2000);
        return false;
    }

    _otaDrawProgress(d, "Laczenie z serwerem...", 0);

    WiFiClientSecure client;
    client.setInsecure();
    client.setTimeout(60);
    HTTPClient http;
    http.begin(client, binUrl);
    http.setTimeout(60000);

    int code = http.GET();
    if (code != 200) {
        Serial.printf("[OTA] download HTTP %d\n", code);
        char err[32];
        snprintf(err, sizeof(err), "Blad pobrania: %d", code);
        _otaDrawProgress(d, err, 0);
        delay(3000);
        http.end();
        return false;
    }

    int total = http.getSize();
    if (total <= 0) {
        _otaDrawProgress(d, "Blad: rozmiar 0", 0);
        delay(2000);
        http.end();
        return false;
    }
    Serial.printf("[OTA] firmware size: %d B\n", total);

    if (!Update.begin(total)) {
        Serial.printf("[OTA] Update.begin failed: %s\n", Update.errorString());
        _otaDrawProgress(d, "Blad: brak miejsca", 0);
        delay(3000);
        http.end();
        return false;
    }

    _otaDrawProgress(d, "Pobieranie firmware...", 0);

    WiFiClient* stream = http.getStreamPtr();
    uint8_t buf[1024];
    int written = 0;
    uint32_t lastDraw = 0;

    while (http.connected() && written < total) {
        size_t avail = stream->available();
        if (avail) {
            int n = stream->readBytes(buf, min(avail, sizeof(buf)));
            if (n <= 0) break;
            if (Update.write(buf, n) != (size_t)n) {
                Serial.printf("[OTA] Update.write failed: %s\n", Update.errorString());
                Update.abort();
                _otaDrawProgress(d, "Blad zapisu", written * 100 / total);
                delay(3000);
                http.end();
                return false;
            }
            written += n;

            uint32_t now = millis();
            if (now - lastDraw > 250) {
                lastDraw = now;
                int pct = written * 100 / total;
                _otaDrawProgress(d, "Pobieranie firmware...", pct);
            }
        } else {
            delay(1);
        }
    }

    http.end();

    if (written != total) {
        Serial.printf("[OTA] incomplete: %d / %d\n", written, total);
        Update.abort();
        _otaDrawProgress(d, "Blad: niepelny pobor", written * 100 / total);
        delay(3000);
        return false;
    }

    if (!Update.end(true)) {
        Serial.printf("[OTA] Update.end failed: %s\n", Update.errorString());
        _otaDrawProgress(d, "Blad finalizacji", 100);
        delay(3000);
        return false;
    }

    if (!Update.isFinished()) {
        _otaDrawProgress(d, "Update niepelny", 100);
        delay(3000);
        return false;
    }

    _otaDrawProgress(d, "Sukces! Restart...", 100);
    delay(1500);
    ESP.restart();
    return true; // never reached
}
