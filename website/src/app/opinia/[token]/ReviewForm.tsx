"use client";

// Formularz opinii po dostawie (link z maila: /opinia/<token>).
// Wszystkie stany (formularz, podziekowanie, nieaktywny link) sa tutaj,
// zeby tlumaczenia trzymac w jednym slowniku.

import { useRef, useState } from "react";
import type React from "react";
import Link from "next/link";
import { localeHome, type Locale } from "@/lib/i18n";
import type { ReviewStatus } from "@/lib/reviews";

export type ReviewFormStatus = ReviewStatus | "invalid";

export interface ReviewFormProps {
  token: string;
  lang: Locale;
  name: string;
  product: string;
  initialStatus: ReviewFormStatus;
}

const TEXT_MAX = 1000;
const NAME_MAX = 40;

type ErrorCode =
  | "invalid_rating"
  | "invalid_name"
  | "text_too_long"
  | "consent_required"
  | "bad_request"
  | "not_found"
  | "rate_limited"
  | "server_error"
  | "network";

type Dict = {
  eyebrow: string;
  rate: string;
  intro: string;
  ratingLabel: string;
  starLabel: (n: number) => string;
  hints: [string, string, string, string, string];
  textLabel: string;
  textPlaceholder: string;
  nameLabel: string;
  nameHint: string;
  consent: string;
  submit: string;
  submitting: string;
  errors: Record<ErrorCode, string>;
  thanksEyebrow: string;
  thanksTitle: string;
  thanksBody: string;
  alreadyBody: string;
  refer: string;
  referNote: string;
  home: string;
  invalidEyebrow: string;
  invalidTitle: string;
  invalidBody: string;
};

