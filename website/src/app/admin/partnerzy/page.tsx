"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import AdminShell from "@/components/admin/AdminShell";
import { toast } from "@/components/admin/toast";

interface Affiliate {
  code: string;
  userId: string;
  email: string | null;
  active: number;
  createdAt: number;
  units: number;
  earnedCents: number;
  paidOutCents: number;
  availableCents: number;
  pendingCents: number;
  tier: { key: string; pct: number };
}

interface Payout {
  id: string;
  userId: string;
  email: string | null;
  kind: string; // "cash" | "tokens"
  amountCents: number;
  tokens: number | null;
  status: string; // requested | paid | rejected | done
  iban: string | null;
  holder: string | null;
  createdAt: number;
  processedAt: number | null;
  note: string | null;
}

// Nazwy poziomow (lib/affiliates.ts AFFILIATE_TIERS — tam importuje sie prisma,
// wiec nie do strony klienta).
const TIER_NAMES: Record<string, string> = {
  start: "Start",
  bronze: "Brąz",
  silver: "Srebro",
  gold: "Złoto",
  diamond: "Diament",
};

const pln = (cents: number) =>
  `${(cents / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;

const dateTime = (ms: number | null) =>
  ms ? new Date(ms).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" }) : "—";

const fmtIban = (iban: string) => iban.replace(/(.{4})/g, "$1 ").trim();

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  paid: { text: "Wypłacono", cls: "bg-green-500/20 text-green-400" },
  done: { text: "Wymieniono", cls: "bg-[#3B82F6]/20 text-[#3B82F6]" },
  rejected: { text: "Odrzucono", cls: "bg-red-500/20 text-red-400" },
  requested: { text: "Zlecono", cls: "bg-[#D8FF3D]/15 text-[#D8FF3D]" },
};

export default function AffiliatesPage() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/affiliates");
      if (res.ok) {
        const d = await res.json();
        setAffiliates(d.affiliates || []);
        setPayouts(d.payouts || []);
      } else {
        toast(`Nie udało się pobrać danych (HTTP ${res.status})`, "error");
      }
    } catch (e) {
      console.error(e);
      toast("Błąd sieci przy pobieraniu danych", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // PATCH z kontrola odpowiedzi (jak w kuponach).
  const patch = async (url: string, body: unknown, failMsg: string) => {
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.ok) {
        toast(`${failMsg}: ${d?.error || `HTTP ${res.status}`}`, "error");
        return null;
      }
      return d;
    } catch {
      toast(`${failMsg}: błąd sieci`, "error");
      return null;
    }
  };

  const markPaid = async (p: Payout) => {
    if (!confirm(`Potwierdzasz, że przelew ${pln(p.amountCents)} na ${p.iban ? fmtIban(p.iban) : "?"} (${p.holder || "?"}) został wysłany?`)) return;
    setBusy(p.id);
    const d = await patch(`/api/admin/affiliates?payout=${encodeURIComponent(p.id)}`, { status: "paid" }, "Nie udało się oznaczyć wypłaty");
    if (d) toast(d.mailed ? "Oznaczono jako wypłacone, klient dostał maila" : "Oznaczono jako wypłacone (mail nie poszedł)");
    setBusy(null);
    fetchData();
  };

  const reject = async (p: Payout) => {
    const note = prompt(`Odrzucić wypłatę ${pln(p.amountCents)} dla ${p.email || p.userId}?\nPowód (trafi do klienta w mailu):`);
    if (note === null) return;
    setBusy(p.id);
    const d = await patch(`/api/admin/affiliates?payout=${encodeURIComponent(p.id)}`, { status: "rejected", note }, "Nie udało się odrzucić wypłaty");
    if (d) toast(d.mailed ? "Odrzucono, klient dostał maila" : "Odrzucono (mail nie poszedł)");
    setBusy(null);
    fetchData();
  };

  const toggleActive = async (a: Affiliate) => {
    if (a.active && !confirm(`Wyłączyć kod ${a.code}? Kupujący nie będą mogli go użyć.`)) return;
    setBusy(a.code);
    await patch(`/api/admin/affiliates?code=${encodeURIComponent(a.code)}`, { active: !a.active },
      a.active ? "Nie udało się wyłączyć kodu" : "Nie udało się włączyć kodu");
    setBusy(null);
    fetchData();
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast("Skopiowano IBAN");
    } catch {
      toast("Nie udało się skopiować", "error");
    }
  };

  const requested = payouts.filter((p) => p.kind === "cash" && p.status === "requested");
  const history = payouts.filter((p) => !(p.kind === "cash" && p.status === "requested"));

  const card = "bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] shadow-xl overflow-hidden mb-6";
  const th = "text-left text-xs font-semibold text-[#E0E0E0]/50 px-4 py-3 whitespace-nowrap";
  const td = "px-4 py-3 text-sm text-[#E0E0E0]/80 whitespace-nowrap";
  const spinner = (
    <div className="flex items-center justify-center h-32">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3B82F6]"></div>
    </div>
  );

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#E0E0E0] mb-1">Program partnerski</h1>
          <p className="text-sm text-[#E0E0E0]/60">Kody partnerów, prowizje i wypłaty (kwoty w PLN)</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-[#313338] hover:bg-[#3F4147] rounded-lg text-sm text-[#3B82F6] transition-colors"
        >
          Odśwież
        </button>
      </div>

      {/* Wyplaty do zrobienia */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={card}>
        <div className="p-6 border-b border-[#3F4147]">
          <h2 className="text-xl font-bold text-[#E0E0E0]">Wypłaty do zrobienia ({requested.length})</h2>
          <p className="text-xs text-[#E0E0E0]/50 mt-1">Zrób przelew ręcznie, potem oznacz jako wypłacone — klient dostanie maila.</p>
        </div>
        {loading ? spinner : requested.length > 0 ? (
          <div className="divide-y divide-[#3F4147]">
            {requested.map((p) => (
              <div key={p.id} className="p-4 flex items-center justify-between gap-4 flex-wrap hover:bg-[#313338] transition-colors">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-lg font-bold text-[#D8FF3D]">{pln(p.amountCents)}</span>
                    <span className="text-sm text-[#E0E0E0]">{p.email || p.userId}</span>
                    <span className="text-xs text-[#E0E0E0]/50">{dateTime(p.createdAt)}</span>
                  </div>
                  <div className="text-sm text-[#E0E0E0]/80">Odbiorca: <b className="text-[#E0E0E0]">{p.holder || "—"}</b></div>
                  {p.iban && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-sm font-mono text-[#3B82F6] bg-[#2B2D31] px-3 py-1 rounded select-all">{fmtIban(p.iban)}</code>
                      <button
                        onClick={() => copy(p.iban as string)}
                        className="px-2.5 py-1 bg-[#2B2D31] hover:bg-[#3F4147] text-[#E0E0E0]/70 text-xs rounded-lg transition-colors"
                      >
                        Kopiuj
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => markPaid(p)}
                    disabled={busy === p.id}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    Oznacz jako wypłacone
                  </button>
                  <button
                    onClick={() => reject(p)}
                    disabled={busy === p.id}
                    className="px-3 py-1.5 bg-[#2B2D31] hover:bg-red-500/20 text-[#E0E0E0]/60 hover:text-red-400 text-xs rounded-lg transition-colors disabled:opacity-50"
                  >
                    Odrzuć
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center text-[#E0E0E0]/40">Brak zleconych wypłat</div>
        )}
      </motion.div>

      {/* Partnerzy */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={card}>
        <div className="p-6 border-b border-[#3F4147]">
          <h2 className="text-xl font-bold text-[#E0E0E0]">Partnerzy ({affiliates.length})</h2>
        </div>
        {loading ? spinner : affiliates.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-[#3F4147]">
                <tr>
                  <th className={th}>Kod</th>
                  <th className={th}>E-mail</th>
                  <th className={th}>Status</th>
                  <th className={th}>Sprzedane szt.</th>
                  <th className={th}>Poziom</th>
                  <th className={th}>Zarobione</th>
                  <th className={th}>Wypłacone / wymienione</th>
                  <th className={th}>Dostępne</th>
                  <th className={th}>W drodze</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3F4147]">
                {affiliates.map((a) => (
                  <tr key={a.code} className="hover:bg-[#313338] transition-colors">
                    <td className={td}>
                      <code className="text-sm font-mono font-bold text-[#3B82F6] bg-[#2B2D31] px-2 py-0.5 rounded">{a.code}</code>
                    </td>
                    <td className={td}>{a.email || <span className="text-[#E0E0E0]/40">{a.userId}</span>}</td>
                    <td className={td}>
                      <button
                        onClick={() => toggleActive(a)}
                        disabled={busy === a.code}
                        title={a.active ? "Kliknij, aby wyłączyć" : "Kliknij, aby włączyć"}
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold transition-colors disabled:opacity-50 ${
                          a.active ? "bg-green-500/20 text-green-400 hover:bg-green-500/30" : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                        }`}
                      >
                        {a.active ? "● Aktywny" : "Wyłączony"}
                      </button>
                    </td>
                    <td className={td}>{a.units}</td>
                    <td className={td}>{TIER_NAMES[a.tier?.key] ?? a.tier?.key} ({a.tier?.pct}%)</td>
                    <td className={td}>{pln(a.earnedCents)}</td>
                    <td className={td}>{pln(a.paidOutCents)}</td>
                    <td className={`${td} font-semibold ${a.availableCents < 0 ? "text-red-400" : "text-green-400"}`}>{pln(a.availableCents)}</td>
                    <td className={`${td} text-[#E0E0E0]/60`}>{pln(a.pendingCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center text-[#E0E0E0]/40">Brak partnerów</div>
        )}
      </motion.div>

      {/* Historia */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={card}>
        <div className="p-6 border-b border-[#3F4147]">
          <h2 className="text-xl font-bold text-[#E0E0E0]">Historia wypłat i wymian ({history.length})</h2>
        </div>
        {loading ? spinner : history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-[#3F4147]">
                <tr>
                  <th className={th}>Zlecono</th>
                  <th className={th}>Rozliczono</th>
                  <th className={th}>E-mail</th>
                  <th className={th}>Rodzaj</th>
                  <th className={th}>Kwota</th>
                  <th className={th}>Status</th>
                  <th className={th}>Szczegóły</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3F4147]">
                {history.map((p) => {
                  const st = STATUS_LABEL[p.status] ?? { text: p.status, cls: "bg-[#2B2D31] text-[#E0E0E0]/60" };
                  return (
                    <tr key={p.id} className="hover:bg-[#313338] transition-colors">
                      <td className={td}>{dateTime(p.createdAt)}</td>
                      <td className={td}>{dateTime(p.processedAt)}</td>
                      <td className={td}>{p.email || <span className="text-[#E0E0E0]/40">{p.userId}</span>}</td>
                      <td className={td}>{p.kind === "tokens" ? "Tokeny AI" : "Przelew"}</td>
                      <td className={`${td} font-semibold`}>{pln(p.amountCents)}</td>
                      <td className={td}>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>{st.text}</span>
                      </td>
                      <td className={`${td} text-xs text-[#E0E0E0]/60 whitespace-normal`}>
                        {p.kind === "tokens"
                          ? `${(p.tokens ?? 0).toLocaleString("pl-PL")} tokenów`
                          : [p.holder, p.iban ? fmtIban(p.iban) : null].filter(Boolean).join(" • ")}
                        {p.note && <div className="text-[#E0E0E0]/50 mt-0.5">Uwaga: {p.note}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center text-[#E0E0E0]/40">Brak historii</div>
        )}
      </motion.div>
    </AdminShell>
  );
}
