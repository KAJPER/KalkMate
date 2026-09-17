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

## Uwaga o linkach

Linki do `kalkmate.pl` oraz do kurierów (`basecourier.com`, `inpost.pl`, w
tym subdomeny) otwierają się w oknie aplikacji. Wszystkie inne linki
(np. do dokumentacji, zewnętrznych serwisów) otwierają się w domyślnej
przeglądarce systemowej.
