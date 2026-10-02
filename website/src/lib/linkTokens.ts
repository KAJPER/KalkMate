// Podpisane linki w mailach (wypisanie z newslettera, "dokoncz platnosc").
// HMAC z sekretem serwera — link dziala bez logowania, ale nie da sie go
// podrobic dla cudzego adresu/zamowienia. `purpose` rozdziela rodzaje linkow,
// zeby token z jednego nie pasowal do drugiego.
//
// Zmiana sekretu uniewaznia linki w juz wyslanych mailach — dlatego najlepiej
// ustawic osobny, staly NEWSLETTER_SECRET (fallback: NEXTAUTH_SECRET).

import { createHmac, timingSafeEqual } from "crypto";

function secret(): string {
  const s = process.env.NEWSLETTER_SECRET || process.env.NEXTAUTH_SECRET || process.env.ADMIN_SESSION_TOKEN;
  if (!s) throw new Error("Brak NEWSLETTER_SECRET / NEXTAUTH_SECRET w konfiguracji serwera");
  return s;
}

export function signLink(purpose: string, value: string): string {
  return createHmac("sha256", secret()).update(`${purpose}:${value}`).digest("base64url").slice(0, 32);
}

export function verifyLink(purpose: string, value: string, token: string): boolean {
  const a = Buffer.from(signLink(purpose, value));
  const b = Buffer.from(token || "");
  return a.length === b.length && timingSafeEqual(a, b);
}
