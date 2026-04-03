"use client";

import { useState } from "react";
import {
  PaymentElement,
  ExpressCheckoutElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { motion } from "framer-motion";
import type { StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js";

interface CheckoutFormProps {
  onSuccess: () => void;
  onError: (message: string) => void;
}

export default function CheckoutForm({ onSuccess, onError }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showExpress, setShowExpress] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: "if_required",
    });

    if (error) {
      onError(error.message ?? "Wystąpił błąd. Spróbuj ponownie.");
      setIsProcessing(false);
    } else {
      onSuccess();
    }
  };

  const handleExpressConfirm = async (
    event: StripeExpressCheckoutElementConfirmEvent
  ) => {
    if (!stripe || !elements) return;

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: "if_required",
    });

    if (error) {
      onError(error.message ?? "Wystąpił błąd. Spróbuj ponownie.");
    } else {
      onSuccess();
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
            <div className="w-full border-t border-gray-200 dark:border-[#3F4147]" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white dark:bg-[#2B2D31] px-4 text-xs text-[#1a1a1a]/40 dark:text-[#E0E0E0]/40">
              lub zapłać kartą / BLIK
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
          className={`w-full py-3.5 font-medium rounded-full text-white transition-all ${
            isProcessing
              ? "bg-[#2563EB]/60 dark:bg-[#3B82F6]/60 cursor-not-allowed"
              : "bg-[#2563EB] dark:bg-[#3B82F6] hover:bg-[#1d4ed8] dark:hover:bg-[#2563EB]"
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
              Przetwarzanie...
            </span>
          ) : (
            "Zapłać 499 zł"
          )}
        </motion.button>
      </form>
    </div>
  );
}
