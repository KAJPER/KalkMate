import { prisma } from "@/lib/db";
import { LICENSE_TOKENS } from "@/lib/tokenGrants";

// Model tokenowy (2026-10): licencja z pudelka kalkulatora = jednorazowe
// doladowanie LICENSE_TOKENS na konto, ktore ja aktywuje. Wspolne dla
// POST /api/user/license/claim i POST /api/subscription/redeem.
//
// Jednorazowosc: kolumna License."tokensGrantedAt" (poza Prisma schema,
// leniwie — patrz tez lib/dbInit.ts). Przyznanie tokenow = warunkowy UPDATE
// licencji (isUsed = 0 AND tokensGrantedAt IS NULL AND nie nalezy do innego
// konta) + UPDATE salda w JEDNEJ transakcji. Licencje wykorzystane w starym
// modelu (isUsed = 1) nie dostaja tokenow wstecz.

let _colReady = false;
export async function ensureLicenseTokensColumn(): Promise<void> {
  if (_colReady) return;
  try {
    const cols = await prisma.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("License")`);
    if (!cols.some((c) => c.name === "tokensGrantedAt")) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "License" ADD COLUMN "tokensGrantedAt" TEXT`);
    }
    _colReady = true;
  } catch (e) {
    // Rownolegly ALTER z innego zadania ("duplicate column") — kolumna jest.
    const msg = String((e as any)?.message || e);
    if (/duplicate column/i.test(msg)) {
      _colReady = true;
      return;
    }
    console.error("[licenseTokens] ensure column fail:", e);
    throw e;
  }
}

export async function readLicenseTokensGrantedAt(licenseId: string): Promise<string | null> {
  await ensureLicenseTokensColumn();
  const rows = await prisma.$queryRaw<{ tokensGrantedAt: string | null }[]>`
    SELECT "tokensGrantedAt" FROM "License" WHERE "id" = ${licenseId} LIMIT 1
  `;
  return rows?.[0]?.tokensGrantedAt ?? null;
}

export type LicenseActivation =
  | { ok: false; reason: "invalid" }
  | {
      ok: true;
      code: string;
      tokensGranted: number;
      tokenBalance: number;
      alreadyActivated: boolean;
      message: string;
    };

export const LICENSE_INVALID_MSG = "Nieprawidłowy lub niedostępny kod licencji";

function fmtTokens(n: number): string {
  return n % 1_000_000 === 0 ? `${n / 1_000_000} mln` : n.toLocaleString("pl-PL");
}

export async function activateLicenseForTokens(userId: string, rawCode: string): Promise<LicenseActivation> {
  const code = String(rawCode || "").trim().toLowerCase();
  if (!code) return { ok: false, reason: "invalid" };

  await ensureLicenseTokensColumn();

  const license = await prisma.license.findUnique({ where: { code } });
  if (!license) return { ok: false, reason: "invalid" };
  // Licencja innego konta — ten sam komunikat (anty-enumeracja).
  if (
    (license.claimedByUserId && license.claimedByUserId !== userId) ||
    (license.usedBy && license.usedBy !== userId)
  ) {
    return { ok: false, reason: "invalid" };
  }

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    // Warunkowe "zajecie" przyznania — tylko pierwsza aktywacja nieuzytej
    // licencji. Dwa rownolegle zadania: wygrywa jedno (drugie = 0 wierszy).
    const granted = await tx.$executeRaw`
      UPDATE "License" SET "tokensGrantedAt" = ${now.toISOString()}
      WHERE "id" = ${license.id}
        AND "isUsed" = 0
        AND "tokensGrantedAt" IS NULL
        AND ("claimedByUserId" IS NULL OR "claimedByUserId" = ${userId})
        AND ("usedBy" IS NULL OR "usedBy" = ${userId})
    `;
    // Przypiecie do konta (takze przy ponownej aktywacji tego samego kodu
    // przez to samo konto — idempotentne). Warunek wlasciciela w WHERE.
    const claimed = await tx.license.updateMany({
      where: {
        id: license.id,
        AND: [
          { OR: [{ claimedByUserId: null }, { claimedByUserId: userId }] },
          { OR: [{ usedBy: null }, { usedBy: userId }] },
        ],
      },
      data: {
        claimedByUserId: userId,
        isUsed: true,
        usedBy: userId,
        usedAt: license.usedAt ?? now,
      },
    });
    if (claimed.count !== 1) {
      // Wyscig z innym kontem — wycofaj cala transakcje.
      throw new LicenseRaceError();
    }
    const tokensGranted = Number(granted) === 1 ? LICENSE_TOKENS : 0;
    if (tokensGranted > 0) {
      await tx.$executeRaw`
        UPDATE "User" SET "tokenBalance" = COALESCE("tokenBalance", 0) + ${tokensGranted}
        WHERE "id" = ${userId}
      `;
    }
    const rows = await tx.$queryRaw<{ tokenBalance: number | bigint | null }[]>`
      SELECT "tokenBalance" FROM "User" WHERE "id" = ${userId} LIMIT 1
    `;
    return { tokensGranted, tokenBalance: Number(rows?.[0]?.tokenBalance ?? 0) };
  }).catch((e) => {
    if (e instanceof LicenseRaceError) return null;
    throw e;
  });

  if (!result) return { ok: false, reason: "invalid" };

  const alreadyActivated = result.tokensGranted === 0;
  return {
    ok: true,
    code: license.code,
    tokensGranted: result.tokensGranted,
    tokenBalance: result.tokenBalance,
    alreadyActivated,
    message: alreadyActivated
      ? "Ta licencja była już wcześniej aktywowana — tokeny przyznaje się tylko raz na licencję."
      : `Licencja aktywowana! Dodano ${fmtTokens(result.tokensGranted)} tokenów AI do Twojego konta.`,
  };
}

class LicenseRaceError extends Error {}
