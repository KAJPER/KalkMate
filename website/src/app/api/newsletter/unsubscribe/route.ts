import { NextRequest, NextResponse } from "next/server";
import { addUnsubscribe, verifyUnsubscribeToken } from "@/lib/newsletter";

// Publiczny link "Wypisz sie" ze stopki newslettera (podpisany HMAC-iem,
// patrz lib/newsletter.ts). GET pokazuje przycisk potwierdzenia — skanery
// linkow w skrzynkach (Outlook/antywirusy) otwieraja linki GET-em i bez tego
// wypisywalyby ludzi same. POST = faktyczne wypisanie; tego samego URL-a
// uzywa tez przycisk "Wypisz" w Gmailu (List-Unsubscribe-Post, RFC 8058).

function page(title: string, inner: string, status = 200) {
  const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · KalkMate</title><meta name="robots" content="noindex">
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0B0B0B;color:#F2EDE3;font-family:Inter,Segoe UI,Roboto,sans-serif;padding:16px}
.c{max-width:440px;width:100%;background:#141414;border:1px solid #2A2A2A;border-bottom:3px solid #D8FF3D;padding:32px 28px;text-align:center}
h1{font-size:22px;margin:0 0 10px}p{color:#9C9890;line-height:1.6;font-size:15px;margin:0 0 18px}
button{background:#D8FF3D;color:#0B0B0B;border:0;padding:14px 26px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;font-size:12px;cursor:pointer;border-radius:4px}
a{color:#F2EDE3}</style></head><body><div class="c">${inner}</div></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function params(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  return { email: (q.get("e") || "").trim().toLowerCase(), token: q.get("t") || "" };
}

export async function GET(request: NextRequest) {
  const { email, token } = params(request);
  if (!email || !verifyUnsubscribeToken(email, token)) {
    return page("Nieprawidłowy link", `<h1>Nieprawidłowy link</h1><p>Napisz do nas: <a href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</a> — wypiszemy Cię ręcznie.</p>`, 400);
  }
  return page(
    "Wypisz się",
    `<h1>Wypisać się z newslettera?</h1><p>Adres <strong>${esc(email)}</strong> nie będzie już dostawać newslettera KalkMate. Wiadomości o Twoich zamówieniach i koncie nadal będą przychodzić.</p>
<form method="post"><button type="submit">Tak, wypisz mnie</button></form>`
  );
}

export async function POST(request: NextRequest) {
  const { email, token } = params(request);
  if (!email || !verifyUnsubscribeToken(email, token)) {
    return page("Nieprawidłowy link", `<h1>Nieprawidłowy link</h1><p>Napisz do nas: <a href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</a>.</p>`, 400);
  }
  await addUnsubscribe(email);
  return page("Wypisano", `<h1>Wypisano ✓</h1><p>Adres <strong>${esc(email)}</strong> nie dostanie już newslettera. Jeśli to pomyłka, napisz na <a href="mailto:kontakt@kalkmate.pl">kontakt@kalkmate.pl</a>.</p>`);
}
