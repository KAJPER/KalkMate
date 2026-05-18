"use client";

import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Elements, PaymentMethodMessagingElement } from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import StripeProvider from "@/components/StripeProvider";
import CheckoutForm from "@/components/CheckoutForm";
import getStripe from "@/lib/getStripe";
import type { InPostPoint } from "@/components/InPostGeowidget";

const InPostGeowidget = lazy(() => import("@/components/InPostGeowidget"));

const INPOST_TOKEN = process.env.NEXT_PUBLIC_INPOST_GEOWIDGET_TOKEN || "";

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

export default function BuyNow() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("form");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", consent: false });
  const [selectedPoint, setSelectedPoint] = useState<InPostPoint | null>(null);
  const [stockLeft, setStockLeft] = useState(9);

  // Pre-fill email z sesji (zalogowany user)
  useEffect(() => {
    if (session?.user?.email && !formData.email) {
      setFormData((d) => ({ ...d, email: session.user!.email!, name: session.user!.name || d.name }));
    }
  }, [session, formData.email]);

  // Day-seeded stock
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
      if (storedDate === today) decrements = parseInt(storedDec, 10) || 0;
    }
    setStockLeft(Math.max(3, baseStock - decrements));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("redirect_status") === "succeeded") {
      setIsModalOpen(true);
      setStage("success");
    }
  }, []);

  useEffect(() => {
    document.body.style.overflow = isModalOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isModalOpen]);

  const openModal = useCallback(() => {
    // Wymagamy zalogowania zeby kupic
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
        {/* Backdrop glow */}
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
                numerem seryjnym i 24-miesięczną gwarancją. Dostawa darmowa do
                Paczkomatu InPost.
              </p>

              <ul className="mt-10 space-y-3">
                {included.map((item, i) => (
                  <li key={i} className="flex items-baseline gap-4 text-[15px] text-[#F2EDE3]/80">
                    <span className="km-mono-eyebrow text-[#D8FF3D] w-6">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3">
                <span className="km-mono-eyebrow text-[#F2EDE3]/55 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full" />
                  Bezpieczna płatność
                </span>
                <span className="km-mono-eyebrow text-[#F2EDE3]/55 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full" />
                  14 dni na zwrot
                </span>
                <span className="km-mono-eyebrow text-[#F2EDE3]/55 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full" />
                  Gwarancja 24 mc
                </span>
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
                {/* Frame ticks */}
                <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-l border-t border-[#D8FF3D]" />
                <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-r border-t border-[#D8FF3D]" />
                <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-l border-b border-[#D8FF3D]" />
                <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-r border-b border-[#D8FF3D]" />

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(242,237,227,0.10)]">
                  <span className="km-mono-eyebrow text-[#F2EDE3]/55">/ KM-v1.0 · ORDER</span>
                  <span className="km-mono-eyebrow text-[#D8FF3D] flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full km-blink" />
                    {stockLeft} szt. dostępnych
                  </span>
                </div>

                {/* Price */}
                <div className="px-6 lg:px-8 py-10">
                  <p className="km-mono-eyebrow text-[#F2EDE3]/45">Cena przedsprzedażowa</p>
                  <div className="mt-3 flex items-baseline gap-4">
                    <span className="km-display text-[110px] leading-[0.9] text-[#F2EDE3]">
                      699
                    </span>
                    <span className="km-display text-3xl text-[#F2EDE3]/45">zł</span>
                    <span className="km-mono-eyebrow text-[#F2EDE3]/30 line-through ml-2">
                      2199 zł
                    </span>
                  </div>
                  <p className="mt-3 km-mono-eyebrow text-[#D8FF3D]">
                    -77% · darmowa wysyłka InPost
                  </p>

                  {/* Stripe BNPL messaging */}
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
                        options={{ amount: 69900, currency: "PLN", countryCode: "PL" }}
                      />
                    </Elements>
                  </div>
                </div>

                {/* Hand-built notice */}
                <div className="mx-6 lg:mx-8 mb-6 border border-[rgba(242,237,227,0.10)] p-4">
                  <p className="km-mono-eyebrow text-[#D8FF3D]">/ produkcja</p>
                  <p className="mt-2 text-[13.5px] leading-[1.55] text-[#F2EDE3]/65">
                    Urządzenia są <span className="text-[#F2EDE3]">ręcznie składane</span>.
                    Wysyłka wszystkich zamówień z przedsprzedaży do <span className="text-[#F2EDE3]">3 maja</span>.
                  </p>
                </div>

                {/* CTA */}
                <button
                  onClick={openModal}
                  className="group w-full px-6 py-5 bg-[#D8FF3D] text-[#0B0B0B] km-mono-eyebrow text-[13px] hover:bg-[#F2EDE3] transition-colors flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#0B0B0B] rounded-full km-blink" />
                    Zamów teraz · 699 zł
                  </span>
                  <span>→</span>
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
              {/* Header */}
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
                    <h3 className="km-display text-3xl text-[#F2EDE3]">Dane do wysyłki</h3>

                    <div className="border border-[rgba(242,237,227,0.10)] p-4 grid grid-cols-2 gap-2 text-sm">
                      <span className="text-[#F2EDE3]/65">KalkMate v1.0</span>
                      <span className="text-right text-[#F2EDE3]">699 zł</span>
                      <span className="text-[#F2EDE3]/45 text-xs">Paczkomat InPost</span>
                      <span className="text-right text-[#D8FF3D] km-mono-eyebrow">GRATIS</span>
                    </div>

                    <div>
                      <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">Imię i nazwisko</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">Email</label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">Telefon</label>
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className={inputClass}
                      />
                    </div>

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
                          <button
                            type="button"
                            onClick={() => setStage("map")}
                            className="km-mono-eyebrow text-[#D8FF3D] ml-3"
                          >
                            Zmień
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setStage("map")}
                          className="w-full px-4 py-3 border border-dashed border-[rgba(242,237,227,0.25)] text-[#F2EDE3]/60 hover:border-[#D8FF3D] hover:text-[#F2EDE3] km-mono-eyebrow transition-colors"
                        >
                          Wybierz Paczkomat InPost →
                        </button>
                      )}
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        required
                        checked={formData.consent}
                        onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                        className="mt-1 accent-[#D8FF3D]"
                      />
                      <span className="text-xs text-[#F2EDE3]/55 leading-relaxed">
                        Akceptuję regulamin i wyrażam zgodę na przetwarzanie danych
                        osobowych w celu realizacji zamówienia.
                      </span>
                    </label>

                    {errorMessage && (
                      <p className="text-sm text-[#FF4D2E]">{errorMessage}</p>
                    )}

                    <button
                      type="submit"
                      disabled={isCreatingIntent || !selectedPoint}
                      className={`w-full py-4 km-mono-eyebrow transition-colors ${
                        isCreatingIntent || !selectedPoint
                          ? "bg-[#D8FF3D]/30 text-[#0B0B0B]/50 cursor-not-allowed"
                          : "bg-[#D8FF3D] text-[#0B0B0B] hover:bg-[#F2EDE3]"
                      }`}
                    >
                      {isCreatingIntent ? "Ładowanie..." : "Przejdź do płatności →"}
                    </button>
                  </form>
                )}

                {stage === "map" && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="km-display text-3xl text-[#F2EDE3]">Wybierz Paczkomat</h3>
                      <button
                        onClick={() => setStage("form")}
                        className="km-mono-eyebrow text-[#D8FF3D]"
                      >
                        ← Wstecz
                      </button>
                    </div>
                    <div className="border border-[rgba(242,237,227,0.10)] overflow-hidden">
                      <Suspense
                        fallback={
                          <div className="flex items-center justify-center h-[440px] bg-[#0E0E0E]">
                            <span className="km-mono-eyebrow text-[#F2EDE3]/55">Ładowanie mapy...</span>
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

                {(stage === "payment" || stage === "error") && clientSecret && (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="km-display text-3xl text-[#F2EDE3]">Płatność</h3>
                      <button
                        onClick={() => { setStage("form"); setErrorMessage(""); }}
                        className="km-mono-eyebrow text-[#D8FF3D]"
                      >
                        ← Wstecz
                      </button>
                    </div>

                    <div className="mb-6 border border-[rgba(242,237,227,0.10)] p-4 space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#F2EDE3]/65">KalkMate v1.0</span>
                        <span className="text-[#F2EDE3]">699 zł</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#F2EDE3]/65">Wysyłka</span>
                        <span className="km-mono-eyebrow text-[#D8FF3D]">GRATIS</span>
                      </div>
                      {selectedPoint && (
                        <div className="text-xs text-[#F2EDE3]/45 pt-1">
                          ↳ {selectedPoint.name} · {selectedPoint.address.line1}
                        </div>
                      )}
                      <div className="flex justify-between pt-3 border-t border-[rgba(242,237,227,0.10)] mt-2">
                        <span className="km-mono-eyebrow text-[#F2EDE3]">RAZEM</span>
                        <span className="km-display text-2xl text-[#F2EDE3]">699 zł</span>
                      </div>
                    </div>

                    {errorMessage && (
                      <div className="mb-4 border border-[#FF4D2E]/40 bg-[#FF4D2E]/[0.06] p-3">
                        <p className="text-sm text-[#FF4D2E]">{errorMessage}</p>
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

                {stage === "success" && (
                  <div className="text-center py-6">
                    <div className="mx-auto w-16 h-16 border border-[#D8FF3D] flex items-center justify-center">
                      <span className="km-display text-4xl text-[#D8FF3D]">✓</span>
                    </div>
                    <h3 className="mt-6 km-display text-3xl text-[#F2EDE3]">
                      Płatność zakończona.
                    </h3>
                    <p className="mt-3 text-sm text-[#F2EDE3]/60 max-w-sm mx-auto leading-relaxed">
                      Dziękujemy za zamówienie. Potwierdzenie wysłaliśmy na{" "}
                      <span className="text-[#F2EDE3]">{formData.email}</span>.
                      Wysyłka 3–5 dni roboczych.
                    </p>
                    <button
                      onClick={closeModal}
                      className="mt-8 px-8 py-3 bg-[#D8FF3D] text-[#0B0B0B] km-mono-eyebrow hover:bg-[#F2EDE3] transition-colors"
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
