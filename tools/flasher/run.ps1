# KalkMate Production Flasher launcher
# Aktywuje venv PlatformIO (gdzie jest esptool.py + espefuse.py)
# i odpala flasher.py.

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

# Sprawdz venv PlatformIO
$pioVenv = "$env:USERPROFILE\.platformio\penv\Scripts\Activate.ps1"
if (-not (Test-Path $pioVenv)) {
    Write-Host "BLAD: brak PlatformIO venv pod $pioVenv" -ForegroundColor Red
    Write-Host "Zainstaluj PlatformIO: https://platformio.org" -ForegroundColor Yellow
    pause
    exit 1
}

# Aktywuj venv
. $pioVenv

# Sprawdz pyserial
$hasPyserial = python -c "import serial.tools.list_ports" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Instaluje pyserial..." -ForegroundColor Yellow
    pip install pyserial
}

# Odpal flasher
Write-Host "Uruchamiam KalkMate Production Flasher..." -ForegroundColor Green
python flasher.py
