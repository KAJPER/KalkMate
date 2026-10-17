import { prisma } from "@/lib/db";

// Przeliczanie zuzycia OpenRouter na "efektywne tokeny" odejmowane z salda usera.
//
// HISTORIA BLEDU (naprawione 2026-09-18): stara wersja liczyla
// `effectiveTokens = total_tokens * costMultiplier`, gdzie costMultiplier to
// SREDNIA ceny input/output modelu (avg(price_in, price_out) / 1.40). To jest
// poprawne TYLKO gdy zapytanie ma mniej wiecej rowny podzial prompt:completion.
// W praktyce KalkMate to prawie zawsze NIE jest prawda:
//   - /api/device/solve wysyla max_tokens: 16000 i prosi o pelne rozwiazanie
//     krok po kroku -> completion_tokens >>> prompt_tokens (zdjecie zadania to
//     relatywnie mało tokenow, odpowiedz to czesto tysiace).
//   - ceny modeli maja completion 4-6x wyzsze niz prompt (patrz aiModels.ts),
//     wiec kiedy completion dominuje total_tokens, prawdziwy koszt jest BLISKO
//     ceny completion, a nie sredniej -> system systematycznie NIEDOSZACOWAC
//     realny koszt i pobiera userowi za malo tokenow wzgledem tego, ile
//     naprawde kosztuje to OpenRouter (obserwacja: 40 zl realnie vs 26 zl
//     pokazane w panelu -> ~35% niedoszacowania, dokladnie w te strone co
//     przewiduje ten mechanizm).
//
// FIX: OpenRouter od pewnego czasu ZAWSZE zwraca w kazdej odpowiedzi
// (bez zadnych dodatkowych parametrow) usage.cost — realny koszt w USD tego
// konkretnego zapytania (uwzglednia faktyczny podzial prompt/completion oraz
// realne ceny modelu, cache itp.). Uzywamy TEGO wprost zamiast liczyc szacunek
// z costMultiplier. costMultiplier zostaje tylko jako fallback (np. gdyby
// OpenRouter kiedys nie zwrocil usage.cost dla jakiegos modelu) i jako baza
// do etykiet "×" w panelu wyboru modelu.

// 1M "efektywnych tokenow" = $1.40 realnego kosztu API (kalibracja niezalezna
// od modelu — patrz komentarz w aiModels.ts).
export const EFFECTIVE_TOKEN_USD = 1.40 / 1_000_000;

export interface OpenRouterUsage {
  total_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  cost?: number; // realny koszt w USD/kredytach OpenRouter tego zapytania
}

// Zwraca liczbe efektywnych tokenow do odjecia z salda usera. Preferuje
// realny koszt (usage.cost) zwrocony przez OpenRouter; spada na stary
// szacunek (total_tokens * costMultiplier) TYLKO gdy cost jest nieobecny
// lub <= 0 (np. blad/model bez raportowania kosztu).
export function effectiveTokensFromUsage(
  usage: OpenRouterUsage | null | undefined,
  costMultiplier: number
): { effectiveTokens: number; source: "real_cost" | "estimate" } {
  const realCost = Number(usage?.cost);
  if (Number.isFinite(realCost) && realCost > 0) {
    return { effectiveTokens: Math.ceil(realCost / EFFECTIVE_TOKEN_USD), source: "real_cost" };
  }
  const totalTokens = Number(usage?.total_tokens) || 0;
  return { effectiveTokens: Math.ceil(totalTokens * costMultiplier), source: "estimate" };
}

// ===========================================================================
// Rezerwacja salda (audyt 2026-10-16)
// ===========================================================================
// Wczesniej: prog "saldo >= 1000" przed zapytaniem + odjecie PO odpowiedzi z
// MAX(0, ...). Rownolegle zapytania przy niskim saldzie przechodzily wszystkie
// i wiekszosc kosztu byla "za darmo". Teraz:
//   1. przed wywolaniem AI atomowo rezerwujemy szacunek (UPDATE ... WHERE
//      saldo >= est) — brak rezerwacji = 402,
//   2. po odpowiedzi rozliczamy roznice (zwrot nadwyzki albo doplata do MAX 0),
//   3. przy bledzie upstream / pustej odpowiedzi zwracamy cala rezerwacje.

// Zgrubny szacunek tokenow wejscia: tekst ~3 znaki/token (konserwatywnie dla
// polskiego), obraz — staly koszt (Gemini ~258/kafelek, Claude/GPT do ~1600).
export const IMAGE_INPUT_TOKENS_ESTIMATE = 1500;
export function estimateInputTokens(textChars: number, imageCount: number): number {
  return Math.ceil(Math.max(0, textChars) / 3) + Math.max(0, imageCount) * IMAGE_INPUT_TOKENS_ESTIMATE;
}

// Szacunek efektywnych tokenow do zarezerwowania: (wejscie + max_tokens) x mnoznik modelu.
export function estimateReservation(
  inputTokens: number,
  maxOutputTokens: number,
  costMultiplier: number
): number {
  const mult = Number.isFinite(costMultiplier) && costMultiplier > 0 ? costMultiplier : 1;
  return Math.max(1, Math.ceil((Math.max(0, inputTokens) + Math.max(0, maxOutputTokens)) * mult));
}

export type ReserveResult = "ok" | "insufficient" | "db_error";