const dict: Record<Locale, Dict> = {
  pl: {
    eyebrow: "/ TWOJA OPINIA",
    rate: "Oceń",
    intro: "Jak sprawdza się na co dzień? Twoja opinia pomoże innym uczniom w wyborze, a nam w ulepszaniu kalkulatora. Zajmie ci to minutę.",
    ratingLabel: "Ocena",
    starLabel: (n) => `${n} z 5`,
    hints: ["Słabo", "Może być", "Dobrze", "Bardzo dobrze", "Rewelacja"],
    textLabel: "Twoja opinia (opcjonalnie)",
    textPlaceholder: "Co działa świetnie, a co warto poprawić?",
    nameLabel: "Podpis",
    nameHint: "Tak podpiszemy opinię na stronie, np. „Jan K.”",
    consent: "Zgadzam się na publikację opinii z imieniem i inicjałem nazwiska na kalkmate.pl",
    submit: "Wyślij opinię",
    submitting: "Wysyłanie…",
    errors: {
      invalid_rating: "Wybierz ocenę od 1 do 5 gwiazdek.",
      invalid_name: "Podpis musi mieć od 1 do 40 znaków.",
      text_too_long: "Opinia może mieć maksymalnie 1000 znaków.",
      consent_required: "Zaznacz zgodę na publikację opinii.",
      bad_request: "Coś poszło nie tak z formularzem. Odśwież stronę i spróbuj ponownie.",
      not_found: "Ten link do opinii jest nieprawidłowy albo wygasł.",
      rate_limited: "Za dużo prób. Odczekaj chwilę i spróbuj ponownie.",
      server_error: "Błąd serwera. Spróbuj ponownie za chwilę.",
      network: "Błąd sieci — sprawdź połączenie i spróbuj ponownie.",
    },
    thanksEyebrow: "/ OPINIA WYSŁANA",
    thanksTitle: "Dziękujemy!",
    thanksBody: "Twoja opinia do nas dotarła. Po krótkiej weryfikacji pojawi się na kalkmate.pl.",
    alreadyBody: "Dziękujemy, Twoja opinia już do nas dotarła.",
    refer: "Poleć znajomym — dostaną −7%",
    referNote: "Twój link polecający znajdziesz w panelu, a za każdą sprzedaną z niego sztukę dostajesz prowizję.",
    home: "Strona główna",
    invalidEyebrow: "/ LINK NIEAKTYWNY",
    invalidTitle: "Ten link nie działa.",
    invalidBody: "Link do opinii jest nieprawidłowy albo wygasł. Jeśli chcesz podzielić się opinią, napisz do nas: kontakt@kalkmate.pl.",
  },
  en: {
    eyebrow: "/ YOUR REVIEW",
    rate: "Rate",
    intro: "How does it work for you day to day? Your review helps other students choose and helps us improve the calculator. It takes a minute.",
    ratingLabel: "Rating",
    starLabel: (n) => `${n} of 5`,
    hints: ["Poor", "Okay", "Good", "Very good", "Excellent"],
    textLabel: "Your review (optional)",
    textPlaceholder: "What works great, and what could be better?",
    nameLabel: "Display name",
    nameHint: "This is how we’ll sign your review on the site, e.g. “John S.”",
    consent: "I agree to my review being published on kalkmate.pl with my first name and last-name initial",
    submit: "Send review",
    submitting: "Sending…",
    errors: {
      invalid_rating: "Pick a rating from 1 to 5 stars.",
      invalid_name: "The display name must be 1–40 characters long.",
      text_too_long: "Your review can be up to 1000 characters long.",
      consent_required: "Tick the consent to publish your review.",
      bad_request: "Something went wrong with the form. Refresh the page and try again.",
      not_found: "This review link is invalid or has expired.",
      rate_limited: "Too many attempts. Wait a moment and try again.",
      server_error: "Server error. Try again in a moment.",
      network: "Network error — check your connection and try again.",
    },
    thanksEyebrow: "/ REVIEW SENT",
    thanksTitle: "Thank you!",
    thanksBody: "We’ve got your review. After a quick check it will appear on kalkmate.pl.",
    alreadyBody: "Thank you, we’ve already received your review.",
    refer: "Recommend it to friends — they get −7%",
    referNote: "You’ll find your referral link in your account, and you earn a commission on every unit sold through it.",
    home: "Home page",
    invalidEyebrow: "/ LINK INACTIVE",
    invalidTitle: "This link doesn’t work.",
    invalidBody: "The review link is invalid or has expired. If you’d like to share your opinion, write to us: kontakt@kalkmate.pl.",
  },
  de: {
    eyebrow: "/ DEINE BEWERTUNG",
    rate: "Bewerte",
    intro: "Wie bewährt er sich im Alltag? Deine Bewertung hilft anderen Schülern bei der Wahl und uns dabei, den Rechner zu verbessern. Das dauert nur eine Minute.",
    ratingLabel: "Bewertung",
    starLabel: (n) => `${n} von 5`,
    hints: ["Schwach", "Geht so", "Gut", "Sehr gut", "Hervorragend"],
    textLabel: "Deine Bewertung (optional)",
    textPlaceholder: "Was funktioniert super und was könnte besser sein?",
    nameLabel: "Anzeigename",
    nameHint: "So unterschreiben wir deine Bewertung auf der Seite, z. B. „Max M.“",
    consent: "Ich bin einverstanden, dass meine Bewertung mit Vorname und Initiale des Nachnamens auf kalkmate.pl veröffentlicht wird",
    submit: "Bewertung senden",
    submitting: "Wird gesendet…",
    errors: {
      invalid_rating: "Wähle eine Bewertung von 1 bis 5 Sternen.",
      invalid_name: "Der Anzeigename muss 1–40 Zeichen lang sein.",
      text_too_long: "Die Bewertung darf höchstens 1000 Zeichen lang sein.",
      consent_required: "Bestätige die Einwilligung zur Veröffentlichung.",
      bad_request: "Mit dem Formular ist etwas schiefgelaufen. Lade die Seite neu und versuche es erneut.",
      not_found: "Dieser Bewertungslink ist ungültig oder abgelaufen.",
      rate_limited: "Zu viele Versuche. Warte kurz und versuche es erneut.",
      server_error: "Serverfehler. Versuche es gleich noch einmal.",
      network: "Netzwerkfehler — prüfe deine Verbindung und versuche es erneut.",
    },
    thanksEyebrow: "/ BEWERTUNG GESENDET",
    thanksTitle: "Danke!",
    thanksBody: "Deine Bewertung ist bei uns angekommen. Nach einer kurzen Prüfung erscheint sie auf kalkmate.pl.",
    alreadyBody: "Danke, deine Bewertung ist bereits bei uns angekommen.",
    refer: "Empfiehl ihn Freunden — sie bekommen −7 %",
    referNote: "Deinen Empfehlungslink findest du in deinem Konto, und für jedes darüber verkaufte Gerät bekommst du eine Provision.",
    home: "Startseite",
    invalidEyebrow: "/ LINK INAKTIV",
    invalidTitle: "Dieser Link funktioniert nicht.",
    invalidBody: "Der Bewertungslink ist ungültig oder abgelaufen. Wenn du deine Meinung teilen möchtest, schreib uns: kontakt@kalkmate.pl.",
  },
  cs: {
    eyebrow: "/ TVOJE RECENZE",
    rate: "Ohodnoť",
    intro: "Jak se osvědčuje v běžném používání? Tvoje recenze pomůže ostatním studentům při výběru a nám se zlepšováním kalkulačky. Zabere ti to minutu.",
    ratingLabel: "Hodnocení",
    starLabel: (n) => `${n} z 5`,
    hints: ["Slabé", "Ujde to", "Dobré", "Velmi dobré", "Skvělé"],
    textLabel: "Tvoje recenze (nepovinné)",
    textPlaceholder: "Co funguje skvěle a co by šlo zlepšit?",
    nameLabel: "Podpis",
    nameHint: "Takto recenzi podepíšeme na webu, např. „Jan N.“",
    consent: "Souhlasím se zveřejněním recenze s mým jménem a iniciálou příjmení na kalkmate.pl",
    submit: "Odeslat recenzi",
    submitting: "Odesílání…",
    errors: {
      invalid_rating: "Vyber hodnocení od 1 do 5 hvězdiček.",
      invalid_name: "Podpis musí mít 1–40 znaků.",
      text_too_long: "Recenze může mít nejvýše 1000 znaků.",
      consent_required: "Zaškrtni souhlas se zveřejněním recenze.",
      bad_request: "S formulářem se něco pokazilo. Obnov stránku a zkus to znovu.",
      not_found: "Tento odkaz na recenzi je neplatný nebo vypršel.",
      rate_limited: "Příliš mnoho pokusů. Chvíli počkej a zkus to znovu.",
      server_error: "Chyba serveru. Zkus to za chvíli znovu.",
      network: "Chyba sítě — zkontroluj připojení a zkus to znovu.",
    },
    thanksEyebrow: "/ RECENZE ODESLÁNA",
    thanksTitle: "Děkujeme!",
    thanksBody: "Tvoje recenze k nám dorazila. Po krátké kontrole se objeví na kalkmate.pl.",
    alreadyBody: "Děkujeme, tvoje recenze už k nám dorazila.",
    refer: "Doporuč přátelům — dostanou −7 %",
    referNote: "Svůj doporučovací odkaz najdeš v účtu a za každý přes něj prodaný kus dostaneš provizi.",
    home: "Hlavní stránka",
    invalidEyebrow: "/ NEAKTIVNÍ ODKAZ",
    invalidTitle: "Tento odkaz nefunguje.",
    invalidBody: "Odkaz na recenzi je neplatný nebo vypršel. Pokud se chceš podělit o názor, napiš nám: kontakt@kalkmate.pl.",
  },
  sk: {
    eyebrow: "/ TVOJA RECENZIA",
    rate: "Ohodnoť",
    intro: "Ako sa osvedčuje pri každodennom používaní? Tvoja recenzia pomôže ostatným študentom pri výbere a nám so zlepšovaním kalkulačky. Zaberie ti to minútu.",
    ratingLabel: "Hodnotenie",
    starLabel: (n) => `${n} z 5`,
    hints: ["Slabé", "Ujde to", "Dobré", "Veľmi dobré", "Skvelé"],
    textLabel: "Tvoja recenzia (nepovinné)",
    textPlaceholder: "Čo funguje skvele a čo by sa dalo zlepšiť?",
    nameLabel: "Podpis",
    nameHint: "Takto recenziu podpíšeme na webe, napr. „Ján N.“",
    consent: "Súhlasím so zverejnením recenzie s mojím menom a iniciálou priezviska na kalkmate.pl",
    submit: "Odoslať recenziu",
    submitting: "Odosielanie…",
    errors: {
      invalid_rating: "Vyber hodnotenie od 1 do 5 hviezdičiek.",
      invalid_name: "Podpis musí mať 1–40 znakov.",
      text_too_long: "Recenzia môže mať najviac 1000 znakov.",
      consent_required: "Zaškrtni súhlas so zverejnením recenzie.",
      bad_request: "S formulárom sa niečo pokazilo. Obnov stránku a skús to znova.",
      not_found: "Tento odkaz na recenziu je neplatný alebo vypršal.",
      rate_limited: "Príliš veľa pokusov. Chvíľu počkaj a skús to znova.",
      server_error: "Chyba servera. Skús to o chvíľu znova.",
      network: "Chyba siete — skontroluj pripojenie a skús to znova.",
    },
    thanksEyebrow: "/ RECENZIA ODOSLANÁ",
    thanksTitle: "Ďakujeme!",
    thanksBody: "Tvoja recenzia k nám dorazila. Po krátkej kontrole sa objaví na kalkmate.pl.",
    alreadyBody: "Ďakujeme, tvoja recenzia už k nám dorazila.",
    refer: "Odporuč priateľom — dostanú −7 %",
    referNote: "Svoj odporúčací odkaz nájdeš v účte a za každý cez neho predaný kus dostaneš províziu.",
    home: "Hlavná stránka",
    invalidEyebrow: "/ NEAKTÍVNY ODKAZ",
    invalidTitle: "Tento odkaz nefunguje.",
    invalidBody: "Odkaz na recenziu je neplatný alebo vypršal. Ak sa chceš podeliť o názor, napíš nám: kontakt@kalkmate.pl.",
  },
  lt: {
    eyebrow: "/ TAVO ATSILIEPIMAS",
    rate: "Įvertink",
    intro: "Kaip jis tau tinka kasdien? Tavo atsiliepimas padės kitiems mokiniams pasirinkti, o mums – tobulinti skaičiuotuvą. Tai užtruks minutę.",
    ratingLabel: "Įvertinimas",
    starLabel: (n) => `${n} iš 5`,
    hints: ["Prastai", "Neblogai", "Gerai", "Labai gerai", "Puikiai"],
    textLabel: "Tavo atsiliepimas (neprivaloma)",
    textPlaceholder: "Kas veikia puikiai, o ką vertėtų patobulinti?",
    nameLabel: "Parašas",
    nameHint: "Taip pasirašysime atsiliepimą svetainėje, pvz., „Jonas K.“",
    consent: "Sutinku, kad mano atsiliepimas būtų paskelbtas kalkmate.pl su mano vardu ir pavardės inicialu",
    submit: "Siųsti atsiliepimą",
    submitting: "Siunčiama…",
    errors: {
      invalid_rating: "Pasirink įvertinimą nuo 1 iki 5 žvaigždučių.",
      invalid_name: "Parašas turi būti 1–40 simbolių ilgio.",
      text_too_long: "Atsiliepimas gali būti ne ilgesnis nei 1000 simbolių.",
      consent_required: "Pažymėk sutikimą paskelbti atsiliepimą.",
      bad_request: "Kažkas nepavyko su forma. Atnaujink puslapį ir bandyk dar kartą.",
      not_found: "Ši atsiliepimo nuoroda neteisinga arba nebegalioja.",
      rate_limited: "Per daug bandymų. Palauk akimirką ir bandyk dar kartą.",
      server_error: "Serverio klaida. Bandyk dar kartą po akimirkos.",
      network: "Tinklo klaida — patikrink ryšį ir bandyk dar kartą.",
    },
    thanksEyebrow: "/ ATSILIEPIMAS IŠSIŲSTAS",
    thanksTitle: "Ačiū!",
    thanksBody: "Tavo atsiliepimą gavome. Po trumpo patikrinimo jis pasirodys kalkmate.pl.",
    alreadyBody: "Ačiū, tavo atsiliepimą jau gavome.",
    refer: "Rekomenduok draugams — jie gaus −7 %",
    referNote: "Savo rekomendacinę nuorodą rasi paskyroje, o už kiekvieną per ją parduotą vienetą gausi komisinį atlygį.",
    home: "Pagrindinis puslapis",
    invalidEyebrow: "/ NUORODA NEAKTYVI",
    invalidTitle: "Ši nuoroda neveikia.",
    invalidBody: "Atsiliepimo nuoroda neteisinga arba nebegalioja. Jei nori pasidalyti nuomone, parašyk mums: kontakt@kalkmate.pl.",
  },
  be: {
    eyebrow: "/ ТВОЙ ВОДГУК",
    rate: "Ацані",
    intro: "Як ён паказвае сябе кожны дзень? Твой водгук дапаможа іншым вучням з выбарам, а нам — паляпшаць калькулятар. Гэта зойме хвіліну.",
    ratingLabel: "Ацэнка",
    starLabel: (n) => `${n} з 5`,
    hints: ["Слаба", "Сярэдне", "Добра", "Вельмі добра", "Выдатна"],
    textLabel: "Твой водгук (неабавязкова)",
    textPlaceholder: "Што працуе выдатна, а што варта палепшыць?",
    nameLabel: "Подпіс",
    nameHint: "Так мы падпішам водгук на сайце, напр. «Ян К.»",
    consent: "Я згодны на публікацыю водгуку з маім імем і ініцыялам прозвішча на kalkmate.pl",
    submit: "Адправіць водгук",
    submitting: "Адпраўка…",
    errors: {
      invalid_rating: "Выберы ацэнку ад 1 да 5 зорак.",
      invalid_name: "Подпіс павінен мець ад 1 да 40 сімвалаў.",
      text_too_long: "Водгук можа мець не больш за 1000 сімвалаў.",
      consent_required: "Адзнач згоду на публікацыю водгуку.",
      bad_request: "Нешта пайшло не так з формай. Абнаві старонку і паспрабуй зноў.",
      not_found: "Гэтая спасылка на водгук няправільная або тэрмін яе дзеяння скончыўся.",
      rate_limited: "Занадта шмат спроб. Пачакай крыху і паспрабуй зноў.",
      server_error: "Памылка сервера. Паспрабуй зноў праз хвіліну.",
      network: "Памылка сеткі — правер злучэнне і паспрабуй зноў.",
    },
    thanksEyebrow: "/ ВОДГУК АДПРАЎЛЕНЫ",
    thanksTitle: "Дзякуем!",
    thanksBody: "Твой водгук да нас дайшоў. Пасля кароткай праверкі ён з’явіцца на kalkmate.pl.",
    alreadyBody: "Дзякуем, твой водгук ужо да нас дайшоў.",
    refer: "Парай сябрам — яны атрымаюць −7%",
    referNote: "Сваю рэферальную спасылку знойдзеш у акаўнце, а за кожную прададзеную праз яе штуку атрымаеш камісію.",
    home: "Галоўная старонка",
    invalidEyebrow: "/ СПАСЫЛКА НЕАКТЫЎНАЯ",
    invalidTitle: "Гэтая спасылка не працуе.",
    invalidBody: "Спасылка на водгук няправільная або тэрмін яе дзеяння скончыўся. Калі хочаш падзяліцца меркаваннем, напішы нам: kontakt@kalkmate.pl.",
  },
  es: {
    eyebrow: "/ TU OPINIÓN",
    rate: "Valora",
    intro: "¿Qué tal te funciona en el día a día? Tu opinión ayudará a otros estudiantes a elegir y a nosotros a mejorar la calculadora. Te llevará un minuto.",
    ratingLabel: "Valoración",
    starLabel: (n) => `${n} de 5`,
    hints: ["Flojo", "Regular", "Bien", "Muy bien", "Excelente"],
    textLabel: "Tu opinión (opcional)",
    textPlaceholder: "¿Qué funciona genial y qué se podría mejorar?",
    nameLabel: "Firma",
    nameHint: "Así firmaremos tu opinión en la web, p. ej. «Juan G.»",
    consent: "Acepto que mi opinión se publique en kalkmate.pl con mi nombre y la inicial de mi apellido",
    submit: "Enviar opinión",
    submitting: "Enviando…",
    errors: {
      invalid_rating: "Elige una valoración de 1 a 5 estrellas.",
      invalid_name: "La firma debe tener entre 1 y 40 caracteres.",
      text_too_long: "La opinión puede tener como máximo 1000 caracteres.",
      consent_required: "Marca el consentimiento para publicar tu opinión.",
      bad_request: "Algo ha fallado con el formulario. Recarga la página e inténtalo de nuevo.",
      not_found: "Este enlace de opinión no es válido o ha caducado.",
      rate_limited: "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
      server_error: "Error del servidor. Inténtalo de nuevo en un momento.",
      network: "Error de red — comprueba tu conexión e inténtalo de nuevo.",
    },
    thanksEyebrow: "/ OPINIÓN ENVIADA",
    thanksTitle: "¡Gracias!",
    thanksBody: "Hemos recibido tu opinión. Tras una breve revisión aparecerá en kalkmate.pl.",
    alreadyBody: "Gracias, ya hemos recibido tu opinión.",
    refer: "Recomiéndalo a tus amigos — tendrán un −7 %",
    referNote: "Encontrarás tu enlace de recomendación en tu cuenta y ganarás una comisión por cada unidad vendida con él.",
    home: "Página principal",
    invalidEyebrow: "/ ENLACE INACTIVO",
    invalidTitle: "Este enlace no funciona.",
    invalidBody: "El enlace de opinión no es válido o ha caducado. Si quieres compartir tu opinión, escríbenos: kontakt@kalkmate.pl.",
  },
  pt: {
    eyebrow: "/ A TUA OPINIÃO",
    rate: "Avalia",
    intro: "Como é que te está a correr no dia a dia? A tua opinião ajuda outros estudantes a escolher e ajuda-nos a melhorar a calculadora. Demora um minuto.",
    ratingLabel: "Avaliação",
    starLabel: (n) => `${n} de 5`,
    hints: ["Fraco", "Razoável", "Bom", "Muito bom", "Excelente"],
    textLabel: "A tua opinião (opcional)",
    textPlaceholder: "O que funciona muito bem e o que podia ser melhor?",
    nameLabel: "Assinatura",
    nameHint: "É assim que assinamos a tua opinião no site, p. ex. «João S.»",
    consent: "Concordo com a publicação da minha opinião em kalkmate.pl com o meu nome e a inicial do apelido",
    submit: "Enviar opinião",
    submitting: "A enviar…",
    errors: {
      invalid_rating: "Escolhe uma avaliação de 1 a 5 estrelas.",
      invalid_name: "A assinatura deve ter entre 1 e 40 caracteres.",
      text_too_long: "A opinião pode ter no máximo 1000 caracteres.",
      consent_required: "Assinala o consentimento para publicar a tua opinião.",
      bad_request: "Algo correu mal com o formulário. Atualiza a página e tenta novamente.",
      not_found: "Este link de opinião é inválido ou expirou.",
      rate_limited: "Demasiadas tentativas. Espera um pouco e tenta novamente.",
      server_error: "Erro do servidor. Tenta novamente daqui a pouco.",
      network: "Erro de rede — verifica a ligação e tenta novamente.",
    },
    thanksEyebrow: "/ OPINIÃO ENVIADA",
    thanksTitle: "Obrigado!",
    thanksBody: "Recebemos a tua opinião. Depois de uma breve verificação, vai aparecer em kalkmate.pl.",
    alreadyBody: "Obrigado, já recebemos a tua opinião.",
    refer: "Recomenda aos teus amigos — recebem −7 %",
    referNote: "Encontras o teu link de recomendação na tua conta e ganhas uma comissão por cada unidade vendida através dele.",
    home: "Página inicial",
    invalidEyebrow: "/ LINK INATIVO",
    invalidTitle: "Este link não funciona.",
    invalidBody: "O link de opinião é inválido ou expirou. Se quiseres partilhar a tua opinião, escreve-nos: kontakt@kalkmate.pl.",
  },
  fr: {
    eyebrow: "/ TON AVIS",
    rate: "Note",
    intro: "Comment se passe-t-il au quotidien ? Ton avis aidera d’autres élèves à choisir, et nous aidera à améliorer la calculatrice. Ça prend une minute.",
    ratingLabel: "Note",
    starLabel: (n) => `${n} sur 5`,
    hints: ["Décevant", "Correct", "Bien", "Très bien", "Excellent"],
    textLabel: "Ton avis (facultatif)",
    textPlaceholder: "Qu’est-ce qui marche super bien, et qu’est-ce qui pourrait être amélioré ?",
    nameLabel: "Signature",
    nameHint: "C’est ainsi que nous signerons ton avis sur le site, p. ex. « Jean D. »",
    consent: "J’accepte que mon avis soit publié sur kalkmate.pl avec mon prénom et l’initiale de mon nom",
    submit: "Envoyer l’avis",
    submitting: "Envoi…",
    errors: {
      invalid_rating: "Choisis une note de 1 à 5 étoiles.",
      invalid_name: "La signature doit comporter entre 1 et 40 caractères.",
      text_too_long: "L’avis peut contenir au maximum 1000 caractères.",
      consent_required: "Coche le consentement à la publication de ton avis.",
      bad_request: "Un problème est survenu avec le formulaire. Recharge la page et réessaie.",
      not_found: "Ce lien d’avis est invalide ou a expiré.",
      rate_limited: "Trop de tentatives. Attends un instant et réessaie.",
      server_error: "Erreur du serveur. Réessaie dans un instant.",
      network: "Erreur réseau — vérifie ta connexion et réessaie.",
    },
    thanksEyebrow: "/ AVIS ENVOYÉ",
    thanksTitle: "Merci !",
    thanksBody: "Nous avons bien reçu ton avis. Après une courte vérification, il apparaîtra sur kalkmate.pl.",
    alreadyBody: "Merci, nous avons déjà reçu ton avis.",
    refer: "Recommande-le à tes amis — ils ont −7 %",
    referNote: "Tu trouveras ton lien de parrainage dans ton compte, et tu touches une commission sur chaque unité vendue grâce à lui.",
    home: "Page d’accueil",
    invalidEyebrow: "/ LIEN INACTIF",
    invalidTitle: "Ce lien ne fonctionne pas.",
    invalidBody: "Le lien d’avis est invalide ou a expiré. Si tu veux partager ton avis, écris-nous : kontakt@kalkmate.pl.",
  },
  it: {
    eyebrow: "/ LA TUA RECENSIONE",
    rate: "Valuta",
    intro: "Come ti trovi nell’uso quotidiano? La tua recensione aiuterà altri studenti a scegliere e noi a migliorare la calcolatrice. Ti ci vorrà un minuto.",
    ratingLabel: "Valutazione",
    starLabel: (n) => `${n} su 5`,
    hints: ["Scarso", "Così così", "Buono", "Molto buono", "Eccellente"],
    textLabel: "La tua recensione (facoltativa)",
    textPlaceholder: "Cosa funziona benissimo e cosa si potrebbe migliorare?",
    nameLabel: "Firma",
    nameHint: "Così firmeremo la tua recensione sul sito, ad es. «Marco R.»",
    consent: "Acconsento alla pubblicazione della recensione su kalkmate.pl con il mio nome e l’iniziale del cognome",
    submit: "Invia recensione",
    submitting: "Invio in corso…",
    errors: {
      invalid_rating: "Scegli una valutazione da 1 a 5 stelle.",
      invalid_name: "La firma deve avere da 1 a 40 caratteri.",
      text_too_long: "La recensione può avere al massimo 1000 caratteri.",
      consent_required: "Spunta il consenso alla pubblicazione della recensione.",
      bad_request: "Qualcosa è andato storto con il modulo. Ricarica la pagina e riprova.",
      not_found: "Questo link per la recensione non è valido o è scaduto.",
      rate_limited: "Troppi tentativi. Aspetta un momento e riprova.",
      server_error: "Errore del server. Riprova tra un momento.",
      network: "Errore di rete — controlla la connessione e riprova.",
    },
    thanksEyebrow: "/ RECENSIONE INVIATA",
    thanksTitle: "Grazie!",
    thanksBody: "Abbiamo ricevuto la tua recensione. Dopo una breve verifica apparirà su kalkmate.pl.",
    alreadyBody: "Grazie, abbiamo già ricevuto la tua recensione.",
    refer: "Consiglialo agli amici — avranno il −7%",
    referNote: "Trovi il tuo link di invito nel tuo account e guadagni una commissione su ogni unità venduta tramite esso.",
    home: "Pagina iniziale",
    invalidEyebrow: "/ LINK NON ATTIVO",
    invalidTitle: "Questo link non funziona.",
    invalidBody: "Il link per la recensione non è valido o è scaduto. Se vuoi condividere la tua opinione, scrivici: kontakt@kalkmate.pl.",
  },
};

