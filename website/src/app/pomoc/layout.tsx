import type { Metadata } from "next";
import { ogImages } from "@/lib/seo";
import { headers } from "next/headers";
import { locales, localePath, ogLocale, siteUrlFromHost } from "@/lib/i18n";

// /pomoc to publiczna strona pomocy/instrukcji — chcemy ją indeksować, z własnym
// tytułem i canonical (strona główna ma osobny canonical, nie dziedziczymy go tu).
// Odpowiedniki w pozostałych językach (/en/pomoc, /de/pomoc, /cs/pomoc, /sk/pomoc...)
// mają własne layout.tsx z tym samym wzorcem; hreflang generowany z `locales`
// (nowy język w i18n.ts = automatycznie w alternates wszystkich wersji).
// Dynamiczne (nie staly obiekt) — patrz komentarz w src/app/page.tsx (kalkmate.eu).
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "Instrukcja obsługi kalkulatora KalkMate — pomoc",
    description:
      "Instrukcja obsługi KalkMate krok po kroku: pierwsze uruchomienie, WiFi, tryb AI, bateria i ładowanie, aktualizacje OTA, rozwiązywanie problemów i changelog.",
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${siteUrl}/pomoc`,
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, `${siteUrl}${localePath(l, "/pomoc")}`])),
        "x-default": `${siteUrl}/pomoc`,
      },
    },
    openGraph: {
      images: ogImages,
      title: "Instrukcja obsługi kalkulatora KalkMate — pomoc",
      description:
        "Instrukcja obsługi KalkMate krok po kroku: pierwsze uruchomienie, WiFi, tryb AI, bateria i ładowanie, aktualizacje OTA, rozwiązywanie problemów i changelog.",
      type: "website",
      locale: ogLocale.pl,
      url: `${siteUrl}/pomoc`,
      siteName: "KalkMate",
    },
    twitter: {
      images: ogImages,
      card: "summary_large_image",
      title: "Instrukcja obsługi kalkulatora KalkMate — pomoc",
      description:
        "Instrukcja obsługi KalkMate krok po kroku: pierwsze uruchomienie, WiFi, tryb AI, bateria i ładowanie, aktualizacje OTA, rozwiązywanie problemów i changelog.",
    },
  };
}

export default function PomocLayout({ children }: { children: React.ReactNode }) {
  return children;
}
