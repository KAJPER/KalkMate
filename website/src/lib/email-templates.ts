// Email szablony — ciemny motyw + lokalizacja we wszystkich językach strony
// (pl | en | de | cs | sk | lt | be | es | pt | fr | it — patrz lib/i18n.ts).
//
// Lokalizacja:
//   "pl" — domyślne (główny rynek; Accept-Language: pl*, brak dopasowania, country=PL/brak)
//   Maile auth (rejestracja, reset hasła, zmiana e-maila): język przeglądarki
//     (Accept-Language) — pierwszy obsługiwany; "be" (białoruski) tylko stąd.
//   Maile zamówień: kraj wysyłki — DE→de, CZ→cs, SK→sk, LT→lt, ES→es, PT→pt,
//     FR/BE/LU→fr, IT→it, pozostałe kraje → en. Białoruś nie jest krajem wysyłki.
//
// Pomocniki do wykrywania:
//   detectLocale(acceptLanguageHeader)  — dla maili auth (request header)
//   localeFromCountry(countryCode)      — dla maili zamówień (Stripe metadata)
//
// WSZYSTKIE dane od klienta/użytkownika (imię, adres, paczkomat, notatki…)
// wstawiamy przez escHtml() — wcześniej imię z formularza zamówienia trafiało
// do HTML maila surowo (audyt 2026-10-16: wstrzykiwanie linków/HTML w mailach
// wysyłanych z naszej domeny).

import { locales, type Locale } from "@/lib/i18n";

export type EmailLocale = Locale;
export const EMAIL_LOCALES: readonly EmailLocale[] = locales;

function isEmailLocale(v: string): v is EmailLocale {
  return (EMAIL_LOCALES as readonly string[]).includes(v);
}

export function detectLocale(acceptLanguage: string | null | undefined): EmailLocale {
  if (typeof acceptLanguage !== "string") return "pl";
  // Kolejność w nagłówku = kolejność preferencji przeglądarki. Bierzemy pierwszy
  // język, który obsługujemy; nic nie pasuje → polski (główny rynek).
  for (const part of acceptLanguage.split(",")) {
    const primary = part.split(";")[0].trim().toLowerCase().split(/[-_]/)[0];
    if (isEmailLocale(primary)) return primary;
  }
  return "pl";
}

// Kraj wysyłki -> język maila. Białoruś (BY) celowo pominięta — nie jest
// krajem wysyłki; "be" wybieramy tylko na podstawie przeglądarki.
const COUNTRY_LOCALE: Record<string, EmailLocale> = {
  PL: "pl",
  DE: "de",
  CZ: "cs",
  SK: "sk",
  LT: "lt",
  ES: "es",
  PT: "pt",
  FR: "fr",
  BE: "fr", // Belgia
  LU: "fr",
  IT: "it",
};

export function localeFromCountry(country: string | null | undefined): EmailLocale {
  // Brak kraju = stare/krajowe zamówienie (reszta kodu traktuje je jako PL).
  const c = (country || "PL").toUpperCase();
  return COUNTRY_LOCALE[c] ?? "en";
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
  hasAccount?: boolean;     // false = zakup jako gosc (brak = ma konto)
}
interface FulfillmentData {
  customerName: string;
  product: string;
  trackingNumber?: string;
  pickupPoint: string;       // niepusty = paczkomat; pusty = kurier pod drzwi
  pickupPointAddress: string;
  carrierName?: string | null;   // nazwa przewoznika do wyswietlenia (InPost, DPD, UPS, GLS…); null = nieznany
  trackUrl?: string | null;      // pelny link sledzenia tej paczki; null = brak; undefined = stary caller
  deliveryAddress?: string;      // "ulica, kod miasto, kraj" dla kuriera ("" przy paczkomacie)
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
  cs: {
    footerAuto:       "Automatická zpráva",
    badgePaid:        "Zaplaceno",
    badgeInProgress:  "Zpracovává se",
    badgeShipped:     "Odesláno",
    badgeFulfilled:   "Vyřízeno",
    badgeCancelled:   "Zrušeno",
    rowProduct:       "Produkt",
    rowAmount:        "Částka",
    rowLocker:        "Výdejní box",
    rowAddress:       "Adresa",
    rowDelivery:      "Doručovací adresa",
    rowStatus:        "Stav",
    rowTracking:      "Číslo zásilky",
    btnPanel:         "Otevřít panel",
    btnVerify:        "Potvrdit e-mail",
    btnReset:         "Nastavit nové heslo",
    btnTrack:         "Sledovat zásilku",
    btnConfirmChange: "Potvrdit novou adresu",
    btnSignin:        "Přihlásit se",
    labelOr:          "Nebo odkaz:",
    labelOrderId:     "Číslo objednávky:",
  },
  sk: {
    footerAuto:       "Automatická správa",
    badgePaid:        "Zaplatené",
    badgeInProgress:  "Spracúva sa",
    badgeShipped:     "Odoslané",
    badgeFulfilled:   "Vybavené",
    badgeCancelled:   "Zrušené",
    rowProduct:       "Produkt",
    rowAmount:        "Suma",
    rowLocker:        "Výdajný box",
    rowAddress:       "Adresa",
    rowDelivery:      "Doručovacia adresa",
    rowStatus:        "Stav",
    rowTracking:      "Číslo zásielky",
    btnPanel:         "Otvoriť panel",
    btnVerify:        "Potvrdiť e-mail",
    btnReset:         "Nastaviť nové heslo",
    btnTrack:         "Sledovať zásielku",
    btnConfirmChange: "Potvrdiť novú adresu",
    btnSignin:        "Prihlásiť sa",
    labelOr:          "Alebo odkaz:",
    labelOrderId:     "Číslo objednávky:",
  },
  lt: {
    footerAuto:       "Automatinis pranešimas",
    badgePaid:        "Apmokėta",
    badgeInProgress:  "Vykdoma",
    badgeShipped:     "Išsiųsta",
    badgeFulfilled:   "Įvykdyta",
    badgeCancelled:   "Atšaukta",
    rowProduct:       "Produktas",
    rowAmount:        "Suma",
    rowLocker:        "Paštomatas",
    rowAddress:       "Adresas",
    rowDelivery:      "Pristatymo adresas",
    rowStatus:        "Būsena",
    rowTracking:      "Siuntos numeris",
    btnPanel:         "Atidaryti skydelį",
    btnVerify:        "Patvirtinti el. paštą",
    btnReset:         "Nustatyti naują slaptažodį",
    btnTrack:         "Sekti siuntą",
    btnConfirmChange: "Patvirtinti naują adresą",
    btnSignin:        "Prisijungti",
    labelOr:          "Arba nuoroda:",
    labelOrderId:     "Užsakymo numeris:",
  },
  be: {
    footerAuto:       "Аўтаматычнае паведамленне",
    badgePaid:        "Аплачана",
    badgeInProgress:  "Выконваецца",
    badgeShipped:     "Адпраўлена",
    badgeFulfilled:   "Выканана",
    badgeCancelled:   "Скасавана",
    rowProduct:       "Прадукт",
    rowAmount:        "Сума",
    rowLocker:        "Паштамат",
    rowAddress:       "Адрас",
    rowDelivery:      "Адрас дастаўкі",
    rowStatus:        "Статус",
    rowTracking:      "Нумар адпраўлення",
    btnPanel:         "Адкрыць панэль",
    btnVerify:        "Пацвердзіць e-mail",
    btnReset:         "Задаць новы пароль",
    btnTrack:         "Адсачыць пасылку",
    btnConfirmChange: "Пацвердзіць новы адрас",
    btnSignin:        "Увайсці",
    labelOr:          "Або спасылка:",
    labelOrderId:     "Нумар заказу:",
  },
  es: {
    footerAuto:       "Mensaje automático",
    badgePaid:        "Pagado",
    badgeInProgress:  "En preparación",
    badgeShipped:     "Enviado",
    badgeFulfilled:   "Completado",
    badgeCancelled:   "Cancelado",
    rowProduct:       "Producto",
    rowAmount:        "Importe",
    rowLocker:        "Punto de recogida",
    rowAddress:       "Dirección",
    rowDelivery:      "Dirección de entrega",
    rowStatus:        "Estado",
    rowTracking:      "Número de seguimiento",
    btnPanel:         "Abrir panel",
    btnVerify:        "Confirmar correo",
    btnReset:         "Crear nueva contraseña",
    btnTrack:         "Seguir envío",
    btnConfirmChange: "Confirmar nueva dirección",
    btnSignin:        "Iniciar sesión",
    labelOr:          "O usa este enlace:",
    labelOrderId:     "N.º de pedido:",
  },
  pt: {
    footerAuto:       "Mensagem automática",
    badgePaid:        "Pago",
    badgeInProgress:  "Em preparação",
    badgeShipped:     "Enviado",
    badgeFulfilled:   "Concluído",
    badgeCancelled:   "Cancelado",
    rowProduct:       "Produto",
    rowAmount:        "Valor",
    rowLocker:        "Cacifo",
    rowAddress:       "Morada",
    rowDelivery:      "Morada de entrega",
    rowStatus:        "Estado",
    rowTracking:      "Número de seguimento",
    btnPanel:         "Abrir painel",
    btnVerify:        "Confirmar e-mail",
    btnReset:         "Definir nova palavra-passe",
    btnTrack:         "Seguir encomenda",
    btnConfirmChange: "Confirmar novo endereço",
    btnSignin:        "Iniciar sessão",
    labelOr:          "Ou usa o link:",
    labelOrderId:     "N.º da encomenda:",
  },
  fr: {
    footerAuto:       "Message automatique",
    badgePaid:        "Payée",
    badgeInProgress:  "En préparation",
    badgeShipped:     "Expédiée",
    badgeFulfilled:   "Terminée",
    badgeCancelled:   "Annulée",
    rowProduct:       "Produit",
    rowAmount:        "Montant",
    rowLocker:        "Point relais",
    rowAddress:       "Adresse",
    rowDelivery:      "Adresse de livraison",
    rowStatus:        "Statut",
    rowTracking:      "Numéro de suivi",
    btnPanel:         "Ouvrir mon espace",
    btnVerify:        "Confirmer l’e-mail",
    btnReset:         "Définir un nouveau mot de passe",
    btnTrack:         "Suivre le colis",
    btnConfirmChange: "Confirmer la nouvelle adresse",
    btnSignin:        "Se connecter",
    labelOr:          "Ou le lien :",
    labelOrderId:     "N° de commande :",
  },
  it: {
    footerAuto:       "Messaggio automatico",
    badgePaid:        "Pagato",
    badgeInProgress:  "In lavorazione",
    badgeShipped:     "Spedito",
    badgeFulfilled:   "Completato",
    badgeCancelled:   "Annullato",
    rowProduct:       "Prodotto",
    rowAmount:        "Importo",
    rowLocker:        "Locker",
    rowAddress:       "Indirizzo",
    rowDelivery:      "Indirizzo di consegna",
    rowStatus:        "Stato",
    rowTracking:      "Numero di tracking",
    btnPanel:         "Apri il pannello",
    btnVerify:        "Conferma e-mail",
    btnReset:         "Imposta nuova password",
    btnTrack:         "Traccia la spedizione",
    btnConfirmChange: "Conferma il nuovo indirizzo",
    btnSignin:        "Accedi",
    labelOr:          "Oppure il link:",
    labelOrderId:     "Numero d’ordine:",
  },
};

const t = (locale: EmailLocale, key: string): string =>
  TX[locale]?.[key] ?? TX.en[key] ?? key;

