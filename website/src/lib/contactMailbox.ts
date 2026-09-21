// Skrzynka kontakt@kalkmate.pl (h24.seohost.pl) — czytanie i odpowiadanie z
// panelu admina. IMAP do czytania, SMTP (to samo konto) do wysylki odpowiedzi.
//
// Serwer zweryfikowany na zywo (2026-09-21): Dovecot, IMAP na porcie 993 (SSL),
// ten sam host co istniejacy SMTP w src/lib/mailer.ts. Foldery na koncie:
// INBOX, INBOX.spam (stary/osobny spam), Junk, Trash, Sent, Drafts.
//
// Konfiguracja przez env (.env.production.local — NIGDY w repo, publiczne):
//   MAILBOX_IMAP_HOST=h24.seohost.pl   (domyslnie jak SMTP)
//   MAILBOX_IMAP_PORT=993
//   MAILBOX_USER=kontakt@kalkmate.pl
//   MAILBOX_PASS=<haslo>
//   MAILBOX_SMTP_HOST / MAILBOX_SMTP_PORT — domyslnie jak IMAP_HOST/465

import { ImapFlow } from "imapflow";
import { simpleParser, type AddressObject, type EmailAddress } from "mailparser";
import nodemailer from "nodemailer";

const IMAP_HOST = process.env.MAILBOX_IMAP_HOST || process.env.MAIL_HOST || "h24.seohost.pl";
const IMAP_PORT = parseInt(process.env.MAILBOX_IMAP_PORT || "993", 10);
const SMTP_HOST = process.env.MAILBOX_SMTP_HOST || process.env.MAIL_HOST || "h24.seohost.pl";
const SMTP_PORT = parseInt(process.env.MAILBOX_SMTP_PORT || "465", 10);
const MAILBOX_USER = process.env.MAILBOX_USER || "kontakt@kalkmate.pl";
const MAILBOX_PASS = process.env.MAILBOX_PASS || "";

export const MAILBOX_FOLDERS = [
  { path: "INBOX", label: "Odebrane" },
  { path: "Sent", label: "Wysłane" },
  { path: "Junk", label: "Spam" },
  { path: "INBOX.spam", label: "Spam (stary)" },
  { path: "Drafts", label: "Robocze" },
  { path: "Trash", label: "Kosz" },
] as const;

export interface MailAddress {
  name: string;
  address: string;
}

async function withImap<T>(fn: (client: ImapFlow) => Promise<T>): Promise<T> {
  if (!MAILBOX_PASS) throw new Error("Brak MAILBOX_PASS w konfiguracji serwera (.env.production.local)");
  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user: MAILBOX_USER, pass: MAILBOX_PASS },
    logger: false,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => client.close());
  }
}

export interface MailboxMessageSummary {
  uid: number;
  subject: string;
  from: MailAddress | null;
  to: MailAddress[];
  date: string | null;
  seen: boolean;
  flagged: boolean;
}

export interface MailboxListResult {
  folder: string;
  total: number;
  messages: MailboxMessageSummary[];
}

// Ostatnie `limit` wiadomosci z folderu, najnowsze pierwsze. To rowniez jest
// "pobranie calej historii" o ktora prosil wlasciciel — panel zawsze pokazuje
// zywy stan skrzynki na serwerze, nie kopie lokalna.
export async function listMessages(folder = "INBOX", limit = 100): Promise<MailboxListResult> {
  return withImap(async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      const total = client.mailbox && typeof client.mailbox !== "boolean" ? client.mailbox.exists : 0;
      if (!total) return { folder, total: 0, messages: [] };
      const start = Math.max(1, total - limit + 1);
      const range = `${start}:${total}`;
      const out: MailboxMessageSummary[] = [];
      for await (const msg of client.fetch(range, { envelope: true, flags: true, uid: true })) {
        const from = msg.envelope?.from?.[0];
        out.push({
          uid: msg.uid,
          subject: msg.envelope?.subject || "(brak tematu)",
          from: from ? { name: from.name || "", address: from.address || "" } : null,
          to: (msg.envelope?.to || []).map((a) => ({ name: a.name || "", address: a.address || "" })),
          date: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : null,
          seen: msg.flags?.has("\\Seen") ?? false,
          flagged: msg.flags?.has("\\Flagged") ?? false,
        });
      }
      out.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      return { folder, total, messages: out };
    } finally {
      lock.release();
    }
  });
}

export interface MailboxAttachment {
  index: number;
  filename: string;
  size: number;
  contentType: string;
}

