// Weryfikacja tozsamosci przez Didit (dowod + selfie) — wypozyczenie bez kaucji
// (lib/rentals.ts). Dokumentacja: docs.didit.me (sessions-api/create-session,
// integration/webhooks, sessions-api/retrieve-session).
//
// Env (serwer):
//   DIDIT_API_KEY         — sk_live_... / sk_test_... (naglowek x-api-key)
//   DIDIT_WORKFLOW_ID     — UUID workflow KYC (ID + liveness) z konsoli Didit
//   DIDIT_WEBHOOK_SECRET  — secret_shared_key webhooka (konsola: API & Webhooks)
// Bez ktorejkolwiek: opcja "bez kaucji" jest ukryta, zostaje tylko kaucja.

import { createHmac, timingSafeEqual } from "crypto";

const API_BASE = "https://verification.didit.me/v3";

export function diditConfigured(): boolean {
  return !!(process.env.DIDIT_API_KEY && process.env.DIDIT_WORKFLOW_ID && process.env.DIDIT_WEBHOOK_SECRET);
}

export async function createDiditSession(opts: {
  vendorData: string;      // nasze id wypozyczenia
  callback: string;        // powrot na /wypozyczenie (Didit dopisze verificationSessionId i status)
  firstName: string;
  lastName: string;
  email: string;
}): Promise<{ sessionId: string; url: string }> {
  const res = await fetch(`${API_BASE}/session/`, {
    method: "POST",
    headers: { "x-api-key": process.env.DIDIT_API_KEY || "", "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      workflow_id: process.env.DIDIT_WORKFLOW_ID,
      vendor_data: opts.vendorData,
      callback: opts.callback,
      callback_method: "both",
      language: "pl",
      contact_details: { email: opts.email, send_notification_emails: false },
      // Rozbieznosc z dowodem Didit zglasza jako ostrzezenie; i tak porownujemy sami.
      expected_details: { first_name: opts.firstName, last_name: opts.lastName },
    }),
  });
  if (!res.ok) throw new Error(`Didit create session ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  if (typeof data?.session_id !== "string" || typeof data?.url !== "string") throw new Error("Didit: brak session_id/url w odpowiedzi");
  return { sessionId: data.session_id, url: data.url };
}

// Podpis webhooka: X-Signature = HMAC-SHA256 (hex) surowego body kluczem
// DIDIT_WEBHOOK_SECRET; X-Timestamp nie starszy niz 5 min. Podczas rotacji
// sekretu Didit wysyla tez X-Signature-Previous — akceptujemy oba.
export function verifyDiditWebhook(rawBody: string, headers: Headers): boolean {
  const secret = process.env.DIDIT_WEBHOOK_SECRET;
  if (!secret) return false;
  const ts = Number(headers.get("x-timestamp"));
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  for (const h of ["x-signature", "x-signature-previous"]) {
    const sig = (headers.get(h) || "").trim().toLowerCase();
    if (/^[0-9a-f]{64}$/.test(sig) && timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return true;
  }
  return false;
}

export interface DiditIdentity {
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;   // YYYY-MM-DD
}

// Pierwszy wynik weryfikacji dokumentu z decision (webhook albo GET decision).
export function identityFromDecision(decision: unknown): DiditIdentity | null {
  const list = (decision as { id_verifications?: unknown })?.id_verifications;
  if (!Array.isArray(list) || !list.length) return null;
  const v = list[0] as Record<string, unknown>;
  const first = typeof v.first_name === "string" ? v.first_name.trim() : "";
  const last = typeof v.last_name === "string" ? v.last_name.trim() : "";
  if (!first || !last) return null;
  const dob = typeof v.date_of_birth === "string" && /^\d{4}-\d{2}-\d{2}/.test(v.date_of_birth) ? v.date_of_birth.slice(0, 10) : null;
  return { firstName: first, lastName: last, dateOfBirth: dob };
}

// "Łukasz" ~ "LUKASZ": bez wielkosci liter i polskich znakow.
export function normalizeName(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l").replace(/Ł/g, "L")
    .toLowerCase().replace(/[^a-z\s-]/g, " ").replace(/\s+/g, " ").trim();
}

// Imie i nazwisko z dowodu musza wystepowac w imieniu i nazwisku podanym
// przy zamowieniu (kolejnosc dowolna, drugie imie z dowodu nie jest wymagane).
export function nameMatches(formName: string, id: DiditIdentity): boolean {
  const form = new Set(normalizeName(formName).split(/[\s-]+/));
  const firstOk = normalizeName(id.firstName).split(/[\s-]+/).some((p) => form.has(p));
  const lastParts = normalizeName(id.lastName).split(/[\s-]+/).filter(Boolean);
  return firstOk && lastParts.length > 0 && lastParts.every((p) => form.has(p));
}

export function isAdult(dateOfBirth: string | null, now = new Date()): boolean {
  if (!dateOfBirth) return false;
  const [y, m, d] = dateOfBirth.split("-").map(Number);
  if (!y || !m || !d) return false;
  const eighteenth = new Date(Date.UTC(y + 18, m - 1, d));
  return eighteenth.getTime() <= now.getTime();
}
