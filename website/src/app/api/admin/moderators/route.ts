import { NextRequest, NextResponse } from "next/server";
import { requireOwnerAuth } from "@/lib/admin-auth";
import {
  createModerator,
  listModerators,
  moderatorTotpSetup,
  normalizeUsername,
  sanitizePermissions,
} from "@/lib/admin-moderators";

// Tylko wlasciciel panelu.
// GET  /api/admin/moderators                         — lista moderatorow
// POST /api/admin/moderators { username, permissions } — nowy moderator;
//      odpowiedz zawiera otpauth (QR do Authenticatora) — pokazywany JEDEN raz.
export async function GET(request: NextRequest) {
  const authErr = await requireOwnerAuth(request); if (authErr) return authErr;
  return NextResponse.json({ ok: true, moderators: await listModerators() });
}

export async function POST(request: NextRequest) {
  const authErr = await requireOwnerAuth(request); if (authErr) return authErr;
  const body = await request.json().catch(() => ({}));
  const username = normalizeUsername(body?.username);
  if (!username) {
    return NextResponse.json(
      { ok: false, error: "Login: 3–32 znaki, tylko małe litery, cyfry, kropka, myślnik i podkreślnik." },
      { status: 400 }
    );
  }
  const permissions = sanitizePermissions(body?.permissions);
  if (!permissions.length) return NextResponse.json({ ok: false, error: "Zaznacz co najmniej jedną sekcję." }, { status: 400 });

  try {
    const { moderator, secret } = await createModerator(username, permissions);
    return NextResponse.json({ ok: true, moderator, totp: await moderatorTotpSetup(username, secret) });
  } catch (e) {
    if (/UNIQUE/i.test((e as Error).message)) {
      return NextResponse.json({ ok: false, error: `Login „${username}” jest już zajęty.` }, { status: 409 });
    }
    console.error("[admin/moderators] create failed", e);
    return NextResponse.json({ ok: false, error: "Nie udało się utworzyć moderatora." }, { status: 500 });
  }
}
