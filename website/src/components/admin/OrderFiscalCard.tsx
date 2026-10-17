"use client";

// Sekcja „Paragon fiskalny” w szczegółach zamówienia — podgląd pozycji,
// dodanie paragonu do kolejki agenta i stan zleceń (lib/fiscal.ts).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "@/components/admin/toast";
import { fmtDateTime, zl } from "@/components/admin/format";

interface Item { name: string; quantity?: string; unit_price: number; discount?: number; vat: string }
// K6: superseded = stare nieudane zlecenie zastapione nowym; cancel_requested =
// anulowanie zlecone, czeka na potwierdzenie agenta.
type JobState = "queued" | "sent" | "printed" | "failed" | "uncertain" | "cancelled" | "superseded" | "cancel_requested";
interface Job {
  id: string;
  state: JobState;
  receiptNumber: number | null;
  error: string | null;
  category?: string | null;
  // Nowsze API: `state` w starym zbiorze (zgodnosc), prawdziwy stan tutaj.
  stateDetail?: JobState;
  createdAt: number;
  printedAt: number | null;
}
interface Data {
  jobs: Job[];
  preview: { items: Item[]; payments: { name?: string; amount: number }[] } | null;
  previewError: string | null;
  configured: boolean;
}

const STATE: Record<JobState, string> = {
  queued: "w kolejce — czeka na agenta",
  sent: "u agenta (drukuje lub ponawia po błędzie)",
  printed: "wydrukowany",
  failed: "błąd",
  uncertain: "NIEPEWNY — sprawdź drukarkę",
  cancelled: "anulowany",
  superseded: "zastąpiony nowym zleceniem",
  cancel_requested: "anulowanie w toku — czeka na agenta",
};

// Zlecenia, ktore NIE blokuja wystawienia nowego paragonu.
const INACTIVE = new Set<JobState>(["cancelled", "failed", "superseded"]);

export default function OrderFiscalCard({ orderId, paid }: { orderId: string; paid: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [sending, setSending] = useState(false);
  const [loadErr, setLoadErr] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/fiscal`);
      if (res.ok) {
        const json: Data = await res.json();
        json.jobs = (json.jobs || []).map((j) => ({ ...j, state: j.stateDetail || j.state }));
        setData(json);
        setLoadErr("");
      } else {
        setLoadErr(`Nie udało się pobrać stanu paragonu (HTTP ${res.status})`);
      }
    } catch {
      /* sekcja pomocnicza — brak danych nie blokuje strony */
      setLoadErr("Błąd sieci przy pobieraniu stanu paragonu");
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const active = data?.jobs.find((j) => !INACTIVE.has(j.state));
  useEffect(() => {
    if (active?.state !== "queued" && active?.state !== "sent" && active?.state !== "cancel_requested") return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [active?.state, load]);

  const last = data?.jobs.find((j) => j.state !== "superseded") ?? data?.jobs[0];

  const enqueue = async () => {
    // Poprzednie zlecenie skonczylo sie bledem w trakcie druku — paragon mogl wyjsc.
    if (last?.state === "failed" && last.category === "protocol" &&
        !confirm("Paragon mógł zostać wydrukowany — sprawdź raport drukarki przed ponowieniem.\n\nPoprzednie zlecenie przerwał błąd protokołu w trakcie druku. Wystaw TYLKO jeśli paragonu NIE MA na drukarce / w kopii elektronicznej.\n\nWystawić ponownie?")) return;
    if (!confirm("Dodać paragon fiskalny do kolejki? Agent wydrukuje go na drukarce fiskalnej.")) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/fiscal`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) toast("Paragon dodany do kolejki");
      else if (res.status === 409) toast(j.error || "To zamówienie ma już aktywne zlecenie paragonu.", "error");
      else toast(j.error || `Nie udało się dodać paragonu (HTTP ${res.status})`, "error");
      await load();
    } catch {
      toast("Błąd sieci — odśwież stan paragonu, zanim spróbujesz ponownie.", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-[#313338] rounded-lg border border-[#3F4147] p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center flex-shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
            <path d="M9 8h6M9 12h6" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#E0E0E0]">Paragon fiskalny</h2>
          <p className="text-xs text-[#E0E0E0]/50">
            Drukuje aplikacja KalkMate Admin / agent na drukarce POSNET · <Link href="/admin/fiscal" className="text-[#3B82F6] hover:underline">Fiskalizacja</Link>
          </p>
        </div>
      </div>

      {loadErr && <p className="text-xs text-red-300">{loadErr}</p>}

      {last && (
        <div className={`rounded-lg px-4 py-3 text-sm border ${
          last.state === "printed" ? "bg-green-500/10 border-green-500/30 text-green-400"
            : last.state === "failed" || last.state === "uncertain" ? "bg-red-500/10 border-red-500/30 text-red-300"
            : "bg-[#2B2D31] border-[#3F4147] text-[#E0E0E0]/80"}`}>
          {last.state === "printed"
            ? `✓ Paragon nr ${last.receiptNumber}${last.printedAt ? ` · ${fmtDateTime(last.printedAt)}` : ""}`
            : `Ostatnie zlecenie: ${STATE[last.state] || last.state}`}
          {last.error && last.state !== "printed" && <span className="block text-xs mt-1 opacity-80">{last.error}</span>}
          {(last.state === "uncertain" || (last.state === "failed" && last.category === "protocol")) && (
            <span className="block text-xs mt-1">Paragon mógł zostać wydrukowany — sprawdź raport drukarki przed ponowieniem (<Link href="/admin/fiscal" className="underline">Fiskalizacja</Link>).</span>
          )}
        </div>
      )}

      {data?.preview && !active && (
        <div className="text-xs text-[#E0E0E0]/70 space-y-1">
          {data.preview.items.map((it, i) => (
            <div key={i} className="flex justify-between gap-3">
              <span>{it.name} <span className="text-[#E0E0E0]/40">({it.vat === "zw" ? "zw" : `${it.vat}%`})</span></span>
              <span className="font-mono">
                {it.quantity && it.quantity !== "1" ? `${it.quantity} × ` : ""}{zl(it.unit_price)}{it.discount ? ` − ${zl(it.discount)}` : ""}
              </span>
            </div>
          ))}
          <div className="flex justify-between gap-3 border-t border-[#3F4147] pt-1 text-[#E0E0E0]">
            <span>Płatność: {data.preview.payments.map((p) => p.name).join(", ")}</span>
            <span className="font-mono">{zl(data.preview.payments.reduce((s, p) => s + p.amount, 0))}</span>
          </div>
        </div>
      )}
      {data?.previewError && !active && <p className="text-xs text-yellow-300">{data.previewError}</p>}

      {!active && (
        <button
          onClick={enqueue}
          disabled={sending || !paid || !data?.preview}
          className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? "Dodaję…" : last?.state === "failed" ? "Wystaw paragon ponownie" : "Wystaw paragon"}
        </button>
      )}
    </div>
  );
}
