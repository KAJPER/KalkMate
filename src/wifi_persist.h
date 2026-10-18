#pragma once
// wifi_persist.h — zapis/odczyt WiFi SSID+hasla i klucza licencji w NVS (Preferences)
// Wywolanie: wifiSaveCreds(ssid, pass) / wifiLoadSaved(ssid, pass) / wifiLoadLicense(key)
//
// Uzyj #include "wifi_persist.h" przed wifi_settings.h i solve_screen.h

#include <Preferences.h>
#include <WiFi.h>
#include <lwip/dns.h>
#include "event_log.h"   // logEventf — diagnostyka DNS trafia tez do panelu admina

#define _WP_NS        "kalkmate"   // przestrzen nazw NVS
#define _WP_SSID      "wifi_ssid"
#define _WP_PASS      "wifi_pass"
#define _WP_LIC       "license"
#define _WP_DEV_TOKEN "dev_token"  // unikalny token urzadzenia (64 znaki hex)

// Tozsamosc urzadzenia — osobny namespace, ktorego reset fabryczny NIE czysci
// (kontrakt K5). Trzyma dev_token oraz flage "unpair" (ustawiana przez reset
// fabryczny: przy nastepnej rejestracji serwer ma odpiac urzadzenie od konta).
#define _WP_ID_NS     "kalkid"
#define _WP_UNPAIR    "unpair"

// Moc nadawania radia STA. Domyslnie pelna (19.5 dBm) — tak urzadzenie
// faktycznie pracowalo w fw <= 1.9.x i 2.0.x na zimnym starcie.
//
// Historia (2026-10-18): audyt 2026-10-17 zamienil WiFi.mode(WIFI_STA) na
// wifiStaOnLimited() ze limitem 8.5 dBm we WSZYSTKICH sciezkach (solve,
// Status konta, notatki...). Ale setTxPower() po WiFi.mode() przegrywa wyscig
// z asynchronicznym STA_START ("setTxPower(): Neither AP or STA has been
// started" w logach), wiec limit dzialal losowo: na zimnym starcie NIE, a w
// ponownych probach polaczenia (radio juz wystartowane) TAK. Efekt: jedno
// uruchomienie ma 19.5 dBm i dziala, kolejne 8.5 dBm i slaby uplink do AP
// (hotspot iPhone, RSSI -70) = AUTH_EXPIRE, timeouty DNS/TCP, "Blad polaczenia
// (-1)". Teraz moc jest ustawiana deterministycznie (czeka na STA_START) i
// jest jedna stala. Jesli kiedys wroci brownout przy nadawaniu, obniz ja TU
// (np. -DKALK_WIFI_TX_POWER=WIFI_POWER_15dBm) zamiast limitowac tylko czesc
// sciezek.
// 8.5 dBm jak w 1.9.x. Diagnoza 2026-10-18 (tcpdump na VPS): przy 19.5 dBm
// kalkulatory GUBILY WLASNE NADAWANE PAKIETY (SYN/ACK/upload zdjecia), odbior
// dzialal — spadki napiecia przy peaku TX radia, a brownout detector jest
// wylaczony (main.cpp), wiec zamiast resetu radio nadaje smieci. NIE PODNOSIC
// bez pomiaru zasilania pod obciazeniem WiFi.
#ifndef KALK_WIFI_TX_POWER
#define KALK_WIFI_TX_POWER WIFI_POWER_8_5dBm
#endif

