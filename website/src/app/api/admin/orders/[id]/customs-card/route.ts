import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { bcGetProfile } from "@/lib/basecourier";
import { fillCustomsCard } from "@/lib/customsCard";

// Kopia formularza UPS z Base Courier (basecourier.com/panel/export/docs).
const TEMPLATE_PATH = path.join(process.cwd(), "assets", "ups", "karta-odprawy-celnej-eksportowej.pdf");

// Przyblizone przeliczniki tylko do sprawdzenia progu 1000 EUR z Karty.
const APPROX_TO_EUR: Record<string, number> = { EUR: 1, PLN: 1 / 4.3, USD: 1 / 1.1 };

// GET /api/admin/orders/[id]/customs-card?value=
// Wypelniona "Karta odprawy celnej eksportowej" UPS (PDF do wydruku i podpisu) —
// obok faktury celnej przy wysylce poza UE w wersji papierowej dokumentow celnych.
// Wypelnia dane obiektywne (opis towaru, numer faktury, waluta, nadawca, sprzedaz,
// brak towarow strategicznych, transport nie wliczony w cene). Oswiadczenia, data
// i podpis zostaja do recznego wypelnienia. Pole "IE599 nie jest wymagane" jest
// zaznaczane tylko dla wartosci <= 1000 EUR (warunek z samej Karty).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });

  const q = request.nextUrl.searchParams;
  const valueParam = parseFloat((q.get("value") || "").replace(",", "."));
  const value = Number.isFinite(valueParam) && valueParam > 0 ? valueParam : order.amount / 100;
  const currency = (order.currency || "eur").toUpperCase();
  const valueEur = value * (APPROX_TO_EUR[currency] ?? 1);

  let profile = { name: "Kacper Popko", vat_company: "KAJPA Kacper Popko", phone: "600580888", email: "kacper@kajpa.pl" };
  try {
    const p = await bcGetProfile();
    profile = { name: p.name || profile.name, vat_company: p.vat_company || profile.vat_company, phone: p.phone || profile.phone, email: p.email || profile.email };
  } catch {
    /* profil to tylko dane kontaktowe */
  }

  try {
    const template = await readFile(TEMPLATE_PATH);
    const pdf = await fillCustomsCard(template, {
      invoiceNo: order.orderNumber,
      trackingNumber: order.trackingNumber || undefined,
      currency,
      description:
        `Kalkulator elektroniczny KalkMate v3.0, 1 szt. Urządzenie elektroniczne w obudowie z tworzywa sztucznego ` +
        `(klawiatura, wyświetlacz OLED, kamera, moduł WiFi) z wbudowanym akumulatorem litowo-polimerowym 3,7 V / 1500 mAh; ` +
        `służy do obliczeń matematycznych i pomocy w nauce. Wartość: ${value.toFixed(2).replace(".", ",")} ${currency}.`,
      senderName: `${profile.name}\n${profile.vat_company}`,
      senderContact: `tel. ${profile.phone}\n${profile.email}`,
      ie599NotRequired: valueEur <= 1000,
    });
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="karta-odprawy-celnej-${order.orderNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[customs-card] failed", id, e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
