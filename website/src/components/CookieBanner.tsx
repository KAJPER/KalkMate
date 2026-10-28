"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { localeFromPathname, type Locale } from "@/lib/i18n";
import { CONSENT_EVENT, CONSENT_STORAGE_KEY, CONSENT_VERSION } from "@/components/consent";

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
    bodySuffix: ", żeby wiedzieć co poprawiać (mapy ciepła, nagrania sesji; jeśli napiszesz na czacie — także przebieg wizyty przy rozmowie). Niezbędne nie wymagają zgody, analityczne — tak.",
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
    bodySuffix: " ones so we know what to improve (heatmaps, session recordings; if you use the chat — also your visit path attached to the conversation). Essential cookies need no consent, analytics ones do.",
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
    bodySuffix: ", um zu wissen, was wir verbessern können (Heatmaps, Sitzungsaufzeichnungen; wenn du den Chat nutzt — auch dein Besuchsverlauf zum Gespräch). Notwendige Cookies brauchen keine Einwilligung, analytische schon.",
    moreInfo: "Mehr in unserer ",
    privacyLink: "Datenschutzerklärung",
    afterLink: ". Sie können Ihre Entscheidung jederzeit im Browser ändern.",
    acceptAll: "Alle akzeptieren",
    onlyEssential: "Nur notwendige",
  },
  cs: {
    ariaLabel: "Souhlas s cookies",
    heading: "Cookies · souhlas",
    privacyBadge: "GDPR / e-Privacy",
    bodyPrefix: "Používáme cookies — ",
    bodyEssential: "nezbytné",
    bodyMiddle: " pro chod obchodu (přihlášení, košík) a ",
    bodyAnalytics: "analytické",
    bodySuffix: ", abychom věděli, co zlepšit (teplotní mapy, záznamy relací; pokud použiješ chat — i průběh návštěvy u konverzace). Nezbytné cookies souhlas nevyžadují, analytické ano.",
    moreInfo: "Více v ",
    privacyLink: "Zásadách ochrany osobních údajů",
    afterLink: ". Své rozhodnutí můžete kdykoli změnit v prohlížeči.",
    acceptAll: "Přijmout vše",
    onlyEssential: "Jen nezbytné",
  },
  sk: {
    ariaLabel: "Súhlas s cookies",
    heading: "Cookies · súhlas",
    privacyBadge: "GDPR / e-Privacy",
    bodyPrefix: "Používame cookies — ",
    bodyEssential: "nevyhnutné",
    bodyMiddle: " na fungovanie obchodu (prihlásenie, košík) a ",
    bodyAnalytics: "analytické",
    bodySuffix: ", aby sme vedeli, čo zlepšiť (teplotné mapy, záznamy relácií; ak použiješ chat — aj priebeh návštevy pri konverzácii). Nevyhnutné cookies súhlas nevyžadujú, analytické áno.",
    moreInfo: "Viac v ",
    privacyLink: "Zásadách ochrany osobných údajov",
    afterLink: ". Svoje rozhodnutie môžete kedykoľvek zmeniť v prehliadači.",
    acceptAll: "Prijať všetky",
    onlyEssential: "Iba nevyhnutné",
  },
  lt: {
    ariaLabel: "Sutikimas dėl slapukų",
    heading: "Slapukai · sutikimas",
    privacyBadge: "BDAR / e-Privacy",
    bodyPrefix: "Naudojame slapukus — ",
    bodyEssential: "būtinuosius",
    bodyMiddle: " parduotuvės veikimui (prisijungimas, krepšelis) ir ",
    bodyAnalytics: "analitinius",
    bodySuffix: ", kad žinotume, ką tobulinti (šilumos žemėlapiai, sesijų įrašai; jei naudosi pokalbį — ir apsilankymo eiga prie pokalbio). Būtiniesiems slapukams sutikimo nereikia, analitiniams — reikia.",
    moreInfo: "Daugiau informacijos — ",
    privacyLink: "Privatumo politikoje",
    afterLink: ". Savo sprendimą naršyklėje galite pakeisti bet kada.",
    acceptAll: "Priimti visus",
    onlyEssential: "Tik būtinuosius",
  },
  be: {
    ariaLabel: "Згода на cookies",
    heading: "Cookies · згода",
    privacyBadge: "GDPR / e-Privacy",
    bodyPrefix: "Мы выкарыстоўваем cookies — ",
    bodyEssential: "неабходныя",
    bodyMiddle: " для працы крамы (уваход, кошык) і ",
    bodyAnalytics: "аналітычныя",
    bodySuffix: ", каб ведаць, што паляпшаць (цеплавыя карты, запісы сесій; калі карыстаешся чатам — і ход наведвання пры размове). Неабходныя не патрабуюць згоды, аналітычныя — патрабуюць.",
    moreInfo: "Падрабязней — у ",
    privacyLink: "Палітыцы прыватнасці",
    afterLink: ". Сваё рашэнне можна ў любы момант змяніць у браўзеры.",
    acceptAll: "Прыняць усе",
    onlyEssential: "Толькі неабходныя",
  },
  es: {
    ariaLabel: "Consentimiento de cookies",
    heading: "Cookies · consentimiento",
    privacyBadge: "RGPD / e-Privacy",
    bodyPrefix: "Usamos cookies — ",
    bodyEssential: "esenciales",
    bodyMiddle: " para el funcionamiento de la tienda (inicio de sesión, carrito) y ",
    bodyAnalytics: "analíticas",
    bodySuffix: " para saber qué mejorar (mapas de calor, grabaciones de sesión; si usas el chat — también tu recorrido por la web junto a la conversación). Las esenciales no requieren consentimiento; las analíticas, sí.",
    moreInfo: "Más información en nuestra ",
    privacyLink: "Política de privacidad",
    afterLink: ". Puedes cambiar tu decisión en el navegador en cualquier momento.",
    acceptAll: "Aceptar todas",
    onlyEssential: "Solo esenciales",
  },
  pt: {
    ariaLabel: "Consentimento de cookies",
    heading: "Cookies · consentimento",
    privacyBadge: "RGPD / e-Privacy",
    bodyPrefix: "Usamos cookies — ",
    bodyEssential: "essenciais",
    bodyMiddle: " para o funcionamento da loja (início de sessão, carrinho) e ",
    bodyAnalytics: "analíticos",
    bodySuffix: ", para sabermos o que melhorar (mapas de calor, gravações de sessão; se usares o chat — também o percurso da visita junto à conversa). Os essenciais não precisam de consentimento; os analíticos, sim.",
    moreInfo: "Mais informações na nossa ",
    privacyLink: "Política de Privacidade",
    afterLink: ". Pode alterar a sua decisão no navegador a qualquer momento.",
    acceptAll: "Aceitar todos",
    onlyEssential: "Só essenciais",
  },
  fr: {
    ariaLabel: "Consentement aux cookies",
    heading: "Cookies · consentement",
    privacyBadge: "RGPD / e-Privacy",
    bodyPrefix: "Nous utilisons des cookies — ",
    bodyEssential: "essentiels",
    bodyMiddle: " au fonctionnement de la boutique (connexion, panier) et ",
    bodyAnalytics: "analytiques",
    bodySuffix: " pour savoir quoi améliorer (cartes de chaleur, enregistrements de session ; si tu utilises le chat — aussi ton parcours sur le site joint à la conversation). Les cookies essentiels ne nécessitent pas de consentement, les analytiques si.",
    moreInfo: "Plus d’informations dans notre ",
    privacyLink: "Politique de confidentialité",
    afterLink: ". Vous pouvez modifier votre choix à tout moment dans votre navigateur.",
    acceptAll: "Tout accepter",
    onlyEssential: "Essentiels uniquement",
  },
  it: {
    ariaLabel: "Consenso ai cookie",
    heading: "Cookie · consenso",
    privacyBadge: "GDPR / e-Privacy",
    bodyPrefix: "Usiamo i cookie — ",
    bodyEssential: "essenziali",
    bodyMiddle: " per il funzionamento del negozio (accesso, carrello) e ",
    bodyAnalytics: "analitici",
    bodySuffix: ", per capire cosa migliorare (mappe di calore, registrazioni delle sessioni; se usi la chat — anche il percorso della visita insieme alla conversazione). Quelli essenziali non richiedono consenso, quelli analitici sì.",
    moreInfo: "Maggiori informazioni nella nostra ",
    privacyLink: "Informativa sulla privacy",
    afterLink: ". Puoi modificare la tua scelta nel browser in qualsiasi momento.",
    acceptAll: "Accetta tutti",
    onlyEssential: "Solo essenziali",
  },
};

