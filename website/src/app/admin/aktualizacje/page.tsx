"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import AdminShell from "@/components/admin/AdminShell";
import { toast } from "@/components/admin/toast";
import { fmtDateTime } from "@/components/admin/format";

// Typy jak w lib/fwUpdateNotice.ts (lib importuje prisma — nie do klienta).
interface FwCampaign {
  id: string;
  targetVersion: string;
  deadline: number;
  intervalDays: number;
  active: boolean;
  createdAt: number;
  stoppedAt: number | null;
  outdatedDevices: number;
}

interface FwVersionBucket {
  version: string;
  count: number;
  paired: number;
  lastSeen: number | null;
}

interface FwOutdatedDevice {
  deviceId: string;
  firmwareVersion: string | null;
  lastSeen: number | null;
  userId: string | null;
  email: string | null;
  active: boolean;
  noticeCount: number;
  lastNoticeAt: number | null;
}

interface FwCampaignStats {
  noticesSent: number;
  usersNotified: number;
  targetsAtStart: number;
  usersUpdated: number;
  usersOutdatedNow: number;
  usersDueNow: number;
}

interface FwAdminOverview {
  defaults: { targetVersion: string; durationDays: number; intervalDays: number };
  totalDevices: number;
  versions: FwVersionBucket[];
  outdated: FwOutdatedDevice[];
  campaign: FwCampaign | null;
  stats: FwCampaignStats | null;
}

interface FwNoticeResult {
  campaignId: string | null;
  eligible: number;
  due: number;
  sent: string[];
  failed: { email: string; error: string }[];
  skipped: number;
}

const DAY_MS = 24 * 60 * 60_000;

