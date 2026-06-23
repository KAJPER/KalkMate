"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AdminShell from "@/components/admin/AdminShell";

interface Coupon {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;        // percent: 1..100 ; fixed: grosze
  active: number;       // 0/1
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  createdAt: string;
}

function describe(c: Coupon): string {
  return c.type === "percent"
    ? `-${c.value}%`
    : `-${(c.value / 100).toFixed(2).replace(/\.00$/, "")} zł`;
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // form
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/coupons");
      if (res.ok) {
        const d = await res.json();
        setCoupons(d.coupons || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCoupons(); }, []);

  const createCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          type,
          value: Number(value),
          maxUses: maxUses ? Number(maxUses) : null,
          expiresAt: expiresAt || null,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setErr(d.error || "Nie udało się utworzyć kuponu.");
      } else {
        setCode(""); setValue(""); setMaxUses(""); setExpiresAt("");
        fetchCoupons();
      }
    } catch {
      setErr("Wystąpił błąd.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c: Coupon) => {
    await fetch(`/api/admin/coupons?id=${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
    fetchCoupons();
  };

  const deleteCoupon = async (c: Coupon) => {
    if (!confirm(`Usunąć kupon ${c.code}?`)) return;
    await fetch(`/api/admin/coupons?id=${c.id}`, { method: "DELETE" });
    fetchCoupons();
  };

  const inputCls =
    "w-full bg-[#2B2D31] border border-[#3F4147] rounded-lg px-3 py-2.5 text-sm text-[#E0E0E0] focus:outline-none focus:border-[#3B82F6]";

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#E0E0E0] mb-1">Kupony rabatowe</h1>
          <p className="text-sm text-[#E0E0E0]/60">Rabaty do zakupu kalkulatora (procent lub kwota zł)</p>
        </div>
        <button
          onClick={fetchCoupons}
          className="flex items-center gap-2 px-4 py-2 bg-[#313338] hover:bg-[#3F4147] rounded-lg text-sm text-[#3B82F6] transition-colors"
        >
          Odśwież
        </button>
      </div>

      {/* Create form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] p-6 shadow-xl max-w-3xl mb-6"
      >
        <h2 className="text-xl font-bold text-[#E0E0E0] mb-5">Nowy kupon</h2>
        <form onSubmit={createCoupon} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#E0E0E0]/60 mb-1.5 block">Kod kuponu</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="MATURA2026"
                className={inputCls + " font-mono uppercase"}
              />
            </div>
            <div>
              <label className="text-xs text-[#E0E0E0]/60 mb-1.5 block">Typ rabatu</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType("percent")}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    type === "percent" ? "bg-[#3B82F6] text-white" : "bg-[#2B2D31] text-[#E0E0E0]/60"
                  }`}
                >
                  Procent %
                </button>
                <button
                  type="button"
                  onClick={() => setType("fixed")}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    type === "fixed" ? "bg-[#3B82F6] text-white" : "bg-[#2B2D31] text-[#E0E0E0]/60"
                  }`}
                >
                  Kwota zł
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-[#E0E0E0]/60 mb-1.5 block">
                {type === "percent" ? "Wartość (%)" : "Wartość (zł)"}
              </label>
              <input
                type="number"
                min={type === "percent" ? 1 : 0.01}
                max={type === "percent" ? 100 : undefined}
                step={type === "percent" ? 1 : 0.01}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={type === "percent" ? "10" : "50"}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-[#E0E0E0]/60 mb-1.5 block">Limit użyć (opcj.)</label>
              <input
                type="number"
                min={1}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="bez limitu"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-[#E0E0E0]/60 mb-1.5 block">Wygasa (opcj.)</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {type === "fixed" && (
            <p className="text-xs text-[#E0E0E0]/40">
              Kupon kwotowy działa tylko dla zamówień w PLN (kalkulator 699 zł).
            </p>
          )}

          {err && <p className="text-sm text-red-400">{err}</p>}

          <button
            type="submit"
            disabled={saving}
            className="bg-[#3B82F6] hover:bg-[#2563EB] text-white px-6 py-3 rounded-xl font-semibold transition-all disabled:opacity-50"
          >
            {saving ? "Tworzenie..." : "Utwórz kupon"}
          </button>
        </form>
      </motion.div>

      {/* List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] shadow-xl overflow-hidden"
      >
        <div className="p-6 border-b border-[#3F4147]">
          <h2 className="text-xl font-bold text-[#E0E0E0]">Lista kuponów ({coupons.length})</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3B82F6]"></div>
          </div>
        ) : coupons.length > 0 ? (
          <div className="divide-y divide-[#3F4147]">
            <AnimatePresence>
              {coupons.map((c) => {
                const expired = c.expiresAt && Date.now() > new Date(c.expiresAt + "T23:59:59").getTime();
                const usedUp = c.maxUses != null && c.usedCount >= c.maxUses;
                const live = !!c.active && !expired && !usedUp;
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-4 hover:bg-[#313338] transition-colors flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <code className="text-sm font-mono font-bold text-[#3B82F6] bg-[#2B2D31] px-3 py-1 rounded">
                          {c.code}
                        </code>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#D8FF3D]/15 text-[#D8FF3D]">
                          {describe(c)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          live ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                        }`}>
                          {live ? "● Aktywny" : c.active ? (expired ? "Wygasł" : "Limit") : "Wyłączony"}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[#E0E0E0]/60 flex-wrap">
                        <span>Użyto: {c.usedCount}{c.maxUses != null ? ` / ${c.maxUses}` : " (bez limitu)"}</span>
                        {c.expiresAt && <span>• Wygasa: {c.expiresAt}</span>}
                        <span>• Utworzono: {new Date(c.createdAt).toLocaleDateString("pl-PL")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActive(c)}
                        className="px-3 py-1.5 bg-[#2B2D31] hover:bg-[#3F4147] text-[#E0E0E0]/70 text-xs rounded-lg transition-colors"
                      >
                        {c.active ? "Wyłącz" : "Włącz"}
                      </button>
                      <button
                        onClick={() => deleteCoupon(c)}
                        className="px-3 py-1.5 bg-[#2B2D31] hover:bg-red-500/20 text-[#E0E0E0]/50 hover:text-red-400 text-xs rounded-lg transition-colors"
                      >
                        Usuń
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="p-12 text-center text-[#E0E0E0]/40">Brak kuponów</div>
        )}
      </motion.div>
    </AdminShell>
  );
}
