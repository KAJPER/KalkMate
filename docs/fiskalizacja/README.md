# Fiskalizacja — Posnet Ergo Online a paragony z platformy KalkMate

Platforma: KalkMate (`website/`): Next.js 16 + Prisma/SQLite na VPS (Ubuntu + nginx), sprzedaż przez internet (Przelewy24, Stripe). Kod modułu:

- agent lokalny: [`fiscal-agent/`](../../fiscal-agent/) (Python, FastAPI);
- część serwerowa: `website/src/lib/fiscal.ts`, `/api/fiscal/agent/*`, `/admin/fiscal`.

Oznaczenia w tym dokumencie:

- ✅ **potwierdzone** w dokumentacji (podane źródło);
- ⚠️ **domysł / niezweryfikowane** — do sprawdzenia na urządzeniu albo z serwisem.

---

## TL;DR

1. **Ergo Online to kasa rejestrująca (ECR), nie drukarka fiskalna.** Paragon wystawia się na niej z klawiatury. Dla połączenia z komputerem Posnet dokumentuje „protokół kasowy”: wymianę baz towarów (PLU), konfigurację i odczyt sprzedaży z buforów paragonowych.
   - ✅ Kasa obsługuje połączenia PC po TCP przez WiFi, w tym „Wychodzące TCP”.
   - ⚠️ W publicznej dokumentacji **nie ma komendy „wystaw paragon fiskalny zlecony z PC”**. Nie znalazłem też specyfikacji protokołu konkretnie dla Ergo Online. Szczegóły w [sekcji 1](#1-co-jest-w-dokumentacji-posnet).
2. Pełny, publicznie udokumentowany protokół z transakcjami (`trinit` → `trline` → `trpayment` → `trend`) mają **drukarki fiskalne POSNET**, np. Thermal / Temo / Trio Online po TCP/WiFi. Moduł jest zbudowany na tym protokole.
3. Wniosek praktyczny: żeby paragony szły automatycznie z platformy, potrzebna jest **drukarka fiskalna online Posnet**, a nie Ergo. Ergo może dalej służyć do sprzedaży „z ręki”. Druga droga to potwierdzenie przez Posnet lub serwis, że Ergo Online ma w firmware tryb sprzedaży z PC, i dostanie jego specyfikacji. Wtedy dopisuje się drugi sterownik w agencie, a reszta zostaje bez zmian.
4. **Prawo:** sprzedaż KalkMate wysyłkowo najpewniej **nie** korzysta ze zwolnienia z kasy. Zwolnienie „wysyłkowe” nie obejmuje wyrobów elektronicznych z wyświetlaczem ani kamer. Paragony są więc obowiązkowe. Szczegóły w [sekcji 4](#4-wymogi-prawne); potwierdź to z księgowym.

---

## 1. Co jest w dokumentacji Posnet

### 1.1 Ergo Online — połączenie z komputerem

Źródło: oficjalna instrukcja obsługi Ergo Online v1.7, rozdział „Usługi PC”, str. 174–178, oraz v2.01.

| Fakt | Status |
|---|---|
| Do 2 „połączeń PC”. Interfejs: COM1, COM2, USB, **TCP**, **Wychodzące TCP**, Bluetooth | ✅ |
| TCP: port wpisywany z klawiatury; nasłuch na AUTO / GPRS / **WiFi** / karta sieciowa USB | ✅ |
| „Wychodzące TCP”: kasa sama łączy się z podanym IP i portem | ✅ |
| Strona kodowa transmisji: Windows-1250, Mazovia, Latin 2 | ✅ |
| „Logowanie zdalne”: kasa udostępnia zasoby dopiero po podaniu hasła przez program | ✅ |
| Bufory pozycji paragonowych: kasa zapisuje wykonane operacje, a program je odczytuje | ✅ |
| Monitory transakcji: kasa wysyła na bieżąco informacje o operacjach | ✅ |
| Programowanie baz odbywa się „przez protokół kasowy” (instrukcja 2.01, str. 170) | ✅ |
| Komenda wystawienia paragonu fiskalnego zleconego z PC | ⚠️ **nie znaleziono** |
| Specyfikacja protokołu kasowego **dla Ergo Online** | ⚠️ **niedostępna publicznie** |

### 1.2 Protokół kasowy Posnet (rodzina kas)

Źródło: „Specyfikacja protokołu kas POSNET NEO EJ 1.01 / NEO 1.02 / BINGO 3.02 / COMBO 1.02” v002 z 2010 r. Dokument firmy Posnet, publiczna kopia leży na soft-bit.pl.

- ✅ Ramka binarna: `SYN STX FLAGS TOKEN F_LEN FLD_NUM CMD_ID DATA… CRC SYN ETX`, CRC16 (x¹⁶+x¹²+x⁵+1), liczby BCD.
- ✅ TCP: kasa nasłuchuje, domyślnie na porcie 1000 (zmiana w konfiguracji lub sekwencją `COMMCFGSET`).
- ✅ Sekwencje dotyczą:
  - konfiguracji (`HEADERSET`, `VATGET`…);
  - baz (PLU, kasjerzy, formy płatności…);
  - odczytu buforów (`SALERECGET`) i statusów (`CASHREGSTATUSGET`, `TRANSSTATUSGET`);
  - raportów;
  - logowania zdalnego (`REMOTELOGIN`).
- ✅ W spisie sekwencji **nie ma** otwarcia, linii ani zamknięcia paragonu zleconego z PC. `TRANSSTATUSGET` tylko odczytuje stan transakcji prowadzonej na kasie.
- ⚠️ To dokument dla starszych kas (EJ, 2010). Nie wiadomo, czy Ergo Online używa identycznego protokołu. Dlatego **nie zaimplementowałem** sterownika kasowego — byłoby to zgadywanie komend.

Ogólną zasadę potwierdza też dokumentacja Comarch ERP Optima: „Obsługa kas fiskalnych polega na przesyłaniu danych o towarach do kasy i imporcie raportu sprzedaży z kasy do programu. Współpraca przebiega w trybie off-line.” Drukowanie paragonów z programu Optima obsługuje tylko przez **drukarki** fiskalne.

### 1.3 Protokół POSNET dla drukarek fiskalnych (użyty w module)

Źródło: „Specyfikacja protokołu POSNET” DBC-I-DEV-45 v021 (Thermal FV EJ / HS FV EJ / FV 3.02), dokument Posnet, kopia na soft-bit.pl.

| Element | Szczegóły | Status |
|---|---|---|
| Ramka | `STX cmd TAB pp<wartość> TAB … [@TOKEN TAB] #CRC16 ETX`; parametry to 2-literowe mnemoniki | ✅ |
| CRC | CRC16-CCITT liczone z bajtów między STX a `#`, zapis szesnastkowy. Tablice ze specyfikacji = wariant XMODEM (poly 0x1021, init 0); w testach zgodność z tablicami i wektorem `"123456789" → 0x31C3` | ✅ |
| Odpowiedzi | OK: `STX cmd TAB … #CRC ETX`; błąd polecenia: `?nnnn`; błąd ramki: `ERR … ?nn` (w przykładzie `rpt` zapisany jako `er13`, parser akceptuje oba) | ✅ |
| Token i `rpt` | Odpowiedź niesie token; `rpt` z tokenem powtarza odpowiedź (bufor 32 odpowiedzi / 1 KiB). Błąd ramki 13 = brak rozkazu o tym tokenie | ✅ |
| Paragon | `trinit bm1` (tryb blokowy) → `trline na vt pr il wa [rw rn op]` → `trpayment ty wa [na re]` → `trend to fp [re]` | ✅ |
| Formy płatności | `ty`: 0 gotówka, 2 karta, 3 czek, 4 bon, 5 kredyt, 6 inna, 7 voucher, 8 konto klienta | ✅ |
| Anulowanie | `prncancel` (synonim `trcancel`) | ✅ |
| Status | `sdev.ds`: 0 gotowość, 1 w menu, 2 czeka na klawisz, 3 błąd czeka na użytkownika. `sprn.pr`: 0 OK, 1 dźwignia, 3 pokrywa, **4/5 brak papieru**, 8 obcinacz… `scomm.fs` = tryb fiskalny; `strns.to` = otwarta transakcja | ✅ |
| Numer paragonu | `trend` ma odpowiedź „standardową” (bez numeru). Numer czytamy z `scnt.bn` („numer ostatnio wydrukowanego paragonu”) przed i po | ✅ (sposób odczytu to nasze rozwiązanie) |
| Stawki VAT | `vatget` → `va…vg` (A–G = indeksy 0–6); 100 = zwolniona, 101 = nieaktywna. `trline.vt` = indeks stawki | ✅ |
| Drukarki **Online** (XL2 / Temo / Trio Online) używają tego samego zestawu komend | ⚠️ Prawie pewne: fiskaltrust używa `scomm`/`trinit`/`trline`/`trpayment`/`trend` dla „POSNET Online printer” po TCP. Nie mam jednak specyfikacji dla wersji Online — przed produkcją potwierdź z serwisem lub Posnet (sekcja 6) |
| Port TCP drukarki | Ustawiany w menu drukarki (Usługi PC → Interfejs PC → TCP/IP). Przykład w dokumentacji fiskaltrust: `tcp://192.168.1.50:6666` | ⚠️ Port domyślny nieustalony |
| Autoryzacja | Protokół drukarki nie ma hasła — ochrona tylko na poziomie sieci (osobny VLAN lub sieć gości) | ✅ (brak w specyfikacji) |
| Kodowanie polskich znaków | „w odpowiednim kodowaniu”; agent domyślnie używa cp1250, da się zmienić | ⚠️ Ustaw zgodnie z menu drukarki |

### 1.4 Gotowe biblioteki open source

| Projekt | Język | Ocena |
|---|---|---|
| [leafnode/PyPOSNET](https://github.com/leafnode/PyPOSNET) | Python | Tylko port szeregowy, 2 commity, brak licencji w README — **nie** |
| [mwegrzynek/litex.posnet](https://github.com/mwegrzynek/litex.posnet) | Python | 9 commitów, 2 gwiazdki, mała aktywność — co najwyżej jako referencja |
| [Kerso-official/Posnet-Connector](https://github.com/Kerso-official/Posnet-Connector) | Python, MIT | Według autora „nie testowane na drukarce”, transakcje niezaimplementowane — **nie** |
| [evox95/pyposnet](https://github.com/evox95/pyposnet) | Python, GPL-2.0 | Serwer protokołu Thermal, 2 commity; GPL — **nie** |
| [Be-Grabby/posnetjs](https://github.com/Be-Grabby/posnetjs) | TypeScript | USB/serial, 20 commitów, wczesna faza, brak TCP — **nie** |
| [trilab_driver_posnet (Odoo)](https://apps.odoo.com/apps/modules/18.0/trilab_driver_posnet) | Python / Odoo | Licencja OPL-1, 549 USD, wymaga Odoo Enterprise; przetestowane Thermal XL i Trio Online — tylko dla Odoo |
| [fiskaltrust middleware (POSNET SCU)](https://docs.fiskaltrust.eu/docs/poscreators/middleware-doc/poland/scu/posnet) | C# | Wersja preview, tylko ścieżka paragonu; sensowne, jeśli wybierzesz fiskaltrust |

Wniosek: nie ma dojrzałej biblioteki Python z TCP i obsługą błędów. Protokół drukarki jest mały i dobrze opisany, więc napisałem własny klient (`fiscal-agent/fiscal_agent/posnet/`, ok. 300 linii) z testami.

## 2. Bezpośrednio po TCP czy przez pośrednika?

- ✅ Ergo Online (i drukarki Online) przyjmują połączenie TCP w sieci lokalnej (WiFi lub LAN). Posnet nie wymaga „Posnet Servera” ani bramki HTTP — protokół idzie wprost po gnieździe.
- Ograniczenia:
  - Urządzenie ma prywatny adres w LAN, a platforma jest w chmurze. Bezpośrednie połączenie z VPS wymagałoby przekierowania portu na routerze, czyli wystawienia urządzenia fiskalnego bez szyfrowania i hasła do internetu. **Tego nie robimy.**
  - Jedno połączenie i jedna kolejka rozkazów naraz. Równoległe programy (np. program magazynowy i agent) mogą sobie przeszkadzać — ⚠️ do sprawdzenia, ile połączeń TCP urządzenie przyjmuje.
  - WiFi zrywa połączenia, a stan „czy paragon się wydrukował” bywa niepewny. Stąd tokeny, `rpt` i sprawdzanie liczników w agencie.
  - „Wychodzące TCP” w Ergo pozwoliłoby kasie łączyć się do serwera. Dalej byłby to jednak protokół kasowy (bez paragonów z PC) i ruch bez szyfrowania przez internet — nie polecam.

## 3. Architektura

```
 kalkmate.pl (VPS)                               Sieć lokalna sklepu/magazynu
┌─────────────────────────────┐   HTTPS (wychodzące   ┌────────────────────────────┐   TCP (LAN/WiFi)   ┌──────────────────┐
│ Panel: zamówienie →         │   z sieci lokalnej)   │ fiscal-agent (FastAPI)     │  protokół POSNET   │ Drukarka fiskalna│
│ „Wystaw paragon”            │ ◀──────────────────── │ • co 10 s POST /claim      │ ─────────────────▶ │ POSNET Online    │
│ FiscalJob (SQLite, kolejka) │   claim / raport      │ • kolejka SQLite + retry   │ ◀───────────────── │                  │──▶ CRK (MF)
│ /api/fiscal/agent/*         │ ────────────────────▶ │ • POST /receipts (lokalnie)│                    └──────────────────┘
└─────────────────────────────┘                       └────────────────────────────┘
```

- **Kierunek połączenia:** agent pyta platformę (wychodzące HTTPS). Nie trzeba otwierać portów, a drukarka nie jest widoczna z internetu.
- **Uwierzytelnianie:**
  - agent → platforma: nagłówek `x-fiscal-agent-token` (= `FISCAL_AGENT_TOKEN`), porównanie w stałym czasie, tylko HTTPS;
  - lokalne API agenta: `Authorization: Bearer AGENT_API_TOKEN`, domyślnie nasłuch na `127.0.0.1`;
  - drukarka nie ma uwierzytelniania, więc postaw ją w osobnej sieci lub VLAN z agentem.
- **Kolejkowanie:** dwie kolejki.
  - Platforma: tabela `FiscalJob` z rekordem `queued → sent → printed | failed | uncertain | cancelled`.
  - Agent: SQLite. Gdy drukarka lub WiFi nie działa, zlecenia czekają lokalnie z wykładniczym odstępem (5 s … 5 min).
- **Idempotencja (najważniejsze — nie wydrukować dwóch paragonów):**
  - Każde zlecenie ma `id`. Agent pamięta id i drugi raz tego samego nie drukuje. Platforma może bezpiecznie wysłać zlecenie ponownie, np. po zgubionej odpowiedzi.
  - Ponowienie po błędzie w panelu tworzy **nowe** zlecenie (nowe id), a stare dostaje stan „anulowane”.
  - Stan `uncertain` (np. agent padł w trakcie druku albo zerwało się połączenie po `trend` i nie dało się go zweryfikować) **nigdy nie jest ponawiany automatycznie**. Człowiek sprawdza drukarkę i klika „Wydrukował się” (wpisuje numer) albo „Ponów”.
- **Obsługa błędów (agent):**

| Sytuacja | Wykrycie | Reakcja |
|---|---|---|
| Brak papieru, otwarta pokrywa | `sprn.pr` ≠ 0 przed paragonem | zlecenie czeka i jest ponawiane (kategoria `paper`) |
| Kasa zajęta (menu, czeka na klawisz) | `sdev.ds` ≠ 0, błędy 2038/2062/11/14 | ponawianie (`busy`) |
| Brak połączenia lub drukarka wyłączona | błąd połączenia TCP | ponawianie (`connection`) |
| WiFi zerwane w trakcie linii | wyjątek w gnieździe | reconnect → `rpt`; jeśli brak odpowiedzi → `prncancel` i ponowienie |
| WiFi zerwane po `trend` | brak odpowiedzi | reconnect → `rpt` → `strns` + `scnt`: transakcja zamknięta i licznik +1 = wydrukowany; transakcja otwarta = anuluj i ponów; inaczej `uncertain` |
| Błędne dane (stawka VAT, kwoty) | `?nnnn` | `prncancel`, stan `failed` z opisem |
| Brak raportu dobowego, tryb tylko do odczytu, blokada | 383, 2036, 484… | `failed` — wymaga człowieka lub serwisu |
| Drukarka w trybie fiskalnym, a agent testowy | `scomm.fs` = T i `FISCAL_ALLOW_REAL=0` | odmowa druku (bezpiecznik) |

- **Pozycje paragonu z zamówienia** (`buildOrderReceipt`):
  - „KalkMate v3 kalkulator AI” 699,00 zł, 23%, z rabatem z kuponu;
  - „Wysyłka” = kwota zamówienia minus produkt po rabacie;
  - płatność „inna”: Przelewy24 albo Stripe.
  - Zamówienia w EUR są blokowane: paragon jest w PLN, a sprzedaż zagraniczna (WSTO/OSS) wymaga decyzji księgowej.
- **Automatyczne kolejkowanie:** `FISCAL_AUTO_ENQUEUE=1` dodaje paragon po opłaceniu (webhook P24 lub Stripe). Domyślnie wyłączone; włącz po testach.

## 4. Wymogi prawne

To nie jest porada prawna — potwierdź z księgowym lub doradcą podatkowym.

- **Czy KalkMate musi wystawiać paragony przy sprzedaży wysyłkowej?**
  - Rozporządzenie MF z 17.12.2024 (Dz.U. 2024 poz. 1902), poz. 41 załącznika, zwalnia sprzedaż wysyłkową opłaconą w całości przez bank, gdy z dowodu zapłaty wynika, czego dotyczyła i kto zapłacił.
  - Ale § 4 ust. 1 pkt 1 wyłącza ze zwolnień m.in.:
    - lit. h — komputery i urządzenia peryferyjne;
    - lit. i — „wyrobów elektronicznych, w tym … wyświetlaczy … aparatów do zapisu lub odtwarzania obrazu i dźwięku…”;
    - lit. l — „sprzętu fotograficznego, w tym … kamer”.
  - Kalkulator z kamerą, wyświetlaczem OLED i WiFi najpewniej podpada pod te wyłączenia. **Sprzedaż trzeba ewidencjonować na kasie lub drukarce fiskalnej**, także wysyłkową.
- **Kasy online** (art. 111 ustawy o VAT i rozporządzenie w sprawie kryteriów i warunków technicznych kas):
  - Urządzenie samo przesyła dane do Centralnego Repozytorium Kas (CRK). Podatnik musi zapewnić mu stały dostęp do internetu.
  - Integracja **nie może i nie musi** nic wysyłać do CRK sama — robi to urządzenie (moduł fiskalny).
  - Paragon i numer powstają wyłącznie w urządzeniu fiskalnym. Moduł nigdy nie „generuje” paragonu sam, tylko zleca go drukarce, więc nie omija modułu fiskalnego.
- **Moment ewidencji i wydanie paragonu:** w sprzedaży wysyłkowej przyjmuje się ewidencję najpóźniej w chwili otrzymania zapłaty. Paragon trzeba wydać nabywcy — wydrukowany do paczki albo e-paragon za zgodą klienta.
  - Pasuje to do obecnego procesu: paragon drukuje się przy pakowaniu i trafia do paczki.
  - `FISCAL_AUTO_ENQUEUE=1` odpowiada wariantowi „w chwili zapłaty”.
- **Korekty i zwroty:** paragonu fiskalnego nie anuluje się po zamknięciu. Zwrot towaru ewidencjonuje się według zasad (ewidencja zwrotów, faktura korygująca). Moduł nie obsługuje zwrotów — tylko anulowanie **niezamkniętej** transakcji (`prncancel`).
- **Testy:**
  - Nie testuj na urządzeniu w trybie fiskalnym „na próbę”: każdy zamknięty paragon to prawdziwy zapis w pamięci fiskalnej i w CRK.
  - Agent ma bezpiecznik `FISCAL_ALLOW_REAL=0`: odmawia druku na urządzeniu fiskalnym.
  - Testuj na drukarce **przed fiskalizacją** (tryb niefiskalny — wydruki „NIEFISKALNY”) albo na egzemplarzu demo lub szkoleniowym z serwisu.

## 5. Pierwszy test na prawdziwym urządzeniu

1. Testy bez urządzenia:
   ```bash
   cd fiscal-agent && pip install -e '.[dev]' && pytest
   posnet-simulator --port 6666   # osobny terminal; symulator jest zbudowany wg specyfikacji, nie z firmware'u
   ```
2. Weź drukarkę POSNET Online **niefiskalną** (nowa przed fiskalizacją albo demo z serwisu). Na kasie Ergo moduł nie zadziała — patrz sekcja 1.
3. W menu drukarki ustaw połączenie: Konfiguracja → Konfig. połączeń → Usługi PC → Interfejs PC → **TCP/IP**, a także port, WiFi i statyczny IP (albo rezerwację DHCP w routerze). Zapisz IP, port i stronę kodową.
4. Na Raspberry Pi lub PC w tej samej sieci zainstaluj agenta (`fiscal-agent/README.md`). W `.env` ustaw `PRINTER_HOST`, `PRINTER_PORT`, `PRINTER_ENCODING` i **`FISCAL_ALLOW_REAL=0`**.
5. `curl -H "Authorization: Bearer …" "http://127.0.0.1:8765/status?refresh=true"` powinno pokazać: model z `sid`, `fiscal: false`, `ready: true`, numer ostatniego paragonu.
6. Paragon testowy przez lokalny endpoint (przykład w `fiscal-agent/README.md`). Sprawdź na wydruku:
   - nazwy z polskimi znakami;
   - stawki VAT (A = 23%?);
   - rabat;
   - formę płatności;
   - sumę;
   - numer zwrócony przez agenta = numer na wydruku.
7. Scenariusze błędów (każdy osobnym paragonem testowym):
   - otwórz pokrywę lub wyjmij papier → zlecenie `queued` z kategorią `paper`; po założeniu papieru drukuje się samo;
   - wejdź w menu drukarki → `busy`;
   - wyłącz drukarkę → `connection`, po włączeniu się drukuje;
   - **wyłącz router w trakcie** dużego paragonu (np. 50 pozycji) → sprawdź, że nie ma dwóch paragonów, a stan jest `printed` albo `uncertain` z prawidłowym opisem;
   - zabij agenta (`kill -9`) w trakcie druku → po starcie zlecenie ma stan `uncertain`.
8. Połącz z platformą: na serwerze `FISCAL_AGENT_TOKEN`, w agencie `PLATFORM_URL` i `PLATFORM_AGENT_TOKEN`. W `/admin/fiscal` agent powinien być „Połączony”, a drukarka „Gotowa”. Z zamówienia testowego (w PLN, opłaconego) kliknij „Wystaw paragon” → numer pojawi się w zamówieniu.
9. Dopiero po tym: fiskalizacja drukarki przez serwisanta, `FISCAL_ALLOW_REAL=1`, jeden prawdziwy paragon, sprawdzenie raportu dobowego i statusu wysyłki do CRK w menu drukarki. Na końcu ewentualnie `FISCAL_AUTO_ENQUEUE=1`.

## 6. Do sprawdzenia z serwisantem lub Posnet

1. **Czy Posnet Ergo Online (podaj wersję firmware z menu „Informacje”) obsługuje wystawianie paragonu fiskalnego zleconego z programu (tryb drukarki / sprzedaż z PC)?** Jeśli tak, poproś o „Specyfikację protokołu” dla tej wersji i nazwę trybu w menu.
2. Jeśli nie — jaki model drukarki fiskalnej Online z WiFi lub LAN polecają (Thermal XL2 Online, Temo Online, Trio Online…) i czy obsługuje protokół POSNET z komendami `trinit/trline/trpayment/trend/scnt/rpt`, jak w DBC-I-DEV-45.
3. Aktualna specyfikacja protokołu dla tego modelu (wersja Online). Do sprawdzenia w niej:
   - zmiany w `trline` lub `trend` (np. obowiązkowe pola, numer paragonu w odpowiedzi);
   - kody błędów;
   - limity długości nazw;
   - pole NIP nabywcy na paragonie.
4. Domyślny port TCP, ile połączeń naraz, czy jest timeout bezczynności, czy drukarka przyjmuje połączenia przez WiFi i LAN jednocześnie.
5. Strona kodowa polskich znaków ustawiona w drukarce.
6. Przypisanie stawek A–G (np. A = 23%, B = 8%, C = 5%, D = 0%, G = zw.) i czy ma je ustawić przy fiskalizacji.
7. Czy jest egzemplarz demo lub szkoleniowy (niefiskalny) do testów integracji. Czy serwis może przeprowadzić testy przed fiskalizacją.
8. E-paragony: czy model je obsługuje i przez jaki protokół lub dostawcę (KSeF / e-paragon). Ergo Online 2.01 ma funkcję „E-paragon” w menu kasjera.
9. Raport dobowy: czy wolno go uruchamiać zdalnie z programu (`dailyrep`), czy tylko z menu. Jak drukarka sygnalizuje problem z wysyłką do CRK.
10. Wymogi rejestracji drukarki (zgłoszenie, przeglądy) oraz zasady pracy kasy Ergo i drukarki równolegle w jednej firmie, np. jak rozdzielić ewidencję sprzedaży stacjonarnej i internetowej.

## 7. Źródła

**Posnet:**
- [Instrukcja obsługi Posnet Ergo Online v1.7 (PDF)](https://www.posnet.com.pl/files/download/instrukcja-obslugi-ergo-on-line-v-1.7.pdf) — „Usługi PC”, str. 174–184
- [Instrukcja obsługi Posnet Ergo Online 2.01 v1.4 (PDF)](https://www.posnet.com.pl/files/download/instrukcja-obslugi-ergo-2.01-online-v1.4.pdf)
- [Ergo Online 3.02 — dokumentacja online](https://dokumentacja.posnet.com/ergo/) (w czasie researchu zwracała 503)
- [Specyfikacja protokołu kas POSNET NEO EJ / NEO / BINGO / COMBO v002 (kopia na soft-bit.pl)](https://www.soft-bit.pl/downloads/all/Posnet/pliki/Specyfikacja%20protokolu%20kas%20wersja%2005.pdf)
- [Specyfikacja protokołu POSNET w drukarkach, DBC-I-DEV-45 v021 (kopia na soft-bit.pl)](https://www.soft-bit.pl/downloads/all/Posnet/pliki/DBC-I-DEV-45-021_specyfikacja_protokolu_Posnet_w_drukarkach.pdf)
- [Thermal XL2 Online — quick start (PDF)](https://www.posnet.com.pl/files/products_download/357/thermal-xl2-online---quick-start---wersja-1.2-en.pdf), [Temo Online — quick start (PDF)](https://www.posnet.com.pl/files/products_download/361/temo-online---quick-start---wersja-1.3-en.pdf)
- [Instrukcja podłączenia terminali płatniczych (ECR-EFT) z kasami Posnet Online](https://www.posnet.com.pl/files/download/instrukcja-podlaczenia-terminali-platniczych-po-protokole-ecr-eft-z-kasami-posnet-i-fawag-online.pdf)

**Integracje i biblioteki:**
- [fiskaltrust — POSNET SCU (Polska)](https://docs.fiskaltrust.eu/docs/poscreators/middleware-doc/poland/scu/posnet), [fiskaltrust middleware issue #751](https://github.com/fiskaltrust/middleware/issues/751)
- [Comarch ERP Optima — Urządzenia fiskalne](https://pomoc.comarch.pl/optima/pl/2025/index.php/dokumentacja/urzadzenia-fiskalne/)
- [Fakturownia — konfiguracja TCP/IP drukarki fiskalnej](https://pomoc.fakturownia.pl/187193426-konfiguracja-polaczenia-przez-tcp-ip-lub-usb-na-drukarce-fiskalnej)
- Biblioteki: [PyPOSNET](https://github.com/leafnode/PyPOSNET), [litex.posnet](https://github.com/mwegrzynek/litex.posnet), [Posnet-Connector](https://github.com/Kerso-official/Posnet-Connector), [pyposnet](https://github.com/evox95/pyposnet), [posnetjs](https://github.com/Be-Grabby/posnetjs), [trilab_driver_posnet](https://apps.odoo.com/apps/modules/18.0/trilab_driver_posnet)

**Prawo:**
- [Rozporządzenie MF z 17.12.2024 w sprawie zwolnień z obowiązku prowadzenia ewidencji przy zastosowaniu kas rejestrujących, Dz.U. 2024 poz. 1902 (PDF)](https://eli.gov.pl/eli/DU/2024/1902/ogl/pol/pdf)
- [ZrozumVAT — zwolnienia z kas fiskalnych w 2025 r.](https://zrozumvat.pl/zwolnienia-z-kas-fiskalnych-w-2025-r/)
- [Ministerstwo Finansów — broszura „Kasy online” (PDF)](https://www.podatki.gov.pl/media/4661/broszura-kasy-on-line.pdf)
- [biznes.gov.pl — Kasa fiskalna w firmie](https://biznes.gov.pl/pl/portal/00243)
