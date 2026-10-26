import { createHash } from "crypto";
import { localeFromCountry } from "@/lib/email-templates";

const MERCHANT_ID = parseInt(process.env.P24_MERCHANT_ID || "0", 10);
const POS_ID = parseInt(process.env.P24_POS_ID || "0", 10);
const CRC = process.env.P24_CRC || "";
const API_KEY = process.env.P24_API_KEY || "";
const SANDBOX = process.env.P24_SANDBOX === "true";

export const P24_BASE_URL = SANDBOX
  ? "https://sandbox.przelewy24.pl/api/v1"
  : "https://secure.przelewy24.pl/api/v1";

export const P24_PANEL_URL = SANDBOX
  ? "https://sandbox.przelewy24.pl/trnRequest"
  : "https://secure.przelewy24.pl/trnRequest";

function basicAuth(): string {
  return "Basic " + Buffer.from(`${POS_ID}:${API_KEY}`).toString("base64");
}

export function signRegister(sessionId: string, amount: number, currency: string): string {
  const obj = { sessionId, merchantId: MERCHANT_ID, amount, currency, crc: CRC };
  return createHash("sha384").update(JSON.stringify(obj)).digest("hex");
}

export function signVerify(sessionId: string, orderId: number, amount: number, currency: string): string {
  const obj = { sessionId, orderId, amount, currency, crc: CRC };
  return createHash("sha384").update(JSON.stringify(obj)).digest("hex");
}

export function verifyNotificationSign(data: {
  merchantId: number;
  posId: number;
  sessionId: string;
  amount: number;
  originAmount: number;
  currency: string;
  orderId: number;
  methodId: number;
  statement: string;
  sign: string;
}): boolean {
  const { sign, ...rest } = data;
  const obj = { ...rest, crc: CRC };
  const expected = createHash("sha384").update(JSON.stringify(obj)).digest("hex");
  return expected === sign;
}

export interface RegisterParams {
  sessionId: string;
  amount: number;
  currency: string;
  description: string;
  email: string;
  client?: string;
  phone?: string;
  address?: string;
  zip?: string;
  city?: string;
  country?: string;
  language?: string;
  urlReturn: string;
  urlStatus: string;
  // channel: 1=karty+ApplePay+GooglePay, 8192=BLIK, 4096=karty, 16=wszystkie
  channel?: number;
  regulationAccept?: boolean;
  method?: number;
}

// Jezyk bramki P24. P24 obsluguje m.in.: bg, cs, de, en, es, fr, hr, hu, it,
// nl, pl, pt, se, sk, ro — NIE ma lt ani be (te -> en). PLN zawsze po polsku
// (klient z Polski); dla EUR jezyk z kraju wysylki (jak maile zamowien,
// localeFromCountry: SK->sk, ES->es, PT->pt, FR/BE/LU->fr, IT->it, CZ->cs, DE->de).
const P24_LANGUAGES = new Set(["pl", "en", "de", "cs", "sk", "es", "pt", "fr", "it"]);
export function p24Language(currency: string, country: string | null | undefined): string {
  if ((currency || "").toUpperCase() === "PLN") return "pl";
  const lang = localeFromCountry(country || "OTHER");
  return P24_LANGUAGES.has(lang) ? lang : "en";
}