// Kwota w walucie PŁATNOŚCI (klient z UK płaci w EUR, a mail jest po angielsku —
// waluty nie wolno zgadywać z języka). PLN zostaje w polskim zapisie "699.00 zł".
const INTL_LOCALE: Record<EmailLocale, string> = {
  pl: "pl-PL", en: "en-IE", de: "de-DE", cs: "cs-CZ", sk: "sk-SK", lt: "lt-LT",
  be: "be-BY", es: "es-ES", pt: "pt-PT", fr: "fr-FR", it: "it-IT",
};
export function formatMoney(cents: number, currency: string | null | undefined, locale: EmailLocale): string {
  const cur = (currency || "pln").toUpperCase();
  if (cur === "PLN") return `${(cents / 100).toFixed(2)} zł`;
  try {
    const intlLocale = INTL_LOCALE[locale] ?? "en-IE";
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
  htmlLang?: string;        // gdy <html lang> ma byc inny niz locale szablonu
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
    cs: ["Děkujeme za nákup.", "nákup"],
    sk: ["Ďakujeme za nákup.", "nákup"],
    lt: ["Ačiū už pirkinį.", "pirkinį"],
    be: ["Дзякуй за пакупку.", "пакупку"],
    es: ["Gracias por tu compra.", "compra"],
    pt: ["Obrigado pela tua compra.", "compra"],
    fr: ["Merci pour ton achat.", "achat"],
    it: ["Grazie per il tuo acquisto.", "acquisto"],
  };
  const leads: Record<EmailLocale, string> = {
    pl: `Cześć ${strongName(data.customerName)}, przyjęliśmy Twoje zamówienie. Poniżej szczegóły.`,
    de: `Hallo ${strongName(data.customerName)}, deine Bestellung wurde angenommen. Hier sind die Details.`,
    en: `Hi ${strongName(data.customerName)}, your order has been received. Here are the details.`,
    cs: `Ahoj ${strongName(data.customerName)}, tvou objednávku jsme přijali. Níže najdeš podrobnosti.`,
    sk: `Ahoj ${strongName(data.customerName)}, tvoju objednávku sme prijali. Nižšie nájdeš podrobnosti.`,
    lt: `Labas, ${strongName(data.customerName)}, tavo užsakymą gavome. Žemiau rasi išsamią informaciją.`,
    be: `Прывітанне, ${strongName(data.customerName)}! Мы прынялі твой заказ. Ніжэй — падрабязнасці.`,
    es: `Hola, ${strongName(data.customerName)}: hemos recibido tu pedido. Aquí tienes los detalles.`,
    pt: `Olá ${strongName(data.customerName)}, recebemos a tua encomenda. Seguem os detalhes.`,
    fr: `Bonjour ${strongName(data.customerName)}, nous avons bien reçu ta commande. Voici le détail.`,
    it: `Ciao ${strongName(data.customerName)}, abbiamo ricevuto il tuo ordine. Ecco i dettagli.`,
  };
  const bodies: Record<EmailLocale, string> = {
    pl: "Damy znać, gdy paczka zostanie wysłana. Status zamówienia sprawdzisz w panelu klienta.",
    de: "Wir benachrichtigen dich, sobald das Paket verschickt wird. Du kannst den Status in deinem Kundenkonto verfolgen.",
    en: "We'll let you know once the package is shipped. You can track the status in your account.",
    cs: "Jakmile balík odešleme, dáme ti vědět. Stav objednávky můžeš sledovat ve svém zákaznickém panelu.",
    sk: "Keď balík odošleme, dáme ti vedieť. Stav objednávky môžeš sledovať vo svojom zákazníckom paneli.",
    lt: "Kai siuntinį išsiųsime, pranešime. Užsakymo būseną gali sekti savo kliento skydelyje.",
    be: "Мы паведамім, калі пасылка будзе адпраўлена. Статус заказу можна сачыць у панэлі кліента.",
    es: "Te avisaremos cuando enviemos el paquete. Puedes seguir el estado del pedido en tu panel de cliente.",
    pt: "Avisamos-te quando a encomenda for enviada. Podes acompanhar o estado no teu painel de cliente.",
    fr: "Nous te préviendrons dès que le colis sera expédié. Tu peux suivre l’état de ta commande dans ton espace client.",
    it: "Ti avviseremo quando il pacco sarà spedito. Puoi seguire lo stato dell’ordine nel tuo pannello cliente.",
  };
  // Zakup jako gosc: brak panelu — zachecamy do zalozenia konta na ten sam e-mail
  // (zamowienie podepnie sie samo).
  const isGuest = data.hasAccount === false;
  const guestBodies: Record<EmailLocale, string> = {
    pl: "Damy znać mailem, gdy paczka zostanie wysłana — z numerem przesyłki. Żeby aktywować tokeny AI z kodu licencji w pudełku, załóż konto na ten sam adres e-mail — to zamówienie samo się do niego podepnie.",
    de: "Wir schicken dir eine E-Mail mit der Sendungsnummer, sobald das Paket verschickt wird. Um die KI-Tokens aus dem Lizenzcode in der Verpackung zu aktivieren, erstelle ein Konto mit derselben E-Mail-Adresse — diese Bestellung wird automatisch damit verknüpft.",
    en: "We'll email you when the package ships, with the tracking number. To activate the AI tokens from the license code in the box, create an account with this same email address — this order will be linked to it automatically.",
    cs: "Jakmile balík odešleme, pošleme ti e-mail s číslem zásilky. Pro aktivaci AI tokenů z licenčního kódu v krabičce si založ účet na stejnou e-mailovou adresu — tahle objednávka se k němu sama připojí.",
    sk: "Keď balík odošleme, pošleme ti e-mail s číslom zásielky. Na aktiváciu AI tokenov z licenčného kódu v krabičke si založ účet na rovnakú e-mailovú adresu — táto objednávka sa k nemu sama pripojí.",
    lt: "Kai siuntinį išsiųsime, atsiųsime el. laišką su siuntos numeriu. Kad aktyvuotum DI žetonus iš licencijos kodo dėžutėje, susikurk paskyrą tuo pačiu el. pašto adresu — šis užsakymas prie jos prisijungs automatiškai.",
    be: "Мы напішам табе на пошту, калі пасылка будзе адпраўлена, — з нумарам адпраўлення. Каб актываваць ШІ-токены з ліцэнзійнага кода ў каробцы, стварі акаўнт на гэты ж адрас e-mail — заказ аўтаматычна прывяжацца да яго.",
    es: "Te enviaremos un correo con el número de seguimiento cuando enviemos el paquete. Para activar los tokens de IA del código de licencia de la caja, crea una cuenta con este mismo correo: el pedido se vinculará a ella automáticamente.",
    pt: "Enviamos-te um e-mail com o número de seguimento quando a encomenda for enviada. Para ativar os tokens de IA do código de licença na caixa, cria uma conta com este mesmo e-mail — esta encomenda fica associada automaticamente.",
    fr: "Nous t’enverrons un e-mail avec le numéro de suivi dès que le colis sera expédié. Pour activer les tokens IA du code de licence dans la boîte, crée un compte avec cette même adresse e-mail : cette commande y sera rattachée automatiquement.",
    it: "Ti invieremo un’e-mail con il numero di tracciamento quando il pacco sarà spedito. Per attivare i token IA dal codice di licenza nella scatola, crea un account con questo stesso indirizzo e-mail: l’ordine verrà collegato automaticamente.",
  };
  const btnRegister: Record<EmailLocale, string> = {
    pl: "Załóż konto",
    de: "Konto erstellen",
    en: "Create account",
    cs: "Založit účet",
    sk: "Založiť účet",
    lt: "Sukurti paskyrą",
    be: "Стварыць акаўнт",
    es: "Crear cuenta",
    pt: "Criar conta",
    fr: "Créer un compte",
    it: "Crea account",
  };
  // Model tokenowy (2026-10): bez triala/subskrypcji — tokeny AI z licencji w pudelku.
  const licenseNote: Record<EmailLocale, string> = {
    pl: "W pudełku znajdziesz kod licencji — po aktywacji w panelu dostaniesz 2 mln tokenów AI na swoje konto. Tokeny nie wygasają; kolejne możesz dokupić w panelu.",
    de: "In der Verpackung findest du einen Lizenzcode — nach der Aktivierung im Kundenkonto erhältst du 2 Mio. KI-Tokens. Die Tokens verfallen nicht; weitere kannst du im Kundenkonto nachkaufen.",
    en: "Inside the box you'll find a license code — activate it in your account panel to get 2 million AI tokens. Tokens never expire; you can top up more in the panel.",
    cs: "V krabičce najdeš licenční kód — po aktivaci v panelu získáš na svůj účet 2 mil. AI tokenů. Tokeny nevyprší; další si můžeš dokoupit v panelu.",
    sk: "V krabičke nájdeš licenčný kód — po aktivácii v paneli získaš na svoj účet 2 mil. AI tokenov. Tokeny nevypršia; ďalšie si môžeš dokúpiť v paneli.",
    lt: "Dėžutėje rasi licencijos kodą — aktyvavus jį skydelyje, į savo paskyrą gausi 2 mln. DI žetonų. Žetonai nenustoja galioti; daugiau gali nusipirkti skydelyje.",
    be: "У каробцы ты знойдзеш ліцэнзійны код — пасля актывацыі ў панэлі атрымаеш на акаўнт 2 млн ШІ-токенаў. Токены не згараюць; дадатковыя можна дакупіць у панэлі.",
    es: "Dentro de la caja encontrarás un código de licencia: actívalo en tu panel y recibirás 2 millones de tokens de IA. Los tokens no caducan; puedes comprar más en el panel.",
    pt: "Dentro da caixa vais encontrar um código de licença — ativa-o no painel e recebes 2 milhões de tokens de IA. Os tokens não expiram; podes comprar mais no painel.",
    fr: "Dans la boîte, tu trouveras un code de licence : active-le dans ton espace client pour recevoir 2 millions de tokens IA. Les tokens n’expirent pas ; tu peux en racheter dans ton espace.",
    it: "Nella scatola trovi un codice di licenza: attivalo nel pannello e riceverai 2 milioni di token IA. I token non scadono; puoi acquistarne altri nel pannello.",
  };
  const eyebrows: Record<EmailLocale, string> = {
    pl: "Zamówienie · Potwierdzenie",
    de: "Bestellung · Bestätigung",
    en: "Order · Confirmation",
    cs: "Objednávka · Potvrzení",
    sk: "Objednávka · Potvrdenie",
    lt: "Užsakymas · Patvirtinimas",
    be: "Заказ · Пацвярджэнне",
    es: "Pedido · Confirmación",
    pt: "Encomenda · Confirmação",
    fr: "Commande · Confirmation",
    it: "Ordine · Conferma",
  };
  const [hl, hlAccent] = headlines[locale];

  // Wiele sztuk: "KalkMate v3.0 × 3" + lista imion na etykietach (kod AI
  // zamaskowany — nie wysylamy sekretu mailem).
  const qty = Number.isInteger(data.quantity) && (data.quantity as number) > 1 ? (data.quantity as number) : 1;
  const productHtml = strongItem(data.product) + (qty > 1 ? ` <strong style="color:${C.signal};font-family:${FONT_MONO};">&times;&nbsp;${qty}</strong>` : "");
  const labelsTitle: Record<EmailLocale, string> = { pl: "Etykiety", de: "Etiketten", en: "Labels", cs: "Štítky", sk: "Štítky", lt: "Etiketės", be: "Этыкеткі", es: "Etiquetas", pt: "Etiquetas", fr: "Étiquettes", it: "Etichette" };
  const codeWord: Record<EmailLocale, string> = { pl: "kod AI", de: "KI-Code", en: "AI code", cs: "AI kód", sk: "AI kód", lt: "DI kodas", be: "ШІ-код", es: "código IA", pt: "código IA", fr: "code IA", it: "codice IA" };
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

    ${body(isGuest ? guestBodies[locale] : bodies[locale])}
    ${body(licenseNote[locale])}
    ${isGuest
      ? ctaButton(btnRegister[locale], "https://kalkmate.pl/auth/signin?mode=register")
      : ctaButton(t(locale, "btnPanel"), "https://kalkmate.pl/panel")}

    <p style="margin:24px 0 0 0;font-family:${FONT_MONO};font-size:10px;letter-spacing:0.15em;color:${C.paperDim};text-transform:uppercase;text-align:center;">${t(locale, "labelOrderId")} <span style="color:${C.paper};font-weight:600;">${escHtml(data.orderId)}</span></p>
  `;
  return shell(inner, locale);
}

// ---------------------------------------------------------------------------
// Wysylka: przewoznik / link sledzenia / miejsce dostawy (wspolne dla maili statusu)
// ---------------------------------------------------------------------------

// Etykieta wiersza przewoznika — lokalnie, bez ruszania wspolnego slownika t()
const ROW_CARRIER: Record<EmailLocale, string> = {
  pl: "Przewoźnik",
  de: "Versanddienstleister",
  en: "Carrier",
  cs: "Dopravce",
  sk: "Prepravca",
  lt: "Vežėjas",
  be: "Перавозчык",
  es: "Transportista",
  pt: "Transportadora",
  fr: "Transporteur",
  it: "Corriere",
};

// Paczkomat (pickupPoint niepusty) -> wiersz paczkomatu (+ adres);
// kurier pod drzwi -> adres dostawy, jesli znany.
function destinationRows(data: FulfillmentData, locale: EmailLocale, withLockerAddress: boolean): string[] {
  if (data.pickupPoint) {
    return [
      infoRow(t(locale, "rowLocker"), escHtml(data.pickupPoint)),
      ...(withLockerAddress
        ? [infoRow(t(locale, "rowAddress"), `<span style="font-size:13px;color:${C.paperSub};">${escHtml(data.pickupPointAddress)}</span>`)]
        : []),
    ];
  }
  return data.deliveryAddress
    ? [infoRow(t(locale, "rowDelivery"), `<span style="font-size:13px;color:${C.paperSub};">${escHtml(data.deliveryAddress)}</span>`)]
    : [];
}

// Przewoznik + link sledzenia. trackUrl === undefined = stary caller: 24 cyfry
// traktujemy jak InPost (dawne zachowanie). null = swiadomie brak linku.
function shipmentInfo(data: FulfillmentData): { carrier: string; url: string | null } {
  const tracking = data.trackingNumber || "";
  const legacyInPost = data.trackUrl === undefined && /^\d{24}$/.test(tracking);
  const url = data.trackUrl && /^https?:\/\//i.test(data.trackUrl)
    ? data.trackUrl
    : legacyInPost ? `https://inpost.pl/sledzenie-przesylek?number=${encodeURIComponent(tracking)}` : null;
  const carrier = (data.carrierName || "").trim() || (legacyInPost ? "InPost" : "");
  return { carrier, url };
}

