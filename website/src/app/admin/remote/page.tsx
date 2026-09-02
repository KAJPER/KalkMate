"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import AdminShell from "@/components/admin/AdminShell";

// Podglad ekranu + zdalne "wcisniecia" klawiszy kalkulatora KalkMate.
// Wymaga, zeby uzytkownik na urzadzeniu wszedl w Ustawienia -> Zdalna
// pomoc (jawna zgoda — patrz src/remote_session.h) — serwer nie moze sam
// zainicjowac polaczenia do kalkulatora (urzadzenie jest za NAT-em), wiec
// "Start sesji" tutaj tylko oznacza gotowosc po stronie serwera; realne
// polaczenie nawiazuje sam kalkulator, gdy zacznie odpytywac.

const SCREEN_W = 256;
const SCREEN_H = 64;
const SCALE = 3;

// Numeryczne wartosci enuma KalkKey z src/input.h — MUSZA sie zgadzac 1:1.
const KEYPAD: { label: string; key: number; navy?: boolean }[][] = [
  [{ label: "MC", key: 20 }, { label: "MR", key: 21 }, { label: "M-", key: 22 }, { label: "M+", key: 23 }, { label: "÷", key: 24 }],
  [{ label: "+/-", key: 15 }, { label: "7", key: 16 }, { label: "8", key: 17 }, { label: "9", key: 18 }, { label: "×", key: 19 }],
  [{ label: "▶", key: 10 }, { label: "4", key: 11 }, { label: "5", key: 12 }, { label: "6", key: 13 }, { label: "−", key: 14 }],
  [{ label: "C/CE", key: 6 }, { label: "1", key: 7 }, { label: "2", key: 8 }, { label: "3", key: 9 }, { label: "+", key: 5 }],
  [{ label: "0", key: 1 }, { label: "00", key: 2 }, { label: ".", key: 3 }, { label: "√", key: 25 }, { label: "%", key: 26 }],
  [{ label: "=", key: 4 }, { label: "MU", key: 27 }],
];

interface FrameResp {
  ok: boolean;
  active: boolean;
  frame: string | null;
  frameAt: string | null;
  waitingForDevice: boolean;
}

