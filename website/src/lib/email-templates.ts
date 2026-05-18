// Email szablony — CIEMNY motyw, wymuszony przez color-scheme:dark + solid colors.
//
// Klucze techniczne:
//  - meta color-scheme="dark" + supported-color-schemes="dark" - klient
//    pocztowy NIE forsuje inwersji do light mode
//  - WSZYSTKIE kolory SOLID (bez rgba/opacity). Gmail mobile w light mode
//    interpretuje rgba na czarnym tle jako jasne na bialym, znika.
//  - Wysoki kontrast: #F2EDE3 (cream) na #0B0B0B (ink) = 14:1 contrast ratio.
//  - Brand: signal #D8FF3D na buttonach/badge, "Mate" italic accent.

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

const C = {
  ink:      "#0B0B0B",   // background outer
  card:     "#141414",   // card (lekko jasniejsza czern dla separacji)
  cardLine: "#2A2A2A",   // border karty
  paper:    "#F2EDE3",   // main text (cream)
  paperSub: "#9C9890",   // muted text (jasna szarosc - SOLID, nie rgba)
  paperDim: "#6B6863",   // captions
  signal:   "#D8FF3D",   // brand accent
  signalDark: "#1A1F08", // ciemne tlo pod signal (np. inside info box)
};

const FONT_BODY = `'Inter','Segoe UI',Roboto,-apple-system,BlinkMacSystemFont,sans-serif`;
const FONT_MONO = `'JetBrains Mono','Fira Code',Consolas,Monaco,monospace`;

// Brand
function brandHtml(size = 24): string {
  return `<span style="font-family:${FONT_BODY};font-weight:800;font-size:${size}px;letter-spacing:-0.5px;color:${C.paper};">Kalk<em style="color:${C.signal};font-style:italic;font-weight:800;">Mate</em></span>`;
}

function eyebrowHtml(text: string, color: string = C.signal): string {
  return `<span style="font-family:${FONT_MONO};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${color};font-weight:700;">${text}</span>`;
}

function shell(inner: string): string {
  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark only">
<meta name="supported-color-schemes" content="dark only">
<title>KalkMate</title>
<style>
  :root { color-scheme: dark; }
  @media (prefers-color-scheme: light) {
    /* w light mode klienty same nas zostawia jak deklarujemy color-scheme dark only */
  }
  /* Outlook.com dark mode mapping */
  [data-ogsc] body, [data-ogsb] body { background:${C.ink} !important; }
</style>
</head>
<body style="margin:0;padding:0;background:${C.ink};color:${C.paper};font-family:${FONT_BODY};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.ink}" style="background:${C.ink};">
  <tr><td align="center" style="padding:32px 16px;background:${C.ink};">

    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:${C.ink};">

      <!-- Header bar -->
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

      <!-- Main card -->
      <tr><td bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.cardLine};padding:36px 32px;">
        ${inner}
      </td></tr>

      <!-- Signal accent stripe -->
      <tr><td bgcolor="${C.signal}" style="height:3px;background:${C.signal};line-height:3px;font-size:0;">&nbsp;</td></tr>

      <!-- Footer -->
      <tr><td style="padding:24px 4px 0 4px;text-align:center;background:${C.ink};">
        <div style="font-family:${FONT_MONO};font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:${C.paperDim};">
          KalkMate &middot; Wiadomosc automatyczna
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

// ---------------------------------------------------------------------
// Szablony
// ---------------------------------------------------------------------

export function purchaseConfirmationEmail(data: OrderData): string {
  const inner = `
    ${eyebrowBlock("Zamowienie &middot; Potwierdzenie")}
    ${headline("Dzieki za zakup.", "zakup")}
    ${lead(`Czesc <strong style="color:${C.paper};font-weight:700;">${data.customerName}</strong>, Twoje zamowienie zostalo przyjete. Ponizej szczegoly.`)}

    ${infoTable([
      infoRow("Produkt", `<strong style="color:${C.paper};font-weight:600;">${data.product}</strong>`),
      infoRow("Kwota", `<strong style="color:${C.signal};font-family:${FONT_MONO};font-size:15px;">${(data.amount / 100).toFixed(2)} zl</strong>`),
      infoRow("Paczkomat", data.pickupPoint),
      infoRow("Adres", `<span style="font-size:13px;color:${C.paperSub};">${data.pickupPointAddress}</span>`),
      infoRow("Status", statusBadge("Oplacone")),
    ].join(""))}

    ${body("Damy znac jak tylko paczka zostanie nadana. Mozesz sledzic status w panelu klienta.")}

    ${ctaButton("Otworz panel", "https://kalkmate.pl/panel")}

    <p style="margin:24px 0 0 0;font-family:${FONT_MONO};font-size:10px;letter-spacing:0.15em;color:${C.paperDim};text-transform:uppercase;text-align:center;">ID zamowienia: <span style="color:${C.paper};font-weight:600;">${data.orderId}</span></p>
  `;
  return shell(inner);
}

export function statusInProgressEmail(data: FulfillmentData): string {
  const inner = `
    ${eyebrowBlock("Status &middot; Aktualizacja")}
    ${headline("Pakujemy.", "Pakujemy")}
    ${lead(`Czesc <strong style="color:${C.paper};font-weight:700;">${data.customerName}</strong>, Twoje zamowienie <strong style="color:${C.paper};font-weight:600;">${data.product}</strong> jest w trakcie realizacji.`)}

    ${infoTable([
      infoRow("Status", statusBadge("W trakcie")),
      infoRow("Paczkomat", data.pickupPoint),
    ].join(""))}

    ${body("Powiadomimy Cie ponownie, gdy paczka zostanie nadana z numerem przesylki InPost.")}

    ${ctaButton("Otworz panel", "https://kalkmate.pl/panel")}
  `;
  return shell(inner);
}

