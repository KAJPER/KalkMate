import type { Metadata } from "next";
import { ogImages } from "@/lib/seo";
import { headers } from "next/headers";
import { locales, localePath, ogLocale, siteUrlFromHost } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "Návod k obsluze KalkMate — nápověda, WiFi, režim AI",
    description:
      "Návod k obsluze AI kalkulačky KalkMate: první spuštění, WiFi, režim AI, baterie a nabíjení, aktualizace OTA, řešení problémů a časté dotazy.",
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${siteUrl}/cs/pomoc`,
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, `${siteUrl}${localePath(l, "/pomoc")}`])),
        "x-default": `${siteUrl}/pomoc`,
      },
    },
    openGraph: {
      images: ogImages,
      title: "Návod k obsluze KalkMate — nápověda, WiFi, režim AI",
      description:
        "Návod k obsluze AI kalkulačky KalkMate: první spuštění, WiFi, režim AI, baterie a nabíjení, aktualizace OTA, řešení problémů a časté dotazy.",
      type: "website",
      locale: ogLocale.cs,
      url: `${siteUrl}/cs/pomoc`,
      siteName: "KalkMate",
    },
    twitter: {
      images: ogImages,
      card: "summary_large_image",
      title: "Návod k obsluze KalkMate — nápověda, WiFi, režim AI",
      description:
        "Návod k obsluze AI kalkulačky KalkMate: první spuštění, WiFi, režim AI, baterie a nabíjení, aktualizace OTA, řešení problémů a časté dotazy.",
    },
  };
}

export default function PomocLayoutCs({ children }: { children: React.ReactNode }) {
  return children;
}
