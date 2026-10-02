// Pamiec zrodla wejscia w przegladarce (pierwsze + ostatnie wejscie) —
// TYLKO przy zgodzie na cookies analityczne (CookieBanner, choice "all").
// Bez zgody nic nie zapisujemy; serwer dopasuje zrodlo po hashu IP
// (patrz lib/attribution.ts resolveAttribution).

import type { Touch } from "@/lib/attribution";

const CONSENT_KEY = "kalkmate-cookie-consent";
const ATTR_KEY = "km-attr";
const MAX_AGE_MS = 90 * 86400_000;

export function hasAnalyticsConsent(): boolean {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    return !!raw && JSON.parse(raw)?.choice === "all";
  } catch {
    return false;
  }
}

interface Stored { first: Touch | null; last: Touch | null }

export function readClientAttribution(): Stored | null {
  if (!hasAnalyticsConsent()) return null;
  try {
    const s = JSON.parse(localStorage.getItem(ATTR_KEY) || "null") as Stored | null;
    if (!s?.first?.at || Date.now() - Date.parse(s.first.at) > MAX_AGE_MS) return null;
    return s;
  } catch {
    return null;
  }
}

// Wolane po kazdym "wejsciu" na strone, ktore serwer sklasyfikowal jako zrodlo.
export function rememberTouch(touch: Touch): void {
  if (!hasAnalyticsConsent()) return;
  try {
    const cur = readClientAttribution();
    const t = { ...touch, at: new Date().toISOString() };
    // Bezposrednie wejscie nie nadpisuje ostatniego prawdziwego zrodla.
    const last = touch.channel === "direct" && cur?.last ? cur.last : t;
    localStorage.setItem(ATTR_KEY, JSON.stringify({ first: cur?.first || t, last }));
  } catch {}
}
