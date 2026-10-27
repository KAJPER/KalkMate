import { type Locale } from "@/lib/i18n";
import { reviews, aggregateRating } from "@/lib/content/reviews";

const dict: Record<Locale, { eyebrow: string; heading: string; sub: string; verified: string }> = {
  pl: {
    eyebrow: "/ OPINIE UŻYTKOWNIKÓW",
    heading: "Co mówią maturzyści.",
    sub: `${aggregateRating.ratingValue}/5 · ${aggregateRating.reviewCount} opinii`,
    verified: "Zweryfikowany zakup",
  },
  en: {
    eyebrow: "/ USER REVIEWS",
    heading: "What students say.",
    sub: `${aggregateRating.ratingValue}/5 · ${aggregateRating.reviewCount} reviews`,
    verified: "Verified purchase",
  },
  de: {
    eyebrow: "/ NUTZERBEWERTUNGEN",
    heading: "Was Schüler sagen.",
    sub: `${aggregateRating.ratingValue}/5 · ${aggregateRating.reviewCount} Bewertungen`,
    verified: "Verifizierter Kauf",
  },
  cs: {
    eyebrow: "/ RECENZE UŽIVATELŮ",
    heading: "Co říkají studenti.",
    sub: `${aggregateRating.ratingValue}/5 · ${aggregateRating.reviewCount} recenzí`,
    verified: "Ověřený nákup",
  },
  sk: {
    eyebrow: "/ RECENZIE POUŽÍVATEĽOV",
    heading: "Čo hovoria študenti.",
    sub: `${aggregateRating.ratingValue}/5 · ${aggregateRating.reviewCount} recenzií`,
    verified: "Overený nákup",
  },
  lt: {
    eyebrow: "/ NAUDOTOJŲ ATSILIEPIMAI",
    heading: "Ką sako mokiniai.",
    sub: `${aggregateRating.ratingValue}/5 · ${aggregateRating.reviewCount} atsiliepimų`,
    verified: "Patvirtintas pirkimas",
  },
  be: {
    eyebrow: "/ ВОДГУКІ КАРЫСТАЛЬНІКАЎ",
    heading: "Што кажуць вучні.",
    sub: `${aggregateRating.ratingValue}/5 · ${aggregateRating.reviewCount} водгукаў`,
    verified: "Пацверджаная пакупка",
  },
  es: {
    eyebrow: "/ OPINIONES DE USUARIOS",
    heading: "Lo que dicen los estudiantes.",
    sub: `${aggregateRating.ratingValue}/5 · ${aggregateRating.reviewCount} opiniones`,
    verified: "Compra verificada",
  },
  pt: {
    eyebrow: "/ OPINIÕES DE UTILIZADORES",
    heading: "O que dizem os estudantes.",
    sub: `${aggregateRating.ratingValue}/5 · ${aggregateRating.reviewCount} opiniões`,
    verified: "Compra verificada",
  },
  fr: {
    eyebrow: "/ AVIS DES UTILISATEURS",
    heading: "Ce qu’en disent les élèves.",
    sub: `${aggregateRating.ratingValue}/5 · ${aggregateRating.reviewCount} avis`,
    verified: "Achat vérifié",
  },
  it: {
    eyebrow: "/ RECENSIONI DEGLI UTENTI",
    heading: "Cosa dicono gli studenti.",
    sub: `${aggregateRating.ratingValue}/5 · ${aggregateRating.reviewCount} recensioni`,
    verified: "Acquisto verificato",
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

export default function Reviews({ lang = "pl" }: { lang?: Locale }) {
  const t = dict[lang];
  const list = reviews[lang];

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

                <div className="border-t border-[rgba(242,237,227,0.08)] pt-3 flex items-center justify-between">
                  <div>
                    <p className="text-[13px] text-[#F2EDE3] font-medium">
                      {r.author}
                    </p>
                    <p className="km-mono-eyebrow text-[#F2EDE3]/55 text-[10px] mt-0.5">{r.location}</p>
                  </div>
                  <span className="km-mono-eyebrow text-[#D8FF3D]/60 text-[10px]">{t.verified}</span>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
