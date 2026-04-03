"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function StickyBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [stockLeft, setStockLeft] = useState(9);
  const [hasScrolled, setHasScrolled] = useState(false);

  // Show banner after scrolling down
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 800 && !hasScrolled) {
        setHasScrolled(true);
        setIsVisible(true);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasScrolled]);

  // Sync stock with BuyNow component using cookie
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
  }, []);

  const handleClose = () => {
    setIsVisible(false);
  };

  const scrollToOrder = () => {
    const buySection = document.getElementById("kup-teraz");
    if (buySection) {
      buySection.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Calculate days until next delivery (always show 28-32 days from today)
  const daysUntilDelivery = 28 + (new Date().getDate() % 5);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-r from-red-600 to-orange-600 dark:from-red-700 dark:to-orange-700 shadow-lg"
        >
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-wrap">
                {/* Stock warning */}
                <div className="flex items-center gap-2 text-white">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>
                  <span className="text-sm font-bold">
                    Tylko {stockLeft} sztuk w magazynie!
                  </span>
                </div>

                {/* Next delivery */}
                <div className="hidden sm:flex items-center gap-2 text-white/90 text-xs">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="3" width="15" height="13" />
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                    <circle cx="5.5" cy="18.5" r="2.5" />
                    <circle cx="18.5" cy="18.5" r="2.5" />
                  </svg>
                  Następna dostawa za {daysUntilDelivery} dni
                </div>

                {/* High demand */}
                <div className="hidden md:flex items-center gap-2 text-white/90 text-xs">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  Wysokie zainteresowanie - 34 osób ogląda teraz
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={scrollToOrder}
                  className="px-4 py-1.5 bg-white text-red-600 font-bold text-sm rounded-full hover:bg-gray-100 transition-colors whitespace-nowrap"
                >
                  Zamów teraz
                </button>
                <button
                  onClick={handleClose}
                  className="w-6 h-6 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
                  aria-label="Zamknij banner"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
