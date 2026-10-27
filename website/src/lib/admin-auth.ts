import * as OTPAuth from "otpauth";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ADMIN_COOKIE_NAME, buildAdminCookie, randomSessionId, verifyAdminCookie } from "@/lib/admin-session";
import { sendMail, CONTACT_EMAIL } from "@/lib/mailer";
import { adminLockoutAlertEmail } from "@/lib/email-templates";
import { getModerator, ensureModeratorTable, type Moderator } from "@/lib/admin-moderators";
import { moderatorApiAllowed } from "@/lib/admin-permissions";

export const COOKIE_NAME = ADMIN_COOKIE_NAME;
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
  // moderatorId: NULL = wlasciciel, inaczej AdminModerator.id (lib/admin-moderators.ts).
  const cols = await prisma.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("AdminSession")`);
  if (!cols.some((c) => c.name === "moderatorId")) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "AdminSession" ADD COLUMN "moderatorId" TEXT`);
  }
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
  moderatorId: string | null;
  moderatorUsername: string | null;
}

// Tworzy nowa sesje po poprawnym TOTP. Zwraca gotowa wartosc cookie.
export async function createAdminSession(userAgent: string | null, ip: string | null, moderatorId: string | null = null): Promise<{ cookie: string; sessionId: string }> {
  const secret = process.env.ADMIN_SESSION_TOKEN;
  if (!secret) throw new Error("ADMIN_SESSION_TOKEN not configured");
  await ensureAdminSessionTable();
  const sessionId = randomSessionId();
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  await prisma.$executeRaw`
    INSERT INTO "AdminSession" ("id", "expiresAt", "lastUsedAt", "userAgent", "ip", "moderatorId")
    VALUES (${sessionId}, ${new Date(exp * 1000).toISOString()}, ${new Date().toISOString()},
            ${(userAgent || "").slice(0, 300)}, ${(ip || "").slice(0, 64)}, ${moderatorId})
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

// Wylogowanie moderatora wszedzie (usuniecie konta / nowy kod 2FA).
export async function revokeModeratorSessions(moderatorId: string): Promise<number> {
  await ensureAdminSessionTable();
  return prisma.$executeRaw`
    UPDATE "AdminSession" SET "revokedAt" = ${new Date().toISOString()}
    WHERE "revokedAt" IS NULL AND "moderatorId" = ${moderatorId}
  `;
}

export async function listAdminSessions(): Promise<AdminSessionRow[]> {
  await ensureAdminSessionTable();
  await ensureModeratorTable();
  return prisma.$queryRaw<AdminSessionRow[]>`
    SELECT s."id", s."createdAt", s."expiresAt", s."lastUsedAt", s."userAgent", s."ip", s."revokedAt",
           s."moderatorId", m."username" AS "moderatorUsername"
    FROM "AdminSession" s LEFT JOIN "AdminModerator" m ON m."id" = s."moderatorId"
    ORDER BY s."createdAt" DESC LIMIT 50
  `;
}

// Wyciaga id sesji z cookie (po weryfikacji podpisu), np. do wylogowania.
export async function currentAdminSessionId(request: NextRequest): Promise<string | null> {
  const parsed = await verifyAdminCookie(request.cookies.get(COOKIE_NAME)?.value, process.env.ADMIN_SESSION_TOKEN);
  return parsed?.sessionId ?? null;
}

// Kto jest zalogowany: wlasciciel (moderator = null) albo moderator.
// null = brak waznej sesji (zly podpis, odwolana, wygasla, usuniety moderator).
export interface AdminIdentity {
  sessionId: string;
  moderator: Moderator | null;
}

const TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const _lastTouch = new Map<string, number>();

export async function getAdminIdentity(request: NextRequest): Promise<AdminIdentity | null> {
  const parsed = await verifyAdminCookie(request.cookies.get(COOKIE_NAME)?.value, process.env.ADMIN_SESSION_TOKEN);
  if (!parsed) return null;

  await ensureAdminSessionTable();
  const rows = await prisma.$queryRaw<{ revokedAt: string | null; expiresAt: string; moderatorId: string | null }[]>`
    SELECT "revokedAt", "expiresAt", "moderatorId" FROM "AdminSession" WHERE "id" = ${parsed.sessionId} LIMIT 1
  `;
  const row = rows[0];
  if (!row || row.revokedAt) return null;
  if (new Date(row.expiresAt).getTime() < Date.now()) return null;

  let moderator: Moderator | null = null;
  if (row.moderatorId) {
    moderator = await getModerator(row.moderatorId);
    if (!moderator) return null; // konto usuniete
  }

  // lastUsedAt — max raz na 5 min per sesja, zeby nie pisac do SQLite przy kazdym zadaniu
  const last = _lastTouch.get(parsed.sessionId) ?? 0;
  if (Date.now() - last > TOUCH_INTERVAL_MS) {
    _lastTouch.set(parsed.sessionId, Date.now());
    prisma.$executeRaw`UPDATE "AdminSession" SET "lastUsedAt" = ${new Date().toISOString()} WHERE "id" = ${parsed.sessionId}`
      .catch(() => { /* nieistotne */ });
  }
  return { sessionId: parsed.sessionId, moderator };
}

// Defense-in-depth: kazdy admin route wywoluje to jako pierwsza linie,
// niezaleznie od middleware (ktore sprawdza tylko podpis + date, bez bazy):
//   const authErr = await requireAdminAuth(request); if (authErr) return authErr;
// Tu dodatkowo: sesja istnieje w bazie, nie jest odwolana, nie wygasla, a
// moderator ma uprawnienie do sekcji tej sciezki API (lib/admin-permissions.ts).
export async function requireAdminAuth(request: NextRequest): Promise<NextResponse | null> {
  const identity = await getAdminIdentity(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (identity.moderator && !moderatorApiAllowed(request.nextUrl.pathname, request.method, identity.moderator.permissions)) {
    return NextResponse.json({ error: "Brak dostępu do tej sekcji" }, { status: 403 });
  }
  return null; // OK
}

// Tylko wlasciciel (zarzadzanie moderatorami, lista sesji, "wyloguj wszystkich").
export async function requireOwnerAuth(request: NextRequest): Promise<NextResponse | null> {
  const identity = await getAdminIdentity(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (identity.moderator) return NextResponse.json({ error: "Tylko dla właściciela panelu" }, { status: 403 });
  return null;
}

// ---------------------------------------------------------------------------
// TOTP
// ---------------------------------------------------------------------------
// Zwraca numer kroku TOTP (counter), do ktorego pasuje kod, albo null.
// Numer kroku sluzy do ochrony przed ponownym uzyciem kodu (consumeTOTPCounter).
export function matchTOTPCounter(rawToken: string, timestamp = Date.now()): number | null {
  const secret = process.env.ADMIN_2FA_SECRET;
  if (!secret) {
    console.error("ADMIN_2FA_SECRET is not configured");
    return null;
  }
  return matchTOTPCounterForSecret(secret, rawToken, timestamp);
}

// To samo dla dowolnego sekretu (moderatorzy — lib/admin-moderators.ts).
export function matchTOTPCounterForSecret(secret: string, rawToken: string, timestamp = Date.now()): number | null {
  const token = String(rawToken ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(token)) return null;

  try {
    const totp = new OTPAuth.TOTP({
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    const delta = totp.validate({ token, timestamp, window: 1 });
    if (delta === null) return null;
    return totp.counter({ timestamp }) + delta;
  } catch (err) {
    console.error("TOTP validation error", err);
    return null;
  }
}

export function validateTOTP(token: string): boolean {
  return matchTOTPCounter(token) !== null;
}

// ---------------------------------------------------------------------------
// Ochrona logowania admina (audyt 2026-10-16)
// ---------------------------------------------------------------------------
// - globalna blokada: LOGIN_FAIL_MAX nieudanych prob w LOGIN_FAIL_WINDOW_MS
//   z DOWOLNYCH adresow -> logowanie zablokowane na LOGIN_LOCK_MS + mail do
//   admina (limit per IP nie chronil przed proba z wielu adresow: 6-cyfrowy
//   kod = 10^6 mozliwosci, okno 90 s);
// - kod TOTP jednorazowy: zapamietujemy ostatni uzyty krok — przechwycony
//   (np. podejrzany przez ramie, keylogger) kod nie zadziala drugi raz;
// - opcjonalnie drugi skladnik: ADMIN_PASSWORD_HASH (bcrypt). Bez tej zmiennej
//   logowanie dziala jak dotad (sam TOTP), zeby nie zablokowac wlasciciela.
// Stan w tabelach poza Prisma (tworzone leniwie), przezywa restart procesu.

const LOGIN_FAIL_WINDOW_MS = 15 * 60_000;
const LOGIN_FAIL_MAX = 10;
const LOGIN_LOCK_MS = 15 * 60_000;

let _authTablesReady = false;
async function ensureAdminAuthTables(): Promise<void> {
  if (_authTablesReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AdminAuthState" (
      "key"       TEXT PRIMARY KEY,
      "value"     TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AdminLoginFailure" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "at" INTEGER NOT NULL,
      "ip" TEXT
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AdminLoginFailure_at_idx" ON "AdminLoginFailure"("at")`);
  _authTablesReady = true;
}

