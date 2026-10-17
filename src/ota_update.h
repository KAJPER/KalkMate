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
// Signed OTA: weryfikacja ECDSA P-256 podpisu firmware przez mbedtls
// (mbedtls jest juz w ESP-IDF, nie wymaga external lib).
#include <mbedtls/pk.h>
#include <mbedtls/sha256.h>
#include <Preferences.h>
#include <esp_ota_ops.h>
#include <esp_partition.h>
#include "kalkmate_certs.h"  // KALKMATE_CA_CERT
#include "battery.h"         // batteryReadMillivolts / batteryIsCharging — bramka OTA

#ifndef KALK_SERVER_URL
#error "ota_update.h wymaga zdefiniowania KALK_SERVER_URL przed include"
#endif
#ifndef FW_VERSION
#error "ota_update.h wymaga zdefiniowania FW_VERSION przed include"
#endif

#define _OTA_CHECK_ENDPOINT  KALK_SERVER_URL "/api/device/firmware/check"
#define _OTA_HTTP_TIMEOUT_MS 30000

// Pobieranie .bin: przerwij gdy przez 15 s nie przyjdzie zaden bajt albo
// calosc trwa dluzej niz 10 min (wczesniej petla mogla wisiec bez konca).
#define _OTA_STALL_TIMEOUT_MS  15000UL
#define _OTA_TOTAL_TIMEOUT_MS  (10UL * 60UL * 1000UL)

// Minimalne napiecie LiPo do startu OTA (chyba ze laduje / USB wpiete).
// Zanik zasilania w trakcie zapisu jest bezpieczny dla bootloadera (stara
// partycja zostaje), ale brownout w polowie = zmarnowana proba i ryzyko
// boot-loopu przy slabej baterii zaraz po restarcie.
#define _OTA_MIN_BATTERY_MV    3700

// Zdrowy boot: po tylu ms nieprzerwanej pracy licznik bootow oczekujacej
// walidacji jest zerowany (patrz otaBootCheck).
#define _OTA_HEALTHY_BOOT_MS   60000UL

// K4: wariant sprzetu wysylany do serwera przy sprawdzaniu aktualizacji,
// zeby nie dostac binarki z innego PCB.
#ifdef KALK_HW_LEGACY
  #define _OTA_HW_VARIANT "legacy"
#else
  #define _OTA_HW_VARIANT "s3"
#endif

// Zdefiniowane nizej (sekcja rollback) — otaCheck() wola przy HTTP 200.
inline void otaConfirmServerOk();

// Jezyk UI (0=PL,1=EN,2=DE) — implementacja w settings_screen.h (po pelnej
// definicji kalkSettings). Forward-deklarowane tu zeby ota_update.h zostal
// self-contained i mogl byc wlaczony PRZED definicja struct KalkMateSettings
// (settings_screen.h robi #include "ota_update.h" wczesniej niz definiuje
// kalkSettings).
extern int otaGetLanguage();
static const char* _otaT(const char* pl, const char* en, const char* de) {
    int l = otaGetLanguage();
    if (l == 0) return pl;
    if (l == 1) return en;
    return de;
}

struct OtaInfo {
    bool   available;     // true gdy nowa wersja > FW_VERSION
    String latestVersion; // wersja zwrocona przez serwer (lub pusta)
    String url;           // URL do .bin
    String notes;         // changelog / opis
    String sig;           // ECDSA P-256 base64 podpis SHA256(bin) (od v1.4.1)
    String error;         // pusty gdy OK, inaczej komunikat bledu
};

// ---------------------------------------------------------------------
//  Helper: porownanie wersji semver (np. "0.1.0" vs "0.2.0")
//  Zwraca: 1 gdy a > b, 0 gdy a == b, -1 gdy a < b
//
//  W kazdym segmencie (miedzy kropkami) liczy sie tylko PIERWSZY ciag cyfr:
//  "7-rc1" -> 7 (wczesniej cyfry byly sklejane: 71), "v1" -> 1. Reszta
//  segmentu (sufiks pre-release) jest ignorowana, wiec "1.9.7-rc1" == "1.9.7".
// ---------------------------------------------------------------------
static int _otaVerSegment(const String& s, int& i) {
    int n = 0;
    bool inDigits = false, done = false;
    while (i < (int)s.length() && s[i] != '.') {
        char c = s[i];
        if (!done && c >= '0' && c <= '9') {
            inDigits = true;
            if (n < 100000) n = n * 10 + (c - '0');   // limit — bez przepelnienia int
        } else if (inDigits) {
            done = true;   // koniec pierwszego ciagu cyfr
        }
        i++;
    }
    return n;
}

