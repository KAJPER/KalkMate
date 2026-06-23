"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { type Locale } from "@/lib/i18n";
import { usePanelLang } from "@/lib/usePanelLang";
import PanelLangSwitcher from "@/components/PanelLangSwitcher";

const DICT: Record<Locale, {
  noToken: string;
  invalidLink: string;
  networkError: string;
  genericFail: string;
  eyebrowStep: string;
  asideHeading1: string;
  asideHeadingItalic: string;
  asideHeading2: string;
  asideBody: string;
  panelEyebrow: string;
  panelTag: string;
  headingPre: string;
  headingEmail: string;
  headingDot: string;
  checking: string;
  invalidTag: string;
  goToSignin: string;
  alreadyTag: string;
  alreadyBody: string;
  signin: string;
  validBody: string;
  activating: string;
  confirmEmail: string;
  doneTag: string;
  doneBody: string;
}> = {
  pl: {
    noToken: "Brak tokenu w linku",
    invalidLink: "Link nieprawidłowy",
    networkError: "Błąd sieci",
    genericFail: "Nie udało się",
    eyebrowStep: "[ 04 ] · Weryfikacja",
    asideHeading1: "Jedno ",
    asideHeadingItalic: "kliknięcie",
    asideHeading2: ".",
    asideBody:
      "Potwierdź swój email żeby aktywować konto. Bez weryfikacji nie zalogujesz się ani nie złożysz zamówienia.",
    panelEyebrow: "Weryfikacja email",
    panelTag: "/VERIFY",
    headingPre: "Potwierdź ",
    headingEmail: "email",
    headingDot: ".",
    checking: "SPRAWDZAM LINK...",
    invalidTag: "/ LINK NIEWAŻNY",
    goToSignin: "Idź do logowania →",
    alreadyTag: "/ JUŻ ZWERYFIKOWANE",
    alreadyBody: "Konto było już aktywowane.",
    signin: "Zaloguj się →",
    validBody: "Klik poniżej aby aktywować swoje konto KalkMate.",
    activating: "AKTYWUJĘ...",
    confirmEmail: "POTWIERDŹ EMAIL",
    doneTag: "/ KONTO AKTYWNE",
    doneBody: "Twoje konto jest aktywne. Możesz się teraz zalogować.",
  },
  en: {
    noToken: "No token in the link",
    invalidLink: "Invalid link",
    networkError: "Network error",
    genericFail: "Something went wrong",
    eyebrowStep: "[ 04 ] · Verification",
    asideHeading1: "One ",
    asideHeadingItalic: "click",
    asideHeading2: ".",
    asideBody:
      "Confirm your email to activate your account. Without verification you can't sign in or place an order.",
    panelEyebrow: "Email verification",
    panelTag: "/VERIFY",
    headingPre: "Confirm your ",
    headingEmail: "email",
    headingDot: ".",
    checking: "CHECKING LINK...",
    invalidTag: "/ INVALID LINK",
    goToSignin: "Go to sign in →",
    alreadyTag: "/ ALREADY VERIFIED",
    alreadyBody: "This account was already activated.",
    signin: "Sign in →",
    validBody: "Click below to activate your KalkMate account.",
    activating: "ACTIVATING...",
    confirmEmail: "CONFIRM EMAIL",
    doneTag: "/ ACCOUNT ACTIVE",
    doneBody: "Your account is active. You can sign in now.",
  },
  de: {
    noToken: "Kein Token im Link",
    invalidLink: "Ungültiger Link",
    networkError: "Netzwerkfehler",
    genericFail: "Etwas ist schiefgelaufen",
    eyebrowStep: "[ 04 ] · Verifizierung",
    asideHeading1: "Ein ",
    asideHeadingItalic: "Klick",
    asideHeading2: ".",
    asideBody:
      "Bestätige deine E-Mail, um dein Konto zu aktivieren. Ohne Verifizierung kannst du dich nicht anmelden und keine Bestellung aufgeben.",
    panelEyebrow: "E-Mail-Verifizierung",
    panelTag: "/VERIFY",
    headingPre: "Bestätige deine ",
    headingEmail: "E-Mail",
    headingDot: ".",
    checking: "LINK WIRD GEPRÜFT...",
    invalidTag: "/ LINK UNGÜLTIG",
    goToSignin: "Zur Anmeldung →",
    alreadyTag: "/ BEREITS VERIFIZIERT",
    alreadyBody: "Dieses Konto wurde bereits aktiviert.",
    signin: "Anmelden →",
    validBody: "Klicke unten, um dein KalkMate-Konto zu aktivieren.",
    activating: "AKTIVIERE...",
    confirmEmail: "E-MAIL BESTÄTIGEN",
    doneTag: "/ KONTO AKTIV",
    doneBody: "Dein Konto ist aktiv. Du kannst dich jetzt anmelden.",
  },
};

