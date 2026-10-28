import { prisma } from "@/lib/db";

// Microsoft Clarity — dzienne snapshoty z Data Export API.
//
// API (project-live-insights) zwraca tylko ostatnie 1-3 dni, wiec trendy
// budujemy sami: raz na dobe zapisujemy snapshot do ClaritySnapshot.
//
// Limit API: 10 zapytan / dobe / projekt. Snapshot = 3 zapytania
// (bez wymiaru, Device, URL). Kazde zapytanie liczymy w ClarityFetchLog
// i pilnujemy budzetu w oknie 24h (nie wiemy, kiedy Clarity resetuje limit):
//   - automat (cron): max AUTO_BUDGET zapytan / 24h, odstep miedzy probami
//   - recznie (panel): max HARD_CAP zapytan / 24h (zostaje zapas na Clarity UI/testy)
//
// Klucz dnia (kolumna day): numOfDays=1 = ostatnie 24h PRZED pobraniem.
// Automat odpala sie o ~06:00 Europe/Warsaw, wiec okno to w ~3/4 "wczoraj" —
// day = data Warsaw dnia pobrania MINUS 1 dzien. Reczne pobranie dostaje ten
// sam klucz (nadpisuje tylko z force). Dokladny moment pobrania: createdAt (ms).
//
// Tabele poza Prisma schema (raw SQL, wzorem coupons.ts). Czasy w ms = BIGINT
// (INTEGER Prisma czyta jako 32-bit i wywala sie na ms).

const API_URL = "https://www.clarity.ms/export-data/api/v1/project-live-insights";
const FETCH_TIMEOUT_MS = 30_000;
const TOP_URLS = 30;
export const CLARITY_CALLS_PER_SNAPSHOT = 3;
export const CLARITY_AUTO_BUDGET = 6;  // automat: max 2 proby / 24h
export const CLARITY_HARD_CAP = 9;     // twardy limit naszych zapytan / 24h (limit Clarity = 10)
const AUTO_RETRY_GAP_MS = 3 * 3600_000; // automat: nie probuj czesciej niz co 3h
export const CLARITY_AUTO_HOUR = 6;     // automat od tej godziny (Europe/Warsaw)
const DAY_MS = 24 * 3600_000;

export type ClarityDimension = "" | "Device" | "URL";

export interface ClarityMetrics {
  sessions: number | null;
  bots: number | null;
  users: number | null;
  pagesPerSession: number | null;
  scrollDepth: number | null;
  totalTime: number | null;
  activeTime: number | null;
  deadClicks: number | null;
  deadClickSessionsPct: number | null;
  rageClicks: number | null;
  rageClickSessionsPct: number | null;
  quickbacks: number | null;
  quickbackSessionsPct: number | null;
  scriptErrors: number | null;
  excessiveScroll: number | null;
}

export interface ClarityParsedRow extends ClarityMetrics {
  dimValue: string;
  raw: Record<string, unknown[]>; // metricName -> wiersze information dla tej wartosci
}

export interface ClaritySnapshotRow extends ClarityMetrics {
  day: string;
  dimension: ClarityDimension;
  dimValue: string;
  createdAt: number;
}

// ----------------------------------------------------------------
// Tabele
// ----------------------------------------------------------------
let _tableReady = false;

