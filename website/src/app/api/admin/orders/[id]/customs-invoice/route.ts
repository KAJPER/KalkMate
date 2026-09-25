import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { PICKUP_ADDRESSES, bcGetProfile, normalizeCountryForShipping, type PickupAddressKey } from "@/lib/basecourier";
import { buildCustomsInvoicePdf } from "@/lib/customsInvoice";

// GET /api/admin/orders/[id]/customs-invoice?value=&hs=&origin=&from=
// Faktura handlowa (PDF) do przesylek poza UE — do wydruku w 3 egzemplarzach
// przy wersji papierowej dokumentow celnych (patrz basecourier.ts).
//   value  — laczna wartosc towaru w walucie zamowienia (domyslnie kwota zamowienia)
//   hs     — kod HS towaru (domyslnie 8470.10 — kalkulatory elektroniczne)
//   origin — kraj pochodzenia, kod ISO (domyslnie PL)
//   from   — klucz adresu nadawcy (PICKUP_ADDRESSES), domyslnie choroszcz
// Dane celne (kod HS, kraj pochodzenia, wartosc) sa deklaracja sprzedawcy —
// domyslne wartosci sa tylko podpowiedzia, admin je sprawdza w panelu.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });

  const q = request.nextUrl.searchParams;
  const value = parseFloat((q.get("value") || "").replace(",", "."));
  const totalValue = Number.isFinite(value) && value > 0 ? value : order.amount / 100;
  const hsRaw = (q.get("hs") || "").trim();
  const hsCode = /^[0-9. ]{4,14}$/.test(hsRaw) ? hsRaw : "8470.10";
  const originRaw = (q.get("origin") || "").trim().toUpperCase();
  const origin = /^[A-Z]{2}$/.test(originRaw) ? originRaw : "PL";
  const fromKey = (q.get("from") || "choroszcz") as PickupAddressKey;
  const from = PICKUP_ADDRESSES[fromKey] ?? PICKUP_ADDRESSES.choroszcz;

  let profile = { name: "Kacper Popko", vat_company: "KAJPA Kacper Popko", phone: "600580888", email: "kacper@kajpa.pl" };
  try {
    const p = await bcGetProfile();
    profile = { name: p.name || profile.name, vat_company: p.vat_company || profile.vat_company, phone: p.phone || profile.phone, email: p.email || profile.email };
  } catch {
    /* profil to tylko dane kontaktowe — faktura sie wygeneruje ze stalymi */
  }

  const country = normalizeCountryForShipping(order.customerCountry || "");
  // Poprawki odbiorcy wpisane w panelu przed nadaniem (jeszcze nie zapisane w zamowieniu).
  const pick = (key: string, fallback: string, max: number) => {
    const v = (q.get(key) || "").trim().replace(/\s+/g, " ");
    return v && v.length <= max ? v : fallback;
  };

  try {
    const pdf = await buildCustomsInvoicePdf({
      invoiceNo: order.orderNumber,
      date: new Date().toISOString().slice(0, 10),
      shipper: {
        name: profile.name,
        company: profile.vat_company,
        street: `${from.street} ${from.house_no}${from.locum_no ? `/${from.locum_no}` : ""}`,
        postal: from.postal,
        city: from.city,
        country: "PL",
        phone: profile.phone,
        email: profile.email,
      },
      consignee: {
        name: pick("name", order.customerName, 100),
        street: pick("street", order.customerAddressStreet || "", 150),
        postal: pick("postal", order.customerAddressPostcode || "", 20),
        city: pick("city", order.customerAddressCity || "", 80),
        country,
        phone: pick("phone", order.customerPhone, 20),
        email: pick("email", order.customerEmail, 120),
      },
      goods: {
        description: "Electronic calculator KalkMate v3.0",
        hsCode,
        originCountry: origin,
        quantity: 1,
        unitValue: totalValue,
        currency: (order.currency || "eur").toUpperCase(),
        weightKg: 1,
      },
    });
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="commercial-invoice-${order.orderNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[customs-invoice] failed", id, e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
