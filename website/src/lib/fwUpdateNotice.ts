// Kampania "Zaktualizuj kalkulator" — mail serwisowy (nie marketing, bez
// zgody newsletterowej) do wlascicieli urzadzen ze starym firmware.
//
// Tlo: fw 2.1.0 laczy sie przez api.kalkmate.pl; kalkmate.pl pojdzie za
// Cloudflare i starsze firmware straci lacznosc (AI, notatki, OTA).
//
// Przeplyw:
//   1. Admin (/admin/aktualizacje) -> startFwCampaign(): wersja docelowa,
//      termin (deadline), co ile dni przypominac. NIGDY nie startuje sama.
//   2. Cron (/api/cron/tracking, co godzine) -> runFwUpdateNotices():
//      uzytkownicy z >=1 sparowanym urzadzeniem < targetVersion (NULL wersja
//      = stara), lastSeen w ostatnich 180 dniach albo NULL, ostatni mail
//      >= intervalDays temu. Max 50 na przebieg. Po deadline kampania sama
//      sie wylacza.
//   3. Panel klienta (/api/user/fw-update-status) — baner.
//
// Tabele poza Prisma (raw SQL, tworzone leniwie — jak Coupon). Znaczniki
// czasu w ms jako BIGINT (Prisma $queryRaw czyta INTEGER jako 32-bit).

import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { fwUpdateNoticeEmail, fwUpdateNoticeSubject, type EmailLocale } from "@/lib/email-templates";
import { langForCountry, langForEmail, isNlLang } from "@/lib/newsletter";
import { localePath, SITE_URL } from "@/lib/i18n";

export const FW_DEFAULT_TARGET = "2.1.0";
export const FW_DEFAULT_DURATION_DAYS = 14;
export const FW_DEFAULT_INTERVAL_DAYS = 2;
export const FW_MAX_PER_RUN = 50;
// Urzadzenia niewidziane dluzej niz tyle dni pomijamy (porzucone / sprzedane).
const ACTIVE_WITHIN_DAYS = 180;
const DAY_MS = 24 * 60 * 60_000;

// === Wersje ===

const SEMVER_RE = /^v?(\d{1,4})\.(\d{1,4})\.(\d{1,4})(?:[-+].*)?$/;

