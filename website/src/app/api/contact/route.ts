import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { sendMail, CONTACT_EMAIL } from "@/lib/mailer";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { COMPLAINT_ACK_SUBJECT, complaintAckEmail } from "@/lib/email-templates";
import { EMAIL_MAX_LENGTH, EMAIL_RE } from "@/lib/auth";

const MESSAGE_MAX = 5000;
// Zadania z formularza /reklamacja (src/app/reklamacja/page.tsx, ZADANIA).
const KNOWN_DEMANDS = new Set([
  "Naprawa urządzenia",
  "Wymiana na nowy egzemplarz",
  "Obniżenie ceny",
  "Odstąpienie od umowy / zwrot pieniędzy",
]);
const COMPLAINT_DEADLINE_DAYS = 14; // art. 7a ustawy o prawach konsumenta

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);

function ticketNumber(now: Date): string {
  const ymd = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(now).replace(/-/g, "");
  return `RK-${ymd}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

// Formularz reklamacji sklada tresc jako tekst z sekcjami (DANE ZGLASZAJACEGO,
// DANE ZAKUPU, OPIS WADY, ZADANIE...). Dlugi opis + obciecie do 5000 znakow
// zjadalo sekcje ZADANIE (ostatnia) — przenosimy ja PRZED opis, zanim utniemy.
interface ParsedComplaint {
  message: string;
  demand?: string;
  orderNumber?: string;
}

function parseComplaint(raw: string): ParsedComplaint | null {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const idx = lines.findIndex((l) => l.trim().toUpperCase() === "ŻĄDANIE");
  if (idx < 0) return null;
  let end = idx + 1;
  while (end < lines.length && lines[end].trim() !== "") end++;
  const demandLines = lines.slice(idx + 1, end).map((l) => l.slice(0, 200));
  const rest = [...lines.slice(0, idx), ...lines.slice(end)];
  // "Adres: ..." z formularza — rozsadny limit, zeby nie wypchnal reszty.
  const limited = rest.map((l) => (/^Adres:/i.test(l) ? l.slice(0, 300) : l));
  const opisIdx = limited.findIndex((l) => l.trim().toUpperCase() === "OPIS WADY");
  const block = ["ŻĄDANIE", ...demandLines, ""];
  const reordered = opisIdx >= 0
    ? [...limited.slice(0, opisIdx), ...block, ...limited.slice(opisIdx)]
    : [...block, ...limited];
  const orderLine = limited.find((l) => /^Numer zamówienia:/i.test(l));
  const demand = demandLines.join(" ").trim();
  // Do maila klienta trafia tylko cos, co wyglada jak nasz numer (KM-RRRRMMDD-NNNN).
  const orderRaw = orderLine ? orderLine.replace(/^Numer zamówienia:\s*/i, "").trim() : "";
  return {
    message: reordered.join("\n"),
    demand: KNOWN_DEMANDS.has(demand) ? demand : undefined,
    orderNumber: /^[A-Za-z0-9-]{3,32}$/.test(orderRaw) ? orderRaw.toUpperCase() : undefined,
  };
}

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);

    const body = await req.json().catch(() => null);
    const name = String(body?.name || "").trim().slice(0, 100);
    const email = String(body?.email || "").trim().toLowerCase();
    const subject = String(body?.subject || "").trim().slice(0, 200);
    let message = String(body?.message || "").trim().slice(0, 20_000);

    if (!name || !email || !message) {
      return NextResponse.json({ ok: false, error: "Imie, email i wiadomosc wymagane." }, { status: 400 });
    }
    if (email.length > EMAIL_MAX_LENGTH || !EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: "Niepoprawny email." }, { status: 400 });
    }
    if (message.length < 5) {
      return NextResponse.json({ ok: false, error: "Wiadomosc za krotka." }, { status: 400 });
    }

    // Limity z lib/rate-limit (prawdziwe IP z X-Real-IP — wczesniej XFF[0],
    // ktory klient ustawia sam). 1 wiadomosc / min i 10 / h z jednego IP.
    const rlMin = rateLimit(`contact:${ip}`, 1, 60_000);
    const rlHour = rlMin.ok ? rateLimit(`contact-h:${ip}`, 10, 60 * 60_000) : rlMin;
    if (!rlMin.ok || !rlHour.ok) {
      return NextResponse.json(
        { ok: false, error: "Za szybko. Sproboj za chwile." },
        { status: 429 }
      );
    }

    const isComplaint = /^reklamacja/i.test(subject);
    const complaint = isComplaint ? parseComplaint(message) : null;
    if (complaint) message = complaint.message;
    message = message.slice(0, MESSAGE_MAX);

    const now = new Date();
    const ticket = isComplaint ? ticketNumber(now) : null;
    const deadline = new Date(now.getTime() + COMPLAINT_DEADLINE_DAYS * 24 * 60 * 60 * 1000);

    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#0B0B0B;font-family:'Inter',sans-serif;color:#F2EDE3;">
<div style="max-width:600px;margin:0 auto;background:#141414;border:1px solid #2A2A2A;padding:28px;">
  <div style="border-bottom:1px solid #2A2A2A;padding-bottom:14px;margin-bottom:18px;">
    <span style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#D8FF3D;font-weight:700;">/CONTACT &middot; kalkmate.pl</span>
  </div>
  <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:800;letter-spacing:-0.5px;">${ticket ? `Reklamacja ${escapeHtml(ticket)}` : "Nowa wiadomosc z formularza"}</h1>
  <table style="width:100%;margin:18px 0;">
    <tr><td style="padding:8px 0;border-bottom:1px solid #2A2A2A;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#6B6863;">Od</td>
        <td style="padding:8px 0;border-bottom:1px solid #2A2A2A;text-align:right;color:#F2EDE3;">${escapeHtml(name)}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #2A2A2A;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#6B6863;">Email</td>
        <td style="padding:8px 0;border-bottom:1px solid #2A2A2A;text-align:right;font-family:'JetBrains Mono',monospace;color:#D8FF3D;">${escapeHtml(email)}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #2A2A2A;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#6B6863;">Temat</td>
        <td style="padding:8px 0;border-bottom:1px solid #2A2A2A;text-align:right;color:#F2EDE3;">${escapeHtml(subject || "(brak)")}</td></tr>${ticket ? `
    <tr><td style="padding:8px 0;border-bottom:1px solid #2A2A2A;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#6B6863;">Termin odpowiedzi</td>
        <td style="padding:8px 0;border-bottom:1px solid #2A2A2A;text-align:right;color:#D8FF3D;">${escapeHtml(fmtDate(deadline))} (14 dni)</td></tr>` : ""}
  </table>
  <div style="margin-top:20px;padding:18px;background:#0B0B0B;border-left:3px solid #D8FF3D;white-space:pre-wrap;font-family:'Inter',sans-serif;font-size:14.5px;line-height:1.6;color:#F2EDE3;">${escapeHtml(message)}</div>
  <p style="margin-top:24px;font-family:'JetBrains Mono',monospace;font-size:10px;color:#6B6863;letter-spacing:0.15em;text-transform:uppercase;">IP: ${escapeHtml(ip)} &middot; ${now.toISOString()}</p>
</div>
</body></html>`;

    const r = await sendMail({
      to: CONTACT_EMAIL,
      subject: `[Formularz]${ticket ? ` [${ticket}]` : ""} ${subject || "Wiadomosc"} - ${name}`,
      html,
      replyTo: email,
    });
    if (!r.ok) {
      console.error("[contact] send failed:", r.error);
      return NextResponse.json({ ok: false, error: "Nie udalo sie wyslac. Sproboj za chwile." }, { status: 500 });
    }

    // Potwierdzenie przyjecia reklamacji dla klienta (numer + data; termin
    // 14 dni biegnie od doreczenia). Max 3 na adres na dobe — formularz nie
    // moze sluzyc do zasypywania cudzych skrzynek. W tle.
    if (ticket && rateLimit(`complaint-ack:${email}`, 3, 24 * 60 * 60_000).ok) {
      void sendMail({
        to: email,
        subject: COMPLAINT_ACK_SUBJECT(ticket),
        html: complaintAckEmail({
          ticket,
          receivedAt: fmtDate(now),
          deadline: fmtDate(deadline),
          orderNumber: complaint?.orderNumber,
          demand: complaint?.demand,
        }),
        replyTo: CONTACT_EMAIL,
      }).then((ack) => {
        if (!ack.ok) console.error("[contact] complaint ack failed:", ack.error);
      });
    }

    return NextResponse.json({ ok: true, ...(ticket ? { ticket } : {}) });
  } catch (e) {
    console.error("[contact]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
