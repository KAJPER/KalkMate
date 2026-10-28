import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { isLocale } from "@/lib/i18n";
import {
  chatToken,
  createChat,
  normalizeEmail,
  sanitizeJourney,
  sanitizePath,
  verifyPow,
} from "@/lib/supportChat";

// POST /api/support/start
// { email, acceptTerms: true, challenge, sig, nonce, website (honeypot), lang, page,
//   trackingConsent, journey? } -> { chatId, token }
export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const rl = rateLimit(`support-start:${ip}`, 5, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  // Honeypot: ukryte pole, ktore wypelniaja tylko boty.
  if (typeof body?.website === "string" && body.website.trim()) return NextResponse.json({ ok: false, error: "bot" }, { status: 400 });
  if (!verifyPow(body?.challenge, body?.sig, body?.nonce)) return NextResponse.json({ ok: false, error: "human_check" }, { status: 400 });
  const email = normalizeEmail(body?.email);
  if (!email) return NextResponse.json({ ok: false, error: "email" }, { status: 400 });
  if (body?.acceptTerms !== true) return NextResponse.json({ ok: false, error: "terms" }, { status: 400 });

  // Przebieg wizyty tylko przy zgodzie na cookies analityczne (przegladarka
  // bez zgody go nie wysyla; tu dodatkowo ignorujemy).
  const trackingConsent = body?.trackingConsent === true;
  const chatId = await createChat({
    email,
    lang: isLocale(body?.lang) ? body.lang : "pl",
    page: sanitizePath(body?.page),
    userAgent: request.headers.get("user-agent"),
    journey: trackingConsent ? sanitizeJourney(body?.journey) : [],
    trackingConsent,
  });
  return NextResponse.json({ ok: true, chatId, token: chatToken(chatId) });
}
