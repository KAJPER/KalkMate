// Email szablony — ciemny motyw + lokalizacja pl | de | en
//
// Lokalizacja:
//   "pl" — domyślne (główny rynek; Accept-Language: pl*, brak dopasowania, country=PL/brak)
//   "de" — klienci z Niemiec (Accept-Language: de* lub country=DE)
//   "en" — Accept-Language: en* oraz zamówienia z pozostałych krajów
//
// Pomocniki do wykrywania:
//   detectLocale(acceptLanguageHeader)  — dla maili auth (request header)
//   localeFromCountry(countryCode)      — dla maili zamówień (Stripe metadata)
//
// WSZYSTKIE dane od klienta/użytkownika (imię, adres, paczkomat, notatki…)
// wstawiamy przez escHtml() — wcześniej imię z formularza zamówienia trafiało
// do HTML maila surowo (audyt 2026-10-16: wstrzykiwanie linków/HTML w mailach
// wysyłanych z naszej domeny).

export type EmailLocale = "pl" | "de" | "en";

export function detectLocale(acceptLanguage: string | null | undefined): EmailLocale {
  if (typeof acceptLanguage !== "string") return "pl";
  // Kolejność w nagłówku = kolejność preferencji przeglądarki. Bierzemy pierwszy
  // język, który obsługujemy; nic nie pasuje → polski (główny rynek).
  for (const part of acceptLanguage.split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase();
    if (/^pl\b/.test(tag)) return "pl";
    if (/^de\b/.test(tag)) return "de";
    if (/^en\b/.test(tag)) return "en";
  }
  return "pl";
}

export function localeFromCountry(country: string | null | undefined): EmailLocale {
  // Brak kraju = stare/krajowe zamówienie (reszta kodu traktuje je jako PL).
  const c = (country || "PL").toUpperCase();
  if (c === "PL") return "pl";
  if (c === "DE") return "de";
  return "en";
}

// Escapowanie danych wstawianych do HTML maila (tekst i atrybuty w "…").
export function escHtml(s: string | null | undefined): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Dane wejściowe szablonów
// ---------------------------------------------------------------------------
interface OrderData {
  customerName: string;
  customerEmail: string;
  product: string;
  amount: number;           // w groszach / centach waluty `currency`
  currency?: string;        // waluta płatności (pln, eur…) — NIE wynika z języka maila
  pickupPoint: string;
  pickupPointAddress: string;
  deliveryAddress?: string; // adres dla kuriera, gdy nie ma paczkomatu (zamówienia zagraniczne)
  orderId: string;
  quantity?: number;        // ile sztuk (brak = 1)
  unitNames?: string[];     // imiona/nicki na etykietach sztuk (BEZ kodów AI — to sekret)
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
  pl: {
    footerAuto:       "Wiadomość automatyczna",
    badgePaid:        "Opłacone",
    badgeInProgress:  "W realizacji",
    badgeShipped:     "Wysłane",
    badgeFulfilled:   "Zrealizowane",
    badgeCancelled:   "Anulowane",
    rowProduct:       "Produkt",
    rowAmount:        "Kwota",
    rowLocker:        "Paczkomat",
    rowAddress:       "Adres",
    rowDelivery:      "Adres dostawy",
    rowStatus:        "Status",
    rowTracking:      "Numer przesyłki",
    btnPanel:         "Otwórz panel",
    btnVerify:        "Potwierdź e-mail",
    btnReset:         "Ustaw nowe hasło",
    btnTrack:         "Śledź przesyłkę",
    btnConfirmChange: "Potwierdź nowy adres",
    btnSignin:        "Zaloguj się",
    labelOr:          "Lub link:",
    labelOrderId:     "Numer zamówienia:",
  },
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
    rowDelivery:      "Lieferadresse",
    rowStatus:        "Status",
    rowTracking:      "Sendungsnummer",
    btnPanel:         "Panel öffnen",
    btnVerify:        "E-Mail bestätigen",
    btnReset:         "Neues Passwort setzen",
    btnTrack:         "Sendung verfolgen",
    btnConfirmChange: "Neue Adresse bestätigen",
    btnSignin:        "Anmelden",
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
    rowDelivery:      "Delivery address",
    rowStatus:        "Status",
    rowTracking:      "Tracking number",
    btnPanel:         "Open panel",
    btnVerify:        "Confirm email",
    btnReset:         "Set new password",
    btnTrack:         "Track package",
    btnConfirmChange: "Confirm new address",
    btnSignin:        "Sign in",
    labelOr:          "Or link:",
    labelOrderId:     "Order ID:",
  },
};

const t = (locale: EmailLocale, key: string): string =>
  TX[locale]?.[key] ?? TX.en[key] ?? key;

