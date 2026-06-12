import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendMail } from "@/lib/mailer";
import { verificationEmail } from "@/lib/email-templates";

const VERIFY_EXPIRY_HOURS = 24;

async function createVerification(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + VERIFY_EXPIRY_HOURS * 60 * 60 * 1000);
  const id = `evr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  // Cancel old non-verified tokens for this user
  await prisma.$executeRaw`
    DELETE FROM "EmailVerification"
    WHERE "userId" = ${userId} AND "verifiedAt" IS NULL
  `;
  await prisma.$executeRaw`
    INSERT INTO "EmailVerification" ("id", "userId", "token", "expiresAt")
    VALUES (${id}, ${userId}, ${token}, ${expiresAt.toISOString()})
  `;
  return token;
}

async function sendVerification(email: string, name: string | null, userId: string) {
  const token = await createVerification(userId);
  const baseUrl = process.env.NEXTAUTH_URL || "https://kalkmate.pl";
  const verifyUrl = `${baseUrl}/auth/verify?token=${token}`;
  const r = await sendMail({
    to: email,
    subject: "Potwierdz adres email - KalkMate",
    html: verificationEmail({
      verifyUrl,
      expiresHours: VERIFY_EXPIRY_HOURS,
      customerName: name || undefined,
    }),
  });
  if (!r.ok) console.error("[register] verification mail send failed:", r.error);
}

export async function POST(req: NextRequest) {
  try {
    const { email: rawEmail, password, name } = await req.json();
    const email = String(rawEmail || "").trim().toLowerCase();

    if (!email || !password) {
      return NextResponse.json({ error: "Email i hasło są wymagane" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Hasło musi mieć minimum 6 znaków" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser && existingUser.password) {
      return NextResponse.json(
        { error: "Użytkownik z tym adresem email już istnieje. Zaloguj się." },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let user;

    if (existingUser && !existingUser.password) {
      // Stare konto bez hasla — dolaczamy haslo, kasujemy emailVerified zeby zweryfikowal
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: { password: hashedPassword, name: name || existingUser.name, emailVerified: null },
      });

      const existingSubscription = await prisma.subscription.findUnique({ where: { userId: user.id } });
      if (!existingSubscription) {
        const existingOrder = await prisma.order.findFirst({ where: { customerEmail: email, status: "paid" } });
        const trialDays = existingOrder ? 30 : 1;
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);
        await prisma.subscription.create({
          data: { id: require("crypto").randomUUID(), userId: user.id, status: "trial", trialEndsAt, trialDays, updatedAt: new Date() },
        });
      }
    } else {
      // Nowy user — emailVerified NULL
      const existingOrder = await prisma.order.findFirst({
        where: { customerEmail: email, status: "paid" },
      });

      user = await prisma.user.create({
        data: { email, password: hashedPassword, name: name || null },
      });

      if (existingOrder) {
        await prisma.order.update({ where: { id: existingOrder.id }, data: { userId: user.id } });
      }

      const trialDays = existingOrder ? 30 : 1;
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);
      await prisma.subscription.create({
        data: { id: require("crypto").randomUUID(), userId: user.id, status: "trial", trialEndsAt, trialDays, updatedAt: new Date() },
      });
    }

    // Wyslij mail weryfikacyjny
    await sendVerification(email, name || user.name, user.id);

    return NextResponse.json(
      {
        success: true,
        needsVerification: true,
        message: "Konto utworzone. Sprawdz skrzynke i potwierdz email.",
        userId: user.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Wystąpił błąd podczas rejestracji" }, { status: 500 });
  }
}
