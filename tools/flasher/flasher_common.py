#!/usr/bin/env python3
# =====================================================================
#  flasher_common.py - wspolna logika flashera KalkMate
#  (GUI flasher.py + CLI flasher_cli.py). BEZ tkintera - CLI musi
#  dzialac, nawet gdy Tk jest zepsuty.
#
#  Audyt 2026-10-16 - co tu jest i dlaczego:
#    * Prowizjonowanie kodu AI: wszystko poza "KALKPROV:OK" = FAIL
#      calego flashowania (wczesniej tylko czerwony wpis w konsoli, a
#      urzadzenie szlo do klienta z kodem 1111). Jedna automatyczna
#      powtorka: reset -> czekaj na port -> ponow komende.
#    * Weryfikacja startu po flashu: po resecie czekamy na port USB i na
#      log firmware'u ("=== KalkMate startup", "[FW] v...", "[CFG]"...).
#      UWAGA: firmware jest budowany z ARDUINO_USB_MODE=1 (HWCDC =
#      USB-Serial-JTAG), wiec po starcie wystawia TEN SAM VID:PID
#      0x303A:0x1001 co bootloader ROM w trybie download. Sama obecnosc
#      portu NIE dowodzi startu firmware'u - dowodem jest dopiero jego log
#      (albo odpowiedz KALKPROV:). PID 0x4001 (TinyUSB) obslugujemy na
#      wypadek buildu z ARDUINO_USB_MODE=0.
#    * Klucz Flash Encryption: dokladnie 64 B (XTS-AES-256), odcisk
#      SHA-256 przypiety w <klucz>.sha256 (TOFU), NIGDY auto-generowany.
#    * Czyszczenie NVS + otadata przed zapisem (zakres liczony z
#      partitions.bin, ktory wgrywamy).
#    * Filtrowanie wyjscia narzedzi: espefuse 4.5.1 `burn_key` wypisuje
#      klucz w hex ("-> [xx xx ...]") - wycinamy to, zanim trafi do logu.
#    * Timeouty na wszystkich wywolaniach esptool/espefuse/espsecure.
#    * production_log.csv: wersja FW, SHA-256 obrazow, odcisk klucza,
#      wynik startu i prowizjonowania (bez samego kodu).
# =====================================================================

import csv
import hashlib
import json
import os
import re
import struct
import subprocess
import threading
import time
from datetime import datetime

import serial
from serial.tools import list_ports

# ----------------------------------------------------------------------
# Stale
# ----------------------------------------------------------------------
ESP_VID = 0x303A
PID_USB_SERIAL_JTAG = 0x1001   # ROM download mode ORAZ firmware KalkMate (HWCDC)
PID_TINYUSB_CDC = 0x4001       # firmware zbudowany z ARDUINO_USB_MODE=0 (TinyUSB)
ESP32S3_USB_IDS = [(ESP_VID, PID_USB_SERIAL_JTAG), (ESP_VID, PID_TINYUSB_CDC)]

FE_KEY_LEN = 64                # XTS-AES-256 (BLOCK_KEY0 + BLOCK_KEY1)
SUBPROCESS_TIMEOUT = 300       # s - write_flash ~1.5 MB @921600 to ~20-40 s
QUICK_TIMEOUT = 60             # s - read_mac / summary / erase_region
PORT_TIMEOUT = 15.0            # s - od resetu do pojawienia sie portu USB
BOOT_LOG_TIMEOUT = 15.0        # s - od otwarcia portu do pierwszej linii logu firmware'u
PROV_RESPONSE_TIMEOUT = 8.0    # s - od wyslania komendy do odpowiedzi KALKPROV:
BLIND_SEND_AFTER = 4.0         # s - wyslij komende "na slepo", jesli nie widac logu

MODES = ("DEV", "PROD_DEV", "PROD_REL")
PROD_MODES = ("PROD_DEV", "PROD_REL")

LOG_HEADER = [
    "timestamp", "mac", "port", "mode", "result", "error",
    "fw_version", "fw_version_in_image",
    "sha256_bootloader", "sha256_partitions", "sha256_firmware",
    "fe_key_sha256", "nvs_erased", "boot_check", "prov_result", "tool",
]
LEGACY_LOG_HEADER = LOG_HEADER[:6]


# ----------------------------------------------------------------------
# Hashowanie / klucz FE
# ----------------------------------------------------------------------
def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def short_hash(h, n=16):
    return (h[:n] + "...") if h else "-"


def fingerprint_path(key_path):
    """keys/flash_encryption_key.bin -> keys/flash_encryption_key.sha256"""
    return os.path.splitext(key_path)[0] + ".sha256"


def read_key_fingerprint(fp_path):
    """Zwraca zapisany odcisk (hex, lower) albo None gdy pliku brak.
    ValueError gdy plik istnieje, ale jest uszkodzony."""
    try:
        with open(fp_path, "r", encoding="ascii", errors="replace") as f:
            tok = f.read().split()
    except FileNotFoundError:
        return None
    if not tok or not re.fullmatch(r"[0-9a-fA-F]{64}", tok[0]):
        raise ValueError(f"Uszkodzony plik odcisku klucza: {fp_path}")
    return tok[0].lower()


def write_key_fingerprint(fp_path, sha, key_name):
    """Zapis odcisku - tryb 'x': nigdy nie nadpisuje istniejacego."""
    with open(fp_path, "x", encoding="ascii", newline="\n") as f:
        f.write(f"{sha}  {key_name}\n")


def check_fe_key(key_path):
    """Sprawdza plik klucza FE BEZ wypisywania jego tresci.

    status: OK | NO_KEY | BAD_LEN | NO_FP | MISMATCH | BAD_FP
    """
    fp_path = fingerprint_path(key_path)
    r = {"status": None, "sha256": None, "size": None,
         "fp_path": fp_path, "expected": None, "msg": ""}
    if not os.path.isfile(key_path):
        r["status"] = "NO_KEY"
        r["msg"] = (f"Brak klucza Flash Encryption: {key_path}\n"
                    "Flasher NIE generuje klucza automatycznie. Skopiuj produkcyjny "
                    "klucz 64 B z OFFLINE backupu do tego folderu (NIE plik z "
                    "'Klucze kalkmate' - to stary, skompromitowany klucz 32 B).")
        return r
    size = os.path.getsize(key_path)
    r["size"] = size
    if size != FE_KEY_LEN:
        hint = (" To wyglada na STARY, SKOMPROMITOWANY klucz 32 B (XTS-AES-128) - "
                "nie uzywaj go." if size == 32 else "")
        r["status"] = "BAD_LEN"
        r["msg"] = (f"Klucz FE ma {size} B, wymagane dokladnie {FE_KEY_LEN} B "
                    f"(XTS-AES-256): {key_path}.{hint}")
        return r
    sha = sha256_file(key_path)
    r["sha256"] = sha
    try:
        expected = read_key_fingerprint(fp_path)
    except ValueError as e:
        r["status"] = "BAD_FP"
        r["msg"] = str(e)
        return r
    r["expected"] = expected
    if expected is None:
        r["status"] = "NO_FP"
        r["msg"] = (f"Brak zapisanego odcisku klucza FE ({fp_path}). "
                    f"SHA-256 obecnego klucza: {sha}")
    elif expected != sha:
        r["status"] = "MISMATCH"
        r["msg"] = (f"KLUCZ FE NIE ZGADZA SIE z zapisanym odciskiem!\n"
                    f"  plik:    {key_path}\n"
                    f"  SHA-256: {short_hash(sha)}\n"
                    f"  odcisk:  {short_hash(expected)} ({fp_path})\n"
                    "Ktos podmienil/wygenerowal klucz. Przywroc produkcyjny klucz "
                    "z offline backupu. Flashowanie zablokowane.")
    else:
        r["status"] = "OK"
        r["msg"] = f"Klucz FE OK (64 B, SHA-256 {short_hash(sha)})"
    return r


