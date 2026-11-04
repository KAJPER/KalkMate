import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { normalizeDeviceId } from "@/lib/device-auth";
import {
  assignRentalDevice,
  cancelRental,
  extendRental,
  getRental,
  markDepositRefunded,
  markRentalReturned,
} from "@/lib/rentals";

// PATCH /api/admin/rentals/[id] { action, ... }
//   assign  { deviceId }  — przypisz kalkulator (start najmu: AI do konca okresu)
//   extend  { days }      — przedluz od obecnego konca
//   return               — zwrot przyjety: kalkulator odpiety i zablokowany
//   deposit { note? }    — kaucja zwrocona (lub opis potracenia)
//   cancel  { reason? }  — anuluj (np. zwrot pieniedzy przed wysylka)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = await requireAdminAuth(request); if (authErr) return authErr;
  const { id } = await params;
  const rental = await getRental(id);
  if (!rental) return NextResponse.json({ ok: false, error: "Nie ma takiego wypożyczenia." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const action = body?.action;

  try {
    if (action === "assign") {
      if (rental.status !== "paid" && rental.status !== "active") {
        return NextResponse.json({ ok: false, error: "Kalkulator można przypisać tylko do opłaconego wypożyczenia." }, { status: 409 });
      }
      const deviceId = normalizeDeviceId(body?.deviceId);
      if (!deviceId) return NextResponse.json({ ok: false, error: "Device ID: 12 znaków hex (menu kalkulatora → Device ID)." }, { status: 400 });
      const device = await prisma.device.findUnique({ where: { deviceId }, select: { id: true } });
      if (!device) {
        return NextResponse.json({ ok: false, error: "Tego kalkulatora nie ma w bazie — włącz go raz z WiFi, żeby się zarejestrował." }, { status: 404 });
      }
      const busy = await prisma.$queryRaw<{ rentalNumber: string }[]>`
        SELECT "rentalNumber" FROM "Rental" WHERE "deviceId" = ${deviceId} AND "status" = 'active' AND "id" <> ${rental.id} LIMIT 1`;
      if (busy.length) {
        return NextResponse.json({ ok: false, error: `Ten kalkulator jest w aktywnym wypożyczeniu ${busy[0].rentalNumber}.` }, { status: 409 });
      }
      return NextResponse.json({ ok: true, rental: await assignRentalDevice(rental, deviceId) });
    }
    if (action === "extend") {
      const days = Math.floor(Number(body?.days));
      if (!Number.isFinite(days) || days < 1 || days > 365) return NextResponse.json({ ok: false, error: "Podaj liczbę dni 1–365." }, { status: 400 });
      if (rental.status !== "active") return NextResponse.json({ ok: false, error: "Przedłużyć można tylko aktywne wypożyczenie." }, { status: 409 });
      return NextResponse.json({ ok: true, rental: await extendRental(rental, days) });
    }
    if (action === "return") {
      if (rental.status !== "active") return NextResponse.json({ ok: false, error: "Zwrot dotyczy aktywnego wypożyczenia." }, { status: 409 });
      return NextResponse.json({ ok: true, rental: await markRentalReturned(rental) });
    }
    if (action === "deposit") {
      if (rental.status !== "returned" && rental.status !== "cancelled") {
        return NextResponse.json({ ok: false, error: "Kaucję rozlicz po zwrocie kalkulatora (albo anulowaniu)." }, { status: 409 });
      }
      if (rental.depositRefundedAt) return NextResponse.json({ ok: false, error: "Kaucja jest już rozliczona." }, { status: 409 });
      const note = typeof body?.note === "string" ? body.note.trim().slice(0, 300) : "";
      return NextResponse.json({ ok: true, rental: await markDepositRefunded(rental, note) });
    }
    if (action === "cancel") {
      if (rental.status === "returned" || rental.status === "cancelled") {
        return NextResponse.json({ ok: false, error: "Tego wypożyczenia nie da się już anulować." }, { status: 409 });
      }
      const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 300) : "";
      return NextResponse.json({ ok: true, rental: await cancelRental(rental, reason) });
    }
    return NextResponse.json({ ok: false, error: "Nieznana akcja." }, { status: 400 });
  } catch (e) {
    console.error("[admin/rentals PATCH]", id, action, e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
