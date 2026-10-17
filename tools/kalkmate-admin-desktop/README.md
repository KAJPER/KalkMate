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

**Kolejka:** zapisywana w `%APPDATA%\kalkmate-admin\fiscal-jobs.json` (zapis
atomowy z fsync + kopia `fiscal-jobs.json.bak`), więc przetrwa zamknięcie
aplikacji. Aplikacja drukuje tylko wtedy, gdy jest włączona. Paragony dodane przy
wyłączonej aplikacji czekają na serwerze. Zamknięcie okna w trakcie druku czeka na
koniec paragonu (maks. 30 s). Uszkodzony plik kolejki jest odkładany jako
`fiscal-jobs.json.corrupt-<czas>`, kolejka odtwarzana z kopii (niedokończone
zlecenia jako „niepewne”), a drukowanie **wstrzymane** z ostrzeżeniem w karcie
aplikacji. Po sprawdzeniu drukarki odblokuj je: **Narzędzia → Odblokuj kolejkę
paragonów…**.

**Identyfikator agenta:** `%APPDATA%\kalkmate-admin\fiscal-agent-state.json`
(trwały `agentId` i licznik tokenów ramek). Serwer oddaje pobrane zlecenie tylko
temu samemu agentowi — po skasowaniu tego pliku zlecenia „w drukarce” przekazuje
się w panelu.

**Bezpieczniki:** domyślnie aplikacja odmawia druku na drukarce w trybie
**fiskalnym** (także gdy drukarka nie podaje trybu). Przełącznik „Druk na drukarce
w trybie FISKALNYM” odblokowujesz dopiero po testach na drukarce niefiskalnej —
aplikacja dodatkowo pyta o to we własnym oknie. Adres drukarki spoza sieci
lokalnej też wymaga potwierdzenia. Limity kwot (domyślnie 4000 zł, 5 pozycji,
wymagany numer zamówienia) ustawia się tylko lokalnie: klucz `fiscalLimits`
(`maxTotal` w groszach, `maxItems`, `requireReference`) w `settings.json` albo
zmienne `KALKMATE_FISCAL_MAX_TOTAL` / `KALKMATE_FISCAL_MAX_ITEMS`.

**Testy logiki:** `npm install` i `npm test` (albo `npm run test:fiscal`). Testy
używają symulatora drukarki z `fiscal-agent/` i wymagają Pythona 3 — na Windows
uruchamiany jest `python`, na innych systemach `python3`; inny interpreter:
zmienna `FISCAL_SIM_PYTHON`.

## Uwaga o linkach

Linki `https://` do `kalkmate.pl` oraz do kurierów (`basecourier.com`,
`inpost.pl`, w tym subdomeny) otwierają się w oknie aplikacji. Wszystkie inne
linki (np. do dokumentacji, zewnętrznych serwisów) otwierają się w domyślnej
przeglądarce systemowej — tylko `http(s):` i `mailto:`, inne schematy
(`file:`, `ms-*:` itp.) są blokowane. Most `window.kalkmateDesktop`
(programator, druk etykiet, agent fiskalny) odpowiada wyłącznie stronom
`https://kalkmate.pl`; strony kurierów nie mogą nim sterować. Strony nie dostają
uprawnień przeglądarki (kamera, mikrofon, lokalizacja…) poza zapisem do schowka.
