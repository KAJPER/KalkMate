"use client";

import { useState } from "react";
import Link from "next/link";
import { type Locale } from "@/lib/i18n";
import { usePanelLang } from "@/lib/usePanelLang";
import PanelLangSwitcher from "@/components/PanelLangSwitcher";

const inputClass =
  "w-full bg-transparent border border-[rgba(242,237,227,0.18)] text-[#F2EDE3] placeholder-[#F2EDE3]/30 px-4 py-3.5 focus:outline-none focus:border-[#D8FF3D] transition-colors km-mono-eyebrow text-[13px]";

const DICT: Record<
  Locale,
  {
    brandEyebrow: string;
    panelStep: string;
    panelHeadlineLine1Prefix: string;
    panelHeadlineLine1Italic: string;
    panelHeadlineLine2: string;
    panelSubtitle: string;
    statLinkValidityValue: string;
    statLinkValidityUnit: string;
    statLinkValidityLabel: string;
    statOneTimeLabel: string;
    statEncrypted: string;
    cardBadge: string;
    headingPrefix: string;
    headingItalic: string;
    headingSuffix: string;
    cardSubtitle: string;
    errorLabel: string;
    emailLabel: string;
    emailPlaceholder: string;
    submitting: string;
    submit: string;
    sentLabel: string;
    sentMessage: string;
    backToSignin: string;
    footerTagline: string;
    genericError: string;
    networkError: string;
  }
