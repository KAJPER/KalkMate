#!/usr/bin/env python3
# =====================================================================
#  KalkMate Production Flasher
#
#  Co robi:
#    1. Wykrywa ESP32-S3 podlaczony przez USB (sprawdza COM porty co 500ms)
#    2. Czyta MAC chipa - pokazuje jako Device ID
#    3. Flashuje bootloader + partitions + firmware przez esptool.py
#    4. OPCJONALNIE wypala Flash Encryption eFuse (Development mode -
#       NIEODWRACALNE, ale Development pozwala na rewrites podczas testow)
#    5. Loguje wynik do production_log.csv
#
#  Uzycie:
#    python flasher.py
#    Plug in ESP32-S3 → kliknij "FLASH" → kalkulator gotowy do wysylki
#
#  Tryby:
#    DEV         — tylko firmware, bez Flash Encryption (dla prototypow)
#    PROD_DEV    — firmware + Flash Encryption (Development mode - mozesz
#                  jeszcze rewrites podczas testow QC)
#    PROD_REL    — firmware + Flash Encryption (RELEASE - eFuses zablokowane
#                  ZAWSZE, juz nigdy nie sflashujesz tej plytki). TYLKO PRZY
#                  KONCOWYM PAKOWANIU DO WYSYLKI.
# =====================================================================

import os
import sys
import time
import csv
import json
import threading
import subprocess
import queue
from datetime import datetime

# === Fix dla zatrutego TCL_LIBRARY przez CSR BlueSuite / inne aplikacje ===
# Tkinter szuka init.tcl w sciezkach z TCL_LIBRARY env. Niektore programy
# (CSR BlueSuite, Mathematica, R) ustawiaja to globalnie na swoje wlasne
# Tcl ktore nie pasuje do Pythona. Wymuszamy wlasciwa sciezke z Python installu.
if sys.platform == "win32":
    _py_dir = os.path.dirname(sys.executable)
    for _sub in ["tcl/tcl8.6", "tcl/tk8.6", "Lib/tcl8.6", "Lib/tk8.6"]:
        _path = os.path.join(_py_dir, _sub.replace("/", os.sep))
        if os.path.exists(_path):
            if "tcl8" in _sub:
                os.environ["TCL_LIBRARY"] = _path
            else:
                os.environ["TK_LIBRARY"] = _path

import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext

try:
    from serial.tools import list_ports
except ImportError:
    print("BLAD: brak pyserial. Zainstaluj: pip install pyserial")
    sys.exit(1)

# === Konfiguracja ===
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
CONFIG_PATH = os.path.join(SCRIPT_DIR, "config.json")
LOG_PATH = os.path.join(SCRIPT_DIR, "production_log.csv")
KEYS_DIR = os.path.join(SCRIPT_DIR, "keys")

# ESP32-S3 native USB-Serial-JTAG: VID=0x303A, PID=0x1001
# ESP32-S3 TinyUSB CDC: VID=0x303A, PID=0x4001
# CH340 (legacy WROVER PCB): VID=0x1A86, PID=0x7523
ESP32S3_USB_IDS = [
    (0x303A, 0x1001),  # USB-Serial-JTAG
    (0x303A, 0x4001),  # TinyUSB CDC (KalkMate firmware)
]


def _autodetect_esptool():
    """Znajdz esptool/espefuse w typowych lokalizacjach (PIO venv, IDF, PATH)."""
    candidates = []
    home = os.path.expanduser("~")
    # PlatformIO Windows venv
    pio_scripts = os.path.join(home, ".platformio", "penv", "Scripts")
    if sys.platform == "win32":
        candidates.append((os.path.join(pio_scripts, "esptool.exe"),
                           os.path.join(pio_scripts, "espefuse.exe")))
    else:
        candidates.append((os.path.join(pio_scripts, "esptool"),
                           os.path.join(pio_scripts, "espefuse")))
    # Package raw scripts (cross-platform fallback)
    pio_pkg = os.path.join(home, ".platformio", "packages",
                            "tool-esptoolpy")
    candidates.append((os.path.join(pio_pkg, "esptool.py"),
                       os.path.join(pio_pkg, "espefuse.py")))
    # Fallback: PATH
    candidates.append(("esptool.py", "espefuse.py"))
    candidates.append(("esptool", "espefuse"))

    for esptool, espefuse in candidates:
        if os.path.exists(esptool) or esptool in ("esptool", "esptool.py"):
            return esptool, espefuse
    return None, None


