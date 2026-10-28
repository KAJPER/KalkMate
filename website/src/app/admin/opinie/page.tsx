"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AdminShell from "@/components/admin/AdminShell";
import { toast } from "@/components/admin/toast";

// Moderacja opinii klientow (lib/reviews.ts). Tylko prawdziwe opinie z linku
// wyslanego po dostawie — tu sie ich nie tworzy ani nie edytuje.

type Status = "requested" | "submitted" | "approved" | "rejected";

interface ReviewRow {
  id: string;
  orderId: string;
  orderNumber: string | null;
  email: string;
  name: string;
  rating: number | null;
  text: string | null;
  lang: string;
  status: Status;
  requestedAt: number;
  submittedAt: number | null;
  moderatedAt: number | null;
}

interface Stats {
  requested: number;
  responded: number;
  responseRate: number;
  avgRating: number | null;
  approved: number;
  avgApprovedRating: number | null;
  pending: number;
}

const fmtDate = (ms: number | null) => (ms ? new Date(ms).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" }) : "—");

function Stars({ rating }: { rating: number | null }) {
  const r = rating ?? 0;
  return (
    <span className="font-mono text-sm tracking-wider" aria-label={`${r} z 5`}>
      <span className="text-[#D8FF3D]">{"★".repeat(r)}</span>
      <span className="text-[#E0E0E0]/20">{"★".repeat(5 - r)}</span>
    </span>
  );
}

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] p-5 shadow-xl">
      <p className="text-xs text-[#E0E0E0]/60 mb-1">{label}</p>
      <p className="text-2xl font-bold text-[#E0E0E0]">{value}</p>
      {sub && <p className="text-xs text-[#E0E0E0]/40 mt-1">{sub}</p>}
    </div>
  );
}

async function fetchAdminReviews(): Promise<{ pending: ReviewRow[]; history: ReviewRow[]; stats: Stats } | null> {
  try {
    const res = await fetch("/api/admin/reviews");
    if (res.ok) return await res.json();
    toast(`Nie udało się pobrać opinii (HTTP ${res.status})`, "error");
  } catch (e) {
    console.error(e);
    toast("Błąd sieci przy pobieraniu opinii", "error");
  }
  return null;
}

