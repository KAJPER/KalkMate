#!/usr/bin/env python3
# =====================================================================
#  KalkMate Production Flasher — CLI (alternatywa dla GUI gdyby Tkinter
#  byl zepsuty na Windowsie). Funkcjonalnie to samo co flasher.py.
#
#  Uzycie:
#    python flasher_cli.py              # tryb DEV (tylko firmware)
#    python flasher_cli.py --prod-dev   # firmware + Flash Encryption (dev)
#    python flasher_cli.py --prod-rel   # firmware + FE Release (PERMANENT!)
#    python flasher_cli.py --auto       # auto-flash kazdy wykryty chip
# =====================================================================

import os
import sys
import time
import csv
import json
import argparse
import subprocess
from datetime import datetime

try:
    from serial.tools import list_ports
except ImportError:
    print("BLAD: brak pyserial. Zainstaluj: pip install pyserial")
    sys.exit(1)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
CONFIG_PATH = os.path.join(SCRIPT_DIR, "config.json")
LOG_PATH = os.path.join(SCRIPT_DIR, "production_log.csv")
KEYS_DIR = os.path.join(SCRIPT_DIR, "keys")

ESP32S3_USB_IDS = [(0x303A, 0x1001), (0x303A, 0x4001)]


# ANSI colors
C_RST  = "\033[0m"
C_RED  = "\033[91m"
C_GRN  = "\033[92m"
C_YEL  = "\033[93m"
C_BLU  = "\033[94m"
C_MAG  = "\033[95m"
C_CYN  = "\033[96m"
C_BOLD = "\033[1m"

if sys.platform == "win32":
    os.system("")  # enable VT100 on Windows console


def _autodetect_esptool():
    home = os.path.expanduser("~")
    pio_scripts = os.path.join(home, ".platformio", "penv", "Scripts")
    if sys.platform == "win32":
        a = os.path.join(pio_scripts, "esptool.exe")
        b = os.path.join(pio_scripts, "espefuse.exe")
    else:
        a = os.path.join(pio_scripts, "esptool")
        b = os.path.join(pio_scripts, "espefuse")
    if os.path.exists(a):
        return a, b
    return "esptool.py", "espefuse.py"


def load_config():
    auto_esptool, auto_espefuse = _autodetect_esptool()
    defaults = {
        "esptool":  auto_esptool,
        "espefuse": auto_espefuse,
        "chip": "esp32s3",
        "baud": 921600,
        "firmware_bin": os.path.join(
            PROJECT_ROOT, ".pio", "build", "esp32s3", "firmware.bin"),
        "bootloader_bin": os.path.join(
            PROJECT_ROOT, ".pio", "build", "esp32s3", "bootloader.bin"),
        "partitions_bin": os.path.join(
            PROJECT_ROOT, ".pio", "build", "esp32s3", "partitions.bin"),
        "flash_addr_bootloader": "0x0",
        "flash_addr_partitions": "0x8000",
        "flash_addr_firmware":   "0x10000",
        "fe_key_file": os.path.join(KEYS_DIR, "flash_encryption_key.bin"),
    }
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            defaults.update(json.load(f))
    # Auto-fix stale config (np. "esptool.py" bez sciezki)
    for k, autoval in [("esptool", auto_esptool),
                       ("espefuse", auto_espefuse)]:
        v = defaults.get(k, "")
        if os.path.isabs(v) and not os.path.exists(v):
            defaults[k] = autoval
        elif (not os.path.isabs(v)) and os.path.isabs(autoval):
            defaults[k] = autoval
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(defaults, f, indent=2)
    return defaults


def find_ports():
    out = []
    for p in list_ports.comports():
        vid = p.vid if p.vid is not None else 0
        pid = p.pid if p.pid is not None else 0
        if (vid, pid) in ESP32S3_USB_IDS:
            out.append(p.device)
    return out


def log_event(mac, port, mode, result, error=""):
    new_file = not os.path.exists(LOG_PATH)
    with open(LOG_PATH, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if new_file:
            w.writerow(["timestamp", "mac", "port", "mode", "result", "error"])
        w.writerow([datetime.now().isoformat(timespec="seconds"),
                    mac, port, mode, result, error])


def read_mac(cfg, port):
    """Odczytaj MAC chipa przez esptool chip_id."""
    cmd = [cfg["esptool"], "--chip", cfg["chip"],
           "--port", port, "--baud", "115200", "chip_id"]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
    out = res.stdout + res.stderr
    for line in out.splitlines():
        if "MAC:" in line:
            return line.split("MAC:")[1].strip().replace(":", "").upper()
    return None


def run_step(cmd, prefix=""):
    print(f"{C_BLU}  $ {' '.join(cmd)}{C_RST}")
    proc = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, bufsize=1)
    for line in proc.stdout:
        print(f"  [{prefix}] {line.rstrip()}")
    proc.wait()
    if proc.returncode != 0:
        raise subprocess.CalledProcessError(proc.returncode, cmd)