def load_config():
    """Wczytaj config.json lub utworz domyslny (z auto-detect ścieżek)."""
    auto_esptool, auto_espefuse = _autodetect_esptool()
    defaults = {
        "esptool":  auto_esptool  or "esptool.py",
        "espefuse": auto_espefuse or "espefuse.py",
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
        # Klucz Flash Encryption (256-bit XTS-AES). Generowany przy
        # pierwszym buildzie produkcyjnym, ten sam dla wszystkich plytek
        # tej serii (alternatywnie: per-device random - bezpieczniejsze ale
        # wymaga zarzadzania kluczami w bazie).
        "fe_key_file": os.path.join(KEYS_DIR, "flash_encryption_key.bin"),
    }
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            defaults.update(json.load(f))
    # Walidacja: jezeli skonfigurowany esptool/espefuse nie istnieje
    # (np. bo user mial stary config bez pelnej sciezki), uzyj auto-detect.
    # Tylko absolute paths sprawdzamy — bare 'esptool.py' znaczy "z PATH".
    for k, autoval in [("esptool", auto_esptool),
                       ("espefuse", auto_espefuse)]:
        v = defaults.get(k, "")
        if os.path.isabs(v) and not os.path.exists(v) and autoval:
            defaults[k] = autoval
        elif (not os.path.isabs(v)) and autoval and os.path.isabs(autoval):
            # Bare name (np. "esptool.py") -> jezeli mamy lepszy abs, uzyj
            defaults[k] = autoval
    # Zapisz (nadpisuje config.json z aktualnymi wartosciami)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(defaults, f, indent=2)
    return defaults


def find_esp32s3_ports():
    """Zwraca liste portow ktore wygladaja na ESP32-S3."""
    found = []
    for p in list_ports.comports():
        vid = p.vid if p.vid is not None else 0
        pid = p.pid if p.pid is not None else 0
        if (vid, pid) in ESP32S3_USB_IDS:
            found.append({"port": p.device, "vid": vid, "pid": pid,
                          "desc": p.description})
    return found