def generate_fe_key(key_path):
    """JAWNA akcja (GUI, z potwierdzeniem). Nigdy nie nadpisuje istniejacego
    klucza ani odcisku. Zwraca SHA-256 nowego klucza."""
    fp_path = fingerprint_path(key_path)
    if os.path.exists(key_path):
        raise FileExistsError(f"Klucz juz istnieje: {key_path}")
    if os.path.exists(fp_path):
        raise FileExistsError(
            f"Istnieje odcisk poprzedniego klucza: {fp_path} - przywroc klucz z "
            "backupu zamiast generowac nowy (albo usun odcisk recznie, jesli "
            "swiadomie zaczynasz NOWA serie).")
    os.makedirs(os.path.dirname(key_path) or ".", exist_ok=True)
    with open(key_path, "xb") as f:
        f.write(os.urandom(FE_KEY_LEN))
        f.flush()
        os.fsync(f.fileno())
    sha = sha256_file(key_path)
    write_key_fingerprint(fp_path, sha, os.path.basename(key_path))
    return sha


# ----------------------------------------------------------------------
# Firmware: wersja + SHA-256 obrazow
# ----------------------------------------------------------------------
_FW_DEFINE_RE = re.compile(r'^\s*#define\s+FW_VERSION\s+"([^"]+)"', re.M)


def _is_under(path, root):
    p = os.path.normcase(os.path.abspath(path))
    r = os.path.normcase(os.path.abspath(root))
    return p == r or p.startswith(r.rstrip("\\/") + os.sep)


def firmware_info(cfg, project_root=None):
    """Zbiera info o obrazach do wgrania: istnienie, rozmiar, mtime, SHA-256
    i wersje FW (fw_version.txt obok binow - paczka exe; albo #define
    FW_VERSION z src/main.cpp, gdy biny sa z .pio/build tego repo)."""
    info = {"files": {}, "missing": [], "version": None, "version_source": None,
            "in_image": None, "warnings": []}
    for key, name in (("bootloader_bin", "bootloader"),
                      ("partitions_bin", "partitions"),
                      ("firmware_bin", "firmware")):
        p = cfg.get(key, "")
        if p and os.path.isfile(p):
            st = os.stat(p)
            info["files"][name] = {"path": p, "size": st.st_size,
                                   "mtime": st.st_mtime, "sha256": sha256_file(p)}
        else:
            info["missing"].append(p or name)
    fw_path = cfg.get("firmware_bin", "")
    fw_dir = os.path.dirname(fw_path)
    vf = os.path.join(fw_dir, "fw_version.txt")
    if os.path.isfile(vf):
        with open(vf, "r", encoding="utf-8", errors="replace") as f:
            v = f.readline().strip()
        if v:
            info["version"], info["version_source"] = v, "fw_version.txt"
    roots = [project_root] if project_root else []
    parts = os.path.normpath(os.path.abspath(fw_dir)).split(os.sep) if fw_dir else []
    if len(parts) >= 4 and parts[-3].lower() == ".pio" and parts[-2].lower() == "build":
        roots.append(os.sep.join(parts[:-3]) + (os.sep if len(parts) == 4 else ""))
    for root in roots:
        if info["version"] is not None:
            break
        main_cpp = os.path.join(root, "src", "main.cpp")
        if os.path.isfile(main_cpp) and _is_under(fw_dir, os.path.join(root, ".pio", "build")):
            with open(main_cpp, "r", encoding="utf-8", errors="replace") as f:
                m = _FW_DEFINE_RE.search(f.read())
            if m:
                info["version"], info["version_source"] = m.group(1), "src/main.cpp"
                if os.path.isfile(fw_path) and os.path.getmtime(main_cpp) > os.path.getmtime(fw_path):
                    info["warnings"].append(
                        "src/main.cpp jest nowszy niz firmware.bin - obraz moze byc "
                        "nieaktualny (przebuduj: pio run -e esp32s3)")
    if info["version"] and "firmware" in info["files"]:
        with open(fw_path, "rb") as f:
            data = f.read()
        info["in_image"] = (b"\x00" + info["version"].encode("ascii", "replace") + b"\x00") in data
        if not info["in_image"]:
            info["warnings"].append(
                f"Napisu wersji '{info['version']}' nie znaleziono w firmware.bin - "
                "obraz moze byc z innej wersji niz podaje " + info["version_source"])
    elif not info["version"]:
        info["warnings"].append("Nie udalo sie ustalic wersji firmware'u (brak fw_version.txt "
                                "obok binow i brak src/main.cpp dla tego folderu)")
    return info


# ----------------------------------------------------------------------
# Tablica partycji -> zakres NVS + otadata do wyczyszczenia
# ----------------------------------------------------------------------
def parse_partition_table(path):
    with open(path, "rb") as f:
        data = f.read()
    entries = []
    md5_ok = None
    for i in range(0, min(len(data), 0xC00), 32):
        e = data[i:i + 32]
        if len(e) < 32:
            break
        magic = e[:2]
        if magic == b"\xAA\x50":
            _, ptype, subtype, offset, size, label, flags = struct.unpack("<2sBBII16sI", e)
            entries.append({"label": label.split(b"\x00")[0].decode("ascii", "replace"),
                            "type": ptype, "subtype": subtype,
                            "offset": offset, "size": size, "flags": flags})
        elif magic == b"\xEB\xEB":
            md5_ok = hashlib.md5(data[:i]).digest() == e[16:32]
        elif magic == b"\xFF\xFF":
            break
        else:
            raise ValueError(f"partitions.bin: nieprawidlowy wpis @0x{i:x}")
    if not entries:
        raise ValueError("partitions.bin: pusta tablica partycji")
    if md5_ok is False:
        raise ValueError("partitions.bin: zla suma MD5 tablicy partycji")
    return entries


