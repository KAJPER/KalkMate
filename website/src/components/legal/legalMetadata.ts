import type { Metadata } from "next";
import { headers } from "next/headers";
import { languagePathAlternates, localePath, ogLocale, siteUrlFromHost, type Locale } from "@/lib/i18n";
import type { LegalDoc } from "./LegalPage";

export const REGULAMIN_PATH = "/regulamin";
export const POLITYKA_PATH = "/polityka-prywatnosci";

// Metadane strony prawnej w danym jezyku: canonical na wlasna wersje
// + hreflang do wszystkich jezykow. Dynamiczne (host) — patrz src/app/page.tsx (kalkmate.eu).
export async function legalMetadata(lang: Locale, path: string, doc: LegalDoc): Promise<Metadata> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  const url = `${siteUrl}${localePath(lang, path)}`;
  return {
    title: doc.metaTitle,
    description: doc.metaDescription,
    robots: { index: true, follow: true },
    alternates: { canonical: url, languages: languagePathAlternates(path, siteUrl) },
    openGraph: { title: doc.metaTitle, description: doc.metaDescription, type: "website", locale: ogLocale[lang], url, siteName: "KalkMate" },
  };
}
