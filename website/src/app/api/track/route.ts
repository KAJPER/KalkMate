import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";

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

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const salt = process.env.ANALYTICS_SALT || "kalkmate-analytics";
    const ipHash = createHash("sha256")
      .update(ip + salt)
      .digest("hex")
      .slice(0, 16);

    const referer = String(body?.referer || "").slice(0, 300) || null;

    await prisma.visit.create({
      data: {
        id: require("crypto").randomUUID(),
        ipHash,
        userAgent,
        referer,
        page,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
