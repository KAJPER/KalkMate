import type { Metadata } from "next";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Regulamin Sklepu — KalkMate",
  description: "Regulamin sklepu internetowego KalkMate",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://kalkmate.pl/regulamin" },
};

const sections = [
  { id: "sek-1", eyebrow: "01", short: "Postanowienia ogólne",       title: "Postanowienia", accent: "ogólne" },
  { id: "sek-2", eyebrow: "02", short: "Zamówienia",                  title: "Zamówienia",    accent: "" },
  { id: "sek-3", eyebrow: "03", short: "Ceny i płatności",            title: "Ceny",          accent: "i płatności" },
  { id: "sek-4", eyebrow: "04", short: "Realizacja i dostawa",        title: "Realizacja",    accent: "i dostawa" },
  { id: "sek-5", eyebrow: "05", short: "Prawo do odstąpienia",        title: "Prawo",         accent: "odstąpienia" },
  { id: "sek-6", eyebrow: "06", short: "Reklamacje i gwarancja",      title: "Reklamacje",    accent: "i gwarancja" },
  { id: "sek-7", eyebrow: "07", short: "Ochrona danych osobowych",    title: "Ochrona",       accent: "danych" },
  { id: "sek-8", eyebrow: "08", short: "Postanowienia końcowe",       title: "Postanowienia", accent: "końcowe" },
];

function H({ id, eyebrow, title, accent }: { id: string; eyebrow: string; title: string; accent: string }) {
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

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/75">{children}</p>;
}

function OL({ children }: { children: React.ReactNode }) {
  return (
    <ol className="list-decimal list-outside ml-6 mt-3 space-y-3 text-[14px] leading-[1.65] text-[#F2EDE3]/75 marker:text-[#D8FF3D]/60 marker:font-medium">
      {children}
    </ol>
  );
}

