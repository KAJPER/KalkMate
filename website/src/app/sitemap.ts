import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { siteUrlFromHost } from "@/lib/i18n";

// Zastepuje dawny staly public/sitemap.xml (zawsze wskazywal na kalkmate.pl,
// niezaleznie od domeny — dla kalkmate.eu to byloby wprost szkodliwe: mapa
// strony pelna adresow OBCEJ domeny). Next.js generuje ten plik pod
// /sitemap.xml z tej konwencji (public/sitemap.xml musial zostac usuniety,
// koliduje z ta trasa).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
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
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
      alternates: alt,
    },
    {
      url: `${siteUrl}/en`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
      alternates: alt,
    },
    {
      url: `${siteUrl}/de`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
      alternates: alt,
    },
    {
      url: `${siteUrl}/pomoc`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/regulamin`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/polityka-prywatnosci`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}
