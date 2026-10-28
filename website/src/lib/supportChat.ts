// Czat z asystentem AI dla klientow na stronie (SupportWidget) — rozmowy
// widoczne dla admina w /admin/support.
//
// - Start rozmowy wymaga e-maila, akceptacji regulaminu czatu (regulamin §8)
//   i potwierdzenia "jestem czlowiekiem" = proof-of-work w przegladarce
//   (bez zewnetrznej captchy: zero dodatkowych cookies, kluczy i transferu
//   danych do trzecich firm). Do tego honeypot i limity per IP.
// - Przebieg wizyty (odwiedzane podstrony/sekcje) zapisujemy przy rozmowie
//   TYLKO, gdy klient zgodzil sie na cookies analityczne — przegladarka bez
//   zgody w ogole go nie zbiera i nie wysyla (SupportWidget). Bez zgody
//   znamy tylko strone, z ktorej pisze (czesc samego zapytania).
// - Model nie ma dostepu do bazy (zamowienia/konta) — publiczny czat nie moze
//   ujawnic cudzych danych; sprawy zamowien kieruje na kontakt@kalkmate.pl.
// Tabele poza Prisma (raw SQL, tworzone leniwie) — jak AdminSession.

import { createHmac, createHash, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { KALKMATE_KNOWLEDGE } from "@/lib/mailReply";
import { SHOP_FACTS } from "@/lib/adminAssistant";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const SUPPORT_MODEL = process.env.SUPPORT_CHAT_MODEL || process.env.MAILBOX_REPLY_MODEL || "google/gemini-3.8-flash";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export const SUPPORT_LIMITS = {
  messageChars: 1000,
  userMessagesPerChat: 40,
  historyForModel: 20,
  journeyEntries: 60,
  retentionDays: 365,
};

// ---------------------------------------------------------------------------
// Podpisy (token rozmowy, wyzwanie PoW)
// ---------------------------------------------------------------------------
function secret(): string {
  const s = process.env.SUPPORT_CHAT_SECRET || process.env.ADMIN_SESSION_TOKEN;
  if (!s) throw new Error("SUPPORT_CHAT_SECRET / ADMIN_SESSION_TOKEN not configured");
  return s;
}

function sign(purpose: string, value: string): string {
  return createHmac("sha256", secret()).update(`${purpose}:${value}`).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(a) || !/^[0-9a-f]{64}$/.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

// Token przegladarki do jej wlasnej rozmowy (bez niego nie da sie czytac/pisac).
export function chatToken(chatId: string): string {
  return sign("support-chat", chatId);
}

export function chatTokenValid(chatId: string, token: unknown): boolean {
  return typeof token === "string" && safeEqualHex(chatToken(chatId), token);
}

// Proof-of-work: przegladarka szuka nonce, dla ktorego
// sha256("<challenge>:<nonce>") zaczyna sie od POW_BITS zerowych bitow
// (~2^15 prob, 1-3 s). Wyzwanie podpisane, wazne 10 min, jednorazowe.
export const POW_BITS = 15;
const POW_TTL_MS = 10 * 60_000;
const usedChallenges = new Map<string, number>();

export function newPowChallenge(): { challenge: string; sig: string; bits: number } {
  const challenge = `${Date.now() + POW_TTL_MS}.${randomBytes(12).toString("hex")}`;
  return { challenge, sig: sign("support-pow", challenge), bits: POW_BITS };
}

function leadingZeroBits(buf: Buffer): number {
  let bits = 0;
  for (const byte of buf) {
    if (byte === 0) { bits += 8; continue; }
    return bits + Math.clz32(byte) - 24;
  }
  return bits;
}

export function verifyPow(challenge: unknown, sig: unknown, nonce: unknown): boolean {
  if (typeof challenge !== "string" || typeof sig !== "string" || typeof nonce !== "string") return false;
  if (!/^\d{13}\.[0-9a-f]{24}$/.test(challenge) || !/^\d{1,12}$/.test(nonce)) return false;
  if (!safeEqualHex(sign("support-pow", challenge), sig)) return false;
  const exp = Number(challenge.split(".")[0]);
  const now = Date.now();
  if (exp < now) return false;
  for (const [c, e] of usedChallenges) if (e < now) usedChallenges.delete(c);
  if (usedChallenges.has(challenge)) return false;
  const hash = createHash("sha256").update(`${challenge}:${nonce}`).digest();
  if (leadingZeroBits(hash) < POW_BITS) return false;
  usedChallenges.set(challenge, exp);
  return true;
}

// ---------------------------------------------------------------------------
// Baza
// ---------------------------------------------------------------------------
let _ready = false;
async function ensureTables(): Promise<void> {
  if (_ready) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SupportChat" (
      "id"            TEXT PRIMARY KEY,
      "email"         TEXT NOT NULL,
      "lang"          TEXT NOT NULL,
      "createdAt"     TEXT NOT NULL,
      "lastMessageAt" TEXT NOT NULL,
      "firstPage"     TEXT,
      "userAgent"     TEXT,
      "journey"       TEXT,
      "trackingConsent" INTEGER NOT NULL DEFAULT 0,
      "userMessages"  INTEGER NOT NULL DEFAULT 0,
      "adminReadAt"   TEXT
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SupportChatMessage" (
      "id"        INTEGER PRIMARY KEY AUTOINCREMENT,
      "chatId"    TEXT NOT NULL,
      "role"      TEXT NOT NULL,
      "content"   TEXT NOT NULL,
      "page"      TEXT,
      "createdAt" TEXT NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SupportChatMessage_chat_idx" ON "SupportChatMessage"("chatId", "id")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SupportChat_last_idx" ON "SupportChat"("lastMessageAt")`);
  _ready = true;
}

export interface JourneyEntry {
  t: number;          // ms od epoki
  kind: "page" | "section";
  path: string;       // sciezka strony
  section?: string;   // id sekcji (np. "kup-teraz")
}

export interface SupportChatRow {
  id: string;
  email: string;
  lang: string;
  createdAt: string;
  lastMessageAt: string;
  firstPage: string | null;
  userAgent: string | null;
  journey: JourneyEntry[];
  trackingConsent: boolean;
  userMessages: number;
  adminReadAt: string | null;
}

export interface SupportMessageRow {
  id: number;
  role: "user" | "assistant";
  content: string;
  page: string | null;
  createdAt: string;
}

type RawChat = Omit<SupportChatRow, "journey" | "trackingConsent" | "userMessages"> & {
  journey: string | null;
  trackingConsent: number | bigint;
  userMessages: number | bigint;
};

function toChat(r: RawChat): SupportChatRow {
  let journey: JourneyEntry[] = [];
  try { journey = r.journey ? (JSON.parse(r.journey) as JourneyEntry[]) : []; } catch { /* zostaje [] */ }
  return { ...r, journey, trackingConsent: Number(r.trackingConsent) === 1, userMessages: Number(r.userMessages) };
}

export function sanitizePath(v: unknown): string | null {
  if (typeof v !== "string") return null;
  // Tylko sciezka (bez query/hash — tam bywaja tokeny), wlasna strona.
  const path = v.split(/[?#]/)[0].slice(0, 200);
  return /^\/[\w\-./]*$/.test(path) ? path : null;
}

// Przebieg wizyty z przegladarki — tylko znane pola, przyciete.
export function sanitizeJourney(v: unknown): JourneyEntry[] {
  if (!Array.isArray(v)) return [];
  const out: JourneyEntry[] = [];
  for (const e of v.slice(-SUPPORT_LIMITS.journeyEntries)) {
    const x = e as Record<string, unknown>;
    const path = sanitizePath(x?.path);
    const t = Number(x?.t);
    if (!path || !Number.isFinite(t)) continue;
    if (x.kind === "section" && typeof x.section === "string" && /^[a-z0-9-]{1,40}$/.test(x.section)) {
      out.push({ t, kind: "section", path, section: x.section });
    } else if (x.kind === "page") {
      out.push({ t, kind: "page", path });
    }
  }
  return out;
}

export function normalizeEmail(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return s.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? s : null;
}

export async function createChat(opts: {
  email: string; lang: string; page: string | null; userAgent: string | null;
  journey: JourneyEntry[]; trackingConsent: boolean;
}): Promise<string> {
  await ensureTables();
  const id = randomUUID();
  const now = new Date().toISOString();
  await prisma.$executeRaw`
    INSERT INTO "SupportChat" ("id", "email", "lang", "createdAt", "lastMessageAt", "firstPage", "userAgent", "journey", "trackingConsent")
    VALUES (${id}, ${opts.email}, ${opts.lang}, ${now}, ${now}, ${opts.page}, ${(opts.userAgent || "").slice(0, 300)},
            ${opts.trackingConsent ? JSON.stringify(opts.journey) : null}, ${opts.trackingConsent ? 1 : 0})
  `;
  return id;
}

export async function getChat(id: string): Promise<SupportChatRow | null> {
  await ensureTables();
  const rows = await prisma.$queryRaw<RawChat[]>`SELECT * FROM "SupportChat" WHERE "id" = ${id} LIMIT 1`;
  return rows[0] ? toChat(rows[0]) : null;
}

export async function getMessages(chatId: string): Promise<SupportMessageRow[]> {
  await ensureTables();
  const rows = await prisma.$queryRaw<(SupportMessageRow & { id: number | bigint })[]>`
    SELECT "id", "role", "content", "page", "createdAt" FROM "SupportChatMessage" WHERE "chatId" = ${chatId} ORDER BY "id" ASC
  `;
  return rows.map((r) => ({ ...r, id: Number(r.id) }));
}

async function addMessage(chatId: string, role: "user" | "assistant", content: string, page: string | null): Promise<void> {
  const now = new Date().toISOString();
  await prisma.$executeRaw`
    INSERT INTO "SupportChatMessage" ("chatId", "role", "content", "page", "createdAt") VALUES (${chatId}, ${role}, ${content}, ${page}, ${now})
  `;
}

// Wiadomosc klienta: zapis + (przy zgodzie) aktualizacja przebiegu wizyty.
// Zwraca false, gdy rozmowa przekroczyla limit wiadomosci.
export async function recordUserMessage(chat: SupportChatRow, text: string, page: string | null, journey: JourneyEntry[] | null): Promise<boolean> {
  const now = new Date().toISOString();
  const n = await prisma.$executeRaw`
    UPDATE "SupportChat" SET "userMessages" = "userMessages" + 1, "lastMessageAt" = ${now}, "adminReadAt" = NULL
    WHERE "id" = ${chat.id} AND "userMessages" < ${SUPPORT_LIMITS.userMessagesPerChat}
  `;
  if (n !== 1) return false;
  if (journey && chat.trackingConsent) {
    await prisma.$executeRaw`UPDATE "SupportChat" SET "journey" = ${JSON.stringify(journey)} WHERE "id" = ${chat.id}`;
  }
  await addMessage(chat.id, "user", text, page);
  return true;
}

export async function recordAssistantMessage(chatId: string, text: string): Promise<void> {
  await addMessage(chatId, "assistant", text, null);
}

// --- Admin ---
export interface SupportChatListItem extends Omit<SupportChatRow, "journey" | "userAgent"> {
  lastMessage: string | null;
}

export async function listChats(limit = 200): Promise<SupportChatListItem[]> {
  await ensureTables();
  const rows = await prisma.$queryRaw<(RawChat & { lastMessage: string | null })[]>`
    SELECT c.*, (SELECT m."content" FROM "SupportChatMessage" m WHERE m."chatId" = c."id" ORDER BY m."id" DESC LIMIT 1) AS "lastMessage"
    FROM "SupportChat" c ORDER BY c."lastMessageAt" DESC LIMIT ${limit}
  `;
  return rows.map((r) => {
    const { journey: _j, userAgent: _ua, ...rest } = toChat(r);
    void _j; void _ua;
    return { ...rest, lastMessage: r.lastMessage ? r.lastMessage.slice(0, 200) : null };
  });
}

export async function markChatRead(id: string): Promise<void> {
  await ensureTables();
  await prisma.$executeRaw`UPDATE "SupportChat" SET "adminReadAt" = ${new Date().toISOString()} WHERE "id" = ${id}`;
}

export async function deleteChat(id: string): Promise<boolean> {
  await ensureTables();
  await prisma.$executeRaw`DELETE FROM "SupportChatMessage" WHERE "chatId" = ${id}`;
  return (await prisma.$executeRaw`DELETE FROM "SupportChat" WHERE "id" = ${id}`) === 1;
}

// Retencja (polityka prywatnosci §5): 12 miesiecy od ostatniej wiadomosci.
export async function purgeOldSupportChats(): Promise<number> {
  await ensureTables();
  const cutoff = new Date(Date.now() - SUPPORT_LIMITS.retentionDays * 86_400_000).toISOString();
  await prisma.$executeRaw`
    DELETE FROM "SupportChatMessage" WHERE "chatId" IN (SELECT "id" FROM "SupportChat" WHERE "lastMessageAt" < ${cutoff})
  `;
  return prisma.$executeRaw`DELETE FROM "SupportChat" WHERE "lastMessageAt" < ${cutoff}`;
}

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------
const LANG_NAMES: Record<string, string> = {
  pl: "polski", en: "angielski", de: "niemiecki", cs: "czeski", sk: "słowacki", lt: "litewski",
  be: "białoruski (cyrylica)", es: "hiszpański", pt: "portugalski (europejski)", fr: "francuski", it: "włoski",
};

const SECTION_NAMES: Record<string, string> = {
  "kup-teraz": "cennik / kup teraz", faq: "FAQ", funkcje: "funkcje", galeria: "galeria", hardware: "hardware",
  "jak-dziala": "jak to działa", opinie: "opinie", prototyp: "prototyp", przedmioty: "przedmioty", "ukryta-kamera": "ukryta kamera",
};

function journeySummary(journey: JourneyEntry[]): string {
  const seen: string[] = [];
  for (const e of journey) {
    const label = e.kind === "section" ? `sekcja „${SECTION_NAMES[e.section!] || e.section}” (${e.path})` : `strona ${e.path}`;
    if (seen[seen.length - 1] !== label) seen.push(label);
  }
  return seen.slice(-15).join(" → ");
}

function systemPrompt(chat: SupportChatRow, page: string | null): string {
  const lang = LANG_NAMES[chat.lang] || "polski";
  const context = [
    page ? `Klient pisze ze strony: ${page}.` : "",
    chat.trackingConsent && chat.journey.length ? `Przebieg wizyty klienta (od najstarszego): ${journeySummary(chat.journey)}.` : "",
  ].filter(Boolean).join("\n");
  return `Jesteś asystentem AI na stronie sklepu KalkMate (kalkmate.pl) — rozmawiasz z klientem (często uczniem lub rodzicem) w okienku czatu.
Cel: rzetelnie odpowiadać na pytania o produkt, zakup, wysyłkę i działanie kalkulatora, i pomóc podjąć decyzję o zakupie — bez nachalności.

Zasady:
- Odpowiadaj w języku, w którym pisze klient (strona jest w wersji: ${lang}). Zwracaj się na "ty".
- Krótko: 1–4 zdania, bez nagłówków i tabel. Linki tylko do kalkmate.pl (np. https://kalkmate.pl/#kup-teraz, https://kalkmate.pl/pomoc, https://kalkmate.pl/regulamin).
- Opieraj się WYŁĄCZNIE na wiedzy poniżej. Czego tam nie ma — powiedz uczciwie, że nie wiesz, i odeślij na kontakt@kalkmate.pl. Nie wymyślaj cen, terminów, rabatów, kodów ani funkcji.
- NIE masz dostępu do zamówień, kont ani płatności. W sprawie konkretnego zamówienia, reklamacji, zwrotu lub konta: poproś o mail na kontakt@kalkmate.pl z numerem zamówienia (KM-...).
- Nigdy nie proś o hasła, dane karty, kod AI kalkulatora ani numery dokumentów.
- Jesteś AI — jeśli ktoś pyta, powiedz to wprost. Nie podawaj się za człowieka.
- Nie rozwiązuj zadań szkolnych w czacie (do tego jest kalkulator). Tematy niezwiązane z KalkMate — grzecznie wróć do tematu.
- Jeśli znasz kontekst wizyty (poniżej), możesz go dyskretnie wykorzystać (np. klient oglądał cennik → odpowiedz o cenie), ale nie komentuj, że go „śledzisz”.

${context ? `=== KONTEKST ===\n${context}\n\n` : ""}${KALKMATE_KNOWLEDGE}

${SHOP_FACTS}`;
}

export async function askSupportAi(chat: SupportChatRow, history: SupportMessageRow[], page: string | null): Promise<string> {
  if (!OPENROUTER_API_KEY) throw new Error("OpenRouter API key not configured");
  const messages = history.slice(-SUPPORT_LIMITS.historyForModel).map((m) => ({ role: m.role, content: m.content }));
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://kalkmate.pl",
      "X-Title": "KalkMate",
    },
    signal: AbortSignal.timeout(45_000),
    body: JSON.stringify({
      model: SUPPORT_MODEL,
      messages: [{ role: "system", content: systemPrompt(chat, page) }, ...messages],
      temperature: 0.4,
      max_tokens: 900,
      // Patrz lib/translate.ts: gemini-3.8-flash nie przyjmuje "none".
      reasoning: { effort: "minimal" },
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Pusta odpowiedź modelu");
  return content.trim().slice(0, 4000);
}
