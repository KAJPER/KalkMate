import { prisma } from "@/lib/db";

// Przewoznik przesylki do maili statusowych (lib/orderFulfillment.ts).
// Wczesniej maile zawsze mowily "InPost" (link do inpost.pl, odbior z
// paczkomatu), a zamowienia zagraniczne ida przez DPD/UPS/GLS/... pod adres.
//
// Zrodla, od najpewniejszego:
//   1. kolumna "shippingCarrier" (raw, poza schema Prisma) — zapisywana przy
//      nadaniu z panelu (basecourier/route.ts: "inpost" albo courier_code
//      Base Courier) i przy synchronizacji sledzenia (courier_name z Base Courier),
//   2. zgadywanie z numeru przesylki (24 cyfry = InPost, 1Z... = UPS),
//   3. paczkomat w zamowieniu = InPost.
// Nieznany przewoznik = bez nazwy i bez linku (mail mowi neutralnie).

export type CarrierCode = "inpost" | "dpd" | "ups" | "gls" | "spring" | "eurohermes";

export interface CarrierInfo {
  code: CarrierCode | null;
  name: string | null;
  trackUrl: string | null;
}

const CARRIERS: Record<CarrierCode, { name: string; track: ((n: string) => string) | null }> = {
  inpost: { name: "InPost", track: (n) => `https://inpost.pl/sledzenie-przesylek?number=${encodeURIComponent(n)}` },
  dpd: { name: "DPD", track: (n) => `https://tracktrace.dpd.com.pl/parcelDetails?typ=1&p1=${encodeURIComponent(n)}` },
  ups: { name: "UPS", track: (n) => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}` },
  gls: { name: "GLS", track: (n) => `https://gls-group.com/PL/pl/sledzenie-paczek?match=${encodeURIComponent(n)}` },
  // Spring / Eurohermes — bez pewnego publicznego linku po samym numerze.
  spring: { name: "Spring", track: null },
  eurohermes: { name: "Eurohermes", track: null },
};

// courier_code z Base Courier ("dpd", "ups_rest_standard", "paczkomaty"...)
// albo courier_name ("DPD Classic", "InPost Paczkomaty"...) -> nasz kod.
export function normalizeCarrier(raw: string | null | undefined): CarrierCode | null {
  const s = String(raw || "").toLowerCase();
  if (!s) return null;
  if (s.includes("inpost") || s.includes("paczkomat")) return "inpost";
  if (s.includes("dpd")) return "dpd";
  if (s.includes("ups")) return "ups";
  if (s.includes("gls")) return "gls";
  if (s.includes("spring")) return "spring";
  if (s.includes("hermes")) return "eurohermes";
  return null;
}

export function resolveCarrier(o: {
  carrier?: string | null;
  trackingNumber?: string | null;
  pickupPoint?: string | null;
}): CarrierInfo {
  const tracking = String(o.trackingNumber || "").trim();
  let code = normalizeCarrier(o.carrier);
  if (!code) {
    if (/^\d{24}$/.test(tracking)) code = "inpost";
    else if (/^1Z[0-9A-Z]{16}$/i.test(tracking)) code = "ups";
    else if ((o.pickupPoint || "").trim()) code = "inpost";
  }
  if (!code) return { code: null, name: null, trackUrl: null };
  const c = CARRIERS[code];
  return { code, name: c.name, trackUrl: tracking && c.track ? c.track(tracking) : null };
}

let _columnReady = false;
async function ensureShippingCarrierColumn(): Promise<void> {
  if (_columnReady) return;
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN "shippingCarrier" TEXT`);
  } catch (e) {
    const cols = await prisma
      .$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("Order")`)
      .catch(() => [] as { name: string }[]);
    if (!cols.some((c) => c.name === "shippingCarrier")) {
      console.error("[carriers] ALTER TABLE shippingCarrier failed:", e);
      return;
    }
  }
  _columnReady = true;
}

export async function readShippingCarrier(orderId: string): Promise<string | null> {
  await ensureShippingCarrierColumn();
  const rows = await prisma
    .$queryRaw<{ shippingCarrier: string | null }[]>`SELECT "shippingCarrier" FROM "Order" WHERE id = ${orderId} LIMIT 1`
    .catch(() => [] as { shippingCarrier: string | null }[]);
  return rows[0]?.shippingCarrier ?? null;
}

// onlyIfEmpty — synchronizacja sledzenia nie nadpisuje tego, co zapisalo nadanie.
export async function saveShippingCarrier(orderId: string, carrier: string, opts: { onlyIfEmpty?: boolean } = {}): Promise<void> {
  const value = carrier.trim().slice(0, 64);
  if (!value) return;
  await ensureShippingCarrierColumn();
  if (opts.onlyIfEmpty) {
    await prisma.$executeRaw`
      UPDATE "Order" SET "shippingCarrier" = ${value}
      WHERE id = ${orderId} AND ("shippingCarrier" IS NULL OR "shippingCarrier" = '')`;
  } else {
    await prisma.$executeRaw`UPDATE "Order" SET "shippingCarrier" = ${value} WHERE id = ${orderId}`;
  }
}

// Dane przewoznika + adres drzwi-drzwi do FulfillmentData (email-templates.ts).
export async function carrierEmailFields(order: {
  id: string;
  trackingNumber?: string | null;
  pickupPoint?: string | null;
  customerAddressStreet?: string | null;
  customerAddressPostcode?: string | null;
  customerAddressCity?: string | null;
  customerCountry?: string | null;
}, trackingOverride?: string | null): Promise<{ carrierName: string | null; trackUrl: string | null; deliveryAddress: string }> {
  const carrier = await readShippingCarrier(order.id).catch(() => null);
  const info = resolveCarrier({
    carrier,
    trackingNumber: trackingOverride !== undefined ? trackingOverride : order.trackingNumber,
    pickupPoint: order.pickupPoint,
  });
  const deliveryAddress = (order.pickupPoint || "").trim()
    ? ""
    : [
        order.customerAddressStreet,
        [order.customerAddressPostcode, order.customerAddressCity].filter(Boolean).join(" "),
        order.customerCountry,
      ].filter(Boolean).join(", ");
  return { carrierName: info.name, trackUrl: info.trackUrl, deliveryAddress };
}
