import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_NAME,
  MAX_AGE,
  validateTOTP,
  createAdminSession,
  revokeAdminSession,
  revokeAllAdminSessions,
  listAdminSessions,
  currentAdminSessionId,
  requireAdminAuth,
} from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

// POST   /api/admin/auth            { token: "<TOTP>" } -> nowa sesja (cookie)
// DELETE /api/admin/auth            wyloguj biezaca sesje
// DELETE /api/admin/auth?all=1      wyloguj WSZYSTKIE inne sesje (np. skradziony laptop)
// GET    /api/admin/auth            lista sesji (wymaga zalogowania)

export async function POST(request: NextRequest) {
  const rl = rateLimit(`admin-auth:${clientIp(request)}`, 5, 5 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Za dużo prób. Spróbuj za ${Math.ceil(rl.resetMs / 60000)} min.` },
      { status: 429 }
    );
  }

  const { token } = await request.json();

  if (!validateTOTP(String(token ?? ""))) {
    return NextResponse.json(
      { error: "Nieprawidłowy kod autoryzacyjny" },
      { status: 401 }
    );
  }

  const { cookie } = await createAdminSession(request.headers.get("user-agent"), clientIp(request));

  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
  return response;
}

export async function DELETE(request: NextRequest) {
  const sessionId = await currentAdminSessionId(request);
  const all = new URL(request.url).searchParams.get("all") === "1";

  if (sessionId) {
    if (all) {
      await revokeAllAdminSessions(sessionId);
    } else {
      await revokeAdminSession(sessionId);
    }
  }

  const response = NextResponse.json({ success: true, revokedOthers: all });
  if (!all) response.cookies.delete(COOKIE_NAME);
  return response;
}

export async function GET(request: NextRequest) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const current = await currentAdminSessionId(request);
  const sessions = await listAdminSessions();
  return NextResponse.json({
    ok: true,
    current,
    sessions: sessions.map((s) => ({ ...s, current: s.id === current })),
  });
}