export async function ensureClarityTables(): Promise<void> {
  if (_tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ClaritySnapshot" (
      "day"                  TEXT NOT NULL,
      "dimension"            TEXT NOT NULL DEFAULT '',
      "dimValue"             TEXT NOT NULL DEFAULT '',
      "sessions"             INTEGER,
      "bots"                 INTEGER,
      "users"                INTEGER,
      "pagesPerSession"      REAL,
      "scrollDepth"          REAL,
      "totalTime"            REAL,
      "activeTime"           REAL,
      "deadClicks"           INTEGER,
      "deadClickSessionsPct" REAL,
      "rageClicks"           INTEGER,
      "rageClickSessionsPct" REAL,
      "quickbacks"           INTEGER,
      "quickbackSessionsPct" REAL,
      "scriptErrors"         INTEGER,
      "excessiveScroll"      INTEGER,
      "raw"                  TEXT,
      "createdAt"            BIGINT NOT NULL,
      PRIMARY KEY ("day", "dimension", "dimValue")
    )
  `);
  // Kazde zapytanie do API (tez nieudane) — do pilnowania limitu 10/dobe.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ClarityFetchLog" (
      "id"        INTEGER PRIMARY KEY AUTOINCREMENT,
      "day"       TEXT NOT NULL,
      "trigger"   TEXT NOT NULL,
      "calls"     INTEGER NOT NULL DEFAULT 0,
      "ok"        INTEGER NOT NULL DEFAULT 0,
      "error"     TEXT,
      "createdAt" BIGINT NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ClarityFetchLog_createdAt_idx" ON "ClarityFetchLog" ("createdAt")`
  );
  _tableReady = true;
}

// ----------------------------------------------------------------
// Daty (serwer chodzi w UTC)
// ----------------------------------------------------------------
export function warsawDate(d = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(d);
}

export function warsawHour(d = new Date()): number {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", hour: "2-digit", hourCycle: "h23" }).format(d);
  return parseInt(h, 10) || 0;
}

// "YYYY-MM-DD" +/- n dni (arytmetyka kalendarzowa, bez stref).
export function shiftDay(day: string, n: number): string {
  const t = Date.parse(`${day}T00:00:00Z`) + n * DAY_MS;
  return new Date(t).toISOString().slice(0, 10);
}

// Klucz snapshotu dla pobrania w chwili `d` (patrz komentarz na gorze).
export function claritySnapshotDay(d = new Date()): string {
  return shiftDay(warsawDate(d), -1);
}

// ----------------------------------------------------------------
// Parser odpowiedzi (defensywnie: nieznane metryki ignorowane, liczby moga byc stringami)
// ----------------------------------------------------------------
function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const s = v.trim().replace(",", ".").replace(/%$/, "");
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function int(v: unknown): number | null {
  const n = num(v);
  return n === null ? null : Math.round(n);
}

function emptyMetrics(): ClarityMetrics {
  return {
    sessions: null, bots: null, users: null, pagesPerSession: null,
    scrollDepth: null, totalTime: null, activeTime: null,
    deadClicks: null, deadClickSessionsPct: null,
    rageClicks: null, rageClickSessionsPct: null,
    quickbacks: null, quickbackSessionsPct: null,
    scriptErrors: null, excessiveScroll: null,
  };
}

// Klucze, pod jakimi Clarity zwraca wartosc wymiaru (np. "Url" dla URL).
const DIM_KEYS: Record<Exclude<ClarityDimension, "">, string[]> = {
  URL: ["url", "pageurl", "page"],
  Device: ["device", "devicetype"],
};

function dimValueOf(info: Record<string, unknown>, dimension: ClarityDimension): string | null {
  if (!dimension) return "";
  const wanted = DIM_KEYS[dimension];
  for (const [k, v] of Object.entries(info)) {
    if (!wanted.includes(k.toLowerCase())) continue;
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s ? s.slice(0, 500) : null;
  }
  return null;
}