def flash_device(cfg, port, mode):
    """Wykonaj pelny flash + ewentualne eFuse na konkretnym porcie."""
    print(f"\n{C_BOLD}=== FLASH START: port={port}, mode={mode} ==={C_RST}")

    # 1. Read MAC
    mac = read_mac(cfg, port)
    if not mac:
        raise RuntimeError("Nie udalo sie odczytac MAC")
    print(f"{C_CYN}  MAC: {mac}{C_RST}")

    # Validate firmware files
    for f in [cfg["firmware_bin"], cfg["bootloader_bin"],
              cfg["partitions_bin"]]:
        if not os.path.exists(f):
            raise FileNotFoundError(f"Brak pliku: {f}")

    # 2. Flash firmware
    print(f"{C_YEL}[1/3] Flashuje bootloader + partitions + firmware...{C_RST}")
    cmd = [
        cfg["esptool"], "--chip", cfg["chip"],
        "--port", port, "--baud", str(cfg["baud"]),
        "write_flash", "-z",
        cfg["flash_addr_bootloader"], cfg["bootloader_bin"],
        cfg["flash_addr_partitions"], cfg["partitions_bin"],
        cfg["flash_addr_firmware"],   cfg["firmware_bin"],
    ]
    run_step(cmd, "esptool")

    # 3. Flash Encryption eFuse
    if mode in ("PROD_DEV", "PROD_REL"):
        print(f"{C_YEL}[2/3] Wypalanie Flash Encryption eFuse...{C_RST}")
        key_file = cfg["fe_key_file"]
        if not os.path.exists(key_file):
            os.makedirs(os.path.dirname(key_file), exist_ok=True)
            print(f"{C_MAG}  Generuje nowy klucz FE: {key_file}")
            print(f"  *** ZBACKUPUJ TEN PLIK NA OSOBNYM NOSNIKU ***{C_RST}")
            with open(key_file, "wb") as f:
                f.write(os.urandom(32))
        cmd = [cfg["espefuse"], "--chip", cfg["chip"], "--port", port,
               "burn_key", "BLOCK_KEY0", key_file, "XTS_AES_256_KEY",
               "--do-not-confirm"]
        run_step(cmd, "espefuse")
        cmd = [cfg["espefuse"], "--chip", cfg["chip"], "--port", port,
               "burn_efuse", "SPI_BOOT_CRYPT_CNT", "1", "--do-not-confirm"]
        run_step(cmd, "espefuse")

    # 4. Release lock
    if mode == "PROD_REL":
        print(f"{C_RED}[3/3] FE -> RELEASE mode (PERMANENT)...{C_RST}")
        cmd = [cfg["espefuse"], "--chip", cfg["chip"], "--port", port,
               "burn_efuse", "DIS_DOWNLOAD_MANUAL_ENCRYPT", "1",
               "--do-not-confirm"]
        run_step(cmd, "espefuse")

    print(f"{C_GRN}{C_BOLD}=== SUKCES: {mac} ==={C_RST}\n")
    log_event(mac, port, mode, "OK")
    return mac


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prod-dev", action="store_true",
                    help="Flash Encryption (Development mode)")
    ap.add_argument("--prod-rel", action="store_true",
                    help="Flash Encryption RELEASE mode (PERMANENT!)")
    ap.add_argument("--auto", action="store_true",
                    help="Auto-flash kazdy wykryty chip, czekaj na nastepny")
    args = ap.parse_args()

    mode = "DEV"
    if args.prod_dev:
        mode = "PROD_DEV"
    if args.prod_rel:
        mode = "PROD_REL"

    cfg = load_config()
    print(f"{C_BOLD}=== KalkMate Production Flasher (CLI) ==={C_RST}")
    print(f"Mode: {C_YEL}{mode}{C_RST}")
    print(f"Firmware: {cfg['firmware_bin']}")
    print(f"Log: {LOG_PATH}\n")

    seen_ports = set()
    print(f"{C_CYN}Oczekuje na podlaczenie ESP32-S3... (Ctrl+C aby zakonczyc){C_RST}")

    while True:
        try:
            ports = set(find_ports())
            new_ports = ports - seen_ports
            disconnected = seen_ports - ports

            for p in disconnected:
                print(f"{C_MAG}[-] Odlaczono {p}{C_RST}")

            for port in new_ports:
                print(f"\n{C_GRN}[+] Wykryto urzadzenie na {port}{C_RST}")
                if mode == "PROD_REL":
                    ans = input(f"{C_RED}*** PROD_REL — eFuses NIEODWRACALNE. "
                                f"Wpisz 'TAK' aby kontynuowac: {C_RST}")
                    if ans.strip() != "TAK":
                        print("Pomijam.")
                        continue
                elif mode == "PROD_DEV" and not args.auto:
                    input(f"Enter aby flashowac (Ctrl+C aby pominac)...")

                try:
                    flash_device(cfg, port, mode)
                    if not args.auto:
                        print(f"{C_CYN}Odlacz urzadzenie i podlacz nastepne, "
                              f"lub Ctrl+C aby zakonczyc.{C_RST}")
                except Exception as e:
                    print(f"{C_RED}!!! BLAD: {e}{C_RST}")
                    log_event("?", port, mode, "FAIL", str(e))

            seen_ports = ports
            time.sleep(0.5)
        except KeyboardInterrupt:
            print(f"\n{C_CYN}Bye.{C_RST}")
            break


if __name__ == "__main__":
    main()
