import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

const PRODUCT_NAME = "__kalkmate_analytics";

async function getOrCreateProduct() {
  const result = await stripe.products.search({
    query: `name:'${PRODUCT_NAME}'`,
  });

  if (result.data.length > 0) return result.data[0];

  return await stripe.products.create({
    name: PRODUCT_NAME,
    metadata: { page_visits: "0", last_reset: new Date().toISOString() },
  });
}

// POST: increment (public, no auth)
export async function POST() {
  try {
    const product = await getOrCreateProduct();
    const count = parseInt(product.metadata.page_visits || "0", 10);

    await stripe.products.update(product.id, {
      metadata: { ...product.metadata, page_visits: String(count + 1) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Visit track error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// GET: read (admin only, protected by middleware)
export async function GET() {
  try {
    const product = await getOrCreateProduct();
    return NextResponse.json({
      page_visits: parseInt(product.metadata.page_visits || "0", 10),
      last_reset: product.metadata.last_reset || null,
    });
  } catch (error) {
    console.error("Visit read error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
