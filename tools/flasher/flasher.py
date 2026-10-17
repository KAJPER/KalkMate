#!/usr/bin/env python3
# =====================================================================
#  KalkMate Production Flasher
#
#  Co robi:
#    1. Wykrywa ESP32-S3 podlaczony przez USB (sprawdza COM porty co 500ms)
#    2. Czyta MAC chipa - pokazuje jako Device ID
#    3. Czysci NVS + otadata (DEV/PROD_DEV zawsze, PROD_REL opcjonalnie)
#    4. Flashuje bootloader + partitions + firmware przez esptool.py
#    5. OPCJONALNIE wypala Flash Encryption eFuse (NIEODWRACALNE)
#    6. Resetuje i WERYFIKUJE start firmware'u (log z portu USB), wgrywa
#       kod AI klienta (KALKPROV) — kazdy blad = FAIL
#    7. Loguje wynik do production_log.csv (wersja FW, SHA-256 obrazow,
#       odcisk klucza FE, wynik startu/prowizjonowania — bez samego kodu)
#
#  Uzycie:
#    python flasher.py
#    Plug in ESP32-S3 -> kliknij "FLASH" -> kalkulator gotowy do wysylki
#
#  Tryby:
#    DEV         - tylko firmware, bez Flash Encryption (dla prototypow).
#                  Odmawia, jesli chip ma juz wlaczone szyfrowanie.
#    PROD_DEV    - firmware + Flash Encryption (Development mode - mozesz
#                  jeszcze rewrites podczas testow QC)
#    PROD_REL    - firmware + FE Release (DIS_DOWNLOAD_MANUAL_ENCRYPT).
#                  TYLKO na chipie po PROD_DEV (klucz spalony + szyfrowanie
#                  wlaczone) — inaczej FAIL. TYLKO PRZY KONCOWYM PAKOWANIU.
#
#  Logika flashowania jest w flasher_common.py (wspolna z flasher_cli.py).
# =====================================================================

import os
import sys
import json
import threading
import subprocess
import queue
from datetime import datetime

# === Tryb "frozen" (PyInstaller, tools/flasher/build_exe.ps1) ===
# W paczce nie ma zewnetrznego esptool.py — pakiet `esptool` (pip, 4.x) jest
# w srodku exe. Zeby zachowac dotychczasowa logike subprocess (streaming
# logu, stdin "BURN"), exe wywoluje SAM SIEBIE z flaga --run-<tool> i tu,
# zanim zaladuje sie tkinter, przekazuje sterowanie do danego narzedzia.
FROZEN = bool(getattr(sys, "frozen", False))
if len(sys.argv) > 1 and sys.argv[1] in ("--run-esptool", "--run-espefuse", "--run-espsecure"):
    _tool = sys.argv[1][len("--run-"):]
    sys.argv = [_tool + ".py"] + sys.argv[2:]
    import importlib
    _mod = importlib.import_module(_tool)
    if _tool == "esptool":
        # esptool.write_flash "zgaduje" Intel HEX po pierwszym bajcie pliku
        # (":" / 0x3A) i probuje sparsowac go jako tekst hex — dla naszych
        # zaszyfrowanych (AES-XTS) binarek to czysto losowe dane, wiec raz
        # na ~256 flashy pierwszy bajt trafia na 0x3A i loadhex() pada z
        # UnicodeDecodeError (system Windows-owy codepage np. cp1250 nie
        # dekoduje dowolnych bajtow). My NIGDY nie flashujemy prawdziwych
        # plikow .hex, wiec to wykrywanie jest tu zawsze falszywym alarmem —
        # wylaczamy je calkowicie.
        _mod.intel_hex_to_bin = lambda f, start_addr=None: f
    try:
        _mod.main()
    except SystemExit as _e:
        raise
    sys.exit(0)

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
from tkinter import messagebox, scrolledtext, filedialog, simpledialog

try:
    import serial  # noqa: F401  (wymagany przez flasher_common)
    from serial.tools import list_ports  # noqa: F401
except ImportError:
    print("BLAD: brak pyserial. Zainstaluj: pip install pyserial")
    sys.exit(1)

import flasher_common as fc

# === Konfiguracja ===
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
# Zasoby dolaczone do paczki PyInstaller (onedir: <exe_dir>/_internal).
BUNDLE_DIR = getattr(sys, "_MEIPASS", SCRIPT_DIR)
# Dane trwale (config, log, KLUCZE). W paczce NIE moga lezec obok exe —
# folder instalacji jest nadpisywany przy aktualizacji, a klucze nie moga
# byc czescia instalatora. Stad %APPDATA%\KalkMate\flasher.
if FROZEN:
    DATA_DIR = os.path.join(
        os.environ.get("APPDATA", os.path.expanduser("~")), "KalkMate", "flasher")
else:
    DATA_DIR = SCRIPT_DIR
