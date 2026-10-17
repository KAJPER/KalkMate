// Wspolne narzedzia paneli statystyk admina (analytics, analytics/visits,
// openrouter-stats, gemini-stats). Folder "_lib" = prywatny w App Router
// (nie jest trasa API).
//
// Dni i godziny liczymy w strefie Europe/Warsaw — wczesniej toISOString()
// (UTC) przesuwal zamowienia/wizyty z 00:00-02:00 na poprzedni dzien.

const TZ = "Europe/Warsaw";

const DAY_FMT = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const PARTS_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const toDate = (d: Date | number) => (typeof d === "number" ? new Date(d) : d);

/** "YYYY-MM-DD" dnia w Warszawie. */
export function warsawDay(d: Date | number): string {
  return DAY_FMT.format(toDate(d));
}

function warsawParts(d: Date | number) {
  const parts = PARTS_FMT.formatToParts(toDate(d));
  const get = (t: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour") % 24, min: get("minute"), s: get("second") };
}

/** Godzina 0-23 w Warszawie. */
export function warsawHour(d: Date | number): number {
  return warsawParts(d).h;
}

// Przesuniecie Warszawy wzgledem UTC w danej chwili (ms, +1h / +2h).
export function warsawOffsetMs(ms: number): number {
  const p = warsawParts(ms);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(ms / 1000) * 1000;
}

/** Poczatek (00:00 czasu warszawskiego) dnia "YYYY-MM-DD" jako timestamp ms. */
export function warsawDayStartMs(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  return guess - warsawOffsetMs(guess);
}

/** n ostatnich dni (klucze "YYYY-MM-DD", od najstarszego, ostatni = dzis w Warszawie). Arytmetyka kalendarzowa — bez problemow ze zmiana czasu. */
export function lastWarsawDays(n: number, now: number = Date.now()): string[] {
  const [y, m, d] = warsawDay(now).split("-").map(Number);
  const base = Date.UTC(y, m - 1, d);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(new Date(base - i * 86_400_000).toISOString().slice(0, 10));
  return out;
}

// === Cache wynikow (60 s) ===
// Panele odpytuja te endpointy co kilka-kilkanascie sekund, a kazde wywolanie
// mielilo cale tabele. Trzymamy obietnice (rownolegle zadania dziela jedno
// liczenie); blad nie zostaje w cache. Na globalThis — wspolne dla bundli.
type Entry = { at: number; value: Promise<unknown> };
const store = ((globalThis as unknown as { __kmAdminStatsCache?: Map<string, Entry> }).__kmAdminStatsCache ??= new Map<string, Entry>());

export const STATS_CACHE_MS = 60_000;

export function cachedStats<T>(key: string, fn: () => Promise<T>, ttlMs: number = STATS_CACHE_MS): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now - hit.at < ttlMs) return hit.value as Promise<T>;
  // Sprzatanie starych kluczy (np. rozne ?days=), zeby mapa nie rosla bez konca.
  if (store.size > 200) {
    for (const [k, v] of store) if (now - v.at >= ttlMs) store.delete(k);
  }
  const value = fn();
  store.set(key, { at: now, value });
  value.catch(() => {
    if (store.get(key)?.value === value) store.delete(key);
  });
  return value;
}
