import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendMail } from "@/lib/mailer";
import { verificationEmail } from "@/lib/email-templates";

async function getUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return await prisma.user.findUnique({ where: { email: session.user.email } });
}

// POST /api/user/account/change-email { newEmail, password }
// M8: Zamiast natychmiastowej zmiany emaila, wysyłamy token weryfikacyjny
// na NOWY adres. Email zostaje zmieniony dopiero po kliknięciu linku.
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

  // Generuj token i zapisz w EmailVerification z targetEmail = newEmail.
  // Kasujemy stare niewykorzystane tokeny zmiany emaila dla tego użytkownika.
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const id = `ecr_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  await prisma.$executeRaw`
    DELETE FROM "EmailVerification"
    WHERE "userId" = ${user.id} AND "verifiedAt" IS NULL AND "targetEmail" IS NOT NULL
  `;
  await prisma.$executeRaw`
    INSERT INTO "EmailVerification" ("id", "userId", "token", "expiresAt", "targetEmail")
    VALUES (${id}, ${user.id}, ${token}, ${expiresAt.toISOString()}, ${newEmail})
  `;

  const baseUrl = process.env.NEXTAUTH_URL || "https://kalkmate.pl";
  const verifyUrl = `${baseUrl}/auth/verify?token=${token}`;
  await sendMail({
    to: newEmail,
    subject: "Potwierdź zmianę adresu email - KalkMate",
    html: verificationEmail({
      verifyUrl,
      expiresHours: 24,
      customerName: user.name || undefined,
    }),
  });

  return NextResponse.json({ ok: true, verificationSent: true });
}
