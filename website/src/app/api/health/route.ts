import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { P24_BASE_URL, POS_ID } from "@/lib/przelewy24";

// Stan strony dla monitoringu (/home/ubuntu/kalkulator/uptime_check.py, cron
// co 5 min). Bez naglowka: tylko baza (publicznie, bez szczegolow). Z
// naglowkiem x-cron-secret (ten sam CRON_SECRET co /api/cron/tracking): tez
// Stripe i Przelewy24 — czy klucze dzialaja i bramki odpowiadaja.
export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET || "";

function secretMatches(given: string | null): boolean {
  if (!CRON_SECRET || !given) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(CRON_SECRET).digest();
  return timingSafeEqual(a, b);
}

type Check = { ok: boolean; ms: number; error?: string };

async function timed(fn: () => Promise<unknown>, timeoutMs = 8000): Promise<Check> {
  const t0 = Date.now();
  try {
    await Promise.race([
      fn(),
      new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout ${timeoutMs} ms`)), timeoutMs)),
    ]);
    return { ok: true, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, error: String((e as Error)?.message || e).slice(0, 200) };
  }
}

async function p24TestAccess(): Promise<void> {
  const auth = "Basic " + Buffer.from(`${POS_ID}:${process.env.P24_API_KEY || ""}`).toString("base64");
  const res = await fetch(`${P24_BASE_URL}/testAccess`, { headers: { Authorization: auth }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json().catch(() => null);
  if (data?.data !== true) throw new Error("testAccess != true");
}

export async function GET(req: NextRequest) {
  const db = await timed(() => prisma.$queryRaw`SELECT 1`);
  if (!secretMatches(req.headers.get("x-cron-secret"))) {
    return NextResponse.json({ ok: db.ok }, { status: db.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  }
  const [stripeCheck, p24] = await Promise.all([
    timed(() => stripe.balance.retrieve()),
    timed(p24TestAccess),
  ]);
  const checks = { db, stripe: stripeCheck, p24 };
  const ok = Object.values(checks).every((c) => c.ok);
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
