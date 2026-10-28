// Asystent AI w panelu admina (/admin/asystent) — czat z "baza wiedzy" o
// KalkMate do odpowiadania na maile, ktore przychodza na INNE adresy niz
// kontakt@kalkmate.pl (te ma /admin/mailbox z wlasnym "Szkic AI").
//
// Bezstanowy: przegladarka trzyma historie rozmowy i wysyla ja w kazdym
// zapytaniu. Jesli w rozmowie pojawi sie e-mail, numer zamowienia (KM-...)
// albo Device ID, dociagamy z bazy REALNE dane (zamowienia, konto, saldo
// tokenow, urzadzenia), zeby model nie zmyslal statusow. Nic tu nie wysyla
// maili ani niczego nie zmienia w bazie — tylko odczyt.

import { prisma } from "@/lib/db";
import { KALKMATE_KNOWLEDGE } from "@/lib/mailReply";
import { faqs } from "@/lib/content/faq";
import { TOKEN_PACKS } from "@/lib/tokenPacks";
import { readTokenBalance } from "@/lib/aiCost";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const ASSISTANT_MODEL =
  process.env.ADMIN_ASSISTANT_MODEL || process.env.MAILBOX_REPLY_MODEL || "google/gemini-3.8-flash";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

// Co znalezlismy w bazie — pokazywane w UI jako "chipy" pod odpowiedzia,
// zeby admin widzial, na jakich danych model sie opieral.
export interface AssistantLookup {
  kind: "order" | "account" | "device" | "missing";
  label: string;
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const ORDER_RE = /\bKM-\d{8}-\d{4}\b/gi;
const DEVICE_RE = /\b[0-9A-F]{12}\b/g;

// Nasze wlasne adresy nie sa "klientem" — pomijamy je przy szukaniu w bazie.
const OWN_DOMAINS = ["kalkmate.pl", "kalkmate.eu"];

const zl = (grosze: number, currency: string) =>
  `${(grosze / 100).toFixed(2).replace(".", ",")} ${currency.toUpperCase()}`;

const FULFILLMENT: Record<string, string> = {
  unfulfilled: "nieopracowane",
  in_progress: "w trakcie realizacji",
  shipped: "wysłane",
  fulfilled: "dostarczone/zrealizowane",
  cancelled: "anulowane",
};
const PAYMENT: Record<string, string> = {
  pending: "oczekuje na płatność",
  paid: "opłacone",
  succeeded: "opłacone",
  cancelled: "anulowane (pieniądze zwrócone)",
  failed: "nieudana płatność",
};
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

type OrderRow = Awaited<ReturnType<typeof prisma.order.findMany>>[number];

function describeOrder(o: OrderRow): string {
  const parts = [
    `Zamówienie ${o.orderNumber} (złożone ${day(o.createdAt)})`,
    `klient: ${o.customerName} <${o.customerEmail}>`,
    `kwota ${zl(o.amount, o.currency)}`,
    `płatność: ${PAYMENT[o.status] || o.status}${o.paidAt ? ` (${day(o.paidAt)})` : ""}`,
    `realizacja: ${FULFILLMENT[o.fulfillmentStatus || "unfulfilled"] || o.fulfillmentStatus}`,
  ];
  if (o.customerCountry) parts.push(`kraj: ${o.customerCountry}`);
  if (o.pickupPoint) parts.push(`Paczkomat ${o.pickupPoint}`);
  if (o.trackingNumber) parts.push(`numer przesyłki ${o.trackingNumber}`);
  if (o.shippedAt) parts.push(`wysłane ${day(o.shippedAt)}`);
  if (o.deliveredAt) parts.push(`doręczone ${day(o.deliveredAt)}`);
  if (o.invoiceSentAt) parts.push(`faktura wysłana ${day(o.invoiceSentAt)}`);
  if (o.adminNotes?.trim()) parts.push(`notatki admina: ${o.adminNotes.trim().slice(0, 400)}`);
  return `- ${parts.join("; ")}`;
}

async function describeAccount(email: string): Promise<{ text: string; userId: string } | null> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE lower("email") = lower(${email}) LIMIT 1`;
  if (!rows.length) return null;
  const user = await prisma.user.findUnique({
    where: { id: rows[0].id },
    include: { Device: { orderBy: { lastSeen: "desc" }, take: 5 } },
  });
  if (!user) return null;
  const balance = await readTokenBalance(user.id);
  const devices = user.Device.length
    ? user.Device.map((d) => `${d.deviceId} (fw ${d.firmwareVersion || "?"}, ostatnio online ${day(d.lastSeen)}, zapytań AI ${d.requestCount})`).join(", ")
    : "brak sparowanych kalkulatorów";
  return {
    userId: user.id,
    text: `- Konto ${user.email}${user.name ? ` (${user.name})` : ""}: założone ${day(user.createdAt)}, e-mail ${
      user.emailVerified ? "potwierdzony" : "NIEpotwierdzony"
    }, saldo tokenów ${balance === null ? "nieznane" : balance.toLocaleString("pl-PL")}, urządzenia: ${devices}`,
  };
}

async function describeDevice(deviceId: string): Promise<string | null> {
  const d = await prisma.device.findUnique({ where: { deviceId }, include: { User: true } });
  if (!d) return null;
  const balance = d.userId ? await readTokenBalance(d.userId) : null;
  return `- Kalkulator ${d.deviceId}: firmware ${d.firmwareVersion || "?"}, pierwszy raz online ${day(d.firstSeen)}, ostatnio ${day(
    d.lastSeen
  )}, zapytań AI ${d.requestCount}, ${
    d.User ? `sparowany z kontem ${d.User.email} (saldo ${balance === null ? "?" : balance.toLocaleString("pl-PL")} tokenów)` : "NIEsparowany z żadnym kontem"
  }`;
}

// Wyszukuje w bazie wszystko, do czego odwoluje sie rozmowa. Limity, zeby
// wklejony dlugi watek z kilkudziesiecioma adresami nie robil 100 zapytan.
export async function lookupContext(text: string): Promise<{ block: string; lookups: AssistantLookup[] }> {
  const emails = [...new Set((text.match(EMAIL_RE) || []).map((e) => e.toLowerCase()))]
    .filter((e) => !OWN_DOMAINS.some((d) => e.endsWith("@" + d)))
    .slice(0, 5);
  const orderNumbers = [...new Set((text.match(ORDER_RE) || []).map((o) => o.toUpperCase()))].slice(0, 5);
  const deviceIds = [...new Set(text.match(DEVICE_RE) || [])].slice(0, 5);

  const lines: string[] = [];
  const lookups: AssistantLookup[] = [];
  const seenOrders = new Set<string>();

  const pushOrders = (rows: OrderRow[]) => {
    for (const o of rows) {
      if (seenOrders.has(o.id)) continue;
      seenOrders.add(o.id);
      lines.push(describeOrder(o));
      lookups.push({ kind: "order", label: o.orderNumber });
    }
  };

  if (orderNumbers.length) {
    const rows = await prisma.order.findMany({ where: { orderNumber: { in: orderNumbers } } });
    pushOrders(rows);
    for (const n of orderNumbers) {
      if (!rows.some((r) => r.orderNumber === n)) {
        lines.push(`- Zamówienia ${n} NIE MA w bazie.`);
        lookups.push({ kind: "missing", label: n });
      }
    }
  }

  for (const email of emails) {
    const ids = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Order" WHERE lower("customerEmail") = lower(${email})
      ORDER BY "createdAt" DESC LIMIT 5`;
    if (ids.length) {
      pushOrders(await prisma.order.findMany({ where: { id: { in: ids.map((r) => r.id) } }, orderBy: { createdAt: "desc" } }));
    }
    const account = await describeAccount(email);
    if (account) {
      lines.push(account.text);
      lookups.push({ kind: "account", label: email });
    }
    if (!ids.length && !account) {
      lines.push(`- Adres ${email}: brak zamówień i brak konta w bazie.`);
      lookups.push({ kind: "missing", label: email });
    }
  }

  for (const id of deviceIds) {
    const desc = await describeDevice(id);
    if (desc) {
      lines.push(desc);
      lookups.push({ kind: "device", label: id });
    }
  }

  return { block: lines.join("\n"), lookups };
}