// Kwota w walucie PŁATNOŚCI (klient z UK płaci w EUR, a mail jest po angielsku —
// waluty nie wolno zgadywać z języka). PLN zostaje w polskim zapisie "699.00 zł".
export function formatMoney(cents: number, currency: string | null | undefined, locale: EmailLocale): string {
  const cur = (currency || "pln").toUpperCase();
  if (cur === "PLN") return `${(cents / 100).toFixed(2)} zł`;
  try {
    const intlLocale = locale === "de" ? "de-DE" : locale === "pl" ? "pl-PL" : "en-IE";
    return new Intl.NumberFormat(intlLocale, { style: "currency", currency: cur }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${cur}`;
  }
}

// ---------------------------------------------------------------------------
// Bloki pomocnicze HTML (locale-aware tam gdzie potrzeba)
// ---------------------------------------------------------------------------
function brandHtml(size = 24): string {
  return `<span style="font-family:${FONT_BODY};font-weight:800;font-size:${size}px;letter-spacing:-0.5px;color:${C.paper};">Kalk<em style="color:${C.signal};font-style:italic;font-weight:800;">Mate</em></span>`;
}

function eyebrowHtml(text: string, color: string = C.signal): string {
  return `<span style="font-family:${FONT_MONO};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${color};font-weight:700;">${text}</span>`;
}

interface ShellOptions {
  htmlLang?: string;        // gdy mail jest w innym jezyku niz de/en (np. "pl")
  footerLabel?: string;     // zamiast "Automated message"
  footerExtraHtml?: string; // np. link do wypisania z newslettera
}

function shell(inner: string, locale: EmailLocale = "pl", opts: ShellOptions = {}): string {
  return `<!DOCTYPE html>
<html lang="${opts.htmlLang || locale}">
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
              <span style="font-family:${FONT_MONO};font-size:10px;letter-spacing:0.15em;color:${C.paperDim};text-transform:uppercase;">/MAIL &middot; v3.0</span>
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
          KalkMate &middot; ${opts.footerLabel || t(locale, "footerAuto")}
        </div>${opts.footerExtraHtml || ""}
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

// Pogrubione imię / produkt w treści (zawsze escapowane — dane od klienta).
const strongName = (s: string) => `<strong style="color:${C.paper};font-weight:700;">${escHtml(s)}</strong>`;
const strongItem = (s: string) => `<strong style="color:${C.paper};font-weight:600;">${escHtml(s)}</strong>`;

export function purchaseConfirmationEmail(data: OrderData, locale: EmailLocale = "pl"): string {
  const headlines: Record<EmailLocale, [string, string]> = {
    pl: ["Dziękujemy za zakup.", "zakup"],
    de: ["Danke für deinen Kauf.", "Kauf"],
    en: ["Thanks for your purchase.", "purchase"],
  };
  const leads: Record<EmailLocale, string> = {
    pl: `Cześć ${strongName(data.customerName)}, przyjęliśmy Twoje zamówienie. Poniżej szczegóły.`,
    de: `Hallo ${strongName(data.customerName)}, deine Bestellung wurde angenommen. Hier sind die Details.`,
    en: `Hi ${strongName(data.customerName)}, your order has been received. Here are the details.`,
  };
  const bodies: Record<EmailLocale, string> = {
    pl: "Damy znać, gdy paczka zostanie wysłana. Status zamówienia sprawdzisz w panelu klienta.",
    de: "Wir benachrichtigen dich, sobald das Paket verschickt wird. Du kannst den Status in deinem Kundenkonto verfolgen.",
    en: "We'll let you know once the package is shipped. You can track the status in your account.",
  };
  const eyebrows: Record<EmailLocale, string> = {
    pl: "Zamówienie · Potwierdzenie",
    de: "Bestellung · Bestätigung",
    en: "Order · Confirmation",
  };
  const [hl, hlAccent] = headlines[locale];

  // Wiele sztuk: "KalkMate v3.0 × 3" + lista imion na etykietach (kod AI
  // zamaskowany — nie wysylamy sekretu mailem).
  const qty = Number.isInteger(data.quantity) && (data.quantity as number) > 1 ? (data.quantity as number) : 1;
  const productHtml = strongItem(data.product) + (qty > 1 ? ` <strong style="color:${C.signal};font-family:${FONT_MONO};">&times;&nbsp;${qty}</strong>` : "");
  const labelsTitle: Record<EmailLocale, string> = { pl: "Etykiety", de: "Etiketten", en: "Labels" };
  const codeWord: Record<EmailLocale, string> = { pl: "kod AI", de: "KI-Code", en: "AI code" };
  const names = (data.unitNames || []).map((n) => String(n ?? "").trim()).filter(Boolean);
  const labelsRow = names.length
    ? infoRow(labelsTitle[locale], names.map((n, i) =>
        `<div style="font-size:13px;color:${C.paper};line-height:1.6;">${names.length > 1 ? `${i + 1}. ` : ""}${escHtml(n)} <span style="color:${C.paperDim};font-family:${FONT_MONO};font-size:11px;">· ${codeWord[locale]} ••••</span></div>`,
      ).join(""))
    : "";

  const inner = `
    ${eyebrowBlock(eyebrows[locale])}
    ${headline(hl, hlAccent)}
    ${lead(leads[locale])}

    ${infoTable([
      infoRow(t(locale, "rowProduct"), productHtml),
      labelsRow,
      infoRow(t(locale, "rowAmount"),  `<strong style="color:${C.signal};font-family:${FONT_MONO};font-size:15px;">${escHtml(formatMoney(data.amount, data.currency, locale))}</strong>`),
      ...(data.pickupPoint
        ? [infoRow(t(locale, "rowLocker"),  escHtml(data.pickupPoint)),
           infoRow(t(locale, "rowAddress"), `<span style="font-size:13px;color:${C.paperSub};">${escHtml(data.pickupPointAddress)}</span>`)]
        : data.deliveryAddress
          ? [infoRow(t(locale, "rowDelivery"), `<span style="font-size:13px;color:${C.paperSub};">${escHtml(data.deliveryAddress)}</span>`)]
          : []),
      infoRow(t(locale, "rowStatus"),  statusBadge(t(locale, "badgePaid"))),
    ].join(""))}

    ${body(bodies[locale])}
    ${ctaButton(t(locale, "btnPanel"), "https://kalkmate.pl/panel")}

    <p style="margin:24px 0 0 0;font-family:${FONT_MONO};font-size:10px;letter-spacing:0.15em;color:${C.paperDim};text-transform:uppercase;text-align:center;">${t(locale, "labelOrderId")} <span style="color:${C.paper};font-weight:600;">${escHtml(data.orderId)}</span></p>
  `;
  return shell(inner, locale);
}

export function statusInProgressEmail(data: FulfillmentData, locale: EmailLocale = "pl"): string {
  const eyebrows: Record<EmailLocale, string> = {
    pl: "Status · Aktualizacja",
    de: "Status · Aktualisierung",
    en: "Status · Update",
  };
  const headlines: Record<EmailLocale, [string, string]> = {
    pl: ["Pakujemy.", "Pakujemy"],
    de: ["Wird verpackt.", "verpackt"],
    en: ["Being packed.", "packed"],
  };
  const leads: Record<EmailLocale, string> = {
    pl: `Cześć ${strongName(data.customerName)}, Twoje zamówienie ${strongItem(data.product)} jest w realizacji.`,
    de: `Hallo ${strongName(data.customerName)}, deine Bestellung ${strongItem(data.product)} wird bearbeitet.`,
    en: `Hi ${strongName(data.customerName)}, your order ${strongItem(data.product)} is being processed.`,
  };
  const bodies: Record<EmailLocale, string> = {
    pl: "Napiszemy ponownie, gdy paczka zostanie nadana — razem z numerem przesyłki InPost.",
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
      infoRow(t(locale, "rowLocker"), escHtml(data.pickupPoint)),
    ].join(""))}

    ${body(bodies[locale])}
    ${ctaButton(t(locale, "btnPanel"), "https://kalkmate.pl/panel")}
  `;
  return shell(inner, locale);
}

// Etykieta nadana w panelu (Base Courier) — numer przesylki juz jest, kurier
// jeszcze nie odebral paczki. Wysylane raz, przy nadaniu (notifyShipmentCreated).
export function statusLabelCreatedEmail(data: FulfillmentData, locale: EmailLocale = "pl"): string {
  const eyebrows: Record<EmailLocale, string> = {
    pl: "Status · Nadanie",
    de: "Status · Versandvorbereitung",
    en: "Status · Shipping",
  };
  const headlines: Record<EmailLocale, [string, string]> = {
    pl: ["Pakujemy i wysyłamy.", "wysyłamy"],
    de: ["Wird verpackt und verschickt.", "verschickt"],
    en: ["Packing and shipping.", "shipping"],
  };
  const leads: Record<EmailLocale, string> = {
    pl: `Cześć ${strongName(data.customerName)}, pakujemy Twoje zamówienie ${strongItem(data.product)} i nadaliśmy już przesyłkę.`,
    de: `Hallo ${strongName(data.customerName)}, wir verpacken deine Bestellung ${strongItem(data.product)} — die Sendung ist bereits angemeldet.`,
    en: `Hi ${strongName(data.customerName)}, we're packing your order ${strongItem(data.product)} and the shipment is already booked.`,
  };
  const bodies: Record<EmailLocale, string> = {
    pl: "Kurier odbierze paczkę w ciągu 1–2 dni roboczych. Do tego czasu śledzenie może pokazywać tylko „przesyłka utworzona” — to normalne.",
    de: "Der Kurier holt das Paket innerhalb von 1–2 Werktagen ab. Bis dahin zeigt die Sendungsverfolgung eventuell nur „Sendung erstellt“ — das ist normal.",
    en: "The courier will collect the package within 1–2 business days. Until then, tracking may only show “shipment created” — that's normal.",
  };
  const [hl, hlAccent] = headlines[locale];
  const tracking = data.trackingNumber || "";
  const isInPost = /^\d{24}$/.test(tracking);

  const inner = `
    ${eyebrowBlock(eyebrows[locale])}
    ${headline(hl, hlAccent)}
    ${lead(leads[locale])}

    ${infoTable([
      infoRow(t(locale, "rowStatus"), statusBadge(t(locale, "badgeInProgress"))),
      tracking
        ? infoRow(t(locale, "rowTracking"), `<strong style="color:${C.ink};font-family:${FONT_MONO};font-size:13px;background:${C.signal};padding:2px 6px;border-radius:2px;">${escHtml(tracking)}</strong>`)
        : "",
      data.pickupPoint ? infoRow(t(locale, "rowLocker"), escHtml(data.pickupPoint)) : "",
    ].join(""))}

    ${body(bodies[locale])}
    ${isInPost
      ? ctaButton(t(locale, "btnTrack"), `https://inpost.pl/sledzenie-przesylek?number=${encodeURIComponent(tracking)}`)
      : ctaButton(t(locale, "btnPanel"), "https://kalkmate.pl/panel")}
  `;
  return shell(inner, locale);
}

export function statusShippedEmail(data: FulfillmentData, locale: EmailLocale = "pl"): string {
  const eyebrows: Record<EmailLocale, string> = {
    pl: "Status · Wysłane",
    de: "Status · Versand",
    en: "Status · Shipped",
  };
  const headlines: Record<EmailLocale, [string, string]> = {
    pl: ["W drodze.", "drodze"],
    de: ["Unterwegs.", "Unterwegs"],
    en: ["On the way.", "way"],
  };
  const leads: Record<EmailLocale, string> = {
    pl: `Cześć ${strongName(data.customerName)}, Twoja paczka ${strongItem(data.product)} została wysłana.`,
    de: `Hallo ${strongName(data.customerName)}, dein Paket ${strongItem(data.product)} wurde verschickt.`,
    en: `Hi ${strongName(data.customerName)}, your package ${strongItem(data.product)} has been shipped.`,
  };
  const trackBodies: Record<EmailLocale, string> = {
    pl: `Śledź przesyłkę na <a href="https://inpost.pl" style="color:${C.signal};text-decoration:underline;font-weight:600;">inpost.pl</a> po numerze podanym powyżej.`,
    de: `Verfolge deine Sendung auf <a href="https://inpost.pl" style="color:${C.signal};text-decoration:underline;font-weight:600;">inpost.pl</a> mit der oben angegebenen Nummer.`,
    en: `Track your shipment at <a href="https://inpost.pl" style="color:${C.signal};text-decoration:underline;font-weight:600;">inpost.pl</a> using the number above.`,
  };
  const pickupBodies: Record<EmailLocale, string> = {
    pl: `Odbierz paczkę z paczkomatu ${strongItem(data.pickupPoint)} po otrzymaniu SMS-a z kodem odbioru.`,
    de: `Hole dein Paket am Paketfach ${strongItem(data.pickupPoint)} ab, nachdem du die SMS mit dem Abholcode erhalten hast.`,
    en: `Pick up your package from parcel locker ${strongItem(data.pickupPoint)} after receiving the SMS with the collection code.`,
  };
  const [hl, hlAccent] = headlines[locale];

  const trackingRow = data.trackingNumber
    ? infoRow(t(locale, "rowTracking"), `<strong style="color:${C.ink};font-family:${FONT_MONO};font-size:13px;background:${C.signal};padding:2px 6px;border-radius:2px;">${escHtml(data.trackingNumber)}</strong>`)
    : "";

  const inner = `
    ${eyebrowBlock(eyebrows[locale])}
    ${headline(hl, hlAccent)}
    ${lead(leads[locale])}

    ${infoTable([
      infoRow(t(locale, "rowStatus"), statusBadge(t(locale, "badgeShipped"))),
      trackingRow,
      infoRow(t(locale, "rowLocker"),  escHtml(data.pickupPoint)),
      infoRow(t(locale, "rowAddress"), `<span style="font-size:13px;color:${C.paperSub};">${escHtml(data.pickupPointAddress)}</span>`),
    ].join(""))}

    ${data.trackingNumber ? body(trackBodies[locale]) : ""}
    ${body(pickupBodies[locale])}

    ${data.trackingNumber
      ? ctaButton(t(locale, "btnTrack"), `https://inpost.pl/sledzenie-przesylek?number=${encodeURIComponent(data.trackingNumber)}`)
      : ""}
  `;
  return shell(inner, locale);
}

export function statusFulfilledEmail(data: FulfillmentData, locale: EmailLocale = "pl"): string {
  const eyebrows: Record<EmailLocale, string> = {
    pl: "Status · Zrealizowane",
    de: "Status · Abgeschlossen",
    en: "Status · Completed",
  };
  const headlines: Record<EmailLocale, [string, string]> = {
    pl: ["Gotowe.", "Gotowe"],
    de: ["Fertig.", "Fertig"],
    en: ["Done.", "Done"],
  };
  const leads: Record<EmailLocale, string> = {
    pl: `Cześć ${strongName(data.customerName)}, Twoje zamówienie ${strongItem(data.product)} zostało zrealizowane.`,
    de: `Hallo ${strongName(data.customerName)}, deine Bestellung ${strongItem(data.product)} wurde abgeschlossen.`,
    en: `Hi ${strongName(data.customerName)}, your order ${strongItem(data.product)} has been completed.`,
  };
  const mailLink = `<a href="mailto:kontakt@kalkmate.pl" style="color:${C.signal};text-decoration:underline;font-weight:600;">kontakt@kalkmate.pl</a>`;
  const bodies: Record<EmailLocale, string> = {
    pl: `Dziękujemy za zakup. W razie pytań napisz do nas: ${mailLink}.`,
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

export function statusCancelledEmail(data: FulfillmentData, locale: EmailLocale = "pl"): string {
  const eyebrows: Record<EmailLocale, string> = {
    pl: "Status · Anulowane",
    de: "Status · Storniert",
    en: "Status · Cancelled",
  };
  const headlines: Record<EmailLocale, [string, string]> = {
    pl: ["Anulowane.", "Anulowane"],
    de: ["Storniert.", "Storniert"],
    en: ["Cancelled.", "Cancelled"],
  };
  const leads: Record<EmailLocale, string> = {
    pl: `Cześć ${strongName(data.customerName)}, Twoje zamówienie ${strongItem(data.product)} zostało anulowane.`,
    de: `Hallo ${strongName(data.customerName)}, deine Bestellung ${strongItem(data.product)} wurde storniert.`,
    en: `Hi ${strongName(data.customerName)}, your order ${strongItem(data.product)} has been cancelled.`,
  };
  const mailLink = `<a href="mailto:kontakt@kalkmate.pl" style="color:${C.signal};text-decoration:underline;font-weight:600;">kontakt@kalkmate.pl</a>`;
  const bodies: Record<EmailLocale, string> = {
    pl: `Jeśli masz pytania albo się tego nie spodziewałeś(-aś), napisz do nas: ${mailLink}.`,
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

const expiryBadge = (text: string) =>
  `<strong style="color:${C.ink};font-family:${FONT_MONO};background:${C.signal};padding:2px 6px;border-radius:2px;">${escHtml(text)}</strong>`;

function linkFallback(locale: EmailLocale, url: string): string {
  return `<p style="margin:24px 0 8px 0;font-family:${FONT_MONO};font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:${C.paperDim};font-weight:600;">${t(locale, "labelOr")}</p>
    <p style="margin:0;padding:14px;background:${C.signalDark};border:1px solid ${C.cardLine};border-left:3px solid ${C.signal};font-family:${FONT_MONO};font-size:11.5px;color:${C.signal};word-break:break-all;">${escHtml(url)}</p>`;
}

export function verificationEmail(data: VerificationData, locale: EmailLocale = "pl"): string {
  const eyebrows: Record<EmailLocale, string> = {
    pl: "Konto · Potwierdzenie e-maila",
    de: "Konto · E-Mail-Bestätigung",
    en: "Account · Email verification",
  };
  const headlines: Record<EmailLocale, [string, string]> = {
    pl: ["Potwierdź e-mail.", "e-mail"],
    de: ["E-Mail bestätigen.", "bestätigen"],
    en: ["Confirm your email.", "email"],
  };
  const greetings: Record<EmailLocale, string> = {
    pl: data.customerName ? `Cześć ${strongName(data.customerName)}!` : "Cześć!",
    de: data.customerName ? `Hallo ${strongName(data.customerName)}!` : "Hallo!",
    en: data.customerName ? `Hi ${strongName(data.customerName)}!` : "Hi!",
  };
  const exp = `${data.expiresHours} h`;
  const leadTexts: Record<EmailLocale, string> = {
    pl: `${greetings.pl} Dziękujemy za rejestrację w KalkMate. Aby aktywować konto, kliknij przycisk poniżej. Link wygasa za ${expiryBadge(exp)}.`,
    de: `${greetings.de} Danke für deine Registrierung bei KalkMate. Um dein Konto zu aktivieren, klicke auf den Button unten. Der Link läuft in ${expiryBadge(exp)} ab.`,
    en: `${greetings.en} Thank you for signing up to KalkMate. To activate your account, click the button below. The link expires in ${expiryBadge(exp)}.`,
  };
  const noteTexts: Record<EmailLocale, string> = {
    pl: "Bez potwierdzenia nie zalogujesz się ani nie złożysz zamówienia. Jeśli to nie Ty zakładałeś(-aś) konto, zignoruj tę wiadomość.",
    de: "Ohne Bestätigung kannst du dich weder anmelden noch bestellen. Falls du kein Konto erstellt hast, ignoriere diese E-Mail.",
    en: "Without verification you won't be able to log in or place an order. If you didn't create this account, ignore this email.",
  };
  const [hl, hlAccent] = headlines[locale];

  const inner = `
    ${eyebrowBlock(eyebrows[locale])}
    ${headline(hl, hlAccent)}
    ${lead(leadTexts[locale])}

    ${ctaButton(t(locale, "btnVerify"), escHtml(data.verifyUrl))}

    ${linkFallback(locale, data.verifyUrl)}

    ${body(`<span style="color:${C.paperDim};">${noteTexts[locale]}</span>`)}
  `;
  return shell(inner, locale);
}

export function passwordResetEmail(data: PasswordResetData, locale: EmailLocale = "pl"): string {
  const eyebrows: Record<EmailLocale, string> = {
    pl: "Konto · Reset hasła",
    de: "Konto · Passwort zurücksetzen",
    en: "Account · Password reset",
  };
  const headlines: Record<EmailLocale, [string, string]> = {
    pl: ["Reset hasła.", "hasła"],
    de: ["Passwort zurücksetzen.", "zurücksetzen"],
    en: ["Password reset.", "reset"],
  };
  const leadTexts: Record<EmailLocale, string> = {
    pl: `Ktoś (mamy nadzieję, że Ty) poprosił o reset hasła do konta KalkMate. Kliknij przycisk poniżej, aby ustawić nowe hasło. Link wygasa za ${expiryBadge(`${data.expiresMinutes} minut`)}.`,
    de: `Jemand (hoffentlich du) hat einen Passwort-Reset für dein KalkMate-Konto angefragt. Klicke auf den Button unten, um ein neues Passwort festzulegen. Der Link läuft in ${expiryBadge(`${data.expiresMinutes} Minuten`)} ab.`,
    en: `Someone (hopefully you) requested a password reset for your KalkMate account. Click the button below to set a new password. The link expires in ${expiryBadge(`${data.expiresMinutes} minutes`)}.`,
  };
  const noteTexts: Record<EmailLocale, string> = {
    pl: "Jeśli to nie Ty wysłałeś(-aś) tę prośbę, zignoruj tę wiadomość — hasło nie zostanie zmienione.",
    de: "Falls du diese Anfrage nicht gestellt hast, ignoriere diese E-Mail. Dein Passwort wird nicht geändert.",
    en: "If you didn't send this request, ignore this email. Your password won't be changed.",
  };
  const [hl, hlAccent] = headlines[locale];

  const inner = `
    ${eyebrowBlock(eyebrows[locale])}
    ${headline(hl, hlAccent)}
    ${lead(leadTexts[locale])}

    ${ctaButton(t(locale, "btnReset"), escHtml(data.resetUrl))}

    ${linkFallback(locale, data.resetUrl)}

    ${body(`<span style="color:${C.paperDim};">${noteTexts[locale]}</span>`)}
  `;
  return shell(inner, locale);
}

// Rejestracja na adres, który JUŻ ma konto. Konta nie ruszamy (audyt
// 2026-10-16: wcześniej rejestracja ustawiała hasło napastnika na koncie
// Google ofiary) — właściciel dostaje tylko informację, co może zrobić.
export interface AccountExistsData {
  signinUrl: string;
  forgotUrl: string;
}

export function accountExistsEmail(data: AccountExistsData, locale: EmailLocale = "pl"): string {
  const eyebrows: Record<EmailLocale, string> = {
    pl: "Konto · Próba rejestracji",
    de: "Konto · Registrierungsversuch",
    en: "Account · Sign-up attempt",
  };
  const headlines: Record<EmailLocale, [string, string]> = {
    pl: ["Masz już konto.", "konto"],
    de: ["Du hast schon ein Konto.", "Konto"],
    en: ["You already have an account.", "account"],
  };
  const forgot = (label: string) =>
    `<a href="${escHtml(data.forgotUrl)}" style="color:${C.signal};text-decoration:underline;font-weight:600;">${label}</a>`;
  const leadTexts: Record<EmailLocale, string> = {
    pl: "Ktoś próbował założyć nowe konto KalkMate na ten adres e-mail. Konto na ten adres już istnieje, więc niczego nie zmieniliśmy.",
    de: "Jemand hat versucht, mit dieser E-Mail-Adresse ein neues KalkMate-Konto zu erstellen. Für diese Adresse gibt es bereits ein Konto, daher haben wir nichts geändert.",
    en: "Someone tried to create a new KalkMate account with this email address. An account with this address already exists, so nothing was changed.",
  };
  const bodyTexts: Record<EmailLocale, string> = {
    pl: `Jeśli to Ty — zaloguj się przez Google (jeśli tak zakładałeś(-aś) konto) albo ustaw hasło przez ${forgot("reset hasła")}.`,
    de: `Falls du das warst: Melde dich mit Google an (falls du das Konto so erstellt hast) oder setze ein Passwort über ${forgot("Passwort zurücksetzen")}.`,
    en: `If this was you, sign in with Google (if that's how you created the account) or set a password using ${forgot("password reset")}.`,
  };
  const noteTexts: Record<EmailLocale, string> = {
    pl: "Jeśli to nie Ty, zignoruj tę wiadomość — Twoje konto i hasło pozostają bez zmian.",
    de: "Falls du das nicht warst, ignoriere diese E-Mail — dein Konto und Passwort bleiben unverändert.",
    en: "If this wasn't you, ignore this email — your account and password stay unchanged.",
  };
  const [hl, hlAccent] = headlines[locale];

  const inner = `
    ${eyebrowBlock(eyebrows[locale])}
    ${headline(hl, hlAccent)}
    ${lead(leadTexts[locale])}
    ${body(bodyTexts[locale])}
    ${ctaButton(t(locale, "btnSignin"), escHtml(data.signinUrl))}
    ${body(`<span style="color:${C.paperDim};">${noteTexts[locale]}</span>`)}
  `;
  return shell(inner, locale);
}