def nvs_otadata_ranges(partitions_bin, include_otadata=True):
    """Zakresy (offset, size) do erase_region: partycja 'nvs' (+ otadata).
    Dla default_16MB.csv i min_spiffs.csv (legacy) daje 0x9000 + 0x7000.
    otadata czyscimy, bo po OTA moze wskazywac app1 - wtedy swiezo wgrany
    app0 by nie wystartowal (bootloader odpalilby stary firmware z app1)."""
    parts = parse_partition_table(partitions_bin)
    nvs = [p for p in parts if p["type"] == 1 and p["subtype"] == 2 and p["label"] == "nvs"]
    if len(nvs) != 1:
        raise ValueError("partitions.bin: brak (jednoznacznej) partycji 'nvs'")
    ranges = [(nvs[0]["offset"], nvs[0]["size"])]
    if include_otadata:
        ota = [p for p in parts if p["type"] == 1 and p["subtype"] == 0]
        if len(ota) > 1:
            raise ValueError("partitions.bin: wiecej niz jedna partycja otadata")
        if ota:
            ranges.append((ota[0]["offset"], ota[0]["size"]))
    apps = [p for p in parts if p["type"] == 0]
    for off, size in ranges:
        if size == 0 or off % 0x1000 or size % 0x1000:
            raise ValueError(f"partitions.bin: zakres 0x{off:x}+0x{size:x} nie jest wyrownany do 4 KB")
        if off < 0x9000:
            raise ValueError(f"partitions.bin: zakres 0x{off:x} nachodzi na bootloader/tablice partycji")
        for a in apps:
            if off < a["offset"] + a["size"] and a["offset"] < off + size:
                raise ValueError(f"partitions.bin: zakres 0x{off:x} nachodzi na aplikacje '{a['label']}'")
    ranges.sort()
    merged = []
    for off, size in ranges:
        if merged and merged[-1][0] + merged[-1][1] == off:
            merged[-1] = (merged[-1][0], merged[-1][1] + size)
        else:
            merged.append((off, size))
    return merged


def fmt_ranges(ranges):
    return ", ".join(f"0x{o:X}..0x{o + s - 1:X} (0x{s:X} B)" for o, s in ranges)


# ----------------------------------------------------------------------
# Filtrowanie wrazliwych danych z wyjscia narzedzi
# ----------------------------------------------------------------------
# espefuse burn_key:        " - BLOCK_KEY0 -> [xx xx xx ...]"
# espefuse burn_block_data: "[04] BLOCK_KEY0 size=32 bytes, offset=00 - > [xx xx ...]."
# espefuse check_wr_data:   "\t(to write): 0x<64 hex>"  (repr BitArray)
# espefuse print_block (--debug): "01234567 89abcdef ..." (slowa 32-bit)
_ARROW_BRACKET_RE = re.compile(r"-\s*>\s*\[[^\]]*\]")
_HEX_BYTES_RUN_RE = re.compile(r"(?:\b[0-9A-Fa-f]{2}[ :]){15,}[0-9A-Fa-f]{2}\b")
_HEX_WORDS_RUN_RE = re.compile(r"(?:\b(?:0x)?[0-9A-Fa-f]{8}\b[ ,]*){4,}")
_HEX_CONTIG_RE = re.compile(r"\b(?:0x)?[0-9A-Fa-f]{32,}\b")


def redact_sensitive(line):
    line = _ARROW_BRACKET_RE.sub("-> [REDACTED]", line)
    line = _HEX_BYTES_RUN_RE.sub("[REDACTED]", line)
    line = _HEX_WORDS_RUN_RE.sub("[REDACTED] ", line)
    line = _HEX_CONTIG_RE.sub("[REDACTED]", line)
    return line


# ----------------------------------------------------------------------
# Uruchamianie narzedzi (timeout + filtr)
# ----------------------------------------------------------------------
class ToolTimeout(RuntimeError):
    pass


def _child_env():
    env = dict(os.environ)
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUNBUFFERED"] = "1"
    return env


def run_tool(cmd, log, prefix="", stdin_input=None, timeout=SUBPROCESS_TIMEOUT,
             creationflags=0):
    """Odpala narzedzie, streamuje (przefiltrowane) wyjscie do log(), ubija
    po `timeout` s. Zwraca przefiltrowane wyjscie; CalledProcessError przy
    exit != 0, ToolTimeout przy przekroczeniu czasu."""
    log(f"  $ {' '.join(cmd)}", "cmd")
    proc = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        stdin=subprocess.PIPE if stdin_input else subprocess.DEVNULL,
        text=True, encoding="utf-8", errors="replace", bufsize=1,
        creationflags=creationflags, env=_child_env())
    killed = []

    def _kill():
        killed.append(True)
        try:
            proc.kill()
        except Exception:
            pass

    timer = threading.Timer(timeout, _kill)
    timer.daemon = True
    timer.start()
    out = []
    try:
        if stdin_input:
            try:
                proc.stdin.write(stdin_input)
                proc.stdin.flush()
                proc.stdin.close()
            except OSError:
                pass
        for line in proc.stdout:
            line = redact_sensitive(line.rstrip("\r\n"))
            out.append(line)
            log(f"  [{prefix}] {line}", "tool")
        proc.wait()
    finally:
        timer.cancel()
    if killed:
        raise ToolTimeout(f"{prefix or 'narzedzie'}: przekroczono {timeout} s - proces ubity")
    if proc.returncode != 0:
        raise subprocess.CalledProcessError(proc.returncode, cmd, output="\n".join(out))
    return "\n".join(out)


def run_capture(cmd, timeout=QUICK_TIMEOUT, creationflags=0):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=timeout,
                           creationflags=creationflags, env=_child_env(),
                           stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise ToolTimeout(f"przekroczono {timeout} s: {' '.join(cmd[:4])} ...")
    return p.returncode, p.stdout or "", p.stderr or ""


_MAC_RE = re.compile(r"^\s*MAC:\s*([0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){5})", re.M)


def parse_mac(text):
    m = _MAC_RE.search(text or "")
    return m.group(1).replace(":", "").upper() if m else None


# ----------------------------------------------------------------------
# eFuse - stan Flash Encryption (dawne FlasherApp._efuse_burn_state)
# ----------------------------------------------------------------------
def _crypt_cnt_enabled(v):
    """SPI_BOOT_CRYPT_CNT: szyfrowanie wlaczone przy NIEPARZYSTEJ liczbie bitow."""
    if isinstance(v, bool):
        return v
    if isinstance(v, int):
        return bin(v).count("1") % 2 == 1
    s = str(v).strip().lower()
    if re.fullmatch(r"\d+", s):
        return bin(int(s)).count("1") % 2 == 1
    m = re.fullmatch(r"0b([01]+)", s)
    if m:
        return m.group(1).count("1") % 2 == 1
    if "disable" in s:
        return False
    if "enable" in s:
        return True
    raise ValueError(f"nieznana wartosc SPI_BOOT_CRYPT_CNT: {v!r}")


