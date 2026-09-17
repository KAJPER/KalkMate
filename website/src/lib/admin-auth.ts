import * as OTPAuth from "otpauth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildAdminCookie, randomSessionId, verifyAdminCookie } from "@/lib/admin-session";

export const COOKIE_NAME = "admin_session";
// 180 dni — aplikacja desktopowa (tools/kalkmate-admin-desktop) ma pamietac
// logowanie miesiacami. Bezpieczne, bo cookie to losowy, podpisany id sesji
// (nie sekret), odwolywalny pojedynczo — patrz admin-session.ts.
export const MAX_AGE = 60 * 60 * 24 * 180;

// === Tabela sesji (raw SQL poza Prisma, jak Device.rentalUntil itd.) ===
let _tableReady = false;
async function ensureAdminSessionTable(): Promise<void> {
  if (_tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AdminSession" (
      "id"         TEXT PRIMARY KEY,
      "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expiresAt"  DATETIME NOT NULL,
      "lastUsedAt" DATETIME,
      "userAgent"  TEXT,
      "ip"         TEXT,
      "revokedAt"  DATETIME
    )
  `);
  _tableReady = true;
}

export interface AdminSessionRow {
  id: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  userAgent: string | null;
  ip: string | null;
  revokedAt: string | null;
}

// Tworzy nowa sesje po poprawnym TOTP. Zwraca gotowa wartosc cookie.
export async function createAdminSession(userAgent: string | null, ip: string | null): Promise<{ cookie: string; sessionId: string }> {
  const secret = process.env.ADMIN_SESSION_TOKEN;
  if (!secret) throw new Error("ADMIN_SESSION_TOKEN not configured");
  await ensureAdminSessionTable();
  const sessionId = randomSessionId();
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  await prisma.$executeRaw`
    INSERT INTO "AdminSession" ("id", "expiresAt", "lastUsedAt", "userAgent", "ip")
    VALUES (${sessionId}, ${new Date(exp * 1000).toISOString()}, ${new Date().toISOString()},
            ${(userAgent || "").slice(0, 300)}, ${(ip || "").slice(0, 64)})
  `;
  const cookie = await buildAdminCookie(sessionId, exp, secret);
  return { cookie, sessionId };
}

export async function revokeAdminSession(sessionId: string): Promise<void> {
  await ensureAdminSessionTable();
  await prisma.$executeRaw`
    UPDATE "AdminSession" SET "revokedAt" = ${new Date().toISOString()}
    WHERE "id" = ${sessionId} AND "revokedAt" IS NULL
  `;
}

export async function revokeAllAdminSessions(exceptId?: string): Promise<number> {
  await ensureAdminSessionTable();
  const now = new Date().toISOString();
  if (exceptId) {
    return prisma.$executeRaw`
      UPDATE "AdminSession" SET "revokedAt" = ${now} WHERE "revokedAt" IS NULL AND "id" != ${exceptId}
    `;
  }
  return prisma.$executeRaw`UPDATE "AdminSession" SET "revokedAt" = ${now} WHERE "revokedAt" IS NULL`;
}

export async function listAdminSessions(): Promise<AdminSessionRow[]> {
  await ensureAdminSessionTable();
  return prisma.$queryRaw<AdminSessionRow[]>`
    SELECT "id", "createdAt", "expiresAt", "lastUsedAt", "userAgent", "ip", "revokedAt"
    FROM "AdminSession" ORDER BY "createdAt" DESC LIMIT 50
  `;
}

// Wyciaga id sesji z cookie (po weryfikacji podpisu), np. do wylogowania.
export async function currentAdminSessionId(request: NextRequest): Promise<string | null> {
  const parsed = await verifyAdminCookie(request.cookies.get(COOKIE_NAME)?.value, process.env.ADMIN_SESSION_TOKEN);
  return parsed?.sessionId ?? null;
}

// Defense-in-depth: kazdy admin route wywoluje to jako pierwsza linie,
// niezaleznie od middleware (ktore sprawdza tylko podpis + date, bez bazy):
//   const authErr = await requireAdminAuth(request); if (authErr) return authErr;
// Tu dodatkowo: sesja istnieje w bazie, nie jest odwolana, nie wygasla.
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const _lastTouch = new Map<string, number>();

export async function requireAdminAuth(request: NextRequest): Promise<NextResponse | null> {
  const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = await verifyAdminCookie(request.cookies.get(COOKIE_NAME)?.value, process.env.ADMIN_SESSION_TOKEN);
  if (!parsed) return unauthorized();

  await ensureAdminSessionTable();
  const rows = await prisma.$queryRaw<{ revokedAt: string | null; expiresAt: string }[]>`
    SELECT "revokedAt", "expiresAt" FROM "AdminSession" WHERE "id" = ${parsed.sessionId} LIMIT 1
  `;
  const row = rows[0];
  if (!row || row.revokedAt) return unauthorized();
  if (new Date(row.expiresAt).getTime() < Date.now()) return unauthorized();

  // lastUsedAt — max raz na 5 min per sesja, zeby nie pisac do SQLite przy kazdym zadaniu
  const last = _lastTouch.get(parsed.sessionId) ?? 0;
  if (Date.now() - last > TOUCH_INTERVAL_MS) {
    _lastTouch.set(parsed.sessionId, Date.now());
    prisma.$executeRaw`UPDATE "AdminSession" SET "lastUsedAt" = ${new Date().toISOString()} WHERE "id" = ${parsed.sessionId}`
      .catch(() => { /* nieistotne */ });
  }
  return null; // OK
}

export function validateTOTP(token: string): boolean {
  const secret = process.env.ADMIN_2FA_SECRET;
  if (!secret) {
    console.error("ADMIN_2FA_SECRET is not configured");
    return false;
  }

  try {
    const totp = new OTPAuth.TOTP({
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    const delta = totp.validate({ token, window: 1 });
    return delta !== null;
  } catch (err) {
    console.error("TOTP validation error", err);
    return false;
  }
}
