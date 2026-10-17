import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import {
  authOptions,
  bumpSessionVersion,
  reissueSessionCookie,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

async function getUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return await prisma.user.findUnique({ where: { email: session.user.email } });
}

// POST /api/user/account/change-password { currentPassword, newPassword }
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });

  // Limit per konto — przejeta sesja nie moze zgadywac obecnego hasla bez konca.
  const rl = rateLimit(`change-pw:${user.id}`, 5, 15 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: `Za dużo prób. Spróbuj za ${Math.ceil(rl.resetMs / 60000)} min.` },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (newPassword.length < PASSWORD_MIN_LENGTH) {
    return NextResponse.json({ ok: false, error: `Nowe hasło musi mieć min. ${PASSWORD_MIN_LENGTH} znaków` }, { status: 400 });
  }
  if (newPassword.length > PASSWORD_MAX_LENGTH) {
    return NextResponse.json({ ok: false, error: `Nowe hasło może mieć max. ${PASSWORD_MAX_LENGTH} znaków` }, { status: 400 });
  }
  if (!user.password) {
    return NextResponse.json({ ok: false, error: "Konto bez hasła (logowanie zewnętrzne)" }, { status: 400 });
  }
  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    return NextResponse.json({ ok: false, error: "Aktualne hasło jest nieprawidłowe" }, { status: 403 });
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });

  // Wyloguj wszystkie INNE sesje (np. ktos znal stare haslo), biezaca dostaje
  // nowe cookie z aktualna wersja sesji.
  await bumpSessionVersion(user.id);
  const res = NextResponse.json({ ok: true });
  await reissueSessionCookie(req, res, user.id);
  return res;
}
