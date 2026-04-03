"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function FlashSale() {
  const [countdown, setCountdown] = useState({ h: 0, m: 0, s: 0 });
  const [stockLeft, setStockLeft] = useState(9);
  const [progressWidth, setProgressWidth] = useState(30);

  // Countdown to midnight
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(23, 59, 59, 999);
      const diff = Math.max(0, midnight.getTime() - now.getTime());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown({ h, m, s });
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  // Stock based on day
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    let seed = 0;
    for (let i = 0; i < today.length; i++) seed += today.charCodeAt(i) * (i + 1);
    const baseStock = (seed % 6) + 7;
    const cookieKey = "km_s";
    const cookies = document.cookie.split("; ").reduce((acc, c) => {
      const [k, v] = c.split("=");
      acc[k] = v;
      return acc;
    }, {} as Record<string, string>);

    const stored = cookies[cookieKey];
    let decrements = 0;
    if (stored) {
      const [storedDate, storedDec] = stored.split(":");
      if (storedDate === today) {
        decrements = parseInt(storedDec, 10) || 0;
      }
    }

    const stock = Math.max(3, baseStock - decrements);
    setStockLeft(stock);
    setProgressWidth(Math.min(100, (stock / 30) * 100));
  }, []);

  // Slowly decrement stock
  useEffect(() => {
    const timer = setInterval(() => {
      setStockLeft((prev) => {
        if (prev <= 3) return prev;
        const next = prev - 1;
        setProgressWidth(Math.min(100, (next / 30) * 100));
        return next;
      });
    }, 90000 + Math.random() * 60000);
    return () => clearInterval(timer);
  }, []);

  const scrollToBuy = () => {
    document.getElementById("kup-teraz")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="py-16 bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 dark:from-red-950/20 dark:via-orange-950/20 dark:to-yellow-950/20 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-96 h-96 bg-red-500 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-500 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      <div className="max-w-5xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="bg-white dark:bg-[#2B2D31] rounded-3xl border-4 border-red-500 dark:border-red-600 p-8 lg:p-12 shadow-2xl"
        >
          {/* Pre-sale badge */}
          <div className="flex justify-center mb-4">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 text-sm font-bold rounded-full uppercase tracking-wide border border-amber-300 dark:border-amber-500/30">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Przedsprzedaż — wysyłka max. do 3 maja
            </span>
          </div>

          {/* Flash Sale Badge */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="relative">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-red-600 dark:text-red-500 animate-pulse"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <div className="absolute inset-0 bg-red-500 blur-xl opacity-50 animate-pulse" />
            </div>
            <h2 className="text-3xl lg:text-4xl font-black text-red-600 dark:text-red-500 uppercase tracking-tight">
              Flash Sale
            </h2>
          </div>

          <p className="text-center text-xl text-[#1a1a1a] dark:text-[#E0E0E0] mb-8">
            <span className="font-bold text-red-600 dark:text-red-500">77% TANIEJ</span> tylko dziś!
          </p>

          {/* Countdown Timer */}
          <div className="mb-8">
            <p className="text-center text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mb-4 uppercase tracking-wider font-semibold">
              Oferta wygasa za:
            </p>
            <div className="flex items-center justify-center gap-3">
              <div className="flex flex-col items-center">
                <div className="bg-gradient-to-br from-red-600 to-red-700 dark:from-red-700 dark:to-red-800 text-white rounded-xl px-6 py-4 min-w-[5rem] shadow-lg">
                  <span className="font-mono font-black text-4xl block">
                    {String(countdown.h).padStart(2, "0")}
                  </span>
                </div>
                <span className="text-xs text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50 mt-2 uppercase tracking-wider font-semibold">
                  Godzin
                </span>
              </div>
              <span className="text-3xl font-bold text-[#1a1a1a]/30 dark:text-[#E0E0E0]/30 mb-6">:</span>
              <div className="flex flex-col items-center">
                <div className="bg-gradient-to-br from-red-600 to-red-700 dark:from-red-700 dark:to-red-800 text-white rounded-xl px-6 py-4 min-w-[5rem] shadow-lg">
                  <span className="font-mono font-black text-4xl block">
                    {String(countdown.m).padStart(2, "0")}
                  </span>
                </div>
                <span className="text-xs text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50 mt-2 uppercase tracking-wider font-semibold">
                  Minut
                </span>
              </div>
              <span className="text-3xl font-bold text-[#1a1a1a]/30 dark:text-[#E0E0E0]/30 mb-6">:</span>
              <div className="flex flex-col items-center">
                <div className="bg-gradient-to-br from-red-600 to-red-700 dark:from-red-700 dark:to-red-800 text-white rounded-xl px-6 py-4 min-w-[5rem] shadow-lg">
                  <span className="font-mono font-black text-4xl block animate-pulse">
                    {String(countdown.s).padStart(2, "0")}
                  </span>
                </div>
                <span className="text-xs text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50 mt-2 uppercase tracking-wider font-semibold">
                  Sekund
                </span>
              </div>
            </div>
          </div>

          {/* Stock Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-[#1a1a1a]/70 dark:text-[#E0E0E0]/70">
                Pozostało w magazynie:
              </span>
              <span className="text-lg font-black text-red-600 dark:text-red-500">
                {stockLeft} szt.
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-[#313338] rounded-full h-4 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressWidth}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 rounded-full relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
              </motion.div>
            </div>
            <p className="text-xs text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50 mt-2 text-center">
              🔥 Ostatnie sztuki w tej cenie!
            </p>
          </div>

          {/* Price */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <span className="text-5xl font-black text-[#1a1a1a] dark:text-[#E0E0E0]">
              499 zł
            </span>
            <div className="flex flex-col">
              <span className="text-2xl text-[#1a1a1a]/30 dark:text-[#E0E0E0]/30 line-through">
                2199 zł
              </span>
              <span className="px-3 py-1 bg-red-600 text-white text-sm font-black rounded-full">
                OSZCZĘDZASZ 1700 ZŁ
              </span>
            </div>
          </div>

          {/* CTA Button */}
          <motion.button
            onClick={scrollToBuy}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-5 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white text-xl font-black rounded-full shadow-xl hover:shadow-2xl transition-all uppercase tracking-wide"
          >
            🔥 Kup teraz ze zniżką -77%
          </motion.button>

          {/* Trust Badges */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50">
            <div className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              Bezpieczna płatność
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="3" width="15" height="13" />
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
              Darmowa wysyłka
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
              </svg>
              14 dni na zwrot
            </div>
          </div>
        </motion.div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </section>
  );
}
