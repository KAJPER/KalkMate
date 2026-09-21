import type { Metadata } from "next";
import { headers } from "next/headers";
import { siteUrlFromHost } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  return {
    title: "Formularz reklamacyjny — KalkMate",
    description:
      "Zgłoś reklamację lub usterkę kalkulatora KalkMate online. Wypełnij formularz, a zgłoszenie trafi bezpośrednio do naszego zespołu.",
    robots: { index: true, follow: true },
    alternates: { canonical: `${siteUrl}/reklamacja` },
  };
}

export default function ReklamacjaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
