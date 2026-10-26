#pragma once
// =====================================================================
//  factory_reset.h — JEDNA wspolna implementacja resetu fabrycznego.
//  Wczesniej byly dwie rozjechane kopie (calculator.h i settings_screen.h),
//  z ktorych zadna nie czyscila kolejki offline ("kalkoq").
//
//  Wolane z:
//   - calculator.h      — przytrzymanie C/CE 5 s w trybie kalkulatora
//                         (ratunek, gdy klawisz z kodu AI nie dziala),
//   - settings_screen.h — Ustawienia -> Reset fabryczny.
//
//  Co kasuje:
//   - NVS "kalkmate" (WiFi, licencja, kod AI, panic key, ustawienia),
//         "kalkhist" (historia), "kalkmap" (mapowanie klawiatury),
//         "kalkoq"   (kolejka offline),
//   - SPIFFS: wszystkie pliki (notatki /notes.json, sprawdziany /tests.json,
//     kolejka /oq*, historia /hist*) — na SPIFFS nie lezy nic innego,
//   - wewnetrzna partycje WiFi esp-idf (esp_wifi_restore).
//  Czego NIE kasuje:
//   - NVS "kalkid" — dev_token (tozsamosc urzadzenia wobec serwera, K5).
//     Ustawia tam flage "unpair": przy nastepnej rejestracji
//     (device_account.h) serwer odepnie urzadzenie od konta,
//   - "ota_rb" (stan walidacji OTA) i "kalkprov" (prowizjonowanie).
//
//  Wlaczany z settings_screen.h PO definicji kalkSettings i T() (oraz
//  _panicRequested) — tylko stamtad, bo main.cpp wlacza settings_screen.h
//  jako pierwszy plik UI.
// =====================================================================

#include <Arduino.h>
#include <U8g2lib.h>
#include <Preferences.h>
#include <SPIFFS.h>
#include <WiFi.h>
#include <esp_wifi.h>
#include "input.h"
#include "ui_kit.h"          // wyglad dialogu (naglowek, przyciski, komunikat)
#include "wifi_persist.h"     // wifiLoad/SaveDeviceToken, wifiStaOnLimited, _WP_*
#include "settings_screen.h"  // kalkSettings, T() — pragma once: no-op gdy wlaczany z settings_screen.h

extern volatile bool _panicRequested;

#define _FR_CONFIRM_TIMEOUT_MS  30000UL   // brak decyzji = anuluj