function applyMetric(m: ClarityMetrics, metricName: string, info: Record<string, unknown>): boolean {
  switch (metricName.toLowerCase()) {
    case "traffic":
      m.sessions = int(info.totalSessionCount) ?? m.sessions;
      m.bots = int(info.totalBotSessionCount) ?? m.bots;
      m.users = int(info.distinctUserCount) ?? m.users;
      m.pagesPerSession = num(info.pagesPerSessionPercentage) ?? m.pagesPerSession;
      return true;
    case "scrolldepth":
      m.scrollDepth = num(info.averageScrollDepth) ?? m.scrollDepth;
      return true;
    case "engagementtime":
      m.totalTime = num(info.totalTime) ?? m.totalTime;
      m.activeTime = num(info.activeTime) ?? m.activeTime;
      return true;
    case "deadclickcount":
      m.deadClicks = int(info.subTotal) ?? m.deadClicks;
      m.deadClickSessionsPct = num(info.sessionsWithMetricPercentage) ?? m.deadClickSessionsPct;
      return true;
    case "rageclickcount":
      m.rageClicks = int(info.subTotal) ?? m.rageClicks;
      m.rageClickSessionsPct = num(info.sessionsWithMetricPercentage) ?? m.rageClickSessionsPct;
      return true;
    case "quickbackclick":
      m.quickbacks = int(info.subTotal) ?? m.quickbacks;
      m.quickbackSessionsPct = num(info.sessionsWithMetricPercentage) ?? m.quickbackSessionsPct;
      return true;
    case "scripterrorcount":
      m.scriptErrors = int(info.subTotal) ?? m.scriptErrors;
      return true;
    case "excessivescroll":
      m.excessiveScroll = int(info.subTotal) ?? m.excessiveScroll;
      return true;
    default:
      return false; // nieznana / listowa metryka — zostaje tylko w raw
  }
}

// Zamienia odpowiedz API na wiersze per wartosc wymiaru ("" dla bez wymiaru).
export function parseClarityResponse(data: unknown, dimension: ClarityDimension): ClarityParsedRow[] {
  type Acc = ClarityParsedRow & { fallbackSessions: number | null };
  const byValue = new Map<string, Acc>();
  if (!Array.isArray(data)) return [];
  for (const metric of data) {
    if (!metric || typeof metric !== "object") continue;
    const metricName = String((metric as { metricName?: unknown }).metricName ?? "").trim();
    const infos = (metric as { information?: unknown }).information;
    if (!metricName || !Array.isArray(infos)) continue;
    for (const info of infos) {
      if (!info || typeof info !== "object") continue;
      const rec = info as Record<string, unknown>;
      const value = dimValueOf(rec, dimension);
      if (value === null) continue;
      let row = byValue.get(value);
      if (!row) {
        row = { ...emptyMetrics(), dimValue: value, raw: {}, fallbackSessions: null };
        byValue.set(value, row);
      }
      const list = (row.raw[metricName] ||= []);
      list.push(rec);
      // Bez wymiaru listy (Browser, PopularPages...) maja wiele wierszy —
      // liczby bierzemy tylko z pierwszego, reszta zostaje w raw.
      if (!dimension && list.length > 1) continue;
      if (applyMetric(row, metricName, rec) && row.fallbackSessions === null) {
        row.fallbackSessions = int(rec.sessionsCount);
      }
    }
  }
  // Sesje z Traffic; gdy go brak — sessionsCount z wierszy metryk.
  return [...byValue.values()].map(({ fallbackSessions, ...r }) => ({
    ...r,
    sessions: r.sessions ?? fallbackSessions,
  }));
}

// ----------------------------------------------------------------
// API
// ----------------------------------------------------------------
export function clarityConfigured(): boolean {
  return !!process.env.CLARITY_API_TOKEN;
}

