"use client";

import { useState, useEffect } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { type StripeElementsOptions } from "@stripe/stripe-js";
import getStripe from "@/lib/getStripe";

interface StripeProviderProps {
  clientSecret: string;
  children: React.ReactNode;
}

export default function StripeProvider({
  clientSecret,
  children,
}: StripeProviderProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: "flat",
      variables: {
        colorPrimary: isDark ? "#3B82F6" : "#2563EB",
        colorBackground: isDark ? "#313338" : "#ffffff",
        colorText: isDark ? "#E0E0E0" : "#1a1a1a",
        colorDanger: "#ef4444",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        borderRadius: "8px",
      },
      rules: {
        ".Input": {
          border: isDark ? "1px solid #3F4147" : "1px solid #e5e7eb",
          backgroundColor: isDark ? "#313338" : "#ffffff",
          color: isDark ? "#E0E0E0" : "#1a1a1a",
          boxShadow: "none",
          padding: "10px 16px",
          fontSize: "14px",
        },
        ".Input:focus": {
          border: isDark ? "1px solid #3B82F6" : "1px solid #2563EB",
          boxShadow: isDark
            ? "0 0 0 2px rgba(59, 130, 246, 0.2)"
            : "0 0 0 2px rgba(37, 99, 235, 0.2)",
        },
        ".Label": {
          fontSize: "14px",
          fontWeight: "500",
          color: isDark ? "rgba(224, 224, 224, 0.7)" : "rgba(26, 26, 26, 0.7)",
        },
        ".Tab": {
          border: isDark ? "1px solid #3F4147" : "1px solid #e5e7eb",
          backgroundColor: isDark ? "#2B2D31" : "#ffffff",
        },
        ".Tab--selected": {
          border: isDark ? "1px solid #3B82F6" : "1px solid #2563EB",
          backgroundColor: isDark ? "#313338" : "#ffffff",
        },
        ".Tab:hover": {
          border: isDark ? "1px solid #3B82F6" : "1px solid #2563EB",
        },
      },
    },
    locale: "pl",
  };

  return (
    <Elements stripe={getStripe()} options={options}>
      {children}
    </Elements>
  );
}
