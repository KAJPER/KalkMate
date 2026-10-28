import { type Locale } from "@/lib/i18n";
import { reviews, aggregateRating, type Review, type SourceLang } from "@/lib/content/reviews";
import { getApprovedReviews } from "@/lib/reviews";

type Dict = {
  eyebrow: string;
  heading: string;
  sub: string;
  verified: string;
  /** Etykieta przy opinii przetlumaczonej maszynowo, wg jezyka oryginalu. */
  translatedFrom: Record<SourceLang, string>;
  /** Rozwiniecie oryginalnej tresci. */
  original: string;
};

const dict: Record<Locale, Dict> = {
  pl: {
    eyebrow: "/ OPINIE UŻYTKOWNIKÓW",
    heading: "Co mówią użytkownicy.",
    sub: `${aggregateRating.ratingValue}/5 · ${aggregateRating.reviewCount} opinii`,
    verified: "Zweryfikowany zakup",
    translatedFrom: { pl: "Przetłumaczono z polskiego", en: "Przetłumaczono z angielskiego" },
    original: "Pokaż oryginał",
  },
  en: {
    eyebrow: "/ USER REVIEWS",
    heading: "What students say.",
    sub: `${aggregateRating.ratingValue}/5 · ${aggregateRating.reviewCount} reviews`,
    verified: "Verified purchase",
    translatedFrom: { pl: "Translated from Polish", en: "Translated from English" },
    original: "Show original",
  },
  de: {
    eyebrow: "/ NUTZERBEWERTUNGEN",
    heading: "Was Schüler sagen.",
    sub: `${aggregateRating.ratingValue}/5 · ${aggregateRating.reviewCount} Bewertungen`,
    verified: "Verifizierter Kauf",
    translatedFrom: { pl: "Aus dem Polnischen übersetzt", en: "Aus dem Englischen übersetzt" },
    original: "Original anzeigen",
  },
  cs: {
    eyebrow: "/ RECENZE UŽIVATELŮ",
    heading: "Co říkají studenti.",
    sub: `${aggregateRating.ratingValue}/5 · ${aggregateRating.reviewCount} recenzí`,
    verified: "Ověřený nákup",
    translatedFrom: { pl: "Přeloženo z polštiny", en: "Přeloženo z angličtiny" },
    original: "Zobrazit originál",
  },
  sk: {
    eyebrow: "/ RECENZIE POUŽÍVATEĽOV",
    heading: "Čo hovoria študenti.",
    sub: `${aggregateRating.ratingValue}/5 · ${aggregateRating.reviewCount} recenzií`,
    verified: "Overený nákup",
    translatedFrom: { pl: "Preložené z poľštiny", en: "Preložené z angličtiny" },
    original: "Zobraziť originál",
  },
  lt: {
    eyebrow: "/ NAUDOTOJŲ ATSILIEPIMAI",
    heading: "Ką sako mokiniai.",
    sub: `${aggregateRating.ratingValue}/5 · ${aggregateRating.reviewCount} atsiliepimų`,
    verified: "Patvirtintas pirkimas",
    translatedFrom: { pl: "Išversta iš lenkų kalbos", en: "Išversta iš anglų kalbos" },
    original: "Rodyti originalą",
  },
  be: {
    eyebrow: "/ ВОДГУКІ КАРЫСТАЛЬНІКАЎ",
    heading: "Што кажуць вучні.",
    sub: `${aggregateRating.ratingValue}/5 · ${aggregateRating.reviewCount} водгукаў`,
    verified: "Пацверджаная пакупка",
    translatedFrom: { pl: "Перакладзена з польскай", en: "Перакладзена з англійскай" },
    original: "Паказаць арыгінал",
  },
  es: {
    eyebrow: "/ OPINIONES DE USUARIOS",
    heading: "Lo que dicen los estudiantes.",
    sub: `${aggregateRating.ratingValue}/5 · ${aggregateRating.reviewCount} opiniones`,
    verified: "Compra verificada",
    translatedFrom: { pl: "Traducido del polaco", en: "Traducido del inglés" },
    original: "Ver original",
  },
  pt: {
    eyebrow: "/ OPINIÕES DE UTILIZADORES",
    heading: "O que dizem os estudantes.",
    sub: `${aggregateRating.ratingValue}/5 · ${aggregateRating.reviewCount} opiniões`,
    verified: "Compra verificada",
    translatedFrom: { pl: "Traduzido do polaco", en: "Traduzido do inglês" },
    original: "Ver original",
  },
  fr: {
    eyebrow: "/ AVIS DES UTILISATEURS",
    heading: "Ce qu’en disent les élèves.",
    sub: `${aggregateRating.ratingValue}/5 · ${aggregateRating.reviewCount} avis`,
    verified: "Achat vérifié",
    translatedFrom: { pl: "Traduit du polonais", en: "Traduit de l’anglais" },
    original: "Voir l’original",
  },
  it: {
    eyebrow: "/ RECENSIONI DEGLI UTENTI",
    heading: "Cosa dicono gli studenti.",
    sub: `${aggregateRating.ratingValue}/5 · ${aggregateRating.reviewCount} recensioni`,
    verified: "Acquisto verificato",
    translatedFrom: { pl: "Tradotto dal polacco", en: "Tradotto dall’inglese" },
    original: "Mostra originale",
  },
};

