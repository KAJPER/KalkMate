"use client";

// Lejek zakupowy (GET /api/admin/funnel, lib/funnel.ts): sekcja kupna w widoku
// -> formularz -> wyslany -> platnosc -> oplacone. Anonimowe zdarzenia bez
// cookies (dzialaja bez zgody na analityke); "oplacone" z tabeli Order.

import { useEffect, useState } from "react";

type Key = "view_buy" | "sticky_click" | "form_open" | "form_submit" | "payment_start" | "paid";
type Counts = Record<Key, number>;
interface FunnelData {
  days: string[];
  daily: Record<string, Counts>;
  totals: Counts;
  byDevice: Record<"mobile" | "desktop" | "unknown", Counts>;
  byLang: Record<string, Counts>;
}

const STEPS: Array<{ key: Exclude<Key, "sticky_click">; label: string }> = [
  { key: "view_buy", label: "Sekcja kupna w widoku" },
  { key: "form_open", label: "Otwarcie formularza" },
  { key: "form_submit", label: "Formularz wysłany" },
  { key: "payment_start", label: "Płatność rozpoczęta" },
  { key: "paid", label: "Opłacone" },
];
const DAY_OPTIONS = [7, 14, 30, 90];

function conv(cur: number, prev: number): string {
  if (!prev) return "—";
  return `${((cur / prev) * 100).toFixed(cur / prev < 0.1 ? 1 : 0)}%`;
}
function fmtDay(key: string) {
  const [, m, d] = key.split("-");
  return `${d}.${m}`;
}