// Wlacza tryb STA i ustawia moc nadawania (KALK_WIFI_TX_POWER). Wolac zamiast
// samego WiFi.mode(WIFI_STA) — kazde wylaczenie radia (WiFi.disconnect(true) /
// WIFI_OFF) przywraca domyslna moc, wiec ustawienie trzeba powtorzyc po
// kazdym ponownym wlaczeniu STA.
static void wifiStaOnLimited() {
    WiFi.mode(WIFI_STA);
    // setTxPower() zwraca false dopoki nie przyszedl event STA_START —
    // poczekaj (max ~600 ms) zamiast cicho zostawic radio na innej mocy.
    bool applied = false;
    for (int i = 0; i < 30 && !applied; i++) {
        applied = WiFi.setTxPower(KALK_WIFI_TX_POWER);
        if (!applied) delay(20);
    }
    Serial.printf("[WiFi] TX power: %s (cel=%d, jedn. 0.25 dBm, get=%d)\n",
                  applied ? "OK" : "NIE USTAWIONA", (int)KALK_WIFI_TX_POWER, (int)WiFi.getTxPower());
}

// millis() ostatniego WiFi.begin (0 = jeszcze nie bylo) — do wykrywania, ze
// laczenie JUZ trwa. Drugi WiFi.begin w trakcie zrywa swiezo nawiazane
// skojarzenie (ASSOC_LEAVE), a hotspot iPhone potem odrzuca kolejne proby
// (AUTH_EXPIRE, 4WAY_HANDSHAKE_TIMEOUT, TIMEOUT) — burza z logu 2026-10-18:
// auto-connect z loop() dostal STA_CONNECTED i w tej samej sekundzie
// _solEnsureWifi() (status jeszcze != CONNECTED, bo brak GOT_IP) zrobil
// kolejny begin.
static uint32_t _wifiBeginAt = 0;
static bool _wifiHintUsed = false;   // czy ostatni begin mial hint BSSID+kanal

static bool wifiJoinInProgress(uint32_t windowMs = 20000) {
    if (_wifiBeginAt == 0) return false;
    if ((WiFi.getMode() & WIFI_MODE_STA) == 0) return false;
    if (WiFi.status() == WL_CONNECTED) return false;
    return (millis() - _wifiBeginAt) < windowMs;
}

// STA + moc + WiFi.begin(ssid, pass) — chyba ze laczenie juz trwa.
static void wifiConnectStart(const char* ssid, const char* pass) {
    if (wifiJoinInProgress()) {
        Serial.println("[WiFi] laczenie juz trwa — nie restartuje");
        return;
    }
    wifiStaOnLimited();
    WiFi.begin(ssid, pass);
    _wifiBeginAt = millis() | 1;
    _wifiHintUsed = false;
}

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

// === Unikalny token urzadzenia (przydzielany przez serwer przy rejestracji) ===
// Zapis zawsze do "kalkid" (przezywa reset fabryczny). Zwraca false przy
// bledzie NVS (logowane bez wartosci tokenu).
static bool wifiSaveDeviceToken(const char* token) {
    if (!token) return false;
    Preferences prefs;
    if (!prefs.begin(_WP_ID_NS, false)) {
        Serial.println("[NVS] BLAD: nie mozna otworzyc kalkid (dev_token)");
        return false;
    }
    size_t n = prefs.putString(_WP_DEV_TOKEN, token);
    prefs.end();
    if (n != strlen(token)) {
        Serial.println("[NVS] BLAD zapisu dev_token");
        return false;
    }
    return true;
}

// buf musi miec min. 65 bajtow (64 znaki hex + \0)
// Odczyt najpierw z "kalkid"; gdy pusto — fallback do starego miejsca
// ("kalkmate", firmware sprzed K5) i jednorazowa migracja do "kalkid".
// Stary klucz zostaje (inny kod moze go jeszcze czytac); po migracji odczyt
// i tak bierze "kalkid".
static void wifiLoadDeviceToken(char* buf, int size) {
    Preferences prefs;
    String t = "";
    if (prefs.begin(_WP_ID_NS, true)) {   // read-only: false gdy namespace jeszcze nie istnieje
        t = prefs.getString(_WP_DEV_TOKEN, "");
        prefs.end();
    }
    if (t.length() == 0) {
        if (prefs.begin(_WP_NS, true)) {
            t = prefs.getString(_WP_DEV_TOKEN, "");
            prefs.end();
        }
        if (t.length() > 0 && wifiSaveDeviceToken(t.c_str())) {
            Serial.println("[NVS] dev_token zmigrowany do kalkid");
        }
    }
    strncpy(buf, t.c_str(), size - 1);
    buf[size - 1] = '\0';
}

