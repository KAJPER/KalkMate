#pragma once
// =====================================================================
//  account_screen.h — ekrany "Status konta" i "Device ID + QR" (Ustawienia)
//
//  Logika sieciowa (accountRegister/accountFetchStatus) jest w
//  device_account.h — ten plik ma tylko rendering + obsluge klawiszy.
//  Przeniesione z main.cpp. Wlaczany na samym koncu main.cpp (po
//  qrcode.h), bo potrzebuje: mT() (main.cpp, zdefiniowane zaraz po
//  settings_screen.h), device_account.h, wifi_persist.h, panic.h i
//  biblioteki QRCode — wszystko to musi juz istniec w tym punkcie pliku.
// =====================================================================

#include <Arduino.h>
#include <WiFi.h>
#include <U8g2lib.h>
#include <qrcode.h>
#include "wifi_persist.h"
#include "device_account.h"
#include "panic.h"
#include "power.h"    // powerCheckSleep / powerSetInhibit

static String _mainDeviceMac() {
    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_WIFI_STA);
    char buf[16];
    snprintf(buf, sizeof(buf), "%02X%02X%02X%02X%02X%02X",
             mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    return String(buf);
}

// Auto-sleep w petlach oczekiwania ekranow konta (wczesniej ekran + radio
// zostawaly wlaczone bez limitu). Po wybudzeniu: odswiez ostatnia klatke
// (bufor u8g2 ja trzyma) i nie traktuj klawisza budzacego jako akcji.
static void _accSleepCheck(U8G2 &d) {
    if (!powerCheckSleep()) return;
    d.sendBuffer();
    inputKeyConsume(KEY_CCE);
    inputWaitRelease();
}

// "Status:  PODLACZONE" -> "PODLACZONE" (krotki status do prawej strony
// naglowka; ten sam tlumaczony napis co wczesniej w tresci ekranu).
static const char* _accStatusWord(const char* s) {
    const char* c = strchr(s, ':');
    if (!c) return s;
    c++;
    while (*c == ' ') c++;
    return *c ? c : s;
}

