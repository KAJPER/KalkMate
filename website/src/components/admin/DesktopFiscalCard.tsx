"use client";

// Ustawienia agenta fiskalnego wbudowanego w aplikację KalkMate Admin
// (tools/kalkmate-admin-desktop/fiscal). Widoczne tylko w aplikacji — w
// przeglądarce pokazuje krótką informację, skąd drukować.

import { useEffect, useState } from "react";
import { toast } from "@/components/admin/toast";
import type { DesktopFiscalConfig, DesktopFiscalInfo } from "@/components/admin/AdminShell";

type Bridge = "pending" | "none" | "ok";

export default function DesktopFiscalCard() {
  const [bridge, setBridge] = useState<Bridge>("pending");
  const [info, setInfo] = useState<DesktopFiscalInfo | null>(null);
  const [form, setForm] = useState({ host: "", port: "6666", encoding: "cp1250" as DesktopFiscalConfig["encoding"] });
  const [busy, setBusy] = useState(false);

  const apply = (i: DesktopFiscalInfo) => {
    setInfo(i);
    if (i.config) setForm({ host: i.config.host, port: String(i.config.port), encoding: i.config.encoding });
  };

  useEffect(() => {
    const api = window.kalkmateDesktop?.fiscal;
    if (!api) {
      Promise.resolve().then(() => setBridge("none"));
      return;
    }
    api.info(false).then((i) => { setBridge("ok"); apply(i); });
    const t = setInterval(() => api.info(false).then(setInfo), 15000);
    return () => clearInterval(t);
  }, []);

  const configure = async (patch: Partial<DesktopFiscalConfig>, okMsg: string) => {
    const api = window.kalkmateDesktop?.fiscal;
    if (!api) return;
    setBusy(true);
    try {
      const r = await api.configure(patch);
      if (r.ok) { apply(r); toast(okMsg); } else toast(r.error || "Nie udało się zapisać", "error");
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    const api = window.kalkmateDesktop?.fiscal;
    if (!api) return;
    setBusy(true);
    try { apply(await api.info(true)); } finally { setBusy(false); }
  };

  if (bridge === "pending") return null;

  if (bridge === "none") {
    return (
      <div className="mb-6 rounded-xl border border-[#3F4147] bg-[#2B2D31] p-4 text-sm text-[#E0E0E0]/70">
        Paragony może drukować <b className="text-[#E0E0E0]">aplikacja KalkMate Admin (1.3+)</b> na komputerze w tej samej sieci
        co drukarka fiskalna — ustawienia drukarki pojawią się tutaj, gdy otworzysz tę stronę w aplikacji. Alternatywa:
        osobny agent <code className="text-xs">fiscal-agent/</code> (np. Raspberry Pi).
      </div>
    );
  }

  const cfg = info?.config;
  const pr = info?.printer;
  const inputCls = "bg-[#1E1F22] border border-[#3F4147] rounded-lg px-3 py-2 text-sm text-[#E0E0E0] focus:outline-none focus:border-[#3B82F6]";

  return (
    <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-[#313338] to-[#2B2D31] p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#E0E0E0]">Ten komputer — aplikacja KalkMate Admin</h2>
          <p className="text-xs text-[#E0E0E0]/60">
            Aplikacja pobiera paragony z kolejki i drukuje je na drukarce POSNET w sieci lokalnej. Działa, dopóki aplikacja jest włączona.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-[#E0E0E0] cursor-pointer">
          <input
            type="checkbox"
            checked={!!cfg?.enabled}
            disabled={busy || (!cfg?.host && !cfg?.enabled)}
            onChange={(e) => configure({ enabled: e.target.checked }, e.target.checked ? "Drukowanie paragonów włączone" : "Drukowanie paragonów wyłączone")}
            className="w-4 h-4 accent-emerald-500"
          />
          Drukuj paragony z tego komputera
        </label>
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => { e.preventDefault(); configure({ host: form.host, port: Number(form.port), encoding: form.encoding }, "Zapisano ustawienia drukarki"); }}
      >
        <label className="text-xs text-[#E0E0E0]/60 flex flex-col gap-1">
          Adres IP drukarki
          <input className={inputCls} value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="192.168.1.50" />
        </label>
        <label className="text-xs text-[#E0E0E0]/60 flex flex-col gap-1">
          Port
          <input className={`${inputCls} w-24`} value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} inputMode="numeric" />
        </label>
        <label className="text-xs text-[#E0E0E0]/60 flex flex-col gap-1">
          Strona kodowa
          <select className={inputCls} value={form.encoding} onChange={(e) => setForm({ ...form, encoding: e.target.value as DesktopFiscalConfig["encoding"] })}>
            <option value="cp1250">Windows-1250</option>
            <option value="iso-8859-2">Latin 2</option>
          </select>
        </label>
        <button disabled={busy} className="px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm disabled:opacity-50">Zapisz</button>
        <button type="button" disabled={busy || !cfg?.host} onClick={refresh}
          className="px-4 py-2 rounded-lg bg-[#2B2D31] hover:bg-[#3F4147] text-[#E0E0E0] text-sm disabled:opacity-50">
          Sprawdź drukarkę
        </button>
      </form>

      {pr && (
        <p className={`text-sm ${pr.ready ? "text-green-400" : "text-orange-300"}`}>
          {pr.ready ? "● " : "○ "}{pr.description || (pr.online ? "Połączono" : "Brak połączenia z drukarką")}
          {pr.last_receipt != null && <span className="text-[#E0E0E0]/50"> · ostatni paragon nr {pr.last_receipt}</span>}
        </p>
      )}
      {info?.platformError && <p className="text-xs text-red-300">Serwer: {info.platformError}</p>}
      {info?.queue && Object.keys(info.queue).length > 0 && (
        <p className="text-xs text-[#E0E0E0]/50">
          Kolejka w aplikacji: {Object.entries(info.queue).map(([k, v]) => `${k}: ${v}`).join(" · ")}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-[#3F4147] pt-3">
        <span className={`text-xs ${cfg?.allowFiscal ? "text-red-300" : "text-[#E0E0E0]/60"}`}>
          Druk na drukarce w trybie FISKALNYM: <b>{cfg?.allowFiscal ? "włączony" : "zablokowany (bezpiecznik testowy)"}</b>
        </span>
        <button
          disabled={busy}
          onClick={() => {
            if (!cfg?.allowFiscal && !confirm(
              "Włączyć druk PRAWDZIWYCH paragonów fiskalnych?\n\nKażdy paragon trafi do pamięci fiskalnej i do CRK — nie da się go cofnąć. " +
              "Włącz dopiero po testach na drukarce niefiskalnej (patrz docs/fiskalizacja)."
            )) return;
            configure({ allowFiscal: !cfg?.allowFiscal }, cfg?.allowFiscal ? "Druk fiskalny zablokowany" : "Druk fiskalny włączony");
          }}
          className="px-3 py-1.5 rounded-lg text-xs bg-[#2B2D31] hover:bg-[#3F4147] text-[#E0E0E0]"
        >
          {cfg?.allowFiscal ? "Zablokuj" : "Odblokuj"}
        </button>
      </div>
    </div>
  );
}
