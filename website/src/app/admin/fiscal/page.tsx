"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import DesktopFiscalCard from "@/components/admin/DesktopFiscalCard";
import { toast } from "@/components/admin/toast";
import { usePolling } from "@/components/admin/usePolling";
import { fmtDateTime, zl } from "@/components/admin/format";

interface PrinterInfo {
  online?: boolean;
  ready?: boolean;
  fiscal?: boolean | null;
  description?: string;
  last_receipt?: number | null;
  error?: string | null;
}

// K6: "superseded" = stare nieudane zlecenie zastapione nowym (ponowienie),
// "cancel_requested" = anulowanie zlecone, czeka az agent je potwierdzi.
type JobState = "queued" | "sent" | "printed" | "failed" | "uncertain" | "cancelled" | "superseded" | "cancel_requested";

interface Job {
  id: string;
  orderId: string | null;
  orderNumber: string | null;
  state: JobState;
  receiptNumber: number | null;
  error: string | null;
  category: string | null;
  attempts: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  // Nowsze API: `state` zostaje w starym zbiorze wartosci (zgodnosc), a
  // prawdziwy stan jest w `stateDetail`; claimedBy = agent, ktory pobral zlecenie.
  stateDetail?: JobState;
  claimedBy?: string | null;
  payload: { items: { name: string; quantity?: string; unit_price: number; discount?: number }[]; payments: { amount: number }[] };
}

type AgentInfo = {
  id?: string;
  name?: string | null;
  lastSeenAt: number | null;
  online: boolean;
  version: string | null;
  printer: PrinterInfo | null;
  agents?: AgentInfo[];
};

interface Data {
  agent?: AgentInfo | null;
  // Kilka agentow (heartbeat kazdego) — w `agent.agents` albo `agents`.
  agents?: AgentInfo[];
  jobs: Job[];
  configured: boolean;
  autoEnqueue: boolean;
}

const STATE_LABEL: Record<JobState, { text: string; cls: string }> = {
  queued: { text: "W kolejce", cls: "bg-blue-500/15 text-blue-300" },
  sent: { text: "U agenta", cls: "bg-yellow-500/15 text-yellow-300" },
  printed: { text: "Wydrukowany", cls: "bg-green-500/15 text-green-400" },
  failed: { text: "Błąd", cls: "bg-red-500/15 text-red-400" },
  uncertain: { text: "Niepewny", cls: "bg-orange-500/20 text-orange-300" },
  cancelled: { text: "Anulowany", cls: "bg-[#E0E0E0]/10 text-[#E0E0E0]/50" },
  superseded: { text: "Zastąpiony", cls: "bg-[#E0E0E0]/10 text-[#E0E0E0]/40" },
  cancel_requested: { text: "Anulowanie w toku", cls: "bg-orange-500/15 text-orange-300" },
};
const UNKNOWN_STATE = { text: "", cls: "bg-[#E0E0E0]/10 text-[#E0E0E0]/60" };

// Ponowienie moze wydrukowac DRUGI paragon, jesli pierwszy jednak wyszedl:
// stan niepewny albo blad protokolu (zerwane polaczenie w trakcie druku).
const mayHavePrinted = (j: Job) =>
  j.state === "uncertain" || j.state === "cancel_requested" || (j.state === "failed" && j.category === "protocol");
const PRINTED_RISK_MSG = "Paragon mógł zostać wydrukowany — sprawdź raport drukarki przed ponowieniem.";

