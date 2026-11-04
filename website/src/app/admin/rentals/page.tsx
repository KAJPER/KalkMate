"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";

// Wypozyczenia (lib/rentals.ts). API: /api/admin/rentals, /api/admin/rentals/[id].
// Kolejnosc pracy: oplacone -> przypisz kalkulator (start najmu) -> nadaj paczke
// w zamowieniu -> po zwrocie "Przyjmij zwrot" -> zresetuj kalkulator -> "Kaucja zwrocona".

type Status = "pending" | "paid" | "active" | "returned" | "cancelled";

interface Rental {
  id: string;
  rentalNumber: string;
  status: Status;
  days: number;
  feeGrosze: number;
  depositGrosze: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  addressStreet: string;
  addressPostcode: string;
  addressCity: string;
  pickupPoint: string;
  orderId: string | null;
  deviceId: string | null;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  paidAt: string | null;
  returnedAt: string | null;
  depositRefundedAt: string | null;
  notes: string | null;
  identityStatus: "pending" | "approved" | "declined" | "mismatch" | "review" | null;
  identityName: string | null;
}

const IDENTITY_LABEL: Record<NonNullable<Rental["identityStatus"]>, string> = {
  pending: "weryfikacja w toku",
  approved: "tożsamość potwierdzona",
  declined: "weryfikacja odrzucona",
  mismatch: "dane z dowodu niezgodne",
  review: "weryfikacja do sprawdzenia",
};

const STATUS_LABEL: Record<Status, string> = {
  pending: "Nieopłacone",
  paid: "Do wysłania",
  active: "U klienta",
  returned: "Zwrócone",
  cancelled: "Anulowane",
};
const STATUS_CLS: Record<Status, string> = {
  pending: "bg-[#3F4147] text-[#E0E0E0]/60",
  paid: "bg-amber-500/15 text-amber-300",
  active: "bg-[#3B82F6]/15 text-[#93C5FD]",
  returned: "bg-green-500/15 text-green-300",
  cancelled: "bg-red-500/10 text-red-300",
};

type Filter = "todo" | "active" | "overdue" | "all";

const card = "bg-[#313338] rounded-xl border border-[#3F4147]";
const btn = "px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50";
const input = "px-3 py-1.5 rounded-lg border border-[#3F4147] bg-[#2B2D31] text-[#E0E0E0] text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]";

const pln = (g: number) => `${(g / 100).toFixed(g % 100 ? 2 : 0)} zł`;
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pl-PL") : "—");
const isOverdue = (r: Rental) => r.status === "active" && !!r.endAt && new Date(r.endAt).getTime() < Date.now();
const daysLeft = (r: Rental) => (r.endAt ? Math.ceil((new Date(r.endAt).getTime() - Date.now()) / 86_400_000) : null);

async function fetchRentals(): Promise<Rental[]> {
  const res = await fetch("/api/admin/rentals");
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data.rentals;
}

