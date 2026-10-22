import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendMail } from "@/lib/mailer";
import {
  verificationEmail,
  accountExistsEmail,
  detectLocale,
  EMAIL_SUBJECTS,
  type EmailLocale,
} from "@/lib/email-templates";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { SIGNUP_TOKENS } from "@/lib/tokenGrants";
import { giveConsent, rememberUserLanguage } from "@/lib/newsletter";
import { newMailToken } from "@/lib/linkTokens";
import {
  EMAIL_RE,
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  normalizeEmail,
  purgeExpiredAuthTokens,
} from "@/lib/auth";

const VERIFY_EXPIRY_HOURS = 24;

// Ta sama odpowiedz dla nowego i ISTNIEJACEGO adresu — rejestracja nie moze
// zdradzac, czy konto istnieje (ani niczego w nim zmieniac).
const NEUTRAL_RESPONSE = {
  success: true,
  needsVerification: true,
  message: "Konto utworzone. Sprawdz skrzynke i potwierdz email.",
};

async function createVerification(userId: string): Promise<string> {
  // W bazie tylko sha256(token) — patrz lib/linkTokens.ts.
  const { token, hash, id } = newMailToken("evr");
  const expiresAt = new Date(Date.now() + VERIFY_EXPIRY_HOURS * 60 * 60 * 1000);
  // Cancel old non-verified tokens for this user
  await prisma.$executeRaw`
    DELETE FROM "EmailVerification"
    WHERE "userId" = ${userId} AND "verifiedAt" IS NULL AND "targetEmail" IS NULL
  `;
  await prisma.$executeRaw`
    INSERT INTO "EmailVerification" ("id", "userId", "token", "expiresAt")
    VALUES (${id}, ${userId}, ${hash}, ${expiresAt.toISOString()})
  `;
  return token;
}

async function sendVerification(email: string, name: string | null, userId: string, locale: EmailLocale) {
  const token = await createVerification(userId);
  const baseUrl = process.env.NEXTAUTH_URL || "https://kalkmate.pl";
  const verifyUrl = `${baseUrl}/auth/verify?token=${token}`;
  const r = await sendMail({
    to: email,
    subject: EMAIL_SUBJECTS.verify[locale],
    html: verificationEmail({
      verifyUrl,
      expiresHours: VERIFY_EXPIRY_HOURS,
      customerName: name || undefined,
    }, locale),
  });
  if (!r.ok) console.error("[register] verification mail send failed:", r.error);
}

// Ktos rejestruje sie na adres, ktory juz ma konto: NIE zmieniamy konta
// (audyt 2026-10-16 — wczesniej ustawialo to haslo napastnika na koncie
// Google ofiary i zerowalo saldo tokenow), tylko informujemy wlasciciela.
async function sendAccountExistsNotice(email: string, locale: EmailLocale) {
  // Bez bombardowania skrzynki: max 3 takie maile na adres na godzine.
  if (!rateLimit(`register-exists:${email}`, 3, 60 * 60_000).ok) return;
  const baseUrl = process.env.NEXTAUTH_URL || "https://kalkmate.pl";
  const r = await sendMail({
    to: email,
    subject: EMAIL_SUBJECTS.accountExists[locale],
    html: accountExistsEmail({
      signinUrl: `${baseUrl}/auth/signin`,
      forgotUrl: `${baseUrl}/auth/forgot-password`,
    }, locale),
  });
  if (!r.ok) console.error("[register] account-exists mail send failed:", r.error);
}

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimit(`register:${clientIp(req)}`, 5, 15 * 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Za dużo prób rejestracji. Spróbuj za ${Math.ceil(rl.resetMs / 60000)} min.` },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const rawEmail = body?.email;
    const password = body?.password;
    const rawName = body?.name;
    const marketingConsent = body?.marketingConsent;

    if (typeof rawEmail !== "string" || typeof password !== "string" || !rawEmail.trim() || !password) {
      return NextResponse.json({ error: "Email i hasło są wymagane" }, { status: 400 });
    }
    if (rawName !== undefined && rawName !== null && typeof rawName !== "string") {
      return NextResponse.json({ error: "Nieprawidłowe imię" }, { status: 400 });
    }
    const email = normalizeEmail(rawEmail);
    if (email.length > EMAIL_MAX_LENGTH || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Nieprawidłowy adres email" }, { status: 400 });
    }
    const name = (rawName || "").trim();
    if (name.length > NAME_MAX_LENGTH) {
      return NextResponse.json({ error: `Imię może mieć maksymalnie ${NAME_MAX_LENGTH} znaków` }, { status: 400 });
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      return NextResponse.json({ error: `Hasło musi mieć minimum ${PASSWORD_MIN_LENGTH} znaków` }, { status: 400 });
    }
    if (password.length > PASSWORD_MAX_LENGTH) {
      return NextResponse.json({ error: `Hasło może mieć maksymalnie ${PASSWORD_MAX_LENGTH} znaków` }, { status: 400 });
    }

    const locale = detectLocale(req.headers.get("accept-language"));
    void purgeExpiredAuthTokens().catch(() => {});

    // Hash liczymy zawsze (takze dla istniejacego adresu) — czas odpowiedzi
    // nie zdradza, czy konto istnieje.
    const hashedPassword = await bcrypt.hash(password, 10);

    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) {
      // Mail w tle — nie czekamy na SMTP (inaczej czas odpowiedzi rozni sie).
      void sendAccountExistsNotice(email, locale).catch((e) => console.error("[register] notice failed:", e));
      return NextResponse.json(NEUTRAL_RESPONSE, { status: 201 });
    }

    // Nowy user — emailVerified NULL
    const existingOrder = await prisma.order.findFirst({
      where: { customerEmail: email, status: "paid" },
    });

    let user;
    try {
      user = await prisma.user.create({
        data: { email, password: hashedPassword, name: name || null },
      });
    } catch (e: any) {
      // Rownolegla rejestracja na ten sam adres — traktuj jak istniejace konto.
      if (e?.code === "P2002") {
        void sendAccountExistsNotice(email, locale).catch(() => {});
        return NextResponse.json(NEUTRAL_RESPONSE, { status: 201 });
      }
      throw e;
    }

    if (existingOrder) {
      await prisma.order.update({ where: { id: existingOrder.id }, data: { userId: user.id } });
    }

    // Model tokenowy (2026-10): bez rekordu Subscription/trialu — tylko saldo
    // startowe SIGNUP_TOKENS. TYLKO dla nowo utworzonego konta (wczesniej
    // wykonywalo sie tez dla istniejacych kont i nadpisywalo oplacone saldo).
    await prisma.$executeRaw`UPDATE "User" SET "tokenBalance" = ${SIGNUP_TOKENS} WHERE "id" = ${user.id}`;

    // Checkbox "chce dostawac newsletter" (domyslnie odznaczony). Blad zapisu
    // zgody nie moze blokowac rejestracji.
    if (marketingConsent === true) {
      await giveConsent(email, "register", clientIp(req)).catch((e) => console.error("[register] consent save failed:", e));
    }
    // Jezyk newslettera dla kont bez zamowien (lib/newsletter.ts).
    await rememberUserLanguage(email, req.headers.get("accept-language")).catch(() => {});

    // Wyslij mail weryfikacyjny (w tle — jak dla istniejacego adresu).
    void sendVerification(email, name || null, user.id, locale).catch((e) =>
      console.error("[register] verification failed:", e)
    );

    return NextResponse.json(NEUTRAL_RESPONSE, { status: 201 });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Wystąpił błąd podczas rejestracji" }, { status: 500 });
  }
}
