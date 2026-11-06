import Reveal from "@/components/Reveal";
import { RENTAL_DEPOSIT_GROSZE, RENTAL_FROM_PLN, RENTAL_PLANS } from "@/lib/content/rentalPlans";

// Duza sekcja "Wypozycz zamiast kupowac" na POLSKIEJ stronie glownej
// (najem tylko z dostawa w Polsce — lib/rentals.ts). Ceny z
// lib/content/rentalPlans.ts. identityAvailable = Didit skonfigurowany
// (wariant bez kaucji, lib/didit.ts) — liczone w page.tsx na serwerze.

const DEPOSIT = RENTAL_DEPOSIT_GROSZE / 100;

export default function RentalPromo({ identityAvailable }: { identityAvailable: boolean }) {
  const perks: [string, string][] = [
    [`Od ${RENTAL_FROM_PLN} zł`, "Tydzień, miesiąc albo cały okres matur — płacisz tylko za to, czego potrzebujesz."],
    identityAvailable
      ? ["Bez kaucji", `Potwierdzasz tożsamość dowodem i selfie (2 min) albo wpłacasz zwrotną kaucję ${DEPOSIT} zł.`]
      : [`Kaucja ${DEPOSIT} zł`, "Zwracamy ją w ciągu 7 dni od otrzymania kalkulatora."],
    ["Dostawa gratis", "Paczkomat InPost w całej Polsce, płatność BLIK albo przelewem."],
    ["Pełna wersja z AI", "Ten sam kalkulator co w sprzedaży. Po okresie najmu AI wyłącza się samo — odsyłasz i gotowe."],
  ];

  return (
    <section id="wypozyczenie" className="relative py-24 lg:py-36 border-y border-[#D8FF3D]/25 bg-[#D8FF3D]/[0.03] overflow-hidden">
      <div className="pointer-events-none absolute -top-40 right-[-10%] w-[620px] h-[620px] rounded-full bg-[#D8FF3D] opacity-[0.07] blur-[160px]" />
      <div className="relative mx-auto max-w-[1400px] px-5 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-8 items-end mb-14">
          <div className="lg:col-span-8">
            <p className="km-mono-eyebrow text-[#D8FF3D]">[ nowość ] · Wypożyczenie</p>
            <h2 className="km-display text-[clamp(44px,7.5vw,116px)] text-[#F2EDE3] mt-4 leading-[0.95]">
              Nie chcesz kupować?<br />
              <span className="italic text-[#D8FF3D]">Wypożycz.</span>
            </h2>
          </div>
          <div className="lg:col-span-4">
            <p className="text-[16px] leading-[1.65] text-[#F2EDE3]/70">
              Matura albo sprawdzian za kilka tygodni? Weź KalkMate na tyle, ile go potrzebujesz —
              od {RENTAL_FROM_PLN} zł, z dostawą do Paczkomatu.
            </p>
          </div>
        </div>

        <Reveal>
          <div className="grid md:grid-cols-3 gap-4">
            {RENTAL_PLANS.map((p) => (
              <a
                key={p.id}
                href={`/wypozyczenie?plan=${p.id}`}
                className={`group block p-7 border transition-colors ${
                  p.featured
                    ? "border-[#D8FF3D] bg-[#D8FF3D]/[0.07]"
                    : "border-[rgba(242,237,227,0.18)] bg-[#0B0B0B]/60 hover:border-[#D8FF3D]/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="km-mono-eyebrow text-[#F2EDE3]/60">{p.label} · {p.days} dni</p>
                  {p.featured && <span className="km-mono-eyebrow text-[10px] text-[#0B0B0B] bg-[#D8FF3D] px-2 py-1">Polecany</span>}
                </div>
                <p className="km-display text-[clamp(56px,6vw,84px)] leading-none mt-5 text-[#F2EDE3]">
                  {p.feeGrosze / 100}
                  <span className="text-[22px] text-[#F2EDE3]/55"> zł</span>
                </p>
                <p className="text-[14px] text-[#F2EDE3]/60 mt-3">{p.hint}</p>
                <p className="km-mono-eyebrow text-[#D8FF3D] mt-6 group-hover:translate-x-1 transition-transform">
                  Wypożycz →
                </p>
              </a>
            ))}
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-14 border-t border-[rgba(242,237,227,0.10)] pt-10">
          {perks.map(([title, desc]) => (
            <div key={title}>
              <p className="text-[17px] text-[#F2EDE3] font-medium">{title}</p>
              <p className="text-[14px] leading-[1.6] text-[#F2EDE3]/60 mt-2">{desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-3">
          <a
            href="/wypozyczenie"
            className="group inline-flex items-center gap-3 bg-[#D8FF3D] text-[#0B0B0B] px-7 py-4 km-mono-eyebrow hover:bg-[#F2EDE3] transition-colors"
          >
            Wypożycz od {RENTAL_FROM_PLN} zł
            <span className="text-base">→</span>
          </a>
          <a
            href="#kup-teraz"
            className="inline-flex items-center gap-2 px-6 py-4 km-mono-eyebrow text-[#F2EDE3]/80 border border-[rgba(242,237,227,0.18)] hover:border-[#D8FF3D] hover:text-[#F2EDE3] transition-colors"
          >
            Wolę kupić na stałe
          </a>
          <a href="/regulamin#wypozyczenie" className="km-mono-eyebrow text-[#F2EDE3]/50 hover:text-[#D8FF3D] px-2">
            Zasady wypożyczenia
          </a>
        </div>
      </div>
    </section>
  );
}