// Zmiana adresu e-mail — link idzie na NOWY adres (potwierdzenie własności).
export interface EmailChangeData {
  verifyUrl: string;
  expiresHours: number;
  newEmail: string;
  customerName?: string;
}

export function emailChangeConfirmEmail(data: EmailChangeData, locale: EmailLocale = "pl"): string {
  const eyebrows: Record<EmailLocale, string> = {
    pl: "Konto · Zmiana adresu e-mail",
    de: "Konto · E-Mail-Adresse ändern",
    en: "Account · Email change",
  };
  const headlines: Record<EmailLocale, [string, string]> = {
    pl: ["Potwierdź nowy adres.", "nowy adres"],
    de: ["Neue Adresse bestätigen.", "Adresse"],
    en: ["Confirm your new address.", "new address"],
  };
  const greetings: Record<EmailLocale, string> = {
    pl: data.customerName ? `Cześć ${strongName(data.customerName)}!` : "Cześć!",
    de: data.customerName ? `Hallo ${strongName(data.customerName)}!` : "Hallo!",
    en: data.customerName ? `Hi ${strongName(data.customerName)}!` : "Hi!",
  };
  const addr = strongItem(data.newEmail);
  const exp = expiryBadge(`${data.expiresHours} h`);
  const leadTexts: Record<EmailLocale, string> = {
    pl: `${greetings.pl} Poproszono o zmianę adresu e-mail konta KalkMate na ${addr}. Zmiana nastąpi dopiero po kliknięciu przycisku poniżej. Link wygasa za ${exp}.`,
    de: `${greetings.de} Es wurde angefragt, die E-Mail-Adresse deines KalkMate-Kontos auf ${addr} zu ändern. Die Änderung erfolgt erst, wenn du auf den Button unten klickst. Der Link läuft in ${exp} ab.`,
    en: `${greetings.en} A request was made to change your KalkMate account email to ${addr}. The change only happens after you click the button below. The link expires in ${exp}.`,
  };
  const noteTexts: Record<EmailLocale, string> = {
    pl: "Po potwierdzeniu logujesz się nowym adresem. Jeśli to nie Ty prosiłeś(-aś) o zmianę, zignoruj tę wiadomość — adres pozostanie bez zmian.",
    de: "Nach der Bestätigung meldest du dich mit der neuen Adresse an. Falls du die Änderung nicht angefragt hast, ignoriere diese E-Mail — die Adresse bleibt unverändert.",
    en: "After confirming, you sign in with the new address. If you didn't request this change, ignore this email — the address will stay the same.",
  };
  const [hl, hlAccent] = headlines[locale];

  const inner = `
    ${eyebrowBlock(eyebrows[locale])}
    ${headline(hl, hlAccent)}
    ${lead(leadTexts[locale])}

    ${ctaButton(t(locale, "btnConfirmChange"), escHtml(data.verifyUrl))}

    ${linkFallback(locale, data.verifyUrl)}

    ${body(`<span style="color:${C.paperDim};">${noteTexts[locale]}</span>`)}
  `;
  return shell(inner, locale);
}

