"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { rememberTouch } from "@/lib/clientAttribution";

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
    if (pathname?.startsWith("/admin")) return;

    if (typeof navigator !== "undefined" && navigator.doNotTrack === "1") return;

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page: pathname,
        referer: landing ? document.referrer : "",
        search: landing ? window.location.search : "",
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
