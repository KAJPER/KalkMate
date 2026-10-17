// Odczyt zgody cookies zapisanej przez CookieBanner (ten sam klucz i wersja).
// "all" = zgoda na cookies analityczne; "essential" = tylko niezbedne.

export const CONSENT_STORAGE_KEY = "kalkmate-cookie-consent";
export const CONSENT_VERSION = "1"; // musi byc zgodne z VERSION w CookieBanner
export const CONSENT_EVENT = "kalkmate:cookie-consent";

export function hasAnalyticsConsent(): boolean {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return false;
    const rec = JSON.parse(raw) as { v?: string; choice?: string };
    // Stara wersja zgody = brak zgody (CookieBanner i tak zapyta ponownie).
    return rec?.v === CONSENT_VERSION && rec?.choice === "all";
  } catch {
    return false;
  }
}
