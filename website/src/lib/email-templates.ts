// Email szablony — ciemny motyw + lokalizacja de | en
//
// Lokalizacja:
//   "de" — klienci z Niemiec (Accept-Language: de* lub country=DE)
//   "en" — wszyscy pozostali (domyślne)
//
// Pomocniki do wykrywania:
//   detectLocale(acceptLanguageHeader)  — dla maili auth (request header)
//   localeFromCountry(countryCode)      — dla maili zamówień (Stripe metadata)

export type EmailLocale = "de" | "en";

export function detectLocale(acceptLanguage: string | null | undefined): EmailLocale {
  if (typeof acceptLanguage === "string" && /^de\b/i.test(acceptLanguage.trim())) return "de";
  return "en";
}

export function localeFromCountry(country: string | null | undefined): EmailLocale {
  return country === "DE" ? "de" : "en";
}

// ---------------------------------------------------------------------------
// Dane wejściowe szablonów
// ---------------------------------------------------------------------------
interface OrderData {
  customerName: string;
  customerEmail: string;
  product: string;
  amount: number;
  pickupPoint: string;
  pickupPointAddress: string;
  orderId: string;
}
interface FulfillmentData {
  customerName: string;
  product: string;
  trackingNumber?: string;
  pickupPoint: string;
  pickupPointAddress: string;
}
interface PasswordResetData {
  resetUrl: string;
  expiresMinutes: number;
}
interface VerificationData {
  verifyUrl: string;
  expiresHours: number;
  customerName?: string;
}

// ---------------------------------------------------------------------------
// Kolory i czcionki
// ---------------------------------------------------------------------------
const C = {
  ink:       "#0B0B0B",
  card:      "#141414",
  cardLine:  "#2A2A2A",
  paper:     "#F2EDE3",
  paperSub:  "#9C9890",
  paperDim:  "#6B6863",
  signal:    "#D8FF3D",
  signalDark:"#1A1F08",
};
const FONT_BODY = `'Inter','Segoe UI',Roboto,-apple-system,BlinkMacSystemFont,sans-serif`;
const FONT_MONO = `'JetBrains Mono','Fira Code',Consolas,Monaco,monospace`;

// ---------------------------------------------------------------------------
// Tłumaczenia
// ---------------------------------------------------------------------------
const TX: Record<EmailLocale, Record<string, string>> = {
  de: {
    footerAuto:       "Automatische Nachricht",
    badgePaid:        "Bezahlt",
    badgeInProgress:  "In Bearbeitung",
    badgeShipped:     "Versendet",
    badgeFulfilled:   "Abgeschlossen",
    badgeCancelled:   "Storniert",
    rowProduct:       "Produkt",
    rowAmount:        "Betrag",
    rowLocker:        "Paketfach",
    rowAddress:       "Adresse",
    rowStatus:        "Status",
    rowTracking:      "Sendungsnummer",
    btnPanel:         "Panel öffnen",
    btnVerify:        "E-Mail bestätigen",
    btnReset:         "Neues Passwort setzen",
    btnTrack:         "Sendung verfolgen",
    labelOr:          "Oder Link:",
    labelOrderId:     "Bestellnummer:",
  },
  en: {
    footerAuto:       "Automated message",
    badgePaid:        "Paid",
    badgeInProgress:  "In progress",
    badgeShipped:     "Shipped",
    badgeFulfilled:   "Completed",
    badgeCancelled:   "Cancelled",
    rowProduct:       "Product",
    rowAmount:        "Amount",
    rowLocker:        "Parcel locker",
    rowAddress:       "Address",
    rowStatus:        "Status",
    rowTracking:      "Tracking number",
    btnPanel:         "Open panel",
    btnVerify:        "Confirm email",
    btnReset:         "Set new password",
    btnTrack:         "Track package",
    labelOr:          "Or link:",
    labelOrderId:     "Order ID:",
  },
};

const t = (locale: EmailLocale, key: string): string =>
  TX[locale]?.[key] ?? TX.en[key] ?? key;

// ---------------------------------------------------------------------------
// Bloki pomocnicze HTML (locale-aware tam gdzie potrzeba)
// ---------------------------------------------------------------------------
function brandHtml(size = 24): string {
  return `<span style="font-family:${FONT_BODY};font-weight:800;font-size:${size}px;letter-spacing:-0.5px;color:${C.paper};">Kalk<em style="color:${C.signal};font-style:italic;font-weight:800;">Mate</em></span>`;
}

