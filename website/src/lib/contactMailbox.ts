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

import { ImapFlow, type SearchObject } from "imapflow";
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
  answered: boolean;
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
          answered: msg.flags?.has("\\Answered") ?? false,
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

// Wysyla przez SMTP konta kontakt@ i doklada TA SAMA wiadomosc (ten sam
// Message-ID) do folderu "Sent", zeby byla widoczna w zwyklej poczcie
// (webmail) tak samo jak wyslana recznie.
async function deliver(mailOptions: nodemailer.SendMailOptions): Promise<{ ok: boolean; error?: string }> {
  if (!MAILBOX_PASS) return { ok: false, error: "Brak MAILBOX_PASS w konfiguracji serwera" };
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
          await client.append("Sent", composed.message as Buffer, ["\Seen"]);
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

export async function sendReply(input: ReplyInput): Promise<{ ok: boolean; error?: string }> {
  return deliver(buildMailOptions(input));
}

// Nowa wiadomosc do dowolnych adresow (nie odpowiedz na mail) — jak "Nowa
// wiadomosc" w zwyklej poczcie.
export interface ComposeInput {
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
}

export async function sendNewMail(input: ComposeInput): Promise<{ ok: boolean; error?: string }> {
  return deliver({
    from: `KalkMate <${MAILBOX_USER}>`,
    to: input.to,
    cc: input.cc && input.cc.length ? input.cc : undefined,
    subject: input.subject,
    html: input.html,
    messageId: `<${Date.now()}.${Math.random().toString(36).slice(2)}@kalkmate.pl>`,
  });
}

// Oznacza mail, na ktory odpowiedzielismy, flaga \Answered (lista pokazuje
// wtedy strzalke ↩). Best effort — wysylka juz sie udala.
export async function markAnswered(uid: number, folder = "INBOX"): Promise<void> {
  try {
    await withImap(async (client) => {
      const lock = await client.getMailboxLock(folder);
      try {
        await client.messageFlagsAdd(String(uid), ["\Answered"], { uid: true });
      } finally {
        lock.release();
      }
    });
  } catch (e) {
    console.error("[contactMailbox] markAnswered failed:", e);
  }
}

// === Rozmowa: wiadomosci powiazane z otwartym mailem ===
// Odpowiedzi wysylamy z In-Reply-To/References wskazujacymi na Message-ID
// oryginalu (patrz buildMailOptions), wiec odpowiedz z "Sent" odnajdujemy
// szukajac w naglowkach. Klient odpisujacy na nasza odpowiedz ma w References
// caly lancuch, wiec tak samo znajdziemy jego kolejne wiadomosci, a dla maila
// z "Sent" — oryginal (przodkowie z In-Reply-To/References).
export interface ThreadMessage {
  uid: number;
  folder: string;
  direction: "in" | "out";
  subject: string;
  from: MailAddress | null;
  to: MailAddress[];
  date: string | null;
  text: string;
}

const THREAD_FOLDERS = ["INBOX", "Sent"];
const THREAD_MAX = 10;

function parseIds(raw: string | null | undefined): string[] {
  return raw ? raw.match(/<[^<>\s]+>/g) || [] : [];
}

// Z odpowiedzi klienta wycinamy cytowana historie ("> ..." i naglowek
// "On ... wrote:") — w rozmowie pokazujemy tylko nowa tresc.
function stripQuotes(text: string): string {
  const out: string[] = [];
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    if (/^\s*(On .{5,140} wrote:|W dniu .{5,140} napisa\S*:|-{2,}\s*Original Message\s*-{2,})/i.test(line)) break;
    if (/^\s*>/.test(line)) continue;
    out.push(line);
  }
  return out.join("\n").trim();
}

export async function getRelatedMessages(uid: number, folder = "INBOX"): Promise<ThreadMessage[]> {
  return withImap(async (client) => {
    // 1) Message-ID i lancuch odpowiedzi otwartej wiadomosci.
    let mid = "";
    let ancestors: string[] = [];
    {
      const lock = await client.getMailboxLock(folder);
      try {
        const m = await client.fetchOne(String(uid), { envelope: true, headers: ["references", "in-reply-to"] }, { uid: true });
        if (!m) return [];
        mid = m.envelope?.messageId || "";
        const hdr = m.headers ? m.headers.toString("utf8") : "";
        ancestors = Array.from(new Set([...parseIds(m.envelope?.inReplyTo), ...parseIds(hdr)])).filter((x) => x !== mid).slice(-8);
      } finally {
        lock.release();
      }
    }
    if (!mid && ancestors.length === 0) return [];

    // 2) Szukamy w INBOX i Sent: potomkow (odpowiedzi) i przodkow (oryginal).
    const found: { folder: string; uid: number }[] = [];
    for (const f of THREAD_FOLDERS) {
      const lock = await client.getMailboxLock(f);
      try {
        const uids = new Set<number>();
        if (mid) {
          for (const criteria of [{ header: { references: mid } }, { header: { "in-reply-to": mid } }] as SearchObject[]) {
            const r = await client.search(criteria, { uid: true });
            (r || []).forEach((u) => uids.add(u));
          }
        }
        for (const aid of ancestors) {
          const r = await client.search({ header: { "message-id": aid } }, { uid: true });
          (r || []).forEach((u) => uids.add(u));
        }
        if (f === folder) uids.delete(uid);
        uids.forEach((u) => found.push({ folder: f, uid: u }));
      } finally {
        lock.release();
      }
    }

    // 3) Tresc znalezionych wiadomosci.
    const out: ThreadMessage[] = [];
    for (const f of THREAD_FOLDERS) {
      const wanted = found.filter((x) => x.folder === f).slice(0, THREAD_MAX * 2);
      if (wanted.length === 0) continue;
      const lock = await client.getMailboxLock(f);
      try {
        for (const w of wanted) {
          const msg = await client.fetchOne(String(w.uid), { source: true }, { uid: true });
          if (!msg || !msg.source) continue;
          const parsed = await simpleParser(msg.source);
          const from = flattenAddresses(parsed.from)[0] || null;
          const mine = f === "Sent" || (from?.address || "").toLowerCase() === MAILBOX_USER.toLowerCase();
          out.push({
            uid: w.uid,
            folder: f,
            direction: mine ? "out" : "in",
            subject: parsed.subject || "(brak tematu)",
            from,
            to: flattenAddresses(parsed.to),
            date: parsed.date ? parsed.date.toISOString() : null,
            text: stripQuotes(parsed.text || "").slice(0, 6000),
          });
        }
      } finally {
        lock.release();
      }
    }
    out.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    return out.slice(-THREAD_MAX);
  });
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
