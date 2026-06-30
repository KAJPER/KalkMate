import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { verificationEmail, detectLocale, EMAIL_SUBJECTS } from "@/lib/email-templates";
import crypto from "crypto";

const VERIFY_EXPIRY_HOURS = 24;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    if (!email) return NextResponse.json({ ok: false, error: "Brak email" }, { status: 400 });

    // Nie ujawniaj czy konto istnieje
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerified) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + VERIFY_EXPIRY_HOURS * 60 * 60 * 1000);
      const id = `evr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      await prisma.$executeRaw`
        DELETE FROM "EmailVerification" WHERE "userId" = ${user.id} AND "verifiedAt" IS NULL
      `;
      await prisma.$executeRaw`
        INSERT INTO "EmailVerification" ("id","userId","token","expiresAt")
        VALUES (${id}, ${user.id}, ${token}, ${expiresAt.toISOString()})
      `;
      const baseUrl = process.env.NEXTAUTH_URL || "https://kalkmate.pl";
      const verifyUrl = `${baseUrl}/auth/verify?token=${token}`;
      const locale = detectLocale(req.headers.get("accept-language"));
      await sendMail({
        to: email,
        subject: EMAIL_SUBJECTS.verify[locale],
        html: verificationEmail({ verifyUrl, expiresHours: VERIFY_EXPIRY_HOURS, customerName: user.name || undefined }, locale),
      });
    } else {
      // Symuluj opoznienie
      await new Promise((res) => setTimeout(res, 250));
    }

    return NextResponse.json({ ok: true, message: "Jesli konto wymaga weryfikacji, wyslalismy nowy link." });
  } catch (e) {
    console.error("[resend-verification]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
