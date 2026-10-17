import { prisma } from "@/lib/db";
import { ensureCaptureTable, ensureCapturesIndexed, purgeOldCaptures, captureRetentionDays } from "@/lib/captures";
import { ensureDailyUsageTable, purgeOldDailyUsage } from "@/lib/aiCost";
import { ensureDeviceTokenHashColumn } from "@/lib/device-auth";

// Inicjalizacja bazy przy starcie serwera (wolane z src/instrumentation.ts).
//
// Baza produkcyjna NIE jest zarzadzana migracjami Prismy — czesc kolumn
// istnieje tylko dzieki recznym/leniwym ALTER TABLE i jest uzywana wylacznie
// przez $queryRaw/$executeRaw (patrz komentarz na gorze prisma/schema.prisma).
// ensureSchema() idempotentnie dodaje brakujace kolumny (PRAGMA table_info),
// ustawia PRAGMA dla SQLite i zaklada indeksy. Nic tu nie usuwa ani nie
// przepisuje danych.

type ColumnSpec = [column: string, ddl: string];

// Kolumny uzywane raw SQL-em w website/src (grep $queryRaw/$executeRaw).
// Typy/defaulty zgodne z uzyciem w kodzie. Kolumny obecne tez w schema.prisma
// (np. Device.unlockCode/deviceToken) sa tu dla starszych kopii bazy — ALTER
// wykona sie tylko gdy kolumny brak.
const RAW_COLUMNS: Record<string, ColumnSpec[]> = {
  User: [
    ["tokenBalance", "INTEGER DEFAULT 0"], // saldo efektywnych tokenow AI
    ["aiModel", "TEXT"],                   // wybrany model OpenRouter ("default" | "<vendor>/<model>")
    ["aiMode", "TEXT"],                    // "matura" | "raw"
  ],
  Device: [
    ["unlockCode", "TEXT"],
    ["deviceToken", "TEXT"],
    ["deviceTokenHash", "TEXT"],          // sha256(deviceToken) hex — lib/device-auth.ts
    ["promptMode", "TEXT"],               // legacy per-device tryb prompta
    ["failedPairs", "INTEGER DEFAULT 0"], // anty brute-force parowania
    ["lockedUntil", "TEXT"],              // ISO — blokada parowania
    ["rentalUntil", "DATETIME"],          // lib/deviceRental.ts
    ["rentalLocked", "INTEGER DEFAULT 0"],
    ["firmwareVersion", "TEXT"],
    ["lastIp", "TEXT"],
  ],
  Order: [
    ["personalizedCode", "TEXT"], // lib/orderPersonalization.ts
    ["personalizedName", "TEXT"],
    ["quantity", "INTEGER NOT NULL DEFAULT 1"], // zamowienie wielu sztuk
    ["personalizationJson", "TEXT"],             // [{"code","name"}] per sztuka
  ],
  Visit: [
    ["host", "TEXT"],
    ["landing", "INTEGER"], // lib/attribution.ts
    ["channel", "TEXT"],
    ["source", "TEXT"],
    ["medium", "TEXT"],
    ["campaign", "TEXT"],
  ],
  EmailVerification: [
    ["targetEmail", "TEXT"], // migracja 20260624000002
  ],
};

// [nazwa, tabela, kolumny] — tworzone tylko gdy tabela i wszystkie kolumny istnieja.
const INDEXES: [string, string, string[]][] = [
  ["DeviceSolve_createdAt_idx", "DeviceSolve", ["createdAt"]],
  ["ChatMessage_role_createdAt_idx", "ChatMessage", ["role", "createdAt"]],
  ["Visit_createdAt_idx", "Visit", ["createdAt"]],
];

// Tabele z prisma/schema.prisma, ktore NIGDY nie przeszly przez migracje (brak
// pliku w prisma/migrations/) — dodane 2026-10-16 wraz z /panel (Note, Test),
// ale dbInit.ts tworzyl dotad tylko kolumny w istniejacych tabelach. Bez tego
// prisma.note.findMany()/prisma.test.findMany() rzuca P2021 "table does not
// exist" (zweryfikowane na produkcji po przelaczeniu wersji 2026-10-17).
// DDL zgodny ze stylem istniejacych migracji (patrz np. 20260222005742_add_conversations).
const TABLES: [name: string, createSql: string, indexes: [string, string][]][] = [
  [
    "Note",
    `CREATE TABLE "Note" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "title" TEXT NOT NULL DEFAULT '',
      "content" TEXT NOT NULL DEFAULT '',
      "position" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    [["Note_userId_position_idx", `"userId", "position"`]],
  ],
  [
    "Test",
    `CREATE TABLE "Test" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "title" TEXT NOT NULL DEFAULT '',
      "content" TEXT NOT NULL DEFAULT '',
      "position" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Test_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    [["Test_userId_position_idx", `"userId", "position"`]],
  ],
];