// Wspolne z ClarityAnalytics / BuyNow (components/consent.ts) — bump
// CONSENT_VERSION, zeby wymusic ponowna zgode po istotnej zmianie.
const STORAGE_KEY = CONSENT_STORAGE_KEY;
const VERSION = CONSENT_VERSION;

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
      new CustomEvent(CONSENT_EVENT, { detail: record }),
    );
  } catch {
    // localStorage zablokowany (private mode) — nic nie zapisujemy
  }
}

export default function CookieBanner() {
  const pathname = usePathname();
  const lang = localeFromPathname(pathname);
  const t = content[lang];
  // null = jeszcze nie wiemy (SSR / pre-mount), false = nie pokazuj, true = pokaz
  const [show, setShow] = useState<boolean | null>(null);

  useEffect(() => {
    setShow(!read());
  }, []);

  // Panel admina (/admin) to wewnetrzne narzedzie za logowaniem — zgoda na
  // ciasteczka sklepu/analityki klienta nie ma tu zastosowania, a baner tylko
  // zaslania tresc panelu (zaobserwowane realnie: nachodzil na karty admina).
  if (pathname?.startsWith("/admin")) return null;
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
              <span className="km-mono-eyebrow text-[#F2EDE3]/55 hidden sm:inline">
                {t.privacyBadge}
              </span>
            </div>
            <p className="text-[14px] leading-[1.55] text-[#F2EDE3]/80">
              {t.bodyPrefix}<strong className="text-[#F2EDE3]">{t.bodyEssential}</strong>{t.bodyMiddle}
              <strong className="text-[#F2EDE3]">{t.bodyAnalytics}</strong>{t.bodySuffix}
            </p>
            <p className="mt-2 text-[12px] text-[#F2EDE3]/55">
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
