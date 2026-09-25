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

function wrapEmailHtml(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank"><style>${BASE_CSS}</style></head><body>${html}</body></html>`;
}

export default function EmailFrame({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(240);
  const srcDoc = useMemo(() => wrapEmailHtml(html), [html]);

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
    <iframe
      ref={ref}
      title="Treść wiadomości"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={srcDoc}
      onLoad={onLoad}
      style={{ height }}
      className="block w-full bg-white rounded-lg border-0"
    />
  );
}
