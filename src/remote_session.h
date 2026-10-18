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
//       inputScan(), patrz input.h) — watek UI co ~500ms dorysowuje
//       wskaznik do biezacego bufora ekranu i wysyla go na fizyczny OLED
//       (krotki "flash" — pelny wzor wraca przy nastepnym normalnym
//       rysowaniu danego ekranu, ~20-50ms pozniej), po czym kopiuje ten
//       sam bufor dla watku sieciowego. CALA komunikacja z serwerem
//       (w tym pelny handshake TLS) dzieje sie w OSOBNYM watku FreeRTOS
//       na Core 0 (_remoteTaskFn) — watek UI (Core 1) nigdy na nia nie
//       czeka, wiec klawiatura/ekran nie zamrazaja sie na czas sieci.
//       Watek sieciowy dostaje tylko kopie bufora i oddaje tylko maly
//       int/bool (klawisz, flaga stop) — jedyne dane dzielone miedzy
//       watkami, pod mutexem. Watek NIGDY nie dotyka u8g2/SPI.
//    4. Odebrany klawisz jest wstrzykiwany przez inputInjectKey() —
//       dziala jak prawdziwy klawisz w KAZDYM ekranie, bez zmian w nich.
//    5. Sesja konczy sie sama po ~10 min (serwer) albo recznie w panelu —
//       kolejny tick watku sieciowego dostanie active:false, watek UI to
//       zauwazy i wylaczy flage + WiFi. Niezaleznie od serwera: twardy
//       limit lokalny _REMOTE_MAX_SESSION_MS oraz koniec przy 401/403/404
//       (urzadzenie nieuprawnione / brak sesji). Przy innych bledach
//       (siec, 5xx) — backoff 2 s -> 30 s zamiast strumienia co 500 ms.
//    6. Na czas sesji auto-sleep jest zablokowany (sen wylacza WiFi, czyli
//       zrywa sesje) — blokada odnawiana co tick (inne ekrany zdejmuja ja
//       przy wyjsciu) i zdejmowana na koncu sesji.
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
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>
#include "wifi_persist.h"   // wifiStaOnLimited, wifiLoadSaved, wifiLoadDeviceToken
#include "power.h"          // powerSetInhibit — bez auto-sleep podczas sesji

#define _REMOTE_CHECKIN_ENDPOINT  KALK_SERVER_URL "/api/device/remote/checkin"
#define _REMOTE_TICK_MS           500    // co ile odpytujemy serwer podczas sesji
#define _REMOTE_HTTP_TIMEOUT_MS   4000   // krotki timeout — to tylko heartbeat, nie moze blokowac UI na dlugo
#define _REMOTE_MAX_SESSION_MS    (15UL * 60UL * 1000UL)   // twardy limit lokalny sesji
#define _REMOTE_BACKOFF_MIN_MS    2000   // pierwszy odstep po bledzie
#define _REMOTE_BACKOFF_MAX_MS    30000  // maks. odstep przy ciaglych bledach

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