function Stars({ rating }: { rating: number }) {
  return (
    <div role="img" className="flex gap-0.5" aria-label={`${rating} z 5 gwiazdek`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill={i < rating ? "#D8FF3D" : "none"}
          stroke={i < rating ? "#D8FF3D" : "rgba(242,237,227,0.2)"}
          strokeWidth="1"
        >
          <polygon points="6,1 7.5,4.5 11,4.8 8.5,7 9.3,11 6,9 2.7,11 3.5,7 1,4.8 4.5,4.5" />
        </svg>
      ))}
    </div>
  );
}

// Zatwierdzone opinie zweryfikowanych kupujacych (lib/reviews.ts) w jezyku
// strony, z trescia. Blad bazy = po prostu bez nich (sekcja dziala jak dotad).
async function verifiedReviews(lang: Locale): Promise<Review[]> {
  try {
    const list = await getApprovedReviews();
    return list
      .filter((r) => r.lang === lang && r.text.trim())
      .map((r) => ({
        author: r.name,
        location: "",
        rating: Math.min(5, Math.max(1, Math.round(r.rating))) as Review["rating"],
        date: r.date,
        body: r.text,
        verified: true,
      }));
  } catch (e) {
    console.error("[Reviews] verified reviews failed:", e);
    return [];
  }
}

export default async function Reviews({ lang = "pl" }: { lang?: Locale }) {
  const t = dict[lang];
  // Najpierw zweryfikowane (z bazy), potem prawdziwe opinie z content/reviews.ts
  // (na wersjach jezykowych: tlumaczenie + oryginal).
  const list = [...(await verifiedReviews(lang)), ...reviews[lang]];

  return (
    <section id="opinie" className="relative bg-[#0D0D0D] py-20 lg:py-28 border-t border-[rgba(242,237,227,0.08)]">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">

        {/* Header */}
        <div className="mb-10">
          <p className="km-mono-eyebrow text-[#D8FF3D]">{t.eyebrow}</p>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-6">
            <h2 className="km-display text-[clamp(28px,3.5vw,52px)] text-[#F2EDE3] leading-[0.95]">
              {t.heading}
            </h2>
            <div className="flex items-center gap-2 pb-1">
              <Stars rating={5} />
              <span className="km-mono-eyebrow text-[#F2EDE3]/55 text-[10px]">{t.sub}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tasma opinii przewijana w petli (CSS, bez JS) — druga kopia jest tylko
          wizualnym przedluzeniem petli, ukryta przed czytnikami ekranu. */}
      <div
        className="km-reviews-viewport overflow-hidden"
        style={{ ["--km-reviews-duration" as string]: `${Math.max(30, list.length * 9)}s` }}
      >
        <div className="km-reviews-track flex w-max">
          {[0, 1].map((copy) =>
            list.map((r, i) => (
              <article
                key={`${copy}-${i}`}
                {...(copy === 1 ? { "aria-hidden": true, "data-dup": "" } : {})}
                className="mr-4 w-[300px] sm:w-[360px] shrink-0 border border-[rgba(242,237,227,0.10)] bg-[#111] p-5 flex flex-col gap-3"
              >
                <Stars rating={r.rating} />

                <p className="text-[14px] leading-[1.6] text-[#F2EDE3]/80 flex-1">
                  {r.body}
                </p>

                {/* Tlumaczenie maszynowe prawdziwej opinii — etykieta + oryginal
                    w natywnym <details> (bez JS, dostepne z klawiatury). W kopii
                    petli (aria-hidden) summary poza kolejnoscia Tab. */}
                {r.translatedFrom && r.original && (
                  <details>
                    <summary
                      tabIndex={copy === 1 ? -1 : undefined}
                      className="km-mono-eyebrow text-[10px] text-[#F2EDE3]/40 cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:text-[#F2EDE3]/70 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#D8FF3D]"
                    >
                      {t.translatedFrom[r.translatedFrom]} · <span className="underline underline-offset-2">{t.original}</span>
                    </summary>
                    <p lang={r.translatedFrom} className="mt-2 text-[13px] leading-[1.55] italic text-[#F2EDE3]/60">
                      {r.original}
                    </p>
                  </details>
                )}

                <div className="border-t border-[rgba(242,237,227,0.08)] pt-3 flex items-center justify-between">
                  <div>
                    <p className="text-[13px] text-[#F2EDE3] font-medium">
                      {r.author}
                    </p>
                    {r.location && (
                      <p className="km-mono-eyebrow text-[#F2EDE3]/55 text-[10px] mt-0.5">{r.location}</p>
                    )}
                  </div>
                  {/* Odznaka tylko przy potwierdzonym zakupie (verified === true) —
                      tlumaczenia przejmuja flage z oryginalnej opinii. */}
                  {r.verified === true && (
                    <span className="km-mono-eyebrow text-[#D8FF3D]/60 text-[10px]">{t.verified}</span>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
