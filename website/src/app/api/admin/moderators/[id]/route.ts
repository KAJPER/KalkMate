import { NextRequest, NextResponse } from "next/server";
import { requireOwnerAuth, revokeModeratorSessions } from "@/lib/admin-auth";
import {
  deleteModerator,
  getModerator,
  moderatorTotpSetup,
  resetModeratorTotp,
  sanitizePermissions,
  updateModeratorPermissions,
} from "@/lib/admin-moderators";

// Tylko wlasciciel panelu.
// PATCH  { permissions }   — zmiana sekcji (dziala od razu, takze w otwartych sesjach)
// POST   { action: "reset2fa" } — nowy kod do Authenticatora + wylogowanie moderatora
// DELETE                   — usuniecie konta + wylogowanie
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = await requireOwnerAuth(request); if (authErr) return authErr;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const permissions = sanitizePermissions(body?.permissions);
  if (!permissions.length) return NextResponse.json({ ok: false, error: "Zaznacz co najmniej jedną sekcję." }, { status: 400 });
  if (!(await updateModeratorPermissions(id, permissions))) {
    return NextResponse.json({ ok: false, error: "Nie ma takiego moderatora." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, moderator: await getModerator(id) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = await requireOwnerAuth(request); if (authErr) return authErr;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (body?.action !== "reset2fa") return NextResponse.json({ ok: false, error: "Nieznana akcja." }, { status: 400 });
  const moderator = await getModerator(id);
  if (!moderator) return NextResponse.json({ ok: false, error: "Nie ma takiego moderatora." }, { status: 404 });
  const secret = await resetModeratorTotp(id);
  if (!secret) return NextResponse.json({ ok: false, error: "Nie ma takiego moderatora." }, { status: 404 });
  await revokeModeratorSessions(id);
  return NextResponse.json({ ok: true, totp: await moderatorTotpSetup(moderator.username, secret) });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = await requireOwnerAuth(request); if (authErr) return authErr;
  const { id } = await params;
  await revokeModeratorSessions(id);
  if (!(await deleteModerator(id))) return NextResponse.json({ ok: false, error: "Nie ma takiego moderatora." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
