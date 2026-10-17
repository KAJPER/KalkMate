import { prisma } from "@/lib/db";
import { parseOrderQuantity } from "@/lib/checkoutPricing";

// Personalizacja fizycznego zamówienia (kod odblokowania AI wgrywany do TEJ
// konkretnej sztuki przed wysylka + imie/nick na etykiecie) — podstawa dla
// wylaczenia prawa odstapienia od umowy zgodnie z art. 38 pkt 3 ustawy o
// prawach konsumenta ("rzecz ... wyprodukowana wedlug specyfikacji konsumenta
// lub sluzaca zaspokojeniu jego zindywidualizowanych potrzeb"). Kolumny poza
// Prisma schema (jak Device.promptMode, User.tokenBalance) — raw SQL,
// ALTER TABLE wykonywany raz, duplikat kolumny po prostu ignorujemy.
//
// WAZNE: to dziala jako prawna podstawa TYLKO jesli personalizacja jest
// realna — administrator faktycznie wgrywa wybrany kod do tej sztuki i
// drukuje wybrane imie na etykiecie PRZED wyslka. Patrz panel
// /admin/orders — tam widac oba pola do realizacji zamowienia.

let _columnsReady = false;

// Dawniej KAZDY blad ALTER (np. "database is locked" przy rownoleglym zapisie)
// byl brany za "kolumna juz istnieje" i flaga ustawiala sie na true na zawsze —
// kolejne UPDATE/SELECT padaly na braku kolumny do restartu procesu. Teraz
// tylko "duplicate column" = ok; inny blad -> sprawdzamy schemat tabeli.
function isDuplicateColumn(e: unknown): boolean {
  const msg = `${(e as { message?: string } | null)?.message ?? ""} ${String((e as { meta?: { message?: unknown } } | null)?.meta?.message ?? "")}`;
  return /duplicate column/i.test(msg);
}

// Zamowienie wielu sztuk (2026-10-17): "quantity" (ile sztuk, domyslnie 1) i
// "personalizationJson" (JSON [{"code":"1234","name":"Ola"}, …] — jedna pozycja
// na sztuke). personalizedCode/personalizedName = pierwsza sztuka (zgodnosc wstecz).
const ORDER_PERSONALIZATION_COLUMNS: [string, string][] = [
  ["personalizedCode", "TEXT"],
  ["personalizedName", "TEXT"],
  ["quantity", "INTEGER NOT NULL DEFAULT 1"],
  ["personalizationJson", "TEXT"],
];

export async function ensureOrderPersonalizationColumns(): Promise<void> {
  if (_columnsReady) return;
  for (const [col, ddl] of ORDER_PERSONALIZATION_COLUMNS) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN "${col}" ${ddl}`);
    } catch (e) {
      if (isDuplicateColumn(e)) continue; // kolumna juz istnieje — ok
      const cols = await prisma
        .$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("Order")`)
        .catch(() => [] as { name: string }[]);
      if (!cols.some((c) => c.name === col)) {
        console.error(`[orderPersonalization] ALTER TABLE ${col} failed:`, e);
        return; // bez ustawiania flagi — sprobujemy przy nastepnym wywolaniu
      }
    }
  }
  _columnsReady = true;
}

