"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/components/CartContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { localeFromPathname, type Locale } from "@/lib/i18n";

function formatPLN(grosze: number) {
  return `${(grosze / 100).toLocaleString("pl-PL")} zł`;
}

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
  free: string;
  total: string;
  goToCart: string;
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
    free: "GRATIS",
    total: "Razem",
    goToCart: "Przejdź do koszyka →",
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
    free: "FREE",
    total: "Total",
    goToCart: "Go to cart →",
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
    free: "GRATIS",
    total: "Gesamt",
    goToCart: "Zum Warenkorb →",
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
                            / KM-v1.0
                          </p>
                          <p className="text-[15px] text-[#F2EDE3] font-medium truncate">
                            {item.name}
                          </p>
                          <p className="text-sm text-[#F2EDE3]/50 mt-1">
                            {formatPLN(item.price)} {t.perUnit}
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

                      {/* Quantity stepper */}
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[rgba(242,237,227,0.08)]">
                        <div className="flex items-center gap-0">
                          <button
                            onClick={() =>
                              updateQuantity(item.id, item.quantity - 1)
                            }
                            className="w-8 h-8 border border-[rgba(242,237,227,0.20)] flex items-center justify-center text-[#F2EDE3] hover:border-[#D8FF3D] hover:text-[#D8FF3D] transition-colors km-mono-eyebrow"
                          >
                            −
                          </button>
                          <span className="w-10 h-8 border-y border-[rgba(242,237,227,0.20)] flex items-center justify-center text-[#F2EDE3] km-mono-eyebrow text-sm">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateQuantity(item.id, item.quantity + 1)
                            }
                            disabled={item.quantity >= 3}
                            className="w-8 h-8 border border-[rgba(242,237,227,0.20)] flex items-center justify-center text-[#F2EDE3] hover:border-[#D8FF3D] hover:text-[#D8FF3D] transition-colors km-mono-eyebrow disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            +
                          </button>
                        </div>
                        <span className="km-display text-lg text-[#F2EDE3]">
                          {formatPLN(item.price * item.quantity)}
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
                      {formatPLN(totalPrice)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#F2EDE3]/65">
                      {t.shipping}
                    </span>
                    <span className="km-mono-eyebrow text-[#D8FF3D]">
                      {t.free}
                    </span>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-[rgba(242,237,227,0.10)]">
                    <span className="km-mono-eyebrow text-[#F2EDE3]">
                      {t.total}
                    </span>
                    <span className="km-display text-2xl text-[#F2EDE3]">
                      {formatPLN(totalPrice)}
                    </span>
                  </div>
                </div>

                <Link
                  href="/koszyk"
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
