"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { type Locale } from "@/lib/i18n";
import { usePanelLang } from "@/lib/usePanelLang";
import PanelLangSwitcher from "@/components/PanelLangSwitcher";
import { recallCallback } from "@/app/auth/callback";

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
  cs: {
    noToken: "V odkazu chybí token",
    invalidLink: "Neplatný odkaz",
    networkError: "Chyba sítě",
    genericFail: "Nepodařilo se",
    eyebrowStep: "[ 04 ] · Ověření",
    asideHeading1: "Jedno ",
    asideHeadingItalic: "kliknutí",
    asideHeading2: ".",
    asideBody:
      "Potvrď svůj e-mail a aktivuj si účet. Bez ověření se nepřihlásíš ani neodešleš objednávku.",
    panelEyebrow: "Ověření e-mailu",
    panelTag: "/VERIFY",
    headingPre: "Potvrď svůj ",
    headingEmail: "e-mail",
    headingDot: ".",
    checking: "OVĚŘUJI ODKAZ...",
    invalidTag: "/ NEPLATNÝ ODKAZ",
    goToSignin: "Přejít na přihlášení →",
    alreadyTag: "/ JIŽ OVĚŘENO",
    alreadyBody: "Tento účet už byl aktivován.",
    signin: "Přihlásit se →",
    validBody: "Kliknutím níže aktivuješ svůj účet KalkMate.",
    activating: "AKTIVUJI...",
    confirmEmail: "POTVRDIT E-MAIL",
    doneTag: "/ ÚČET AKTIVNÍ",
    doneBody: "Tvůj účet je aktivní. Teď se můžeš přihlásit.",
  },
  sk: {
    noToken: "V odkaze chýba token",
    invalidLink: "Neplatný odkaz",
    networkError: "Chyba siete",
    genericFail: "Nepodarilo sa",
    eyebrowStep: "[ 04 ] · Overenie",
    asideHeading1: "Jedno ",
    asideHeadingItalic: "kliknutie",
    asideHeading2: ".",
    asideBody:
      "Potvrď svoj e-mail a aktivuj účet. Bez overenia sa neprihlásiš ani neodošleš objednávku.",
    panelEyebrow: "Overenie e-mailu",
    panelTag: "/VERIFY",
    headingPre: "Potvrď ",
    headingEmail: "e-mail",
    headingDot: ".",
    checking: "OVERUJEM ODKAZ...",
    invalidTag: "/ NEPLATNÝ ODKAZ",
    goToSignin: "Prejsť na prihlásenie →",
    alreadyTag: "/ UŽ OVERENÉ",
    alreadyBody: "Tento účet už bol aktivovaný.",
    signin: "Prihlásiť sa →",
    validBody: "Kliknutím nižšie aktivuješ svoj účet KalkMate.",
    activating: "AKTIVUJEM...",
    confirmEmail: "POTVRDIŤ E-MAIL",
    doneTag: "/ ÚČET AKTÍVNY",
    doneBody: "Tvoj účet je aktívny. Teraz sa môžeš prihlásiť.",
  },
  lt: {
    noToken: "Nuorodoje nėra prieigos rakto",
    invalidLink: "Neteisinga nuoroda",
    networkError: "Tinklo klaida",
    genericFail: "Nepavyko",
    eyebrowStep: "[ 04 ] · Patvirtinimas",
    asideHeading1: "Vienas ",
    asideHeadingItalic: "paspaudimas",
    asideHeading2: ".",
    asideBody:
      "Patvirtink el. paštą, kad aktyvuotum paskyrą. Be patvirtinimo negalėsi prisijungti ir pateikti užsakymo.",
    panelEyebrow: "El. pašto patvirtinimas",
    panelTag: "/VERIFY",
    headingPre: "Patvirtink ",
    headingEmail: "el. paštą",
    headingDot: ".",
    checking: "TIKRINAMA NUORODA...",
    invalidTag: "/ NUORODA NEGALIOJA",
    goToSignin: "Eiti į prisijungimą →",
    alreadyTag: "/ JAU PATVIRTINTA",
    alreadyBody: "Ši paskyra jau buvo aktyvuota.",
    signin: "Prisijungti →",
    validBody: "Paspausk žemiau, kad aktyvuotum savo KalkMate paskyrą.",
    activating: "AKTYVUOJAMA...",
    confirmEmail: "PATVIRTINTI EL. PAŠTĄ",
    doneTag: "/ PASKYRA AKTYVI",
    doneBody: "Tavo paskyra aktyvi. Dabar gali prisijungti.",
  },
  be: {
    noToken: "У спасылцы няма токена",
    invalidLink: "Несапраўдная спасылка",
    networkError: "Памылка сеткі",
    genericFail: "Не ўдалося",
    eyebrowStep: "[ 04 ] · Пацвярджэнне",
    asideHeading1: "Адзін ",
    asideHeadingItalic: "клік",
    asideHeading2: ".",
    asideBody:
      "Пацвердзі свой email, каб актываваць акаўнт. Без пацвярджэння не атрымаецца ўвайсці або зрабіць заказ.",
    panelEyebrow: "Пацвярджэнне email",
    panelTag: "/VERIFY",
    headingPre: "Пацвердзі ",
    headingEmail: "email",
    headingDot: ".",
    checking: "ПРАВЯРАЮ СПАСЫЛКУ...",
    invalidTag: "/ СПАСЫЛКА НЕСАПРАЎДНАЯ",
    goToSignin: "Перайсці да ўваходу →",
    alreadyTag: "/ УЖО ПАЦВЕРДЖАНА",
    alreadyBody: "Гэты акаўнт ужо быў актываваны.",
    signin: "Увайсці →",
    validBody: "Націсні ніжэй, каб актываваць свой акаўнт KalkMate.",
    activating: "АКТЫВУЮ...",
    confirmEmail: "ПАЦВЕРДЗІЦЬ EMAIL",
    doneTag: "/ АКАЎНТ АКТЫЎНЫ",
    doneBody: "Твой акаўнт актыўны. Цяпер можаш увайсці.",
  },
  es: {
    noToken: "Falta el token en el enlace",
    invalidLink: "Enlace no válido",
    networkError: "Error de red",
    genericFail: "No se ha podido completar",
    eyebrowStep: "[ 04 ] · Verificación",
    asideHeading1: "Un solo ",
    asideHeadingItalic: "clic",
    asideHeading2: ".",
    asideBody:
      "Confirma tu email para activar la cuenta. Sin verificación no podrás iniciar sesión ni hacer pedidos.",
    panelEyebrow: "Verificación del email",
    panelTag: "/VERIFY",
    headingPre: "Confirma tu ",
    headingEmail: "email",
    headingDot: ".",
    checking: "COMPROBANDO ENLACE...",
    invalidTag: "/ ENLACE NO VÁLIDO",
    goToSignin: "Ir a iniciar sesión →",
    alreadyTag: "/ YA VERIFICADO",
    alreadyBody: "Esta cuenta ya estaba activada.",
    signin: "Iniciar sesión →",
    validBody: "Haz clic abajo para activar tu cuenta KalkMate.",
    activating: "ACTIVANDO...",
    confirmEmail: "CONFIRMAR EMAIL",
    doneTag: "/ CUENTA ACTIVA",
    doneBody: "Tu cuenta está activa. Ya puedes iniciar sesión.",
  },
  pt: {
    noToken: "A ligação não contém token",
    invalidLink: "Ligação inválida",
    networkError: "Erro de rede",
    genericFail: "Não foi possível concluir",
    eyebrowStep: "[ 04 ] · Verificação",
    asideHeading1: "Um só ",
    asideHeadingItalic: "clique",
    asideHeading2: ".",
    asideBody:
      "Confirma o teu email para ativar a conta. Sem verificação não consegues iniciar sessão nem fazer encomendas.",
    panelEyebrow: "Verificação do email",
    panelTag: "/VERIFY",
    headingPre: "Confirma o teu ",
    headingEmail: "email",
    headingDot: ".",
    checking: "A VERIFICAR A LIGAÇÃO...",
    invalidTag: "/ LIGAÇÃO INVÁLIDA",
    goToSignin: "Ir para o início de sessão →",
    alreadyTag: "/ JÁ VERIFICADO",
    alreadyBody: "Esta conta já tinha sido ativada.",
    signin: "Iniciar sessão →",
    validBody: "Clica abaixo para ativar a tua conta KalkMate.",
    activating: "A ATIVAR...",
    confirmEmail: "CONFIRMAR EMAIL",
    doneTag: "/ CONTA ATIVA",
    doneBody: "A tua conta está ativa. Já podes iniciar sessão.",
  },
  fr: {
    noToken: "Le lien ne contient pas de jeton",
    invalidLink: "Lien invalide",
    networkError: "Erreur réseau",
    genericFail: "Échec",
    eyebrowStep: "[ 04 ] · Vérification",
    asideHeading1: "Un seul ",
    asideHeadingItalic: "clic",
    asideHeading2: ".",
    asideBody:
      "Confirme ton email pour activer ton compte. Sans vérification, tu ne pourras ni te connecter ni passer commande.",
    panelEyebrow: "Vérification de l'email",
    panelTag: "/VERIFY",
    headingPre: "Confirme ton ",
    headingEmail: "email",
    headingDot: ".",
    checking: "VÉRIFICATION DU LIEN...",
    invalidTag: "/ LIEN INVALIDE",
    goToSignin: "Aller à la connexion →",
    alreadyTag: "/ DÉJÀ VÉRIFIÉ",
    alreadyBody: "Ce compte a déjà été activé.",
    signin: "Se connecter →",
    validBody: "Clique ci-dessous pour activer ton compte KalkMate.",
    activating: "ACTIVATION...",
    confirmEmail: "CONFIRMER L'EMAIL",
    doneTag: "/ COMPTE ACTIF",
    doneBody: "Ton compte est actif. Tu peux maintenant te connecter.",
  },
  it: {
    noToken: "Token mancante nel link",
    invalidLink: "Link non valido",
    networkError: "Errore di rete",
    genericFail: "Operazione non riuscita",
    eyebrowStep: "[ 04 ] · Verifica",
    asideHeading1: "Un solo ",
    asideHeadingItalic: "clic",
    asideHeading2: ".",
    asideBody:
      "Conferma la tua email per attivare l'account. Senza verifica non puoi accedere né effettuare ordini.",
    panelEyebrow: "Verifica email",
    panelTag: "/VERIFY",
    headingPre: "Conferma la tua ",
    headingEmail: "email",
    headingDot: ".",
    checking: "VERIFICA DEL LINK...",
    invalidTag: "/ LINK NON VALIDO",
    goToSignin: "Vai all'accesso →",
    alreadyTag: "/ GIÀ VERIFICATO",
    alreadyBody: "Questo account era già stato attivato.",
    signin: "Accedi →",
    validBody: "Clicca qui sotto per attivare il tuo account KalkMate.",
    activating: "ATTIVAZIONE...",
    confirmEmail: "CONFERMA EMAIL",
    doneTag: "/ ACCOUNT ATTIVO",
    doneBody: "Il tuo account è attivo. Ora puoi accedere.",
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
  // Intencja sprzed rejestracji (np. checkout) zapamietana na /auth/signin —
  // link "Zaloguj sie" po weryfikacji wraca tam zamiast na /panel.
  const [signinHref, setSigninHref] = useState("/auth/signin");

  useEffect(() => {
    const cb = recallCallback();
    if (cb) setSigninHref(`/auth/signin?callbackUrl=${encodeURIComponent(cb)}`);
  }, []);

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
                  <Link href={signinHref} className="km-mono-eyebrow text-[#D8FF3D] hover:text-[#F2EDE3] transition-colors">
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
                  <Link href={signinHref} className="km-mono-eyebrow text-[#D8FF3D] hover:text-[#F2EDE3] transition-colors">
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
                  <Link href={signinHref} className="km-mono-eyebrow text-[#D8FF3D] hover:text-[#F2EDE3] transition-colors">
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
