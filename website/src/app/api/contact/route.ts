import { NextRequest, NextResponse } from "next/server";
import { sendMail } from "@/lib/mailer";

// Prosty rate limit in-memory (1 mail / IP / 60s)
const lastByIp = new Map<string, number>();
const RATE_LIMIT_MS = 60_000;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest) {
  try {
    const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "anon").trim();
    const now = Date.now();
    const last = lastByIp.get(ip) || 0;
    if (now - last < RATE_LIMIT_MS) {
      return NextResponse.json(
        { ok: false, error: "Za szybko. Sproboj za chwile." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const name = String(body?.name || "").trim().slice(0, 100);
    const email = String(body?.email || "").trim().toLowerCase().slice(0, 150);
    const subject = String(body?.subject || "").trim().slice(0, 200);
    const message = String(body?.message || "").trim().slice(0, 5000);

    if (!name || !email || !message) {
      return NextResponse.json({ ok: false, error: "Imie, email i wiadomosc wymagane." }, { status: 400 });
    }
    if (!email.includes("@") || email.length < 5) {
      return NextResponse.json({ ok: false, error: "Niepoprawny email." }, { status: 400 });
    }
    if (message.length < 5) {
      return NextResponse.json({ ok: false, error: "Wiadomosc za krotka." }, { status: 400 });
    }

    lastByIp.set(ip, now);

    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#0B0B0B;font-family:'Inter',sans-serif;color:#F2EDE3;">
<div style="max-width:600px;margin:0 auto;background:#141414;border:1px solid #2A2A2A;padding:28px;">
  <div style="border-bottom:1px solid #2A2A2A;padding-bottom:14px;margin-bottom:18px;">
    <span style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#D8FF3D;font-weight:700;">/CONTACT &middot; kalkmate.pl</span>
  </div>
  <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Nowa wiadomosc z formularza</h1>
  <table style="width:100%;margin:18px 0;">
    <tr><td style="padding:8px 0;border-bottom:1px solid #2A2A2A;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#6B6863;">Od</td>
        <td style="padding:8px 0;border-bottom:1px solid #2A2A2A;text-align:right;color:#F2EDE3;">${escapeHtml(name)}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #2A2A2A;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#6B6863;">Email</td>
        <td style="padding:8px 0;border-bottom:1px solid #2A2A2A;text-align:right;font-family:'JetBrains Mono',monospace;color:#D8FF3D;">${escapeHtml(email)}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #2A2A2A;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#6B6863;">Temat</td>
        <td style="padding:8px 0;border-bottom:1px solid #2A2A2A;text-align:right;color:#F2EDE3;">${escapeHtml(subject || "(brak)")}</td></tr>
  </table>
  <div style="margin-top:20px;padding:18px;background:#0B0B0B;border-left:3px solid #D8FF3D;white-space:pre-wrap;font-family:'Inter',sans-serif;font-size:14.5px;line-height:1.6;color:#F2EDE3;">${escapeHtml(message)}</div>
  <p style="margin-top:24px;font-family:'JetBrains Mono',monospace;font-size:10px;color:#6B6863;letter-spacing:0.15em;text-transform:uppercase;">IP: ${escapeHtml(ip)} &middot; ${new Date().toISOString()}</p>
</div>
</body></html>`;

    const r = await sendMail({
      to: "kontakt@kalkmate.pl",
      subject: `[Formularz] ${subject || "Wiadomosc"} - ${name}`,
      html,
      replyTo: email,
    });
    if (!r.ok) {
      console.error("[contact] send failed:", r.error);
      return NextResponse.json({ ok: false, error: "Nie udalo sie wyslac. Sproboj za chwile." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[contact]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
