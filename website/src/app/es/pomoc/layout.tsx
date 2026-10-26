import type { Metadata } from "next";
import { headers } from "next/headers";
import { locales, localePath, siteUrlFromHost } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "Ayuda y manual de usuario — KalkMate",
    description:
      "Manual de la calculadora KalkMate: primer encendido, configuración WiFi, modo IA, solución de problemas e historial de firmware.",
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${siteUrl}/es/pomoc`,
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, `${siteUrl}${localePath(l, "/pomoc")}`])),
        "x-default": `${siteUrl}/pomoc`,
      },
    },
  };
}

export default function PomocLayoutEs({ children }: { children: React.ReactNode }) {
  return children;
}