function eyebrowHtml(text: string, color: string = C.signal): string {
  return `<span style="font-family:${FONT_MONO};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${color};font-weight:700;">${text}</span>`;
}

function shell(inner: string, locale: EmailLocale = "en"): string {
  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark only">
<meta name="supported-color-schemes" content="dark only">
<title>KalkMate</title>
<style>
  :root { color-scheme: dark; }
  [data-ogsc] body, [data-ogsb] body { background:${C.ink} !important; }
</style>
</head>
<body style="margin:0;padding:0;background:${C.ink};color:${C.paper};font-family:${FONT_BODY};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.ink}" style="background:${C.ink};">
  <tr><td align="center" style="padding:32px 16px;background:${C.ink};">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:${C.ink};">
      <tr><td style="padding:0 4px 18px 4px;background:${C.ink};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="left" style="background:${C.ink};">${brandHtml(24)}</td>
            <td align="right" style="background:${C.ink};">
              <span style="font-family:${FONT_MONO};font-size:10px;letter-spacing:0.15em;color:${C.paperDim};text-transform:uppercase;">/MAIL &middot; v1.0</span>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.cardLine};padding:36px 32px;">
        ${inner}
      </td></tr>
      <tr><td bgcolor="${C.signal}" style="height:3px;background:${C.signal};line-height:3px;font-size:0;">&nbsp;</td></tr>
      <tr><td style="padding:24px 4px 0 4px;text-align:center;background:${C.ink};">
        <div style="font-family:${FONT_MONO};font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:${C.paperDim};">
          KalkMate &middot; ${t(locale, "footerAuto")}
        </div>
        <div style="font-family:${FONT_BODY};font-size:12.5px;color:${C.paperSub};margin-top:8px;">
          <a href="mailto:kontakt@kalkmate.pl" style="color:${C.paper};text-decoration:none;font-weight:600;">kontakt@kalkmate.pl</a>
          &nbsp;&middot;&nbsp;
          <a href="https://kalkmate.pl" style="color:${C.paper};text-decoration:none;font-weight:600;">kalkmate.pl</a>
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function eyebrowBlock(text: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;border-bottom:1px solid ${C.cardLine};padding-bottom:14px;width:100%;">
    <tr>
      <td style="width:10px;vertical-align:middle;">
        <span style="display:inline-block;width:8px;height:8px;background:${C.signal};border-radius:50%;"></span>
      </td>
      <td style="vertical-align:middle;padding-left:12px;">${eyebrowHtml(text)}</td>
    </tr>
  </table>`;
}

function headline(text: string, accent?: string): string {
  let html = text;
  if (accent) {
    html = text.replace(
      accent,
      `<em style="color:${C.signal};font-style:italic;font-weight:800;">${accent}</em>`
    );
  }
  return `<h1 style="margin:0 0 12px 0;font-family:${FONT_BODY};font-weight:800;font-size:30px;line-height:1.1;color:${C.paper};letter-spacing:-0.8px;">${html}</h1>`;
}

function lead(text: string): string {
  return `<p style="margin:0 0 14px 0;font-family:${FONT_BODY};font-size:16px;line-height:1.6;color:${C.paperSub};">${text}</p>`;
}

function body(text: string): string {
  return `<p style="margin:0 0 12px 0;font-family:${FONT_BODY};font-size:14.5px;line-height:1.65;color:${C.paperSub};">${text}</p>`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:12px 0;border-bottom:1px solid ${C.cardLine};font-family:${FONT_MONO};font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${C.paperDim};font-weight:600;">${label}</td>
    <td style="padding:12px 0;border-bottom:1px solid ${C.cardLine};font-family:${FONT_BODY};font-size:14px;color:${C.paper};text-align:right;font-weight:500;">${value}</td>
  </tr>`;
}

function infoTable(rows: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;">${rows}</table>`;
}

function statusBadge(text: string): string {
  return `<span style="display:inline-block;padding:5px 12px;background:${C.signal};color:${C.ink};font-family:${FONT_MONO};font-size:10px;letter-spacing:0.15em;text-transform:uppercase;font-weight:700;border-radius:2px;">${text}</span>`;
}

