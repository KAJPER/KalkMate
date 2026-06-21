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
    String sig;           // ECDSA P-256 base64 podpis SHA256(bin) (od v1.4.1)
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
    {
        uint8_t mac[6];
        esp_read_mac(mac, ESP_MAC_WIFI_STA);
        char did[16];
        snprintf(did, sizeof(did), "%02X%02X%02X%02X%02X%02X",
                 mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
        http.addHeader("x-device-id", did);
    }
    http.addHeader("x-fw-version", FW_VERSION);
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
    d.drawStr(2, 60, "Nie wylaczaj urzadzenia!");

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
//    1. otaMarkPendingValidation() — wywolaj tuz przed ESP.restart() po sukcesie OTA.
//       Zapisuje do NVS flage "pending=true" i licznik "boot_cnt=0".
//    2. otaBootCheck() — wywolaj wczesnie w setup(). Jesli pending, inkrementuje
//       licznik. Jesli >= 3 proby (boot loop) — rollback na poprzednia partycje.
//    3. otaMarkValid() — wywolaj po potwierdzeniu poprawnego dzialania (WiFi OK).
//       Czysci flage. Bez tego po 3 nieudanych bootach nastapi rollback.
// ---------------------------------------------------------------------

inline void otaMarkPendingValidation() {
    Preferences p;
    p.begin("ota_rb", false);
    p.putBool("pending", true);
    p.putInt("boot_cnt", 0);
    p.end();
    Serial.println("[OTA] oznaczono jako oczekujacy walidacji");
}

inline void otaMarkValid() {
    Preferences p;
    p.begin("ota_rb", true);
    bool pending = p.getBool("pending", false);
    p.end();
    if (!pending) return;
    p.begin("ota_rb", false);
    p.putBool("pending", false);
    p.putInt("boot_cnt", 0);
    p.end();
    Serial.println("[OTA] firmware zawalidowany (WiFi OK)");
}

inline void otaBootCheck() {
    Preferences p;
    p.begin("ota_rb", false);
    bool pending = p.getBool("pending", false);
    if (!pending) { p.end(); return; }

    int cnt = p.getInt("boot_cnt", 0) + 1;
    p.putInt("boot_cnt", cnt);
    p.end();
    Serial.printf("[OTA] boot po OTA — proba %d/3\n", cnt);
    if (cnt < 3) return;

    // Boot loop wykryty — rollback do poprzedniej partycji OTA
    Serial.println("[OTA] BOOT LOOP WYKRYTY — rollback!");
    Preferences p2;
    p2.begin("ota_rb", false);
    p2.putBool("pending", false);
    p2.putInt("boot_cnt", 0);
    p2.end();

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

    if (fallback) {
        Serial.printf("[OTA] rollback -> %s @ 0x%x\n", fallback->label, fallback->address);
        esp_ota_set_boot_partition(fallback);
    } else {
        Serial.println("[OTA] brak partycji do rollbacku — restart bez rollbacku");
    }
    delay(500);
    ESP.restart();
}

// ---------------------------------------------------------------------
//  otaInstall — pobiera .bin i wpisuje przez Update API
//  Streaming SHA-256 + ECDSA verify przed commit (od v1.4.1).
//  Pokazuje postep na OLED. Po sukcesie wywoluje ESP.restart().
// ---------------------------------------------------------------------
inline bool otaInstall(U8G2 &d, const String& binUrl, const String& sigB64 = "") {
    Serial.printf("[OTA] install: %s\n", binUrl.c_str());

    if (WiFi.status() != WL_CONNECTED) {
        _otaDrawProgress(d, "Blad: brak WiFi", 0);
        delay(2000);
        return false;
    }

#ifdef KALK_REQUIRE_SIGNED_OTA
    if (sigB64.isEmpty()) {
        Serial.println("[OTA] KALK_REQUIRE_SIGNED_OTA: brak podpisu — install odrzucony");
        _otaDrawProgress(d, "PROD: brak podpisu!", 0);
        delay(3000);
        return false;
    }
#endif

    _otaDrawProgress(d, "Laczenie z serwerem...", 0);

    WiFiClientSecure client;
    client.setInsecure();
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

    while (http.connected() && written < total) {
        size_t avail = stream->available();
        if (avail) {
            int n = stream->readBytes(buf, min(avail, sizeof(buf)));
            if (n <= 0) break;
            if (Update.write(buf, n) != (size_t)n) {
                Serial.printf("[OTA] Update.write failed: %s\n", Update.errorString());
                Update.abort();
                if (verifySignature) mbedtls_sha256_free(&shaCtx);
                _otaDrawProgress(d, "Blad zapisu", written * 100 / total);
                delay(3000);
                http.end();
                return false;
            }
            // Aktualizuj hash dla weryfikacji
            if (verifySignature) {
                mbedtls_sha256_update(&shaCtx, buf, n);
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
            _otaDrawProgress(d, "Blad parsowania key", 100);
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
            _otaDrawProgress(d, "PODPIS NIEPOPRAWNY!", 100);
            delay(5000);
            return false;
        }
        Serial.println("[OTA] podpis OK - firmware zaufany");
        _otaDrawProgress(d, "Podpis OK, zapisuje...", 100);
    }

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
    otaMarkPendingValidation();
    ESP.restart();
    return true; // never reached
}