const ERROR_CODES: readonly ErrorCode[] = [
  "invalid_rating", "invalid_name", "text_too_long", "consent_required",
  "bad_request", "not_found", "rate_limited", "server_error",
];

function toErrorCode(v: unknown): ErrorCode {
  return typeof v === "string" && (ERROR_CODES as readonly string[]).includes(v)
    ? (v as ErrorCode)
    : "server_error";
}

const inputClass =
  "w-full bg-transparent border border-[rgba(242,237,227,0.18)] text-[#F2EDE3] placeholder-[#F2EDE3]/30 px-4 py-3.5 focus:outline-none focus:border-[#D8FF3D] transition-colors text-[15px]";

const label = "km-mono-eyebrow text-[#F2EDE3]/55 block mb-2";

function StarIcon({ filled, size = 32 }: { filled: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      aria-hidden="true"
      fill={filled ? "#D8FF3D" : "none"}
      stroke={filled ? "#D8FF3D" : "rgba(242,237,227,0.3)"}
      strokeWidth="0.6"
      strokeLinejoin="round"
    >
      <polygon points="6,1 7.5,4.5 11,4.8 8.5,7 9.3,11 6,9 2.7,11 3.5,7 1,4.8 4.5,4.5" />
    </svg>
  );
}

function StarRating({
  value,
  onChange,
  t,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  t: Dict;
  disabled: boolean;
}) {
  const [hover, setHover] = useState(0);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const shown = hover || value;

  // strzalki / Home / End jak w natywnej grupie radio
  const onKeyDown = (e: React.KeyboardEvent, n: number) => {
    let next = n;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = Math.min(5, n + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = Math.max(1, n - 1);
    else if (e.key === "Home") next = 1;
    else if (e.key === "End") next = 5;
    else return;
    e.preventDefault();
    onChange(next);
    refs.current[next - 1]?.focus();
  };

  return (
    <div>
      <span id="km-review-rating-label" className={label}>{t.ratingLabel}</span>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div
          role="radiogroup"
          aria-labelledby="km-review-rating-label"
          aria-required="true"
          className="flex -ml-1.5"
          onMouseLeave={() => setHover(0)}
        >
          {[1, 2, 3, 4, 5].map((n) => {
            const checked = value === n;
            // roving tabindex: fokus na zaznaczonej (albo pierwszej) gwiazdce
            const tabbable = value ? checked : n === 1;
            return (
              <button
                key={n}
                ref={(el) => { refs.current[n - 1] = el; }}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-label={t.starLabel(n)}
                tabIndex={tabbable ? 0 : -1}
                disabled={disabled}
                onClick={() => onChange(n)}
                onMouseEnter={() => setHover(n)}
                onKeyDown={(e) => onKeyDown(e, n)}
                className="p-1.5 rounded-sm transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#D8FF3D] disabled:cursor-not-allowed"
              >
                <StarIcon filled={n <= shown} />
              </button>
            );
          })}
        </div>
        <span className="km-mono-eyebrow text-[#D8FF3D]/80 min-h-[1em]" aria-hidden="true">
          {shown ? t.hints[shown - 1] : ""}
        </span>
      </div>
    </div>
  );
}

export default function ReviewForm({ token, lang, name, product, initialStatus }: ReviewFormProps) {
  const t = dict[lang] ?? dict.pl;
  const home = localeHome(lang);

  const [view, setView] = useState<"form" | "thanks" | "already" | "invalid">(
    initialStatus === "invalid" ? "invalid" : initialStatus === "requested" ? "form" : "already",
  );
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [displayName, setDisplayName] = useState(name.slice(0, NAME_MAX));
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [sentRating, setSentRating] = useState(0);

  const canSubmit = rating >= 1 && consent && displayName.trim().length > 0 && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch("/api/reviews/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          rating,
          text: text.trim().slice(0, TEXT_MAX),
          name: displayName.trim().slice(0, NAME_MAX),
          consent: true,
        }),
      });
      const j: { ok?: boolean; error?: string } = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        setSentRating(rating);
        setView("thanks");
      } else if (r.status === 409 || j.error === "already_submitted") {
        setView("already");
      } else if (r.status === 404 || j.error === "not_found") {
        setView("invalid");
      } else if (r.status === 429) {
        setError("rate_limited");
      } else {
        setError(toErrorCode(j.error));
      }
    } catch {
      setError("network");
    } finally {
      setSubmitting(false);
    }
  };

  const homeLink = (
    <Link
      href={home}
      className="km-mono-eyebrow text-[#F2EDE3]/55 hover:text-[#F2EDE3] transition-colors"
    >
      ← {t.home}
    </Link>
  );

  if (view === "invalid") {
    return (
      <div lang={lang}>
        <p className="km-mono-eyebrow text-[#F2EDE3]/55">{t.invalidEyebrow}</p>
        <h1 className="km-display text-[clamp(32px,6vw,48px)] mt-3 text-[#F2EDE3]">{t.invalidTitle}</h1>
        <p className="mt-5 text-[15px] leading-[1.65] text-[#F2EDE3]/65">{t.invalidBody}</p>
        <div className="mt-8">{homeLink}</div>
      </div>
    );
  }

  if (view === "thanks" || view === "already") {
    return (
      <div lang={lang} role="status">
        <p className="km-mono-eyebrow text-[#D8FF3D]">{t.thanksEyebrow}</p>
        <h1 className="km-display text-[clamp(36px,7vw,56px)] mt-3 text-[#F2EDE3]">
          <span className="italic text-[#D8FF3D]">{t.thanksTitle}</span>
        </h1>
        <p className="mt-5 text-[15px] leading-[1.65] text-[#F2EDE3]/70">
          {view === "thanks" ? t.thanksBody : t.alreadyBody}
        </p>

        {view === "thanks" && sentRating >= 4 && (
          <div className="mt-8 border border-[#D8FF3D]/40 bg-[#D8FF3D]/[0.06] p-5">
            <Link
              href="/panel?tab=affiliate"
              className="inline-flex items-center gap-2 bg-[#D8FF3D] text-[#0B0B0B] px-5 py-3 km-mono-eyebrow hover:bg-[#e4ff70] transition-colors"
            >
              {t.refer} →
            </Link>
            <p className="mt-3 text-[13px] leading-[1.6] text-[#F2EDE3]/60">{t.referNote}</p>
          </div>
        )}

        <div className="mt-8">{homeLink}</div>
      </div>
    );
  }

  return (
    <div lang={lang}>
      <p className="km-mono-eyebrow text-[#D8FF3D]">{t.eyebrow}</p>
      <h1 className="km-display text-[clamp(34px,7vw,56px)] mt-3 text-[#F2EDE3]">
        {t.rate} <span className="italic text-[#D8FF3D]">{product}</span>.
      </h1>
      <p className="mt-5 text-[15px] leading-[1.65] text-[#F2EDE3]/65">{t.intro}</p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-7" noValidate>
        <StarRating value={rating} onChange={setRating} t={t} disabled={submitting} />

        <div>
          <label htmlFor="km-review-text" className={label}>{t.textLabel}</label>
          <textarea
            id="km-review-text"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, TEXT_MAX))}
            maxLength={TEXT_MAX}
            rows={5}
            placeholder={t.textPlaceholder}
            disabled={submitting}
            aria-describedby="km-review-text-count"
            className={`${inputClass} resize-y min-h-[120px] leading-[1.6]`}
          />
          <p
            id="km-review-text-count"
            className={`km-mono-eyebrow text-[10px] mt-1.5 text-right ${
              text.length >= TEXT_MAX ? "text-[#D8FF3D]" : "text-[#F2EDE3]/40"
            }`}
            aria-live="polite"
          >
            {text.length}/{TEXT_MAX}
          </p>
        </div>

        <div>
          <label htmlFor="km-review-name" className={label}>{t.nameLabel}</label>
          <input
            id="km-review-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value.slice(0, NAME_MAX))}
            maxLength={NAME_MAX}
            required
            autoComplete="off"
            disabled={submitting}
            aria-describedby="km-review-name-hint"
            className={inputClass}
          />
          <p id="km-review-name-hint" className="text-[12px] mt-1.5 text-[#F2EDE3]/45">{t.nameHint}</p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            required
            disabled={submitting}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#D8FF3D] cursor-pointer"
          />
          <span className="text-[14px] leading-[1.55] text-[#F2EDE3]/80">{t.consent}</span>
        </label>

        {error && (
          <p role="alert" className="border border-[#ff6b6b]/40 bg-[#ff6b6b]/[0.08] px-4 py-3 text-[14px] text-[#ffb3b3]">
            {t.errors[error]}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-[#D8FF3D] text-[#0B0B0B] px-6 py-4 km-mono-eyebrow text-[12px] hover:bg-[#e4ff70] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#D8FF3D]"
        >
          {submitting ? t.submitting : t.submit}
        </button>
      </form>

      <div className="mt-8">{homeLink}</div>
    </div>
  );
}
