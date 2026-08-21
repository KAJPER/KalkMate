import type { Metadata } from "next";
import { SITE_URL } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Formularz reklamacyjny — KalkMate",
  description:
    "Zgłoś reklamację lub usterkę kalkulatora KalkMate online. Wypełnij formularz, a zgłoszenie trafi bezpośrednio do naszego zespołu.",
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}/reklamacja` },
};

export default function ReklamacjaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
