"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AdminShell from "@/components/admin/AdminShell";

interface License {
  id: string;
  code: string;
  durationDays: number;
  isUsed: boolean;
  usedBy: string | null;
  usedAt: string | null;
  createdAt: string;
  usedByUser?: {
    id: string;
    email: string;
    name: string | null;
  } | null;
}

export default function LicensesPage() {
  const [generatingCodes, setGeneratingCodes] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [licenseDuration, setLicenseDuration] = useState<"week" | "month" | "3months">("month");
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "used" | "unused">("all");
  const [stats, setStats] = useState({ total: 0, used: 0, unused: 0 });

  useEffect(() => {
    fetchLicenses();
  }, [filter]);

  const fetchLicenses = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/licenses/list?filter=${filter}&limit=100`);
      if (res.ok) {
        const data = await res.json();
        setLicenses(data.licenses);

        // Calculate stats
        const all = await fetch(`/api/admin/licenses/list?limit=1000`).then(r => r.json());
        setStats({
          total: all.total,
          used: all.licenses.filter((l: License) => l.isUsed).length,
          unused: all.licenses.filter((l: License) => !l.isUsed).length,
        });
      }
    } catch (error) {
      console.error("Failed to fetch licenses:", error);
    } finally {
      setLoading(false);
    }
  };

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
        fetchLicenses(); // Refresh list
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

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#E0E0E0] mb-1">Generator Licencji</h1>
          <p className="text-sm text-[#E0E0E0]/60">Zarządzaj kodami dostępu do AI Chat</p>
        </div>
        <button
          onClick={fetchLicenses}
          className="flex items-center gap-2 px-4 py-2 bg-[#313338] hover:bg-[#3F4147] rounded-lg text-sm text-[#3B82F6] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
          Odśwież
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-xl border border-[#3F4147] p-5">
          <p className="text-xs text-[#E0E0E0]/60 mb-1">Wszystkie licencje</p>
          <p className="text-3xl font-bold text-[#3B82F6]">{stats.total}</p>
        </div>
        <div className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-xl border border-[#3F4147] p-5">
          <p className="text-xs text-[#E0E0E0]/60 mb-1">Użyte</p>
          <p className="text-3xl font-bold text-green-400">{stats.used}</p>
        </div>
        <div className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-xl border border-[#3F4147] p-5">
          <p className="text-xs text-[#E0E0E0]/60 mb-1">Dostępne</p>
          <p className="text-3xl font-bold text-purple-400">{stats.unused}</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] p-6 shadow-xl max-w-3xl"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#2563EB] flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#E0E0E0]">Generuj nowe licencje</h2>
            <p className="text-sm text-[#E0E0E0]/60">Kody dostępu dla użytkowników</p>
          </div>
        </div>

        <div className="bg-[#2B2D31] rounded-xl p-4 mb-6 border border-[#3F4147]/50">
          <p className="text-sm text-[#E0E0E0]/80 mb-2">
            <span className="font-semibold text-[#3B82F6]">Format:</span> 16 znaków (a-z, 0-9, -+=%)<br />
            <span className="font-semibold text-[#3B82F6]">Dostęp:</span> AI Chat przez wybrany okres
          </p>
        </div>

        <div className="mb-6">
          <label className="text-sm font-semibold text-[#E0E0E0] mb-3 block">Wybierz okres dostępu:</label>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setLicenseDuration("week")}
              className={`px-4 py-4 rounded-xl text-sm font-medium transition-all ${
                licenseDuration === "week"
                  ? "bg-gradient-to-br from-[#3B82F6] to-[#2563EB] text-white shadow-lg scale-105"
                  : "bg-[#2B2D31] text-[#E0E0E0]/60 hover:bg-[#313338]"
              }`}
            >
              <div className="font-bold text-base">Tydzień</div>
              <div className="text-xs opacity-75 mt-1">7 dni</div>
            </button>
            <button
              onClick={() => setLicenseDuration("month")}
              className={`px-4 py-4 rounded-xl text-sm font-medium transition-all ${
                licenseDuration === "month"
                  ? "bg-gradient-to-br from-[#3B82F6] to-[#2563EB] text-white shadow-lg scale-105"
                  : "bg-[#2B2D31] text-[#E0E0E0]/60 hover:bg-[#313338]"
              }`}
            >
              <div className="font-bold text-base">Miesiąc</div>
              <div className="text-xs opacity-75 mt-1">30 dni</div>
            </button>
            <button
              onClick={() => setLicenseDuration("3months")}
              className={`px-4 py-4 rounded-xl text-sm font-medium transition-all ${
                licenseDuration === "3months"
                  ? "bg-gradient-to-br from-[#3B82F6] to-[#2563EB] text-white shadow-lg scale-105"
                  : "bg-[#2B2D31] text-[#E0E0E0]/60 hover:bg-[#313338]"
              }`}
            >
              <div className="font-bold text-base">3 miesiące</div>
              <div className="text-xs opacity-75 mt-1">90 dni</div>
            </button>
          </div>
        </div>

        <div className="flex gap-3 mb-4">
          <button
            onClick={() => generateLicenses(1)}
            disabled={generatingCodes}
            className="flex-1 bg-[#3B82F6] hover:bg-[#2563EB] text-white px-6 py-4 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
          >
            Generuj 1
          </button>
          <button
            onClick={() => generateLicenses(5)}
            disabled={generatingCodes}
            className="flex-1 bg-[#3B82F6] hover:bg-[#2563EB] text-white px-6 py-4 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
          >
            Generuj 5
          </button>
          <button
            onClick={() => generateLicenses(10)}
            disabled={generatingCodes}
            className="flex-1 bg-[#3B82F6] hover:bg-[#2563EB] text-white px-6 py-4 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
          >
            Generuj 10
          </button>
        </div>

        {generatingCodes && (
          <div className="flex items-center justify-center gap-2 text-[#3B82F6] text-sm py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#3B82F6]"></div>
            Generowanie licencji...
          </div>
        )}

        {generatedCodes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="bg-[#2B2D31] border border-[#3F4147] rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#E0E0E0] flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Wygenerowano pomyślnie ({generatedCodes.length})
              </h3>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedCodes.join("\n"));
                  alert("Skopiowano wszystkie licencje!");
                }}
                className="flex items-center gap-2 px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium rounded-lg transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Kopiuj wszystkie
              </button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {generatedCodes.map((code, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-[#313338] px-4 py-3 rounded-lg hover:bg-[#3F4147] transition-colors group"
                >
                  <code className="text-sm font-mono text-green-400 font-semibold">{code}</code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(code);
                      alert(`Skopiowano: ${code}`);
                    }}
                    className="text-xs text-[#E0E0E0]/40 hover:text-[#3B82F6] transition-colors opacity-0 group-hover:opacity-100"
                  >
                    Kopiuj
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* License List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] shadow-xl overflow-hidden"
      >
        <div className="p-6 border-b border-[#3F4147]">
          <h2 className="text-xl font-bold text-[#E0E0E0] mb-4">Lista licencji</h2>

          {/* Filter Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === "all"
                  ? "bg-[#3B82F6] text-white"
                  : "bg-[#2B2D31] text-[#E0E0E0]/60 hover:bg-[#313338]"
              }`}
            >
              Wszystkie ({stats.total})
            </button>
            <button
              onClick={() => setFilter("unused")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === "unused"
                  ? "bg-purple-500 text-white"
                  : "bg-[#2B2D31] text-[#E0E0E0]/60 hover:bg-[#313338]"
              }`}
            >
              Dostępne ({stats.unused})
            </button>
            <button
              onClick={() => setFilter("used")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === "used"
                  ? "bg-green-500 text-white"
                  : "bg-[#2B2D31] text-[#E0E0E0]/60 hover:bg-[#313338]"
              }`}
            >
              Użyte ({stats.used})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3B82F6]"></div>
          </div>
        ) : licenses.length > 0 ? (
          <div className="divide-y divide-[#3F4147]">
            <AnimatePresence>
              {licenses.map((license, i) => (
                <motion.div
                  key={license.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="p-4 hover:bg-[#313338] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <code className="text-sm font-mono font-bold text-[#3B82F6] bg-[#2B2D31] px-3 py-1 rounded">
                          {license.code}
                        </code>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          license.isUsed
                            ? "bg-green-500/20 text-green-400"
                            : "bg-purple-500/20 text-purple-400"
                        }`}>
                          {license.isUsed ? "✓ Użyta" : "◯ Dostępna"}
                        </span>
                        <span className="text-xs text-[#E0E0E0]/40">
                          {license.durationDays} dni
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-[#E0E0E0]/60">
                        <span>
                          Utworzona: {new Date(license.createdAt).toLocaleDateString("pl-PL", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </span>
                        {license.isUsed && license.usedByUser && (
                          <>
                            <span className="text-[#E0E0E0]/30">•</span>
                            <span className="text-green-400">
                              Użyta przez: {license.usedByUser.email}
                            </span>
                            <span className="text-[#E0E0E0]/30">•</span>
                            <span>
                              {new Date(license.usedAt!).toLocaleDateString("pl-PL", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric"
                              })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(license.code);
                        alert(`Skopiowano: ${license.code}`);
                      }}
                      className="px-3 py-1.5 bg-[#2B2D31] hover:bg-[#3F4147] text-[#E0E0E0]/60 hover:text-[#3B82F6] text-xs rounded-lg transition-colors"
                    >
                      Kopiuj
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="p-12 text-center text-[#E0E0E0]/40">
            Brak licencji w tej kategorii
          </div>
        )}
      </motion.div>
    </AdminShell>
  );
}
