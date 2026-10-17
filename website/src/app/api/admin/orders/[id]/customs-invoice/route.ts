import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { PICKUP_ADDRESSES, bcGetProfile, normalizeCountryForShipping, splitCityState, warsawToday, type PickupAddressKey } from "@/lib/basecourier";
import { buildCustomsInvoicePdf, customsGoodsValue, customsUnitValue, CUSTOMS_UNIT_WEIGHT_KG } from "@/lib/customsInvoice";
import { readOrderUnits } from "@/lib/orderPersonalization";

// GET /api/admin/orders/[id]/customs-invoice?value=&hs=&origin=&from=
// Faktura handlowa (PDF) do przesylek poza UE — do wydruku w 3 egzemplarzach
// przy wersji papierowej dokumentow celnych (patrz basecourier.ts).
//   value  — laczna wartosc towaru w walucie zamowienia (domyslnie kwota zamowienia
//            BEZ oplaty za wysylke — customsGoodsValue); przy kilku sztukach
//            dzielona rowno na sztuki (rabat rozlozony proporcjonalnie)
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
  const totalValue = Number.isFinite(value) && value > 0 && value < 1_000_000 ? value : customsGoodsValue(order);
  // Liczba sztuk (Order.quantity, stare zamowienia = 1).
  const units = await readOrderUnits(order.id).catch(() => null);
  const quantity = Math.max(1, Math.floor(Number(units?.quantity) || 1));
  const unitValue = customsUnitValue(totalValue, quantity);
  const hsRaw = (q.get("hs") || "").trim();
  const hsCode = /^[0-9. ]{4,14}$/.test(hsRaw) ? hsRaw : "8470.10";
  const originRaw = (q.get("origin") || "").trim().toUpperCase();
  const origin = /^[A-Z]{2}$/.test(originRaw) ? originRaw : "PL";
  // Tylko wlasne klucze — "constructor"/"__proto__" z URL dawaly obiekt z
  // prototypu zamiast adresu (na fakturze "undefined undefined").
  const fromRaw = q.get("from") || "choroszcz";
  const fromKey: PickupAddressKey = Object.prototype.hasOwnProperty.call(PICKUP_ADDRESSES, fromRaw) ? (fromRaw as PickupAddressKey) : "choroszcz";
  const from = PICKUP_ADDRESSES[fromKey];

  let profile = { name: "Kacper Popko", vat_company: "KAJPA Kacper Popko", phone: "600580888", email: "kacper@kajpa.pl" };
  try {
    const p = await bcGetProfile();
    profile = { name: p.name || profile.name, vat_company: p.vat_company || profile.vat_company, phone: p.phone || profile.phone, email: p.email || profile.email };
  } catch {
    /* profil to tylko dane kontaktowe — faktura sie wygeneruje ze stalymi */
  }

  // Puste customerCountry = zamowienie krajowe (konwencja checkoutPricing), nie "US".
  const country = normalizeCountryForShipping(order.customerCountry || "PL");
  // Poprawki odbiorcy wpisane w panelu przed nadaniem (jeszcze nie zapisane w zamowieniu).
  const pick = (key: string, fallback: string, max: number) => {
    const v = (q.get(key) || "").trim().replace(/\s+/g, " ");
    return v && v.length <= max ? v : fallback;
  };

  // Stan (US/CA) — z formularza panelu albo wykryty z pola miasta zamowienia; na fakturze "Miasto, ST".
  const guessed = splitCityState(order.customerAddressCity, order.customerCountry);
  const consigneeState = pick("state", guessed.state, 3);
  const consigneeCityBase = pick("city", guessed.city, 80);
  const consigneeCity = consigneeState ? `${consigneeCityBase}, ${consigneeState}` : consigneeCityBase;

  try {
    const pdf = await buildCustomsInvoicePdf({
      invoiceNo: order.orderNumber,
      date: warsawToday(), // data w strefie Europe/Warsaw (serwer chodzi w UTC)
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
        city: consigneeCity,
        country,
        phone: pick("phone", order.customerPhone, 20),
        email: pick("email", order.customerEmail, 120),
      },
      goods: {
        description: "Electronic calculator KalkMate v3.0",
        hsCode,
        originCountry: origin,
        quantity,
        unitValue,
        currency: (order.currency || "eur").toUpperCase(),
        weightKg: CUSTOMS_UNIT_WEIGHT_KG * quantity,
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