function ctaButton(text: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto;">
    <tr><td bgcolor="${C.signal}" style="background:${C.signal};border-radius:4px;">
      <a href="${url}" style="display:inline-block;padding:15px 32px;font-family:${FONT_MONO};font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:${C.ink};text-decoration:none;font-weight:800;">${text}&nbsp;&nbsp;&rarr;</a>
    </td></tr>
  </table>`;
}

// ---------------------------------------------------------------------------
// Szablony
// ---------------------------------------------------------------------------

export function purchaseConfirmationEmail(data: OrderData, locale: EmailLocale = "en"): string {
  const headlines: Record<EmailLocale, [string, string]> = {
    de: ["Danke für deinen Kauf.", "Kauf"],
    en: ["Thanks for your purchase.", "purchase"],
  };
  const leads: Record<EmailLocale, string> = {
    de: `Hallo <strong style="color:${C.paper};font-weight:700;">${data.customerName}</strong>, deine Bestellung wurde angenommen. Hier sind die Details.`,
    en: `Hi <strong style="color:${C.paper};font-weight:700;">${data.customerName}</strong>, your order has been received. Here are the details.`,
  };
  const bodies: Record<EmailLocale, string> = {
    de: "Wir benachrichtigen dich, sobald das Paket verschickt wird. Du kannst den Status in deinem Kundenkonto verfolgen.",
    en: "We'll let you know once the package is shipped. You can track the status in your account.",
  };
  const eyebrows: Record<EmailLocale, string> = {
    de: "Bestellung · Bestätigung",
    en: "Order · Confirmation",
  };
  const [hl, hlAccent] = headlines[locale];

  const inner = `
    ${eyebrowBlock(eyebrows[locale])}
    ${headline(hl, hlAccent)}
    ${lead(leads[locale])}

    ${infoTable([
      infoRow(t(locale, "rowProduct"), `<strong style="color:${C.paper};font-weight:600;">${data.product}</strong>`),
      infoRow(t(locale, "rowAmount"),  `<strong style="color:${C.signal};font-family:${FONT_MONO};font-size:15px;">${(data.amount / 100).toFixed(2)} ${locale === "de" ? "€" : "zł"}</strong>`),
      infoRow(t(locale, "rowLocker"),  data.pickupPoint),
      infoRow(t(locale, "rowAddress"), `<span style="font-size:13px;color:${C.paperSub};">${data.pickupPointAddress}</span>`),
      infoRow(t(locale, "rowStatus"),  statusBadge(t(locale, "badgePaid"))),
    ].join(""))}

    ${body(bodies[locale])}
    ${ctaButton(t(locale, "btnPanel"), "https://kalkmate.pl/panel")}

    <p style="margin:24px 0 0 0;font-family:${FONT_MONO};font-size:10px;letter-spacing:0.15em;color:${C.paperDim};text-transform:uppercase;text-align:center;">${t(locale, "labelOrderId")} <span style="color:${C.paper};font-weight:600;">${data.orderId}</span></p>
  `;
  return shell(inner, locale);
}

export function statusInProgressEmail(data: FulfillmentData, locale: EmailLocale = "en"): string {
  const eyebrows: Record<EmailLocale, string> = {
    de: "Status · Aktualisierung",
    en: "Status · Update",
  };
  const headlines: Record<EmailLocale, [string, string]> = {
    de: ["Wird verpackt.", "verpackt"],
    en: ["Being packed.", "packed"],
  };
  const leads: Record<EmailLocale, string> = {
    de: `Hallo <strong style="color:${C.paper};font-weight:700;">${data.customerName}</strong>, deine Bestellung <strong style="color:${C.paper};font-weight:600;">${data.product}</strong> wird bearbeitet.`,
    en: `Hi <strong style="color:${C.paper};font-weight:700;">${data.customerName}</strong>, your order <strong style="color:${C.paper};font-weight:600;">${data.product}</strong> is being processed.`,
  };
  const bodies: Record<EmailLocale, string> = {
    de: "Wir benachrichtigen dich erneut, wenn das Paket mit einer InPost-Sendungsnummer verschickt wurde.",
    en: "We'll notify you again once the package has been shipped with an InPost tracking number.",
  };
  const [hl, hlAccent] = headlines[locale];

  const inner = `
    ${eyebrowBlock(eyebrows[locale])}
    ${headline(hl, hlAccent)}
    ${lead(leads[locale])}

    ${infoTable([
      infoRow(t(locale, "rowStatus"), statusBadge(t(locale, "badgeInProgress"))),
      infoRow(t(locale, "rowLocker"), data.pickupPoint),
    ].join(""))}

    ${body(bodies[locale])}
    ${ctaButton(t(locale, "btnPanel"), "https://kalkmate.pl/panel")}
  `;
  return shell(inner, locale);
}

export function statusShippedEmail(data: FulfillmentData, locale: EmailLocale = "en"): string {
  const eyebrows: Record<EmailLocale, string> = {
    de: "Status · Versand",
    en: "Status · Shipped",
  };
  const headlines: Record<EmailLocale, [string, string]> = {
    de: ["Unterwegs.", "Unterwegs"],
    en: ["On the way.", "way"],
  };
  const leads: Record<EmailLocale, string> = {
    de: `Hallo <strong style="color:${C.paper};font-weight:700;">${data.customerName}</strong>, dein Paket <strong style="color:${C.paper};font-weight:600;">${data.product}</strong> wurde verschickt.`,
    en: `Hi <strong style="color:${C.paper};font-weight:700;">${data.customerName}</strong>, your package <strong style="color:${C.paper};font-weight:600;">${data.product}</strong> has been shipped.`,
  };
  const trackBodies: Record<EmailLocale, string> = {
    de: `Verfolge deine Sendung auf <a href="https://inpost.pl" style="color:${C.signal};text-decoration:underline;font-weight:600;">inpost.pl</a> mit der oben angegebenen Nummer.`,
    en: `Track your shipment at <a href="https://inpost.pl" style="color:${C.signal};text-decoration:underline;font-weight:600;">inpost.pl</a> using the number above.`,
  };
  const pickupBodies: Record<EmailLocale, string> = {
    de: `Hole dein Paket am Paketfach <strong style="color:${C.paper};font-weight:600;">${data.pickupPoint}</strong> ab, nachdem du die SMS mit dem Abholcode erhalten hast.`,
    en: `Pick up your package from parcel locker <strong style="color:${C.paper};font-weight:600;">${data.pickupPoint}</strong> after receiving the SMS with the collection code.`,
  };
  const [hl, hlAccent] = headlines[locale];

  const trackingRow = data.trackingNumber
    ? infoRow(t(locale, "rowTracking"), `<strong style="color:${C.ink};font-family:${FONT_MONO};font-size:13px;background:${C.signal};padding:2px 6px;border-radius:2px;">${data.trackingNumber}</strong>`)
    : "";

  const inner = `
    ${eyebrowBlock(eyebrows[locale])}
    ${headline(hl, hlAccent)}
    ${lead(leads[locale])}

    ${infoTable([
      infoRow(t(locale, "rowStatus"), statusBadge(t(locale, "badgeShipped"))),
      trackingRow,
      infoRow(t(locale, "rowLocker"),  data.pickupPoint),
      infoRow(t(locale, "rowAddress"), `<span style="font-size:13px;color:${C.paperSub};">${data.pickupPointAddress}</span>`),
    ].join(""))}

    ${data.trackingNumber ? body(trackBodies[locale]) : ""}
    ${body(pickupBodies[locale])}

    ${data.trackingNumber
      ? ctaButton(t(locale, "btnTrack"), `https://inpost.pl/sledzenie-przesylek?number=${data.trackingNumber}`)
      : ""}
  `;
  return shell(inner, locale);
}

export function statusFulfilledEmail(data: FulfillmentData, locale: EmailLocale = "en"): string {
  const eyebrows: Record<EmailLocale, string> = {
    de: "Status · Abgeschlossen",
    en: "Status · Completed",
  };
  const headlines: Record<EmailLocale, [string, string]> = {
    de: ["Fertig.", "Fertig"],
    en: ["Done.", "Done"],
  };
  const leads: Record<EmailLocale, string> = {
    de: `Hallo <strong style="color:${C.paper};font-weight:700;">${data.customerName}</strong>, deine Bestellung <strong style="color:${C.paper};font-weight:600;">${data.product}</strong> wurde abgeschlossen.`,
    en: `Hi <strong style="color:${C.paper};font-weight:700;">${data.customerName}</strong>, your order <strong style="color:${C.paper};font-weight:600;">${data.product}</strong> has been completed.`,
  };
  const mailLink = `<a href="mailto:kontakt@kalkmate.pl" style="color:${C.signal};text-decoration:underline;font-weight:600;">kontakt@kalkmate.pl</a>`;
  const bodies: Record<EmailLocale, string> = {
    de: `Danke für deinen Kauf. Bei Fragen schreib uns an ${mailLink}.`,
    en: `Thank you for your purchase. If you have any questions, contact us at ${mailLink}.`,
  };
  const [hl, hlAccent] = headlines[locale];

  const inner = `
    ${eyebrowBlock(eyebrows[locale])}
    ${headline(hl, hlAccent)}
    ${lead(leads[locale])}

    ${infoTable([
      infoRow(t(locale, "rowStatus"), statusBadge(t(locale, "badgeFulfilled"))),
    ].join(""))}

    ${body(bodies[locale])}
    ${ctaButton(t(locale, "btnPanel"), "https://kalkmate.pl/panel")}
  `;
  return shell(inner, locale);
}

export function statusCancelledEmail(data: FulfillmentData, locale: EmailLocale = "en"): string {
  const eyebrows: Record<EmailLocale, string> = {
    de: "Status · Storniert",
    en: "Status · Cancelled",
  };
  const headlines: Record<EmailLocale, [string, string]> = {
    de: ["Storniert.", "Storniert"],
    en: ["Cancelled.", "Cancelled"],
  };
  const leads: Record<EmailLocale, string> = {
    de: `Hallo <strong style="color:${C.paper};font-weight:700;">${data.customerName}</strong>, deine Bestellung <strong style="color:${C.paper};font-weight:600;">${data.product}</strong> wurde storniert.`,
    en: `Hi <strong style="color:${C.paper};font-weight:700;">${data.customerName}</strong>, your order <strong style="color:${C.paper};font-weight:600;">${data.product}</strong> has been cancelled.`,
  };
  const mailLink = `<a href="mailto:kontakt@kalkmate.pl" style="color:${C.signal};text-decoration:underline;font-weight:600;">kontakt@kalkmate.pl</a>`;
  const bodies: Record<EmailLocale, string> = {
    de: `Falls du dazu Fragen hast oder das nicht erwartet hast, melde dich bitte bei uns unter ${mailLink}.`,
    en: `If you have any questions about this or didn't expect it, please reach out to us at ${mailLink}.`,
  };
  const [hl, hlAccent] = headlines[locale];

  const inner = `
    ${eyebrowBlock(eyebrows[locale])}
    ${headline(hl, hlAccent)}
    ${lead(leads[locale])}

    ${infoTable([
      infoRow(t(locale, "rowStatus"), statusBadge(t(locale, "badgeCancelled"))),
    ].join(""))}

    ${body(bodies[locale])}
  `;
  return shell(inner, locale);
}

