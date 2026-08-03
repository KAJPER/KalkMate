import type { Metadata } from "next";
import { SITE_URL } from "@/lib/i18n";

// /pomoc to publiczna strona pomocy/instrukcji — chcemy ją indeksować, z własnym
// tytułem i canonical (strona główna ma osobny canonical, nie dziedziczymy go tu).
// Odpowiedniki /en/pomoc i /de/pomoc mają własne layout.tsx z tym samym wzorcem.
export const metadata: Metadata = {
  title: "Pomoc i instrukcja obsługi — KalkMate",
  description:
    "Instrukcja obsługi kalkulatora KalkMate: pierwsze uruchomienie, konfiguracja WiFi, tryb AI, rozwiązywanie problemów i historia firmware.",
  robots: { index: true, follow: true },
  alternates: {
    canonical: `${SITE_URL}/pomoc`,
    languages: {
      pl: `${SITE_URL}/pomoc`,
      en: `${SITE_URL}/en/pomoc`,
      de: `${SITE_URL}/de/pomoc`,
      "x-default": `${SITE_URL}/pomoc`,
    },
  },
};

export default function PomocLayout({ children }: { children: React.ReactNode }) {
  return children;
}