const tokenPacksText = TOKEN_PACKS.map(
  (p) => `${p.label}: ${(p.priceGrosze / 100).toFixed(0)} zł / ${(p.priceEurCents / 100).toFixed(0)} EUR`
).join("; ");

const faqText = faqs.pl.map((f) => `P: ${f.q}\nO: ${f.a}`).join("\n\n");

// Fakty sklepowe, ktorych nie ma w KALKMATE_KNOWLEDGE (to jest pod szkic
// odpowiedzi w Poczcie). Zrodla: components/BuyNow.tsx, lib/tokenPacks.ts,
// lib/seo.ts (wysylka), lib/content/faq.ts.
export const SHOP_FACTS = `=== SKLEP, CENY, WYSYŁKA ===
- Cena kalkulatora: 699 zł (Polska) / 169 EUR (zagranica). Sprzedaż na kalkmate.pl (także kalkmate.eu), strona w 11 językach.
- Wysyłka: Polska — InPost (Paczkomat) za darmo; UE — 20 EUR; reszta świata — 35 EUR. Jedna paczka niezależnie od liczby sztuk.
- Czas realizacji: kalkulatory są składane ręcznie — do ok. 4 tygodni (zagranica zwykle 2–4 tygodnie z dostawą).
- Płatności: Przelewy24 (PL) i karta przez Stripe.
- Paczki tokenów (panel kalkmate.pl → zakładka AI → Kup tokeny): ${tokenPacksText}.
- Firma: KAJPA Kacper Popko, ul. Zastawie I 37, 16-070 Choroszcz, NIP 9662222951, kontakt@kalkmate.pl.

=== FAQ ZE STRONY (PL) ===
${faqText}`;

