import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_NAME,
  MAX_AGE,
  matchTOTPCounter,
  matchTOTPCounterForSecret,
  consumeTOTPCounter,
  adminLoginLockedUntil,
  recordAdminLoginFailure,
  adminPasswordRequired,
  verifyAdminPassword,
  createAdminSession,
  revokeAdminSession,
  revokeAllAdminSessions,
  listAdminSessions,
  currentAdminSessionId,
  requireOwnerAuth,
} from "@/lib/admin-auth";
import { normalizeUsername, verifyModeratorLogin } from "@/lib/admin-moderators";
import { rateLimit, clientIp } from "@/lib/rate-limit";

// POST   /api/admin/auth            { token: "<TOTP>", password?: "<haslo>" } -> nowa sesja (cookie)
//                                   (password wymagane tylko gdy ustawione ADMIN_PASSWORD_HASH)
//                                   { username, token } -> sesja MODERATORA (jego wlasny TOTP,
//                                   dostep tylko do wybranych sekcji — lib/admin-permissions.ts)
// DELETE /api/admin/auth            wyloguj biezaca sesje
// DELETE /api/admin/auth?all=1      wyloguj WSZYSTKIE inne sesje (np. skradziony laptop) — wymaga waznej sesji
// GET    /api/admin/auth            lista sesji (wymaga zalogowania)

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const rl = rateLimit(`admin-auth:${ip}`, 5, 5 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Za dużo prób. Spróbuj za ${Math.ceil(rl.resetMs / 60000)} min.` },
      { status: 429 }
    );
  }

  // Globalna blokada po serii nieudanych prob (z dowolnych IP).
  const lockedUntil = await adminLoginLockedUntil();
  if (lockedUntil) {
    return NextResponse.json(
      { error: `Logowanie tymczasowo zablokowane (zbyt wiele nieudanych prób). Spróbuj za ${Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60000))} min.` },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const token = String(body?.token ?? "");

  // Moderator: login + kod z jego Authenticatora. Te same limity i globalna
  // blokada co dla wlasciciela.
  const rawUsername = typeof body?.username === "string" ? body.username.trim() : "";
  if (rawUsername) {
    const username = normalizeUsername(rawUsername);
    const result = username
      ? await verifyModeratorLogin(username, token, (secret, t) => matchTOTPCounterForSecret(secret, t))
      : ({ ok: false, reason: "invalid" } as const);
    if (!result.ok) {
      const { locked } = await recordAdminLoginFailure(ip);
      return NextResponse.json(
        {
          error: locked
            ? "Zbyt wiele nieudanych prób — logowanie zablokowane na 15 min."
            : result.reason === "reused"
              ? "Ten kod został już użyty. Poczekaj na następny kod w aplikacji."
              : "Nieprawidłowy login lub kod",
        },
        { status: locked ? 429 : 401 }
      );
    }
    const { cookie } = await createAdminSession(request.headers.get("user-agent"), ip, result.id);
    const response = NextResponse.json({ success: true, moderator: true });
    response.cookies.set(COOKIE_NAME, cookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: MAX_AGE,
      path: "/",
    });
    return response;
  }

  const password = typeof body?.password === "string" ? body.password : "";
  const passwordRequired = adminPasswordRequired();

  // Oba skladniki sprawdzane zawsze — odpowiedz nie zdradza, ktory byl zly.
  const counter = matchTOTPCounter(token);
  const passwordOk = await verifyAdminPassword(password);

  if (counter === null || !passwordOk) {
    const { locked } = await recordAdminLoginFailure(ip);
    return NextResponse.json(
      {
        error: locked
          ? "Zbyt wiele nieudanych prób — logowanie zablokowane na 15 min."
          : passwordRequired
            ? "Nieprawidłowy kod lub hasło"
            : "Nieprawidłowy kod autoryzacyjny",
        ...(passwordRequired ? { passwordRequired: true } : {}),
      },
      { status: locked ? 429 : 401 }
    );
  }

  // Kod jednorazowy: ten sam (lub starszy) krok TOTP nie zaloguje drugi raz.
  if (!(await consumeTOTPCounter(counter))) {
    await recordAdminLoginFailure(ip);
    return NextResponse.json(
      { error: "Ten kod został już użyty. Poczekaj na następny kod w aplikacji." },
      { status: 401 }
    );
  }

  const { cookie } = await createAdminSession(request.headers.get("user-agent"), ip);

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
  const all = new URL(request.url).searchParams.get("all") === "1";

  if (all) {
    // Wylogowanie WSZYSTKICH innych sesji tylko z sesji, ktora sama jest
    // wazna w bazie (nie odwolana) — wczesniej wystarczal podpis cookie, wiec
    // odwolana/skradziona sesja mogla wylogowac prawowitego admina.
    const authErr = await requireOwnerAuth(request); if (authErr) return authErr;
    const sessionId = await currentAdminSessionId(request);
    if (sessionId) await revokeAllAdminSessions(sessionId);
    return NextResponse.json({ success: true, revokedOthers: true });
  }

  const sessionId = await currentAdminSessionId(request);
  if (sessionId) await revokeAdminSession(sessionId);

  const response = NextResponse.json({ success: true, revokedOthers: false });
  response.cookies.delete(COOKIE_NAME);
  return response;
}

export async function GET(request: NextRequest) {
  const authErr = await requireOwnerAuth(request); if (authErr) return authErr;
  const current = await currentAdminSessionId(request);
  const sessions = await listAdminSessions();
  return NextResponse.json({
    ok: true,
    current,
    sessions: sessions.map((s) => ({ ...s, current: s.id === current })),
  });
}
