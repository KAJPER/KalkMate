"use client";

import { useSyncExternalStore } from "react";
import { useCart } from "@/components/CartContext";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import HtmlLang from "@/components/HtmlLang";
import Link from "next/link";
import { locales, localeHome, type Locale } from "@/lib/i18n";
import { formatMoney, MAX_ORDER_QUANTITY, PRODUCT_ID, clampQuantity } from "@/lib/content/shop";
import { rememberCallback } from "@/app/auth/callback";

const content: Record<Locale, {
  eyebrow: string;
  itemCount: (n: number) => string;
  titlePre: string; titleItalic: string;
  clearCart: string;
  emptyTitle: string;
  emptyBody: string;
  goToShop: string;
  colProduct: string; colQty: string; colSum: string;
  perUnit: string;
  limitNote: string;
  decrease: string; increase: string;
  removeAria: string;
  summary: string;
  products: (n: number) => string;
  shippingPl: string;
  shippingIntl: string;
  shippingIntlValue: string;
  free: string;
  toPay: string;
  toPayPlusShipping: string;
  checkout: string;
  loginAndOrder: string;
  badges: string[];
}> = {
  pl: {
    eyebrow: "[ koszyk ]",
    itemCount: (n) => `${n} ${n === 1 ? "produkt" : n < 5 ? "produkty" : "produktów"}`,
    titlePre: "Twój ", titleItalic: "koszyk",
    clearCart: "Wyczyść koszyk",
    emptyTitle: "Koszyk jest pusty",
    emptyBody: "Nie masz jeszcze żadnych produktów w koszyku. Dodaj KalkMate v3.0, aby kontynuować.",
    goToShop: "Przejdź do sklepu",
    colProduct: "Produkt", colQty: "Ilość", colSum: "Suma",
    perUnit: "/ szt.",
    limitNote: `max ${MAX_ORDER_QUANTITY} szt. na zamówienie`,
    decrease: "Zmniejsz ilość", increase: "Zwiększ ilość",
    removeAria: "Usuń z koszyka",
    summary: "/ Podsumowanie",
    products: (n) => `Produkty (${n} szt.)`,
    shippingPl: "Wysyłka InPost Paczkomat",
    shippingIntl: "Wysyłka kurierem",
    shippingIntlValue: "UE 20 € · świat 35 € / zamówienie",
    free: "GRATIS",
    toPay: "Do zapłaty",
    toPayPlusShipping: "Do zapłaty + wysyłka",
    checkout: "Przejdź do zamówienia",
    loginAndOrder: "Zaloguj się i zamów",
    badges: ["Bezpieczna płatność", "Gwarancja 24 mc", "Darmowa wysyłka InPost w PL"],
  },
  en: {
    eyebrow: "[ cart ]",
    itemCount: (n) => `${n} ${n === 1 ? "item" : "items"}`,
    titlePre: "Your ", titleItalic: "cart",
    clearCart: "Clear cart",
    emptyTitle: "Your cart is empty",
    emptyBody: "There's nothing in your cart yet. Add KalkMate v3.0 to continue.",
    goToShop: "Go to shop",
    colProduct: "Product", colQty: "Qty", colSum: "Subtotal",
    perUnit: "/ ea.",
    limitNote: `max ${MAX_ORDER_QUANTITY} units per order`,
    decrease: "Decrease quantity", increase: "Increase quantity",
    removeAria: "Remove from cart",
    summary: "/ Summary",
    products: (n) => `Products (${n})`,
    shippingPl: "InPost Parcel Locker shipping",
    shippingIntl: "Courier shipping",
    shippingIntlValue: "EU €20 · world €35 / order",
    free: "FREE",
    toPay: "Total",
    toPayPlusShipping: "Total + shipping",
    checkout: "Continue to checkout",
    loginAndOrder: "Sign in and order",
    badges: ["Secure payment", "24-month warranty", "Free InPost shipping in Poland"],
  },
  de: {
    eyebrow: "[ warenkorb ]",
    itemCount: (n) => `${n} Artikel`,
    titlePre: "Dein ", titleItalic: "Warenkorb",
    clearCart: "Warenkorb leeren",
    emptyTitle: "Dein Warenkorb ist leer",
    emptyBody: "Du hast noch keine Produkte im Warenkorb. Füge KalkMate v3.0 hinzu, um fortzufahren.",
    goToShop: "Zum Shop",
    colProduct: "Produkt", colQty: "Menge", colSum: "Summe",
    perUnit: "/ Stk.",
    limitNote: `max. ${MAX_ORDER_QUANTITY} Stück pro Bestellung`,
    decrease: "Menge verringern", increase: "Menge erhöhen",
    removeAria: "Aus dem Warenkorb entfernen",
    summary: "/ Übersicht",
    products: (n) => `Produkte (${n} Stk.)`,
    shippingPl: "Versand an InPost-Paketstation",
    shippingIntl: "Kurierversand",
    shippingIntlValue: "EU 20 € · Welt 35 € / Bestellung",
    free: "GRATIS",
    toPay: "Gesamt",
    toPayPlusShipping: "Gesamt + Versand",
    checkout: "Weiter zur Bestellung",
    loginAndOrder: "Anmelden und bestellen",
    badges: ["Sichere Zahlung", "24 Monate Garantie", "Kostenloser InPost-Versand in Polen"],
  },
};