def _bool_value(v):
    if isinstance(v, bool):
        return v
    if isinstance(v, int):
        return v != 0
    s = str(v).strip().lower()
    if s in ("true", "1", "yes"):
        return True
    if s in ("false", "0", "no"):
        return False
    return None


def purpose_kind(v):
    if v is None:
        return None
    s = str(v).strip().upper()
    if s == "2" or "XTS_AES_256_KEY_1" in s:
        return "XTS_AES_256_KEY_1"
    if s == "3" or "XTS_AES_256_KEY_2" in s:
        return "XTS_AES_256_KEY_2"
    if s == "4" or "XTS_AES_128_KEY" in s:
        return "XTS_AES_128_KEY"
    if s in ("0", "USER", ""):
        return "USER"
    return "OTHER:" + s[:30]


def parse_efuse_summary(text):
    i = (text or "").find("{")
    if i < 0:
        raise ValueError("brak JSON w wyjsciu espefuse summary")
    data, _ = json.JSONDecoder().raw_decode(text[i:])

    def field(name):
        v = data.get(name)
        return v if isinstance(v, dict) else None

    bk0 = field("BLOCK_KEY0")
    cc = field("SPI_BOOT_CRYPT_CNT")
    if bk0 is None or cc is None:
        raise ValueError("w summary brak BLOCK_KEY0 / SPI_BOOT_CRYPT_CNT")
    dme = field("DIS_DOWNLOAD_MANUAL_ENCRYPT")
    kp0 = field("KEY_PURPOSE_0")
    kp1 = field("KEY_PURPOSE_1")
    return {
        "key_burned": bk0.get("readable", True) is False,
        "crypt_enabled": _crypt_cnt_enabled(cc.get("value")),
        "crypt_raw": str(cc.get("value")),
        "manual_encrypt_disabled": _bool_value(dme.get("value")) if dme else None,
        "key_purpose_0": purpose_kind(kp0.get("value")) if kp0 else None,
        "key_purpose_1": purpose_kind(kp1.get("value")) if kp1 else None,
    }


def check_key_purposes(state, log):
    """Gdy klucz jest juz spalony: musi to byc XTS-AES-256 (2 bloki).
    XTS_AES_128_KEY = seria ze starym kluczem 32 B -> nasz klucz 64 B by
    tego chipa zepsul."""
    k0, k1 = state.get("key_purpose_0"), state.get("key_purpose_1")
    if k0 is None:
        log("  [!] Nie udalo sie odczytac KEY_PURPOSE_0 - nie weryfikuje typu klucza na chipie", "warn")
        return
    if k0 != "XTS_AES_256_KEY_1":
        raise RuntimeError(
            f"Na chipie spalony klucz o przeznaczeniu {k0} (oczekiwane XTS_AES_256_KEY_1). "
            "To chip z innej serii / starym kluczem 32 B - obrazy zaszyfrowane kluczem "
            "64 B nie wystartuja. Przerywam.")
    if k1 is not None and k1 != "XTS_AES_256_KEY_2":
        raise RuntimeError(f"KEY_PURPOSE_1 = {k1} (oczekiwane XTS_AES_256_KEY_2) - przerywam.")


# ----------------------------------------------------------------------
# Porty USB
# ----------------------------------------------------------------------
def list_esp_ports(include_tinyusb=True):
    out = []
    for p in list_ports.comports():
        vid = p.vid if p.vid is not None else 0
        pid = p.pid if p.pid is not None else 0
        if (vid, pid) in ESP32S3_USB_IDS and (include_tinyusb or pid != PID_TINYUSB_CDC):
            out.append({"port": p.device, "vid": vid, "pid": pid,
                        "desc": p.description or "", "serial": p.serial_number or ""})
    return out


def mac_from_serial_number(sn):
    """USB-Serial-JTAG podaje MAC jako iSerial ("68:EE:8F:60:56:A4")."""
    s = re.sub(r"[^0-9A-Fa-f]", "", sn or "")
    return s.upper() if len(s) == 12 else None


def _pick_port(mac, port_hint):
    ports = list_esp_ports()
    if not ports:
        return None, False
    if mac:
        for p in ports:
            if mac_from_serial_number(p["serial"]) == mac:
                return p, False
    if port_hint:
        for p in ports:
            if p["port"] == port_hint:
                return p, False
    if len(ports) == 1:
        return ports[0], False
    return None, True


def _open_serial(port, pid):
    ser = serial.Serial()
    ser.port = port
    ser.baudrate = 115200
    ser.timeout = 0.1
    ser.write_timeout = 2
    if pid == PID_USB_SERIAL_JTAG:
        # USB-Serial-JTAG resetuje chip przy RTS=1/DTR=0 - otwieramy z obiema
        # liniami nieaktywnymi (stan "idle"), zeby samo otwarcie/zamkniecie
        # portu nie zrestartowalo urzadzenia w trakcie okna prowizjonowania.
        ser.dtr = False
        ser.rts = False
    ser.open()
    return ser


# ----------------------------------------------------------------------
# Weryfikacja startu firmware'u + prowizjonowanie kodu AI
# ----------------------------------------------------------------------
_FW_LINE_RE = re.compile(
    r"^(=== KalkMate|\[[A-Za-z][A-Za-z0-9_\-]*\]|KALKPROV:|\[\s*\d+\]\[[EWIDV]\])")
_EARLY_PREFIXES = ("=== KalkMate startup", "[FW]", "[BOOT]", "[EARLY]", "[NVS]",
                   "[PROV] Pierwszy boot")
_LATE_PREFIXES = ("[CFG]", "[WiFi-auto]", "[OTA]", "[TIME]")   # drukowane PO oknie PROV
_ROM_DOWNLOAD_RE = re.compile(r"waiting for download|\(DOWNLOAD", re.I)
_BOOT_ERROR_RE = re.compile(r"invalid header|Guru Meditation|abort\(\) was called|"
                            r"flash read err|Checksum failure|Backtrace:", re.I)
_FW_VER_RE = re.compile(r"^\[FW\] v(\S+)")
_DEEP_SLEEP_RE = re.compile(r"^\[EARLY\].*deep sleep", re.I)


LANG_CODES = ("pl", "en", "de")   # KALKPROV:SETLANG - jezyk interfejsu kalkulatora