export function parseSemver(v: string | null | undefined): [number, number, number] | null {
  const m = SEMVER_RE.exec((v || "").trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

export function isValidTargetVersion(v: unknown): v is string {
  return typeof v === "string" && /^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(v);
}

// <0 gdy a < b. Niepoprawna wersja = najstarsza.
export function compareSemver(a: string | null | undefined, b: string | null | undefined): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa && !pb) return 0;
  if (!pa) return -1;
  if (!pb) return 1;
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

// NULL / nieczytelna wersja = nieaktualne.
export function isOutdated(version: string | null | undefined, target: string): boolean {
  return compareSemver(version, target) < 0;
}

// Device ID w mailu/panelu: tylko 4 ostatnie znaki MAC.
export function maskDeviceId(id: string): string {
  return `••••${id.slice(-4)}`;
}

// === Tabele ===

let _ready = false;
export async function ensureFwUpdateTables(): Promise<void> {
  if (_ready) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FwUpdateCampaign" (
      "id"              TEXT PRIMARY KEY,
      "targetVersion"   TEXT NOT NULL,
      "deadline"        BIGINT NOT NULL,
      "intervalDays"    INTEGER NOT NULL DEFAULT 2,
      "active"          INTEGER NOT NULL DEFAULT 1,
      "createdAt"       BIGINT NOT NULL,
      "stoppedAt"       BIGINT,
      "outdatedDevices" INTEGER NOT NULL DEFAULT 0
    )`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FwUpdateNotice" (
      "campaignId" TEXT NOT NULL,
      "userId"     TEXT NOT NULL,
      "email"      TEXT NOT NULL DEFAULT '',
      "sentAt"     BIGINT NOT NULL,
      "count"      INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY ("campaignId", "userId")
    )`);
  // Uzytkownicy z nieaktualnym urzadzeniem w chwili startu — do statystyki
  // "zaktualizowali od startu".
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FwUpdateTarget" (
      "campaignId" TEXT NOT NULL,
      "userId"     TEXT NOT NULL,
      PRIMARY KEY ("campaignId", "userId")
    )`);
  _ready = true;
}

export interface FwCampaign {
  id: string;
  targetVersion: string;
  deadline: number;
  intervalDays: number;
  active: boolean;
  createdAt: number;
  stoppedAt: number | null;
  outdatedDevices: number;
}

interface CampaignRow {
  id: string;
  targetVersion: string;
  deadline: bigint | number;
  intervalDays: bigint | number;
  active: bigint | number;
  createdAt: bigint | number;
  stoppedAt: bigint | number | null;
  outdatedDevices: bigint | number;
}

function toCampaign(r: CampaignRow): FwCampaign {
  return {
    id: r.id,
    targetVersion: r.targetVersion,
    deadline: Number(r.deadline),
    intervalDays: Number(r.intervalDays),
    active: Number(r.active) === 1,
    createdAt: Number(r.createdAt),
    stoppedAt: r.stoppedAt == null ? null : Number(r.stoppedAt),
    outdatedDevices: Number(r.outdatedDevices),
  };
}

// Ostatnia kampania (aktywna albo zakonczona) — do panelu admina.
export async function getLatestFwCampaign(): Promise<FwCampaign | null> {
  await ensureFwUpdateTables();
  const rows = await prisma.$queryRaw<CampaignRow[]>`
    SELECT * FROM "FwUpdateCampaign" ORDER BY "createdAt" DESC LIMIT 1`;
  return rows[0] ? toCampaign(rows[0]) : null;
}

// Aktywna i przed terminem. Po terminie wylacza ja na stale.
export async function getActiveFwCampaign(): Promise<FwCampaign | null> {
  await ensureFwUpdateTables();
  const rows = await prisma.$queryRaw<CampaignRow[]>`
    SELECT * FROM "FwUpdateCampaign" WHERE "active" = 1 ORDER BY "createdAt" DESC LIMIT 1`;
  if (!rows[0]) return null;
  const c = toCampaign(rows[0]);
  const now = Date.now();
  if (now >= c.deadline) {
    await prisma.$executeRaw`
      UPDATE "FwUpdateCampaign" SET "active" = 0, "stoppedAt" = ${c.deadline} WHERE "id" = ${c.id} AND "active" = 1`;
    return null;
  }
  return c;
}

// === Urzadzenia ===

export interface FwDeviceRow {
  deviceId: string;
  userId: string | null;
  email: string | null;
  firmwareVersion: string | null;
  lastSeen: number | null;
}

// lastSeen bywa INTEGER ms albo tekst ISO (stare wiersze) — jak admin/devices.
function toMs(v: Date | string | number | null | undefined): number | null {
  if (v == null) return null;
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

export async function listFleet(): Promise<FwDeviceRow[]> {
  const rows = await prisma.device.findMany({
    select: {
      deviceId: true,
      userId: true,
      firmwareVersion: true,
      lastSeen: true,
      User: { select: { email: true } },
    },
  });
  return rows.map((d) => ({
    deviceId: d.deviceId,
    userId: d.userId,
    email: d.User?.email ?? null,
    firmwareVersion: d.firmwareVersion,
    lastSeen: toMs(d.lastSeen),
  }));
}

function recentlySeen(d: FwDeviceRow, now: number): boolean {
  return d.lastSeen == null || d.lastSeen >= now - ACTIVE_WITHIN_DAYS * DAY_MS;
}

// Uzytkownik -> jego nieaktualne, sparowane, niedawno widziane urzadzenia.
function outdatedByUser(fleet: FwDeviceRow[], target: string, now: number): Map<string, { email: string; devices: FwDeviceRow[] }> {
  const map = new Map<string, { email: string; devices: FwDeviceRow[] }>();
  for (const d of fleet) {
    if (!d.userId || !d.email) continue;
    if (!isOutdated(d.firmwareVersion, target) || !recentlySeen(d, now)) continue;
    const cur = map.get(d.userId) || { email: d.email, devices: [] };
    cur.devices.push(d);
    map.set(d.userId, cur);
  }
  return map;
}

// === Start / stop (tylko z panelu admina) ===

export async function startFwCampaign(p: { targetVersion: string; deadline: number; intervalDays: number }): Promise<FwCampaign> {
  await ensureFwUpdateTables();
  const now = Date.now();
  const fleet = await listFleet();
  const outdated = outdatedByUser(fleet, p.targetVersion, now);
  const outdatedDevices = Array.from(outdated.values()).reduce((n, u) => n + u.devices.length, 0);
  const id = randomUUID();
  // Jedna aktywna kampania naraz.
  await prisma.$executeRaw`
    UPDATE "FwUpdateCampaign" SET "active" = 0, "stoppedAt" = ${now} WHERE "active" = 1`;
  await prisma.$executeRaw`
    INSERT INTO "FwUpdateCampaign" ("id", "targetVersion", "deadline", "intervalDays", "active", "createdAt", "outdatedDevices")
    VALUES (${id}, ${p.targetVersion}, ${p.deadline}, ${p.intervalDays}, 1, ${now}, ${outdatedDevices})`;
  for (const userId of outdated.keys()) {
    await prisma.$executeRaw`
      INSERT OR IGNORE INTO "FwUpdateTarget" ("campaignId", "userId") VALUES (${id}, ${userId})`;
  }
  return {
    id, targetVersion: p.targetVersion, deadline: p.deadline, intervalDays: p.intervalDays,
    active: true, createdAt: now, stoppedAt: null, outdatedDevices,
  };
}

export async function stopFwCampaign(): Promise<number> {
  await ensureFwUpdateTables();
  const n = await prisma.$executeRaw`
    UPDATE "FwUpdateCampaign" SET "active" = 0, "stoppedAt" = ${Date.now()} WHERE "active" = 1`;
  return Number(n);
}

// === Jezyk maila ===
// Jak newsletter (listRecipients): kraj z ostatniego zamowienia, koncowka
// domeny e-mail, jezyk przegladarki z rejestracji (UserLanguage), domyslnie pl.

async function localeForUser(userId: string, email: string): Promise<EmailLocale> {
  const order = await prisma.order.findFirst({
    where: { OR: [{ userId }, { customerEmail: email }], customerCountry: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { customerCountry: true },
  }).catch(() => null);
  const fromCountry = langForCountry(order?.customerCountry);
  if (fromCountry) return fromCountry;
  const fromTld = langForEmail(email);
  if (fromTld) return fromTld;
  try {
    const rows = await prisma.$queryRaw<{ lang: string }[]>`
      SELECT "lang" FROM "UserLanguage" WHERE "email" = ${email.toLowerCase()} LIMIT 1`;
    if (isNlLang(rows[0]?.lang)) return rows[0].lang;
  } catch {
    // tabela UserLanguage powstaje przy pierwszym uzyciu newslettera/rejestracji
  }
  return "pl";
}

export function fwHelpUrl(locale: EmailLocale): string {
  return `${SITE_URL}${localePath(locale, "/pomoc")}#ota`;
}

