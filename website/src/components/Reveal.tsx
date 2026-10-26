"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

// Lekki zamiennik framer-motion `initial/whileInView` (opacity 0 + przesuniecie
// w osi Y -> pelna widocznosc, raz, po wejsciu w viewport). Sekcje landingu
// (HowItWorks, ExamBenefits, Specs, Gallery) moga dzieki temu byc serwerowymi
// komponentami — do przegladarki nie trafia ani framer-motion (~40 KB gz),
// ani ich slowniki 11 jezykow; klientowy jest tylko ten wrapper.
// Animacja to CSS @keyframes (globals.css, .km-reveal), a nie `transition`,
// zeby nie gryzla sie z `transition-colors` i hoverami na tym samym elemencie.
type Props = {
  as?: "div" | "figure" | "li" | "article";
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  /** Przesuniecie startowe w px (framer `initial.y`). */
  y?: number;
  /** Sekundy. */
  delay?: number;
  /** Sekundy. */
  duration?: number;
  /** CSS timing function. */
  ease?: string;
  /** Jaka czesc elementu musi byc widoczna (framer `viewport.amount`). */
  amount?: number;
};

export default function Reveal({
  as: Tag = "div",
  className = "",
  style,
  children,
  y = 24,
  delay = 0,
  duration = 0.6,
  ease = "cubic-bezier(0.22, 1, 0.36, 1)",
  amount = 0.3,
}: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: amount },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [amount]);

  const vars = {
    "--km-reveal-y": `${y}px`,
    "--km-reveal-delay": `${delay}s`,
    "--km-reveal-duration": `${duration}s`,
    "--km-reveal-ease": ease,
    ...style,
  } as CSSProperties;

  return (
    <Tag
      ref={ref as never}
      className={`km-reveal ${className}`}
      data-shown={shown ? "" : undefined}
      style={vars}
    >
      {children}
    </Tag>
  );
}
