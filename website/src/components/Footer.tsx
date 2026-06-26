import { type Locale } from "@/lib/i18n";

const content: Record<Locale, {
  tagline: string;
  product: string;
  account: string;
  legal: string;
  company: string;
  links: {
    howItWorks: string;
    subjects: string;
    hardware: string;
    gallery: string;
    order: string;
    signin: string;
    panel: string;
    activation: string;
    help: string;
    terms: string;
    privacy: string;
    ce: string;
  };
  fields: {
    seller: string;
    nip: string;
    regon: string;
    bdo: string;
    address: string;
    email: string;
    phone: string;
  };
  copyright: string;
}> = {
  pl: {
    tagline: "Polski kalkulator AI · 2026",
    product: "Produkt",
    account: "Konto",
    legal: "Formalności",
    company: "Dane firmy",
    links: {
      howItWorks: "Jak działa",
      subjects: "Przedmioty",
      hardware: "Hardware",
      gallery: "Galeria",
      order: "Zamów",
      signin: "Logowanie",
      panel: "Panel",
      activation: "Aktywacja",
      help: "Pomoc",
      terms: "Regulamin",
      privacy: "Polityka prywatności",
      ce: "Deklaracja zgodności CE",
    },
    fields: {
      seller: "Sprzedawca",
      nip: "NIP",
      regon: "REGON",
      bdo: "Nr BDO",
      address: "Adres siedziby",
      email: "E-mail",
      phone: "Telefon",
    },
    copyright: "© 2026 KAJPA Kacper Popko · KalkMate. Wyprodukowano w Polsce.",
  },
  en: {
    tagline: "Polish AI calculator · 2026",
    product: "Product",
    account: "Account",
    legal: "Legal",
    company: "Company details",
    links: {
      howItWorks: "How it works",
      subjects: "Subjects",
      hardware: "Hardware",
      gallery: "Gallery",
      order: "Order",
      signin: "Sign in",
      panel: "Panel",
      activation: "Activation",
      help: "Help",
      terms: "Terms of Service",
      privacy: "Privacy Policy",
      ce: "CE Declaration of Conformity",
    },
    fields: {
      seller: "Seller",
      nip: "Tax ID (NIP)",
      regon: "REGON",
      bdo: "BDO No.",
      address: "Registered address",
      email: "E-mail",
      phone: "Phone",
    },
    copyright: "© 2026 KAJPA Kacper Popko · KalkMate. Made in Poland.",
  },
  de: {
    tagline: "Polnischer KI-Rechner · 2026",
    product: "Produkt",
    account: "Konto",
    legal: "Rechtliches",
    company: "Firmendaten",
    links: {
      howItWorks: "So funktioniert's",
      subjects: "Fächer",
      hardware: "Hardware",
      gallery: "Galerie",
      order: "Bestellen",
      signin: "Anmelden",
      panel: "Panel",
      activation: "Aktivierung",
      help: "Hilfe",
      terms: "AGB",
      privacy: "Datenschutzerklärung",
      ce: "CE-Konformitätserklärung",
    },
    fields: {
      seller: "Verkäufer",
      nip: "Steuer-ID (NIP)",
      regon: "REGON",
      bdo: "BDO-Nr.",
      address: "Geschäftssitz",
      email: "E-Mail",
      phone: "Telefon",
    },
    copyright: "© 2026 KAJPA Kacper Popko · KalkMate. Hergestellt in Polen.",
  },
};

