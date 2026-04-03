import Image from "next/image";

export default function Footer() {
  return (
    <footer className="py-12 bg-white dark:bg-[#2B2D31] border-t border-gray-100 dark:border-[#3F4147]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Logo */}
          <div>
            <a href="#" className="flex items-center gap-0.5">
              <Image
                src="/kalkmate_icon.svg"
                alt="KalkMate icon"
                width={30}
                height={30}
                className="dark:invert"
              />
              <Image
                src="/kalkmate_text.svg"
                alt="KalkMate"
                width={120}
                height={28}
                className="dark:invert"
              />
            </a>
          </div>

          {/* Links */}
          <div className="flex gap-6">
            <a
              href="/regulamin"
              className="text-sm text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50 hover:text-[#1a1a1a] dark:hover:text-[#E0E0E0] transition-colors"
            >
              Regulamin
            </a>
            <a
              href="/polityka-prywatnosci"
              className="text-sm text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50 hover:text-[#1a1a1a] dark:hover:text-[#E0E0E0] transition-colors"
            >
              Polityka prywatności
            </a>
            <a
              href="mailto:kacper@kajpa.pl"
              className="text-sm text-[#1a1a1a]/50 dark:text-[#E0E0E0]/50 hover:text-[#1a1a1a] dark:hover:text-[#E0E0E0] transition-colors"
            >
              Kontakt
            </a>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-100 dark:border-[#3F4147] flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[#1a1a1a]/40 dark:text-[#E0E0E0]/40">
            kacper@kajpa.pl
          </p>
          <p className="text-xs text-[#1a1a1a]/40 dark:text-[#E0E0E0]/40">
            &copy; 2026 KalkMate. Zaprojektowane i wyprodukowane w Polsce.
          </p>
        </div>
      </div>
    </footer>
  );
}
