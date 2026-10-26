import type { Metadata } from "next";
import { headers } from "next/headers";
import { locales, localePath, ogLocale, siteUrlFromHost } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "KalkMate naudojimo instrukcija — pagalba, WiFi, DI režimas",
    description:
      "DI skaičiuotuvo KalkMate naudojimo instrukcija: pirmasis paleidimas, WiFi, DI režimas, baterija ir įkrovimas, OTA atnaujinimai, problemų sprendimas ir DUK.",
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${siteUrl}/lt/pomoc`,
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, `${siteUrl}${localePath(l, "/pomoc")}`])),
        "x-default": `${siteUrl}/pomoc`,
      },
    },
    openGraph: {
      title: "KalkMate naudojimo instrukcija — pagalba, WiFi, DI režimas",
      description:
        "DI skaičiuotuvo KalkMate naudojimo instrukcija: pirmasis paleidimas, WiFi, DI režimas, baterija ir įkrovimas, OTA atnaujinimai, problemų sprendimas ir DUK.",
      type: "website",
      locale: ogLocale.lt,
      url: `${siteUrl}/lt/pomoc`,
      siteName: "KalkMate",
    },
    twitter: {
      card: "summary_large_image",
      title: "KalkMate naudojimo instrukcija — pagalba, WiFi, DI režimas",
      description:
        "DI skaičiuotuvo KalkMate naudojimo instrukcija: pirmasis paleidimas, WiFi, DI režimas, baterija ir įkrovimas, OTA atnaujinimai, problemų sprendimas ir DUK.",
    },
  };
}

export default function PomocLayoutLt({ children }: { children: React.ReactNode }) {
  return children;
}
