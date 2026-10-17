import { readdir, readFile, stat, writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";

export const CAPTURES_DIR =
  process.env.CALCULATOR_CAPTURES_DIR ||
  path.join(process.cwd(), "..", "captures");

// Filename format z saveCapture():
//   YYYY-MM-DD-HH-MM-SS_<deviceId>_<licenseTag>[_<rand>].jpg
// (toISOString z replace(/[:T]/g, "-") + slice(0,19), potem _devTag_licTag.jpg;
// sufiks _rand od 2026-10-16 — dwa zdjecia w tej samej sekundzie nadpisywaly sie)
//
// Audyt 2026-10-16: metadane zdjec w tabeli "Capture" (poza Prisma schema,
// tworzona leniwie jak Coupon/RemoteSession):
//   filename  PK
//   deviceId  urzadzenie
//   userId    WLASCICIEL URZADZENIA W CHWILI ZDJECIA (nowy wlasciciel po
//             odsprzedazy/resecie nie widzi zdjec poprzedniego)
//   createdAt ms epoch (jak DateTime Prismy w SQLite)
//   size      bajty
//   legacy    1 = plik sprzed tabeli (zaindeksowany przez backfill, bez
//             znanego wlasciciela — widoczny dla obecnego wlasciciela
//             urzadzenia, tak jak dotychczas)
// Wczesniej kazde zadanie listy robilo readdir + stat calego katalogu (O(N)).

export interface CaptureMeta {
  filename: string;
  deviceId: string;
  timestamp: string; // ISO
  sizeKB: number;
}

const FILENAME_RE = /^[A-Za-z0-9_\-]+\.jpg$/;

export function isSafeFilename(name: string): boolean {
  return FILENAME_RE.test(name) && !name.includes("..") && !name.includes("/");
}

function parseFilename(filename: string): { deviceId: string; timestamp: string } | null {
  const parts = filename.replace(/\.jpg$/, "").split("_");
  if (parts.length < 2) return null;
  const tsParts = parts[0].split("-");
  if (tsParts.length !== 6) return null;
  const [Y, M, D, h, m, s] = tsParts;
  const iso = `${Y}-${M}-${D}T${h}:${m}:${s}Z`;
  if (Number.isNaN(new Date(iso).getTime())) return null;
  return { deviceId: parts[1], timestamp: iso };
}

let _tableReady = false;
export async function ensureCaptureTable(): Promise<void> {
  if (_tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Capture" (
      "filename"  TEXT PRIMARY KEY,
      "deviceId"  TEXT NOT NULL,
      "userId"    TEXT,
      "createdAt" BIGINT NOT NULL,
      "size"      INTEGER NOT NULL DEFAULT 0,
      "legacy"    INTEGER NOT NULL DEFAULT 0
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Capture_userId_createdAt" ON "Capture" ("userId", "createdAt")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Capture_deviceId_createdAt" ON "Capture" ("deviceId", "createdAt")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Capture_createdAt" ON "Capture" ("createdAt")`
  );
  _tableReady = true;
}

// Zapisz JPEG z zadania na dysk + wiersz w Capture. Nie rzuca — log error jak fail.
export async function saveCapture(
  base64Data: string,
  deviceId: string | null,
  licenseKey: string,
  fwVersion: string | null,
  ownerUserId: string | null
): Promise<string | null> {
  try {
    await mkdir(CAPTURES_DIR, { recursive: true });
    const now = new Date();
    const stamp = now.toISOString().replace(/[:T]/g, "-").slice(0, 19);  // 2026-05-28-14-33-12
    const devTag = (deviceId || "unknown").replace(/[^A-Za-z0-9-]/g, "").slice(0, 16) || "unknown";
    const licTag = licenseKey.replace(/[^A-Za-z0-9-]/g, "").slice(-8) || "none";
    const rand = randomBytes(3).toString("hex");
    const filename = `${stamp}_${devTag}_${licTag}_${rand}.jpg`;
    const filepath = path.join(CAPTURES_DIR, filename);
    const buffer = Buffer.from(base64Data, "base64");
    await writeFile(filepath, buffer);
    console.log(`[capture] saved: ${filename} (${buffer.length} B, fw=${fwVersion || "?"})`);
    try {
      await ensureCaptureTable();
      await prisma.$executeRaw`
        INSERT OR REPLACE INTO "Capture" ("filename", "deviceId", "userId", "createdAt", "size", "legacy")
        VALUES (${filename}, ${devTag}, ${ownerUserId}, ${now.getTime()}, ${buffer.length}, 0)
      `;
    } catch (e) {
      // Plik jest — przy nastepnym backfillu trafi do tabeli jako legacy.
      console.error("[capture] index insert fail:", e);
    }
    return filename;
  } catch (err) {
    console.error("[capture] save error:", err);
    return null;
  }
}

// --- Backfill: pliki sprzed tabeli -> wiersze legacy=1 (raz na proces) ---
let _indexPromise: Promise<void> | null = null;

async function backfillLegacyCaptures(): Promise<void> {
  await ensureCaptureTable();
  let entries: string[];
  try {
    entries = await readdir(CAPTURES_DIR);
  } catch {
    return;
  }
  const known = new Set(
    (await prisma.$queryRawUnsafe<{ filename: string }[]>(`SELECT "filename" FROM "Capture"`)).map(
      (r) => r.filename
    )
  );
  const pending: { filename: string; deviceId: string; createdAt: number; size: number }[] = [];
  for (const f of entries) {
    if (!f.endsWith(".jpg") || known.has(f) || !isSafeFilename(f)) continue;
    const parsed = parseFilename(f);
    if (!parsed) continue;
    try {
      const st = await stat(path.join(CAPTURES_DIR, f));
      pending.push({
        filename: f,
        deviceId: parsed.deviceId,
        createdAt: new Date(parsed.timestamp).getTime(),
        size: st.size,
      });
    } catch {
      // skip
    }
  }
  const BATCH = 200;
  for (let i = 0; i < pending.length; i += BATCH) {
    const chunk = pending.slice(i, i + BATCH);
    const values = chunk.map(() => "(?, ?, NULL, ?, ?, 1)").join(",");
    const args = chunk.flatMap((c) => [c.filename, c.deviceId, c.createdAt, c.size]);
    await prisma.$executeRawUnsafe(
      `INSERT OR IGNORE INTO "Capture" ("filename", "deviceId", "userId", "createdAt", "size", "legacy") VALUES ${values}`,
      ...args
    );
  }
  if (pending.length) console.log(`[capture] backfill: zaindeksowano ${pending.length} plikow legacy`);
}

// Gwarancja, ze tabela istnieje i pliki legacy sa zaindeksowane. Pierwsze
// wywolanie w procesie skanuje katalog jeden raz, kolejne sa natychmiastowe.
export function ensureCapturesIndexed(): Promise<void> {
  if (!_indexPromise) {
    _indexPromise = backfillLegacyCaptures().catch((e) => {
      console.error("[capture] backfill fail:", e);
      _indexPromise = null; // sprobuj ponownie przy nastepnym zadaniu
    });
  }
  return _indexPromise;
}

interface CaptureRow {
  filename: string;
  deviceId: string;
  userId: string | null;
  createdAt: number | bigint;
  size: number | bigint;
  legacy: number | bigint;
}

function toMeta(r: CaptureRow): CaptureMeta {
  return {
    filename: r.filename,
    deviceId: r.deviceId,
    timestamp: new Date(Number(r.createdAt)).toISOString(),
    sizeKB: Math.round(Number(r.size) / 1024),
  };
}

// Kursor kolejnej strony: createdAt (ms) ostatniego elementu jako string
// (panel traktuje nextBefore jako string i odsyla w ?before=).
function cursorOf(rows: CaptureRow[], limit: number): string | null {
  return rows.length === limit && rows.length > 0 ? String(Number(rows[rows.length - 1].createdAt)) : null;
}

export interface CapturePage {
  limit: number;
  before: number | null; // ms epoch — zwracamy starsze niz
}

export function parseCapturePage(url: URL, defLimit: number, maxLimit: number): CapturePage {
  const limitRaw = parseInt(url.searchParams.get("limit") || "", 10);
  const limit = Math.min(maxLimit, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : defLimit));
  const b = url.searchParams.get("before");
  let before: number | null = null;
  if (b) {
    const t = /^\d+$/.test(b) ? Number(b) : new Date(b).getTime();
    if (Number.isFinite(t)) before = t;
  }
  return { limit, before };
}

