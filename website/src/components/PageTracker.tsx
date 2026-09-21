"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function PageTracker() {
  const pathname = usePathname();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (lastTracked.current === pathname) return;
    lastTracked.current = pathname;

    // Panel admina nie jest ruchem klienckim — bez tego kazde otwarcie
    // /admin/* (przez nas, nie klientow) zawyzalo licznik "Wizyty" na
    // dashboardzie (zaobserwowane realnie na produkcji).
    if (pathname?.startsWith("/admin")) return;

    if (typeof navigator !== "undefined" && navigator.doNotTrack === "1") return;

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: pathname, referer: document.referrer }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
