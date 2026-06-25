"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/components/CartContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { localeLabel, type Locale } from "@/lib/i18n";

const links = [
  { href: "#jak-dziala", n: "01" },
  { href: "#przedmioty", n: "02" },
  { href: "#hardware", n: "03" },
  { href: "#galeria", n: "04" },
  { href: "#faq", n: "05" },
];

const content: Record<Locale, {
  navLabels: string[];
  panel: string;
  cart: string;
  cartAria: string;
  menu: string;
  panelLogin: string;
  cartMobile: string;
}> = {
  pl: {
    navLabels: ["Jak działa", "Przedmioty", "Hardware", "Galeria", "FAQ"],
    panel: "Panel ↗",
    cart: "Koszyk",
    cartAria: "Koszyk",
    menu: "Menu",
    panelLogin: "Panel · Logowanie ↗",
    cartMobile: "Koszyk",
  },
  en: {
    navLabels: ["How it works", "Subjects", "Hardware", "Gallery", "FAQ"],
    panel: "Panel ↗",
    cart: "Cart",
    cartAria: "Cart",
    menu: "Menu",
    panelLogin: "Panel · Sign in ↗",
    cartMobile: "Cart",
  },
  de: {
    navLabels: ["So funktioniert's", "Fächer", "Hardware", "Galerie", "FAQ"],
    panel: "Panel ↗",
    cart: "Warenkorb",
    cartAria: "Warenkorb",
    menu: "Menü",
    panelLogin: "Panel · Anmelden ↗",
    cartMobile: "Warenkorb",
  },
};

export default function Navigation({ lang = "pl" }: { lang?: Locale }) {
  const t = content[lang];
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [clock, setClock] = useState("");
  const { totalItems, openDrawer } = useCart();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      setClock(`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-colors duration-300 ${
        scrolled
          ? "bg-[#0B0B0B]/85 backdrop-blur-md border-b border-[rgba(242,237,227,0.10)]"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <div className="flex items-center justify-between h-16">
          <a href="#top" className="flex items-baseline gap-2 group">
            <span className="km-display text-[26px] tracking-tight leading-none text-[#F2EDE3]">
              Kalk<span className="italic text-[#D8FF3D]">Mate</span>
            </span>
            <span className="km-mono-eyebrow text-[#F2EDE3]/40 hidden sm:inline">
              /v0.6.4
            </span>
          </a>

          <nav className="hidden lg:flex items-center gap-8">
            {links.map((l, i) => (
              <a
                key={l.href}
                href={l.href}
                className="group flex items-baseline gap-1.5 text-[13.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3] transition-colors"
              >
                <span className="km-mono-eyebrow text-[#F2EDE3]/30 group-hover:text-[#D8FF3D] transition-colors">
                  {l.n}
                </span>
                <span>{t.navLabels[i]}</span>
              </a>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-5">
            <span className="km-mono-eyebrow text-[#F2EDE3]/40 tabular-nums">
              {`${localeLabel[lang]} · ${clock}`}
            </span>
            <LanguageSwitcher current={lang} />
            <a
              href="/auth/signin"
              className="inline-flex items-center gap-2 px-4 py-2 km-mono-eyebrow text-[#F2EDE3]/80 border border-[rgba(242,237,227,0.20)] hover:border-[#D8FF3D] hover:text-[#F2EDE3] transition-colors"
            >
              {t.panel}
            </a>
            {/* Cart button */}
            <button
              onClick={openDrawer}
              className="relative inline-flex items-center gap-2 px-4 py-2 bg-[#D8FF3D] text-[#0B0B0B] km-mono-eyebrow hover:bg-[#F2EDE3] transition-colors"
              aria-label={t.cartAria}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 01-8 0" />
              </svg>
              {t.cart}
              {totalItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#0B0B0B] text-[#D8FF3D] rounded-full flex items-center justify-center text-[10px] font-bold border border-[#D8FF3D]">
                  {totalItems}
                </span>
              )}
            </button>
          </div>

          {/* Mobile: cart icon + menu */}
          <div className="lg:hidden flex items-center gap-3">
            <button
              onClick={openDrawer}
              className="relative p-2 text-[#F2EDE3]"
              aria-label={t.cartAria}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 01-8 0" />
              </svg>
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-[#D8FF3D] text-[#0B0B0B] rounded-full flex items-center justify-center text-[9px] font-bold min-w-[18px] min-h-[18px]">
                  {totalItems}
                </span>
              )}
            </button>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="km-mono-eyebrow text-[#F2EDE3] px-3 py-1.5 border border-[rgba(242,237,227,0.20)]"
              aria-label={t.menu}
            >
              {menuOpen ? "✕" : t.menu}
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="lg:hidden border-t border-[rgba(242,237,227,0.10)] bg-[#0B0B0B]">
          <div className="px-5 py-6 flex flex-col gap-4">
            {links.map((l, i) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="flex items-baseline gap-2 text-lg text-[#F2EDE3]"
              >
                <span className="km-mono-eyebrow text-[#D8FF3D]">{l.n}</span>
                <span className="km-display text-2xl">{t.navLabels[i]}</span>
              </a>
            ))}
            <a
              href="/auth/signin"
              onClick={() => setMenuOpen(false)}
              className="mt-2 inline-flex items-center justify-center gap-2 px-5 py-3 km-mono-eyebrow text-[#F2EDE3] border border-[rgba(242,237,227,0.20)]"
            >
              {t.panelLogin}
            </a>
            <a
              href="/koszyk"
              onClick={() => setMenuOpen(false)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#D8FF3D] text-[#0B0B0B] km-mono-eyebrow"
            >
              {totalItems > 0 ? `${t.cartMobile} (${totalItems})` : t.cartMobile}
            </a>
            <div className="mt-2">
              <LanguageSwitcher current={lang} compact />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