// Zdjecia widoczne dla usera: zrobione gdy urzadzenie bylo jego (userId)
// + pliki legacy (bez znanego wlasciciela) z urzadzen, ktore TERAZ do niego
// naleza — tak jak dotychczas (Device nie ma kolumny pairedAt, wiec nie da
// sie odciac zdjec sprzed sparowania).
export async function listUserCaptures(
  userId: string,
  ownedDeviceIds: string[],
  page: CapturePage
): Promise<{ items: CaptureMeta[]; nextBefore: string | null }> {
  await ensureCapturesIndexed();
  const before = page.before ?? Number.MAX_SAFE_INTEGER;
  let rows: CaptureRow[];
  if (ownedDeviceIds.length) {
    const ph = ownedDeviceIds.map(() => "?").join(",");
    rows = await prisma.$queryRawUnsafe<CaptureRow[]>(
      `SELECT "filename", "deviceId", "userId", "createdAt", "size", "legacy" FROM "Capture"
       WHERE ("userId" = ? OR ("legacy" = 1 AND "userId" IS NULL AND "deviceId" IN (${ph})))
         AND "createdAt" < ?
       ORDER BY "createdAt" DESC LIMIT ?`,
      userId,
      ...ownedDeviceIds,
      before,
      page.limit
    );
  } else {
    rows = await prisma.$queryRawUnsafe<CaptureRow[]>(
      `SELECT "filename", "deviceId", "userId", "createdAt", "size", "legacy" FROM "Capture"
       WHERE "userId" = ? AND "createdAt" < ?
       ORDER BY "createdAt" DESC LIMIT ?`,
      userId,
      before,
      page.limit
    );
  }
  const items = rows.map(toMeta);
  return { items, nextBefore: cursorOf(rows, page.limit) };
}

