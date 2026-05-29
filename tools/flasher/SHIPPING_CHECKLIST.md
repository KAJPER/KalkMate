# KalkMate — Checklist produkcyjny (mega-secure)

## Co to znaczy "produkcyjne"

Urządzenie które:
- Ma **firmware podpisany ECDSA** (server-side) → tylko Ty możesz robić OTA update
- Ma **API key obfuskowany** w binarce → strings nic nie wyciągnie
- Ma **Flash Encryption** wypaloną w eFuse → nawet z dumpem flasha nie odszyfrują
- Ma **eFuse Release lock** → nikt już nigdy nie sflashuje tego chipa po USB

Po wykonaniu tego checklistu, urządzenie jest na poziomie ochrony 4/4 (z naszej tabeli).

---

## 0. Wymagania jednorazowe (pierwsza partia)

- [ ] Mam zbackupowany **`tools/flasher/keys/flash_encryption_key.bin`** na osobnym nośniku (pendrive, sejf)
- [ ] Mam zbackupowany **`firmware_signing.pem`** z serwera `/home/ubuntu/kalkulator/keys/`
- [ ] Zaktualizowałem `FW_VERSION` w `src/main.cpp` do wersji produkcyjnej (np. `1.5.0-prod`)
- [ ] `git status` jest czyste (wszystkie zmiany scommitowane)
- [ ] Mam dobre kable USB-C z data lines (nie "charge-only")

---

## 1. Build firmware do produkcji

```powershell
cd c:\Users\Kacper\Desktop\kalkmate\KalkMate
pio run -e esp32s3
```

- [ ] Build zakończony **SUCCESS**
- [ ] Sprawdziłem rozmiar: `.pio\build\esp32s3\firmware.bin` ma ~1.1 MB
- [ ] **Verify obfuskacja**: 
  ```powershell
  Select-String -Path .pio\build\esp32s3\firmware.bin -Pattern "calc_api_key" -Encoding Byte -SimpleMatch
  ```
  Jeśli **nic nie zwraca** → obfuskacja OK. Jeśli zwraca match → STOP, klucz w plaintexcie.

---

## 2. Deploy + sign OTA na serwerze

```powershell
.\deploy.ps1 X.Y.Z "Production release"
```

To robi:
- [ ] Bumpuje `FW_VERSION` w main.cpp + rebuild
- [ ] Upload .bin do `/home/ubuntu/kalkulator/firmware-private/`
- [ ] **Server podpisuje ECDSA P-256** → .sig w tym samym folderze
- [ ] Aktualizuje `FIRMWARE_LATEST_VERSION` w `.env.production.local`
- [ ] Restartuje pm2 kalkmate

Verify:
```powershell
curl https://kalkmate.pl/api/device/firmware/check -H "x-api-key: <CALCULATOR_API_KEY-REDACTED>"
```
Powinno zwrócić `{"ok":true, "version":"X.Y.Z", "sig":"MEUCIQ..."}` — z polem `sig` niepustym.

---

## 3. Flash pierwszej płytki — PROD_DEV

```powershell
cd tools\flasher
python flasher.py
```

- [ ] Podłącz świeży kalkulator USB-C
- [ ] Status: "WYKRYTO URZADZENIE" + pokazuje MAC
- [ ] Wybierz **PROD_DEV** (środkowy radio button)
- [ ] Klik **FLASH**
- [ ] Popup z ostrzeżeniem → klik "Tak" (Flash Encryption Dev = jeszcze 4× rewrites możliwe)
- [ ] Czekaj 30-60 sekund (boot + eFuse burning)
- [ ] **NIE ODŁĄCZAJ** dopóki nie widzisz zielonego "SUKCES"
- [ ] Jeśli widzisz "BLAD" → patrz log, nie wpadaj w panikę. eFuse jeszcze nie w Release mode, więc da się ratować.

Po sukcesie:
- [ ] **PIERWSZY RAZ TYLKO:** sprawdź czy w `tools/flasher/keys/` powstał nowy plik `flash_encryption_key.bin`
- [ ] **NATYCHMIAST zbackupuj** ten plik na pendrive/dysk poza komputerem. Bez niego nigdy więcej nie sflashujesz żadnej płytki tej serii.

---

## 4. QC test na sflashowanej płytce

Włącz kalkulator. Sprawdź:

- [ ] Boot: pokazuje splash → kalkulator z "0"
- [ ] Wpisz kod AI: pokazuje "AI" → menu
- [ ] **Settings → Bateria** — pokazuje napięcie ~4V (jeśli pełna LiPo)
- [ ] **Settings → WiFi** — wprowadź sieć testową, łączy się
- [ ] **Settings → Test kamery** — robi zdjęcie, pokazuje rozdzielczość 1600×1200
- [ ] **Menu → Rozwiąż zadanie → Tryb zdjęcia** — robi foto, wysyła, dostaje odpowiedź AI
- [ ] **Panel webowy** (kalkmate.pl/panel/kalkulator) — Device ID + Firmware = 1.4.x ✓, "Zapytan: 1" po teście

