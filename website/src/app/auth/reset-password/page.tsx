"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { usePanelLang } from "@/lib/usePanelLang";
import PanelLangSwitcher from "@/components/PanelLangSwitcher";
import { type Locale } from "@/lib/i18n";

const inputClass =
  "w-full bg-transparent border border-[rgba(242,237,227,0.18)] text-[#F2EDE3] placeholder-[#F2EDE3]/30 px-4 py-3.5 focus:outline-none focus:border-[#D8FF3D] transition-colors km-mono-eyebrow text-[13px]";

const DICT: Record<
  Locale,
  {
    auth: string;
    brandEyebrow: string;
    brandHeading1: string;
    brandHeading2: string;
    brandSub: string;
    statHashLabel: string;
    statTransportLabel: string;
    statLogsLabel: string;
    reset: string;
    newPassword: string;
    setNewHeading1: string;
    setNewHeading2: string;
    checkingLink: string;
    linkInvalidEyebrow: string;
    sendNewLink: string;
    passwordChangedEyebrow: string;
    passwordChangedBody: string;
    intro: string;
    errorEyebrow: string;
    newPasswordLabel: string;
    repeatPasswordLabel: string;
    submitting: string;
    submit: string;
    footer: string;
    noToken: string;
    invalidLink: string;
    networkError: string;
    somethingWrong: string;
    minLength: string;
    passwordsDiffer: string;
  }
