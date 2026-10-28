"use client";

// Przyklejony pasek "Zamow" na dole ekranu — tylko mobile (< lg). 72% ruchu to
// telefony, a na / przewijaja srednio ~38% strony, wiec sekcja #kup-teraz
// czesto nie jest w ogole widziana.
// Widoczny po przewinieciu hero (#top); chowany, gdy w widoku jest #kup-teraz,
// gdy otwarty jest modal zamowienia albo gdy wisi baner cookies. Gdy widoczny,
// body dostaje klase km-sticky-bar (globals.css ustawia --km-sticky-bar-h,
// z ktorej korzysta przycisk czatu w SupportWidget).
// Nic nie renderuje, dopoki pasek nie ma sie pierwszy raz pokazac (CLS/LCP).

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { PRODUCT_CENTS, PRODUCT_NAME, formatMoney, type ShopCurrency } from "@/lib/content/shop";
import { CONSENT_EVENT, hasConsentChoice } from "@/components/consent";
import { requestOpenCheckout, useCheckoutState } from "@/lib/checkoutBus";
import { trackFunnel } from "@/lib/funnelClient";

const ORDER_LABEL: Record<Locale, string> = {
  pl: "Zamów",
  en: "Order",
  de: "Bestellen",
  cs: "Objednat",
  sk: "Objednať",
  lt: "Užsakyti",
  be: "Заказаць",
  es: "Pedir",
  pt: "Encomendar",
  fr: "Commander",
  it: "Ordina",
};

// Waluta zanim BuyNow sie zamontuje — jak domyslny kraj w BuyNow (/ i /be = PL).
const fallbackCurrency = (lang: Locale): ShopCurrency => (lang === "pl" || lang === "be" ? "PLN" : "EUR");

export default function StickyBuyBar({ lang = "pl" }: { lang?: Locale }) {
  const checkout = useCheckoutState();
  const [pastHero, setPastHero] = useState(false);
  const [buyVisible, setBuyVisible] = useState(false);
  const [bannerShown, setBannerShown] = useState(true);
  const [armed, setArmed] = useState(false);

  // Hero przewiniete w calosci (nad ekranem).
  useEffect(() => {
    const hero = document.getElementById("top");
    if (!hero) {
      const onScroll = () => setPastHero(window.scrollY > window.innerHeight);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }
    const io = new IntersectionObserver(([e]) => setPastHero(!e.isIntersecting && e.boundingClientRect.bottom <= 0));
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  // Sekcja kupna na ekranie — #kup-teraz istnieje dopiero po zamontowaniu BuyNow.
  useEffect(() => {
    if (!checkout.ready) return;
    const el = document.getElementById("kup-teraz");
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setBuyVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [checkout.ready]);

  // Baner cookies (CookieBanner) — pokazany, dopoki nie ma wyboru w aktualnej wersji.
  useEffect(() => {
    const check = () => setBannerShown(!hasConsentChoice());
    check();
    window.addEventListener(CONSENT_EVENT, check);
    return () => window.removeEventListener(CONSENT_EVENT, check);
  }, []);

  const show = pastHero && !buyVisible && !checkout.open && !bannerShown;

  // Pierwsze pokazanie "uzbraja" pasek (od tej pory tylko chowany translate).
  if (show && !armed) setArmed(true);

  useEffect(() => {
    document.body.classList.toggle("km-sticky-bar", show);
    return () => document.body.classList.remove("km-sticky-bar");
  }, [show]);

  if (!armed) return null;

  const currency = checkout.currency ?? fallbackCurrency(lang);
  const price = formatMoney(PRODUCT_CENTS[currency], currency, lang);

  const onClick = () => {
    trackFunnel("sticky_click", { lang });
    if (checkout.ready) requestOpenCheckout();
    else document.getElementById("kup-teraz")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      aria-hidden={!show}
      inert={!show}
      className={`fixed inset-x-0 bottom-0 z-[80] lg:hidden bg-[#0B0B0B]/95 backdrop-blur-md border-t border-[rgba(242,237,227,0.14)] pb-[env(safe-area-inset-bottom,0px)] transition-transform duration-300 ease-out motion-reduce:transition-none ${show ? "translate-y-0" : "translate-y-full"}`}
    >
      <div className="mx-auto max-w-3xl h-16 px-4 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="km-mono-eyebrow text-[10px] text-[#F2EDE3]/55 truncate">{PRODUCT_NAME}</p>
          <p className="text-[18px] font-semibold leading-tight text-[#F2EDE3]">{price}</p>
        </div>
        <button
          type="button"
          onClick={onClick}
          className="shrink-0 h-11 px-5 bg-[#D8FF3D] text-[#0B0B0B] km-mono-eyebrow text-[13px] hover:bg-[#F2EDE3] transition-colors flex items-center gap-3"
        >
          <span className="w-1.5 h-1.5 bg-[#0B0B0B] rounded-full km-blink" aria-hidden />
          {ORDER_LABEL[lang]}
          <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}
