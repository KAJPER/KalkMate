"use client";

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Elements, PaymentMethodMessagingElement } from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import StripeProvider from "@/components/StripeProvider";
import CheckoutForm from "@/components/CheckoutForm";
import getStripe from "@/lib/getStripe";
import type { InPostPoint } from "@/components/InPostGeowidget";
import { useCart } from "@/components/CartContext";

const InPostGeowidget = lazy(() => import("@/components/InPostGeowidget"));

const INPOST_TOKEN = process.env.NEXT_PUBLIC_INPOST_GEOWIDGET_TOKEN || "";

const EU_COUNTRIES = new Set([
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE",
  "GR","HU","IE","IT","LV","LT","LU","MT","NL","PT","RO","SK","SI","ES","SE",
]);

const COUNTRIES = [
  { code: "PL", name: "🇵🇱 Polska — darmowa wysyłka InPost" },
  { code: "DE", name: "🇩🇪 Deutschland" },
  { code: "FR", name: "🇫🇷 France" },
  { code: "AT", name: "🇦🇹 Österreich" },
  { code: "CZ", name: "🇨🇿 Česká republika" },
  { code: "SK", name: "🇸🇰 Slovensko" },
  { code: "HU", name: "🇭🇺 Magyarország" },
  { code: "NL", name: "🇳🇱 Nederland" },
  { code: "BE", name: "🇧🇪 België / Belgique" },
  { code: "IT", name: "🇮🇹 Italia" },
  { code: "ES", name: "🇪🇸 España" },
  { code: "SE", name: "🇸🇪 Sverige" },
  { code: "DK", name: "🇩🇰 Danmark" },
  { code: "FI", name: "🇫🇮 Suomi" },
  { code: "PT", name: "🇵🇹 Portugal" },
  { code: "RO", name: "🇷🇴 România" },
  { code: "BG", name: "🇧🇬 България" },
  { code: "GR", name: "🇬🇷 Ελλάδα" },
  { code: "HR", name: "🇭🇷 Hrvatska" },
  { code: "GB", name: "🇬🇧 United Kingdom" },
  { code: "US", name: "🇺🇸 United States" },
  { code: "CA", name: "🇨🇦 Canada" },
  { code: "AU", name: "🇦🇺 Australia" },
  { code: "CH", name: "🇨🇭 Schweiz / Suisse" },
  { code: "NO", name: "🇳🇴 Norge" },
  { code: "OTHER", name: "🌍 Other country" },
];

const included = [
  "Urządzenie KalkMate v1.0",
  "30 naklejek znamionowych",
  "Miesiąc AI Chat gratis",
  "Kabel USB-C",
  "Instrukcja obsługi",
  "Instrukcja konfiguracji WiFi",
];

type Stage = "form" | "map" | "payment" | "error" | "success";

const inputClass =
  "w-full px-4 py-3 bg-[#0B0B0B] border border-[rgba(242,237,227,0.18)] text-[#F2EDE3] text-sm focus:outline-none focus:border-[#D8FF3D] placeholder:text-[#F2EDE3]/30 transition-colors";

