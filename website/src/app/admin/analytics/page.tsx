"use client";

import { useState, useEffect, useCallback } from "react";
import AdminShell from "@/components/admin/AdminShell";

// ----------------------------------------------------------------
// Typy
// ----------------------------------------------------------------
interface VisitData {
  period: { days: number; since: string };
  overview: {
    totalViews: number;
    uniqueVisitors: number;
    todayViews: number;
    todayUnique: number;
    yesterdayViews: number;
    avgDailyViews: number;
  };
  daily: Array<{ date: string; views: number; unique: number }>;
  topPages: Array<{ page: string; views: number }>;
  referrers: Array<{ source: string; count: number }>;
  devices: { mobile: number; desktop: number };
  funnel: Array<{ page: string; views: number; unique: number }>;
  hourly: Array<{ hour: number; count: number }>;
  byDomain: Array<{ domain: string; views: number; unique: number }>;
  sources?: SourcesData;
}

interface SourceAgg { sessions: number; orders: number; pln: number; eur: number }
interface SourcesData {
  channels: Array<SourceAgg & { channel: string; label: string }>;
  top: Array<SourceAgg & { channel: string; label: string; source: string }>;
  campaigns: Array<SourceAgg & { campaign: string; source: string }>;
  totalOrders: number;
  unattributed: number;
  trackedSessions: number;
}

function fmtRevenue(a: SourceAgg) {
  const parts = [];
  if (a.pln) parts.push(`${Math.round(a.pln / 100).toLocaleString("pl-PL")} zł`);
  if (a.eur) parts.push(`${Math.round(a.eur / 100).toLocaleString("pl-PL")} €`);
  return parts.join(" + ") || "—";
}

function convRate(a: SourceAgg) {
  if (!a.sessions) return a.orders ? "—" : "0%";
  return `${((a.orders / a.sessions) * 100).toFixed(1)}%`;
}

