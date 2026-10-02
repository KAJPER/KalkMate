import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { registerTransaction, paymentUrl } from "@/lib/przelewy24";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { addPaymentSession, verifyResumeToken } from "@/lib/paymentReminders";

// GET /api/p24/resume?o=<orderId>&t=<podpis> — link "Dokończ płatność" z maila
// przypominajacego (lib/paymentReminders.ts). Rejestruje NOWA transakcje P24
// na kwote zamowienia i przekierowuje na bramke. Bez logowania — link jest
// podpisany i pozwala tylko zaplacic za to jedno zamowienie.

function page(title: string, text: string, status = 200) {
  const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · KalkMate</title><meta name="robots" content="noindex">
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0B0B0B;color:#F2EDE3;font-family:Inter,Segoe UI,Roboto,sans-serif;padding:16px}
.c{max-width:440px;width:100%;background:#141414;border:1px solid #2A2A2A;border-bottom:3px solid #D8FF3D;padding:32px 28px;text-align:center}
h1{font-size:22px;margin:0 0 10px}p{color:#9C9890;line-height:1.6;font-size:15px;margin:0 0 18px}a{color:#D8FF3D}</style></head>
<body><div class="c"><h1>${title}</h1><p>${text}</p><p><a href="https://kalkmate.pl">kalkmate.pl</a> · <a href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</a></p></div></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  fulfillmentStatus: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddressStreet: string | null;
  customerAddressPostcode: string | null;
  customerAddressCity: string | null;
  customerCountry: string | null;
  amount: number;
  currency: string;
}

export async function GET(request: NextRequest) {
  const rl = rateLimit(`p24-resume:${clientIp(request)}`, 10, 10 * 60_000);
  if (!rl.ok) return page("Za dużo prób", "Spróbuj ponownie za kilka minut.", 429);

  const q = request.nextUrl.searchParams;
  const orderId = q.get("o") || "";
  if (!orderId || !verifyResumeToken(orderId, q.get("t") || "")) {
    return page("Nieprawidłowy link", "Ten link do płatności jest niepoprawny. Napisz do nas — pomożemy dokończyć zamówienie.", 400);
  }

  const rows = await prisma.$queryRaw<OrderRow[]>`
    SELECT id, "orderNumber", status, "fulfillmentStatus", "customerName", "customerEmail", "customerPhone",
           "customerAddressStreet", "customerAddressPostcode", "customerAddressCity", "customerCountry",
           amount, currency
    FROM "Order" WHERE id = ${orderId} LIMIT 1`;
  const o = rows[0];
  if (!o) return page("Nie znaleziono zamówienia", "To zamówienie nie istnieje. Napisz do nas, jeśli to pomyłka.", 404);
  if (o.status === "paid") {
    return page("Zamówienie opłacone ✓", `Zamówienie ${o.orderNumber} jest już opłacone — nic więcej nie trzeba robić.`);
  }
  if (o.status !== "pending" || o.fulfillmentStatus === "cancelled") {
    return page("Zamówienie anulowane", `Zamówienie ${o.orderNumber} zostało anulowane. Złóż nowe zamówienie na kalkmate.pl.`);
  }

  try {
    const sessionId = `km-${randomUUID()}`;
    const currency = (o.currency || "pln").toUpperCase();
    const baseUrl = process.env.NEXTAUTH_URL || "https://kalkmate.pl";
    const token = await registerTransaction({
      sessionId,
      amount: Number(o.amount),
      currency,
      description: "KalkMate v3.0 - AI Calculator",
      email: o.customerEmail,
      client: o.customerName,
      phone: o.customerPhone,
      address: o.customerAddressStreet || "",
      zip: o.customerAddressPostcode || "",
      city: o.customerAddressCity || o.customerCountry || "",
      country: o.customerCountry && o.customerCountry !== "OTHER" ? o.customerCountry : "PL",
      language: currency === "PLN" ? "pl" : "en",
      urlReturn: `${baseUrl}/?p24_return=true&p24_session=${sessionId}`,
      urlStatus: `${baseUrl}/api/webhooks/p24`,
      channel: 16,
    });
    await addPaymentSession(sessionId, o.id);
    return NextResponse.redirect(paymentUrl(token), 303);
  } catch (e) {
    console.error("[p24/resume] register failed:", e);
    return page("Płatność chwilowo niedostępna", "Nie udało się połączyć z Przelewy24. Spróbuj za chwilę albo odpisz na maila — pomożemy.", 502);
  }
}