> = {
  pl: {
    auth: "/AUTH",
    brandEyebrow: "[ 03 ] · Nowe hasło",
    brandHeading1: "Zabezpiecz",
    brandHeading2: "konto",
    brandSub:
      "Wybierz mocne hasło. Min. 6 znaków, ale my polecamy więcej — kombinacja liter, cyfr i znaków specjalnych.",
    statHashLabel: "Hashowanie",
    statTransportLabel: "Transport",
    statLogsLabel: "Logów haseł",
    reset: "/RESET",
    newPassword: "Nowe hasło",
    setNewHeading1: "Ustaw",
    setNewHeading2: "nowe",
    checkingLink: "SPRAWDZAM LINK...",
    linkInvalidEyebrow: "/ LINK NIEWAŻNY",
    sendNewLink: "Wyślij nowy link →",
    passwordChangedEyebrow: "/ HASŁO ZMIENIONE",
    passwordChangedBody:
      "Twoje hasło zostało zmienione. Przekierowuję do logowania...",
    intro:
      "Min. 6 znaków. Polecamy mieszankę liter, cyfr i znaków specjalnych.",
    errorEyebrow: "/ ERROR",
    newPasswordLabel: "Nowe hasło",
    repeatPasswordLabel: "Powtórz hasło",
    submitting: "Zapisuję...",
    submit: "Ustaw hasło",
    footer: "KalkMate · Kalkulator z AI",
    noToken: "Brak tokenu w linku",
    invalidLink: "Link nieprawidłowy",
    networkError: "Błąd sieci",
    somethingWrong: "Coś poszło nie tak",
    minLength: "Hasło musi mieć min. 6 znaków",
    passwordsDiffer: "Hasła się różnią",
  },
  en: {
    auth: "/AUTH",
    brandEyebrow: "[ 03 ] · New password",
    brandHeading1: "Secure your",
    brandHeading2: "account",
    brandSub:
      "Pick a strong password. Min. 6 characters, but we recommend more — a mix of letters, numbers and special characters.",
    statHashLabel: "Hashing",
    statTransportLabel: "Transport",
    statLogsLabel: "Password logs",
    reset: "/RESET",
    newPassword: "New password",
    setNewHeading1: "Set a",
    setNewHeading2: "new one",
    checkingLink: "CHECKING LINK...",
    linkInvalidEyebrow: "/ LINK INVALID",
    sendNewLink: "Send a new link →",
    passwordChangedEyebrow: "/ PASSWORD CHANGED",
    passwordChangedBody:
      "Your password has been changed. Redirecting to sign in...",
    intro:
      "Min. 6 characters. We recommend a mix of letters, numbers and special characters.",
    errorEyebrow: "/ ERROR",
    newPasswordLabel: "New password",
    repeatPasswordLabel: "Repeat password",
    submitting: "Saving...",
    submit: "Set password",
    footer: "KalkMate · AI-powered calculator",
    noToken: "No token in the link",
    invalidLink: "Invalid link",
    networkError: "Network error",
    somethingWrong: "Something went wrong",
    minLength: "Password must be at least 6 characters",
    passwordsDiffer: "Passwords do not match",
  },
  de: {
    auth: "/AUTH",
    brandEyebrow: "[ 03 ] · Neues Passwort",
    brandHeading1: "Sichere dein",
    brandHeading2: "Konto",
    brandSub:
      "Wähle ein starkes Passwort. Mind. 6 Zeichen, wir empfehlen aber mehr — eine Kombination aus Buchstaben, Zahlen und Sonderzeichen.",
    statHashLabel: "Hashing",
    statTransportLabel: "Transport",
    statLogsLabel: "Passwort-Logs",
    reset: "/RESET",
    newPassword: "Neues Passwort",
    setNewHeading1: "Lege ein",
    setNewHeading2: "neues fest",
    checkingLink: "LINK WIRD GEPRÜFT...",
    linkInvalidEyebrow: "/ LINK UNGÜLTIG",
    sendNewLink: "Neuen Link senden →",
    passwordChangedEyebrow: "/ PASSWORT GEÄNDERT",
    passwordChangedBody:
      "Dein Passwort wurde geändert. Weiterleitung zur Anmeldung...",
    intro:
      "Mind. 6 Zeichen. Wir empfehlen eine Mischung aus Buchstaben, Zahlen und Sonderzeichen.",
    errorEyebrow: "/ ERROR",
    newPasswordLabel: "Neues Passwort",
    repeatPasswordLabel: "Passwort wiederholen",
    submitting: "Speichern...",
    submit: "Passwort festlegen",
    footer: "KalkMate · KI-Taschenrechner",
    noToken: "Kein Token im Link",
    invalidLink: "Ungültiger Link",
    networkError: "Netzwerkfehler",
    somethingWrong: "Etwas ist schiefgelaufen",
    minLength: "Das Passwort muss mindestens 6 Zeichen lang sein",
    passwordsDiffer: "Die Passwörter stimmen nicht überein",
  },
  cs: {
    auth: "/AUTH",
    brandEyebrow: "[ 03 ] · Nové heslo",
    brandHeading1: "Zabezpeč svůj",
    brandHeading2: "účet",
    brandSub:
      "Zvol silné heslo. Min. 6 znaků, ale doporučujeme víc — kombinaci písmen, číslic a speciálních znaků.",
    statHashLabel: "Hashování",
    statTransportLabel: "Přenos",
    statLogsLabel: "Logů hesel",
    reset: "/RESET",
    newPassword: "Nové heslo",
    setNewHeading1: "Nastav",
    setNewHeading2: "nové",
    checkingLink: "OVĚŘUJI ODKAZ...",
    linkInvalidEyebrow: "/ NEPLATNÝ ODKAZ",
    sendNewLink: "Poslat nový odkaz →",
    passwordChangedEyebrow: "/ HESLO ZMĚNĚNO",
    passwordChangedBody:
      "Tvoje heslo bylo změněno. Přesměrovávám na přihlášení...",
    intro:
      "Min. 6 znaků. Doporučujeme kombinaci písmen, číslic a speciálních znaků.",
    errorEyebrow: "/ ERROR",
    newPasswordLabel: "Nové heslo",
    repeatPasswordLabel: "Zopakuj heslo",
    submitting: "Ukládám...",
    submit: "Nastavit heslo",
    footer: "KalkMate · Kalkulačka s AI",
    noToken: "V odkazu chybí token",
    invalidLink: "Neplatný odkaz",
    networkError: "Chyba sítě",
    somethingWrong: "Něco se pokazilo",
    minLength: "Heslo musí mít alespoň 6 znaků",
    passwordsDiffer: "Hesla se neshodují",
  },
  sk: {
    auth: "/AUTH",
    brandEyebrow: "[ 03 ] · Nové heslo",
    brandHeading1: "Zabezpeč svoj",
    brandHeading2: "účet",
    brandSub:
      "Zvoľ silné heslo. Min. 6 znakov, ale odporúčame viac — kombináciu písmen, číslic a špeciálnych znakov.",
    statHashLabel: "Hashovanie",
    statTransportLabel: "Prenos",
    statLogsLabel: "Logov hesiel",
    reset: "/RESET",
    newPassword: "Nové heslo",
    setNewHeading1: "Nastav",
    setNewHeading2: "nové",
    checkingLink: "OVERUJEM ODKAZ...",
    linkInvalidEyebrow: "/ NEPLATNÝ ODKAZ",
    sendNewLink: "Poslať nový odkaz →",
    passwordChangedEyebrow: "/ HESLO ZMENENÉ",
    passwordChangedBody:
      "Tvoje heslo bolo zmenené. Presmerúvam na prihlásenie...",
    intro:
      "Min. 6 znakov. Odporúčame kombináciu písmen, číslic a špeciálnych znakov.",
    errorEyebrow: "/ CHYBA",
    newPasswordLabel: "Nové heslo",
    repeatPasswordLabel: "Zopakuj heslo",
    submitting: "Ukladám...",
    submit: "Nastaviť heslo",
    footer: "KalkMate · Kalkulačka s AI",
    noToken: "V odkaze chýba token",
    invalidLink: "Neplatný odkaz",
    networkError: "Chyba siete",
    somethingWrong: "Niečo sa pokazilo",
    minLength: "Heslo musí mať aspoň 6 znakov",
    passwordsDiffer: "Heslá sa nezhodujú",
  },
  lt: {
    auth: "/AUTH",
    brandEyebrow: "[ 03 ] · Naujas slaptažodis",
    brandHeading1: "Apsaugok savo",
    brandHeading2: "paskyrą",
    brandSub:
      "Pasirink stiprų slaptažodį. Min. 6 simboliai, bet rekomenduojame daugiau — raidžių, skaičių ir specialiųjų simbolių derinį.",
    statHashLabel: "Maišos funkcija",
    statTransportLabel: "Perdavimas",
    statLogsLabel: "Slaptažodžių žurnalų",
    reset: "/RESET",
    newPassword: "Naujas slaptažodis",
    setNewHeading1: "Nustatyk",
    setNewHeading2: "naują",
    checkingLink: "TIKRINAMA NUORODA...",
    linkInvalidEyebrow: "/ NUORODA NEGALIOJA",
    sendNewLink: "Siųsti naują nuorodą →",
    passwordChangedEyebrow: "/ SLAPTAŽODIS PAKEISTAS",
    passwordChangedBody:
      "Tavo slaptažodis pakeistas. Nukreipiama į prisijungimą...",
    intro:
      "Min. 6 simboliai. Rekomenduojame raidžių, skaičių ir specialiųjų simbolių derinį.",
    errorEyebrow: "/ KLAIDA",
    newPasswordLabel: "Naujas slaptažodis",
    repeatPasswordLabel: "Pakartok slaptažodį",
    submitting: "Išsaugoma...",
    submit: "Nustatyti slaptažodį",
    footer: "KalkMate · Skaičiuotuvas su DI",
    noToken: "Nuorodoje nėra prieigos rakto",
    invalidLink: "Neteisinga nuoroda",
    networkError: "Tinklo klaida",
    somethingWrong: "Kažkas nepavyko",
    minLength: "Slaptažodis turi būti bent 6 simbolių",
    passwordsDiffer: "Slaptažodžiai nesutampa",
  },
  be: {
    auth: "/AUTH",
    brandEyebrow: "[ 03 ] · Новы пароль",
    brandHeading1: "Абарані свой",
    brandHeading2: "акаўнт",
    brandSub:
      "Выберы надзейны пароль. Мін. 6 сімвалаў, але раім больш — спалучэнне літар, лічбаў і спецыяльных знакаў.",
    statHashLabel: "Хэшаванне",
    statTransportLabel: "Перадача",
    statLogsLabel: "Логаў пароляў",
    reset: "/RESET",
    newPassword: "Новы пароль",
    setNewHeading1: "Задай",
    setNewHeading2: "новы",
    checkingLink: "ПРАВЯРАЮ СПАСЫЛКУ...",
    linkInvalidEyebrow: "/ СПАСЫЛКА НЕСАПРАЎДНАЯ",
    sendNewLink: "Даслаць новую спасылку →",
    passwordChangedEyebrow: "/ ПАРОЛЬ ЗМЕНЕНЫ",
    passwordChangedBody:
      "Твой пароль зменены. Перанакіроўваю да ўваходу...",
    intro:
      "Мін. 6 сімвалаў. Раім спалучэнне літар, лічбаў і спецыяльных знакаў.",
    errorEyebrow: "/ ПАМЫЛКА",
    newPasswordLabel: "Новы пароль",
    repeatPasswordLabel: "Паўтары пароль",
    submitting: "Захоўваю...",
    submit: "Задаць пароль",
    footer: "KalkMate · Калькулятар з ШІ",
    noToken: "У спасылцы няма токена",
    invalidLink: "Несапраўдная спасылка",
    networkError: "Памылка сеткі",
    somethingWrong: "Нешта пайшло не так",
    minLength: "Пароль павінен мець мінімум 6 сімвалаў",
    passwordsDiffer: "Паролі не супадаюць",
  },
  es: {
    auth: "/AUTH",
    brandEyebrow: "[ 03 ] · Nueva contraseña",
    brandHeading1: "Protege tu",
    brandHeading2: "cuenta",
    brandSub:
      "Elige una contraseña segura. Mín. 6 caracteres, aunque recomendamos más — una mezcla de letras, números y caracteres especiales.",
    statHashLabel: "Hashing",
    statTransportLabel: "Transporte",
    statLogsLabel: "Registros de contraseñas",
    reset: "/RESET",
    newPassword: "Nueva contraseña",
    setNewHeading1: "Crea una",
    setNewHeading2: "nueva",
    checkingLink: "COMPROBANDO ENLACE...",
    linkInvalidEyebrow: "/ ENLACE NO VÁLIDO",
    sendNewLink: "Enviar un nuevo enlace →",
    passwordChangedEyebrow: "/ CONTRASEÑA CAMBIADA",
    passwordChangedBody:
      "Tu contraseña se ha cambiado. Redirigiendo al inicio de sesión...",
    intro:
      "Mín. 6 caracteres. Recomendamos una mezcla de letras, números y caracteres especiales.",
    errorEyebrow: "/ ERROR",
    newPasswordLabel: "Nueva contraseña",
    repeatPasswordLabel: "Repite la contraseña",
    submitting: "Guardando...",
    submit: "Guardar contraseña",
    footer: "KalkMate · Calculadora con IA",
    noToken: "Falta el token en el enlace",
    invalidLink: "Enlace no válido",
    networkError: "Error de red",
    somethingWrong: "Algo ha salido mal",
    minLength: "La contraseña debe tener al menos 6 caracteres",
    passwordsDiffer: "Las contraseñas no coinciden",
  },
  pt: {
    auth: "/AUTH",
    brandEyebrow: "[ 03 ] · Nova palavra-passe",
    brandHeading1: "Protege a tua",
    brandHeading2: "conta",
    brandSub:
      "Escolhe uma palavra-passe forte. Mín. 6 caracteres, mas recomendamos mais — uma mistura de letras, números e caracteres especiais.",
    statHashLabel: "Hashing",
    statTransportLabel: "Transporte",
    statLogsLabel: "Registos de palavras-passe",
    reset: "/RESET",
    newPassword: "Nova palavra-passe",
    setNewHeading1: "Define uma",
    setNewHeading2: "nova",
    checkingLink: "A VERIFICAR A LIGAÇÃO...",
    linkInvalidEyebrow: "/ LIGAÇÃO INVÁLIDA",
    sendNewLink: "Enviar nova ligação →",
    passwordChangedEyebrow: "/ PALAVRA-PASSE ALTERADA",
    passwordChangedBody:
      "A tua palavra-passe foi alterada. A redirecionar para o início de sessão...",
    intro:
      "Mín. 6 caracteres. Recomendamos uma mistura de letras, números e caracteres especiais.",
    errorEyebrow: "/ ERRO",
    newPasswordLabel: "Nova palavra-passe",
    repeatPasswordLabel: "Repete a palavra-passe",
    submitting: "A guardar...",
    submit: "Definir palavra-passe",
    footer: "KalkMate · Calculadora com IA",
    noToken: "A ligação não contém token",
    invalidLink: "Ligação inválida",
    networkError: "Erro de rede",
    somethingWrong: "Algo correu mal",
    minLength: "A palavra-passe deve ter pelo menos 6 caracteres",
    passwordsDiffer: "As palavras-passe não coincidem",
  },
  fr: {
    auth: "/AUTH",
    brandEyebrow: "[ 03 ] · Nouveau mot de passe",
    brandHeading1: "Sécurise ton",
    brandHeading2: "compte",
    brandSub:
      "Choisis un mot de passe robuste. 6 caractères min., mais nous en conseillons davantage — un mélange de lettres, de chiffres et de caractères spéciaux.",
    statHashLabel: "Hachage",
    statTransportLabel: "Transport",
    statLogsLabel: "Journaux de mots de passe",
    reset: "/RESET",
    newPassword: "Nouveau mot de passe",
    setNewHeading1: "Choisis-en un",
    setNewHeading2: "nouveau",
    checkingLink: "VÉRIFICATION DU LIEN...",
    linkInvalidEyebrow: "/ LIEN INVALIDE",
    sendNewLink: "Envoyer un nouveau lien →",
    passwordChangedEyebrow: "/ MOT DE PASSE MODIFIÉ",
    passwordChangedBody:
      "Ton mot de passe a été modifié. Redirection vers la connexion...",
    intro:
      "6 caractères min. Nous conseillons un mélange de lettres, de chiffres et de caractères spéciaux.",
    errorEyebrow: "/ ERREUR",
    newPasswordLabel: "Nouveau mot de passe",
    repeatPasswordLabel: "Répète le mot de passe",
    submitting: "Enregistrement...",
    submit: "Définir le mot de passe",
    footer: "KalkMate · Calculatrice avec IA",
    noToken: "Le lien ne contient pas de jeton",
    invalidLink: "Lien invalide",
    networkError: "Erreur réseau",
    somethingWrong: "Une erreur s'est produite",
    minLength: "Le mot de passe doit contenir au moins 6 caractères",
    passwordsDiffer: "Les mots de passe ne correspondent pas",
  },
  it: {
    auth: "/AUTH",
    brandEyebrow: "[ 03 ] · Nuova password",
    brandHeading1: "Proteggi il tuo",
    brandHeading2: "account",
    brandSub:
      "Scegli una password robusta. Min. 6 caratteri, ma ne consigliamo di più — un mix di lettere, numeri e caratteri speciali.",
    statHashLabel: "Hashing",
    statTransportLabel: "Trasporto",
    statLogsLabel: "Log delle password",
    reset: "/RESET",
    newPassword: "Nuova password",
    setNewHeading1: "Impostane una",
    setNewHeading2: "nuova",
    checkingLink: "VERIFICA DEL LINK...",
    linkInvalidEyebrow: "/ LINK NON VALIDO",
    sendNewLink: "Invia un nuovo link →",
    passwordChangedEyebrow: "/ PASSWORD MODIFICATA",
    passwordChangedBody:
      "La tua password è stata modificata. Reindirizzamento all'accesso...",
    intro:
      "Min. 6 caratteri. Consigliamo un mix di lettere, numeri e caratteri speciali.",
    errorEyebrow: "/ ERRORE",
    newPasswordLabel: "Nuova password",
    repeatPasswordLabel: "Ripeti la password",
    submitting: "Salvataggio...",
    submit: "Imposta password",
    footer: "KalkMate · Calcolatrice con IA",
    noToken: "Token mancante nel link",
    invalidLink: "Link non valido",
    networkError: "Errore di rete",
    somethingWrong: "Qualcosa è andato storto",
    minLength: "La password deve avere almeno 6 caratteri",
    passwordsDiffer: "Le password non coincidono",
  },
};

function ResetInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";

  const { lang, setLang } = usePanelLang();
  const t = DICT[lang];

  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      setValid(false);
      setTokenError(t.noToken);
      return;
    }
    (async () => {
      try {
        const r = await fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`);
        const j = await r.json();
        setValid(!!j.valid);
        if (!j.valid) setTokenError(j.error || t.invalidLink);
      } catch {
        setValid(false);
        setTokenError(t.networkError);
      } finally {
        setChecking(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError(t.minLength); return; }
    if (password !== confirm) { setError(t.passwordsDiffer); return; }
    setSubmitting(true);
    try {
      const r = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const j = await r.json();
      if (!j.ok) setError(j.error || t.somethingWrong);
      else {
        setDone(true);
        setTimeout(() => router.push("/auth/signin"), 2500);
      }
    } catch {
      setError(t.networkError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 relative border-r border-[rgba(242,237,227,0.10)] flex-col justify-between p-10 xl:p-14 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none -z-0">
          <div className="absolute -top-32 -left-20 w-[520px] h-[520px] rounded-full bg-[#D8FF3D] opacity-[0.05] blur-[140px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[420px] h-[420px] rounded-full bg-[#FF4D2E] opacity-[0.04] blur-[120px]" />
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <Link href="/" className="km-display text-[28px] leading-none">
            Kalk<span className="italic text-[#D8FF3D]">Mate</span>
          </Link>
          <span className="km-mono-eyebrow text-[#F2EDE3]/40">{t.auth}</span>
        </div>

        <div className="relative z-10">
          <p className="km-mono-eyebrow text-[#D8FF3D]">{t.brandEyebrow}</p>
          <h2 className="km-display text-[clamp(48px,5.4vw,84px)] mt-6">
            {t.brandHeading1}<br />
            <span className="italic">{t.brandHeading2}</span>.
          </h2>
          <p className="mt-6 text-[15px] leading-[1.6] text-[#F2EDE3]/65 max-w-md">
            {t.brandSub}
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-6">
          <div>
            <p className="km-display text-3xl text-[#F2EDE3]">bcrypt</p>
            <p className="km-mono-eyebrow text-[#F2EDE3]/40 mt-1">{t.statHashLabel}</p>
          </div>
          <div>
            <p className="km-display text-3xl text-[#F2EDE3]">TLS</p>
            <p className="km-mono-eyebrow text-[#F2EDE3]/40 mt-1">{t.statTransportLabel}</p>
          </div>
          <div>
            <p className="km-display text-3xl text-[#F2EDE3]">0</p>
            <p className="km-mono-eyebrow text-[#F2EDE3]/40 mt-1">{t.statLogsLabel}</p>
          </div>
        </div>
      </div>

      {/* Right form */}
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
              <span className="km-display text-2xl">
                Kalk<span className="italic text-[#D8FF3D]">Mate</span>
              </span>
            </Link>

            <div className="flex items-center justify-between border-b border-[rgba(242,237,227,0.10)] pb-4">
              <span className="km-mono-eyebrow text-[#D8FF3D] flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full km-blink" />
                {t.newPassword}
              </span>
              <span className="km-mono-eyebrow text-[#F2EDE3]/40">{t.reset}</span>
            </div>

            <h1 className="km-display text-4xl lg:text-5xl mt-6 leading-[0.95]">
              {t.setNewHeading1} <span className="italic text-[#D8FF3D]">{t.setNewHeading2}</span>.
            </h1>

            {checking ? (
              <p className="mt-6 km-mono-eyebrow text-[#F2EDE3]/55">{t.checkingLink}</p>
            ) : !valid ? (
              <>
                <div className="mt-6 border border-[#FF4D2E]/40 bg-[#FF4D2E]/[0.06] p-4">
                  <p className="km-mono-eyebrow text-[#FF4D2E]">{t.linkInvalidEyebrow}</p>
                  <p className="text-sm text-[#FF4D2E]/90 mt-2">{tokenError}</p>
                </div>
                <div className="mt-6 pt-4 border-t border-[rgba(242,237,227,0.10)] text-center">
                  <Link
                    href="/auth/forgot-password"
                    className="km-mono-eyebrow text-[#D8FF3D] hover:text-[#F2EDE3] transition-colors"
                  >
                    {t.sendNewLink}
                  </Link>
                </div>
              </>
            ) : done ? (
              <div className="mt-6 border border-[#D8FF3D]/40 bg-[#D8FF3D]/[0.05] p-4">
                <p className="km-mono-eyebrow text-[#D8FF3D]">{t.passwordChangedEyebrow}</p>
                <p className="text-sm text-[#F2EDE3]/80 mt-2 leading-relaxed">
                  {t.passwordChangedBody}
                </p>
              </div>
            ) : (
              <>
                <p className="mt-3 text-[14.5px] text-[#F2EDE3]/55">
                  {t.intro}
                </p>

                {error && (
                  <div className="mt-6 border border-[#FF4D2E]/40 bg-[#FF4D2E]/[0.06] p-3">
                    <p className="km-mono-eyebrow text-[#FF4D2E]">{t.errorEyebrow}</p>
                    <p className="text-sm text-[#FF4D2E] mt-1">{error}</p>
                  </div>
                )}

                <form onSubmit={submit} className="mt-6 space-y-5">
                  <div>
                    <label htmlFor="password" className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                      {t.newPasswordLabel}
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoFocus
                      minLength={6}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label htmlFor="confirm" className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                      {t.repeatPasswordLabel}
                    </label>
                    <input
                      id="confirm"
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className={inputClass}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !password || !confirm}
                    className={`group w-full px-5 py-4 km-mono-eyebrow flex items-center justify-between transition-colors ${
                      submitting
                        ? "bg-[#D8FF3D]/30 text-[#0B0B0B]/50 cursor-not-allowed"
                        : "bg-[#D8FF3D] text-[#0B0B0B] hover:bg-[#F2EDE3]"
                    }`}
                  >
                    <span>{submitting ? t.submitting : t.submit}</span>
                    <span>→</span>
                  </button>
                </form>
              </>
            )}
          </div>

          <p className="text-center mt-6 km-mono-eyebrow text-[#F2EDE3]/30">
            {t.footer}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center">
          <p className="km-mono-eyebrow text-[#F2EDE3]/55">ŁADOWANIE...</p>
        </div>
      }
    >
      <ResetInner />
    </Suspense>
  );
}
