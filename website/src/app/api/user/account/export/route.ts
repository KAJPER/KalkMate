import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { listTokenPurchasesByUser } from "@/lib/tokenPurchases";
import { consentStatus } from "@/lib/newsletter";

// GET /api/user/account/export — kopia danych konta (RODO art. 15 i 20)
// w JSON: konto, subskrypcja, zgoda marketingowa, zamowienia, zakupy tokenow,
// licencje, urzadzenia, notatki, sprawdziany, rozmowy (bez tresci
// zalacznikow — tylko nazwa/typ/rozmiar) i historia z kalkulatora.
// Bez sekretow: hash hasla, tokeny OAuth, deviceToken, kod AI, IP.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true, email: true, name: true, image: true, emailVerified: true,
      createdAt: true, updatedAt: true, password: true,
    },
  });
  if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });

  // Eksport jest ciezki (cala historia) — max kilka razy na godzine.
  const rl = rateLimit(`export:${user.id}`, 5, 60 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: `Za dużo eksportów. Spróbuj za ${Math.ceil(rl.resetMs / 60000)} min.` },
      { status: 429 }
    );
  }

  try {
    const [extra, subscription, accounts, orders, licenses, devices, notes, tests, conversations, solves] = await Promise.all([
      prisma.$queryRaw<{ tokenBalance: number | null; aiModel: string | null; aiMode: string | null }[]>`
        SELECT "tokenBalance", "aiModel", "aiMode" FROM "User" WHERE "id" = ${user.id} LIMIT 1
      `.catch(() => []),
      prisma.subscription.findUnique({
        where: { userId: user.id },
        select: { status: true, plan: true, trialEndsAt: true, trialDays: true, stripeCurrentPeriodEnd: true, createdAt: true, cancelledAt: true },
      }),
      prisma.account.findMany({ where: { userId: user.id }, select: { provider: true, type: true } }),
      prisma.order.findMany({
        where: { OR: [{ userId: user.id }, { customerEmail: user.email }] },
        orderBy: { createdAt: "desc" },
        select: {
          orderNumber: true, status: true, fulfillmentStatus: true, customerName: true, customerEmail: true,
          customerPhone: true, pickupPoint: true, pickupPointAddress: true, customerAddressStreet: true,
          customerAddressPostcode: true, customerAddressCity: true, customerCountry: true, paymentProvider: true,
          amount: true, currency: true, trackingNumber: true, createdAt: true, paidAt: true, shippedAt: true,
          deliveredAt: true,
        },
      }),
      prisma.license.findMany({
        where: { claimedByUserId: user.id },
        select: { code: true, durationDays: true, usedAt: true, createdAt: true },
      }),
      prisma.device.findMany({
        where: { userId: user.id },
        select: { deviceId: true, firstSeen: true, lastSeen: true, firmwareVersion: true, requestCount: true },
      }),
      prisma.note.findMany({
        where: { userId: user.id },
        orderBy: { position: "asc" },
        select: { title: true, content: true, createdAt: true, updatedAt: true },
      }),
      prisma.test.findMany({
        where: { userId: user.id },
        orderBy: { position: "asc" },
        select: { title: true, content: true, createdAt: true, updatedAt: true },
      }),
      prisma.conversation.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
        select: {
          title: true, createdAt: true, updatedAt: true,
          ChatMessage: {
            orderBy: { createdAt: "asc" },
            select: {
              role: true, content: true, createdAt: true,
              Attachment: { select: { filename: true, mimeType: true, fileSize: true } },
            },
          },
        },
      }),
      prisma.deviceSolve.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
        select: { deviceId: true, mode: true, question: true, answer: true, createdAt: true },
      }),
    ]);

    const tokenPurchases = await listTokenPurchasesByUser(user.id)
      .then((rows) => rows.map((r) => ({
        provider: r.provider, tokens: r.tokens, amount: r.amount, currency: r.currency,
        status: r.status, createdAt: r.createdAt, paidAt: r.paidAt,
      })))
      .catch(() => []);
    const consent = await consentStatus(user.email).catch(() => null);
    const x = extra[0];

    const data = {
      exportedAt: new Date().toISOString(),
      format: "kalkmate-account-export/v1",
      account: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        hasPassword: !!user.password,
        loginProviders: accounts.map((a) => a.provider),
        tokenBalance: Number(x?.tokenBalance ?? 0),
        aiModel: x?.aiModel ?? null,
        aiMode: x?.aiMode ?? null,
      },
      subscription,
      marketingConsent: consent,
      orders,
      tokenPurchases,
      licenses,
      devices,
      notes,
      tests,
      conversations: conversations.map((c) => ({
        title: c.title,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        messages: c.ChatMessage.map((m) => ({
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
          attachments: m.Attachment, // tylko metadane, bez tresci plikow
        })),
      })),
      calculatorHistory: solves,
    };

    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="kalkmate-dane-${date}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[user/account/export]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