const carrierRow = (carrier: string, locale: EmailLocale) =>
  carrier ? infoRow(ROW_CARRIER[locale], escHtml(carrier)) : "";

export function statusInProgressEmail(data: FulfillmentData, locale: EmailLocale = "pl"): string {
  const eyebrows: Record<EmailLocale, string> = {
    pl: "Status · Aktualizacja",
    de: "Status · Aktualisierung",
    en: "Status · Update",
    cs: "Stav · Aktualizace",
    sk: "Stav · Aktualizácia",
    lt: "Būsena · Atnaujinimas",
    be: "Статус · Абнаўленне",
    es: "Estado · Actualización",
    pt: "Estado · Atualização",
    fr: "Statut · Mise à jour",
    it: "Stato · Aggiornamento",
  };
  const headlines: Record<EmailLocale, [string, string]> = {
    pl: ["Pakujemy.", "Pakujemy"],
    de: ["Wird verpackt.", "verpackt"],
    en: ["Being packed.", "packed"],
    cs: ["Balíme.", "Balíme"],
    sk: ["Balíme.", "Balíme"],
    lt: ["Pakuojame.", "Pakuojame"],
    be: ["Пакуем.", "Пакуем"],
    es: ["Lo estamos preparando.", "preparando"],
    pt: ["Estamos a embalar.", "embalar"],
    fr: ["En préparation.", "préparation"],
    it: ["Lo stiamo imballando.", "imballando"],
  };
  const leads: Record<EmailLocale, string> = {
    pl: `Cześć ${strongName(data.customerName)}, Twoje zamówienie ${strongItem(data.product)} jest w realizacji.`,
    de: `Hallo ${strongName(data.customerName)}, deine Bestellung ${strongItem(data.product)} wird bearbeitet.`,
    en: `Hi ${strongName(data.customerName)}, your order ${strongItem(data.product)} is being processed.`,
    cs: `Ahoj ${strongName(data.customerName)}, tvoje objednávka ${strongItem(data.product)} se zpracovává.`,
    sk: `Ahoj ${strongName(data.customerName)}, tvoja objednávka ${strongItem(data.product)} sa spracúva.`,
    lt: `Labas, ${strongName(data.customerName)}, tavo užsakymas ${strongItem(data.product)} vykdomas.`,
    be: `Прывітанне, ${strongName(data.customerName)}! Твой заказ ${strongItem(data.product)} выконваецца.`,
    es: `Hola, ${strongName(data.customerName)}: tu pedido ${strongItem(data.product)} está en preparación.`,
    pt: `Olá ${strongName(data.customerName)}, a tua encomenda ${strongItem(data.product)} está a ser processada.`,
    fr: `Bonjour ${strongName(data.customerName)}, ta commande ${strongItem(data.product)} est en cours de préparation.`,
    it: `Ciao ${strongName(data.customerName)}, il tuo ordine ${strongItem(data.product)} è in lavorazione.`,
  };
  const bodies: Record<EmailLocale, string> = {
    // Bez nazwy przewoznika — na tym etapie moze byc jeszcze nieznany
    pl: "Napiszemy ponownie, gdy paczka zostanie nadana — razem z numerem przesyłki.",
    de: "Wir benachrichtigen dich erneut, sobald das Paket verschickt wurde — mit der Sendungsnummer.",
    en: "We'll notify you again once the package has been shipped, with the tracking number.",
    cs: "Znovu ti napíšeme, až balík odešleme — i s číslem zásilky.",
    sk: "Znova ti napíšeme, keď balík odošleme — aj s číslom zásielky.",
    lt: "Vėl parašysime, kai siuntinys bus išsiųstas, — kartu su siuntos numeriu.",
    be: "Мы напішам зноў, калі пасылка будзе адпраўлена, — разам з нумарам адпраўлення.",
    es: "Te volveremos a escribir cuando enviemos el paquete, junto con el número de seguimiento.",
    pt: "Voltamos a escrever-te quando a encomenda for enviada, com o número de seguimento.",
    fr: "Nous t’écrirons à nouveau à l’expédition du colis, avec le numéro de suivi.",
    it: "Ti scriveremo di nuovo alla spedizione del pacco, insieme al numero di tracking.",
  };
  const [hl, hlAccent] = headlines[locale];

  const inner = `
    ${eyebrowBlock(eyebrows[locale])}
    ${headline(hl, hlAccent)}
    ${lead(leads[locale])}

    ${infoTable([
      infoRow(t(locale, "rowStatus"), statusBadge(t(locale, "badgeInProgress"))),
      ...destinationRows(data, locale, false),
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
    cs: "Stav · Odeslání",
    sk: "Stav · Odoslanie",
    lt: "Būsena · Siuntimas",
    be: "Статус · Адпраўка",
    es: "Estado · Envío",
    pt: "Estado · Envio",
    fr: "Statut · Expédition",
    it: "Stato · Spedizione",
  };
  const headlines: Record<EmailLocale, [string, string]> = {
    pl: ["Pakujemy i wysyłamy.", "wysyłamy"],
    de: ["Wird verpackt und verschickt.", "verschickt"],
    en: ["Packing and shipping.", "shipping"],
    cs: ["Balíme a odesíláme.", "odesíláme"],
    sk: ["Balíme a odosielame.", "odosielame"],
    lt: ["Pakuojame ir siunčiame.", "siunčiame"],
    be: ["Пакуем і адпраўляем.", "адпраўляем"],
    es: ["Preparando y enviando.", "enviando"],
    pt: ["A embalar e a enviar.", "enviar"],
    fr: ["Emballage et expédition.", "expédition"],
    it: ["Imballiamo e spediamo.", "spediamo"],
  };
  const leads: Record<EmailLocale, string> = {
    pl: `Cześć ${strongName(data.customerName)}, pakujemy Twoje zamówienie ${strongItem(data.product)} i nadaliśmy już przesyłkę.`,
    de: `Hallo ${strongName(data.customerName)}, wir verpacken deine Bestellung ${strongItem(data.product)} — die Sendung ist bereits angemeldet.`,
    en: `Hi ${strongName(data.customerName)}, we're packing your order ${strongItem(data.product)} and the shipment is already booked.`,
    cs: `Ahoj ${strongName(data.customerName)}, balíme tvou objednávku ${strongItem(data.product)} a zásilku už jsme podali.`,
    sk: `Ahoj ${strongName(data.customerName)}, balíme tvoju objednávku ${strongItem(data.product)} a zásielku sme už podali.`,
    lt: `Labas, ${strongName(data.customerName)}, pakuojame tavo užsakymą ${strongItem(data.product)} — siunta jau užregistruota.`,
    be: `Прывітанне, ${strongName(data.customerName)}! Мы пакуем твой заказ ${strongItem(data.product)} — адпраўленне ўжо аформлена.`,
    es: `Hola, ${strongName(data.customerName)}: estamos preparando tu pedido ${strongItem(data.product)} y el envío ya está registrado.`,
    pt: `Olá ${strongName(data.customerName)}, estamos a embalar a tua encomenda ${strongItem(data.product)} e o envio já está registado.`,
    fr: `Bonjour ${strongName(data.customerName)}, nous emballons ta commande ${strongItem(data.product)} et l’envoi est déjà enregistré.`,
    it: `Ciao ${strongName(data.customerName)}, stiamo imballando il tuo ordine ${strongItem(data.product)} e la spedizione è già registrata.`,
  };
  const bodies: Record<EmailLocale, string> = {
    pl: "Kurier odbierze paczkę w ciągu 1–2 dni roboczych. Do tego czasu śledzenie może pokazywać tylko „przesyłka utworzona” — to normalne.",
    de: "Der Kurier holt das Paket innerhalb von 1–2 Werktagen ab. Bis dahin zeigt die Sendungsverfolgung eventuell nur „Sendung erstellt“ — das ist normal.",
    en: "The courier will collect the package within 1–2 business days. Until then, tracking may only show “shipment created” — that's normal.",
    cs: "Kurýr si balík vyzvedne do 1–2 pracovních dnů. Do té doby může sledování ukazovat jen „zásilka vytvořena“ — to je normální.",
    sk: "Kuriér si balík vyzdvihne do 1–2 pracovných dní. Dovtedy môže sledovanie ukazovať len „zásielka vytvorená“ — to je normálne.",
    lt: "Kurjeris paims siuntinį per 1–2 darbo dienas. Iki tol sekimo sistema gali rodyti tik „siunta sukurta“ — tai normalu.",
    be: "Кур’ер забярэ пасылку на працягу 1–2 працоўных дзён. Да таго часу адсочванне можа паказваць толькі «адпраўленне створана» — гэта нармальна.",
    es: "El mensajero recogerá el paquete en 1–2 días laborables. Hasta entonces, el seguimiento puede mostrar solo «envío creado»; es normal.",
    pt: "A transportadora vai recolher a encomenda em 1–2 dias úteis. Até lá, o seguimento pode mostrar apenas «envio criado» — é normal.",
    fr: "Le transporteur récupérera le colis sous 1 à 2 jours ouvrés. D’ici là, le suivi peut n’afficher que « envoi créé » — c’est normal.",
    it: "Il corriere ritirerà il pacco entro 1–2 giorni lavorativi. Fino ad allora il tracking potrebbe mostrare solo «spedizione creata»: è normale.",
  };
  const [hl, hlAccent] = headlines[locale];
  const tracking = data.trackingNumber || "";
  const ship = shipmentInfo(data);

  const inner = `
    ${eyebrowBlock(eyebrows[locale])}
    ${headline(hl, hlAccent)}
    ${lead(leads[locale])}

    ${infoTable([
      infoRow(t(locale, "rowStatus"), statusBadge(t(locale, "badgeInProgress"))),
      tracking
        ? infoRow(t(locale, "rowTracking"), `<strong style="color:${C.ink};font-family:${FONT_MONO};font-size:13px;background:${C.signal};padding:2px 6px;border-radius:2px;">${escHtml(tracking)}</strong>`)
        : "",
      carrierRow(ship.carrier, locale),
      ...destinationRows(data, locale, false),
    ].join(""))}

    ${body(bodies[locale])}
    ${ship.url
      ? ctaButton(t(locale, "btnTrack"), escHtml(ship.url))
      : ctaButton(t(locale, "btnPanel"), "https://kalkmate.pl/panel")}
  `;
  return shell(inner, locale);
}