os.makedirs(DATA_DIR, exist_ok=True)
CONFIG_PATH = os.path.join(DATA_DIR, "config.json")
LOG_PATH = os.path.join(DATA_DIR, "production_log.csv")
KEYS_DIR = os.path.join(DATA_DIR, "keys")
os.makedirs(KEYS_DIR, exist_ok=True)

# Domyslny firmware: w paczce = biny dolaczone przy buildzie
# (build_exe.ps1 kopiuje aktualny .pio/build/esp32s3 + fw_version.txt),
# w dev = build PIO.
if FROZEN:
    DEFAULT_FW_DIR = os.path.join(BUNDLE_DIR, "firmware")
else:
    DEFAULT_FW_DIR = os.path.join(PROJECT_ROOT, ".pio", "build", "esp32s3")

# Porty: patrz flasher_common.ESP32S3_USB_IDS. Firmware KalkMate (HWCDC,
# ARDUINO_USB_MODE=1) ma TEN SAM VID:PID 0x303A:0x1001 co ROM w trybie
# download — start firmware'u weryfikujemy po jego logu, nie po porcie.
ESP32S3_USB_IDS = fc.ESP32S3_USB_IDS

LEVEL_COLORS = {"info": "#0F0", "ok": "#0F0", "step": "#D8FF3D", "warn": "#FA0",
                "err": "#F44", "cmd": "#88F", "tool": "#0C0", "dev": "#8AB"}
BG = "#1a1a1a"
FG = "#F2EDE3"


def _autodetect_esptool():
    """Znajdz esptool/espefuse w typowych lokalizacjach (PIO venv, IDF, PATH)."""
    if FROZEN:
        # Narzedzia sa w srodku exe — markery obsluguje _tool_cmd().
        return "<frozen>esptool", "<frozen>espefuse"
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
        "firmware_bin": os.path.join(DEFAULT_FW_DIR, "firmware.bin"),
        "bootloader_bin": os.path.join(DEFAULT_FW_DIR, "bootloader.bin"),
        "partitions_bin": os.path.join(DEFAULT_FW_DIR, "partitions.bin"),
        "flash_addr_bootloader": "0x0",
        "flash_addr_partitions": "0x8000",
        "flash_addr_firmware":   "0x10000",
        # Klucz Flash Encryption (64 B, XTS-AES-256). Ten sam dla wszystkich
        # plytek serii. NIGDY nie generowany automatycznie — tylko jawnym
        # przyciskiem "Wygeneruj nowy klucz FE" (nowa seria). Odcisk SHA-256
        # przypiety obok: keys/flash_encryption_key.sha256.
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
    # Firmware: config z innego komputera / stary build moze wskazywac na
    # nieistniejacy folder -> wroc do domyslnego (w paczce: biny z instalatora).
    for k, name in [("firmware_bin", "firmware.bin"),
                    ("bootloader_bin", "bootloader.bin"),
                    ("partitions_bin", "partitions.bin")]:
        if not os.path.exists(defaults.get(k, "")):
            defaults[k] = os.path.join(DEFAULT_FW_DIR, name)
    # Klucz FE zawsze w KEYS_DIR biezacego komputera (nigdy sciezka z paczki).
    defaults["fe_key_file"] = os.path.join(KEYS_DIR, "flash_encryption_key.bin")
    # Zapisz (nadpisuje config.json z aktualnymi wartosciami)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(defaults, f, indent=2)
    return defaults


def _tool_cmd(path):
    """Zbuduj prefiks komendy dla esptool/espefuse/espsecure.

    Na Windows subprocess.run/Popen woła CreateProcess bezposrednio (bez
    shell=True), ktore NIE zna skojarzen plikow — probujac odpalic ".py"
    jako natywny .exe dostajemy [WinError 193] "%1 nie jest prawidlowa
    aplikacja systemu Win32". Trzeba jawnie przepuscic przez interpreter,
    ktorym ten GUI wlasnie dziala (sys.executable).
    """
    if path.startswith("<frozen>"):
        # Paczka PyInstaller: exe uruchamia sam siebie w trybie narzedzia
        # (dispatcher na gorze pliku, przed importem tkinter).
        return [sys.executable, "--run-" + path[len("<frozen>"):]]
    if path.endswith(".py"):
        return [sys.executable, path]
    return [path]


# Bez migajacych okien konsoli przy kazdym wywolaniu esptool (Windows);
# w paczce --windowed exe i tak nie ma konsoli, ale dzieci by ja tworzyly.
_SUBPROCESS_FLAGS = getattr(subprocess, "CREATE_NO_WINDOW", 0) if sys.platform == "win32" else 0


def find_esp32s3_ports():
    """Zwraca liste portow ktore wygladaja na ESP32-S3."""
    return fc.list_esp_ports()


