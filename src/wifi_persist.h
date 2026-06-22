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

// === Lista zapamietanych sieci (jak w telefonie) ===
// Przechowywane jako n0_s/n0_p .. n7_s/n7_p + licznik "netcnt".
// Indeks 0 = ostatnio uzyta. Primary (_WP_SSID/_WP_PASS) = idx 0 (kompat z
// istniejacym auto-connect).
#define _WP_MAX_NETS 8

static uint8_t wifiSavedCount() {
    Preferences prefs; prefs.begin(_WP_NS, true);
    uint8_t c = prefs.getUChar("netcnt", 0);
    prefs.end();
    return c > _WP_MAX_NETS ? _WP_MAX_NETS : c;
}

// Zwraca true gdy slot idx ma zapisana siec; wypelnia bufory (moga byc NULL).
static bool wifiGetSavedNet(uint8_t idx, char* ssidBuf, int ssidSize, char* passBuf, int passSize) {
    if (idx >= _WP_MAX_NETS) return false;
    char ks[12], kp[12];
    snprintf(ks, sizeof(ks), "n%u_s", idx);
    snprintf(kp, sizeof(kp), "n%u_p", idx);
    Preferences prefs; prefs.begin(_WP_NS, true);
    String s = prefs.getString(ks, "");
    String p = prefs.getString(kp, "");
    prefs.end();
    if (ssidBuf) { strncpy(ssidBuf, s.c_str(), ssidSize - 1); ssidBuf[ssidSize - 1] = '\0'; }
    if (passBuf) { strncpy(passBuf, p.c_str(), passSize - 1); passBuf[passSize - 1] = '\0'; }
    return s.length() > 0;
}

// Dodaj/zaktualizuj siec — laduje na poczatek listy (idx 0). Duplikat SSID
// zostaje przesuniety na przod z nowym haslem. Ustawia tez primary.
static void wifiAddNetwork(const char* ssid, const char* pass) {
    if (!ssid || !ssid[0]) return;
    static char ss[_WP_MAX_NETS][33];
    static char pp[_WP_MAX_NETS][64];
    uint8_t cnt = wifiSavedCount();
    int n = 0;
    for (uint8_t i = 0; i < cnt && n < _WP_MAX_NETS - 1; i++) {
        char s[33], p[64];
        if (!wifiGetSavedNet(i, s, sizeof(s), p, sizeof(p))) continue;
        if (strcmp(s, ssid) == 0) continue;  // pomin duplikat (bedzie na przodzie)
        strncpy(ss[n], s, 32); ss[n][32] = '\0';
        strncpy(pp[n], p, 63); pp[n][63] = '\0';
        n++;
    }
    Preferences prefs; prefs.begin(_WP_NS, false);
    prefs.putString("n0_s", ssid);
    prefs.putString("n0_p", pass ? pass : "");
    for (int i = 0; i < n; i++) {
        char ks[12], kp[12];
        snprintf(ks, sizeof(ks), "n%d_s", i + 1);
        snprintf(kp, sizeof(kp), "n%d_p", i + 1);
        prefs.putString(ks, ss[i]);
        prefs.putString(kp, pp[i]);
    }
    prefs.putUChar("netcnt", (uint8_t)(n + 1));
    prefs.putString(_WP_SSID, ssid);
    prefs.putString(_WP_PASS, pass ? pass : "");
    prefs.end();
}

// Usun zapamietana siec o indeksie idx (przesuwa pozostale).
static void wifiForgetNetwork(uint8_t idx) {
    uint8_t cnt = wifiSavedCount();
    if (idx >= cnt) return;
    static char ss[_WP_MAX_NETS][33];
    static char pp[_WP_MAX_NETS][64];
    int n = 0;
    for (uint8_t i = 0; i < cnt; i++) {
        if (i == idx) continue;
        char s[33], p[64];
        wifiGetSavedNet(i, s, sizeof(s), p, sizeof(p));
        strncpy(ss[n], s, 32); ss[n][32] = '\0';
        strncpy(pp[n], p, 63); pp[n][63] = '\0';
        n++;
    }
    Preferences prefs; prefs.begin(_WP_NS, false);
    for (int i = 0; i < n; i++) {
        char ks[12], kp[12];
        snprintf(ks, sizeof(ks), "n%d_s", i);
        snprintf(kp, sizeof(kp), "n%d_p", i);
        prefs.putString(ks, ss[i]);
        prefs.putString(kp, pp[i]);
    }
    { char ks[12], kp[12]; snprintf(ks,sizeof(ks),"n%d_s",n); snprintf(kp,sizeof(kp),"n%d_p",n); prefs.remove(ks); prefs.remove(kp); }
    prefs.putUChar("netcnt", (uint8_t)n);
    if (n > 0) { prefs.putString(_WP_SSID, ss[0]); prefs.putString(_WP_PASS, pp[0]); }
    else       { prefs.remove(_WP_SSID); prefs.remove(_WP_PASS); }
    prefs.end();
}

// Jednorazowa migracja: jezeli lista pusta, a istnieje stara pojedyncza siec
// (_WP_SSID/_WP_PASS) — przenies ja do listy zapamietanych.
static void wifiEnsureListSeeded() {
    if (wifiSavedCount() > 0) return;
    char s[33] = "", p[64] = "";
    if (wifiLoadSaved(s, sizeof(s), p, sizeof(p))) wifiAddNetwork(s, p);
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

// === Szybki reconnect WiFi — cache BSSID + kanal AP ===
// Po udanym polaczeniu wywolaj wifiSaveBssidChannel(). Nastepny WiFi.begin
// via wifiFastBegin() podaje AP hint i pomija ~1-3s skanowania.

static void wifiSaveBssidChannel() {
    if (WiFi.status() != WL_CONNECTED) return;
    uint8_t* bssid = WiFi.BSSID();
    int32_t  ch    = WiFi.channel();
    if (!bssid || ch <= 0) return;
    Preferences prefs;
    prefs.begin(_WP_NS, false);
    prefs.putBytes("bssid", bssid, 6);
    prefs.putInt ("chan",  ch);
    prefs.end();
}

// Laduje BSSID i kanal z NVS. Zwraca true gdy dane sa wazne.
static bool wifiLoadBssidChannel(uint8_t* bssidOut, int32_t& channelOut) {
    Preferences prefs;
    prefs.begin(_WP_NS, true);
    size_t n   = prefs.getBytes("bssid", bssidOut, 6);
    channelOut = prefs.getInt ("chan",  0);
    prefs.end();
    if (n != 6 || channelOut <= 0) return false;
    // Sprawdz czy BSSID nie jest zerowy (brak danych)
    for (int i = 0; i < 6; i++) if (bssidOut[i]) return true;
    return false;
}

// WiFi.begin z hint BSSID+kanal gdy dostepny — pomija skan, szybszy o 1-3s.
static void wifiFastBegin(const char* ssid, const char* pass) {
    uint8_t bssid[6];
    int32_t ch;
    if (wifiLoadBssidChannel(bssid, ch)) {
        Serial.printf("[WiFi] fast begin ch=%d bssid=%02X:%02X:%02X:%02X:%02X:%02X\n",
                      ch, bssid[0],bssid[1],bssid[2],bssid[3],bssid[4],bssid[5]);
        WiFi.begin(ssid, pass, ch, bssid);
    } else {
        WiFi.begin(ssid, pass);
    }
}

// kalkSaveSettings / kalkLoadSettings zdefiniowane w settings_screen.h
// (musza byc po definicji struct kalkSettings)