export default function FunnelPanel() {
  const [days, setDays] = useState(14);
  const [data, setData] = useState<FunnelData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/funnel?days=${days}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 403 ? "Brak dostępu" : `Błąd ${res.status}`);
        return (await res.json()) as FunnelData;
      })
      .then((d) => { if (!cancelled) { setData(d); setError(""); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Błąd ładowania"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days]);

  const t = data?.totals;
  const max = t ? Math.max(1, ...STEPS.map((s) => t[s.key])) : 1;
  const mob = data?.byDevice.mobile;
  const desk = data?.byDevice.desktop;

  return (
    <div className="bg-[#313338] border border-[#3F4147] rounded-xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-[#E0E0E0]">Lejek zakupowy</h2>
          <p className="text-xs text-[#E0E0E0]/40 mt-0.5">
            Anonimowe zdarzenia (bez cookies, bez zgody). „Opłacone” z zamówień — bez podziału na urządzenie.
          </p>
        </div>
        <div className="flex gap-1.5">
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => { if (d !== days) { setDays(d); setLoading(true); } }}
              className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                days === d ? "bg-[#3B82F6] border-[#3B82F6] text-white" : "bg-[#2B2D31] border-[#3F4147] text-[#E0E0E0]/70 hover:bg-[#3F4147]"
              }`}
            >
              {d} dni
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
      {!data && loading && <p className="text-sm text-[#E0E0E0]/30">Ładowanie…</p>}

      {t && mob && desk && data && (
        <div className={`space-y-6 ${loading ? "opacity-60" : ""}`}>
          {/* Lejek — razem */}
          <div className="space-y-2.5">
            {STEPS.map((s, i) => {
              const v = t[s.key];
              const prev = i > 0 ? t[STEPS[i - 1].key] : 0;
              return (
                <div key={s.key}>
                  <div className="flex items-baseline justify-between gap-2 text-xs mb-1">
                    <span className="text-[#E0E0E0]/80">{s.label}</span>
                    <span className="text-[#E0E0E0]/50 whitespace-nowrap">
                      <span className="text-[#E0E0E0] font-semibold text-sm">{v}</span>
                      {i > 0 && <span className="ml-2">{conv(v, prev)} z poprz.</span>}
                    </span>
                  </div>
                  <div className="h-2.5 bg-[#2B2D31] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${s.key === "paid" ? "bg-[#D8FF3D]" : "bg-[#3B82F6]"}`}
                      style={{ width: `${Math.max(v ? 1.5 : 0, (v / max) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <p className="text-[11px] text-[#E0E0E0]/35">
              Otwarcia formularza mogą przekraczać widok sekcji — pasek mobilny i koszyk otwierają formularz bez przewijania do #kup-teraz.
              Płatność rozpoczęta: PL może utworzyć zarówno P24, jak i Stripe (karta) w jednej wizycie.
            </p>
          </div>

          {/* Mobile vs desktop + pasek */}
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm min-w-[420px]">
                <thead>
                  <tr className="text-xs text-[#E0E0E0]/40 text-left">
                    <th className="font-medium px-2 pb-2">Krok</th>
                    <th className="font-medium px-2 pb-2 text-right">Mobile</th>
                    <th className="font-medium px-2 pb-2 text-right">Konw.</th>
                    <th className="font-medium px-2 pb-2 text-right">Desktop</th>
                    <th className="font-medium px-2 pb-2 text-right">Konw.</th>
                  </tr>
                </thead>
                <tbody>
                  {STEPS.filter((s) => s.key !== "paid").map((s, i, arr) => (
                    <tr key={s.key} className="border-t border-[#3F4147]/60">
                      <td className="px-2 py-2 text-[#E0E0E0]/90">{s.label}</td>
                      <td className="px-2 py-2 text-right text-[#E0E0E0]/80">{mob[s.key]}</td>
                      <td className="px-2 py-2 text-right text-[#E0E0E0]/50">{i > 0 ? conv(mob[s.key], mob[arr[i - 1].key]) : ""}</td>
                      <td className="px-2 py-2 text-right text-[#E0E0E0]/80">{desk[s.key]}</td>
                      <td className="px-2 py-2 text-right text-[#E0E0E0]/50">{i > 0 ? conv(desk[s.key], desk[arr[i - 1].key]) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-[#2B2D31] border border-[#3F4147]/50 rounded-lg p-4 md:min-w-[180px]">
              <p className="text-xs font-medium text-[#E0E0E0]/40 uppercase tracking-wider mb-1">Kliknięcia paska</p>
              <p className="text-2xl font-bold text-[#D8FF3D]">{t.sticky_click}</p>
              <p className="text-xs text-[#E0E0E0]/40 mt-1">
                {mob.form_open ? `${conv(t.sticky_click, mob.form_open)} otwarć formularza na mobile` : "pasek „Zamów” na mobile"}
              </p>
            </div>
          </div>

          {/* Jezyki */}
          {Object.keys(data.byLang).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.byLang)
                .sort((a, b) => b[1].view_buy + b[1].form_open - (a[1].view_buy + a[1].form_open))
                .map(([lang, c]) => (
                  <span key={lang} className="text-xs bg-[#2B2D31] border border-[#3F4147]/60 rounded-md px-2 py-1 text-[#E0E0E0]/70">
                    <span className="text-[#E0E0E0] font-medium uppercase">{lang}</span>{" "}
                    {c.view_buy} → {c.form_open} → {c.form_submit} → {c.payment_start}
                  </span>
                ))}
            </div>
          )}

          {/* Per dzien */}
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-xs text-[#E0E0E0]/40 text-left">
                  <th className="font-medium px-2 pb-2">Dzień</th>
                  <th className="font-medium px-2 pb-2 text-right">Widok</th>
                  <th className="font-medium px-2 pb-2 text-right">Pasek</th>
                  <th className="font-medium px-2 pb-2 text-right">Formularz</th>
                  <th className="font-medium px-2 pb-2 text-right">Wysłany</th>
                  <th className="font-medium px-2 pb-2 text-right">Płatność</th>
                  <th className="font-medium px-2 pb-2 text-right">Opłacone</th>
                </tr>
              </thead>
              <tbody>
                {[...data.days].reverse().map((d) => {
                  const c = data.daily[d];
                  if (!c) return null;
                  return (
                    <tr key={d} className="border-t border-[#3F4147]/60">
                      <td className="px-2 py-1.5 text-[#E0E0E0]/90">{fmtDay(d)}</td>
                      <td className="px-2 py-1.5 text-right text-[#E0E0E0]/80">{c.view_buy}</td>
                      <td className="px-2 py-1.5 text-right text-[#E0E0E0]/60">{c.sticky_click}</td>
                      <td className="px-2 py-1.5 text-right text-[#E0E0E0]/80">{c.form_open}</td>
                      <td className="px-2 py-1.5 text-right text-[#E0E0E0]/80">{c.form_submit}</td>
                      <td className="px-2 py-1.5 text-right text-[#E0E0E0]/80">{c.payment_start}</td>
                      <td className={`px-2 py-1.5 text-right font-medium ${c.paid ? "text-[#D8FF3D]" : "text-[#E0E0E0]/40"}`}>{c.paid}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
