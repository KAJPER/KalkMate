import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { passwordResetEmail } from "@/lib/email-templates";
import crypto from "crypto";

const EXPIRY_MINUTES = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ ok: false, error: "Wpisz email" }, { status: 400 });
    }

    // Nie ujawniaj czy konto istnieje (zabezpieczenie przed enumeration).
    // Zawsze zwracamy ok=true, ale wysylamy maila tylko gdy user istnieje.
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      // Generuj losowy token 32 bajty -> 64 hex chars
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);
      const id = `pwr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      // Skasuj stare niewygasle resety dla tego usera (raw SQL bo tabela nie w Prisma schema)
      await prisma.$executeRaw`
        DELETE FROM "PasswordReset"
        WHERE "userId" = ${user.id} AND "usedAt" IS NULL
      `;

      await prisma.$executeRaw`
        INSERT INTO "PasswordReset" ("id", "userId", "token", "expiresAt")
        VALUES (${id}, ${user.id}, ${token}, ${expiresAt.toISOString()})
      `;

      const baseUrl = process.env.NEXTAUTH_URL || "https://kalkmate.pl";
      const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;

      const r = await sendMail({
        to: email,
        subject: "Reset hasla - KalkMate",
        html: passwordResetEmail({ resetUrl, expiresMinutes: EXPIRY_MINUTES }),
      });
      if (!r.ok) {
        console.error("[forgot-password] mail send failed:", r.error);
        // Nie ujawniaj bledu, ale loguj
      }
    } else {
      // Symuluj opoznienie zeby nie roznicowac czasu odpowiedzi
      await new Promise((res) => setTimeout(res, 250));
    }

    return NextResponse.json({
      ok: true,
      message: "Jesli konto istnieje, wyslalismy link do resetu hasla.",
    });
  } catch (e) {
    console.error("[forgot-password]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
