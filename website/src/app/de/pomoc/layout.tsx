import type { Metadata } from "next";
import { headers } from "next/headers";
import { siteUrlFromHost } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "Hilfe und Bedienungsanleitung — KalkMate",
    description:
      "Bedienungsanleitung für den KalkMate-Taschenrechner: erste Inbetriebnahme, WLAN-Einrichtung, KI-Modus, Fehlerbehebung und Firmware-Verlauf.",
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${siteUrl}/de/pomoc`,
      languages: {
        pl: `${siteUrl}/pomoc`,
        en: `${siteUrl}/en/pomoc`,
        de: `${siteUrl}/de/pomoc`,
        "x-default": `${siteUrl}/pomoc`,
      },
    },
  };
}

export default function PomocLayoutDe({ children }: { children: React.ReactNode }) {
  return children;
}
