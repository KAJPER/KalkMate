"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { CONSENT_EVENT, hasAnalyticsConsent } from "@/components/consent";

const CLARITY_PROJECT_ID = "xnarb47w07";

// Sekcje, ktorych NIE nagrywamy: panel admina (personel), panel klienta
// (tresc czatow AI — czesto nieletni uczniowie), logowanie/rejestracja/reset
// hasla (tokeny w URL, hasla) i parowanie urzadzenia (kod AI).
const BLOCKED_PREFIXES = ["/admin", "/panel", "/auth", "/claim", "/opinia"]; // /opinia/<token> — token w adresie

// Parametry z sekretami — powrot ze Stripe/P24, linki weryfikacyjne itp.
const SENSITIVE_PARAMS = [
  "token",
  "payment_intent",
  "payment_intent_client_secret",
  "setup_intent",
  "setup_intent_client_secret",
  "redirect_status",
  "p24_session",
];

function isBlockedPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return BLOCKED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function urlHasSecrets(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    if (SENSITIVE_PARAMS.some((k) => params.has(k))) return true;
    return /token=|client_secret/i.test(window.location.hash);
  } catch {
    return true;
  }
}

type ClarityFn = (...args: unknown[]) => void;

// Ładujemy Clarity dopiero po zgodzie na cookies analityczne (patrz CookieBanner) —
// bez zgody wcale nie inicjalizujemy skryptu, zamiast inicjalizować i cofać consent.
export default function ClarityAnalytics() {
  const pathname = usePathname();
  // Clarity zatrzymany przez wejscie w chroniona sekcje (nawigacja kliencka —
  // skrypt zostaje w pamieci po przejsciu z landingu np. na /auth/signin).
  const stoppedRef = useRef(false);

  useEffect(() => {
    const w = window as unknown as { clarity?: ClarityFn };

    if (isBlockedPath(pathname) || urlHasSecrets()) {
      if (typeof w.clarity === "function" && !stoppedRef.current) {
        try { w.clarity("stop"); } catch { /* ignore */ }
        stoppedRef.current = true;
      }
      return;
    }

    if (stoppedRef.current) {
      // Powrot na publiczna strone w tej samej sesji SPA — wznow nagrywanie.
      stoppedRef.current = false;
      if (typeof w.clarity === "function" && hasAnalyticsConsent()) {
        try { w.clarity("start"); } catch { /* ignore */ }
      }
      return;
    }

    let started = false;

    const start = () => {
      if (started || !hasAnalyticsConsent()) return;
      // Zgoda mogla przyjsc juz po przejsciu na chroniona strone.
      if (isBlockedPath(window.location.pathname) || urlHasSecrets()) return;
      started = true;
      import("@microsoft/clarity").then(({ default: Clarity }) => {
        Clarity.init(CLARITY_PROJECT_ID);
      });
    };

    start();
    window.addEventListener(CONSENT_EVENT, start);
    return () => window.removeEventListener(CONSENT_EVENT, start);
  }, [pathname]);

  return null;
}