// === Wysylka ===

export interface FwNoticeResult {
  campaignId: string | null;
  eligible: number;  // uzytkownicy z nieaktualnym urzadzeniem
  due: number;       // z nich: interwal minal
  sent: string[];    // adresy e-mail
  failed: { email: string; error: string }[];
  skipped: number;   // wyscig z drugim procesem
}

export async function runFwUpdateNotices(limit = FW_MAX_PER_RUN): Promise<FwNoticeResult> {
  const result: FwNoticeResult = { campaignId: null, eligible: 0, due: 0, sent: [], failed: [], skipped: 0 };
  const c = await getActiveFwCampaign();
  if (!c) return result;
  result.campaignId = c.id;

  const now = Date.now();
  const fleet = await listFleet();
  const outdated = outdatedByUser(fleet, c.targetVersion, now);
  result.eligible = outdated.size;
  if (!outdated.size) return result;

  const prevRows = await prisma.$queryRaw<{ userId: string; sentAt: bigint | number; count: bigint | number }[]>`
    SELECT "userId", "sentAt", "count" FROM "FwUpdateNotice" WHERE "campaignId" = ${c.id}`;
  const prev = new Map(prevRows.map((r) => [r.userId, { sentAt: Number(r.sentAt), count: Number(r.count) }]));
  const dueBefore = now - Math.max(1, c.intervalDays) * DAY_MS;

  // Najpierw ci, ktorzy jeszcze nic nie dostali, potem najdawniej powiadomieni.
  const due = Array.from(outdated.entries())
    .filter(([userId]) => (prev.get(userId)?.sentAt ?? 0) <= dueBefore)
    .sort((a, b) => (prev.get(a[0])?.sentAt ?? 0) - (prev.get(b[0])?.sentAt ?? 0));
  result.due = due.length;

  for (const [userId, u] of due.slice(0, Math.max(1, Math.min(200, limit)))) {
    const email = u.email.trim().toLowerCase();
    const before = prev.get(userId);
    // Znacznik PRZED wysylka (warunek na sentAt) — rownolegly przebieg nie wysle drugi raz.
    const claimed = await prisma.$executeRaw`
      INSERT INTO "FwUpdateNotice" ("campaignId", "userId", "email", "sentAt", "count")
      VALUES (${c.id}, ${userId}, ${email}, ${now}, 1)
      ON CONFLICT("campaignId", "userId") DO UPDATE SET
        "sentAt" = excluded."sentAt", "count" = "FwUpdateNotice"."count" + 1, "email" = excluded."email"
      WHERE "FwUpdateNotice"."sentAt" <= ${dueBefore}`;
    if (Number(claimed) === 0) { result.skipped++; continue; }

    const locale = await localeForUser(userId, email);
    const html = fwUpdateNoticeEmail({
      devices: u.devices
        .sort((a, b) => a.deviceId.localeCompare(b.deviceId))
        .map((d) => ({ deviceId: maskDeviceId(d.deviceId), firmwareVersion: d.firmwareVersion })),
      targetVersion: c.targetVersion,
      deadline: c.deadline,
      helpUrl: fwHelpUrl(locale),
    }, locale);
    const r = await sendMail({
      to: email,
      subject: fwUpdateNoticeSubject(locale, c.deadline),
      html,
    }).catch((err) => ({ ok: false, error: String(err) }));

    if (r.ok) {
      result.sent.push(email);
    } else {
      console.error(`[fwUpdateNotice] mail failed ${email}:`, r.error);
      result.failed.push({ email, error: String(r.error || "send failed").slice(0, 200) });
      // Cofnij znacznik — nastepny przebieg ponowi.
      const undo = before
        ? prisma.$executeRaw`
            UPDATE "FwUpdateNotice" SET "sentAt" = ${before.sentAt}, "count" = ${before.count}
            WHERE "campaignId" = ${c.id} AND "userId" = ${userId} AND "sentAt" = ${now}`
        : prisma.$executeRaw`
            DELETE FROM "FwUpdateNotice" WHERE "campaignId" = ${c.id} AND "userId" = ${userId} AND "sentAt" = ${now}`;
      await undo.catch((e) => console.error(`[fwUpdateNotice] marker rollback failed ${email}:`, e));
    }
  }
  return result;
}

