"use client";

import { useEffect, useRef } from "react";

// Odswiezanie co `ms`, wstrzymane gdy karta/okno jest ukryte (document.hidden)
// — panel bywa otwarty caly dzien w tle (tez w aplikacji Electron), a kazde
// odswiezenie to kilka zapytan do bazy/IMAP/OpenRouter. Po powrocie do karty
// dane odswiezaja sie od razu. Pierwsze wywolanie (przy montowaniu) robi sam
// komponent — hook tylko powtarza.
export function usePolling(fn: () => unknown, ms: number, enabled = true) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer === null) timer = setInterval(() => fnRef.current(), ms);
    };
    const stop = () => {
      if (timer !== null) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        fnRef.current();
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ms, enabled]);
}
