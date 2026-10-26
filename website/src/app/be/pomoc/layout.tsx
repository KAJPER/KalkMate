import type { Metadata } from "next";
import { ogImages } from "@/lib/seo";
import { headers } from "next/headers";
import { locales, localePath, ogLocale, siteUrlFromHost } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "Інструкцыя KalkMate — дапамога, WiFi, рэжым ШІ",
    description:
      "Інструкцыя да калькулятара KalkMate з ШІ: першы запуск, WiFi, рэжым ШІ, батарэя і зарадка, абнаўленні OTA, вырашэнне праблем і частыя пытанні.",
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${siteUrl}/be/pomoc`,
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, `${siteUrl}${localePath(l, "/pomoc")}`])),
        "x-default": `${siteUrl}/pomoc`,
      },
    },
    openGraph: {
      images: ogImages,
      title: "Інструкцыя KalkMate — дапамога, WiFi, рэжым ШІ",
      description:
        "Інструкцыя да калькулятара KalkMate з ШІ: першы запуск, WiFi, рэжым ШІ, батарэя і зарадка, абнаўленні OTA, вырашэнне праблем і частыя пытанні.",
      type: "website",
      locale: ogLocale.be,
      url: `${siteUrl}/be/pomoc`,
      siteName: "KalkMate",
    },
    twitter: {
      images: ogImages,
      card: "summary_large_image",
      title: "Інструкцыя KalkMate — дапамога, WiFi, рэжым ШІ",
      description:
        "Інструкцыя да калькулятара KalkMate з ШІ: першы запуск, WiFi, рэжым ШІ, батарэя і зарадка, абнаўленні OTA, вырашэнне праблем і частыя пытанні.",
    },
  };
}

export default function PomocLayoutBe({ children }: { children: React.ReactNode }) {
  return children;
}
