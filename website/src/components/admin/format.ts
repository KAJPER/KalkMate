// Wspolne formatowanie w panelu admina (kwoty, daty, rozmiary, CSV).
//
// Daty ZAWSZE w strefie Europe/Warsaw — panel dziala tez w aplikacji Electron
// i na komputerach z inna strefa systemowa; godzina zamowienia ma byc ta sama,
// co w mailu do klienta i w bazie (czas polski).

export const ADMIN_TZ = "Europe/Warsaw";

type DateInput = number | string | Date;

// number = sekundy (jak `created` z /api/admin/orders) gdy < 1e11, inaczej ms.
function toDate(v: DateInput): Date {
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(v < 1e11 ? v * 1000 : v);
  return new Date(v);
}

// "16.10.2026, 14:05" (opcjonalnie z sekundami) w czasie polskim.
export function fmtDateTime(v: DateInput, opts: { seconds?: boolean } = {}): string {
  const d = toDate(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("pl-PL", {
    timeZone: ADMIN_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(opts.seconds ? { second: "2-digit" } : {}),
  });
}

// "2026-10-16 14:05" — do CSV / nazw plikow (sortowalne), w czasie polskim.
export function fmtIsoLocal(v: DateInput, withTime = true): string {
  const d = toDate(v);
  if (isNaN(d.getTime())) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: ADMIN_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value])
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return withTime ? `${date} ${parts.hour}:${parts.minute}` : date;
}

// Kwota w groszach/centach -> "189.00 zł" / "189.00 €".
export function formatAmount(amount: number, currency: string): string {
  const value = (amount / 100).toFixed(2);
  const symbol = currency?.toLowerCase() === "eur" ? "€" : "zł";
  return `${value} ${symbol}`;
}

// Grosze -> "1 234,50 zł".
export const zl = (gr: number) => (gr / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2 }) + " zł";

export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Komorka CSV (separator ";", Excel PL):
//  - ochrona przed CSV/formula injection — wartosc zaczynajaca sie od
//    = + - @ TAB CR dostaje prefiks ' (Excel/LibreOffice nie wykona jej jako
//    formuly; dane klienta typu imie/adres pochodza z formularza zamowienia),
//  - same cyfry (numer przesylki, kod AI z zerem na poczatku, dlugie numery)
//    jako tekst ="..." — inaczej Excel zrobi z nich 6,2E+17 / zgubi zera.
//    Bezpieczne, bo tylko dla wartosci zlozonych wylacznie z cyfr.
export function csvCell(v: string | number | null | undefined, opts: { text?: boolean } = {}): string {
  let t = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  else if (/^\d+$/.test(t) && (opts.text || t.length >= 6 || (t.length > 1 && t.startsWith("0")))) return `="${t}"`;
  return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

// Pobranie pliku przez <a download> — dziala tez w aplikacji Electron
// (window.open(blob:) trafia tam do shell.openExternal i nic sie nie dzieje),
// a przegladarki nie blokuja tego jako popupu.
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Chwila zwloki — czesc przegladarek czyta blob asynchronicznie po click().
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
