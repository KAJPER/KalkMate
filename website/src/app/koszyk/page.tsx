"use client";

import { useCart } from "@/components/CartContext";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import Link from "next/link";

function formatPLN(grosze: number) {
  return `${(grosze / 100).toLocaleString("pl-PL")} zł`;
}

export default function CartPage() {
  const { items, removeItem, updateQuantity, clearCart, totalItems, totalPrice } = useCart();
  const { status } = useSession();
  const router = useRouter();

  const handleCheckout = () => {
    if (status !== "authenticated") {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent("/koszyk")}`);
      return;
    }
    // Redirect to main page BuyNow section and trigger checkout
    router.push("/?checkout=true#kup-teraz");
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F2EDE3]">
      <Navigation />

      <main className="pt-28 lg:pt-32 pb-24">
        <div className="max-w-5xl mx-auto px-5 lg:px-10">
          {/* Header */}
          <div className="flex items-center justify-between gap-6 border-b border-[rgba(242,237,227,0.10)] pb-5 mb-10">
            <div>
              <p className="km-mono-eyebrow text-[#D8FF3D]">
                [ koszyk ] · {totalItems}{" "}
                {totalItems === 1
                  ? "produkt"
                  : totalItems < 5
                  ? "produkty"
                  : "produktów"}
              </p>
              <h1 className="km-display text-[clamp(48px,7vw,96px)] mt-3 leading-[0.92]">
                Twój{" "}
                <span className="italic text-[#D8FF3D]">koszyk</span>.
              </h1>
            </div>
            {items.length > 0 && (
              <button
                onClick={clearCart}
                className="km-mono-eyebrow text-[#F2EDE3]/40 hover:text-[#FF4D2E] transition-colors hidden sm:block"
              >
                Wyczyść koszyk
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
              <h2 className="km-display text-3xl mb-3">Koszyk jest pusty</h2>
              <p className="text-[#F2EDE3]/50 mb-8 max-w-sm mx-auto">
                Nie masz jeszcze żadnych produktów w koszyku. Dodaj KalkMate
                v1.0, aby kontynuować.
              </p>
              <Link
                href="/#kup-teraz"
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#D8FF3D] text-[#0B0B0B] km-mono-eyebrow hover:bg-[#F2EDE3] transition-colors"
              >
                <span className="w-1.5 h-1.5 bg-[#0B0B0B] rounded-full km-blink" />
                Przejdź do sklepu
              </Link>
            </div>
          ) : (
            <div className="grid lg:grid-cols-[1fr_380px] gap-8 lg:gap-12 items-start">
              {/* Products */}
              <div className="space-y-4">
                {/* Table header — desktop */}
                <div className="hidden sm:grid grid-cols-[1fr_140px_140px_40px] gap-4 px-4 pb-2 border-b border-[rgba(242,237,227,0.10)]">
                  <span className="km-mono-eyebrow text-[#F2EDE3]/40">
                    Produkt
                  </span>
                  <span className="km-mono-eyebrow text-[#F2EDE3]/40 text-center">
                    Ilość
                  </span>
                  <span className="km-mono-eyebrow text-[#F2EDE3]/40 text-right">
                    Suma
                  </span>
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
                          / KM-v1.0 · ORDER
                        </p>
                        <p className="text-[16px] text-[#F2EDE3] font-medium">
                          {item.name}
                        </p>
                        <p className="text-sm text-[#F2EDE3]/50 mt-0.5">
                          {formatPLN(item.price)} / szt.
                        </p>
                      </div>

                      {/* Quantity stepper */}
                      <div className="flex items-center justify-center gap-0 mt-4 sm:mt-0">
                        <button
                          onClick={() =>
                            updateQuantity(item.id, item.quantity - 1)
                          }
                          className="w-9 h-9 border border-[rgba(242,237,227,0.20)] flex items-center justify-center text-[#F2EDE3] hover:border-[#D8FF3D] hover:text-[#D8FF3D] transition-colors km-mono-eyebrow"
                        >
                          −
                        </button>
                        <span className="w-12 h-9 border-y border-[rgba(242,237,227,0.20)] flex items-center justify-center text-[#F2EDE3] km-mono-eyebrow">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.id, item.quantity + 1)
                          }
                          disabled={item.quantity >= 3}
                          className="w-9 h-9 border border-[rgba(242,237,227,0.20)] flex items-center justify-center text-[#F2EDE3] hover:border-[#D8FF3D] hover:text-[#D8FF3D] transition-colors km-mono-eyebrow disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          +
                        </button>
                      </div>

                      {/* Subtotal */}
                      <div className="text-right mt-3 sm:mt-0">
                        <span className="km-display text-xl text-[#F2EDE3]">
                          {formatPLN(item.price * item.quantity)}
                        </span>
                      </div>

                      {/* Remove */}
                      <div className="flex justify-end mt-3 sm:mt-0">
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-[#F2EDE3]/30 hover:text-[#FF4D2E] transition-colors p-1"
                          aria-label="Usuń z koszyka"
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
                  Wyczyść koszyk
                </button>
              </div>

              {/* Order summary */}
              <div className="lg:sticky lg:top-24">
                <div className="border border-[rgba(242,237,227,0.18)] bg-[#0B0B0B]">
                  {/* Corner ticks */}
                  <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-l border-t border-[#D8FF3D]" />
                  <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-r border-t border-[#D8FF3D]" />
                  <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-l border-b border-[#D8FF3D]" />
                  <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-r border-b border-[#D8FF3D]" />

                  <div className="px-6 py-4 border-b border-[rgba(242,237,227,0.10)]">
                    <span className="km-mono-eyebrow text-[#D8FF3D]">
                      / Podsumowanie
                    </span>
                  </div>

                  <div className="p-6 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#F2EDE3]/65">
                        Produkty ({totalItems} szt.)
                      </span>
                      <span className="text-[#F2EDE3]">
                        {formatPLN(totalPrice)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#F2EDE3]/65">
                        Wysyłka InPost Paczkomat
                      </span>
                      <span className="km-mono-eyebrow text-[#D8FF3D]">
                        GRATIS
                      </span>
                    </div>
                    <div className="flex justify-between pt-4 border-t border-[rgba(242,237,227,0.10)]">
                      <span className="km-mono-eyebrow text-[#F2EDE3]">
                        Do zapłaty
                      </span>
                      <span className="km-display text-3xl text-[#F2EDE3]">
                        {formatPLN(totalPrice)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleCheckout}
                    className="group w-full px-6 py-5 bg-[#D8FF3D] text-[#0B0B0B] km-mono-eyebrow text-[13px] hover:bg-[#F2EDE3] transition-colors flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-[#0B0B0B] rounded-full km-blink" />
                      {status === "authenticated"
                        ? "Przejdź do zamówienia"
                        : "Zaloguj się i zamów"}
                    </span>
                    <span>→</span>
                  </button>
                </div>

                {/* Trust badges */}
                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
                  <span className="km-mono-eyebrow text-[#F2EDE3]/40 flex items-center gap-2 text-[11px]">
                    <span className="w-1 h-1 bg-[#D8FF3D] rounded-full" />
                    Bezpieczna płatność
                  </span>
                  <span className="km-mono-eyebrow text-[#F2EDE3]/40 flex items-center gap-2 text-[11px]">
                    <span className="w-1 h-1 bg-[#D8FF3D] rounded-full" />
                    Gwarancja 24 mc
                  </span>
                  <span className="km-mono-eyebrow text-[#F2EDE3]/40 flex items-center gap-2 text-[11px]">
                    <span className="w-1 h-1 bg-[#D8FF3D] rounded-full" />
                    Darmowa wysyłka
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
