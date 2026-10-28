"use client";

import dynamic from "next/dynamic";
import { type Locale } from "@/lib/i18n";

const CartDrawer   = dynamic(() => import("@/components/CartDrawer"),   { ssr: false });
const CookieBanner = dynamic(() => import("@/components/CookieBanner"), { ssr: false });
const BuyNow       = dynamic(() => import("@/components/BuyNow"),       { ssr: false });
const VideoScroll  = dynamic(() => import("@/components/VideoScroll"),  { ssr: false });
const ClarityAnalyticsImpl = dynamic(() => import("@/components/ClarityAnalytics"), { ssr: false });
const SupportWidget = dynamic(() => import("@/components/SupportWidget"), { ssr: false });
const StickyBuyBar  = dynamic(() => import("@/components/StickyBuyBar"),  { ssr: false });

export function ClientCartDrawer()   { return <CartDrawer />; }
export function ClientCookieBanner() { return <CookieBanner />; }
export function ClientClarityAnalytics() { return <ClarityAnalyticsImpl />; }
export function ClientSupportWidget() { return <SupportWidget />; }
export function ClientBuyNow({ lang, defaultCountry }: { lang?: Locale; defaultCountry?: string }) {
  return <BuyNow lang={lang} defaultCountry={defaultCountry} />;
}
// Pasek "Zamow" na dole ekranu (mobile) — raz na landingu, obok ClientBuyNow.
export function ClientStickyBuyBar({ lang }: { lang?: Locale }) {
  return <StickyBuyBar lang={lang} />;
}
export function ClientVideoScroll({ lang }: { lang?: Locale }) {
  return <VideoScroll lang={lang} />;
}
