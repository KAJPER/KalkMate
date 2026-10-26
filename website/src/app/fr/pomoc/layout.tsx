import type { Metadata } from "next";
import { headers } from "next/headers";
import { locales, localePath, ogLocale, siteUrlFromHost } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "Mode d’emploi KalkMate — aide, WiFi et mode IA",
    description:
      "Mode d’emploi de la calculatrice IA KalkMate : première mise en route, WiFi, mode IA, batterie et recharge, mises à jour OTA, dépannage et FAQ.",
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${siteUrl}/fr/pomoc`,
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, `${siteUrl}${localePath(l, "/pomoc")}`])),
        "x-default": `${siteUrl}/pomoc`,
      },
    },
    openGraph: {
      title: "Mode d’emploi KalkMate — aide, WiFi et mode IA",
      description:
        "Mode d’emploi de la calculatrice IA KalkMate : première mise en route, WiFi, mode IA, batterie et recharge, mises à jour OTA, dépannage et FAQ.",
      type: "website",
      locale: ogLocale.fr,
      url: `${siteUrl}/fr/pomoc`,
      siteName: "KalkMate",
    },
    twitter: {
      card: "summary_large_image",
      title: "Mode d’emploi KalkMate — aide, WiFi et mode IA",
      description:
        "Mode d’emploi de la calculatrice IA KalkMate : première mise en route, WiFi, mode IA, batterie et recharge, mises à jour OTA, dépannage et FAQ.",
    },
  };
}

export default function PomocLayoutFr({ children }: { children: React.ReactNode }) {
  return children;
}