export default function FiscalPage() {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/fiscal");
      if (res.ok) {
        const json: Data = await res.json();
        // Prawdziwy stan (superseded / cancel_requested) zamiast zgodnosciowego.
        json.jobs = (json.jobs || []).map((j) => ({ ...j, state: j.stateDetail || j.state }));
        setData(json);
        setLoadErr("");
      } else {
        setLoadErr(`Nie udało się pobrać danych fiskalizacji (HTTP ${res.status})`);
      }
    } catch {
      setLoadErr("Błąd sieci przy pobieraniu danych fiskalizacji");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  usePolling(load, 15000);

  const act = async (job: Job, action: "retry" | "cancel" | "mark_printed" | "reassign") => {
    let receiptNumber: number | undefined;
    if (action === "mark_printed") {
      const v = window.prompt("Numer paragonu wydrukowanego przez drukarkę (sprawdź na wydruku / w kopii elektronicznej):");
      if (!v) return;
      receiptNumber = parseInt(v, 10);
      if (!Number.isFinite(receiptNumber) || receiptNumber <= 0) {
        toast("Nieprawidłowy numer paragonu", "error");
        return;
      }
    }
    if (action === "retry" && mayHavePrinted(job) &&
        !confirm(`${PRINTED_RISK_MSG}\n\n${job.state === "uncertain" ? "Stan NIEPEWNY" : "Błąd protokołu w trakcie druku"}: ponów TYLKO jeśli sprawdziłeś drukarkę i kopię elektroniczną i paragonu NIE MA. Inaczej klient dostanie dwa paragony.\n\nPonowić?`)) return;
    if (action === "reassign" &&
        !confirm(`Oddać zlecenie innemu agentowi?\n\n${PRINTED_RISK_MSG}\nObecny agent${job.claimedBy ? ` (${job.claimedBy})` : ""} mógł już zacząć druk (zlecenie jest „u agenta”). Oddaj je tylko, gdy ten agent/komputer jest wyłączony na stałe.`)) return;
    if (action === "cancel") {
      const msg =
        job.state === "sent"
          ? "Agent już pobrał to zlecenie — anulowanie poprosi go o porzucenie druku.\n\nJeśli zdążył wydrukować, oznacz później „Wydrukował się”.\n\nAnulować?"
          : job.state === "cancel_requested"
            ? `Potwierdzasz, że paragon NIE został wydrukowany?\n\n${PRINTED_RISK_MSG}\n\nZamknąć zlecenie jako anulowane?`
            : "Anulować zlecenie paragonu?";
      if (!confirm(msg)) return;
    }
    setBusy(job.id);
    try {
      const res = await fetch(`/api/admin/fiscal/jobs/${job.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, receiptNumber }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) {
        toast(action === "retry" ? "Dodano nowe zlecenie" : action === "reassign" ? "Zlecenie oddane — weźmie je pierwszy wolny agent" : "Zapisano");
      } else if (res.status === 409) {
        toast(j.error || "Zamówienie ma już aktywne zlecenie paragonu — odśwież listę zamiast ponawiać.", "error");
      } else {
        toast(j.error || `Błąd (HTTP ${res.status})`, "error");
      }
      await load();
    } catch {
      toast("Błąd sieci — sprawdź stan zlecenia po odświeżeniu, zanim ponowisz.", "error");
    } finally {
      setBusy(null);
    }
  };

  // Heartbeat: lista agentow (nowe API) albo jeden (stare).
  const agentList = data?.agents?.length ? data.agents : data?.agent?.agents;
  const agents: AgentInfo[] = agentList?.length ? agentList : data?.agent && data.agent.lastSeenAt ? [data.agent] : [];
  const anyOnline = agents.some((a) => a.online);
  const printers = agents.filter((a) => a.printer);
  const attention = data?.jobs.filter((j) => j.state === "failed" || j.state === "uncertain" || j.state === "cancel_requested").length ?? 0;

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#E0E0E0] mb-1">Fiskalizacja</h1>
        <p className="text-sm text-[#E0E0E0]/60">
          Paragony drukuje aplikacja KalkMate Admin (albo osobny agent) na komputerze w sieci drukarki fiskalnej POSNET. Instrukcja: <code className="text-xs">docs/fiskalizacja/README.md</code>
        </p>
      </div>

      <DesktopFiscalCard />

      {loadErr && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{loadErr}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-[#3F4147] bg-[#2B2D31] p-5">
          <p className="text-xs text-[#E0E0E0]/60 mb-1">{agents.length > 1 ? `Agenci (${agents.length})` : "Agent"}</p>
          <p className={`text-lg font-bold ${anyOnline ? "text-green-400" : "text-red-400"}`}>
            {anyOnline ? "● Połączony" : "● Brak połączenia"}
          </p>
          {agents.length === 0 && <p className="text-xs text-[#E0E0E0]/50 mt-1">Agent jeszcze się nie zgłosił</p>}
          {agents.map((a, i) => (
            <p key={a.id || i} className="text-xs text-[#E0E0E0]/50 mt-1 break-words">
              {agents.length > 1 && (
                <span className={a.online ? "text-green-400" : "text-red-400"}>● {a.name || a.id || `agent ${i + 1}`} · </span>
              )}
              {a.lastSeenAt ? `Ostatnio: ${fmtDateTime(a.lastSeenAt)}` : "jeszcze się nie zgłosił"}
              {a.version ? ` · v${a.version}` : ""}
            </p>
          ))}
        </div>
        <div className="rounded-xl border border-[#3F4147] bg-[#2B2D31] p-5">
          <p className="text-xs text-[#E0E0E0]/60 mb-1">{printers.length > 1 ? `Drukarki (${printers.length})` : "Drukarka"}</p>
          {printers.length === 0 && <p className="text-lg font-bold text-orange-300">—</p>}
          {printers.map((a, i) => {
            const printer = a.printer as PrinterInfo;
            return (
              <div key={a.id || i} className={i ? "mt-2 pt-2 border-t border-[#3F4147]" : ""}>
                <p className={`text-lg font-bold ${printer.ready ? "text-green-400" : "text-orange-300"}`}>
                  {printers.length > 1 && <span className="text-xs font-normal text-[#E0E0E0]/50">{a.name || a.id || `agent ${i + 1}`}: </span>}
                  {printer.ready ? "Gotowa" : printer.online ? "Wymaga uwagi" : "Niedostępna"}
                </p>
                <p className="text-xs text-[#E0E0E0]/50 mt-1 break-words">{printer.description || printer.error || ""}</p>
                {printer.fiscal === false && (
                  <p className="text-xs text-blue-300 mt-1">Tryb niefiskalny — wydruki testowe, bez mocy paragonu.</p>
                )}
              </div>
            );
          })}
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
              // Wartosc pozycji = ilosc × cena − rabat (jak w agentach fiskalnych, ROUND_HALF_UP).
              const total = (j.payload?.items || []).reduce((s, i) => s + Math.round((Number(i.quantity ?? 1) || 1) * i.unit_price) - (i.discount || 0), 0);
              const st = STATE_LABEL[j.state] || { ...UNKNOWN_STATE, text: j.state };
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
                      {fmtDateTime(j.createdAt)} · {j.createdBy === "auto" ? "automatycznie" : "z panelu"}
                      {j.attempts ? ` · prób: ${j.attempts}` : ""}
                      {j.claimedBy && (j.state === "sent" || j.state === "cancel_requested") ? ` · agent: ${j.claimedBy}` : ""}
                    </p>
                    {j.error && <p className={`text-xs mt-1 ${j.state === "printed" || j.state === "superseded" ? "text-[#E0E0E0]/50" : "text-red-300"}`}>{j.error}</p>}
                    {mayHavePrinted(j) && <p className="text-xs mt-1 text-orange-300">{PRINTED_RISK_MSG}</p>}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {(j.state === "failed" || j.state === "uncertain") && (
                      <button disabled={busy === j.id} onClick={() => act(j, "retry")}
                        className="px-3 py-1.5 rounded-lg text-xs bg-[#3B82F6] text-white disabled:opacity-50">Ponów</button>
                    )}
                    {j.state === "sent" && (
                      <button disabled={busy === j.id} onClick={() => act(j, "reassign")}
                        title="Agent trzymający zlecenie nie odpowiada? Oddaj zlecenie innemu agentowi."
                        className="px-3 py-1.5 rounded-lg text-xs bg-[#2B2D31] hover:bg-[#3F4147] text-[#E0E0E0]">Oddaj innemu agentowi</button>
                    )}
                    {(j.state === "failed" || j.state === "uncertain" || j.state === "cancel_requested") && (
                      <button disabled={busy === j.id} onClick={() => act(j, "mark_printed")}
                        className="px-3 py-1.5 rounded-lg text-xs bg-[#2B2D31] hover:bg-[#3F4147] text-[#E0E0E0]">Wydrukował się</button>
                    )}
                    {(j.state === "queued" || j.state === "failed" || j.state === "uncertain" || j.state === "sent" || j.state === "cancel_requested") && (
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
