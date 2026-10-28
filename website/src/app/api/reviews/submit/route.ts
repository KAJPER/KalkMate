import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import {
  submitReview,
  isReviewTokenFormat,
  cleanDisplayName,
  cleanReviewText,
  REVIEW_NAME_MAX,
  REVIEW_TEXT_MAX,
} from "@/lib/reviews";

// POST /api/reviews/submit — opinia z /opinia/<token> (link z maila po dostawie).
// Body: { token, rating 1..5, text (<=1000), name (1..40), consent: true }
// Token jedyna autoryzacja: 32 losowe bajty, jednorazowy (status 'requested').
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!rateLimit(`review-submit:${ip}`, 10, 10 * 60_000).ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "bad_request" }, { status: 400 });
    const { token, rating, text, name, consent } = body as Record<string, unknown>;

    if (!isReviewTokenFormat(token)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (!rateLimit(`review-submit-token:${token}`, 5, 10 * 60_000).ok) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "invalid_rating" }, { status: 400 });
    }
    if (text !== undefined && text !== null && typeof text !== "string") {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    const cleanText = cleanReviewText(text);
    if (cleanText.length > REVIEW_TEXT_MAX) return NextResponse.json({ error: "text_too_long" }, { status: 400 });
    const cleanName = cleanDisplayName(name);
    if (!cleanName || cleanName.length > REVIEW_NAME_MAX) return NextResponse.json({ error: "invalid_name" }, { status: 400 });
    if (consent !== true) return NextResponse.json({ error: "consent_required" }, { status: 400 });

    const r = await submitReview({ token, rating, text: cleanText, name: cleanName });
    if (r === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (r === "already_submitted") return NextResponse.json({ error: "already_submitted" }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[reviews/submit]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
