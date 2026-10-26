import type { Metadata } from "next";
import { headers } from "next/headers";
import { locales, localePath, siteUrlFromHost } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "Nápověda a návod k obsluze — KalkMate",
    description:
      "Návod k obsluze kalkulačky KalkMate: první spuštění, nastavení WiFi, režim AI, řešení problémů a historie firmwaru.",
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${siteUrl}/cs/pomoc`,
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, `${siteUrl}${localePath(l, "/pomoc")}`])),
        "x-default": `${siteUrl}/pomoc`,
      },
    },
  };
}

export default function PomocLayoutCs({ children }: { children: React.ReactNode }) {
  return children;
}