Jeśli wszystko działa → ✓ ta płytka jest gotowa do Release. Jeśli coś nie → naprawiaj firmware, rebuild, reflash w PROD_DEV (Development mode pozwala na re-flash do 4 razy).

---

## 5. Release lock — TYLKO TUŻ PRZED PAKOWANIEM DO PUDEŁKA

⚠️ **NIEODWRACALNE** ⚠️

Po tym kroku:
- Chip **PERMANENTNIE** w Flash Encryption Release mode
- Nigdy więcej żadnego flashowania po USB
- Tylko OTA update (a OTA wymaga podpisanego firmware z naszym kluczem prywatnym)
- Brick = brick, **żaden serwis nie ratuje**

Robisz to **TYLKO** gdy:
- ✓ QC test przeszedł 100%
- ✓ Pakujesz do kartonu pod adres klienta
- ✓ Masz pewność że firmware na chipie to dokładnie ta wersja co chcesz wysłać

```powershell
python flasher.py
```

- [ ] Podłącz tę samą płytkę (po QC) z powrotem
- [ ] Wybierz **PROD_REL** (trzeci radio button)
- [ ] Klik **FLASH**
- [ ] Popup **"UWAGA — Operacja NIEODWRACALNA"** → **PRZECZYTAJ uważnie** → klik "Tak"
- [ ] Czekaj na "SUKCES"
- [ ] Sprawdź `production_log.csv` — wpis `mode=PROD_REL, result=OK` z MAC płytki

---

## 6. Zapis MAC → klient (audit trail)

W zewnętrznej tabeli (Excel, Notion, własna baza) zapisz:

| MAC | Firmware | Klient | Data wysyłki | Tracking |
|---|---|---|---|---|
| AC276EA240B0 | 1.4.1 | Jan Kowalski | 2026-05-29 | INPOST123 |
| AC276EA240C2 | 1.4.1 | Anna Nowak | 2026-05-29 | INPOST124 |

Gdy klient zadzwoni z problemem, masz MAC → wiesz która wersja → wiesz kiedy wysłana.

`tools/flasher/production_log.csv` już tych danych dostarcza (timestamp + MAC + mode).

---

## 7. Cleanup po sesji produkcyjnej

- [ ] Wyciągnij **pendrive z kluczami** z komputera, schowaj w sejfie/safe
- [ ] **NIE COMMIT'UJ** `tools/flasher/keys/` ani `production_log.csv` (gitignore się tym zajmuje, ale sprawdź `git status`)
- [ ] Aktualizuj listę kontaktów klientów + MACs w swojej bazie
- [ ] Aktualizuj changelog na kalkmate.pl/pomoc jeśli wypchnąłeś nową wersję

---

## Awaryjnie — co jeśli...

### Flashing crashed w środku PROD_DEV?
Płytka jest w stanie pośrednim. Skoro nie skończyłeś, eFuses jeszcze nie zablokowały rewrites. **Spróbuj ponownie** w PROD_DEV — z tym samym kluczem (FE key file ten sam). Powinno wznowić.

### Flashing crashed w środku PROD_REL?
🚨 **Płytka brick'owana** w 70% przypadków. eFuse Release jest najszybsza operacja (bit set), więc to mało prawdopodobne, ale możliwe. Jeśli chip dalej boot'uje → spróbuj OTA z urządzenia (jeśli wciąż boot'uje firmware). Jeśli nie → wymień chip na PCB (RMA wewnętrzny).

### Zgubiłem `flash_encryption_key.bin`?
🚨 **Wszystkie istniejące płytki tej serii są nie do reflashowania.** Mogą działać przez OTA jeśli chip wciąż boot'uje, ale nie sflashujesz nic nowego po USB. Następna seria = nowy klucz.

### Klient zwrócił urządzenie z problemem?
- Sprawdź MAC → którą wersję firmware ma
- Jeśli przed PROD_REL: można reflashować (dev mode dalej działa)
- Jeśli po PROD_REL: tylko OTA może go uratować, ALBO wymiana chipa

### Server skompromentowany / wyciekł klucz prywatny?
🚨 **Wszystkie urządzenia z tej generacji firmware mogą dostać złośliwy update.** Plan B:
1. Wygeneruj nową parę kluczy ECDSA
2. Build nowy firmware z nową publicznym kluczem
3. **NA STAREJ FIRMWARE** wypchnij wersję z tym nowym kluczem, podpisaną STARYM prywatnym kluczem
4. Urządzenia zaczynają używać nowego klucza do weryfikacji
5. Wycofaj stary klucz prywatny z serwera

---

## TL;DR — typowy dzień produkcyjny

```powershell
# 1. Build
pio run -e esp32s3

# 2. Deploy + sign (po raz pierwszy w sesji)
.\deploy.ps1 1.4.2 "..."

# 3. Otwórz flasher
cd tools\flasher
python flasher.py

# 4. Dla każdej z 50 płytek:
#    a) USB → FLASH (PROD_DEV) → ~45s
#    b) QC test → jeśli OK, odznacz na liście
#
# 5. Pod koniec dnia, na koniec listy QC:
#    a) USB → FLASH (PROD_REL) → potwierdź "TAK"
#    b) Pakuj do pudełka, wyślij
```
