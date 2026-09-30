import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { bcGetProfile } from "@/lib/basecourier";
import { fillCustomsAuthorization } from "@/lib/customsAuthorization";

const TEMPLATE_PATH = path.join(process.cwd(), "assets", "ups", "upowaznienie-celne-posrednie-osoba-fizyczna.pdf");

// GET /api/admin/orders/[id]/customs-authorization
// Upowaznienie celne dla agencji UPS (jednorazowe, do TEJ przesylki) — wymagane
// tylko dla wysylek > 1000 EUR/1000 kg (patrz uwaga na stronie zamowienia).
// PESEL z OWNER_PESEL (.env.production.local, NIGDY w repo — patrz .gitignore).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });

  let profile = { name: "Kacper Popko", phone: "600580888", email: "kacper@kajpa.pl", street: "ul. Zastawie I", house_no: "37", postal: "16-070", city: "Choroszcz" };
  try {
    const p = await bcGetProfile();
    profile = {
      name: p.name || profile.name,
      phone: p.phone || profile.phone,
      email: p.email || profile.email,
      street: p.street || profile.street,
      house_no: p.house_no || profile.house_no,
      postal: p.postal || profile.postal,
      city: p.city || profile.city,
    };
  } catch {
    /* profil to tylko dane kontaktowe/adresowe nadawcy */
  }

  try {
    const template = await readFile(TEMPLATE_PATH);
    const pdf = await fillCustomsAuthorization(template, {
      city: profile.city,
      fullName: profile.name,
      address: `${profile.street} ${profile.house_no}, ${profile.postal} ${profile.city}`,
      email: profile.email,
      phone: profile.phone,
      pesel: process.env.OWNER_PESEL || undefined,
      trackingNumber: order.trackingNumber || undefined,
    });
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="upowaznienie-celne-${order.orderNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[customs-authorization] failed", id, e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
