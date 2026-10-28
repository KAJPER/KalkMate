"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { rememberTouch } from "@/lib/clientAttribution";

// Query z sekretami (token weryfikacyjny/resetu hasla, client_secret Stripe,
// sesja P24, kod AI z /claim) nie powinno trafiac do statystyk wizyt.
const SECRET_PARAMS = [
  "token", "payment_intent", "payment_intent_client_secret", "setup_intent",
  "setup_intent_client_secret", "p24_session", "c", "callbackUrl",
];

function safeSearch(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    SECRET_PARAMS.forEach((k) => params.delete(k));
    const s = params.toString();
    return s ? `?${s}` : "";
  } catch {
    return "";
  }
}

export default function PageTracker() {
  const pathname = usePathname();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (lastTracked.current === pathname) return;
    // Pierwsza odslona po zaladowaniu strony = "wejscie" (ma znaczenie
    // document.referrer i ?utm_...). Kolejne to nawigacja wewnatrz strony —
    // referer wysylany przez nie bylby ciagle tym samym zewnetrznym adresem.
    const landing = lastTracked.current === null;
    lastTracked.current = pathname;

    // Panel admina nie jest ruchem klienckim — bez tego kazde otwarcie
    // /admin/* (przez nas, nie klientow) zawyzalo licznik "Wizyty" na
    // dashboardzie (zaobserwowane realnie na produkcji).
    // /opinia/<token> — token z maila nie trafia do statystyk wejsc.
    if (pathname?.startsWith("/admin") || pathname?.startsWith("/opinia")) return;

    if (typeof navigator !== "undefined" && navigator.doNotTrack === "1") return;

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page: pathname,
        referer: landing ? document.referrer : "",
        search: landing ? safeSearch() : "",
        landing,
      }),
      keepalive: true,
    })
      .then((r) => r.json())
      .then((d) => { if (d?.touch) rememberTouch(d.touch); })
      .catch(() => {});
  }, [pathname]);

  return null;
}
