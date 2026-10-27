// Moderatorzy panelu admina — konta z dostepem tylko do wybranych sekcji
// (lib/admin-permissions.ts). Zarzadza nimi wlasciciel w /admin/moderators.
// Logowanie: login + kod z Authenticatora (wlasny sekret TOTP kazdego
// moderatora, generowany przy tworzeniu / "Nowy kod 2FA").
// Tabela poza Prisma (raw SQL, tworzona leniwie) — jak AdminSession.

import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { isAdminSection, type AdminSection } from "@/lib/admin-permissions";

let _ready = false;
export async function ensureModeratorTable(): Promise<void> {
  if (_ready) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AdminModerator" (
      "id"              TEXT PRIMARY KEY,
      "username"        TEXT NOT NULL UNIQUE COLLATE NOCASE,
      "totpSecret"      TEXT NOT NULL,
      "totpLastCounter" INTEGER NOT NULL DEFAULT 0,
      "permissions"     TEXT NOT NULL DEFAULT '[]',
      "createdAt"       TEXT NOT NULL,
      "lastLoginAt"     TEXT
    )
  `);
  _ready = true;
}

export interface Moderator {
  id: string;
  username: string;
  permissions: AdminSection[];
  createdAt: string;
  lastLoginAt: string | null;
}

interface ModeratorRow {
  id: string;
  username: string;
  totpSecret: string;
  totpLastCounter: number | bigint;
  permissions: string;
  createdAt: string;
  lastLoginAt: string | null;
}

function parsePermissions(raw: string): AdminSection[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter(isAdminSection) : [];
  } catch {
    return [];
  }
}

function toModerator(r: ModeratorRow): Moderator {
  return { id: r.id, username: r.username, permissions: parsePermissions(r.permissions), createdAt: r.createdAt, lastLoginAt: r.lastLoginAt };
}

export function normalizeUsername(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return /^[a-z0-9._-]{3,32}$/.test(s) ? s : null;
}

export function sanitizePermissions(v: unknown): AdminSection[] {
  return Array.isArray(v) ? [...new Set(v.filter(isAdminSection))] : [];
}

function newTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

// Link do Authenticatora (QR) — label "KalkMate Admin:<login>".
export function moderatorOtpauthUri(username: string, secret: string): string {
  return new OTPAuth.TOTP({
    issuer: "KalkMate Admin",
    label: username,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).toString();
}

// Dane do pokazania wlascicielowi po utworzeniu / resecie: QR + sekret do
// recznego wpisania (gdy nie da sie zeskanowac).
export async function moderatorTotpSetup(username: string, secret: string): Promise<{ secret: string; otpauth: string; qr: string }> {
  const otpauth = moderatorOtpauthUri(username, secret);
  const qr = await QRCode.toDataURL(otpauth, { margin: 1, width: 240, errorCorrectionLevel: "M" });
  return { secret, otpauth, qr };
}

export async function listModerators(): Promise<Moderator[]> {
  await ensureModeratorTable();
  const rows = await prisma.$queryRaw<ModeratorRow[]>`SELECT * FROM "AdminModerator" ORDER BY "createdAt" ASC`;
  return rows.map(toModerator);
}

export async function getModerator(id: string): Promise<Moderator | null> {
  await ensureModeratorTable();
  const rows = await prisma.$queryRaw<ModeratorRow[]>`SELECT * FROM "AdminModerator" WHERE "id" = ${id} LIMIT 1`;
  return rows[0] ? toModerator(rows[0]) : null;
}

// Zwraca moderatora + sekret (tylko raz — do pokazania QR wlascicielowi).
export async function createModerator(username: string, permissions: AdminSection[]): Promise<{ moderator: Moderator; secret: string }> {
  await ensureModeratorTable();
  const id = crypto.randomUUID();
  const secret = newTotpSecret();
  const now = new Date().toISOString();
  await prisma.$executeRaw`
    INSERT INTO "AdminModerator" ("id", "username", "totpSecret", "permissions", "createdAt")
    VALUES (${id}, ${username}, ${secret}, ${JSON.stringify(permissions)}, ${now})
  `;
  return { moderator: { id, username, permissions, createdAt: now, lastLoginAt: null }, secret };
}

export async function updateModeratorPermissions(id: string, permissions: AdminSection[]): Promise<boolean> {
  await ensureModeratorTable();
  const n = await prisma.$executeRaw`UPDATE "AdminModerator" SET "permissions" = ${JSON.stringify(permissions)} WHERE "id" = ${id}`;
  return n === 1;
}

// Nowy sekret TOTP (zgubiony telefon). Stary kod przestaje dzialac od razu.
export async function resetModeratorTotp(id: string): Promise<string | null> {
  await ensureModeratorTable();
  const secret = newTotpSecret();
  const n = await prisma.$executeRaw`
    UPDATE "AdminModerator" SET "totpSecret" = ${secret}, "totpLastCounter" = 0 WHERE "id" = ${id}
  `;
  return n === 1 ? secret : null;
}

export async function deleteModerator(id: string): Promise<boolean> {
  await ensureModeratorTable();
  const n = await prisma.$executeRaw`DELETE FROM "AdminModerator" WHERE "id" = ${id}`;
  return n === 1;
}

// Logowanie: zwraca id moderatora, gdy kod pasuje i nie byl jeszcze uzyty
// (jednorazowosc per moderator — jak consumeTOTPCounter wlasciciela).
// "unknown" = brak takiego loginu albo zly kod (odpowiedz ich nie rozroznia).
export async function verifyModeratorLogin(
  username: string,
  token: string,
  matchCounter: (secret: string, token: string) => number | null
): Promise<{ ok: true; id: string } | { ok: false; reason: "invalid" | "reused" }> {
  await ensureModeratorTable();
  const rows = await prisma.$queryRaw<ModeratorRow[]>`SELECT * FROM "AdminModerator" WHERE "username" = ${username} LIMIT 1`;
  const row = rows[0];
  // Kod sprawdzamy zawsze (takze dla nieistniejacego loginu) — ten sam czas odpowiedzi.
  const counter = matchCounter(row?.totpSecret ?? newTotpSecret(), token);
  if (!row || counter === null) return { ok: false, reason: "invalid" };
  const now = new Date().toISOString();
  const n = await prisma.$executeRaw`
    UPDATE "AdminModerator" SET "totpLastCounter" = ${counter}, "lastLoginAt" = ${now}
    WHERE "id" = ${row.id} AND "totpLastCounter" < ${counter}
  `;
  return n === 1 ? { ok: true, id: row.id } : { ok: false, reason: "reused" };
}
