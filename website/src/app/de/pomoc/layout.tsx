import type { Metadata } from "next";
import { SITE_URL } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Hilfe und Bedienungsanleitung — KalkMate",
  description:
    "Bedienungsanleitung für den KalkMate-Taschenrechner: erste Inbetriebnahme, WLAN-Einrichtung, KI-Modus, Fehlerbehebung und Firmware-Verlauf.",
  robots: { index: true, follow: true },
  alternates: {
    canonical: `${SITE_URL}/de/pomoc`,
    languages: {
      pl: `${SITE_URL}/pomoc`,
      en: `${SITE_URL}/en/pomoc`,
      de: `${SITE_URL}/de/pomoc`,
      "x-default": `${SITE_URL}/pomoc`,
    },
  },
};

export default function PomocLayoutDe({ children }: { children: React.ReactNode }) {
  return children;
}
