"use client";

import { Elements, PaymentMethodMessagingElement } from "@stripe/react-stripe-js";
import type { StripeElementsOptions, StripePaymentMethodMessagingElementOptions } from "@stripe/stripe-js";
import getStripe from "@/lib/getStripe";
import { type Locale } from "@/lib/i18n";

// Komunikat "zaplac pozniej / w ratach" (Klarna przez Stripe) na karcie
// zamowienia. Osobny modul ladowany przez next/dynamic — Stripe.js
// (js.stripe.com) nie jest pobierany na landingu, dopoki BuyNow nie zdecyduje,
// ze wolno (zgoda analityczna albo otwarcie modala zamowienia).
export default function KlarnaMessaging({
  amount,
  currency,
  countryCode,
  lang,
}: {
  amount: number;
  currency: "PLN" | "EUR";
  countryCode: NonNullable<StripePaymentMethodMessagingElementOptions["countryCode"]>;
  lang: Locale;
}) {
  return (
    <Elements
      stripe={getStripe()}
      options={{
        locale: lang,
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
      <PaymentMethodMessagingElement options={{ amount, currency, countryCode }} />
    </Elements>
  );
}
