"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import AdminShell from "@/components/admin/AdminShell";

interface UserStat {
  id: string;
  email: string;
  name: string | null;
  tokenBalance: number;
  tokensConsumed: number;
  tokenPct: number;
  aiModel: string;
  modelLabel: string;
  aiMode: string;
  chatMessages: number;
  deviceSolves: number;
  estimatedCostUSD: number;
}

interface StatsData {
  users: UserStat[];
  totals: {
    totalUsers: number;
    totalTokensConsumed: number;
    totalChatMessages: number;
    totalDeviceSolves: number;
    totalEstimatedCostUSD: number;
  };
  dailyActivity: Array<{ date: string; chat: number; device: number; total: number }>;
}

const TOKEN_GRANT = 1_000_000;

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function ProgressBar({ pct, color = "blue" }: { pct: number; color?: string }) {
  const colors: Record<string, string> = {
    blue: "from-blue-500 to-blue-400",
    green: "from-emerald-500 to-emerald-400",
    yellow: "from-yellow-500 to-yellow-400",
    red: "from-red-500 to-red-400",
  };
  const pick = pct > 80 ? "red" : pct > 50 ? "yellow" : "green";
  return (
    <div className="w-full bg-[#1E2024] rounded-full h-1.5 overflow-hidden">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${colors[pick]} transition-all`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

export default function OpenRouterPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"consumed" | "chat" | "device" | "cost">("consumed");

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/openrouter-stats");
      if (res.ok) setData(await res.json());
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchStats();
    const iv = setInterval(fetchStats, 30000);
    return () => clearInterval(iv);
  }, []);

  const sortedUsers = data
    ? [...data.users].sort((a, b) => {
        if (sortBy === "chat") return b.chatMessages - a.chatMessages;
        if (sortBy === "device") return b.deviceSolves - a.deviceSolves;
        if (sortBy === "cost") return b.estimatedCostUSD - a.estimatedCostUSD;
        return b.tokensConsumed - a.tokensConsumed;
      })
    : [];

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#E0E0E0] mb-1">OpenRouter AI</h1>
          <p className="text-sm text-[#E0E0E0]/60">Realne zużycie tokenów i koszty API</p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchStats(); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#313338] hover:bg-[#3F4147] rounded-lg text-sm text-[#3B82F6] transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
          Odśwież
        </button>
      </div>

      {loading && !data ? (
        <div className="flex flex-col items-center justify-center h-64 text-[#E0E0E0]/50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3B82F6] mb-4" />
          <p className="text-sm">Ładowanie statystyk...</p>
        </div>
      ) : data ? (
        <div className="space-y-6">

          {/* Overview */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 lg:grid-cols-5 gap-4"
          >
            {[
              { label: "Użytkownicy", value: data.totals.totalUsers, sub: "z kontem", color: "text-[#3B82F6]" },
              { label: "Tokeny (skonsumowane)", value: fmtTokens(data.totals.totalTokensConsumed), sub: `z ${fmtTokens(data.totals.totalUsers * TOKEN_GRANT)} dostępnych`, color: "text-purple-400" },
              { label: "Wiadomości chat", value: data.totals.totalChatMessages.toLocaleString(), sub: "zapytań użytkowników", color: "text-emerald-400" },
              { label: "Solve (kalkulator)", value: data.totals.totalDeviceSolves.toLocaleString(), sub: "rozwiązanych zadań", color: "text-yellow-400" },
              { label: "Koszt API (est.)", value: `$${data.totals.totalEstimatedCostUSD.toFixed(4)}`, sub: `≈ ${(data.totals.totalEstimatedCostUSD * 3.9).toFixed(2)} PLN`, color: "text-red-400" },
            ].map((s, i) => (
              <div key={i} className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] p-5 shadow-xl">
                <p className="text-xs text-[#E0E0E0]/50 mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-[#E0E0E0]/40 mt-1">{s.sub}</p>
              </div>
            ))}
          </motion.div>

          {/* Economy note */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-[#1a2a1a] border border-emerald-500/30 rounded-2xl p-4 flex items-start gap-3"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
              </svg>
            </div>
            <div className="text-sm">
              <p className="text-emerald-400 font-semibold mb-0.5">Ekonomika tokenów</p>
              <p className="text-[#E0E0E0]/60">
                1M efektywnych tokenów = ~$1.40 kosztu API (niezależnie od modelu).
                Przy subskrypcji 30 PLN (~$7.70) marża wynosi <span className="text-emerald-400 font-semibold">~82%</span>.
                {" "}Szacowany przychód przy pełnym zużyciu ({data.totals.totalUsers} userów × 30 PLN) ={" "}
                <span className="text-emerald-400 font-semibold">{(data.totals.totalUsers * 30).toLocaleString()} PLN</span>,
                {" "}koszt API <span className="text-red-400 font-semibold">{(data.totals.totalUsers * 1.40 * 3.9).toFixed(2)} PLN</span>.
              </p>
            </div>
          </motion.div>

          {/* Daily Activity */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold text-[#E0E0E0] mb-4 flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Aktywność (ostatnie 7 dni)
            </h2>
            <div className="space-y-2">
              {[...data.dailyActivity].reverse().map((day, i) => {
                const maxTotal = Math.max(...data.dailyActivity.map((d) => d.total), 1);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-[#E0E0E0]/50 w-24 flex-shrink-0">
                      {new Date(day.date).toLocaleDateString("pl-PL", { weekday: "short", day: "numeric", month: "short" })}
                    </span>
                    <div className="flex-1 bg-[#1E2024] rounded-full h-2 overflow-hidden">
                      <div className="h-full flex">
                        <div
                          className="bg-blue-500/70 rounded-l-full"
                          style={{ width: `${(day.chat / maxTotal) * 100}%` }}
                        />
                        <div
                          className="bg-yellow-500/70 rounded-r-full"
                          style={{ width: `${(day.device / maxTotal) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs w-36 flex-shrink-0 justify-end">
                      <span className="text-blue-400">Chat: <span className="font-bold">{day.chat}</span></span>
                      <span className="text-yellow-400">Device: <span className="font-bold">{day.device}</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-[#E0E0E0]/40">
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-blue-500/70 inline-block" />AI Chat</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-yellow-500/70 inline-block" />Kalkulator (device)</span>
            </div>
          </motion.div>

          {/* Per-user table */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] p-6 shadow-xl"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-[#E0E0E0] flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                Użytkownicy — zużycie tokenów
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#E0E0E0]/40">Sortuj:</span>
                {(["consumed", "chat", "device", "cost"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSortBy(s)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      sortBy === s ? "bg-[#3B82F6] text-white" : "bg-[#2B2D31] text-[#E0E0E0]/50 hover:text-[#E0E0E0]"
                    }`}
                  >
                    {{ consumed: "Tokeny", chat: "Chat", device: "Device", cost: "Koszt" }[s]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {sortedUsers.map((u, i) => (
                <div key={u.id} className="bg-[#2B2D31] rounded-xl border border-[#3F4147]/50 p-4 hover:border-[#3B82F6]/20 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className="text-sm font-bold text-[#E0E0E0]/20 w-6 flex-shrink-0 mt-0.5">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      {/* Row 1: email + badges */}
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <p className="text-sm font-semibold text-[#E0E0E0] truncate">{u.email}</p>
                        {u.name && <p className="text-xs text-[#E0E0E0]/40 truncate">({u.name})</p>}
                        <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/15 text-purple-400 border border-purple-500/20">
                          {u.modelLabel}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs border ${
                          u.aiMode === "raw"
                            ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                            : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        }`}>
                          {u.aiMode === "raw" ? "Czysty AI" : "Matura"}
                        </span>
                      </div>

                      {/* Token progress */}
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-[#E0E0E0]/50">
                            Zużyte: <span className="text-[#E0E0E0] font-semibold">{fmtTokens(u.tokensConsumed)}</span>
                            {" "}/{" "}
                            <span className="text-[#E0E0E0]/40">{fmtTokens(TOKEN_GRANT)}</span>
                          </span>
                          <span className="text-[#E0E0E0]/40">{u.tokenPct.toFixed(1)}%</span>
                        </div>
                        <ProgressBar pct={u.tokenPct} />
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-4 flex-wrap text-xs">
                        <span className="text-[#E0E0E0]/50">
                          Pozostało: <span className="text-emerald-400 font-semibold">{fmtTokens(u.tokenBalance)}</span>
                        </span>
                        <span className="text-[#E0E0E0]/50">
                          Chat: <span className="text-blue-400 font-semibold">{u.chatMessages}</span> wiad.
                        </span>
                        <span className="text-[#E0E0E0]/50">
                          Device: <span className="text-yellow-400 font-semibold">{u.deviceSolves}</span> solve
                        </span>
                        <span className="text-[#E0E0E0]/50">
                          Koszt API: <span className="text-red-400 font-semibold">${u.estimatedCostUSD.toFixed(4)}</span>
                          <span className="text-[#E0E0E0]/30 ml-1">≈ {(u.estimatedCostUSD * 3.9).toFixed(3)} PLN</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Model reference */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold text-[#E0E0E0] mb-4 flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Mnożniki modeli (koszt efektywny)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {[
                { id: "default", label: "Domyślny (Gemini 2.5 Pro)", multiplier: 4 },
                { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", multiplier: 5 },
                { id: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash", multiplier: 4 },
                { id: "anthropic/claude-opus-4.6", label: "Claude Opus 4.6", multiplier: 10 },
                { id: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6", multiplier: 6 },
                { id: "openai/gpt-5.4", label: "GPT-5.4", multiplier: 6 },
                { id: "x-ai/grok-4.3", label: "Grok 4.3", multiplier: 1.3 },
                { id: "deepseek/deepseek-v3.2", label: "DeepSeek V3.2", multiplier: 0.2 },
                { id: "qwen/qwen3-coder", label: "Qwen3 Coder", multiplier: 0.7 },
                { id: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick", multiplier: 0.3 },
                { id: "mistralai/mistral-large-2512", label: "Mistral Large 3", multiplier: 0.7 },
                { id: "perplexity/sonar-pro", label: "Sonar Pro", multiplier: 6 },
              ].map((m) => {
                const usersWithModel = data.users.filter((u) => u.aiModel === m.id).length;
                return (
                  <div key={m.id} className="bg-[#2B2D31] rounded-lg border border-[#3F4147]/50 px-3 py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#E0E0E0] truncate">{m.label}</p>
                      <p className="text-xs text-[#E0E0E0]/40">{usersWithModel > 0 ? `${usersWithModel} user${usersWithModel > 1 ? "ów" : ""}` : "nieużywany"}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 ${
                      m.multiplier >= 6 ? "bg-red-500/20 text-red-400" :
                      m.multiplier >= 2 ? "bg-yellow-500/20 text-yellow-400" :
                      "bg-emerald-500/20 text-emerald-400"
                    }`}>
                      ×{m.multiplier}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-[#E0E0E0]/30 mt-3">
              Mnożnik ×1.0 = Gemini 2.5 Flash (baseline $1.40/1M). Efektywne tokeny = realne tokeny × mnożnik. Koszt zawsze: efektywne × $1.40/1M.
            </p>
          </motion.div>

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
