"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

type NotificationType = "purchase" | "checkout";

interface Notification {
  name: string;
  city: string;
  time: string;
  type: NotificationType;
}

const notifications: Notification[] = [
  { name: "Michał K.", city: "Warszawa", time: "2 minuty temu", type: "purchase" },
  { name: "Anna S.", city: "Kraków", time: "teraz", type: "checkout" },
  { name: "Piotr W.", city: "Wrocław", time: "5 minut temu", type: "purchase" },
  { name: "Karolina M.", city: "Gdańsk", time: "teraz", type: "checkout" },
  { name: "Jakub N.", city: "Poznań", time: "8 minut temu", type: "purchase" },
  { name: "Natalia P.", city: "Łódź", time: "teraz", type: "checkout" },
  { name: "Tomasz R.", city: "Katowice", time: "12 minut temu", type: "purchase" },
  { name: "Magdalena L.", city: "Szczecin", time: "teraz", type: "checkout" },
  { name: "Bartosz K.", city: "Lublin", time: "15 minut temu", type: "purchase" },
  { name: "Julia W.", city: "Gdynia", time: "teraz", type: "checkout" },
  { name: "Damian S.", city: "Białystok", time: "18 minut temu", type: "purchase" },
  { name: "Weronika T.", city: "Bydgoszcz", time: "teraz", type: "checkout" },
];

export default function SocialProof() {
  const [currentNotification, setCurrentNotification] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    // Don't show if user has closed it
    if (hasInteracted) return;

    // Initial delay before first notification (reduced to 3 seconds)
    const initialDelay = setTimeout(() => {
      setIsVisible(true);
    }, 3000);

    return () => clearTimeout(initialDelay);
  }, [hasInteracted]);

  useEffect(() => {
    if (!isVisible || hasInteracted) return;

    // Show notification for 4 seconds, then hide for 1 second
    const showTimer = setTimeout(() => {
      setIsVisible(false);
    }, 4000);

    const cycleTimer = setTimeout(() => {
      setCurrentNotification((prev) => (prev + 1) % notifications.length);
      setIsVisible(true);
    }, 5000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(cycleTimer);
    };
  }, [isVisible, currentNotification, hasInteracted]);

  const handleClose = () => {
    setIsVisible(false);
    setHasInteracted(true);
  };

  const notification = notifications[currentNotification];
  const isCheckout = notification.type === "checkout";

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed bottom-6 left-6 z-50 max-w-sm"
        >
          <div className="bg-white dark:bg-[#2B2D31] rounded-xl shadow-2xl border border-gray-100 dark:border-[#3F4147] p-4 pr-12">
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 dark:bg-[#313338] text-[#1a1a1a]/40 dark:text-[#E0E0E0]/40 hover:bg-gray-200 dark:hover:bg-[#3F4147] transition-colors"
              aria-label="Zamknij powiadomienie"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="flex items-start gap-3">
              {/* Icon */}
              {isCheckout ? (
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-500/10 rounded-full flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#2563EB] dark:text-[#3B82F6]">
                    <circle cx="9" cy="21" r="1" />
                    <circle cx="20" cy="21" r="1" />
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                  </svg>
                </div>
              ) : (
                <div className="flex-shrink-0 w-10 h-10 bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 dark:text-green-400">
                    <path d="M20 7h-9" />
                    <path d="M14 17H5" />
                    <circle cx="17" cy="17" r="3" />
                    <circle cx="7" cy="7" r="3" />
                  </svg>
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1a1a1a] dark:text-[#E0E0E0]">
                  {isCheckout
                    ? `${notification.name} właśnie dokonuje płatności`
                    : `${notification.name} kupił KalkMate`}
                </p>
                <p className="text-xs text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mt-0.5">
                  {notification.city} • {notification.time}
                </p>
              </div>
            </div>

            {/* Badge */}
            {isCheckout ? (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-[#2563EB] dark:text-[#3B82F6]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2563EB] dark:bg-[#3B82F6] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2563EB] dark:bg-[#3B82F6]"></span>
                </span>
                Trwa płatność
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Zweryfikowany zakup
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
