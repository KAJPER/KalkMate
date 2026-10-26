"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { usePanelLang } from "@/lib/usePanelLang";
import PanelLangSwitcher from "@/components/PanelLangSwitcher";
import { type Locale } from "@/lib/i18n";
import { forgetCallback, rememberCallback, safeCallback } from "@/app/auth/callback";

const DICT: Record<
  Locale,
  {
    oauthCallback: string;
    oauthNotLinked: string;
    accessDenied: string;
    errorPrefix: (e: string) => string;
    registerError: string;
    genericError: string;
    badgeLogin: string;
    badgeRegister: string;
    brandEyebrow: string;
    brandHeading: ReactNode;
    brandDesc: string;
    statSubjects: string;
    statResponse: string;
    statWarranty: string;
    warrantyUnit: string;
    h1Login: ReactNode;
    h1Register: ReactNode;
    subLogin: string;
    subRegister: string;
    errorLabel: string;
    resendSending: string;
    resendLink: string;
    checkInbox: string;
    verificationSentText: (email: string) => ReactNode;
    continueGoogle: string;
    or: string;
    nameLabel: string;
    nameOptional: string;
    namePlaceholder: string;
    emailLabel: string;
    emailPlaceholder: string;
    passwordLabel: string;
    minChars: string;
    forgotPassword: string;
    submitLoadingLogin: string;
    submitLoadingRegister: string;
    submitLogin: string;
    submitRegister: string;
    toggleToRegister: string;
    toggleToLogin: string;
    backHome: string;
    newsletterConsent: string;
  }
