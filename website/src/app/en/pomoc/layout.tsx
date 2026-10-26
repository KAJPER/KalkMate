import type { Metadata } from "next";
import { ogImages } from "@/lib/seo";
import { headers } from "next/headers";
import { locales, localePath, ogLocale, siteUrlFromHost } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "KalkMate User Manual & Help — Setup, WiFi, AI Mode",
    description:
      "KalkMate AI calculator user manual: first setup, WiFi, AI mode, battery and charging, OTA updates, troubleshooting, FAQ and firmware changelog.",
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${siteUrl}/en/pomoc`,
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, `${siteUrl}${localePath(l, "/pomoc")}`])),
        "x-default": `${siteUrl}/pomoc`,
      },
    },
    openGraph: {
      images: ogImages,
      title: "KalkMate User Manual & Help — Setup, WiFi, AI Mode",
      description:
        "KalkMate AI calculator user manual: first setup, WiFi, AI mode, battery and charging, OTA updates, troubleshooting, FAQ and firmware changelog.",
      type: "website",
      locale: ogLocale.en,
      url: `${siteUrl}/en/pomoc`,
      siteName: "KalkMate",
    },
    twitter: {
      images: ogImages,
      card: "summary_large_image",
      title: "KalkMate User Manual & Help — Setup, WiFi, AI Mode",
      description:
        "KalkMate AI calculator user manual: first setup, WiFi, AI mode, battery and charging, OTA updates, troubleshooting, FAQ and firmware changelog.",
    },
  };
}

export default function PomocLayoutEn({ children }: { children: React.ReactNode }) {
  return children;
}
