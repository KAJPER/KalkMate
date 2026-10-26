import type { Metadata } from "next";
import { headers } from "next/headers";
import { locales, localePath, siteUrlFromHost } from "@/lib/i18n";

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
        ...Object.fromEntries(locales.map((l) => [l, `${siteUrl}${localePath(l, "/pomoc")}`])),
        "x-default": `${siteUrl}/pomoc`,
      },
    },
  };
}

export default function PomocLayoutEn({ children }: { children: React.ReactNode }) {
  return children;
}