// Kopia compareSemver z lib (niepoprawna wersja = najstarsza).
function parseSemver(v: string | null | undefined): [number, number, number] | null {
  const m = /^v?(\d{1,4})\.(\d{1,4})\.(\d{1,4})(?:[-+].*)?$/.exec((v || "").trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function isOutdated(v: string | null | undefined, target: string): boolean {
  const pa = parseSemver(v);
  const pb = parseSemver(target);
  if (!pb) return false;
  if (!pa) return true;
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] < pb[i];
  return false;
}

// Wartosc dla <input type="datetime-local"> w czasie lokalnym przegladarki.
function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function relTime(ms: number | null, now: number): string {
  if (ms == null) return "nigdy";
  const diff = now - ms;
  if (diff < 60_000) return "przed chwilą";
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `${min} min temu`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} godz. temu`;
  const d = Math.floor(h / 24);
  if (d < 60) return `${d} dni temu`;
  return `${Math.floor(d / 30)} mies. temu`;
}

function daysLeft(deadline: number, now: number): string {
  const diff = deadline - now;
  if (diff <= 0) return "termin minął";
  const d = Math.floor(diff / DAY_MS);
  const h = Math.floor((diff % DAY_MS) / 3_600_000);
  return d > 0 ? `${d} dni ${h} godz.` : `${h} godz.`;
}

// GET z obsluga bledow (toast); null = blad.
async function loadOverview(): Promise<FwAdminOverview | null> {
  try {
    const res = await fetch("/api/admin/fw-update");
    const d = await res.json().catch(() => null);
    if (res.ok && d?.ok) return d as FwAdminOverview;
    toast(`Nie udało się pobrać danych (${d?.error || `HTTP ${res.status}`})`, "error");
  } catch (e) {
    console.error(e);
    toast("Błąd sieci przy pobieraniu danych", "error");
  }
  return null;
}

const cardCls = "bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] shadow-xl";
const inputCls =
  "w-full bg-[#2B2D31] border border-[#3F4147] rounded-lg px-3 py-2.5 text-sm text-[#E0E0E0] focus:outline-none focus:border-[#3B82F6]";
const thCls = "px-4 py-3 text-left text-xs font-semibold text-[#E0E0E0]/50 uppercase tracking-wide whitespace-nowrap";
const tdCls = "px-4 py-3 text-sm text-[#E0E0E0]/80 whitespace-nowrap";

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="bg-[#2B2D31] rounded-xl border border-[#3F4147] p-3">
      <div className="text-xl font-bold text-[#E0E0E0]">{value}</div>
      <div className="text-xs text-[#E0E0E0]/60 mt-0.5">{label}</div>
      {hint && <div className="text-[11px] text-[#E0E0E0]/40 mt-0.5">{hint}</div>}
    </div>
  );
}

export default function FwUpdatePage() {
  const [data, setData] = useState<FwAdminOverview | null>(null);
  // Chwila pobrania danych — "X temu" / "pozostalo" liczone od niej.
  const [now, setNow] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // formularz — domyslne wartosci ustawiane po pierwszym pobraniu
  const [targetVersion, setTargetVersion] = useState("");
  const [deadline, setDeadline] = useState("");
  const [intervalDays, setIntervalDays] = useState("");
  const formInit = useRef(false);

  const applyOverview = useCallback((d: FwAdminOverview) => {
    setData(d);
    setNow(Date.now());
    if (!formInit.current) {
      formInit.current = true;
      setTargetVersion(d.defaults.targetVersion);
      setDeadline(toLocalInput(Date.now() + d.defaults.durationDays * DAY_MS));
      setIntervalDays(String(d.defaults.intervalDays));
    }
  }, []);

  // Fetch bez setState; stan ustawiany w .then (react-hooks/set-state-in-effect).
  const fetchOverview = useCallback(() => {
    loadOverview().then((d) => {
      if (d) applyOverview(d);
      setLoading(false);
    });
  }, [applyOverview]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  // POST z kontrola odpowiedzi; zwraca body albo null przy bledzie.
  const post = async (payload: Record<string, unknown>, failMsg: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/fw-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.ok) {
        toast(`${failMsg}: ${d?.error || `HTTP ${res.status}`}`, "error");
        return null;
      }
      if (d.overview) applyOverview(d.overview as FwAdminOverview);
      return d;
    } catch {
      toast(`${failMsg}: błąd sieci`, "error");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const campaign = data?.campaign ?? null;
  const stats = data?.stats ?? null;
  // Ta sama wersja odniesienia co lista nieaktualnych z serwera.
  const refTarget = campaign?.targetVersion || data?.defaults.targetVersion || "2.1.0";

  const startCampaign = async () => {
    if (!data) return;
    const tv = targetVersion.trim();
    if (!/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(tv)) {
      toast("Wersja docelowa w formacie X.Y.Z (np. 2.1.0)", "error");
      return;
    }
    const dl = new Date(deadline).getTime();
    if (!deadline || !Number.isFinite(dl)) {
      toast("Podaj termin", "error");
      return;
    }
    const iv = Number(intervalDays);
    if (!Number.isInteger(iv) || iv < 1 || iv > 14) {
      toast("Interwał: liczba całkowita 1..14 dni", "error");
      return;
    }

    // Liczby dla wpisanej wersji: urzadzenia z kubelkow wersji, uzytkownicy
    // z listy nieaktualnych (dokladne tylko, gdy wersja = ta z serwera).
    const outdatedBuckets = data.versions.filter((v) => isOutdated(v.version, tv));
    const devCount = outdatedBuckets.reduce((n, v) => n + v.count, 0);
    const pairedCount = outdatedBuckets.reduce((n, v) => n + v.paired, 0);
    const sameTarget = tv === refTarget;
    const userCount = sameTarget
      ? new Set(data.outdated.filter((d) => d.userId && d.email && d.active).map((d) => d.userId)).size
      : null;

    const msg =
      `Uruchomić kampanię "Zaktualizuj kalkulator" do wersji ${tv}?\n\n` +
      `Nieaktualne urządzenia: ${devCount} (sparowane: ${pairedCount}).\n` +
      (userCount != null ? `Użytkownicy do powiadomienia (aktywni ≤180 dni): ${userCount}.\n` : "") +
      `Termin: ${fmtDateTime(dl)}, przypomnienie co ${iv} dni.\n\n` +
      `Maile będą wysyłane automatycznie co godzinę (max 50 na przebieg) aż do terminu.` +
      (campaign?.active ? `\n\nObecna aktywna kampania zostanie zakończona.` : "");
    if (!confirm(msg)) return;

    const d = await post({ action: "start", targetVersion: tv, deadline: dl, intervalDays: iv }, "Nie udało się uruchomić kampanii");
    if (d) toast(`Kampania uruchomiona (${d.campaign?.outdatedDevices ?? 0} urządzeń)`);
  };

  const stopCampaign = async () => {
    if (!confirm("Zatrzymać kampanię? Maile przestaną wychodzić, baner w panelu klienta zniknie.")) return;
    const d = await post({ action: "stop" }, "Nie udało się zatrzymać kampanii");
    if (d) toast("Kampania zatrzymana");
  };

  const sendNow = async () => {
    const d = await post({ action: "send" }, "Wysyłka nie powiodła się");
    if (!d) return;
    const r = d.result as FwNoticeResult;
    if (!r.campaignId) {
      toast("Brak aktywnej kampanii", "info");
      return;
    }
    const text = `Wysłano: ${r.sent.length}, błędy: ${r.failed.length}, do wysłania: ${r.due} (uprawnionych: ${r.eligible})`;
    toast(text, r.failed.length ? "error" : r.sent.length ? "success" : "info");
    if (r.failed.length) console.warn("[fw-update] failed:", r.failed);
  };

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#E0E0E0] mb-1">Aktualizacje firmware</h1>
          <p className="text-sm text-[#E0E0E0]/60">
            Kampania mailowa „Zaktualizuj kalkulator” dla urządzeń ze starym firmware
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchOverview(); }}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[#313338] hover:bg-[#3F4147] rounded-lg text-sm text-[#3B82F6] transition-colors disabled:opacity-50"
        >
          {loading ? "Ładowanie..." : "Odśwież"}
        </button>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3B82F6]"></div>
        </div>
      ) : !data ? (
        <div className={`${cardCls} p-12 text-center text-[#E0E0E0]/40`}>Brak danych</div>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            {/* Status kampanii */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`${cardCls} p-6`}>
              <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
                <h2 className="text-xl font-bold text-[#E0E0E0]">Kampania</h2>
                {campaign && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    campaign.active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  }`}>
                    {campaign.active ? "● Aktywna" : "Zatrzymana"}
                  </span>
                )}
              </div>

              {!campaign ? (
                <p className="text-sm text-[#E0E0E0]/50">
                  Żadna kampania nie została jeszcze uruchomiona. Maile nie wychodzą, dopóki nie klikniesz „Start”.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm mb-5">
                    <div className="text-[#E0E0E0]/60">
                      Wersja docelowa: <code className="font-mono font-bold text-[#3B82F6]">{campaign.targetVersion}</code>
                    </div>
                    <div className="text-[#E0E0E0]/60">
                      Przypomnienie co: <b className="text-[#E0E0E0]">{campaign.intervalDays} dni</b>
                    </div>
                    <div className="text-[#E0E0E0]/60">
                      Termin: <b className="text-[#E0E0E0]">{fmtDateTime(campaign.deadline)}</b>
                    </div>
                    <div className="text-[#E0E0E0]/60">
                      Pozostało: <b className={campaign.deadline - now < 3 * DAY_MS ? "text-amber-300" : "text-[#E0E0E0]"}>
                        {daysLeft(campaign.deadline, now)}
                      </b>
                    </div>
                    <div className="text-[#E0E0E0]/60">
                      Utworzona: <span className="text-[#E0E0E0]/80">{fmtDateTime(campaign.createdAt)}</span>
                    </div>
                    {campaign.stoppedAt != null && (
                      <div className="text-[#E0E0E0]/60">
                        Zatrzymana: <span className="text-[#E0E0E0]/80">{fmtDateTime(campaign.stoppedAt)}</span>
                      </div>
                    )}
                    <div className="text-[#E0E0E0]/60 sm:col-span-2">
                      Nieaktualne urządzenia przy starcie: <b className="text-[#E0E0E0]">{campaign.outdatedDevices}</b>
                    </div>
                  </div>

                  {stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <Stat label="Wysłanych maili" value={stats.noticesSent} />
                      <Stat label="Powiadomionych użytkowników" value={stats.usersNotified} />
                      <Stat label="Do powiadomienia przy starcie" value={stats.targetsAtStart} />
                      <Stat label="Zaktualizowali od startu" value={stats.usersUpdated}
                        hint={stats.targetsAtStart ? `${Math.round((stats.usersUpdated / stats.targetsAtStart) * 100)}%` : undefined} />
                      <Stat label="Nadal nieaktualni" value={stats.usersOutdatedNow} />
                      <Stat label="Do wysłania w najbliższym przebiegu" value={stats.usersDueNow} />
                    </div>
                  )}
                </>
              )}
            </motion.div>

            {/* Sterowanie */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={`${cardCls} p-6`}>
              <h2 className="text-xl font-bold text-[#E0E0E0] mb-5">Nowa kampania</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="text-xs text-[#E0E0E0]/60 mb-1.5 block">Wersja docelowa</label>
                  <input
                    value={targetVersion}
                    onChange={(e) => setTargetVersion(e.target.value)}
                    placeholder={data.defaults.targetVersion}
                    className={inputCls + " font-mono"}
                  />
                </div>
                <div>
                  <label className="text-xs text-[#E0E0E0]/60 mb-1.5 block">Termin (deadline)</label>
                  <input
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-xs text-[#E0E0E0]/60 mb-1.5 block">Przypomnienie co (dni)</label>
                  <input
                    type="number"
                    min={1}
                    max={14}
                    step={1}
                    value={intervalDays}
                    onChange={(e) => setIntervalDays(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
              <p className="text-xs text-[#E0E0E0]/40 mb-5">
                Po starcie cron wysyła maile co godzinę (max 50 na przebieg) do właścicieli sparowanych urządzeń
                z wersją niższą niż docelowa, widzianych w ostatnich 180 dniach. Po terminie kampania wyłącza się sama.
                Start nowej kampanii kończy poprzednią.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => void startCampaign()}
                  disabled={saving}
                  className="bg-[#3B82F6] hover:bg-[#2563EB] text-white px-6 py-3 rounded-xl font-semibold transition-all disabled:opacity-50"
                >
                  {saving ? "Zapisywanie..." : "Start"}
                </button>
                {campaign?.active && (
                  <>
                    <button
                      onClick={() => void sendNow()}
                      disabled={saving}
                      className="px-5 py-3 bg-[#2B2D31] hover:bg-[#3F4147] text-[#E0E0E0] rounded-xl font-semibold transition-colors disabled:opacity-50"
                    >
                      Wyślij teraz
                    </button>
                    <button
                      onClick={() => void stopCampaign()}
                      disabled={saving}
                      className="px-5 py-3 bg-[#2B2D31] hover:bg-red-500/20 text-[#E0E0E0]/70 hover:text-red-400 rounded-xl font-semibold transition-colors disabled:opacity-50"
                    >
                      Stop
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>

          {/* Flota wg wersji */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`${cardCls} overflow-hidden mb-6`}
          >
            <div className="p-6 border-b border-[#3F4147]">
              <h2 className="text-xl font-bold text-[#E0E0E0]">Flota wg wersji firmware ({data.totalDevices})</h2>
              <p className="text-xs text-[#E0E0E0]/40 mt-1">
                Na czerwono wersje niższe niż <code className="font-mono">{refTarget}</code>
              </p>
            </div>
            {data.versions.length ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#2B2D31]/60">
                    <tr>
                      <th className={thCls}>Wersja</th>
                      <th className={thCls}>Urządzeń</th>
                      <th className={thCls}>Sparowanych</th>
                      <th className={thCls}>Ostatnio widziane</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3F4147]">
                    {data.versions.map((v) => {
                      const old = isOutdated(v.version, refTarget);
                      return (
                        <tr key={v.version || "_none"} className={old ? "bg-red-500/5" : "hover:bg-[#313338]"}>
                          <td className={tdCls}>
                            <code className={`font-mono font-bold ${old ? "text-red-400" : "text-green-400"}`}>
                              {v.version || "brak"}
                            </code>
                          </td>
                          <td className={tdCls}>{v.count}</td>
                          <td className={tdCls}>{v.paired}</td>
                          <td className={tdCls}>
                            {v.lastSeen != null ? (
                              <>
                                {relTime(v.lastSeen, now)}
                                <span className="text-[#E0E0E0]/40"> · {fmtDateTime(v.lastSeen)}</span>
                              </>
                            ) : (
                              <span className="text-[#E0E0E0]/40">nigdy</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-[#E0E0E0]/40">Brak urządzeń</div>
            )}
          </motion.div>

          {/* Nieaktualne urzadzenia */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={`${cardCls} overflow-hidden`}
          >
            <div className="p-6 border-b border-[#3F4147]">
              <h2 className="text-xl font-bold text-[#E0E0E0]">
                Nieaktualne urządzenia ({data.outdated.length})
              </h2>
              <p className="text-xs text-[#E0E0E0]/40 mt-1">
                Wersja niższa niż <code className="font-mono">{refTarget}</code> albo brak wersji. Mail dostają tylko
                sparowane i aktywne (widziane ≤180 dni).
              </p>
            </div>
            {data.outdated.length ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#2B2D31]/60">
                    <tr>
                      <th className={thCls}>Urządzenie</th>
                      <th className={thCls}>Wersja</th>
                      <th className={thCls}>Ostatnio widziane</th>
                      <th className={thCls}>Właściciel</th>
                      <th className={thCls}>Aktywne</th>
                      <th className={thCls}>Maili</th>
                      <th className={thCls}>Ostatni mail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3F4147]">
                    {data.outdated.map((d) => (
                      <tr key={d.deviceId} className="hover:bg-[#313338]">
                        <td className={tdCls}><code className="font-mono text-[#3B82F6]">{d.deviceId}</code></td>
                        <td className={tdCls}>
                          <code className="font-mono text-red-400">{d.firmwareVersion || "brak"}</code>
                        </td>
                        <td className={tdCls}>
                          {d.lastSeen != null ? (
                            <span title={fmtDateTime(d.lastSeen)}>
                              {relTime(d.lastSeen, now)}
                              <span className="text-[#E0E0E0]/40"> · {fmtDateTime(d.lastSeen)}</span>
                            </span>
                          ) : (
                            <span className="text-[#E0E0E0]/40">nigdy</span>
                          )}
                        </td>
                        <td className={tdCls}>
                          {d.email ? d.email : <span className="text-[#E0E0E0]/40">niesparowane</span>}
                        </td>
                        <td className={tdCls}>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            d.active ? "bg-green-500/20 text-green-400" : "bg-[#E0E0E0]/10 text-[#E0E0E0]/50"
                          }`}>
                            {d.active ? "Tak" : "Nie"}
                          </span>
                        </td>
                        <td className={tdCls}>{d.noticeCount}</td>
                        <td className={tdCls}>
                          {d.lastNoticeAt != null ? fmtDateTime(d.lastNoticeAt) : <span className="text-[#E0E0E0]/40">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-[#E0E0E0]/40">Wszystkie urządzenia są aktualne</div>
            )}
          </motion.div>
        </>
      )}
    </AdminShell>
  );
}
