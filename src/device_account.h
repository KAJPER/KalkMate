#pragma once
// device_account.h — komunikacja z serwerem o stanie sparowania urzadzenia.
//
// Dwie publiczne funkcje:
//   accountRegister()      — POST /api/device/register (zglasza deviceId + unlockCode)
//   accountFetchStatus(s)  — GET  /api/device/account-status (czy sparowane, email, licencja)
//
// Pierwsza wymaga aktywnego WiFi. Druga tez. Funkcje sa nieblokujace dlugo
// (timeout 8s).

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include "wifi_persist.h"   // wifiSaveLicense — auto-sync licencji do NVS

// Forward decl struktury kalkSettings — definicja w settings_screen.h, ale
// nie includujemy go zeby uniknac cyklu. Wymagamy tylko pola aiUnlockCode.
struct KalkMateSettings;
extern KalkMateSettings kalkSettings;
// Helper inline: wyciaga unlock code (forward usage przez wskaznik na char[12])
extern const char* _accGetUnlockCode();

#ifndef KALK_SERVER_URL
#define KALK_SERVER_URL "https://twojserwer.pl"
#endif
#ifndef KALK_API_KEY
#define KALK_API_KEY ""
#endif

#ifndef FW_VERSION
#define FW_VERSION "0.0.0"
#endif

// Pomocnik: deviceId (MAC). Zdefiniowany rowniez w solve_screen.h pod
// taka sama nazwa _solDeviceId — zeby uniknac duplikatu uzywamy lokalnej.
static inline String _accDeviceId() {
    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_WIFI_STA);
    char buf[16];
    snprintf(buf, sizeof(buf), "%02X%02X%02X%02X%02X%02X",
             mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    return String(buf);
}

// Status konta odczytany z serwera.
struct AccountStatus {
    bool   ok;            // czy fetch sie powiodl
    bool   paired;        // czy device jest sparowane z kontem
    String userEmail;     // email konta (pusty gdy !paired)
    bool   hasLicense;    // czy konto ma licencje
    String licenseCode;
    String licenseStatus; // "trial" | "active" | "expired"
    int    daysLeft;      // -1 jesli niedostepne
    String aiModel;       // aktywny model AI, np. "google/gemini-2.5-pro"
    String aiMode;        // tryb: "detailed" | "calc_only" | "result_only"
    String error;
};

// POST /api/device/register — kalkulator zglasza swoj unlockCode i fwVersion.
// Powinno byc wolane raz po polaczeniu z WiFi (np. lazy z flagą).
inline bool accountRegister() {
    if (WiFi.status() != WL_CONNECTED) return false;

    WiFiClientSecure client;
    client.setInsecure();
    client.setTimeout(8000);

    HTTPClient http;
    http.setReuse(false);
    http.setTimeout(8000);

    String url = String(KALK_SERVER_URL) + "/api/device/register";
    if (!http.begin(client, url)) return false;

    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-api-key", KALK_API_KEY);

    String body = "{\"deviceId\":\"" + _accDeviceId()
                + "\",\"unlockCode\":\"" + String(_accGetUnlockCode())
                + "\",\"firmwareVersion\":\"" + String(FW_VERSION)
                + "\"}";

    int code = http.POST(body);
    String resp = http.getString();
    http.end();

    return (code == 200 && resp.indexOf("\"ok\":true") >= 0);
}

// GET /api/device/account-status — pobierz status sparowania.
// Wypelnia AccountStatus. Zwraca false przy bledzie sieci.
inline bool accountFetchStatus(AccountStatus& out) {
    out.ok = false;
    out.paired = false;
    out.hasLicense = false;
    out.daysLeft = -1;
    out.error = "";

    if (WiFi.status() != WL_CONNECTED) {
        out.error = "Brak WiFi";
        return false;
    }

    WiFiClientSecure client;
    client.setInsecure();
    client.setTimeout(8000);

    HTTPClient http;
    http.setReuse(false);
    http.setTimeout(8000);

    String url = String(KALK_SERVER_URL) + "/api/device/account-status";
    if (!http.begin(client, url)) {
        out.error = "Init HTTP nieudany";
        return false;
    }

    http.addHeader("x-api-key", KALK_API_KEY);
    http.addHeader("x-device-id", _accDeviceId());

    int code = http.GET();
    String resp = http.getString();
    http.end();

    if (code != 200) {
        out.error = "HTTP " + String(code);
        return false;
    }

    // Bardzo prosty parser bez ArduinoJson (jak w innych modulach KalkMate).
    out.aiModel = "";
    out.aiMode  = "";
    out.ok = (resp.indexOf("\"ok\":true") >= 0);
    out.paired = (resp.indexOf("\"paired\":true") >= 0);

    auto extract = [&](const char* key) -> String {
        String pattern = String("\"") + key + "\":\"";
        int s = resp.indexOf(pattern);
        if (s < 0) return "";
        s += pattern.length();
        int e = resp.indexOf("\"", s);
        if (e < 0) return "";
        return resp.substring(s, e);
    };
    auto extractInt = [&](const char* key, int def) -> int {
        String pattern = String("\"") + key + "\":";
        int s = resp.indexOf(pattern);
        if (s < 0) return def;
        s += pattern.length();
        int e = s;
        while (e < (int)resp.length() && (resp[e] == '-' || isdigit(resp[e]))) e++;
        if (e == s) return def;
        return resp.substring(s, e).toInt();
    };

    out.userEmail     = extract("userEmail");
    out.licenseCode   = extract("code");
    out.licenseStatus = extract("status");
    out.aiModel       = extract("aiModel");
    out.aiMode        = extract("aiMode");
    if (out.licenseCode.length() > 0) {
        out.hasLicense = true;
        // AUTO-SYNC do NVS — serwer wie jaka jest licencja, urzadzenie
        // od teraz tez. Bez tego solve_screen wysyla pusty x-license-key
        // i serwer odrzuca jako "nieprawidlowy klucz".
        char saved[40] = "";
        wifiLoadLicense(saved, sizeof(saved));
        if (strcmp(saved, out.licenseCode.c_str()) != 0) {
            wifiSaveLicense(out.licenseCode.c_str());
            Serial.printf("[account] licencja zapisana w NVS: %s\n",
                          out.licenseCode.c_str());
        }
    }
    out.daysLeft = extractInt("daysLeft", -1);

    return true;
}

// Wygodny helper: rejestruj raz na power-up + pobierz licencje z serwera
// do NVS, zeby solve_screen mogl ja wyslac w x-license-key headerze.
// Wolac zewszad gdzie WiFi jest aktywne.
inline bool accountRegisterOnce() {
    static bool _accDone = false;
    if (_accDone) return true;
    if (accountRegister()) {
        _accDone = true;
        // Po rejestracji - pobierz licencje z serwera. accountFetchStatus
        // robi wifiSaveLicense() automatycznie jezeli nie ma w NVS.
        AccountStatus st;
        accountFetchStatus(st);
        return true;
    }
    return false;
}