export function verificationEmail(data: VerificationData, locale: EmailLocale = "en"): string {
  const eyebrows: Record<EmailLocale, string> = {
    de: "Konto · E-Mail-Bestätigung",
    en: "Account · Email verification",
  };
  const headlines: Record<EmailLocale, [string, string]> = {
    de: ["E-Mail bestätigen.", "bestätigen"],
    en: ["Confirm your email.", "email"],
  };
  const greetings: Record<EmailLocale, string> = {
    de: data.customerName
      ? `Hallo <strong style="color:${C.paper};font-weight:700;">${data.customerName}</strong>!`
      : "Hallo!",
    en: data.customerName
      ? `Hi <strong style="color:${C.paper};font-weight:700;">${data.customerName}</strong>!`
      : "Hi!",
  };
  const leadTexts: Record<EmailLocale, string> = {
    de: `${greetings.de} Danke für deine Registrierung bei KalkMate. Um dein Konto zu aktivieren, klicke auf den Button unten. Der Link läuft in <strong style="color:${C.ink};font-family:${FONT_MONO};background:${C.signal};padding:2px 6px;border-radius:2px;">${data.expiresHours} h</strong> ab.`,
    en: `${greetings.en} Thank you for signing up to KalkMate. To activate your account, click the button below. The link expires in <strong style="color:${C.ink};font-family:${FONT_MONO};background:${C.signal};padding:2px 6px;border-radius:2px;">${data.expiresHours} h</strong>.`,
  };
  const noteTexts: Record<EmailLocale, string> = {
    de: "Ohne Bestätigung kannst du dich weder anmelden noch bestellen. Falls du kein Konto erstellt hast, ignoriere diese E-Mail.",
    en: "Without verification you won't be able to log in or place an order. If you didn't create this account, ignore this email.",
  };
  const [hl, hlAccent] = headlines[locale];

  const inner = `
    ${eyebrowBlock(eyebrows[locale])}
    ${headline(hl, hlAccent)}
    ${lead(leadTexts[locale])}

    ${ctaButton(t(locale, "btnVerify"), data.verifyUrl)}

    <p style="margin:24px 0 8px 0;font-family:${FONT_MONO};font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:${C.paperDim};font-weight:600;">${t(locale, "labelOr")}</p>
    <p style="margin:0;padding:14px;background:${C.signalDark};border:1px solid ${C.cardLine};border-left:3px solid ${C.signal};font-family:${FONT_MONO};font-size:11.5px;color:${C.signal};word-break:break-all;">${data.verifyUrl}</p>

    ${body(`<span style="color:${C.paperDim};">${noteTexts[locale]}</span>`)}
  `;
  return shell(inner, locale);
}