async function callClarity(dimension: ClarityDimension): Promise<unknown> {
  const token = process.env.CLARITY_API_TOKEN;
  if (!token) throw new Error("CLARITY_API_TOKEN nie ustawiony");
  const qs = new URLSearchParams({ numOfDays: "1" });
  if (dimension) qs.set("dimension1", dimension);
  const res = await fetch(`${API_URL}?${qs}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) {
    // Tresc bledu Clarity (bez naglowkow — token nie trafia do logow).
    const body = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 200);
    throw new Error(`Clarity HTTP ${res.status}${dimension ? ` (${dimension})` : ""}${body ? `: ${body}` : ""}`);
  }
  return res.json();
}

// ----------------------------------------------------------------
// Budzet zapytan
// ----------------------------------------------------------------
export interface ClarityQuota {
  callsLast24h: number;
  autoBudget: number;
  hardCap: number;
  remainingManual: number; // ile zapytan moze jeszcze zrobic panel (wg naszego licznika)
  lastAttemptAt: number | null;
  lastOk: boolean | null;
  lastError: string | null;
}

export async function getClarityQuota(now = Date.now()): Promise<ClarityQuota> {
  await ensureClarityTables();
  const since = now - DAY_MS;
  const sum = await prisma.$queryRaw<{ n: bigint | number | null }[]>`
    SELECT SUM("calls") AS n FROM "ClarityFetchLog" WHERE "createdAt" >= ${since}
  `;
  const last = await prisma.$queryRaw<{ createdAt: bigint | number; ok: bigint | number; error: string | null }[]>`
    SELECT "createdAt", "ok", "error" FROM "ClarityFetchLog" ORDER BY "createdAt" DESC LIMIT 1
  `;
  const calls = Number(sum[0]?.n ?? 0);
  return {
    callsLast24h: calls,
    autoBudget: CLARITY_AUTO_BUDGET,
    hardCap: CLARITY_HARD_CAP,
    remainingManual: Math.max(0, CLARITY_HARD_CAP - calls),
    lastAttemptAt: last[0] ? Number(last[0].createdAt) : null,
    lastOk: last[0] ? Number(last[0].ok) === 1 : null,
    lastError: last[0]?.error ?? null,
  };
}

async function snapshotExists(day: string): Promise<boolean> {
  const r = await prisma.$queryRaw<{ n: bigint | number }[]>`
    SELECT COUNT(*) AS n FROM "ClaritySnapshot" WHERE "day" = ${day} AND "dimension" = ''
  `;
  return Number(r[0]?.n ?? 0) > 0;
}

// ----------------------------------------------------------------
// Snapshot
// ----------------------------------------------------------------
export interface ClaritySnapshotResult {
  ok: boolean;
  day: string;
  skipped?: "exists" | "not_configured" | "quota" | "too_soon" | "running";
  calls: number;            // ile zapytan zuzylo TO wywolanie
  stored?: { overall: number; device: number; url: number };
  errors: string[];
  quota: ClarityQuota;
}

export interface ClaritySnapshotOptions {
  force?: boolean;                  // pobierz mimo istniejacego snapshotu
  trigger?: "cron" | "manual";
  now?: Date;
}

let _running: Promise<ClaritySnapshotResult> | null = null;

export function fetchAndStoreClaritySnapshot(opts: ClaritySnapshotOptions = {}): Promise<ClaritySnapshotResult> {
  // Jedno pobranie naraz w procesie (cron + klik w panelu nie spalaja 2x limitu).
  if (_running) {
    return _running.then((r) => ({ ...r, ok: false, skipped: "running" as const, calls: 0 }));
  }
  _running = runSnapshot(opts).finally(() => {
    _running = null;
  });
  return _running;
}

function toRowValues(day: string, dimension: ClarityDimension, r: ClarityParsedRow, raw: string, createdAt: number) {
  return prisma.$executeRaw`
    INSERT OR REPLACE INTO "ClaritySnapshot" (
      "day", "dimension", "dimValue", "sessions", "bots", "users", "pagesPerSession",
      "scrollDepth", "totalTime", "activeTime", "deadClicks", "deadClickSessionsPct",
      "rageClicks", "rageClickSessionsPct", "quickbacks", "quickbackSessionsPct",
      "scriptErrors", "excessiveScroll", "raw", "createdAt"
    ) VALUES (
      ${day}, ${dimension}, ${r.dimValue}, ${r.sessions}, ${r.bots}, ${r.users}, ${r.pagesPerSession},
      ${r.scrollDepth}, ${r.totalTime}, ${r.activeTime}, ${r.deadClicks}, ${r.deadClickSessionsPct},
      ${r.rageClicks}, ${r.rageClickSessionsPct}, ${r.quickbacks}, ${r.quickbackSessionsPct},
      ${r.scriptErrors}, ${r.excessiveScroll}, ${raw}, ${BigInt(createdAt)}
    )
  `;
}

async function runSnapshot(opts: ClaritySnapshotOptions): Promise<ClaritySnapshotResult> {
  await ensureClarityTables();
  const nowDate = opts.now ?? new Date();
  const now = nowDate.getTime();
  const trigger = opts.trigger ?? "manual";
  const day = claritySnapshotDay(nowDate);
  const quota = await getClarityQuota(now);
  const base = { day, calls: 0, errors: [] as string[], quota };

  if (!clarityConfigured()) return { ...base, ok: false, skipped: "not_configured" };
  if (!opts.force && (await snapshotExists(day))) return { ...base, ok: true, skipped: "exists" };

  const budget = trigger === "cron" ? CLARITY_AUTO_BUDGET : CLARITY_HARD_CAP;
  if (quota.callsLast24h + CLARITY_CALLS_PER_SNAPSHOT > budget) {
    return { ...base, ok: false, skipped: "quota" };
  }
  if (trigger === "cron" && quota.lastAttemptAt !== null && now - quota.lastAttemptAt < AUTO_RETRY_GAP_MS) {
    return { ...base, ok: false, skipped: "too_soon" };
  }

  const errors: string[] = [];
  let calls = 0;
  const responses: Partial<Record<"overall" | "device" | "url", unknown>> = {};

  // Kolejno; blad pierwszego (bez wymiaru) = koniec, zeby nie palic limitu.
  const plan: ["overall" | "device" | "url", ClarityDimension][] = [["overall", ""], ["device", "Device"], ["url", "URL"]];
  for (const [key, dim] of plan) {
    calls++;
    try {
      responses[key] = await callClarity(dim);
    } catch (e) {
      errors.push((e as Error).message);
      if (key === "overall") break;
    }
  }

  const overall = responses.overall !== undefined ? parseClarityResponse(responses.overall, "") : [];
  const devices = responses.device !== undefined ? parseClarityResponse(responses.device, "Device") : [];
  const urls = responses.url !== undefined
    ? parseClarityResponse(responses.url, "URL")
        .sort((a, b) => (b.sessions ?? 0) - (a.sessions ?? 0))
        .slice(0, TOP_URLS)
    : [];
  if (responses.overall !== undefined && !overall.length) errors.push("Clarity: pusta/nieznana odpowiedz (bez wymiaru)");

  const ok = overall.length > 0;
  if (ok) {
    const queries = [];
    // Przy force czyscimy dzien danego wymiaru — inaczej zostalyby stare URL-e spoza top.
    if (responses.device !== undefined) {
      queries.push(prisma.$executeRaw`DELETE FROM "ClaritySnapshot" WHERE "day" = ${day} AND "dimension" = 'Device'`);
    }
    if (responses.url !== undefined) {
      queries.push(prisma.$executeRaw`DELETE FROM "ClaritySnapshot" WHERE "day" = ${day} AND "dimension" = 'URL'`);
    }
    // Wiersz ogolny: pelna odpowiedz w raw (listy Browser/OS/Country/PopularPages na pozniej).
    queries.push(toRowValues(day, "", overall[0], JSON.stringify(responses.overall).slice(0, 200_000), now));
    for (const r of devices) queries.push(toRowValues(day, "Device", r, JSON.stringify(r.raw), now));
    for (const r of urls) queries.push(toRowValues(day, "URL", r, JSON.stringify(r.raw), now));
    await prisma.$transaction(queries);
  }

  const errText = errors.length ? errors.join(" | ").slice(0, 1000) : null;
  await prisma.$executeRaw`
    INSERT INTO "ClarityFetchLog" ("day", "trigger", "calls", "ok", "error", "createdAt")
    VALUES (${day}, ${trigger}, ${calls}, ${ok ? 1 : 0}, ${errText}, ${BigInt(now)})
  `;
  if (errors.length) console.error(`[clarity] snapshot ${day} (${trigger}) bledy: ${errText}`);
  else console.log(`[clarity] snapshot ${day} (${trigger}) devices=${devices.length} urls=${urls.length}`);

  return {
    ok,
    day,
    calls,
    stored: ok ? { overall: 1, device: devices.length, url: urls.length } : undefined,
    errors,
    quota: await getClarityQuota(now),
  };
}

// Wolane z godzinnego crona (/api/cron/tracking): raz na dobe od CLARITY_AUTO_HOUR.
export async function maybeRunDailyClaritySnapshot(now = new Date()): Promise<ClaritySnapshotResult | null> {
  if (!clarityConfigured()) return null;
  if (warsawHour(now) < CLARITY_AUTO_HOUR) return null;
  return fetchAndStoreClaritySnapshot({ trigger: "cron", now });
}

// ----------------------------------------------------------------
// Odczyt do panelu
// ----------------------------------------------------------------
type DbRow = Record<string, unknown>;

function mapRow(r: DbRow): ClaritySnapshotRow {
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    day: String(r.day),
    dimension: String(r.dimension ?? "") as ClarityDimension,
    dimValue: String(r.dimValue ?? ""),
    sessions: n(r.sessions),
    bots: n(r.bots),
    users: n(r.users),
    pagesPerSession: n(r.pagesPerSession),
    scrollDepth: n(r.scrollDepth),
    totalTime: n(r.totalTime),
    activeTime: n(r.activeTime),
    deadClicks: n(r.deadClicks),
    deadClickSessionsPct: n(r.deadClickSessionsPct),
    rageClicks: n(r.rageClicks),
    rageClickSessionsPct: n(r.rageClickSessionsPct),
    quickbacks: n(r.quickbacks),
    quickbackSessionsPct: n(r.quickbackSessionsPct),
    scriptErrors: n(r.scriptErrors),
    excessiveScroll: n(r.excessiveScroll),
    createdAt: Number(r.createdAt ?? 0),
  };
}

const SELECT_COLS = `"day", "dimension", "dimValue", "sessions", "bots", "users", "pagesPerSession",
  "scrollDepth", "totalTime", "activeTime", "deadClicks", "deadClickSessionsPct",
  "rageClicks", "rageClickSessionsPct", "quickbacks", "quickbackSessionsPct",
  "scriptErrors", "excessiveScroll", "createdAt"`;

export interface ClarityTrends {
  configured: boolean;
  days: number;
  since: string;
  overall: ClaritySnapshotRow[];
  devices: Record<string, ClaritySnapshotRow[]>;
  topUrls: { day: string | null; createdAt: number | null; rows: ClaritySnapshotRow[] };
  quota: ClarityQuota;
}

export async function getClarityTrends(days: number): Promise<ClarityTrends> {
  await ensureClarityTables();
  const since = shiftDay(warsawDate(), -Math.max(1, days));
  const rows = (await prisma.$queryRawUnsafe<DbRow[]>(
    `SELECT ${SELECT_COLS} FROM "ClaritySnapshot"
     WHERE "day" >= ? AND "dimension" IN ('', 'Device') ORDER BY "day" ASC`,
    since,
  )).map(mapRow);

  const overall = rows.filter((r) => r.dimension === "");
  const devices: Record<string, ClaritySnapshotRow[]> = {};
  for (const r of rows) {
    if (r.dimension !== "Device") continue;
    (devices[r.dimValue] ||= []).push(r);
  }

  const latest = await prisma.$queryRaw<{ day: string }[]>`
    SELECT MAX("day") AS day FROM "ClaritySnapshot" WHERE "dimension" = 'URL'
  `;
  const latestDay = latest[0]?.day ?? null;
  const urlRows = latestDay
    ? (await prisma.$queryRawUnsafe<DbRow[]>(
        `SELECT ${SELECT_COLS} FROM "ClaritySnapshot" WHERE "day" = ? AND "dimension" = 'URL'`,
        latestDay,
      )).map(mapRow)
    : [];
  urlRows.sort((a, b) => (b.deadClickSessionsPct ?? -1) - (a.deadClickSessionsPct ?? -1) || (b.sessions ?? 0) - (a.sessions ?? 0));

  return {
    configured: clarityConfigured(),
    days,
    since,
    overall,
    devices,
    topUrls: { day: latestDay, createdAt: urlRows[0]?.createdAt ?? null, rows: urlRows },
    quota: await getClarityQuota(),
  };
}
