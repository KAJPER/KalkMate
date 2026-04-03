"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function UrgencyBanner() {
  const [currentAlert, setCurrentAlert] = useState(0);
  const [recentOrders, setRecentOrders] = useState(12);

  const alerts = [
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
      text: () => `${recentOrders} osób kupiło w ciągu ostatnich 24h`,
      color: "from-green-600 to-emerald-600 dark:from-green-700 dark:to-emerald-700",
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      text: () => "Promocja kończy się o północy - nie przegap!",
      color: "from-red-600 to-orange-600 dark:from-red-700 dark:to-orange-700",
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      ),
      text: () => "Darmowa wysyłka InPost - oszczędzasz 15 zł",
      color: "from-blue-600 to-cyan-600 dark:from-blue-700 dark:to-cyan-700",
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
      text: () => "30 dni darmowego AI Chat w prezencie!",
      color: "from-purple-600 to-pink-600 dark:from-purple-700 dark:to-pink-700",
    },
  ];

  // Rotate alerts every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentAlert((prev) => (prev + 1) % alerts.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [alerts.length]);

  // Increment recent orders occasionally
  useEffect(() => {
    const timer = setInterval(() => {
      setRecentOrders((prev) => prev + 1);
    }, 120000 + Math.random() * 60000); // every 2-3 min
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full bg-gradient-to-r overflow-hidden py-3">
      <div className="max-w-7xl mx-auto px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentAlert}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className={`flex items-center justify-center gap-3 bg-gradient-to-r ${alerts[currentAlert].color} text-white px-6 py-2.5 rounded-full shadow-lg`}
          >
            <div className="flex-shrink-0">
              {alerts[currentAlert].icon}
            </div>
            <span className="text-sm font-semibold text-center">
              {alerts[currentAlert].text()}
            </span>
          </motion.div>
        </AnimatePresence>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mt-3">
          {alerts.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentAlert(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentAlert
                  ? "w-8 bg-[#2563EB] dark:bg-[#3B82F6]"
                  : "w-2 bg-[#1a1a1a]/20 dark:bg-[#E0E0E0]/20"
              }`}
              aria-label={`Pokaż alert ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
