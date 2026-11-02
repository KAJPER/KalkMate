import Link from "next/link";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import HtmlLang from "@/components/HtmlLang";
import { localeHome, localePath, type Locale } from "@/lib/i18n";

// Wspolny uklad stron prawnych (regulamin, polityka prywatnosci) we wszystkich
// jezykach. Tresc kazdej wersji jezykowej to obiekt LegalDoc z
// src/content/legal/<dokument>/<jezyk>.tsx — tutaj tylko hero, spis sekcji
// i stopka dokumentu, zeby wersje nie rozjezdzaly sie wygladem.

export type LegalSection = {
  id: string;           // kotwica "sek-N" (taka sama we wszystkich jezykach — linkuja do niej inne strony)
  eyebrow: string;      // "01"
  short: string;        // pozycja w spisie po lewej
  title: string;
  accent: string;       // druga czesc tytulu, kursywa na zolto ("" = brak)
  wrapperId?: string;   // dodatkowa kotwica na <section> (np. "program-partnerski")
  body: React.ReactNode;
};

export type LegalDoc = {
  metaTitle: string;
  metaDescription: string;
  badge: string;        // pasek nad tytulem, lewa strona
  dateLabel: string;    // pasek nad tytulem, prawa strona
  eyebrow: string;      // "[ regulamin ] · 10 sekcji"
  h1: string;
  h1Accent: string;
  intro: string;
  // Tylko tlumaczenia: informacja, ze wiazaca jest wersja polska.
  bindingNote?: React.ReactNode;
  sections: LegalSection[];
  thanks: React.ReactNode;
  footerNote: string;
  otherDocLabel: string;  // "→ Polityka prywatności"
  homeLabel: string;      // "← Strona główna"
};

export function H({ id, eyebrow, title, accent }: { id: string; eyebrow: string; title: string; accent: string }) {
  return (
    <header className="mb-8 scroll-mt-28" id={id}>
      <p className="km-mono-eyebrow text-[#D8FF3D]">{eyebrow}</p>
      <h2 className="km-display text-[clamp(36px,5.5vw,72px)] mt-3 leading-[0.95] text-[#F2EDE3]">
        {title}
        {accent && <> <span className="italic text-[#D8FF3D]">{accent}</span></>}
        <span className="text-[#D8FF3D]">.</span>
      </h2>
    </header>
  );
}

export function SubH({ children }: { children: React.ReactNode }) {
  return <h3 className="km-mono-eyebrow text-[#F2EDE3]/55 mt-8 mb-3">{children}</h3>;
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/75">{children}</p>;
}

export function OL({ children }: { children: React.ReactNode }) {
  return (
    <ol className="list-decimal list-outside ml-6 mt-3 space-y-3 text-[14px] leading-[1.65] text-[#F2EDE3]/75 marker:text-[#D8FF3D]/60 marker:font-medium">
      {children}
    </ol>
  );
}

export function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc list-outside ml-6 mt-3 space-y-1.5 text-[14px] text-[#F2EDE3]/70 marker:text-[#D8FF3D]/60">
      {children}
    </ul>
  );
}