// Walidacja wspolna dla P24/Stripe route'ow — kod to dokladnie 4 cyfry
// (to samo pole co kalkSettings.aiUnlockCode na urzadzeniu), imie 1-40 znakow.
export function validatePersonalization(unlockCode: unknown, personalizeName: unknown):
  | { ok: true; code: string; name: string }
  | { ok: false; error: string } {
  const code = String(unlockCode ?? "").trim();
  // Imie drukuje sie na etykiecie: bez znakow sterujacych / nowych linii.
  const name = String(personalizeName ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (!/^\d{4}$/.test(code)) {
    return { ok: false, error: "Kod odblokowania AI musi mieć dokładnie 4 cyfry." };
  }
  if (!name || name.length > 40) {
    return { ok: false, error: "Podaj imię/nick do etykiety (max 40 znaków)." };
  }
  return { ok: true, code, name };
}

export async function setOrderPersonalization(orderId: string, code: string, name: string): Promise<void> {
  await setOrderUnits(orderId, 1, [{ code, name }]);
}

// === Wiele sztuk w zamowieniu ===

export interface OrderUnit {
  code: string; // 4-cyfrowy kod AI (sekret — nie pokazywac klientowi w mailach)
  name: string; // imie/nick na etykiete
}

// Walidacja body checkoutu (Stripe i P24):
//   nowy format: quantity + personalizations: [{ unlockCode, name }] (dlugosc == quantity)
//   stary format: unlockCode + personalizeName (bez personalizations) = 1 sztuka
export function validateOrderUnits(body: {
  quantity?: unknown;
  personalizations?: unknown;
  unlockCode?: unknown;
  personalizeName?: unknown;
}):
  | { ok: true; quantity: number; units: OrderUnit[] }
  | { ok: false; error: string; reason: "quantity" | "personalization" } {
  const q = parseOrderQuantity(body.quantity);
  if (!q.ok) return { ok: false, error: q.error, reason: "quantity" };
  const quantity = q.quantity;

  if (body.personalizations === undefined || body.personalizations === null) {
    if (quantity !== 1) {
      return { ok: false, error: `Podaj personalizację (kod AI i imię) dla każdej z ${quantity} sztuk.`, reason: "personalization" };
    }
    const p = validatePersonalization(body.unlockCode, body.personalizeName);
    if (!p.ok) return { ok: false, error: p.error, reason: "personalization" };
    return { ok: true, quantity: 1, units: [{ code: p.code, name: p.name }] };
  }

  if (!Array.isArray(body.personalizations)) {
    return { ok: false, error: "Nieprawidłowe dane personalizacji.", reason: "personalization" };
  }
  if (body.personalizations.length !== quantity) {
    return {
      ok: false,
      error: `Liczba personalizacji (${body.personalizations.length}) nie zgadza się z ilością sztuk (${quantity}).`,
      reason: "personalization",
    };
  }
  const units: OrderUnit[] = [];
  for (let i = 0; i < body.personalizations.length; i++) {
    const item = (body.personalizations[i] ?? {}) as Record<string, unknown>;
    const p = validatePersonalization(item.unlockCode ?? item.code, item.name ?? item.personalizeName);
    if (!p.ok) {
      const error = quantity > 1 ? `Sztuka ${i + 1}: ${p.error}` : p.error;
      return { ok: false, error, reason: "personalization" };
    }
    units.push({ code: p.code, name: p.name });
  }
  return { ok: true, quantity, units };
}

// Kompaktowy JSON do kolumny personalizationJson / metadata Stripe.
export function serializeOrderUnits(units: OrderUnit[]): string {
  return JSON.stringify(units.map((u) => ({ code: u.code, name: u.name })));
}

// Parsowanie JSON-a jednostek (kolumna / metadata). Zly format = null.
export function parseOrderUnitsJson(raw: unknown): OrderUnit[] | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    const out: OrderUnit[] = [];
    for (const it of arr) {
      if (!it || typeof it !== "object") return null;
      const o = it as Record<string, unknown>;
      out.push({ code: String(o.code ?? ""), name: String(o.name ?? "") });
    }
    return out;
  } catch {
    return null;
  }
}

// === Metadata Stripe ===
// Stripe: max 500 znakow na wartosc. Budzet liczymy w BAJTACH UTF-8 (>= liczba
// znakow w kazdej interpretacji), z zapasem: 480. Miesci sie -> `personalization`;
// inaczej dzielimy NA GRANICACH SZTUK (kazdy kawalek to poprawna tablica JSON):
// `personalization_1..n` + `personalization_parts` = n. Jedna sztuka to max
// ~145 B (imie 40 znakow), wiec kazda zawsze miesci sie w kawalku.
const STRIPE_META_BUDGET = 480;

