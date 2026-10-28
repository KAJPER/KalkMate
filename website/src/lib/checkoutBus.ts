// Luzne polaczenie BuyNow <-> StickyBuyBar (bez wspolnego rodzica).
// - otwarcie formularza: window CustomEvent OPEN_CHECKOUT_EVENT (slucha BuyNow),
// - stan BuyNow (zamontowany, waluta, modal otwarty): maly store modulowy
//   (moduly sa wspolne dla chunkow), czytany przez useCheckoutState.

import { useSyncExternalStore } from "react";
import type { ShopCurrency } from "@/lib/content/shop";

export const OPEN_CHECKOUT_EVENT = "km:open-checkout";

export interface CheckoutState {
  ready: boolean; // BuyNow zamontowany (slucha OPEN_CHECKOUT_EVENT)
  currency: ShopCurrency | null;
  open: boolean; // modal zamowienia otwarty
}

const INITIAL: CheckoutState = { ready: false, currency: null, open: false };
let state: CheckoutState = INITIAL;
const listeners = new Set<() => void>();

export function publishCheckoutState(next: CheckoutState): void {
  if (next.ready === state.ready && next.currency === state.currency && next.open === state.open) return;
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function useCheckoutState(): CheckoutState {
  return useSyncExternalStore(subscribe, () => state, () => INITIAL);
}

export function requestOpenCheckout(): void {
  window.dispatchEvent(new CustomEvent(OPEN_CHECKOUT_EVENT));
}