static int _otaVerCmp(const String& a, const String& b) {
    int ai = 0, bi = 0;
    while (ai < (int)a.length() || bi < (int)b.length()) {
        int an = _otaVerSegment(a, ai);
        int bn = _otaVerSegment(b, bi);
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
    client.setCACert(KALKMATE_CA_CERT);
    client.setTimeout(30);
    HTTPClient http;
    String url = String(_OTA_CHECK_ENDPOINT) + "?current=" + FW_VERSION;
    http.begin(client, url);
    http.addHeader("x-api-key", KALK_API_KEY);
    {
        uint8_t mac[6];
        esp_read_mac(mac, ESP_MAC_WIFI_STA);
        char did[16];
        snprintf(did, sizeof(did), "%02X%02X%02X%02X%02X%02X",
                 mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
        http.addHeader("x-device-id", did);
    }
    http.addHeader("x-fw-version", FW_VERSION);
    http.addHeader("x-hw-variant", _OTA_HW_VARIANT);   // K4
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
    // Udane HTTPS do kalkmate.pl = ten firmware umie sie zaktualizowac dalej.
    otaConfirmServerOk();

    info.latestVersion = _otaJsonField(body, "version");
    info.url           = _otaJsonField(body, "url");
    info.notes         = _otaJsonField(body, "notes");
    info.sig           = _otaJsonField(body, "sig");   // ECDSA P-256 base64, opcjonalne

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
    d.drawStr(2, 60, _otaT("Nie wylaczaj urzadzenia!", "Do not turn off the device!", "Geraet nicht ausschalten!"));

    d.sendBuffer();
}

// === ECDSA P-256 signing public key ===
// Wygenerowany na serwerze (kalkmate.pl), parny klucz prywatny w
// /home/ubuntu/kalkulator/keys/firmware_signing.pem. Tylko ten klucz moze
// podpisac firmware - jezeli ktos podmieni serwer ale nie ma klucza, weryfikacja
// na urzadzeniu zawiedzie i OTA nie zainstaluje sie.
static const char _OTA_PUBLIC_KEY_PEM[] =
    "-----BEGIN PUBLIC KEY-----\n"
    "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEQxvaN+MwX/l1QMbnXkqbkLk/17sY\n"
    "Nk6P0+wqp94IGa2xucxLevcoEfa9QhG5SXXTjICEnnZY4gpfjjxwFWProQ==\n"
    "-----END PUBLIC KEY-----\n";

// Dekoder base64 -> bytes. Zwraca rozmiar wynikowy.
inline size_t _otaBase64Decode(const String& in, uint8_t* out, size_t outMax) {
    auto val = [](char c) -> int {
        if (c >= 'A' && c <= 'Z') return c - 'A';
        if (c >= 'a' && c <= 'z') return c - 'a' + 26;
        if (c >= '0' && c <= '9') return c - '0' + 52;
        if (c == '+') return 62;
        if (c == '/') return 63;
        return -1;
    };
    size_t outLen = 0;
    int buf = 0, bits = 0;
    for (size_t i = 0; i < in.length(); i++) {
        char c = in[i];
        if (c == '=' || c == '\n' || c == '\r' || c == ' ') continue;
        int v = val(c);
        if (v < 0) continue;
        buf = (buf << 6) | v;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            if (outLen >= outMax) return outLen;
            out[outLen++] = (uint8_t)((buf >> bits) & 0xFF);
        }
    }
    return outLen;
}

// ---------------------------------------------------------------------
//  Rollback support — health-check po aktualizacji OTA.
//
//  Mechanizm:
//    1. otaMarkPendingValidation() — wywolaj zaraz po Update.end() (PRZED
//       jakimkolwiek delay/restartem). Zapisuje do NVS "boot_cnt=0" i "pending=true".
//    2. otaBootCheck() — wywolaj wczesnie w setup(). Jesli pending, inkrementuje
//       licznik. Jesli >= 3 proby (boot loop) — rollback na poprzednia partycje.
//       Po 60 s nieprzerwanej pracy licznik jest zerowany (boot "zdrowy") —
//       uczen, ktory kilka razy wlaczy urzadzenie tylko jako kalkulator, nie
//       wywola falszywego rollbacku. Firmware NIE jest wtedy jeszcze zatwierdzany.
//    3. otaConfirmServerOk() / otaMarkValid() — po pierwszej odpowiedzi HTTPS
//       200 z kalkmate.pl (register / account-status / firmware check).
//       Czysci flage. Samo WL_CONNECTED nie wystarcza: firmware z zepsutym
//       TLS polaczylby sie z WiFi, ale nie pobralby juz zadnej aktualizacji.
//
//  Uwaga: rdzen Arduino (CONFIG_APP_ROLLBACK_ENABLE) sam zatwierdza obraz w
//  otadata zaraz przy starcie — powyzszy mechanizm (NVS + recznie
//  esp_ota_set_boot_partition) dziala niezaleznie od tego.
// ---------------------------------------------------------------------

// RAM: czy biezacy boot jest niezwalidowanym bootem po OTA (ustawiane w otaBootCheck).
static bool _otaPendingThisBoot = false;

inline bool otaIsPendingValidation() { return _otaPendingThisBoot; }

inline bool otaMarkPendingValidation() {
    Preferences p;
    if (!p.begin("ota_rb", false)) {
        Serial.println("[OTA] BLAD NVS: nie mozna otworzyc ota_rb (pending)");
        return false;
    }
    // Najpierw licznik, potem flaga — zanik zasilania pomiedzy nie zostawi
    // pending=true ze starym, niezerowym licznikiem.
    bool ok = (p.putInt("boot_cnt", 0) == 4);
    ok = (p.putBool("pending", true) == 1) && ok;
    p.end();
    if (ok) Serial.println("[OTA] oznaczono jako oczekujacy walidacji");
    else    Serial.println("[OTA] BLAD zapisu flagi walidacji — brak ochrony przed boot-loopem");
    return ok;
}

// Zwraca true gdy nie ma juz nic do walidacji (zatwierdzono albo nie bylo OTA).
inline bool otaMarkValid() {
    Preferences p;
    // read-only begin() zwraca false gdy namespace nie istnieje = nigdy nie bylo OTA
    if (!p.begin("ota_rb", true)) { _otaPendingThisBoot = false; return true; }
    bool pending = p.getBool("pending", false);
    p.end();
    if (!pending) { _otaPendingThisBoot = false; return true; }
    if (!p.begin("ota_rb", false)) {
        Serial.println("[OTA] BLAD NVS: nie mozna otworzyc ota_rb (walidacja)");
        return false;
    }
    bool ok = (p.putBool("pending", false) == 1);
    if (ok && p.putInt("boot_cnt", 0) != 4) {
        Serial.println("[OTA] BLAD zapisu licznika bootow (walidacja)");
    }
    p.end();
    if (!ok) {
        Serial.println("[OTA] BLAD zapisu walidacji firmware — ponowie przy nastepnym HTTPS 200");
        return false;
    }
    _otaPendingThisBoot = false;
    Serial.println("[OTA] firmware zawalidowany (HTTPS 200 z kalkmate.pl)");
    return true;
}

// Wolac po kazdej odpowiedzi HTTP 200 z kalkmate.pl. Pierwsze udane
// wywolanie w danym boocie zatwierdza firmware po OTA; kolejne to no-op.
inline void otaConfirmServerOk() {
    static bool _done = false;
    if (_done) return;
    _done = otaMarkValid();
}

// (a) Zdrowy boot: osobny task, bo setup() przez pierwsze minuty zwykle
// siedzi w runCalculator() (do loop() dochodzi dopiero po wejsciu w tryb AI),
// a uczen moze w ogole nie wejsc w tryb AI. Task powstaje TYLKO w bootach
// oczekujacych walidacji, robi jeden zapis NVS i sie konczy.
static void _otaHealthyBootTask(void*) {
    while (millis() < _OTA_HEALTHY_BOOT_MS) vTaskDelay(pdMS_TO_TICKS(1000));
    Preferences p;
    if (p.begin("ota_rb", false)) {
        if (p.getBool("pending", false) && p.getInt("boot_cnt", 0) != 0) {
            if (p.putInt("boot_cnt", 0) == 4)
                Serial.println("[OTA] 60 s stabilnej pracy — licznik bootow wyzerowany (firmware nadal niezwalidowany)");
            else
                Serial.println("[OTA] BLAD zapisu licznika bootow (zdrowy boot)");
        }
        p.end();
    } else {
        Serial.println("[OTA] BLAD NVS: nie mozna otworzyc ota_rb (zdrowy boot)");
    }
    vTaskDelete(NULL);
}

inline void otaBootCheck() {
    Preferences p;
    if (!p.begin("ota_rb", false)) {
        Serial.println("[OTA] BLAD NVS: nie mozna otworzyc ota_rb (boot check)");
        return;
    }
    bool pending = p.getBool("pending", false);
    if (!pending) { p.end(); return; }

    int cnt = p.getInt("boot_cnt", 0) + 1;
    // Gdy zapis sie nie uda, licznik stoi w miejscu => brak rollbacku
    // (bezpieczny kierunek: niczego nie przelaczamy na slepo).
    if (p.putInt("boot_cnt", cnt) != 4) {
        Serial.println("[OTA] BLAD zapisu licznika bootow");
    }
    p.end();
    Serial.printf("[OTA] boot po OTA (niezwalidowany) — proba %d/3\n", cnt);
    if (cnt < 3) {
        _otaPendingThisBoot = true;
        if (xTaskCreate(_otaHealthyBootTask, "ota_hb", 4096, NULL, 1, NULL) != pdPASS) {
            Serial.println("[OTA] BLAD: nie mozna uruchomic taska zdrowego bootu");
        }
        return;
    }

    // Boot loop wykryty — rollback do poprzedniej partycji OTA
    Serial.println("[OTA] BOOT LOOP WYKRYTY — rollback!");
    Preferences p2;
    if (p2.begin("ota_rb", false)) {
        bool ok = (p2.putBool("pending", false) == 1);
        ok = (p2.putInt("boot_cnt", 0) == 4) && ok;
        p2.end();
        if (!ok) Serial.println("[OTA] BLAD zapisu NVS przy rollbacku");
    } else {
        Serial.println("[OTA] BLAD NVS: nie mozna otworzyc ota_rb (rollback)");
    }

    const esp_partition_t* running = esp_ota_get_running_partition();
    esp_partition_iterator_t it = esp_partition_find(
        ESP_PARTITION_TYPE_APP, ESP_PARTITION_SUBTYPE_ANY, NULL);
    const esp_partition_t* fallback = NULL;
    while (it) {
        const esp_partition_t* part = esp_partition_get(it);
        if (part->subtype >= ESP_PARTITION_SUBTYPE_APP_OTA_MIN &&
            part->subtype <= ESP_PARTITION_SUBTYPE_APP_OTA_MAX &&
            part->address != running->address) {
            fallback = part;
            break;
        }
        it = esp_partition_next(it);
    }
    esp_partition_iterator_release(it);

    if (!fallback) {
        // pending juz wyczyszczone — restart dalby ten sam firmware, wiec
        // po prostu kontynuujemy boot.
        Serial.println("[OTA] brak partycji do rollbacku — kontynuuje bez rollbacku");
        return;
    }
    Serial.printf("[OTA] rollback -> %s @ 0x%x\n", fallback->label, fallback->address);
    esp_err_t err = esp_ota_set_boot_partition(fallback);
    if (err != ESP_OK) {
        // Np. obraz w fallbacku nie przechodzi weryfikacji — zostajemy na
        // biezacym firmware (pending wyczyszczone, kolejnych prob nie bedzie).
        Serial.printf("[OTA] rollback NIEUDANY: esp_ota_set_boot_partition = %s (0x%x) — kontynuuje bez rollbacku\n",
                      esp_err_to_name(err), (unsigned)err);
        return;
    }
    delay(500);
    ESP.restart();
}

// ---------------------------------------------------------------------
//  Bramka baterii przed OTA: >= 3.7 V albo ladowanie / USB wpiete.
//  0 mV = brak pomiaru (legacy PCB) i < 500 mV = brak baterii (zasilanie
//  z USB) — wtedy nie blokujemy (tak samo traktuje to wczesny test w setup()).
// ---------------------------------------------------------------------
static bool _otaBatteryOk(U8G2 &d) {
    uint16_t mv = batteryReadMillivolts();
    bool extPower = batteryIsCharging() || batteryIsUsbPresent();
    Serial.printf("[OTA] bateria: %u mV, zasilanie zewn.: %d\n", (unsigned)mv, (int)extPower);
    if (mv < 500 || mv >= _OTA_MIN_BATTERY_MV || extPower) return true;

    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);
    d.drawStr(2, 14, _otaT("Za slaba bateria do aktualizacji", "Battery too low for update", "Akku zu schwach fuer Update"));
    char vb[32];
    snprintf(vb, sizeof(vb), "VBAT = %u.%02u V (min 3.70 V)",
             (unsigned)(mv / 1000), (unsigned)((mv % 1000) / 10));
    d.drawStr(2, 32, vb);
    d.drawStr(2, 50, _otaT("Podlacz ladowarke USB-C", "Connect USB-C charger", "USB-C-Ladegeraet anschliessen"));
    d.sendBuffer();
    delay(3000);
    return false;
}