async function getAuthState(key: string): Promise<string | null> {
  await ensureAdminAuthTables();
  const rows = await prisma.$queryRaw<{ value: string }[]>`SELECT "value" FROM "AdminAuthState" WHERE "key" = ${key} LIMIT 1`;
  return rows[0]?.value ?? null;
}

async function setAuthState(key: string, value: string): Promise<void> {
  await ensureAdminAuthTables();
  const now = new Date().toISOString();
  await prisma.$executeRaw`
    INSERT INTO "AdminAuthState" ("key", "value", "updatedAt") VALUES (${key}, ${value}, ${now})
    ON CONFLICT("key") DO UPDATE SET "value" = excluded."value", "updatedAt" = excluded."updatedAt"
  `;
}

// Zwraca timestamp (ms) konca blokady albo 0, gdy logowanie jest odblokowane.
export async function adminLoginLockedUntil(): Promise<number> {
  const v = Number(await getAuthState("loginLockedUntil"));
  return Number.isFinite(v) && v > Date.now() ? v : 0;
}

export async function recordAdminLoginFailure(ip: string): Promise<{ locked: boolean }> {
  await ensureAdminAuthTables();
  const now = Date.now();
  const since = now - LOGIN_FAIL_WINDOW_MS;
  await prisma.$executeRaw`INSERT INTO "AdminLoginFailure" ("at", "ip") VALUES (${now}, ${(ip || "").slice(0, 64)})`;
  await prisma.$executeRaw`DELETE FROM "AdminLoginFailure" WHERE "at" < ${now - 24 * 60 * 60_000}`;
  const rows = await prisma.$queryRaw<{ n: number | bigint }[]>`
    SELECT COUNT(*) AS n FROM "AdminLoginFailure" WHERE "at" >= ${since}
  `;
  const failures = Number(rows[0]?.n ?? 0);
  if (failures < LOGIN_FAIL_MAX) return { locked: false };
  if (await adminLoginLockedUntil()) return { locked: true };

  await setAuthState("loginLockedUntil", String(now + LOGIN_LOCK_MS));
  const ipRows = await prisma.$queryRaw<{ ip: string | null }[]>`
    SELECT DISTINCT "ip" FROM "AdminLoginFailure" WHERE "at" >= ${since}
  `;
  // Po blokadzie liczymy od zera — kolejna seria = kolejna blokada i alert.
  await prisma.$executeRaw`DELETE FROM "AdminLoginFailure" WHERE "at" >= ${since}`;
  console.warn(`[admin-auth] login lockout: ${failures} failed attempts in ${LOGIN_FAIL_WINDOW_MS / 60_000} min`);

  void sendMail({
    to: process.env.ADMIN_ALERT_EMAIL || CONTACT_EMAIL,
    subject: "[KalkMate] Blokada logowania do panelu admina",
    html: adminLockoutAlertEmail({
      failures,
      windowMinutes: LOGIN_FAIL_WINDOW_MS / 60_000,
      lockMinutes: LOGIN_LOCK_MS / 60_000,
      ips: ipRows.map((r) => r.ip || "?"),
      at: new Date(now).toISOString(),
    }),
  }).then((r) => {
    if (!r.ok) console.error("[admin-auth] lockout alert mail failed:", r.error);
  });
  return { locked: true };
}