export function statusShippedEmail(data: FulfillmentData): string {
  const trackingRow = data.trackingNumber
    ? infoRow("Nr przesylki", `<strong style="color:${C.ink};font-family:${FONT_MONO};font-size:13px;background:${C.signal};padding:2px 6px;border-radius:2px;">${data.trackingNumber}</strong>`)
    : "";

  const inner = `
    ${eyebrowBlock("Status &middot; Wysyłka")}
    ${headline("W drodze.", "drodze")}
    ${lead(`Czesc <strong style="color:${C.paper};font-weight:700;">${data.customerName}</strong>, Twoja paczka <strong style="color:${C.paper};font-weight:600;">${data.product}</strong> zostala nadana.`)}

    ${infoTable([
      infoRow("Status", statusBadge("Wyslane")),
      trackingRow,
      infoRow("Paczkomat", data.pickupPoint),
      infoRow("Adres", `<span style="font-size:13px;color:${C.paperSub};">${data.pickupPointAddress}</span>`),
    ].join(""))}

    ${data.trackingNumber ? body(`Sledz przesylke na <a href="https://inpost.pl" style="color:${C.signal};text-decoration:underline;font-weight:600;">inpost.pl</a> wpisujac numer.`) : ""}
    ${body(`Odbierz paczke z paczkomatu <strong style="color:${C.paper};font-weight:600;">${data.pickupPoint}</strong> po otrzymaniu SMS z kodem.`)}

    ${data.trackingNumber ? ctaButton("Sledz paczke", `https://inpost.pl/sledzenie-przesylek?number=${data.trackingNumber}`) : ""}
  `;
  return shell(inner);
}

export function statusFulfilledEmail(data: FulfillmentData): string {
  const mailLink = `<a href="mailto:kontakt@kalkmate.pl" style="color:${C.signal};text-decoration:underline;font-weight:600;">kontakt@kalkmate.pl</a>`;
  const inner = `
    ${eyebrowBlock("Status &middot; Zrealizowane")}
    ${headline("Gotowe.", "Gotowe")}
    ${lead(`Czesc <strong style="color:${C.paper};font-weight:700;">${data.customerName}</strong>, Twoje zamowienie <strong style="color:${C.paper};font-weight:600;">${data.product}</strong> zostalo zrealizowane.`)}

    ${infoTable([
      infoRow("Status", statusBadge("Zrealizowane")),
    ].join(""))}

    ${body(`Dzieki za zakup. Jezeli masz pytania, napisz na ${mailLink}.`)}

    ${ctaButton("Otworz panel", "https://kalkmate.pl/panel")}
  `;
  return shell(inner);
}

export function verificationEmail(data: VerificationData): string {
  const greeting = data.customerName
    ? `Czesc <strong style="color:${C.paper};font-weight:700;">${data.customerName}</strong>!`
    : "Czesc!";

  const inner = `
    ${eyebrowBlock("Konto &middot; Weryfikacja email")}
    ${headline("Potwierdz adres.", "Potwierdz")}
    ${lead(`${greeting} Dziekujemy za rejestracje w KalkMate. Aby aktywowac konto, kliknij przycisk ponizej. Link wygasa za <strong style="color:${C.ink};font-family:${FONT_MONO};background:${C.signal};padding:2px 6px;border-radius:2px;">${data.expiresHours} h</strong>.`)}

    ${ctaButton("Potwierdz email", data.verifyUrl)}

    <p style="margin:24px 0 8px 0;font-family:${FONT_MONO};font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:${C.paperDim};font-weight:600;">Lub link:</p>
    <p style="margin:0;padding:14px;background:${C.signalDark};border:1px solid ${C.cardLine};border-left:3px solid ${C.signal};font-family:${FONT_MONO};font-size:11.5px;color:${C.signal};word-break:break-all;">${data.verifyUrl}</p>

    ${body(`<span style="color:${C.paperDim};">Bez weryfikacji nie zalogujesz sie ani nie zlozysz zamowienia. Jezeli to nie Ty zakladales(as) konto, zignoruj tego maila.</span>`)}
  `;
  return shell(inner);
}

export function passwordResetEmail(data: PasswordResetData): string {
  const inner = `
    ${eyebrowBlock("Konto &middot; Reset hasła")}
    ${headline("Reset hasla.", "Reset")}
    ${lead(`Ktos (mam nadzieje ze Ty) poprosil o zresetowanie hasla do konta KalkMate. Aby ustawic nowe haslo, kliknij ponizszy przycisk. Link wygasa za <strong style="color:${C.ink};font-family:${FONT_MONO};background:${C.signal};padding:2px 6px;border-radius:2px;">${data.expiresMinutes} minut</strong>.`)}

    ${ctaButton("Ustaw nowe haslo", data.resetUrl)}

    <p style="margin:24px 0 8px 0;font-family:${FONT_MONO};font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:${C.paperDim};font-weight:600;">Lub link:</p>
    <p style="margin:0;padding:14px;background:${C.signalDark};border:1px solid ${C.cardLine};border-left:3px solid ${C.signal};font-family:${FONT_MONO};font-size:11.5px;color:${C.signal};word-break:break-all;">${data.resetUrl}</p>

    ${body(`<span style="color:${C.paperDim};">Jezeli to nie Ty wyslales(as) ta prosbe, zignoruj tego maila. Twoje haslo nie zostanie zmienione.</span>`)}
  `;
  return shell(inner);
}