export function statusShippedEmail(data: FulfillmentData, locale: EmailLocale = "pl"): string {
  const eyebrows: Record<EmailLocale, string> = {
    pl: "Status · Wysłane",
    de: "Status · Versand",
    en: "Status · Shipped",
    cs: "Stav · Odesláno",
    sk: "Stav · Odoslané",
    lt: "Būsena · Išsiųsta",
    be: "Статус · Адпраўлена",
    es: "Estado · Enviado",
    pt: "Estado · Enviado",
    fr: "Statut · Expédiée",
    it: "Stato · Spedito",
  };
  const headlines: Record<EmailLocale, [string, string]> = {
    pl: ["W drodze.", "drodze"],
    de: ["Unterwegs.", "Unterwegs"],
    en: ["On the way.", "way"],
    cs: ["Na cestě.", "cestě"],
    sk: ["Na ceste.", "ceste"],
    lt: ["Jau kelyje.", "kelyje"],
    be: ["У дарозе.", "дарозе"],
    es: ["En camino.", "camino"],
    pt: ["A caminho.", "caminho"],
    fr: ["En route.", "route"],
    it: ["In viaggio.", "viaggio"],
  };
  const leads: Record<EmailLocale, string> = {
    pl: `Cześć ${strongName(data.customerName)}, Twoja paczka ${strongItem(data.product)} została wysłana.`,
    de: `Hallo ${strongName(data.customerName)}, dein Paket ${strongItem(data.product)} wurde verschickt.`,
    en: `Hi ${strongName(data.customerName)}, your package ${strongItem(data.product)} has been shipped.`,
    cs: `Ahoj ${strongName(data.customerName)}, tvůj balík ${strongItem(data.product)} byl odeslán.`,
    sk: `Ahoj ${strongName(data.customerName)}, tvoj balík ${strongItem(data.product)} bol odoslaný.`,
    lt: `Labas, ${strongName(data.customerName)}, tavo siuntinys ${strongItem(data.product)} išsiųstas.`,
    be: `Прывітанне, ${strongName(data.customerName)}! Твая пасылка ${strongItem(data.product)} адпраўлена.`,
    es: `Hola, ${strongName(data.customerName)}: tu paquete ${strongItem(data.product)} ya está enviado.`,
    pt: `Olá ${strongName(data.customerName)}, a tua encomenda ${strongItem(data.product)} foi enviada.`,
    fr: `Bonjour ${strongName(data.customerName)}, ton colis ${strongItem(data.product)} a été expédié.`,
    it: `Ciao ${strongName(data.customerName)}, il tuo pacco ${strongItem(data.product)} è stato spedito.`,
  };
  const ship = shipmentInfo(data);
  // Link do sledzenia u przewoznika (url juz zwalidowany w shipmentInfo)
  const trackLink = (text: string) =>
    `<a href="${escHtml(ship.url)}" style="color:${C.signal};text-decoration:underline;font-weight:600;">${escHtml(text)}</a>`;
  const c = ship.carrier;
  // Jest link: nazwa przewoznika (albo "strona przewoznika") jako link
  const trackLinkBodies: Record<EmailLocale, string> = {
    pl: c ? `Śledź przesyłkę na stronie przewoźnika ${trackLink(c)} po numerze podanym powyżej.` : `Śledź przesyłkę na ${trackLink("stronie przewoźnika")} po numerze podanym powyżej.`,
    de: c ? `Verfolge deine Sendung auf der Website von ${trackLink(c)} mit der oben angegebenen Nummer.` : `Verfolge deine Sendung auf der ${trackLink("Website des Versanddienstleisters")} mit der oben angegebenen Nummer.`,
    en: c ? `Track your shipment on the ${trackLink(c)} website using the number above.` : `Track your shipment on the ${trackLink("carrier's website")} using the number above.`,
    cs: c ? `Zásilku sleduj na webu přepravce ${trackLink(c)} podle čísla uvedeného výše.` : `Zásilku sleduj na ${trackLink("webu přepravce")} podle čísla uvedeného výše.`,
    sk: c ? `Zásielku sleduj na webe prepravcu ${trackLink(c)} podľa čísla uvedeného vyššie.` : `Zásielku sleduj na ${trackLink("webe prepravcu")} podľa čísla uvedeného vyššie.`,
    lt: c ? `Siuntą sek vežėjo ${trackLink(c)} svetainėje pagal aukščiau nurodytą numerį.` : `Siuntą sek ${trackLink("vežėjo svetainėje")} pagal aukščiau nurodytą numerį.`,
    be: c ? `Адсочвай пасылку на сайце перавозчыка ${trackLink(c)} па нумары, пазначаным вышэй.` : `Адсочвай пасылку на ${trackLink("сайце перавозчыка")} па нумары, пазначаным вышэй.`,
    es: c ? `Sigue tu envío en la web del transportista ${trackLink(c)} con el número indicado arriba.` : `Sigue tu envío en la ${trackLink("web del transportista")} con el número indicado arriba.`,
    pt: c ? `Acompanha o envio no site da transportadora ${trackLink(c)} com o número indicado acima.` : `Acompanha o envio no ${trackLink("site da transportadora")} com o número indicado acima.`,
    fr: c ? `Suis ton colis sur le site du transporteur ${trackLink(c)} avec le numéro indiqué ci-dessus.` : `Suis ton colis sur le ${trackLink("site du transporteur")} avec le numéro indiqué ci-dessus.`,
    it: c ? `Traccia la spedizione sul sito del corriere ${trackLink(c)} con il numero indicato sopra.` : `Traccia la spedizione sul ${trackLink("sito del corriere")} con il numero indicato sopra.`,
  };
  // Brak linku, znany przewoznik
  const carrierOnlyBodies: Record<EmailLocale, string> = {
    pl: `Przesyłkę nadaliśmy kurierem ${strongItem(c)} — numer znajdziesz powyżej.`,
    de: `Wir haben das Paket mit ${strongItem(c)} verschickt — die Sendungsnummer findest du oben.`,
    en: `We've shipped your package with ${strongItem(c)} — the tracking number is above.`,
    cs: `Zásilku jsme odeslali přes přepravce ${strongItem(c)} — číslo najdeš výše.`,
    sk: `Zásielku sme odoslali cez prepravcu ${strongItem(c)} — číslo nájdeš vyššie.`,
    lt: `Siuntą išsiuntėme per vežėją ${strongItem(c)} — numerį rasi aukščiau.`,
    be: `Мы адправілі пасылку праз перавозчыка ${strongItem(c)} — нумар пазначаны вышэй.`,
    es: `Hemos enviado tu paquete con ${strongItem(c)}; el número de seguimiento está arriba.`,
    pt: `Enviámos a tua encomenda pela transportadora ${strongItem(c)} — o número está indicado acima.`,
    fr: `Nous avons expédié ton colis via ${strongItem(c)} — le numéro de suivi est indiqué ci-dessus.`,
    it: `Abbiamo spedito il pacco con ${strongItem(c)}: il numero di tracciamento è indicato sopra.`,
  };
  // Brak linku i przewoznika
  const neutralTrackBodies: Record<EmailLocale, string> = {
    pl: "Numer przesyłki znajdziesz powyżej.",
    de: "Die Sendungsnummer findest du oben.",
    en: "You'll find the tracking number above.",
    cs: "Číslo zásilky najdeš výše.",
    sk: "Číslo zásielky nájdeš vyššie.",
    lt: "Siuntos numerį rasi aukščiau.",
    be: "Нумар адпраўлення пазначаны вышэй.",
    es: "Encontrarás el número de seguimiento arriba.",
    pt: "Encontras o número de seguimento acima.",
    fr: "Tu trouveras le numéro de suivi ci-dessus.",
    it: "Trovi il numero di tracciamento qui sopra.",
  };
  const trackBody = ship.url ? trackLinkBodies[locale] : c ? carrierOnlyBodies[locale] : neutralTrackBodies[locale];
  // Kurier pod drzwi — bez obietnic specyficznych dla przewoznika
  const doorBodies: Record<EmailLocale, string> = {
    pl: "Kurier dostarczy paczkę pod podany adres — zwykle dostaniesz od przewoźnika e-mail lub SMS z przewidywaną godziną doręczenia.",
    de: "Der Kurier liefert das Paket an die angegebene Adresse — normalerweise bekommst du vom Versanddienstleister eine E-Mail oder SMS mit der voraussichtlichen Zustellzeit.",
    en: "The courier will deliver the package to the address you provided — the carrier usually sends you an email or SMS with the estimated delivery time.",
    cs: "Kurýr doručí balík na uvedenou adresu — obvykle ti přepravce pošle e-mail nebo SMS s předpokládaným časem doručení.",
    sk: "Kuriér doručí balík na uvedenú adresu — zvyčajne ti prepravca pošle e-mail alebo SMS s predpokladaným časom doručenia.",
    lt: "Kurjeris pristatys siuntinį nurodytu adresu — paprastai vežėjas atsiunčia el. laišką arba SMS su numatomu pristatymo laiku.",
    be: "Кур’ер дастаўіць пасылку на пазначаны адрас — звычайна перавозчык дасылае e-mail або SMS з прыблізным часам дастаўкі.",
    es: "El mensajero entregará el paquete en la dirección indicada; normalmente el transportista te enviará un correo o SMS con la hora prevista de entrega.",
    pt: "O estafeta vai entregar a encomenda na morada indicada — normalmente a transportadora envia-te um e-mail ou SMS com a hora prevista de entrega.",
    fr: "Le livreur apportera le colis à l’adresse indiquée — en général, le transporteur t’envoie un e-mail ou un SMS avec l’heure de livraison prévue.",
    it: "Il corriere consegnerà il pacco all’indirizzo indicato: di solito riceverai dal corriere un’e-mail o un SMS con l’orario di consegna previsto.",
  };
  const pickupBodies: Record<EmailLocale, string> = {
    pl: `Odbierz paczkę z paczkomatu ${strongItem(data.pickupPoint)} po otrzymaniu SMS-a z kodem odbioru.`,
    de: `Hole dein Paket am Paketfach ${strongItem(data.pickupPoint)} ab, nachdem du die SMS mit dem Abholcode erhalten hast.`,
    en: `Pick up your package from parcel locker ${strongItem(data.pickupPoint)} after receiving the SMS with the collection code.`,
    cs: `Balík si vyzvedni ve výdejním boxu ${strongItem(data.pickupPoint)}, jakmile ti přijde SMS s kódem pro vyzvednutí.`,
    sk: `Balík si vyzdvihni vo výdajnom boxe ${strongItem(data.pickupPoint)}, keď ti príde SMS s kódom na vyzdvihnutie.`,
    lt: `Siuntinį atsiimk paštomate ${strongItem(data.pickupPoint)}, kai gausi SMS su atsiėmimo kodu.`,
    be: `Забяры пасылку з паштамата ${strongItem(data.pickupPoint)} пасля SMS з кодам атрымання.`,
    es: `Recoge tu paquete en el punto ${strongItem(data.pickupPoint)} cuando recibas el SMS con el código de recogida.`,
    pt: `Levanta a encomenda no cacifo ${strongItem(data.pickupPoint)} depois de receberes o SMS com o código de levantamento.`,
    fr: `Récupère ton colis au point relais ${strongItem(data.pickupPoint)} dès réception du SMS avec le code de retrait.`,
    it: `Ritira il pacco al locker ${strongItem(data.pickupPoint)} dopo aver ricevuto l’SMS con il codice di ritiro.`,
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
      carrierRow(c, locale),
      ...destinationRows(data, locale, true),
    ].join(""))}

    ${data.trackingNumber ? body(trackBody) : ""}
    ${data.pickupPoint ? body(pickupBodies[locale]) : body(doorBodies[locale])}

    ${ship.url ? ctaButton(t(locale, "btnTrack"), escHtml(ship.url)) : ""}
  `;
  return shell(inner, locale);
}

export function statusFulfilledEmail(data: FulfillmentData, locale: EmailLocale = "pl"): string {
  const eyebrows: Record<EmailLocale, string> = {
    pl: "Status · Zrealizowane",
    de: "Status · Abgeschlossen",
    en: "Status · Completed",
    cs: "Stav · Vyřízeno",
    sk: "Stav · Vybavené",
    lt: "Būsena · Įvykdyta",
    be: "Статус · Выканана",
    es: "Estado · Completado",
    pt: "Estado · Concluído",
    fr: "Statut · Terminée",
    it: "Stato · Completato",
  };
  const headlines: Record<EmailLocale, [string, string]> = {
    pl: ["Gotowe.", "Gotowe"],
    de: ["Fertig.", "Fertig"],
    en: ["Done.", "Done"],
    cs: ["Hotovo.", "Hotovo"],
    sk: ["Hotovo.", "Hotovo"],
    lt: ["Atlikta.", "Atlikta"],
    be: ["Гатова.", "Гатова"],
    es: ["Listo.", "Listo"],
    pt: ["Concluído.", "Concluído"],
    fr: ["C’est fait.", "fait"],
    it: ["Fatto.", "Fatto"],
  };
  const leads: Record<EmailLocale, string> = {
    pl: `Cześć ${strongName(data.customerName)}, Twoje zamówienie ${strongItem(data.product)} zostało zrealizowane.`,
    de: `Hallo ${strongName(data.customerName)}, deine Bestellung ${strongItem(data.product)} wurde abgeschlossen.`,
    en: `Hi ${strongName(data.customerName)}, your order ${strongItem(data.product)} has been completed.`,
    cs: `Ahoj ${strongName(data.customerName)}, tvoje objednávka ${strongItem(data.product)} byla vyřízena.`,
    sk: `Ahoj ${strongName(data.customerName)}, tvoja objednávka ${strongItem(data.product)} bola vybavená.`,
    lt: `Labas, ${strongName(data.customerName)}, tavo užsakymas ${strongItem(data.product)} įvykdytas.`,
    be: `Прывітанне, ${strongName(data.customerName)}! Твой заказ ${strongItem(data.product)} выкананы.`,
    es: `Hola, ${strongName(data.customerName)}: tu pedido ${strongItem(data.product)} se ha completado.`,
    pt: `Olá ${strongName(data.customerName)}, a tua encomenda ${strongItem(data.product)} foi concluída.`,
    fr: `Bonjour ${strongName(data.customerName)}, ta commande ${strongItem(data.product)} est terminée.`,
    it: `Ciao ${strongName(data.customerName)}, il tuo ordine ${strongItem(data.product)} è stato completato.`,
  };
  const mailLink = `<a href="mailto:kontakt@kalkmate.pl" style="color:${C.signal};text-decoration:underline;font-weight:600;">kontakt@kalkmate.pl</a>`;
  const bodies: Record<EmailLocale, string> = {
    pl: `Dziękujemy za zakup. Nie zapomnij aktywować kodu licencji z pudełka w panelu — dostaniesz 2 mln tokenów AI. W razie pytań napisz do nas: ${mailLink}.`,
    de: `Danke für deinen Kauf. Vergiss nicht, den Lizenzcode aus der Verpackung im Kundenkonto zu aktivieren — du erhältst 2 Mio. KI-Tokens. Bei Fragen schreib uns an ${mailLink}.`,
    en: `Thank you for your purchase. Don't forget to activate the license code from the box in your account panel — you'll get 2 million AI tokens. If you have any questions, contact us at ${mailLink}.`,
    cs: `Děkujeme za nákup. Nezapomeň v panelu aktivovat licenční kód z krabičky — získáš 2 mil. AI tokenů. S případnými dotazy nám napiš: ${mailLink}.`,
    sk: `Ďakujeme za nákup. Nezabudni v paneli aktivovať licenčný kód z krabičky — získaš 2 mil. AI tokenov. S prípadnými otázkami nám napíš: ${mailLink}.`,
    lt: `Ačiū už pirkinį. Nepamiršk skydelyje aktyvuoti licencijos kodo iš dėžutės — gausi 2 mln. DI žetonų. Jei turi klausimų, rašyk mums: ${mailLink}.`,
    be: `Дзякуй за пакупку. Не забудзь актываваць у панэлі ліцэнзійны код з каробкі — атрымаеш 2 млн ШІ-токенаў. Калі ёсць пытанні, пішы нам: ${mailLink}.`,
    es: `Gracias por tu compra. No olvides activar en tu panel el código de licencia de la caja: recibirás 2 millones de tokens de IA. Si tienes alguna pregunta, escríbenos a ${mailLink}.`,
    pt: `Obrigado pela tua compra. Não te esqueças de ativar no painel o código de licença da caixa — recebes 2 milhões de tokens de IA. Se tiveres dúvidas, escreve-nos para ${mailLink}.`,
    fr: `Merci pour ton achat. N’oublie pas d’activer dans ton espace le code de licence de la boîte : tu recevras 2 millions de tokens IA. Pour toute question, écris-nous à ${mailLink}.`,
    it: `Grazie per l’acquisto. Non dimenticare di attivare nel pannello il codice di licenza della scatola: riceverai 2 milioni di token IA. Per qualsiasi domanda scrivici a ${mailLink}.`,
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
    cs: "Stav · Zrušeno",
    sk: "Stav · Zrušené",
    lt: "Būsena · Atšaukta",
    be: "Статус · Скасавана",
    es: "Estado · Cancelado",
    pt: "Estado · Cancelado",
    fr: "Statut · Annulée",
    it: "Stato · Annullato",
  };
  const headlines: Record<EmailLocale, [string, string]> = {
    pl: ["Anulowane.", "Anulowane"],
    de: ["Storniert.", "Storniert"],
    en: ["Cancelled.", "Cancelled"],
    cs: ["Zrušeno.", "Zrušeno"],
    sk: ["Zrušené.", "Zrušené"],
    lt: ["Atšaukta.", "Atšaukta"],
    be: ["Скасавана.", "Скасавана"],
    es: ["Cancelado.", "Cancelado"],
    pt: ["Cancelada.", "Cancelada"],
    fr: ["Annulée.", "Annulée"],
    it: ["Annullato.", "Annullato"],
  };
  const leads: Record<EmailLocale, string> = {
    pl: `Cześć ${strongName(data.customerName)}, Twoje zamówienie ${strongItem(data.product)} zostało anulowane.`,
    de: `Hallo ${strongName(data.customerName)}, deine Bestellung ${strongItem(data.product)} wurde storniert.`,
    en: `Hi ${strongName(data.customerName)}, your order ${strongItem(data.product)} has been cancelled.`,
    cs: `Ahoj ${strongName(data.customerName)}, tvoje objednávka ${strongItem(data.product)} byla zrušena.`,
    sk: `Ahoj ${strongName(data.customerName)}, tvoja objednávka ${strongItem(data.product)} bola zrušená.`,
    lt: `Labas, ${strongName(data.customerName)}, tavo užsakymas ${strongItem(data.product)} atšauktas.`,
    be: `Прывітанне, ${strongName(data.customerName)}! Твой заказ ${strongItem(data.product)} скасаваны.`,
    es: `Hola, ${strongName(data.customerName)}: tu pedido ${strongItem(data.product)} se ha cancelado.`,
    pt: `Olá ${strongName(data.customerName)}, a tua encomenda ${strongItem(data.product)} foi cancelada.`,
    fr: `Bonjour ${strongName(data.customerName)}, ta commande ${strongItem(data.product)} a été annulée.`,
    it: `Ciao ${strongName(data.customerName)}, il tuo ordine ${strongItem(data.product)} è stato annullato.`,
  };
  const mailLink = `<a href="mailto:kontakt@kalkmate.pl" style="color:${C.signal};text-decoration:underline;font-weight:600;">kontakt@kalkmate.pl</a>`;
  const bodies: Record<EmailLocale, string> = {
    pl: `Jeśli masz pytania albo się tego nie spodziewałeś(-aś), napisz do nas: ${mailLink}.`,
    de: `Falls du dazu Fragen hast oder das nicht erwartet hast, melde dich bitte bei uns unter ${mailLink}.`,
    en: `If you have any questions about this or didn't expect it, please reach out to us at ${mailLink}.`,
    cs: `Pokud máš dotazy nebo jsi to nečekal(a), napiš nám: ${mailLink}.`,
    sk: `Ak máš otázky alebo si to nečakal(a), napíš nám: ${mailLink}.`,
    lt: `Jei turi klausimų arba to nesitikėjai, parašyk mums: ${mailLink}.`,
    be: `Калі ў цябе ёсць пытанні або ты гэтага не чакаў(-ла), напішы нам: ${mailLink}.`,
    es: `Si tienes preguntas o no te lo esperabas, escríbenos a ${mailLink}.`,
    pt: `Se tiveres dúvidas ou não estavas à espera disto, escreve-nos para ${mailLink}.`,
    fr: `Si tu as des questions ou si tu ne t’y attendais pas, écris-nous à ${mailLink}.`,
    it: `Se hai domande o non te lo aspettavi, scrivici a ${mailLink}.`,
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
    cs: "Účet · Ověření e-mailu",
    sk: "Účet · Overenie e-mailu",
    lt: "Paskyra · El. pašto patvirtinimas",
    be: "Акаўнт · Пацвярджэнне e-mail",
    es: "Cuenta · Verificación del correo",
    pt: "Conta · Verificação do e-mail",
    fr: "Compte · Vérification de l’e-mail",
    it: "Account · Verifica e-mail",
  };
  const headlines: Record<EmailLocale, [string, string]> = {
    pl: ["Potwierdź e-mail.", "e-mail"],
    de: ["E-Mail bestätigen.", "bestätigen"],
    en: ["Confirm your email.", "email"],
    cs: ["Potvrď e-mail.", "e-mail"],
    sk: ["Potvrď e-mail.", "e-mail"],
    lt: ["Patvirtink el. paštą.", "el. paštą"],
    be: ["Пацвердзі e-mail.", "e-mail"],
    es: ["Confirma tu correo.", "correo"],
    pt: ["Confirma o teu e-mail.", "e-mail"],
    fr: ["Confirme ton e-mail.", "e-mail"],
    it: ["Conferma la tua e-mail.", "e-mail"],
  };
  const greetings: Record<EmailLocale, string> = {
    pl: data.customerName ? `Cześć ${strongName(data.customerName)}!` : "Cześć!",
    de: data.customerName ? `Hallo ${strongName(data.customerName)}!` : "Hallo!",
    en: data.customerName ? `Hi ${strongName(data.customerName)}!` : "Hi!",
    cs: data.customerName ? `Ahoj ${strongName(data.customerName)}!` : "Ahoj!",
    sk: data.customerName ? `Ahoj ${strongName(data.customerName)}!` : "Ahoj!",
    lt: data.customerName ? `Labas, ${strongName(data.customerName)}!` : "Labas!",
    be: data.customerName ? `Прывітанне, ${strongName(data.customerName)}!` : "Прывітанне!",
    es: data.customerName ? `¡Hola, ${strongName(data.customerName)}!` : "¡Hola!",
    pt: data.customerName ? `Olá ${strongName(data.customerName)}!` : "Olá!",
    fr: data.customerName ? `Bonjour ${strongName(data.customerName)} !` : "Bonjour !",
    it: data.customerName ? `Ciao ${strongName(data.customerName)}!` : "Ciao!",
  };
  const exp = `${data.expiresHours} h`;
  const leadTexts: Record<EmailLocale, string> = {
    pl: `${greetings.pl} Dziękujemy za rejestrację w KalkMate. Aby aktywować konto, kliknij przycisk poniżej. Link wygasa za ${expiryBadge(exp)}.`,
    de: `${greetings.de} Danke für deine Registrierung bei KalkMate. Um dein Konto zu aktivieren, klicke auf den Button unten. Der Link läuft in ${expiryBadge(exp)} ab.`,
    en: `${greetings.en} Thank you for signing up to KalkMate. To activate your account, click the button below. The link expires in ${expiryBadge(exp)}.`,
    cs: `${greetings.cs} Děkujeme za registraci v KalkMate. Účet aktivuješ kliknutím na tlačítko níže. Odkaz vyprší za ${expiryBadge(exp)}.`,
    sk: `${greetings.sk} Ďakujeme za registráciu v KalkMate. Účet aktivuješ kliknutím na tlačidlo nižšie. Odkaz vyprší o ${expiryBadge(exp)}.`,
    lt: `${greetings.lt} Ačiū, kad užsiregistravai KalkMate. Paskyrai aktyvuoti spustelėk mygtuką žemiau. Nuoroda galioja ${expiryBadge(exp)}.`,
    be: `${greetings.be} Дзякуй за рэгістрацыю ў KalkMate. Каб актываваць акаўнт, націсні кнопку ніжэй. Спасылка дзейнічае ${expiryBadge(exp)}.`,
    es: `${greetings.es} Gracias por registrarte en KalkMate. Para activar tu cuenta, haz clic en el botón de abajo. El enlace caduca en ${expiryBadge(exp)}.`,
    pt: `${greetings.pt} Obrigado por te registares no KalkMate. Para ativar a tua conta, clica no botão abaixo. O link expira em ${expiryBadge(exp)}.`,
    fr: `${greetings.fr} Merci pour ton inscription sur KalkMate. Pour activer ton compte, clique sur le bouton ci-dessous. Le lien expire dans ${expiryBadge(exp)}.`,
    it: `${greetings.it} Grazie per la registrazione su KalkMate. Per attivare l’account, clicca sul pulsante qui sotto. Il link scade tra ${expiryBadge(exp)}.`,
  };
  const noteTexts: Record<EmailLocale, string> = {
    pl: "Bez potwierdzenia nie zalogujesz się ani nie złożysz zamówienia. Jeśli to nie Ty zakładałeś(-aś) konto, zignoruj tę wiadomość.",
    de: "Ohne Bestätigung kannst du dich weder anmelden noch bestellen. Falls du kein Konto erstellt hast, ignoriere diese E-Mail.",
    en: "Without verification you won't be able to log in or place an order. If you didn't create this account, ignore this email.",
    cs: "Bez potvrzení se nepřihlásíš ani neobjednáš. Pokud sis účet nezakládal(a) ty, tento e-mail ignoruj.",
    sk: "Bez potvrdenia sa neprihlásiš ani neobjednáš. Ak si si účet nezakladal(a) ty, tento e-mail ignoruj.",
    lt: "Be patvirtinimo negalėsi nei prisijungti, nei pateikti užsakymo. Jei paskyros nekūrei tu, šį laišką ignoruok.",
    be: "Без пацвярджэння ты не зможаш увайсці або зрабіць заказ. Калі акаўнт ствараў не ты, проста праігнаруй гэты ліст.",
    es: "Sin la verificación no podrás iniciar sesión ni hacer pedidos. Si no has creado esta cuenta, ignora este correo.",
    pt: "Sem a confirmação não podes iniciar sessão nem fazer encomendas. Se não criaste esta conta, ignora este e-mail.",
    fr: "Sans confirmation, tu ne pourras ni te connecter ni passer commande. Si tu n’as pas créé ce compte, ignore cet e-mail.",
    it: "Senza conferma non potrai accedere né effettuare ordini. Se non hai creato tu questo account, ignora questa e-mail.",
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
    cs: "Účet · Obnovení hesla",
    sk: "Účet · Obnovenie hesla",
    lt: "Paskyra · Slaptažodžio atkūrimas",
    be: "Акаўнт · Скід пароля",
    es: "Cuenta · Restablecer contraseña",
    pt: "Conta · Redefinir palavra-passe",
    fr: "Compte · Réinitialisation du mot de passe",
    it: "Account · Reimpostazione password",
  };
  const headlines: Record<EmailLocale, [string, string]> = {
    pl: ["Reset hasła.", "hasła"],
    de: ["Passwort zurücksetzen.", "zurücksetzen"],
    en: ["Password reset.", "reset"],
    cs: ["Obnovení hesla.", "hesla"],
    sk: ["Obnovenie hesla.", "hesla"],
    lt: ["Slaptažodžio atkūrimas.", "atkūrimas"],
    be: ["Скід пароля.", "пароля"],
    es: ["Restablecer contraseña.", "contraseña"],
    pt: ["Redefinir palavra-passe.", "palavra-passe"],
    fr: ["Nouveau mot de passe.", "mot de passe"],
    it: ["Reimposta la password.", "password"],
  };
  const leadTexts: Record<EmailLocale, string> = {
    pl: `Ktoś (mamy nadzieję, że Ty) poprosił o reset hasła do konta KalkMate. Kliknij przycisk poniżej, aby ustawić nowe hasło. Link wygasa za ${expiryBadge(`${data.expiresMinutes} minut`)}.`,
    de: `Jemand (hoffentlich du) hat einen Passwort-Reset für dein KalkMate-Konto angefragt. Klicke auf den Button unten, um ein neues Passwort festzulegen. Der Link läuft in ${expiryBadge(`${data.expiresMinutes} Minuten`)} ab.`,
    en: `Someone (hopefully you) requested a password reset for your KalkMate account. Click the button below to set a new password. The link expires in ${expiryBadge(`${data.expiresMinutes} minutes`)}.`,
    cs: `Někdo (doufáme, že ty) požádal o obnovení hesla k účtu KalkMate. Nové heslo nastavíš kliknutím na tlačítko níže. Odkaz vyprší za ${expiryBadge(`${data.expiresMinutes} minut`)}.`,
    sk: `Niekto (dúfame, že ty) požiadal o obnovenie hesla k účtu KalkMate. Nové heslo nastavíš kliknutím na tlačidlo nižšie. Odkaz vyprší o ${expiryBadge(`${data.expiresMinutes} minút`)}.`,
    lt: `Kažkas (tikimės, kad tu) paprašė atkurti KalkMate paskyros slaptažodį. Naujam slaptažodžiui nustatyti spustelėk mygtuką žemiau. Nuoroda galioja ${expiryBadge(`${data.expiresMinutes} min.`)}.`,
    be: `Хтосьці (спадзяёмся, што ты) запытаў скід пароля для акаўнта KalkMate. Каб задаць новы пароль, націсні кнопку ніжэй. Спасылка дзейнічае ${expiryBadge(`${data.expiresMinutes} хв`)}.`,
    es: `Alguien (esperamos que tú) ha solicitado restablecer la contraseña de tu cuenta de KalkMate. Haz clic en el botón de abajo para crear una nueva. El enlace caduca en ${expiryBadge(`${data.expiresMinutes} minutos`)}.`,
    pt: `Alguém (esperamos que tu) pediu para redefinir a palavra-passe da tua conta KalkMate. Clica no botão abaixo para definir uma nova. O link expira em ${expiryBadge(`${data.expiresMinutes} minutos`)}.`,
    fr: `Quelqu’un (toi, espérons-le) a demandé la réinitialisation du mot de passe de ton compte KalkMate. Clique sur le bouton ci-dessous pour en définir un nouveau. Le lien expire dans ${expiryBadge(`${data.expiresMinutes} minutes`)}.`,
    it: `Qualcuno (speriamo tu) ha richiesto la reimpostazione della password del tuo account KalkMate. Clicca sul pulsante qui sotto per impostarne una nuova. Il link scade tra ${expiryBadge(`${data.expiresMinutes} minuti`)}.`,
  };
  const noteTexts: Record<EmailLocale, string> = {
    pl: "Jeśli to nie Ty wysłałeś(-aś) tę prośbę, zignoruj tę wiadomość — hasło nie zostanie zmienione.",
    de: "Falls du diese Anfrage nicht gestellt hast, ignoriere diese E-Mail. Dein Passwort wird nicht geändert.",
    en: "If you didn't send this request, ignore this email. Your password won't be changed.",
    cs: "Pokud jsi o to nežádal(a) ty, tento e-mail ignoruj — heslo zůstane beze změny.",
    sk: "Ak si o to nežiadal(a) ty, tento e-mail ignoruj — heslo zostane bez zmeny.",
    lt: "Jei to neprašei, šį laišką ignoruok — slaptažodis nebus pakeistas.",
    be: "Калі ты гэтага не запытваў(-ла), праігнаруй ліст — пароль не зменіцца.",
    es: "Si no has hecho esta solicitud, ignora este correo: tu contraseña no cambiará.",
    pt: "Se não fizeste este pedido, ignora este e-mail — a tua palavra-passe não será alterada.",
    fr: "Si tu n’es pas à l’origine de cette demande, ignore cet e-mail : ton mot de passe ne sera pas modifié.",
    it: "Se non hai fatto tu questa richiesta, ignora questa e-mail: la password non verrà modificata.",
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
    cs: "Účet · Pokus o registraci",
    sk: "Účet · Pokus o registráciu",
    lt: "Paskyra · Bandymas registruotis",
    be: "Акаўнт · Спроба рэгістрацыі",
    es: "Cuenta · Intento de registro",
    pt: "Conta · Tentativa de registo",
    fr: "Compte · Tentative d’inscription",
    it: "Account · Tentativo di registrazione",
  };
  const headlines: Record<EmailLocale, [string, string]> = {
    pl: ["Masz już konto.", "konto"],
    de: ["Du hast schon ein Konto.", "Konto"],
    en: ["You already have an account.", "account"],
    cs: ["Účet už máš.", "Účet"],
    sk: ["Účet už máš.", "Účet"],
    lt: ["Paskyrą jau turi.", "Paskyrą"],
    be: ["У цябе ўжо ёсць акаўнт.", "акаўнт"],
    es: ["Ya tienes una cuenta.", "cuenta"],
    pt: ["Já tens uma conta.", "conta"],
    fr: ["Tu as déjà un compte.", "compte"],
    it: ["Hai già un account.", "account"],
  };
  const forgot = (label: string) =>
    `<a href="${escHtml(data.forgotUrl)}" style="color:${C.signal};text-decoration:underline;font-weight:600;">${label}</a>`;
  const leadTexts: Record<EmailLocale, string> = {
    pl: "Ktoś próbował założyć nowe konto KalkMate na ten adres e-mail. Konto na ten adres już istnieje, więc niczego nie zmieniliśmy.",
    de: "Jemand hat versucht, mit dieser E-Mail-Adresse ein neues KalkMate-Konto zu erstellen. Für diese Adresse gibt es bereits ein Konto, daher haben wir nichts geändert.",
    en: "Someone tried to create a new KalkMate account with this email address. An account with this address already exists, so nothing was changed.",
    cs: "Někdo se pokusil na tuto e-mailovou adresu založit nový účet KalkMate. Účet s touto adresou už existuje, proto jsme nic neměnili.",
    sk: "Niekto sa pokúsil na túto e-mailovú adresu založiť nový účet KalkMate. Účet s touto adresou už existuje, preto sme nič nemenili.",
    lt: "Kažkas bandė šiuo el. pašto adresu sukurti naują KalkMate paskyrą. Paskyra su šiuo adresu jau yra, todėl nieko nekeitėme.",
    be: "Хтосьці паспрабаваў стварыць новы акаўнт KalkMate на гэты адрас e-mail. Акаўнт з гэтым адрасам ужо існуе, таму мы нічога не змянялі.",
    es: "Alguien ha intentado crear una nueva cuenta de KalkMate con esta dirección de correo. Ya existe una cuenta con esta dirección, así que no hemos cambiado nada.",
    pt: "Alguém tentou criar uma nova conta KalkMate com este endereço de e-mail. Já existe uma conta com este endereço, por isso não alterámos nada.",
    fr: "Quelqu’un a tenté de créer un nouveau compte KalkMate avec cette adresse e-mail. Un compte existe déjà avec cette adresse, nous n’avons donc rien modifié.",
    it: "Qualcuno ha provato a creare un nuovo account KalkMate con questo indirizzo e-mail. Esiste già un account con questo indirizzo, quindi non abbiamo modificato nulla.",
  };
  const bodyTexts: Record<EmailLocale, string> = {
    pl: `Jeśli to Ty — zaloguj się przez Google (jeśli tak zakładałeś(-aś) konto) albo ustaw hasło przez ${forgot("reset hasła")}.`,
    de: `Falls du das warst: Melde dich mit Google an (falls du das Konto so erstellt hast) oder setze ein Passwort über ${forgot("Passwort zurücksetzen")}.`,
    en: `If this was you, sign in with Google (if that's how you created the account) or set a password using ${forgot("password reset")}.`,
    cs: `Pokud jsi to byl(a) ty — přihlas se přes Google (pokud sis tak účet zakládal(a)) nebo si nastav heslo přes ${forgot("obnovení hesla")}.`,
    sk: `Ak si to bol(a) ty — prihlás sa cez Google (ak si si tak účet zakladal(a)) alebo si nastav heslo cez ${forgot("obnovenie hesla")}.`,
    lt: `Jei tai buvai tu, prisijunk per Google (jei taip kūrei paskyrą) arba nusistatyk slaptažodį per ${forgot("slaptažodžio atkūrimą")}.`,
    be: `Калі гэта быў(-ла) ты — увайдзі праз Google (калі ты так ствараў(-ла) акаўнт) або задай пароль праз ${forgot("скід пароля")}.`,
    es: `Si has sido tú, inicia sesión con Google (si creaste la cuenta así) o establece una contraseña con ${forgot("restablecer contraseña")}.`,
    pt: `Se foste tu, inicia sessão com o Google (se foi assim que criaste a conta) ou define uma palavra-passe através de ${forgot("redefinir palavra-passe")}.`,
    fr: `Si c’était toi, connecte-toi avec Google (si tu as créé ton compte ainsi) ou définis un mot de passe via ${forgot("la réinitialisation du mot de passe")}.`,
    it: `Se eri tu, accedi con Google (se hai creato l’account così) oppure imposta una password tramite ${forgot("reimpostazione password")}.`,
  };
  const noteTexts: Record<EmailLocale, string> = {
    pl: "Jeśli to nie Ty, zignoruj tę wiadomość — Twoje konto i hasło pozostają bez zmian.",
    de: "Falls du das nicht warst, ignoriere diese E-Mail — dein Konto und Passwort bleiben unverändert.",
    en: "If this wasn't you, ignore this email — your account and password stay unchanged.",
    cs: "Pokud jsi to nebyl(a) ty, tento e-mail ignoruj — tvůj účet i heslo zůstávají beze změny.",
    sk: "Ak si to nebol(a) ty, tento e-mail ignoruj — tvoj účet aj heslo zostávajú bez zmeny.",
    lt: "Jei tai buvai ne tu, šį laišką ignoruok — tavo paskyra ir slaptažodis lieka nepakitę.",
    be: "Калі гэта быў(-ла) не ты, праігнаруй ліст — твой акаўнт і пароль застаюцца без змен.",
    es: "Si no has sido tú, ignora este correo: tu cuenta y tu contraseña siguen igual.",
    pt: "Se não foste tu, ignora este e-mail — a tua conta e a palavra-passe ficam iguais.",
    fr: "Si ce n’était pas toi, ignore cet e-mail : ton compte et ton mot de passe restent inchangés.",
    it: "Se non eri tu, ignora questa e-mail: account e password restano invariati.",
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
    cs: "Účet · Změna e-mailové adresy",
    sk: "Účet · Zmena e-mailovej adresy",
    lt: "Paskyra · El. pašto adreso keitimas",
    be: "Акаўнт · Змена адраса e-mail",
    es: "Cuenta · Cambio de correo",
    pt: "Conta · Alteração de e-mail",
    fr: "Compte · Changement d’adresse e-mail",
    it: "Account · Modifica e-mail",
  };
  const headlines: Record<EmailLocale, [string, string]> = {
    pl: ["Potwierdź nowy adres.", "nowy adres"],
    de: ["Neue Adresse bestätigen.", "Adresse"],
    en: ["Confirm your new address.", "new address"],
    cs: ["Potvrď novou adresu.", "novou adresu"],
    sk: ["Potvrď novú adresu.", "novú adresu"],
    lt: ["Patvirtink naują adresą.", "naują adresą"],
    be: ["Пацвердзі новы адрас.", "новы адрас"],
    es: ["Confirma tu nueva dirección.", "nueva dirección"],
    pt: ["Confirma o novo endereço.", "novo endereço"],
    fr: ["Confirme ta nouvelle adresse.", "nouvelle adresse"],
    it: ["Conferma il nuovo indirizzo.", "nuovo indirizzo"],
  };
  const greetings: Record<EmailLocale, string> = {
    pl: data.customerName ? `Cześć ${strongName(data.customerName)}!` : "Cześć!",
    de: data.customerName ? `Hallo ${strongName(data.customerName)}!` : "Hallo!",
    en: data.customerName ? `Hi ${strongName(data.customerName)}!` : "Hi!",
    cs: data.customerName ? `Ahoj ${strongName(data.customerName)}!` : "Ahoj!",
    sk: data.customerName ? `Ahoj ${strongName(data.customerName)}!` : "Ahoj!",
    lt: data.customerName ? `Labas, ${strongName(data.customerName)}!` : "Labas!",
    be: data.customerName ? `Прывітанне, ${strongName(data.customerName)}!` : "Прывітанне!",
    es: data.customerName ? `¡Hola, ${strongName(data.customerName)}!` : "¡Hola!",
    pt: data.customerName ? `Olá ${strongName(data.customerName)}!` : "Olá!",
    fr: data.customerName ? `Bonjour ${strongName(data.customerName)} !` : "Bonjour !",
    it: data.customerName ? `Ciao ${strongName(data.customerName)}!` : "Ciao!",
  };
  const addr = strongItem(data.newEmail);
  const exp = expiryBadge(`${data.expiresHours} h`);
  const leadTexts: Record<EmailLocale, string> = {
    pl: `${greetings.pl} Poproszono o zmianę adresu e-mail konta KalkMate na ${addr}. Zmiana nastąpi dopiero po kliknięciu przycisku poniżej. Link wygasa za ${exp}.`,
    de: `${greetings.de} Es wurde angefragt, die E-Mail-Adresse deines KalkMate-Kontos auf ${addr} zu ändern. Die Änderung erfolgt erst, wenn du auf den Button unten klickst. Der Link läuft in ${exp} ab.`,
    en: `${greetings.en} A request was made to change your KalkMate account email to ${addr}. The change only happens after you click the button below. The link expires in ${exp}.`,
    cs: `${greetings.cs} Byla podána žádost o změnu e-mailové adresy účtu KalkMate na ${addr}. Změna proběhne až po kliknutí na tlačítko níže. Odkaz vyprší za ${exp}.`,
    sk: `${greetings.sk} Bola podaná žiadosť o zmenu e-mailovej adresy účtu KalkMate na ${addr}. Zmena prebehne až po kliknutí na tlačidlo nižšie. Odkaz vyprší o ${exp}.`,
    lt: `${greetings.lt} Gautas prašymas pakeisti KalkMate paskyros el. pašto adresą į ${addr}. Pakeitimas įsigalios tik spustelėjus mygtuką žemiau. Nuoroda galioja ${exp}.`,
    be: `${greetings.be} Паступіў запыт на змену адраса e-mail акаўнта KalkMate на ${addr}. Змена адбудзецца толькі пасля націску кнопкі ніжэй. Спасылка дзейнічае ${exp}.`,
    es: `${greetings.es} Se ha solicitado cambiar el correo de tu cuenta de KalkMate a ${addr}. El cambio solo se aplicará cuando hagas clic en el botón de abajo. El enlace caduca en ${exp}.`,
    pt: `${greetings.pt} Foi pedida a alteração do e-mail da tua conta KalkMate para ${addr}. A alteração só acontece depois de clicares no botão abaixo. O link expira em ${exp}.`,
    fr: `${greetings.fr} Une demande de changement de l’adresse e-mail de ton compte KalkMate vers ${addr} a été effectuée. Le changement n’aura lieu qu’après un clic sur le bouton ci-dessous. Le lien expire dans ${exp}.`,
    it: `${greetings.it} È stata richiesta la modifica dell’e-mail del tuo account KalkMate in ${addr}. La modifica avverrà solo dopo aver cliccato sul pulsante qui sotto. Il link scade tra ${exp}.`,
  };
  const noteTexts: Record<EmailLocale, string> = {
    pl: "Po potwierdzeniu logujesz się nowym adresem. Jeśli to nie Ty prosiłeś(-aś) o zmianę, zignoruj tę wiadomość — adres pozostanie bez zmian.",
    de: "Nach der Bestätigung meldest du dich mit der neuen Adresse an. Falls du die Änderung nicht angefragt hast, ignoriere diese E-Mail — die Adresse bleibt unverändert.",
    en: "After confirming, you sign in with the new address. If you didn't request this change, ignore this email — the address will stay the same.",
    cs: "Po potvrzení se budeš přihlašovat novou adresou. Pokud jsi o změnu nežádal(a) ty, tento e-mail ignoruj — adresa zůstane stejná.",
    sk: "Po potvrdení sa budeš prihlasovať novou adresou. Ak si o zmenu nežiadal(a) ty, tento e-mail ignoruj — adresa zostane rovnaká.",
    lt: "Patvirtinus prisijungsi nauju adresu. Jei pakeitimo neprašei, šį laišką ignoruok — adresas liks tas pats.",
    be: "Пасля пацвярджэння ты будзеш уваходзіць з новым адрасам. Калі ты не запытваў(-ла) змену, праігнаруй ліст — адрас застанецца ранейшым.",
    es: "Tras confirmarlo, iniciarás sesión con la nueva dirección. Si no has solicitado este cambio, ignora este correo: la dirección seguirá siendo la misma.",
    pt: "Depois de confirmares, passas a iniciar sessão com o novo endereço. Se não pediste esta alteração, ignora este e-mail — o endereço fica igual.",
    fr: "Après confirmation, tu te connecteras avec la nouvelle adresse. Si tu n’as pas demandé ce changement, ignore cet e-mail : l’adresse restera la même.",
    it: "Dopo la conferma accederai con il nuovo indirizzo. Se non hai richiesto tu la modifica, ignora questa e-mail: l’indirizzo resterà invariato.",
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
    cs: "Účet · Zabezpečení",
    sk: "Účet · Zabezpečenie",
    lt: "Paskyra · Saugumas",
    be: "Акаўнт · Бяспека",
    es: "Cuenta · Seguridad",
    pt: "Conta · Segurança",
    fr: "Compte · Sécurité",
    it: "Account · Sicurezza",
  };
  const headlines: Record<EmailLocale, [string, string]> = {
    pl: ["Prośba o zmianę adresu.", "zmianę adresu"],
    de: ["Adressänderung angefragt.", "Adressänderung"],
    en: ["Email change requested.", "Email change"],
    cs: ["Žádost o změnu adresy.", "změnu adresy"],
    sk: ["Žiadosť o zmenu adresy.", "zmenu adresy"],
    lt: ["Prašymas pakeisti adresą.", "pakeisti adresą"],
    be: ["Запыт на змену адраса.", "змену адраса"],
    es: ["Solicitud de cambio de correo.", "cambio de correo"],
    pt: ["Pedido de alteração de e-mail.", "alteração de e-mail"],
    fr: ["Demande de changement d’adresse.", "changement d’adresse"],
    it: ["Richiesta di modifica e-mail.", "modifica e-mail"],
  };
  const greetings: Record<EmailLocale, string> = {
    pl: data.customerName ? `Cześć ${strongName(data.customerName)}!` : "Cześć!",
    de: data.customerName ? `Hallo ${strongName(data.customerName)}!` : "Hallo!",
    en: data.customerName ? `Hi ${strongName(data.customerName)}!` : "Hi!",
    cs: data.customerName ? `Ahoj ${strongName(data.customerName)}!` : "Ahoj!",
    sk: data.customerName ? `Ahoj ${strongName(data.customerName)}!` : "Ahoj!",
    lt: data.customerName ? `Labas, ${strongName(data.customerName)}!` : "Labas!",
    be: data.customerName ? `Прывітанне, ${strongName(data.customerName)}!` : "Прывітанне!",
    es: data.customerName ? `¡Hola, ${strongName(data.customerName)}!` : "¡Hola!",
    pt: data.customerName ? `Olá ${strongName(data.customerName)}!` : "Olá!",
    fr: data.customerName ? `Bonjour ${strongName(data.customerName)} !` : "Bonjour !",
    it: data.customerName ? `Ciao ${strongName(data.customerName)}!` : "Ciao!",
  };
  const addr = strongItem(data.newEmailMasked);
  const mailLink = `<a href="mailto:kontakt@kalkmate.pl" style="color:${C.signal};text-decoration:underline;font-weight:600;">kontakt@kalkmate.pl</a>`;
  const leadTexts: Record<EmailLocale, string> = {
    pl: `${greetings.pl} W Twoim koncie KalkMate poproszono o zmianę adresu e-mail na ${addr}. Zmiana nastąpi dopiero po potwierdzeniu linkiem wysłanym na nowy adres.`,
    de: `${greetings.de} In deinem KalkMate-Konto wurde eine Änderung der E-Mail-Adresse auf ${addr} angefragt. Sie wird erst wirksam, nachdem der Link an die neue Adresse bestätigt wurde.`,
    en: `${greetings.en} A request was made in your KalkMate account to change the email address to ${addr}. It only takes effect after the link sent to the new address is confirmed.`,
    cs: `${greetings.cs} Ve tvém účtu KalkMate byla podána žádost o změnu e-mailové adresy na ${addr}. Změna proběhne až po potvrzení odkazu zaslaného na novou adresu.`,
    sk: `${greetings.sk} V tvojom účte KalkMate bola podaná žiadosť o zmenu e-mailovej adresy na ${addr}. Zmena prebehne až po potvrdení odkazu zaslaného na novú adresu.`,
    lt: `${greetings.lt} Tavo KalkMate paskyroje gautas prašymas pakeisti el. pašto adresą į ${addr}. Pakeitimas įsigalios tik patvirtinus nuorodą, išsiųstą naujuoju adresu.`,
    be: `${greetings.be} У тваім акаўнце KalkMate паступіў запыт на змену адраса e-mail на ${addr}. Змена адбудзецца толькі пасля пацвярджэння спасылкі, адпраўленай на новы адрас.`,
    es: `${greetings.es} En tu cuenta de KalkMate se ha solicitado cambiar la dirección de correo a ${addr}. El cambio solo se aplicará cuando se confirme el enlace enviado a la nueva dirección.`,
    pt: `${greetings.pt} Foi pedida na tua conta KalkMate a alteração do endereço de e-mail para ${addr}. A alteração só acontece depois de confirmado o link enviado para o novo endereço.`,
    fr: `${greetings.fr} Une demande de changement d’adresse e-mail vers ${addr} a été faite sur ton compte KalkMate. Elle ne prendra effet qu’après confirmation du lien envoyé à la nouvelle adresse.`,
    it: `${greetings.it} Nel tuo account KalkMate è stata richiesta la modifica dell’indirizzo e-mail in ${addr}. La modifica avverrà solo dopo la conferma del link inviato al nuovo indirizzo.`,
  };
  const noteTexts: Record<EmailLocale, string> = {
    pl: `Jeśli to nie Ty — natychmiast zmień hasło w panelu i napisz do nas: ${mailLink}.`,
    de: `Falls du das nicht warst, ändere sofort dein Passwort im Kundenkonto und schreib uns an ${mailLink}.`,
    en: `If this wasn't you, change your password in the panel right away and contact us at ${mailLink}.`,
    cs: `Pokud jsi to nebyl(a) ty, okamžitě si v panelu změň heslo a napiš nám: ${mailLink}.`,
    sk: `Ak si to nebol(a) ty, okamžite si v paneli zmeň heslo a napíš nám: ${mailLink}.`,
    lt: `Jei tai buvai ne tu, iš karto pakeisk slaptažodį skydelyje ir parašyk mums: ${mailLink}.`,
    be: `Калі гэта быў(-ла) не ты, неадкладна змяні пароль у панэлі і напішы нам: ${mailLink}.`,
    es: `Si no has sido tú, cambia ya tu contraseña en el panel y escríbenos a ${mailLink}.`,
    pt: `Se não foste tu, muda já a palavra-passe no painel e escreve-nos para ${mailLink}.`,
    fr: `Si ce n’était pas toi, change immédiatement ton mot de passe dans ton espace et écris-nous à ${mailLink}.`,
    it: `Se non eri tu, cambia subito la password nel pannello e scrivici a ${mailLink}.`,
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
    cs: "Potvrď e-mailovou adresu – KalkMate",
    sk: "Potvrď e-mailovú adresu – KalkMate",
    lt: "Patvirtink el. pašto adresą – KalkMate",
    be: "Пацвердзі адрас e-mail – KalkMate",
    es: "Confirma tu correo – KalkMate",
    pt: "Confirma o teu e-mail – KalkMate",
    fr: "Confirme ton adresse e-mail – KalkMate",
    it: "Conferma il tuo indirizzo e-mail – KalkMate",
  },
  passwordReset: {
    pl: "Reset hasła – KalkMate",
    de: "Passwort zurücksetzen – KalkMate",
    en: "Password reset – KalkMate",
    cs: "Obnovení hesla – KalkMate",
    sk: "Obnovenie hesla – KalkMate",
    lt: "Slaptažodžio atkūrimas – KalkMate",
    be: "Скід пароля – KalkMate",
    es: "Restablecer contraseña – KalkMate",
    pt: "Redefinir palavra-passe – KalkMate",
    fr: "Réinitialisation du mot de passe – KalkMate",
    it: "Reimpostazione password – KalkMate",
  },
  accountExists: {
    pl: "Próba założenia konta na Twój adres – KalkMate",
    de: "Registrierungsversuch mit deiner Adresse – KalkMate",
    en: "Sign-up attempt with your email – KalkMate",
    cs: "Pokus o registraci s tvou adresou – KalkMate",
    sk: "Pokus o registráciu s tvojou adresou – KalkMate",
    lt: "Bandymas registruotis tavo adresu – KalkMate",
    be: "Спроба рэгістрацыі з тваім адрасам – KalkMate",
    es: "Intento de registro con tu correo – KalkMate",
    pt: "Tentativa de registo com o teu e-mail – KalkMate",
    fr: "Tentative d’inscription avec ton adresse – KalkMate",
    it: "Tentativo di registrazione con il tuo indirizzo – KalkMate",
  },
  emailChange: {
    pl: "Potwierdź zmianę adresu e-mail – KalkMate",
    de: "Änderung der E-Mail-Adresse bestätigen – KalkMate",
    en: "Confirm your email change – KalkMate",
    cs: "Potvrď změnu e-mailové adresy – KalkMate",
    sk: "Potvrď zmenu e-mailovej adresy – KalkMate",
    lt: "Patvirtink el. pašto adreso pakeitimą – KalkMate",
    be: "Пацвердзі змену адраса e-mail – KalkMate",
    es: "Confirma el cambio de correo – KalkMate",
    pt: "Confirma a alteração de e-mail – KalkMate",
    fr: "Confirme le changement d’adresse e-mail – KalkMate",
    it: "Conferma la modifica dell’e-mail – KalkMate",
  },
  emailChangeNotice: {
    pl: "Prośba o zmianę adresu e-mail konta – KalkMate",
    de: "Änderung der Konto-E-Mail angefragt – KalkMate",
    en: "Account email change requested – KalkMate",
    cs: "Žádost o změnu e-mailu účtu – KalkMate",
    sk: "Žiadosť o zmenu e-mailu účtu – KalkMate",
    lt: "Prašymas pakeisti paskyros el. paštą – KalkMate",
    be: "Запыт на змену e-mail акаўнта – KalkMate",
    es: "Solicitud de cambio del correo de la cuenta – KalkMate",
    pt: "Pedido de alteração do e-mail da conta – KalkMate",
    fr: "Demande de changement de l’e-mail du compte – KalkMate",
    it: "Richiesta di modifica dell’e-mail dell’account – KalkMate",
  },
  orderInProgress: {
    pl: "Twoje zamówienie jest w realizacji – KalkMate",
    de: "Deine Bestellung wird bearbeitet – KalkMate",
    en: "Your order is being processed – KalkMate",
    cs: "Tvoje objednávka se zpracovává – KalkMate",
    sk: "Tvoja objednávka sa spracúva – KalkMate",
    lt: "Tavo užsakymas vykdomas – KalkMate",
    be: "Твой заказ выконваецца – KalkMate",
    es: "Tu pedido está en preparación – KalkMate",
    pt: "A tua encomenda está a ser processada – KalkMate",
    fr: "Ta commande est en préparation – KalkMate",
    it: "Il tuo ordine è in lavorazione – KalkMate",
  },
  orderLabelCreated: {
    pl: "Pakujemy i wysyłamy Twoje zamówienie – KalkMate",
    de: "Deine Bestellung wird verpackt und verschickt – KalkMate",
    en: "We're packing and shipping your order – KalkMate",
    cs: "Balíme a odesíláme tvou objednávku – KalkMate",
    sk: "Balíme a odosielame tvoju objednávku – KalkMate",
    lt: "Pakuojame ir siunčiame tavo užsakymą – KalkMate",
    be: "Пакуем і адпраўляем твой заказ – KalkMate",
    es: "Estamos preparando y enviando tu pedido – KalkMate",
    pt: "Estamos a embalar e a enviar a tua encomenda – KalkMate",
    fr: "Nous emballons et expédions ta commande – KalkMate",
    it: "Stiamo imballando e spedendo il tuo ordine – KalkMate",
  },
  orderShipped: {
    pl: "Twoja paczka została wysłana! – KalkMate",
    de: "Dein Paket wurde verschickt! – KalkMate",
    en: "Your package has been shipped! – KalkMate",
    cs: "Tvůj balík byl odeslán! – KalkMate",
    sk: "Tvoj balík bol odoslaný! – KalkMate",
    lt: "Tavo siuntinys išsiųstas! – KalkMate",
    be: "Твая пасылка адпраўлена! – KalkMate",
    es: "¡Tu paquete está en camino! – KalkMate",
    pt: "A tua encomenda foi enviada! – KalkMate",
    fr: "Ton colis a été expédié ! – KalkMate",
    it: "Il tuo pacco è stato spedito! – KalkMate",
  },
  orderFulfilled: {
    pl: "Zamówienie zrealizowane – KalkMate",
    de: "Bestellung abgeschlossen – KalkMate",
    en: "Order completed – KalkMate",
    cs: "Objednávka vyřízena – KalkMate",
    sk: "Objednávka vybavená – KalkMate",
    lt: "Užsakymas įvykdytas – KalkMate",
    be: "Заказ выкананы – KalkMate",
    es: "Pedido completado – KalkMate",
    pt: "Encomenda concluída – KalkMate",
    fr: "Commande terminée – KalkMate",
    it: "Ordine completato – KalkMate",
  },
  orderCancelled: {
    pl: "Twoje zamówienie zostało anulowane – KalkMate",
    de: "Deine Bestellung wurde storniert – KalkMate",
    en: "Your order has been cancelled – KalkMate",
    cs: "Tvoje objednávka byla zrušena – KalkMate",
    sk: "Tvoja objednávka bola zrušená – KalkMate",
    lt: "Tavo užsakymas atšauktas – KalkMate",
    be: "Твой заказ скасаваны – KalkMate",
    es: "Tu pedido se ha cancelado – KalkMate",
    pt: "A tua encomenda foi cancelada – KalkMate",
    fr: "Ta commande a été annulée – KalkMate",
    it: "Il tuo ordine è stato annullato – KalkMate",
  },
  orderConfirmation: {
    pl: "Potwierdzenie zamówienia – KalkMate",
    de: "Bestellbestätigung – KalkMate",
    en: "Order confirmation – KalkMate",
    cs: "Potvrzení objednávky – KalkMate",
    sk: "Potvrdenie objednávky – KalkMate",
    lt: "Užsakymo patvirtinimas – KalkMate",
    be: "Пацвярджэнне заказу – KalkMate",
    es: "Confirmación del pedido – KalkMate",
    pt: "Confirmação da encomenda – KalkMate",
    fr: "Confirmation de commande – KalkMate",
    it: "Conferma d’ordine – KalkMate",
  },
} satisfies Record<string, Record<EmailLocale, string>>;

