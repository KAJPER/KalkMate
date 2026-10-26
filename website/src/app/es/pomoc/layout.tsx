import type { Metadata } from "next";
import { ogImages } from "@/lib/seo";
import { headers } from "next/headers";
import { locales, localePath, ogLocale, siteUrlFromHost } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "Manual de usuario de KalkMate — ayuda, WiFi y modo IA",
    description:
      "Manual de usuario de la calculadora con IA KalkMate: primer arranque, WiFi, modo IA, batería y carga, actualizaciones OTA, solución de problemas y FAQ.",
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${siteUrl}/es/pomoc`,
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, `${siteUrl}${localePath(l, "/pomoc")}`])),
        "x-default": `${siteUrl}/pomoc`,
      },
    },
    openGraph: {
      images: ogImages,
      title: "Manual de usuario de KalkMate — ayuda, WiFi y modo IA",
      description:
        "Manual de usuario de la calculadora con IA KalkMate: primer arranque, WiFi, modo IA, batería y carga, actualizaciones OTA, solución de problemas y FAQ.",
      type: "website",
      locale: ogLocale.es,
      url: `${siteUrl}/es/pomoc`,
      siteName: "KalkMate",
    },
    twitter: {
      images: ogImages,
      card: "summary_large_image",
      title: "Manual de usuario de KalkMate — ayuda, WiFi y modo IA",
      description:
        "Manual de usuario de la calculadora con IA KalkMate: primer arranque, WiFi, modo IA, batería y carga, actualizaciones OTA, solución de problemas y FAQ.",
    },
  };
}

export default function PomocLayoutEs({ children }: { children: React.ReactNode }) {
  return children;
}