// ---------------------------------------------------------------------
// Kasowanie danych (bez UI). Po nim wolajacy robi ESP.restart().
// ---------------------------------------------------------------------
static void factoryResetWipe() {
    Serial.println("[FACTORY] start");

    // 1. Kopia tokenu urzadzenia PRZED czyszczeniem. Odczyt robi tez
    //    jednorazowa migracje "kalkmate" -> "kalkid", gdyby jeszcze nie zaszla.
    char tok[68] = "";
    wifiLoadDeviceToken(tok, sizeof(tok));

    // 2. NVS danych uzytkownika ("kalkid", "ota_rb", "kalkprov" zostaja).
    static const char* const kNs[] = { "kalkmate", "kalkhist", "kalkmap", "kalkoq" };
    for (size_t i = 0; i < sizeof(kNs) / sizeof(kNs[0]); i++) {
        Preferences p;
        if (p.begin(kNs[i], false)) {
            bool ok = p.clear();
            p.end();
            Serial.printf("[FACTORY] NVS %s: %s\n", kNs[i], ok ? "wyczyszczony" : "BLAD czyszczenia");
        }
    }

    // 3. Token z powrotem: do "kalkid" (idempotentne — nie byl czyszczony)
    //    oraz kopia w starym miejscu ("kalkmate"), ktore czyta firmware sprzed
    //    K5 — gdyby OTA zrobilo rollback, urzadzenie nie dostanie 401
    //    "Invalid device token" (website/src/lib/device-auth.ts).
    if (tok[0]) {
        if (!wifiSaveDeviceToken(tok)) Serial.println("[FACTORY] BLAD zapisu dev_token (kalkid)");
        Preferences p;
        if (p.begin(_WP_NS, false)) {
            if (p.putString(_WP_DEV_TOKEN, tok) == 0) Serial.println("[FACTORY] BLAD zapisu dev_token (kalkmate)");
            p.end();
        }
    }
    memset(tok, 0, sizeof(tok));

    // 4. Flaga "unpair" — serwer odepnie urzadzenie od konta przy nastepnej
    //    rejestracji (x-factory-reset: 1, device_account.h).
    {
        Preferences p;
        bool ok = false;
        if (p.begin(_WP_ID_NS, false)) {
            ok = (p.putBool(_WP_UNPAIR, true) == 1);
            p.end();
        }
        Serial.println(ok ? "[FACTORY] flaga unpair ustawiona" : "[FACTORY] BLAD zapisu flagi unpair");
    }

    // 5. SPIFFS — usun wszystkie pliki (wszystko tam to dane uzytkownika).
    //    Po jednym pliku na obieg (bez usuwania w trakcie iteracji katalogu);
    //    gdy usuniecie sie nie uda -> format calej partycji.
    if (SPIFFS.begin(true)) {
        bool failed = false;
        int removed = 0;
        for (int guard = 0; guard < 256; guard++) {
            File root = SPIFFS.open("/");
            if (!root) break;
            File f = root.openNextFile();
            if (!f) { root.close(); break; }
            String path = f.path();
            f.close();
            root.close();
            if (!SPIFFS.remove(path)) { failed = true; break; }
            removed++;
        }
        if (failed) {
            Serial.println("[FACTORY] SPIFFS: usuwanie nieudane -> format");
            SPIFFS.format();
        }
        Serial.printf("[FACTORY] SPIFFS: usunieto %d plikow\n", removed);
    }

    // 6. Wewnetrzna partycja WiFi esp-idf — osobna od naszej "kalkmate".
    //    WiFi.begin() z persistent=true (fw sprzed WiFi.persistent(false))
    //    zapisywal tam SSID+haslo przy KAZDYM polaczeniu; po wielu cyklach
    //    partycja potrafila sie zapchac ("zle haslo" mimo poprawnych danych).
    //    Wlaczenie STA wymusza init drivera (reset bywa wolany z kalkulatora,
    //    zanim cokolwiek uruchomilo WiFi) — z limitem mocy TX (anty-brownout).
    wifiStaOnLimited();
    esp_wifi_restore();
    WiFi.mode(WIFI_OFF);   // nie zostawiaj radia wlaczonego po resecie

    Serial.println("[FACTORY] done");
}

// ---------------------------------------------------------------------
// Para przyciskow dialogu (jak w uiConfirm): "cancel" w ramce, "confirm"
// wypelniony, wysrodkowane, baseline y. Uzywane tez w settings_screen.h
// (Kolejka offline).
// ---------------------------------------------------------------------
static void _frDrawButtons(U8G2& d, int y, const char* cancel, const char* confirm) {
    d.setFont(UI_FONT_SMALL);
    int wc = d.getStrWidth(cancel) + 8, wo = d.getStrWidth(confirm) + 8;
    int gap = 16, x = (UI_W - (wc + gap + wo)) / 2;
    uiButton(d, x, y, cancel, false);
    uiButton(d, x + wc + gap, y, confirm, true);
}

// Dialog potwierdzenia: ostrzezenie, co zostanie skasowane, przyciski;
// w naglowku odliczanie do automatycznego anulowania.
static void _frDrawConfirm(U8G2& d, int secLeft) {
    d.clearBuffer();
    char right[8];
    snprintf(right, sizeof(right), "%d s", secLeft);
    uiHeader(d, T("Reset fabryczny", "Factory reset", "Werksreset", "Tovarni reset"), false, right);
    d.setFont(UI_FONT);
    const char* q = T("Skasowac wszystkie dane?", "Erase all data?", "Alle Daten loeschen?", "Smazat vsechna data?");
    int w = d.getStrWidth(q), x = (UI_W - (w + 12)) / 2;
    d.setBitmapMode(1);
    d.drawXBM(x, 18, 8, 8, UI_ICO_WARN);
    d.setBitmapMode(0);
    d.drawStr(x + 12, 26, q);
    d.setFont(UI_FONT_SMALL);
    uiCenter(d, 37, T("Skasuje: WiFi, kod AI, historie, kolejke,",
                      "Deletes: WiFi, AI code, history, queue,",
                      "Loescht: WLAN, KI-Code, Verlauf, Warteschl.,",
                      "Smaze: WiFi, kod AI, historii, frontu,"));
    uiCenter(d, 45, T("notatki, sprawdziany, powiazanie z kontem.",
                      "notes, tests, account link.",
                      "Notizen, Tests, Kontoverknuepfung.",
                      "poznamky, testy, propojeni s uctem."));
    _frDrawButtons(d, 61, T("C/CE anuluj", "C/CE cancel", "C/CE abbrechen", "C/CE zrusit"),
                   T("OK resetuj", "OK reset", "OK zuruecksetzen", "OK resetovat"));
    d.sendBuffer();
}

