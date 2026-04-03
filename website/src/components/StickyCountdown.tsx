"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function StickyCountdown() {
  const [countdown, setCountdown] = useState({ h: 0, m: 0, s: 0 });
  const [isVisible, setIsVisible] = useState(true);

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

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          exit={{ y: -100 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed top-0 left-0 right-0 z-[60] bg-gradient-to-r from-red-600 to-orange-600 dark:from-red-700 dark:to-orange-700 text-white py-2 px-4 shadow-lg"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="flex items-center gap-2">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="animate-pulse"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="text-sm font-bold">PROMOCJA -77%</span>
              </div>
              <span className="hidden sm:inline text-sm">
                kończy się za:
              </span>
              <div className="flex items-center gap-1">
                <div className="bg-white/20 rounded px-2 py-1 min-w-[2.5rem] text-center">
                  <span className="font-mono font-bold text-lg">
                    {String(countdown.h).padStart(2, "0")}
                  </span>
                </div>
                <span className="font-bold">:</span>
                <div className="bg-white/20 rounded px-2 py-1 min-w-[2.5rem] text-center">
                  <span className="font-mono font-bold text-lg">
                    {String(countdown.m).padStart(2, "0")}
                  </span>
                </div>
                <span className="font-bold">:</span>
                <div className="bg-white/20 rounded px-2 py-1 min-w-[2.5rem] text-center">
                  <span className="font-mono font-bold text-lg">
                    {String(countdown.s).padStart(2, "0")}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsVisible(false)}
              className="text-white/80 hover:text-white transition-colors p-1"
              aria-label="Zamknij"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