def boot_check_and_provision(mac, code, log, port_hint=None,
                             port_timeout=PORT_TIMEOUT, boot_timeout=BOOT_LOG_TIMEOUT,
                             max_dev_lines=80, lang=None):
    """Wolac ZARAZ po resecie urzadzenia (esptool --after hard_reset).

    Czeka na port USB (max port_timeout), otwiera go i czyta log firmware'u.
    Firmware uznajemy za uruchomiony po pierwszej linii jego logu (albo
    odpowiedzi KALKPROV:). Gdy podano `code`, wysyla KALKPROV:SETCODE:<code>
    zaraz po pierwszej linii z poczatku setup() - firmware buforuje RX, a
    okno 3 s otwiera sie chwile pozniej.

    Zwraca dict: boot (bool), prov (OK | ERR:... | NO_RESPONSE | NO_WINDOW |
    NO_PORT | NO_BOOT | SKIPPED), detail, fw_seen (wersja z "[FW] v..."), port.
    Kod AI nigdy nie trafia do logu.
    """
    if lang is not None and lang not in LANG_CODES:
        raise ValueError(f"nieznany jezyk {lang!r} (dozwolone: {', '.join(LANG_CODES)})")
    want = bool(code or lang)   # cokolwiek do prowizjonowania (kod AI i/lub jezyk)
    res = {"boot": False, "prov": "SKIPPED" if not want else None,
           "lang": None, "detail": "", "fw_seen": None, "port": None}
    t_reset = time.time()
    time.sleep(0.7)   # stara instancja portu znika po resecie USB
    ser = None
    t_open = None
    t_boot = None
    sent_at = None
    saw_banner = saw_late = dl_hint = warned_multi = False
    err_hint = None
    lines_logged = 0
    buf = b""

    def _send():
        nonlocal sent_at
        try:
            # Jezyk PRZED kodem: firmware zamyka okno zaraz po udanym SETCODE.
            if lang:
                ser.write(b"KALKPROV:SETLANG:" + lang.encode("ascii") + b"\n")
            if code:
                ser.write(b"KALKPROV:SETCODE:" + code.encode("ascii") + b"\n")
            ser.flush()
            sent_at = time.time()
            what = " + ".join(x for x in (f"jezyka {lang}" if lang else "",
                                          "kodu AI" if code else "") if x)
            log(f"  [prov] wyslano komende ustawienia {what}", "cmd")
        except (serial.SerialException, OSError) as e:
            log(f"  [prov] blad wysylania: {e}", "warn")

    try:
        while True:
            now = time.time()
            if ser is None:
                limit = (t_reset + port_timeout) if t_open is None else (t_open + boot_timeout)
                if now > limit:
                    if t_open is None:
                        res["detail"] = (f"urzadzenie nie wystartowalo: brak portu USB "
                                         f"{port_timeout:.0f} s po resecie")
                    else:
                        res["detail"] = "port USB zniknal i nie wrocil"
                    break
                pinfo, multi = _pick_port(mac, port_hint)
                if multi and not warned_multi:
                    log("  [!] Podlaczonych kilka urzadzen ESP32 - odlacz pozostale", "warn")
                    warned_multi = True
                if pinfo:
                    try:
                        ser = _open_serial(pinfo["port"], pinfo["pid"])
                        res["port"] = pinfo["port"]
                        if t_open is None:
                            t_open = time.time()
                            log(f"  [start] port {pinfo['port']} "
                                f"({pinfo['vid']:04X}:{pinfo['pid']:04X}) po "
                                f"{t_open - t_reset:.1f} s, czekam na log firmware'u...", "info")
                    except (serial.SerialException, OSError, ValueError):
                        ser = None
                if ser is None:
                    time.sleep(0.1)
                    continue

            # --- warunki konca ---
            if not res["boot"] and now > t_open + boot_timeout:
                res["detail"] = (f"urzadzenie nie wystartowalo: brak logu firmware'u "
                                 f"{boot_timeout:.0f} s po otwarciu portu")
                break
            if not want and res["boot"]:
                # chwile dluzej, zeby zlapac "[FW] v..." (kontrola wersji)
                if t_boot is None:
                    t_boot = now
                if res["fw_seen"] or now > t_boot + 2.0:
                    break
            if want and res["prov"] is not None:
                break
            if want and sent_at is None and now > t_open + BLIND_SEND_AFTER:
                _send()
            if want and sent_at is not None and now > sent_at + PROV_RESPONSE_TIMEOUT:
                res["prov"] = "NO_WINDOW" if (saw_late and not saw_banner) else "NO_RESPONSE"
                break

            try:
                chunk = ser.read(512)
            except (serial.SerialException, OSError) as e:
                log(f"  [start] port zamkniety ({e}) - ponawiam otwarcie", "warn")
                try:
                    ser.close()
                except Exception:
                    pass
                ser = None
                buf = b""
                continue
            if not chunk:
                continue
            buf += chunk
            while b"\n" in buf:
                raw, buf = buf.split(b"\n", 1)
                line = raw.decode("utf-8", "replace").strip()
                if not line:
                    continue
                if lines_logged < max_dev_lines:
                    log(f"  [dev] {redact_sensitive(line)}", "dev")
                    lines_logged += 1
                if _BOOT_ERROR_RE.search(line):
                    err_hint = line[:120]
                if _ROM_DOWNLOAD_RE.search(line):
                    dl_hint = True
                if _FW_LINE_RE.match(line):
                    res["boot"] = True
                    m = _FW_VER_RE.match(line)
                    if m:
                        res["fw_seen"] = m.group(1)
                if line.startswith("[PROV] Pierwszy boot"):
                    saw_banner = True
                if line.startswith(_LATE_PREFIXES):
                    saw_late = True
                if _DEEP_SLEEP_RE.match(line):
                    res["detail"] = "urzadzenie przeszlo w deep sleep (niska bateria?)"
                if line.startswith("KALKPROV:LANG:"):
                    res["boot"] = True
                    res["lang"] = ("OK" if line == "KALKPROV:LANG:OK"
                                   else "LANG_" + line[len("KALKPROV:LANG:"):][:30])
                    if res["lang"] != "OK" and res["prov"] is None:
                        res["prov"] = res["lang"]          # blad jezyka = FAIL
                    elif not code and res["prov"] is None:
                        res["prov"] = "OK"                 # tylko jezyk - gotowe
                elif line.startswith("KALKPROV:"):
                    res["boot"] = True
                    if code and res["prov"] is None:
                        res["prov"] = "OK" if line == "KALKPROV:OK" else line[len("KALKPROV:"):][:40]
                        # kod OK, ale jezyk wyslany i niepotwierdzony = FAIL
                        if res["prov"] == "OK" and lang and res["lang"] != "OK":
                            res["prov"] = res["lang"] or "LANG_NO_RESPONSE"
                if want and res["prov"] is None and res["boot"]:
                    if saw_late and not saw_banner:
                        res["prov"] = "NO_WINDOW"     # okno minelo / flaga done juz w NVS
                    elif saw_late and saw_banner and sent_at is not None:
                        res["prov"] = "NO_RESPONSE"   # okno minelo bez odpowiedzi
                    elif sent_at is None and line.startswith(_EARLY_PREFIXES):
                        _send()
            if len(buf) > 4096:
                buf = buf[-1024:]
    finally:
        if ser is not None:
            try:
                ser.close()
            except Exception:
                pass

    if want and res["prov"] is None:
        res["prov"] = "NO_PORT" if t_open is None else ("NO_BOOT" if not res["boot"] else "NO_RESPONSE")
    if not res["boot"]:
        if err_hint:
            res["detail"] += f"; ostatni blad z urzadzenia: {err_hint}"
        if dl_hint:
            res["detail"] += "; chip stoi w trybie DOWNLOAD (ROM)"
    return res