// ---------------------------------------------------------------------
// Ekran potwierdzenia. Przerysowywany tylko gdy zmienia sie odliczanie
// (raz na sekunde). OK (= / 5) = TAK. Anulowanie: C/CE, "<" (+/- / 4),
// 30 s bez decyzji, panic (tylko gdy honorPanic — w kalkulatorze panic nie
// ma znaczenia, a jego flaga moze byc ustawiona z wczesniejszych klawiszy).
// ---------------------------------------------------------------------
static bool _factoryResetConfirm(U8G2& d, bool honorPanic) {
    int shownSec = (int)(_FR_CONFIRM_TIMEOUT_MS / 1000);
    _frDrawConfirm(d, shownSec);

    static const KalkKey kOk[] = { KEY_EQ, KEY_5 };
    static const KalkKey kNo[] = { KEY_CCE, KEY_PLUSMINUS, KEY_4 };
    // Klawisze trzymane w chwili wejscia (C/CE z 5-s przytrzymania, OK z menu
    // ustawien, zablokowany klawisz) NIE licza sie — dopiero nowe nacisniecie.
    for (KalkKey k : kOk) (void)inputKeyConsume(k);
    for (KalkKey k : kNo) (void)inputKeyConsume(k);

    const uint32_t t0 = millis();
    while (millis() - t0 < _FR_CONFIRM_TIMEOUT_MS) {
        int sec = (int)((_FR_CONFIRM_TIMEOUT_MS - (millis() - t0) + 999) / 1000);
        if (sec != shownSec) { shownSec = sec; _frDrawConfirm(d, sec); }
        if (honorPanic) {
            if (_panicRequested) return false;
            KalkKey pk = (KalkKey)kalkSettings.panicKey;
            if (pk != KEY_NONE && pk < KEY_COUNT && inputKeyConsume(pk)) {
                _panicRequested = true;
                return false;
            }
        }
        for (KalkKey k : kNo) if (inputKeyConsume(k)) return false;
        for (KalkKey k : kOk) if (inputKeyConsume(k)) return true;
        delay(20);
    }
    Serial.println("[FACTORY] brak potwierdzenia w 30 s — anulowano");
    return false;
}

// ---------------------------------------------------------------------
// Pelny przebieg: potwierdzenie -> kasowanie -> restart.
// Wraca TYLKO gdy uzytkownik anulowal (zwraca false).
// ---------------------------------------------------------------------
static bool factoryResetRun(U8G2& d, bool honorPanic) {
    if (!_factoryResetConfirm(d, honorPanic)) return false;

    const char* title = T("Reset fabryczny", "Factory reset", "Werksreset", "Tovarni reset");
    d.clearBuffer();
    uiHeader(d, title, false);
    d.setFont(UI_FONT);
    uiCenter(d, 30, T("Kasuje dane, prosze czekac...", "Erasing data, please wait...", "Loesche Daten, bitte warten...", "Mazu data, prosim cekejte..."));
    uiSpinner(d, UI_W / 2, 41);
    d.setFont(UI_FONT_SMALL);
    uiCenter(d, 56, T("Nie wylaczaj urzadzenia!", "Do not turn off the device!", "Geraet nicht ausschalten!", "Nevypinejte zarizeni!"));
    d.sendBuffer();

    factoryResetWipe();

    uiMessage(d, title, UI_ICO_CHECK,
              T("Zresetowano fabrycznie", "Factory reset done", "Werksreset abgeschlossen", "Tovarni reset dokoncen"),
              T("Restart...", "Restarting...", "Neustart...", "Restartuji..."));
    delay(1500);
    ESP.restart();
    while (true) delay(1000);   // niedosiegniete
    return true;
}
