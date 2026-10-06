"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import DesktopFiscalCard from "@/components/admin/DesktopFiscalCard";
import { toast } from "@/components/admin/toast";

interface PrinterInfo {
  online?: boolean;
  ready?: boolean;
  fiscal?: boolean | null;
  description?: string;
  last_receipt?: number | null;
  error?: string | null;
}

interface Job {
  id: string;
  orderId: string | null;
  orderNumber: string | null;
  state: "queued" | "sent" | "printed" | "failed" | "uncertain" | "cancelled";
  receiptNumber: number | null;
  error: string | null;
  category: string | null;
  attempts: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  payload: { items: { name: string; unit_price: number; discount?: number }[]; payments: { amount: number }[] };
}

interface Data {
  agent: { lastSeenAt: number | null; online: boolean; version: string | null; printer: PrinterInfo | null };
  jobs: Job[];
  configured: boolean;
  autoEnqueue: boolean;
}

const STATE_LABEL: Record<Job["state"], { text: string; cls: string }> = {
  queued: { text: "W kolejce", cls: "bg-blue-500/15 text-blue-300" },
  sent: { text: "U agenta", cls: "bg-yellow-500/15 text-yellow-300" },
  printed: { text: "Wydrukowany", cls: "bg-green-500/15 text-green-400" },
  failed: { text: "Błąd", cls: "bg-red-500/15 text-red-400" },
  uncertain: { text: "Niepewny", cls: "bg-orange-500/20 text-orange-300" },
  cancelled: { text: "Anulowany", cls: "bg-[#E0E0E0]/10 text-[#E0E0E0]/50" },
};

const zl = (gr: number) => (gr / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2 }) + " zł";

