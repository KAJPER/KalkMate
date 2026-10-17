import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { classify, ipHashFromHeaders, recordVisit } from "@/lib/attribution";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const BOT_UA = /bot|crawler|spider|crawling|facebookexternalhit|linkedinbot|twitterbot|googlebot|bingbot|slurp|duckduckbot|baidu|yandex|semrush|ahrefs|mj12bot/i;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export async function POST(req: NextRequest) {
  try {
    // Publiczny endpoint piszacy do bazy — limit per IP (prawdziwe IP z
    // X-Real-IP, jak w lib/rate-limit), zeby nie dalo sie zalac tabeli Visit.
    if (!rateLimit(`track:${clientIp(req)}`, 60, 60_000).ok) {
      return NextResponse.json({ ok: false }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    const page = str(body?.page, 300) || "/";

    // Admin i api stron nie śledzić
    if (page.startsWith("/admin") || page.startsWith("/api")) {
      return NextResponse.json({ ok: true });
    }

    const userAgent = (req.headers.get("user-agent") || "").slice(0, 300);
    if (BOT_UA.test(userAgent)) {
      return NextResponse.json({ ok: true });
    }

    const ipHash = ipHashFromHeaders(req.headers);

    const referer = str(body?.referer, 500) || null;
    const host = (req.headers.get("host") || "").toLowerCase().split(":")[0].slice(0, 100) || null;
    const landing = body?.landing === true;
    // Zrodlo liczymy tylko dla wejscia na strone (nie dla nawigacji wewnatrz).
    const touch = landing ? classify(str(body?.search, 500), referer || "") : null;

    await recordVisit({
      id: randomUUID(),
      ipHash,
      userAgent,
      referer,
      page,
      host,
      landing,
      touch,
    });

    return NextResponse.json({ ok: true, touch: touch ? { ...touch, landing: page } : null });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
