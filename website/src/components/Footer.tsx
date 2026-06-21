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
              <li><a href="/pomoc" className="text-[14.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3]">Pomoc</a></li>
            </ul>
          </div>

          <div className="lg:col-span-2">
            <p className="km-mono-eyebrow text-[#D8FF3D] mb-4">Formalności</p>
            <ul className="space-y-2.5">
              <li><a href="/regulamin" className="text-[14.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3]">Regulamin</a></li>
              <li><a href="/polityka-prywatnosci" className="text-[14.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3]">Polityka prywatności</a></li>
              <li><a href="/docs/ce-declaration.pdf" className="text-[14.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3]" target="_blank" rel="noopener noreferrer">Deklaracja zgodności CE</a></li>
              <li>
                <a href="mailto:kontakt@kalkmate.pl" className="text-[14.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3]">
                  kontakt@kalkmate.pl
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Dane firmy — wymagane prawnie + zgodne z ustawa o swiadczeniu uslug drogą elektroniczna */}
        <div className="mt-14 pt-6 border-t border-[rgba(242,237,227,0.10)]">
          <p className="km-mono-eyebrow text-[#D8FF3D] mb-4">Dane firmy</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 text-[13.5px] text-[#F2EDE3]/70">
            <div>
              <p className="km-mono-eyebrow text-[#F2EDE3]/40 text-[10px] mb-1">Sprzedawca</p>
              <p className="text-[#F2EDE3]">KAJPA Kacper Popko</p>
            </div>
            <div>
              <p className="km-mono-eyebrow text-[#F2EDE3]/40 text-[10px] mb-1">NIP</p>
              <p className="font-mono text-[#F2EDE3]">9662222951</p>
            </div>
            <div>
              <p className="km-mono-eyebrow text-[#F2EDE3]/40 text-[10px] mb-1">REGON</p>
              <p className="font-mono text-[#F2EDE3]">545011444</p>
            </div>
            <div>
              <p className="km-mono-eyebrow text-[#F2EDE3]/40 text-[10px] mb-1">Adres siedziby</p>
              <p className="text-[#F2EDE3]">ul. Zastawie I 37, 16-070 Choroszcz</p>
            </div>
            <div>
              <p className="km-mono-eyebrow text-[#F2EDE3]/40 text-[10px] mb-1">E-mail</p>
              <a href="mailto:kontakt@kajpa.pl" className="font-mono text-[#F2EDE3] hover:text-[#D8FF3D] transition-colors">
                kontakt@kajpa.pl
              </a>
            </div>
            <div>
              <p className="km-mono-eyebrow text-[#F2EDE3]/40 text-[10px] mb-1">Telefon</p>
              <a href="tel:+48600580888" className="font-mono text-[#F2EDE3] hover:text-[#D8FF3D] transition-colors">
                600 580 888
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-[rgba(242,237,227,0.10)] flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <p className="km-mono-eyebrow text-[#F2EDE3]/40">
            © 2026 KAJPA Kacper Popko · KalkMate. Wyprodukowano w Polsce.
          </p>
          <p className="km-mono-eyebrow text-[#F2EDE3]/30">
            FW 0.6.4 · LAT 50.0647 LON 19.9450
          </p>
        </div>
      </div>
    </footer>
  );
}
