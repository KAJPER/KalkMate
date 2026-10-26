import type { Metadata } from "next";
import { ogImages } from "@/lib/seo";
import { headers } from "next/headers";
import { locales, localePath, ogLocale, siteUrlFromHost } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "Manual de utilização KalkMate — ajuda, WiFi e modo IA",
    description:
      "Manual de utilização da calculadora com IA KalkMate: primeiro arranque, WiFi, modo IA, bateria e carregamento, atualizações OTA, resolução de problemas e FAQ.",
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${siteUrl}/pt/pomoc`,
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, `${siteUrl}${localePath(l, "/pomoc")}`])),
        "x-default": `${siteUrl}/pomoc`,
      },
    },
    openGraph: {
      images: ogImages,
      title: "Manual de utilização KalkMate — ajuda, WiFi e modo IA",
      description:
        "Manual de utilização da calculadora com IA KalkMate: primeiro arranque, WiFi, modo IA, bateria e carregamento, atualizações OTA, resolução de problemas e FAQ.",
      type: "website",
      locale: ogLocale.pt,
      url: `${siteUrl}/pt/pomoc`,
      siteName: "KalkMate",
    },
    twitter: {
      images: ogImages,
      card: "summary_large_image",
      title: "Manual de utilização KalkMate — ajuda, WiFi e modo IA",
      description:
        "Manual de utilização da calculadora com IA KalkMate: primeiro arranque, WiFi, modo IA, bateria e carregamento, atualizações OTA, resolução de problemas e FAQ.",
    },
  };
}

export default function PomocLayoutPt({ children }: { children: React.ReactNode }) {
  return children;
}
