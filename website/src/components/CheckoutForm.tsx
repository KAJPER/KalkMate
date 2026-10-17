"use client";

import { useState } from "react";
import {
  PaymentElement,
  ExpressCheckoutElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { motion } from "framer-motion";
import type { PaymentIntent } from "@stripe/stripe-js";
import { type Locale } from "@/lib/i18n";
import { formatMoney } from "@/lib/content/shop";

export type ConfirmedPayment = { id: string; status: PaymentIntent.Status };

interface CheckoutFormProps {
  /** Wynik bez przekierowania (karta/portfel) — status z API Stripe. */
  onSuccess: (payment?: ConfirmedPayment) => void;
  onError: (message: string) => void;
  lang?: Locale;
  /** Kwota do zaplaty w jednostkach minimalnych — z odpowiedzi serwera (K1). */
  amountCents: number;
  currency: string;
}

const content: Record<Locale, {
  // Etykieta przycisku musi jednoznacznie wskazywac obowiazek zaplaty
  // (art. 17 ust. 3 u.p.k. / § 312j BGB / UK CCR "order with obligation to pay").
  payButton: (amount: string) => string;
  processing: string;
  orPayOther: string;
  genericError: string;
}> = {
  pl: {
    payButton: (a) => `Zamawiam i płacę – ${a}`,
    processing: "Przetwarzanie…",
    orPayOther: "lub zapłać inną metodą",
    genericError: "Wystąpił błąd. Spróbuj ponownie.",
  },
  en: {
    payButton: (a) => `Order with obligation to pay – ${a}`,
    processing: "Processing…",
    orPayOther: "or pay another way",
    genericError: "Something went wrong. Please try again.",
  },
  de: {
    payButton: (a) => `Zahlungspflichtig bestellen – ${a}`,
    processing: "Wird verarbeitet…",
    orPayOther: "oder mit einer anderen Methode bezahlen",
    genericError: "Ein Fehler ist aufgetreten. Bitte versuche es erneut.",
  },
};

// Powrot z przekierowania (Klarna, 3DS, bank) na ten sam landing, ale BEZ
// starego query (checkout=true itd.) — inaczej po powrocie efekt checkoutu
// nadpisywal ekran sukcesu formularzem (ryzyko podwojnej platnosci).
function returnUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

export default function CheckoutForm({ onSuccess, onError, lang = "pl", amountCents, currency }: CheckoutFormProps) {
  const t = content[lang];
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showExpress, setShowExpress] = useState(false);
  const amountLabel = formatMoney(amountCents, currency, lang, { decimals: true });

  const confirm = async () => {
    if (!stripe || !elements) return null;
    return stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl() },
      redirect: "if_required",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsProcessing(true);

    const result = await confirm();
    if (!result) { setIsProcessing(false); return; }

    if (result.error) {
      onError(result.error.message ?? t.genericError);
      setIsProcessing(false);
    } else {
      const pi = result.paymentIntent;
      onSuccess(pi ? { id: pi.id, status: pi.status } : undefined);
    }
  };

  const handleExpressConfirm = async () => {
    const result = await confirm();
    if (!result) return;

    if (result.error) {
      onError(result.error.message ?? t.genericError);
    } else {
      const pi = result.paymentIntent;
      onSuccess(pi ? { id: pi.id, status: pi.status } : undefined);
    }
  };

  return (
    <div className="space-y-6">
      {/* Express Checkout (Apple Pay, Google Pay, Link) */}
      <div style={{ display: showExpress ? "block" : "none" }}>
        <ExpressCheckoutElement
          onReady={({ availablePaymentMethods }) => {
            if (availablePaymentMethods) {
              setShowExpress(true);
            }
          }}
          onConfirm={handleExpressConfirm}
          options={{
            buttonHeight: 48,
          }}
        />
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[rgba(242,237,227,0.10)]" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-[#0B0B0B] px-4 km-mono-eyebrow text-[11px] text-[#F2EDE3]/40">
              {t.orPayOther}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <PaymentElement options={{ layout: "tabs" }} />

        <motion.button
          type="submit"
          disabled={!stripe || isProcessing}
          whileTap={{ scale: 0.98 }}
          className={`w-full py-4 px-5 km-mono-eyebrow transition-colors ${
            !stripe || isProcessing
              ? "bg-[#D8FF3D]/30 text-[#0B0B0B]/50 cursor-not-allowed"
              : "bg-[#D8FF3D] text-[#0B0B0B] hover:bg-[#F2EDE3]"
          }`}
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              {t.processing}
            </span>
          ) : (
            t.payButton(amountLabel)
          )}
        </motion.button>
      </form>
    </div>
  );
}