function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (locales as readonly string[]).includes(v);
}

// Query czytane bez useSearchParams (ten wymagalby Suspense przy prerenderze):
// na serwerze "", w przegladarce aktualne window.location.search.
const noopSubscribe = () => () => {};
const clientSearch = () => window.location.search;
const serverSearch = () => "";

export default function CartPage() {
  const { items, removeItem, updateQuantity, clearCart, totalItems, totalPrice } = useCart();
  const { status } = useSession();
  const router = useRouter();

  // /koszyk nie ma wariantow /en, /de — jezyk z ?lang= (link z szuflady/menu),
  // potem z jezyka landingu, z ktorego dodano produkt.
  const search = useSyncExternalStore(noopSubscribe, clientSearch, serverSearch);
  const queryLang = new URLSearchParams(search).get("lang");
  const itemLang = items[0]?.lang;
  const lang: Locale = isLocale(queryLang) ? queryLang : isLocale(itemLang) ? itemLang : "pl";
  const t = content[lang];

  const cartCurrency = items[0]?.currency ?? "PLN";
  const isPln = cartCurrency === "PLN";

  const handleCheckout = () => {
    // Checkout zyje w sekcji BuyNow landingu w tym samym jezyku. Ilosc idzie
    // w ?qty= (przezywa tez przekierowanie przez logowanie).
    const qty = clampQuantity(items.find((i) => i.id === PRODUCT_ID)?.quantity ?? totalItems);
    const target = `${localeHome(lang)}?checkout=true&qty=${qty}#kup-teraz`;
    if (status !== "authenticated") {
      rememberCallback(target);
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(target)}`);
      return;
    }
    router.push(target);
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F2EDE3]">
      {lang !== "pl" && <HtmlLang lang={lang} />}
      <Navigation lang={lang} />

      <main className="pt-28 lg:pt-32 pb-24">
        <div className="max-w-5xl mx-auto px-5 lg:px-10">
          {/* Header */}
          <div className="flex items-center justify-between gap-6 border-b border-[rgba(242,237,227,0.10)] pb-5 mb-10">
            <div>
              <p className="km-mono-eyebrow text-[#D8FF3D]">
                {t.eyebrow} · {t.itemCount(totalItems)}
              </p>
              <h1 className="km-display text-[clamp(48px,7vw,96px)] mt-3 leading-[0.92]">
                {t.titlePre}
                <span className="italic text-[#D8FF3D]">{t.titleItalic}</span>.
              </h1>
            </div>
            {items.length > 0 && (
              <button
                onClick={clearCart}
                className="km-mono-eyebrow text-[#F2EDE3]/40 hover:text-[#FF4D2E] transition-colors hidden sm:block"
              >
                {t.clearCart}
              </button>
            )}
          </div>

          {items.length === 0 ? (
            /* Empty state */
            <div className="text-center py-20">
              <div className="mx-auto w-20 h-20 border border-[rgba(242,237,227,0.12)] flex items-center justify-center mb-8">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-[#F2EDE3]/25"
                >
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 01-8 0" />
                </svg>
              </div>
              <h2 className="km-display text-3xl mb-3">{t.emptyTitle}</h2>
              <p className="text-[#F2EDE3]/50 mb-8 max-w-sm mx-auto">{t.emptyBody}</p>
              <Link
                href={`${localeHome(lang)}#kup-teraz`}
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#D8FF3D] text-[#0B0B0B] km-mono-eyebrow hover:bg-[#F2EDE3] transition-colors"
              >
                <span className="w-1.5 h-1.5 bg-[#0B0B0B] rounded-full km-blink" />
                {t.goToShop}
              </Link>
            </div>
          ) : (
            <div className="grid lg:grid-cols-[1fr_380px] gap-8 lg:gap-12 items-start">
              {/* Products */}
              <div className="space-y-4">
                {/* Table header — desktop */}
                <div className="hidden sm:grid grid-cols-[1fr_140px_140px_40px] gap-4 px-4 pb-2 border-b border-[rgba(242,237,227,0.10)]">
                  <span className="km-mono-eyebrow text-[#F2EDE3]/40">{t.colProduct}</span>
                  <span className="km-mono-eyebrow text-[#F2EDE3]/40 text-center">{t.colQty}</span>
                  <span className="km-mono-eyebrow text-[#F2EDE3]/40 text-right">{t.colSum}</span>
                  <span />
                </div>

                {items.map((item) => (
                  <div
                    key={item.id}
                    className="border border-[rgba(242,237,227,0.10)] bg-[#0E0E0E] p-4 sm:p-5"
                  >
                    <div className="sm:grid sm:grid-cols-[1fr_140px_140px_40px] sm:gap-4 sm:items-center">
                      {/* Product info */}
                      <div>
                        <p className="km-mono-eyebrow text-[#D8FF3D] text-[10px] mb-1">
                          / KM-v3.0 · ORDER
                        </p>
                        <p className="text-[16px] text-[#F2EDE3] font-medium">
                          {item.name}
                        </p>
                        <p className="text-sm text-[#F2EDE3]/50 mt-0.5">
                          {formatMoney(item.price, item.currency ?? "PLN", lang)} {t.perUnit}
                        </p>
                      </div>

                      {/* Ilosc 1..MAX_ORDER_QUANTITY (wysylka stala na zamowienie) */}
                      <div className="flex flex-col items-center justify-center mt-4 sm:mt-0">
                        <div className="flex items-center border border-[rgba(242,237,227,0.20)]">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            aria-label={t.decrease}
                            className="w-9 h-9 flex items-center justify-center text-[#F2EDE3] hover:bg-[#F2EDE3] hover:text-[#0B0B0B] transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#F2EDE3]"
                          >
                            −
                          </button>
                          <span className="w-10 text-center text-[#F2EDE3] km-mono-eyebrow" aria-live="polite">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            disabled={item.quantity >= MAX_ORDER_QUANTITY}
                            aria-label={t.increase}
                            className="w-9 h-9 flex items-center justify-center text-[#F2EDE3] hover:bg-[#F2EDE3] hover:text-[#0B0B0B] transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#F2EDE3]"
                          >
                            +
                          </button>
                        </div>
                        <span className="km-mono-eyebrow text-[#F2EDE3]/35 text-[10px] mt-1.5 text-center">
                          {t.limitNote}
                        </span>
                      </div>

                      {/* Subtotal */}
                      <div className="text-right mt-3 sm:mt-0">
                        <span className="km-display text-xl text-[#F2EDE3]">
                          {formatMoney(item.price * item.quantity, item.currency ?? "PLN", lang)}
                        </span>
                      </div>

                      {/* Remove */}
                      <div className="flex justify-end mt-3 sm:mt-0">
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-[#F2EDE3]/30 hover:text-[#FF4D2E] transition-colors p-1"
                          aria-label={t.removeAria}
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Mobile clear */}
                <button
                  onClick={clearCart}
                  className="sm:hidden km-mono-eyebrow text-[#F2EDE3]/40 hover:text-[#FF4D2E] transition-colors w-full text-center py-2"
                >
                  {t.clearCart}
                </button>
              </div>

              {/* Order summary */}
              <div className="lg:sticky lg:top-24">
                <div className="relative border border-[rgba(242,237,227,0.18)] bg-[#0B0B0B]">
                  {/* Corner ticks */}
                  <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-l border-t border-[#D8FF3D]" />
                  <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-r border-t border-[#D8FF3D]" />
                  <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-l border-b border-[#D8FF3D]" />
                  <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-r border-b border-[#D8FF3D]" />

                  <div className="px-6 py-4 border-b border-[rgba(242,237,227,0.10)]">
                    <span className="km-mono-eyebrow text-[#D8FF3D]">{t.summary}</span>
                  </div>

                  <div className="p-6 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#F2EDE3]/65">{t.products(totalItems)}</span>
                      <span className="text-[#F2EDE3]">
                        {formatMoney(totalPrice, cartCurrency, lang)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#F2EDE3]/65">
                        {isPln ? t.shippingPl : t.shippingIntl}
                      </span>
                      {isPln ? (
                        <span className="km-mono-eyebrow text-[#D8FF3D]">{t.free}</span>
                      ) : (
                        <span className="text-[#F2EDE3]/65">{t.shippingIntlValue}</span>
                      )}
                    </div>
                    <div className="flex justify-between pt-4 border-t border-[rgba(242,237,227,0.10)]">
                      <span className="km-mono-eyebrow text-[#F2EDE3]">
                        {isPln ? t.toPay : t.toPayPlusShipping}
                      </span>
                      <span className="km-display text-3xl text-[#F2EDE3]">
                        {formatMoney(totalPrice, cartCurrency, lang)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleCheckout}
                    className="group w-full px-6 py-5 bg-[#D8FF3D] text-[#0B0B0B] km-mono-eyebrow text-[13px] hover:bg-[#F2EDE3] transition-colors flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-[#0B0B0B] rounded-full km-blink" />
                      {status === "authenticated" ? t.checkout : t.loginAndOrder}
                    </span>
                    <span>→</span>
                  </button>
                </div>

                {/* Trust badges */}
                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
                  {t.badges.map((b) => (
                    <span key={b} className="km-mono-eyebrow text-[#F2EDE3]/40 flex items-center gap-2 text-[11px]">
                      <span className="w-1 h-1 bg-[#D8FF3D] rounded-full" />
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer lang={lang} />
    </div>
  );
}
