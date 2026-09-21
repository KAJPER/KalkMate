import type { Metadata } from "next";
import { headers } from "next/headers";
import { siteUrlFromHost } from "@/lib/i18n";

// /pomoc to publiczna strona pomocy/instrukcji — chcemy ją indeksować, z własnym
// tytułem i canonical (strona główna ma osobny canonical, nie dziedziczymy go tu).
// Odpowiedniki /en/pomoc i /de/pomoc mają własne layout.tsx z tym samym wzorcem.
// Dynamiczne (nie staly obiekt) — patrz komentarz w src/app/page.tsx (kalkmate.eu).
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "Pomoc i instrukcja obsługi — KalkMate",
    description:
      "Instrukcja obsługi kalkulatora KalkMate: pierwsze uruchomienie, konfiguracja WiFi, tryb AI, rozwiązywanie problemów i historia firmware.",
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${siteUrl}/pomoc`,
      languages: {
        pl: `${siteUrl}/pomoc`,
        en: `${siteUrl}/en/pomoc`,
        de: `${siteUrl}/de/pomoc`,
        "x-default": `${siteUrl}/pomoc`,
      },
    },
  };
}

export default function PomocLayout({ children }: { children: React.ReactNode }) {
  return children;
}
