import type { Metadata } from "next";
import { headers } from "next/headers";
import { locales, localePath, siteUrlFromHost } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "Дапамога і інструкцыя — KalkMate",
    description:
      "Інструкцыя да калькулятара KalkMate: першы запуск, наладжванне WiFi, рэжым ШІ, вырашэнне праблем і гісторыя прашыўкі.",
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${siteUrl}/be/pomoc`,
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, `${siteUrl}${localePath(l, "/pomoc")}`])),
        "x-default": `${siteUrl}/pomoc`,
      },
    },
  };
}

export default function PomocLayoutBe({ children }: { children: React.ReactNode }) {
  return children;
}
