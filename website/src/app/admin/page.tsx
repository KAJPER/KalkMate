"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import AdminShell from "@/components/admin/AdminShell";
import StatCard from "@/components/admin/StatCard";
import RevenueChart from "@/components/admin/RevenueChart";
import OrdersChart from "@/components/admin/OrdersChart";
import GeminiUsageChart from "@/components/admin/GeminiUsageChart";
import OrdersPieChart from "@/components/admin/OrdersPieChart";

interface Analytics {
  totalRevenue: number;
  totalOrders: number;
  succeededOrders: number;
  pendingOrders: number;
  canceledOrders: number;
  fulfilledOrders: number;
  unfulfilledOrders: number;
  dailyOrders: Array<{ date: string; count: number; revenue: number }>;
}

interface Stats {
  users: {
    total: number;
  };
  subscriptions: {
    total: number;
    active: number;
    trial: number;
    expired: number;
  };
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
  cost: {
    totalEstimatedUSD: number;
    perThousandTokens: number;
  };
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
  subscription: {
    status: string;
    trialEndsAt: string | null;
    plan: string | null;
  } | null;
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
  const [licenseDuration, setLicenseDuration] = useState<"week" | "month" | "3months">("month");
  const [stockValue, setStockValue] = useState<number | "">("");
  const [stockSaving, setStockSaving] = useState(false);
  const [stockSaved, setStockSaved] = useState(false);

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
        setStockValue(s.stock);
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

    const durationDays = licenseDuration === "week" ? 7 : licenseDuration === "month" ? 30 : 90;

    try {
      const res = await fetch("/api/admin/licenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ count, durationDays }),
      });

      if (res.ok) {
        const data = await res.json();
        setGeneratedCodes(data.codes);
        fetchData(); // Refresh stats
      } else {
        alert("Nie udało się wygenerować licencji");
      }
    } catch (error) {
      console.error("Failed to generate licenses:", error);
      alert("Wystąpił błąd");
    } finally {
      setGeneratingCodes(false);
    }
  };

  const saveStock = async () => {
    if (stockValue === "" || stockSaving) return;
    setStockSaving(true);
    setStockSaved(false);
    try {
      const res = await fetch("/api/admin/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: Number(stockValue) }),
      });
      if (res.ok) setStockSaved(true);
    } catch {}
    setStockSaving(false);
    setTimeout(() => setStockSaved(false), 3000);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

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
          {/* Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Przychód"
              value={`${(analytics.totalRevenue / 100).toLocaleString("pl-PL")} zł`}
              subtitle={`${analytics.succeededOrders} opłaconych`}
              color="green"
            />
            <StatCard
              title="Zamówienia"
              value={analytics.totalOrders}
              subtitle={`${analytics.pendingOrders} oczekujących`}
              color="blue"
            />
            <StatCard
              title="Do wysyłki"
              value={analytics.unfulfilledOrders}
              subtitle={`${analytics.fulfilledOrders} wysłanych`}
              color="yellow"
            />
            <StatCard
              title="Wizyty"
              value={visits.toLocaleString("pl-PL")}
              subtitle="Wejścia na stronę"
              color="purple"
            />
          </div>

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
                onChange={(e) => { setStockValue(e.target.value === "" ? "" : Number(e.target.value)); setStockSaved(false); }}
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
                <p className="text-sm text-[#E0E0E0]/60">Generuj kody dostępu do AI Chat</p>
              </div>
            </div>

            <div className="bg-[#2B2D31] rounded-xl p-4 mb-4 border border-[#3F4147]/50">
              <p className="text-sm text-[#E0E0E0]/80 mb-2">
                <span className="font-semibold text-[#3B82F6]">Format:</span> 16 znaków (a-z, 0-9, -+=%)<br />
                <span className="font-semibold text-[#3B82F6]">Dostęp:</span> AI Chat przez wybrany okres
              </p>
            </div>

            <div className="mb-4">
              <label className="text-sm font-semibold text-[#E0E0E0] mb-2 block">Okres dostępu:</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setLicenseDuration("week")}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    licenseDuration === "week"
                      ? "bg-gradient-to-br from-[#3B82F6] to-[#2563EB] text-white shadow-lg"
                      : "bg-[#2B2D31] text-[#E0E0E0]/60 hover:bg-[#313338]"
                  }`}
                >
                  <div className="font-bold">Tydzień</div>
                  <div className="text-xs opacity-75">7 dni</div>
                </button>
                <button
                  onClick={() => setLicenseDuration("month")}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    licenseDuration === "month"
                      ? "bg-gradient-to-br from-[#3B82F6] to-[#2563EB] text-white shadow-lg"
                      : "bg-[#2B2D31] text-[#E0E0E0]/60 hover:bg-[#313338]"
                  }`}
                >
                  <div className="font-bold">Miesiąc</div>
                  <div className="text-xs opacity-75">30 dni</div>
                </button>
                <button
                  onClick={() => setLicenseDuration("3months")}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    licenseDuration === "3months"
                      ? "bg-gradient-to-br from-[#3B82F6] to-[#2563EB] text-white shadow-lg"
                      : "bg-[#2B2D31] text-[#E0E0E0]/60 hover:bg-[#313338]"
                  }`}
                >
                  <div className="font-bold">3 miesiące</div>
                  <div className="text-xs opacity-75">90 dni</div>
                </button>
              </div>
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
                      alert("Skopiowano wszystkie licencje!");
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
                          alert(`Skopiowano: ${code}`);
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

          {/* Gemini API Stats Card */}
          {geminiStats && (
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
                <div>
                  <h2 className="text-xl font-bold text-[#E0E0E0]">Google Gemini API</h2>
                  <p className="text-sm text-[#E0E0E0]/60">Statystyki zużycia i koszty</p>
                </div>
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
                <div className="bg-[#2B2D31] rounded-xl p-4 border border-[#3F4147]/50">
                  <p className="text-xs text-[#E0E0E0]/60 mb-1">Koszt (USD)</p>
                  <p className="text-2xl font-bold text-purple-400">${(geminiStats.cost?.totalEstimatedUSD || 0).toFixed(2)}</p>
                </div>
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
                  href="/admin/orders"
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
                          {user.subscription && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              user.subscription.status === "active" ? "bg-green-500/20 text-green-400" :
                              user.subscription.status === "trial" ? "bg-blue-500/20 text-blue-400" :
                              "bg-gray-500/20 text-gray-400"
                            }`}>
                              {user.subscription.status === "active" ? "Aktywna" :
                               user.subscription.status === "trial" ? "Trial" : user.subscription.status}
                            </span>
                          )}
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

          {/* Stats cards - użytkownicy i subskrypcje */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Użytkownicy"
                value={stats.users.total}
                subtitle="Zarejestrowanych kont"
                color="cyan"
              />
              <StatCard
                title="Subskrypcje"
                value={stats.subscriptions.total}
                subtitle={`${stats.subscriptions.active} aktywnych`}
                color="indigo"
              />
              <StatCard
                title="Triale"
                value={stats.subscriptions.trial}
                subtitle={`${stats.subscriptions.expired} wygasłych`}
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
