"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import AdminShell from "@/components/admin/AdminShell";
import StatCard from "@/components/admin/StatCard";
import Link from "next/link";
import RevenueChart from "@/components/admin/RevenueChart";
import OrdersChart from "@/components/admin/OrdersChart";
import GeminiUsageChart from "@/components/admin/GeminiUsageChart";
import OrdersPieChart from "@/components/admin/OrdersPieChart";
import { toast } from "@/components/admin/toast";
import { usePolling } from "@/components/admin/usePolling";
import { createLicenses, LICENSE_TOKENS_LABEL } from "@/components/admin/licenseGen";

interface Analytics {
  totalRevenue: number;
  totalRefunded: number;
  refundedOrders: number;
  totalOrders: number;
  succeededOrders: number;
  pendingOrders: number;
  canceledOrders: number;
  fulfilledOrders: number;
  unfulfilledOrders: number;
  dailyOrders: Array<{ date: string; count: number; revenue: number }>;
  // Porzucone koszyki (zamowienie zalozone, nigdy nieoplacone) — nowsze API,
  // nazwy pol tolerancyjnie (kwota w groszach PLN).
  abandonedOrders?: number;
  abandonedCount?: number;
  abandonedAmount?: number;
  abandonedRevenue?: number;
  abandonedValue?: number;
  abandonedTotal?: number;
}

interface Stats {
  users: {
    total: number;
  };
  // Model tokenowy (od 2026-10). Starsze API może tego pola nie zwracać.
  tokens?: {
    usersWithAccess: number;
    totalBalance: number;
    minForAi: number;
    licenseValue: number;
    licensesWithTokens: number;
  };
  // Subskrypcje wycofane — API zwraca je już tylko jako dane historyczne,
  // dashboard ich nie pokazuje.
  subscriptions?: unknown;
  licenses: {
    total: number;
    used: number;
    available: number;
  };
}

