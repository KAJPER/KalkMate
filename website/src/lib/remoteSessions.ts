import { prisma } from "@/lib/db";

// Zdalna pomoc — live podglad ekranu kalkulatora + zdalne "naciskanie" klawiszy
// z panelu admina. Wzorem Coupon/TokenPurchase: tabela poza Prisma schema,
// tworzona lazy raw SQL (CREATE TABLE IF NOT EXISTS).
//
// Firmware wchodzi w ten tryb przez Ustawienia -> Zdalna pomoc (jawna zgoda
// uzytkownika, widoczny kwadracik w rogu ekranu przez caly czas trwania
// sesji — patrz src/remote_session.h). Kalkulator odpytuje
// POST /api/device/remote/checkin co ~500ms: wysyla biezacy zrzut ekranu
// (2048 B, 1bpp, format u8g2 "vertical_top_lsb" — u8g2.getBufferPtr()) i
// odbiera ewentualny oczekujacy klawisz do "wcisniecia".
//
// Sesja wygasa automatycznie (expiresAt) — admin moze ja tez recznie
// zatrzymac. Jeden pendingKey na raz (kolejny nadpisuje niedostarczony).

export interface RemoteSessionRow {
  deviceId: string;
  active: number;       // 0 | 1
  expiresAt: string;     // ISO
  pendingKey: number | null;
  frame: string | null;  // base64, 2048 B surowego bufora OLED
  frameAt: string | null;
  createdAt: string;
}

let _tableReady = false;

export async function ensureRemoteSessionTable(): Promise<void> {
  if (_tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS RemoteSession (
      deviceId   TEXT PRIMARY KEY,
      active     INTEGER NOT NULL DEFAULT 0,
      expiresAt  TEXT NOT NULL,
      pendingKey INTEGER,
      frame      TEXT,
      frameAt    TEXT,
      createdAt  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  _tableReady = true;
}

const SESSION_MINUTES = 10; // auto-wygasniecie, niezaleznie od reczne "stop"

export async function startRemoteSession(deviceId: string): Promise<void> {
  await ensureRemoteSessionTable();
  const expiresAt = new Date(Date.now() + SESSION_MINUTES * 60_000).toISOString();
  await prisma.$executeRaw`
    INSERT INTO RemoteSession (deviceId, active, expiresAt, pendingKey, frame, frameAt, createdAt)
    VALUES (${deviceId}, 1, ${expiresAt}, NULL, NULL, NULL, ${new Date().toISOString()})
    ON CONFLICT(deviceId) DO UPDATE SET
      active = 1, expiresAt = ${expiresAt}, pendingKey = NULL, frame = NULL, frameAt = NULL
  `;
}

export async function stopRemoteSession(deviceId: string): Promise<void> {
  await ensureRemoteSessionTable();
  await prisma.$executeRaw`UPDATE RemoteSession SET active = 0 WHERE deviceId = ${deviceId}`;
}

export async function getRemoteSession(deviceId: string): Promise<RemoteSessionRow | null> {
  await ensureRemoteSessionTable();
  const rows = await prisma.$queryRaw<RemoteSessionRow[]>`
    SELECT deviceId, active, expiresAt, pendingKey, frame, frameAt, createdAt
    FROM RemoteSession WHERE deviceId = ${deviceId} LIMIT 1
  `;
  return rows[0] ?? null;
}

// Czy sesja jest aktywna I nie wygasla (uzywane zarowno przez checkin z
// urzadzenia jak i przez GET frame w panelu, zeby oba zawsze zgadzaly sie
// co do stanu).
export function isSessionLive(row: RemoteSessionRow | null): boolean {
  if (!row || !row.active) return false;
  return new Date(row.expiresAt).getTime() > Date.now();
}

export async function setRemoteFrame(deviceId: string, frameBase64: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE RemoteSession SET frame = ${frameBase64}, frameAt = ${new Date().toISOString()}
    WHERE deviceId = ${deviceId}
  `;
}

export async function setPendingKey(deviceId: string, key: number): Promise<void> {
  await ensureRemoteSessionTable();
  await prisma.$executeRaw`UPDATE RemoteSession SET pendingKey = ${key} WHERE deviceId = ${deviceId}`;
}

// Odczyt + natychmiastowe skasowanie (dostarcz dokladnie raz).
export async function consumePendingKey(deviceId: string): Promise<number | null> {
  const row = await getRemoteSession(deviceId);
  if (!row || row.pendingKey === null || row.pendingKey === undefined) return null;
  await prisma.$executeRaw`UPDATE RemoteSession SET pendingKey = NULL WHERE deviceId = ${deviceId}`;
  return row.pendingKey;
}
