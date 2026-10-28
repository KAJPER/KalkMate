import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminAuth } from "@/lib/admin-auth";
import {
  affiliateBalance,
  listAffiliates,
  listAllPayouts,
  setAffiliateActive,
  setPayoutStatus,
  tierForUnits,
  type PayoutRow,
} from "@/lib/affiliates";
import { sendMail } from "@/lib/mailer";
import { escHtml } from "@/lib/email-templates";

// GET /api/admin/affiliates — partnerzy (z saldem i poziomem) + wszystkie wyplaty
export async function GET(req: NextRequest) {
  const authErr = await requireAdminAuth(req); if (authErr) return authErr;
  try {
    const rows = await listAffiliates();
    // Lista jest mala — saldo liczone per partner.
    const affiliates = await Promise.all(rows.map(async (a) => {
      const b = await affiliateBalance(a.userId);
      const tier = tierForUnits(a.units);
      return { ...a, availableCents: b.availableCents, pendingCents: b.pendingCents, tier: { key: tier.key, pct: tier.pct } };
    }));
    const payouts = await listAllPayouts(undefined, 500);

    // E-mail do wyplat (takze uzytkownikow bez kodu — np. po usunieciu konta brak).
    const emails = new Map<string, string | null>(rows.map((a) => [a.userId, a.email]));
    const missing = [...new Set(payouts.map((p) => p.userId).filter((id) => !emails.has(id)))];
    if (missing.length) {
      const users = await prisma.user.findMany({ where: { id: { in: missing } }, select: { id: true, email: true } });
      for (const u of users) emails.set(u.id, u.email);
    }
    return NextResponse.json({
      ok: true,
      affiliates,
      payouts: payouts.map((p) => ({ ...p, email: emails.get(p.userId) ?? null })),
    });
  } catch (e) {
    console.error("[admin/affiliates GET]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

const plnFmt = (cents: number) =>
  `${(cents / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;

function payoutMailHtml(p: PayoutRow, status: "paid" | "rejected", note: string | null): string {
  const amount = escHtml(plnFmt(p.amountCents));
  const iban = p.iban ? escHtml(`…${p.iban.slice(-4)}`) : "";
  const noteHtml = note
    ? `<p style="margin:12px 0;padding:10px 14px;background:#f3f4f6;border-radius:6px;"><b>Uwaga / Note:</b> ${escHtml(note)}</p>`
    : "";
  const pl = status === "paid"
    ? `<p>Wysłaliśmy przelew <b>${amount}</b> z programu partnerskiego KalkMate${iban ? ` na konto ${iban}` : ""}. Pieniądze powinny dotrzeć w ciągu 1–2 dni roboczych.</p>`
    : `<p>Twoje zlecenie wypłaty <b>${amount}</b> z programu partnerskiego KalkMate zostało odrzucone. Kwota wróciła do salda — możesz zlecić wypłatę ponownie albo wymienić ją na tokeny AI.</p>`;
  const en = status === "paid"
    ? `<p>We have sent a bank transfer of <b>${amount}</b> from the KalkMate partner program${iban ? ` to account ${iban}` : ""}. It should arrive within 1–2 business days.</p>`
    : `<p>Your payout request of <b>${amount}</b> from the KalkMate partner program was rejected. The amount is back in your balance — you can request a payout again or exchange it for AI tokens.</p>`;
  return `<!doctype html><html lang="pl"><body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#111;">
  <div style="max-width:560px;margin:0 auto;">
    <h2 style="margin:0 0 12px 0;">${status === "paid" ? "Wypłata wysłana" : "Wypłata odrzucona"}</h2>
    ${pl}
    ${noteHtml}
    <p>Szczegóły: <a href="https://kalkmate.pl/panel">kalkmate.pl/panel</a>. Pytania? Odpisz na tego maila.</p>
    <hr style="border:0;border-top:1px solid #e5e7eb;margin:20px 0;">
    ${en}
    <p>Details: <a href="https://kalkmate.pl/panel">kalkmate.pl/panel</a>. Questions? Just reply to this email.</p>
    <p style="color:#6b7280;font-size:12px;margin-top:24px;">KalkMate — program partnerski / partner program</p>
  </div></body></html>`;
}

// PATCH /api/admin/affiliates?payout=<id> — Body: { status: "paid"|"rejected", note? }
// PATCH /api/admin/affiliates?code=<code> — Body: { active: boolean }
export async function PATCH(req: NextRequest) {
  const authErr = await requireAdminAuth(req); if (authErr) return authErr;
  try {
    const params = new URL(req.url).searchParams;
    const body = await req.json().catch(() => ({}));

    const payoutId = params.get("payout");
    if (payoutId) {
      const status = body?.status === "paid" ? "paid" : body?.status === "rejected" ? "rejected" : null;
      if (!status) return NextResponse.json({ ok: false, error: "Nieprawidlowy status" }, { status: 400 });
      const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;
      const ok = await setPayoutStatus(payoutId, status, note);
      if (!ok) {
        return NextResponse.json({ ok: false, error: "Wyplata nie istnieje albo jest juz rozliczona." }, { status: 409 });
      }
      // Mail do klienta — blad wysylki nie cofa zmiany statusu.
      let mailed = false;
      try {
        const rows = await prisma.$queryRaw<PayoutRow[]>`SELECT * FROM "AffiliatePayout" WHERE "id" = ${payoutId} LIMIT 1`;
        const p = rows[0] ? { ...rows[0], amountCents: Number(rows[0].amountCents) } : null;
        const user = p ? await prisma.user.findUnique({ where: { id: p.userId }, select: { email: true } }) : null;
        if (p && user?.email) {
          const r = await sendMail({
            to: user.email,
            subject: status === "paid"
              ? "Wypłata z programu partnerskiego wysłana / Payout sent – KalkMate"
              : "Wypłata z programu partnerskiego odrzucona / Payout rejected – KalkMate",
            html: payoutMailHtml(p, status, note),
          });
          mailed = r.ok;
        }
      } catch (e) {
        console.error("[admin/affiliates PATCH mail]", e);
      }
      return NextResponse.json({ ok: true, id: payoutId, status, mailed });
    }

    const code = params.get("code");
    if (code) {
      const active = !!body?.active;
      const ok = await setAffiliateActive(code, active);
      if (!ok) return NextResponse.json({ ok: false, error: "Nie ma takiego kodu" }, { status: 404 });
      return NextResponse.json({ ok: true, code, active });
    }

    return NextResponse.json({ ok: false, error: "Brak payout lub code" }, { status: 400 });
  } catch (e) {
    console.error("[admin/affiliates PATCH]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