// Flaga "unpair" (K5) — ustawiana przez reset fabryczny w "kalkid".
static bool wifiFactoryUnpairPending() {
    Preferences prefs;
    if (!prefs.begin(_WP_ID_NS, true)) return false;
    bool v = prefs.getBool(_WP_UNPAIR, false);
    prefs.end();
    return v;
}

// Kasuje flage "unpair" po potwierdzeniu przez serwer (HTTP 200).
static bool wifiClearFactoryUnpair() {
    Preferences prefs;
    if (!prefs.begin(_WP_ID_NS, false)) {
        Serial.println("[NVS] BLAD: nie mozna otworzyc kalkid (unpair)");
        return false;
    }
    bool ok = (prefs.putBool(_WP_UNPAIR, false) == 1);
    prefs.end();
    if (!ok) Serial.println("[NVS] BLAD zapisu flagi unpair");
    return ok;
}

// === Kod odblokowujacy tryb AI ===
// Zwraca false przy bledzie NVS (logowane bez wartosci kodu).
static bool saveAiCode(const char* code) {
    if (!code) return false;
    Preferences prefs;
    if (!prefs.begin(_WP_NS, false)) {
        Serial.println("[NVS] BLAD: nie mozna otworzyc kalkmate (ai_code)");
        return false;
    }
    size_t n = prefs.putString("ai_code", code);
    prefs.end();
    if (n != strlen(code)) {
        Serial.println("[NVS] BLAD zapisu kodu AI");
        return false;
    }
    return true;
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
    prefs.putString("bssid_ssid", WiFi.SSID());  // do ktorej sieci ten hint nalezy
    prefs.end();
}

// Laduje BSSID i kanal z NVS, TYLKO jesli zostaly zapisane dla TEJ SAME sieci
// (ssidWanted) — inaczej hint jest z innej sieci (np. user przelaczyl WiFi w
// Ustawieniach) i wskazywalby na zupelnie zly AP, co gwarantowanie failuje
// polaczenie mimo poprawnego hasla i NIE naprawia sie samo (hint nigdy nie
// jest odswiezany poza udanym fast-begin — patrz wifiFastBegin). Zwraca true
// gdy dane sa wazne i naleza do ssidWanted.
static bool wifiLoadBssidChannel(const char* ssidWanted, uint8_t* bssidOut, int32_t& channelOut) {
    Preferences prefs;
    prefs.begin(_WP_NS, true);
    size_t n   = prefs.getBytes("bssid", bssidOut, 6);
    channelOut = prefs.getInt ("chan",  0);
    String savedSsid = prefs.getString("bssid_ssid", "");
    prefs.end();
    if (n != 6 || channelOut <= 0) return false;
    if (!ssidWanted || savedSsid != String(ssidWanted)) return false;
    // Sprawdz czy BSSID nie jest zerowy (brak danych)
    for (int i = 0; i < 6; i++) if (bssidOut[i]) return true;
    return false;
}

#ifndef KALKMATE_HOST
#define KALKMATE_HOST "kalkmate.pl"
#endif

static void _wifiSetDns(const IPAddress& a, const IPAddress& b) {
    ip_addr_t d;
    IP_ADDR4(&d, a[0], a[1], a[2], a[3]);
    dns_setserver(0, &d);
    IP_ADDR4(&d, b[0], b[1], b[2], b[3]);
    dns_setserver(1, &d);
}