// Zakoduj podany bufor (kopia, NIE bezposrednio z u8g2 — patrz nizej dlaczego)
// do base64 (2048 B -> ok. 2732 znakow).
static String _remoteEncodeFrame(const uint8_t* buf) {
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

// =====================================================================
//  Watek sieciowy w tle (Core 0) — PRAWDZIWA asynchronicznosc.
//
//  Zasada, ktorej ten kod PILNUJE: watek siecowy NIGDY nie dotyka u8g2 ani
//  SPI. To jedyne miejsce gdzie dwa watki na raz moglyby sie realnie
//  pogryzc (dwie rownoczesne transakcje SPI na tej samej magistrali =
//  ryzyko zaciecia/zaszumienia ekranu). Caly kontakt z ekranem
//  (_remoteStampIndicator/remoteSendBuffer) zostaje na watku glownym,
//  wywolywany jak dotychczas z inputScan(). Watek w tle dostaje tylko
//  KOPIE bufora (mutex) i oddaje z powrotem tylko maly int/bool (klawisz,
//  flaga stop) — to jedyne dane dzielone miedzy watkami.
// =====================================================================
static TaskHandle_t      _remoteTaskHandle = nullptr;
static SemaphoreHandle_t _remoteMutex      = nullptr;
static uint8_t  _remoteFrameShared[_REMOTE_BUF_LEN];
static volatile bool _remoteFrameReady     = false;  // watek UI wpisal nowa klatke do wyslania
static volatile int  _remotePendingKey     = -1;     // watek siecowy odebral klawisz do wstrzykniecia
static volatile bool _remoteStopRequested  = false;  // serwer kazal zakonczyc sesje
static uint32_t      _remoteSessionStartMs = 0;      // start biezacej sesji (watek UI)

// Wykonuje siebie w petli na Core 0. Cale IO sieciowe (w tym pelny
// handshake TLS przy pierwszym polaczeniu) dzieje sie TU — watek UI
// (Core 1, loop()) nigdy na to nie czeka.
static void _remoteTaskFn(void* /*arg*/) {
    WiFiClientSecure client;
    HTTPClient http;
    bool clientReady = false;
    uint32_t backoffMs = 0;   // 0 = brak bledow; potem 2 s -> 30 s

    for (;;) {
        if (!remoteSessionActive()) { backoffMs = 0; vTaskDelay(pdMS_TO_TICKS(200)); continue; }
        // Stop juz zgloszony — czekaj, az watek UI go odbierze (nie wysylaj dalej)
        if (_remoteStopRequested) { vTaskDelay(pdMS_TO_TICKS(100)); continue; }
        if (WiFi.status() != WL_CONNECTED) { vTaskDelay(pdMS_TO_TICKS(200)); continue; }

        uint8_t localFrame[_REMOTE_BUF_LEN];
        bool haveFrame = false;
        if (xSemaphoreTake(_remoteMutex, pdMS_TO_TICKS(50)) == pdTRUE) {
            if (_remoteFrameReady) {
                memcpy(localFrame, _remoteFrameShared, _REMOTE_BUF_LEN);
                haveFrame = true;
            }
            xSemaphoreGive(_remoteMutex);
        }
        if (!haveFrame) { vTaskDelay(pdMS_TO_TICKS(50)); continue; }

        String frame = _remoteEncodeFrame(localFrame);

        if (!clientReady) {
            client.setCACert(KALKMATE_CA_CERT);
            client.setTimeout(10);
            clientReady = true;
        }
        http.begin(client, _REMOTE_CHECKIN_ENDPOINT);
        http.setReuse(true);   // keep-alive miedzy tickami tego watku — patrz komentarz w v1.9.3
        http.addHeader("Content-Type", "application/json");
        http.addHeader("x-api-key", KALK_API_KEY);
        http.addHeader("x-device-id", _remoteDeviceId());
        // x-device-token: od fw 1.9.6 serwer weryfikuje checkin przez
        // verifyDeviceAuth() (audyt 2026-09-17 — bez tego kazdy z kluczem API
        // mogl podszyc sie pod cudze urzadzenie i przejac sesje zdalnej
        // pomocy). Token czytany z NVS raz na zycie taska, nie co 500 ms.
        {
            static char s_devToken[68] = "";
            static bool  s_devTokenLoaded = false;
            if (!s_devTokenLoaded) {
                wifiLoadDeviceToken(s_devToken, sizeof(s_devToken));
                s_devTokenLoaded = true;
            }
            if (s_devToken[0]) http.addHeader("x-device-token", s_devToken);
        }
        http.setTimeout(_REMOTE_HTTP_TIMEOUT_MS);

        String body = String("{\"frame\":\"") + frame + "\"}";
        int httpCode = http.POST(body);
        // Odpowiedz czytamy przy KAZDYM kodzie HTTP (nie tylko 200) — serwer
        // moze zakonczyc sesje ("active":false) takze w odpowiedzi bledu.
        String resp = (httpCode > 0) ? http.getString() : String();
        http.end();

        bool stop = (resp.indexOf("\"active\":false") >= 0) ||
                    httpCode == 401 || httpCode == 403 || httpCode == 404;
        if (stop) {
            Serial.printf("[REMOTE] koniec sesji (HTTP %d)\n", httpCode);
            _remoteStopRequested = true;
            clientReady = false;
            backoffMs = 0;
        } else if (httpCode == 200) {
            backoffMs = 0;
            int keyIdx = resp.indexOf("\"key\":");
            if (keyIdx >= 0) {
                int val = atoi(resp.c_str() + keyIdx + 6);
                if (val > 0 && val < KEY_COUNT) _remotePendingKey = val;
            }
        } else {
            clientReady = false;   // polaczenie moglo padnac — pelny reconnect nastepnym razem
            backoffMs = backoffMs ? backoffMs * 2 : _REMOTE_BACKOFF_MIN_MS;
            if (backoffMs > _REMOTE_BACKOFF_MAX_MS) backoffMs = _REMOTE_BACKOFF_MAX_MS;
            Serial.printf("[REMOTE] HTTP %d — kolejna proba za %lu ms\n", httpCode, (unsigned long)backoffMs);
        }

        vTaskDelay(pdMS_TO_TICKS(_REMOTE_TICK_MS + backoffMs));
    }
}

// Konczy sesje po stronie urzadzenia (watek UI): flaga off, WiFi off,
// zdjecie blokady auto-sleep.
static void _remoteEndSession() {
    remoteSessionSetActive(false);
    WiFi.mode(WIFI_OFF);   // koniec sesji — oszczedzaj baterie jak wszedzie indziej w projekcie
    powerSetInhibit(false);
    // Watku NIE zabijamy — sam sie usypia (remoteSessionActive()==false -> vTaskDelay
    // 200ms w petli) i obudzi przy nastepnej sesji. Prosciej i bezpieczniej niz
    // tworzenie/niszczenie tasku za kazdym razem.
}

// Odbiera wyniki z watku siecowego i aplikuje je (wstrzykniecie klawisza,
// wylaczenie sesji) — TO wywolywac tylko z watku UI.
static void _remoteDrainResults() {
    int key = _remotePendingKey;
    if (key > 0) {
        _remotePendingKey = -1;
        inputInjectKey((KalkKey)key);
    }
    if (_remoteStopRequested) {
        _remoteEndSession();
        _remoteStopRequested = false;
    }
}

// Wywolywane z inputScan() (input.h) gdy remoteSessionActive()==true.
// Throttluje sie samo do _REMOTE_TICK_MS. To jest juz TYLKO watek UI:
// dorysowanie wskaznika + wyslanie na fizyczny OLED (musi zostac tutaj,
// patrz komentarz przy tasku) + skopiowanie klatki dla watku sieciowego.
// Zero blokujacego IO w tej funkcji — stad "prawdziwa" asynchronicznosc.
void remoteHeartbeatTick() {
    // Start watku siecowego raz, przy pierwszym wejsciu w sesje.
    if (!_remoteTaskHandle) {
        _remoteMutex = xSemaphoreCreateMutex();
        xTaskCreatePinnedToCore(_remoteTaskFn, "remoteHelp", 12288, nullptr, 1, &_remoteTaskHandle, 0);
    }

    _remoteDrainResults();   // tanie (kilka porownan) — rob to co kazdy scan, nie tylko co tick
    if (!remoteSessionActive()) return;

    // Twardy limit lokalny — niezaleznie od tego, co mowi (albo czy w ogole
    // odpowiada) serwer.
    if (millis() - _remoteSessionStartMs > _REMOTE_MAX_SESSION_MS) {
        Serial.println("[REMOTE] limit 15 min — koniec sesji");
        _remoteEndSession();
        return;
    }

    static uint32_t lastTick = 0;
    uint32_t now = millis();
    if (now - lastTick < _REMOTE_TICK_MS) return;
    lastTick = now;

    // Blokada auto-sleep odnawiana co tick: notatki/sprawdziany/konto
    // zdejmuja ja (powerSetInhibit(false)) przy wyjsciu ze swoich ekranow.
    powerSetInhibit(true);

    _remoteStampIndicator();
    remoteSendBuffer();   // krotki "flash" wskaznika na fizycznym OLED — TYLKO watek UI dotyka SPI

    uint8_t* buf = remoteGetScreenBuffer();
    if (buf && xSemaphoreTake(_remoteMutex, 0) == pdTRUE) {
        memcpy(_remoteFrameShared, buf, _REMOTE_BUF_LEN);
        _remoteFrameReady = true;
        xSemaphoreGive(_remoteMutex);
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
                _remoteEndSession();
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
    wifiStaOnLimited();   // STA + TxPower (KALK_WIFI_TX_POWER)
    wifiFastBegin(ssid, pass);
    memset(pass, 0, sizeof(pass));
    unsigned long t0 = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - t0 < 8000 && !_panicRequested) delay(200);
    if (_panicRequested) return;
    if (WiFi.status() != WL_CONNECTED) {
        _solDrawError(d, T("Nie polaczono z WiFi", "Could not connect", "Keine WLAN-Verbindung"), "");
        return;
    }
    wifiSaveBssidChannel();
    accountRegisterOnce();

    _remoteSessionStartMs = millis();
    _remoteStopRequested  = false;
    remoteSessionSetActive(true);
    powerSetInhibit(true);   // sen wylaczylby WiFi = zerwana sesja

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