# ----------------------------------------------------------------------
# Wrapper na esptool / espefuse / espsecure
# ----------------------------------------------------------------------
class EspTools:
    def __init__(self, cfg, tool_cmd, log, creationflags=0):
        self.cfg = cfg
        self.tool_cmd = tool_cmd
        self.log = log
        self.cf = creationflags

    def _esptool(self, port, args, baud=None, after="no_reset"):
        return self.tool_cmd(self.cfg["esptool"]) + [
            "--chip", self.cfg["chip"], "--port", port,
            "--baud", str(baud or self.cfg["baud"]),
            "--before", "default_reset", "--after", after] + list(args)

    def _espefuse(self, port, args):
        return self.tool_cmd(self.cfg["espefuse"]) + [
            "--chip", self.cfg["chip"], "--port", port] + list(args)

    def run(self, cmd, prefix, stdin_input=None, timeout=SUBPROCESS_TIMEOUT):
        return run_tool(cmd, self.log, prefix, stdin_input, timeout, self.cf)

    def read_mac(self, port, after="no_reset"):
        out = self.run(self._esptool(port, ["read_mac"], baud=115200, after=after),
                       "esptool", timeout=QUICK_TIMEOUT)
        return parse_mac(out)

    def reset(self, port, expected_mac=None):
        """Reset do normalnego bootu (RTS przez USB-Serial-JTAG). Przy okazji
        sprawdza, czy na porcie dalej jest TO SAMO urzadzenie."""
        mac = self.read_mac(port, after="hard_reset")
        if expected_mac and mac and mac != expected_mac:
            raise RuntimeError(f"Na porcie {port} jest inne urzadzenie (MAC {mac}, "
                               f"oczekiwany {expected_mac}) - przerywam")
        return mac

    def efuse_state(self, port):
        cmd = self._espefuse(port, ["summary", "--format", "json"])
        self.log(f"  $ {' '.join(cmd)}", "cmd")
        rc, out, err = run_capture(cmd, QUICK_TIMEOUT, self.cf)
        try:
            return parse_efuse_summary(out)
        except (ValueError, json.JSONDecodeError) as e:
            tail = redact_sensitive((out[-400:] + "\n" + err[-400:]).strip())
            raise RuntimeError(f"Nie udalo sie odczytac stanu eFuse (exit {rc}): {e}\n{tail}")

    def erase_ranges(self, port, ranges):
        for off, size in ranges:
            # esptool >= 4.6 odmawia erase na chipie z aktywnym Flash Encryption
            # bez --force. Kasujemy wylacznie NVS/otadata (0x9000..0xFFFF) —
            # bootloader (0x0), tablica partycji (0x8000) i aplikacja (0x10000)
            # nietkniete, wiec --force jest tu bezpieczne. Twarda blokada
            # zakresu, zeby --force nigdy nie objelo niczego innego.
            if off < 0x9000 or off + size > 0x10000:
                raise RuntimeError(f"erase_region poza NVS/otadata (0x{off:X}+0x{size:X}) - odmowa")
            self.run(self._esptool(port, ["erase_region", "--force", f"0x{off:X}", f"0x{size:X}"]),
                     "esptool-erase", timeout=QUICK_TIMEOUT)

    def write_flash(self, port, pairs, force=False):
        args = ["write_flash"] + (["--force"] if force else [])
        for addr, path in pairs:
            args += [addr, path]
        self.run(self._esptool(port, args, after="no_reset"), "esptool")

    def encrypt_images(self, key_file, out_dir):
        espsecure = self.cfg.get("espsecure") or self.cfg["espefuse"].replace("espefuse", "espsecure")
        os.makedirs(out_dir, exist_ok=True)
        outs = []
        for addr_key, bin_key in (("flash_addr_bootloader", "bootloader_bin"),
                                  ("flash_addr_partitions", "partitions_bin"),
                                  ("flash_addr_firmware", "firmware_bin")):
            src, addr = self.cfg[bin_key], self.cfg[addr_key]
            dst = os.path.join(out_dir, os.path.basename(src).replace(".bin", "_enc.bin"))
            if os.path.exists(dst):
                os.remove(dst)    # nigdy nie wgrywaj starego zaszyfrowanego obrazu
            cmd = self.tool_cmd(espsecure) + ["encrypt_flash_data", "--aes_xts",
                                              "--keyfile", key_file, "--address", addr,
                                              "--output", dst, src]
            self.run(cmd, "espsecure", timeout=QUICK_TIMEOUT)
            if not os.path.isfile(dst) or os.path.getsize(dst) < os.path.getsize(src):
                raise RuntimeError(f"espsecure nie utworzyl poprawnego {dst}")
            outs.append((addr, dst))
        return outs

    def burn_key(self, port, key_file):
        self.run(self._espefuse(port, ["burn_key", "BLOCK_KEY0", key_file, "XTS_AES_256_KEY"]),
                 "espefuse-key", stdin_input="BURN\n")

    def burn_efuse(self, port, name, value, prefix):
        self.run(self._espefuse(port, ["burn_efuse", name, value]), prefix, stdin_input="BURN\n")


# ----------------------------------------------------------------------
# Glowny przebieg flashowania (GUI i CLI)
# ----------------------------------------------------------------------
class FlashJob:
    def __init__(self, cfg, tools, mode, port, mac, log, code=None, wipe_nvs=True,
                 key_sha=None, project_root=None, keys_dir=None, tool_name="gui",
                 status=None, lang=None):
        if mode not in MODES:
            raise ValueError(f"nieznany tryb {mode}")
        self.cfg, self.tools, self.mode, self.port, self.mac = cfg, tools, mode, port, mac
        self.log, self.code, self.wipe_nvs, self.key_sha = log, code or None, wipe_nvs, key_sha
        self.project_root, self.keys_dir, self.tool_name = project_root, keys_dir, tool_name
        self.status = status or (lambda text: None)
        if lang is not None and lang not in LANG_CODES:
            raise ValueError(f"nieznany jezyk {lang!r}")
        self.lang = lang or None

    @property
    def wants_prov(self):
        """Kod AI i/lub jezyk do wgrania w oknie prowizjonowania."""
        return bool(self.code or self.lang)