// Temat potwierdzenia zamówienia z numerem (webhook Stripe, P24, przypomnienia).
export function orderConfirmationSubject(locale: EmailLocale, orderNumber: string): string {
  const s: Record<EmailLocale, string> = {
    pl: `Potwierdzenie zamówienia ${orderNumber} – KalkMate`,
    de: `Bestellbestätigung ${orderNumber} – KalkMate`,
    en: `Order confirmation ${orderNumber} – KalkMate`,
    cs: `Potvrzení objednávky ${orderNumber} – KalkMate`,
    sk: `Potvrdenie objednávky ${orderNumber} – KalkMate`,
    lt: `Užsakymo ${orderNumber} patvirtinimas – KalkMate`,
    be: `Пацвярджэнне заказу ${orderNumber} – KalkMate`,
    es: `Confirmación del pedido ${orderNumber} – KalkMate`,
    pt: `Confirmação da encomenda ${orderNumber} – KalkMate`,
    fr: `Confirmation de la commande ${orderNumber} – KalkMate`,
    it: `Conferma dell’ordine ${orderNumber} – KalkMate`,
  };
  return s[locale];
}

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
  lang?: EmailLocale;
  // Podstawa wysyłki pokazywana w stopce. "consent" (domyślnie) = zgoda
  // marketingowa (newsletter); "service" = informacja serwisowa o produkcie,
  // który odbiorca ma (bez reklamy) — tylko gdy wysyłka idzie też do osób bez zgody.
  reason?: "consent" | "service";
}

