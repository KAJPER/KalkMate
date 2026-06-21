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

// POST /api/user/account/change-password { currentPassword, newPassword }
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const currentPassword = String(body?.currentPassword || "");
  const newPassword = String(body?.newPassword || "");

  if (newPassword.length < 6) {
    return NextResponse.json({ ok: false, error: "Nowe hasło musi mieć min. 6 znaków" }, { status: 400 });
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
  return NextResponse.json({ ok: true });
}