> = {
  pl: {
    oauthCallback: "Błąd logowania przez Google. Spróbuj ponownie.",
    oauthNotLinked: "Ten email jest już zarejestrowany hasłem. Zaloguj się emailem i hasłem.",
    accessDenied: "Dostęp odmówiony przez Google.",
    errorPrefix: (e) => `Błąd: ${e}`,
    registerError: "Błąd rejestracji",
    genericError: "Wystąpił błąd",
    badgeLogin: "Logowanie",
    badgeRegister: "Rejestracja",
    brandEyebrow: "[ 01 ] · Panel klienta",
    brandHeading: (<>Twój sprzęt.<br /><span className="italic">Twoje</span> rozwiązania.</>),
    brandDesc:
      "Zaloguj się, żeby skonfigurować WiFi w kalkulatorze, przeglądać historię rozwiązań, zarządzać tokenami AI i aktywować nowe urządzenia.",
    statSubjects: "Przedmiotów",
    statResponse: "Odpowiedź",
    statWarranty: "Gwarancja",
    warrantyUnit: "mc",
    h1Login: (<>Wejdź na <span className="italic text-[#D8FF3D]">panel</span>.</>),
    h1Register: (<>Załóż <span className="italic text-[#D8FF3D]">konto</span>.</>),
    subLogin: "Zaloguj się i przejmij kontrolę nad swoim KalkMate.",
    subRegister: "Utwórz konto, żeby zacząć aktywować urządzenia.",
    errorLabel: "/ ERROR",
    resendSending: "WYSYŁAM...",
    resendLink: "WYŚLIJ NOWY LINK WERYFIKACYJNY →",
    checkInbox: "/ SPRAWDŹ SKRZYNKĘ",
    verificationSentText: (email) => (
      <>
        Wysłaliśmy link aktywacyjny na <strong className="text-[#F2EDE3]">{email}</strong>.
        Kliknij go żeby aktywować konto (link wygasa za 24h). Sprawdź też SPAM.
      </>
    ),
    continueGoogle: "Kontynuuj z Google",
    or: "lub",
    nameLabel: "Imię",
    nameOptional: "· opcjonalne",
    namePlaceholder: "Jan Kowalski",
    emailLabel: "Email",
    emailPlaceholder: "twoj@email.pl",
    passwordLabel: "Hasło",
    minChars: "Min. 6 znaków",
    forgotPassword: "Zapomniałem hasła",
    submitLoadingLogin: "Logowanie...",
    submitLoadingRegister: "Tworzenie konta...",
    submitLogin: "Zaloguj się",
    submitRegister: "Zarejestruj się",
    toggleToRegister: "Nie masz konta? → Załóż konto",
    toggleToLogin: "Masz już konto? → Zaloguj się",
    backHome: "← Powrót do strony głównej",
    newsletterConsent: "Chcę dostawać e-mailem informacje o nowościach, promocjach i kuponach KalkMate (newsletter). Zgodę mogę wycofać w każdej chwili. (opcjonalnie)",
  },
  en: {
    oauthCallback: "Google sign-in failed. Please try again.",
    oauthNotLinked: "This email is already registered with a password. Sign in with email and password.",
    accessDenied: "Access denied by Google.",
    errorPrefix: (e) => `Error: ${e}`,
    registerError: "Registration error",
    genericError: "An error occurred",
    badgeLogin: "Sign in",
    badgeRegister: "Register",
    brandEyebrow: "[ 01 ] · Client panel",
    brandHeading: (<>Your hardware.<br /><span className="italic">Your</span> solutions.</>),
    brandDesc:
      "Sign in to set up WiFi on your calculator, browse your solution history, manage your AI tokens and activate new devices.",
    statSubjects: "Subjects",
    statResponse: "Response",
    statWarranty: "Warranty",
    warrantyUnit: "mo",
    h1Login: (<>Enter the <span className="italic text-[#D8FF3D]">panel</span>.</>),
    h1Register: (<>Create an <span className="italic text-[#D8FF3D]">account</span>.</>),
    subLogin: "Sign in and take control of your KalkMate.",
    subRegister: "Create an account to start activating devices.",
    errorLabel: "/ ERROR",
    resendSending: "SENDING...",
    resendLink: "SEND A NEW VERIFICATION LINK →",
    checkInbox: "/ CHECK YOUR INBOX",
    verificationSentText: (email) => (
      <>
        We sent an activation link to <strong className="text-[#F2EDE3]">{email}</strong>.
        Click it to activate your account (the link expires in 24h). Check your SPAM folder too.
      </>
    ),
    continueGoogle: "Continue with Google",
    or: "or",
    nameLabel: "Name",
    nameOptional: "· optional",
    namePlaceholder: "John Smith",
    emailLabel: "Email",
    emailPlaceholder: "you@email.com",
    passwordLabel: "Password",
    minChars: "Min. 6 characters",
    forgotPassword: "Forgot password",
    submitLoadingLogin: "Signing in...",
    submitLoadingRegister: "Creating account...",
    submitLogin: "Sign in",
    submitRegister: "Sign up",
    toggleToRegister: "No account? → Create one",
    toggleToLogin: "Already have an account? → Sign in",
    backHome: "← Back to homepage",
    newsletterConsent: "Send me KalkMate news, promotions and coupons by email (newsletter). I can withdraw this at any time. (optional)",
  },
  de: {
    oauthCallback: "Google-Anmeldung fehlgeschlagen. Bitte versuche es erneut.",
    oauthNotLinked: "Diese E-Mail ist bereits mit einem Passwort registriert. Melde dich mit E-Mail und Passwort an.",
    accessDenied: "Zugriff von Google verweigert.",
    errorPrefix: (e) => `Fehler: ${e}`,
    registerError: "Registrierungsfehler",
    genericError: "Ein Fehler ist aufgetreten",
    badgeLogin: "Anmeldung",
    badgeRegister: "Registrierung",
    brandEyebrow: "[ 01 ] · Kundenbereich",
    brandHeading: (<>Deine Hardware.<br /><span className="italic">Deine</span> Lösungen.</>),
    brandDesc:
      "Melde dich an, um WiFi auf deinem Rechner einzurichten, deinen Lösungsverlauf einzusehen, deine KI-Tokens zu verwalten und neue Geräte zu aktivieren.",
    statSubjects: "Fächer",
    statResponse: "Antwort",
    statWarranty: "Garantie",
    warrantyUnit: "Mon",
    h1Login: (<>Zum <span className="italic text-[#D8FF3D]">Panel</span>.</>),
    h1Register: (<>Konto <span className="italic text-[#D8FF3D]">erstellen</span>.</>),
    subLogin: "Melde dich an und übernimm die Kontrolle über dein KalkMate.",
    subRegister: "Erstelle ein Konto, um Geräte zu aktivieren.",
    errorLabel: "/ ERROR",
    resendSending: "SENDE...",
    resendLink: "NEUEN BESTÄTIGUNGSLINK SENDEN →",
    checkInbox: "/ POSTFACH PRÜFEN",
    verificationSentText: (email) => (
      <>
        Wir haben einen Aktivierungslink an <strong className="text-[#F2EDE3]">{email}</strong> gesendet.
        Klicke darauf, um dein Konto zu aktivieren (der Link läuft in 24h ab). Prüfe auch deinen SPAM-Ordner.
      </>
    ),
    continueGoogle: "Mit Google fortfahren",
    or: "oder",
    nameLabel: "Name",
    nameOptional: "· optional",
    namePlaceholder: "Max Mustermann",
    emailLabel: "E-Mail",
    emailPlaceholder: "du@email.de",
    passwordLabel: "Passwort",
    minChars: "Mind. 6 Zeichen",
    forgotPassword: "Passwort vergessen",
    submitLoadingLogin: "Anmeldung...",
    submitLoadingRegister: "Konto wird erstellt...",
    submitLogin: "Anmelden",
    submitRegister: "Registrieren",
    toggleToRegister: "Kein Konto? → Konto erstellen",
    toggleToLogin: "Schon ein Konto? → Anmelden",
    backHome: "← Zurück zur Startseite",
    newsletterConsent: "Ich möchte Neuigkeiten, Aktionen und Gutscheine von KalkMate per E-Mail erhalten (Newsletter). Widerruf jederzeit möglich. (optional)",
  },
  cs: {
    oauthCallback: "Přihlášení přes Google se nezdařilo. Zkus to prosím znovu.",
    oauthNotLinked: "Tento e-mail je už zaregistrovaný s heslem. Přihlas se e-mailem a heslem.",
    accessDenied: "Google odepřel přístup.",
    errorPrefix: (e) => `Chyba: ${e}`,
    registerError: "Chyba registrace",
    genericError: "Došlo k chybě",
    badgeLogin: "Přihlášení",
    badgeRegister: "Registrace",
    brandEyebrow: "[ 01 ] · Zákaznický panel",
    brandHeading: (<>Tvoje zařízení.<br /><span className="italic">Tvoje</span> řešení.</>),
    brandDesc:
      "Přihlas se, abys mohl(a) nastavit WiFi v kalkulačce, procházet historii řešení, spravovat AI tokeny a aktivovat nová zařízení.",
    statSubjects: "Předměty",
    statResponse: "Odpověď",
    statWarranty: "Záruka",
    warrantyUnit: "měs",
    h1Login: (<>Vstup do <span className="italic text-[#D8FF3D]">panelu</span>.</>),
    h1Register: (<>Založ si <span className="italic text-[#D8FF3D]">účet</span>.</>),
    subLogin: "Přihlas se a převezmi kontrolu nad svým KalkMate.",
    subRegister: "Vytvoř si účet a začni aktivovat zařízení.",
    errorLabel: "/ ERROR",
    resendSending: "ODESÍLÁM...",
    resendLink: "POSLAT NOVÝ OVĚŘOVACÍ ODKAZ →",
    checkInbox: "/ ZKONTROLUJ SCHRÁNKU",
    verificationSentText: (email) => (
      <>
        Na <strong className="text-[#F2EDE3]">{email}</strong> jsme poslali aktivační odkaz.
        Klikni na něj a aktivuj si účet (odkaz vyprší za 24 h). Zkontroluj i složku SPAM.
      </>
    ),
    continueGoogle: "Pokračovat přes Google",
    or: "nebo",
    nameLabel: "Jméno",
    nameOptional: "· nepovinné",
    namePlaceholder: "Jan Novák",
    emailLabel: "E-mail",
    emailPlaceholder: "ty@email.cz",
    passwordLabel: "Heslo",
    minChars: "Min. 6 znaků",
    forgotPassword: "Zapomněl(a) jsem heslo",
    submitLoadingLogin: "Přihlašování...",
    submitLoadingRegister: "Vytvářím účet...",
    submitLogin: "Přihlásit se",
    submitRegister: "Zaregistrovat se",
    toggleToRegister: "Nemáš účet? → Založ si ho",
    toggleToLogin: "Už máš účet? → Přihlas se",
    backHome: "← Zpět na hlavní stránku",
    newsletterConsent: "Chci dostávat e-mailem novinky, akce a slevové kupóny KalkMate (newsletter). Souhlas mohu kdykoli odvolat. (nepovinné)",
  },
  sk: {
    oauthCallback: "Prihlásenie cez Google zlyhalo. Skús to znova.",
    oauthNotLinked: "Tento e-mail je už zaregistrovaný s heslom. Prihlás sa e-mailom a heslom.",
    accessDenied: "Google zamietol prístup.",
    errorPrefix: (e) => `Chyba: ${e}`,
    registerError: "Chyba registrácie",
    genericError: "Nastala chyba",
    badgeLogin: "Prihlásenie",
    badgeRegister: "Registrácia",
    brandEyebrow: "[ 01 ] · Klientsky panel",
    brandHeading: (<>Tvoje zariadenie.<br /><span className="italic">Tvoje</span> riešenia.</>),
    brandDesc:
      "Prihlás sa, aby si nastavil WiFi v kalkulačke, prezeral históriu riešení, spravoval AI tokeny a aktivoval nové zariadenia.",
    statSubjects: "Predmety",
    statResponse: "Odpoveď",
    statWarranty: "Záruka",
    warrantyUnit: "mes.",
    h1Login: (<>Vstúp do <span className="italic text-[#D8FF3D]">panela</span>.</>),
    h1Register: (<>Založ si <span className="italic text-[#D8FF3D]">účet</span>.</>),
    subLogin: "Prihlás sa a prevezmi kontrolu nad svojím KalkMate.",
    subRegister: "Vytvor si účet a začni aktivovať zariadenia.",
    errorLabel: "/ CHYBA",
    resendSending: "ODOSIELAM...",
    resendLink: "POSLAŤ NOVÝ OVEROVACÍ ODKAZ →",
    checkInbox: "/ SKONTROLUJ SCHRÁNKU",
    verificationSentText: (email) => (
      <>
        Poslali sme aktivačný odkaz na <strong className="text-[#F2EDE3]">{email}</strong>.
        Klikni naň a aktivuj účet (odkaz vyprší o 24 h). Skontroluj aj SPAM.
      </>
    ),
    continueGoogle: "Pokračovať cez Google",
    or: "alebo",
    nameLabel: "Meno",
    nameOptional: "· nepovinné",
    namePlaceholder: "Ján Novák",
    emailLabel: "E-mail",
    emailPlaceholder: "tvoj@email.sk",
    passwordLabel: "Heslo",
    minChars: "Min. 6 znakov",
    forgotPassword: "Zabudol som heslo",
    submitLoadingLogin: "Prihlasujem...",
    submitLoadingRegister: "Vytváram účet...",
    submitLogin: "Prihlásiť sa",
    submitRegister: "Zaregistrovať sa",
    toggleToRegister: "Nemáš účet? → Založ si ho",
    toggleToLogin: "Už máš účet? → Prihlás sa",
    backHome: "← Späť na hlavnú stránku",
    newsletterConsent: "Chcem dostávať e-mailom novinky, akcie a zľavové kupóny KalkMate (newsletter). Súhlas môžem kedykoľvek odvolať. (nepovinné)",
  },
  lt: {
    oauthCallback: "Nepavyko prisijungti per Google. Bandyk dar kartą.",
    oauthNotLinked: "Šis el. paštas jau užregistruotas su slaptažodžiu. Prisijunk el. paštu ir slaptažodžiu.",
    accessDenied: "Google atmetė prieigą.",
    errorPrefix: (e) => `Klaida: ${e}`,
    registerError: "Registracijos klaida",
    genericError: "Įvyko klaida",
    badgeLogin: "Prisijungimas",
    badgeRegister: "Registracija",
    brandEyebrow: "[ 01 ] · Kliento skydelis",
    brandHeading: (<>Tavo įrenginys.<br /><span className="italic">Tavo</span> sprendimai.</>),
    brandDesc:
      "Prisijunk, kad nustatytum skaičiuotuvo WiFi, peržiūrėtum sprendimų istoriją, valdytum DI žetonus ir aktyvuotum naujus įrenginius.",
    statSubjects: "Dalykai",
    statResponse: "Atsakymas",
    statWarranty: "Garantija",
    warrantyUnit: "mėn.",
    h1Login: (<>Eik į <span className="italic text-[#D8FF3D]">skydelį</span>.</>),
    h1Register: (<>Susikurk <span className="italic text-[#D8FF3D]">paskyrą</span>.</>),
    subLogin: "Prisijunk ir valdyk savo KalkMate.",
    subRegister: "Susikurk paskyrą, kad galėtum aktyvuoti įrenginius.",
    errorLabel: "/ KLAIDA",
    resendSending: "SIUNČIAMA...",
    resendLink: "SIŲSTI NAUJĄ PATVIRTINIMO NUORODĄ →",
    checkInbox: "/ PATIKRINK PAŠTĄ",
    verificationSentText: (email) => (
      <>
        Išsiuntėme aktyvavimo nuorodą į <strong className="text-[#F2EDE3]">{email}</strong>.
        Paspausk ją, kad aktyvuotum paskyrą (nuoroda galioja 24 val.). Patikrink ir SPAM.
      </>
    ),
    continueGoogle: "Tęsti su Google",
    or: "arba",
    nameLabel: "Vardas",
    nameOptional: "· neprivaloma",
    namePlaceholder: "Jonas Jonaitis",
    emailLabel: "El. paštas",
    emailPlaceholder: "tavo@pastas.lt",
    passwordLabel: "Slaptažodis",
    minChars: "Min. 6 simboliai",
    forgotPassword: "Pamiršau slaptažodį",
    submitLoadingLogin: "Jungiamasi...",
    submitLoadingRegister: "Kuriama paskyra...",
    submitLogin: "Prisijungti",
    submitRegister: "Registruotis",
    toggleToRegister: "Neturi paskyros? → Susikurk",
    toggleToLogin: "Jau turi paskyrą? → Prisijunk",
    backHome: "← Grįžti į pagrindinį puslapį",
    newsletterConsent: "Noriu el. paštu gauti KalkMate naujienas, akcijas ir nuolaidų kuponus (naujienlaiškis). Sutikimą galiu bet kada atšaukti. (neprivaloma)",
  },
  be: {
    oauthCallback: "Не ўдалося ўвайсці праз Google. Паспрабуй яшчэ раз.",
    oauthNotLinked: "Гэты email ужо зарэгістраваны з паролем. Увайдзі праз email і пароль.",
    accessDenied: "Google адмовіў у доступе.",
    errorPrefix: (e) => `Памылка: ${e}`,
    registerError: "Памылка рэгістрацыі",
    genericError: "Адбылася памылка",
    badgeLogin: "Уваход",
    badgeRegister: "Рэгістрацыя",
    brandEyebrow: "[ 01 ] · Панэль кліента",
    brandHeading: (<>Тваё абсталяванне.<br /><span className="italic">Твае</span> рашэнні.</>),
    brandDesc:
      "Увайдзі, каб наладзіць WiFi у калькулятары, праглядаць гісторыю рашэнняў, кіраваць токенамі ШІ і актываваць новыя прылады.",
    statSubjects: "Прадметаў",
    statResponse: "Адказ",
    statWarranty: "Гарантыя",
    warrantyUnit: "мес.",
    h1Login: (<>Увайдзі ў <span className="italic text-[#D8FF3D]">панэль</span>.</>),
    h1Register: (<>Ствары <span className="italic text-[#D8FF3D]">акаўнт</span>.</>),
    subLogin: "Увайдзі і вазьмі пад кантроль свой KalkMate.",
    subRegister: "Ствары акаўнт, каб пачаць актываваць прылады.",
    errorLabel: "/ ПАМЫЛКА",
    resendSending: "АДПРАЎЛЯЮ...",
    resendLink: "ДАСЛАЦЬ НОВУЮ СПАСЫЛКУ ДЛЯ ПАЦВЯРДЖЭННЯ →",
    checkInbox: "/ ПРАВЕР ПОШТУ",
    verificationSentText: (email) => (
      <>
        Мы даслалі спасылку для актывацыі на <strong className="text-[#F2EDE3]">{email}</strong>.
        Націсні на яе, каб актываваць акаўнт (спасылка дзейнічае 24 г). Правер таксама СПАМ.
      </>
    ),
    continueGoogle: "Працягнуць з Google",
    or: "або",
    nameLabel: "Імя",
    nameOptional: "· неабавязкова",
    namePlaceholder: "Іван Іваноў",
    emailLabel: "Email",
    emailPlaceholder: "tvoj@email.by",
    passwordLabel: "Пароль",
    minChars: "Мін. 6 сімвалаў",
    forgotPassword: "Забыў пароль",
    submitLoadingLogin: "Уваход...",
    submitLoadingRegister: "Ствараю акаўнт...",
    submitLogin: "Увайсці",
    submitRegister: "Зарэгістравацца",
    toggleToRegister: "Няма акаўнта? → Ствары яго",
    toggleToLogin: "Ужо ёсць акаўнт? → Увайдзі",
    backHome: "← Назад на галоўную",
    newsletterConsent: "Хачу атрымліваць па email навіны, акцыі і купоны KalkMate (рассылка). Згоду магу адклікаць у любы момант. (неабавязкова)",
  },
  es: {
    oauthCallback: "Error al iniciar sesión con Google. Inténtalo de nuevo.",
    oauthNotLinked: "Este email ya está registrado con contraseña. Inicia sesión con email y contraseña.",
    accessDenied: "Google ha denegado el acceso.",
    errorPrefix: (e) => `Error: ${e}`,
    registerError: "Error de registro",
    genericError: "Se ha producido un error",
    badgeLogin: "Iniciar sesión",
    badgeRegister: "Registro",
    brandEyebrow: "[ 01 ] · Panel de cliente",
    brandHeading: (<>Tu dispositivo.<br /><span className="italic">Tus</span> soluciones.</>),
    brandDesc:
      "Inicia sesión para configurar el WiFi de la calculadora, consultar el historial de soluciones, gestionar tus tokens de IA y activar nuevos dispositivos.",
    statSubjects: "Asignaturas",
    statResponse: "Respuesta",
    statWarranty: "Garantía",
    warrantyUnit: "meses",
    h1Login: (<>Entra en el <span className="italic text-[#D8FF3D]">panel</span>.</>),
    h1Register: (<>Crea una <span className="italic text-[#D8FF3D]">cuenta</span>.</>),
    subLogin: "Inicia sesión y toma el control de tu KalkMate.",
    subRegister: "Crea una cuenta para empezar a activar dispositivos.",
    errorLabel: "/ ERROR",
    resendSending: "ENVIANDO...",
    resendLink: "ENVIAR UN NUEVO ENLACE DE VERIFICACIÓN →",
    checkInbox: "/ REVISA TU BANDEJA",
    verificationSentText: (email) => (
      <>
        Hemos enviado un enlace de activación a <strong className="text-[#F2EDE3]">{email}</strong>.
        Haz clic en él para activar tu cuenta (el enlace caduca en 24 h). Revisa también SPAM.
      </>
    ),
    continueGoogle: "Continuar con Google",
    or: "o",
    nameLabel: "Nombre",
    nameOptional: "· opcional",
    namePlaceholder: "Juan García",
    emailLabel: "Email",
    emailPlaceholder: "tu@email.es",
    passwordLabel: "Contraseña",
    minChars: "Mín. 6 caracteres",
    forgotPassword: "He olvidado mi contraseña",
    submitLoadingLogin: "Iniciando sesión...",
    submitLoadingRegister: "Creando cuenta...",
    submitLogin: "Iniciar sesión",
    submitRegister: "Registrarse",
    toggleToRegister: "¿No tienes cuenta? → Crea una",
    toggleToLogin: "¿Ya tienes cuenta? → Inicia sesión",
    backHome: "← Volver a la página principal",
    newsletterConsent: "Quiero recibir por email novedades, promociones y cupones de KalkMate (newsletter). Puedo retirar el consentimiento en cualquier momento. (opcional)",
  },
  pt: {
    oauthCallback: "Falha ao iniciar sessão com o Google. Tenta novamente.",
    oauthNotLinked: "Este email já está registado com palavra-passe. Inicia sessão com email e palavra-passe.",
    accessDenied: "O Google negou o acesso.",
    errorPrefix: (e) => `Erro: ${e}`,
    registerError: "Erro no registo",
    genericError: "Ocorreu um erro",
    badgeLogin: "Iniciar sessão",
    badgeRegister: "Registo",
    brandEyebrow: "[ 01 ] · Painel de cliente",
    brandHeading: (<>O teu equipamento.<br /><span className="italic">As tuas</span> soluções.</>),
    brandDesc:
      "Inicia sessão para configurar o WiFi da calculadora, ver o histórico de soluções, gerir os teus tokens de IA e ativar novos dispositivos.",
    statSubjects: "Disciplinas",
    statResponse: "Resposta",
    statWarranty: "Garantia",
    warrantyUnit: "meses",
    h1Login: (<>Entra no <span className="italic text-[#D8FF3D]">painel</span>.</>),
    h1Register: (<>Cria uma <span className="italic text-[#D8FF3D]">conta</span>.</>),
    subLogin: "Inicia sessão e assume o controlo do teu KalkMate.",
    subRegister: "Cria uma conta para começares a ativar dispositivos.",
    errorLabel: "/ ERRO",
    resendSending: "A ENVIAR...",
    resendLink: "ENVIAR NOVA LIGAÇÃO DE VERIFICAÇÃO →",
    checkInbox: "/ VERIFICA A CAIXA DE ENTRADA",
    verificationSentText: (email) => (
      <>
        Enviámos uma ligação de ativação para <strong className="text-[#F2EDE3]">{email}</strong>.
        Clica nela para ativar a conta (a ligação expira em 24 h). Verifica também o SPAM.
      </>
    ),
    continueGoogle: "Continuar com o Google",
    or: "ou",
    nameLabel: "Nome",
    nameOptional: "· opcional",
    namePlaceholder: "João Silva",
    emailLabel: "Email",
    emailPlaceholder: "tu@email.pt",
    passwordLabel: "Palavra-passe",
    minChars: "Mín. 6 caracteres",
    forgotPassword: "Esqueci-me da palavra-passe",
    submitLoadingLogin: "A iniciar sessão...",
    submitLoadingRegister: "A criar conta...",
    submitLogin: "Iniciar sessão",
    submitRegister: "Registar",
    toggleToRegister: "Não tens conta? → Cria uma",
    toggleToLogin: "Já tens conta? → Inicia sessão",
    backHome: "← Voltar à página inicial",
    newsletterConsent: "Quero receber por email novidades, promoções e cupões da KalkMate (newsletter). Posso retirar o consentimento a qualquer momento. (opcional)",
  },
  fr: {
    oauthCallback: "Échec de la connexion avec Google. Réessaie.",
    oauthNotLinked: "Cet email est déjà enregistré avec un mot de passe. Connecte-toi avec ton email et ton mot de passe.",
    accessDenied: "Accès refusé par Google.",
    errorPrefix: (e) => `Erreur : ${e}`,
    registerError: "Erreur d'inscription",
    genericError: "Une erreur s'est produite",
    badgeLogin: "Connexion",
    badgeRegister: "Inscription",
    brandEyebrow: "[ 01 ] · Espace client",
    brandHeading: (<>Ton appareil.<br /><span className="italic">Tes</span> solutions.</>),
    brandDesc:
      "Connecte-toi pour configurer le WiFi de la calculatrice, consulter l'historique des solutions, gérer tes jetons IA et activer de nouveaux appareils.",
    statSubjects: "Matières",
    statResponse: "Réponse",
    statWarranty: "Garantie",
    warrantyUnit: "mois",
    h1Login: (<>Accède à ton <span className="italic text-[#D8FF3D]">espace</span>.</>),
    h1Register: (<>Crée un <span className="italic text-[#D8FF3D]">compte</span>.</>),
    subLogin: "Connecte-toi et prends le contrôle de ton KalkMate.",
    subRegister: "Crée un compte pour commencer à activer des appareils.",
    errorLabel: "/ ERREUR",
    resendSending: "ENVOI...",
    resendLink: "ENVOYER UN NOUVEAU LIEN DE VÉRIFICATION →",
    checkInbox: "/ VÉRIFIE TA BOÎTE MAIL",
    verificationSentText: (email) => (
      <>
        Nous avons envoyé un lien d'activation à <strong className="text-[#F2EDE3]">{email}</strong>.
        Clique dessus pour activer ton compte (le lien expire dans 24 h). Vérifie aussi les SPAM.
      </>
    ),
    continueGoogle: "Continuer avec Google",
    or: "ou",
    nameLabel: "Prénom",
    nameOptional: "· facultatif",
    namePlaceholder: "Jean Dupont",
    emailLabel: "Email",
    emailPlaceholder: "toi@email.fr",
    passwordLabel: "Mot de passe",
    minChars: "6 caractères min.",
    forgotPassword: "Mot de passe oublié",
    submitLoadingLogin: "Connexion...",
    submitLoadingRegister: "Création du compte...",
    submitLogin: "Se connecter",
    submitRegister: "S'inscrire",
    toggleToRegister: "Pas de compte ? → Crée-en un",
    toggleToLogin: "Déjà un compte ? → Connecte-toi",
    backHome: "← Retour à l'accueil",
    newsletterConsent: "Je souhaite recevoir par email les nouveautés, promotions et coupons KalkMate (newsletter). Je peux retirer mon consentement à tout moment. (facultatif)",
  },
  it: {
    oauthCallback: "Accesso con Google non riuscito. Riprova.",
    oauthNotLinked: "Questa email è già registrata con una password. Accedi con email e password.",
    accessDenied: "Accesso negato da Google.",
    errorPrefix: (e) => `Errore: ${e}`,
    registerError: "Errore di registrazione",
    genericError: "Si è verificato un errore",
    badgeLogin: "Accesso",
    badgeRegister: "Registrazione",
    brandEyebrow: "[ 01 ] · Area clienti",
    brandHeading: (<>Il tuo dispositivo.<br /><span className="italic">Le tue</span> soluzioni.</>),
    brandDesc:
      "Accedi per configurare il WiFi della calcolatrice, consultare lo storico delle soluzioni, gestire i token IA e attivare nuovi dispositivi.",
    statSubjects: "Materie",
    statResponse: "Risposta",
    statWarranty: "Garanzia",
    warrantyUnit: "mesi",
    h1Login: (<>Entra nel <span className="italic text-[#D8FF3D]">pannello</span>.</>),
    h1Register: (<>Crea un <span className="italic text-[#D8FF3D]">account</span>.</>),
    subLogin: "Accedi e prendi il controllo del tuo KalkMate.",
    subRegister: "Crea un account per iniziare ad attivare i dispositivi.",
    errorLabel: "/ ERRORE",
    resendSending: "INVIO...",
    resendLink: "INVIA UN NUOVO LINK DI VERIFICA →",
    checkInbox: "/ CONTROLLA LA POSTA",
    verificationSentText: (email) => (
      <>
        Abbiamo inviato un link di attivazione a <strong className="text-[#F2EDE3]">{email}</strong>.
        Cliccalo per attivare l'account (il link scade tra 24 h). Controlla anche lo SPAM.
      </>
    ),
    continueGoogle: "Continua con Google",
    or: "oppure",
    nameLabel: "Nome",
    nameOptional: "· facoltativo",
    namePlaceholder: "Mario Rossi",
    emailLabel: "Email",
    emailPlaceholder: "tu@email.it",
    passwordLabel: "Password",
    minChars: "Min. 6 caratteri",
    forgotPassword: "Password dimenticata",
    submitLoadingLogin: "Accesso in corso...",
    submitLoadingRegister: "Creazione account...",
    submitLogin: "Accedi",
    submitRegister: "Registrati",
    toggleToRegister: "Non hai un account? → Creane uno",
    toggleToLogin: "Hai già un account? → Accedi",
    backHome: "← Torna alla home page",
    newsletterConsent: "Voglio ricevere via email novità, promozioni e coupon KalkMate (newsletter). Posso revocare il consenso in qualsiasi momento. (facoltativo)",
  },
};