// Powiadomienie na STARY adres przy prośbie o zmianę e-maila — właściciel
// konta dowiaduje się o zmianie, nawet jeśli nie on o nią prosił.
export interface EmailChangeNoticeData {
  newEmailMasked: string; // np. "j***@gmail.com"
  customerName?: string;
}

export function emailChangeNoticeEmail(data: EmailChangeNoticeData, locale: EmailLocale = "pl"): string {
  const eyebrows: Record<EmailLocale, string> = {
    pl: "Konto · Bezpieczeństwo",
    de: "Konto · Sicherheit",
    en: "Account · Security",
  };
  const headlines: Record<EmailLocale, [string, string]> = {
    pl: ["Prośba o zmianę adresu.", "zmianę adresu"],
    de: ["Adressänderung angefragt.", "Adressänderung"],
    en: ["Email change requested.", "Email change"],
  };
  const greetings: Record<EmailLocale, string> = {
    pl: data.customerName ? `Cześć ${strongName(data.customerName)}!` : "Cześć!",
    de: data.customerName ? `Hallo ${strongName(data.customerName)}!` : "Hallo!",
    en: data.customerName ? `Hi ${strongName(data.customerName)}!` : "Hi!",
  };
  const addr = strongItem(data.newEmailMasked);
  const mailLink = `<a href="mailto:kontakt@kalkmate.pl" style="color:${C.signal};text-decoration:underline;font-weight:600;">kontakt@kalkmate.pl</a>`;
  const leadTexts: Record<EmailLocale, string> = {
    pl: `${greetings.pl} W Twoim koncie KalkMate poproszono o zmianę adresu e-mail na ${addr}. Zmiana nastąpi dopiero po potwierdzeniu linkiem wysłanym na nowy adres.`,
    de: `${greetings.de} In deinem KalkMate-Konto wurde eine Änderung der E-Mail-Adresse auf ${addr} angefragt. Sie wird erst wirksam, nachdem der Link an die neue Adresse bestätigt wurde.`,
    en: `${greetings.en} A request was made in your KalkMate account to change the email address to ${addr}. It only takes effect after the link sent to the new address is confirmed.`,
  };
  const noteTexts: Record<EmailLocale, string> = {
    pl: `Jeśli to nie Ty — natychmiast zmień hasło w panelu i napisz do nas: ${mailLink}.`,
    de: `Falls du das nicht warst, ändere sofort dein Passwort im Kundenkonto und schreib uns an ${mailLink}.`,
    en: `If this wasn't you, change your password in the panel right away and contact us at ${mailLink}.`,
  };
  const [hl, hlAccent] = headlines[locale];

  const inner = `
    ${eyebrowBlock(eyebrows[locale])}
    ${headline(hl, hlAccent)}
    ${lead(leadTexts[locale])}
    ${body(noteTexts[locale])}
  `;
  return shell(inner, locale);
}