function SourcesTable({ rows, first }: { rows: Array<SourceAgg & { key: string; name: string; sub?: string }>; first: string }) {
  if (!rows.length) return <p className="text-sm text-[#E0E0E0]/30">Brak danych w tym okresie</p>;
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm min-w-[520px]">
        <thead>
          <tr className="text-xs text-[#E0E0E0]/40 text-left">
            <th className="font-medium px-2 pb-2">{first}</th>
            <th className="font-medium px-2 pb-2 text-right">Wejścia</th>
            <th className="font-medium px-2 pb-2 text-right">Zamówienia</th>
            <th className="font-medium px-2 pb-2 text-right">Przychód</th>
            <th className="font-medium px-2 pb-2 text-right">Konwersja</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-[#3F4147]/60">
              <td className="px-2 py-2 text-[#E0E0E0]/90">
                {r.name}
                {r.sub && <span className="block text-[11px] text-[#E0E0E0]/40">{r.sub}</span>}
              </td>
              <td className="px-2 py-2 text-right text-[#E0E0E0]/80">{r.sessions}</td>
              <td className={`px-2 py-2 text-right font-medium ${r.orders ? "text-[#D8FF3D]" : "text-[#E0E0E0]/40"}`}>{r.orders}</td>
              <td className="px-2 py-2 text-right text-[#E0E0E0]/80 whitespace-nowrap">{fmtRevenue(r)}</td>
              <td className="px-2 py-2 text-right text-[#E0E0E0]/60">{convRate(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Generator linkow z UTM — do bio TikToka/Instagrama, opisow filmow, postow,
// reklam. Dzieki temu w tabeli wyzej widac, ktory kanal/kampania sprzedaje.
const UTM_PRESETS: Array<{ label: string; source: string; medium: string }> = [
  { label: "TikTok", source: "tiktok", medium: "social" },
  { label: "Instagram", source: "instagram", medium: "social" },
  { label: "YouTube", source: "youtube", medium: "video" },
  { label: "Facebook", source: "facebook", medium: "social" },
  { label: "Newsletter", source: "newsletter", medium: "email" },
  { label: "Reklama Google", source: "google", medium: "cpc" },
];

function UtmBuilder() {
  const [url, setUrl] = useState("https://kalkmate.pl/");
  const [source, setSource] = useState("tiktok");
  const [medium, setMedium] = useState("social");
  const [campaign, setCampaign] = useState("");
  const [copied, setCopied] = useState(false);
  const slug = (v: string) => v.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  let link = "";
  try {
    const u = new URL(url.trim());
    if (slug(source)) u.searchParams.set("utm_source", slug(source));
    if (slug(medium)) u.searchParams.set("utm_medium", slug(medium));
    if (slug(campaign)) u.searchParams.set("utm_campaign", slug(campaign));
    link = u.toString();
  } catch {
    link = "";
  }
  const field = "w-full min-w-0 bg-[#2B2D31] border border-[#3F4147] rounded-lg px-3 py-2 text-sm text-[#E0E0E0] focus:outline-none focus:border-[#3B82F6]";
  return (
    <div className="bg-[#313338] border border-[#3F4147] rounded-xl p-6">
      <h2 className="text-sm font-semibold text-[#E0E0E0] mb-1">Generator linków z UTM</h2>
      <p className="text-xs text-[#E0E0E0]/40 mb-4">Wklejaj taki link w bio, opisy filmów i posty — wtedy w tabeli wyżej zobaczysz, ile z niego było wejść i zamówień.</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {UTM_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => { setSource(p.source); setMedium(p.medium); }}
            className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
              source === p.source && medium === p.medium ? "bg-[#3B82F6] border-[#3B82F6] text-white" : "bg-[#2B2D31] border-[#3F4147] text-[#E0E0E0]/70 hover:bg-[#3F4147]"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <input className={field} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Adres strony" aria-label="Adres strony" />
        <input className={field} value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="Kampania, np. film-promo-pazdziernik" aria-label="Kampania" />
        <input className={field} value={source} onChange={(e) => setSource(e.target.value)} placeholder="Źródło (utm_source)" aria-label="Źródło" />
        <input className={field} value={medium} onChange={(e) => setMedium(e.target.value)} placeholder="Medium (utm_medium)" aria-label="Medium" />
      </div>
      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        <code className="flex-1 min-w-0 break-all text-xs bg-[#1E1F22] border border-[#3F4147] rounded-lg px-3 py-2 text-[#D8FF3D]">{link || "Nieprawidłowy adres"}</code>
        <button
          type="button"
          disabled={!link}
          onClick={() => { navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[#3B82F6] hover:bg-[#2f6fd6] text-white disabled:opacity-50"
        >
          {copied ? "Skopiowano ✓" : "Kopiuj"}
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function fmtDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

function fmtPage(page: string) {
  if (page === "/") return "/ (Strona główna)";
  return page;
}

function pct(val: number, total: number) {
  if (!total) return 0;
  return Math.round((val / total) * 100);
}

// ----------------------------------------------------------------
// Komponenty pomocnicze
// ----------------------------------------------------------------
function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-[#313338] border border-[#3F4147] rounded-xl p-5">
      <p className="text-xs font-medium text-[#E0E0E0]/40 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p
        className={`text-3xl font-bold ${accent ? "text-[#3B82F6]" : "text-[#E0E0E0]"}`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-[#E0E0E0]/40 mt-1">{sub}</p>}
    </div>
  );
}

function MiniBar({
  value,
  max,
  color = "bg-[#3B82F6]",
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const w = max ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 rounded-full bg-[#3F4147] overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
    </div>
  );
}

// ----------------------------------------------------------------
// Wykres liniowy (SVG sparkline)
// ----------------------------------------------------------------
function LineChart({
  data,
  keyViews,
  keyUnique,
}: {
  data: Array<{ date: string; views: number; unique: number }>;
  keyViews: "views" | "unique";
  keyUnique: "views" | "unique";
}) {
  const W = 600;
  const H = 120;
  const PAD = 8;

  const vVals = data.map((d) => d[keyViews]);
  const uVals = data.map((d) => d[keyUnique]);
  const maxV = Math.max(...vVals, 1);

  function toPath(vals: number[]) {
    if (!vals.length) return "";
    const xStep = (W - PAD * 2) / Math.max(vals.length - 1, 1);
    return vals
      .map((v, i) => {
        const x = PAD + i * xStep;
        const y = H - PAD - ((v / maxV) * (H - PAD * 2));
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  const lastLabel = data[data.length - 1]?.date;
  const midLabel = data[Math.floor(data.length / 2)]?.date;
  const firstLabel = data[0]?.date;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" style={{ minWidth: 320 }}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map((frac) => {
          const y = H - PAD - frac * (H - PAD * 2);
          return (
            <line
              key={frac}
              x1={PAD}
              y1={y}
              x2={W - PAD}
              y2={y}
              stroke="#3F4147"
              strokeWidth="1"
            />
          );
        })}
        {/* Views line */}
        <path
          d={toPath(vVals)}
          fill="none"
          stroke="#3B82F6"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Unique line */}
        <path
          d={toPath(uVals)}
          fill="none"
          stroke="#D8FF3D"
          strokeWidth="1.5"
          strokeDasharray="4 2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* X labels */}
        {[firstLabel, midLabel, lastLabel].map((label, i) => {
          const positions = [PAD, W / 2, W - PAD];
          const anchors = ["start", "middle", "end"] as const;
          return (
            <text
              key={i}
              x={positions[i]}
              y={H + 16}
              textAnchor={anchors[i]}
              fontSize="10"
              fill="#6B6863"
            >
              {label ? fmtDate(label) : ""}
            </text>
          );
        })}
      </svg>
      <div className="flex gap-4 mt-1 text-xs text-[#E0E0E0]/40">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-[#3B82F6] rounded" />
          Wyświetlenia
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-[#D8FF3D] rounded" />
          Unikalni
        </span>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Wykres słupkowy godzinowy
// ----------------------------------------------------------------
function HourlyChart({ data }: { data: Array<{ hour: number; count: number }> }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-0.5 h-16">
      {data.map(({ hour, count }) => (
        <div
          key={hour}
          className="flex-1 flex flex-col items-center gap-0.5 group"
          title={`${hour}:00 — ${count} wejść`}
        >
          <div
            className="w-full rounded-sm bg-[#3B82F6]/70 group-hover:bg-[#3B82F6] transition-colors"
            style={{ height: `${Math.max(2, (count / max) * 56)}px` }}
          />
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------
// Główna strona
// ----------------------------------------------------------------
const PERIOD_OPTIONS = [
  { label: "7 dni", value: 7 },
  { label: "30 dni", value: 30 },
  { label: "90 dni", value: 90 },
];

export default function AnalyticsPage() {
  const [data, setData] = useState<VisitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics/visits?days=${days}`);
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalDevices = data
    ? data.devices.mobile + data.devices.desktop
    : 0;
  const totalReferrers = data
    ? data.referrers.reduce((s, r) => s + r.count, 0)
    : 0;
  const funnelMax = data?.funnel[0]?.views || 1;

  const funnelLabels: Record<string, string> = {
    "/": "Strona główna",
    "/koszyk": "Koszyk",
    "/auth/signin": "Logowanie",
    "/panel": "Panel klienta",
  };

  return (
    <AdminShell>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#E0E0E0]">Analityka</h1>
          <p className="text-sm text-[#E0E0E0]/40 mt-0.5">
            Ruch na stronie i zachowanie użytkowników
          </p>
        </div>
        <div className="flex gap-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                days === opt.value
                  ? "bg-[#3B82F6] text-white"
                  : "bg-[#313338] text-[#E0E0E0]/60 hover:text-[#E0E0E0] border border-[#3F4147]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-[#E0E0E0]/40 text-sm py-12 text-center">
          Ładowanie danych...
        </div>
      ) : !data ? (
        <div className="text-red-400 text-sm">Błąd ładowania.</div>
      ) : (
        <div className="space-y-6">
          {/* ---- Stat cards ---- */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Wyświetlenia (okres)"
              value={data.overview.totalViews.toLocaleString("pl-PL")}
              sub={`śr. ${data.overview.avgDailyViews}/dzień`}
            />
            <StatCard
              label="Unikalni odwiedzający"
              value={data.overview.uniqueVisitors.toLocaleString("pl-PL")}
              sub={`ostatnie ${days} dni`}
              accent
            />
            <StatCard
              label="Dzisiaj"
              value={data.overview.todayViews}
              sub={`${data.overview.todayUnique} unikalnych`}
            />
            <StatCard
              label="Wczoraj"
              value={data.overview.yesterdayViews}
              sub={
                data.overview.yesterdayViews > 0
                  ? data.overview.todayViews > data.overview.yesterdayViews
                    ? "▲ więcej niż wczoraj"
                    : "▼ mniej niż wczoraj"
                  : "brak danych"
              }
            />
          </div>

          {/* ---- Zrodla i sprzedaz (lib/attribution.ts) ---- */}
          {data.sources && (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-[#313338] border border-[#3F4147] rounded-xl p-6">
                <h2 className="text-sm font-semibold text-[#E0E0E0] mb-1">Źródła i sprzedaż — kanały</h2>
                <p className="text-xs text-[#E0E0E0]/40 mb-4">
                  Wejścia na stronę i opłacone zamówienia wg ostatniego źródła przed zakupem.
                  {data.sources.unattributed > 0 && ` ${data.sources.unattributed} z ${data.sources.totalOrders} zamówień bez źródła (sprzed włączenia śledzenia).`}
                </p>
                <SourcesTable first="Kanał" rows={data.sources.channels.map((c) => ({ ...c, key: c.channel, name: c.label }))} />
              </div>
              <div className="bg-[#313338] border border-[#3F4147] rounded-xl p-6">
                <h2 className="text-sm font-semibold text-[#E0E0E0] mb-1">Źródła — szczegóły</h2>
                <p className="text-xs text-[#E0E0E0]/40 mb-4">Konkretne serwisy (google, tiktok, chatgpt…) i strony polecające.</p>
                <SourcesTable first="Źródło" rows={data.sources.top.map((c) => ({ ...c, key: `${c.channel}|${c.source}`, name: c.source, sub: c.label }))} />
              </div>
              <div className="bg-[#313338] border border-[#3F4147] rounded-xl p-6">
                <h2 className="text-sm font-semibold text-[#E0E0E0] mb-1">Kampanie (UTM)</h2>
                <p className="text-xs text-[#E0E0E0]/40 mb-4">Linki z parametrem utm_campaign — newslettery, posty, reklamy.</p>
                <SourcesTable first="Kampania" rows={data.sources.campaigns.map((c) => ({ ...c, key: `${c.campaign}|${c.source}`, name: c.campaign, sub: c.source }))} />
              </div>
              <UtmBuilder />
            </div>
          )}

          {/* ---- Wykres dzienny ---- */}
          <div className="bg-[#313338] border border-[#3F4147] rounded-xl p-6">
            <h2 className="text-sm font-semibold text-[#E0E0E0] mb-4">
              Ruch dzienny — ostatnie {days} dni
            </h2>
            <LineChart
              data={data.daily}
              keyViews="views"
              keyUnique="unique"
            />
          </div>

          {/* ---- Domeny (kalkmate.pl vs kalkmate.eu) ---- */}
          {data.byDomain.length > 0 && (
            <div className="bg-[#313338] border border-[#3F4147] rounded-xl p-6">
              <h2 className="text-sm font-semibold text-[#E0E0E0] mb-4">
                Ruch wg domeny
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {data.byDomain.map(({ domain, views, unique }) => (
                  <div key={domain} className="bg-[#2B2D31] border border-[#3F4147]/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-mono text-[#E0E0E0]">{domain}</span>
                      <span className="text-xs text-[#E0E0E0]/40">{pct(views, data.overview.totalViews)}%</span>
                    </div>
                    <p className="text-2xl font-bold text-[#E0E0E0]">{views}</p>
                    <p className="text-xs text-[#E0E0E0]/50">{unique} unikalnych</p>
                    <MiniBar value={views} max={data.byDomain[0]?.views || 1} color="bg-[#3B82F6]" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ---- Top pages + Referrers ---- */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Top pages */}
            <div className="bg-[#313338] border border-[#3F4147] rounded-xl p-6">
              <h2 className="text-sm font-semibold text-[#E0E0E0] mb-4">
                Najpopularniejsze strony
              </h2>
              <div className="space-y-3">
                {data.topPages.map(({ page, views }) => (
                  <div key={page}>
                    <div className="flex justify-between items-center mb-1">
                      <span
                        className="text-sm text-[#E0E0E0]/80 font-mono truncate max-w-[70%]"
                        title={page}
                      >
                        {fmtPage(page)}
                      </span>
                      <span className="text-sm text-[#E0E0E0] font-medium ml-2 shrink-0">
                        {views}
                        <span className="text-[#E0E0E0]/30 text-xs ml-1">
                          ({pct(views, data.overview.totalViews)}%)
                        </span>
                      </span>
                    </div>
                    <MiniBar value={views} max={data.topPages[0]?.views || 1} />
                  </div>
                ))}
                {data.topPages.length === 0 && (
                  <p className="text-sm text-[#E0E0E0]/30">Brak danych</p>
                )}
              </div>
            </div>

            {/* Referrers */}
            <div className="bg-[#313338] border border-[#3F4147] rounded-xl p-6">
              <h2 className="text-sm font-semibold text-[#E0E0E0] mb-4">
                Źródła ruchu
              </h2>
              <div className="space-y-3">
                {data.referrers.map(({ source, count }) => (
                  <div key={source}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-[#E0E0E0]/80">
                        {source}
                      </span>
                      <span className="text-sm text-[#E0E0E0] font-medium">
                        {count}
                        <span className="text-[#E0E0E0]/30 text-xs ml-1">
                          ({pct(count, totalReferrers)}%)
                        </span>
                      </span>
                    </div>
                    <MiniBar
                      value={count}
                      max={data.referrers[0]?.count || 1}
                      color="bg-[#D8FF3D]"
                    />
                  </div>
                ))}
                {data.referrers.length === 0 && (
                  <p className="text-sm text-[#E0E0E0]/30">Brak danych</p>
                )}
              </div>
            </div>
          </div>

          {/* ---- Lejek + Urządzenia ---- */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Lejek konwersji */}
            <div className="bg-[#313338] border border-[#3F4147] rounded-xl p-6">
              <h2 className="text-sm font-semibold text-[#E0E0E0] mb-1">
                Lejek konwersji
              </h2>
              <p className="text-xs text-[#E0E0E0]/40 mb-4">
                Ile unikalnych wizyt na kluczowych stronach
              </p>
              <div className="space-y-4">
                {data.funnel.map(({ page, views, unique }) => (
                  <div key={page}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-[#E0E0E0]/80">
                        {funnelLabels[page] || page}
                      </span>
                      <div className="text-right">
                        <span className="text-sm font-medium text-[#E0E0E0]">
                          {unique} unikalnych
                        </span>
                        <span className="text-xs text-[#E0E0E0]/30 ml-1.5">
                          ({views} total)
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-[#3F4147] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#3B82F6] to-[#D8FF3D]"
                        style={{
                          width: `${Math.max(2, pct(unique, data.funnel[0]?.unique || 1))}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-[#E0E0E0]/30 mt-0.5">
                      {data.funnel[0]?.unique
                        ? `${pct(unique, data.funnel[0].unique)}% odwiedzających stronę główną`
                        : "—"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Urządzenia + godziny */}
            <div className="space-y-6">
              {/* Urządzenia */}
              <div className="bg-[#313338] border border-[#3F4147] rounded-xl p-6">
                <h2 className="text-sm font-semibold text-[#E0E0E0] mb-4">
                  Typy urządzeń
                </h2>
                {totalDevices > 0 ? (
                  <>
                    <div className="flex gap-2 mb-3">
                      <div
                        className="h-8 bg-[#3B82F6] rounded-l-lg flex items-center justify-center text-xs font-bold text-white"
                        style={{
                          width: `${pct(data.devices.desktop, totalDevices)}%`,
                          minWidth: "2rem",
                        }}
                      >
                        {pct(data.devices.desktop, totalDevices)}%
                      </div>
                      <div
                        className="h-8 bg-[#D8FF3D] rounded-r-lg flex items-center justify-center text-xs font-bold text-black"
                        style={{
                          width: `${pct(data.devices.mobile, totalDevices)}%`,
                          minWidth: "2rem",
                        }}
                      >
                        {pct(data.devices.mobile, totalDevices)}%
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm bg-[#3B82F6]" />
                        <span className="text-[#E0E0E0]/70">Desktop</span>
                        <span className="text-[#E0E0E0] font-medium">
                          {data.devices.desktop}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm bg-[#D8FF3D]" />
                        <span className="text-[#E0E0E0]/70">Mobile</span>
                        <span className="text-[#E0E0E0] font-medium">
                          {data.devices.mobile}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-[#E0E0E0]/30">Brak danych</p>
                )}
              </div>

              {/* Aktywność godzinowa */}
              <div className="bg-[#313338] border border-[#3F4147] rounded-xl p-6">
                <h2 className="text-sm font-semibold text-[#E0E0E0] mb-1">
                  Aktywność wg godziny
                </h2>
                <p className="text-xs text-[#E0E0E0]/40 mb-4">
                  Kiedy użytkownicy odwiedzają stronę
                </p>
                <HourlyChart data={data.hourly} />
                <div className="flex justify-between text-xs text-[#E0E0E0]/30 mt-1">
                  <span>0:00</span>
                  <span>12:00</span>
                  <span>23:00</span>
                </div>
                {data.hourly.length > 0 && (() => {
                  const peak = data.hourly.reduce((a, b) =>
                    b.count > a.count ? b : a
                  );
                  return (
                    <p className="text-xs text-[#E0E0E0]/40 mt-2">
                      Szczyt: <span className="text-[#E0E0E0]/70">{peak.hour}:00</span>
                      {" "}({peak.count} wejść)
                    </p>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
