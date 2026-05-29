# KalkMate Production Flasher

Narzędzie GUI do flashowania kalkulatorów na linii produkcyjnej.

## Co robi

1. Wykrywa ESP32-S3 automatycznie po podłączeniu USB (VID 0x303A)
2. Odczytuje MAC chipa (= Device ID)
3. Flashuje bootloader + partitions + firmware
4. **Opcjonalnie** wypala Flash Encryption eFuse (chroni firmware przed extractem)
5. Loguje wszystko do `production_log.csv`

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
| **DEV** | Tylko firmware | TAK | Prototypy, testy, debug |
| **PROD_DEV** | Firmware + Flash Encryption (Development) | Jeszcze możesz rewrites (max 4×) | QC line — montaż + testy |
| **PROD_REL** | Firmware + FE Release mode | ❌ **NIGDY** | Tylko ostateczne pakowanie do klienta |

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

- Generowany raz losowo przy pierwszym FLASH w trybie PROD_DEV
- Zapisany w `keys/flash_encryption_key.bin` (256-bit XTS-AES)
- **TEN SAM klucz dla wszystkich płytek tej serii** (alternatywa: per-device random — bezpieczniej ale wymaga DB)
- **BACKUP TEGO PLIKU NA OSOBNYM NOSNIKU!** Jeśli go zgubisz, nie sflashujesz nigdy więcej tej serii.

## Audit log

`production_log.csv` zawiera:
```
timestamp, mac, port, mode, result, error
2026-05-29T14:33:12, AC276EA240B0, COM7, PROD_DEV, OK,
2026-05-29T14:34:55, AC276EA240C2, COM7, PROD_REL, OK,
```

Otwórz w Excelu — lista wszystkich sflashowanych urządzeń z timestampem.

## Troubleshooting

**"Nie znaleziono esptool.py"** → edytuj `config.json` z pełną ścieżką

**Chip nie wykrywany** → ESP32-S3 wymaga trybu bootloader przy pierwszym flashu (gdy nie ma jeszcze KalkMate firmware). Trzymaj BOOT, naciśnij RESET, puść RESET, puść BOOT.

**Timeout odczytu chipa** → kabel USB-C w którym oba D+ i D- są podłączone (niektóre tanie "tylko-do-ładowania" kable nie mają data lines).

**`A fatal error occurred: ESP32-S3 chip was placed into download mode using GPIO0`** → normalna informacja, esptool sobie radzi.

**Po PROD_REL nie da się juz nic zrobić** → tak miało być. eFuses nieodwracalne. Dlatego wymaga confirmation.