// ---------------------------------------------------------------------
//  otaInstall — pobiera .bin i wpisuje przez Update API
//  Streaming SHA-256 + ECDSA verify przed commit (od v1.4.1).
//  Pokazuje postep na OLED. Po sukcesie wywoluje ESP.restart().
// ---------------------------------------------------------------------
inline bool otaInstall(U8G2 &d, const String& binUrl, const String& sigB64 = "") {
    Serial.printf("[OTA] install: %s\n", binUrl.c_str());

    if (WiFi.status() != WL_CONNECTED) {
        _otaDrawProgress(d, _otaT("Blad: brak WiFi", "Error: no WiFi", "Fehler: kein WLAN"), 0);
        delay(2000);
        return false;
    }

    if (!_otaBatteryOk(d)) {
        Serial.println("[OTA] odrzucono: za niska bateria");
        return false;
    }

#ifdef KALK_REQUIRE_SIGNED_OTA
    if (sigB64.isEmpty()) {
        Serial.println("[OTA] KALK_REQUIRE_SIGNED_OTA: brak podpisu — install odrzucony");
        _otaDrawProgress(d, _otaT("PROD: brak podpisu!", "PROD: missing signature!", "PROD: fehlende Signatur!"), 0);
        delay(3000);
        return false;
    }
#endif

    // C5: walidacja domeny przed pobraniem — zapobiega przekierowaniu na obcy serwer
    if (!binUrl.startsWith("https://kalkmate.pl/")) {
        Serial.printf("[OTA] ODRZUCONO: zly URL firmware: %s\n", binUrl.c_str());
        _otaDrawProgress(d, _otaT("BLAD: zly URL!", "ERROR: bad URL!", "FEHLER: falsche URL!"), 0);
        delay(3000);
        return false;
    }

    _otaDrawProgress(d, _otaT("Laczenie z serwerem...", "Connecting to server...", "Verbinde mit Server..."), 0);

    WiFiClientSecure client;
    client.setCACert(KALKMATE_CA_CERT);
    client.setTimeout(60);
    HTTPClient http;
    http.begin(client, binUrl);
    http.setTimeout(60000);

    // Auth headers - serwer wymaga API key + device-id sparowanego w bazie
    // zeby zwrocic binarke (zamiast public URL z /public/firmware/).
    http.addHeader("x-api-key", KALK_API_KEY);
    {
        uint8_t mac[6];
        esp_read_mac(mac, ESP_MAC_WIFI_STA);
        char did[16];
        snprintf(did, sizeof(did), "%02X%02X%02X%02X%02X%02X",
                 mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
        http.addHeader("x-device-id", did);
    }
    http.addHeader("x-fw-version", FW_VERSION);

    int code = http.GET();
    if (code != 200) {
        Serial.printf("[OTA] download HTTP %d\n", code);
        char err[48];
        snprintf(err, sizeof(err), _otaT("Blad pobrania: %d", "Download error: %d", "Downloadfehler: %d"), code);
        _otaDrawProgress(d, err, 0);
        delay(3000);
        http.end();
        return false;
    }

    int total = http.getSize();
    if (total <= 0) {
        _otaDrawProgress(d, _otaT("Blad: rozmiar 0", "Error: size 0", "Fehler: Groesse 0"), 0);
        delay(2000);
        http.end();
        return false;
    }
    Serial.printf("[OTA] firmware size: %d B\n", total);

    if (!Update.begin(total)) {
        Serial.printf("[OTA] Update.begin failed: %s\n", Update.errorString());
        _otaDrawProgress(d, _otaT("Blad: brak miejsca", "Error: no space", "Fehler: kein Speicherplatz"), 0);
        delay(3000);
        http.end();
        return false;
    }

    _otaDrawProgress(d, _otaT("Pobieranie firmware...", "Downloading firmware...", "Firmware wird geladen..."), 0);

    // Streaming SHA-256 zeby zweryfikowac podpis po pobraniu
    bool verifySignature = (sigB64.length() > 0);
    mbedtls_sha256_context shaCtx;
    if (verifySignature) {
        mbedtls_sha256_init(&shaCtx);
        mbedtls_sha256_starts(&shaCtx, 0);  // 0 = SHA-256 (1 = SHA-224)
        Serial.println("[OTA] signed mode — bedzie weryfikacja ECDSA");
    } else {
        Serial.println("[OTA] UWAGA: brak podpisu z serwera, install bez weryfikacji");
    }

    WiFiClient* stream = http.getStreamPtr();
    uint8_t buf[1024];
    int written = 0;
    uint32_t lastDraw = 0;
    const uint32_t dlStart = millis();
    uint32_t lastData = dlStart;
    const char* dlFail = nullptr;   // powod przerwania petli (nullptr = normalny koniec)

    while (http.connected() && written < total) {
        uint32_t nowMs = millis();
        if (WiFi.status() != WL_CONNECTED) {
            dlFail = _otaT("Blad: utracono WiFi", "Error: WiFi lost", "Fehler: WLAN verloren");
            break;
        }
        if (nowMs - lastData > _OTA_STALL_TIMEOUT_MS) {
            dlFail = _otaT("Blad: brak danych 15 s", "Error: no data for 15 s", "Fehler: 15 s keine Daten");
            break;
        }
        if (nowMs - dlStart > _OTA_TOTAL_TIMEOUT_MS) {
            dlFail = _otaT("Blad: pobieranie za dlugie", "Error: download too slow", "Fehler: Download zu langsam");
            break;
        }
        size_t avail = stream->available();
        if (avail) {
            int n = stream->readBytes(buf, min(avail, sizeof(buf)));
            if (n <= 0) break;
            if (Update.write(buf, n) != (size_t)n) {
                Serial.printf("[OTA] Update.write failed: %s\n", Update.errorString());
                Update.abort();
                if (verifySignature) mbedtls_sha256_free(&shaCtx);
                _otaDrawProgress(d, _otaT("Blad zapisu", "Write error", "Schreibfehler"), written * 100 / total);
                delay(3000);
                http.end();
                return false;
            }
            // Aktualizuj hash dla weryfikacji
            if (verifySignature) {
                mbedtls_sha256_update(&shaCtx, buf, n);
            }
            written += n;
            lastData = millis();

            uint32_t now = millis();
            if (now - lastDraw > 250) {
                lastDraw = now;
                int pct = written * 100 / total;
                _otaDrawProgress(d, _otaT("Pobieranie firmware...", "Downloading firmware...", "Firmware wird geladen..."), pct);
            }
        } else {
            delay(1);
        }
    }

    http.end();

    // Niepelne pobieranie (timeout / utrata WiFi / zerwane polaczenie) —
    // sprawdzane PRZED podpisem, zeby nie pokazywac mylacego "PODPIS
    // NIEPOPRAWNY" dla urwanego pliku.
    if (written != total) {
        Serial.printf("[OTA] incomplete: %d / %d (%s)\n", written, total,
                      dlFail ? dlFail : "polaczenie zamkniete");
        if (verifySignature) mbedtls_sha256_free(&shaCtx);
        Update.abort();
        _otaDrawProgress(d, dlFail ? dlFail : _otaT("Blad: niepelny pobor", "Error: incomplete download", "Fehler: unvollstaendiger Download"),
                         written * 100 / total);
        delay(3000);
        return false;
    }

    // === WERYFIKACJA PODPISU ECDSA P-256 ===
    if (verifySignature) {
        uint8_t hash[32];
        mbedtls_sha256_finish(&shaCtx, hash);
        mbedtls_sha256_free(&shaCtx);

        Serial.printf("[OTA] SHA256 firmware: ");
        for (int i = 0; i < 8; i++) Serial.printf("%02x", hash[i]);
        Serial.printf("... (%d bajtow)\n", written);

        // Zdekoduj base64 podpis
        uint8_t sigBuf[128];
        size_t sigLen = _otaBase64Decode(sigB64, sigBuf, sizeof(sigBuf));
        Serial.printf("[OTA] podpis ECDSA: %u bajtow DER\n", sigLen);

        mbedtls_pk_context pk;
        mbedtls_pk_init(&pk);
        int ret = mbedtls_pk_parse_public_key(
            &pk,
            (const uint8_t*)_OTA_PUBLIC_KEY_PEM,
            strlen(_OTA_PUBLIC_KEY_PEM) + 1);
        if (ret != 0) {
            Serial.printf("[OTA] parse_public_key fail: -0x%x\n", -ret);
            mbedtls_pk_free(&pk);
            Update.abort();
            _otaDrawProgress(d, _otaT("Blad parsowania key", "Key parse error", "Schluessel-Parsefehler"), 100);
            delay(3000);
            return false;
        }

        ret = mbedtls_pk_verify(&pk, MBEDTLS_MD_SHA256,
                                hash, sizeof(hash),
                                sigBuf, sigLen);
        mbedtls_pk_free(&pk);

        if (ret != 0) {
            Serial.printf("[OTA] WERYFIKACJA PODPISU NIEUDANA: -0x%x\n", -ret);
            Update.abort();
            _otaDrawProgress(d, _otaT("PODPIS NIEPOPRAWNY!", "SIGNATURE INVALID!", "SIGNATUR UNGUELTIG!"), 100);
            delay(5000);
            return false;
        }
        Serial.println("[OTA] podpis OK - firmware zaufany");
        _otaDrawProgress(d, _otaT("Podpis OK, zapisuje...", "Signature OK, saving...", "Signatur OK, speichere..."), 100);
    }

    if (!Update.end(true)) {
        Serial.printf("[OTA] Update.end failed: %s\n", Update.errorString());
        _otaDrawProgress(d, _otaT("Blad finalizacji", "Finalize error", "Fehler beim Abschluss"), 100);
        delay(3000);
        return false;
    }

    if (!Update.isFinished()) {
        _otaDrawProgress(d, _otaT("Update niepelny", "Update incomplete", "Update unvollstaendig"), 100);
        delay(3000);
        return false;
    }

    // Flaga walidacji PRZED komunikatem i delay: Update.end() juz przelaczyl
    // partycje startowa, wiec wylaczenie zasilania w trakcie 1.5 s pauzy
    // uruchomiloby nowy firmware bez ochrony przed boot-loopem.
    otaMarkPendingValidation();
    _otaDrawProgress(d, _otaT("Sukces! Restart...", "Success! Restarting...", "Erfolg! Neustart..."), 100);
    delay(1500);
    ESP.restart();
    return true; // never reached
}