> = {
  pl: {
    brandEyebrow: "/AUTH",
    panelStep: "[ 02 ] · Reset hasła",
    panelHeadlineLine1Prefix: "Nowe ",
    panelHeadlineLine1Italic: "hasło",
    panelHeadlineLine2: "Bez paniki.",
    panelSubtitle:
      "Wpisz email konta — wyślemy Ci link, dzięki któremu w 30 sekund ustawisz nowe hasło. Link żyje 60 minut i działa raz.",
    statLinkValidityValue: "60",
    statLinkValidityUnit: "min",
    statLinkValidityLabel: "Ważność linku",
    statOneTimeLabel: "Jednorazowy",
    statEncrypted: "Szyfrowane",
    cardBadge: "Reset hasła",
    headingPrefix: "Zapomniałem ",
    headingItalic: "hasła",
    headingSuffix: ".",
    cardSubtitle: "Podaj email konta — wyślemy link resetujący.",
    errorLabel: "/ ERROR",
    emailLabel: "Email",
    emailPlaceholder: "twoj@email.pl",
    submitting: "Wysyłam...",
    submit: "Wyślij link",
    sentLabel: "/ WYSŁANO",
    sentMessage:
      "Jeśli konto istnieje, wysłaliśmy link resetujący na podany email. Sprawdź skrzynkę (również SPAM). Link wygasa za 60 minut.",
    backToSignin: "← Powrót do logowania",
    footerTagline: "KalkMate · Kalkulator z AI",
    genericError: "Coś poszło nie tak",
    networkError: "Błąd sieci",
  },
  en: {
    brandEyebrow: "/AUTH",
    panelStep: "[ 02 ] · Password reset",
    panelHeadlineLine1Prefix: "A new ",
    panelHeadlineLine1Italic: "password",
    panelHeadlineLine2: "No panic.",
    panelSubtitle:
      "Enter your account email — we'll send you a link that lets you set a new password in 30 seconds. The link lives for 60 minutes and works once.",
    statLinkValidityValue: "60",
    statLinkValidityUnit: "min",
    statLinkValidityLabel: "Link validity",
    statOneTimeLabel: "One-time",
    statEncrypted: "Encrypted",
    cardBadge: "Password reset",
    headingPrefix: "I forgot my ",
    headingItalic: "password",
    headingSuffix: ".",
    cardSubtitle: "Enter your account email — we'll send a reset link.",
    errorLabel: "/ ERROR",
    emailLabel: "Email",
    emailPlaceholder: "you@email.com",
    submitting: "Sending...",
    submit: "Send link",
    sentLabel: "/ SENT",
    sentMessage:
      "If the account exists, we've sent a reset link to the given email. Check your inbox (including SPAM). The link expires in 60 minutes.",
    backToSignin: "← Back to sign in",
    footerTagline: "KalkMate · AI-powered calculator",
    genericError: "Something went wrong",
    networkError: "Network error",
  },
  de: {
    brandEyebrow: "/AUTH",
    panelStep: "[ 02 ] · Passwort zurücksetzen",
    panelHeadlineLine1Prefix: "Ein neues ",
    panelHeadlineLine1Italic: "Passwort",
    panelHeadlineLine2: "Keine Panik.",
    panelSubtitle:
      "Gib die E-Mail deines Kontos ein — wir senden dir einen Link, mit dem du in 30 Sekunden ein neues Passwort festlegst. Der Link gilt 60 Minuten und funktioniert einmal.",
    statLinkValidityValue: "60",
    statLinkValidityUnit: "Min",
    statLinkValidityLabel: "Gültigkeit des Links",
    statOneTimeLabel: "Einmalig",
    statEncrypted: "Verschlüsselt",
    cardBadge: "Passwort zurücksetzen",
    headingPrefix: "Ich habe mein ",
    headingItalic: "Passwort",
    headingSuffix: " vergessen.",
    cardSubtitle: "Gib die E-Mail deines Kontos ein — wir senden einen Reset-Link.",
    errorLabel: "/ ERROR",
    emailLabel: "E-Mail",
    emailPlaceholder: "du@email.de",
    submitting: "Senden...",
    submit: "Link senden",
    sentLabel: "/ GESENDET",
    sentMessage:
      "Falls das Konto existiert, haben wir einen Reset-Link an die angegebene E-Mail gesendet. Prüfe dein Postfach (auch SPAM). Der Link läuft in 60 Minuten ab.",
    backToSignin: "← Zurück zur Anmeldung",
    footerTagline: "KalkMate · KI-Taschenrechner",
    genericError: "Etwas ist schiefgelaufen",
    networkError: "Netzwerkfehler",
  },
  cs: {
    brandEyebrow: "/AUTH",
    panelStep: "[ 02 ] · Obnovení hesla",
    panelHeadlineLine1Prefix: "Nové ",
    panelHeadlineLine1Italic: "heslo",
    panelHeadlineLine2: "Žádná panika.",
    panelSubtitle:
      "Zadej e-mail svého účtu — pošleme ti odkaz, se kterým si za 30 sekund nastavíš nové heslo. Odkaz platí 60 minut a funguje jen jednou.",
    statLinkValidityValue: "60",
    statLinkValidityUnit: "min",
    statLinkValidityLabel: "Platnost odkazu",
    statOneTimeLabel: "Jednorázový",
    statEncrypted: "Šifrováno",
    cardBadge: "Obnovení hesla",
    headingPrefix: "Zapomněl(a) jsem ",
    headingItalic: "heslo",
    headingSuffix: ".",
    cardSubtitle: "Zadej e-mail svého účtu — pošleme ti odkaz pro obnovení.",
    errorLabel: "/ ERROR",
    emailLabel: "E-mail",
    emailPlaceholder: "ty@email.cz",
    submitting: "Odesílám...",
    submit: "Poslat odkaz",
    sentLabel: "/ ODESLÁNO",
    sentMessage:
      "Pokud účet existuje, poslali jsme na zadaný e-mail odkaz pro obnovení hesla. Zkontroluj schránku (i SPAM). Odkaz vyprší za 60 minut.",
    backToSignin: "← Zpět na přihlášení",
    footerTagline: "KalkMate · Kalkulačka s AI",
    genericError: "Něco se pokazilo",
    networkError: "Chyba sítě",
  },
  sk: {
    brandEyebrow: "/AUTH",
    panelStep: "[ 02 ] · Obnovenie hesla",
    panelHeadlineLine1Prefix: "Nové ",
    panelHeadlineLine1Italic: "heslo",
    panelHeadlineLine2: "Bez paniky.",
    panelSubtitle:
      "Zadaj e-mail účtu — pošleme ti odkaz, s ktorým si za 30 sekúnd nastavíš nové heslo. Odkaz platí 60 minút a funguje raz.",
    statLinkValidityValue: "60",
    statLinkValidityUnit: "min",
    statLinkValidityLabel: "Platnosť odkazu",
    statOneTimeLabel: "Jednorazový",
    statEncrypted: "Šifrované",
    cardBadge: "Obnovenie hesla",
    headingPrefix: "Zabudol som ",
    headingItalic: "heslo",
    headingSuffix: ".",
    cardSubtitle: "Zadaj e-mail účtu — pošleme odkaz na obnovenie hesla.",
    errorLabel: "/ CHYBA",
    emailLabel: "E-mail",
    emailPlaceholder: "tvoj@email.sk",
    submitting: "Odosielam...",
    submit: "Poslať odkaz",
    sentLabel: "/ ODOSLANÉ",
    sentMessage:
      "Ak účet existuje, poslali sme na zadaný e-mail odkaz na obnovenie hesla. Skontroluj schránku (aj SPAM). Odkaz vyprší o 60 minút.",
    backToSignin: "← Späť na prihlásenie",
    footerTagline: "KalkMate · Kalkulačka s AI",
    genericError: "Niečo sa pokazilo",
    networkError: "Chyba siete",
  },
  lt: {
    brandEyebrow: "/AUTH",
    panelStep: "[ 02 ] · Slaptažodžio atkūrimas",
    panelHeadlineLine1Prefix: "Naujas ",
    panelHeadlineLine1Italic: "slaptažodis",
    panelHeadlineLine2: "Be panikos.",
    panelSubtitle:
      "Įvesk paskyros el. paštą — atsiųsime nuorodą, su kuria per 30 sekundžių nustatysi naują slaptažodį. Nuoroda galioja 60 minučių ir veikia vieną kartą.",
    statLinkValidityValue: "60",
    statLinkValidityUnit: "min",
    statLinkValidityLabel: "Nuorodos galiojimas",
    statOneTimeLabel: "Vienkartinė",
    statEncrypted: "Šifruota",
    cardBadge: "Slaptažodžio atkūrimas",
    headingPrefix: "Pamiršau ",
    headingItalic: "slaptažodį",
    headingSuffix: ".",
    cardSubtitle: "Įvesk paskyros el. paštą — atsiųsime atkūrimo nuorodą.",
    errorLabel: "/ KLAIDA",
    emailLabel: "El. paštas",
    emailPlaceholder: "tavo@pastas.lt",
    submitting: "Siunčiama...",
    submit: "Siųsti nuorodą",
    sentLabel: "/ IŠSIŲSTA",
    sentMessage:
      "Jei paskyra egzistuoja, į nurodytą el. paštą išsiuntėme atkūrimo nuorodą. Patikrink pašto dėžutę (ir SPAM). Nuoroda nustos galioti po 60 minučių.",
    backToSignin: "← Grįžti į prisijungimą",
    footerTagline: "KalkMate · Skaičiuotuvas su DI",
    genericError: "Kažkas nepavyko",
    networkError: "Tinklo klaida",
  },
  be: {
    brandEyebrow: "/AUTH",
    panelStep: "[ 02 ] · Скід пароля",
    panelHeadlineLine1Prefix: "Новы ",
    panelHeadlineLine1Italic: "пароль",
    panelHeadlineLine2: "Без панікі.",
    panelSubtitle:
      "Увядзі email акаўнта — мы дашлём спасылку, з якой за 30 секунд задасі новы пароль. Спасылка дзейнічае 60 хвілін і працуе адзін раз.",
    statLinkValidityValue: "60",
    statLinkValidityUnit: "хв",
    statLinkValidityLabel: "Тэрмін дзеяння спасылкі",
    statOneTimeLabel: "Аднаразовая",
    statEncrypted: "Шыфраванне",
    cardBadge: "Скід пароля",
    headingPrefix: "Я забыў ",
    headingItalic: "пароль",
    headingSuffix: ".",
    cardSubtitle: "Увядзі email акаўнта — мы дашлём спасылку для скіду.",
    errorLabel: "/ ПАМЫЛКА",
    emailLabel: "Email",
    emailPlaceholder: "tvoj@email.by",
    submitting: "Адпраўляю...",
    submit: "Даслаць спасылку",
    sentLabel: "/ АДПРАЎЛЕНА",
    sentMessage:
      "Калі акаўнт існуе, мы даслалі спасылку для скіду на ўказаны email. Правер скрыню (у тым ліку СПАМ). Спасылка перастане дзейнічаць праз 60 хвілін.",
    backToSignin: "← Назад да ўваходу",
    footerTagline: "KalkMate · Калькулятар з ШІ",
    genericError: "Нешта пайшло не так",
    networkError: "Памылка сеткі",
  },
  es: {
    brandEyebrow: "/AUTH",
    panelStep: "[ 02 ] · Restablecer contraseña",
    panelHeadlineLine1Prefix: "Nueva ",
    panelHeadlineLine1Italic: "contraseña",
    panelHeadlineLine2: "Sin pánico.",
    panelSubtitle:
      "Escribe el email de tu cuenta — te enviaremos un enlace para crear una nueva contraseña en 30 segundos. El enlace dura 60 minutos y funciona una sola vez.",
    statLinkValidityValue: "60",
    statLinkValidityUnit: "min",
    statLinkValidityLabel: "Validez del enlace",
    statOneTimeLabel: "De un solo uso",
    statEncrypted: "Cifrado",
    cardBadge: "Restablecer contraseña",
    headingPrefix: "He olvidado mi ",
    headingItalic: "contraseña",
    headingSuffix: ".",
    cardSubtitle: "Indica el email de tu cuenta — te enviaremos un enlace de restablecimiento.",
    errorLabel: "/ ERROR",
    emailLabel: "Email",
    emailPlaceholder: "tu@email.es",
    submitting: "Enviando...",
    submit: "Enviar enlace",
    sentLabel: "/ ENVIADO",
    sentMessage:
      "Si la cuenta existe, hemos enviado un enlace de restablecimiento al email indicado. Revisa tu bandeja (también SPAM). El enlace caduca en 60 minutos.",
    backToSignin: "← Volver al inicio de sesión",
    footerTagline: "KalkMate · Calculadora con IA",
    genericError: "Algo ha salido mal",
    networkError: "Error de red",
  },
  pt: {
    brandEyebrow: "/AUTH",
    panelStep: "[ 02 ] · Redefinir palavra-passe",
    panelHeadlineLine1Prefix: "Nova ",
    panelHeadlineLine1Italic: "palavra-passe",
    panelHeadlineLine2: "Sem pânico.",
    panelSubtitle:
      "Introduz o email da conta — enviamos-te uma ligação para definires uma nova palavra-passe em 30 segundos. A ligação é válida durante 60 minutos e funciona uma vez.",
    statLinkValidityValue: "60",
    statLinkValidityUnit: "min",
    statLinkValidityLabel: "Validade da ligação",
    statOneTimeLabel: "Utilização única",
    statEncrypted: "Encriptado",
    cardBadge: "Redefinir palavra-passe",
    headingPrefix: "Esqueci-me da ",
    headingItalic: "palavra-passe",
    headingSuffix: ".",
    cardSubtitle: "Indica o email da conta — enviamos uma ligação de redefinição.",
    errorLabel: "/ ERRO",
    emailLabel: "Email",
    emailPlaceholder: "tu@email.pt",
    submitting: "A enviar...",
    submit: "Enviar ligação",
    sentLabel: "/ ENVIADO",
    sentMessage:
      "Se a conta existir, enviámos uma ligação de redefinição para o email indicado. Verifica a caixa de entrada (incluindo SPAM). A ligação expira em 60 minutos.",
    backToSignin: "← Voltar ao início de sessão",
    footerTagline: "KalkMate · Calculadora com IA",
    genericError: "Algo correu mal",
    networkError: "Erro de rede",
  },
  fr: {
    brandEyebrow: "/AUTH",
    panelStep: "[ 02 ] · Réinitialisation du mot de passe",
    panelHeadlineLine1Prefix: "Nouveau ",
    panelHeadlineLine1Italic: "mot de passe",
    panelHeadlineLine2: "Pas de panique.",
    panelSubtitle:
      "Saisis l'email de ton compte — nous t'enverrons un lien pour définir un nouveau mot de passe en 30 secondes. Le lien est valable 60 minutes et ne fonctionne qu'une fois.",
    statLinkValidityValue: "60",
    statLinkValidityUnit: "min",
    statLinkValidityLabel: "Validité du lien",
    statOneTimeLabel: "Usage unique",
    statEncrypted: "Chiffré",
    cardBadge: "Réinitialisation",
    headingPrefix: "Mot de passe ",
    headingItalic: "oublié",
    headingSuffix: ".",
    cardSubtitle: "Indique l'email de ton compte — nous t'enverrons un lien de réinitialisation.",
    errorLabel: "/ ERREUR",
    emailLabel: "Email",
    emailPlaceholder: "toi@email.fr",
    submitting: "Envoi...",
    submit: "Envoyer le lien",
    sentLabel: "/ ENVOYÉ",
    sentMessage:
      "Si le compte existe, nous avons envoyé un lien de réinitialisation à l'email indiqué. Vérifie ta boîte de réception (y compris les SPAM). Le lien expire dans 60 minutes.",
    backToSignin: "← Retour à la connexion",
    footerTagline: "KalkMate · Calculatrice avec IA",
    genericError: "Une erreur s'est produite",
    networkError: "Erreur réseau",
  },
  it: {
    brandEyebrow: "/AUTH",
    panelStep: "[ 02 ] · Reimposta password",
    panelHeadlineLine1Prefix: "Nuova ",
    panelHeadlineLine1Italic: "password",
    panelHeadlineLine2: "Niente panico.",
    panelSubtitle:
      "Inserisci l'email dell'account — ti invieremo un link per impostare una nuova password in 30 secondi. Il link vale 60 minuti e funziona una sola volta.",
    statLinkValidityValue: "60",
    statLinkValidityUnit: "min",
    statLinkValidityLabel: "Validità del link",
    statOneTimeLabel: "Monouso",
    statEncrypted: "Crittografato",
    cardBadge: "Reimposta password",
    headingPrefix: "Ho dimenticato la ",
    headingItalic: "password",
    headingSuffix: ".",
    cardSubtitle: "Inserisci l'email dell'account — ti invieremo un link di reimpostazione.",
    errorLabel: "/ ERRORE",
    emailLabel: "Email",
    emailPlaceholder: "tu@email.it",
    submitting: "Invio...",
    submit: "Invia link",
    sentLabel: "/ INVIATO",
    sentMessage:
      "Se l'account esiste, abbiamo inviato un link di reimpostazione all'email indicata. Controlla la casella (anche lo SPAM). Il link scade tra 60 minuti.",
    backToSignin: "← Torna all'accesso",
    footerTagline: "KalkMate · Calcolatrice con IA",
    genericError: "Qualcosa è andato storto",
    networkError: "Errore di rete",
  },
};

