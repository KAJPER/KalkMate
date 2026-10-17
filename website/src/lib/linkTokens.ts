// Podpisane linki w mailach (wypisanie z newslettera, "dokoncz platnosc").
// HMAC z sekretem serwera — link dziala bez logowania, ale nie da sie go
// podrobic dla cudzego adresu/zamowienia. `purpose` rozdziela rodzaje linkow,
// zeby token z jednego nie pasowal do drugiego.
//
// Zmiana sekretu uniewaznia linki w juz wyslanych mailach — dlatego najlepiej
// ustawic osobny, staly NEWSLETTER_SECRET (fallback: NEXTAUTH_SECRET, potem
// ADMIN_SESSION_TOKEN). Audyt 2026-10-16: klucz linkow nie powinien zalezec od
// sekretow sesji (rotacja NEXTAUTH_SECRET po wycieku psula wszystkie linki,
// a wyciek klucza linkow = mozliwosc podpisywania sesji). Po ustawieniu
// NEWSLETTER_SECRET linki podpisane wczesniej fallbackiem nadal sa
// weryfikowane (verifyLink probuje tez starych kluczy), wiec nic sie nie psuje.

import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

let _warnedNoSecret = false;

function fallbackSecrets(): string[] {
  return [process.env.NEXTAUTH_SECRET, process.env.ADMIN_SESSION_TOKEN].filter((s): s is string => !!s);
}

function secret(): string {
  const primary = process.env.NEWSLETTER_SECRET;
  if (primary) return primary;
  const s = fallbackSecrets()[0];
  if (!s) throw new Error("Brak NEWSLETTER_SECRET / NEXTAUTH_SECRET w konfiguracji serwera");
  if (!_warnedNoSecret) {
    _warnedNoSecret = true;
    console.warn(
      "[linkTokens] Brak NEWSLETTER_SECRET — linki w mailach (wypisanie, dokonczenie platnosci) " +
        "sa podpisywane sekretem sesji (NEXTAUTH_SECRET/ADMIN_SESSION_TOKEN). Ustaw osobny NEWSLETTER_SECRET."
    );
  }
  return s;
}

function sign(key: string, purpose: string, value: string): string {
  return createHmac("sha256", key).update(`${purpose}:${value}`).digest("base64url").slice(0, 32);
}

export function signLink(purpose: string, value: string): string {
  return sign(secret(), purpose, value);
}

function safeEqual(expected: string, token: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(token || "");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyLink(purpose: string, value: string, token: string): boolean {
  if (safeEqual(signLink(purpose, value), token)) return true;
  // Linki wyslane zanim ustawiono NEWSLETTER_SECRET byly podpisane fallbackiem.
  if (process.env.NEWSLETTER_SECRET) {
    for (const key of fallbackSecrets()) {
      if (safeEqual(sign(key, purpose, value), token)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Jednorazowe tokeny w linkach (reset hasla, weryfikacja / zmiana e-maila)
// ---------------------------------------------------------------------------
// W bazie trzymamy TYLKO sha256(token) — wyciek kopii bazy (backup, dev.db)
// nie daje dzialajacych linkow resetu hasla. Wiersze z hashem maja id
// zaczynajace sie od HASHED_TOKEN_ID_PREFIX; starsze wiersze (sprzed audytu
// 2026-10-16) maja token jawnym tekstem — sa jeszcze akceptowane do wygasniecia
// (max 24 h), ale tylko gdy id NIE ma prefiksu (inaczej ktos znajacy hash z bazy
// moglby podac go jako "jawny" token).

export const HASHED_TOKEN_ID_PREFIX = "h1_";

export function hashMailToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Nowy token: `token` idzie do linku w mailu, `hash` do bazy, `id` jako klucz wiersza.
export function newMailToken(kind: string): { token: string; hash: string; id: string } {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    hash: hashMailToken(token),
    id: `${HASHED_TOKEN_ID_PREFIX}${kind}_${Date.now()}_${randomBytes(4).toString("hex")}`,
  };
}

// Format tokenu z linku (64 znaki hex) — odrzucamy smieci zanim dotkniemy bazy.
export function isMailTokenFormat(token: string): boolean {
  return /^[0-9a-f]{64}$/i.test(token);
}