export default function BuyNow({ defaultCountry = "PL" }: { defaultCountry?: string }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { addItem } = useCart();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("form");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);
  const [formData, setFormData] = useState({
    name: "", email: "", phone: "",
    street: "", postcode: "", city: "",
    country: defaultCountry,
    consent: false,
  });
  const [selectedPoint, setSelectedPoint] = useState<InPostPoint | null>(null);
  const [stockLeft, setStockLeft] = useState(9);
  const [showEUR, setShowEUR] = useState(defaultCountry !== "PL");

  // Derived pricing based on country
  const isPoland = formData.country === "PL";
  const isEU = EU_COUNTRIES.has(formData.country);
  const currency = isPoland ? "PLN" : "EUR";
  const productCents = isPoland ? 69900 : 16900;
  const shippingCents = isPoland ? 0 : isEU ? 2000 : 3500;
  const totalCents = productCents + shippingCents;

  useEffect(() => {
    if (session?.user?.email && !formData.email) {
      setFormData((d) => ({ ...d, email: session.user!.email!, name: session.user!.name || d.name }));
    }
  }, [session, formData.email]);

  useEffect(() => {
    fetch("/api/stock")
      .then((r) => r.json())
      .then((d) => { if (typeof d.stock === "number") setStockLeft(d.stock); })
      .catch(() => setStockLeft(11));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("redirect_status") === "succeeded") {
      setIsModalOpen(true);
      setStage("success");
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "true" && status === "authenticated") {
      setIsModalOpen(true);
      setStage("form");
      setErrorMessage("");
    }
  }, [status]);

  const gcsSurveyRendered = useRef(false);
  useEffect(() => {
    if (stage !== "success" || gcsSurveyRendered.current) return;
    gcsSurveyRendered.current = true;
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 28);
    const estimatedDelivery = deliveryDate.toISOString().slice(0, 10);
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("payment_intent") || (clientSecret ? clientSecret.split("_secret_")[0] : `KM-${Date.now()}`);
    const customerEmail = formData.email || session?.user?.email || "";
    (window as any).renderOptIn = function () {
      (window as any).gapi.load("surveyoptin", function () {
        (window as any).gapi.surveyoptin.render({
          merchant_id: 5808165395,
          order_id: orderId,
          email: customerEmail,
          delivery_country: formData.country === "OTHER" ? "US" : formData.country,
          estimated_delivery_date: estimatedDelivery,
          products: [{ gtin: "5904224900012" }],
        });
      });
    };
    if (!(window as any).gapi) {
      const script = document.createElement("script");
      script.src = "https://apis.google.com/js/platform.js?onload=renderOptIn";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    } else {
      (window as any).renderOptIn();
    }
  }, [stage, clientSecret, formData.email, formData.country, session]);

  useEffect(() => {
    document.body.style.overflow = isModalOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isModalOpen]);

  const openModal = useCallback(() => {
    if (status === "loading") return;
    if (status !== "authenticated") {
      const cb = typeof window !== "undefined" ? window.location.pathname : "/";
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(cb)}`);
      return;
    }
    setIsModalOpen(true);
    setStage("form");
    setErrorMessage("");
  }, [status, router]);

  const closeModal = useCallback(() => setIsModalOpen(false), []);
  const handlePointSelect = useCallback((point: InPostPoint) => {
    setSelectedPoint(point);
    setStage("form");
  }, []);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPoland && !selectedPoint) {
      setErrorMessage("Wybierz punkt odbioru.");
      return;
    }
    if (isPoland && (!formData.street || !formData.postcode || !formData.city)) {
      setErrorMessage("Podaj pełny adres (ulica, kod pocztowy, miasto) — wymagany do wystawienia faktury.");
      return;
    }
    if (!isPoland && (!formData.street || !formData.city)) {
      setErrorMessage("Please provide your full delivery address.");
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
          currency,
          shippingCents,
          pickupPoint: isPoland && selectedPoint ? selectedPoint.name : null,
          pickupPointAddress: isPoland && selectedPoint
            ? `${selectedPoint.address.line1}, ${selectedPoint.address.line2}`
            : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd serwera");
      setClientSecret(data.clientSecret);
      setStage("payment");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Nieoczekiwany błąd.");
    } finally {
      setIsCreatingIntent(false);
    }
  };

  const handlePaymentSuccess = () => setStage("success");
  const handlePaymentError = (m: string) => { setErrorMessage(m); setStage("error"); };

  return (
    <>
      <section id="kup-teraz" className="relative py-24 lg:py-36 bg-[#0E0E0E] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[720px] rounded-full bg-[#D8FF3D] opacity-[0.05] blur-[180px]" />
        </div>

        <div className="mx-auto max-w-[1400px] px-5 lg:px-10 relative z-10">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-16 items-start">
            {/* Left: copy */}
            <div className="lg:col-span-7">
              <p className="km-mono-eyebrow text-[#D8FF3D]">[ 07 ] · Order</p>
              <h2 className="km-display text-[clamp(48px,8vw,128px)] text-[#F2EDE3] mt-4">
                Weź <span className="italic text-[#D8FF3D]">jeden</span>.<br />
                Reszta to formalność.
              </h2>
              <p className="mt-8 text-[15px] leading-[1.65] text-[#F2EDE3]/65 max-w-md">
                KalkMate v1.0 — ręcznie składany w Polsce. Każda sztuka z indywidualnym
                numerem seryjnym i 24-miesięczną gwarancją. Dostawa darmowa do Paczkomatu InPost.
              </p>
              <ul className="mt-10 space-y-3">
                {included.map((item, i) => (
                  <li key={i} className="flex items-baseline gap-4 text-[15px] text-[#F2EDE3]/80">
                    <span className="km-mono-eyebrow text-[#D8FF3D] w-6">{String(i + 1).padStart(2, "0")}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3">
                {["Bezpieczna płatność", "14 dni na zwrot", "Gwarancja 24 mc", "Wysyłka międzynarodowa"].map((t) => (
                  <span key={t} className="km-mono-eyebrow text-[#F2EDE3]/55 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full" />
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: order card */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="lg:col-span-5 lg:col-start-8 relative lg:max-w-[460px] lg:ml-auto w-full"
            >
              <div className="relative bg-[#0B0B0B] border border-[rgba(242,237,227,0.18)]">
                <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-l border-t border-[#D8FF3D]" />
                <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-r border-t border-[#D8FF3D]" />
                <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-l border-b border-[#D8FF3D]" />
                <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-r border-b border-[#D8FF3D]" />

                <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(242,237,227,0.10)]">
                  <span className="km-mono-eyebrow text-[#F2EDE3]/55">/ KM-v1.0 · ORDER</span>
                  <span className="km-mono-eyebrow text-[#D8FF3D] flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full km-blink" />
                    {stockLeft} szt. dostępnych
                  </span>
                </div>

                {/* Currency toggle */}
                <div className="flex border-b border-[rgba(242,237,227,0.10)]">
                  <button
                    onClick={() => setShowEUR(false)}
                    className={`flex-1 py-2.5 km-mono-eyebrow text-xs transition-colors ${!showEUR ? "bg-[#D8FF3D] text-[#0B0B0B]" : "text-[#F2EDE3]/40 hover:text-[#F2EDE3]"}`}
                  >
                    PLN · 🇵🇱
                  </button>
                  <button
                    onClick={() => setShowEUR(true)}
                    className={`flex-1 py-2.5 km-mono-eyebrow text-xs transition-colors ${showEUR ? "bg-[#D8FF3D] text-[#0B0B0B]" : "text-[#F2EDE3]/40 hover:text-[#F2EDE3]"}`}
                  >
                    EUR · 🌍
                  </button>
                </div>

                {/* Price */}
                <div className="px-6 lg:px-8 py-10">
                  <p className="km-mono-eyebrow text-[#F2EDE3]/45">
                    {showEUR ? "Pre-sale price" : "Cena przedsprzedażowa"}
                  </p>
                  <div className="mt-3 flex items-baseline gap-4">
                    <span className="km-display text-[100px] leading-[0.9] text-[#F2EDE3]">
                      {showEUR ? "169" : "699"}
                    </span>
                    <span className="km-display text-3xl text-[#F2EDE3]/45">
                      {showEUR ? "€" : "zł"}
                    </span>
                    {!showEUR && (
                      <span className="km-mono-eyebrow text-[#F2EDE3]/30 line-through ml-2">2199 zł</span>
                    )}
                  </div>
                  <p className="mt-3 km-mono-eyebrow text-[#D8FF3D]">
                    {showEUR
                      ? "InPost PL free · EU 20€ · World 35€"
                      : "-77% · darmowa wysyłka InPost"}
                  </p>

                  <div className="mt-6 [&_iframe]:!min-h-0 opacity-80">
                    <Elements
                      stripe={getStripe()}
                      options={{
                        appearance: {
                          theme: "night",
                          variables: {
                            colorText: "#a0a0a0",
                            colorTextSecondary: "#7a7a7a",
                            colorPrimary: "#D8FF3D",
                            colorBackground: "#0B0B0B",
                            fontFamily: "var(--font-geist), system-ui, sans-serif",
                          },
                        },
                      } as StripeElementsOptions}
                    >
                      <PaymentMethodMessagingElement
                        options={{
                          amount: showEUR ? 16900 : 69900,
                          currency: showEUR ? "EUR" : "PLN",
                          countryCode: showEUR ? "DE" : "PL",
                        }}
                      />
                    </Elements>
                  </div>
                </div>

                <div className="mx-6 lg:mx-8 mb-6 border border-[rgba(242,237,227,0.10)] p-4">
                  <p className="km-mono-eyebrow text-[#D8FF3D]">/ produkcja</p>
                  <p className="mt-2 text-[13.5px] leading-[1.55] text-[#F2EDE3]/65">
                    Urządzenia są <span className="text-[#F2EDE3]">ręcznie składane</span>.
                    Czas realizacji do <span className="text-[#F2EDE3]">4 tygodni</span>.
                  </p>
                </div>

                <button
                  onClick={openModal}
                  className="group w-full px-6 py-5 bg-[#D8FF3D] text-[#0B0B0B] km-mono-eyebrow text-[13px] hover:bg-[#F2EDE3] transition-colors flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#0B0B0B] rounded-full km-blink" />
                    {showEUR ? "Order now · 169 EUR" : "Zamów teraz · 699 zł"}
                  </span>
                  <span>→</span>
                </button>
                <button
                  onClick={() => addItem({ id: "kalkmate-v1", name: "KalkMate v1.0", price: 69900 })}
                  className="w-full px-6 py-4 border border-[rgba(242,237,227,0.18)] text-[#F2EDE3]/70 km-mono-eyebrow text-[13px] hover:border-[#D8FF3D] hover:text-[#F2EDE3] transition-colors flex items-center justify-between"
                >
                  <span>{showEUR ? "Add to cart" : "Dodaj do koszyka"}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <path d="M16 10a4 4 0 01-8 0" />
                  </svg>
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* MODAL */}
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
            <div className="absolute inset-0 bg-[#0B0B0B]/80 backdrop-blur-md" />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className={`relative w-full max-h-[90vh] overflow-y-auto bg-[#0B0B0B] border border-[rgba(242,237,227,0.18)] ${
                stage === "map" ? "max-w-3xl" : "max-w-lg"
              }`}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(242,237,227,0.10)] sticky top-0 bg-[#0B0B0B] z-10">
                <span className="km-mono-eyebrow text-[#D8FF3D]">/ KM-v1.0 · {stage.toUpperCase()}</span>
                <button
                  onClick={closeModal}
                  className="w-8 h-8 border border-[rgba(242,237,227,0.20)] flex items-center justify-center text-[#F2EDE3] hover:bg-[#F2EDE3] hover:text-[#0B0B0B] transition-colors"
                  aria-label="Zamknij"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 lg:p-8">
                {stage === "form" && (
                  <form onSubmit={handleFormSubmit} className="space-y-5">
                    <h3 className="km-display text-3xl text-[#F2EDE3]">
                      {isPoland ? "Dane do wysyłki" : "Shipping details"}
                    </h3>

                    {/* Order summary */}
                    <div className="border border-[rgba(242,237,227,0.10)] p-4 grid grid-cols-2 gap-2 text-sm">
                      <span className="text-[#F2EDE3]/65">KalkMate v1.0</span>
                      <span className="text-right text-[#F2EDE3]">
                        {isPoland ? "699 zł" : `${(productCents / 100).toFixed(0)} EUR`}
                      </span>
                      <span className="text-[#F2EDE3]/45 text-xs">
                        {isPoland ? "Paczkomat InPost" : isEU ? "EU courier" : "International courier"}
                      </span>
                      {shippingCents === 0 ? (
                        <span className="text-right text-[#D8FF3D] km-mono-eyebrow">GRATIS</span>
                      ) : (
                        <span className="text-right text-[#F2EDE3]">{(shippingCents / 100).toFixed(0)} EUR</span>
                      )}
                    </div>

                    {/* Country selector */}
                    <div>
                      <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                        {isPoland ? "Kraj dostawy" : "Delivery country"}
                      </label>
                      <select
                        value={formData.country}
                        onChange={(e) => {
                          setFormData({ ...formData, country: e.target.value });
                          setSelectedPoint(null);
                        }}
                        className={inputClass + " cursor-pointer"}
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                        {isPoland ? "Imię i nazwisko" : "Full name"}
                      </label>
                      <input type="text" required value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={inputClass} />
                    </div>
                    <div>
                      <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">Email</label>
                      <input type="email" required value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className={inputClass} />
                    </div>
                    <div>
                      <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                        {isPoland ? "Telefon" : "Phone"}
                      </label>
                      <input type="tel" required value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className={inputClass} />
                    </div>

                    {/* Address */}
                    <div className="border border-[rgba(242,237,227,0.10)] p-4 space-y-3">
                      <p className="km-mono-eyebrow text-[#D8FF3D] text-xs">
                        {isPoland ? "/ Adres do faktury VAT" : "/ Delivery & invoice address"}
                      </p>
                      <div>
                        <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                          {isPoland ? "Ulica i numer domu" : "Street address"}
                        </label>
                        <input type="text" required value={formData.street}
                          onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                          className={inputClass}
                          placeholder={isPoland ? "np. Marszałkowska 1/2" : "e.g. Berliner Str. 12"} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                            {isPoland ? "Kod pocztowy" : "Postcode / ZIP"}
                          </label>
                          <input type="text" required value={formData.postcode}
                            onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                            className={inputClass}
                            placeholder={isPoland ? "00-000" : "12345"}
                            pattern={isPoland ? "\\d{2}-\\d{3}" : undefined} />
                        </div>
                        <div>
                          <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                            {isPoland ? "Miasto" : "City"}
                          </label>
                          <input type="text" required value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            className={inputClass}
                            placeholder={isPoland ? "Warszawa" : "Berlin"} />
                        </div>
                      </div>
                    </div>

                    {/* InPost picker — only Poland */}
                    {isPoland && (
                      <div>
                        <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">Punkt odbioru</label>
                        {selectedPoint ? (
                          <div className="flex items-center justify-between p-3 border border-[#D8FF3D]/50 bg-[#D8FF3D]/[0.05]">
                            <div className="min-w-0">
                              <p className="text-sm text-[#F2EDE3] truncate">{selectedPoint.name}</p>
                              <p className="text-xs text-[#F2EDE3]/50 truncate">
                                {selectedPoint.address.line1}, {selectedPoint.address.line2}
                              </p>
                            </div>
                            <button type="button" onClick={() => setStage("map")} className="km-mono-eyebrow text-[#D8FF3D] ml-3">
                              Zmień
                            </button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setStage("map")}
                            className="w-full px-4 py-3 border border-dashed border-[rgba(242,237,227,0.25)] text-[#F2EDE3]/60 hover:border-[#D8FF3D] hover:text-[#F2EDE3] km-mono-eyebrow transition-colors">
                            Wybierz Paczkomat InPost →
                          </button>
                        )}
                      </div>
                    )}

                    {/* International shipping note */}
                    {!isPoland && (
                      <div className="border border-[rgba(242,237,227,0.10)] p-4 bg-[#D8FF3D]/[0.03]">
                        <p className="km-mono-eyebrow text-[#D8FF3D] text-xs mb-1">/ International delivery</p>
                        <p className="text-xs text-[#F2EDE3]/60 leading-relaxed">
                          Courier delivery to your address.{" "}
                          <strong className="text-[#F2EDE3]">{isEU ? "20 EUR" : "35 EUR"}</strong>{" "}
                          shipping fee · approx. 2–4 weeks
                        </p>
                      </div>
                    )}

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" required checked={formData.consent}
                        onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                        className="mt-1 accent-[#D8FF3D]" />
                      <span className="text-xs text-[#F2EDE3]/55 leading-relaxed">
                        {isPoland
                          ? "Akceptuję regulamin i wyrażam zgodę na przetwarzanie danych osobowych w celu realizacji zamówienia."
                          : "I accept the terms and conditions and consent to the processing of my personal data for order fulfillment."}
                      </span>
                    </label>

                    {errorMessage && <p className="text-sm text-[#FF4D2E]">{errorMessage}</p>}

                    <button
                      type="submit"
                      disabled={isCreatingIntent || (isPoland && !selectedPoint)}
                      className={`w-full py-4 km-mono-eyebrow transition-colors ${
                        isCreatingIntent || (isPoland && !selectedPoint)
                          ? "bg-[#D8FF3D]/30 text-[#0B0B0B]/50 cursor-not-allowed"
                          : "bg-[#D8FF3D] text-[#0B0B0B] hover:bg-[#F2EDE3]"
                      }`}
                    >
                      {isCreatingIntent
                        ? (isPoland ? "Ładowanie..." : "Loading...")
                        : (isPoland ? "Przejdź do płatności →" : "Continue to payment →")}
                    </button>
                  </form>
                )}

                {stage === "map" && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="km-display text-3xl text-[#F2EDE3]">Wybierz Paczkomat</h3>
                      <button onClick={() => setStage("form")} className="km-mono-eyebrow text-[#D8FF3D]">← Wstecz</button>
                    </div>
                    <div className="border border-[rgba(242,237,227,0.10)] overflow-hidden">
                      <Suspense fallback={
                        <div className="flex items-center justify-center h-[440px] bg-[#0E0E0E]">
                          <span className="km-mono-eyebrow text-[#F2EDE3]/55">Ładowanie mapy...</span>
                        </div>
                      }>
                        <InPostGeowidget token={INPOST_TOKEN} onPointSelect={handlePointSelect} height="440px" />
                      </Suspense>
                    </div>
                  </div>
                )}

                {(stage === "payment" || stage === "error") && clientSecret && (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="km-display text-3xl text-[#F2EDE3]">
                        {isPoland ? "Płatność" : "Payment"}
                      </h3>
                      <button onClick={() => { setStage("form"); setErrorMessage(""); }} className="km-mono-eyebrow text-[#D8FF3D]">
                        ← Wstecz
                      </button>
                    </div>

                    <div className="mb-6 border border-[rgba(242,237,227,0.10)] p-4 space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#F2EDE3]/65">KalkMate v1.0</span>
                        <span className="text-[#F2EDE3]">
                          {isPoland ? "699 zł" : `${(productCents / 100).toFixed(0)} EUR`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#F2EDE3]/65">{isPoland ? "Wysyłka" : "Shipping"}</span>
                        {shippingCents === 0
                          ? <span className="km-mono-eyebrow text-[#D8FF3D]">GRATIS</span>
                          : <span className="text-[#F2EDE3]">{(shippingCents / 100).toFixed(0)} EUR</span>}
                      </div>
                      {isPoland && selectedPoint && (
                        <div className="text-xs text-[#F2EDE3]/45 pt-1">
                          ↳ {selectedPoint.name} · {selectedPoint.address.line1}
                        </div>
                      )}
                      {!isPoland && formData.city && (
                        <div className="text-xs text-[#F2EDE3]/45 pt-1">
                          ↳ {formData.street}, {formData.city} · {formData.country}
                        </div>
                      )}
                      <div className="flex justify-between pt-3 border-t border-[rgba(242,237,227,0.10)] mt-2">
                        <span className="km-mono-eyebrow text-[#F2EDE3]">TOTAL</span>
                        <span className="km-display text-2xl text-[#F2EDE3]">
                          {isPoland ? "699 zł" : `${(totalCents / 100).toFixed(0)} EUR`}
                        </span>
                      </div>
                    </div>

                    {errorMessage && (
                      <div className="mb-4 border border-[#FF4D2E]/40 bg-[#FF4D2E]/[0.06] p-3">
                        <p className="text-sm text-[#FF4D2E]">{errorMessage}</p>
                      </div>
                    )}

                    <StripeProvider clientSecret={clientSecret}>
                      <CheckoutForm onSuccess={handlePaymentSuccess} onError={handlePaymentError} />
                    </StripeProvider>
                  </div>
                )}

                {stage === "success" && (
                  <div className="text-center py-6">
                    <div className="mx-auto w-16 h-16 border border-[#D8FF3D] flex items-center justify-center">
                      <span className="km-display text-4xl text-[#D8FF3D]">✓</span>
                    </div>
                    <h3 className="mt-6 km-display text-3xl text-[#F2EDE3]">
                      {isPoland ? "Płatność zakończona." : "Payment complete."}
                    </h3>
                    <p className="mt-3 text-sm text-[#F2EDE3]/60 max-w-sm mx-auto leading-relaxed">
                      {isPoland ? (
                        <>Dziękujemy za zamówienie. Potwierdzenie wysłaliśmy na{" "}
                          <span className="text-[#F2EDE3]">{formData.email}</span>. Wysyłka w ciągu 4 tygodni.</>
                      ) : (
                        <>Thank you for your order. Confirmation sent to{" "}
                          <span className="text-[#F2EDE3]">{formData.email}</span>. Shipping within 4 weeks.</>
                      )}
                    </p>
                    <button onClick={closeModal} className="mt-8 px-8 py-3 bg-[#D8FF3D] text-[#0B0B0B] km-mono-eyebrow hover:bg-[#F2EDE3] transition-colors">
                      {isPoland ? "Zamknij" : "Close"}
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