export default function RegulaminPage() {
  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F2EDE3]">
      <Navigation />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[rgba(242,237,227,0.10)] pt-28 lg:pt-32">
        <div className="pointer-events-none absolute -top-32 -left-20 w-[520px] h-[520px] rounded-full bg-[#D8FF3D] opacity-[0.06] blur-[140px]" />
        <div className="pointer-events-none absolute top-[20%] -right-32 w-[420px] h-[420px] rounded-full bg-[#FF4D2E] opacity-[0.05] blur-[140px]" />

        <div className="max-w-6xl mx-auto px-6 pb-14 lg:pb-20 relative">
          <div className="flex items-center justify-between gap-6 border-b border-[rgba(242,237,227,0.10)] pb-5 mb-12">
            <span className="km-mono-eyebrow text-[#F2EDE3]/55 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full km-blink" />
              Zgodny z ustawą o prawach konsumenta
            </span>
            <span className="km-mono-eyebrow text-[#F2EDE3]/40 hidden md:inline">
              Obowiązuje od · 2026-01-01
            </span>
          </div>

          <p className="km-mono-eyebrow text-[#D8FF3D]">[ regulamin ] · 8 sekcji</p>
          <h1 className="km-display text-[clamp(56px,8.5vw,128px)] mt-4 leading-[0.92] text-[#F2EDE3]">
            Regulamin<br />
            <span className="italic text-[#D8FF3D]">sklepu</span>.
          </h1>
          <p className="mt-8 text-[16px] leading-[1.65] text-[#F2EDE3]/65 max-w-2xl">
            Zasady składania zamówień, płatności, dostawy, zwrotów i reklamacji
            w sklepie internetowym kalkmate.pl.
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-12">
        {/* Sidebar nav */}
        <nav className="lg:sticky lg:top-24 self-start space-y-1">
          {sections.map((s) => (
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
          {/* 1 */}
          <section>
            <H id="sek-1" eyebrow="01" title="Postanowienia" accent="ogólne" />
            <P>
              Niniejszy regulamin określa zasady sprzedaży produktów w sklepie internetowym
              dostępnym pod adresem kalkmate.pl, prowadzonym przez <strong className="text-[#F2EDE3]">Kacpra Popko</strong>{" "}
              prowadzącego działalność gospodarczą pod firmą <strong className="text-[#F2EDE3]">KAJPA Kacper Popko</strong>,
              zwanego dalej „Sprzedawcą".
            </P>
            <div className="mt-5 p-5 border border-[rgba(242,237,227,0.10)] bg-[#0E0E0E]">
              <p className="km-mono-eyebrow text-[#D8FF3D] mb-3">KAJPA Kacper Popko</p>
              <div className="grid sm:grid-cols-2 gap-y-2 gap-x-6 text-[14px] text-[#F2EDE3]/80">
                <div>
                  <span className="text-[#F2EDE3]/45">NIP:</span>{" "}
                  <span className="font-mono">9662222951</span>
                </div>
                <div>
                  <span className="text-[#F2EDE3]/45">REGON:</span>{" "}
                  <span className="font-mono">545011444</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-[#F2EDE3]/45">Adres siedziby:</span>{" "}
                  <span>ul. Zastawie I 37, 16-070 Choroszcz</span>
                </div>
              </div>
            </div>
          </section>

          {/* 2 */}
          <section>
            <H id="sek-2" eyebrow="02" title="Zamówienia" accent="" />
            <OL>
              <li>Zamówienia przyjmowane są przez stronę internetową kalkmate.pl przez całą dobę, 7 dni w tygodniu.</li>
              <li>Złożenie zamówienia jest równoznaczne z akceptacją niniejszego regulaminu.</li>
              <li>Po złożeniu zamówienia Kupujący otrzymuje potwierdzenie na podany adres e-mail.</li>
              <li>Sprzedawca zastrzega sobie prawo do odmowy realizacji zamówienia w uzasadnionych przypadkach.</li>
            </OL>
          </section>

          {/* 3 */}
          <section>
            <H id="sek-3" eyebrow="03" title="Ceny" accent="i płatności" />
            <OL>
              <li>Wszystkie ceny podane na stronie są cenami brutto (zawierają podatek VAT).</li>
              <li>Płatności obsługiwane są przez serwis Przelewy24 (PayPro SA, ul. Kanclerska 15, 60-327 Poznań).</li>
              <li>Dostępne metody płatności: karta płatnicza, BLIK, przelew bankowy oraz inne metody dostępne w serwisie Przelewy24.</li>
            </OL>
          </section>

          {/* 4 */}
          <section>
            <H id="sek-4" eyebrow="04" title="Realizacja" accent="i dostawa" />
            <OL>
              <li>Produkt KalkMate jest wytwarzany na zamówienie jako produkcja własna.</li>
              <li>Termin realizacji wynosi do 4 tygodni od momentu zaksięgowania płatności. Standardowy czas realizacji to 1–2 tygodnie.</li>
              <li>Dostawa na terenie Polski realizowana jest za pośrednictwem InPost (paczkomat). Koszt dostawy w Polsce: 0 zł.</li>
              <li>Dostawa zagraniczna (kraje UE): 20 EUR. Dostawa poza UE: 35 EUR.</li>
              <li>Kupujący otrzymuje numer śledzenia przesyłki po jej nadaniu.</li>
            </OL>
          </section>

          {/* 5 */}
          <section>
            <H id="sek-5" eyebrow="05" title="Prawo" accent="odstąpienia" />
            <P>
              Konsument ma prawo odstąpić od umowy zawartej na odległość w terminie 14 dni
              kalendarzowych bez podania przyczyny, z zastrzeżeniem wyjątku opisanego poniżej.
            </P>

            <div className="mt-5 p-5 border border-[#D8FF3D]/30 bg-[#D8FF3D]/[0.04]">
              <p className="km-mono-eyebrow text-[#D8FF3D] mb-3">Wyjątek — urządzenie personalizowane na zamówienie</p>
              <p className="text-[14px] leading-[1.65] text-[#F2EDE3]/80">
                Każdy egzemplarz urządzenia KalkMate jest indywidualnie personalizowany na
                życzenie Konsumenta przed wysyłką: (a) wgrywany jest wybrany przez Konsumenta
                w formularzu zamówienia kod odblokowania funkcji AI oraz (b) na etykiecie danego
                egzemplarza drukowane jest podane przez Konsumenta imię/nick. Zgodnie z{" "}
                <strong className="text-[#F2EDE3]">art. 38 pkt 3 ustawy z dnia 30 maja 2014 r. o prawach konsumenta</strong>,
                prawo odstąpienia od umowy nie przysługuje w odniesieniu do rzeczy wyprodukowanej
                według specyfikacji konsumenta lub służącej zaspokojeniu jego zindywidualizowanych
                potrzeb. Informacja ta oraz wymóg wyrażenia odrębnej zgody są przedstawiane
                Konsumentowi przed zawarciem umowy, w formularzu zamówienia.
              </p>
              <p className="text-[14px] leading-[1.65] text-[#F2EDE3]/80 mt-3">
                Wyjątek ten <strong className="text-[#F2EDE3]">nie dotyczy</strong> zakupów subskrypcji
                AI Chat ani doładowań tokenów, dla których prawo odstąpienia obowiązuje na zasadach ogólnych.
              </p>
            </div>

            <div className="mt-6">
              <P>
                Poniższe ustępy dotyczą przypadków, w których prawo odstąpienia przysługuje
                (tj. zakupów innych niż spersonalizowane urządzenie KalkMate):
              </P>
            </div>
            <OL>
              <li>Termin do odstąpienia od umowy wygasa po upływie 14 dni od dnia, w którym Konsument wszedł w posiadanie rzeczy.</li>
              <li>Aby skorzystać z prawa odstąpienia, Konsument musi poinformować Sprzedawcę o swojej decyzji drogą mailową na adres: <strong className="text-[#F2EDE3]">kontakt@kalkmate.pl</strong>.</li>
              <li>
                Zwrotu towaru należy dokonać na adres: <strong className="text-[#F2EDE3]">KalkMate, ul. Zastawie I 37, 16-070 Choroszcz</strong>.
                Zwrot płatności następuje w terminie do 14 dni od dnia otrzymania zwracanego towaru.
                Jeżeli Konsument wyraźnie zażądał rozpoczęcia świadczenia usługi (np. rozwiązań AI)
                przed upływem terminu do odstąpienia, Sprzedawca ma prawo potrącić z kwoty zwrotu
                wynagrodzenie za usługi faktycznie spełnione do chwili odstąpienia (art. 35 ustawy
                o prawach konsumenta), a w przypadku zwracanej rzeczy noszącej ślady użytkowania
                wykraczające poza konieczne do stwierdzenia charakteru i funkcjonowania towaru —
                także kwotę odpowiadającą zmniejszeniu jej wartości (art. 34 ust. 4 ustawy o prawach konsumenta).
              </li>
              <li>Prawo do reklamacji z tytułu rękojmi i gwarancji (§6) przysługuje niezależnie od powyższych postanowień i nie jest przez nie ograniczane.</li>
            </OL>
          </section>

          {/* 6 */}
          <section>
            <H id="sek-6" eyebrow="06" title="Reklamacje" accent="i gwarancja" />
            <OL>
              <li>Produkty objęte są gwarancją Sprzedawcy na okres 24 miesięcy od daty zakupu.</li>
              <li>Reklamacje należy zgłaszać drogą mailową na adres: <strong className="text-[#F2EDE3]">kontakt@kalkmate.pl</strong>, podając numer zamówienia i opis usterki.</li>
              <li>Sprzedawca rozpatruje reklamacje w terminie do 14 dni kalendarzowych.</li>
            </OL>
          </section>

          {/* 7 */}
          <section>
            <H id="sek-7" eyebrow="07" title="Ochrona" accent="danych" />
            <OL>
              <li>Administratorem danych osobowych jest Sprzedawca.</li>
              <li>Dane osobowe przetwarzane są wyłącznie w celu realizacji zamówienia i nie są udostępniane podmiotom trzecim, z wyjątkiem firm kurierskich i operatorów płatności.</li>
              <li>Kupującemu przysługuje prawo wglądu do swoich danych, ich poprawiania oraz żądania usunięcia.</li>
              <li>
                Strona wykorzystuje pliki cookies, w tym narzędzie analityczne Microsoft Clarity
                (mapy ciepła, nagrania sesji), ładowane wyłącznie po wyrażeniu zgody w bannerze
                cookies. Szczegóły znajdują się w{" "}
                <Link href="/polityka-prywatnosci#sek-9" className="text-[#D8FF3D] hover:underline">
                  Polityce Prywatności
                </Link>.
              </li>
            </OL>
          </section>

          {/* 8 */}
          <section>
            <H id="sek-8" eyebrow="08" title="Postanowienia" accent="końcowe" />
            <OL>
              <li>W sprawach nieuregulowanych niniejszym regulaminem stosuje się przepisy Kodeksu Cywilnego oraz ustawy o prawach konsumenta.</li>
              <li>Sprzedawca zastrzega sobie prawo do zmiany regulaminu. Zmiany wchodzą w życie z dniem publikacji na stronie.</li>
              <li>Wszelkie spory rozstrzygane będą przez sąd właściwy dla siedziby Sprzedawcy.</li>
            </OL>
          </section>

          {/* Podziekowanie */}
          <div className="border-l-2 border-[#D8FF3D] pl-6 py-4 bg-[#D8FF3D]/[0.04]">
            <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/85">
              Dziękujemy za zaufanie i zakup KalkMate. W razie pytań dotyczących zamówienia,
              zwrotu lub reklamacji — jesteśmy pod ręką pod adresem kontakt@kalkmate.pl.
            </p>
          </div>

          {/* Stopka dokumentu */}
          <div className="pt-8 border-t border-[rgba(242,237,227,0.10)] flex flex-wrap items-center justify-between gap-4">
            <span className="km-mono-eyebrow text-[#F2EDE3]/45">
              Obowiązuje od · 2026-01-01
            </span>
            <div className="flex items-center gap-4">
              <Link href="/polityka-prywatnosci" className="km-mono-eyebrow text-[#F2EDE3]/55 hover:text-[#D8FF3D] transition-colors">
                → Polityka prywatności
              </Link>
              <Link href="/" className="km-mono-eyebrow text-[#F2EDE3]/55 hover:text-[#D8FF3D] transition-colors">
                ← Strona główna
              </Link>
            </div>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
