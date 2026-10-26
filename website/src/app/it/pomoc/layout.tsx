import type { Metadata } from "next";
import { headers } from "next/headers";
import { locales, localePath, siteUrlFromHost } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "Assistenza e manuale d’uso — KalkMate",
    description:
      "Manuale della calcolatrice KalkMate: primo avvio, configurazione WiFi, modalità IA, risoluzione dei problemi e cronologia del firmware.",
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${siteUrl}/it/pomoc`,
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, `${siteUrl}${localePath(l, "/pomoc")}`])),
        "x-default": `${siteUrl}/pomoc`,
      },
    },
  };
}

export default function PomocLayoutIt({ children }: { children: React.ReactNode }) {
  return children;
}
