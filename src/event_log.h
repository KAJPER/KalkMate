#pragma once
// event_log.h — kompaktowy log WAZNYCH zdarzen (bledy/resety/awarie polaczen),
// trzymany w SPIFFS i wysylany do serwera przy okazji istniejacej rejestracji
// urzadzenia (accountRegister(), main.cpp po kazdym polaczeniu WiFi).
//
// NIE jest to pelne lustro Serial — tylko zdarzenia warte zobaczenia zdalnie
// (patrz logEvent() wywolania w innych plikach). Kazda linia w pliku:
//   <epoch>|<tag>|<wiadomosc>\n
// epoch=0 gdy NTP jeszcze nie zsynchronizowane w momencie zdarzenia — serwer
// i tak znakuje wlasna data odbioru (patrz /api/device/register), epoch to
// tylko dodatkowy kontekst "ile czasu temu w przyblizeniu".
//
// Bufor jest zaokraglony z gory (_EVLOG_MAX_BYTES) — po przekroczeniu nowe
// zdarzenia sa po cichu pomijane, zeby jedno "gadatliwe" zdarzenie nie
// zjadlo calego limitu i nie zablokowalo wysylki. Czyszczony dopiero po
// potwierdzonej (HTTP 200) wysylce w accountRegister().

#include <Arduino.h>
#include <SPIFFS.h>
#include <time.h>

#define _EVLOG_PATH        "/evlog.txt"
#define _EVLOG_MAX_BYTES   3072   // ~kilkadziesiat linii — tani upload, nie zapycha SPIFFS

// Wola SPIFFS.begin() jesli jeszcze nie zamontowany — bezpieczne wielokrotne
// wywolanie (offline_queue.h robi to samo przy swoich plikach).
static inline bool _evlogFs() {
    static bool mounted = false;
    if (mounted) return true;
    mounted = SPIFFS.begin(false);
    return mounted;
}

// Dopisz zdarzenie (tag krotki, np. "WIFI"/"TLS"/"CAM"/"BOOT"; msg bez
// znaku '|' ani nowej linii — oba sa zamieniane na spacje).
inline void logEvent(const char* tag, const char* msg) {
    if (!_evlogFs()) return;
    File f = SPIFFS.open(_EVLOG_PATH, FILE_APPEND);
    if (!f) return;
    if (f.size() >= _EVLOG_MAX_BYTES) { f.close(); return; }

    time_t now = time(nullptr);
    long epoch = (now > 1600000000L) ? (long)now : 0;   // >2020-09 = NTP juz zsynchronizowane

    char line[160];
    char cleanMsg[100];
    size_t j = 0;
    for (size_t i = 0; msg[i] && j < sizeof(cleanMsg) - 1; i++) {
        char c = msg[i];
        cleanMsg[j++] = (c == '|' || c == '\n' || c == '\r') ? ' ' : c;
    }
    cleanMsg[j] = '\0';
    int n = snprintf(line, sizeof(line), "%ld|%s|%s\n", epoch, tag, cleanMsg);
    if (n > 0) f.write((const uint8_t*)line, (size_t)min((size_t)n, sizeof(line) - 1));
    f.close();
}

inline void logEventf(const char* tag, const char* fmt, ...) {
    char buf[100];
    va_list args;
    va_start(args, fmt);
    vsnprintf(buf, sizeof(buf), fmt, args);
    va_end(args);
    logEvent(tag, buf);
}

// Odczytaj caly bufor do przeslania (pusty string gdy brak/nic). buf musi
// miec min. _EVLOG_MAX_BYTES+1 bajtow.
inline size_t logEventRead(char* buf, size_t bufSize) {
    buf[0] = '\0';
    if (!_evlogFs() || !SPIFFS.exists(_EVLOG_PATH)) return 0;
    File f = SPIFFS.open(_EVLOG_PATH, FILE_READ);
    if (!f) return 0;
    size_t n = f.readBytes(buf, bufSize - 1);
    buf[n] = '\0';
    f.close();
    return n;
}

// Wolane PO potwierdzonej (HTTP 200) wysylce — zeby nie wyslac tych samych
// zdarzen drugi raz.
inline void logEventClear() {
    if (_evlogFs() && SPIFFS.exists(_EVLOG_PATH)) SPIFFS.remove(_EVLOG_PATH);
}
