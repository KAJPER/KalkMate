"use client";

import { useState } from "react";
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

export default function P24CheckoutForm({
  formData, selectedPoint, isPoland,
  currency, productCents, shippingCents, discountCents, totalCents,
  appliedCoupon, couponCode,
  onBack,
}: P24CheckoutFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMethod, setLoadingMethod] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const fmtMoney = (cents: number) =>
    currency === "PLN"
      ? `${(cents / 100).toFixed(2).replace(/\.00$/, "").replace(".", ",")} zł`
      : `${(cents / 100).toFixed(0)} EUR`;

  async function pay(blikMode: boolean) {
    setIsLoading(true);
    setLoadingMethod(blikMode ? "blik" : "other");
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
      window.location.href = data.redirectUrl;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Błąd połączenia.";
      setErrorMsg(msg);
      setIsLoading(false);
      setLoadingMethod(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="km-display text-3xl text-[#F2EDE3]">Płatność</h3>
        <button onClick={onBack} disabled={isLoading} className="km-mono-eyebrow text-[#D8FF3D] disabled:opacity-40">
          ← Wstecz
        </button>
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

      <div className="space-y-3">
        <p className="km-mono-eyebrow text-[#F2EDE3]/55 mb-4">Wybierz metodę płatności</p>

        {/* BLIK */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => pay(true)}
          disabled={isLoading}
          className="w-full flex items-center gap-4 p-4 border border-[rgba(242,237,227,0.18)] hover:border-[#D8FF3D] transition-colors disabled:opacity-50"
        >
          <div className="w-10 h-10 bg-[#D8FF3D] flex items-center justify-center flex-shrink-0">
            {loadingMethod === "blik"
              ? <svg className="animate-spin h-4 w-4 text-[#0B0B0B]" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              : <span className="km-mono-eyebrow text-[#0B0B0B] text-xs font-bold">BLIK</span>}
          </div>
          <div className="text-left">
            <p className="text-sm text-[#F2EDE3] font-medium">BLIK</p>
            <p className="text-xs text-[#F2EDE3]/45 mt-0.5">Kod z aplikacji bankowej</p>
          </div>
          <span className="ml-auto text-[#F2EDE3]/30">→</span>
        </motion.button>

        {/* Karta */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => pay(false)}
          disabled={isLoading}
          className="w-full flex items-center gap-4 p-4 border border-[rgba(242,237,227,0.18)] hover:border-[#D8FF3D] transition-colors disabled:opacity-50"
        >
          <div className="w-10 h-10 border border-[rgba(242,237,227,0.25)] flex items-center justify-center flex-shrink-0">
            {loadingMethod === "other"
              ? <svg className="animate-spin h-4 w-4 text-[#F2EDE3]/60" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              : <svg width="20" height="14" viewBox="0 0 24 17" fill="none">
                  <rect x="0.5" y="0.5" width="23" height="16" rx="1.5" stroke="#F2EDE3" strokeOpacity="0.6"/>
                  <rect y="4" width="24" height="3" fill="#F2EDE3" fillOpacity="0.15"/>
                  <rect x="2" y="10" width="6" height="2" rx="0.5" fill="#F2EDE3" fillOpacity="0.6"/>
                </svg>}
          </div>
          <div className="text-left">
            <p className="text-sm text-[#F2EDE3] font-medium">Karta / Przelew / Inne</p>
            <p className="text-xs text-[#F2EDE3]/45 mt-0.5">Visa, Mastercard, Apple Pay, przelew bankowy i więcej</p>
          </div>
          <span className="ml-auto text-[#F2EDE3]/30">→</span>
        </motion.button>

        <p className="text-xs text-[#F2EDE3]/30 text-center pt-2">
          Płatności obsługuje <span className="text-[#F2EDE3]/50">Przelewy24</span>
        </p>
      </div>
    </div>
  );
}