// Potwierdzenie przyjęcia reklamacji (formularz /reklamacja → /api/contact).
// Tylko PL — formularz jest po polsku. Treść od klienta ograniczona do minimum
// (numer zamówienia, żądanie z listy), żeby formularza nie dało się użyć do
// wysyłania dowolnych treści na cudze adresy z naszej domeny.
export interface ComplaintAckData {
  ticket: string;        // numer zgłoszenia, np. RK-20261016-7K3QX
  receivedAt: string;    // sformatowana data przyjęcia
  deadline: string;      // sformatowana data, do której odpowiemy (14 dni)
  orderNumber?: string;
  demand?: string;       // żądanie (tylko wartość z listy w formularzu)
}

export const COMPLAINT_ACK_SUBJECT = (ticket: string) => `Przyjęliśmy reklamację ${ticket} – KalkMate`;

export function complaintAckEmail(d: ComplaintAckData): string {
  const rows =
    infoRow("Numer zgłoszenia", `<strong style="color:${C.signal};font-family:${FONT_MONO};">${escHtml(d.ticket)}</strong>`) +
    infoRow("Data przyjęcia", escHtml(d.receivedAt)) +
    infoRow("Odpowiemy do", escHtml(d.deadline)) +
    (d.orderNumber ? infoRow("Zamówienie", escHtml(d.orderNumber)) : "") +
    (d.demand ? infoRow("Żądanie", escHtml(d.demand)) : "");
  const inner = `
    ${eyebrowBlock("Reklamacja · Potwierdzenie")}
    ${headline("Przyjęliśmy zgłoszenie.", "zgłoszenie")}
    ${lead("Dziękujemy — Twoja reklamacja dotarła do nas. Rozpatrzymy ją i odpowiemy na ten adres e-mail najpóźniej w ciągu 14 dni kalendarzowych od daty przyjęcia (art. 7a ustawy o prawach konsumenta).")}
    ${infoTable(rows)}
    ${body("Zdjęcia lub nagranie wady możesz dosłać w odpowiedzi na tę wiadomość — podaj w niej numer zgłoszenia.")}
    ${body(`<span style="color:${C.paperDim};">Jeśli to nie Ty wysyłałeś(-aś) zgłoszenie, zignoruj tę wiadomość albo napisz do nas na kontakt@kalkmate.pl.</span>`)}
  `;
  return shell(inner, "pl", { footerLabel: "Wiadomość automatyczna" });
}