interface GeminiStats {
  overview: {
    totalRequests: number;
    totalMessages: number;
    userMessages: number;
    assistantMessages: number;
    uniqueUsers: number;
  };
  tokens: {
    totalEstimated: number;
    userMessagesEstimated: number;
    assistantMessagesEstimated: number;
    averagePerRequest: number;
  };
  // Szacunek z liczby wiadomosci (nie realny koszt) — nowsze API moze zwrocic
  // null / deprecated; realne koszty sa w /admin/gemini (konto OpenRouter).
  cost?: {
    totalEstimatedUSD: number | null;
    perThousandTokens: number;
  } | null;
  deprecated?: boolean | string;
  topUsers: Array<{
    email: string;
    name: string | null;
    messageCount: number;
  }>;
  dailyActivity: Array<{
    date: string;
    userMessages: number;
    assistantMessages: number;
    total: number;
  }>;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  licensesUsed: number;
}

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [visits, setVisits] = useState<number>(0);
  const [geminiStats, setGeminiStats] = useState<GeminiStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingCodes, setGeneratingCodes] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [stockValue, setStockValue] = useState<number | "">("");
  const [stockSaving, setStockSaving] = useState(false);
  const [stockSaved, setStockSaved] = useState(false);
  const [stockErr, setStockErr] = useState("");
  // Pole edytowane (niezapisane) — auto-odswiezanie co 30 s go nie nadpisuje.
  const stockDirtyRef = useRef(false);
  // Ostatnia kopia bazy (lib/dbBackup.ts) — ostrzezenie, gdy cron przestal je robic.
  const [lastBackupAt, setLastBackupAt] = useState<string | null | undefined>(undefined);

  const fetchData = useCallback(async () => {
    try {
      const [analyticsRes, visitsRes, statsRes, geminiRes, usersRes, stockRes] = await Promise.all([
        fetch("/api/admin/analytics"),
        fetch("/api/admin/visits"),
        fetch("/api/admin/stats"),
        fetch("/api/admin/gemini-stats"),
        fetch("/api/admin/users?limit=10"),
        fetch("/api/admin/stock"),
      ]);
      fetch("/api/admin/backups").then((r) => r.json()).then((d) => d.ok && setLastBackupAt(d.lastAt)).catch(() => {});

      if (analyticsRes.ok) {
        setAnalytics(await analyticsRes.json());
      }
      if (visitsRes.ok) {
        const v = await visitsRes.json();
        setVisits(v.page_visits);
      }
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
      if (geminiRes.ok) {
        setGeminiStats(await geminiRes.json());
      }
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users);
      }
      if (stockRes.ok) {
        const s = await stockRes.json();
        if (!stockDirtyRef.current) setStockValue(s.stock);
      }
    } catch (error) {
      console.error("Failed to fetch:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const generateLicenses = async (count: number) => {
    setGeneratingCodes(true);
    setGeneratedCodes([]);

    try {
      setGeneratedCodes(await createLicenses(count));
      fetchData(); // Refresh stats
    } catch (error) {
      console.error("Failed to generate licenses:", error);
      toast((error as Error).message || "Wystąpił błąd", "error");
    } finally {
      setGeneratingCodes(false);
    }
  };

  const saveStock = async () => {
    if (stockValue === "" || stockSaving) return;
    setStockSaving(true);
    setStockSaved(false);
    setStockErr("");
    try {
      const res = await fetch("/api/admin/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: Number(stockValue) }),
      });
      if (res.ok) {
        stockDirtyRef.current = false;
        setStockSaved(true);
        setTimeout(() => setStockSaved(false), 3000);
      } else {
        const data = await res.json().catch(() => null);
        setStockErr(`Nie zapisano: ${data?.error || `HTTP ${res.status}`}`);
      }
    } catch {
      setStockErr("Nie zapisano: błąd sieci");
    } finally {
      setStockSaving(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  // Co 30 s, wstrzymane gdy karta jest w tle (document.hidden).
  usePolling(fetchData, 30000);

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#E0E0E0] mb-1">Admin Dashboard</h1>
          <p className="text-sm text-[#E0E0E0]/60">Zarządzanie KalkMate</p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchData(); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#313338] hover:bg-[#3F4147] rounded-lg text-sm text-[#3B82F6] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
          Odśwież
        </button>
      </div>

      {loading && !analytics ? (
        <div className="flex flex-col items-center justify-center h-64 text-[#E0E0E0]/50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3B82F6] mb-4"></div>
          <p className="text-sm">Ładowanie danych...</p>
        </div>
      ) : analytics ? (
        <div className="space-y-6">
          {lastBackupAt !== undefined && (!lastBackupAt || Date.now() - Date.parse(lastBackupAt) > 30 * 3600_000) && (
            <Link href="/admin/backups" className="block rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300 hover:bg-red-500/15">
              ⚠ {lastBackupAt ? "Ostatnia kopia bazy ma ponad dobę" : "Nie ma jeszcze żadnej kopii bazy"} — kliknij, żeby sprawdzić / zrobić kopię teraz.
            </Link>
          )}

          {/* Quick Stats */}
          {(() => {
            // Porzucone koszyki — osobno od zwrotow (nikt nie zaplacil, wiec nic nie oddano).
            const abandonedCount = analytics.abandonedOrders ?? analytics.abandonedCount;
            const abandonedValue = analytics.abandonedAmount ?? analytics.abandonedRevenue ?? analytics.abandonedValue ?? analytics.abandonedTotal;
            const hasAbandoned = abandonedCount !== undefined || abandonedValue !== undefined;
            return (
          <div className={`grid grid-cols-2 gap-4 ${hasAbandoned ? "lg:grid-cols-3 xl:grid-cols-6" : "lg:grid-cols-5"}`}>
            <StatCard
              title="Przychód"
              value={`${(analytics.totalRevenue / 100).toLocaleString("pl-PL")} zł`}
              subtitle={`${analytics.succeededOrders} opłaconych`}
              color="green"
            />
            <StatCard
              title="Zwrócono"
              value={`${(analytics.totalRefunded / 100).toLocaleString("pl-PL")} zł`}
              subtitle={`Anulowane po opłaceniu (zwrot): ${analytics.refundedOrders}`}
              color="red"
            />
            {hasAbandoned && (
              <StatCard
                title="Porzucone (nieopłacone)"
                value={abandonedValue !== undefined ? `${(abandonedValue / 100).toLocaleString("pl-PL")} zł` : abandonedCount ?? 0}
                subtitle={`${abandonedCount ?? "?"} koszyków bez płatności — bez zwrotu`}
                color="orange"
              />
            )}
            <StatCard
              title="Zamówienia"
              value={analytics.totalOrders}
              subtitle={`${analytics.pendingOrders} oczekujących`}
              color="blue"
            />
            <Link href="/admin/orders?view=to_ship" className="block rounded-2xl hover:ring-2 hover:ring-[#D8FF3D]/40 transition">
              <StatCard
                title="Do wysyłki"
                value={analytics.unfulfilledOrders}
                subtitle={`${analytics.fulfilledOrders} wysłanych · kliknij`}
                color="yellow"
              />
            </Link>
            <StatCard
              title="Wizyty"
              value={visits.toLocaleString("pl-PL")}
              subtitle="Wejścia na stronę"
              color="purple"
            />
          </div>
            );
          })()}

          {/* Stock widget */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] p-6 shadow-xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D8FF3D] to-[#a8cc00] flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0B0B0B" strokeWidth="2.2">
                  <path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/>
                  <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#E0E0E0]">Stan magazynowy</h2>
                <p className="text-sm text-[#E0E0E0]/60">Liczba "szt. dostępnych" na stronie głównej</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={9999}
                value={stockValue}
                onChange={(e) => {
                  stockDirtyRef.current = true;
                  setStockValue(e.target.value === "" ? "" : Number(e.target.value));
                  setStockSaved(false);
                  setStockErr("");
                }}
                onKeyDown={(e) => e.key === "Enter" && saveStock()}
                className="w-32 px-4 py-3 rounded-xl bg-[#2B2D31] border border-[#3F4147] text-[#E0E0E0] text-2xl font-bold text-center focus:outline-none focus:border-[#D8FF3D] transition-colors"
                placeholder="11"
              />
              <span className="text-[#E0E0E0]/50 text-sm">szt. dostępnych</span>
              <button
                onClick={saveStock}
                disabled={stockSaving || stockValue === ""}
                className={`ml-auto px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
                  stockSaved
                    ? "bg-green-500 text-white"
                    : "bg-[#D8FF3D] text-[#0B0B0B] hover:bg-[#c8ef2d] disabled:opacity-40"
                }`}
              >
                {stockSaving ? "Zapisuję..." : stockSaved ? "✓ Zapisano" : "Zapisz"}
              </button>
            </div>
            {stockErr && <p className="mt-2 text-sm text-red-400">{stockErr}</p>}
          </motion.div>

          {/* License Generator Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] p-6 shadow-xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#2563EB] flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#E0E0E0]">Generator licencji</h2>
                <p className="text-sm text-[#E0E0E0]/60">Kody z pudełka — po {LICENSE_TOKENS_LABEL} AI</p>
              </div>
            </div>

            <div className="bg-[#2B2D31] rounded-xl p-4 mb-4 border border-[#3F4147]/50">
              <p className="text-sm text-[#E0E0E0]/80 mb-2">
                <span className="font-semibold text-[#3B82F6]">Format:</span> 16 znaków (a-z, 0-9, -+=%)<br />
                <span className="font-semibold text-[#3B82F6]">Wartość:</span> jednorazowo {LICENSE_TOKENS_LABEL} na konto
              </p>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => generateLicenses(1)}
                disabled={generatingCodes}
                className="flex-1 bg-[#3B82F6] hover:bg-[#2563EB] text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generuj 1
              </button>
              <button
                onClick={() => generateLicenses(5)}
                disabled={generatingCodes}
                className="flex-1 bg-[#3B82F6] hover:bg-[#2563EB] text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generuj 5
              </button>
              <button
                onClick={() => generateLicenses(10)}
                disabled={generatingCodes}
                className="flex-1 bg-[#3B82F6] hover:bg-[#2563EB] text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generuj 10
              </button>
            </div>

            {generatingCodes && (
              <div className="flex items-center gap-2 text-[#3B82F6] text-sm">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#3B82F6]"></div>
                Generowanie licencji...
              </div>
            )}

            {generatedCodes.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="bg-[#2B2D31] border border-[#3F4147] rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[#E0E0E0] flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Wygenerowane ({generatedCodes.length})
                  </h3>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedCodes.join("\n"));
                      toast("Skopiowano wszystkie licencje!");
                    }}
                    className="text-xs text-[#3B82F6] hover:underline font-medium"
                  >
                    Kopiuj wszystkie
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {generatedCodes.map((code, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-[#313338] px-4 py-3 rounded-lg hover:bg-[#3F4147] transition-colors"
                    >
                      <code className="text-sm font-mono text-green-400 font-semibold">{code}</code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(code);
                          toast(`Skopiowano: ${code}`);
                        }}
                        className="text-xs text-[#E0E0E0]/60 hover:text-[#3B82F6] transition-colors"
                      >
                        Kopiuj
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Gemini API Stats Card — koszt z /api/admin/gemini-stats to szacunek
              z liczby wiadomosci; gdy API go nie podaje (null/deprecated),
              zamiast fikcyjnej kwoty link do realnych kosztow z OpenRouter. */}
          {geminiStats && (geminiStats.deprecated || !geminiStats.overview) && (
            <Link
              href="/admin/gemini"
              className="block rounded-2xl border border-[#3F4147] bg-gradient-to-br from-[#313338] to-[#2B2D31] px-6 py-4 text-sm text-[#E0E0E0]/70 hover:border-purple-500/40"
            >
              <span className="font-semibold text-[#E0E0E0]">OpenRouter AI</span> — realne zużycie i koszty API:{" "}
              <span className="text-purple-400">otwórz OpenRouter AI →</span>
            </Link>
          )}
          {geminiStats && !geminiStats.deprecated && geminiStats.overview && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] p-6 shadow-xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                    <line x1="12" y1="22.08" x2="12" y2="12"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-[#E0E0E0]">OpenRouter AI</h2>
                  <p className="text-sm text-[#E0E0E0]/60">Statystyki zużycia</p>
                </div>
                <Link href="/admin/gemini" className="text-sm text-purple-400 hover:underline">
                  Realne koszty →
                </Link>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <div className="bg-[#2B2D31] rounded-xl p-4 border border-[#3F4147]/50">
                  <p className="text-xs text-[#E0E0E0]/60 mb-1">Zapytania</p>
                  <p className="text-2xl font-bold text-purple-400">{geminiStats.overview?.totalRequests?.toLocaleString() || 0}</p>
                </div>
                <div className="bg-[#2B2D31] rounded-xl p-4 border border-[#3F4147]/50">
                  <p className="text-xs text-[#E0E0E0]/60 mb-1">Wiadomości</p>
                  <p className="text-2xl font-bold text-purple-400">{geminiStats.overview?.totalMessages?.toLocaleString() || 0}</p>
                </div>
                <div className="bg-[#2B2D31] rounded-xl p-4 border border-[#3F4147]/50">
                  <p className="text-xs text-[#E0E0E0]/60 mb-1">Użytkownicy</p>
                  <p className="text-2xl font-bold text-purple-400">{geminiStats.overview?.uniqueUsers || 0}</p>
                </div>
                <div className="bg-[#2B2D31] rounded-xl p-4 border border-[#3F4147]/50">
                  <p className="text-xs text-[#E0E0E0]/60 mb-1">Tokeny</p>
                  <p className="text-2xl font-bold text-purple-400">{((geminiStats.tokens?.totalEstimated || 0) / 1000).toFixed(1)}K</p>
                </div>
                {typeof geminiStats.cost?.totalEstimatedUSD === "number" ? (
                  <div className="bg-[#2B2D31] rounded-xl p-4 border border-[#3F4147]/50" title="Szacunek z liczby wiadomości — realny koszt w OpenRouter AI">
                    <p className="text-xs text-[#E0E0E0]/60 mb-1">Koszt szac. (USD)</p>
                    <p className="text-2xl font-bold text-purple-400">~${geminiStats.cost.totalEstimatedUSD.toFixed(2)}</p>
                  </div>
                ) : (
                  <Link href="/admin/gemini" className="bg-[#2B2D31] rounded-xl p-4 border border-[#3F4147]/50 hover:border-purple-500/40 block">
                    <p className="text-xs text-[#E0E0E0]/60 mb-1">Koszt</p>
                    <p className="text-sm font-semibold text-purple-400">Realne koszty →</p>
                  </Link>
                )}
              </div>

              {geminiStats.topUsers && geminiStats.topUsers.length > 0 && (
                <div className="bg-[#2B2D31] rounded-xl p-4 border border-[#3F4147]/50">
                  <h3 className="text-sm font-semibold text-[#E0E0E0] mb-3">Top użytkownicy AI Chat</h3>
                  <div className="space-y-2">
                    {geminiStats.topUsers.slice(0, 5).map((user, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-[#3F4147]/30 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#E0E0E0]/40 w-6">#{i + 1}</span>
                          <div>
                            <p className="text-sm font-medium text-[#E0E0E0]">{user.name || "Brak imienia"}</p>
                            <p className="text-xs text-[#E0E0E0]/60">{user.email}</p>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-purple-400">{user.messageCount} msg</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Users Card */}
          {users.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] p-6 shadow-xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-[#E0E0E0]">Użytkownicy</h2>
                  <p className="text-sm text-[#E0E0E0]/60">Ostatnio zarejestrowani ({stats?.users.total || 0} total)</p>
                </div>
                <a
                  href="/admin/users"
                  className="text-sm text-[#3B82F6] hover:underline"
                >
                  Zobacz wszystkich →
                </a>
              </div>

              <div className="space-y-3">
                {users.map((user, i) => (
                  <div key={user.id} className="bg-[#2B2D31] rounded-xl p-4 border border-[#3F4147]/50 hover:border-[#3B82F6]/30 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-[#E0E0E0]">{user.name || "Brak imienia"}</p>
                        </div>
                        <p className="text-xs text-[#E0E0E0]/60 mb-2">{user.email}</p>
                        <div className="flex items-center gap-4 text-xs text-[#E0E0E0]/50">
                          <span>Dołączył: {new Date(user.createdAt).toLocaleDateString("pl-PL")}</span>
                          {user.licensesUsed > 0 && (
                            <span className="text-[#3B82F6]">Licencji użytych: {user.licensesUsed}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Stats cards - użytkownicy, AI (tokeny), licencje */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Użytkownicy"
                value={stats.users.total}
                subtitle="Zarejestrowanych kont"
                color="cyan"
              />
              <StatCard
                title="Z dostępem do AI"
                value={stats.tokens ? stats.tokens.usersWithAccess : "—"}
                subtitle={stats.tokens ? `saldo ≥ ${stats.tokens.minForAi.toLocaleString("pl-PL")} tokenów` : "brak danych z API"}
                color="indigo"
              />
              <StatCard
                title="Tokeny na kontach"
                value={stats.tokens ? stats.tokens.totalBalance.toLocaleString("pl-PL") : "—"}
                subtitle={stats.tokens ? `${stats.tokens.licensesWithTokens} kodów z pudełka aktywowanych` : "brak danych z API"}
                color="pink"
              />
              <StatCard
                title="Licencje"
                value={stats.licenses.available}
                subtitle={`${stats.licenses.used} użytych`}
                color="teal"
              />
            </div>
          )}

          {/* Zaawansowana Analityka (Recharts Dashboard) */}
          <div className="space-y-6 mt-8">
            <h2 className="text-xl font-bold text-[#E0E0E0] mb-2 flex items-center gap-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
              Zaawansowana Analityka
            </h2>
            
            {/* Przychód - pełna szerokość */}
            <div className="w-full">
              <RevenueChart data={analytics.dailyOrders} />
            </div>

            {/* Siatka 3 kolumn: Słupki zamówień, Pie chart statusów, Linie użycia Gemini */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <OrdersChart data={analytics.dailyOrders} />
              <OrdersPieChart 
                succeeded={analytics.succeededOrders} 
                pending={analytics.pendingOrders} 
                canceled={analytics.canceledOrders} 
              />
              {geminiStats?.dailyActivity && geminiStats.dailyActivity.length > 0 ? (
                <GeminiUsageChart data={geminiStats.dailyActivity} />
              ) : (
                <div className="bg-[#313338] rounded-2xl border border-[#3F4147] p-6 flex items-center justify-center text-[#E0E0E0]/40 text-sm">
                  Brak danych AI do wyświetlenia
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#313338] rounded-xl border border-red-500/30 p-6 text-center">
          <p className="text-red-400 font-semibold mb-2">Nie udało się załadować danych</p>
          <p className="text-sm text-[#E0E0E0]/60">Spróbuj odświeżyć stronę</p>
        </div>
      )}
    </AdminShell>
  );
}
