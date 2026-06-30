"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { InPostPoint } from "@/components/InPostGeowidget";

interface FormData {
  name: string;
  email: string;
  phone: string;
  street: string;
  postcode: string;
  city: string;
  country: string;
}

interface P24CheckoutFormProps {
  formData: FormData;
  selectedPoint: InPostPoint | null;
  isPoland: boolean;
  currency: string;
  productCents: number;
  shippingCents: number;
  discountCents: number;
  totalCents: number;
  appliedCoupon: { code: string; discountCents: number } | null;
  couponCode: string | null;
  onSuccess: () => void;
  onError: (msg: string) => void;
  onBack: () => void;
}

type Step = "select" | "blik_code" | "blik_waiting" | "blik_error";

const BLIK_POLL_INTERVAL = 2000;
const BLIK_POLL_MAX = 60; // 60 * 2s = 2 minutes

export default function P24CheckoutForm({
  formData, selectedPoint, isPoland,
  currency, productCents, shippingCents, discountCents, totalCents,
  appliedCoupon, couponCode,
  onSuccess, onError, onBack,
}: P24CheckoutFormProps) {
  const [step, setStep] = useState<Step>("select");
  const [blikCode, setBlikCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [p24Token, setP24Token] = useState<string | null>(null);
  const [p24SessionId, setP24SessionId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const fmtMoney = (cents: number) =>
    currency === "PLN"
      ? `${(cents / 100).toFixed(2).replace(/\.00$/, "").replace(".", ",")} zł`
      : `${(cents / 100).toFixed(0)} EUR`;

  async function createP24Transaction(blikMode: boolean) {
    setIsLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/p24/create-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          currency,
          shippingCents,
          couponCode: couponCode || null,
          pickupPoint: isPoland && selectedPoint ? selectedPoint.name : null,
          pickupPointAddress:
            isPoland && selectedPoint
              ? `${selectedPoint.address.line1}, ${selectedPoint.address.line2}`
              : null,
          blikMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd serwera.");
      return data as { token: string; sessionId: string; redirectUrl: string };
    } finally {
      setIsLoading(false);
    }
  }

  async function handleBlikInit() {
    try {
      const data = await createP24Transaction(true);
      setP24Token(data.token);
      setP24SessionId(data.sessionId);
      setStep("blik_code");
    } catch (err: any) {
      setErrorMsg(err.message || "Błąd połączenia.");
    }
  }

  async function handleBlikSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (blikCode.length !== 6 || !/^\d{6}$/.test(blikCode)) {
      setErrorMsg("Wprowadź poprawny 6-cyfrowy kod BLIK.");
      return;
    }
    setIsLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/p24/blik", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: p24Token, blikCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd BLIK.");
      setStep("blik_waiting");
      startPolling(p24SessionId!);
    } catch (err: any) {
      setErrorMsg(err.message || "Błąd BLIK.");
    } finally {
      setIsLoading(false);
    }
  }

  function startPolling(sessionId: string) {
    pollCountRef.current = 0;
    pollRef.current = setInterval(async () => {
      pollCountRef.current++;
      try {
        const r = await fetch(`/api/p24/status?sessionId=${sessionId}`);
        const d = await r.json();
        if (d.status === "paid") {
          if (pollRef.current) clearInterval(pollRef.current);
          onSuccess();
        }
      } catch {}
      if (pollCountRef.current >= BLIK_POLL_MAX) {
        if (pollRef.current) clearInterval(pollRef.current);
        setStep("blik_error");
        setErrorMsg("Przekroczono czas oczekiwania. Jeśli środki zostały pobrane, zamówienie zostanie przetworzone automatycznie.");
      }
    }, BLIK_POLL_INTERVAL);
  }

  async function handleCardRedirect() {
    try {
      const data = await createP24Transaction(false);
      window.location.href = data.redirectUrl;
    } catch (err: any) {
      setErrorMsg(err.message || "Błąd połączenia.");
    }
  }

  const inputClass =
    "w-full px-4 py-3 bg-[#0B0B0B] border border-[rgba(242,237,227,0.18)] text-[#F2EDE3] text-sm focus:outline-none focus:border-[#D8FF3D] placeholder:text-[#F2EDE3]/30 transition-colors";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="km-display text-3xl text-[#F2EDE3]">Płatność</h3>
        {step === "select" && (
          <button onClick={onBack} className="km-mono-eyebrow text-[#D8FF3D]">
            ← Wstecz
          </button>
        )}
        {(step === "blik_code" || step === "blik_error") && (
          <button
            onClick={() => {
              if (pollRef.current) clearInterval(pollRef.current);
              setStep("select");
              setBlikCode("");
              setErrorMsg("");
            }}
            className="km-mono-eyebrow text-[#D8FF3D]"
          >
            ← Wstecz
          </button>
        )}
      </div>

      {/* Order summary */}
      <div className="mb-6 border border-[rgba(242,237,227,0.10)] p-4 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-[#F2EDE3]/65">KalkMate v1.0</span>
          <span className="text-[#F2EDE3]">{fmtMoney(productCents)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#F2EDE3]/65">Wysyłka</span>
          {shippingCents === 0
            ? <span className="km-mono-eyebrow text-[#D8FF3D]">GRATIS</span>
            : <span className="text-[#F2EDE3]">{fmtMoney(shippingCents)}</span>}
        </div>
        {appliedCoupon && (
          <div className="flex justify-between">
            <span className="text-[#D8FF3D]">Kupon {appliedCoupon.code}</span>
            <span className="text-[#D8FF3D]">−{fmtMoney(discountCents)}</span>
          </div>
        )}
        <div className="flex justify-between pt-3 border-t border-[rgba(242,237,227,0.10)] mt-2">
          <span className="km-mono-eyebrow text-[#F2EDE3]">TOTAL</span>
          <span className="km-display text-2xl text-[#F2EDE3]">{fmtMoney(totalCents)}</span>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 border border-[#FF4D2E]/40 bg-[#FF4D2E]/[0.06] p-3">
          <p className="text-sm text-[#FF4D2E]">{errorMsg}</p>
        </div>
      )}

      {/* ─── STEP: SELECT METHOD ─── */}
      {step === "select" && (
        <div className="space-y-3">
          <p className="km-mono-eyebrow text-[#F2EDE3]/55 mb-4">Wybierz metodę płatności</p>

          {/* BLIK */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleBlikInit}
            disabled={isLoading}
            className="w-full flex items-center gap-4 p-4 border border-[rgba(242,237,227,0.18)] hover:border-[#D8FF3D] transition-colors disabled:opacity-50"
          >
            <div className="w-10 h-10 bg-[#D8FF3D] flex items-center justify-center flex-shrink-0">
              <span className="km-mono-eyebrow text-[#0B0B0B] text-xs font-bold">BLIK</span>
            </div>
            <div className="text-left">
              <p className="text-sm text-[#F2EDE3] font-medium">BLIK</p>
              <p className="text-xs text-[#F2EDE3]/45 mt-0.5">Kod z aplikacji bankowej — bez przekierowania</p>
            </div>
            <span className="ml-auto text-[#F2EDE3]/30">→</span>
          </motion.button>

          {/* Karta */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleCardRedirect}
            disabled={isLoading}
            className="w-full flex items-center gap-4 p-4 border border-[rgba(242,237,227,0.18)] hover:border-[#D8FF3D] transition-colors disabled:opacity-50"
          >
            <div className="w-10 h-10 border border-[rgba(242,237,227,0.25)] flex items-center justify-center flex-shrink-0">
              <svg width="20" height="14" viewBox="0 0 24 17" fill="none">
                <rect x="0.5" y="0.5" width="23" height="16" rx="1.5" stroke="#F2EDE3" strokeOpacity="0.6"/>
                <rect y="4" width="24" height="3" fill="#F2EDE3" fillOpacity="0.15"/>
                <rect x="2" y="10" width="6" height="2" rx="0.5" fill="#F2EDE3" fillOpacity="0.6"/>
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm text-[#F2EDE3] font-medium">Karta płatnicza</p>
              <p className="text-xs text-[#F2EDE3]/45 mt-0.5">Visa, Mastercard, Apple Pay, Google Pay</p>
            </div>
            <span className="ml-auto text-[#F2EDE3]/30">→</span>
          </motion.button>

          {/* Przelew bankowy */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleCardRedirect}
            disabled={isLoading}
            className="w-full flex items-center gap-4 p-4 border border-[rgba(242,237,227,0.18)] hover:border-[#D8FF3D] transition-colors disabled:opacity-50"
          >
            <div className="w-10 h-10 border border-[rgba(242,237,227,0.25)] flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#F2EDE3]/60">
                <rect x="2" y="7" width="20" height="14" rx="1"/>
                <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
                <line x1="12" y1="12" x2="12" y2="16"/>
                <line x1="10" y1="14" x2="14" y2="14"/>
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm text-[#F2EDE3] font-medium">Przelew / inne metody P24</p>
              <p className="text-xs text-[#F2EDE3]/45 mt-0.5">Przelewy24 — wybór metody na stronie P24</p>
            </div>
            <span className="ml-auto text-[#F2EDE3]/30">→</span>
          </motion.button>

          {isLoading && (
            <div className="flex items-center justify-center py-3 gap-2 text-[#F2EDE3]/55 text-sm">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Przygotowywanie płatności...
            </div>
          )}

          <p className="text-xs text-[#F2EDE3]/30 text-center pt-2">
            Płatności obsługuje <span className="text-[#F2EDE3]/50">Przelewy24</span>
          </p>
        </div>
      )}

      {/* ─── STEP: BLIK CODE ─── */}
      {step === "blik_code" && (
        <form onSubmit={handleBlikSubmit} className="space-y-5">
          <div className="flex items-center gap-3 p-3 bg-[#D8FF3D]/[0.05] border border-[#D8FF3D]/20">
            <div className="w-8 h-8 bg-[#D8FF3D] flex items-center justify-center flex-shrink-0">
              <span className="km-mono-eyebrow text-[#0B0B0B] text-[10px]">BLIK</span>
            </div>
            <p className="text-sm text-[#F2EDE3]/80">Otwórz aplikację bankową i wygeneruj kod BLIK</p>
          </div>

          <div>
            <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
              Kod BLIK (6 cyfr)
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={blikCode}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setBlikCode(v);
                setErrorMsg("");
              }}
              placeholder="000 000"
              autoComplete="one-time-code"
              className={inputClass + " text-center text-2xl tracking-[0.5em] font-mono"}
              required
            />
          </div>

          <motion.button
            type="submit"
            whileTap={{ scale: 0.98 }}
            disabled={isLoading || blikCode.length !== 6}
            className={`w-full py-4 km-mono-eyebrow transition-colors ${
              isLoading || blikCode.length !== 6
                ? "bg-[#D8FF3D]/30 text-[#0B0B0B]/50 cursor-not-allowed"
                : "bg-[#D8FF3D] text-[#0B0B0B] hover:bg-[#F2EDE3]"
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Wysyłanie...
              </span>
            ) : (
              `Zapłać ${(totalCents / 100).toFixed(2).replace(".", ",")} zł przez BLIK`
            )}
          </motion.button>
        </form>
      )}

      {/* ─── STEP: BLIK WAITING ─── */}
      {step === "blik_waiting" && (
        <div className="text-center py-6 space-y-5">
          <div className="mx-auto w-16 h-16 border border-[#D8FF3D] flex items-center justify-center">
            <svg className="animate-spin h-8 w-8 text-[#D8FF3D]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
          <div>
            <p className="km-display text-2xl text-[#F2EDE3]">Czekam na potwierdzenie</p>
            <p className="mt-2 text-sm text-[#F2EDE3]/60 max-w-xs mx-auto leading-relaxed">
              Otwórz aplikację bankową i <strong className="text-[#F2EDE3]">zatwierdź płatność BLIK</strong>.
              Ta strona automatycznie przejdzie dalej.
            </p>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-[#D8FF3D] opacity-60 animate-bounce"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── STEP: BLIK ERROR (timeout) ─── */}
      {step === "blik_error" && (
        <div className="space-y-4">
          <button
            onClick={() => {
              setStep("select");
              setBlikCode("");
              setErrorMsg("");
            }}
            className="w-full py-4 km-mono-eyebrow border border-[rgba(242,237,227,0.18)] text-[#F2EDE3]/70 hover:border-[#D8FF3D] hover:text-[#F2EDE3] transition-colors"
          >
            Spróbuj ponownie
          </button>
        </div>
      )}
    </div>
  );
}
