import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { locales, localeHomeUrl, localePath, siteUrlFromHost } from "@/lib/i18n";

// Zastepuje dawny staly public/sitemap.xml (zawsze wskazywal na kalkmate.pl,
// niezaleznie od domeny — dla kalkmate.eu to byloby wprost szkodliwe: mapa
// strony pelna adresow OBCEJ domeny). Next.js generuje ten plik pod
// /sitemap.xml z tej konwencji (public/sitemap.xml musial zostac usuniety,
// koliduje z ta trasa).
// Czas startu serwera = czas ostatniego wdrozenia. Wczesniej bylo new Date()
// przy kazdym pobraniu mapy — "zmienione przed chwila" za kazdym razem, wiec
// Google przestaje ufac lastModified calej mapy.
const DEPLOYED_AT = new Date();

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  // hreflang miedzy wersjami jezykowymi (lista jezykow z lib/i18n.ts).
  const alt = { languages: Object.fromEntries(locales.map((l) => [l, localeHomeUrl(l, siteUrl)])) };
  const pomocAlt = {
    languages: Object.fromEntries(locales.map((l) => [l, `${siteUrl}${localePath(l, "/pomoc")}`])),
  };

  const homes: MetadataRoute.Sitemap = locales.map((l) => ({
    url: localeHomeUrl(l, siteUrl),
    lastModified: DEPLOYED_AT,
    changeFrequency: "daily",
    priority: l === "pl" ? 1.0 : 0.9,
    alternates: alt,
  }));
  const pomoc: MetadataRoute.Sitemap = locales.map((l) => ({
    url: `${siteUrl}${localePath(l, "/pomoc")}`,
    lastModified: DEPLOYED_AT,
    changeFrequency: "weekly",
    priority: l === "pl" ? 0.6 : 0.5,
    alternates: pomocAlt,
  }));

  return [
    ...homes,
    ...pomoc,
    {
      url: `${siteUrl}/reklamacja`,
      lastModified: DEPLOYED_AT,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${siteUrl}/regulamin`,
      lastModified: DEPLOYED_AT,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/polityka-prywatnosci`,
      lastModified: DEPLOYED_AT,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}
