import type { Metadata } from "next";
import { headers } from "next/headers";
import { locales, localePath, siteUrlFromHost } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "Pomoc a návod na použitie — KalkMate",
    description:
      "Návod na použitie kalkulačky KalkMate: prvé spustenie, nastavenie WiFi, režim AI, riešenie problémov a história firmvéru.",
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${siteUrl}/sk/pomoc`,
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, `${siteUrl}${localePath(l, "/pomoc")}`])),
        "x-default": `${siteUrl}/pomoc`,
      },
    },
  };
}

export default function PomocLayoutSk({ children }: { children: React.ReactNode }) {
  return children;
}
