@echo off
REM KalkMate Production Flasher - dwuklik launcher
REM Odpala run.ps1 ktore aktywuje venv PIO i puszcza flasher.py

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1"
pause
