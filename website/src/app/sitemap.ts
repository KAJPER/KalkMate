import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { siteUrlFromHost } from "@/lib/i18n";

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
  const pomocAlt = {
    languages: {
      pl: `${siteUrl}/pomoc`,
      en: `${siteUrl}/en/pomoc`,
      de: `${siteUrl}/de/pomoc`,
    },
  };
  const alt = {
    languages: {
      pl: `${siteUrl}/`,
      en: `${siteUrl}/en`,
      de: `${siteUrl}/de`,
    },
  };

  return [
    {
      url: `${siteUrl}/`,
      lastModified: DEPLOYED_AT,
      changeFrequency: "daily",
      priority: 1.0,
      alternates: alt,
    },
    {
      url: `${siteUrl}/en`,
      lastModified: DEPLOYED_AT,
      changeFrequency: "daily",
      priority: 0.9,
      alternates: alt,
    },
    {
      url: `${siteUrl}/de`,
      lastModified: DEPLOYED_AT,
      changeFrequency: "daily",
      priority: 0.9,
      alternates: alt,
    },
    {
      url: `${siteUrl}/pomoc`,
      lastModified: DEPLOYED_AT,
      changeFrequency: "weekly",
      priority: 0.6,
      alternates: pomocAlt,
    },
    {
      url: `${siteUrl}/en/pomoc`,
      lastModified: DEPLOYED_AT,
      changeFrequency: "weekly",
      priority: 0.5,
      alternates: pomocAlt,
    },
    {
      url: `${siteUrl}/de/pomoc`,
      lastModified: DEPLOYED_AT,
      changeFrequency: "weekly",
      priority: 0.5,
      alternates: pomocAlt,
    },
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
