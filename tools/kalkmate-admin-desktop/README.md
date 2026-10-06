# KalkMate Admin (desktop)

Aplikacja Windows (Electron) opakowująca panel administracyjny
[kalkmate.pl/admin](https://kalkmate.pl/admin) we własne okno. Sesja logowania
(cookie) jest trzymana na dysku, więc po zalogowaniu raz aplikacja pamięta
login przez wiele miesięcy (tyle, ile ważne jest cookie sesyjne wystawiane
przez serwer).

## Uruchomienie w trybie deweloperskim

```bash
npm install
npm start
```

Otworzy się okno z panelem admina. Przy pierwszym uruchomieniu trzeba się
zalogować — dane logowania i cookies zostają zapisane lokalnie.

## Budowanie instalatora (.exe)

```bash
npm install
npm run dist
```

Gotowy instalator pojawi się w `dist\KalkMate-Admin-Setup-1.0.0.exe`.
Przy pierwszym uruchomieniu `npm run dist` electron-builder pobiera
dodatkowe binaria (Electron, narzędzia do budowania instalatora NSIS) —
może to potrwać kilka minut i wymaga połączenia z internetem.

## Gdzie trzyma się sesja

Cookies i dane logowania są zapisane w profilu Electrona pod:

```
%APPDATA%\kalkmate-admin
```

Ten katalog przetrwa aktualizacje aplikacji (nowa wersja instalatora go nie
czyści). Usunięcie tego folderu = pełne wylogowanie ze wszystkich kont.

## Jak się wylogować

W aplikacji: menu **Plik → Wyloguj i wyczyść sesję**. Czyści cookies/storage
tylko dla panelu admina (partycja `persist:kalkmate`) i przeładowuje stronę
logowania — nie trzeba niczego odinstalowywać ani kasować ręcznie plików.

## Skróty klawiszowe

- `Ctrl+R` — przeładuj
- `Alt+←` / `Alt+→` — wstecz / dalej
- `Ctrl+=` / `Ctrl+-` / `Ctrl+0` — powiększ / pomniejsz / reset zoomu
- `Ctrl+Shift+I` — narzędzia deweloperskie

## Programator

Menu **Narzędzia → Programator kalkulatorów** (`Ctrl+Shift+P`) uruchamia
osobny program GUI do wgrywania firmware na płytki KalkMate.

- **Wersja zainstalowana (paczka .exe):** programator jest dołączony do
  instalatora i uruchamiany z `resources/flasher/KalkMateFlasher.exe`
  (folder `flasher` trafia tam z `../flasher/dist/KalkMateFlasher` —
  wynik `PyInstaller --onedir`, wraz z folderem `_internal/`). Jeśli plik
  nie zostanie znaleziony, aplikacja pokaże błąd z prośbą o ponowną
  instalację.
- **Tryb deweloperski (`npm start`):** uruchamiany jest
  `tools/flasher/flasher.py` systemowym Pythonem (`python`).
- Konfiguracja, log i klucze programatora trzymane są w
  `%APPDATA%\KalkMate\flasher` — przed flashowaniem partii PROD klucze
  trzeba tam skopiować ręcznie z głównego komputera (nie są częścią
  instalatora).
- Jeśli programator już działa, ponowne kliknięcie menu tylko pokaże
  komunikat „Programator jest już uruchomiony" zamiast otwierać drugą
  instancję.

## Drukarka fiskalna (paragony)

Od wersji 1.3.0 aplikacja ma wbudowanego agenta fiskalnego (`fiscal/`). Jest to port
[`fiscal-agent/`](../../fiscal-agent/) do Node, więc nie trzeba instalować Pythona.
Agent pobiera z kalkmate.pl paragony dodane w panelu („Wystaw paragon” w
zamówieniu) i drukuje je na drukarce fiskalnej **POSNET Online** w sieci lokalnej
(TCP/WiFi). Kasa Posnet Ergo się do tego nie nadaje — wyjaśnienie w
[`docs/fiskalizacja/README.md`](../../docs/fiskalizacja/README.md).

**Konfiguracja:** w aplikacji otwórz **Fiskalizacja** w panelu. Karta „Ten komputer”
pojawia się tylko w aplikacji. Wpisz IP i port drukarki, kliknij **Sprawdź drukarkę**,
a potem zaznacz **Drukuj paragony z tego komputera**. Ustawienia zapisują się w
`%APPDATA%\kalkmate-admin\settings.json`.

**Logowanie:** agent łączy się z serwerem sesją admina z aplikacji (bez osobnego
tokenu). Po wylogowaniu przestaje pobierać paragony, dopóki się nie zalogujesz.

**Kolejka:** zapisywana w `%APPDATA%\kalkmate-admin\fiscal-jobs.json`, więc
przetrwa zamknięcie aplikacji. Aplikacja drukuje tylko wtedy, gdy jest włączona.
Paragony dodane przy wyłączonej aplikacji czekają na serwerze. Zamknięcie okna w
trakcie druku czeka na koniec paragonu (maks. 30 s).

**Bezpiecznik:** domyślnie aplikacja odmawia druku na drukarce w trybie
**fiskalnym**. Przełącznik „Druk na drukarce w trybie FISKALNYM” odblokowujesz
dopiero po testach na drukarce niefiskalnej.

**Testy logiki:** `npm install` i `npm run test:fiscal`. Testy używają symulatora
drukarki z `fiscal-agent/` i wymagają `python3`.

## Uwaga o linkach

Linki do `kalkmate.pl` oraz do kurierów (`basecourier.com`, `inpost.pl`, w
tym subdomeny) otwierają się w oknie aplikacji. Wszystkie inne linki
(np. do dokumentacji, zewnętrznych serwisów) otwierają się w domyślnej
przeglądarce systemowej.