// === Panel klienta ===

export interface UserFwUpdateStatus {
  needed: boolean;
  targetVersion: string | null;
  deadline: number | null;
  devices: { deviceId: string; firmwareVersion: string | null }[]; // maskowane
}

export async function userFwUpdateStatus(userId: string): Promise<UserFwUpdateStatus> {
  const c = await getActiveFwCampaign();
  if (!c) return { needed: false, targetVersion: null, deadline: null, devices: [] };
  // W panelu bez filtra lastSeen — wlasciciel widzi kazde swoje stare urzadzenie.
  const rows = await prisma.device.findMany({
    where: { userId },
    select: { deviceId: true, firmwareVersion: true },
  });
  const devices = rows
    .filter((d) => isOutdated(d.firmwareVersion, c.targetVersion))
    .map((d) => ({ deviceId: maskDeviceId(d.deviceId), firmwareVersion: d.firmwareVersion }));
  return { needed: devices.length > 0, targetVersion: c.targetVersion, deadline: c.deadline, devices };
}

// === Panel admina ===

export interface FwVersionBucket {
  version: string;      // "" = brak wersji
  count: number;
  paired: number;
  lastSeen: number | null; // najnowszy lastSeen w grupie
}

export interface FwOutdatedDevice {
  deviceId: string;
  firmwareVersion: string | null;
  lastSeen: number | null;
  userId: string | null;
  email: string | null;
  active: boolean;       // lastSeen w ostatnich 180 dniach / NULL
  noticeCount: number;
  lastNoticeAt: number | null;
}