export default function Footer({ lang = "pl" }: { lang?: Locale }) {
  const t = content[lang];
  return (
    <footer className="border-t border-[rgba(242,237,227,0.10)] bg-[#0B0B0B] pt-16 pb-8">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-6">
            <p className="km-display text-[clamp(56px,9vw,140px)] leading-[0.92] text-[#F2EDE3]">
              Kalk<span className="italic text-[#D8FF3D]">Mate</span>.
            </p>
            <p className="km-mono-eyebrow text-[#F2EDE3]/45 mt-6">
              {t.tagline}
            </p>
          </div>

          <div className="lg:col-span-2">
            <p className="km-mono-eyebrow text-[#D8FF3D] mb-4">{t.product}</p>
            <ul className="space-y-2.5">
              <li><a href="#jak-dziala" className="text-[14.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3]">{t.links.howItWorks}</a></li>
              <li><a href="#przedmioty" className="text-[14.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3]">{t.links.subjects}</a></li>
              <li><a href="#hardware" className="text-[14.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3]">{t.links.hardware}</a></li>
              <li><a href="#galeria" className="text-[14.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3]">{t.links.gallery}</a></li>
              <li><a href="#kup-teraz" className="text-[14.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3]">{t.links.order}</a></li>
            </ul>
          </div>

          <div className="lg:col-span-2">
            <p className="km-mono-eyebrow text-[#D8FF3D] mb-4">{t.account}</p>
            <ul className="space-y-2.5">
              <li><a href="/auth/signin" className="text-[14.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3]">{t.links.signin}</a></li>
              <li><a href="/panel" className="text-[14.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3]">{t.links.panel}</a></li>
              <li><a href="/claim" className="text-[14.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3]">{t.links.activation}</a></li>
              <li><a href="/pomoc" className="text-[14.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3]">{t.links.help}</a></li>
            </ul>
          </div>

          <div className="lg:col-span-2">
            <p className="km-mono-eyebrow text-[#D8FF3D] mb-4">{t.legal}</p>
            <ul className="space-y-2.5">
              <li><a href="/regulamin" className="text-[14.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3]">{t.links.terms}</a></li>
              <li><a href="/polityka-prywatnosci" className="text-[14.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3]">{t.links.privacy}</a></li>
              <li><a href="/docs/ce-declaration.pdf" className="text-[14.5px] text-[#F2EDE3]/70 hover:text-[#F2EDE3]" target="_blank" rel="noopener noreferrer">{t.links.ce}</a></li>
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
          <p className="km-mono-eyebrow text-[#D8FF3D] mb-4">{t.company}</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 text-[13.5px] text-[#F2EDE3]/70">
            <div>
              <p className="km-mono-eyebrow text-[#F2EDE3]/40 text-[10px] mb-1">{t.fields.seller}</p>
              <p className="text-[#F2EDE3]">KAJPA Kacper Popko</p>
            </div>
            <div>
              <p className="km-mono-eyebrow text-[#F2EDE3]/40 text-[10px] mb-1">{t.fields.nip}</p>
              <p className="font-mono text-[#F2EDE3]">9662222951</p>
            </div>
            <div>
              <p className="km-mono-eyebrow text-[#F2EDE3]/40 text-[10px] mb-1">{t.fields.regon}</p>
              <p className="font-mono text-[#F2EDE3]">545011444</p>
            </div>
            <div>
              <p className="km-mono-eyebrow text-[#F2EDE3]/40 text-[10px] mb-1">{t.fields.bdo}</p>
              <p className="font-mono text-[#F2EDE3]">000727998</p>
            </div>
            <div>
              <p className="km-mono-eyebrow text-[#F2EDE3]/40 text-[10px] mb-1">{t.fields.address}</p>
              <p className="text-[#F2EDE3]">ul. Zastawie I 37, 16-070 Choroszcz</p>
            </div>
            <div>
              <p className="km-mono-eyebrow text-[#F2EDE3]/40 text-[10px] mb-1">{t.fields.email}</p>
              <a href="mailto:kontakt@kajpa.pl" className="font-mono text-[#F2EDE3] hover:text-[#D8FF3D] transition-colors">
                kontakt@kajpa.pl
              </a>
            </div>
            <div>
              <p className="km-mono-eyebrow text-[#F2EDE3]/40 text-[10px] mb-1">{t.fields.phone}</p>
              <a href="tel:+48600580888" className="font-mono text-[#F2EDE3] hover:text-[#D8FF3D] transition-colors">
                600 580 888
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-[rgba(242,237,227,0.10)] flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <p className="km-mono-eyebrow text-[#F2EDE3]/40">
            {t.copyright}
          </p>
          <p className="km-mono-eyebrow text-[#F2EDE3]/30">
            FW 0.6.4 · LAT 50.0647 LON 19.9450
          </p>
        </div>
      </div>
    </footer>
  );
}
