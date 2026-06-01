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

export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
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
