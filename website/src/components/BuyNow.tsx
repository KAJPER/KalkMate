"use client";

import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Elements, PaymentMethodMessagingElement } from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import StripeProvider from "@/components/StripeProvider";
import CheckoutForm from "@/components/CheckoutForm";
import getStripe from "@/lib/getStripe";
import type { InPostPoint } from "@/components/InPostGeowidget";

const InPostGeowidget = lazy(() => import("@/components/InPostGeowidget"));

const INPOST_TOKEN = process.env.NEXT_PUBLIC_INPOST_GEOWIDGET_TOKEN || "";

const included = [
  "Urządzenie KalkMate",
  "30 naklejek znamionowych",
  "Miesiąc AI Chat gratis",
  "Kabel USB-C",
  "Instrukcja obsługi",
  "Instrukcja konfiguracji WiFi",
];

type Stage = "form" | "map" | "payment" | "error" | "success";

const inputClass =
  "w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-[#3F4147] bg-white dark:bg-[#313338] text-[#1a1a1a] dark:text-[#E0E0E0] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] dark:focus:ring-[#3B82F6]";

export default function BuyNow() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("form");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    consent: false,
  });
  const [selectedPoint, setSelectedPoint] = useState<InPostPoint | null>(null);

  const [stockLeft, setStockLeft] = useState(9);
  const [orderCount, setOrderCount] = useState(847);
  const [isDark, setIsDark] = useState(false);
  const [countdown, setCountdown] = useState({ h: 0, m: 0, s: 0 });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Day-seeded stock + cookie-based decrement for returning visitors
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    // Seed based on day string -> deterministic per day
    let seed = 0;
    for (let i = 0; i < today.length; i++) seed += today.charCodeAt(i) * (i + 1);
    const baseStock = (seed % 6) + 7; // 7-12 per day
    const baseOrders = (seed % 50) + 830; // 830-879 per day

    // Check cookie for how many decrements this visitor saw
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
    setOrderCount(baseOrders + decrements);
  }, []);

  // Slowly decrement stock over time, save to cookie
  useEffect(() => {
    const timer = setInterval(() => {
      setStockLeft((prev) => {
        if (prev <= 3) return prev;
        const next = prev - 1;
        // Save decrement to cookie (expires end of day)
        const today = new Date().toISOString().slice(0, 10);
        const cookieKey = "km_s";
        const cookies = document.cookie.split("; ").reduce((acc, c) => {
          const [k, v] = c.split("=");
          acc[k] = v;
          return acc;
        }, {} as Record<string, string>);
        const stored = cookies[cookieKey];
        let totalDec = 1;
        if (stored) {
          const [storedDate, storedDec] = stored.split(":");
          if (storedDate === today) totalDec = (parseInt(storedDec, 10) || 0) + 1;
        }
        const midnight = new Date();
        midnight.setHours(23, 59, 59, 0);
        document.cookie = `${cookieKey}=${today}:${totalDec}; expires=${midnight.toUTCString()}; path=/`;
        return next;
      });
      setOrderCount((prev) => prev + 1);
    }, 60000 + Math.random() * 60000); // every 1-2 min
    return () => clearInterval(timer);
  }, []);

  // Countdown to midnight (promotion ends "today")
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("redirect_status") === "succeeded") {
      setIsModalOpen(true);
      setStage("success");
    }
  }, []);

  // Lock body scroll when modal open
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isModalOpen]);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
    setStage("form");
    setErrorMessage("");
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handlePointSelect = useCallback((point: InPostPoint) => {
    setSelectedPoint(point);
    setStage("form");
  }, []);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPoint) {
      setErrorMessage("Wybierz punkt odbioru.");
      return;
    }

    setIsCreatingIntent(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          pickupPoint: selectedPoint.name,
          pickupPointAddress: `${selectedPoint.address.line1}, ${selectedPoint.address.line2}`,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Błąd serwera");
      }

      setClientSecret(data.clientSecret);
      setStage("payment");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Wystąpił nieoczekiwany błąd."
      );
    } finally {
      setIsCreatingIntent(false);
    }
  };

  const handlePaymentSuccess = () => {
    setStage("success");
    setOrderCount((prev) => prev + 1);
  };

  const handlePaymentError = (message: string) => {
    setErrorMessage(message);
    setStage("error");
  };

  return (
    <>
      <section id="kup-teraz" className="py-24 bg-[#F5F5F5] dark:bg-[#313338]">
        <div className="max-w-xl mx-auto px-6">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="text-3xl lg:text-4xl font-bold text-center text-[#1a1a1a] dark:text-[#E0E0E0]"
          >
            Miej przewagę na każdym egzaminie
          </motion.h2>

          {/* Marketing badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.05 }}
            className="mt-6 flex flex-wrap gap-3 justify-center"
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-medium rounded-full">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Zostało tylko {stockLeft} sztuk!
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 text-[#2563EB] dark:text-[#3B82F6] text-xs font-medium rounded-full">
              Już {orderCount} osób zamówiło
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-medium rounded-full">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13" />
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
              Darmowa wysyłka
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-medium rounded-full">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Promocja kończy się za {String(countdown.h).padStart(2, "0")}:{String(countdown.m).padStart(2, "0")}:{String(countdown.s).padStart(2, "0")}
            </span>
          </motion.div>

          {/* Product card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
            className="mt-8 bg-white dark:bg-[#2B2D31] rounded-xl border border-gray-100 dark:border-[#3F4147] p-8"
          >
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
                KalkMate v1.0
              </h3>
              <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-full uppercase tracking-wide">
                Przedsprzedaż
              </span>
            </div>

            <div className="mb-4 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Urządzenia są <strong>ręcznie produkowane</strong> — wysyłka wszystkich zamówień z przedsprzedaży nastąpi <strong>maksymalnie do 3 maja</strong>.
              </p>
            </div>

            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-4xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
                499 zł
              </span>
              <span className="text-lg text-[#1a1a1a]/30 dark:text-[#E0E0E0]/30 line-through">
                2199 zł
              </span>
              <span className="px-2 py-0.5 bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold rounded">
                -77%
              </span>
            </div>

            <p className="mt-2 text-sm text-[#2563EB] dark:text-[#3B82F6] font-medium">
              Darmowa wysyłka InPost
            </p>

            {/* Payment Method Messaging */}
            <div className="mt-4 [&_iframe]:!min-h-0">
              <Elements
                stripe={getStripe()}
                options={{
                  appearance: {
                    theme: isDark ? "night" : "flat",
                    variables: {
                      colorText: isDark ? "#b0b0b0" : "#4a4a4a",
                      colorTextSecondary: isDark ? "#b0b0b0" : "#4a4a4a",
                      colorPrimary: isDark ? "#93b4f5" : "#2563EB",
                      colorBackground: isDark ? "#2B2D31" : "#ffffff",
                      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
                    },
                  },
                } as StripeElementsOptions}
              >
                <PaymentMethodMessagingElement
                  options={{
                    amount: 49900,
                    currency: "PLN",
                    countryCode: "PL",
                  }}
                />
              </Elements>
            </div>

            <div className="mt-6 border-t border-gray-100 dark:border-[#3F4147] pt-6">
              <p className="text-xs text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50 uppercase tracking-wider font-medium">
                W zestawie
              </p>
              <ul className="mt-3 space-y-2">
                {included.map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#2563EB] dark:text-[#3B82F6]">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span className="text-sm text-[#1a1a1a]/70 dark:text-[#E0E0E0]/70">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Trust badges */}
            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-[#3F4147] flex flex-wrap gap-4">
              <div className="flex items-center gap-2 text-xs text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                Bezpieczna płatność
              </div>
              <div className="flex items-center gap-2 text-xs text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
                </svg>
                14 dni na zwrot
              </div>
              <div className="flex items-center gap-2 text-xs text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Gwarancja jakości
              </div>
            </div>

            <button
              onClick={openModal}
              className="mt-8 w-full py-3.5 bg-[#2563EB] dark:bg-[#3B82F6] text-white font-medium rounded-full hover:bg-[#1d4ed8] dark:hover:bg-[#2563EB] transition-colors text-lg"
            >
              Zamów teraz
            </button>
          </motion.div>
        </div>
      </section>

      {/* MODAL OVERLAY */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={closeModal}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className={`relative w-full max-h-[90vh] overflow-y-auto bg-white dark:bg-[#2B2D31] rounded-2xl border border-gray-100 dark:border-[#3F4147] shadow-2xl ${
                stage === "map" ? "max-w-3xl" : "max-w-lg"
              }`}
            >
              {/* Close button */}
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-[#313338] text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 hover:bg-gray-200 dark:hover:bg-[#3F4147] transition-colors z-10"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>

              <div className="p-8">
                {/* FORM STAGE */}
                {stage === "form" && (
                  <form onSubmit={handleFormSubmit} className="space-y-4">
                    <h3 className="text-xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] pr-8">
                      Dane do wysyłki
                    </h3>

                    {/* Mini order summary */}
                    <div className="p-4 bg-[#F5F5F5] dark:bg-[#313338] rounded-lg">
                      <div className="flex justify-between text-sm text-[#1a1a1a] dark:text-[#E0E0E0]">
                        <span className="font-medium">KalkMate v1.0</span>
                        <span className="font-bold">499 zł</span>
                      </div>
                      <div className="flex justify-between text-xs text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50 mt-1">
                        <span>Wysyłka Paczkomat InPost</span>
                        <span className="text-green-600 dark:text-green-400 font-medium">Gratis</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a]/70 dark:text-[#E0E0E0]/70 mb-1">
                        Imię i nazwisko
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a]/70 dark:text-[#E0E0E0]/70 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a]/70 dark:text-[#E0E0E0]/70 mb-1">
                        Telefon
                      </label>
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className={inputClass}
                      />
                    </div>

                    {/* Pickup point selection */}
                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a]/70 dark:text-[#E0E0E0]/70 mb-1">
                        Punkt odbioru
                      </label>
                      {selectedPoint ? (
                        <div className="flex items-center justify-between p-3 rounded-lg border border-[#2563EB] dark:border-[#3B82F6] bg-blue-50/50 dark:bg-blue-500/5">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex-shrink-0 w-8 h-8 bg-[#FFCF00] rounded-lg flex items-center justify-center">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                                <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
                              </svg>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#E0E0E0] truncate">
                                {selectedPoint.name}
                              </p>
                              <p className="text-xs text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50 truncate">
                                {selectedPoint.address.line1}, {selectedPoint.address.line2}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setStage("map")}
                            className="flex-shrink-0 ml-3 text-xs text-[#2563EB] dark:text-[#3B82F6] hover:underline font-medium"
                          >
                            Zmień
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setStage("map")}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-[#3F4147] text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 hover:border-[#2563EB] dark:hover:border-[#3B82F6] hover:text-[#2563EB] dark:hover:text-[#3B82F6] transition-colors"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          Wybierz Paczkomat InPost
                        </button>
                      )}
                    </div>

                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        required
                        checked={formData.consent}
                        onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                        className="mt-1 accent-[#2563EB]"
                      />
                      <span className="text-xs text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50">
                        Akceptuję regulamin sklepu i wyrażam zgodę na przetwarzanie danych
                        osobowych w celu realizacji zamówienia.
                      </span>
                    </div>

                    {errorMessage && (
                      <p className="text-sm text-red-500">{errorMessage}</p>
                    )}

                    <button
                      type="submit"
                      disabled={isCreatingIntent || !selectedPoint}
                      className={`w-full py-3 font-medium rounded-full text-white transition-colors ${
                        isCreatingIntent || !selectedPoint
                          ? "bg-[#2563EB]/60 dark:bg-[#3B82F6]/60 cursor-not-allowed"
                          : "bg-[#2563EB] dark:bg-[#3B82F6] hover:bg-[#1d4ed8] dark:hover:bg-[#2563EB]"
                      }`}
                    >
                      {isCreatingIntent ? "Ładowanie..." : "Przejdź do płatności"}
                    </button>
                  </form>
                )}

                {/* MAP STAGE - InPost Geowidget */}
                {stage === "map" && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] pr-8">
                        Wybierz punkt odbioru
                      </h3>
                      <button
                        onClick={() => setStage("form")}
                        className="text-sm text-[#2563EB] dark:text-[#3B82F6] hover:underline"
                      >
                        Wstecz
                      </button>
                    </div>
                    <p className="text-sm text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50 mb-4">
                      Paczkomaty InPost
                    </p>
                    <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-[#3F4147]">
                      <Suspense
                        fallback={
                          <div className="flex items-center justify-center h-[440px] bg-[#F5F5F5] dark:bg-[#313338]">
                            <div className="flex items-center gap-2 text-sm text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50">
                              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Ładowanie mapy...
                            </div>
                          </div>
                        }
                      >
                        <InPostGeowidget
                          token={INPOST_TOKEN}
                          onPointSelect={handlePointSelect}
                          height="440px"
                        />
                      </Suspense>
                    </div>
                  </div>
                )}

                {/* PAYMENT STAGE */}
                {(stage === "payment" || stage === "error") && clientSecret && (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] pr-8">
                        Płatność
                      </h3>
                      <button
                        onClick={() => {
                          setStage("form");
                          setErrorMessage("");
                        }}
                        className="text-sm text-[#2563EB] dark:text-[#3B82F6] hover:underline"
                      >
                        Wstecz
                      </button>
                    </div>

                    <div className="mb-6 p-4 bg-[#F5F5F5] dark:bg-[#313338] rounded-lg space-y-1">
                      <div className="flex justify-between text-sm text-[#1a1a1a] dark:text-[#E0E0E0]">
                        <span>KalkMate v1.0</span>
                        <span className="font-medium">499 zł</span>
                      </div>
                      <div className="flex justify-between text-sm text-[#1a1a1a] dark:text-[#E0E0E0]">
                        <span>Wysyłka</span>
                        <span className="text-green-600 dark:text-green-400 font-medium">Gratis</span>
                      </div>
                      {selectedPoint && (
                        <div className="flex items-center gap-1.5 text-xs text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50 pt-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          {selectedPoint.name} &middot; {selectedPoint.address.line1}
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-bold text-[#1a1a1a] dark:text-[#E0E0E0] pt-3 border-t border-gray-200 dark:border-[#3F4147]">
                        <span>Razem</span>
                        <span>499 zł</span>
                      </div>
                    </div>

                    {errorMessage && (
                      <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 rounded-lg">
                        <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
                      </div>
                    )}

                    <StripeProvider clientSecret={clientSecret}>
                      <CheckoutForm
                        onSuccess={handlePaymentSuccess}
                        onError={handlePaymentError}
                      />
                    </StripeProvider>
                  </div>
                )}

                {/* SUCCESS STAGE */}
                {stage === "success" && (
                  <div className="text-center py-4">
                    <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 dark:text-green-400">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <h3 className="mt-4 text-xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
                      Płatność zakończona!
                    </h3>
                    <p className="mt-2 text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">
                      Dziękujemy za zamówienie. Potwierdzenie wysłaliśmy na{" "}
                      <span className="font-medium text-[#1a1a1a] dark:text-[#E0E0E0]">
                        {formData.email}
                      </span>
                      . Zamówienie wyślemy w ciągu 3-5 dni roboczych.
                    </p>
                    {selectedPoint && (
                      <p className="mt-2 text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">
                        Punkt odbioru:{" "}
                        <span className="font-medium text-[#1a1a1a] dark:text-[#E0E0E0]">
                          {selectedPoint.name}
                        </span>
                        {" "}&middot; {selectedPoint.address.line1}
                      </p>
                    )}
                    <button
                      onClick={closeModal}
                      className="mt-6 px-8 py-2.5 bg-[#2563EB] dark:bg-[#3B82F6] text-white font-medium rounded-full hover:bg-[#1d4ed8] dark:hover:bg-[#2563EB] transition-colors"
                    >
                      Zamknij
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
