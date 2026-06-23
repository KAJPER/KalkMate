import type { Metadata } from "next";

// /pomoc to publiczna strona pomocy/instrukcji — chcemy ją indeksować, z własnym
// tytułem i canonical (strona główna ma osobny canonical, nie dziedziczymy go tu).
export const metadata: Metadata = {
  title: "Pomoc i instrukcja obsługi — KalkMate",
  description:
    "Instrukcja obsługi kalkulatora KalkMate: pierwsze uruchomienie, konfiguracja WiFi, tryb AI, rozwiązywanie problemów i historia firmware.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://kalkmate.pl/pomoc" },
};

export default function PomocLayout({ children }: { children: React.ReactNode }) {
  return children;
}