// Zapasowy serwer DNS (8.8.8.8) w DRUGIM slocie lwIP — serwer z DHCP (slot 0)
// zostaje bez zmian, a lwIP przechodzi na zapasowy sam, gdy pierwszy nie
// odpowiada. Wolac po kazdym udanym polaczeniu; tania i NIE dotyka DHCP.
//
// BYLO (commit 3385862, 2026-10-17): WiFi.config(0,0,0,8.8.8.8,1.1.1.1).
// W core 2.0.17 to NIE jest "tylko ustaw DNS" — set_esp_interface_ip() zatrzymuje
// klienta DHCP, zeruje IP (0.0.0.0) i startuje DHCP od nowa, a do tego ustawia
// _useStaticIp. Wolane tuz po WL_CONNECTED i tuz przed pierwszym HTTPS
// (_solEnsureWifi -> accountRegisterOnce) powodowalo okno bez adresu IP:
// DNS 13 s timeout, TCP connect -1, a gdy DHCP sie nie powtorzyl (hotspot
// iPhone) siec byla martwa do restartu mimo WL_CONNECTED.
static void wifiApplyDnsFallback() {
    ip_addr_t cur = *dns_getserver(1);
    if (!ip_addr_isany(&cur)) {   // slot 1 juz zajety (np. DHCP podal 2 serwery)
        Serial.println("[WiFi] DNS: zapasowy serwer juz ustawiony");
        return;
    }
    ip_addr_t d;
    IP_ADDR4(&d, 8, 8, 8, 8);
    dns_setserver(1, &d);
    Serial.println("[WiFi] DNS: zapasowy 8.8.8.8 w slocie 1 (DHCP nietkniete)");
}

// Czeka az interfejs STA faktycznie dostanie adres IP. WL_CONNECTED w Arduino
// to tylko flaga zdarzenia — po rozlaczeniu/DHCP-u bywa nieaktualna. Zwraca
// true gdy IP != 0.0.0.0 (od razu, jesli juz jest).
static bool wifiWaitForIp(uint32_t timeoutMs = 8000, volatile bool* abortFlag = nullptr) {
    uint32_t t0 = millis();
    while (WiFi.localIP() == IPAddress(0, 0, 0, 0)) {
        if (abortFlag && *abortFlag) return false;
        if (millis() - t0 >= timeoutMs) {
            Serial.printf("[WiFi] brak IP po %lu ms (status=%d RSSI=%d)\n",
                          (unsigned long)(millis() - t0), (int)WiFi.status(), WiFi.RSSI());
            logEventf("WIFI", "brak IP po %lums st=%d rssi=%d", (unsigned long)(millis() - t0),
                      (int)WiFi.status(), WiFi.RSSI());
            return false;
        }
        delay(50);
    }
    return true;
}

