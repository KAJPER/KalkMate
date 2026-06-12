import Link from "next/link";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Regulamin - KalkMate",
  description: "Regulamin korzystania z serwisu KalkMate.pl",
};

const sections = [
  { id: "par-1",  eyebrow: "§ 1",  short: "Postanowienia ogólne",       title: "Postanowienia",       accent: "ogólne" },
  { id: "par-2",  eyebrow: "§ 2",  short: "Definicje",                   title: "Definicje",            accent: "" },
  { id: "par-3",  eyebrow: "§ 3",  short: "Zasady składania zamówień",   title: "Składanie",            accent: "zamówień" },
  { id: "par-4",  eyebrow: "§ 4",  short: "Płatności",                   title: "Płatności",            accent: "" },
  { id: "par-5",  eyebrow: "§ 5",  short: "Dostawa",                      title: "Dostawa",              accent: "i wysyłka" },
  { id: "par-6",  eyebrow: "§ 6",  short: "Prawo odstąpienia – wył.",    title: "Prawo",                accent: "odstąpienia" },
  { id: "par-7",  eyebrow: "§ 7",  short: "Reklamacje",                   title: "Reklamacje",           accent: "" },
  { id: "par-8",  eyebrow: "§ 8",  short: "Subskrypcja AI Chat",         title: "Subskrypcja",          accent: "AI" },
  { id: "par-9",  eyebrow: "§ 9",  short: "Konto użytkownika",           title: "Konto",                accent: "użytkownika" },
  { id: "par-10", eyebrow: "§ 10", short: "Ochrona danych osobowych",    title: "Ochrona",              accent: "danych" },
  { id: "par-11", eyebrow: "§ 11", short: "Własność intelektualna",      title: "Własność",             accent: "intelektualna" },
  { id: "par-12", eyebrow: "§ 12", short: "Postanowienia końcowe",       title: "Postanowienia",        accent: "końcowe" },
  { id: "par-13", eyebrow: "§ 13", short: "Dane kontaktowe",             title: "Kontakt",              accent: "" },
];

function H({
  id, eyebrow, title, accent,
}: { id: string; eyebrow: string; title: string; accent: string }) {
  return (
    <header className="mb-8 scroll-mt-28" id={id}>
      <p className="km-mono-eyebrow text-[#D8FF3D]">{eyebrow}</p>
      <h2 className="km-display text-[clamp(36px,5.5vw,72px)] mt-3 leading-[0.95] text-[#F2EDE3]">
        {title}
        {accent && (
          <>
            {" "}
            <span className="italic text-[#D8FF3D]">{accent}</span>
            <span className="text-[#D8FF3D]">.</span>
          </>
        )}
        {!accent && <span className="text-[#D8FF3D]">.</span>}
      </h2>
    </header>
  );
}

function OL({ children }: { children: React.ReactNode }) {
  return (
    <ol className="list-decimal list-outside ml-6 space-y-3 text-[15px] leading-[1.65] text-[#F2EDE3]/75 marker:text-[#D8FF3D] marker:font-mono">
      {children}
    </ol>
  );
}

