# =====================================================================
#  build_exe.ps1 - pakuje flasher.py do samodzielnego programu Windows
#  (PyInstaller, tryb onedir) -> dist\KalkMateFlasher\KalkMateFlasher.exe
#
#  Wynik trafia do instalatora aplikacji desktopowej
#  (tools\kalkmate-admin-desktop, extraResources -> resources\flasher).
#
#  Uzycie:  .\build_exe.ps1            (z folderu tools\flasher)
#  Wymaga:  python + pip: pyinstaller, esptool (4.x), pyserial
#           zbudowany firmware w ..\..\.pio\build\esp32s3 (pio run -e esp32s3)
#
#  Co JEST w paczce:  flasher.py, esptool/espefuse/espsecure (pip), pyserial,
#                     tkinter, firmware\{bootloader,partitions,firmware}.bin
#  Czego NIE MA:      config.json, production_log.csv, keys\ - to zyje w
#                     %APPDATA%\KalkMate\flasher na komputerze uzytkownika.
#                     Klucz Flash Encryption NIGDY nie moze byc w instalatorze.
#
#  UWAGA: plik celowo tylko ASCII - PowerShell 5.1 czyta skrypty bez BOM
#  jako ANSI i wywala parser na znakach UTF-8 (np. dlugi myslnik).
# =====================================================================
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$fwSrc = Join-Path $PSScriptRoot "..\..\.pio\build\esp32s3"
$fwDst = Join-Path $PSScriptRoot "build_firmware"
$bins  = @("bootloader.bin", "partitions.bin", "firmware.bin")

Write-Host "[1/3] Firmware do paczki ($fwSrc)" -ForegroundColor Green
if (Test-Path $fwDst) { Remove-Item -Recurse -Force $fwDst }
New-Item -ItemType Directory -Force $fwDst | Out-Null
foreach ($b in $bins) {
    $p = Join-Path $fwSrc $b
    if (-not (Test-Path $p)) { throw "Brak $p - najpierw: pio run -e esp32s3" }
    Copy-Item $p $fwDst
    Write-Host ("  {0,-16} {1,9} B" -f $b, (Get-Item $p).Length)
}

Write-Host "[2/3] PyInstaller" -ForegroundColor Green
if (Test-Path "dist\KalkMateFlasher") { Remove-Item -Recurse -Force "dist\KalkMateFlasher" }
# Zatrute TCL_LIBRARY/TK_LIBRARY (np. CSR BlueSuite ustawia je globalnie)
# sprawiaja, ze hook PyInstallera uznaje tkinter za "broken" i WYRZUCA go z
# paczki - GUI wtedy nie wstaje (okno bledu zamiast programu). Wymuszamy
# sciezki z instalacji Pythona na czas budowania.
$pyBase = (python -c "import sys;print(sys.base_prefix)").Trim()
$tclDir = Join-Path $pyBase "tcl\tcl8.6"
$tkDir  = Join-Path $pyBase "tcl\tk8.6"
if (-not (Test-Path $tclDir) -or -not (Test-Path $tkDir)) { throw "Brak Tcl/Tk w $pyBase\tcl" }
$env:TCL_LIBRARY = $tclDir
$env:TK_LIBRARY  = $tkDir
Write-Host "  TCL_LIBRARY=$tclDir"
# PyInstaller loguje INFO na stderr - przy $ErrorActionPreference=Stop
# PowerShell 5.1 zamienia pierwsza taka linie w blad terminujacy. Na czas
# wywolania natywnego procesu przelaczamy na Continue i patrzymy na exit code.
$ErrorActionPreference = "Continue"
python -m PyInstaller --noconfirm --clean --windowed --onedir --log-level WARN `
    --name KalkMateFlasher `
    --add-data "build_firmware;firmware" `
    --collect-all esptool --collect-all espefuse --collect-all espsecure `
    --hidden-import serial.tools.list_ports `
    flasher.py 2>&1 | ForEach-Object { "$_" }
$pyExit = $LASTEXITCODE
$ErrorActionPreference = "Stop"
if ($pyExit -ne 0) { throw "PyInstaller zakonczyl sie bledem ($pyExit)" }

Write-Host "[3/3] Weryfikacja" -ForegroundColor Green
$exe = Join-Path $PSScriptRoot "dist\KalkMateFlasher\KalkMateFlasher.exe"
if (-not (Test-Path $exe)) { throw "Brak $exe" }
# tkinter musi byc w paczce (patrz komentarz o TCL_LIBRARY wyzej)
foreach ($d in @("_tcl_data", "_tk_data")) {
    if (-not (Test-Path (Join-Path $PSScriptRoot "dist\KalkMateFlasher\_internal\$d"))) {
        throw "W paczce brakuje $d - tkinter zostal wykluczony przez PyInstallera (zatrute TCL_LIBRARY?)"
    }
}
# Upewnij sie, ze klucze nie trafily do paczki
$leak = Get-ChildItem -Recurse "dist\KalkMateFlasher" -Include "*.bin" | Where-Object { $_.Name -like "*key*" }
if ($leak) { throw "W paczce sa pliki kluczy: $($leak.FullName -join ', ')" }
$size = [math]::Round((Get-ChildItem -Recurse "dist\KalkMateFlasher" | Measure-Object Length -Sum).Sum / 1MB, 1)
Write-Host "OK: $exe  (folder $size MB)"
Write-Host "Test narzedzia w paczce (esptool z exe):"
$ErrorActionPreference = "Continue"
$ver = (& $exe --run-esptool version 2>&1 | ForEach-Object { "$_" }) -join "`n"
$toolExit = $LASTEXITCODE
$ErrorActionPreference = "Stop"
Write-Host $ver
if ($toolExit -ne 0 -or $ver -notmatch "esptool") { throw "Test --run-esptool nie przeszedl (exit $toolExit)" }
Write-Host "BUILD OK" -ForegroundColor Green