function systemPrompt(dbBlock: string): string {
  return `Jesteś wewnętrznym asystentem zespołu KalkMate (kalkulator edukacyjny z AI, kalkmate.pl). Rozmawiasz z właścicielem sklepu, NIE z klientem.
Pomagasz mu szybko odpowiadać na maile, które przychodzą na różne adresy (poza panelem Poczta), i odpowiadasz na jego pytania o produkt, sklep i konkretnych klientów.

${KALKMATE_KNOWLEDGE}

${SHOP_FACTS}

=== DANE Z BAZY KALKMATE (odczytane teraz, aktualne) ===
${dbBlock || "(w rozmowie nie ma adresu e-mail, numeru zamówienia KM-… ani Device ID — nic nie sprawdzano w bazie)"}

Zasady:
- Gdy właściciel wkleja maila od klienta (albo prosi „odpisz”, „napisz odpowiedź”): napisz gotową odpowiedź do wysłania W JĘZYKU KLIENTA, ton ciepły i rzeczowy, bez emoji, z podpisem „Zespół KalkMate” w języku odpowiedzi. Odpowiedź umieść w bloku między liniami \`---\` (na początku i na końcu), żeby dało się ją skopiować — sam czysty tekst maila, bez Markdown (bez gwiazdek, nagłówków). Pod blokiem, po polsku, krótko (max 3 punkty): czego brakuje / co sprawdzić / co obiecujesz, jeśli to istotne. Bez tych uwag, jeśli nie ma nic ważnego.
- Gdy właściciel pyta o coś (np. „ile kosztuje wysyłka do Niemiec?”, „co z zamówieniem KM-…?”) — odpowiadaj po polsku, krótko i konkretnie.
- Opieraj się WYŁĄCZNIE na bazie wiedzy i danych z bazy powyżej. Nie wymyślaj statusów, dat, numerów przesyłek, kwot, funkcji ani terminów. Jeśli czegoś nie wiesz — powiedz to wprost i zaproponuj, co sprawdzić.
- Jeśli klient pyta o swoje zamówienie, a w danych z bazy go nie ma — w odpowiedzi poproś o numer zamówienia albo e-mail użyty przy zakupie, a właścicielowi zasugeruj wklejenie adresu nadawcy.
- Nie pisz w odpowiedzi do klienta, że coś zostało już załatwione (zwrot, wymiana, anulowanie), jeśli właściciel tego nie potwierdził — pisz, że zespół się tym zajmie.
- O prawie do zwrotu w 14 dni wspominaj tylko, gdy klient wprost o to pyta.
- Właściciel może poprawiać szkic („krócej”, „po angielsku”, „dodaj że wyślemy w piątek”) — wtedy zwróć poprawioną całą odpowiedź w tym samym formacie.`;
}

export async function askAssistant(messages: AssistantMessage[]): Promise<{ reply: string; lookups: AssistantLookup[] }> {
  if (!OPENROUTER_API_KEY) throw new Error("OpenRouter API key not configured");

  // Ostatnie 20 wiadomosci, kazda przycieta — dlugie watki mailowe potrafia
  // miec dziesiatki tysiecy znakow cytatow.
  const history = messages.slice(-20).map((m) => ({ role: m.role, content: m.content.slice(0, 12_000) }));
  const { block, lookups } = await lookupContext(history.filter((m) => m.role === "user").map((m) => m.content).join("\n"));

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://kalkmate.pl",
      "X-Title": "KalkMate",
    },
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      model: ASSISTANT_MODEL,
      messages: [{ role: "system", content: systemPrompt(block) }, ...history],
      temperature: 0.4,
      max_tokens: 4000,
      // patrz lib/mailReply.ts — bez tego model potrafi zjesc max_tokens na reasoning.
      reasoning: { effort: "minimal" },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Pusta odpowiedz modelu");
  return { reply: content.trim(), lookups };
}