// ---------------------------------------------------------------------------
// Tematy maili (subject lines) — używane bezpośrednio w routes
// ---------------------------------------------------------------------------
export const EMAIL_SUBJECTS = {
  verify: {
    pl: "Potwierdź adres e-mail – KalkMate",
    de: "E-Mail-Adresse bestätigen – KalkMate",
    en: "Confirm your email – KalkMate",
  },
  passwordReset: {
    pl: "Reset hasła – KalkMate",
    de: "Passwort zurücksetzen – KalkMate",
    en: "Password reset – KalkMate",
  },
  accountExists: {
    pl: "Próba założenia konta na Twój adres – KalkMate",
    de: "Registrierungsversuch mit deiner Adresse – KalkMate",
    en: "Sign-up attempt with your email – KalkMate",
  },
  emailChange: {
    pl: "Potwierdź zmianę adresu e-mail – KalkMate",
    de: "Änderung der E-Mail-Adresse bestätigen – KalkMate",
    en: "Confirm your email change – KalkMate",
  },
  emailChangeNotice: {
    pl: "Prośba o zmianę adresu e-mail konta – KalkMate",
    de: "Änderung der Konto-E-Mail angefragt – KalkMate",
    en: "Account email change requested – KalkMate",
  },
  orderInProgress: {
    pl: "Twoje zamówienie jest w realizacji – KalkMate",
    de: "Deine Bestellung wird bearbeitet – KalkMate",
    en: "Your order is being processed – KalkMate",
  },
  orderLabelCreated: {
    pl: "Pakujemy i wysyłamy Twoje zamówienie – KalkMate",
    de: "Deine Bestellung wird verpackt und verschickt – KalkMate",
    en: "We're packing and shipping your order – KalkMate",
  },
  orderShipped: {
    pl: "Twoja paczka została wysłana! – KalkMate",
    de: "Dein Paket wurde verschickt! – KalkMate",
    en: "Your package has been shipped! – KalkMate",
  },
  orderFulfilled: {
    pl: "Zamówienie zrealizowane – KalkMate",
    de: "Bestellung abgeschlossen – KalkMate",
    en: "Order completed – KalkMate",
  },
  orderCancelled: {
    pl: "Twoje zamówienie zostało anulowane – KalkMate",
    de: "Deine Bestellung wurde storniert – KalkMate",
    en: "Your order has been cancelled – KalkMate",
  },
  orderConfirmation: {
    pl: "Potwierdzenie zamówienia – KalkMate",
    de: "Bestellbestätigung – KalkMate",
    en: "Order confirmation – KalkMate",
  },
} satisfies Record<string, Record<EmailLocale, string>>;