# ----------------------------------------------------------------------
# GUI
# ----------------------------------------------------------------------
class FlasherApp:
    """Wszystkie zmiany widgetow Tk ida przez self.ui() -> kolejka ->
    drain_ui() w glownym watku (Tk nie jest thread-safe). Watki robocze
    (odczyt MAC, flash) NIE dotykaja widgetow bezposrednio."""

    def __init__(self, root):
        self.root = root
        self.cfg = load_config()
        self.current_port = None
        self.current_mac = None
        self.busy = False
        self.ui_q = queue.Queue()
        self.fw_info = None

        root.title("KalkMate Production Flasher")
        root.geometry("800x900")
        root.configure(bg=BG)

        # === Status panel ===
        status_frame = tk.Frame(root, bg=BG)
        status_frame.pack(fill=tk.X, padx=10, pady=8)
        tk.Label(status_frame, text="Status:", bg=BG, fg=FG,
                 font=("Arial", 11)).pack(side=tk.LEFT)
        self.status_label = tk.Label(
            status_frame, text="OCZEKUJE NA URZADZENIE...",
            bg=BG, fg="#D8FF3D", font=("Arial", 14, "bold"))
        self.status_label.pack(side=tk.LEFT, padx=10)

        # === Device info ===
        info_frame = self._frame(" Urzadzenie ")
        self.port_var = tk.StringVar(value="-")
        self.mac_var = tk.StringVar(value="-")
        self.chip_var = tk.StringVar(value="-")
        for label, var in [("Port:", self.port_var),
                           ("MAC / Device ID:", self.mac_var),
                           ("Chip:", self.chip_var)]:
            row = tk.Frame(info_frame, bg=BG)
            row.pack(fill=tk.X, padx=10, pady=1)
            tk.Label(row, text=label, bg=BG, fg="#888",
                     width=20, anchor="w").pack(side=tk.LEFT)
            tk.Label(row, textvariable=var, bg=BG, fg=FG,
                     font=("Consolas", 11, "bold")).pack(side=tk.LEFT)

        # === Mode selection ===
        mode_frame = self._frame(" Tryb flashowania ")
        self.mode_var = tk.StringVar(value="DEV")
        modes = [
            ("DEV — tylko firmware (prototyp; odmawia na zaszyfrowanym chipie)", "DEV"),
            ("PROD_DEV — firmware + Flash Encryption (Dev mode, mozna jeszcze rewrites)",
             "PROD_DEV"),
            ("PROD_REL — FE Release (PERMANENTNIE; tylko chip po PROD_DEV + QC!)",
             "PROD_REL"),
        ]
        for text, val in modes:
            tk.Radiobutton(
                mode_frame, text=text, value=val, variable=self.mode_var,
                bg=BG, fg=FG, selectcolor="#333",
                activebackground=BG, activeforeground="#D8FF3D",
                font=("Arial", 9)
            ).pack(anchor="w", padx=10, pady=1)
        self.wipe_rel_var = tk.BooleanVar(value=False)
        tk.Checkbutton(
            mode_frame, variable=self.wipe_rel_var,
            text="PROD_REL: wyczysc tez NVS + otadata (wymagane dla kodu AI; kasuje token, WiFi z QC, ustawienia)",
            bg=BG, fg=FG, selectcolor="#333", activebackground=BG,
            activeforeground="#D8FF3D", font=("Arial", 8)
        ).pack(anchor="w", padx=10, pady=(4, 1))
        tk.Label(
            mode_frame, justify=tk.LEFT, anchor="w", wraplength=760,
            bg=BG, fg="#FA0", font=("Arial", 8),
            text=("DEV i PROD_DEV ZAWSZE czyszcza NVS + otadata przed zapisem (token urzadzenia, "
                  "WiFi, kod AI, historia, powiazanie z kontem). Reflash urzadzenia ZWROCONEGO od "
                  "klienta: po flashu kliknij w panelu admina „Reset tokenu” dla tego MAC, "
                  "inaczej serwer odrzuci nowy token urzadzenia.")
        ).pack(fill=tk.X, padx=10, pady=(1, 4))

        # === Personalizacja klienta (kod AI z zamowienia, /admin/orders) ===
        prov_frame = self._frame(" Personalizacja klienta (opcjonalnie) ")
        row = tk.Frame(prov_frame, bg=BG)
        row.pack(fill=tk.X, padx=10, pady=4)
        tk.Label(row, text="Kod AI klienta (4 cyfry):", bg=BG,
                 fg=FG, width=22, anchor="w").pack(side=tk.LEFT)
        self.client_code_var = tk.StringVar(value="")
        tk.Entry(row, textvariable=self.client_code_var, width=8,
                 font=("Consolas", 12, "bold"), justify="center").pack(side=tk.LEFT)
        tk.Label(row, text="  puste = zostaw domyślny 1111; podany kod musi sie wgrac, inaczej FAIL",
                 bg=BG, fg="#888", font=("Arial", 8)).pack(side=tk.LEFT, padx=5)

        # === Firmware (ktore biny zostana wgrane) ===
        fw_frame = self._frame(" Firmware ")
        fw_row = tk.Frame(fw_frame, bg=BG)
        fw_row.pack(fill=tk.X, padx=10, pady=2)
        self.fw_dir_var = tk.StringVar(value=os.path.dirname(self.cfg["firmware_bin"]))
        tk.Label(fw_row, textvariable=self.fw_dir_var, bg=BG, fg=FG,
                 font=("Consolas", 9), anchor="w").pack(side=tk.LEFT, fill=tk.X, expand=True)
        tk.Button(fw_row, text="Zmien folder...", bg="#333", fg=FG,
                  font=("Arial", 9), command=self.choose_firmware_dir).pack(side=tk.RIGHT)
        self.fw_ver_var = tk.StringVar(value="-")
        self.fw_ver_label = tk.Label(fw_frame, textvariable=self.fw_ver_var, bg=BG, fg="#D8FF3D",
                                     font=("Consolas", 10, "bold"), anchor="w", justify=tk.LEFT,
                                     wraplength=760)
        self.fw_ver_label.pack(fill=tk.X, padx=10, pady=(0, 4))

        # === Klucz Flash Encryption ===
        key_frame = self._frame(" Klucz Flash Encryption (PROD_DEV / PROD_REL) ")
        key_row = tk.Frame(key_frame, bg=BG)
        key_row.pack(fill=tk.X, padx=10, pady=3)
        self.key_var = tk.StringVar(value="-")
        self.key_label = tk.Label(key_row, textvariable=self.key_var, bg=BG, fg=FG,
                                  font=("Consolas", 9), anchor="w", justify=tk.LEFT,
                                  wraplength=600)
        self.key_label.pack(side=tk.LEFT, fill=tk.X, expand=True)
        self.genkey_btn = tk.Button(key_row, text="Wygeneruj nowy klucz FE...", bg="#442",
                                    fg=FG, font=("Arial", 8), command=self.generate_key)
        self.genkey_btn.pack(side=tk.RIGHT)

        # === Action buttons ===
        btn_frame = tk.Frame(root, bg=BG)
        btn_frame.pack(fill=tk.X, padx=10, pady=8)
        self.flash_btn = tk.Button(
            btn_frame, text="FLASH",
            bg="#D8FF3D", fg="#0a0a0a", font=("Arial", 16, "bold"),
            command=self.start_flash, state=tk.DISABLED,
            padx=30, pady=10)
        self.flash_btn.pack(side=tk.LEFT, padx=5)
        tk.Button(btn_frame, text="Otworz log", bg="#333", fg=FG, font=("Arial", 9),
                  command=self.open_log).pack(side=tk.LEFT, padx=5)
        tk.Button(btn_frame, text="Wyczysc", bg="#333", fg=FG, font=("Arial", 9),
                  command=self.clear_console).pack(side=tk.LEFT, padx=5)

        # === Console output ===
        console_frame = tk.LabelFrame(root, text=" Log ", bg=BG, fg=FG,
                                      font=("Arial", 10, "bold"))
        console_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
        self.console = scrolledtext.ScrolledText(
            console_frame, bg="#0a0a0a", fg="#0F0", font=("Consolas", 9),
            wrap=tk.WORD)
        self.console.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # Start poll loop + kolejka UI
        self._refresh_fw_info()
        self._refresh_key_info()
        self._log_startup_info()
        self.poll_ports()
        self.drain_ui()

    def _frame(self, title):
        f = tk.LabelFrame(self.root, text=title, bg=BG, fg=FG, font=("Arial", 10, "bold"))
        f.pack(fill=tk.X, padx=10, pady=4)
        return f

    # -- Thread-safe UI helpers --------------------------------------------
    def ui(self, fn, *args, **kw):
        """Zleca wywolanie fn(*args) w glownym watku Tk."""
        self.ui_q.put((fn, args, kw))

    def log(self, msg, color="#0F0"):
        self.ui(self._console_append, msg, color)

    def flog(self, msg, level="info"):
        """Callback logu dla flasher_common (poziom -> kolor)."""
        self.log(msg, LEVEL_COLORS.get(level, "#0F0"))

    def set_status(self, text, color):
        self.ui(self.status_label.config, text=text, fg=color)

    def _console_append(self, msg, color):
        self.console.tag_config(color, foreground=color)
        self.console.insert(tk.END, msg + "\n", color)
        self.console.see(tk.END)

    def drain_ui(self):
        try:
            for _ in range(400):
                fn, args, kw = self.ui_q.get_nowait()
                try:
                    fn(*args, **kw)
                except tk.TclError:
                    pass
        except queue.Empty:
            pass
        self.root.after(50, self.drain_ui)

    def clear_console(self):
        self.console.delete("1.0", tk.END)

    def open_log(self):
        if os.path.exists(LOG_PATH):
            os.startfile(LOG_PATH)
        else:
            messagebox.showinfo("Log", "Brak wpisow yet — sflashuj pierwsze urzadzenie.")

    # -- Firmware / klucz / info startowe -------------------------------------
    def _refresh_fw_info(self):
        """(glowny watek) Wersja FW + SHA-256 obrazow -> etykieta w GUI."""
        try:
            info = fc.firmware_info(self.cfg, None if FROZEN else PROJECT_ROOT)
        except Exception as e:  # noqa: BLE001
            info = {"files": {}, "missing": [str(e)], "version": None,
                    "version_source": None, "in_image": None, "warnings": []}
        self.fw_info = info
        if info["missing"]:
            text, color = "BRAK PLIKOW: " + ", ".join(os.path.basename(m) for m in info["missing"]), "#F44"
        else:
            ver = info["version"] or "?"
            src = info["version_source"] or "zrodlo nieznane"
            conf = ", potwierdzona w obrazie" if info["in_image"] else ""
            fw_sha = info["files"]["firmware"]["sha256"]
            text = f"Wersja firmware: v{ver}  ({src}{conf})   firmware.bin SHA-256 {fc.short_hash(fw_sha, 12)}"
            color = "#D8FF3D"
            if info["warnings"]:
                text += "\n[!] " + "\n[!] ".join(info["warnings"])
                color = "#FA0"
        self.fw_ver_var.set(text)
        self.fw_ver_label.config(fg=color)
        return info

    def _refresh_key_info(self):
        chk = fc.check_fe_key(self.cfg["fe_key_file"])
        st = chk["status"]
        path = self.cfg["fe_key_file"]
        if st == "OK":
            text, color = f"OK: 64 B, SHA-256 {fc.short_hash(chk['sha256'])} (odcisk zgodny)\n{path}", "#0F0"
        elif st == "NO_FP":
            text, color = (f"64 B, SHA-256 {fc.short_hash(chk['sha256'])} — BRAK zapisanego odcisku "
                           f"(przy pierwszym PROD zapytam o przypiecie)\n{path}"), "#FA0"
        elif st == "NO_KEY":
            text, color = (f"BRAK klucza. DEV dziala; PROD wymaga produkcyjnego klucza 64 B z offline "
                           f"backupu.\n{path}"), "#FA0"
        else:
            text, color = chk["msg"], "#F44"
        self.key_var.set(text)
        self.key_label.config(fg=color)
        self.genkey_btn.config(state=tk.NORMAL if st == "NO_KEY" else tk.DISABLED)
        return chk

    def _log_startup_info(self):
        self.log(f"[i] Tryb: {'paczka (PyInstaller)' if FROZEN else 'dev (python)'}  dane: {DATA_DIR}")
        info = self.fw_info or {"files": {}, "missing": []}
        for name in ("bootloader", "partitions", "firmware"):
            f = info["files"].get(name)
            if f:
                self.log(f"[i] {name:<10} {f['size']:>8} B  "
                         f"{datetime.fromtimestamp(f['mtime']):%Y-%m-%d %H:%M}  "
                         f"sha256 {fc.short_hash(f['sha256'], 12)}  {f['path']}")
        for m in info["missing"]:
            self.log(f"[!] BRAK: {m}", "#F88")
        if info.get("version"):
            self.log(f"[i] Wersja firmware: v{info['version']} ({info['version_source']}"
                     f"{', potwierdzona w obrazie' if info.get('in_image') else ''})", "#D8FF3D")
        for w in info.get("warnings", []):
            self.log(f"[!] {w}", "#FA0")
        key = self.cfg["fe_key_file"]
        chk = fc.check_fe_key(key)
        if chk["status"] == "NO_KEY":
            self.log(f"[!] Brak klucza Flash Encryption: {key}", "#FA0")
            self.log("    DEV dziala bez klucza. PROD_DEV/PROD_REL wymagaja PRODUKCYJNEGO klucza 64 B: "
                     "skopiuj go z OFFLINE backupu (pendrive w sejfie) do tego folderu. NIE uzywaj "
                     "pliku z folderu 'tools/flasher/Klucze kalkmate' — to stary, skompromitowany "
                     "klucz 32 B, a nie backup. Flasher NIGDY nie generuje klucza sam.", "#FA0")
        elif chk["status"] in ("OK", "NO_FP"):
            self.log(f"[i] Klucz FE: {key}  (64 B, SHA-256 {fc.short_hash(chk['sha256'])}"
                     f"{', odcisk zgodny' if chk['status'] == 'OK' else ', odcisk jeszcze nieprzypiety'})")
        else:
            self.log(f"[!] {chk['msg']}", "#F44")

    def choose_firmware_dir(self):
        if self.busy:
            return
        d = filedialog.askdirectory(
            title="Folder z firmware (bootloader.bin, partitions.bin, firmware.bin)",
            initialdir=self.fw_dir_var.get() or DEFAULT_FW_DIR)
        if not d:
            return
        missing = [n for n in ("bootloader.bin", "partitions.bin", "firmware.bin")
                   if not os.path.exists(os.path.join(d, n))]
        if missing:
            messagebox.showerror("Firmware", f"W folderze brakuje: {', '.join(missing)}")
            return
        self.cfg["bootloader_bin"] = os.path.join(d, "bootloader.bin")
        self.cfg["partitions_bin"] = os.path.join(d, "partitions.bin")
        self.cfg["firmware_bin"] = os.path.join(d, "firmware.bin")
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(self.cfg, f, indent=2)
        self.fw_dir_var.set(d)
        self.log(f"[i] Firmware: {d}")
        self._refresh_fw_info()
        self._log_startup_info()

    def generate_key(self):
        """JAWNA akcja: nowy klucz FE = nowa seria. Nigdy nie nadpisuje."""
        if self.busy:
            return
        key_file = self.cfg["fe_key_file"]
        fp = fc.fingerprint_path(key_file)
        if os.path.exists(key_file):
            messagebox.showerror("Klucz FE", f"Klucz juz istnieje:\n{key_file}\n\nFlasher nigdy go nie nadpisuje.")
            return
        if os.path.exists(fp):
            messagebox.showerror(
                "Klucz FE",
                f"Istnieje odcisk poprzedniego klucza:\n{fp}\n\nKlucz zaginal? PRZYWROC go z offline "
                "backupu zamiast generowac nowy — urzadzen z poprzednim kluczem nowym nie sflashujesz.\n"
                "(Jesli swiadomie zaczynasz NOWA serie: usun recznie plik odcisku.)")
            return
        if not messagebox.askyesno(
                "Nowy klucz Flash Encryption = NOWA SERIA",
                "Generujesz NOWY klucz FE (64 B, XTS-AES-256).\n\n"
                "- Urzadzen zaszyfrowanych innym kluczem NIE sflashujesz tym kluczem.\n"
                "- Jesli masz produkcyjny klucz na backupie — PRZERWIJ i skopiuj go zamiast tego.\n"
                "- Utrata tego pliku = zadnej plytki tej serii nie sflashujesz juz po USB.\n\n"
                "Kontynuowac?", icon="warning"):
            return
        typed = simpledialog.askstring("Potwierdzenie", "Wpisz: NOWY KLUCZ", parent=self.root)
        if (typed or "").strip().upper() != "NOWY KLUCZ":
            self.log("[i] Generowanie klucza anulowane")
            return
        try:
            sha = fc.generate_fe_key(key_file)
        except Exception as e:  # noqa: BLE001
            messagebox.showerror("Klucz FE", f"Nie udalo sie: {e}")
            return
        self.log(f"[!] Wygenerowano NOWY klucz FE: {key_file} (SHA-256 {sha})", "#FA0")
        messagebox.showwarning(
            "ZROB BACKUP TERAZ",
            f"Zapisano: {key_file}\nSHA-256: {sha}\n\n"
            "NATYCHMIAST skopiuj ten plik na nosnik OFFLINE (pendrive w sejfie, 2 kopie) i "
            "sprawdz SHA-256 kopii. Nie trzymaj go w repo, w chmurze ani w folderze "
            "'Klucze kalkmate'.")
        self._refresh_key_info()

    # -- USB port detection -----------------------------------------------
    def poll_ports(self):
        if not self.busy:
            ports = find_esp32s3_ports()
            if ports:
                p = ports[0]
                if p["port"] != self.current_port:
                    self.current_port = p["port"]
                    self.current_mac = None
                    self.port_var.set(p["port"])
                    self.mac_var.set("-")
                    self.chip_var.set("-")
                    self.flash_btn.config(state=tk.DISABLED)
                    self.status_label.config(text="WYKRYTO URZADZENIE", fg="#D8FF3D")
                    self.log(f"[+] Wykryto ESP32-S3 na {p['port']} "
                             f"(VID:PID={p['vid']:04x}:{p['pid']:04x})")
                    # Probuj odczytac MAC w tle
                    threading.Thread(target=self.read_chip_info, args=(p["port"],),
                                     daemon=True).start()
            else:
                if self.current_port is not None:
                    self.log(f"[-] Odlaczono urzadzenie {self.current_port}")
                self.current_port = None
                self.current_mac = None
                self.port_var.set("-")
                self.mac_var.set("-")
                self.chip_var.set("-")
                self.status_label.config(text="OCZEKUJE NA URZADZENIE...", fg="#888")
                self.flash_btn.config(state=tk.DISABLED)
        self.root.after(500, self.poll_ports)

    def read_chip_info(self, port):
        """(watek roboczy) Odczytaj MAC + chip type przez esptool chip_id."""
        try:
            cmd = _tool_cmd(self.cfg["esptool"]) + [
                "--chip", self.cfg["chip"],
                "--port", port, "--baud", "115200",
                "--after", "no_reset",
                "chip_id"]
            rc, out, err = fc.run_capture(cmd, timeout=20, creationflags=_SUBPROCESS_FLAGS)
            output = out + err
            mac = fc.parse_mac(output)
            chip = self.cfg["chip"]
            for line in output.splitlines():
                if "Chip is" in line:
                    chip = line.split("Chip is")[1].strip()
            if mac:
                self.ui(self._set_device, port, mac, chip)
            else:
                self.log(f"[!] Nie udalo sie odczytac MAC:\n{fc.redact_sensitive(output[:300])}", "#F88")
        except fc.ToolTimeout:
            self.log("[!] Timeout odczytu chipa (czy w bootloader mode?)", "#F88")
        except FileNotFoundError:
            self.log(f"[!] BLAD: nie znaleziono '{self.cfg['esptool']}'. "
                     f"Edytuj {CONFIG_PATH}", "#F00")
        except Exception as e:  # noqa: BLE001
            self.log(f"[!] Blad odczytu: {e}", "#F88")

    def _set_device(self, port, mac, chip):
        """(glowny watek) wynik read_chip_info."""
        if port != self.current_port:
            return      # urzadzenie zmienilo sie w miedzyczasie
        self.current_mac = mac
        self.mac_var.set(mac)
        self.chip_var.set(chip)
        self.log(f"[i] MAC: {mac}  chip: {chip}")
        if not self.busy:
            self.flash_btn.config(state=tk.NORMAL)

    def _enable_flash_if_device(self):
        if self.current_port and self.current_mac and not self.busy:
            self.flash_btn.config(state=tk.NORMAL)

    # -- Flash workflow ---------------------------------------------------
    def _log_fail_row(self, mac, port, mode, error, key_sha=""):
        try:
            fc.append_production_log(LOG_PATH, {"mac": mac or "?", "port": port or "?", "mode": mode,
                                                "result": "FAIL", "error": error,
                                                "fe_key_sha256": key_sha or "", "tool": "gui"})
        except Exception as e:  # noqa: BLE001
            self.log(f"!!! NIE ZAPISANO wpisu w production_log.csv: {e}", "#F44")

    def _preflight_key(self, mode, port, mac):
        """(glowny watek) Klucz FE: 64 B + zgodny odcisk SHA-256. Zwraca SHA
        albo None (=przerwij). Brak odcisku -> jawne przypiecie (TOFU)."""
        key = self.cfg["fe_key_file"]
        chk = fc.check_fe_key(key)
        st = chk["status"]
        if st == "OK":
            return chk["sha256"]
        if st == "NO_FP":
            if not messagebox.askyesno(
                    "Odcisk klucza FE - pierwsze uzycie",
                    "Nie ma zapisanego odcisku klucza Flash Encryption.\n\n"
                    f"Klucz: {key}\nSHA-256: {chk['sha256']}\n\n"
                    "Przypiac ten odcisk jako PRODUKCYJNY? Od teraz kazdy inny plik klucza = FAIL.\n\n"
                    "Potwierdz TYLKO, jesli to na pewno klucz, ktorym zaszyfrowane sa dotychczasowe "
                    "urzadzenia (porownaj SHA-256 z offline backupem).", icon="warning"):
                return None
            try:
                fc.write_key_fingerprint(chk["fp_path"], chk["sha256"], os.path.basename(key))
            except FileExistsError:
                return self._preflight_key(mode, port, mac)
            self.log(f"[!] Przypieto odcisk klucza FE ({chk['fp_path']}): "
                     f"SHA-256 {chk['sha256']} — inny klucz zablokuje PROD", "#FA0")
            self._refresh_key_info()
            return chk["sha256"]
        messagebox.showerror("Klucz Flash Encryption", chk["msg"])
        self.log(f"!!! {chk['msg']}", "#F44")
        self._log_fail_row(mac, port, mode, f"[klucz] {st}", chk.get("sha256") or "")
        self.status_label.config(text="BLAD KLUCZA FE!", fg="#F00")
        self._refresh_key_info()
        return None

    def start_flash(self):
        """(glowny watek) walidacja + potwierdzenia, potem watek roboczy."""
        if self.busy:
            return
        mode = self.mode_var.get()
        port, mac = self.current_port, self.current_mac
        if not port or not mac:
            messagebox.showerror("Flash", "Brak urzadzenia albo nie odczytano MAC.")
            return
        code = self.client_code_var.get().strip()
        if code and not (len(code) == 4 and code.isdigit()):
            messagebox.showerror("Kod AI", "Kod AI musi miec dokladnie 4 cyfry (albo zostaw pole puste).")
            return
        wipe = mode in ("DEV", "PROD_DEV") or bool(self.wipe_rel_var.get())
        if mode == "PROD_REL" and code and not wipe:
            if not messagebox.askyesno(
                    "Kod AI w PROD_REL",
                    "Okno prowizjonowania kodu AI otwiera sie tylko przy pierwszym boocie na "
                    "swiezym NVS. W PROD_REL NVS nie jest domyslnie czyszczony, wiec kod by sie "
                    "nie wgral (= FAIL).\n\nWyczyscic NVS + otadata dla tej sztuki? (kasuje token "
                    "urzadzenia, WiFi z QC, ustawienia)"):
                return
            wipe = True

        fw = self._refresh_fw_info()
        if fw["missing"]:
            messagebox.showerror("Firmware", "Brak plikow:\n" + "\n".join(fw["missing"]))
            return
        if fw["warnings"] and not messagebox.askyesno(
                "Firmware - ostrzezenie", "\n\n".join(fw["warnings"]) + "\n\nKontynuowac mimo to?"):
            return

        key_sha = None
        if mode in fc.PROD_MODES:
            key_sha = self._preflight_key(mode, port, mac)
            if not key_sha:
                return

        # Confirmation przy nieodwracalnych operacjach
        if mode == "PROD_REL":
            if not messagebox.askyesno(
                    "UWAGA — Operacja NIEODWRACALNA",
                    f"PROD_REL: po flashu urzadzenie {mac} "
                    f"BEDZIE NA ZAWSZE zablokowane (eFuses).\n\n"
                    "Wymagane: chip po PROD_DEV + QC (sprawdze eFuse — inaczej FAIL).\n"
                    "Release palony dopiero PO poprawnym starcie firmware'u.\n\n"
                    "Czy NA PEWNO pakujesz to do wysylki klientowi?"):
                return
        elif mode == "PROD_DEV":
            if not messagebox.askyesno(
                    "Flash Encryption (Development)",
                    f"Wlaczam Flash Encryption na {mac}.\n\n"
                    "Mozesz jeszcze sflashowac kilka razy w trybie dev, "
                    "ale po PRZELACZENIU na Release jest game over.\n\nKontynuowac?"):
                return

        self.busy = True
        self.flash_btn.config(state=tk.DISABLED)
        tools = fc.EspTools(self.cfg, _tool_cmd, self.flog, _SUBPROCESS_FLAGS)
        job = fc.FlashJob(self.cfg, tools, mode, port, mac, self.flog, code=code or None,
                          wipe_nvs=wipe, key_sha=key_sha,
                          project_root=None if FROZEN else PROJECT_ROOT,
                          keys_dir=KEYS_DIR, tool_name="gui",
                          status=lambda text: self.set_status(text, "#FFA500"))
        threading.Thread(target=self._do_flash, args=(job,), daemon=True).start()

    def _do_flash(self, job):
        """(watek roboczy) — widgetow dotyka tylko przez self.ui()/set_status()."""
        r = None
        try:
            self.set_status("FLASHUJE...", "#FFA500")
            self.log(f"\n=== FLASH START: {job.mac} na {job.port}, tryb={job.mode}"
                     f"{', kod AI: TAK' if job.code else ''}"
                     f"{', NVS+otadata: czyszczone' if job.wipe_nvs else ''} ===", "#D8FF3D")
            r = fc.run_flash_job(job)
        except Exception as e:  # noqa: BLE001 — run_flash_job nie rzuca, ale na wszelki wypadek
            self.log(f"!!! BLAD: {e}", "#F00")
        finally:
            row = r.log_row() if r else {"mac": job.mac, "port": job.port, "mode": job.mode,
                                         "result": "FAIL", "error": "wyjatek flashera", "tool": "gui"}
            try:
                where = fc.append_production_log(LOG_PATH, row)
                if os.path.normcase(where) != os.path.normcase(LOG_PATH):
                    self.log(f"[!] production_log.csv zablokowany (Excel?) — wpis zapisany w {where}", "#FA0")
            except Exception as e:  # noqa: BLE001
                self.log(f"!!! NIE ZAPISANO wpisu w production_log.csv: {e}", "#F44")
            if r is not None and r.ok:
                ver = (r.fw or {}).get("version") or "?"
                self.log(f"=== FLASH SUKCES: {job.mac} (v{ver}, start: OK"
                         f"{', kod AI: OK' if job.code else ''}) ===", "#0F0")
                if r.nvs_erased:
                    self.log("[i] NVS wyczyszczony. Jesli to urzadzenie zwrocone od klienta / bylo juz "
                             f"sparowane: panel admina -> urzadzenie {job.mac} -> „Reset tokenu”.", "#FA0")
                self.log("")
                self.set_status("SUKCES — odlacz urzadzenie", "#0F0")
            else:
                err = r.error if r is not None else "wyjatek flashera"
                self.log(f"=== FLASH FAIL: {job.mac} — {err} ===\n", "#F44")
                self.set_status("BLAD! — patrz log, NIE WYSYLAJ", "#F00")
            self.busy = False
            if r is None or not r.ok:
                self.ui(self._enable_flash_if_device)


def main():
    root = tk.Tk()
    FlasherApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
