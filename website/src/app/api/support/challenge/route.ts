import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { newPowChallenge } from "@/lib/supportChat";

// GET /api/support/challenge — wyzwanie proof-of-work do "Nie jestem robotem"
// w czacie na stronie (lib/supportChat.ts verifyPow).
export async function GET(request: NextRequest) {
  const rl = rateLimit(`support-challenge:${clientIp(request)}`, 30, 10 * 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  return NextResponse.json({ ok: true, ...newPowChallenge() }, { headers: { "Cache-Control": "no-store" } });
}