function SignInForm() {
  const searchParams = useSearchParams();
  const { lang, setLang } = usePanelLang();
  const t = DICT[lang];
  // callbackUrl z query jest kontrolowany przez atakujacego — tylko sciezki
  // w obrebie naszego originu (bez javascript:, //host, /\host). Patrz callback.ts.
  const callbackParam = searchParams.get("callbackUrl");

  // Zapamietaj intencje (np. powrot do checkoutu), zeby przezyla rejestracje
  // i klik w link weryfikacyjny z maila (nowa karta).
  useEffect(() => {
    if (callbackParam) rememberCallback(callbackParam);
  }, [callbackParam]);

  // Docelowy adres po zalogowaniu (niepoprawny/brak -> /panel). Zapamietanej
  // intencji NIE czytamy tutaj, tylko na /auth/verify (link do logowania
  // dostaje ja jako callbackUrl) — inaczej zwykle logowanie z menu w ciagu
  // 24h wrzucaloby usera w checkout.
  const resolveCallback = () => safeCallback(callbackParam);
  // Tryb formularza: ?mode=register | ?mode=signup | ?signup=1 -> rejestracja, domyslnie login
  const initialMode = searchParams.get("mode") || (searchParams.get("signup") ? "register" : "");
  const startAsRegister = initialMode === "register" || initialMode === "signup";

  const urlError = searchParams.get("error");
  const urlErrorMsg = urlError === "OAuthCallback" || urlError === "OAuthSignin"
    ? t.oauthCallback
    : urlError === "OAuthAccountNotLinked"
    ? t.oauthNotLinked
    : urlError === "AccessDenied"
    ? t.accessDenied
    : urlError
    ? t.errorPrefix(urlError)
    : "";

  const [isLogin, setIsLogin] = useState(!startAsRegister);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(urlErrorMsg);
  const [verificationSent, setVerificationSent] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setVerificationSent(false);
    setShowResend(false);
    setIsLoading(true);

    try {
      if (isLogin) {
        const result = await signIn("credentials", { email, password, redirect: false });
        if (result?.error) {
          setError(result.error);
          if (result.error.toLowerCase().includes("niezweryfikowany")) setShowResend(true);
        } else if (result?.ok) {
          const target = resolveCallback();
          forgetCallback();
          // Hard navigation - upewniamy sie ze cookie sesji jest widoczne w SSR
          window.location.href = target;
        }
      } else {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name, marketingConsent }),
        });
        const data = await res.json();
        if (!res.ok) setError(data.error || t.registerError);
        else {
          // Konto utworzone — NIE logujemy automatycznie. User musi zweryfikowac email.
          setVerificationSent(true);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.genericError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setVerificationSent(true);
      setShowResend(false);
      setError("");
    } finally {
      setResending(false);
    }
  };

  const inputClass =
    "w-full px-4 py-3 bg-[#0B0B0B] border border-[rgba(242,237,227,0.18)] text-[#F2EDE3] text-[15px] placeholder:text-[#F2EDE3]/30 focus:outline-none focus:border-[#D8FF3D] transition-colors";

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F2EDE3] km-grain flex">
      {/* Left: brand panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 relative border-r border-[rgba(242,237,227,0.10)] flex-col justify-between p-10 xl:p-14 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none -z-0">
          <div className="absolute -top-32 -left-20 w-[520px] h-[520px] rounded-full bg-[#D8FF3D] opacity-[0.05] blur-[140px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[420px] h-[420px] rounded-full bg-[#FF4D2E] opacity-[0.04] blur-[120px]" />
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <Link href="/" className="km-display text-[28px] leading-none">
            Kalk<span className="italic text-[#D8FF3D]">Mate</span>
          </Link>
          <span className="km-mono-eyebrow text-[#F2EDE3]/40">v0.6.4</span>
        </div>

        <div className="relative z-10">
          <p className="km-mono-eyebrow text-[#D8FF3D]">{t.brandEyebrow}</p>
          <h2 className="km-display text-[clamp(48px,5.4vw,84px)] mt-6">
            {t.brandHeading}
          </h2>
          <p className="mt-6 text-[15px] leading-[1.6] text-[#F2EDE3]/65 max-w-md">
            {t.brandDesc}
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-6">
          <div>
            <p className="km-display text-3xl text-[#F2EDE3]">04</p>
            <p className="km-mono-eyebrow text-[#F2EDE3]/40 mt-1">{t.statSubjects}</p>
          </div>
          <div>
            <p className="km-display text-3xl text-[#F2EDE3]">1.2<span className="text-[#F2EDE3]/40 text-lg">s</span></p>
            <p className="km-mono-eyebrow text-[#F2EDE3]/40 mt-1">{t.statResponse}</p>
          </div>
          <div>
            <p className="km-display text-3xl text-[#F2EDE3]">24<span className="text-[#F2EDE3]/40 text-lg">{t.warrantyUnit}</span></p>
            <p className="km-mono-eyebrow text-[#F2EDE3]/40 mt-1">{t.statWarranty}</p>
          </div>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10 relative">
        <div className="w-full max-w-md relative">
          {/* Frame ticks */}
          <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-l border-t border-[#D8FF3D]" />
          <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-r border-t border-[#D8FF3D]" />
          <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-l border-b border-[#D8FF3D]" />
          <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-r border-b border-[#D8FF3D]" />

          <div className="border border-[rgba(242,237,227,0.18)] bg-[#0B0B0B] p-6 lg:p-8">
            {/* Mobile brand + language switcher */}
            <div className="flex items-center justify-between mb-6">
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
                {isLogin ? t.badgeLogin : t.badgeRegister}
              </span>
              <span className="km-mono-eyebrow text-[#F2EDE3]/40">
                /AUTH · v0.6.4
              </span>
            </div>

            <h1 className="km-display text-4xl lg:text-5xl mt-6 leading-[0.95]">
              {isLogin ? t.h1Login : t.h1Register}
            </h1>
            <p className="mt-3 text-[14.5px] text-[#F2EDE3]/55">
              {isLogin ? t.subLogin : t.subRegister}
            </p>

            {error && (
              <div className="mt-6 border border-[#FF4D2E]/40 bg-[#FF4D2E]/[0.06] p-3">
                <p className="km-mono-eyebrow text-[#FF4D2E]">{t.errorLabel}</p>
                <p className="text-sm text-[#FF4D2E] mt-1">{error}</p>
                {showResend && (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending || !email}
                    className="mt-3 km-mono-eyebrow text-[#D8FF3D] hover:text-[#F2EDE3] disabled:opacity-50 transition-colors"
                  >
                    {resending ? t.resendSending : t.resendLink}
                  </button>
                )}
              </div>
            )}

            {verificationSent && (
              <div className="mt-6 border border-[#D8FF3D]/40 bg-[#D8FF3D]/[0.05] p-4">
                <p className="km-mono-eyebrow text-[#D8FF3D]">{t.checkInbox}</p>
                <p className="text-sm text-[#F2EDE3]/80 mt-2 leading-relaxed">
                  {t.verificationSentText(email)}
                </p>
              </div>
            )}

            {/* Google OAuth */}
            <div className="mt-6">
              <button
                type="button"
                onClick={() => {
                  const target = resolveCallback();
                  forgetCallback();
                  signIn("google", { callbackUrl: target });
                }}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-[rgba(242,237,227,0.18)] bg-transparent text-[#F2EDE3]/80 hover:border-[rgba(242,237,227,0.35)] hover:text-[#F2EDE3] transition-colors km-mono-eyebrow"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {t.continueGoogle}
              </button>
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[rgba(242,237,227,0.10)]" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-[#0B0B0B] km-mono-eyebrow text-[#F2EDE3]/30 text-[11px]">{t.or}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div>
                  <label htmlFor="name" className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                    {t.nameLabel} <span className="text-[#F2EDE3]/30">{t.nameOptional}</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.namePlaceholder}
                    className={inputClass}
                  />
                </div>
              )}

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
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="password" className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                  {t.passwordLabel}
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className={inputClass}
                />
                {!isLogin && (
                  <p className="km-mono-eyebrow text-[#F2EDE3]/40 mt-2">
                    {t.minChars}
                  </p>
                )}
                {!isLogin && (
                  <label className="flex items-start gap-3 cursor-pointer mt-4">
                    <input
                      type="checkbox"
                      checked={marketingConsent}
                      onChange={(e) => setMarketingConsent(e.target.checked)}
                      className="mt-1 accent-[#D8FF3D]"
                    />
                    <span className="text-xs text-[#F2EDE3]/55 leading-relaxed">{t.newsletterConsent}</span>
                  </label>
                )}
                {isLogin && (
                  <div className="mt-2 text-right">
                    <a
                      href="/auth/forgot-password"
                      className="km-mono-eyebrow text-[#F2EDE3]/55 hover:text-[#D8FF3D] transition-colors"
                    >
                      {t.forgotPassword}
                    </a>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`group w-full px-5 py-4 km-mono-eyebrow flex items-center justify-between transition-colors ${
                  isLoading
                    ? "bg-[#D8FF3D]/30 text-[#0B0B0B]/50 cursor-not-allowed"
                    : "bg-[#D8FF3D] text-[#0B0B0B] hover:bg-[#F2EDE3]"
                }`}
              >
                <span className="flex items-center gap-2">
                  {!isLoading && <span className="w-1.5 h-1.5 bg-[#0B0B0B] rounded-full km-blink" />}
                  {isLoading
                    ? isLogin ? t.submitLoadingLogin : t.submitLoadingRegister
                    : isLogin ? t.submitLogin : t.submitRegister}
                </span>
                {!isLoading && <span>→</span>}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-[rgba(242,237,227,0.10)] flex flex-col gap-3">
              <button
                onClick={() => { setIsLogin(!isLogin); setError(""); }}
                className="km-mono-eyebrow text-[#D8FF3D] hover:text-[#F2EDE3] transition-colors text-left"
              >
                {isLogin ? t.toggleToRegister : t.toggleToLogin}
              </button>
              <Link
                href="/"
                className="km-mono-eyebrow text-[#F2EDE3]/45 hover:text-[#F2EDE3] transition-colors"
              >
                {t.backHome}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center">
          <span className="km-mono-eyebrow text-[#F2EDE3]/55">Ładowanie...</span>
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