export async function reserveTokens(userId: string, amount: number): Promise<ReserveResult> {
  try {
    const n = await prisma.$executeRaw`
      UPDATE "User" SET "tokenBalance" = "tokenBalance" - ${amount}
      WHERE "id" = ${userId} AND "tokenBalance" >= ${amount}
    `;
    return n > 0 ? "ok" : "insufficient";
  } catch (e) {
    console.error("[aiCost] reserve fail:", e);
    return "db_error";
  }
}

// Rozliczenie po odpowiedzi: actual > reserved -> doplata (do MAX 0),
// actual < reserved -> zwrot nadwyzki. Nie rzuca.
export async function settleTokens(userId: string, reserved: number, actual: number): Promise<void> {
  const diff = Math.ceil(actual) - reserved;
  try {
    if (diff > 0) {
      await prisma.$executeRaw`
        UPDATE "User" SET "tokenBalance" = MAX(0, "tokenBalance" - ${diff}) WHERE "id" = ${userId}
      `;
    } else if (diff < 0) {
      await prisma.$executeRaw`
        UPDATE "User" SET "tokenBalance" = "tokenBalance" + ${-diff} WHERE "id" = ${userId}
      `;
    }
  } catch (e) {
    console.error(`[aiCost] settle fail user=${userId} reserved=${reserved} actual=${actual}:`, e);
  }
}

export async function refundTokens(userId: string, reserved: number): Promise<void> {
  if (reserved <= 0) return;
  await settleTokens(userId, reserved, 0);
}

// Odczyt salda. null = blad bazy (wolajacy zwraca 503, nie 402).
export async function readTokenBalance(userId: string): Promise<number | null> {
  try {
    const rows = await prisma.$queryRaw<{ tokenBalance: number | bigint | null }[]>`
      SELECT "tokenBalance" FROM "User" WHERE "id" = ${userId} LIMIT 1
    `;
    return Number(rows?.[0]?.tokenBalance ?? 0);
  } catch (e) {
    console.error("[aiCost] balance read fail:", e);
    return null;
  }
}

// ===========================================================================
// Waznosc subskrypcji (kontrakt K2)
// ===========================================================================
// status "active" jest wazny tylko gdy okres nie minal (stripeCurrentPeriodEnd
// null albo w przyszlosci) — licencje/odnowienia ustawiaja koniec okresu.
// "trial" — do trialEndsAt.
export function isSubscriptionValid(
  sub: { status: string; trialEndsAt: Date | null; stripeCurrentPeriodEnd: Date | null } | null | undefined,
  now: Date = new Date()
): boolean {
  if (!sub) return false;
  if (sub.status === "active") {
    return !sub.stripeCurrentPeriodEnd || new Date(sub.stripeCurrentPeriodEnd).getTime() > now.getTime();
  }
  if (sub.status === "trial") {
    return !!sub.trialEndsAt && new Date(sub.trialEndsAt).getTime() > now.getTime();
  }
  return false;
}

// ===========================================================================
// Dzienny budzet dla trybu license-only (urzadzenie bez konta -> brak salda)
// ===========================================================================
// Tabela DeviceDailyUsage poza Prisma schema (leniwie, wzorem Coupon):
//   scope   'license' | 'device'
//   subject kod licencji albo deviceId
//   day     YYYY-MM-DD (czas Europe/Warsaw)
//   tokens  suma efektywnych tokenow danego dnia
export function licenseDailyTokenLimit(): number {
  const n = parseInt(process.env.LICENSE_DAILY_TOKEN_LIMIT || "", 10);
  return Number.isFinite(n) && n > 0 ? n : 300_000;
}

export function usageDay(d: Date = new Date()): string {
  // sv-SE formatuje jako YYYY-MM-DD
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

let _usageTableReady = false;
export async function ensureDailyUsageTable(): Promise<void> {
  if (_usageTableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DeviceDailyUsage" (
      "scope"    TEXT NOT NULL,
      "subject"  TEXT NOT NULL,
      "day"      TEXT NOT NULL,
      "tokens"   INTEGER NOT NULL DEFAULT 0,
      "requests" INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY ("scope", "subject", "day")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "DeviceDailyUsage_day" ON "DeviceDailyUsage" ("day")`
  );
  _usageTableReady = true;
}

export async function getDailyUsage(scope: "license" | "device", subject: string, day = usageDay()): Promise<number> {
  await ensureDailyUsageTable();
  const rows = await prisma.$queryRaw<{ tokens: number | bigint }[]>`
    SELECT "tokens" FROM "DeviceDailyUsage"
    WHERE "scope" = ${scope} AND "subject" = ${subject} AND "day" = ${day} LIMIT 1
  `;
  return Number(rows?.[0]?.tokens ?? 0);
}

export async function addDailyUsage(
  scope: "license" | "device",
  subject: string,
  tokens: number,
  day = usageDay()
): Promise<void> {
  await ensureDailyUsageTable();
  const t = Math.max(0, Math.ceil(tokens));
  await prisma.$executeRaw`
    INSERT INTO "DeviceDailyUsage" ("scope", "subject", "day", "tokens", "requests")
    VALUES (${scope}, ${subject}, ${day}, ${t}, 1)
    ON CONFLICT("scope", "subject", "day") DO UPDATE SET
      "tokens" = "tokens" + ${t}, "requests" = "requests" + 1
  `;
}

export async function purgeOldDailyUsage(keepDays = 90): Promise<number> {
  await ensureDailyUsageTable();
  const cutoff = usageDay(new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000));
  return prisma.$executeRaw`DELETE FROM "DeviceDailyUsage" WHERE "day" < ${cutoff}`;
}
