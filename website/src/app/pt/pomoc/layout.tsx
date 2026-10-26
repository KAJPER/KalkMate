import type { Metadata } from "next";
import { headers } from "next/headers";
import { locales, localePath, siteUrlFromHost } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "Ajuda e manual de utilização — KalkMate",
    description:
      "Manual da calculadora KalkMate: primeira utilização, configuração do WiFi, modo IA, resolução de problemas e histórico de firmware.",
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${siteUrl}/pt/pomoc`,
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, `${siteUrl}${localePath(l, "/pomoc")}`])),
        "x-default": `${siteUrl}/pomoc`,
      },
    },
  };
}

export default function PomocLayoutPt({ children }: { children: React.ReactNode }) {
  return children;
}
