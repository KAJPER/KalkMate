import FAQItem from "@/components/FAQItem";
import { type Locale } from "@/lib/i18n";
import { faqs } from "@/lib/content/faq";

const content: Record<
  Locale,
  {
    eyebrow: string;
    h2: { before: string; italic: string; after: string };
    sideParagraph: string;
    helpLink: string;
  }
> = {
  pl: {
    eyebrow: "[ 06 ] · FAQ",
    h2: { before: "Pytania, ", italic: "które", after: "każdy ma." },
    sideParagraph: "Nie znalazłeś odpowiedzi? Napisz — odpowiadam w ciągu 24h.",
    helpLink: "Pełna instrukcja obsługi KalkMate",
  },
  en: {
    eyebrow: "[ 06 ] · FAQ",
    h2: { before: "Questions ", italic: "everyone", after: "has." },
    sideParagraph: "Didn't find your answer? Drop me a line — I reply within 24h.",
    helpLink: "Full KalkMate user guide",
  },
  de: {
    eyebrow: "[ 06 ] · FAQ",
    h2: { before: "Fragen, ", italic: "die", after: "jeder hat." },
    sideParagraph: "Keine Antwort gefunden? Schreib mir — ich antworte innerhalb von 24h.",
    helpLink: "Vollständige KalkMate-Bedienungsanleitung",
  },
  cs: {
    eyebrow: "[ 06 ] · FAQ",
    h2: { before: "Otázky, ", italic: "které", after: "má každý." },
    sideParagraph: "Nenašel jsi odpověď? Napiš mi — odpovídám do 24 hodin.",
    helpLink: "Kompletní návod k obsluze KalkMate",
  },
  sk: {
    eyebrow: "[ 06 ] · FAQ",
    h2: { before: "Otázky, ", italic: "ktoré", after: "má každý." },
    sideParagraph: "Nenašiel si odpoveď? Napíš mi — odpovedám do 24 hodín.",
    helpLink: "Kompletný návod na obsluhu KalkMate",
  },
  lt: {
    eyebrow: "[ 06 ] · DUK",
    h2: { before: "Klausimai, ", italic: "kuriuos", after: "užduoda visi." },
    sideParagraph: "Neradai atsakymo? Parašyk man — atsakau per 24 valandas.",
    helpLink: "Visa KalkMate naudojimo instrukcija",
  },
  be: {
    eyebrow: "[ 06 ] · FAQ",
    h2: { before: "Пытанні, ", italic: "якія", after: "ёсць у кожнага." },
    sideParagraph: "Не знайшоў адказу? Напішы мне — адказваю на працягу 24 гадзін.",
    helpLink: "Поўная інструкцыя KalkMate",
  },
  es: {
    eyebrow: "[ 06 ] · FAQ",
    h2: { before: "Preguntas ", italic: "que", after: "todos se hacen." },
    sideParagraph: "¿No has encontrado tu respuesta? Escríbeme — respondo en menos de 24 h.",
    helpLink: "Manual de uso completo de KalkMate",
  },
  pt: {
    eyebrow: "[ 06 ] · FAQ",
    h2: { before: "Perguntas ", italic: "que", after: "todos fazem." },
    sideParagraph: "Não encontraste a resposta? Escreve-me — respondo em 24 horas.",
    helpLink: "Manual de utilização completo do KalkMate",
  },
  fr: {
    eyebrow: "[ 06 ] · FAQ",
    h2: { before: "Les questions ", italic: "que", after: "tout le monde se pose." },
    sideParagraph: "Tu n’as pas trouvé ta réponse ? Écris-moi — je réponds sous 24 h.",
    helpLink: "Mode d’emploi complet de KalkMate",
  },
  it: {
    eyebrow: "[ 06 ] · FAQ",
    h2: { before: "Domande ", italic: "che", after: "tutti si fanno." },
    sideParagraph: "Non hai trovato la risposta? Scrivimi — rispondo entro 24 ore.",
    helpLink: "Manuale d’uso completo di KalkMate",
  },
};

export default function FAQ({ lang = "pl" }: { lang?: Locale }) {
  const t = content[lang];
  const items = faqs[lang];
  return (
    <section id="faq" className="relative py-24 lg:py-36">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-8 items-end mb-12 lg:mb-16">
          <div className="lg:col-span-8">
            <p className="km-mono-eyebrow text-[#D8FF3D]">{t.eyebrow}</p>
            <h2 className="km-display text-[clamp(40px,7vw,108px)] text-[#F2EDE3] mt-4">
              {t.h2.before}<span className="italic">{t.h2.italic}</span><br />
              {t.h2.after}
            </h2>
          </div>
          <div className="lg:col-span-4">
            <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/60">
              {t.sideParagraph}
            </p>
            <a
              href="mailto:kontakt@kalkmate.pl"
              className="km-mono-eyebrow text-[#D8FF3D] mt-3 inline-flex items-center gap-2"
            >
              kontakt@kalkmate.pl <span>↗</span>
            </a>
          </div>
        </div>

        <div className="border-t border-[rgba(242,237,227,0.10)]">
          {items.map((f, i) => (
            <FAQItem key={i} item={f} n={i + 1} />
          ))}
        </div>

        {/* Link do instrukcji z opisowym tekstem — GSC: /pomoc "wykryta, niezindeksowana"
            (jedyny link byl w stopce), wiecej linkow wewnetrznych = wyzszy priorytet skanowania. */}
        <a
          href={lang === "pl" ? "/pomoc" : `/${lang}/pomoc`}
          className="km-mono-eyebrow text-[#D8FF3D] mt-8 inline-flex items-center gap-2 hover:underline"
        >
          {t.helpLink} <span>→</span>
        </a>
      </div>
    </section>
  );
}
