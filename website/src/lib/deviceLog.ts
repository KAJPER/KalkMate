import { prisma } from "@/lib/db";

// Logi zdarzen z kalkulatora (src/event_log.h) — dolaczane do kazdego
// POST /api/device/register (patrz route.ts), NIE pelne lustro Serial,
// tylko wazne zdarzenia (boot/reset reason, awarie WiFi/TLS, kamera).
//
// Format pojedynczej linii z urzadzenia: "<epoch_sekundy_lub_0>|<tag>|<msg>".
// epoch=0 gdy NTP jeszcze nie bylo zsynchronizowane w momencie zdarzenia —
// wtedy deviceTs zostaje NULL, a receivedAt (zawsze pewne, zegar serwera)
// to jedyna wiarygodna data. deviceTs trzymany w ms (spojnie z reszta bazy —
// patrz komentarz w dbInit.ts), mimo ze urzadzenie wysyla sekundy.
//
// Audyt 2026-10-16 nauczyl: kolumny z duzymi liczbami (ms epoch) MUSZA byc
// BIGINT, nie INTEGER — Prisma >=6.19.3 odrzuca INTEGER przy wartosciach
// > 2^31 (patrz git blame src/lib/captures.ts, ta sama naprawa).

export interface DeviceLogEntry {
  id: number;
  deviceId: string;
  deviceTs: number | null; // epoch ms, wg zegara urzadzenia (moze byc niedokladny)
  receivedAt: number; // epoch ms, wg zegara serwera
  tag: string;
  message: string;
}

const MAX_LOGS_PER_DEVICE = 500; // retencja per urzadzenie — stare wpisy przycinane po zapisie
const MAX_TAG_LEN = 16;
const MAX_MSG_LEN = 200;

let _tableReady = false;
export async function ensureDeviceLogTable(): Promise<void> {
  if (_tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DeviceLog" (
      "id"         INTEGER PRIMARY KEY AUTOINCREMENT,
      "deviceId"   TEXT NOT NULL,
      "deviceTs"   BIGINT,
      "receivedAt" BIGINT NOT NULL,
      "tag"        TEXT NOT NULL,
      "message"    TEXT NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "DeviceLog_deviceId_receivedAt" ON "DeviceLog" ("deviceId", "receivedAt")`
  );
  _tableReady = true;
}

// Parsuje body.logs (string wieloliniowy z urzadzenia) i zapisuje wiersze +
// przycina retencje tego urzadzenia. Nie rzuca — bledne/puste linie sa
// po cichu pomijane (nie blokuja reszty rejestracji urzadzenia).
export async function storeDeviceLogs(deviceId: string, raw: string | undefined | null): Promise<number> {
  if (!raw || !raw.trim()) return 0;
  await ensureDeviceLogTable();

  const now = Date.now();
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 100); // max 100 linii/rejestracje — anty-spam
  let inserted = 0;
  for (const line of lines) {
    const p1 = line.indexOf("|");
    const p2 = p1 >= 0 ? line.indexOf("|", p1 + 1) : -1;
    if (p1 < 0 || p2 < 0) continue;
    const epochSec = parseInt(line.slice(0, p1), 10);
    const tag = line.slice(p1 + 1, p2).trim().slice(0, MAX_TAG_LEN) || "?";
    const message = line.slice(p2 + 1).trim().slice(0, MAX_MSG_LEN);
    if (!message) continue;
    const deviceTs = Number.isFinite(epochSec) && epochSec > 0 ? epochSec * 1000 : null;
    try {
      await prisma.$executeRaw`
        INSERT INTO "DeviceLog" ("deviceId", "deviceTs", "receivedAt", "tag", "message")
        VALUES (${deviceId}, ${deviceTs}, ${now}, ${tag}, ${message})
      `;
      inserted++;
    } catch (e) {
      console.error("[deviceLog] insert fail:", e);
    }
  }

  if (inserted > 0) {
    // Retencja: zostaw tylko MAX_LOGS_PER_DEVICE najnowszych dla tego urzadzenia.
    try {
      await prisma.$executeRaw`
        DELETE FROM "DeviceLog" WHERE "deviceId" = ${deviceId} AND "id" NOT IN (
          SELECT "id" FROM "DeviceLog" WHERE "deviceId" = ${deviceId}
          ORDER BY "receivedAt" DESC LIMIT ${MAX_LOGS_PER_DEVICE}
        )
      `;
    } catch (e) {
      console.error("[deviceLog] retention prune fail:", e);
    }
  }
  return inserted;
}

export async function listDeviceLogs(deviceId: string, limit = 200): Promise<DeviceLogEntry[]> {
  await ensureDeviceLogTable();
  return prisma.$queryRaw<DeviceLogEntry[]>`
    SELECT "id", "deviceId", "deviceTs", "receivedAt", "tag", "message"
    FROM "DeviceLog" WHERE "deviceId" = ${deviceId}
    ORDER BY "receivedAt" DESC LIMIT ${limit}
  `;
}
