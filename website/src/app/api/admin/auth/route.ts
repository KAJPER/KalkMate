import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, MAX_AGE, validateTOTP } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const rl = rateLimit(`admin-auth:${clientIp(request)}`, 5, 5 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Za dużo prób. Spróbuj za ${Math.ceil(rl.resetMs / 60000)} min.` },
      { status: 429 }
    );
  }

  const { token } = await request.json();

  if (!validateTOTP(token)) {
    return NextResponse.json(
      { error: "Nieprawidłowy kod autoryzacyjny" },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, process.env.ADMIN_SESSION_TOKEN!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