class FlashResult:
    def __init__(self, job):
        self.job = job
        self.ok = False
        self.error = ""
        self.step = "start"
        self.fw = None
        self.key_sha = None
        self.nvs_erased = False
        self.boot_check = ""
        self.prov = []
        self.efuse = None

    def prov_summary(self):
        if not self.job.wants_prov:
            return "SKIPPED"
        return "|".join(self.prov) if self.prov else "NOT_RUN"

    def log_row(self):
        fw = self.fw or {"files": {}}
        files = fw.get("files", {})
        in_img = fw.get("in_image")
        return {
            "mac": self.job.mac or "?", "port": self.job.port or "?",
            "mode": self.job.mode, "result": "OK" if self.ok else "FAIL",
            "error": self.error,
            "fw_version": fw.get("version") or "",
            "fw_version_in_image": "" if in_img is None else ("yes" if in_img else "no"),
            "sha256_bootloader": files.get("bootloader", {}).get("sha256", ""),
            "sha256_partitions": files.get("partitions", {}).get("sha256", ""),
            "sha256_firmware": files.get("firmware", {}).get("sha256", ""),
            "fe_key_sha256": self.key_sha or "",
            "nvs_erased": "yes" if self.nvs_erased else "no",
            "boot_check": self.boot_check,
            "prov_result": self.prov_summary(),
            "tool": self.job.tool_name,
        }


def _boot_and_provision(job, r, attempt_label=""):
    log = job.log
    res = boot_check_and_provision(job.mac, job.code, log, port_hint=job.port, lang=job.lang)
    r.boot_check = "OK" if res["boot"] else "FAIL"
    if job.wants_prov:
        r.prov.append(res["prov"])
    fw_ver = (r.fw or {}).get("version")
    if res["fw_seen"]:
        log(f"  [start] firmware raportuje v{res['fw_seen']}", "info")
        if fw_ver and res["fw_seen"] != fw_ver:
            if (r.fw or {}).get("in_image"):
                raise RuntimeError(f"Urzadzenie raportuje v{res['fw_seen']}, a wgrywano "
                                   f"v{fw_ver} - wystartowal inny firmware niz wgrany (otadata "
                                   "wskazuje app1 po OTA? w PROD_REL zaznacz czyszczenie NVS+otadata)")
            log(f"  [!] Urzadzenie raportuje v{res['fw_seen']}, oczekiwano v{fw_ver}", "warn")
    if res["boot"]:
        log(f"  [start] OK - firmware wystartowal{attempt_label}", "ok")
    else:
        log(f"  [!] {res['detail']}{attempt_label}", "err")
    if job.wants_prov:
        lvl = "ok" if res["prov"] == "OK" else "err"
        log(f"  [prov] wynik: {res['prov']}{attempt_label}", lvl)
    elif res["detail"] and res["boot"]:
        log(f"  [!] {res['detail']}", "warn")
    return res


def _run_job(job, r):
    cfg, t, mode, port, log = job.cfg, job.tools, job.mode, job.port, job.log
    prod = mode in PROD_MODES

    # --- 1. pliki + wersja ---
    r.step = "pliki"
    fw = firmware_info(cfg, job.project_root)
    r.fw = fw
    if fw["missing"]:
        raise FileNotFoundError("Brak pliku: " + ", ".join(fw["missing"]))
    log(f"[i] Firmware v{fw['version'] or '?'} ({fw['version_source'] or 'zrodlo nieznane'}"
        f"{', potwierdzona w obrazie' if fw['in_image'] else ''}), "
        f"firmware.bin SHA-256 {short_hash(fw['files']['firmware']['sha256'])}", "info")
    for w in fw["warnings"]:
        log(f"  [!] {w}", "warn")

    # --- 2. stan eFuse ---
    r.step = "efuse"
    job.status("SPRAWDZAM eFuse...")
    log("[1/6] Stan Flash Encryption (eFuse)...", "step")
    st = t.efuse_state(port)
    r.efuse = st
    log(f"  klucz FE spalony: {'TAK' if st['key_burned'] else 'nie'} | szyfrowanie: "
        f"{'WLACZONE' if st['crypt_enabled'] else 'wylaczone'} ({st['crypt_raw']}) | "
        f"DIS_DOWNLOAD_MANUAL_ENCRYPT: {st['manual_encrypt_disabled']} | "
        f"KEY_PURPOSE_0: {st['key_purpose_0']}", "info")
    if mode == "DEV" and st["crypt_enabled"]:
        raise RuntimeError(
            "Chip ma WLACZONE Flash Encryption - DEV wgralby niezaszyfrowany obraz i "
            "urzadzenie by nie wystartowalo. Odmawiam. Uzyj PROD_DEV (ten sam klucz FE).")
    if mode == "PROD_REL" and not (st["key_burned"] and st["crypt_enabled"]):
        raise RuntimeError(
            "PROD_REL wymaga chipa po PROD_DEV (klucz FE spalony w BLOCK_KEY0 i "
            f"szyfrowanie wlaczone). Ten chip: klucz={'TAK' if st['key_burned'] else 'NIE'}, "
            f"szyfrowanie={'TAK' if st['crypt_enabled'] else 'NIE'}. Najpierw PROD_DEV + QC.")
    if mode == "PROD_DEV" and st["crypt_enabled"] and not st["key_burned"]:
        raise RuntimeError("Niespojny stan eFuse: szyfrowanie wlaczone, a BLOCK_KEY0 nie jest "
                           "read-protected - nie dotykam tego chipa.")
    if prod and st["key_burned"]:
        check_key_purposes(st, log)

    # --- 3. klucz + szyfrowanie obrazow ---
    if prod:
        r.step = "klucz"
        chk = check_fe_key(cfg["fe_key_file"])
        if chk["status"] != "OK":
            raise RuntimeError(chk["msg"])
        if job.key_sha and chk["sha256"] != job.key_sha:
            raise RuntimeError("Plik klucza FE zmienil sie od momentu potwierdzenia - przerywam")
        r.key_sha = chk["sha256"]
        log(f"[2/6] Szyfrowanie obrazow kluczem FE (SHA-256 {short_hash(r.key_sha)})...", "step")
        r.step = "szyfrowanie"
        enc_dir = os.path.join(job.keys_dir or os.path.dirname(cfg["fe_key_file"]), "encrypted")
        pairs = t.encrypt_images(cfg["fe_key_file"], enc_dir)
    else:
        log("[2/6] DEV - obrazy bez szyfrowania", "step")
        pairs = [(cfg["flash_addr_bootloader"], cfg["bootloader_bin"]),
                 (cfg["flash_addr_partitions"], cfg["partitions_bin"]),
                 (cfg["flash_addr_firmware"], cfg["firmware_bin"])]

    # --- 4. NVS + otadata ---
    r.step = "nvs"
    if job.wipe_nvs:
        ranges = nvs_otadata_ranges(cfg["partitions_bin"])
        log(f"[3/6] Czyszcze NVS + otadata: {fmt_ranges(ranges)} (token urzadzenia, WiFi, "
            "kod AI, historia, flaga prowizjonowania)", "step")
        t.erase_ranges(port, ranges)
        r.nvs_erased = True
    else:
        log("[3/6] NVS/otadata NIE czyszczone (PROD_REL bez zaznaczonej opcji)", "step")

    # --- 5. zapis ---
    r.step = "zapis"
    job.status("ZAPIS FLASH...")
    log("[4/6] Zapis bootloader + partitions + firmware...", "step")
    t.write_flash(port, pairs, force=prod)

    # --- 5b. PROD_DEV: eFuse (jak dotad: klucz + SPI_BOOT_CRYPT_CNT=1) ---
    if mode == "PROD_DEV":
        r.step = "efuse-burn"
        if st["key_burned"]:
            log("  BLOCK_KEY0 juz spalony - pomijam burn_key (typ klucza sprawdzony, "
                "zgodnosci tresci nie da sie zweryfikowac - weryfikuje ja start firmware'u)", "warn")
        else:
            t.burn_key(port, cfg["fe_key_file"])
        if st["crypt_enabled"]:
            log("  SPI_BOOT_CRYPT_CNT juz wlaczony - pomijam", "info")
        else:
            t.burn_efuse(port, "SPI_BOOT_CRYPT_CNT", "1", "espefuse-en")

    # --- 6. reset + weryfikacja startu + kod AI (z jedna powtorka) ---
    r.step = "start"
    job.status("START / PROWIZJONOWANIE..." if job.wants_prov else "WERYFIKACJA STARTU...")
    log("[5/6] Reset i weryfikacja startu firmware'u"
        + ((" + prowizjonowanie" + (" kodu AI" if job.code else "") + (f" jezyka {job.lang}" if job.lang else "")) if job.wants_prov else "") + "...", "step")
    t.reset(port, job.mac)
    res = _boot_and_provision(job, r)
    ok = res["boot"] and (not job.wants_prov or res["prov"] == "OK")
    if not ok:
        log("  [!] Automatyczna powtorka: reset urzadzenia i ponowna proba...", "warn")
        erase_port = res.get("port") or port
        if job.wants_prov and res["prov"] in ("NO_RESPONSE", "NO_WINDOW") and job.wipe_nvs:
            # Okno prowizjonowania moglo sie zamknac bez komendy (flaga done
            # zapisana) - czyscimy sam NVS, zeby otworzylo sie ponownie.
            nvs_only = nvs_otadata_ranges(cfg["partitions_bin"], include_otadata=False)
            log(f"  czyszcze ponownie NVS {fmt_ranges(nvs_only)}, zeby otworzyc okno prowizjonowania", "info")
            t.erase_ranges(erase_port, nvs_only)
        t.reset(erase_port, job.mac)
        res = _boot_and_provision(job, r, " (powtorka)")
        ok = res["boot"] and (not job.wants_prov or res["prov"] == "OK")
    if not res["boot"]:
        raise RuntimeError(res["detail"] or "urzadzenie nie wystartowalo")
    if job.wants_prov and res["prov"] != "OK":
        raise RuntimeError(f"Prowizjonowanie (kod AI / jezyk) nieudane ({r.prov_summary()}) - "
                           "urzadzenie zostaloby z kodem 1111. NIE WYSYLAJ, powtorz flash.")

    # --- 7. PROD_REL: zamkniecie (po udanym starcie - zly klucz nie przejdzie) ---
    if mode == "PROD_REL":
        r.step = "release"
        job.status("RELEASE (eFuse)...")
        log("[6/6] Przelaczenie FE na RELEASE (DIS_DOWNLOAD_MANUAL_ENCRYPT, PERMANENT)...", "step")
        if st["manual_encrypt_disabled"] is True:
            log("  DIS_DOWNLOAD_MANUAL_ENCRYPT juz spalony - pomijam", "info")
        else:
            t.burn_efuse(port, "DIS_DOWNLOAD_MANUAL_ENCRYPT", "1", "espefuse-release")
        r.step = "start-po-release"
        t.reset(port, job.mac)
        res2 = boot_check_and_provision(job.mac, None, log, port_hint=port)
        if not res2["boot"]:
            r.boot_check = "FAIL"
            raise RuntimeError("Po RELEASE: " + (res2["detail"] or "urzadzenie nie wystartowalo"))
        log("  [start] OK po RELEASE", "ok")
    else:
        log("[6/6] (RELEASE tylko w PROD_REL)", "step")