// Czy user moze zobaczyc dany plik. Wiersz w Capture rozstrzyga; brak
// wiersza (plik jeszcze niezaindeksowany) -> regula legacy: deviceId z nazwy
// pliku musi byc urzadzeniem usera.
export async function canUserAccessCapture(
  userId: string,
  filename: string,
  ownsDevice: (deviceId: string) => Promise<boolean>
): Promise<boolean> {
  await ensureCapturesIndexed();
  const rows = await prisma.$queryRaw<CaptureRow[]>`
    SELECT "filename", "deviceId", "userId", "createdAt", "size", "legacy"
    FROM "Capture" WHERE "filename" = ${filename} LIMIT 1
  `;
  const row = rows[0];
  if (row) {
    if (row.userId) return row.userId === userId;
    if (Number(row.legacy) === 1) return ownsDevice(row.deviceId);
    return false; // zdjecie z niesparowanego urzadzenia — tylko admin
  }
  const parsed = parseFilename(filename);
  if (!parsed) return false;
  return ownsDevice(parsed.deviceId);
}

// Lista dla admina (wszystkie urzadzenia) + statystyki z tabeli.
export async function listAdminCaptures(
  deviceFilter: string | null,
  page: CapturePage
): Promise<{
  items: CaptureMeta[];
  nextBefore: string | null;
  total: number;
  filtered: number;
  totalSizeKB: number;
  byDevice: { deviceId: string; count: number }[];
}> {
  await ensureCapturesIndexed();
  const before = page.before ?? Number.MAX_SAFE_INTEGER;
  const rows = deviceFilter
    ? await prisma.$queryRaw<CaptureRow[]>`
        SELECT "filename", "deviceId", "userId", "createdAt", "size", "legacy" FROM "Capture"
        WHERE UPPER("deviceId") = ${deviceFilter} AND "createdAt" < ${before}
        ORDER BY "createdAt" DESC LIMIT ${page.limit}
      `
    : await prisma.$queryRaw<CaptureRow[]>`
        SELECT "filename", "deviceId", "userId", "createdAt", "size", "legacy" FROM "Capture"
        WHERE "createdAt" < ${before}
        ORDER BY "createdAt" DESC LIMIT ${page.limit}
      `;
  const byDeviceRows = await prisma.$queryRawUnsafe<{ deviceId: string; count: number | bigint }[]>(
    `SELECT "deviceId", COUNT(*) AS "count" FROM "Capture" GROUP BY "deviceId" ORDER BY "count" DESC`
  );
  const byDevice = byDeviceRows.map((r) => ({ deviceId: r.deviceId, count: Number(r.count) }));
  const total = byDevice.reduce((s, d) => s + d.count, 0);
  const agg = deviceFilter
    ? await prisma.$queryRaw<{ n: number | bigint; bytes: number | bigint | null }[]>`
        SELECT COUNT(*) AS "n", SUM("size") AS "bytes" FROM "Capture" WHERE UPPER("deviceId") = ${deviceFilter}
      `
    : await prisma.$queryRaw<{ n: number | bigint; bytes: number | bigint | null }[]>`
        SELECT COUNT(*) AS "n", SUM("size") AS "bytes" FROM "Capture"
      `;
  const items = rows.map(toMeta);
  return {
    items,
    nextBefore: cursorOf(rows, page.limit),
    total,
    filtered: Number(agg[0]?.n ?? 0),
    totalSizeKB: Math.round(Number(agg[0]?.bytes ?? 0) / 1024),
    byDevice,
  };
}

