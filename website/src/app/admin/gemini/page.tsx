"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import AdminShell from "@/components/admin/AdminShell";

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

export default function GeminiPage() {
  const [stats, setStats] = useState<GeminiStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/admin/gemini-stats");
        if (res.ok) {
          setStats(await res.json());
        }
      } catch (error) {
        console.error("Failed to fetch gemini stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#E0E0E0] mb-1">Google Gemini API</h1>
        <p className="text-sm text-[#E0E0E0]/60">Statystyki zużycia i analityka kosztów</p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 text-[#E0E0E0]/50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mb-4"></div>
          <p className="text-sm">Ładowanie statystyk...</p>
        </div>
      ) : stats ? (
        <div className="space-y-6">
          {/* Overview Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
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
                <h2 className="text-xl font-bold text-[#E0E0E0]">Przegląd zużycia</h2>
                <p className="text-sm text-[#E0E0E0]/60">Aktualne statystyki API</p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-[#2B2D31] rounded-xl p-4 border border-[#3F4147]/50">
                <p className="text-xs text-[#E0E0E0]/60 mb-1">Zapytania</p>
                <p className="text-2xl font-bold text-purple-400">{stats.overview?.totalRequests?.toLocaleString() || 0}</p>
                <p className="text-xs text-[#E0E0E0]/40 mt-1">User requests</p>
              </div>
              <div className="bg-[#2B2D31] rounded-xl p-4 border border-[#3F4147]/50">
                <p className="text-xs text-[#E0E0E0]/60 mb-1">Wiadomości</p>
                <p className="text-2xl font-bold text-purple-400">{stats.overview?.totalMessages?.toLocaleString() || 0}</p>
                <p className="text-xs text-[#E0E0E0]/40 mt-1">Total messages</p>
              </div>
              <div className="bg-[#2B2D31] rounded-xl p-4 border border-[#3F4147]/50">
                <p className="text-xs text-[#E0E0E0]/60 mb-1">Użytkownicy</p>
                <p className="text-2xl font-bold text-purple-400">{stats.overview?.uniqueUsers || 0}</p>
                <p className="text-xs text-[#E0E0E0]/40 mt-1">Active users</p>
              </div>
              <div className="bg-[#2B2D31] rounded-xl p-4 border border-[#3F4147]/50">
                <p className="text-xs text-[#E0E0E0]/60 mb-1">Tokeny</p>
                <p className="text-2xl font-bold text-purple-400">{((stats.tokens?.totalEstimated || 0) / 1000).toFixed(1)}K</p>
                <p className="text-xs text-[#E0E0E0]/40 mt-1">Estimated tokens</p>
              </div>
              <div className="bg-[#2B2D31] rounded-xl p-4 border border-[#3F4147]/50">
                <p className="text-xs text-[#E0E0E0]/60 mb-1">Koszt (USD)</p>
                <p className="text-2xl font-bold text-purple-400">${(stats.cost?.totalEstimatedUSD || 0).toFixed(2)}</p>
                <p className="text-xs text-[#E0E0E0]/40 mt-1">Total cost</p>
              </div>
            </div>
          </motion.div>

          {/* Top Users */}
          {stats.topUsers && stats.topUsers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] p-6 shadow-xl"
            >
              <h3 className="text-lg font-semibold text-[#E0E0E0] mb-4 flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                Top użytkownicy AI Chat
              </h3>
              <div className="space-y-3">
                {stats.topUsers.map((user, i) => (
                  <div key={i} className="flex items-center justify-between bg-[#2B2D31] px-4 py-4 rounded-xl border border-[#3F4147]/50">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-[#E0E0E0]/30 w-8">#{i + 1}</span>
                      <div>
                        <p className="text-sm font-semibold text-[#E0E0E0]">{user.name || "Brak imienia"}</p>
                        <p className="text-xs text-[#E0E0E0]/60">{user.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-purple-400">{user.messageCount}</p>
                      <p className="text-xs text-[#E0E0E0]/40">wiadomości</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Daily Activity */}
          {stats.dailyActivity && stats.dailyActivity.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] p-6 shadow-xl"
            >
              <h3 className="text-lg font-semibold text-[#E0E0E0] mb-4 flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Aktywność (ostatnie 7 dni)
              </h3>
              <div className="space-y-2">
                {stats.dailyActivity.slice().reverse().map((day, i) => (
                  <div key={i} className="flex items-center justify-between bg-[#2B2D31] px-4 py-3 rounded-lg border border-[#3F4147]/50">
                    <span className="text-sm font-medium text-[#E0E0E0]">
                      {new Date(day.date).toLocaleDateString("pl-PL", { weekday: "short", day: "numeric", month: "short" })}
                    </span>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-[#E0E0E0]/60">User: <span className="text-blue-400 font-semibold">{day.userMessages}</span></span>
                      <span className="text-xs text-[#E0E0E0]/60">AI: <span className="text-purple-400 font-semibold">{day.assistantMessages}</span></span>
                      <span className="text-sm text-[#E0E0E0] font-bold">Total: {day.total}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      ) : (
        <div className="bg-[#313338] rounded-xl border border-red-500/30 p-6 text-center">
          <p className="text-red-400 font-semibold mb-2">Nie udało się załadować statystyk</p>
          <p className="text-sm text-[#E0E0E0]/60">Spróbuj odświeżyć stronę</p>
        </div>
      )}
    </AdminShell>
  );
}
