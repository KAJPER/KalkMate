// Klient lejka zakupowego (/api/funnel, lib/funnel.ts). Anonimowo, bez
// cookies — dziala bez zgody na analityke. Bledy sa ignorowane.

import type { Locale } from "@/lib/i18n";

export type ClientFunnelEvent = "view_buy" | "sticky_click" | "form_open" | "form_submit";

// Ta sama regula co deviceFromUserAgent na serwerze (spojne kroki lejka).
function device(): "mobile" | "desktop" {
  try {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? "mobile" : "desktop";
  } catch {
    return "desktop";
  }
}

export function trackFunnel(event: ClientFunnelEvent, ctx: { lang?: Locale; country?: string | null } = {}): void {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({ event, lang: ctx.lang ?? null, country: ctx.country ?? null, device: device() });
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/funnel", blob)) return;
    fetch("/api/funnel", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
  } catch {
    /* ignore */
  }
}

// Raz na zaladowanie strony (per sciezka — nawigacja miedzy jezykami to inna strona).
const sent = new Set<string>();
export function trackFunnelOnce(event: ClientFunnelEvent, ctx: { lang?: Locale; country?: string | null } = {}): void {
  if (typeof window === "undefined") return;
  const key = `${event}:${window.location.pathname}`;
  if (sent.has(key)) return;
  sent.add(key);
  trackFunnel(event, ctx);
}
