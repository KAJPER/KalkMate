#pragma once
// =====================================================================
//  remote_session.h — "Zdalna pomoc": live podglad ekranu + zdalne
//  "nacisniecia" klawiszy z panelu admina (kalkmate.pl/admin/remote).
//
//  Architektura (WAZNE — urzadzenie jest za NAT-em klienta, serwer NIGDY
//  nie inicjuje polaczenia do kalkulatora):
//    1. Uzytkownik jawnie wchodzi Ustawienia -> Zdalna pomoc. To jedyny
//       sposob na wejscie w ten tryb — nie da sie go wywolac "po cichu"
//       z serwera.
//    2. Ekran pokazuje Device ID + duzy, ciagle widoczny wskaznik ze
//       sesja jest aktywna (kwadracik w prawym gornym rogu, dorysowywany
//       przy kazdym "tick" ponizej — patrz remoteHeartbeatTick()).
//    3. Od tego momentu — z KAZDEGO ekranu w UI (bo hak jest w
//       inputScan(), patrz input.h) — kalkulator co ~500ms:
//         a) dorysowuje wskaznik do biezacego bufora ekranu (cokolwiek
//            akurat jest wyswietlone) i wysyla go na fizyczny OLED
//            (krotki "flash" — pelny wzor jest przywracany przy nastepnym
//            normalnym rysowaniu danego ekranu, ~20-50ms pozniej),
//         b) wysyla ten sam bufor (2048 B, base64) do serwera,
//         c) odbiera ewentualny oczekujacy zdalny klawisz i "wciska" go
//            przez inputInjectKey() — dziala jak prawdziwy klawisz w
//            KAZDYM ekranie, bez zadnych zmian w tych ekranach.
//    4. Sesja konczy sie sama po ~10 min (serwer) albo recznie w panelu —
//       kolejny tick dostanie active:false, wylaczy flage i WiFi.
//
//  Wymaga: input.h (remoteSessionActive/SetActive, inputInjectKey,
//  remoteGetScreenBuffer/remoteSendBuffer), wifi_persist.h, kalkmate_certs.h,
//  device_account.h (accountRegisterOnce), settings_screen.h (T(), kalkSettings,
//  _setBtn/_setWaitRelease).
// =====================================================================

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

#define _REMOTE_CHECKIN_ENDPOINT  KALK_SERVER_URL "/api/device/remote/checkin"
#define _REMOTE_TICK_MS           500    // co ile odpytujemy serwer podczas sesji
#define _REMOTE_HTTP_TIMEOUT_MS   4000   // krotki timeout — to tylko heartbeat, nie moze blokowac UI na dlugo

// Device ID — MAC ESP32, ta sama definicja co _solDeviceId() w solve_screen.h.
// Duplikacja celowa (ten sam powod co dithering XBM w camera-test): plik
// jest wlaczany w innym miejscu drzewa include niz solve_screen.h.
static String _remoteDeviceId() {
    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_WIFI_STA);
    char buf[16];
    snprintf(buf, sizeof(buf), "%02X%02X%02X%02X%02X%02X",
             mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    return String(buf);
}

// Zrodlo prawdy o rozmiarze bufora OLED — 256x64, 1bpp, format u8g2
// "vertical_top_lsb": buf[(y>>3)*256 + x], bit (y&7), bit0 = gorny piksel.
#define _REMOTE_BUF_LEN  2048

// Domalowuje 6x6 kwadracik w prawym gornym rogu (x:246..251, y:0..5)
// BEZPOSREDNIO w buforze u8g2 — nie przez d.drawBox(), zeby dzialalo
// niezaleznie od tego jaki ekran/funkcja aktualnie rysuje.
static void _remoteStampIndicator() {
    uint8_t* buf = remoteGetScreenBuffer();
    if (!buf) return;
    for (int y = 0; y < 6; y++) {
        uint8_t bit = (uint8_t)(1 << (y & 7));
        int page = y >> 3;  // zawsze 0 dla y<8
        for (int x = 246; x < 252; x++) {
            buf[page * 256 + x] |= bit;
        }
    }
}

// Zakoduj biezacy bufor ekranu do base64 (2048 B -> ok. 2732 znakow).
static String _remoteFrameBase64() {
    uint8_t* buf = remoteGetScreenBuffer();
    if (!buf) return String();
    static const char* tbl = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    String out;
    out.reserve(((_REMOTE_BUF_LEN + 2) / 3) * 4);
    for (int i = 0; i < _REMOTE_BUF_LEN; i += 3) {
        uint32_t n = (uint32_t)buf[i] << 16;
        if (i + 1 < _REMOTE_BUF_LEN) n |= (uint32_t)buf[i + 1] << 8;
        if (i + 2 < _REMOTE_BUF_LEN) n |= (uint32_t)buf[i + 2];
        out += tbl[(n >> 18) & 0x3F];
        out += tbl[(n >> 12) & 0x3F];
        out += (i + 1 < _REMOTE_BUF_LEN) ? tbl[(n >> 6) & 0x3F] : '=';
        out += (i + 2 < _REMOTE_BUF_LEN) ? tbl[n & 0x3F] : '=';
    }
    return out;
}

