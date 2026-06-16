import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { sendMail } from "@/lib/mailer";

const CRON_SECRET = process.env.CRON_SECRET || "";
const INPOST_API  = "https://api-shipx-pl.easypack24.net/v1";

// Statusy oznaczające że kurier odebrał paczkę od nadawcy
const PICKUP_STATUSES = new Set([
  "adopted_at_source_branch",
  "collected_from_sender",
  "sent_from_source_branch",
  "adopted_at_sorting_hub",
  "sent_from_sorting_hub",
]);

async function fetchInPostStatus(trackingNumber: string): Promise<string | null> {
  try {
    const res = await fetch(`${INPOST_API}/trackings/${trackingNumber}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.status || null;
  } catch {
    return null;
  }
}

function pickupHtml(name: string, tracking: string) {
  return `<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0B0B0B;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;padding:0 16px">
    <div style="background:#0B0B0B;border:1px solid rgba(242,237,227,0.12);padding:40px">
      <p style="margin:0 0 4px;font-family:monospace;font-size:11px;letter-spacing:0.12em;color:#D8FF3D">/ STATUS PRZESYŁKI</p>
      <h1 style="margin:12px 0 0;font-size:32px;font-weight:600;color:#F2EDE3;line-height:1.1">Kurier odebrał<br><em style="font-style:italic;color:#D8FF3D">Twoją paczkę</em>.</h1>
      <div style="margin:32px 0;height:1px;background:rgba(242,237,227,0.10)"></div>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:rgba(242,237,227,0.70)">Cześć ${name},</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:rgba(242,237,227,0.70)">
        Kurier InPost odebrał Twoje zamówienie <strong style="color:#F2EDE3">KalkMate v1.0</strong>
        i przekazał je do sieci logistycznej. Paczka jest w drodze do wybranego Paczkomatu.
      </p>
      <div style="background:#0E0E0E;border:1px solid rgba(242,237,227,0.10);padding:16px 20px;margin-bottom:28px">
        <p style="margin:0 0 6px;font-family:monospace;font-size:10px;letter-spacing:0.10em;color:#D8FF3D">/ NUMER ŚLEDZENIA</p>
        <p style="margin:0;font-family:monospace;font-size:17px;color:#F2EDE3;letter-spacing:0.06em">${tracking}</p>
      </div>
      <a href="https://inpost.pl/sledzenie-przesylek?number=${tracking}"
         style="display:inline-block;padding:14px 28px;background:#D8FF3D;color:#0B0B0B;font-family:monospace;font-size:12px;letter-spacing:0.10em;text-decoration:none;font-weight:700">
        ŚLEDŹ PRZESYŁKĘ →
      </a>
      <div style="margin:32px 0;height:1px;background:rgba(242,237,227,0.10)"></div>
      <p style="margin:0;font-size:12px;color:rgba(242,237,227,0.35)">
        KalkMate · kalkmate.pl<br>
        Masz pytania? Odpisz na tego maila lub napisz na kacper@kajpa.pl
      </p>
    </div>
  </div>
</body>
</html>`;
}

function deliveredHtml(name: string, tracking: string, pickupPoint: string) {
  return `<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0B0B0B;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;padding:0 16px">
    <div style="background:#0B0B0B;border:1px solid rgba(242,237,227,0.12);padding:40px">
      <p style="margin:0 0 4px;font-family:monospace;font-size:11px;letter-spacing:0.12em;color:#D8FF3D">/ DOSTAWA ZREALIZOWANA</p>
      <h1 style="margin:12px 0 0;font-size:32px;font-weight:600;color:#F2EDE3;line-height:1.1">Paczka czeka<br><em style="font-style:italic;color:#D8FF3D">w Paczkomacie</em>.</h1>
      <div style="margin:32px 0;height:1px;background:rgba(242,237,227,0.10)"></div>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:rgba(242,237,227,0.70)">Cześć ${name},</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:rgba(242,237,227,0.70)">
        Twój <strong style="color:#F2EDE3">KalkMate v1.0</strong> dotarł do Paczkomatu
        i czeka na odbiór. Masz <strong style="color:#F2EDE3">48 godzin</strong> na odebranie paczki.
      </p>
      <div style="background:#0E0E0E;border:1px solid rgba(242,237,227,0.10);padding:16px 20px;margin-bottom:12px">
        <p style="margin:0 0 6px;font-family:monospace;font-size:10px;letter-spacing:0.10em;color:#D8FF3D">/ PACZKOMAT</p>
        <p style="margin:0;font-size:15px;color:#F2EDE3;font-weight:600">${pickupPoint || "—"}</p>
      </div>
      <div style="background:#0E0E0E;border:1px solid rgba(242,237,227,0.10);padding:16px 20px;margin-bottom:28px">
        <p style="margin:0 0 6px;font-family:monospace;font-size:10px;letter-spacing:0.10em;color:#D8FF3D">/ NUMER ŚLEDZENIA</p>
        <p style="margin:0;font-family:monospace;font-size:17px;color:#F2EDE3;letter-spacing:0.06em">${tracking}</p>
      </div>
      <a href="https://inpost.pl/sledzenie-przesylek?number=${tracking}"
         style="display:inline-block;padding:14px 28px;background:#D8FF3D;color:#0B0B0B;font-family:monospace;font-size:12px;letter-spacing:0.10em;text-decoration:none;font-weight:700">
        SZCZEGÓŁY PRZESYŁKI →
      </a>
      <div style="margin:32px 0;height:1px;background:rgba(242,237,227,0.10)"></div>
      <p style="margin:0;font-size:12px;color:rgba(242,237,227,0.35)">
        KalkMate · kalkmate.pl<br>
        Masz pytania? Odpisz na tego maila lub napisz na kacper@kajpa.pl
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: string[] = [];
  let checked = 0, emailsSent = 0;

  try {
    // Pobierz wszystkie succeeded payment intents (max 100)
    const list = await stripe.paymentIntents.list({ limit: 100, expand: [] });

    for (const pi of list.data) {
      const tracking = pi.metadata.tracking_number;
      if (!tracking) continue;

      // Pomiń jeśli już dostarczono i powiadomiono
      if (
        pi.metadata.tracking_last_status === "delivered" &&
        pi.metadata.tracking_notified_delivered === "1"
      ) continue;

      const status = await fetchInPostStatus(tracking);
      if (!status) continue;

      checked++;
      const prev = pi.metadata.tracking_last_status || "";
      if (status === prev) continue;

      const metaUpdate: Record<string, string> = { tracking_last_status: status };
      const email = pi.metadata.customer_email;
      const name  = (pi.metadata.customer_name || "Kliencie").split(" ")[0];

      // Kurier odebrał
      if (PICKUP_STATUSES.has(status) && !pi.metadata.tracking_notified_pickup) {
        metaUpdate.tracking_notified_pickup = "1";
        if (email) {
          await sendMail({
            to: email,
            subject: "KalkMate — Kurier odebrał Twoją paczkę",
            html: pickupHtml(name, tracking),
          });
          emailsSent++;
          results.push(`[PICKUP] ${pi.id} → ${email}`);
        }
      }

      // Dostarczono do paczkomatu
      if (status === "delivered" && !pi.metadata.tracking_notified_delivered) {
        metaUpdate.tracking_notified_delivered = "1";
        if (email) {
          await sendMail({
            to: email,
            subject: "KalkMate — Paczka czeka w Paczkomacie!",
            html: deliveredHtml(name, tracking, pi.metadata.pickup_point || ""),
          });
          emailsSent++;
          results.push(`[DELIVERED] ${pi.id} → ${email}`);
        }
      }

      await stripe.paymentIntents.update(pi.id, { metadata: metaUpdate });
      results.push(`${pi.id}: ${prev || "brak"} → ${status}`);
    }

    console.log(`[cron/tracking] checked=${checked} emails=${emailsSent}`);
    return NextResponse.json({ ok: true, checked, emailsSent, results });
  } catch (e) {
    console.error("[cron/tracking]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
