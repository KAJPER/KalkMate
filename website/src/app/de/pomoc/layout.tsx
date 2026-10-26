import type { Metadata } from "next";
import { headers } from "next/headers";
import { locales, localePath, ogLocale, siteUrlFromHost } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "KalkMate Bedienungsanleitung & Hilfe — Einrichtung, WLAN, KI",
    description:
      "Bedienungsanleitung für den KI-Taschenrechner KalkMate: Ersteinrichtung, WLAN, KI-Modus, Akku und Laden, OTA-Updates, Fehlerbehebung und FAQ.",
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${siteUrl}/de/pomoc`,
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, `${siteUrl}${localePath(l, "/pomoc")}`])),
        "x-default": `${siteUrl}/pomoc`,
      },
    },
    openGraph: {
      title: "KalkMate Bedienungsanleitung & Hilfe — Einrichtung, WLAN, KI",
      description:
        "Bedienungsanleitung für den KI-Taschenrechner KalkMate: Ersteinrichtung, WLAN, KI-Modus, Akku und Laden, OTA-Updates, Fehlerbehebung und FAQ.",
      type: "website",
      locale: ogLocale.de,
      url: `${siteUrl}/de/pomoc`,
      siteName: "KalkMate",
    },
    twitter: {
      card: "summary_large_image",
      title: "KalkMate Bedienungsanleitung & Hilfe — Einrichtung, WLAN, KI",
      description:
        "Bedienungsanleitung für den KI-Taschenrechner KalkMate: Ersteinrichtung, WLAN, KI-Modus, Akku und Laden, OTA-Updates, Fehlerbehebung und FAQ.",
    },
  };
}

export default function PomocLayoutDe({ children }: { children: React.ReactNode }) {
  return children;
}
