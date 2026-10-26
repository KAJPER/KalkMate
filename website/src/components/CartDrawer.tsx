"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/components/CartContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { localeFromPathname, type Locale } from "@/lib/i18n";
import { formatMoney, MAX_ORDER_QUANTITY } from "@/lib/content/shop";

const content: Record<Locale, {
  heading: string;
  itemCount: (n: number) => string;
  closeCart: string;
  emptyTitle: string;
  emptyBody: string;
  continueShopping: string;
  perUnit: string;
  removeFromCart: string;
  products: string;
  shipping: string;
  shippingIntl: string;
  shippingAtCheckout: string;
  free: string;
  total: string;
  totalPlusShipping: string;
  goToCart: string;
  quantity: string;
  limitNote: string;
  decrease: string;
  increase: string;
}> = {
  pl: {
    heading: "/ Koszyk",
    itemCount: (n) => `${n} ${n === 1 ? "produkt" : n < 5 ? "produkty" : "produktów"}`,
    closeCart: "Zamknij koszyk",
    emptyTitle: "Koszyk jest pusty",
    emptyBody: "Dodaj KalkMate do koszyka, aby kontynuować.",
    continueShopping: "Kontynuuj zakupy",
    perUnit: "/ szt.",
    removeFromCart: "Usuń z koszyka",
    products: "Produkty",
    shipping: "Wysyłka InPost",
    shippingIntl: "Wysyłka",
    shippingAtCheckout: "UE 20 € · świat 35 € / zamówienie",
    free: "GRATIS",
    total: "Razem",
    totalPlusShipping: "Razem + wysyłka",
    goToCart: "Przejdź do koszyka →",
    quantity: "Ilość",
    limitNote: `max ${MAX_ORDER_QUANTITY} szt. na zamówienie`,
    decrease: "Zmniejsz ilość",
    increase: "Zwiększ ilość",
  },
  en: {
    heading: "/ Cart",
    itemCount: (n) => `${n} ${n === 1 ? "item" : "items"}`,
    closeCart: "Close cart",
    emptyTitle: "Your cart is empty",
    emptyBody: "Add KalkMate to your cart to continue.",
    continueShopping: "Continue shopping",
    perUnit: "/ ea.",
    removeFromCart: "Remove from cart",
    products: "Products",
    shipping: "InPost shipping",
    shippingIntl: "Shipping",
    shippingAtCheckout: "EU €20 · world €35 / order",
    free: "FREE",
    total: "Total",
    totalPlusShipping: "Total + shipping",
    goToCart: "Go to cart →",
    quantity: "Qty",
    limitNote: `max ${MAX_ORDER_QUANTITY} units per order`,
    decrease: "Decrease quantity",
    increase: "Increase quantity",
  },
  de: {
    heading: "/ Warenkorb",
    itemCount: (n) => `${n} Artikel`,
    closeCart: "Warenkorb schließen",
    emptyTitle: "Ihr Warenkorb ist leer",
    emptyBody: "Fügen Sie KalkMate zum Warenkorb hinzu, um fortzufahren.",
    continueShopping: "Weiter einkaufen",
    perUnit: "/ Stk.",
    removeFromCart: "Aus dem Warenkorb entfernen",
    products: "Produkte",
    shipping: "InPost-Versand",
    shippingIntl: "Versand",
    shippingAtCheckout: "EU 20 € · Welt 35 € / Bestellung",
    free: "GRATIS",
    total: "Gesamt",
    totalPlusShipping: "Gesamt + Versand",
    goToCart: "Zum Warenkorb →",
    quantity: "Menge",
    limitNote: `max. ${MAX_ORDER_QUANTITY} Stück pro Bestellung`,
    decrease: "Menge verringern",
    increase: "Menge erhöhen",
  },
  cs: {
    heading: "/ Košík",
    itemCount: (n) => `${n} ${n === 1 ? "produkt" : n >= 2 && n <= 4 ? "produkty" : "produktů"}`,
    closeCart: "Zavřít košík",
    emptyTitle: "Košík je prázdný",
    emptyBody: "Pro pokračování přidejte KalkMate do košíku.",
    continueShopping: "Pokračovat v nákupu",
    perUnit: "/ ks",
    removeFromCart: "Odebrat z košíku",
    products: "Produkty",
    shipping: "Doprava InPost",
    shippingIntl: "Doprava",
    shippingAtCheckout: "EU 20 € · svět 35 € / objednávka",
    free: "ZDARMA",
    total: "Celkem",
    totalPlusShipping: "Celkem + doprava",
    goToCart: "Přejít do košíku →",
    quantity: "Množství",
    limitNote: `max. ${MAX_ORDER_QUANTITY} ks na objednávku`,
    decrease: "Snížit množství",
    increase: "Zvýšit množství",
  },
  sk: {
    heading: "/ Košík",
    itemCount: (n) => `${n} ${n === 1 ? "produkt" : n >= 2 && n <= 4 ? "produkty" : "produktov"}`,
    closeCart: "Zavrieť košík",
    emptyTitle: "Košík je prázdny",
    emptyBody: "Pre pokračovanie pridajte KalkMate do košíka.",
    continueShopping: "Pokračovať v nákupe",
    perUnit: "/ ks",
    removeFromCart: "Odstrániť z košíka",
    products: "Produkty",
    shipping: "Doprava InPost",
    shippingIntl: "Doprava",
    shippingAtCheckout: "EÚ 20 € · svet 35 € / objednávka",
    free: "ZADARMO",
    total: "Spolu",
    totalPlusShipping: "Spolu + doprava",
    goToCart: "Prejsť do košíka →",
    quantity: "Množstvo",
    limitNote: `max. ${MAX_ORDER_QUANTITY} ks na objednávku`,
    decrease: "Znížiť množstvo",
    increase: "Zvýšiť množstvo",
  },
  lt: {
    heading: "/ Krepšelis",
    itemCount: (n) => {
      const m10 = n % 10, m100 = n % 100;
      const w = m10 === 1 && m100 !== 11 ? "prekė"
        : m10 >= 2 && (m100 < 11 || m100 > 19) ? "prekės" : "prekių";
      return `${n} ${w}`;
    },
    closeCart: "Uždaryti krepšelį",
    emptyTitle: "Krepšelis tuščias",
    emptyBody: "Norėdami tęsti, įdėkite KalkMate į krepšelį.",
    continueShopping: "Tęsti apsipirkimą",
    perUnit: "/ vnt.",
    removeFromCart: "Pašalinti iš krepšelio",
    products: "Prekės",
    shipping: "InPost pristatymas",
    shippingIntl: "Pristatymas",
    shippingAtCheckout: "ES 20 € · pasaulis 35 € / užsakymas",
    free: "NEMOKAMAI",
    total: "Iš viso",
    totalPlusShipping: "Iš viso + pristatymas",
    goToCart: "Į krepšelį →",
    quantity: "Kiekis",
    limitNote: `daugiausia ${MAX_ORDER_QUANTITY} vnt. užsakyme`,
    decrease: "Sumažinti kiekį",
    increase: "Padidinti kiekį",
  },
  be: {
    heading: "/ Кошык",
    itemCount: (n) => {
      const m10 = n % 10, m100 = n % 100;
      const w = m10 === 1 && m100 !== 11 ? "тавар"
        : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? "тавары" : "тавараў";
      return `${n} ${w}`;
    },
    closeCart: "Закрыць кошык",
    emptyTitle: "Кошык пусты",
    emptyBody: "Дадайце KalkMate у кошык, каб працягнуць.",
    continueShopping: "Працягнуць пакупкі",
    perUnit: "/ шт.",
    removeFromCart: "Выдаліць з кошыка",
    products: "Тавары",
    shipping: "Дастаўка InPost",
    shippingIntl: "Дастаўка",
    shippingAtCheckout: "ЕС 20 € · свет 35 € / замова",
    free: "БЯСПЛАТНА",
    total: "Разам",
    totalPlusShipping: "Разам + дастаўка",
    goToCart: "Перайсці ў кошык →",
    quantity: "Колькасць",
    limitNote: `макс. ${MAX_ORDER_QUANTITY} шт. на замову`,
    decrease: "Паменшыць колькасць",
    increase: "Павялічыць колькасць",
  },
  es: {
    heading: "/ Carrito",
    itemCount: (n) => `${n} ${n === 1 ? "producto" : "productos"}`,
    closeCart: "Cerrar carrito",
    emptyTitle: "Tu carrito está vacío",
    emptyBody: "Añade KalkMate al carrito para continuar.",
    continueShopping: "Seguir comprando",
    perUnit: "/ ud.",
    removeFromCart: "Eliminar del carrito",
    products: "Productos",
    shipping: "Envío InPost",
    shippingIntl: "Envío",
    shippingAtCheckout: "UE 20 € · mundo 35 € / pedido",
    free: "GRATIS",
    total: "Total",
    totalPlusShipping: "Total + envío",
    goToCart: "Ir al carrito →",
    quantity: "Cantidad",
    limitNote: `máx. ${MAX_ORDER_QUANTITY} uds. por pedido`,
    decrease: "Reducir cantidad",
    increase: "Aumentar cantidad",
  },
  pt: {
    heading: "/ Carrinho",
    itemCount: (n) => `${n} ${n === 1 ? "produto" : "produtos"}`,
    closeCart: "Fechar carrinho",
    emptyTitle: "O seu carrinho está vazio",
    emptyBody: "Adicione o KalkMate ao carrinho para continuar.",
    continueShopping: "Continuar a comprar",
    perUnit: "/ un.",
    removeFromCart: "Remover do carrinho",
    products: "Produtos",
    shipping: "Envio InPost",
    shippingIntl: "Envio",
    shippingAtCheckout: "UE 20 € · mundo 35 € / encomenda",
    free: "GRÁTIS",
    total: "Total",
    totalPlusShipping: "Total + envio",
    goToCart: "Ir para o carrinho →",
    quantity: "Qtd.",
    limitNote: `máx. ${MAX_ORDER_QUANTITY} un. por encomenda`,
    decrease: "Diminuir quantidade",
    increase: "Aumentar quantidade",
  },
  fr: {
    heading: "/ Panier",
    itemCount: (n) => `${n} ${n === 1 ? "article" : "articles"}`,
    closeCart: "Fermer le panier",
    emptyTitle: "Votre panier est vide",
    emptyBody: "Ajoutez KalkMate au panier pour continuer.",
    continueShopping: "Continuer mes achats",
    perUnit: "/ pce",
    removeFromCart: "Retirer du panier",
    products: "Produits",
    shipping: "Livraison InPost",
    shippingIntl: "Livraison",
    shippingAtCheckout: "UE 20 € · monde 35 € / commande",
    free: "GRATUIT",
    total: "Total",
    totalPlusShipping: "Total + livraison",
    goToCart: "Voir le panier →",
    quantity: "Qté",
    limitNote: `max. ${MAX_ORDER_QUANTITY} unités par commande`,
    decrease: "Diminuer la quantité",
    increase: "Augmenter la quantité",
  },
  it: {
    heading: "/ Carrello",
    itemCount: (n) => `${n} ${n === 1 ? "prodotto" : "prodotti"}`,
    closeCart: "Chiudi carrello",
    emptyTitle: "Il carrello è vuoto",
    emptyBody: "Aggiungi KalkMate al carrello per continuare.",
    continueShopping: "Continua lo shopping",
    perUnit: "/ pz.",
    removeFromCart: "Rimuovi dal carrello",
    products: "Prodotti",
    shipping: "Spedizione InPost",
    shippingIntl: "Spedizione",
    shippingAtCheckout: "UE 20 € · mondo 35 € / ordine",
    free: "GRATIS",
    total: "Totale",
    totalPlusShipping: "Totale + spedizione",
    goToCart: "Vai al carrello →",
    quantity: "Quantità",
    limitNote: `max ${MAX_ORDER_QUANTITY} pz. per ordine`,
    decrease: "Diminuisci quantità",
    increase: "Aumenta quantità",
  },
};

