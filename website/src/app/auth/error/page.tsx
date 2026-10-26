"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { type Locale } from "@/lib/i18n";
import { usePanelLang } from "@/lib/usePanelLang";
import PanelLangSwitcher from "@/components/PanelLangSwitcher";

const DICT: Record<
  Locale,
  {
    errorMessages: Record<string, string>;
    eyebrowError: string;
    headingPart1: string;
    headingEmphasis: string;
    headingPart2: string;
    tryAgain: string;
    home: string;
  }
> = {
  pl: {
    errorMessages: {
      Configuration: "Problem z konfiguracją serwera.",
      AccessDenied: "Dostęp został odrzucony.",
      Verification: "Link weryfikacyjny wygasł lub jest nieprawidłowy.",
      Default: "Wystąpił nieoczekiwany błąd podczas logowania.",
    },
    eyebrowError: "Błąd",
    headingPart1: "Coś ",
    headingEmphasis: "poszło",
    headingPart2: " nie tak.",
    tryAgain: "Spróbuj ponownie",
    home: "← Strona główna",
  },
  en: {
    errorMessages: {
      Configuration: "There is a problem with the server configuration.",
      AccessDenied: "Access was denied.",
      Verification: "The verification link has expired or is invalid.",
      Default: "An unexpected error occurred during sign-in.",
    },
    eyebrowError: "Error",
    headingPart1: "Something ",
    headingEmphasis: "went",
    headingPart2: " wrong.",
    tryAgain: "Try again",
    home: "← Home",
  },
  de: {
    errorMessages: {
      Configuration: "Es gibt ein Problem mit der Serverkonfiguration.",
      AccessDenied: "Zugriff verweigert.",
      Verification: "Der Bestätigungslink ist abgelaufen oder ungültig.",
      Default: "Bei der Anmeldung ist ein unerwarteter Fehler aufgetreten.",
    },
    eyebrowError: "Fehler",
    headingPart1: "Etwas ist ",
    headingEmphasis: "schiefgelaufen",
    headingPart2: ".",
    tryAgain: "Erneut versuchen",
    home: "← Startseite",
  },
  cs: {
    errorMessages: {
      Configuration: "Problém s konfigurací serveru.",
      AccessDenied: "Přístup byl odepřen.",
      Verification: "Ověřovací odkaz vypršel nebo je neplatný.",
      Default: "Při přihlašování došlo k neočekávané chybě.",
    },
    eyebrowError: "Chyba",
    headingPart1: "Něco se ",
    headingEmphasis: "pokazilo",
    headingPart2: ".",
    tryAgain: "Zkusit znovu",
    home: "← Hlavní stránka",
  },
  sk: {
    errorMessages: {
      Configuration: "Problém s konfiguráciou servera.",
      AccessDenied: "Prístup bol zamietnutý.",
      Verification: "Overovací odkaz vypršal alebo je neplatný.",
      Default: "Pri prihlasovaní nastala neočakávaná chyba.",
    },
    eyebrowError: "Chyba",
    headingPart1: "Niečo sa ",
    headingEmphasis: "pokazilo",
    headingPart2: ".",
    tryAgain: "Skúsiť znova",
    home: "← Hlavná stránka",
  },
  lt: {
    errorMessages: {
      Configuration: "Serverio konfigūracijos klaida.",
      AccessDenied: "Prieiga atmesta.",
      Verification: "Patvirtinimo nuoroda nebegalioja arba yra neteisinga.",
      Default: "Prisijungiant įvyko netikėta klaida.",
    },
    eyebrowError: "Klaida",
    headingPart1: "Kažkas ",
    headingEmphasis: "nepavyko",
    headingPart2: ".",
    tryAgain: "Bandyti dar kartą",
    home: "← Pagrindinis puslapis",
  },
  be: {
    errorMessages: {
      Configuration: "Праблема з канфігурацыяй сервера.",
      AccessDenied: "Доступ адхілены.",
      Verification: "Спасылка для пацвярджэння пратэрмінавана або несапраўдная.",
      Default: "Падчас уваходу адбылася нечаканая памылка.",
    },
    eyebrowError: "Памылка",
    headingPart1: "Нешта ",
    headingEmphasis: "пайшло",
    headingPart2: " не так.",
    tryAgain: "Паспрабаваць зноў",
    home: "← Галоўная старонка",
  },
  es: {
    errorMessages: {
      Configuration: "Hay un problema con la configuración del servidor.",
      AccessDenied: "Se ha denegado el acceso.",
      Verification: "El enlace de verificación ha caducado o no es válido.",
      Default: "Se ha producido un error inesperado al iniciar sesión.",
    },
    eyebrowError: "Error",
    headingPart1: "Algo ",
    headingEmphasis: "ha salido",
    headingPart2: " mal.",
    tryAgain: "Intentar de nuevo",
    home: "← Inicio",
  },
  pt: {
    errorMessages: {
      Configuration: "Há um problema com a configuração do servidor.",
      AccessDenied: "O acesso foi negado.",
      Verification: "A ligação de verificação expirou ou é inválida.",
      Default: "Ocorreu um erro inesperado ao iniciar sessão.",
    },
    eyebrowError: "Erro",
    headingPart1: "Algo ",
    headingEmphasis: "correu",
    headingPart2: " mal.",
    tryAgain: "Tentar novamente",
    home: "← Página inicial",
  },
  fr: {
    errorMessages: {
      Configuration: "Problème de configuration du serveur.",
      AccessDenied: "L'accès a été refusé.",
      Verification: "Le lien de vérification a expiré ou n'est pas valide.",
      Default: "Une erreur inattendue s'est produite lors de la connexion.",
    },
    eyebrowError: "Erreur",
    headingPart1: "Quelque chose ",
    headingEmphasis: "s'est mal",
    headingPart2: " passé.",
    tryAgain: "Réessayer",
    home: "← Accueil",
  },
  it: {
    errorMessages: {
      Configuration: "Problema con la configurazione del server.",
      AccessDenied: "Accesso negato.",
      Verification: "Il link di verifica è scaduto o non è valido.",
      Default: "Si è verificato un errore imprevisto durante l'accesso.",
    },
    eyebrowError: "Errore",
    headingPart1: "Qualcosa ",
    headingEmphasis: "è andato",
    headingPart2: " storto.",
    tryAgain: "Riprova",
    home: "← Home page",
  },
};

