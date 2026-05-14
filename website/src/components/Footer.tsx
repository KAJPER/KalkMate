export default function Footer() {
  return (
    <footer className="border-t border-[rgba(242,237,227,0.10)] bg-[#0B0B0B] pt-16 pb-8">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-6">
            <p className="km-display text-[clamp(56px,9vw,140px)] leading-[0.92] text-[#F2EDE3]">
              Kalk<span className="italic text-[#D8FF3D]">Mate</span>.
            </p>
            <p className="km-mono-eyebrow text-[#F2EDE3]/45 mt-6">
              Polski kalkulator AI · 2026
            </p>
          </div>

          <div className="lg:col-span-2">
            <p className="km-mono-eyebrow text-[#D8FF3D] mb-4">Produkt</p>
            <ul className="space-y-2.5">
              <li><a href="#jak-dziala" className="text-[14.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3]">Jak działa</a></li>
              <li><a href="#przedmioty" className="text-[14.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3]">Przedmioty</a></li>
              <li><a href="#hardware" className="text-[14.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3]">Hardware</a></li>
              <li><a href="#galeria" className="text-[14.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3]">Galeria</a></li>
              <li><a href="#kup-teraz" className="text-[14.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3]">Zamów</a></li>
            </ul>
          </div>

          <div className="lg:col-span-2">
            <p className="km-mono-eyebrow text-[#D8FF3D] mb-4">Konto</p>
            <ul className="space-y-2.5">
              <li><a href="/auth/signin" className="text-[14.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3]">Logowanie</a></li>
              <li><a href="/panel" className="text-[14.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3]">Panel</a></li>
              <li><a href="/claim" className="text-[14.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3]">Aktywacja</a></li>
            </ul>
          </div>

          <div className="lg:col-span-2">
            <p className="km-mono-eyebrow text-[#D8FF3D] mb-4">Formalności</p>
            <ul className="space-y-2.5">
              <li><a href="/regulamin" className="text-[14.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3]">Regulamin</a></li>
              <li><a href="/polityka-prywatnosci" className="text-[14.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3]">Polityka prywatności</a></li>
              <li>
                <a href="mailto:kacper@kajpa.pl" className="text-[14.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3]">
                  kacper@kajpa.pl
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-6 border-t border-[rgba(242,237,227,0.10)] flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <p className="km-mono-eyebrow text-[#F2EDE3]/40">
            © 2026 KalkMate. Wyprodukowano w Polsce.
          </p>
          <p className="km-mono-eyebrow text-[#F2EDE3]/30">
            FW 0.6.4 · LAT 50.0647 LON 19.9450
          </p>
        </div>
      </div>
    </footer>
  );
}