// Wywolywane z inputScan() (input.h) gdy remoteSessionActive()==true.
// Throttluje sie samo do _REMOTE_TICK_MS — bezpieczne wolac czesto.
void remoteHeartbeatTick() {
    static uint32_t lastTick = 0;
    uint32_t now = millis();
    if (now - lastTick < _REMOTE_TICK_MS) return;
    lastTick = now;

    if (WiFi.status() != WL_CONNECTED) return;  // brak sieci — sprobuj przy nastepnym tick

    _remoteStampIndicator();
    remoteSendBuffer();   // krotki "flash" wskaznika na fizycznym OLED
    String frame = _remoteFrameBase64();

    WiFiClientSecure client;
    client.setCACert(KALKMATE_CA_CERT);
    client.setTimeout(10);
    HTTPClient http;
    http.begin(client, _REMOTE_CHECKIN_ENDPOINT);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-api-key", KALK_API_KEY);
    http.addHeader("x-device-id", _remoteDeviceId());
    http.setTimeout(_REMOTE_HTTP_TIMEOUT_MS);

    String body = String("{\"frame\":\"") + frame + "\"}";
    int httpCode = http.POST(body);
    if (httpCode != 200) {
        http.end();
        return;   // chwilowy blad — kolejny tick i tak sprobuje ponownie
    }
    String resp = http.getString();
    http.end();

    if (resp.indexOf("\"active\":false") >= 0) {
        remoteSessionSetActive(false);
        WiFi.mode(WIFI_OFF);   // koniec sesji — oszczedzaj baterie jak wszedzie indziej w projekcie
        return;
    }

    int keyIdx = resp.indexOf("\"key\":");
    if (keyIdx >= 0) {
        int numStart = keyIdx + 6;
        int val = atoi(resp.c_str() + numStart);
        if (val > 0 && val < KEY_COUNT) {
            inputInjectKey((KalkKey)val);
        }
    }
}

// ---------------------------------------------------------------------------
// Ekran ustawien: Ustawienia -> Zdalna pomoc.
// Jesli sesja juz aktywna -> pyta o zatrzymanie. Jesli nie -> laczy WiFi
// (ten sam wzorzec co _solProcessQueue w solve_screen.h) i startuje.
// ---------------------------------------------------------------------------
void _editRemoteHelp(U8G2 &d) {
    _setWaitRelease();

    if (remoteSessionActive()) {
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 14, T("Zdalna pomoc: AKTYWNA", "Remote help: ACTIVE", "Fernhilfe: AKTIV"));
        d.drawHLine(0, 16, 256);
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 32, T("Ktos moze widziec i sterowac", "Someone can see and control", "Jemand kann sehen und steuern"));
        d.drawStr(2, 42, T("tym kalkulatorem zdalnie.", "this calculator remotely.", "diesen Rechner aus der Ferne."));
        d.drawStr(2, 62, T("OK = zakoncz   < = wstecz", "OK = end   < = back", "OK = beenden  < = zurueck"));
        d.sendBuffer();
        while (true) {
            if (_panicRequested) return;
            if (_setBtn(BTN_OK)) {
                remoteSessionSetActive(false);
                WiFi.mode(WIFI_OFF);
                _setWaitRelease();
                return;
            }
            if (_setBtn(BTN_LEFT)) { _setWaitRelease(); return; }
            delay(20);
        }
    }

    // Start nowej sesji — polacz WiFi (jak _solProcessQueue).
    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);
    d.drawStr(2, 32, T("Laczenie z WiFi...", "Connecting to WiFi...", "Verbinde mit WLAN..."));
    d.sendBuffer();

    char ssid[33] = "", pass[64] = "";
    wifiLoadSaved(ssid, sizeof(ssid), pass, sizeof(pass));
    if (ssid[0] == '\0') {
        _solDrawError(d, T("Brak zapisanej sieci WiFi", "No saved WiFi network", "Kein gespeichertes WLAN"), "");
        return;
    }
    WiFi.mode(WIFI_STA);
    wifiFastBegin(ssid, pass);
    unsigned long t0 = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - t0 < 8000) delay(200);
    if (WiFi.status() != WL_CONNECTED) {
        _solDrawError(d, T("Nie polaczono z WiFi", "Could not connect", "Keine WLAN-Verbindung"), "");
        return;
    }
    wifiSaveBssidChannel();
    accountRegisterOnce();

    remoteSessionSetActive(true);

    d.clearBuffer();
    d.setFont(u8g2_font_6x10_tf);
    d.drawStr(2, 14, T("Zdalna pomoc aktywna", "Remote help active", "Fernhilfe aktiv"));
    d.drawHLine(0, 16, 256);
    d.setFont(u8g2_font_5x7_tf);
    d.drawStr(2, 30, T("Podaj wsparciu Device ID:", "Give support this Device ID:", "Geraete-ID fuer den Support:"));
    d.setFont(u8g2_font_6x10_tf);
    d.drawStr(2, 44, _remoteDeviceId().c_str());
    d.setFont(u8g2_font_5x7_tf);
    d.drawStr(2, 62, T("Kwadracik w rogu = sesja trwa", "Corner square = session live", "Eckquadrat = Sitzung aktiv"));
    d.sendBuffer();
    _setWaitRelease();
    delay(2500);
}
