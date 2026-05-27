#pragma once
// wifi_persist.h — zapis/odczyt WiFi SSID+hasla i klucza licencji w NVS (Preferences)
// Wywolanie: wifiSaveCreds(ssid, pass) / wifiLoadSaved(ssid, pass) / wifiLoadLicense(key)
//
// Uzyj #include "wifi_persist.h" przed wifi_settings.h i solve_screen.h

#include <Preferences.h>

#define _WP_NS   "kalkmate"   // przestrzen nazw NVS
#define _WP_SSID "wifi_ssid"
#define _WP_PASS "wifi_pass"
#define _WP_LIC  "license"

// Zapisz SSID i haslo WiFi do NVS
static void wifiSaveCreds(const char* ssid, const char* pass) {
    Preferences prefs;
    prefs.begin(_WP_NS, false);
    prefs.putString(_WP_SSID, ssid);
    prefs.putString(_WP_PASS, pass);
    prefs.end();
}

// Odczytaj zapisane dane WiFi
// ssidBuf i passBuf musza miec odpowiedni rozmiar (min 33 i 64)
// Zwraca true jesli znaleziono zapisane dane
static bool wifiLoadSaved(char* ssidBuf, int ssidSize, char* passBuf, int passSize) {
    Preferences prefs;
    prefs.begin(_WP_NS, true);  // read-only
    String s = prefs.getString(_WP_SSID, "");
    String p = prefs.getString(_WP_PASS, "");
    prefs.end();
    strncpy(ssidBuf, s.c_str(), ssidSize - 1);
    ssidBuf[ssidSize - 1] = '\0';
    strncpy(passBuf, p.c_str(), passSize - 1);
    passBuf[passSize - 1] = '\0';
    return (ssidBuf[0] != '\0');
}

// Zwraca tylko SSID (do wyswietlania)
static String wifiGetSavedSSID() {
    Preferences prefs;
    prefs.begin(_WP_NS, true);
    String s = prefs.getString(_WP_SSID, "");
    prefs.end();
    return s;
}

// Zapisz klucz licencji do NVS
static void wifiSaveLicense(const char* key) {
    Preferences prefs;
    prefs.begin(_WP_NS, false);
    prefs.putString(_WP_LIC, key);
    prefs.end();
}

// Odczytaj klucz licencji
static void wifiLoadLicense(char* keyBuf, int keySize) {
    Preferences prefs;
    prefs.begin(_WP_NS, true);
    String k = prefs.getString(_WP_LIC, "");
    prefs.end();
    strncpy(keyBuf, k.c_str(), keySize - 1);
    keyBuf[keySize - 1] = '\0';
}

// === Kod odblokowujacy tryb AI ===
static void saveAiCode(const char* code) {
    Preferences prefs;
    prefs.begin(_WP_NS, false);
    prefs.putString("ai_code", code);
    prefs.end();
}
static void loadAiCode(char* buf, int bufSize, const char* defaultCode) {
    Preferences prefs;
    prefs.begin(_WP_NS, true);
    String s = prefs.getString("ai_code", defaultCode);
    prefs.end();
    strncpy(buf, s.c_str(), bufSize - 1);
    buf[bufSize - 1] = '\0';
}

// === Panic key (KalkKey jako uint8_t) ===
static void savePanicKey(uint8_t key) {
    Preferences prefs;
    prefs.begin(_WP_NS, false);
    prefs.putUChar("panic_key", key);
    prefs.end();
}
static uint8_t loadPanicKey(uint8_t defaultKey) {
    Preferences prefs;
    prefs.begin(_WP_NS, true);
    uint8_t k = prefs.getUChar("panic_key", defaultKey);
    prefs.end();
    return k;
}

// kalkSaveSettings / kalkLoadSettings zdefiniowane w settings_screen.h
// (musza byc po definicji struct kalkSettings)

