// Walidacja danych z /admin/newsletter (wspolna dla testu i wysylki).
import type { AudienceFilter, CampaignContent } from "@/lib/newsletter";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function parseContent(raw: unknown): { ok: true; content: CampaignContent } | { ok: false; error: string } {
  const b = (raw || {}) as Record<string, unknown>;
  const subject = str(b.subject, 200);
  const body = str(b.body, 50_000);
  if (!subject) return { ok: false, error: "Podaj temat." };
  if (!body) return { ok: false, error: "Wpisz treść." };
  const ctaUrl = str(b.ctaUrl, 500);
  if (ctaUrl && !/^https?:\/\//.test(ctaUrl)) return { ok: false, error: "Link przycisku musi zaczynać się od https://" };

  let image: CampaignContent["image"] = null;
  const img = b.image as Record<string, unknown> | null | undefined;
  if (img) {
    const contentType = str(img.contentType, 50).toLowerCase();
    const data = typeof img.data === "string" ? img.data : "";
    if (!IMAGE_TYPES.has(contentType) || !/^[A-Za-z0-9+/=]+$/.test(data)) return { ok: false, error: "Nieprawidłowe zdjęcie." };
    if (data.length > 3_000_000) return { ok: false, error: "Zdjęcie jest za duże (max ~2 MB)." };
    image = { filename: str(img.filename, 100) || "image.jpg", contentType, data };
  }

  const lang = b.lang === "en" || b.lang === "de" ? b.lang : "pl";
  return {
    ok: true,
    content: {
      subject,
      body,
      title: str(b.title, 200),
      eyebrow: str(b.eyebrow, 60) || undefined,
      preheader: str(b.preheader, 200) || undefined,
      ctaText: str(b.ctaText, 60) || undefined,
      ctaUrl: ctaUrl || undefined,
      lang,
      image,
    },
  };
}

export function parseFilter(raw: unknown): AudienceFilter {
  const f = (raw || {}) as Record<string, unknown>;
  const country = f.country === "PL" || f.country === "foreign" ? f.country : "all";
  return {
    registered: f.registered !== false && f.registered !== "0",
    verifiedOnly: f.verifiedOnly === true || f.verifiedOnly === "1",
    buyers: f.buyers !== false && f.buyers !== "0",
    country,
    // Domyslnie TYLKO ze zgoda — bez niej wolno wysylac wylacznie tresci
    // informacyjne (wtedy admin swiadomie odznacza).
    consentOnly: f.consentOnly !== false && f.consentOnly !== "0",
  };
}
