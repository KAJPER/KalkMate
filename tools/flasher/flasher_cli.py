#!/usr/bin/env python3
# =====================================================================
#  KalkMate Production Flasher — CLI (alternatywa dla GUI gdyby Tkinter
#  byl zepsuty na Windowsie). TYLKO tryb DEV.
#
#  Audyt 2026-10-16: tryby PROD (--prod-dev / --prod-rel) zostaly z CLI
#  USUNIETE. Stara implementacja generowala klucz 32 B (espefuse wymaga
#  64 B dla XTS_AES_256_KEY), wgrywala NIEZASZYFROWANY obraz przed
#  paleniem eFuse i palila z --do-not-confirm (rowniez w --auto) — kazde
#  takie urzadzenie bylo zepsute. Flash Encryption robi wylacznie GUI
#  (flasher.py), ktore ma pelna walidacje klucza i stanu eFuse.
#
#  Uzycie:
#    python flasher_cli.py              # DEV: flash kazdego nowo podlaczonego
#    python flasher_cli.py --auto       # DEV: petla, kazda sztuka raz na sesje
#    python flasher_cli.py --code 1234  # DEV + kod AI klienta (jedna sztuka)
#
#  Logika flashowania (czyszczenie NVS+otadata, weryfikacja startu,
#  prowizjonowanie kodu AI z powtorka, log) jest wspolna z GUI:
#  flasher_common.py.
# =====================================================================

import os
import sys
import json
import time
import argparse

try:
    import serial  # noqa: F401  (wymagany przez flasher_common)
except ImportError:
    print("BLAD: brak pyserial. Zainstaluj: pip install pyserial")
    sys.exit(1)

import flasher_common as fc

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
CONFIG_PATH = os.path.join(SCRIPT_DIR, "config.json")
LOG_PATH = os.path.join(SCRIPT_DIR, "production_log.csv")
KEYS_DIR = os.path.join(SCRIPT_DIR, "keys")

# Port musi zniknac na co najmniej tyle sekund, zeby uznac to za odlaczenie
# (reset urzadzenia po flashu = re-enumeracja USB trwajaca < 2 s — to NIE
# jest nowe urzadzenie).
UNPLUG_DEBOUNCE_S = 3.0

# ANSI colors
C_RST  = "\033[0m"
C_RED  = "\033[91m"
C_GRN  = "\033[92m"
C_YEL  = "\033[93m"
C_BLU  = "\033[94m"
C_MAG  = "\033[95m"
C_CYN  = "\033[96m"
C_GRY  = "\033[90m"
C_BOLD = "\033[1m"

LEVEL_COLORS = {"info": C_CYN, "ok": C_GRN, "step": C_YEL + C_BOLD, "warn": C_YEL,
                "err": C_RED, "cmd": C_BLU, "tool": "", "dev": C_GRY}

if sys.platform == "win32":
    os.system("")  # enable VT100 on Windows console


def clog(msg, level="info"):
    color = LEVEL_COLORS.get(level, "")
    try:
        print(f"{color}{msg}{C_RST}" if color else msg, flush=True)
    except UnicodeEncodeError:
        print(msg.encode("ascii", "replace").decode("ascii"), flush=True)


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


def _tool_cmd(path):
    """Zbuduj prefiks komendy dla esptool/espefuse (patrz flasher.py — ten
    sam [WinError 193] gdy subprocess probuje odpalic ".py" bezposrednio
    jako natywny .exe na Windows)."""
    if path.endswith(".py"):
        return [sys.executable, path]
    return [path]


def flash_device(cfg, tools, port, client_code=None, flashed_macs=None, lang=None):
    """DEV flash jednej sztuki. Zwraca (mac, ok). Wpis w production_log.csv
    zawsze (OK/FAIL)."""
    clog(f"\n=== FLASH START: port={port}, mode=DEV ===", "step")
    try:
        mac = tools.read_mac(port, after="no_reset")
    except Exception as e:  # noqa: BLE001
        clog(f"!!! Nie udalo sie odczytac MAC: {e}", "err")
        fc.append_production_log(LOG_PATH, {"mac": "?", "port": port, "mode": "DEV",
                                            "result": "FAIL", "error": f"[mac] {e}", "tool": "cli"})
        return None, False
    if not mac:
        clog("!!! Nie udalo sie odczytac MAC", "err")
        fc.append_production_log(LOG_PATH, {"mac": "?", "port": port, "mode": "DEV",
                                            "result": "FAIL", "error": "[mac] brak MAC", "tool": "cli"})
        return None, False
    clog(f"  MAC: {mac}", "info")
    if flashed_macs is not None and mac in flashed_macs:
        clog(f"[=] {mac} juz obsluzony w tej sesji (wynik: {flashed_macs[mac]}) — pomijam "
             "(odlacz go). Zeby sflashowac ponownie, uruchom CLI jeszcze raz.", "warn")
        return mac, None

    job = fc.FlashJob(cfg, tools, "DEV", port, mac, clog, code=client_code, lang=lang,
                      wipe_nvs=True, project_root=PROJECT_ROOT, keys_dir=KEYS_DIR,
                      tool_name="cli")
    r = fc.run_flash_job(job)
    where = fc.append_production_log(LOG_PATH, r.log_row())
    if where != LOG_PATH:
        clog(f"[!] production_log.csv zablokowany — wpis zapisany w {where}", "warn")
    if r.ok:
        clog(f"=== SUKCES: {mac} (v{(r.fw or {}).get('version') or '?'}, start OK"
             f"{', kod AI OK' if client_code else ''}{', jezyk ' + lang if lang else ''}) ===", "ok")
        clog("[i] NVS wyczyszczony. Urzadzenie zwrocone od klienta? Panel admina -> "
             f"urzadzenie {mac} -> 'Reset tokenu'.", "warn")
    else:
        clog(f"=== FAIL: {mac} — {r.error} ===", "err")
    return mac, r.ok


