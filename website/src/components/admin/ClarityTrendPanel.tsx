"use client";

// Trendy Microsoft Clarity z dziennych snapshotow (src/lib/clarity.ts,
// GET/POST /api/admin/clarity). Wykresy w czystym SVG, bez bibliotek.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/components/admin/toast";

// ----------------------------------------------------------------
// Typy (zgodne z ClarityTrends w lib/clarity.ts)
// ----------------------------------------------------------------
interface Row {
  day: string;
  dimension: "" | "Device" | "URL";
  dimValue: string;
  sessions: number | null;
  bots: number | null;
  users: number | null;
  pagesPerSession: number | null;
  scrollDepth: number | null;
  totalTime: number | null;
  activeTime: number | null;
  deadClicks: number | null;
  deadClickSessionsPct: number | null;
  rageClicks: number | null;
  rageClickSessionsPct: number | null;
  quickbacks: number | null;
  quickbackSessionsPct: number | null;
  scriptErrors: number | null;
  excessiveScroll: number | null;
  createdAt: number;
}

interface Quota {
  callsLast24h: number;
  autoBudget: number;
  hardCap: number;
  remainingManual: number;
  lastAttemptAt: number | null;
  lastOk: boolean | null;
  lastError: string | null;
}

interface TrendsData {
  ok: boolean;
  configured: boolean;
  days: number;
  since: string;
  overall: Row[];
  devices: Record<string, Row[]>;
  topUrls: { day: string | null; createdAt: number | null; rows: Row[] };
  quota: Quota;
}

type MetricKey = "sessions" | "scrollDepth" | "activeTime" | "deadClickSessionsPct" | "rageClickSessionsPct" | "quickbackSessionsPct";

interface MetricDef {
  key: MetricKey;
  label: string;
  fmt: (v: number) => string;
  bars?: boolean;
  lowerIsBetter?: boolean;
}

