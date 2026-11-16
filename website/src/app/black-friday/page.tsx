import Link from "next/link";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { BLACK_FRIDAY } from "@/lib/content/promo";
import { RENTAL_PLANS } from "@/lib/content/rentalPlans";

// Regulamin promocji Black Friday 2026 (dane z lib/content/promo.ts).
const zl = (g: number) => `${g / 100} zł`;
const eur = (c: number) => `${c / 100} €`;
const monthPlan = RENTAL_PLANS.find((p) => p.id === BLACK_FRIDAY.rentalPlanId)!;

export default function BlackFridayPage() {
  const points = [
    <>Organizatorem promocji jest KAJPA Kacper Popko, ul. Zastawie I 37, 16-070 Choroszcz, NIP 9662222951 (Sprzedawca). W sprawach nieuregulowanych stosuje się <Link href="/regulamin" className="text-[#D8FF3D] hover:underline">Regulamin sklepu</Link>.</>,
    <>Promocja trwa od <b>27 listopada 2026, godz. 00:00</b> do <b>30 listopada 2026, godz. 23:59</b> (czas polski). Decyduje chwila złożenia zamówienia w sklepie kalkmate.pl.</>,
    <>W czasie promocji kalkulator KalkMate v3.0 kosztuje <b>{zl(BLACK_FRIDAY.productPln)}</b> za sztukę zamiast {zl(BLACK_FRIDAY.regularPln)} (zamówienia z dostawą w Polsce, płatne w złotówkach) oraz <b>{eur(BLACK_FRIDAY.productEur)}</b> zamiast {eur(BLACK_FRIDAY.regularEur)} (dostawa za granicę, płatność w euro; koszt wysyłki bez zmian). Najniższa cena z 30 dni przed obniżką: <b>{zl(BLACK_FRIDAY.regularPln)}</b> / <b>{eur(BLACK_FRIDAY.regularEur)}</b>.</>,
    <>Cena promocyjna obejmuje łącznie <b>{BLACK_FRIDAY.unitLimit} sztuk</b> (wspólna pula dla zamówień w złotówkach i w euro). Po wyczerpaniu puli sklep automatycznie pokazuje i nalicza cenę regularną. Liczba pozostałych sztuk wyświetlana na stronie ma charakter orientacyjny; w wyjątkowych przypadkach (równoczesne zamówienia) pula może zostać przekroczona o pojedyncze sztuki — takie zamówienia realizujemy w cenie promocyjnej.</>,
    <>Do puli liczą się zamówienia opłacone oraz złożone w ostatniej godzinie i oczekujące na płatność. Zamówienie złożone w czasie promocji w cenie promocyjnej można opłacić także po jej zakończeniu — cena się nie zmienia.</>,
    <>W czasie promocji wypożyczenie kalkulatora na {monthPlan.days} dni kosztuje <b>{zl(BLACK_FRIDAY.rentalFeeGrosze)}</b> zamiast {zl(monthPlan.feeGrosze)}. Pozostałe warunki najmu (kaucja albo weryfikacja tożsamości, zwrot) — zgodnie z §10 <Link href="/regulamin#wypozyczenie" className="text-[#D8FF3D] hover:underline">Regulaminu sklepu</Link>.</>,
    <>Ceny promocyjnej nie można łączyć z kuponami rabatowymi ani kodami programu partnerskiego.</>,
    <>Czas realizacji zamówień wynosi do 4 tygodni (kalkulatory są składane ręcznie). Promocja nie zmienia praw konsumenta, w tym prawa do odstąpienia od umowy i reklamacji.</>,
  ];
  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F2EDE3]">
      <Navigation />
      <section className="relative overflow-hidden border-b border-[rgba(242,237,227,0.10)] pt-36 lg:pt-40">
        <div className="max-w-3xl mx-auto px-6 pb-12 relative">
          <p className="km-mono-eyebrow text-[#D8FF3D]">[ regulamin promocji ] · 27–30.11.2026</p>
          <h1 className="km-display text-[clamp(48px,7vw,96px)] mt-4 leading-[0.95]">
            Black <span className="italic text-[#D8FF3D]">Friday</span>.
          </h1>
          <p className="mt-6 text-[16px] leading-[1.65] text-[#F2EDE3]/65">
            KalkMate za {zl(BLACK_FRIDAY.productPln)} / {eur(BLACK_FRIDAY.productEur)} (pierwsze {BLACK_FRIDAY.unitLimit} sztuk) i wypożyczenie na miesiąc za {zl(BLACK_FRIDAY.rentalFeeGrosze)}.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/#kup-teraz" className="bg-[#D8FF3D] text-[#0B0B0B] px-6 py-3.5 km-mono-eyebrow">Kup za {zl(BLACK_FRIDAY.productPln)} →</Link>
            <Link href="/wypozyczenie?plan=month" className="px-6 py-3.5 km-mono-eyebrow border border-[rgba(242,237,227,0.18)] hover:border-[#D8FF3D]">Wypożycz za {zl(BLACK_FRIDAY.rentalFeeGrosze)}</Link>
          </div>
        </div>
      </section>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <ol className="list-decimal list-outside ml-6 space-y-4 text-[15px] leading-[1.65] text-[#F2EDE3]/80 marker:text-[#D8FF3D]">
          {points.map((p, i) => <li key={i}>{p}</li>)}
        </ol>

        <div lang="en" className="mt-14 border-t border-[rgba(242,237,227,0.10)] pt-8 text-[14px] leading-[1.65] text-[#F2EDE3]/65 space-y-3">
          <p className="km-mono-eyebrow text-[#D8FF3D]">Summary in English</p>
          <p>
            Black Friday runs from 27 November 2026, 00:00 to 30 November 2026, 23:59 (Polish time); the time the order is placed counts.
            KalkMate v3.0 costs <b>{eur(BLACK_FRIDAY.productEur)}</b> instead of {eur(BLACK_FRIDAY.regularEur)} for orders paid in euro
            (shipping cost unchanged) and {zl(BLACK_FRIDAY.productPln)} instead of {zl(BLACK_FRIDAY.regularPln)} in Poland.
            Lowest price in the 30 days before the reduction: {eur(BLACK_FRIDAY.regularEur)} / {zl(BLACK_FRIDAY.regularPln)}.
          </p>
          <p>
            The offer is limited to {BLACK_FRIDAY.unitLimit} units in total; after that the regular price applies automatically.
            It cannot be combined with coupons or partner codes. Orders placed at the promotional price keep it if paid later.
            Delivery time is up to 4 weeks (hand-assembled). Your consumer rights, including withdrawal and complaints, are not affected.
            The binding version is the Polish text above; the shop terms apply otherwise.
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
