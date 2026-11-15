import type { Metadata } from "next";
import { headers } from "next/headers";
import { siteUrlFromHost } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "Black Friday 2026 — regulamin promocji | KalkMate",
    description: "Zasady promocji Black Friday w KalkMate: kalkulator za 549 zł (limit 50 sztuk) i wypożyczenie na miesiąc za 99 zł, 27–30 listopada 2026.",
    robots: { index: true, follow: true },
    alternates: { canonical: `${siteUrl}/black-friday` },
  };
}

export default function BlackFridayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
