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

// Logo jako tekst z lepszym stylem - bardziej kompatybilne z email clients
const logoHtml = `<div style="font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">KalkMate</div>`;

const baseStyle = `
  body { margin: 0; padding: 0; background: #1a1a1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  .container { max-width: 560px; margin: 0 auto; padding: 40px 20px; }
  .card { background: #2B2D31; border-radius: 12px; padding: 32px; border: 1px solid #3F4147; }
  .logo { text-align: center; margin-bottom: 24px; }
  h1 { color: #E0E0E0; font-size: 20px; margin: 0 0 16px 0; }
  p { color: #b0b0b0; font-size: 14px; line-height: 1.6; margin: 0 0 12px 0; }
  .highlight { color: #E0E0E0; font-weight: 600; }
  .info-box { background: #313338; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #3F4147; }
  .info-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
  .info-label { color: #808080; }
  .info-value { color: #E0E0E0; font-weight: 500; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .badge-blue { background: rgba(59,130,246,0.15); color: #60a5fa; }
  .badge-green { background: rgba(34,197,94,0.15); color: #4ade80; }
  .badge-amber { background: rgba(245,158,11,0.15); color: #fbbf24; }
  .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #666; }
`;

export function purchaseConfirmationEmail(data: OrderData): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${baseStyle}</style></head>
<body>
<div class="container">
  <div class="card">
    <div class="logo">${logoHtml}</div>
    <h1>Dziękujemy za zamówienie!</h1>
    <p>Cześć <span class="highlight">${data.customerName}</span>,</p>
    <p>Twoje zamówienie zostało przyjęte i jest w trakcie przetwarzania. Poniżej znajdziesz szczegóły:</p>

    <div class="info-box">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr><td style="padding:6px 0;font-size:13px;color:#808080;">Produkt</td><td style="padding:6px 0;font-size:13px;color:#E0E0E0;font-weight:500;text-align:right;">${data.product}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#808080;">Kwota</td><td style="padding:6px 0;font-size:13px;color:#E0E0E0;font-weight:500;text-align:right;">${(data.amount / 100).toFixed(2)} zł</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#808080;">Paczkomat</td><td style="padding:6px 0;font-size:13px;color:#E0E0E0;font-weight:500;text-align:right;">${data.pickupPoint}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#808080;">Adres</td><td style="padding:6px 0;font-size:13px;color:#b0b0b0;font-weight:400;text-align:right;font-size:12px;">${data.pickupPointAddress}</td></tr>
      </table>
    </div>

    <p>Powiadomimy Cię mailowo, gdy Twoje zamówienie zostanie wysłane.</p>
    <p style="font-size:12px;color:#666;margin-top:20px;">ID zamówienia: ${data.orderId}</p>
  </div>
  <div class="footer">
    ${logoHtml}
  </div>
</div>
</body>
</html>`;
}

export function statusInProgressEmail(data: FulfillmentData): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${baseStyle}</style></head>
<body>
<div class="container">
  <div class="card">
    <div class="logo">${logoHtml}</div>
    <h1>Twoje zamówienie jest realizowane</h1>
    <p>Cześć <span class="highlight">${data.customerName}</span>,</p>
    <p>Twoje zamówienie <span class="highlight">${data.product}</span> jest w trakcie realizacji. Przygotowujemy je do wysyłki.</p>

    <div class="info-box">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr><td style="padding:6px 0;font-size:13px;color:#808080;">Status</td><td style="padding:6px 0;text-align:right;"><span class="badge badge-amber">W trakcie realizacji</span></td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#808080;">Paczkomat</td><td style="padding:6px 0;font-size:13px;color:#E0E0E0;font-weight:500;text-align:right;">${data.pickupPoint}</td></tr>
      </table>
    </div>

    <p>Powiadomimy Cię ponownie, gdy paczka zostanie nadana.</p>
  </div>
  <div class="footer">
    ${logoHtml}
  </div>
</div>
</body>
</html>`;
}

export function statusShippedEmail(data: FulfillmentData): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${baseStyle}</style></head>
<body>
<div class="container">
  <div class="card">
    <div class="logo">${logoHtml}</div>
    <h1>Twoja paczka została wysłana!</h1>
    <p>Cześć <span class="highlight">${data.customerName}</span>,</p>
    <p>Twoje zamówienie <span class="highlight">${data.product}</span> zostało nadane i jest w drodze do Twojego Paczkomatu.</p>

    <div class="info-box">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr><td style="padding:6px 0;font-size:13px;color:#808080;">Status</td><td style="padding:6px 0;text-align:right;"><span class="badge badge-blue">Wysłane</span></td></tr>
        ${data.trackingNumber ? `<tr><td style="padding:6px 0;font-size:13px;color:#808080;">Nr przesyłki</td><td style="padding:6px 0;font-size:13px;color:#E0E0E0;font-weight:600;text-align:right;">${data.trackingNumber}</td></tr>` : ""}
        <tr><td style="padding:6px 0;font-size:13px;color:#808080;">Paczkomat</td><td style="padding:6px 0;font-size:13px;color:#E0E0E0;font-weight:500;text-align:right;">${data.pickupPoint}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#808080;">Adres</td><td style="padding:6px 0;font-size:13px;color:#b0b0b0;font-weight:400;text-align:right;font-size:12px;">${data.pickupPointAddress}</td></tr>
      </table>
    </div>

    ${data.trackingNumber ? `<p>Możesz śledzić swoją przesyłkę na stronie InPost wpisując numer: <span class="highlight">${data.trackingNumber}</span></p>` : ""}
    <p>Odbierz paczkę z Paczkomatu <span class="highlight">${data.pickupPoint}</span> po otrzymaniu kodu odbioru SMS.</p>
  </div>
  <div class="footer">
    ${logoHtml}
  </div>
</div>
</body>
</html>`;
}

export function statusFulfilledEmail(data: FulfillmentData): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${baseStyle}</style></head>
<body>
<div class="container">
  <div class="card">
    <div class="logo">${logoHtml}</div>
    <h1>Zamówienie zrealizowane</h1>
    <p>Cześć <span class="highlight">${data.customerName}</span>,</p>
    <p>Twoje zamówienie <span class="highlight">${data.product}</span> zostało zrealizowane.</p>

    <div class="info-box">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr><td style="padding:6px 0;font-size:13px;color:#808080;">Status</td><td style="padding:6px 0;text-align:right;"><span class="badge badge-green">Zrealizowane</span></td></tr>
      </table>
    </div>

    <p>Dziękujemy za zakup! Jeśli masz jakiekolwiek pytania, odpowiedz na tego maila.</p>
  </div>
  <div class="footer">
    ${logoHtml}
  </div>
</div>
</body>
</html>`;
}
