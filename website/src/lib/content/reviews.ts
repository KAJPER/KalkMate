import { type Locale, locales } from "@/lib/i18n";
import source from "./reviews-source.json";
import translationsJson from "./reviews-translations.json";

export type Review = {
  author: string;
  location: string;
  rating: 1 | 2 | 3 | 4 | 5;
  date: string;
  body: string;
  /** true = zweryfikowany zakup (odznaka). false/undefined = bez odznaki. */
  verified?: boolean;
  /** Ustawione, gdy `body` to tlumaczenie maszynowe — jezyk oryginalu. */
  translatedFrom?: SourceLang;
  /** Oryginalna tresc opinii (tylko przy translatedFrom). */
  original?: string;
};

/** Jezyk, w ktorym opinia zostala napisana (w zrodle prawie wszystkie PL). */
export type SourceLang = "pl" | "en";

// Opinie PL: prawdziwe dane (formularz Google + opinie z Allegro sprzed
// sklepu), wyeksportowane do reviews-source.json z oryginalnymi polami.
// Pokazujemy TYLKO te ze zgoda na publikacje; odznaka "zweryfikowany zakup"
// tylko tam, gdzie zweryfikowany_zakup = true. Najnowsze na poczatku.
type SourceReview = {
  id: number;
  tresc_opinii: string;
  ocena: number;
  imie: string;
  data: string; // "YYYY-MM-DD HH:mm"
  miasto: string;
  jezyk: string;
  zweryfikowany_zakup: boolean;
  zgoda_na_publikacje: boolean;
};

// Pole `jezyk` w zrodle bywa bledne (np. polska opinia oznaczona "EN"),
// wiec za angielska uznajemy tylko "EN" bez polskich znakow.
const sourceLang = (r: SourceReview): SourceLang =>
  r.jezyk.toUpperCase() === "EN" && !/[ąćęłńóśźż]/i.test(r.tresc_opinii) ? "en" : "pl";

const realPl = (source as SourceReview[])
  .filter((r) => r.zgoda_na_publikacje)
  .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : b.id - a.id))
  .map((r) => ({
    id: r.id,
    lang: sourceLang(r),
    review: {
      author: r.imie,
      location: r.miasto,
      rating: Math.min(5, Math.max(1, Math.round(r.ocena))) as Review["rating"],
      date: r.data.slice(0, 10),
      body: r.tresc_opinii,
      verified: r.zweryfikowany_zakup,
    } satisfies Review,
  }));

const realReviewsPl: Review[] = realPl.map((r) => r.review);

// Pozostale jezyki: TE SAME prawdziwe opinie (autor, miasto, ocena, data,
// odznaka bez zmian), tylko tresc przetlumaczona maszynowo
// (reviews-translations.json: { "<jezyk>": { "<id>": "<tekst>" } }) i oznaczona
// jako tlumaczenie z oryginalem pod reka. Brak tlumaczenia = oryginalna tresc
// (bez etykiety "przetlumaczono").
const translations = translationsJson as Partial<Record<Locale, Record<string, string>>>;

function localized(locale: Exclude<Locale, "pl">): Review[] {
  const map = translations[locale] ?? {};
  return realPl.map(({ id, lang, review }) => {
    const text = map[String(id)];
    if (lang === locale || !text) return review;
    return { ...review, body: text, translatedFrom: lang, original: review.body };
  });
}

export const reviews = Object.fromEntries(
  locales.map((l) => [l, l === "pl" ? realReviewsPl : localized(l)]),
) as Record<Locale, Review[]>;

// Ocena zbiorcza liczona z prawdziwych opinii (nie wpisana recznie).
const _ratingSum = realReviewsPl.reduce((sum, r) => sum + r.rating, 0);
export const aggregateRating = {
  ratingValue: (_ratingSum / realReviewsPl.length).toFixed(1),
  reviewCount: String(realReviewsPl.length),
  bestRating: "5",
  worstRating: "1",
};