export default function RemoteControlPage() {
  const [deviceId, setDeviceId] = useState("");
  const [session, setSession] = useState<"idle" | "starting" | "live">("idle");
  const [status, setStatus] = useState<FrameResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deviceIdRef = useRef("");

  const drawFrame = useCallback((base64: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let bytes: Uint8Array;
    try {
      const bin = atob(base64);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch {
      return;
    }
    if (bytes.length < (SCREEN_W * SCREEN_H) / 8) return;

    // Format u8g2 "vertical_top_lsb" (tak jest zainicjowany SSD1322 256x64
    // full-buffer): bufor to 8 "stron" po 256 B, kazdy bajt = 1 kolumna,
    // 8 pikseli w pionie, bit0 = gorny piksel tej 8-pikselowej grupy.
    //   byte = buf[(y >> 3) * 256 + x], bit = y & 7
    const img = ctx.createImageData(SCREEN_W, SCREEN_H);
    for (let y = 0; y < SCREEN_H; y++) {
      const page = y >> 3;
      const bit = y & 7;
      for (let x = 0; x < SCREEN_W; x++) {
        const byte = bytes[page * SCREEN_W + x] ?? 0;
        const on = (byte >> bit) & 1;
        const v = on ? 255 : 0;
        const idx = (y * SCREEN_W + x) * 4;
        img.data[idx] = v;
        img.data[idx + 1] = v;
        img.data[idx + 2] = v;
        img.data[idx + 3] = 255;
      }
    }
    // Rysuj 1:1 na pomocniczym canvasie, potem skaluj bez rozmycia na widoczny
    const off = document.createElement("canvas");
    off.width = SCREEN_W;
    off.height = SCREEN_H;
    off.getContext("2d")!.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, SCREEN_W, SCREEN_H, 0, 0, SCREEN_W * SCALE, SCREEN_H * SCALE);
  }, []);

  const poll = useCallback(async () => {
    const id = deviceIdRef.current;
    if (!id) return;
    try {
      const res = await fetch(`/api/admin/remote/frame?deviceId=${encodeURIComponent(id)}`, { cache: "no-store" });
      const json: FrameResp = await res.json();
      setStatus(json);
      if (json.active) setSession("live");
      if (json.frame) drawFrame(json.frame);
    } catch {
      // chwilowy blad sieci — kolejny poll i tak nadejdzie za chwile
    }
  }, [drawFrame]);

  const start = async () => {
    const id = deviceId.trim().toUpperCase();
    if (!id) return;
    setError(null);
    deviceIdRef.current = id;
    setSession("starting");
    try {
      const res = await fetch("/api/admin/remote/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(poll, 500);
      poll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Blad startu sesji");
      setSession("idle");
    }
  };

  const stop = async () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    const id = deviceIdRef.current;
    setSession("idle");
    setStatus(null);
    if (id) {
      fetch("/api/admin/remote/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: id }),
      }).catch(() => {});
    }
  };

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      // best-effort — zatrzymaj sesje po zejsciu ze strony
      if (deviceIdRef.current) {
        navigator.sendBeacon?.(
          "/api/admin/remote/stop",
          new Blob([JSON.stringify({ deviceId: deviceIdRef.current })], { type: "application/json" })
        );
      }
    };
  }, []);

  const sendKey = async (key: number) => {
    const id = deviceIdRef.current;
    if (!id || session !== "live") return;
    setSending(key);
    try {
      await fetch("/api/admin/remote/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: id, key }),
      });
    } catch {
      // ignoruj — nastepny klik sprobuje ponownie
    } finally {
      setTimeout(() => setSending(null), 150);
    }
  };

  return (
    <AdminShell>
      <div className="p-6 max-w-5xl">
        <h1 className="text-2xl font-bold text-[#E0E0E0] mb-1">Zdalna pomoc</h1>
        <p className="text-sm text-[#E0E0E0]/60 mb-6">
          Podglad ekranu na zywo + zdalne sterowanie klawiaturą. Wymaga, żeby
          użytkownik na kalkulatorze wszedł w <b>Ustawienia → Zdalna pomoc</b> —
          wskaźnik w rogu ekranu urządzenia pokazuje, że sesja jest aktywna
          (nie da się jej ukryć przed użytkownikiem).
        </p>

        <div className="flex items-center gap-3 mb-6">
          <input
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            placeholder="Device ID, np. 44B176CCEDD8"
            disabled={session !== "idle"}
            className="px-3 py-2 bg-[#1A1A1A] border border-[#3F4147] rounded-lg text-sm font-mono text-[#E0E0E0] w-72 disabled:opacity-50"
          />
          {session === "idle" ? (
            <button
              onClick={start}
              disabled={!deviceId.trim()}
              className="px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-40 rounded-lg text-sm font-semibold text-white"
            >
              Start sesji
            </button>
          ) : (
            <button
              onClick={stop}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold text-white"
            >
              Zatrzymaj
            </button>
          )}
          {session === "starting" && <span className="text-xs text-[#E0E0E0]/50">Uruchamiam…</span>}
          {session === "live" && status?.waitingForDevice && (
            <span className="text-xs text-amber-400">Czekam aż urządzenie wejdzie w tryb Zdalna pomoc…</span>
          )}
          {session === "live" && !status?.waitingForDevice && (
            <span className="text-xs text-green-400">● Połączono {status?.frameAt ? `· ${new Date(status.frameAt).toLocaleTimeString("pl-PL")}` : ""}</span>
          )}
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>

        <div className="flex flex-wrap gap-8 items-start">
          <div className="bg-black border border-[#3F4147] rounded-lg p-3 inline-block">
            <canvas
              ref={canvasRef}
              width={SCREEN_W * SCALE}
              height={SCREEN_H * SCALE}
              className="block"
              style={{ imageRendering: "pixelated" }}
            />
            {session !== "live" || status?.waitingForDevice ? (
              <div className="mt-2 text-center text-[10px] text-[#E0E0E0]/30 font-mono">brak sygnału</div>
            ) : null}
          </div>

          <div className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-xl border border-[#3F4147] p-4">
            <p className="text-xs font-semibold text-[#E0E0E0]/60 uppercase mb-3">Wirtualna klawiatura</p>
            <div className="flex flex-col gap-2">
              {KEYPAD.map((row, i) => (
                <div key={i} className="flex gap-2">
                  {row.map((k) => (
                    <button
                      key={k.key}
                      onClick={() => sendKey(k.key)}
                      disabled={session !== "live"}
                      className={`w-12 h-10 rounded-md text-xs font-mono border transition-colors ${
                        sending === k.key
                          ? "bg-[#3B82F6] border-[#3B82F6] text-white"
                          : "bg-[#1A1A1A] border-[#3F4147] text-[#E0E0E0] hover:bg-[#2B2D31]"
                      } disabled:opacity-30 disabled:cursor-not-allowed`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