export function passwordResetEmail(data: PasswordResetData, locale: EmailLocale = "en"): string {
  const eyebrows: Record<EmailLocale, string> = {
    de: "Konto · Passwort zurücksetzen",
    en: "Account · Password reset",
  };
  const headlines: Record<EmailLocale, [string, string]> = {
    de: ["Passwort zurücksetzen.", "zurücksetzen"],
    en: ["Password reset.", "reset"],
  };
  const leadTexts: Record<EmailLocale, string> = {
    de: `Jemand (hoffentlich du) hat einen Passwort-Reset für dein KalkMate-Konto angefragt. Klicke auf den Button unten, um ein neues Passwort festzulegen. Der Link läuft in <strong style="color:${C.ink};font-family:${FONT_MONO};background:${C.signal};padding:2px 6px;border-radius:2px;">${data.expiresMinutes} Minuten</strong> ab.`,
    en: `Someone (hopefully you) requested a password reset for your KalkMate account. Click the button below to set a new password. The link expires in <strong style="color:${C.ink};font-family:${FONT_MONO};background:${C.signal};padding:2px 6px;border-radius:2px;">${data.expiresMinutes} minutes</strong>.`,
  };
  const noteTexts: Record<EmailLocale, string> = {
    de: "Falls du diese Anfrage nicht gestellt hast, ignoriere diese E-Mail. Dein Passwort wird nicht geändert.",
    en: "If you didn't send this request, ignore this email. Your password won't be changed.",
  };
  const [hl, hlAccent] = headlines[locale];

  const inner = `
    ${eyebrowBlock(eyebrows[locale])}
    ${headline(hl, hlAccent)}
    ${lead(leadTexts[locale])}

    ${ctaButton(t(locale, "btnReset"), data.resetUrl)}

    <p style="margin:24px 0 8px 0;font-family:${FONT_MONO};font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:${C.paperDim};font-weight:600;">${t(locale, "labelOr")}</p>
    <p style="margin:0;padding:14px;background:${C.signalDark};border:1px solid ${C.cardLine};border-left:3px solid ${C.signal};font-family:${FONT_MONO};font-size:11.5px;color:${C.signal};word-break:break-all;">${data.resetUrl}</p>

    ${body(`<span style="color:${C.paperDim};">${noteTexts[locale]}</span>`)}
  `;
  return shell(inner, locale);
}

// ---------------------------------------------------------------------------
// Tematy maili (subject lines) — używane bezpośrednio w routes
// ---------------------------------------------------------------------------
export const EMAIL_SUBJECTS = {
  verify: {
    de: "E-Mail-Adresse bestätigen – KalkMate",
    en: "Confirm your email – KalkMate",
  },
  passwordReset: {
    de: "Passwort zurücksetzen – KalkMate",
    en: "Password reset – KalkMate",
  },
  orderInProgress: {
    de: "Deine Bestellung wird bearbeitet – KalkMate",
    en: "Your order is being processed – KalkMate",
  },
  orderShipped: {
    de: "Dein Paket wurde verschickt! – KalkMate",
    en: "Your package has been shipped! – KalkMate",
  },
  orderFulfilled: {
    de: "Bestellung abgeschlossen – KalkMate",
    en: "Order completed – KalkMate",
  },
  orderCancelled: {
    de: "Deine Bestellung wurde storniert – KalkMate",
    en: "Your order has been cancelled – KalkMate",
  },
  orderConfirmation: {
    de: "Bestellbestätigung – KalkMate",
    en: "Order confirmation – KalkMate",
  },
} satisfies Record<string, Record<EmailLocale, string>>;