def _tool_name(cmd):
    for a in cmd or []:
        s = os.path.basename(str(a)).lower()
        for n in ("espsecure", "espefuse", "esptool"):
            if n in s:
                return n
    return os.path.basename(str(cmd[0])) if cmd else "?"


def run_flash_job(job):
    """Pelny flash; NIGDY nie rzuca - zwraca FlashResult (ok/error)."""
    r = FlashResult(job)
    try:
        _run_job(job, r)
        r.ok = True
    except subprocess.CalledProcessError as e:
        r.error = f"[{r.step}] {_tool_name(e.cmd)} exit {e.returncode}"
    except Exception as e:   # noqa: BLE001 - kazdy blad = FAIL z opisem
        r.error = f"[{r.step}] {e}"
    if not r.ok:
        job.log(f"!!! BLAD: {r.error}", "err")
    return r


# ----------------------------------------------------------------------
# production_log.csv
# ----------------------------------------------------------------------
def _csv_safe(v):
    s = str(v if v is not None else "").replace("\r", " ").replace("\n", " | ")
    if s[:1] in ("=", "+", "@"):
        s = "'" + s     # bez formul w Excelu
    return s


def _ensure_log_header(path):
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        with open(path, "w", newline="", encoding="utf-8") as f:
            csv.writer(f).writerow(LOG_HEADER)
        return
    with open(path, "r", newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    if rows and rows[0] == LOG_HEADER:
        return
    if rows and rows[0] == LEGACY_LOG_HEADER:
        # Migracja starego logu (6 kolumn): stare wiersze bez zmian, nowe kolumny puste.
        tmp = path + ".tmp"
        with open(tmp, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(LOG_HEADER)
            for row in rows[1:]:
                w.writerow(row + [""] * max(0, len(LOG_HEADER) - len(row)))
        os.replace(tmp, path)
        return
    # Nieznany format - nie ruszamy, odkladamy obok i zaczynamy nowy.
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    os.replace(path, os.path.splitext(path)[0] + f"_old_{stamp}.csv")
    with open(path, "w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerow(LOG_HEADER)


def append_production_log(path, row):
    """Dopisuje wiersz. Gdy plik jest zablokowany (np. otwarty w Excelu),
    pisze do <log>_PENDING.csv i zwraca te sciezke."""
    values = dict(row)
    values.setdefault("timestamp", datetime.now().isoformat(timespec="seconds"))
    line = [_csv_safe(values.get(k, "")) for k in LOG_HEADER]
    for target in (path, os.path.splitext(path)[0] + "_PENDING.csv"):
        try:
            _ensure_log_header(target)
            with open(target, "a", newline="", encoding="utf-8") as f:
                csv.writer(f).writerow(line)
            return target
        except PermissionError:
            continue
    raise PermissionError(f"Nie da sie zapisac logu produkcyjnego ({path}) - zamknij Excela")