function VerifyInner() {
  const { lang, setLang } = usePanelLang();
  const t = DICT[lang];
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<"checking" | "valid" | "invalid" | "done" | "already">("checking");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); setError(t.noToken); return; }
    (async () => {
      try {
        const r = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
        const j = await r.json();
        if (j.alreadyVerified) { setState("already"); return; }
        if (!j.valid) { setState("invalid"); setError(j.error || t.invalidLink); return; }
        setState("valid");
      } catch {
        setState("invalid"); setError(t.networkError);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const confirm = async () => {
    setSubmitting(true);
    try {
      const r = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const j = await r.json();
      if (j.ok) setState("done");
      else { setState("invalid"); setError(j.error || t.genericFail); }
    } catch {
      setError(t.networkError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F2EDE3] flex">
      <div className="hidden lg:flex lg:w-1/2 relative border-r border-[rgba(242,237,227,0.10)] flex-col justify-between p-10 xl:p-14 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none -z-0">
          <div className="absolute -top-32 -left-20 w-[520px] h-[520px] rounded-full bg-[#D8FF3D] opacity-[0.05] blur-[140px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[420px] h-[420px] rounded-full bg-[#FF4D2E] opacity-[0.04] blur-[120px]" />
        </div>
        <div className="relative z-10 flex items-center justify-between">
          <Link href="/" className="km-display text-[28px] leading-none">Kalk<span className="italic text-[#D8FF3D]">Mate</span></Link>
          <span className="km-mono-eyebrow text-[#F2EDE3]/40">/AUTH</span>
        </div>
        <div className="relative z-10">
          <p className="km-mono-eyebrow text-[#D8FF3D]">{t.eyebrowStep}</p>
          <h2 className="km-display text-[clamp(48px,5.4vw,84px)] mt-6">
            {t.asideHeading1}<span className="italic">{t.asideHeadingItalic}</span>{t.asideHeading2}
          </h2>
          <p className="mt-6 text-[15px] leading-[1.6] text-[#F2EDE3]/65 max-w-md">
            {t.asideBody}
          </p>
        </div>
        <div />
      </div>

      <div className="flex-1 flex items-center justify-center p-6 lg:p-10 relative">
        <div className="absolute top-6 right-6 z-20">
          <PanelLangSwitcher lang={lang} setLang={setLang} />
        </div>
        <div className="w-full max-w-md relative">
          <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-l border-t border-[#D8FF3D]" />
          <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-r border-t border-[#D8FF3D]" />
          <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-l border-b border-[#D8FF3D]" />
          <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-r border-b border-[#D8FF3D]" />

          <div className="border border-[rgba(242,237,227,0.18)] bg-[#0B0B0B] p-6 lg:p-8">
            <Link href="/" className="lg:hidden inline-flex items-center gap-2 mb-6">
              <span className="km-display text-2xl">Kalk<span className="italic text-[#D8FF3D]">Mate</span></span>
            </Link>

            <div className="flex items-center justify-between border-b border-[rgba(242,237,227,0.10)] pb-4">
              <span className="km-mono-eyebrow text-[#D8FF3D] flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full km-blink" />
                {t.panelEyebrow}
              </span>
              <span className="km-mono-eyebrow text-[#F2EDE3]/40">{t.panelTag}</span>
            </div>

            <h1 className="km-display text-4xl lg:text-5xl mt-6 leading-[0.95]">
              {t.headingPre}<span className="italic text-[#D8FF3D]">{t.headingEmail}</span>{t.headingDot}
            </h1>

            {state === "checking" && (
              <p className="mt-6 km-mono-eyebrow text-[#F2EDE3]/55">{t.checking}</p>
            )}

            {state === "invalid" && (
              <>
                <div className="mt-6 border border-[#FF4D2E]/40 bg-[#FF4D2E]/[0.06] p-4">
                  <p className="km-mono-eyebrow text-[#FF4D2E]">{t.invalidTag}</p>
                  <p className="text-sm text-[#FF4D2E]/90 mt-2">{error}</p>
                </div>
                <div className="mt-6 pt-4 border-t border-[rgba(242,237,227,0.10)] text-center">
                  <Link href="/auth/signin" className="km-mono-eyebrow text-[#D8FF3D] hover:text-[#F2EDE3] transition-colors">
                    {t.goToSignin}
                  </Link>
                </div>
              </>
            )}

            {state === "already" && (
              <>
                <div className="mt-6 border border-[#D8FF3D]/40 bg-[#D8FF3D]/[0.05] p-4">
                  <p className="km-mono-eyebrow text-[#D8FF3D]">{t.alreadyTag}</p>
                  <p className="text-sm text-[#F2EDE3]/80 mt-2">{t.alreadyBody}</p>
                </div>
                <div className="mt-6 text-center">
                  <Link href="/auth/signin" className="km-mono-eyebrow text-[#D8FF3D] hover:text-[#F2EDE3] transition-colors">
                    {t.signin}
                  </Link>
                </div>
              </>
            )}

            {state === "valid" && (
              <>
                <p className="mt-3 text-[14.5px] text-[#F2EDE3]/55">
                  {t.validBody}
                </p>
                <button
                  onClick={confirm}
                  disabled={submitting}
                  className={`mt-6 w-full px-5 py-4 km-mono-eyebrow flex items-center justify-between transition-colors ${
                    submitting
                      ? "bg-[#D8FF3D]/30 text-[#0B0B0B]/50 cursor-not-allowed"
                      : "bg-[#D8FF3D] text-[#0B0B0B] hover:bg-[#F2EDE3]"
                  }`}
                >
                  <span>{submitting ? t.activating : t.confirmEmail}</span>
                  <span>→</span>
                </button>
              </>
            )}

            {state === "done" && (
              <>
                <div className="mt-6 border border-[#D8FF3D]/40 bg-[#D8FF3D]/[0.05] p-4">
                  <p className="km-mono-eyebrow text-[#D8FF3D]">{t.doneTag}</p>
                  <p className="text-sm text-[#F2EDE3]/80 mt-2">
                    {t.doneBody}
                  </p>
                </div>
                <div className="mt-6 text-center">
                  <Link href="/auth/signin" className="km-mono-eyebrow text-[#D8FF3D] hover:text-[#F2EDE3] transition-colors">
                    {t.signin}
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center"><p className="km-mono-eyebrow text-[#F2EDE3]/55">ŁADOWANIE...</p></div>}>
      <VerifyInner />
    </Suspense>
  );
}
