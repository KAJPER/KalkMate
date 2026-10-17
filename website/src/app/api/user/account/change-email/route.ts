import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions, EMAIL_MAX_LENGTH, EMAIL_RE, normalizeEmail } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { sendMail } from "@/lib/mailer";
import {
  emailChangeConfirmEmail,
  emailChangeNoticeEmail,
  detectLocale,
  EMAIL_SUBJECTS,
} from "@/lib/email-templates";
import { rateLimit } from "@/lib/rate-limit";
import { newMailToken } from "@/lib/linkTokens";

const EXPIRY_HOURS = 24;

async function getUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return await prisma.user.findUnique({ where: { email: session.user.email } });
}

// "jan.kowalski@gmail.com" -> "j***@gmail.com" (powiadomienie na stary adres
// nie powinno ujawniac pelnego nowego adresu, gdyby skrzynke czytal ktos inny).
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}

// POST /api/user/account/change-email { newEmail, password }
// M8: Zamiast natychmiastowej zmiany emaila, wysyłamy token weryfikacyjny
// na NOWY adres. Email zostaje zmieniony dopiero po kliknięciu linku.
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });

  // Limit per konto (zgadywanie hasla z przejetej sesji / spam na cudze adresy).
  const rl = rateLimit(`change-email:${user.id}`, 5, 60 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: `Za dużo prób. Spróbuj za ${Math.ceil(rl.resetMs / 60000)} min.` },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const newEmail = normalizeEmail(body?.newEmail);
  const password = typeof body?.password === "string" ? body.password : "";

  if (newEmail.length > EMAIL_MAX_LENGTH || !EMAIL_RE.test(newEmail)) {
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
  // W bazie tylko sha256(token) — patrz lib/linkTokens.ts.
  const { token, hash, id } = newMailToken("ecr");
  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.$executeRaw`
    DELETE FROM "EmailVerification"
    WHERE "userId" = ${user.id} AND "verifiedAt" IS NULL AND "targetEmail" IS NOT NULL
  `;
  await prisma.$executeRaw`
    INSERT INTO "EmailVerification" ("id", "userId", "token", "expiresAt", "targetEmail")
    VALUES (${id}, ${user.id}, ${hash}, ${expiresAt.toISOString()}, ${newEmail})
  `;

  const baseUrl = process.env.NEXTAUTH_URL || "https://kalkmate.pl";
  const verifyUrl = `${baseUrl}/auth/verify?token=${token}`;
  const locale = detectLocale(req.headers.get("accept-language"));
  const customerName = user.name || undefined;

  const sent = await sendMail({
    to: newEmail,
    subject: EMAIL_SUBJECTS.emailChange[locale],
    html: emailChangeConfirmEmail({ verifyUrl, expiresHours: EXPIRY_HOURS, newEmail, customerName }, locale),
  });
  if (!sent.ok) {
    console.error("[change-email] confirm mail send failed:", sent.error);
    return NextResponse.json(
      { ok: false, error: "Nie udało się wysłać maila na nowy adres. Spróbuj ponownie później." },
      { status: 502 }
    );
  }

  // Powiadomienie na STARY adres — wlasciciel konta dowiaduje sie o probie
  // zmiany, nawet jesli to nie on (np. przejeta sesja). W tle.
  void sendMail({
    to: user.email,
    subject: EMAIL_SUBJECTS.emailChangeNotice[locale],
    html: emailChangeNoticeEmail({ newEmailMasked: maskEmail(newEmail), customerName }, locale),
  }).then((r) => {
    if (!r.ok) console.error("[change-email] notice to old address failed:", r.error);
  });

  // Adres NIE jest jeszcze zmieniony — zmiana nastapi po kliknieciu linku.
  return NextResponse.json({
    ok: true,
    verificationSent: true,
    pendingVerification: true,
    message: "Wyslalismy link na nowy adres. Adres zmieni sie dopiero po jego kliknieciu.",
  });
}
