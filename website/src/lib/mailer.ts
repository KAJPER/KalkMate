// Wysylka maili przez SMTP h24.seohost.pl (zamiast Resend).
// Dane konta: noreply@kalkmate.pl
//
// Konfiguracja przez env (.env.production.local):
//   MAIL_HOST=h24.seohost.pl
//   MAIL_PORT=465
//   MAIL_SECURE=true
//   MAIL_USER=noreply@kalkmate.pl
//   MAIL_PASS=<haslo>
//   MAIL_FROM_NAME=KalkMate
//   MAIL_FROM_ADDRESS=noreply@kalkmate.pl

import nodemailer from "nodemailer";

const host   = process.env.MAIL_HOST   || "h24.seohost.pl";
const port   = parseInt(process.env.MAIL_PORT || "465", 10);
const secure = (process.env.MAIL_SECURE || "true") === "true";
const user   = process.env.MAIL_USER   || "noreply@kalkmate.pl";
const pass   = process.env.MAIL_PASS   || "";

const fromName    = process.env.MAIL_FROM_NAME    || "KalkMate";
const fromAddress = process.env.MAIL_FROM_ADDRESS || "noreply@kalkmate.pl";

let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (_transporter) return _transporter;
  if (!pass) {
    console.warn("[mailer] MAIL_PASS missing - mail send will fail");
  }
  _transporter = nodemailer.createTransport({
    host,
    port,
    secure,                    // 465 = TLS od razu
    auth: { user, pass },
    tls: {
      // h24.seohost.pl ma valid cert, ale w razie czego:
      rejectUnauthorized: true,
    },
  });
  return _transporter;
}

export const FROM_EMAIL = `${fromName} <${fromAddress}>`;
export const CONTACT_EMAIL = "kontakt@kalkmate.pl";

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface MailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: MailAttachment[];
}

export async function sendMail(opts: MailOptions): Promise<{ ok: boolean; error?: string }> {
  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: FROM_EMAIL,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      replyTo: opts.replyTo || CONTACT_EMAIL,
      attachments: opts.attachments,
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[mailer] send failed:", msg);
    return { ok: false, error: msg };
  }
}

// Quick health check (uzywany np. w admin debug endpoincie)
export async function verifyMailer(): Promise<{ ok: boolean; error?: string }> {
  try {
    await getTransporter().verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
