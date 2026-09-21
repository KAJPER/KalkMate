import type { Metadata } from "next";
import { headers } from "next/headers";
import { siteUrlFromHost } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "Help & User Guide — KalkMate",
    description:
      "KalkMate calculator user guide: first setup, WiFi configuration, AI mode, troubleshooting and firmware history.",
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${siteUrl}/en/pomoc`,
      languages: {
        pl: `${siteUrl}/pomoc`,
        en: `${siteUrl}/en/pomoc`,
        de: `${siteUrl}/de/pomoc`,
        "x-default": `${siteUrl}/pomoc`,
      },
    },
  };
}

export default function PomocLayoutEn({ children }: { children: React.ReactNode }) {
  return children;
}
