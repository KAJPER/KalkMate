// Prawdziwy stan konta OpenRouter (nie szacunek z naszej bazy) — do
// wykrywania rozjazdow miedzy tym, ile MY naliczylismy userom, a tym, ile
// OpenRouter faktycznie policzyl nam. GET /api/v1/auth/key zwraca usage
// (all-time, USD) + rozbicie usage_daily/weekly/monthly dla klucza API,
// bez zadnych dodatkowych uprawnien ponad zwykly klucz z .env.
//
// Zrodlo: https://openrouter.ai/docs (endpoint zweryfikowany na zywo
// 2026-09-18 realnym kluczem produkcyjnym).

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

export interface OpenRouterAccountUsage {
  ok: true;
  usageAllTimeUSD: number;
  usageDailyUSD: number;
  usageWeeklyUSD: number;
  usageMonthlyUSD: number;
  limitUSD: number | null;
  limitRemainingUSD: number | null;
  isFreeTier: boolean;
}

export interface OpenRouterAccountError {
  ok: false;
  error: string;
}

let cache: { at: number; value: OpenRouterAccountUsage | OpenRouterAccountError } | null = null;
const CACHE_MS = 60_000; // nie spamuj OpenRoutera przy kazdym odswiezeniu panelu

export async function getOpenRouterAccountUsage(): Promise<OpenRouterAccountUsage | OpenRouterAccountError> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  if (!OPENROUTER_API_KEY) {
    const value = { ok: false as const, error: "OPENROUTER_API_KEY nieskonfigurowany" };
    cache = { at: Date.now(), value };
    return value;
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const value = { ok: false as const, error: `OpenRouter ${res.status}` };
      cache = { at: Date.now(), value };
      return value;
    }
    const json = await res.json();
    const d = json?.data ?? {};
    const value: OpenRouterAccountUsage = {
      ok: true,
      usageAllTimeUSD: Number(d.usage) || 0,
      usageDailyUSD: Number(d.usage_daily) || 0,
      usageWeeklyUSD: Number(d.usage_weekly) || 0,
      usageMonthlyUSD: Number(d.usage_monthly) || 0,
      limitUSD: d.limit === null || d.limit === undefined ? null : Number(d.limit),
      limitRemainingUSD: d.limit_remaining === null || d.limit_remaining === undefined ? null : Number(d.limit_remaining),
      isFreeTier: Boolean(d.is_free_tier),
    };
    cache = { at: Date.now(), value };
    return value;
  } catch (e) {
    const value = { ok: false as const, error: (e as Error).message };
    cache = { at: Date.now(), value };
    return value;
  }
}
