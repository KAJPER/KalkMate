// Walidacja callbackUrl po logowaniu + zapamietanie intencji powrotu.
//
// callbackUrl przychodzi z query (?callbackUrl=...) i jest kontrolowany przez
// atakujacego — bez walidacji `window.location.href = callbackUrl` to open
// redirect (//evil.com, /\evil.com) i DOM XSS (javascript:...). Akceptujemy
// WYLACZNIE sciezki wzgledne w obrebie naszego originu.
//
// Zwykly modul (bez "use client") — uzywany tez w server component
// /auth/signup. Funkcje storage sa no-op poza przegladarka.

export const DEFAULT_CALLBACK = "/panel";

const MAX_LEN = 2048;

export function safeCallback(cb: unknown, fallback: string = DEFAULT_CALLBACK): string {
  if (typeof cb !== "string" || !cb || cb.length > MAX_LEN) return fallback;
  // Tylko sciezka od "/" — bez schematu (javascript:, https:), bez "//host"
  // (protocol-relative) i "/\host" (przegladarki traktuja "\" jak "/").
  if (cb[0] !== "/" || cb[1] === "/" || cb[1] === "\\") return fallback;
  // Znaki kontrolne/whitespace: przegladarki wycinaja \t \n \r z URL-i,
  // wiec "/\t/evil.com" zamienia sie w "//evil.com".
  if (/[\u0000-\u001F\u007F\s\\]/.test(cb)) return fallback;
  // Druga linia obrony: po sparsowaniu origin musi zostac nasz.
  try {
    const base = "https://kalkmate.invalid";
    const u = new URL(cb, base);
    if (u.origin !== base) return fallback;
  } catch {
    return fallback;
  }
  return cb;
}

// Intencja powrotu (np. "/en?checkout=true#kup-teraz") musi przezyc
// rejestracje -> klik w link z maila (czesto NOWA karta) -> logowanie.
// sessionStorage jest per-karta, wiec link z maila by jej nie widzial —
// dlatego localStorage z krotkim TTL (link weryfikacyjny i tak wygasa po 24h).
const STORE_KEY = "km_post_auth_redirect";
const TTL_MS = 24 * 60 * 60 * 1000;

export function rememberCallback(cb: string | null | undefined): void {
  const safe = safeCallback(cb, "");
  if (!safe || safe === DEFAULT_CALLBACK) return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ url: safe, at: Date.now() }));
  } catch {
    /* storage niedostepny (tryb prywatny) — trudno, wrocimy na /panel */
  }
}

export function recallCallback(): string | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { url?: unknown; at?: unknown };
    if (typeof parsed?.at !== "number" || Date.now() - parsed.at > TTL_MS) {
      localStorage.removeItem(STORE_KEY);
      return null;
    }
    return safeCallback(parsed.url, "") || null;
  } catch {
    return null;
  }
}

export function forgetCallback(): void {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    /* ignore */
  }
}
