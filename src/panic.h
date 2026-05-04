#pragma once
// =====================================================================
//  panic.h — globalny panic button (powrot do trybu kalkulatora z dowolnego ekranu)
//
//  Klawisz panic ustawiany w kalkSettings.panicKey (domyslnie KEY_MU).
//  Gdy panic naciety, ustawiamy flage `_panicRequested`. Kazdy UI screen
//  sprawdza ja w petli (panicTriggered()) i jesli true - return.
//
//  main.cpp loop() po wyjsciu z UI screen sprawdza flage i jesli
//  ustawiona, wywoluje runCalculator + panicClear().
// =====================================================================

#include <Arduino.h>
#include "input.h"
#include "settings_screen.h"

// Definicja w main.cpp — extern zeby wszystkie TU widzialy tę sama zmienna
extern volatile bool _panicRequested;

inline bool panicTriggered() { return _panicRequested; }
inline void panicClear()      { _panicRequested = false; }

// Wywoluj w petlach UI - sprawdza czy panic key zostal nacisniety
// (z `kalkSettings.panicKey`). Jesli tak, ustawia flage.
inline void panicCheck() {
    KalkKey pk = (KalkKey)kalkSettings.panicKey;
    if (pk == KEY_NONE || pk >= KEY_COUNT) return;
    if (inputKeyConsume(pk)) {
        _panicRequested = true;
    }
}