// Audyt 2026-10-16: stopka podawała jako powód wysyłki "masz konto lub
// zamówienie" — to nie jest podstawa do wysyłania newslettera (art. 398 PKE
// wymaga zgody). Newsletter idzie wyłącznie do osób ze zgodą, więc stopka
// mówi o zgodzie; wariant "service" zostaje dla komunikatów serwisowych.
const NEWSLETTER_FOOTER: Record<EmailLocale, { why: string; whyService: string; unsub: string }> = {
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
  cs: {
    why: "Tuto zprávu dostáváš, protože ses přihlásil(a) k odběru newsletteru KalkMate (souhlas se zasíláním obchodních sdělení). Souhlas můžeš kdykoli odvolat.",
    whyService: "Toto je servisní zpráva k produktu nebo službě KalkMate, kterou používáš.",
    unsub: "Odhlásit se z newsletteru",
  },
  sk: {
    why: "Túto správu dostávaš, pretože si sa prihlásil(a) na odber newslettera KalkMate (súhlas so zasielaním obchodných oznámení). Súhlas môžeš kedykoľvek odvolať.",
    whyService: "Toto je servisná správa k produktu alebo službe KalkMate, ktorú používaš.",
    unsub: "Odhlásiť sa z newslettera",
  },
  lt: {
    why: "Gauni šį laišką, nes užsiprenumeravai KalkMate naujienlaiškį (sutikimas gauti rinkodaros pranešimus). Sutikimą gali bet kada atšaukti.",
    whyService: "Tai aptarnavimo pranešimas apie KalkMate produktą ar paslaugą, kuria naudojiesi.",
    unsub: "Atsisakyti naujienlaiškio",
  },
  be: {
    why: "Ты атрымліваеш гэты ліст, бо падпісаўся(-лася) на рассылку KalkMate (згода на атрыманне рэкламных паведамленняў). Згоду можна адклікаць у любы момант.",
    whyService: "Гэта сэрвіснае паведамленне пра прадукт або паслугу KalkMate, якой ты карыстаешся.",
    unsub: "Адпісацца ад рассылкі",
  },
  es: {
    why: "Recibes este mensaje porque te suscribiste al boletín de KalkMate (consentimiento para comunicaciones comerciales). Puedes retirar tu consentimiento en cualquier momento.",
    whyService: "Este es un mensaje de servicio sobre un producto o servicio de KalkMate que utilizas.",
    unsub: "Darse de baja",
  },
  pt: {
    why: "Recebes esta mensagem porque subscreveste a newsletter da KalkMate (consentimento para comunicações comerciais). Podes retirar o consentimento a qualquer momento.",
    whyService: "Esta é uma mensagem de serviço sobre um produto ou serviço KalkMate que utilizas.",
    unsub: "Cancelar subscrição",
  },
  fr: {
    why: "Tu reçois ce message car tu t’es inscrit(e) à la newsletter KalkMate (consentement aux communications commerciales). Tu peux retirer ton consentement à tout moment.",
    whyService: "Ceci est un message de service concernant un produit ou un service KalkMate que tu utilises.",
    unsub: "Se désinscrire",
  },
  it: {
    why: "Ricevi questo messaggio perché ti sei iscritto/a alla newsletter di KalkMate (consenso alle comunicazioni commerciali). Puoi revocare il consenso in qualsiasi momento.",
    whyService: "Questo è un messaggio di servizio relativo a un prodotto o servizio KalkMate che utilizzi.",
    unsub: "Annulla l’iscrizione",
  },
};

export function newsletterEmail(c: NewsletterContent): string {
  const lang = c.lang || "pl";
  const f = NEWSLETTER_FOOTER[lang] ?? NEWSLETTER_FOOTER.en;
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

  return shell(inner, lang, {
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
