import type { Metadata } from "next";
import { headers } from "next/headers";
import { locales, localePath, siteUrlFromHost } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "Pagalba ir naudojimo instrukcija — KalkMate",
    description:
      "KalkMate skaičiuotuvo naudojimo instrukcija: pirmasis paleidimas, WiFi nustatymas, DI režimas, problemų sprendimas ir programinės įrangos istorija.",
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${siteUrl}/lt/pomoc`,
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, `${siteUrl}${localePath(l, "/pomoc")}`])),
        "x-default": `${siteUrl}/pomoc`,
      },
    },
  };
}

export default function PomocLayoutLt({ children }: { children: React.ReactNode }) {
  return children;
}
