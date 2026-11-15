import Link from "next/link";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { BLACK_FRIDAY } from "@/lib/content/promo";
import { RENTAL_PLANS } from "@/lib/content/rentalPlans";

// Regulamin promocji Black Friday 2026 (dane z lib/content/promo.ts).
const zl = (g: number) => `${g / 100} zł`;
const monthPlan = RENTAL_PLANS.find((p) => p.id === BLACK_FRIDAY.rentalPlanId)!;

export default function BlackFridayPage() {
  const points = [
    <>Organizatorem promocji jest KAJPA Kacper Popko, ul. Zastawie I 37, 16-070 Choroszcz, NIP 9662222951 (Sprzedawca). W sprawach nieuregulowanych stosuje się <Link href="/regulamin" className="text-[#D8FF3D] hover:underline">Regulamin sklepu</Link>.</>,
    <>Promocja trwa od <b>27 listopada 2026, godz. 00:00</b> do <b>30 listopada 2026, godz. 23:59</b> (czas polski). Decyduje chwila złożenia zamówienia w sklepie kalkmate.pl.</>,
    <>W czasie promocji kalkulator KalkMate v3.0 kosztuje <b>{zl(BLACK_FRIDAY.productPln)}</b> za sztukę zamiast {zl(BLACK_FRIDAY.regularPln)}. Najniższa cena z 30 dni przed obniżką: <b>{zl(BLACK_FRIDAY.regularPln)}</b>.</>,
    <>Cena promocyjna obejmuje łącznie <b>{BLACK_FRIDAY.unitLimit} sztuk</b> i dotyczy zamówień płatnych w złotówkach z dostawą w Polsce. Po wyczerpaniu puli sklep automatycznie pokazuje i nalicza cenę regularną. Liczba pozostałych sztuk wyświetlana na stronie ma charakter orientacyjny; w wyjątkowych przypadkach (równoczesne zamówienia) pula może zostać przekroczona o pojedyncze sztuki — takie zamówienia realizujemy w cenie promocyjnej.</>,
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
            KalkMate za {zl(BLACK_FRIDAY.productPln)} (pierwsze {BLACK_FRIDAY.unitLimit} sztuk) i wypożyczenie na miesiąc za {zl(BLACK_FRIDAY.rentalFeeGrosze)}.
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
      </div>
      <Footer />
    </div>
  );
}