export interface MailboxMessageFull {
  uid: number;
  folder: string;
  subject: string;
  from: MailAddress | null;
  to: MailAddress[];
  cc: MailAddress[];
  date: string | null;
  html: string | null;
  text: string | null;
  messageId: string | null;
  references: string[];
  attachments: MailboxAttachment[];
}

function flattenAddresses(a: AddressObject | AddressObject[] | undefined): MailAddress[] {
  if (!a) return [];
  const list = Array.isArray(a) ? a : [a];
  const out: MailAddress[] = [];
  for (const group of list) {
    for (const v of (group.value || []) as EmailAddress[]) {
      out.push({ name: v.name || "", address: v.address || "" });
    }
  }
  return out;
}

// Pelna tresc wiadomosci + oznaczenie jako przeczytana (\Seen). Zalaczniki sa
// tylko wymienione (metadane) — pobranie tresci zalacznika idzie osobnym
// wywolaniem getAttachment(), zeby nie sciagac duzych plikow przy samym
// otwieraniu maila.
export async function getMessage(uid: number, folder = "INBOX"): Promise<MailboxMessageFull | null> {
  return withImap(async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
      if (!msg || !msg.source) return null;
      const parsed = await simpleParser(msg.source);

      client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }).catch(() => { /* nieistotne */ });

      const references = Array.isArray(parsed.references)
        ? parsed.references
        : parsed.references
          ? [parsed.references]
          : [];

      return {
        uid,
        folder,
        subject: parsed.subject || "(brak tematu)",
        from: flattenAddresses(parsed.from)[0] || null,
        to: flattenAddresses(parsed.to),
        cc: flattenAddresses(parsed.cc),
        date: parsed.date ? parsed.date.toISOString() : null,
        html: typeof parsed.html === "string" ? parsed.html : null,
        text: parsed.text || null,
        messageId: parsed.messageId || null,
        references,
        attachments: (parsed.attachments || []).map((a, index) => ({
          index,
          filename: a.filename || `zalacznik-${index + 1}`,
          size: a.size,
          contentType: a.contentType,
        })),
      };
    } finally {
      lock.release();
    }
  });
}

export async function getAttachment(
  uid: number,
  index: number,
  folder = "INBOX"
): Promise<{ filename: string; contentType: string; content: Buffer } | null> {
  return withImap(async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
      if (!msg || !msg.source) return null;
      const parsed = await simpleParser(msg.source);
      const att = (parsed.attachments || [])[index];
      if (!att) return null;
      return { filename: att.filename || `zalacznik-${index + 1}`, contentType: att.contentType, content: att.content };
    } finally {
      lock.release();
    }
  });
}

export interface ReplyInput {
  toAddress: string;
  toName?: string;
  subject: string;
  html: string;
  inReplyToMessageId?: string | null;
  priorReferences?: string[];
}

function buildMailOptions(input: ReplyInput) {
  const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@kalkmate.pl>`;
  const references = [...(input.priorReferences || []), ...(input.inReplyToMessageId ? [input.inReplyToMessageId] : [])];
  return {
    from: `KalkMate <${MAILBOX_USER}>`,
    to: input.toName ? { name: input.toName, address: input.toAddress } : input.toAddress,
    subject: input.subject,
    html: input.html,
    messageId,
    inReplyTo: input.inReplyToMessageId || undefined,
    references: references.length ? references.join(" ") : undefined,
  };
}

// Wysyla odpowiedz przez SMTP konta kontakt@ i doklada TA SAMA wiadomosc
// (ten sam Message-ID) do folderu "Sent", zeby byla widoczna w zwyklej
// poczcie (webmail) tak samo jak wyslana recznie.
export async function sendReply(input: ReplyInput): Promise<{ ok: boolean; error?: string }> {
  if (!MAILBOX_PASS) return { ok: false, error: "Brak MAILBOX_PASS w konfiguracji serwera" };
  const mailOptions = buildMailOptions(input);
  try {
    const smtp = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: true,
      auth: { user: MAILBOX_USER, pass: MAILBOX_PASS },
    });
    await smtp.sendMail(mailOptions);

    try {
      const composer = nodemailer.createTransport({ streamTransport: true, buffer: true });
      const composed = await composer.sendMail(mailOptions);
      if (composed.message) {
        await withImap(async (client) => {
          await client.append("Sent", composed.message as Buffer, ["\\Seen"]);
        });
      }
    } catch (e) {
      console.error("[contactMailbox] append to Sent failed (mail was still sent):", e);
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[contactMailbox] send failed:", msg);
    return { ok: false, error: msg };
  }
}

export async function verifyMailbox(): Promise<{ ok: boolean; error?: string }> {
  try {
    await withImap(async (client) => {
      await client.getMailboxLock("INBOX").then((l) => l.release());
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
