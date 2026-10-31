#pragma once
// ============================================================================
// server_select.h — wybor najszybszego serwera dla /api/device/solve
// ============================================================================
// Glowny serwer (aplikacja + baza + AI) stoi w Mediolanie: KALKMATE_HOST.
// Serwery posredniczace (np. ca.kalkmate.pl w Kanadzie) to sam nginx, ktory
// przekazuje zapytania do Mediolanu po stalym polaczeniu keep-alive — patrz
// tools/edge/. Kalkulator daleko od Europy robi handshake TLS i wysyla
// zdjecie do bliskiego serwera (kilka szybkich wymian zamiast kilku przez
// ocean), a tylko jedna wymiana idzie dalej do Mediolanu.
//
// Tylko solve (najwiekszy upload + najczesciej uzywane). Rejestracja,
// notatki, sprawdziany, zdalna pomoc i OTA zostaja na KALKMATE_HOST (OTA
// i tak przyjmuje tylko https://kalkmate.pl/, ota_update.h).
//
// Wybor: czas polaczenia TCP (bez TLS — szybko) do kazdego hosta, lepszy
// z 2 prob. Serwer posredniczacy wygrywa tylko, gdy jest szybszy o
// _SRV_MARGIN_MS — inaczej (np. kalkulator w Polsce) zostaje Mediolan, bo
// droga przez posrednika dodaje jego wlasna wymiane z Mediolanem.
// Pomiar co _SRV_REFRESH_MS (i po kazdym restarcie/wybudzeniu — RAM).
// Gdy wybrany posrednik nie odpowiada: druga proba tego samego zapytania
// idzie od razu do Mediolanu, a posrednik jest pomijany przez _SRV_PENALTY_MS.
//
// Nowy serwer posredniczacy = nowa linia w _SRV_HOSTS (+ certyfikat
// Let's Encrypt na nim — KALKMATE_CA_CERT zawiera wszystkie roote ISRG).
// ============================================================================

#include <WiFi.h>

#ifndef KALKMATE_HOST
#error "server_select.h wymaga KALKMATE_HOST (wifi_persist.h)"
#endif

// Indeks 0 = serwer glowny (zawsze ostatnia deska ratunku).
static const char* const _SRV_HOSTS[] = {
    KALKMATE_HOST,       // Mediolan (glowny)
    "ca.kalkmate.pl",    // Kanada (nginx -> Mediolan)
};
static const int _SRV_COUNT = sizeof(_SRV_HOSTS) / sizeof(_SRV_HOSTS[0]);

#define _SRV_MARGIN_MS     40
#define _SRV_CONNECT_MS    1500
#define _SRV_REFRESH_MS    (6UL * 3600UL * 1000UL)
#define _SRV_PENALTY_MS    (30UL * 60UL * 1000UL)

static int      _srvChosen = 0;
static bool     _srvMeasured = false;
static uint32_t _srvMeasuredAt = 0;
static uint32_t _srvBadUntil[_SRV_COUNT] = {0};

static bool _srvIsBad(int i) {
    return _srvBadUntil[i] != 0 && (int32_t)(_srvBadUntil[i] - millis()) > 0;
}

// Najlepszy czas polaczenia TCP z 2 prob (ms), -1 = niedostepny.
// Pierwsza proba zawiera tez DNS — druga juz z cache lwIP, wiec min()
// mierzy glownie odleglosc. Nieudana pierwsza proba = koniec (nie czekamy 2x).
static int _srvMeasure(const char* host, volatile bool* abortFlag) {
    int best = -1;
    for (int i = 0; i < 2; i++) {
        if (abortFlag && *abortFlag) break;
        WiFiClient c;
        uint32_t t0 = millis();
        bool ok = c.connect(host, 443, _SRV_CONNECT_MS);
        uint32_t dt = millis() - t0;
        c.stop();
        if (!ok) break;
        if (best < 0 || (int)dt < best) best = (int)dt;
    }
    return best;
}

// Mierzy wszystkie serwery, jesli dawno (albo nigdy) nie mierzono.
// Wolac z taska sieciowego (blokuje do ~kilku sekund przy niedostepnym hoscie).
static void serverRefreshIfStale(volatile bool* abortFlag = nullptr) {
    if (_SRV_COUNT < 2 || WiFi.status() != WL_CONNECTED) return;
    if (_srvMeasured && millis() - _srvMeasuredAt < _SRV_REFRESH_MS) return;

    int rtt[_SRV_COUNT];
    for (int i = 0; i < _SRV_COUNT; i++) rtt[i] = _srvMeasure(_SRV_HOSTS[i], abortFlag);
    if (abortFlag && *abortFlag) return;   // przerwany pomiar = bez zmian

    int best = 0;
    for (int i = 1; i < _SRV_COUNT; i++) {
        if (rtt[i] < 0) continue;
        int ref = rtt[best];
        if (ref < 0 || rtt[i] + _SRV_MARGIN_MS < ref) best = i;
    }
    _srvChosen = best;
    _srvMeasured = true;
    _srvMeasuredAt = millis();
    Serial.printf("[SRV] pomiar: %s=%dms %s=%dms -> %s\n",
        _SRV_HOSTS[0], rtt[0], _SRV_COUNT > 1 ? _SRV_HOSTS[1] : "-", _SRV_COUNT > 1 ? rtt[1] : -1,
        _SRV_HOSTS[best]);
    logEventf("SRV", "rtt %d/%d -> %s", rtt[0], _SRV_COUNT > 1 ? rtt[1] : -1, _SRV_HOSTS[best]);
}

// Indeks serwera do uzycia teraz (posrednik w karze -> glowny).
static int serverSolveIndex() {
    return _srvIsBad(_srvChosen) ? 0 : _srvChosen;
}

static const char* serverHost(int idx) {
    return (idx >= 0 && idx < _SRV_COUNT) ? _SRV_HOSTS[idx] : _SRV_HOSTS[0];
}

// Posrednik nie odpowiedzial — pomijaj go przez jakis czas i zmierz od nowa
// po karze (moze to byla chwilowa awaria albo kalkulator zmienil siec).
static void serverMarkFailed(int idx) {
    if (idx <= 0 || idx >= _SRV_COUNT) return;
    _srvBadUntil[idx] = millis() + _SRV_PENALTY_MS;
    if (_srvBadUntil[idx] == 0) _srvBadUntil[idx] = 1;
    _srvMeasured = false;
    Serial.printf("[SRV] %s niedostepny — przez 30 min tylko %s\n", _SRV_HOSTS[idx], _SRV_HOSTS[0]);
    logEventf("SRV", "%s down, fallback %s", _SRV_HOSTS[idx], _SRV_HOSTS[0]);
}