export default function ReviewsAdminPage() {
  const [pending, setPending] = useState<ReviewRow[]>([]);
  const [history, setHistory] = useState<ReviewRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<"all" | "approved" | "rejected">("all");

  // Fetch bez setState; stan ustawiany w .then (react-hooks/set-state-in-effect).
  const load = useCallback(() => {
    fetchAdminReviews().then((d) => {
      if (d) {
        setPending(d.pending || []);
        setHistory(d.history || []);
        setStats(d.stats || null);
      }
      setLoading(false);
    });
  }, []);

  const fetchReviews = () => {
    setLoading(true);
    load();
  };

  useEffect(() => {
    load();
  }, [load]);

  const moderate = async (r: ReviewRow, status: "approved" | "rejected") => {
    setBusyId(r.id);
    try {
      const res = await fetch(`/api/admin/reviews?id=${encodeURIComponent(r.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        toast(`Nie udało się zapisać: ${d?.error || `HTTP ${res.status}`}`, "error");
      } else {
        toast(status === "approved" ? `Opublikowano opinię: ${r.name}` : `Odrzucono opinię: ${r.name}`);
      }
    } catch {
      toast("Nie udało się zapisać: błąd sieci", "error");
    } finally {
      setBusyId(null);
      fetchReviews();
    }
  };

  const shownHistory = historyFilter === "all" ? history : history.filter((r) => r.status === historyFilter);

  const card = (r: ReviewRow, actions: React.ReactNode) => (
    <motion.div
      key={r.id}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      className="p-4 hover:bg-[#313338] transition-colors flex items-start justify-between gap-4"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <Stars rating={r.rating} />
          <span className="text-sm font-semibold text-[#E0E0E0]">{r.name || "—"}</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-[#2B2D31] text-[#E0E0E0]/60 uppercase">{r.lang}</span>
          {r.status === "approved" && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-400">Opublikowana</span>}
          {r.status === "rejected" && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400">Odrzucona</span>}
        </div>
        <p className="text-sm text-[#E0E0E0]/85 whitespace-pre-wrap break-words">
          {r.text || <span className="text-[#E0E0E0]/35 italic">(sama ocena, bez treści)</span>}
        </p>
        <div className="mt-2 flex items-center gap-x-4 gap-y-1 text-xs text-[#E0E0E0]/50 flex-wrap">
          <span>Zamówienie: <b className="text-[#E0E0E0]/80 font-mono">{r.orderNumber || r.orderId}</b></span>
          <span>• {r.email}</span>
          <span>• Prośba: {fmtDate(r.requestedAt)}</span>
          <span>• Opinia: {fmtDate(r.submittedAt)}</span>
          {r.moderatedAt && <span>• Decyzja: {fmtDate(r.moderatedAt)}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">{actions}</div>
    </motion.div>
  );

  const btn = (label: string, onClick: () => void, kind: "ok" | "no", disabled: boolean) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 text-xs rounded-lg transition-colors disabled:opacity-50 ${
        kind === "ok"
          ? "bg-green-500/15 hover:bg-green-500/25 text-green-400"
          : "bg-[#2B2D31] hover:bg-red-500/20 text-[#E0E0E0]/60 hover:text-red-400"
      }`}
    >
      {label}
    </button>
  );

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#E0E0E0] mb-1">Opinie klientów</h1>
          <p className="text-sm text-[#E0E0E0]/60">
            Zweryfikowane zakupy: prośba wysyłana 5–14 dni po dostawie. Na stronie pojawiają się tylko zatwierdzone.
          </p>
        </div>
        <button
          onClick={fetchReviews}
          className="flex items-center gap-2 px-4 py-2 bg-[#313338] hover:bg-[#3F4147] rounded-lg text-sm text-[#3B82F6] transition-colors"
        >
          Odśwież
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatBox label="Wysłane prośby" value={String(stats.requested)} />
          <StatBox
            label="Odpowiedzi"
            value={`${(stats.responseRate * 100).toFixed(0)}%`}
            sub={`${stats.responded} z ${stats.requested}`}
          />
          <StatBox
            label="Średnia ocena"
            value={stats.avgRating != null ? stats.avgRating.toFixed(2) : "—"}
            sub="ze wszystkich odpowiedzi"
          />
          <StatBox
            label="Opublikowane"
            value={String(stats.approved)}
            sub={stats.avgApprovedRating != null ? `śr. ${stats.avgApprovedRating.toFixed(2)} · JSON-LD od 5 opinii` : "JSON-LD od 5 opinii"}
          />
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] shadow-xl overflow-hidden mb-6"
      >
        <div className="p-6 border-b border-[#3F4147]">
          <h2 className="text-xl font-bold text-[#E0E0E0]">Do moderacji ({pending.length})</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3B82F6]"></div>
          </div>
        ) : pending.length > 0 ? (
          <div className="divide-y divide-[#3F4147]">
            <AnimatePresence>
              {pending.map((r) =>
                card(r, (
                  <>
                    {btn("Zatwierdź", () => moderate(r, "approved"), "ok", busyId === r.id)}
                    {btn("Odrzuć", () => moderate(r, "rejected"), "no", busyId === r.id)}
                  </>
                ))
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="p-12 text-center text-[#E0E0E0]/40">Brak opinii czekających na moderację</div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] shadow-xl overflow-hidden"
      >
        <div className="p-6 border-b border-[#3F4147] flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-xl font-bold text-[#E0E0E0]">Historia ({history.length})</h2>
          <div className="flex gap-2">
            {(["all", "approved", "rejected"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setHistoryFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  historyFilter === f ? "bg-[#3B82F6] text-white" : "bg-[#2B2D31] text-[#E0E0E0]/60"
                }`}
              >
                {f === "all" ? "Wszystkie" : f === "approved" ? "Zatwierdzone" : "Odrzucone"}
              </button>
            ))}
          </div>
        </div>
        {loading ? null : shownHistory.length > 0 ? (
          <div className="divide-y divide-[#3F4147]">
            <AnimatePresence>
              {shownHistory.map((r) =>
                card(
                  r,
                  r.status === "approved"
                    ? btn("Ukryj (odrzuć)", () => moderate(r, "rejected"), "no", busyId === r.id)
                    : btn("Zatwierdź", () => moderate(r, "approved"), "ok", busyId === r.id),
                )
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="p-12 text-center text-[#E0E0E0]/40">Brak</div>
        )}
      </motion.div>
    </AdminShell>
  );
}
