"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "kalkmate-cookie-consent";
const CLARITY_PROJECT_ID = "xnarb47w07";

interface ConsentRecord {
  v: string;
  choice: "all" | "essential";
  at: string;
}

function hasAnalyticsConsent(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    return (JSON.parse(raw) as ConsentRecord)?.choice === "all";
  } catch {
    return false;
  }
}

// Ładujemy Clarity dopiero po zgodzie na cookies analityczne (patrz CookieBanner) —
// bez zgody wcale nie inicjalizujemy skryptu, zamiast inicjalizować i cofać consent.
export default function ClarityAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    // Panel admina — nie nagrywaj sesji wlasciciela/personelu razem z
    // klientami sklepu, to inny kontekst i nie ma tu po co sledzic.
    if (pathname?.startsWith("/admin")) return;

    let started = false;

    const start = () => {
      if (started || !hasAnalyticsConsent()) return;
      started = true;
      import("@microsoft/clarity").then(({ default: Clarity }) => {
        Clarity.init(CLARITY_PROJECT_ID);
      });
    };

    start();
    window.addEventListener("kalkmate:cookie-consent", start);
    return () => window.removeEventListener("kalkmate:cookie-consent", start);
  }, [pathname]);

  return null;
}
