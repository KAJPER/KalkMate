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
        <div className="mb-12">
          <p className="km-mono-eyebrow text-[#D8FF3D]">{t.eyebrow}</p>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-6">
            <h2 className="km-display text-[clamp(28px,3.5vw,52px)] text-[#F2EDE3] leading-[0.95]">
              {t.heading}
            </h2>
            <div className="flex items-center gap-2 pb-1">
              <Stars rating={5} />
              <span className="km-mono-eyebrow text-[#F2EDE3]/40 text-[10px]">{t.sub}</span>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((r, i) => (
            <article
              key={i}
              className="border border-[rgba(242,237,227,0.10)] bg-[#111] p-5 flex flex-col gap-3"
              itemScope
              itemType="https://schema.org/Review"
            >
              <Stars rating={r.rating} />

              <p
                className="text-[14px] leading-[1.6] text-[#F2EDE3]/80 flex-1"
                itemProp="reviewBody"
              >
                {r.body}
              </p>

              <div className="border-t border-[rgba(242,237,227,0.08)] pt-3 flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-[#F2EDE3] font-medium" itemProp="author" itemScope itemType="https://schema.org/Person">
                    <span itemProp="name">{r.author}</span>
                  </p>
                  <p className="km-mono-eyebrow text-[#F2EDE3]/35 text-[10px] mt-0.5">{r.location}</p>
                </div>
                <span className="km-mono-eyebrow text-[#D8FF3D]/60 text-[10px]">{t.verified}</span>
              </div>

              <meta itemProp="datePublished" content={r.date} />
              <div itemProp="reviewRating" itemScope itemType="https://schema.org/Rating">
                <meta itemProp="ratingValue" content={String(r.rating)} />
                <meta itemProp="bestRating" content="5" />
              </div>
              <div itemProp="itemReviewed" itemScope itemType="https://schema.org/Product">
                <meta itemProp="name" content="KalkMate" />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