// ----------------------------------------------------------------
// Formatowanie
// ----------------------------------------------------------------
const fmtInt = (v: number) => Math.round(v).toLocaleString("pl-PL");
const fmtPct = (v: number) => `${v.toLocaleString("pl-PL", { maximumFractionDigits: 1 })}%`;
function fmtSec(v: number) {
  const s = Math.round(v);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function fmtDay(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}
function fmtDateTime(ms: number) {
  return new Date(ms).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function fmtPath(url: string) {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname === "/" ? "/" : u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

const METRICS: MetricDef[] = [
  { key: "sessions", label: "Sesje", fmt: fmtInt, bars: true },
  { key: "scrollDepth", label: "Śr. głębokość scrolla", fmt: fmtPct },
  { key: "activeTime", label: "Aktywny czas", fmt: fmtSec },
  { key: "deadClickSessionsPct", label: "Dead clicks (% sesji)", fmt: fmtPct, lowerIsBetter: true },
  { key: "rageClickSessionsPct", label: "Rage clicks (% sesji)", fmt: fmtPct, lowerIsBetter: true },
  { key: "quickbackSessionsPct", label: "Quickback (% sesji)", fmt: fmtPct, lowerIsBetter: true },
];

// Kolory urzadzen (Clarity: PC / Mobile / Tablet / Other)
const DEVICE_COLORS: Record<string, string> = {
  PC: "#3B82F6",
  Mobile: "#D8FF3D",
  Tablet: "#A78BFA",
};
const DEVICE_LABELS: Record<string, string> = { PC: "Desktop", Mobile: "Mobile", Tablet: "Tablet" };
const devColor = (d: string) => DEVICE_COLORS[d] || "#9CA3AF";
const devLabel = (d: string) => DEVICE_LABELS[d] || d;

// Wszystkie dni okresu (luki = brak snapshotu)
function dayRange(since: string, until: string): string[] {
  const out: string[] = [];
  let t = Date.parse(`${since}T00:00:00Z`);
  const end = Date.parse(`${until}T00:00:00Z`);
  while (t <= end && out.length < 400) {
    out.push(new Date(t).toISOString().slice(0, 10));
    t += 86_400_000;
  }
  return out;
}

function avg(vals: (number | null)[]): number | null {
  const v = vals.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

// Srednia wazona sesjami (dla % i czasow), suma dla sesji.
function aggregate(rows: Row[], key: MetricKey): number | null {
  if (key === "sessions") {
    const v = rows.map((r) => r.sessions).filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) : null;
  }
  let w = 0;
  let s = 0;
  for (const r of rows) {
    const v = r[key];
    if (v === null) continue;
    const weight = r.sessions ?? 1;
    w += weight;
    s += v * weight;
  }
  return w ? s / w : avg(rows.map((r) => r[key]));
}

// ----------------------------------------------------------------
// Wykres (linie lub slupki), SVG
// ----------------------------------------------------------------
interface Series {
  name: string;
  color: string;
  values: (number | null)[];
}

function TrendChart({ days, series, fmt, bars }: { days: string[]; series: Series[]; fmt: (v: number) => string; bars?: boolean }) {
  const W = 320;
  const H = 96;
  const PX = 4;
  const PY = 8;
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const max = Math.max(...all, 0) || 1;
  const n = days.length;
  const xStep = (W - PX * 2) / Math.max(n - 1, 1);
  const x = (i: number) => (n === 1 ? W / 2 : PX + i * xStep);
  const y = (v: number) => H - PY - (v / max) * (H - PY * 2);

  // Linia przerywana na lukach (osobne segmenty)
  function segments(vals: (number | null)[]) {
    const out: string[] = [];
    let cur = "";
    vals.forEach((v, i) => {
      if (v === null) {
        if (cur) out.push(cur);
        cur = "";
        return;
      }
      cur += `${cur ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
    });
    if (cur) out.push(cur);
    return out;
  }

  const barW = Math.max(2, ((W - PX * 2) / Math.max(n, 1)) * 0.7);
  const labels = n ? [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i) : [];

  return (
    <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full h-auto" role="img">
      {[0.5, 1].map((f) => (
        <line key={f} x1={PX} x2={W - PX} y1={y(max * f)} y2={y(max * f)} stroke="#3F4147" strokeWidth="1" />
      ))}
      <line x1={PX} x2={W - PX} y1={H - PY} y2={H - PY} stroke="#3F4147" strokeWidth="1" />
      <text x={W - PX} y={y(max) - 2} textAnchor="end" fontSize="9" fill="#6B6863">{fmt(max)}</text>
      {bars
        ? series[0]?.values.map((v, i) =>
            v === null ? null : (
              <rect key={i} x={x(i) - barW / 2} y={y(v)} width={barW} height={Math.max(1, H - PY - y(v))} rx="1" fill={series[0].color} opacity="0.8">
                <title>{`${fmtDay(days[i])}: ${fmt(v)}`}</title>
              </rect>
            ),
          )
        : series.map((s) => (
            <g key={s.name}>
              {segments(s.values).map((d, k) => (
                <path key={k} d={d} fill="none" stroke={s.color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
              ))}
              {s.values.map((v, i) =>
                v === null ? null : (
                  <circle key={i} cx={x(i)} cy={y(v)} r={n > 40 ? 1.2 : 2} fill={s.color}>
                    <title>{`${s.name} ${fmtDay(days[i])}: ${fmt(v)}`}</title>
                  </circle>
                ),
              )}
            </g>
          ))}
      {labels.map((i, k) => (
        <text
          key={i}
          x={x(i)}
          y={H + 12}
          textAnchor={labels.length === 1 ? "middle" : k === 0 ? "start" : k === labels.length - 1 ? "end" : "middle"}
          fontSize="9"
          fill="#6B6863"
        >
          {fmtDay(days[i])}
        </text>
      ))}
    </svg>
  );
}

function Legend({ series }: { series: Series[] }) {
  return (
    <div className="flex flex-wrap gap-3 mt-1 text-xs text-[#E0E0E0]/50">
      {series.map((s) => (
        <span key={s.name} className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------
// Panel
// ----------------------------------------------------------------
const PERIODS = [7, 30, 90];

async function fetchTrends(days: number): Promise<{ data: TrendsData; error?: undefined } | { data?: undefined; error: string }> {
  try {
    const res = await fetch(`/api/admin/clarity?days=${days}`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) return { error: json?.error || `Nie udało się pobrać danych (HTTP ${res.status})` };
    return { data: json as TrendsData };
  } catch {
    return { error: "Błąd sieci" };
  }
}

export default function ClarityTrendPanel() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [fetching, setFetching] = useState(false);
  const [devMetric, setDevMetric] = useState<MetricKey>("deadClickSessionsPct");
  const reqId = useRef(0);

  // Fetch bez setState; stan ustawiany w .then (react-hooks/set-state-in-effect).
  const load = useCallback(() => {
    const id = ++reqId.current;
    fetchTrends(days).then((r) => {
      if (id !== reqId.current) return;
      if (r.data) {
        setErr("");
        setData(r.data);
      } else setErr(r.error);
      setLoading(false);
    });
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  async function fetchNow(force = false) {
    if (force && !confirm("Pobrać snapshot ponownie?\n\nZużyje 3 z 10 dziennych zapytań do Clarity API.")) return;
    setFetching(true);
    try {
      const res = await fetch(`/api/admin/clarity${force ? "?force=1" : ""}`, { method: "POST" });
      const json = await res.json().catch(() => null);
      const msg: string = json?.message || json?.error || `HTTP ${res.status}`;
      if (json?.skipped === "exists") {
        toast(msg, "info");
      } else if (res.ok && json?.ok) {
        toast(msg, json.errors?.length ? "info" : "success");
        load();
      } else {
        toast(msg, "error");
      }
    } catch {
      toast("Błąd sieci", "error");
    } finally {
      setFetching(false);
    }
  }

  const view = useMemo(() => {
    if (!data) return null;
    const lastDay = data.overall.length ? data.overall[data.overall.length - 1].day : null;
    const allDays = Object.values(data.devices).flat().map((r) => r.day).concat(data.overall.map((r) => r.day));
    const until = allDays.sort().at(-1) ?? lastDay;
    const range = until ? dayRange(data.since > until ? until : data.since, until) : [];
    const byDay = new Map(data.overall.map((r) => [r.day, r]));
    const devices = Object.keys(data.devices).sort((a, b) => {
      const order = ["Mobile", "PC", "Tablet"];
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });
    const devByDay: Record<string, Map<string, Row>> = {};
    for (const d of devices) devByDay[d] = new Map(data.devices[d].map((r) => [r.day, r]));
    return { range, byDay, devices, devByDay, last: lastDay ? byDay.get(lastDay) ?? null : null };
  }, [data]);

  const card = "bg-[#313338] border border-[#3F4147] rounded-xl p-6";
  const btn = "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors";
  const q = data?.quota;
  const hasData = !!data && data.overall.length > 0;

  return (
    <div className="space-y-6">
      {/* ---- Naglowek ---- */}
      <div className={card}>
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#E0E0E0]">Microsoft Clarity — trendy</h2>
            <p className="text-xs text-[#E0E0E0]/40 mt-1 max-w-xl">
              Dzienny snapshot z Clarity Data Export API (API pamięta tylko 1–3 dni). Każdy dzień = 24h przed pobraniem;
              automat pobiera ok. 06:00, więc dzień na wykresie to głównie ta data. Limit: 10 zapytań/dobę, jedno pobranie = 3.
            </p>
            {q && (
              <p className="text-xs text-[#E0E0E0]/40 mt-2">
                Zapytania w ostatnich 24h: <span className="text-[#E0E0E0]/70">{q.callsLast24h}/{q.hardCap}</span>
                {q.lastAttemptAt && (
                  <>
                    {" · "}ostatnie pobranie: {fmtDateTime(q.lastAttemptAt)}{" "}
                    {q.lastOk ? <span className="text-green-400">OK</span> : <span className="text-red-400" title={q.lastError || ""}>błąd</span>}
                  </>
                )}
              </p>
            )}
            {q?.lastOk === false && q.lastError && (
              <p className="text-xs text-red-400/80 mt-1 break-words max-w-xl">{q.lastError}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-1 shrink-0">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => {
                  if (p === days) return;
                  setLoading(true);
                  setDays(p);
                }}
                className={`${btn} ${days === p ? "bg-[#3B82F6] text-white" : "bg-[#2B2D31] text-[#E0E0E0]/60 hover:text-[#E0E0E0] border border-[#3F4147]"}`}
              >
                {p} dni
              </button>
            ))}
            <button
              onClick={() => fetchNow(false)}
              disabled={fetching || (data !== null && !data.configured)}
              className={`${btn} bg-[#D8FF3D] text-[#1E1F22] hover:bg-[#D8FF3D]/90 disabled:opacity-40 ml-1`}
              title={data && !data.configured ? "Brak CLARITY_API_TOKEN na serwerze" : "Pobierz snapshot z Clarity (3 zapytania)"}
            >
              {fetching ? "Pobieranie…" : "Pobierz teraz"}
            </button>
            {hasData && (
              <button
                onClick={() => fetchNow(true)}
                disabled={fetching || (q ? q.remainingManual < 3 : false)}
                className={`${btn} bg-[#2B2D31] text-[#E0E0E0]/50 hover:text-[#E0E0E0] border border-[#3F4147] disabled:opacity-40`}
                title="Pobierz ponownie snapshot za ostatni dzień (zużywa limit)"
              >
                Odśwież
              </button>
            )}
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className="text-[#E0E0E0]/40 text-sm py-8 text-center">Ładowanie danych Clarity…</div>
      ) : err ? (
        <div className="text-red-400 text-sm">{err}</div>
      ) : !data || !view || !hasData ? (
        <div className={`${card} text-center py-10`}>
          <p className="text-sm text-[#E0E0E0]/60">Brak snapshotów Clarity.</p>
          <p className="text-xs text-[#E0E0E0]/30 mt-1">
            {data && !data.configured
              ? "Ustaw CLARITY_API_TOKEN na serwerze — potem automat zapisze pierwszy snapshot po 06:00."
              : "Pierwszy zapisze automat (godzinny cron, po 06:00) albo przycisk „Pobierz teraz”. Trendy pojawią się po kilku dniach."}
          </p>
        </div>
      ) : (
        <>
          {/* ---- Wykresy ogolne ---- */}
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {METRICS.map((m) => {
              const values = view.range.map((d) => view.byDay.get(d)?.[m.key] ?? null);
              const last = view.last?.[m.key] ?? null;
              const mean = avg(values);
              const delta = last !== null && mean ? ((last - mean) / mean) * 100 : null;
              const good = delta === null ? null : m.lowerIsBetter ? delta <= 0 : delta >= 0;
              return (
                <div key={m.key} className="bg-[#313338] border border-[#3F4147] rounded-xl p-4">
                  <div className="flex items-baseline justify-between gap-2 mb-2">
                    <h3 className="text-xs text-[#E0E0E0]/50 uppercase tracking-wider font-medium">{m.label}</h3>
                    <div className="text-right">
                      <span className="text-lg font-bold text-[#E0E0E0]">{last === null ? "—" : m.fmt(last)}</span>
                      {delta !== null && Math.abs(delta) >= 0.5 && (
                        <span className={`ml-1.5 text-xs ${good ? "text-green-400" : "text-red-400"}`} title={`vs średnia okresu (${mean !== null ? m.fmt(mean) : "—"})`}>
                          {delta > 0 ? "▲" : "▼"}
                          {Math.abs(delta).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <TrendChart days={view.range} series={[{ name: "Wszystkie", color: "#3B82F6", values }]} fmt={m.fmt} bars={m.bars} />
                </div>
              );
            })}
          </div>

          {/* ---- Mobile vs desktop ---- */}
          {view.devices.length > 0 && (
            <div className={card}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h2 className="text-sm font-semibold text-[#E0E0E0]">Mobile vs desktop</h2>
                <div className="flex flex-wrap gap-1">
                  {METRICS.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setDevMetric(m.key)}
                      className={`px-2 py-1 rounded-md text-xs transition-colors ${
                        devMetric === m.key ? "bg-[#3B82F6] text-white" : "bg-[#2B2D31] text-[#E0E0E0]/50 hover:text-[#E0E0E0] border border-[#3F4147]"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              {(() => {
                const m = METRICS.find((x) => x.key === devMetric) ?? METRICS[0];
                const series: Series[] = view.devices.map((d) => ({
                  name: devLabel(d),
                  color: devColor(d),
                  values: view.range.map((day) => view.devByDay[d].get(day)?.[m.key] ?? null),
                }));
                return (
                  <>
                    <TrendChart days={view.range} series={series} fmt={m.fmt} />
                    <Legend series={series} />
                  </>
                );
              })()}
              <div className="overflow-x-auto -mx-2 mt-5">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="text-xs text-[#E0E0E0]/40 text-left">
                      <th className="font-medium px-2 pb-2">Urządzenie ({days} dni)</th>
                      {METRICS.map((m) => (
                        <th key={m.key} className="font-medium px-2 pb-2 text-right">{m.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {view.devices.map((d) => (
                      <tr key={d} className="border-t border-[#3F4147]/60">
                        <td className="px-2 py-2 text-[#E0E0E0]/80">
                          <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ background: devColor(d) }} />
                          {devLabel(d)}
                        </td>
                        {METRICS.map((m) => {
                          const v = aggregate(data.devices[d], m.key);
                          return (
                            <td key={m.key} className="px-2 py-2 text-right text-[#E0E0E0] tabular-nums">
                              {v === null ? "—" : m.fmt(v)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[11px] text-[#E0E0E0]/30 px-2 mt-2">Sesje = suma; pozostałe = średnia ważona sesjami.</p>
              </div>
            </div>
          )}

          {/* ---- Top URL ---- */}
          <div className={card}>
            <h2 className="text-sm font-semibold text-[#E0E0E0] mb-1">Strony z problemami</h2>
            <p className="text-xs text-[#E0E0E0]/40 mb-4">
              Top {data.topUrls.rows.length} URL-i (wg sesji) z ostatniego snapshotu
              {data.topUrls.day ? ` (${fmtDay(data.topUrls.day)}${data.topUrls.createdAt ? `, pobrano ${fmtDateTime(data.topUrls.createdAt)}` : ""})` : ""}, posortowane wg % sesji z dead clickami.
            </p>
            {data.topUrls.rows.length === 0 ? (
              <p className="text-sm text-[#E0E0E0]/30">Brak danych per URL.</p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="text-xs text-[#E0E0E0]/40 text-left">
                      <th className="font-medium px-2 pb-2">URL</th>
                      <th className="font-medium px-2 pb-2 text-right">Sesje</th>
                      <th className="font-medium px-2 pb-2 text-right">Dead %</th>
                      <th className="font-medium px-2 pb-2 text-right">Rage %</th>
                      <th className="font-medium px-2 pb-2 text-right">Quickback %</th>
                      <th className="font-medium px-2 pb-2 text-right">Scroll</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topUrls.rows.map((r) => {
                      const hot = (v: number | null, warn: number) =>
                        v === null ? "text-[#E0E0E0]/30" : v >= warn ? "text-red-400" : v >= warn / 2 ? "text-amber-400" : "text-[#E0E0E0]";
                      return (
                        <tr key={r.dimValue} className="border-t border-[#3F4147]/60">
                          <td className="px-2 py-2 max-w-[320px]">
                            <span className="block truncate font-mono text-xs text-[#E0E0E0]/80" title={r.dimValue}>
                              {fmtPath(r.dimValue)}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-[#E0E0E0]">{r.sessions === null ? "—" : fmtInt(r.sessions)}</td>
                          <td className={`px-2 py-2 text-right tabular-nums ${hot(r.deadClickSessionsPct, 10)}`}>
                            {r.deadClickSessionsPct === null ? "—" : fmtPct(r.deadClickSessionsPct)}
                          </td>
                          <td className={`px-2 py-2 text-right tabular-nums ${hot(r.rageClickSessionsPct, 3)}`}>
                            {r.rageClickSessionsPct === null ? "—" : fmtPct(r.rageClickSessionsPct)}
                          </td>
                          <td className={`px-2 py-2 text-right tabular-nums ${hot(r.quickbackSessionsPct, 15)}`}>
                            {r.quickbackSessionsPct === null ? "—" : fmtPct(r.quickbackSessionsPct)}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-[#E0E0E0]">{r.scrollDepth === null ? "—" : fmtPct(r.scrollDepth)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
