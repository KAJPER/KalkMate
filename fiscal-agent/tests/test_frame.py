import pytest

from fiscal_agent.posnet.frame import FrameError, FrameReader, clean_text, crc16_xmodem, decode, encode


def test_crc_xmodem_check_vector():
    # Standardowy wektor CRC-16/XMODEM (poly 0x1021, init 0) — ten sam wariant co tablice w DBC-I-DEV-45.
    assert crc16_xmodem(b"123456789") == 0x31C3


def test_crc_matches_spec_table_algorithm():
    # Algorytm tablicowy przepisany ze specyfikacji (str. 7): tablice = CRC bajtu przesuniętego o 8 bitów.
    htab, ltab = [], []
    for i in range(256):
        c = _table_entry(i)
        htab.append(c >> 8)
        ltab.append(c & 0xFF)
    assert htab[:4] == [0x00, 0x10, 0x20, 0x30] and ltab[:4] == [0x00, 0x21, 0x42, 0x63]  # zgodne ze spec.
    hi = lo = 0
    for ch in b"Ala ma kota.":
        idx = hi ^ ch
        hi = lo ^ htab[idx]
        lo = ltab[idx]
    assert (hi << 8) | lo == crc16_xmodem(b"Ala ma kota.")


def _table_entry(i: int) -> int:
    crc = i << 8
    for _ in range(8):
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return crc


def test_encode_layout():
    frame = encode("trline", [("na", "Mleko"), ("vt", "2"), ("pr", "245")], token=12)
    body = b"trline\tnaMleko\tvt2\tpr245\t@0012\t"
    assert frame == b"\x02" + body + b"#" + f"{crc16_xmodem(body):04X}".encode() + b"\x03"


def test_decode_roundtrip_and_fields():
    resp = decode(encode("scnt", [("bn", "123"), ("nu", "ABC")], token=7))
    assert resp.ok and resp.command == "scnt" and resp.token == 7
    assert resp.fields == {"bn": "123", "nu": "ABC"}


def test_decode_command_error_and_frame_error():
    body = b"trend\t?2054\t"
    err = decode(b"\x02" + body + b"#" + f"{crc16_xmodem(body):04X}".encode() + b"\x03")
    assert err.error == 2054 and not err.frame_error
    body = b"ERR\t@8765\ter13\tcmrpt\t"  # przykład ze specyfikacji (rozkaz rpt)
    ferr = decode(b"\x02" + body + b"#" + f"{crc16_xmodem(body):04X}".encode() + b"\x03")
    assert ferr.frame_error and ferr.error == 13 and ferr.token == 8765 and ferr.fields["cm"] == "rpt"


def test_decode_rejects_bad_crc():
    frame = bytearray(encode("sid"))
    frame[-2] = ord("0") if frame[-2] != ord("0") else ord("1")
    with pytest.raises(FrameError):
        decode(bytes(frame))


def test_polish_characters_cp1250():
    frame = encode("trline", [("na", "Żółć")])
    assert "Żółć".encode("cp1250") in frame
    assert decode(frame).fields["na"] == "Żółć"


def test_encode_rejects_control_chars_and_clean_text():
    with pytest.raises(ValueError):
        encode("trline", [("na", "a\tb")])
    assert clean_text("Kalk\tMate #1\n v3", 40) == "Kalk Mate nr 1 v3"


def test_frame_reader_splits_and_joins():
    a, b = encode("sid"), encode("scnt")
    r = FrameReader()
    assert r.feed(b"garbage" + a[:3]) == []
    assert r.feed(a[3:] + b) == [a, b]
