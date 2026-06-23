"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { localeFromPathname, type Locale } from "@/lib/i18n";

const content: Record<Locale, {
  ariaLabel: string;
  heading: string;
  privacyBadge: string;
  bodyPrefix: string;
  bodyEssential: string;
  bodyMiddle: string;
  bodyAnalytics: string;
  bodySuffix: string;
  moreInfo: string;
  privacyLink: string;
  afterLink: string;
  acceptAll: string;
  onlyEssential: string;
}> = {
  pl: {
    ariaLabel: "Zgoda na pliki cookies",
    heading: "Cookies · zgoda",
    privacyBadge: "RODO / e-Privacy",
    bodyPrefix: "Używamy ciasteczek — ",
    bodyEssential: "niezbędnych",
    bodyMiddle: " do działania sklepu (logowanie, koszyk) oraz ",
    bodyAnalytics: "analitycznych",
    bodySuffix: ", żeby wiedzieć co poprawiać. Niezbędne nie wymagają zgody, analityczne — tak.",
    moreInfo: "Więcej w ",
    privacyLink: "Polityce Prywatności",
    afterLink: ". Decyzję możesz zmienić w przeglądarce w dowolnym momencie.",
    acceptAll: "Akceptuję wszystkie",
    onlyEssential: "Tylko niezbędne",
  },
  en: {
    ariaLabel: "Cookie consent",
    heading: "Cookies · consent",
    privacyBadge: "GDPR / e-Privacy",
    bodyPrefix: "We use cookies — ",
    bodyEssential: "essential",
    bodyMiddle: " ones to run the store (login, cart) and ",
    bodyAnalytics: "analytics",
    bodySuffix: " ones so we know what to improve. Essential cookies need no consent, analytics ones do.",
    moreInfo: "More in our ",
    privacyLink: "Privacy Policy",
    afterLink: ". You can change your decision in your browser at any time.",
    acceptAll: "Accept all",
    onlyEssential: "Essential only",
  },
  de: {
    ariaLabel: "Cookie-Einwilligung",
    heading: "Cookies · Einwilligung",
    privacyBadge: "DSGVO / e-Privacy",
    bodyPrefix: "Wir verwenden Cookies — ",
    bodyEssential: "notwendige",
    bodyMiddle: " für den Betrieb des Shops (Anmeldung, Warenkorb) sowie ",
    bodyAnalytics: "analytische",
    bodySuffix: ", um zu wissen, was wir verbessern können. Notwendige Cookies brauchen keine Einwilligung, analytische schon.",
    moreInfo: "Mehr in unserer ",
    privacyLink: "Datenschutzerklärung",
    afterLink: ". Sie können Ihre Entscheidung jederzeit im Browser ändern.",
    acceptAll: "Alle akzeptieren",
    onlyEssential: "Nur notwendige",
  },
};

const STORAGE_KEY = "kalkmate-cookie-consent";
const VERSION = "1"; // bump zeby wymusic ponowna zgode po istotnej zmianie

type Choice = "all" | "essential";

interface ConsentRecord {
  v: string;
  choice: Choice;
  at: string;
}

function read(): ConsentRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentRecord;
    if (parsed?.v !== VERSION) return null; // stara wersja -> pytamy znow
    return parsed;
  } catch {
    return null;
  }
}

function write(choice: Choice) {
  const record: ConsentRecord = {
    v: VERSION,
    choice,
    at: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    window.dispatchEvent(
      new CustomEvent("kalkmate:cookie-consent", { detail: record }),
    );
  } catch {
    // localStorage zablokowany (private mode) — nic nie zapisujemy
  }
}

export default function CookieBanner() {
  const lang = localeFromPathname(usePathname());
  const t = content[lang];
  // null = jeszcze nie wiemy (SSR / pre-mount), false = nie pokazuj, true = pokaz
  const [show, setShow] = useState<boolean | null>(null);

  useEffect(() => {
    setShow(!read());
  }, []);

  if (!show) return null;

  const accept = (choice: Choice) => {
    write(choice);
    setShow(false);
  };

  return (
    <div
      role="dialog"
      aria-label={t.ariaLabel}
      className="fixed inset-x-0 bottom-0 z-[100] px-4 pb-4 sm:px-6 sm:pb-6 pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto max-w-4xl bg-[#0E0E0E]/95 backdrop-blur-md border border-[rgba(242,237,227,0.18)] shadow-2xl">
        {/* Top accent bar */}
        <div className="h-[2px] bg-gradient-to-r from-transparent via-[#D8FF3D] to-transparent" />

        <div className="p-5 sm:p-7 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="km-mono-eyebrow text-[#D8FF3D] flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full km-blink" />
                {t.heading}
              </span>
              <span className="km-mono-eyebrow text-[#F2EDE3]/30 hidden sm:inline">
                {t.privacyBadge}
              </span>
            </div>
            <p className="text-[14px] leading-[1.55] text-[#F2EDE3]/80">
              {t.bodyPrefix}<strong className="text-[#F2EDE3]">{t.bodyEssential}</strong>{t.bodyMiddle}
              <strong className="text-[#F2EDE3]">{t.bodyAnalytics}</strong>{t.bodySuffix}
            </p>
            <p className="mt-2 text-[12px] text-[#F2EDE3]/45">
              {t.moreInfo}
              <Link
                href="/polityka-prywatnosci#sek-9"
                className="text-[#D8FF3D] hover:underline"
              >
                {t.privacyLink}
              </Link>
              {t.afterLink}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-2 lg:min-w-[200px]">
            <button
              onClick={() => accept("all")}
              className="km-mono-eyebrow bg-[#D8FF3D] text-[#0B0B0B] px-5 py-3 hover:bg-[#F2EDE3] transition-colors order-1"
            >
              {t.acceptAll}
            </button>
            <button
              onClick={() => accept("essential")}
              className="km-mono-eyebrow border border-[rgba(242,237,227,0.18)] text-[#F2EDE3]/80 px-5 py-3 hover:border-[#D8FF3D] hover:text-[#F2EDE3] transition-colors order-2"
            >
              {t.onlyEssential}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