export interface FwCampaignStats {
  noticesSent: number;    // suma maili
  usersNotified: number;
  targetsAtStart: number; // uzytkownicy z nieaktualnym urzadzeniem przy starcie
  usersUpdated: number;   // z nich: dzis bez nieaktualnych urzadzen
  usersOutdatedNow: number;
  usersDueNow: number;    // dostana mail w najblizszym przebiegu (interwal minal)
}

export interface FwAdminOverview {
  defaults: { targetVersion: string; durationDays: number; intervalDays: number };
  totalDevices: number;
  versions: FwVersionBucket[];
  outdated: FwOutdatedDevice[];
  campaign: FwCampaign | null;
  stats: FwCampaignStats | null;
}

export async function fwAdminOverview(): Promise<FwAdminOverview> {
  await ensureFwUpdateTables();
  await getActiveFwCampaign(); // domyka kampanie po terminie
  const campaign = await getLatestFwCampaign();
  const fleet = await listFleet();
  const now = Date.now();

  const buckets = new Map<string, FwVersionBucket>();
  for (const d of fleet) {
    const v = (d.firmwareVersion || "").trim();
    const b = buckets.get(v) || { version: v, count: 0, paired: 0, lastSeen: null };
    b.count++;
    if (d.userId) b.paired++;
    if (d.lastSeen != null && (b.lastSeen == null || d.lastSeen > b.lastSeen)) b.lastSeen = d.lastSeen;
    buckets.set(v, b);
  }
  const versions = Array.from(buckets.values()).sort((a, b) => compareSemver(b.version, a.version));

  const target = campaign?.targetVersion || FW_DEFAULT_TARGET;
  const notices = campaign
    ? await prisma.$queryRaw<{ userId: string; sentAt: bigint | number; count: bigint | number }[]>`
        SELECT "userId", "sentAt", "count" FROM "FwUpdateNotice" WHERE "campaignId" = ${campaign.id}`
    : [];
  const noticeBy = new Map(notices.map((n) => [n.userId, { sentAt: Number(n.sentAt), count: Number(n.count) }]));

  const outdated: FwOutdatedDevice[] = fleet
    .filter((d) => isOutdated(d.firmwareVersion, target))
    .map((d) => {
      const n = d.userId ? noticeBy.get(d.userId) : undefined;
      return {
        deviceId: d.deviceId,
        firmwareVersion: d.firmwareVersion,
        lastSeen: d.lastSeen,
        userId: d.userId,
        email: d.email,
        active: recentlySeen(d, now),
        noticeCount: n?.count ?? 0,
        lastNoticeAt: n?.sentAt ?? null,
      };
    })
    .sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0));

  let stats: FwCampaignStats | null = null;
  if (campaign) {
    const byUser = outdatedByUser(fleet, campaign.targetVersion, now);
    const targets = await prisma.$queryRaw<{ userId: string }[]>`
      SELECT "userId" FROM "FwUpdateTarget" WHERE "campaignId" = ${campaign.id}`;
    // "Zaktualizowal" = zadnego nieaktualnego urzadzenia (bez filtra lastSeen).
    const stillOld = new Set(fleet.filter((d) => d.userId && isOutdated(d.firmwareVersion, campaign.targetVersion)).map((d) => d.userId));
    const dueBefore = now - Math.max(1, campaign.intervalDays) * DAY_MS;
    stats = {
      noticesSent: notices.reduce((s, n) => s + Number(n.count), 0),
      usersNotified: notices.length,
      targetsAtStart: targets.length,
      usersUpdated: targets.filter((t) => !stillOld.has(t.userId)).length,
      usersOutdatedNow: byUser.size,
      usersDueNow: campaign.active
        ? Array.from(byUser.keys()).filter((u) => (noticeBy.get(u)?.sentAt ?? 0) <= dueBefore).length
        : 0,
    };
  }

  return {
    defaults: { targetVersion: FW_DEFAULT_TARGET, durationDays: FW_DEFAULT_DURATION_DAYS, intervalDays: FW_DEFAULT_INTERVAL_DAYS },
    totalDevices: fleet.length,
    versions,
    outdated,
    campaign,
    stats,
  };
}
