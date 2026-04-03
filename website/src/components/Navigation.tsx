"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

const navLinks = [
  { href: "#funkcje", label: "Funkcje" },
  { href: "#jak-dziala", label: "Jak działa" },
  { href: "#specyfikacja", label: "Specyfikacja" },
  { href: "#prototyp", label: "O produkcie" },
  { href: "#kup-teraz", label: "Kup teraz" },
];

export default function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/80 dark:bg-[#2B2D31]/80 backdrop-blur-md border-b border-gray-200 dark:border-[#3F4147]"
          : "bg-transparent"
      }`}
      style={{ top: '44px' }}
    >
      <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="#" className="flex items-center gap-0.5">
          <Image
            src="/kalkmate_icon.svg"
            alt="KalkMate icon"
            width={36}
            height={36}
            className="dark:invert"
          />
          <Image
            src="/kalkmate_text.svg"
            alt="KalkMate"
            width={140}
            height={32}
            className="dark:invert"
          />
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-[#1a1a1a]/70 dark:text-[#E0E0E0]/70 hover:text-[#1a1a1a] dark:hover:text-[#E0E0E0] transition-colors"
            >
              {link.label}
            </a>
          ))}
          <a
            href="/panel"
            className="text-sm text-[#1a1a1a]/70 dark:text-[#E0E0E0]/70 hover:text-[#1a1a1a] dark:hover:text-[#E0E0E0] transition-colors flex items-center gap-1.5"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Panel
          </a>
          <a
            href="#kup-teraz"
            className="text-sm font-medium bg-[#2563EB] dark:bg-[#3B82F6] text-white px-5 py-2 rounded-full hover:bg-[#1d4ed8] dark:hover:bg-[#2563EB] transition-colors"
          >
            Zamów teraz
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
        >
          <span
            className={`block w-6 h-0.5 bg-[#1a1a1a] dark:bg-[#E0E0E0] transition-transform ${
              mobileOpen ? "rotate-45 translate-y-2" : ""
            }`}
          />
          <span
            className={`block w-6 h-0.5 bg-[#1a1a1a] dark:bg-[#E0E0E0] transition-opacity ${
              mobileOpen ? "opacity-0" : ""
            }`}
          />
          <span
            className={`block w-6 h-0.5 bg-[#1a1a1a] dark:bg-[#E0E0E0] transition-transform ${
              mobileOpen ? "-rotate-45 -translate-y-2" : ""
            }`}
          />
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white dark:bg-[#2B2D31] border-b border-gray-200 dark:border-[#3F4147]"
          >
            <div className="px-6 py-4 flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-sm text-[#1a1a1a]/70 dark:text-[#E0E0E0]/70 hover:text-[#1a1a1a] dark:hover:text-[#E0E0E0]"
                >
                  {link.label}
                </a>
              ))}
              <a
                href="/panel"
                onClick={() => setMobileOpen(false)}
                className="text-sm text-[#1a1a1a]/70 dark:text-[#E0E0E0]/70 hover:text-[#1a1a1a] dark:hover:text-[#E0E0E0] flex items-center gap-1.5"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Panel
              </a>
              <a
                href="#kup-teraz"
                onClick={() => setMobileOpen(false)}
                className="text-sm font-medium bg-[#2563EB] dark:bg-[#3B82F6] text-white px-5 py-2 rounded-full text-center hover:bg-[#1d4ed8] dark:hover:bg-[#2563EB] transition-colors"
              >
                Zamów teraz
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