// PRAWDZIWE sprawdzenie DNS (2026-10-18). wifiApplyDnsFallback() tylko USTAWIA
// adresy i loguje "OK" niezaleznie od tego, czy cokolwiek sie rozwiaze —
// w logu bylo "DNS fallback OK", a zaraz potem "hostByName(): DNS Failed for
// kalkmate.pl" (13 s timeoutu lwIP, potem "connection refused (-1)"). Tu
// faktycznie rozwiazujemy nazwe, z trzema strategiami po kolei:
//   0) serwery DNS tak jak sa teraz (DHCP albo wczesniejszy fallback),
//   1) brama (przy hotspocie z telefonu to wlasnie jego relay DNS) + 8.8.8.8,
//   2) publiczne 8.8.8.8 / 1.1.1.1 wpisane wprost do lwIP.
// Udany lookup zostaje w cache lwIP, wiec zaraz potem HTTPClient trafia w
// cache zamiast pytac jeszcze raz. abortFlag (opcjonalny) pozwala przerwac
// miedzy probami (panic).
static bool _wifiEnsureDnsImpl(const char* host, volatile bool* abortFlag) {
    // Bez adresu IP kazdy lookup konczy sie 13-14 s timeoutem — wczesniej to
    // wygladalo jak "zepsuty DNS", a naprawde interfejs nie mial IP.
    if (!wifiWaitForIp(8000, abortFlag)) return false;
    wifiApplyDnsFallback();   // drugi serwer (8.8.8.8) zawsze obecny — idempotentne, DHCP nietkniete
    for (int attempt = 0; attempt < 3; attempt++) {
        if (abortFlag && *abortFlag) return false;
        // Log 2026-10-18 (hotspot iPhone, RSSI -71): DHCP/brama 172.20.10.1
        // padla 2x po 13 s, publiczne 8.8.8.8 odpowiedzialo za 6 s — publiczne
        // idzie przed brama.
        if (attempt == 1) _wifiSetDns(IPAddress(8, 8, 8, 8), IPAddress(1, 1, 1, 1));
        else if (attempt == 2) _wifiSetDns(WiFi.gatewayIP(), IPAddress(8, 8, 8, 8));
        IPAddress ip;
        uint32_t t0 = millis();
        if (WiFi.hostByName(host, ip)) {
            Serial.printf("[DNS] %s -> %s (%lu ms, strategia %d)\n", host, ip.toString().c_str(),
                          (unsigned long)(millis() - t0), attempt);
            if (attempt > 0) logEventf("DNS", "ok po strategii %d (%lu ms)", attempt, (unsigned long)(millis() - t0));
            return true;
        }
        String d0 = WiFi.dnsIP(0).toString(), d1 = WiFi.dnsIP(1).toString(), gw = WiFi.gatewayIP().toString();
        Serial.printf("[DNS] strategia %d NIEUDANA (%lu ms) dns0=%s dns1=%s gw=%s RSSI=%d\n", attempt,
                      (unsigned long)(millis() - t0), d0.c_str(), d1.c_str(), gw.c_str(), WiFi.RSSI());
        logEventf("DNS", "fail s%d dns0=%s dns1=%s gw=%s rssi=%d", attempt, d0.c_str(), d1.c_str(), gw.c_str(), WiFi.RSSI());
    }
    return false;
}

// Jedno rozwiazywanie na raz: zadanie rozgrzewajace w tle (main.cpp) i
// wysylka z UI nie moga jednoczesnie przestawiac serwerow DNS. Drugi
// wolajacy czeka i zwykle trafia juz w cache lwIP.
static volatile uint32_t _wifiDnsBusy = 0;
static bool wifiEnsureDns(const char* host = KALKMATE_HOST, volatile bool* abortFlag = nullptr) {
    uint32_t w0 = millis();
    while (__sync_lock_test_and_set(&_wifiDnsBusy, 1)) {
        if ((abortFlag && *abortFlag) || millis() - w0 > 50000) return false;
        delay(50);
    }
    bool ok = _wifiEnsureDnsImpl(host, abortFlag);
    __sync_lock_release(&_wifiDnsBusy);
    return ok;
}

// WiFi.begin z hint BSSID+kanal gdy dostepny dla TEJ sieci — pomija skan,
// szybszy o 1-3s. Gdy hint jest z innej sieci (albo go brak), zwykly begin.
static void wifiFastBegin(const char* ssid, const char* pass) {
    uint8_t bssid[6];
    int32_t ch;
    if (wifiLoadBssidChannel(ssid, bssid, ch)) {
        // Bez BSSID w logu (M9) — identyfikuje konkretny router/lokalizacje.
        Serial.printf("[WiFi] fast begin ch=%d (hint BSSID)\n", (int)ch);
        WiFi.begin(ssid, pass, ch, bssid);
        _wifiHintUsed = true;
    } else {
        WiFi.begin(ssid, pass);
        _wifiHintUsed = false;
    }
    _wifiBeginAt = millis() | 1;
}

// kalkSaveSettings / kalkLoadSettings zdefiniowane w settings_screen.h
// (musza byc po definicji struct kalkSettings)