// ---------------------------------------------------------------------------
// Alert dla admina (blokada logowania do panelu admina)
// ---------------------------------------------------------------------------
export interface AdminLockoutData {
  failures: number;
  windowMinutes: number;
  lockMinutes: number;
  ips: string[];
  at: string;
}

export function adminLockoutAlertEmail(d: AdminLockoutData): string {
  const rows =
    infoRow("Nieudane próby", escHtml(String(d.failures))) +
    infoRow("Okno", `${escHtml(String(d.windowMinutes))} min`) +
    infoRow("Blokada", `${escHtml(String(d.lockMinutes))} min`) +
    infoRow("Czas", escHtml(d.at)) +
    infoRow("Adresy IP", `<span style="font-family:${FONT_MONO};font-size:12px;">${d.ips.slice(0, 20).map(escHtml).join("<br>") || "-"}</span>`);
  const inner = `
    ${eyebrowBlock("Admin · Alert bezpieczeństwa")}
    ${headline("Blokada logowania admina.", "Blokada")}
    ${lead("Wykryto serię nieudanych prób logowania do panelu admina (kod TOTP / hasło). Logowanie do panelu zostało czasowo zablokowane dla wszystkich adresów IP. Istniejące sesje działają dalej.")}
    ${infoTable(rows)}
    ${body("Jeśli to nie Ty — rozważ rotację ADMIN_2FA_SECRET i wylogowanie pozostałych sesji (panel admina → sesje → wyloguj inne).")}
  `;
  return shell(inner, "pl", { footerLabel: "Alert systemowy" });
}

// ---------------------------------------------------------------------------
// Newsletter (/admin/newsletter)
// ---------------------------------------------------------------------------
// Tresc pisana w panelu prostym formatowaniem (jak w komunikatorze):
//   pusta linia = nowy akapit, "## " = srodtytul, "- " = lista,
//   **pogrubienie**, *kursywa*, [tekst](https://link), golé https://linki.
// Wszystko jest najpierw escapowane (escHtml, na górze pliku) — admin nie
// wkleja surowego HTML.

