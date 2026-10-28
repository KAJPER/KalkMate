import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import {
  SUPPORT_LIMITS,
  askSupportAi,
  chatTokenValid,
  getChat,
  getMessages,
  recordAssistantMessage,
  recordUserMessage,
  sanitizeJourney,
  sanitizePath,
} from "@/lib/supportChat";

// GET  /api/support/message?chatId&token      -> historia (wznowienie po przeladowaniu)
// POST /api/support/message { chatId, token, text, page, journey? } -> { reply }
async function authorizedChat(chatId: unknown, token: unknown) {
  if (typeof chatId !== "string" || !/^[0-9a-f-]{36}$/.test(chatId) || !chatTokenValid(chatId, token)) return null;
  return getChat(chatId);
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const chat = await authorizedChat(q.get("chatId"), q.get("token"));
  if (!chat) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const messages = (await getMessages(chat.id)).map(({ role, content, createdAt }) => ({ role, content, createdAt }));
  return NextResponse.json({ ok: true, email: chat.email, messages }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const rl = rateLimit(`support-msg:${ip}`, 30, 10 * 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const chat = await authorizedChat(body?.chatId, body?.token);
  if (!chat) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, SUPPORT_LIMITS.messageChars) : "";
  if (!text) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });

  const page = sanitizePath(body?.page);
  const journey = chat.trackingConsent && Array.isArray(body?.journey) ? sanitizeJourney(body.journey) : null;
  if (!(await recordUserMessage(chat, text, page, journey))) {
    return NextResponse.json({ ok: false, error: "limit" }, { status: 429 });
  }
  const fresh = (await getChat(chat.id)) ?? chat;
  try {
    const reply = await askSupportAi(fresh, await getMessages(chat.id), page);
    await recordAssistantMessage(chat.id, reply);
    return NextResponse.json({ ok: true, reply });
  } catch (e) {
    console.error("[api/support/message]", chat.id, e);
    return NextResponse.json({ ok: false, error: "ai" }, { status: 502 });
  }
}
