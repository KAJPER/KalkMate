import type { Metadata } from "next";
import { ogImages } from "@/lib/seo";
import { headers } from "next/headers";
import { locales, localePath, ogLocale, siteUrlFromHost } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "Manuale d’uso KalkMate — assistenza, WiFi e modalità IA",
    description:
      "Manuale d’uso della calcolatrice IA KalkMate: prima accensione, WiFi, modalità IA, batteria e ricarica, aggiornamenti OTA, risoluzione dei problemi e FAQ.",
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${siteUrl}/it/pomoc`,
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, `${siteUrl}${localePath(l, "/pomoc")}`])),
        "x-default": `${siteUrl}/pomoc`,
      },
    },
    openGraph: {
      images: ogImages,
      title: "Manuale d’uso KalkMate — assistenza, WiFi e modalità IA",
      description:
        "Manuale d’uso della calcolatrice IA KalkMate: prima accensione, WiFi, modalità IA, batteria e ricarica, aggiornamenti OTA, risoluzione dei problemi e FAQ.",
      type: "website",
      locale: ogLocale.it,
      url: `${siteUrl}/it/pomoc`,
      siteName: "KalkMate",
    },
    twitter: {
      images: ogImages,
      card: "summary_large_image",
      title: "Manuale d’uso KalkMate — assistenza, WiFi e modalità IA",
      description:
        "Manuale d’uso della calcolatrice IA KalkMate: prima accensione, WiFi, modalità IA, batteria e ricarica, aggiornamenti OTA, risoluzione dei problemi e FAQ.",
    },
  };
}

export default function PomocLayoutIt({ children }: { children: React.ReactNode }) {
  return children;
}