function inlineFormat(escaped: string): string {
  const link = `color:${C.signal};text-decoration:underline;font-weight:600;`;
  return escaped
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, text, url) => `<a href="${url}" style="${link}">${text}</a>`)
    .replace(/(^|[\s(])(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, (_m, pre, url) => `${pre}<a href="${url}" style="${link}">${url}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, `<strong style="color:${C.paper};font-weight:700;">$1</strong>`)
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, `$1<em>$2</em>`);
}

export function newsletterBodyHtml(text: string): string {
  const blocks = text.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  return blocks
    .map((block) => {
      const lines = block.split("\n");
      if (lines[0].startsWith("## ")) {
        const rest = lines.slice(1).join("\n").trim();
        const h = `<h2 style="margin:22px 0 10px 0;font-family:${FONT_BODY};font-weight:800;font-size:20px;line-height:1.25;color:${C.paper};letter-spacing:-0.3px;">${inlineFormat(escHtml(lines[0].slice(3).trim()))}</h2>`;
        return rest ? h + newsletterBodyHtml(rest) : h;
      }
      if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
        const items = lines
          .map((l) => `<li style="margin:0 0 6px 0;">${inlineFormat(escHtml(l.replace(/^\s*[-•]\s+/, "")))}</li>`)
          .join("");
        return `<ul style="margin:0 0 14px 0;padding-left:20px;font-family:${FONT_BODY};font-size:15px;line-height:1.6;color:${C.paperSub};">${items}</ul>`;
      }
      return `<p style="margin:0 0 14px 0;font-family:${FONT_BODY};font-size:15px;line-height:1.65;color:${C.paperSub};">${lines
        .map((l) => inlineFormat(escHtml(l)))
        .join("<br>")}</p>`;
    })
    .join("");
}

export interface NewsletterContent {
  eyebrow?: string;      // maly napis nad tytulem, np. "Nowosc"
  title: string;         // duzy naglowek
  preheader?: string;    // podglad w skrzynce (szary tekst obok tematu)
  body: string;          // tresc w prostym formatowaniu (patrz wyzej)
  imageSrc?: string;     // "cid:..." przy wysylce, data:/blob: URL w podgladzie
  ctaText?: string;
  ctaUrl?: string;
  unsubscribeUrl: string;
  lang?: "pl" | "en" | "de";
  // Podstawa wysyłki pokazywana w stopce. "consent" (domyślnie) = zgoda
  // marketingowa (newsletter); "service" = informacja serwisowa o produkcie,
  // który odbiorca ma (bez reklamy) — tylko gdy wysyłka idzie też do osób bez zgody.
  reason?: "consent" | "service";
}

// Audyt 2026-10-16: stopka podawała jako powód wysyłki "masz konto lub
// zamówienie" — to nie jest podstawa do wysyłania newslettera (art. 398 PKE
// wymaga zgody). Newsletter idzie wyłącznie do osób ze zgodą, więc stopka
// mówi o zgodzie; wariant "service" zostaje dla komunikatów serwisowych.
const NEWSLETTER_FOOTER: Record<"pl" | "en" | "de", { why: string; whyService: string; unsub: string }> = {
  pl: {
    why: "Dostajesz tę wiadomość, bo zapisałeś(-aś) się na newsletter KalkMate (zgoda na informacje handlowe). Zgodę możesz wycofać w każdej chwili.",
    whyService: "To wiadomość serwisowa o produkcie lub usłudze KalkMate, z której korzystasz.",
    unsub: "Wypisz się z newslettera",
  },
  en: {
    why: "You are receiving this because you subscribed to the KalkMate newsletter (marketing consent). You can withdraw your consent at any time.",
    whyService: "This is a service message about a KalkMate product or service you use.",
    unsub: "Unsubscribe",
  },
  de: {
    why: "Sie erhalten diese Nachricht, weil Sie dem Empfang des KalkMate-Newsletters zugestimmt haben. Sie können Ihre Einwilligung jederzeit widerrufen.",
    whyService: "Dies ist eine Servicemitteilung zu einem KalkMate-Produkt oder -Dienst, den Sie nutzen.",
    unsub: "Abmelden",
  },
};

export function newsletterEmail(c: NewsletterContent): string {
  const lang = c.lang || "pl";
  const f = NEWSLETTER_FOOTER[lang];
  const why = c.reason === "service" ? f.whyService : f.why;
  const preheader = c.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escHtml(c.preheader)}</div>`
    : "";
  const image = c.imageSrc
    ? `<img src="${escHtml(c.imageSrc)}" alt="" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;margin:0 0 22px 0;border-radius:4px;">`
    : "";
  const cta = c.ctaText && c.ctaUrl && /^https?:\/\//.test(c.ctaUrl) ? ctaButton(escHtml(c.ctaText), escHtml(c.ctaUrl)) : "";
  const inner = `${preheader}
    ${c.eyebrow ? eyebrowBlock(escHtml(c.eyebrow)) : ""}
    ${image}
    ${c.title ? headline(escHtml(c.title)) : ""}
    ${newsletterBodyHtml(c.body)}
    ${cta}`;

  return shell(inner, lang === "de" ? "de" : "en", {
    htmlLang: lang,
    footerLabel: "Newsletter",
    footerExtraHtml: `
        <div style="font-family:${FONT_BODY};font-size:11.5px;color:${C.paperDim};margin-top:8px;line-height:1.5;">${why}<br>
          <a href="${escHtml(c.unsubscribeUrl)}" style="color:${C.paperSub};text-decoration:underline;">${f.unsub}</a>
        </div>`,
  });
}

// ---------------------------------------------------------------------------
// Przypomnienie o niedokonczonej platnosci (P24, klienci z Polski)
// ---------------------------------------------------------------------------
export interface PaymentReminderData {
  customerName: string;
  orderNumber: string;
  amount: string;        // sformatowana kwota, np. "699 zł"
  pickupPoint?: string;  // paczkomat (PL)
  resumeUrl: string;
  cancelAfterDays: number;
  quantity?: number;     // ile sztuk (brak = 1)
}

export const PAYMENT_REMINDER_SUBJECT = (orderNumber: string) => `Dokończ płatność za zamówienie ${orderNumber} – KalkMate`;

export function paymentReminderEmail(d: PaymentReminderData): string {
  const first = escHtml((d.customerName || "").trim().split(/\s+/)[0] || "");
  const rows =
    infoRow("Zamówienie", escHtml(d.orderNumber)) +
    infoRow("Produkt", `KalkMate v3.0${Number.isInteger(d.quantity) && (d.quantity as number) > 1 ? ` &times;&nbsp;${d.quantity}` : ""}`) +
    infoRow("Do zapłaty", escHtml(d.amount)) +
    (d.pickupPoint ? infoRow("Paczkomat", escHtml(d.pickupPoint)) : "");
  const inner = `
    ${eyebrowBlock("Płatność niedokończona")}
    ${headline("Twój KalkMate czeka.", "czeka")}
    ${lead(`${first ? `Cześć <strong style="color:${C.paper};font-weight:700;">${first}</strong>! ` : ""}Zamówienie zostało złożone, ale płatność nie została dokończona — np. przerwana transakcja BLIK albo zamknięta strona banku. Zamówienie wciąż czeka, dane i personalizacja są zapisane.`)}
    ${infoTable(rows)}
    ${ctaButton("Dokończ płatność", escHtml(d.resumeUrl))}
    ${body(`Link otwiera płatność Przelewy24 (BLIK, przelew, karta) dla tego samego zamówienia — nie trzeba niczego wypełniać od nowa.`)}
    ${body(`Jeśli płatność jest już zrobiona, zignoruj tę wiadomość — potwierdzenie przyjdzie osobnym mailem. Jeśli rezygnujesz, nic nie musisz robić: nieopłacone zamówienie anulujemy automatycznie po ${d.cancelAfterDays} dniach. Problem z płatnością? Odpisz na tego maila.`)}
  `;
  return shell(inner, "en", { htmlLang: "pl", footerLabel: "Wiadomość automatyczna" });
}