// Zuzywa krok TOTP. false = ten kod (albo nowszy) byl juz uzyty -> odrzuc.
export async function consumeTOTPCounter(counter: number): Promise<boolean> {
  await ensureAdminAuthTables();
  const now = new Date().toISOString();
  await prisma.$executeRaw`
    INSERT OR IGNORE INTO "AdminAuthState" ("key", "value", "updatedAt") VALUES ('totpLastCounter', '0', ${now})
  `;
  const updated = await prisma.$executeRaw`
    UPDATE "AdminAuthState" SET "value" = ${String(counter)}, "updatedAt" = ${now}
    WHERE "key" = 'totpLastCounter' AND CAST("value" AS INTEGER) < ${counter}
  `;
  return updated === 1;
}

// ADMIN_PASSWORD_HASH: hash bcrypt ("$2a$10$...") albo ten sam hash w base64 —
// UWAGA: Next.js rozwija "$..." w plikach .env, wiec surowy hash trzeba wpisac
// z "\$" albo (prosciej) jako base64 calego hasha. Ustawiac dopiero, gdy
// formularz /admin/login (i aplikacja desktopowa) wysyla pole `password`.
let _warnedBadHash = false;
function adminPasswordHash(): string | null {
  const raw = (process.env.ADMIN_PASSWORD_HASH || "").trim();
  if (!raw) return null;
  const isBcrypt = (s: string) => /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(s);
  if (isBcrypt(raw)) return raw;
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8").trim();
    if (isBcrypt(decoded)) return decoded;
  } catch {}
  if (!_warnedBadHash) {
    _warnedBadHash = true;
    // Bledna wartosc NIE blokuje logowania (zostaje sam TOTP) — inaczej
    // literowka w .env odcinalaby wlasciciela od panelu.
    console.error("[admin-auth] ADMIN_PASSWORD_HASH ustawione, ale to nie jest poprawny hash bcrypt — haslo NIE jest wymagane");
  }
  return null;
}

export function adminPasswordRequired(): boolean {
  return adminPasswordHash() !== null;
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const hash = adminPasswordHash();
  if (!hash) return true;
  if (!password) return false;
  try {
    return await bcrypt.compare(password.slice(0, 200), hash);
  } catch {
    return false;
  }
}