export function stripePersonalizationMetadata(units: OrderUnit[]): Record<string, string> {
  const full = serializeOrderUnits(units);
  if (Buffer.byteLength(full, "utf8") <= STRIPE_META_BUDGET) return { personalization: full };
  const parts: string[] = [];
  let cur: OrderUnit[] = [];
  for (const u of units) {
    const next = [...cur, u];
    if (cur.length > 0 && Buffer.byteLength(serializeOrderUnits(next), "utf8") > STRIPE_META_BUDGET) {
      parts.push(serializeOrderUnits(cur));
      cur = [u];
    } else {
      cur = next;
    }
  }
  if (cur.length) parts.push(serializeOrderUnits(cur));
  const out: Record<string, string> = { personalization_parts: String(parts.length) };
  parts.forEach((p, i) => { out[`personalization_${i + 1}`] = p; });
  return out;
}

// Odczyt w webhooku. null = brak/uszkodzone dane nowego formatu (wywolujacy
// spada na personalized_code/personalized_name = 1 sztuka).
export function unitsFromStripeMetadata(meta: Record<string, string | undefined>): OrderUnit[] | null {
  if (meta.personalization) return parseOrderUnitsJson(meta.personalization);
  const n = parseInt(meta.personalization_parts || "", 10);
  if (!Number.isInteger(n) || n < 1 || n > 10) return null;
  const all: OrderUnit[] = [];
  for (let i = 1; i <= n; i++) {
    const part = parseOrderUnitsJson(meta[`personalization_${i}`]);
    if (!part) return null;
    all.push(...part);
  }
  return all;
}

// Zapis ilosci i personalizacji (raw SQL — kolumn nie ma w Prisma schemie).
export async function setOrderUnits(orderId: string, quantity: number, units: OrderUnit[]): Promise<void> {
  await ensureOrderPersonalizationColumns();
  const first = units[0];
  await prisma.$executeRaw`
    UPDATE "Order" SET
      "personalizedCode" = ${first?.code ?? null},
      "personalizedName" = ${first?.name ?? null},
      "quantity" = ${quantity},
      "personalizationJson" = ${serializeOrderUnits(units)}
    WHERE id = ${orderId}
  `;
}

// Ilosc + personalizacje z juz pobranego wiersza "Order" (SELECT * albo
// wybrane kolumny). Brakujace kolumny / stare zamowienia: quantity 1, units z
// personalizationJson, a gdy go brak — z personalizedCode/personalizedName.
// UWAGA: units.length moze byc < quantity (stare zamowienia bez personalizacji
// maja units = []) — uzywaj units[i]?.code. quantity >= units.length zawsze.
export function parseOrderUnitsRow(row: {
  quantity?: unknown;
  personalizationJson?: unknown;
  personalizedCode?: unknown;
  personalizedName?: unknown;
} | null | undefined): { quantity: number; units: OrderUnit[] } {
  if (!row) return { quantity: 1, units: [] };
  let units = parseOrderUnitsJson(row.personalizationJson);
  if (!units) {
    const code = row.personalizedCode == null ? "" : String(row.personalizedCode);
    const name = row.personalizedName == null ? "" : String(row.personalizedName);
    units = code || name ? [{ code, name }] : [];
  }
  const qRaw = typeof row.quantity === "bigint" ? Number(row.quantity) : Number(row.quantity);
  const q = Number.isInteger(qRaw) && qRaw >= 1 ? qRaw : 1;
  return { quantity: Math.max(q, units.length), units };
}

// To samo po id zamowienia. SELECT * — nie wywraca sie na brakujacych
// kolumnach (stara baza); brak zamowienia = { quantity: 1, units: [] }.
// Bledy samej bazy (np. "database is locked") sa rzucane — wywolujacy decyduje.
export async function readOrderUnits(orderId: string): Promise<{ quantity: number; units: OrderUnit[] }> {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT * FROM "Order" WHERE id = ${orderId} LIMIT 1`;
  return parseOrderUnitsRow(rows[0]);
}
