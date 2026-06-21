import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";

async function getUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return await prisma.user.findUnique({ where: { email: session.user.email } });
}

// POST /api/user/account/change-email { newEmail, password }
// Zmiana zabezpieczona haslem. Po zmianie sesja trzyma stary email -> trzeba
// zalogowac sie ponownie (UI to obsluguje przez signOut).
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const newEmail = String(body?.newEmail || "").trim().toLowerCase();
  const password = String(body?.password || "");

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(newEmail)) {
    return NextResponse.json({ ok: false, error: "Nieprawidłowy adres email" }, { status: 400 });
  }
  if (newEmail === user.email.toLowerCase()) {
    return NextResponse.json({ ok: false, error: "To już jest Twój obecny email" }, { status: 400 });
  }
  if (!user.password) {
    return NextResponse.json({ ok: false, error: "Konto bez hasła (logowanie zewnętrzne)" }, { status: 400 });
  }
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return NextResponse.json({ ok: false, error: "Hasło jest nieprawidłowe" }, { status: 403 });
  }

  const taken = await prisma.user.findUnique({ where: { email: newEmail } });
  if (taken) {
    return NextResponse.json({ ok: false, error: "Ten email jest już zajęty" }, { status: 409 });
  }

  await prisma.user.update({ where: { id: user.id }, data: { email: newEmail } });
  return NextResponse.json({ ok: true, relogin: true });
}
