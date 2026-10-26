import type { Metadata } from "next";
import { ogImages } from "@/lib/seo";
import { headers } from "next/headers";
import { locales, localePath, ogLocale, siteUrlFromHost } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "Návod na použitie KalkMate — pomoc, WiFi, režim AI",
    description:
      "Návod na použitie AI kalkulačky KalkMate: prvé spustenie, WiFi, režim AI, batéria a nabíjanie, aktualizácie OTA, riešenie problémov a časté otázky.",
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${siteUrl}/sk/pomoc`,
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, `${siteUrl}${localePath(l, "/pomoc")}`])),
        "x-default": `${siteUrl}/pomoc`,
      },
    },
    openGraph: {
      images: ogImages,
      title: "Návod na použitie KalkMate — pomoc, WiFi, režim AI",
      description:
        "Návod na použitie AI kalkulačky KalkMate: prvé spustenie, WiFi, režim AI, batéria a nabíjanie, aktualizácie OTA, riešenie problémov a časté otázky.",
      type: "website",
      locale: ogLocale.sk,
      url: `${siteUrl}/sk/pomoc`,
      siteName: "KalkMate",
    },
    twitter: {
      images: ogImages,
      card: "summary_large_image",
      title: "Návod na použitie KalkMate — pomoc, WiFi, režim AI",
      description:
        "Návod na použitie AI kalkulačky KalkMate: prvé spustenie, WiFi, režim AI, batéria a nabíjanie, aktualizácie OTA, riešenie problémov a časté otázky.",
    },
  };
}

export default function PomocLayoutSk({ children }: { children: React.ReactNode }) {
  return children;
}
