"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Podglad HTML maila od nadawcy z internetu (NIEZAUFANY). Sandbox BEZ
// allow-scripts — zaden <script>/onerror z maila sie nie wykona; allow-same-origin
// jest po to, zeby rodzic mogl zmierzyc tresc i dopasowac ja do ekranu (bez
// skryptow z maila samo w sobie nie jest to dziura). allow-popups: linki
// (<base target="_blank">) otwieraja sie w nowej karcie zamiast podmieniac tresc.
//
// Problem na telefonie: maile maja zwykle stala szerokosc ~600 px, wiec na
// ekranie 390 px dawaly poziomy scroll wewnatrz iframe i wysoka ramke ze
// scrollem w scrollu. Tu: (1) domyslny styl (zawijanie, obrazki max 100%),
// (2) skalowanie calosci w dol, gdy tresc jest szersza niz ramka, (3) ramka
// dopasowuje wysokosc do tresci — przewija sie tylko strona.

const BASE_CSS = `
html{-webkit-text-size-adjust:100%}
body{margin:0;padding:12px;font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#222;background:#fff;overflow-wrap:anywhere}
img{max-width:100%;height:auto}
pre{white-space:pre-wrap}
blockquote{margin-left:0;padding-left:12px;border-left:3px solid #ccc}
`;

// Zdalne obrazki w mailach to czesto piksele sledzace (nadawca widzi, ze i kiedy
// mail zostal otwarty, z jakiego IP). Domyslnie CSP w ramce blokuje wszystko
// poza obrazkami wbudowanymi (data:/cid:) i stylami inline; "Pokaz obrazy"
// dopuszcza https:. CSP z <meta> musi byc PRZED trescia maila — stad w <head>.
const CSP_BLOCKED = "default-src 'none'; img-src data: cid:; style-src 'unsafe-inline'; font-src data:";
const CSP_IMAGES = "default-src 'none'; img-src data: cid: https:; style-src 'unsafe-inline'; font-src data:";

function wrapEmailHtml(html: string, showImages: boolean): string {
  const csp = showImages ? CSP_IMAGES : CSP_BLOCKED;
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${csp}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank"><style>${BASE_CSS}</style></head><body>${html}</body></html>`;
}

// Czy mail w ogole ma zdalne obrazki (<img src=http...>, url(http...) w stylach,
// background=) — tylko wtedy pokazujemy pasek "Pokaz obrazy".
const REMOTE_IMG_RE = /<img\b[^>]*\bsrc\s*=\s*["']?\s*(https?:)?\/\/|url\(\s*["']?\s*(https?:)?\/\/|\bbackground\s*=\s*["']?\s*(https?:)?\/\//i;

export default function EmailFrame({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(240);
  // Zgoda na obrazy dotyczy TEGO maila — inny mail znowu startuje z blokada.
  const [imagesFor, setImagesFor] = useState<string | null>(null);
  const showImages = imagesFor === html;
  const hasRemote = useMemo(() => REMOTE_IMG_RE.test(html), [html]);
  const srcDoc = useMemo(() => wrapEmailHtml(html, showImages), [html, showImages]);

  const fit = useCallback(() => {
    const frame = ref.current;
    const doc = frame?.contentDocument;
    const root = doc?.documentElement;
    const body = doc?.body;
    if (!frame || !doc || !root || !body) return;

    // Zerujemy poprzednie skalowanie, zeby zmierzyc naturalna szerokosc tresci.
    body.style.transform = "";
    body.style.transformOrigin = "";
    body.style.minWidth = "";
    body.style.boxSizing = "";
    const avail = frame.clientWidth;
    const natural = Math.max(root.scrollWidth, body.scrollWidth);

    let scale = 1;
    if (avail > 0 && natural > avail + 1) {
      scale = avail / natural;
      body.style.boxSizing = "border-box";
      body.style.minWidth = `${natural}px`;
      body.style.transformOrigin = "0 0";
      body.style.transform = `scale(${scale})`;
    }

    const rect = body.getBoundingClientRect();
    const marginBottom = parseFloat(doc.defaultView?.getComputedStyle(body).marginBottom || "0") || 0;
    setHeight(Math.max(120, Math.ceil(rect.bottom + marginBottom * scale) + 2));
  }, []);

  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    // Zmiana szerokosci ramki (obrot telefonu, otwarcie/zamkniecie panelu).
    const ro = new ResizeObserver(() => fit());
    ro.observe(frame);
    return () => ro.disconnect();
  }, [fit]);

  const onLoad = () => {
    fit();
    // Obrazki doladowuja sie po zdarzeniu load ramki i zmieniaja wysokosc.
    const doc = ref.current?.contentDocument;
    if (doc) Array.from(doc.images).forEach((img) => img.addEventListener("load", fit));
    setTimeout(fit, 400);
    setTimeout(fit, 1500);
  };

  return (
    <div>
      {hasRemote && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#3F4147] bg-[#2B2D31] px-3 py-2 text-xs text-[#E0E0E0]/70">
          <span>
            {showImages
              ? "Obrazy z internetu są wyświetlane."
              : "Obrazy z internetu zablokowane — mogą informować nadawcę, że mail został otwarty."}
          </span>
          <button
            type="button"
            onClick={() => setImagesFor(showImages ? null : html)}
            className="px-2.5 py-1 rounded-md bg-[#313338] border border-[#3F4147] text-[#3B82F6] hover:bg-[#3F4147]"
          >
            {showImages ? "Ukryj obrazy" : "Pokaż obrazy"}
          </button>
        </div>
      )}
      {/* Sandbox BEZ allow-scripts — skrypty z maila nigdy sie nie wykonaja. */}
      <iframe
        ref={ref}
        title="Treść wiadomości"
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        srcDoc={srcDoc}
        onLoad={onLoad}
        style={{ height }}
        className="block w-full bg-white rounded-lg border-0"
      />
    </div>
  );
}