def log_event(mac, port, mode, result, error=""):
    """Dopisz wpis do production_log.csv."""
    new_file = not os.path.exists(LOG_PATH)
    with open(LOG_PATH, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if new_file:
            w.writerow(["timestamp", "mac", "port", "mode", "result", "error"])
        w.writerow([datetime.now().isoformat(timespec="seconds"),
                    mac, port, mode, result, error])


# ----------------------------------------------------------------------
# GUI
# ----------------------------------------------------------------------
class FlasherApp:
    def __init__(self, root):
        self.root = root
        self.cfg = load_config()
        self.current_port = None
        self.current_mac = None
        self.busy = False
        self.log_q = queue.Queue()

        root.title("KalkMate Production Flasher")
        root.geometry("700x600")
        root.configure(bg="#1a1a1a")

        # === Status panel ===
        status_frame = tk.Frame(root, bg="#1a1a1a")
        status_frame.pack(fill=tk.X, padx=10, pady=10)

        tk.Label(status_frame, text="Status:", bg="#1a1a1a",
                 fg="#F2EDE3", font=("Arial", 11)).pack(side=tk.LEFT)

        self.status_label = tk.Label(
            status_frame, text="OCZEKUJE NA URZADZENIE...",
            bg="#1a1a1a", fg="#D8FF3D", font=("Arial", 14, "bold"))
        self.status_label.pack(side=tk.LEFT, padx=10)

        # === Device info ===
        info_frame = tk.LabelFrame(
            root, text=" Urzadzenie ", bg="#1a1a1a", fg="#F2EDE3",
            font=("Arial", 10, "bold"))
        info_frame.pack(fill=tk.X, padx=10, pady=5)

        self.port_var = tk.StringVar(value="-")
        self.mac_var = tk.StringVar(value="-")
        self.chip_var = tk.StringVar(value="-")

        for label, var in [("Port:", self.port_var),
                           ("MAC / Device ID:", self.mac_var),
                           ("Chip:", self.chip_var)]:
            row = tk.Frame(info_frame, bg="#1a1a1a")
            row.pack(fill=tk.X, padx=10, pady=2)
            tk.Label(row, text=label, bg="#1a1a1a", fg="#888",
                     width=20, anchor="w").pack(side=tk.LEFT)
            tk.Label(row, textvariable=var, bg="#1a1a1a", fg="#F2EDE3",
                     font=("Consolas", 11, "bold")).pack(side=tk.LEFT)

        # === Mode selection ===
        mode_frame = tk.LabelFrame(
            root, text=" Tryb flashowania ", bg="#1a1a1a", fg="#F2EDE3",
            font=("Arial", 10, "bold"))
        mode_frame.pack(fill=tk.X, padx=10, pady=5)

        self.mode_var = tk.StringVar(value="DEV")
        modes = [
            ("DEV — tylko firmware (prototyp)", "DEV"),
            ("PROD_DEV — firmware + Flash Encryption (Dev mode, mozna jeszcze rewrites)",
             "PROD_DEV"),
            ("PROD_REL — firmware + FE Release (PERMANENTNIE zablokowane!)",
             "PROD_REL"),
        ]
        for text, val in modes:
            tk.Radiobutton(
                mode_frame, text=text, value=val, variable=self.mode_var,
                bg="#1a1a1a", fg="#F2EDE3", selectcolor="#333",
                activebackground="#1a1a1a", activeforeground="#D8FF3D",
                font=("Arial", 9)
            ).pack(anchor="w", padx=10, pady=1)

        # === Action buttons ===
        btn_frame = tk.Frame(root, bg="#1a1a1a")
        btn_frame.pack(fill=tk.X, padx=10, pady=10)

        self.flash_btn = tk.Button(
            btn_frame, text="FLASH",
            bg="#D8FF3D", fg="#0a0a0a", font=("Arial", 16, "bold"),
            command=self.start_flash, state=tk.DISABLED,
            padx=30, pady=12)
        self.flash_btn.pack(side=tk.LEFT, padx=5)

        tk.Button(
            btn_frame, text="Otworz log",
            bg="#333", fg="#F2EDE3", font=("Arial", 9),
            command=self.open_log).pack(side=tk.LEFT, padx=5)

        tk.Button(
            btn_frame, text="Wyczysc",
            bg="#333", fg="#F2EDE3", font=("Arial", 9),
            command=self.clear_console).pack(side=tk.LEFT, padx=5)

        # === Console output ===
        console_frame = tk.LabelFrame(
            root, text=" Log ", bg="#1a1a1a", fg="#F2EDE3",
            font=("Arial", 10, "bold"))
        console_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        self.console = scrolledtext.ScrolledText(
            console_frame, bg="#0a0a0a", fg="#0F0", font=("Consolas", 9),
            wrap=tk.WORD)
        self.console.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # Start poll loop + log queue drainer
        self.poll_ports()
        self.drain_log()

    # -- Console helper ---------------------------------------------------
    def log(self, msg, color="#0F0"):
        self.log_q.put((msg, color))

    def drain_log(self):
        try:
            while True:
                msg, color = self.log_q.get_nowait()
                self.console.tag_config(color, foreground=color)
                self.console.insert(tk.END, msg + "\n", color)
                self.console.see(tk.END)
        except queue.Empty:
            pass
        self.root.after(100, self.drain_log)

    def clear_console(self):
        self.console.delete("1.0", tk.END)

    def open_log(self):
        if os.path.exists(LOG_PATH):
            os.startfile(LOG_PATH)
        else:
            messagebox.showinfo("Log", "Brak wpisow yet — sflashuj pierwsze urzadzenie.")

    # -- USB port detection -----------------------------------------------
    def poll_ports(self):
        if not self.busy:
            ports = find_esp32s3_ports()
            if ports:
                p = ports[0]
                if p["port"] != self.current_port:
                    self.current_port = p["port"]
                    self.port_var.set(p["port"])
                    self.status_label.config(text="WYKRYTO URZADZENIE",
                                              fg="#D8FF3D")
                    self.log(f"[+] Wykryto ESP32-S3 na {p['port']} "
                             f"(VID:PID={p['vid']:04x}:{p['pid']:04x})")
                    # Probuj odczytac MAC w tle
                    threading.Thread(
                        target=self.read_chip_info, daemon=True).start()
            else:
                if self.current_port is not None:
                    self.log(f"[-] Odlaczono urzadzenie {self.current_port}")
                self.current_port = None
                self.current_mac = None
                self.port_var.set("-")
                self.mac_var.set("-")
                self.chip_var.set("-")
                self.status_label.config(text="OCZEKUJE NA URZADZENIE...",
                                          fg="#888")
                self.flash_btn.config(state=tk.DISABLED)
        self.root.after(500, self.poll_ports)

    def read_chip_info(self):
        """Odczytaj MAC + chip type przez esptool chip_id."""
        try:
            cmd = [self.cfg["esptool"], "--chip", self.cfg["chip"],
                   "--port", self.current_port, "--baud", "115200",
                   "--after", "no_reset",
                   "chip_id"]
            res = subprocess.run(cmd, capture_output=True, text=True,
                                 timeout=15)
            output = res.stdout + res.stderr
            mac = None
            chip = self.cfg["chip"]
            for line in output.splitlines():
                if "MAC:" in line:
                    mac = line.split("MAC:")[1].strip().replace(":", "").upper()
                if "Chip is" in line:
                    chip = line.split("Chip is")[1].strip()
            if mac:
                self.current_mac = mac
                self.mac_var.set(mac)
                self.chip_var.set(chip)
                self.log(f"[i] MAC: {mac}  chip: {chip}")
                self.flash_btn.config(state=tk.NORMAL)
            else:
                self.log(f"[!] Nie udalo sie odczytac MAC:\n{output[:200]}",
                         "#F88")
        except subprocess.TimeoutExpired:
            self.log("[!] Timeout odczytu chipa (czy w bootloader mode?)",
                     "#F88")
        except FileNotFoundError:
            self.log(f"[!] BLAD: nie znaleziono '{self.cfg['esptool']}'. "
                     f"Edytuj {CONFIG_PATH}", "#F00")
        except Exception as e:
            self.log(f"[!] Blad odczytu: {e}", "#F88")

    # -- Flash workflow ---------------------------------------------------
    def start_flash(self):
        mode = self.mode_var.get()
        # Confirmation przy nieodwracalnych operacjach
        if mode == "PROD_REL":
            if not messagebox.askyesno(
                    "UWAGA — Operacja NIEODWRACALNA",
                    f"PROD_REL: po flashu urzadzenie {self.current_mac} "
                    f"BEDZIE NA ZAWSZE zablokowane (eFuses).\n\n"
                    "Nie da sie juz sflashowac, debugowac, rewrites.\n\n"
                    "Czy NA PEWNO pakujesz to do wysylki klientowi?"):
                return
        elif mode == "PROD_DEV":
            if not messagebox.askyesno(
                    "Flash Encryption (Development)",
                    f"Wlaczam Flash Encryption na {self.current_mac}.\n\n"
                    "Mozesz jeszcze sflashowac kilka razy w trybie dev, "
                    "ale po PRZELACZENIU na Release jest game over.\n\nKontynuowac?"):
                return

        self.busy = True
        self.flash_btn.config(state=tk.DISABLED)
        threading.Thread(target=self._do_flash, args=(mode,),
                         daemon=True).start()

    def _do_flash(self, mode):
        port = self.current_port
        mac = self.current_mac
        try:
            self.status_label.config(text="FLASHUJE...", fg="#FFA500")
            self.log(f"\n=== FLASH START: {mac} on {port}, mode={mode} ===")

            # Validate firmware files exist
            for f in [self.cfg["firmware_bin"], self.cfg["bootloader_bin"],
                      self.cfg["partitions_bin"]]:
                if not os.path.exists(f):
                    raise FileNotFoundError(f"Brak pliku: {f}")

            # Step 1: flash firmware
            # Dla PROD_DEV/PROD_REL: pre-szyfrujemy binaries kluczem przed wgraniem,
            # bo przy host-generated key ESP32 NIE auto-szyfruje flash przy pierwszym
            # boocie (robi to tylko przy device-generated key).
            if mode in ("PROD_DEV", "PROD_REL"):
                key_file = self.cfg["fe_key_file"]
                if not os.path.exists(key_file):
                    os.makedirs(os.path.dirname(key_file), exist_ok=True)
                    self.log(f"  Generuje nowy klucz FE: {key_file}")
                    with open(key_file, "wb") as f:
                        f.write(os.urandom(64))   # 64 bajtow = XTS-AES-256
                espsecure = self.cfg.get("espsecure",
                    self.cfg["espefuse"].replace("espefuse", "espsecure"))
                enc_dir = os.path.join(os.path.dirname(key_file), "encrypted")
                os.makedirs(enc_dir, exist_ok=True)
                self.log(f"[0/3] Pre-szyfrowanie binaries kluczem FE...")
                enc_bins = []
                for addr, src in [
                    (self.cfg["flash_addr_bootloader"], self.cfg["bootloader_bin"]),
                    (self.cfg["flash_addr_partitions"], self.cfg["partitions_bin"]),
                    (self.cfg["flash_addr_firmware"],   self.cfg["firmware_bin"]),
                ]:
                    dst = os.path.join(enc_dir, os.path.basename(src).replace(".bin", "_enc.bin"))
                    cmd = [espsecure, "encrypt-flash-data",
                           "--aes-xts", "--keyfile", key_file,
                           "--address", addr, "--output", dst, src]
                    self._run_subprocess(cmd, prefix="espsecure")
                    enc_bins.append((addr, dst))
                boot_bin, part_bin, fw_bin = enc_bins[0][1], enc_bins[1][1], enc_bins[2][1]
            else:
                boot_bin = self.cfg["bootloader_bin"]
                part_bin = self.cfg["partitions_bin"]
                fw_bin   = self.cfg["firmware_bin"]

            self.log(f"[1/3] Flashuje bootloader + partitions + firmware...")
            force_flag = ["--force"] if mode in ("PROD_DEV", "PROD_REL") else []
            cmd = [
                self.cfg["esptool"], "--chip", self.cfg["chip"],
                "--port", port, "--baud", str(self.cfg["baud"]),
                "--after", "no-reset",
                "write-flash", *force_flag,
                self.cfg["flash_addr_bootloader"], boot_bin,
                self.cfg["flash_addr_partitions"], part_bin,
                self.cfg["flash_addr_firmware"],   fw_bin,
            ]
            self._run_subprocess(cmd, prefix="esptool")

            # Step 2 (opcjonalne): Flash Encryption eFuse
            if mode in ("PROD_DEV", "PROD_REL"):
                self.log("[2/3] Wypalanie Flash Encryption eFuse...")
                # Wypal klucz w BLOCK_KEY0
                cmd = [self.cfg["espefuse"], "--chip", self.cfg["chip"],
                       "--port", port,
                       "burn-key", "BLOCK_KEY0",
                       key_file, "XTS_AES_256_KEY"]
                self._run_subprocess(cmd, prefix="espefuse-key", stdin_input="BURN\n")
                # Wlacz Flash Encryption
                cmd = [self.cfg["espefuse"], "--chip", self.cfg["chip"],
                       "--port", port,
                       "burn-efuse", "SPI_BOOT_CRYPT_CNT", "1"]
                self._run_subprocess(cmd, prefix="espefuse-en", stdin_input="BURN\n")

            # Step 3 (tylko PROD_REL): zamknij Flash Encryption Release
            if mode == "PROD_REL":
                self.log("[3/3] Przelaczenie FE na RELEASE mode (PERMANENT!)...")
                cmd = [self.cfg["espefuse"], "--chip", self.cfg["chip"],
                       "--port", port,
                       "burn-efuse", "DIS_DOWNLOAD_MANUAL_ENCRYPT", "1"]
                self._run_subprocess(cmd, prefix="espefuse-release", stdin_input="BURN\n")

            # Reset chip zeby dostal sie z bootloader mode do normalnego bootu
            self.log("Resetuje urzadzenie...")
            try:
                cmd = [self.cfg["esptool"], "--chip", self.cfg["chip"],
                       "--port", port, "--baud", "115200", "run"]
                self._run_subprocess(cmd, prefix="esptool-reset")
            except Exception:
                self.log("  (reset przez esptool nie powiodl sie — nacisnij RESET recznie)", "#F88")

            self.log(f"=== FLASH SUKCES: {mac} ===\n", "#0F0")
            self.status_label.config(text=f"SUKCES — odlacz urzadzenie",
                                      fg="#0F0")
            log_event(mac, port, mode, "OK")

        except subprocess.CalledProcessError as e:
            self.log(f"!!! BLAD: subprocess return {e.returncode}", "#F00")
            self.status_label.config(text="BLAD!", fg="#F00")
            log_event(mac, port, mode, "FAIL", f"exit {e.returncode}")
        except Exception as e:
            self.log(f"!!! BLAD: {e}", "#F00")
            self.status_label.config(text="BLAD!", fg="#F00")
            log_event(mac, port, mode, "FAIL", str(e))
        finally:
            self.busy = False

    def _run_subprocess(self, cmd, prefix="", stdin_input=None):
        """Odpal subprocess i streamuj jego stdout/stderr do console."""
        self.log(f"  $ {' '.join(cmd)}", "#88F")
        proc = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            stdin=subprocess.PIPE if stdin_input else None,
            text=True, bufsize=1)
        if stdin_input:
            proc.stdin.write(stdin_input)
            proc.stdin.flush()
            proc.stdin.close()
        for line in proc.stdout:
            self.log(f"  [{prefix}] {line.rstrip()}")
        proc.wait()
        if proc.returncode != 0:
            raise subprocess.CalledProcessError(proc.returncode, cmd)


def main():
    root = tk.Tk()
    app = FlasherApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