export default function CartDrawer() {
  const lang = localeFromPathname(usePathname());
  const t = content[lang];
  const {
    items,
    removeItem,
    updateQuantity,
    totalItems,
    totalPrice,
    isDrawerOpen,
    closeDrawer,
  } = useCart();
  const drawerRef = useRef<HTMLDivElement>(null);
  // Jeden produkt w koszyku -> jedna waluta. PLN = Polska (darmowy InPost).
  const cartCurrency = items[0]?.currency ?? "PLN";
  const isPln = cartCurrency === "PLN";
  const cartHref = lang === "pl" ? "/koszyk" : `/koszyk?lang=${lang}`;

  // Lock scroll when open
  useEffect(() => {
    document.body.style.overflow = isDrawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isDrawerOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    if (isDrawerOpen) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isDrawerOpen, closeDrawer]);

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-[#0B0B0B]/80 backdrop-blur-sm"
            onClick={closeDrawer}
          />

          {/* Drawer */}
          <motion.div
            ref={drawerRef}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-[#0B0B0B] border-l border-[rgba(242,237,227,0.10)] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(242,237,227,0.10)]">
              <div className="flex items-center gap-3">
                <span className="km-mono-eyebrow text-[#D8FF3D]">
                  {t.heading}
                </span>
                {totalItems > 0 && (
                  <span className="km-mono-eyebrow text-[#F2EDE3]/50">
                    · {t.itemCount(totalItems)}
                  </span>
                )}
              </div>
              <button
                onClick={closeDrawer}
                className="w-8 h-8 border border-[rgba(242,237,227,0.20)] flex items-center justify-center text-[#F2EDE3] hover:bg-[#F2EDE3] hover:text-[#0B0B0B] transition-colors"
                aria-label={t.closeCart}
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 border border-[rgba(242,237,227,0.15)] flex items-center justify-center mb-6">
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="text-[#F2EDE3]/30"
                    >
                      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <path d="M16 10a4 4 0 01-8 0" />
                    </svg>
                  </div>
                  <p className="km-display text-2xl text-[#F2EDE3] mb-2">
                    {t.emptyTitle}
                  </p>
                  <p className="text-sm text-[#F2EDE3]/50 mb-6">
                    {t.emptyBody}
                  </p>
                  <button
                    onClick={closeDrawer}
                    className="px-6 py-3 bg-[#D8FF3D] text-[#0B0B0B] km-mono-eyebrow hover:bg-[#F2EDE3] transition-colors"
                  >
                    {t.continueShopping}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="border border-[rgba(242,237,227,0.10)] bg-[#0E0E0E] p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="km-mono-eyebrow text-[#D8FF3D] text-[10px] mb-1">
                            / KM-v3.0
                          </p>
                          <p className="text-[15px] text-[#F2EDE3] font-medium truncate">
                            {item.name}
                          </p>
                          <p className="text-sm text-[#F2EDE3]/50 mt-1">
                            {formatMoney(item.price, item.currency ?? "PLN", lang)} {t.perUnit}
                          </p>
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-[#F2EDE3]/30 hover:text-[#FF4D2E] transition-colors p-1"
                          aria-label={t.removeFromCart}
                        >
                          <svg
                            width="16"
                            height="16"
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

                      {/* Ilosc 1..MAX_ORDER_QUANTITY (wysylka stala na zamowienie) */}
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[rgba(242,237,227,0.08)]">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="km-mono-eyebrow text-[#F2EDE3]/60 text-[11px]">{t.quantity}</span>
                            <div className="flex items-center border border-[rgba(242,237,227,0.20)]">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                disabled={item.quantity <= 1}
                                aria-label={t.decrease}
                                className="w-8 h-8 flex items-center justify-center text-[#F2EDE3] hover:bg-[#F2EDE3] hover:text-[#0B0B0B] transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#F2EDE3]"
                              >
                                −
                              </button>
                              <span className="w-8 text-center km-mono-eyebrow text-[#F2EDE3]" aria-live="polite">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                disabled={item.quantity >= MAX_ORDER_QUANTITY}
                                aria-label={t.increase}
                                className="w-8 h-8 flex items-center justify-center text-[#F2EDE3] hover:bg-[#F2EDE3] hover:text-[#0B0B0B] transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#F2EDE3]"
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <p className="km-mono-eyebrow text-[#F2EDE3]/35 text-[10px] mt-1.5">{t.limitNote}</p>
                        </div>
                        <span className="km-display text-lg text-[#F2EDE3]">
                          {formatMoney(item.price * item.quantity, item.currency ?? "PLN", lang)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer — checkout */}
            {items.length > 0 && (
              <div className="border-t border-[rgba(242,237,227,0.10)] p-6 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#F2EDE3]/65">{t.products}</span>
                    <span className="text-[#F2EDE3]">
                      {formatMoney(totalPrice, cartCurrency, lang)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#F2EDE3]/65">
                      {isPln ? t.shipping : t.shippingIntl}
                    </span>
                    {isPln ? (
                      <span className="km-mono-eyebrow text-[#D8FF3D]">{t.free}</span>
                    ) : (
                      <span className="text-[#F2EDE3]/65">{t.shippingAtCheckout}</span>
                    )}
                  </div>
                  <div className="flex justify-between pt-3 border-t border-[rgba(242,237,227,0.10)]">
                    <span className="km-mono-eyebrow text-[#F2EDE3]">
                      {isPln ? t.total : t.totalPlusShipping}
                    </span>
                    <span className="km-display text-2xl text-[#F2EDE3]">
                      {formatMoney(totalPrice, cartCurrency, lang)}
                    </span>
                  </div>
                </div>

                <Link
                  href={cartHref}
                  onClick={closeDrawer}
                  className="block w-full py-4 bg-[#D8FF3D] text-[#0B0B0B] km-mono-eyebrow text-center hover:bg-[#F2EDE3] transition-colors"
                >
                  {t.goToCart}
                </Link>

                <button
                  onClick={closeDrawer}
                  className="block w-full py-3 km-mono-eyebrow text-[#F2EDE3]/60 hover:text-[#F2EDE3] transition-colors text-center"
                >
                  {t.continueShopping}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
