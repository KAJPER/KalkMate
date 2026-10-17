# KalkMate Production Flasher

Narzędzie GUI do flashowania kalkulatorów na linii produkcyjnej.

## Co robi

1. Wykrywa ESP32-S3 automatycznie po podłączeniu USB (VID 0x303A)
2. Odczytuje MAC chipa (= Device ID)
3. Czyści NVS + otadata (DEV/PROD_DEV zawsze, PROD_REL opcjonalnie) — zakres liczony z `partitions.bin`
4. Flashuje bootloader + partitions + firmware
5. **Opcjonalnie** wypala Flash Encryption eFuse (chroni firmware przed extractem)
6. Resetuje i weryfikuje start firmware'u (log z portu USB, max ~15 s); wgrywa kod AI klienta (`KALKPROV`) z jedną automatyczną powtórką — wszystko poza `KALKPROV:OK` = FAIL
7. Loguje wszystko do `production_log.csv`

Logika jest w `flasher_common.py` (wspólna dla GUI i CLI). CLI (`flasher_cli.py`) obsługuje **tylko DEV** — Flash Encryption wyłącznie przez GUI.

> Firmware jest budowany z `ARDUINO_USB_MODE=1` (USB-Serial-JTAG), więc po starcie ma ten sam VID:PID `303A:1001` co bootloader ROM — start sprawdzamy po logu firmware'u, nie po samym porcie.

## Wymagania (Windows)

```powershell
# Python 3.9+
pip install pyserial

# Esptool — JUŻ MASZ z PlatformIO:
# C:\Users\Kacper\.platformio\penv\Scripts\esptool.py
# C:\Users\Kacper\.platformio\penv\Scripts\espefuse.py
```

## Pierwsze uruchomienie

```powershell
cd c:\Users\Kacper\Desktop\kalkmate\KalkMate\tools\flasher
python flasher.py
```

Przy pierwszym starcie utworzy się `config.json`. Jeśli `esptool.py` nie jest w PATH, edytuj config:

```json
{
  "esptool": "C:\\Users\\Kacper\\.platformio\\penv\\Scripts\\esptool.py",
  "espefuse": "C:\\Users\\Kacper\\.platformio\\penv\\Scripts\\espefuse.py"
}
```

Lub aktywuj venv PIO:
```powershell
& "C:\Users\Kacper\.platformio\penv\Scripts\Activate.ps1"
python flasher.py
```

## Tryby flashowania

| Tryb | Co robi | Odwracalne? | Kiedy używać |
|---|---|---|---|
| **DEV** | Tylko firmware (odmawia na zaszyfrowanym chipie) | TAK | Prototypy, testy, debug |
| **PROD_DEV** | Firmware + Flash Encryption (Development) | Jeszcze możesz rewrites (max 4×) | QC line — montaż + testy |
| **PROD_REL** | Firmware + FE Release mode (tylko chip po PROD_DEV) | ❌ **NIGDY** | Tylko ostateczne pakowanie do klienta |

Reflash urządzenia zwróconego od klienta: NVS (token urządzenia) jest czyszczony → w panelu admina kliknij **„Reset tokenu”** dla tego MAC.

## Workflow produkcyjny

### Codziennie (prototypy / iteracja):
1. `pio run -e esp32s3` żeby zbudować świeże firmware
2. Odpal `flasher.py`
3. Wybierz **DEV**
4. Wciskaj USB → klik FLASH → odłączaj → następny

### Linia produkcyjna (montaż):
1. Zbuduj firmware: `pio run -e esp32s3`
2. Odpal `flasher.py`, wybierz **PROD_DEV**
3. Każda płytka: USB → FLASH → eFuse wypalony → testy QC → odłącz
4. Płytki ktore przeszły QC: ponownie podłącz, wybierz **PROD_REL** → permanent lock

### Klucz Flash Encryption

- **Nigdy nie generowany automatycznie.** Nowy klucz (= nowa seria) tylko jawnie: przycisk „Wygeneruj nowy klucz FE…” w GUI (z potwierdzeniem)
- Zapisany w `keys/flash_encryption_key.bin` — dokładnie **64 B** (XTS-AES-256); inny rozmiar = FAIL
- Odcisk SHA-256 przypięty w `keys/flash_encryption_key.sha256` (przy pierwszym użyciu flasher pyta o potwierdzenie); niezgodność = FAIL
- `Klucze kalkmate/` to **NIE** backup — leży tam stary, skompromitowany klucz 32 B
- **TEN SAM klucz dla wszystkich płytek tej serii** (alternatywa: per-device random — bezpieczniej ale wymaga DB)
- **BACKUP TEGO PLIKU NA OSOBNYM NOSNIKU!** Jeśli go zgubisz, nie sflashujesz nigdy więcej tej serii.

## Audit log

`production_log.csv` zawiera:
```
timestamp, mac, port, mode, result, error, fw_version, fw_version_in_image,
sha256_bootloader, sha256_partitions, sha256_firmware, fe_key_sha256,
nvs_erased, boot_check, prov_result, tool
```

Otwórz w Excelu — lista wszystkich sflashowanych urządzeń z timestampem. Stary log (6 kolumn) jest automatycznie migrowany do nowego nagłówka. `prov_result` to wynik prowizjonowania (np. `OK`, `ERR:BADCODE|OK`, `NO_WINDOW`) — **bez samego kodu**. Gdy plik jest otwarty w Excelu, wpis trafia do `production_log_PENDING.csv`.

## Troubleshooting

**"Nie znaleziono esptool.py"** → edytuj `config.json` z pełną ścieżką

**Chip nie wykrywany** → ESP32-S3 wymaga trybu bootloader przy pierwszym flashu (gdy nie ma jeszcze KalkMate firmware). Trzymaj BOOT, naciśnij RESET, puść RESET, puść BOOT.

**Timeout odczytu chipa** → kabel USB-C w którym oba D+ i D- są podłączone (niektóre tanie "tylko-do-ładowania" kable nie mają data lines).

**`A fatal error occurred: ESP32-S3 chip was placed into download mode using GPIO0`** → normalna informacja, esptool sobie radzi.

**Po PROD_REL nie da się juz nic zrobić** → tak miało być. eFuses nieodwracalne. Dlatego wymaga confirmation.
