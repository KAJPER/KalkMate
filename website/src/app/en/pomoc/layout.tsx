import type { Metadata } from "next";
import { SITE_URL } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Help & User Guide — KalkMate",
  description:
    "KalkMate calculator user guide: first setup, WiFi configuration, AI mode, troubleshooting and firmware history.",
  robots: { index: true, follow: true },
  alternates: {
    canonical: `${SITE_URL}/en/pomoc`,
    languages: {
      pl: `${SITE_URL}/pomoc`,
      en: `${SITE_URL}/en/pomoc`,
      de: `${SITE_URL}/de/pomoc`,
      "x-default": `${SITE_URL}/pomoc`,
    },
  },
};

export default function PomocLayoutEn({ children }: { children: React.ReactNode }) {
  return children;
}