// Pokazuje status sparowania urzadzenia z kontem (Settings -> Status konta).
// Wymaga WiFi. Pyta serwer GET /api/device/account-status.
inline void showAccountStatusScreen(U8G2 &d) {
    inputWaitRelease();
    // Bez auto-sleep tylko na czas operacji sieciowych; przed kazda petla
    // oczekiwania na klawisz zdejmujemy blokade (powerSetInhibit(false)
    // przy okazji zeruje licznik bezczynnosci po dlugim laczeniu).
    powerSetInhibit(true);

    auto exitWait = [&]() {
        inputWaitRelease();
        powerSetInhibit(false);
    };

    // Render: laczenie / rejestracja
    const char* title = mT("Status konta", "Account status", "Kontostatus", "Stav uctu");
    auto drawBusy = [&](const char* msg) {
        uiBusy(d, title, UI_ICO_CLOUD, msg);
    };

    drawBusy(mT("Sprawdzam WiFi...", "Checking WiFi...", "Pruefe WLAN...", "Kontroluji WiFi..."));
    if (WiFi.status() != WL_CONNECTED) {
        char ssid[33] = "", pass[64] = "";
        wifiLoadSaved(ssid, sizeof(ssid), pass, sizeof(pass));
        if (ssid[0] == '\0') {
            uiMessage(d, title, UI_ICO_WIFI,
                      mT("Brak zapisanego WiFi.", "No saved WiFi.", "Kein gespeichertes WLAN.", "Zadna ulozena WiFi."),
                      mT("Ustawienia -> WiFi i konto", "Settings -> WiFi & account", "Einstellungen -> WLAN & Konto", "Nastaveni -> WiFi a ucet"),
                      nullptr,
                      mT("C/CE = wyjscie", "C/CE = exit", "C/CE = beenden", "C/CE = konec"));
            powerSetInhibit(false);
            while (true) {
                if (_panicRequested) { exitWait(); return; }
                _accSleepCheck(d);
                if (inputKeyConsume(KEY_CCE) || _setBtn(BTN_LEFT)) { exitWait(); return; }
                delay(20);
            }
        }
        drawBusy(mT("Lacze z WiFi...", "Connecting to WiFi...", "Verbinde mit WLAN...", "Pripojuji k WiFi..."));
        wifiConnectStart(ssid, pass);   // STA + TxPower; nie restartuje trwajacego laczenia
        unsigned long t0 = millis();
        while (WiFi.status() != WL_CONNECTED && millis() - t0 < 12000) delay(150);
    }

    if (WiFi.status() != WL_CONNECTED) {
        uiMessage(d, title, UI_ICO_WARN,
                  mT("Brak polaczenia z WiFi.", "No WiFi connection.", "Keine WLAN-Verbindung.", "Zadne pripojeni WiFi."),
                  nullptr, nullptr,
                  mT("C/CE = wyjscie", "C/CE = exit", "C/CE = beenden", "C/CE = konec"));
        powerSetInhibit(false);
        while (true) {
            if (_panicRequested) { exitWait(); return; }
            _accSleepCheck(d);
            if (inputKeyConsume(KEY_CCE) || _setBtn(BTN_LEFT)) { exitWait(); return; }
            delay(20);
        }
    }

    // Zarejestruj device (zaktualizuj unlock code) + pobierz status
    drawBusy(mT("Rejestruje urzadzenie...", "Registering device...", "Registriere Geraet...", "Registruji zarizeni..."));
    accountRegister();

    drawBusy(mT("Pobieram status...", "Fetching status...", "Lade Status...", "Nacitam stav..."));
    AccountStatus st;
    bool ok = accountFetchStatus(st);
    powerSetInhibit(false);

    // Render
    while (true) {
        if (_panicRequested) { exitWait(); return; }
        _accSleepCheck(d);
        d.clearBuffer();
        const char* foot = mT("C/CE = wyjscie   OK = odswiez", "C/CE = exit   OK = refresh", "C/CE = beenden   OK = aktualisieren", "C/CE = konec   OK = obnovit");
        char line[80];
        if (!ok) {
            uiHeader(d, title, true);
            d.setFont(UI_FONT);
            const char* l1 = mT("Blad pobierania:", "Fetch error:", "Ladefehler:", "Chyba nacteni:");
            int w = d.getStrWidth(l1);
            int x = (UI_W - (w + 12)) / 2;
            d.setBitmapMode(1);
            d.drawXBM(x, 23, 8, 8, UI_ICO_CROSS);
            d.setBitmapMode(0);
            d.drawStr(x + 12, 31, l1);
            snprintf(line, sizeof(line), "%s", st.error.c_str());
            d.setFont(UI_FONT_SMALL);
            uiCenter(d, 44, line);
        } else if (!st.paired) {
            uiHeader(d, title, true, _accStatusWord(mT("Status:  NIEPODLACZONE", "Status:  NOT LINKED", "Status:  NICHT VERBUNDEN", "Stav:    NEPROPOJENO")));
            d.setFont(UI_FONT);
            const char* l1 = mT("Sparuj na stronie:", "Pair on the website:", "Koppeln auf der Website:", "Sparujte na webu:");
            int w = d.getStrWidth(l1);
            int x = (UI_W - (w + 12)) / 2;
            d.setBitmapMode(1);
            d.drawXBM(x, 18, 8, 8, UI_ICO_KEY);
            d.setBitmapMode(0);
            d.drawStr(x + 12, 26, l1);
            uiCenter(d, 38, "kalkmate.pl/panel -> Kalkulator");
            d.setFont(UI_FONT_SMALL);
            uiCenter(d, 49, mT("Wpisz Device ID + kod odblokowania.",
                               "Enter Device ID + unlock code.",
                               "Geraete-ID + Freischaltcode eingeben.",
                               "Zadejte ID zarizeni + odemykaci kod."));
        } else {
            uiHeader(d, title, true, _accStatusWord(mT("Status:  PODLACZONE", "Status:  LINKED", "Status:  VERBUNDEN", "Stav:    PROPOJENO")));
            // Wiersze informacyjne (10 px): Konto / Licencja / Dni / Model
            int y = 22;
            uiInfoRow(d, y, mT("Konto", "Account", "Konto", "Ucet"), st.userEmail.c_str());
            y += 10;
            if (st.hasLicense) {
                const char* lic_s = (st.licenseStatus == "active") ? "OK" :
                                    (st.licenseStatus == "trial")  ? mT("trial", "trial", "Test", "zkusebni")
                                                                    : mT("wygas", "expired", "abgelaufen", "vyprsela");
                snprintf(line, sizeof(line), "%.14s (%s)", st.licenseCode.c_str(), lic_s);
                uiInfoRow(d, y, mT("Licencja", "License", "Lizenz", "Licence"), line);
                y += 10;
                if (st.daysLeft >= 0) {
                    snprintf(line, sizeof(line), "%d", st.daysLeft);
                    uiInfoRow(d, y, mT("Pozostalo dni", "Days left", "Resttage", "Zbyva dni"), line);
                    y += 10;
                }
                // Model AI (po '/', np. "google/gemini-2.5-pro" -> "gemini-2.5-pro") + tryb
                if (st.aiModel.length() > 0 || st.aiMode.length() > 0) {
                    int sl = st.aiModel.lastIndexOf('/');
                    String m = (sl >= 0) ? st.aiModel.substring(sl + 1) : st.aiModel;
                    if (m.length() > 0 && st.aiMode.length() > 0) m += " / ";
                    m += st.aiMode;
                    uiInfoRow(d, y, mT("Model", "Model", "Modell", "Model"), m.c_str());
                }
            } else {
                d.setFont(UI_FONT);
                d.setBitmapMode(1);
                const char* nl = mT("Brak licencji na koncie", "No license on account", "Keine Lizenz im Konto", "Na uctu neni licence");
                int w = d.getStrWidth(nl);
                int x = (UI_W - (w + 12)) / 2;
                d.drawXBM(x, 34, 8, 8, UI_ICO_WARN);
                d.setBitmapMode(0);
                d.drawStr(x + 12, 42, nl);
            }
        }

        uiFooter(d, foot);
        d.sendBuffer();

        if (inputKeyConsume(KEY_CCE) || _setBtn(BTN_LEFT)) { exitWait(); return; }
        if (_setBtn(BTN_OK)) {
            drawBusy(mT("Odswiezam...", "Refreshing...", "Aktualisiere...", "Obnovuji..."));
            accountRegister();
            ok = accountFetchStatus(st);
            inputWaitRelease();
            inputActivityReset();   // czas operacji sieciowej nie liczy sie do auto-sleep
        }
        delay(30);
    }
}

