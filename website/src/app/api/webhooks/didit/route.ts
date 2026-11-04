import { NextRequest, NextResponse } from "next/server";
import { identityFromDecision, isAdult, nameMatches, verifyDiditWebhook } from "@/lib/didit";
import { formatPln, getRental, setRentalIdentityResult, type IdentityStatus } from "@/lib/rentals";
import { appUrl } from "@/lib/rentalPayment";
import { sendMail } from "@/lib/mailer";
import { rentalIdentityApprovedEmail, RENTAL_EMAIL_SUBJECTS } from "@/lib/email-templates";

// POST /api/webhooks/didit — wynik weryfikacji tozsamosci (wypozyczenie bez
// kaucji, lib/rentals.ts). Podpis X-Signature (HMAC surowego body) + X-Timestamp.
// "approved" tylko gdy Didit zatwierdzil ORAZ imie i nazwisko z dowodu
// zgadzaja sie z najemca ORAZ ukonczone 18 lat. Inne wyniki: klient moze
// zaplacic z kaucja. Z danych dowodu zapisujemy tylko imie i nazwisko.
// Ten sam status przyslany drugi raz (retry Didit) nic nie zmienia.
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!verifyDiditWebhook(raw, request.headers)) {
    console.warn("[didit webhook] bad signature/timestamp");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  let ev: Record<string, unknown>;
  try { ev = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (ev.webhook_type !== "status.updated") return NextResponse.json({ received: true });

  const rentalId = typeof ev.vendor_data === "string" ? ev.vendor_data : "";
  const rental = /^[0-9a-f-]{36}$/.test(rentalId) ? await getRental(rentalId) : null;
  if (!rental || rental.identitySessionId !== ev.session_id) {
    console.warn("[didit webhook] unknown rental/session", rentalId, ev.session_id);
    return NextResponse.json({ received: true });
  }

  let status: IdentityStatus | null = null;
  let name: string | null = null;
  switch (ev.status) {
    case "Approved": {
      const id = identityFromDecision(ev.decision);
      name = id ? `${id.firstName} ${id.lastName}` : null;
      status = id && nameMatches(rental.customerName, id) && isAdult(id.dateOfBirth) ? "approved" : "mismatch";
      break;
    }
    case "Declined": status = "declined"; break;
    case "In Review": status = "review"; break;
    default: return NextResponse.json({ received: true });   // Not Started / In Progress / Expired / ...
  }
  if (status === rental.identityStatus) return NextResponse.json({ received: true });

  const changed = await setRentalIdentityResult(rental.id, status, name);
  console.log(`[didit webhook] ${rental.rentalNumber}: ${ev.status} -> ${status}${changed ? "" : " (najem juz oplacony — bez zmian)"}`);
  if (changed && status === "approved") {
    // Klient mogl zamknac strone po weryfikacji — link do platnosci mailem.
    // W tle: Didit oczekuje szybkiej odpowiedzi 2xx (wolny SMTP = retry).
    void sendMail({
      to: rental.customerEmail,
      subject: RENTAL_EMAIL_SUBJECTS.identityApproved,
      html: rentalIdentityApprovedEmail({
        customerName: rental.customerName,
        rentalNumber: rental.rentalNumber,
        fee: formatPln(rental.feeGrosze),
        payUrl: `${appUrl()}/wypozyczenie?r=${rental.id}&t=${rental.accessToken}`,
      }),
    }).catch((e) => console.error("[didit webhook] mail failed", e));
  }
  return NextResponse.json({ received: true });
}
