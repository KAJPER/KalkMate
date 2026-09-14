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

static String _mainDeviceMac() {
    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_WIFI_STA);
    char buf[16];
    snprintf(buf, sizeof(buf), "%02X%02X%02X%02X%02X%02X",
             mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    return String(buf);
}

// Pokazuje status sparowania urzadzenia z kontem (Settings -> Status konta).
// Wymaga WiFi. Pyta serwer GET /api/device/account-status.
inline void showAccountStatusScreen(U8G2 &d) {
    inputWaitRelease();
    powerSetInhibit(true);

    auto exitWait = [&]() {
        inputWaitRelease();
        powerSetInhibit(false);
    };

    // Render: laczenie / rejestracja
    auto drawBusy = [&](const char* msg) {
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 10, mT("Status konta", "Account status", "Kontostatus"));
        d.drawHLine(0, 12, 256);
        d.drawStr(2, 32, msg);
        d.sendBuffer();
    };

    drawBusy(mT("Sprawdzam WiFi...", "Checking WiFi...", "Pruefe WLAN..."));
    if (WiFi.status() != WL_CONNECTED) {
        char ssid[33] = "", pass[64] = "";
        wifiLoadSaved(ssid, sizeof(ssid), pass, sizeof(pass));
        if (ssid[0] == '\0') {
            d.clearBuffer();
            d.setFont(u8g2_font_6x10_tf);
            d.drawStr(2, 10, mT("Status konta", "Account status", "Kontostatus"));
            d.drawHLine(0, 12, 256);
            d.drawStr(2, 32, mT("Brak zapisanego WiFi.", "No saved WiFi.", "Kein gespeichertes WLAN."));
            d.drawStr(2, 44, mT("Settings -> Ustaw WiFi", "Settings -> Set up WiFi", "Settings -> WLAN einrichten"));
            d.setFont(u8g2_font_5x7_tf);
            d.drawStr(2, 62, mT("C/CE = wyjscie", "C/CE = exit", "C/CE = beenden"));
            d.sendBuffer();
            while (true) {
                if (_panicRequested) { exitWait(); return; }
                if (inputKeyConsume(KEY_CCE) || _setBtn(BTN_LEFT)) { exitWait(); return; }
                delay(20);
            }
        }
        drawBusy(mT("Lacze z WiFi...", "Connecting to WiFi...", "Verbinde mit WLAN..."));
        WiFi.mode(WIFI_STA);
        WiFi.begin(ssid, pass);
        unsigned long t0 = millis();
        while (WiFi.status() != WL_CONNECTED && millis() - t0 < 12000) delay(150);
    }

    if (WiFi.status() != WL_CONNECTED) {
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 10, mT("Status konta", "Account status", "Kontostatus"));
        d.drawHLine(0, 12, 256);
        d.drawStr(2, 32, mT("Brak polaczenia z WiFi.", "No WiFi connection.", "Keine WLAN-Verbindung."));
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 62, mT("C/CE = wyjscie", "C/CE = exit", "C/CE = beenden"));
        d.sendBuffer();
        while (true) {
            if (_panicRequested) { exitWait(); return; }
            if (inputKeyConsume(KEY_CCE) || _setBtn(BTN_LEFT)) { exitWait(); return; }
            delay(20);
        }
    }

    // Zarejestruj device (zaktualizuj unlock code) + pobierz status
    drawBusy(mT("Rejestruje urzadzenie...", "Registering device...", "Registriere Geraet..."));
    accountRegister();

    drawBusy(mT("Pobieram status...", "Fetching status...", "Lade Status..."));
    AccountStatus st;
    bool ok = accountFetchStatus(st);

    // Render
    while (true) {
        if (_panicRequested) { exitWait(); return; }
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 10, mT("Status konta", "Account status", "Kontostatus"));
        d.drawHLine(0, 12, 256);

        d.setFont(u8g2_font_5x7_tf);
        char line[80];
        if (!ok) {
            d.drawStr(2, 22, mT("Blad pobierania:", "Fetch error:", "Ladefehler:"));
            snprintf(line, sizeof(line), "%s", st.error.c_str());
            d.drawStr(2, 32, line);
        } else if (!st.paired) {
            d.drawStr(2, 22, mT("Status:  NIEPODLACZONE", "Status:  NOT LINKED", "Status:  NICHT VERBUNDEN"));
            d.drawStr(2, 34, mT("Sparuj na stronie:", "Pair on the website:", "Koppeln auf der Website:"));
            d.drawStr(2, 44, "kalkmate.pl/panel -> Kalkulator");
            d.drawStr(2, 54, mT("Wpisz Device ID + kod odblokowania.",
                                 "Enter Device ID + unlock code.",
                                 "Geraete-ID + Freischaltcode eingeben."));
        } else {
            d.drawStr(2, 21, mT("Status:  PODLACZONE", "Status:  LINKED", "Status:  VERBUNDEN"));
            snprintf(line, sizeof(line), mT("Konto: %.34s", "Account: %.34s", "Konto: %.34s"), st.userEmail.c_str());
            d.drawStr(2, 30, line);
            if (st.hasLicense) {
                const char* lic_s = (st.licenseStatus == "active") ? "OK" :
                                    (st.licenseStatus == "trial")  ? mT("trial", "trial", "Test")
                                                                    : mT("wygas", "expired", "abgelaufen");
                snprintf(line, sizeof(line), mT("Lic: %.14s (%s)", "Lic: %.14s (%s)", "Lizenz: %.14s (%s)"),
                         st.licenseCode.c_str(), lic_s);
                d.drawStr(2, 39, line);

                // Dni + aktywny model AI na jednej linii
                char combo[64] = "";
                if (st.daysLeft >= 0)
                    snprintf(combo, sizeof(combo), mT("Dni: %d", "Days: %d", "Tage: %d"), st.daysLeft);
                if (st.aiModel.length() > 0) {
                    // Skroc do nazwy po '/' (np. "google/gemini-2.5-pro" -> "gemini-2.5-pro")
                    int sl = st.aiModel.lastIndexOf('/');
                    String m = (sl >= 0) ? st.aiModel.substring(sl + 1) : st.aiModel;
                    if (m.length() > 13) m = m.substring(0, 11) + "..";
                    char tmp[40];
                    snprintf(tmp, sizeof(tmp), "%sAI:%s",
                             combo[0] ? "  " : "", m.c_str());
                    strncat(combo, tmp, sizeof(combo) - strlen(combo) - 1);
                }
                if (combo[0]) d.drawStr(2, 48, combo);

                if (st.aiMode.length() > 0) {
                    snprintf(line, sizeof(line), mT("Tryb: %.28s", "Mode: %.28s", "Modus: %.28s"), st.aiMode.c_str());
                    d.drawStr(2, 57, line);
                }
            } else {
                d.drawStr(2, 39, mT("Brak licencji na koncie", "No license on account", "Keine Lizenz im Konto"));
            }
        }

        d.drawStr(2, 63, mT("C/CE = wyjscie   OK = odswiez", "C/CE = exit   OK = refresh", "C/CE = beenden   OK = aktualisieren"));
        d.sendBuffer();

        if (inputKeyConsume(KEY_CCE) || _setBtn(BTN_LEFT)) { exitWait(); return; }
        if (_setBtn(BTN_OK)) {
            drawBusy(mT("Odswiezam...", "Refreshing...", "Aktualisiere..."));
            accountRegister();
            ok = accountFetchStatus(st);
            inputWaitRelease();
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
        d.clearBuffer();
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 10, "Device ID + QR");
        d.drawHLine(0, 12, 256);
        d.drawStr(2, 32, mT("Rejestruje na serwerze...", "Registering with server...", "Registriere beim Server..."));
        d.sendBuffer();

        if (WiFi.status() != WL_CONNECTED) {
            char ssid[33] = "", pass[64] = "";
            wifiLoadSaved(ssid, sizeof(ssid), pass, sizeof(pass));
            if (ssid[0]) {
                WiFi.mode(WIFI_STA);
                WiFi.begin(ssid, pass);
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

    while (true) {
        if (panicTriggered()) return;
        d.clearBuffer();

        // Lewa strona: device ID + info
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 8, "Device ID:");
        d.setFont(u8g2_font_6x10_tf);
        d.drawStr(2, 20, deviceId.c_str());
        d.setFont(u8g2_font_5x7_tf);
        d.drawStr(2, 32, mT("Skanuj QR -> podlaczenie",
                             "Scan QR -> link to account",
                             "QR scannen -> Konto verknuepfen"));
        d.drawStr(2, 42, mT("do panelu klienta.",
                             "in user panel.",
                             "im Kundenpanel."));
        d.drawStr(2, 60, mT("OK / < = wyjscie",
                             "OK / < = exit",
                             "OK / < = beenden"));

        // Prawa strona: QR (po prawej, 64x64 px max)
        // QR wersja 4 = 33 modules, kazdy 1px = 33x33. Mieści się prawo.
        int qrSize = qrcode.size;   // 33
        int scale = 1;              // 1px per module
        int qrPx = qrSize * scale;
        int xOff = 256 - qrPx - 4;
        int yOff = (64 - qrPx) / 2;
        for (uint8_t y = 0; y < qrSize; y++) {
            for (uint8_t x = 0; x < qrSize; x++) {
                if (qrcode_getModule(&qrcode, x, y)) {
                    d.drawPixel(xOff + x * scale, yOff + y * scale);
                }
            }
        }

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