function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc list-outside ml-6 mt-2 space-y-1 text-[14px] text-[#F2EDE3]/65 marker:text-[#D8FF3D]/60">
      {children}
    </ul>
  );
}

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F2EDE3]">
      <Navigation />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[rgba(242,237,227,0.10)] pt-28 lg:pt-32">
        <div className="pointer-events-none absolute -top-32 -right-20 w-[520px] h-[520px] rounded-full bg-[#D8FF3D] opacity-[0.06] blur-[140px]" />
        <div className="pointer-events-none absolute top-[20%] -left-32 w-[420px] h-[420px] rounded-full bg-[#FF4D2E] opacity-[0.05] blur-[140px]" />

        <div className="max-w-6xl mx-auto px-6 pb-14 lg:pb-20 relative">
          <div className="flex items-center justify-between gap-6 border-b border-[rgba(242,237,227,0.10)] pb-5 mb-12">
            <span className="km-mono-eyebrow text-[#F2EDE3]/55 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full km-blink" />
              Dokument prawny · v2.0
            </span>
            <span className="km-mono-eyebrow text-[#F2EDE3]/40 hidden md:inline">
              Aktualizacja · 2026-05-31
            </span>
          </div>

          <p className="km-mono-eyebrow text-[#D8FF3D]">[ regulamin ] · 13 sekcji</p>
          <h1 className="km-display text-[clamp(56px,8.5vw,128px)] mt-4 leading-[0.92] text-[#F2EDE3]">
            Regulamin<br />
            <span className="italic text-[#D8FF3D]">serwisu</span>.
          </h1>
          <p className="mt-8 text-[16px] leading-[1.65] text-[#F2EDE3]/65 max-w-2xl">
            Zasady korzystania ze sklepu KalkMate.pl — zakupu kalkulatora,
            subskrypcji AI Chat, reklamacji i ochrony danych.
            Każdy paragraf można rozwinąć w panelu po lewej.
          </p>
        </div>
      </section>

      {/* Layout */}
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

        {/* Content */}
        <main className="space-y-24 min-w-0">
          {/* § 1 */}
          <section>
            <H id="par-1" eyebrow="§ 1" title="Postanowienia" accent="ogólne" />
            <OL>
              <li>
                Regulamin określa zasady korzystania ze sklepu internetowego KalkMate.pl,
                prowadzonego przez <strong className="text-[#F2EDE3]">KAJPA Kacper Popko</strong>{" "}
                (dalej: „Sprzedawca").
              </li>
              <li>
                Dane Sprzedawcy:
                <UL>
                  <li><strong className="text-[#F2EDE3]">Nazwa:</strong> KAJPA Kacper Popko</li>
                  <li><strong className="text-[#F2EDE3]">NIP:</strong> 9662222951</li>
                  <li><strong className="text-[#F2EDE3]">E-mail:</strong>{" "}
                    <a href="mailto:kontakt@kajpa.pl" className="text-[#D8FF3D] hover:underline">kontakt@kajpa.pl</a>
                  </li>
                  <li><strong className="text-[#F2EDE3]">Telefon:</strong>{" "}
                    <a href="tel:+48600580888" className="text-[#D8FF3D] hover:underline">+48 600 580 888</a>
                  </li>
                </UL>
              </li>
              <li>KalkMate oferuje sprzedaż kalkulatorów graficznych wraz z subskrypcją usługi AI Chat.</li>
              <li>Kontakt ze Sprzedawcą możliwy jest poprzez formularz kontaktowy na stronie, e-mail lub telefon wskazane powyżej.</li>
              <li>Niniejszy Regulamin jest integralną częścią umowy sprzedaży zawieranej między Sprzedawcą a Klientem.</li>
              <li>Przed złożeniem zamówienia Klient zobowiązany jest zapoznać się z treścią Regulaminu.</li>
            </OL>
          </section>

          {/* § 2 */}
          <section>
            <H id="par-2" eyebrow="§ 2" title="Definicje" accent="" />
            <OL>
              <li><strong className="text-[#F2EDE3]">Klient</strong> – osoba fizyczna posiadająca pełną zdolność do czynności prawnych, osoba prawna lub jednostka organizacyjna nieposiadająca osobowości prawnej, która dokonuje zakupu w Sklepie.</li>
              <li><strong className="text-[#F2EDE3]">Konsument</strong> – osoba fizyczna dokonująca zakupu w celach niezwiązanych z działalnością gospodarczą lub zawodową.</li>
              <li><strong className="text-[#F2EDE3]">Kalkulator</strong> – kalkulator graficzny oferowany w Sklepie wraz z oprogramowaniem.</li>
              <li><strong className="text-[#F2EDE3]">AI Chat</strong> – usługa subskrypcyjna umożliwiająca korzystanie z chatbota opartego na sztucznej inteligencji (Google Gemini Pro) do rozwiązywania zadań matematycznych.</li>
              <li><strong className="text-[#F2EDE3]">Subskrypcja</strong> – usługa świadczona okresowo w modelu abonamentowym.</li>
              <li><strong className="text-[#F2EDE3]">Konto</strong> – panel klienta dostępny po zalogowaniu, umożliwiający zarządzanie zamówieniami i subskrypcją.</li>
            </OL>
          </section>

          {/* § 3 */}
          <section>
            <H id="par-3" eyebrow="§ 3" title="Składanie" accent="zamówień" />
            <OL>
              <li><strong className="text-[#F2EDE3]">Każdy kalkulator oferowany w Sklepie jest produktem wykonywanym ręcznie, indywidualnie na zamówienie Klienta.</strong> Produkt jest tworzony wyłącznie po złożeniu i opłaceniu zamówienia — nie pochodzi z magazynu gotowych towarów.</li>
              <li>
                Złożenie zamówienia wymaga wypełnienia formularza zamówienia i podania:
                <UL>
                  <li>imienia i nazwiska,</li>
                  <li>adresu email,</li>
                  <li>numeru telefonu,</li>
                  <li>wybranego punktu odbioru InPost.</li>
                </UL>
              </li>
              <li>Zamówienie uważa się za złożone z chwilą otrzymania przez Sprzedawcę potwierdzonego zamówienia wraz z płatnością.</li>
              <li>Cena produktu widoczna na stronie w momencie składania zamówienia jest ceną wiążącą.</li>
              <li>Klient otrzymuje potwierdzenie zamówienia na podany adres email.</li>
              <li>Umowa sprzedaży zostaje zawarta z chwilą wysłania przez Sprzedawcę potwierdzenia przyjęcia zamówienia do realizacji.</li>
            </OL>
          </section>

          {/* § 4 */}
          <section>
            <H id="par-4" eyebrow="§ 4" title="Płatności" accent="" />
            <OL>
              <li>Płatności realizowane są przez system Stripe.</li>
              <li>
                Akceptowane metody płatności:
                <UL>
                  <li>karty płatnicze (Visa, Mastercard, American Express),</li>
                  <li>BLIK,</li>
                  <li>Apple Pay i Google Pay.</li>
                </UL>
              </li>
              <li>Realizacja zamówienia następuje po otrzymaniu potwierdzenia płatności od operatora płatności.</li>
              <li>W przypadku subskrypcji AI Chat płatność pobierana jest automatycznie co miesiąc.</li>
            </OL>
          </section>

          {/* § 5 */}
          <section>
            <H id="par-5" eyebrow="§ 5" title="Dostawa" accent="i wysyłka" />
            <OL>
              <li>Dostawa realizowana jest wyłącznie na terytorium Polski.</li>
              <li>Sprzedawca wysyła produkty za pośrednictwem InPost Paczkomaty.</li>
              <li><strong className="text-[#F2EDE3]">Maksymalny czas wysyłki wynosi 4 tygodnie (28 dni kalendarzowych) od daty zaksięgowania płatności.</strong></li>
              <li>Zazwyczaj zamówienia wysyłamy w ciągu tygodnia od opłacenia, jednak ze względu na to, że każdy kalkulator jest składany i testowany ręcznie przez nasz zespół, realizacja może w wyjątkowych przypadkach zająć do 3 tygodni.</li>
              <li>Klient zostanie powiadomiony emailem oraz SMS o nadaniu paczki i możliwości odbioru.</li>
              <li>Produkt należy odebrać w ciągu 48 godzin od otrzymania powiadomienia. Po tym czasie paczka zostanie zwrócona do Sprzedawcy.</li>
            </OL>
          </section>

          {/* § 6 */}
          <section>
            <H id="par-6" eyebrow="§ 6" title="Prawo" accent="odstąpienia" />
            <p className="km-mono-eyebrow text-[#FF4D2E] mb-4">— wyłączenie</p>
            <OL>
              <li><strong className="text-[#F2EDE3]">Prawo odstąpienia od umowy (zwrot towaru) nie przysługuje</strong> w odniesieniu do produktów oferowanych w Sklepie, tj. kalkulatorów graficznych wykonywanych ręcznie, indywidualnie na zamówienie Klienta.</li>
              <li>Podstawa prawna wyłączenia: art. 38 ust. 1 pkt 3 Ustawy z dnia 30 maja 2014 r. o prawach konsumenta (t.j. Dz.U. 2020 poz. 287 ze zm.) — prawo odstąpienia od umowy zawartej poza lokalem przedsiębiorstwa lub na odległość nie przysługuje konsumentowi w odniesieniu do umów, w których przedmiotem świadczenia jest rzecz nieprefabrykowana, wyprodukowana według specyfikacji konsumenta lub służąca zaspokojeniu jego zindywidualizowanych potrzeb.</li>
              <li>Każdy kalkulator jest wytwarzany ręcznie, od podstaw, wyłącznie po złożeniu i opłaceniu zamówienia przez konkretnego Klienta. Produkt nie istnieje przed złożeniem zamówienia i nie może być odsprzedany innemu nabywcy — z tego powodu zwrot nie jest możliwy.</li>
              <li>Powyższe wyłączenie nie ogranicza uprawnień Klienta z tytułu reklamacji (rękojmi za wady), opisanych w § 7 niniejszego Regulaminu.</li>
              <li>Składając zamówienie i dokonując płatności, Klient potwierdza, że zapoznał się z niniejszym wyłączeniem prawa odstąpienia od umowy i akceptuje jego warunki.</li>
            </OL>
          </section>

          {/* § 7 */}
          <section>
            <H id="par-7" eyebrow="§ 7" title="Reklamacje" accent="" />
            <OL>
              <li>Sprzedawca odpowiada wobec Klienta za niezgodność produktu z umową.</li>
              <li>
                Reklamację można zgłosić:
                <UL>
                  <li>poprzez email na adres podany w stopce strony,</li>
                  <li>poprzez formularz kontaktowy na stronie.</li>
                </UL>
              </li>
              <li>
                W zgłoszeniu reklamacyjnym należy podać:
                <UL>
                  <li>imię i nazwisko,</li>
                  <li>adres email,</li>
                  <li>numer zamówienia,</li>
                  <li>opis wady lub niezgodności,</li>
                  <li>żądanie Klienta (np. wymiana, naprawa, obniżenie ceny).</li>
                </UL>
              </li>
              <li>Sprzedawca ustosunkuje się do reklamacji w ciągu 14 dni od jej otrzymania.</li>
              <li>
                W przypadku produktu wadliwego Klient może żądać:
                <UL>
                  <li>wymiany na nowy,</li>
                  <li>naprawy produktu,</li>
                  <li>obniżenia ceny,</li>
                  <li>odstąpienia od umowy i zwrotu środków.</li>
                </UL>
              </li>
            </OL>
          </section>

          {/* § 8 */}
          <section>
            <H id="par-8" eyebrow="§ 8" title="Subskrypcja" accent="AI" />
            <OL>
              <li>Kup kalkulatora obejmuje 30-dniowy bezpłatny dostęp do AI Chat.</li>
              <li>Nowi użytkownicy otrzymują 1-dniowy okres próbny AI Chat.</li>
              <li>Po zakończeniu okresu bezpłatnego/próbnego, subskrypcja jest kontynuowana automatycznie za opłatą 29 zł/miesiąc.</li>
              <li>Płatność za subskrypcję pobierana jest automatycznie w cyklu miesięcznym.</li>
              <li>Klient może anulować subskrypcję w dowolnym momencie w panelu klienta.</li>
              <li>Anulowanie subskrypcji następuje z końcem bieżącego okresu rozliczeniowego.</li>
              <li>Po anulowaniu subskrypcji Klient nie otrzymuje zwrotu środków za niewykorzystany okres.</li>
              <li>Sprzedawca zastrzega sobie prawo do zmiany ceny subskrypcji z 30-dniowym wyprzedzeniem, powiadamiając Klientów drogą mailową.</li>
            </OL>
          </section>

          {/* § 9 */}
          <section>
            <H id="par-9" eyebrow="§ 9" title="Konto" accent="użytkownika" />
            <OL>
              <li>Konto można utworzyć podczas rejestracji lub automatycznie podczas pierwszego zakupu.</li>
              <li>Logowanie wymaga podania adresu email oraz hasła (minimum 6 znaków).</li>
              <li>Klient ponosi pełną odpowiedzialność za zachowanie poufności hasła i danych dostępowych do konta.</li>
              <li>Zabronione jest udostępnianie danych logowania osobom trzecim.</li>
              <li>
                W panelu klienta dostępne są:
                <UL>
                  <li>historia zamówień,</li>
                  <li>tracking przesyłek,</li>
                  <li>AI Chat,</li>
                  <li>zarządzanie subskrypcją.</li>
                </UL>
              </li>
              <li>W przypadku utraty hasła można je zresetować korzystając z funkcji odzyskiwania hasła.</li>
              <li>Klient może w każdej chwili zażądać usunięcia konta poprzez kontakt z obsługą klienta.</li>
            </OL>
          </section>

          {/* § 10 */}
          <section>
            <H id="par-10" eyebrow="§ 10" title="Ochrona" accent="danych" />
            <OL>
              <li>Administratorem danych osobowych Klientów jest KalkMate.</li>
              <li>Dane osobowe przetwarzane są zgodnie z RODO i Polityką Prywatności.</li>
              <li>
                Szczegółowe informacje o przetwarzaniu danych znajdują się w{" "}
                <Link href="/polityka-prywatnosci" className="text-[#D8FF3D] hover:underline">
                  Polityce Prywatności
                </Link>.
              </li>
            </OL>
          </section>

          {/* § 11 */}
          <section>
            <H id="par-11" eyebrow="§ 11" title="Własność" accent="intelektualna" />
            <OL>
              <li>Wszystkie treści zamieszczone na stronie KalkMate.pl, w tym teksty, grafiki, logo, zdjęcia, są własnością Sprzedawcy i podlegają ochronie prawa autorskiego.</li>
              <li>Kopiowanie, rozpowszechnianie lub wykorzystywanie treści w celach komercyjnych bez zgody Sprzedawcy jest zabronione.</li>
              <li>Oprogramowanie kalkulatora jest własnością Sprzedawcy i jest licencjonowane Klientowi wyłącznie do użytku osobistego.</li>
            </OL>
          </section>

          {/* § 12 */}
          <section>
            <H id="par-12" eyebrow="§ 12" title="Postanowienia" accent="końcowe" />
            <OL>
              <li>Sprzedawca zastrzega sobie prawo do zmiany Regulaminu z ważnych przyczyn technicznych, prawnych lub organizacyjnych.</li>
              <li>O zmianach Regulaminu Klienci zostaną powiadomieni poprzez email lub komunikat na stronie z 14-dniowym wyprzedzeniem.</li>
              <li>Zmiany Regulaminu nie wpływają na umowy zawarte przed datą wejścia w życie nowego Regulaminu.</li>
              <li>W sprawach nieuregulowanych Regulaminem zastosowanie mają przepisy Kodeksu Cywilnego oraz ustawy o prawach konsumenta.</li>
              <li>Ewentualne spory będą rozstrzygane przez sąd właściwy według przepisów Kodeksu postępowania cywilnego.</li>
              <li>
                Konsument ma prawo skorzystać z pozasądowych sposobów rozstrzygania sporów, w szczególności poprzez:
                <UL>
                  <li>Stałe Polubowne Sądy Konsumenckie,</li>
                  <li>Wojewódzkie Inspektoraty Inspekcji Handlowej,</li>
                  <li>
                    platformę ODR:{" "}
                    <a
                      href="https://ec.europa.eu/consumers/odr"
                      target="_blank"
                      rel="noopener"
                      className="text-[#D8FF3D] hover:underline break-all"
                    >
                      https://ec.europa.eu/consumers/odr
                    </a>.
                  </li>
                </UL>
              </li>
            </OL>
          </section>

          {/* § 13 */}
          <section>
            <H id="par-13" eyebrow="§ 13" title="Kontakt" accent="" />
            <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/75">
              W razie pytań dotyczących Regulaminu lub działalności sklepu prosimy o kontakt:
            </p>
            <div className="mt-5 p-5 border border-[rgba(242,237,227,0.10)] bg-[#0E0E0E] text-[14px] text-[#F2EDE3]/80">
              <div className="km-mono-eyebrow text-[#D8FF3D] mb-3">KAJPA Kacper Popko</div>
              <div className="grid sm:grid-cols-2 gap-y-2 gap-x-6">
                <div>
                  <span className="text-[#F2EDE3]/45">NIP:</span>{" "}
                  <span className="font-mono">9662222951</span>
                </div>
                <div>
                  <span className="text-[#F2EDE3]/45">E-mail:</span>{" "}
                  <a href="mailto:kontakt@kajpa.pl" className="text-[#D8FF3D] hover:underline">kontakt@kajpa.pl</a>
                </div>
                <div>
                  <span className="text-[#F2EDE3]/45">Telefon:</span>{" "}
                  <a href="tel:+48600580888" className="text-[#D8FF3D] hover:underline font-mono">+48 600 580 888</a>
                </div>
                <div>
                  <span className="text-[#F2EDE3]/45">Formularz:</span>{" "}
                  <Link href="/pomoc#kontakt" className="text-[#D8FF3D] hover:underline">/pomoc#kontakt</Link>
                </div>
              </div>
            </div>
          </section>

          {/* Stopka dokumentu */}
          <div className="pt-8 border-t border-[rgba(242,237,227,0.10)] flex flex-wrap items-center justify-between gap-4">
            <span className="km-mono-eyebrow text-[#F2EDE3]/45">
              Ostatnia aktualizacja · 2026-05-31
            </span>
            <Link
              href="/"
              className="km-mono-eyebrow text-[#F2EDE3]/55 hover:text-[#D8FF3D] transition-colors"
            >
              ← Strona główna
            </Link>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
