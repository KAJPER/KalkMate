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
