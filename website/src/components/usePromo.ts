"use client";

import { useEffect, useState } from "react";
import { BLACK_FRIDAY, bfActive, type PromoState } from "@/lib/content/promo";

// Stan Black Friday w przegladarce (/api/promo, lib/promo.ts). Jedno zapytanie
// na zaladowanie strony, wspolne dla wszystkich komponentow. Zanim przyjdzie
// odpowiedz: zgadujemy po datach (sztuki nieznane = traktujemy jak dostepne;
// serwer i tak liczy cene sam przy platnosci).
let cache: PromoState | null = null;
let inflight: Promise<PromoState | null> | null = null;

function guess(): PromoState {
  const timeActive = bfActive();
  return {
    active: timeActive, timeActive, remaining: BLACK_FRIDAY.unitLimit, endsAt: BLACK_FRIDAY.endsAt,
    productPln: BLACK_FRIDAY.productPln, regularPln: BLACK_FRIDAY.regularPln,
    productEur: BLACK_FRIDAY.productEur, regularEur: BLACK_FRIDAY.regularEur, unitLimit: BLACK_FRIDAY.unitLimit,
  };
}

function load(): Promise<PromoState | null> {
  if (!inflight) {
    inflight = fetch("/api/promo")
      .then((r) => (r.ok ? (r.json() as Promise<PromoState>) : null))
      .then((s) => { if (s) cache = s; return s; })
      .catch(() => null);
  }
  return inflight;
}

export function usePromo(): PromoState {
  const [state, setState] = useState<PromoState>(() => cache ?? guess());
  useEffect(() => {
    // Poza oknem promocji nic nie pobieramy (zero dodatkowych zapytan przez caly rok).
    if (cache || !bfActive()) return;
    let alive = true;
    void load().then((s) => { if (alive && s) setState(s); });
    return () => { alive = false; };
  }, []);
  return state;
}