def main():
    ap = argparse.ArgumentParser(description="KalkMate flasher CLI (tylko DEV)")
    ap.add_argument("--prod-dev", action="store_true",
                    help="WYLACZONE — Flash Encryption tylko przez GUI (flasher.py)")
    ap.add_argument("--prod-rel", action="store_true",
                    help="WYLACZONE — Flash Encryption tylko przez GUI (flasher.py)")
    ap.add_argument("--auto", action="store_true",
                    help="Petla: flashuj kazda nowa sztuke (kazdy MAC najwyzej raz na sesje)")
    ap.add_argument("--code", default=None,
                    help="Kod AI klienta (4 cyfry, z /admin/orders) do wgrania "
                         "przez okno prowizjonowania zaraz po flashu. Blad wgrania = FAIL. "
                         "Nie da sie laczyc z --auto (ten sam kod poszedlby na kazda sztuke).")
    ap.add_argument("--lang", choices=list(fc.LANG_CODES), default=None,
                    help="Jezyk interfejsu kalkulatora (pl/en/de) wgrywany w oknie "
                         "prowizjonowania. Brak = domyslny firmware'u (en). Blad = FAIL.")
    args = ap.parse_args()

    if args.prod_dev or args.prod_rel:
        clog("BLAD: tryby PROD_DEV/PROD_REL sa wylaczone w CLI (stara implementacja "
             "psula urzadzenia). Uzyj GUI: python flasher.py", "err")
        sys.exit(2)
    if args.code and args.auto:
        clog("BLAD: --code razem z --auto wgraloby ten sam kod na wszystkie "
             "urzadzenia. Uzyj --code bez --auto (jedna sztuka na raz).", "err")
        sys.exit(1)
    if args.code and not (len(args.code) == 4 and args.code.isdigit()):
        clog("BLAD: --code musi miec dokladnie 4 cyfry.", "err")
        sys.exit(1)

    cfg = load_config()
    tools = fc.EspTools(cfg, _tool_cmd, clog)
    clog("=== KalkMate Production Flasher (CLI, tylko DEV) ===", "step")
    info = fc.firmware_info(cfg, PROJECT_ROOT)
    clog(f"Firmware: {cfg['firmware_bin']}  (v{info['version'] or '?'}"
         f"{', potwierdzona w obrazie' if info['in_image'] else ''})", "info")
    for w in info["warnings"]:
        clog(f"[!] {w}", "warn")
    if info["missing"]:
        clog("BLAD: brak plikow: " + ", ".join(info["missing"]), "err")
        sys.exit(1)
    clog(f"Log: {LOG_PATH}", "info")
    clog("DEV czysci NVS + otadata przed zapisem (token, WiFi, kod AI, historia).\n", "warn")

    handled = set()          # porty juz obsluzone (do fizycznego odlaczenia)
    absent_since = {}        # port -> kiedy zniknal
    # --auto: kazdy MAC (OK albo FAIL) najwyzej raz na sesje — zepsuta sztuka
    # w petli restartow tez nie bedzie flashowana w kolko.
    flashed_macs = {} if args.auto else None
    clog("Oczekuje na podlaczenie ESP32-S3... (Ctrl+C aby zakonczyc)", "info")

    while True:
        try:
            now = time.time()
            # Porty TinyUSB CDC (0x4001) to zawsze dzialajacy firmware, nigdy
            # "nowe urzadzenie do flashowania" — pomijamy je calkowicie.
            ports = {p["port"]: p for p in fc.list_esp_ports(include_tinyusb=False)}

            for port in list(handled):
                if port in ports:
                    absent_since.pop(port, None)
                    continue
                t0 = absent_since.setdefault(port, now)
                if now - t0 >= UNPLUG_DEBOUNCE_S:
                    handled.discard(port)
                    absent_since.pop(port, None)
                    clog(f"[-] Odlaczono {port}", "info")

            for port, p in ports.items():
                if port in handled:
                    continue
                handled.add(port)
                sn_mac = fc.mac_from_serial_number(p["serial"])
                if flashed_macs is not None and sn_mac and sn_mac in flashed_macs:
                    clog(f"[=] {port}: {sn_mac} juz sflashowany w tej sesji — pomijam", "warn")
                    continue
                clog(f"\n[+] Wykryto urzadzenie na {port}", "ok")
                try:
                    mac, ok = flash_device(cfg, tools, port, client_code=args.code, lang=args.lang,
                                           flashed_macs=flashed_macs)
                    if ok is not None and flashed_macs is not None and mac:
                        flashed_macs[mac] = "OK" if ok else "FAIL"
                except Exception as e:  # noqa: BLE001
                    clog(f"!!! BLAD: {e}", "err")
                    fc.append_production_log(LOG_PATH, {"mac": "?", "port": port, "mode": "DEV",
                                                        "result": "FAIL", "error": str(e), "tool": "cli"})
                clog("Odlacz urzadzenie i podlacz nastepne, lub Ctrl+C aby zakonczyc.", "info")
                # Po flashu port mogl chwile zniknac (reset) — nie licz tego
                # jako odlaczenia.
                absent_since.pop(port, None)

            time.sleep(0.5)
        except KeyboardInterrupt:
            clog("\nBye.", "info")
            break


if __name__ == "__main__":
    main()