// Lista z wiekszymi odstepami (pozycje z pogrubionym poczatkiem).
export function ULWide({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc list-outside ml-6 mt-4 space-y-2.5 text-[14px] text-[#F2EDE3]/70 marker:text-[#D8FF3D]/60">
      {children}
    </ul>
  );
}

export function B({ children }: { children: React.ReactNode }) {
  return <strong className="text-[#F2EDE3]">{children}</strong>;
}

export function A({ href, children }: { href: string; children: React.ReactNode }) {
  const external = /^(https?:|mailto:|tel:)/.test(href);
  if (external) {
    return (
      <a href={href} {...(href.startsWith("http") ? { target: "_blank", rel: "noopener" } : {})} className="text-[#D8FF3D] hover:underline">
        {children}
      </a>
    );
  }
  return <Link href={href} className="text-[#D8FF3D] hover:underline">{children}</Link>;
}

// Karta z danymi firmy (identyczne we wszystkich jezykach poza etykietami).
export function CompanyBox({ rows }: { rows: { label: string; value: React.ReactNode; mono?: boolean; wide?: boolean }[] }) {
  return (
    <div className="mt-5 p-5 border border-[rgba(242,237,227,0.10)] bg-[#0E0E0E]">
      <p className="km-mono-eyebrow text-[#D8FF3D] mb-3">KAJPA Kacper Popko</p>
      <div className="grid sm:grid-cols-2 gap-y-2 gap-x-6 text-[14px] text-[#F2EDE3]/80">
        {rows.map((r) => (
          <div key={r.label} className={r.wide ? "sm:col-span-2" : undefined}>
            <span className="text-[#F2EDE3]/45">{r.label}:</span>{" "}
            <span className={r.mono ? "font-mono" : undefined}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Wyrozniona ramka (np. wyjatek od prawa odstapienia).
export function Callout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 p-5 border border-[#D8FF3D]/30 bg-[#D8FF3D]/[0.04]">
      <p className="km-mono-eyebrow text-[#D8FF3D] mb-3">{title}</p>
      {children}
    </div>
  );
}

export function CalloutP({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-[14px] leading-[1.65] text-[#F2EDE3]/80 ${className}`}>{children}</p>;
}

// Tabela poziomow programu partnerskiego (regulamin §9).
export function TierTable({ head, rows }: { head: [string, string, string]; rows: string[][] }) {
  return (
    <div className="mt-3 max-w-md border border-[rgba(242,237,227,0.10)] bg-[#0E0E0E]">
      <table className="w-full text-[14px]">
        <thead>
          <tr className="text-left km-mono-eyebrow text-[#F2EDE3]/45 border-b border-[rgba(242,237,227,0.10)]">
            <th className="px-4 py-2 font-normal">{head[0]}</th>
            <th className="px-4 py-2 font-normal">{head[1]}</th>
            <th className="px-4 py-2 font-normal text-right">{head[2]}</th>
          </tr>
        </thead>
        <tbody className="text-[#F2EDE3]/80">
          {rows.map(([name, units, pct]) => (
            <tr key={name} className="border-b border-[rgba(242,237,227,0.06)] last:border-0">
              <td className="px-4 py-2">{name}</td>
              <td className="px-4 py-2 font-mono">{units}</td>
              <td className="px-4 py-2 font-mono text-right text-[#D8FF3D]">{pct}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Tabela "cel przetwarzania → podstawa prawna" (polityka prywatnosci §4).
export function BasisTable({ head, rows }: { head: [string, string]; rows: [string, string][] }) {
  return (
    <div className="overflow-x-auto mt-6 border border-[rgba(242,237,227,0.10)] bg-[#0E0E0E]">
      <table className="min-w-full text-[14px]">
        <thead>
          <tr className="border-b border-[rgba(242,237,227,0.10)]">
            <th className="px-4 py-3 text-left km-mono-eyebrow text-[#D8FF3D]">{head[0]}</th>
            <th className="px-4 py-3 text-left km-mono-eyebrow text-[#D8FF3D]">{head[1]}</th>
          </tr>
        </thead>
        <tbody className="text-[#F2EDE3]/75">
          {rows.map(([purpose, basis]) => (
            <tr key={purpose} className="border-t border-[rgba(242,237,227,0.06)]">
              <td className="px-4 py-3">{purpose}</td>
              <td className="px-4 py-3 text-[#F2EDE3]/60 font-mono text-[13px]">{basis}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Ramka z danymi kontaktowymi (np. organ nadzorczy PUODO).
export function InfoBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 p-4 border border-[rgba(242,237,227,0.10)] bg-[#0E0E0E] text-[14px] text-[#F2EDE3]/75">
      <span className="km-mono-eyebrow text-[#D8FF3D] block mb-2">{title}</span>
      {children}
    </div>
  );
}

// Nazwa techniczna (np. cookie) — czcionka mono.
export function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[13px]">{children}</span>;
}

// Odstep przed kolejnym akapitem (jak <div className="mt-4"><P/></div> w oryginale).
export function Gap({ size = 4, children }: { size?: 4 | 5 | 6; children: React.ReactNode }) {
  const cls = size === 6 ? "mt-6" : size === 5 ? "mt-5" : "mt-4";
  return <div className={cls}>{children}</div>;
}

export default function LegalPage({ lang, doc, path, otherPath }: { lang: Locale; doc: LegalDoc; path: string; otherPath: string }) {
  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F2EDE3]">
      {lang !== "pl" && <HtmlLang lang={lang} />}
      <Navigation lang={lang} switchPath={path} />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[rgba(242,237,227,0.10)] pt-28 lg:pt-32">
        <div className="pointer-events-none absolute -top-32 -left-20 w-[520px] h-[520px] rounded-full bg-[#D8FF3D] opacity-[0.06] blur-[140px]" />
        <div className="pointer-events-none absolute top-[20%] -right-32 w-[420px] h-[420px] rounded-full bg-[#FF4D2E] opacity-[0.05] blur-[140px]" />

        <div className="max-w-6xl mx-auto px-6 pb-14 lg:pb-20 relative">
          <div className="flex items-center justify-between gap-6 border-b border-[rgba(242,237,227,0.10)] pb-5 mb-12">
            <span className="km-mono-eyebrow text-[#F2EDE3]/55 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full km-blink" />
              {doc.badge}
            </span>
            <span className="km-mono-eyebrow text-[#F2EDE3]/40 hidden md:inline">{doc.dateLabel}</span>
          </div>

          <p className="km-mono-eyebrow text-[#D8FF3D]">{doc.eyebrow}</p>
          <h1 className="km-display text-[clamp(56px,8.5vw,128px)] mt-4 leading-[0.92] text-[#F2EDE3] break-words">
            {doc.h1}<br />
            <span className="italic text-[#D8FF3D]">{doc.h1Accent}</span>.
          </h1>
          <p className="mt-8 text-[16px] leading-[1.65] text-[#F2EDE3]/65 max-w-2xl">{doc.intro}</p>
          {doc.bindingNote && (
            <p className="mt-6 max-w-2xl border-l-2 border-[#D8FF3D]/60 pl-4 text-[13.5px] leading-[1.6] text-[#F2EDE3]/60">
              {doc.bindingNote}
            </p>
          )}
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-12">
        {/* Spis sekcji */}
        <nav className="lg:sticky lg:top-24 self-start space-y-1">
          {doc.sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="block km-mono-eyebrow text-[#F2EDE3]/55 hover:text-[#D8FF3D] py-1.5 transition-colors"
            >
              {s.eyebrow} · {s.short}
            </a>
          ))}
        </nav>

        <main className="space-y-24 min-w-0">
          {doc.sections.map((s) => (
            <section key={s.id} id={s.wrapperId} className={s.wrapperId ? "scroll-mt-28" : undefined}>
              <H id={s.id} eyebrow={s.eyebrow} title={s.title} accent={s.accent} />
              {s.body}
            </section>
          ))}

          {/* Podziekowanie */}
          <div className="border-l-2 border-[#D8FF3D] pl-6 py-4 bg-[#D8FF3D]/[0.04]">
            <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/85">{doc.thanks}</p>
          </div>

          {/* Stopka dokumentu */}
          <div className="pt-8 border-t border-[rgba(242,237,227,0.10)] flex flex-wrap items-center justify-between gap-4">
            <span className="km-mono-eyebrow text-[#F2EDE3]/45">{doc.footerNote}</span>
            <div className="flex items-center gap-4">
              <Link href={localePath(lang, otherPath)} className="km-mono-eyebrow text-[#F2EDE3]/55 hover:text-[#D8FF3D] transition-colors">
                {doc.otherDocLabel}
              </Link>
              <Link href={localeHome(lang)} className="km-mono-eyebrow text-[#F2EDE3]/55 hover:text-[#D8FF3D] transition-colors">
                {doc.homeLabel}
              </Link>
            </div>
          </div>
        </main>
      </div>

      <Footer lang={lang} />
    </div>
  );
}
