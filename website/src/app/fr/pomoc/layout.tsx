import type { Metadata } from "next";
import { headers } from "next/headers";
import { locales, localePath, siteUrlFromHost } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "Aide et mode d’emploi — KalkMate",
    description:
      "Mode d’emploi de la calculatrice KalkMate : première mise en route, configuration WiFi, mode IA, dépannage et historique du firmware.",
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${siteUrl}/fr/pomoc`,
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, `${siteUrl}${localePath(l, "/pomoc")}`])),
        "x-default": `${siteUrl}/pomoc`,
      },
    },
  };
}

export default function PomocLayoutFr({ children }: { children: React.ReactNode }) {
  return children;
}