async function tableColumns(table: string): Promise<Set<string> | null> {
  const rows = await prisma.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("${table}")`);
  if (!rows.length) return null; // tabela nie istnieje
  return new Set(rows.map((r) => r.name));
}

async function pragma(sql: string): Promise<void> {
  try {
    // PRAGMA zwraca wiersz — $executeRaw w SQLite odrzuca zapytania z wynikiem.
    await prisma.$queryRawUnsafe(sql);
  } catch (e) {
    console.error(`[dbInit] ${sql} fail:`, e);
  }
}

let _schemaPromise: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!_schemaPromise) {
    _schemaPromise = runEnsureSchema().catch((e) => {
      console.error("[dbInit] ensureSchema fail:", e);
      _schemaPromise = null;
    });
  }
  return _schemaPromise;
}

async function runEnsureSchema(): Promise<void> {
  // journal_mode=WAL jest trwaly (zapisany w pliku bazy). busy_timeout i
  // synchronous dzialaja per polaczenie — tu ustawiamy je dla polaczenia z
  // puli, ktore wykona te zapytania (best effort).
  await pragma(`PRAGMA journal_mode=WAL`);
  await pragma(`PRAGMA busy_timeout=5000`);
  await pragma(`PRAGMA synchronous=NORMAL`);

  for (const [table, cols] of Object.entries(RAW_COLUMNS)) {
    const have = await tableColumns(table);
    if (!have) {
      console.warn(`[dbInit] tabela "${table}" nie istnieje — pomijam kolumny`);
      continue;
    }
    for (const [column, ddl] of cols) {
      if (have.has(column)) continue;
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${ddl}`);
        console.log(`[dbInit] dodano kolumne ${table}.${column}`);
      } catch (e) {
        console.error(`[dbInit] ALTER ${table}.${column} fail:`, e);
      }
    }
  }

  for (const [table, createSql, indexes] of TABLES) {
    const have = await tableColumns(table);
    if (have) continue; // tabela juz istnieje — nic do zrobienia
    try {
      await prisma.$executeRawUnsafe(createSql);
      console.log(`[dbInit] utworzono tabele ${table}`);
      for (const [idxName, cols] of indexes) {
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "${idxName}" ON "${table}" (${cols})`);
      }
    } catch (e) {
      console.error(`[dbInit] CREATE TABLE ${table} fail:`, e);
    }
  }

  for (const [name, table, cols] of INDEXES) {
    const have = await tableColumns(table);
    if (!have || !cols.every((c) => have.has(c))) continue;
    try {
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "${name}" ON "${table}" (${cols.map((c) => `"${c}"`).join(", ")})`
      );
    } catch (e) {
      console.error(`[dbInit] index ${name} fail:`, e);
    }
  }

  // Tabele poza Prisma schema tworzone przez moduly (idempotentne).
  await ensureDeviceTokenHashColumn();
  await ensureCaptureTable();
  await ensureDailyUsageTable();
}

// --- Zadania okresowe (raz na dobe) ---------------------------------------
const DAY_MS = 24 * 60 * 60 * 1000;

async function runMaintenance(): Promise<void> {
  try {
    await ensureCapturesIndexed();
    await purgeOldCaptures(captureRetentionDays());
  } catch (e) {
    console.error("[dbInit] capture retention fail:", e);
  }
  try {
    await purgeOldDailyUsage(90);
  } catch (e) {
    console.error("[dbInit] daily usage purge fail:", e);
  }
}

export function startMaintenance(): void {
  const g = globalThis as unknown as { __kalkMaintenanceStarted?: boolean };
  if (g.__kalkMaintenanceStarted) return;
  g.__kalkMaintenanceStarted = true;
  // Pierwszy przebieg chwile po starcie (nie spowalnia rozruchu), potem co dobe.
  const first = setTimeout(() => void runMaintenance(), 60_000);
  first.unref?.();
  const every = setInterval(() => void runMaintenance(), DAY_MS);
  every.unref?.();
}

export async function initDatabase(): Promise<void> {
  await ensureSchema();
  startMaintenance();
}