function ErrorContent() {
  const { lang, setLang } = usePanelLang();
  const t = DICT[lang];
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorMessages = t.errorMessages;

  const message = error && errorMessages[error] ? errorMessages[error] : errorMessages.Default;

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F2EDE3] km-grain flex items-center justify-center p-6">
      <div className="w-full max-w-md relative">
        <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-l border-t border-[#FF4D2E]" />
        <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-r border-t border-[#FF4D2E]" />
        <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-l border-b border-[#FF4D2E]" />
        <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-r border-b border-[#FF4D2E]" />
        <div className="absolute -top-1.5 right-0 -translate-y-full pb-2">
          <PanelLangSwitcher lang={lang} setLang={setLang} />
        </div>
        <div className="border border-[rgba(242,237,227,0.18)] p-8 text-center">
          <div className="flex items-center justify-between border-b border-[rgba(242,237,227,0.10)] pb-4">
            <span className="km-mono-eyebrow text-[#FF4D2E] flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#FF4D2E] rounded-full km-blink" />
              {t.eyebrowError}
            </span>
            <span className="km-mono-eyebrow text-[#F2EDE3]/40">
              /AUTH · ERROR {error ? "· " + error.toUpperCase() : ""}
            </span>
          </div>
          <h1 className="km-display text-4xl mt-6">
            {t.headingPart1}
            <span className="italic text-[#FF4D2E]">{t.headingEmphasis}</span>
            {t.headingPart2}
          </h1>
          <p className="mt-4 text-[14.5px] text-[#F2EDE3]/65">{message}</p>
          <div className="mt-8 flex flex-col gap-3">
            <Link
              href="/auth/signin"
              className="inline-flex items-center justify-between px-5 py-3 km-mono-eyebrow bg-[#D8FF3D] text-[#0B0B0B] hover:bg-[#F2EDE3] transition-colors"
            >
              <span>{t.tryAgain}</span>
              <span>→</span>
            </Link>
            <Link
              href="/"
              className="km-mono-eyebrow text-[#F2EDE3]/45 hover:text-[#F2EDE3] transition-colors"
            >
              {t.home}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center">
          <span className="km-mono-eyebrow text-[#F2EDE3]/55">Ładowanie...</span>
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}