export default function RentalsPage() {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [filter, setFilter] = useState<Filter>("todo");
  const [busy, setBusy] = useState<string | null>(null);
  const [deviceInput, setDeviceInput] = useState<Record<string, string>>({});

  const reload = useCallback(
    () => fetchRentals().then(setRentals).catch((e: Error) => setMsg({ ok: false, text: e.message })).finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    let cancelled = false;
    fetchRentals()
      .then((list) => { if (!cancelled) setRentals(list); })
      .catch((e: Error) => { if (!cancelled) setMsg({ ok: false, text: e.message }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const act = async (r: Rental, action: string, extra: Record<string, unknown> = {}, okText = "Zapisano.") => {
    setBusy(r.id);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/rentals/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
      if (!data.ok) throw new Error(data.error || "Błąd");
      setMsg({ ok: true, text: `${r.rentalNumber}: ${okText}` });
      await reload();
    } catch (e) {
      setMsg({ ok: false, text: `${r.rentalNumber}: ${(e as Error).message}` });
    } finally {
      setBusy(null);
    }
  };

  const filtered = rentals.filter((r) =>
    filter === "all" ? true
      : filter === "active" ? r.status === "active"
      : filter === "overdue" ? isOverdue(r)
      : r.status === "paid" || isOverdue(r) || (r.status === "returned" && !r.depositRefundedAt && r.depositGrosze > 0)
  );
  const counts = {
    todo: rentals.filter((r) => r.status === "paid" || isOverdue(r) || (r.status === "returned" && !r.depositRefundedAt && r.depositGrosze > 0)).length,
    active: rentals.filter((r) => r.status === "active").length,
    overdue: rentals.filter(isOverdue).length,
    all: rentals.length,
  };

  return (
    <AdminShell>
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl font-bold text-[#E0E0E0] mb-1">Wypożyczenia</h1>
        <p className="text-sm text-[#E0E0E0]/60">
          Opłacone → przypisz kalkulator (start najmu, AI działa do końca okresu) → nadaj paczkę w zamówieniu →
          po zwrocie „Przyjmij zwrot” (kalkulator zostaje zablokowany) → reset fabryczny → zwróć kaucję.
          Strona dla klientów: <Link href="/wypozyczenie" target="_blank" className="text-[#3B82F6] hover:underline">/wypozyczenie</Link>
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {([["todo", "Do zrobienia"], ["active", "U klientów"], ["overdue", "Po terminie"], ["all", "Wszystkie"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilter(k)}
            className={`${btn} ${filter === k ? "bg-[#3B82F6] text-white" : "bg-[#2B2D31] border border-[#3F4147] text-[#E0E0E0]/80"}`}>
            {l} <span className="opacity-60">{counts[k]}</span>
          </button>
        ))}
      </div>
      {msg && <p className={`text-sm mb-3 ${msg.ok ? "text-green-400" : "text-red-400"}`}>{msg.text}</p>}

      {loading ? (
        <p className="text-sm text-[#E0E0E0]/40">Ładowanie…</p>
      ) : !filtered.length ? (
        <p className="text-sm text-[#E0E0E0]/40">Nic tu nie ma.</p>
      ) : (
        <div className="space-y-3 max-w-5xl">
          {filtered.map((r) => {
            const left = daysLeft(r);
            const overdue = isOverdue(r);
            return (
              <div key={r.id} className={`${card} p-4 space-y-3`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold text-[#E0E0E0]">{r.rentalNumber}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded ${STATUS_CLS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  {overdue && <span className="text-[11px] px-2 py-0.5 rounded bg-red-500/20 text-red-300">po terminie {Math.abs(left ?? 0)} dni</span>}
                  {r.status === "active" && !overdue && left !== null && <span className="text-[11px] text-[#E0E0E0]/50">zostało {left} dni</span>}
                  {r.identityStatus && (
                    <span className={`text-[11px] px-2 py-0.5 rounded ${r.identityStatus === "approved" ? "bg-green-500/15 text-green-300" : "bg-[#3F4147] text-[#E0E0E0]/70"}`}>
                      {IDENTITY_LABEL[r.identityStatus]}{r.identityName ? ` · ${r.identityName}` : ""}
                    </span>
                  )}
                  {r.status === "returned" && !r.depositRefundedAt && r.depositGrosze > 0 && <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300">kaucja do zwrotu</span>}
                  <span className="ml-auto text-xs text-[#E0E0E0]/40">{fmtDate(r.createdAt)}</span>
                </div>

                <div className="grid sm:grid-cols-3 gap-3 text-sm text-[#E0E0E0]/80">
                  <div>
                    <p className="font-medium text-[#E0E0E0]">{r.customerName}</p>
                    <p className="text-xs break-all">{r.customerEmail} · {r.customerPhone}</p>
                    <p className="text-xs text-[#E0E0E0]/50">{r.addressStreet}, {r.addressPostcode} {r.addressCity}</p>
                  </div>
                  <div className="text-xs space-y-0.5">
                    <p>{r.days} dni · najem {pln(r.feeGrosze)} · kaucja {pln(r.depositGrosze)}</p>
                    <p>Paczkomat: {r.pickupPoint}</p>
                    <p>Okres: {fmtDate(r.startAt)} → <strong>{fmtDate(r.endAt)}</strong></p>
                  </div>
                  <div className="text-xs space-y-0.5">
                    <p>Kalkulator: <span className="font-mono">{r.deviceId || "—"}</span></p>
                    {r.orderId && (
                      <p><Link href={`/admin/orders/${r.orderId}`} className="text-[#3B82F6] hover:underline">Zamówienie (wysyłka, paragon) →</Link></p>
                    )}
                    {r.depositRefundedAt && <p>Kaucja rozliczona {fmtDate(r.depositRefundedAt)}</p>}
                  </div>
                </div>

                {r.notes && <pre className="text-[11px] text-[#E0E0E0]/50 whitespace-pre-wrap bg-[#2B2D31] rounded p-2">{r.notes}</pre>}

                <div className="flex flex-wrap items-center gap-2">
                  {(r.status === "paid" || r.status === "active") && (
                    <>
                      <input
                        className={`${input} w-44 font-mono uppercase`}
                        placeholder="Device ID"
                        maxLength={12}
                        value={deviceInput[r.id] ?? ""}
                        onChange={(e) => setDeviceInput((m) => ({ ...m, [r.id]: e.target.value.toUpperCase() }))}
                      />
                      <button type="button" disabled={busy === r.id || !(deviceInput[r.id] || "").trim()}
                        onClick={() => act(r, "assign", { deviceId: deviceInput[r.id] }, "kalkulator przypisany, najem ruszył.")}
                        className={`${btn} bg-[#3B82F6] text-white`}>
                        {r.deviceId ? "Zmień kalkulator" : "Przypisz i rozpocznij najem"}
                      </button>
                    </>
                  )}
                  {r.status === "active" && (
                    <>
                      <button type="button" disabled={busy === r.id}
                        onClick={() => { const d = prompt("O ile dni przedłużyć? (po dopłacie)", "7"); if (d) void act(r, "extend", { days: Number(d) }, `przedłużono o ${d} dni.`); }}
                        className={`${btn} bg-[#2B2D31] border border-[#3F4147] text-[#E0E0E0]/80`}>
                        Przedłuż
                      </button>
                      <button type="button" disabled={busy === r.id}
                        onClick={() => { if (confirm("Kalkulator dotarł z powrotem? Zostanie odpięty od konta najemcy i zablokowany do następnego najmu.")) void act(r, "return", {}, "zwrot przyjęty — zrób reset fabryczny i zwróć kaucję."); }}
                        className={`${btn} bg-green-600/80 text-white`}>
                        Przyjmij zwrot
                      </button>
                    </>
                  )}
                  {(r.status === "returned" || r.status === "cancelled") && !r.depositRefundedAt && r.depositGrosze > 0 && (
                    <button type="button" disabled={busy === r.id}
                      onClick={() => {
                        const note = prompt("Kaucja zwrócona. Jeśli coś potrąciłeś, wpisz ile i za co (puste = zwrot w całości):", "");
                        if (note !== null) void act(r, "deposit", { note }, "kaucja rozliczona.");
                      }}
                      className={`${btn} bg-amber-500/20 border border-amber-500/40 text-amber-200`}>
                      Kaucja zwrócona
                    </button>
                  )}
                  {(r.status === "pending" || r.status === "paid" || r.status === "active") && (
                    <button type="button" disabled={busy === r.id}
                      onClick={() => { const reason = prompt("Powód anulowania (np. zwrot pieniędzy przed wysyłką):", ""); if (reason !== null) void act(r, "cancel", { reason }, "anulowane."); }}
                      className={`${btn} bg-red-500/10 border border-red-500/30 text-red-300`}>
                      Anuluj
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
