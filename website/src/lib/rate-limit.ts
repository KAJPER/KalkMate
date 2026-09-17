// Prosty in-memory rate limiter — sliding window.
// Per-process (PM2 fork z 1 instancja kalkmate → OK, jak dolozysz cluster trzeba Redis).

import { NextRequest } from "next/server";

interface Bucket {
  hits: number[]; // timestampy w ms
}

const store = new Map<string, Bucket>();

// Cleanup co minute zeby Map nie rosla w nieskonczonosc
setInterval(
  () => {
    const cutoff = Date.now() - 60 * 60 * 1000; // 1h wstecz wystarczy
    for (const [key, b] of store) {
      const fresh = b.hits.filter((t) => t > cutoff);
      if (fresh.length === 0) store.delete(key);
      else b.hits = fresh;
    }
  },
  5 * 60 * 1000, // co 5 min
);

// Kolejnosc ma znaczenie (audyt 2026-09-17, potwierdzone na nginx):
// nginx ustawia X-Real-IP z $remote_addr (nie do podrobienia), natomiast
// X-Forwarded-For buduje przez $proxy_add_x_forwarded_for, czyli DOKLEJA
// prawdziwy adres NA KONIEC listy przyslanej przez klienta. Poprzednie
// `split(",")[0]` bralo wiec wartosc kontrolowana przez atakujacego —
// losowy naglowek na kazde zadanie omijal limity logowania/TOTP/rejestracji.
// Z XFF bierzemy ostatni element (ten dopisany przez nginx), nigdy pierwszy.
export function clientIp(req: NextRequest): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return "unknown";
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetMs: number; // ms do zwolnienia limitu
}

// Sprawdza i (jesli ok) liczy hita. Limit: maxHits w windowMs.
// Zwraca { ok: false } gdy przekroczone.
export function rateLimit(
  bucketKey: string,
  maxHits: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;
  let b = store.get(bucketKey);
  if (!b) {
    b = { hits: [] };
    store.set(bucketKey, b);
  }
  // wyrzuc stare
  b.hits = b.hits.filter((t) => t > cutoff);
  if (b.hits.length >= maxHits) {
    const oldest = b.hits[0];
    return {
      ok: false,
      remaining: 0,
      resetMs: Math.max(0, windowMs - (now - oldest)),
    };
  }
  b.hits.push(now);
  return {
    ok: true,
    remaining: maxHits - b.hits.length,
    resetMs: windowMs - (now - b.hits[0]),
  };
}