export default function ForgotPasswordPage() {
  const { lang, setLang } = usePanelLang();
  const t = DICT[lang];

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const j = await r.json();
      if (!j.ok) setError(j.error || t.genericError);
      else setDone(true);
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
          <span className="km-mono-eyebrow text-[#F2EDE3]/40">{t.brandEyebrow}</span>
        </div>

        <div className="relative z-10">
          <p className="km-mono-eyebrow text-[#D8FF3D]">{t.panelStep}</p>
          <h2 className="km-display text-[clamp(48px,5.4vw,84px)] mt-6">
            {t.panelHeadlineLine1Prefix}
            <span className="italic">{t.panelHeadlineLine1Italic}</span>.<br />
            {t.panelHeadlineLine2}
          </h2>
          <p className="mt-6 text-[15px] leading-[1.6] text-[#F2EDE3]/65 max-w-md">
            {t.panelSubtitle}
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-6">
          <div>
            <p className="km-display text-3xl text-[#F2EDE3]">{t.statLinkValidityValue}<span className="text-[#F2EDE3]/40 text-lg">{t.statLinkValidityUnit}</span></p>
            <p className="km-mono-eyebrow text-[#F2EDE3]/40 mt-1">{t.statLinkValidityLabel}</p>
          </div>
          <div>
            <p className="km-display text-3xl text-[#F2EDE3]">1<span className="text-[#F2EDE3]/40 text-lg">×</span></p>
            <p className="km-mono-eyebrow text-[#F2EDE3]/40 mt-1">{t.statOneTimeLabel}</p>
          </div>
          <div>
            <p className="km-display text-3xl text-[#F2EDE3]">SMTP</p>
            <p className="km-mono-eyebrow text-[#F2EDE3]/40 mt-1">{t.statEncrypted}</p>
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10 relative">
        <div className="w-full max-w-md relative">
          {/* Frame ticks */}
          <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-l border-t border-[#D8FF3D]" />
          <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-r border-t border-[#D8FF3D]" />
          <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-l border-b border-[#D8FF3D]" />
          <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-r border-b border-[#D8FF3D]" />

          <div className="border border-[rgba(242,237,227,0.18)] bg-[#0B0B0B] p-6 lg:p-8">
            <div className="flex items-center justify-between mb-4">
              <Link href="/" className="lg:hidden inline-flex items-center gap-2">
                <span className="km-display text-2xl">
                  Kalk<span className="italic text-[#D8FF3D]">Mate</span>
                </span>
              </Link>
              <div className="ml-auto">
                <PanelLangSwitcher lang={lang} setLang={setLang} compact />
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-[rgba(242,237,227,0.10)] pb-4">
              <span className="km-mono-eyebrow text-[#D8FF3D] flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full km-blink" />
                {t.cardBadge}
              </span>
              <span className="km-mono-eyebrow text-[#F2EDE3]/40">/FORGOT</span>
            </div>

            <h1 className="km-display text-4xl lg:text-5xl mt-6 leading-[0.95]">
              {t.headingPrefix}<span className="italic text-[#D8FF3D]">{t.headingItalic}</span>{t.headingSuffix}
            </h1>
            <p className="mt-3 text-[14.5px] text-[#F2EDE3]/55">
              {t.cardSubtitle}
            </p>

            {error && (
              <div className="mt-6 border border-[#FF4D2E]/40 bg-[#FF4D2E]/[0.06] p-3">
                <p className="km-mono-eyebrow text-[#FF4D2E]">{t.errorLabel}</p>
                <p className="text-sm text-[#FF4D2E] mt-1">{error}</p>
              </div>
            )}

            {!done ? (
              <form onSubmit={submit} className="mt-6 space-y-5">
                <div>
                  <label htmlFor="email" className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                    {t.emailLabel}
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.emailPlaceholder}
                    required
                    autoFocus
                    className={inputClass}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !email.trim()}
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
            ) : (
              <div className="mt-6 border border-[#D8FF3D]/40 bg-[#D8FF3D]/[0.05] p-4">
                <p className="km-mono-eyebrow text-[#D8FF3D]">{t.sentLabel}</p>
                <p className="text-sm text-[#F2EDE3]/80 mt-2 leading-relaxed">
                  {t.sentMessage}
                </p>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-[rgba(242,237,227,0.10)] text-center">
              <Link
                href="/auth/signin"
                className="km-mono-eyebrow text-[#F2EDE3]/55 hover:text-[#D8FF3D] transition-colors"
              >
                {t.backToSignin}
              </Link>
            </div>
          </div>

          <p className="text-center mt-6 km-mono-eyebrow text-[#F2EDE3]/30">
            {t.footerTagline}
          </p>
        </div>
      </div>
    </div>
  );
}
