import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { stripe } from "@/lib/stripe";
import { sendMail } from "@/lib/mailer";

function invoiceHtml(name: string, filename: string) {
  return `<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0B0B0B;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;padding:0 16px">
    <div style="background:#0B0B0B;border:1px solid rgba(242,237,227,0.12);padding:40px">
      <p style="margin:0 0 4px;font-family:monospace;font-size:11px;letter-spacing:0.12em;color:#D8FF3D">/ DOKUMENT</p>
      <h1 style="margin:12px 0 0;font-size:32px;font-weight:600;color:#F2EDE3;line-height:1.1">Faktura<br><em style="font-style:italic;color:#D8FF3D">do zamówienia</em>.</h1>
      <div style="margin:32px 0;height:1px;background:rgba(242,237,227,0.10)"></div>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:rgba(242,237,227,0.70)">Cześć ${name},</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:rgba(242,237,227,0.70)">
        W załączniku znajdziesz fakturę do swojego zamówienia <strong style="color:#F2EDE3">KalkMate v1.0</strong>.
        Jeśli masz pytania dotyczące faktury, odpisz na tego maila.
      </p>
      <div style="background:#0E0E0E;border:1px solid rgba(242,237,227,0.10);padding:16px 20px;margin-bottom:28px">
        <p style="margin:0 0 6px;font-family:monospace;font-size:10px;letter-spacing:0.10em;color:#D8FF3D">/ ZAŁĄCZNIK</p>
        <p style="margin:0;font-size:14px;color:#F2EDE3;font-family:monospace">${filename}</p>
      </div>
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;

  try {
    const formData = await request.formData();
    const file = formData.get("invoice") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Brak pliku faktury" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Tylko pliki PDF są obsługiwane" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Plik zbyt duży (max 10 MB)" }, { status: 400 });
    }

    const pi = await stripe.paymentIntents.retrieve(id);
    const email = pi.metadata.customer_email;
    const name  = (pi.metadata.customer_name || "Kliencie").split(" ")[0];

    if (!email) {
      return NextResponse.json({ error: "Brak adresu email klienta w zamówieniu" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await sendMail({
      to: email,
      subject: `KalkMate — Faktura do zamówienia`,
      html: invoiceHtml(name, file.name),
      attachments: [
        {
          filename: file.name,
          content: buffer,
          contentType: "application/pdf",
        },
      ],
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error || "Błąd wysyłki" }, { status: 500 });
    }

    await stripe.paymentIntents.update(id, {
      metadata: {
        invoice_sent_at: new Date().toISOString(),
        invoice_filename: file.name,
      },
    });

    return NextResponse.json({ ok: true, sentTo: email, filename: file.name });
  } catch (e) {
    console.error("[invoice] send error:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
