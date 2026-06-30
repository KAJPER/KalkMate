import { createHash } from "crypto";

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

export { MERCHANT_ID, POS_ID };
