// Podpisane ciasteczko sesji admina — czesc WSPOLNA dla Edge (middleware.ts)
// i Node (lib/admin-auth.ts). Tylko WebCrypto, zero importow z Node/Prisma,
// zeby dalo sie to uruchomic w middleware na Edge runtime.
//
// Format cookie:  v2.<sessionId>.<expUnixSec>.<hmacHex>
//   hmac = HMAC-SHA256(key = ADMIN_SESSION_TOKEN, msg = "<sessionId>.<expUnixSec>")
//
// Dlaczego tak (audyt 2026-09-17, pkt 3): wczesniej cookie bylo DOSLOWNIE
// wartoscia ADMIN_SESSION_TOKEN — kto je wyciagnal (kopia profilu aplikacji
// desktopowej, skradziony laptop), mial pelny dostep az do rotacji sekretu,
// a rotacja wylogowywala wszystkich naraz. Teraz sekret sluzy tylko do
// PODPISYWANIA losowych identyfikatorow sesji: cookie nie zawiera sekretu,
// kazde logowanie ma wlasny id, a id da sie odwolac pojedynczo (tabela
// AdminSession — patrz admin-auth.ts). Middleware sprawdza podpis + date
// wygasniecia bez bazy; route'y dodatkowo sprawdzaja odwolanie w bazie.

export const ADMIN_COOKIE_VERSION = "v2";

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function bytesToHex(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
  return s;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return bytesToHex(sig);
}

// Porownanie w stalym czasie (Edge nie ma node:crypto.timingSafeEqual).
function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  const x = hexToBytes(a);
  const y = hexToBytes(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export function randomSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function buildAdminCookie(sessionId: string, expUnixSec: number, secret: string): Promise<string> {
  const sig = await hmacHex(secret, `${sessionId}.${expUnixSec}`);
  return `${ADMIN_COOKIE_VERSION}.${sessionId}.${expUnixSec}.${sig}`;
}

export interface ParsedAdminCookie {
  sessionId: string;
  exp: number;
}

// Sprawdza format, podpis i date wygasniecia. NIE sprawdza odwolania w bazie
// (to robi requireAdminAuth w Node). Zwraca null gdy cokolwiek sie nie zgadza.
export async function verifyAdminCookie(value: string | undefined, secret: string | undefined): Promise<ParsedAdminCookie | null> {
  if (!value || !secret) return null;
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== ADMIN_COOKIE_VERSION) return null;
  const [, sessionId, expStr, sig] = parts;
  if (!/^[0-9a-f]{64}$/.test(sessionId) || !/^\d{1,12}$/.test(expStr) || !/^[0-9a-f]{64}$/.test(sig)) return null;
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
  const expected = await hmacHex(secret, `${sessionId}.${expStr}`);
  if (!constantTimeEqualHex(expected, sig)) return null;
  return { sessionId, exp };
}