inline void showDeviceIdQrScreen(U8G2 &d) {
    inputWaitRelease();

    String deviceId = _mainDeviceMac();

    // Sprobuj zarejestrowac device na serwerze (zapisac unlockCode).
    // Robi sie raz — jesli WiFi off, ladujemy zapisane creds i probujemy.
    {
        uiBusy(d, "Device ID + QR", UI_ICO_CLOUD,
               mT("Rejestruje na serwerze...", "Registering with server...", "Registriere beim Server...", "Registruji na serveru..."));

        if (WiFi.status() != WL_CONNECTED) {
            char ssid[33] = "", pass[64] = "";
            wifiLoadSaved(ssid, sizeof(ssid), pass, sizeof(pass));
            if (ssid[0]) {
                wifiConnectStart(ssid, pass);   // STA + TxPower; nie restartuje trwajacego laczenia
                unsigned long t0 = millis();
                while (WiFi.status() != WL_CONNECTED && millis() - t0 < 8000) {
                    delay(150);
                    if (panicTriggered()) return;
                }
            }
        }
        if (WiFi.status() == WL_CONNECTED) {
            accountRegister();   // POST /api/device/register z unlockCode
        }
    }

    // URL: kalkmate.pl/claim?d=<MAC>  (po sparowaniu nie trzeba kodu licencji,
    // user na stronie wpisze unlockCode)
    String url = String(KALK_SERVER_URL) + "/claim?d=" + deviceId;

    // Generuj QR code (wersja 4 = 33x33 modules, mieści się 70+ znakow ASCII)
    QRCode qrcode;
    uint8_t qrcodeBytes[qrcode_getBufferSize(4)];
    qrcode_initText(&qrcode, qrcodeBytes, 4, ECC_LOW, url.c_str());

    inputActivityReset();   // laczenie/rejestracja nie liczy sie do auto-sleep
    while (true) {
        if (panicTriggered()) return;
        _accSleepCheck(d);
        d.clearBuffer();

        // Lewa strona: kod QR w normalnej polaryzacji (ciemne moduly na jasnym
        // polu + strefa ciszy 3 moduly) — czytelny dla kazdego skanera.
        // Wersja 4 = 33x33 moduly, 1 px/modul (2 px = 66 px > 64).
        const int qrSize = qrcode.size;      // 33
        const int qz     = 3;                // strefa ciszy
        const int box    = qrSize + 2 * qz;  // 39
        const int bx     = 4;
        const int by     = (UI_H - box) / 2;
        d.setDrawColor(1);
        d.drawBox(bx, by, box, box);
        d.setDrawColor(0);
        for (uint8_t y = 0; y < qrSize; y++) {
            for (uint8_t x = 0; x < qrSize; x++) {
                if (qrcode_getModule(&qrcode, x, y)) {
                    d.drawPixel(bx + qz + x, by + qz + y);
                }
            }
        }
        d.setDrawColor(1);

        // Prawa strona: naglowek, Device ID duzym fontem, podpowiedz
        const int tx = bx + box + 10;
        d.setFont(UI_FONT);
        d.drawStr(tx, 10, "<");
        d.drawStr(tx + 10, 10, "Device ID + QR");
        d.drawHLine(tx - 4, UI_HEADER_LINE, UI_W - (tx - 4));
        d.setFont(UI_FONT_SMALL);
        d.drawStr(tx, 22, "Device ID");
        d.setFont(UI_FONT_BIG);
        d.drawStr(tx, 39, deviceId.c_str());
        d.setFont(UI_FONT_SMALL);
        d.drawStr(tx, 51, mT("Skanuj QR -> podlaczenie",
                             "Scan QR -> link to account",
                             "QR scannen -> Konto verknuepfen",
                             "Naskenujte QR -> propojeni"));
        d.drawStr(tx, 60, mT("do panelu klienta.",
                             "in user panel.",
                             "im Kundenpanel.",
                             "v zakaznickem panelu."));
        d.setFont(UI_FONT);

        d.sendBuffer();

        if (_panicRequested) return;
        inputScan();
        if (inputBtn(BTN_OK) == LOW || inputBtn(BTN_LEFT) == LOW ||
            inputKeyConsume(KEY_CCE)) {
            inputWaitRelease();
            return;
        }
        delay(30);
    }
}
