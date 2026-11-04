import type { Metadata } from "next";
import { headers } from "next/headers";
import { siteUrlFromHost } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "Wypożycz kalkulator KalkMate — od 79 zł | KalkMate",
    description:
      "Wypożycz KalkMate na tydzień, miesiąc albo cały okres matur. Dostawa do Paczkomatu, płatność BLIK lub przelewem, zwrotna kaucja 300 zł.",
    robots: { index: true, follow: true },
    alternates: { canonical: `${siteUrl}/wypozyczenie` },
  };
}

export default function WypozyczenieLayout({ children }: { children: React.ReactNode }) {
  return children;
}
