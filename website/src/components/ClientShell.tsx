"use client";

import dynamic from "next/dynamic";
import { type Locale } from "@/lib/i18n";

const CartDrawer   = dynamic(() => import("@/components/CartDrawer"),   { ssr: false });
const CookieBanner = dynamic(() => import("@/components/CookieBanner"), { ssr: false });
const BuyNow       = dynamic(() => import("@/components/BuyNow"),       { ssr: false });
const VideoScroll  = dynamic(() => import("@/components/VideoScroll"),  { ssr: false });
const ClarityAnalyticsImpl = dynamic(() => import("@/components/ClarityAnalytics"), { ssr: false });

export function ClientCartDrawer()   { return <CartDrawer />; }
export function ClientCookieBanner() { return <CookieBanner />; }
export function ClientClarityAnalytics() { return <ClarityAnalyticsImpl />; }
export function ClientBuyNow({ lang, defaultCountry }: { lang?: Locale; defaultCountry?: string }) {
  return <BuyNow lang={lang} defaultCountry={defaultCountry} />;
}
export function ClientVideoScroll({ lang }: { lang?: Locale }) {
  return <VideoScroll lang={lang} />;
}
