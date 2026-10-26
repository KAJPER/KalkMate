"use client";

import { Elements } from "@stripe/react-stripe-js";
import { type StripeElementsOptions, type StripeElementLocale } from "@stripe/stripe-js";
import getStripe from "@/lib/getStripe";
import { type Locale } from "@/lib/i18n";

/**
 * Jezyk strony -> locale Stripe Elements. Stripe nie ma bialoruskiego
 * (jest tylko "ru") — dla "be" uzywamy angielskiego.
 */
export function stripeLocale(lang: Locale): StripeElementLocale {
  return lang === "be" ? "en" : lang;
}

interface StripeProviderProps {
  clientSecret: string;
  children: React.ReactNode;
  /** Jezyk strony — etykiety i komunikaty Stripe Elements w tym samym jezyku. */
  lang?: Locale;
}

// Modal zamowienia (BuyNow) jest zawsze ciemny — Elements w tej samej palecie
// zamiast jasnego/systemowego motywu, ktory gryzl sie z reszta formularza.
const appearance: StripeElementsOptions["appearance"] = {
  theme: "night",
  variables: {
    colorPrimary: "#D8FF3D",
    colorBackground: "#0B0B0B",
    colorText: "#F2EDE3",
    colorTextSecondary: "rgba(242, 237, 227, 0.55)",
    colorTextPlaceholder: "rgba(242, 237, 227, 0.30)",
    colorDanger: "#FF4D2E",
    fontFamily: "var(--font-geist), Inter, system-ui, -apple-system, sans-serif",
    borderRadius: "0px",
  },
  rules: {
    ".Input": {
      border: "1px solid rgba(242, 237, 227, 0.18)",
      backgroundColor: "#0B0B0B",
      color: "#F2EDE3",
      boxShadow: "none",
      padding: "10px 16px",
      fontSize: "14px",
    },
    ".Input:focus": {
      border: "1px solid #D8FF3D",
      boxShadow: "none",
    },
    ".Label": {
      fontSize: "13px",
      fontWeight: "500",
      color: "rgba(242, 237, 227, 0.55)",
    },
    ".Tab": {
      border: "1px solid rgba(242, 237, 227, 0.18)",
      backgroundColor: "#0B0B0B",
    },
    ".Tab--selected": {
      border: "1px solid #D8FF3D",
      backgroundColor: "#0E0E0E",
    },
    ".Tab:hover": {
      border: "1px solid #D8FF3D",
    },
  },
};

export default function StripeProvider({
  clientSecret,
  children,
  lang = "pl",
}: StripeProviderProps) {
  const options: StripeElementsOptions = {
    clientSecret,
    appearance,
    locale: stripeLocale(lang),
  };

  return (
    <Elements stripe={getStripe()} options={options}>
      {children}
    </Elements>
  );
}