export default function FiscalPage() {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/fiscal");
      if (res.ok) setData(await res.json());
      else toast("Nie udało się pobrać danych fiskalizacji", "error");
    } catch {
      toast("Błąd sieci", "error");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const act = async (job: Job, action: "retry" | "cancel" | "mark_printed") => {
    let receiptNumber: number | undefined;
    if (action === "mark_printed") {
      const v = window.prompt("Numer paragonu wydrukowanego przez drukarkę (sprawdź na wydruku / w kopii elektronicznej):");
      if (!v) return;
      receiptNumber = parseInt(v, 10);
    }
    if (action === "retry" && job.state === "uncertain" &&
        !confirm("Stan NIEPEWNY: paragon mógł się już wydrukować.\n\nPonów TYLKO jeśli sprawdziłeś drukarkę i kopię elektroniczną i paragonu NIE MA. Inaczej klient dostanie dwa paragony.\n\nPonowić?")) return;
    if (action === "cancel" && !confirm("Anulować zlecenie paragonu?")) return;
    setBusy(job.id);
    try {
      const res = await fetch(`/api/admin/fiscal/jobs/${job.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, receiptNumber }),
      });
      const j = await res.json();
      if (j.ok) toast(action === "retry" ? "Dodano nowe zlecenie" : "Zapisano");
      else toast(j.error || "Błąd", "error");
      await load();
    } finally {
      setBusy(null);
    }
  };

  const agent = data?.agent;
  const printer = agent?.printer;
  const attention = data?.jobs.filter((j) => j.state === "failed" || j.state === "uncertain").length ?? 0;

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#E0E0E0] mb-1">Fiskalizacja</h1>
        <p className="text-sm text-[#E0E0E0]/60">
          Paragony drukuje aplikacja KalkMate Admin (albo osobny agent) na komputerze w sieci drukarki fiskalnej POSNET. Instrukcja: <code className="text-xs">docs/fiskalizacja/README.md</code>
        </p>
      </div>

      <DesktopFiscalCard />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-[#3F4147] bg-[#2B2D31] p-5">
          <p className="text-xs text-[#E0E0E0]/60 mb-1">Agent</p>
          <p className={`text-lg font-bold ${agent?.online ? "text-green-400" : "text-red-400"}`}>
            {agent?.online ? "● Połączony" : "● Brak połączenia"}
          </p>
          <p className="text-xs text-[#E0E0E0]/50 mt-1">
            {agent?.lastSeenAt ? `Ostatnio: ${new Date(agent.lastSeenAt).toLocaleString("pl-PL")}` : "Agent jeszcze się nie zgłosił"}
            {agent?.version ? ` · v${agent.version}` : ""}
          </p>
        </div>
        <div className="rounded-xl border border-[#3F4147] bg-[#2B2D31] p-5">
          <p className="text-xs text-[#E0E0E0]/60 mb-1">Drukarka</p>
          <p className={`text-lg font-bold ${printer?.ready ? "text-green-400" : "text-orange-300"}`}>
            {printer ? (printer.ready ? "Gotowa" : printer.online ? "Wymaga uwagi" : "Niedostępna") : "—"}
          </p>
          <p className="text-xs text-[#E0E0E0]/50 mt-1 break-words">{printer?.description || printer?.error || ""}</p>
          {printer?.fiscal === false && (
            <p className="text-xs text-blue-300 mt-1">Tryb niefiskalny — wydruki testowe, bez mocy paragonu.</p>
          )}
        </div>
        <div className="rounded-xl border border-[#3F4147] bg-[#2B2D31] p-5">
          <p className="text-xs text-[#E0E0E0]/60 mb-1">Do wyjaśnienia</p>
          <p className={`text-lg font-bold ${attention ? "text-red-400" : "text-[#E0E0E0]"}`}>{attention}</p>
          <p className="text-xs text-[#E0E0E0]/50 mt-1">
            Automatyczne paragony po opłaceniu: {data?.autoEnqueue ? "włączone" : "wyłączone (FISCAL_AUTO_ENQUEUE)"}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#3F4147] bg-gradient-to-br from-[#313338] to-[#2B2D31] overflow-hidden">
        <div className="p-4 border-b border-[#3F4147] flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#E0E0E0]">Zlecenia paragonów</h2>
          <button onClick={load} className="px-3 py-1.5 bg-[#2B2D31] hover:bg-[#3F4147] rounded-lg text-xs text-[#3B82F6]">Odśwież</button>
        </div>
        {!data ? (
          <div className="p-10 text-center text-[#E0E0E0]/40">Ładowanie…</div>
        ) : data.jobs.length === 0 ? (
          <div className="p-10 text-center text-[#E0E0E0]/40">Brak zleceń. Paragon dodasz w szczegółach zamówienia.</div>
        ) : (
          <div className="divide-y divide-[#3F4147]">
            {data.jobs.map((j) => {
              const total = j.payload.items.reduce((s, i) => s + i.unit_price - (i.discount || 0), 0);
              const st = STATE_LABEL[j.state];
              return (
                <div key={j.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>{st.text}</span>
                      {j.orderId ? (
                        <Link href={`/admin/orders/${j.orderId}`} className="font-mono text-sm text-[#3B82F6] hover:underline">
                          {j.orderNumber || j.orderId}
                        </Link>
                      ) : (
                        <span className="font-mono text-sm text-[#E0E0E0]/70">{j.id}</span>
                      )}
                      <span className="text-sm text-[#E0E0E0]">{zl(total)}</span>
                      {j.receiptNumber && <span className="text-sm text-green-400">paragon nr {j.receiptNumber}</span>}
                    </div>
                    <p className="text-xs text-[#E0E0E0]/50 mt-1">
                      {new Date(j.createdAt).toLocaleString("pl-PL")} · {j.createdBy === "auto" ? "automatycznie" : "z panelu"}
                      {j.attempts ? ` · prób: ${j.attempts}` : ""}
                    </p>
                    {j.error && <p className={`text-xs mt-1 ${j.state === "printed" ? "text-[#E0E0E0]/50" : "text-red-300"}`}>{j.error}</p>}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {(j.state === "failed" || j.state === "uncertain") && (
                      <button disabled={busy === j.id} onClick={() => act(j, "retry")}
                        className="px-3 py-1.5 rounded-lg text-xs bg-[#3B82F6] text-white disabled:opacity-50">Ponów</button>
                    )}
                    {(j.state === "failed" || j.state === "uncertain") && (
                      <button disabled={busy === j.id} onClick={() => act(j, "mark_printed")}
                        className="px-3 py-1.5 rounded-lg text-xs bg-[#2B2D31] hover:bg-[#3F4147] text-[#E0E0E0]">Wydrukował się</button>
                    )}
                    {(j.state === "queued" || j.state === "failed" || j.state === "uncertain") && (
                      <button disabled={busy === j.id} onClick={() => act(j, "cancel")}
                        className="px-3 py-1.5 rounded-lg text-xs bg-[#2B2D31] hover:bg-red-500/20 text-[#E0E0E0]/60 hover:text-red-400">Anuluj</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
