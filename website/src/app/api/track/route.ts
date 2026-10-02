import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { classify, ipHashFromHeaders, recordVisit } from "@/lib/attribution";

const BOT_UA = /bot|crawler|spider|crawling|facebookexternalhit|linkedinbot|twitterbot|googlebot|bingbot|slurp|duckduckbot|baidu|yandex|semrush|ahrefs|mj12bot/i;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const page = String(body?.page || "/").slice(0, 300);

    // Admin i api stron nie śledzić
    if (page.startsWith("/admin") || page.startsWith("/api")) {
      return NextResponse.json({ ok: true });
    }

    const userAgent = (req.headers.get("user-agent") || "").slice(0, 300);
    if (BOT_UA.test(userAgent)) {
      return NextResponse.json({ ok: true });
    }

    const ipHash = ipHashFromHeaders(req.headers);

    const referer = String(body?.referer || "").slice(0, 300) || null;
    const host = (req.headers.get("host") || "").toLowerCase().split(":")[0].slice(0, 100) || null;
    const landing = body?.landing === true;
    // Zrodlo liczymy tylko dla wejscia na strone (nie dla nawigacji wewnatrz).
    const touch = landing ? classify(String(body?.search || "").slice(0, 500), referer || "") : null;

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
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
