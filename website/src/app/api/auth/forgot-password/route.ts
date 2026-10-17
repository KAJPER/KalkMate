import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { passwordResetEmail, detectLocale, EMAIL_SUBJECTS, type EmailLocale } from "@/lib/email-templates";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { newMailToken } from "@/lib/linkTokens";
import { normalizeEmail, purgeExpiredAuthTokens } from "@/lib/auth";

const EXPIRY_MINUTES = 60;

// Cala praca (szukanie konta, token, SMTP) idzie W TLE — odpowiedz jest stala
// i przychodzi tak samo szybko niezaleznie od tego, czy konto istnieje
// (wczesniej await na SMTP tylko dla istniejacych kont = enumeracja kont po czasie).
async function sendResetInBackground(email: string, locale: EmailLocale): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return;

  // Generuj losowy token 32 bajty -> 64 hex chars; w bazie tylko sha256 (lib/linkTokens.ts)
  const { token, hash, id } = newMailToken("pwr");
  const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);

  // Skasuj stare niewygasle resety dla tego usera (raw SQL bo tabela nie w Prisma schema)
  await prisma.$executeRaw`
    DELETE FROM "PasswordReset"
    WHERE "userId" = ${user.id} AND "usedAt" IS NULL
  `;

  await prisma.$executeRaw`
    INSERT INTO "PasswordReset" ("id", "userId", "token", "expiresAt")
    VALUES (${id}, ${user.id}, ${hash}, ${expiresAt.toISOString()})
  `;

  const baseUrl = process.env.NEXTAUTH_URL || "https://kalkmate.pl";
  const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;

  const r = await sendMail({
    to: email,
    subject: EMAIL_SUBJECTS.passwordReset[locale],
    html: passwordResetEmail({ resetUrl, expiresMinutes: EXPIRY_MINUTES }, locale),
  });
  if (!r.ok) {
    console.error("[forgot-password] mail send failed:", r.error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimit(`forgot-pw:${clientIp(req)}`, 3, 15 * 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: `Za dużo prób. Spróbuj za ${Math.ceil(rl.resetMs / 60000)} min.` },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const email = normalizeEmail(body?.email);
    if (!email) {
      return NextResponse.json({ ok: false, error: "Wpisz email" }, { status: 400 });
    }

    // Per adres: max 3 maile na godzine (cicho — odpowiedz jest taka sama).
    if (rateLimit(`forgot-pw-email:${email}`, 3, 60 * 60_000).ok) {
      const locale = detectLocale(req.headers.get("accept-language"));
      void sendResetInBackground(email, locale).catch((e) => console.error("[forgot-password] background:", e));
    }
    void purgeExpiredAuthTokens().catch(() => {});

    // Nie ujawniaj czy konto istnieje (zabezpieczenie przed enumeration).
    return NextResponse.json({
      ok: true,
      message: "Jesli konto istnieje, wyslalismy link do resetu hasla.",
    });
  } catch (e) {
    console.error("[forgot-password]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