// Czyta plik z CAPTURES_DIR jako Buffer. Wraca null gdy nie istnieje / niebezpieczna nazwa.
export async function readCapture(filename: string): Promise<Buffer | null> {
  if (!isSafeFilename(filename)) return null;
  const full = path.join(CAPTURES_DIR, filename);
  // Druga warstwa anty-traversal: po resolve sciezka musi zaczynac sie od CAPTURES_DIR
  const resolved = path.resolve(full);
  if (!resolved.startsWith(path.resolve(CAPTURES_DIR) + path.sep)) return null;
  try {
    return await readFile(resolved);
  } catch {
    return null;
  }
}

// Retencja: usuwa pliki + wiersze starsze niz `days` dni. Env
// CAPTURE_RETENTION_DAYS (domyslnie 180; 0 = wylaczone). Wolane raz na dobe
// z dbInit.startMaintenance().
export function captureRetentionDays(): number {
  const raw = process.env.CAPTURE_RETENTION_DAYS;
  if (raw === undefined || raw === "") return 180;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function purgeOldCaptures(days: number): Promise<number> {
  if (!(days > 0)) return 0;
  await ensureCapturesIndexed();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (;;) {
    const rows = await prisma.$queryRaw<{ filename: string }[]>`
      SELECT "filename" FROM "Capture" WHERE "createdAt" < ${cutoff} ORDER BY "createdAt" ASC LIMIT 500
    `;
    if (!rows.length) break;
    for (const r of rows) {
      if (!isSafeFilename(r.filename)) continue;
      try {
        await unlink(path.join(CAPTURES_DIR, r.filename));
      } catch (e) {
        if ((e as NodeJS.ErrnoException)?.code !== "ENOENT") console.error(`[capture] purge unlink ${r.filename}:`, e);
      }
    }
    const names = rows.map((r) => r.filename);
    await prisma.$executeRawUnsafe(
      `DELETE FROM "Capture" WHERE "filename" IN (${names.map(() => "?").join(",")})`,
      ...names
    );
    removed += rows.length;
    if (rows.length < 500) break;
  }
  if (removed) console.log(`[capture] retencja ${days} dni: usunieto ${removed} zdjec`);
  return removed;
}

// Usuniecie konta (RODO art. 17): zdjecia zrobione, gdy urzadzenie nalezalo do
// tego konta (Capture.userId zapisany w saveCapture). Stare pliki bez wiersza
// w tabeli nie maja wlasciciela-konta — zostaja przy urzadzeniu.
export async function deleteUserCaptures(userId: string): Promise<number> {
  if (!userId) return 0;
  await ensureCapturesIndexed();
  let removed = 0;
  for (;;) {
    const rows = await prisma.$queryRaw<{ filename: string }[]>`
      SELECT "filename" FROM "Capture" WHERE "userId" = ${userId} LIMIT 500
    `;
    if (!rows.length) break;
    for (const r of rows) {
      if (!isSafeFilename(r.filename)) continue;
      try {
        await unlink(path.join(CAPTURES_DIR, r.filename));
      } catch (e) {
        if ((e as NodeJS.ErrnoException)?.code !== "ENOENT") console.error(`[capture] delete unlink ${r.filename}:`, e);
      }
    }
    const names = rows.map((r) => r.filename);
    await prisma.$executeRawUnsafe(
      `DELETE FROM "Capture" WHERE "filename" IN (${names.map(() => "?").join(",")})`,
      ...names
    );
    removed += rows.length;
    if (rows.length < 500) break;
  }
  return removed;
}
