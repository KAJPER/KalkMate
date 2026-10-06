// Kopie zapasowe bazy SQLite (zamowienia, konta, licencje — wszystko w jednym
// pliku na VPS; awaria dysku bez kopii = utrata wszystkiego).
//
// - VACUUM INTO: spojna kopia DZIALAJACEJ bazy (bez zatrzymywania serwera),
//   potem gzip. Pliki w BACKUP_DIR (domyslnie <website>/backups, poza public/).
// - Automatycznie raz na dobe z godzinnego crona (/api/cron/tracking ->
//   ensureDailyBackup), recznie z /admin/backups.
// - Retencja: BACKUP_KEEP_DAYS (domyslnie 30), zawsze min. 7 najnowszych.
// - Kopia poza serwerem: gdy ustawiony BACKUP_RCLONE_REMOTE (np. "gdrive:kalkmate-backups"),
//   kazda nowa kopia idzie tez tam przez `rclone copy` (rclone skonfigurowany na serwerze).
//   Bez tego kopie leza na tym samym dysku co baza — chronia przed bledem/usunieciem
//   danych, ale NIE przed awaria dysku. Wtedy pobieraj je recznie z panelu.

import { prisma } from "@/lib/db";
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "fs";
import { join } from "path";
import { pipeline } from "stream/promises";
import { createGzip } from "zlib";
import { execFile } from "child_process";

export const BACKUP_DIR = process.env.BACKUP_DIR || join(process.cwd(), "backups");
const KEEP_DAYS = Math.max(1, parseInt(process.env.BACKUP_KEEP_DAYS || "30", 10) || 30);
const MIN_KEEP = 7;
const NAME_RE = /^kalkmate-\d{8}-\d{6}\.db\.gz$/;

export interface BackupFile {
  name: string;
  size: number;
  createdAt: string;
}

export function isBackupName(name: string): boolean {
  return NAME_RE.test(name);
}

export function listBackups(): BackupFile[] {
  if (!existsSync(BACKUP_DIR)) return [];
  return readdirSync(BACKUP_DIR)
    .filter(isBackupName)
    .map((name) => {
      const st = statSync(join(BACKUP_DIR, name));
      return { name, size: st.size, createdAt: st.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

let running: Promise<BackupFile> | null = null;

export async function createBackup(): Promise<BackupFile> {
  // Dwa rownoczesne wywolania (cron + klik w panelu) robia jedna kopie.
  if (running) return running;
  running = (async () => {
    mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
    const raw = join(BACKUP_DIR, `kalkmate-${stamp}.db`);
    const gz = `${raw}.gz`;
    try {
      // VACUUM INTO nie przyjmuje parametru — sciezka jako literal (apostrofy podwojone).
      await prisma.$executeRawUnsafe(`VACUUM INTO '${raw.replace(/'/g, "''")}'`);
      await pipeline(createReadStream(raw), createGzip({ level: 9 }), createWriteStream(gz));
    } finally {
      if (existsSync(raw)) unlinkSync(raw);
    }
    const name = gz.split(/[\\/]/).pop()!;
    pruneBackups();
    await uploadOffsite(gz).catch((e) => console.error("[dbBackup] offsite upload failed:", e));
    const st = statSync(gz);
    console.log(`[dbBackup] created ${name} (${st.size} B)`);
    return { name, size: st.size, createdAt: st.mtime.toISOString() };
  })();
  try {
    return await running;
  } finally {
    running = null;
  }
}

export function pruneBackups(): string[] {
  const cutoff = Date.now() - KEEP_DAYS * 86400_000;
  const removed: string[] = [];
  listBackups().forEach((b, i) => {
    if (i >= MIN_KEEP && Date.parse(b.createdAt) < cutoff) {
      unlinkSync(join(BACKUP_DIR, b.name));
      removed.push(b.name);
    }
  });
  return removed;
}

function uploadOffsite(file: string): Promise<void> {
  const remote = process.env.BACKUP_RCLONE_REMOTE;
  if (!remote) return Promise.resolve();
  return new Promise((resolve, reject) => {
    execFile("rclone", ["copy", file, remote], { timeout: 10 * 60_000 }, (err, _out, stderr) =>
      err ? reject(new Error(`${err.message} ${stderr}`.slice(0, 500))) : resolve());
  });
}

// Wolane co godzine z crona: kopia, jesli ostatnia ma ponad 20 h.
export async function ensureDailyBackup(): Promise<BackupFile | null> {
  const last = listBackups()[0];
  if (last && Date.now() - Date.parse(last.createdAt) < 20 * 3600_000) return null;
  return createBackup();
}

export function backupStatus() {
  const list = listBackups();
  return {
    dir: BACKUP_DIR,
    keepDays: KEEP_DAYS,
    offsite: process.env.BACKUP_RCLONE_REMOTE || null,
    lastAt: list[0]?.createdAt ?? null,
    backups: list,
  };
}