export async function registerTransaction(params: RegisterParams): Promise<string> {
  const sign = signRegister(params.sessionId, params.amount, params.currency);

  const payload: Record<string, unknown> = {
    merchantId: MERCHANT_ID,
    posId: POS_ID,
    sessionId: params.sessionId,
    amount: params.amount,
    currency: params.currency,
    description: params.description,
    email: params.email,
    client: params.client ?? "",
    phone: params.phone ?? "",
    address: params.address ?? "",
    zip: params.zip ?? "",
    city: params.city ?? "",
    country: params.country ?? "PL",
    language: params.language ?? "pl",
    urlReturn: params.urlReturn,
    urlStatus: params.urlStatus,
    channel: params.channel ?? 16,
    regulationAccept: params.regulationAccept ?? false,
    sign,
    encoding: "UTF-8",
  };

  if (params.method !== undefined) payload.method = params.method;

  const res = await fetch(`${P24_BASE_URL}/transaction/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: basicAuth() },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`P24 register failed ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (!data.data?.token) throw new Error("P24 register: no token returned");
  return data.data.token as string;
}

export function paymentUrl(token: string): string {
  return `${P24_PANEL_URL}/${token}`;
}

export async function blikChargeByCode(
  token: string,
  blikCode: string
): Promise<{ orderId: number; message: string }> {
  const res = await fetch(`${P24_BASE_URL}/paymentMethod/blik/chargeByCode`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: basicAuth() },
    body: JSON.stringify({ token, blikCode }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`P24 BLIK failed ${res.status}: ${text}`);
  }

  const data = await res.json();
  return { orderId: data.data?.orderId ?? 0, message: data.data?.message ?? "" };
}

export async function verifyTransaction(params: {
  sessionId: string;
  orderId: number;
  amount: number;
  currency: string;
}): Promise<void> {
  const sign = signVerify(params.sessionId, params.orderId, params.amount, params.currency);

  const res = await fetch(`${P24_BASE_URL}/transaction/verify`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: basicAuth() },
    body: JSON.stringify({
      merchantId: MERCHANT_ID,
      posId: POS_ID,
      sessionId: params.sessionId,
      amount: params.amount,
      currency: params.currency,
      orderId: params.orderId,
      sign,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`P24 verify failed ${res.status}: ${text}`);
  }
}

// === Status transakcji po sessionId ===
// GET /transaction/by/sessionId/{sessionId} (Basic auth jak reszta API).
// Uzywane przed przypomnieniem o platnosci i przed auto-anulowaniem
// (lib/paymentReminders.ts, lib/orderCleanup.ts) — gdyby webhook P24 nie
// dotarl, nie chcemy anulowac oplaconego zamowienia.
// status P24: 0 = brak wplaty, 1 = wplata jest, czeka na weryfikacje (verify),
//             2 = dokonana (zweryfikowana), 3 = zwrocona.
// found=false = P24 nie zna transakcji (nikt nic nie wplacil). Inny blad
// (siec, 5xx, 401) = wyjatek — wywolujacy ma pominac rekord (fail-safe).
export interface P24TransactionInfo {
  found: boolean;
  sessionId: string;
  status: number;
  orderId: number;   // id transakcji po stronie P24 (do verify)
  amount: number;    // grosze/centy
  currency: string;  // np. "PLN"
}

export function p24StatusIsPaid(status: number): boolean {
  return status === 1 || status === 2;
}

export async function getTransactionBySessionId(sessionId: string): Promise<P24TransactionInfo> {
  const notFound: P24TransactionInfo = { found: false, sessionId, status: 0, orderId: 0, amount: 0, currency: "" };
  const res = await fetch(`${P24_BASE_URL}/transaction/by/sessionId/${encodeURIComponent(sessionId)}`, {
    method: "GET",
    headers: { Authorization: basicAuth() },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 404 || (res.status === 400 && /not\s*found/i.test(text))) return notFound;
    throw new Error(`P24 transaction/by/sessionId failed ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json().catch(() => null);
  const d = data?.data;
  if (!d || typeof d !== "object") throw new Error("P24 transaction/by/sessionId: brak danych w odpowiedzi");
  const status = Number(d.status);
  if (!Number.isFinite(status)) throw new Error("P24 transaction/by/sessionId: nieprawidlowy status");
  return {
    found: true,
    sessionId,
    status,
    orderId: Number(d.orderId) || 0,
    amount: Number(d.amount) || 0,
    currency: String(d.currency || ""),
  };
}

export { MERCHANT_ID, POS_ID };
