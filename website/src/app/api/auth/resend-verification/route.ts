import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { verificationEmail, detectLocale, EMAIL_SUBJECTS, type EmailLocale } from "@/lib/email-templates";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { newMailToken } from "@/lib/linkTokens";
import { normalizeEmail, purgeExpiredAuthTokens } from "@/lib/auth";

const VERIFY_EXPIRY_HOURS = 24;

const OK_RESPONSE = { ok: true, message: "Jesli konto wymaga weryfikacji, wyslalismy nowy link." };

// W tle — odpowiedz nie zalezy (czasowo) od tego, czy konto istnieje.
async function resendInBackground(email: string, locale: EmailLocale): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerified) return;

  const { token, hash, id } = newMailToken("evr");
  const expiresAt = new Date(Date.now() + VERIFY_EXPIRY_HOURS * 60 * 60 * 1000);
  await prisma.$executeRaw`
    DELETE FROM "EmailVerification"
    WHERE "userId" = ${user.id} AND "verifiedAt" IS NULL AND "targetEmail" IS NULL
  `;
  await prisma.$executeRaw`
    INSERT INTO "EmailVerification" ("id","userId","token","expiresAt")
    VALUES (${id}, ${user.id}, ${hash}, ${expiresAt.toISOString()})
  `;
  const baseUrl = process.env.NEXTAUTH_URL || "https://kalkmate.pl";
  const verifyUrl = `${baseUrl}/auth/verify?token=${token}`;
  const r = await sendMail({
    to: email,
    subject: EMAIL_SUBJECTS.verify[locale],
    html: verificationEmail({ verifyUrl, expiresHours: VERIFY_EXPIRY_HOURS, customerName: user.name || undefined }, locale),
  });
  if (!r.ok) console.error("[resend-verification] mail send failed:", r.error);
}

export async function POST(req: NextRequest) {
  try {
    // Audyt 2026-10-16: wczesniej brak limitu — dowolny adres dalo sie
    // zasypac mailami z naszej domeny.
    const rlIp = rateLimit(`resend-verif-ip:${clientIp(req)}`, 5, 60 * 60_000);
    if (!rlIp.ok) {
      return NextResponse.json(
        { ok: false, error: `Za dużo prób. Spróbuj za ${Math.ceil(rlIp.resetMs / 60000)} min.` },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const email = normalizeEmail(body?.email);
    if (!email) return NextResponse.json({ ok: false, error: "Brak email" }, { status: 400 });

    // Per adres: odstep min. 60 s i max 3 na godzine. Odpowiedz bez zmian
    // (nie zdradza, czy konto istnieje) — po prostu nic nie wysylamy.
    const cooldown = rateLimit(`resend-verif-cd:${email}`, 1, 60_000);
    const hourly = cooldown.ok ? rateLimit(`resend-verif-email:${email}`, 3, 60 * 60_000) : cooldown;
    if (cooldown.ok && hourly.ok) {
      const locale = detectLocale(req.headers.get("accept-language"));
      void resendInBackground(email, locale).catch((e) => console.error("[resend-verification] background:", e));
    }
    void purgeExpiredAuthTokens().catch(() => {});

    return NextResponse.json(OK_RESPONSE);
  } catch (e) {
    console.error("[resend-verification]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
