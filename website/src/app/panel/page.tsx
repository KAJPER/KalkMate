"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { TOKEN_PACKS } from "@/lib/tokenPacks";
import { usePanelLang } from "@/lib/usePanelLang";
import PanelLangSwitcher from "@/components/PanelLangSwitcher";
import { type Locale } from "@/lib/i18n";
import ChatInput, { type ChatDraft, type ChatInputLabels } from "./_components/ChatInput";
import { fetchJson, sendJson, type FetchJsonResult } from "./_lib/fetchJson";
import { fileToDataUrl } from "./_lib/compressImage";

// react-markdown + remark/rehype + KaTeX (JS i CSS) to najcięższa część panelu —
// ładujemy je dopiero, gdy w zakładce czatu pojawi się odpowiedź AI.
const MessageRenderer = dynamic(() => import("@/components/MessageRenderer"), {
  ssr: false,
  loading: () => <div className="h-4 w-24 bg-[#F2EDE3]/10 animate-pulse" />,
});

const DATE_LOCALE: Record<Locale, string> = {
  pl: "pl-PL",
  en: "en-GB",
  de: "de-DE",
  cs: "cs-CZ",
  sk: "sk-SK",
  lt: "lt-LT",
  be: "be-BY",
  es: "es-ES",
  pt: "pt-PT",
  fr: "fr-FR",
  it: "it-IT",
};

const TAB_IDS = ["orders", "chat", "ai", "calculator", "notes", "tests", "settings"] as const;
type TabId = (typeof TAB_IDS)[number];
const CALC_TABS: readonly TabId[] = ["calculator", "notes", "tests"];

// Dane zakładki uznajemy za świeże przez 60 s — powrót do zakładki nie odpala
// ponownie wszystkich zapytań (słabe telefony / mobilny internet).
const FRESH_MS = 60_000;
// Pakiet startowy przy rejestracji (200 tys.) — punkt odniesienia dla paska salda.
const TOKEN_REFERENCE = 200_000;
// Kod z pudełka dodaje jednorazowo 2 mln tokenów — punkt odniesienia dla
// szacunku "ile zadań" i tabelki wydajności modeli.
const LICENSE_TOKENS = 2_000_000;
const CAPTURES_PAGE = 24;

type ChatAttachment = { filename: string; mimeType: string; fileSize: number; data: string };
type ChatMessage = { role: string; content: string; attachments?: ChatAttachment[] };
type ReturnNotice = "tokens_success" | "tokens_cancelled";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const PANEL_DICT: Record<Locale, {
  // header / heading
  logout: string;
  logoutLong: string;
  newsletterTitle: string;
  newsletterDesc: string;
  newsletterOn: string;
  newsletterOff: string;
  yourPanel: string;
  greeting: (name: React.ReactNode) => React.ReactNode;
  sessionActive: string;
  loading: string;
  // tabs
  tabsOrders: string;
  tabsChat: string;
  tabsAi: string;
  tabsCalculator: string;
  tabsNotes: string;
  tabsTests: string;
  tabsSettings: string;
  // alerts / messages
  alertPaymentStart: string;
  alertNetwork: string;
  alertSaveFailed: string;
  errGeneric: string;
  pwTooShort: string;
  pwMismatch: string;
  pwChanged: string;
  emailChanged: string;
  alertNoDeviceUnpair: string;
  confirmUnpair: (id: string) => string;
  alertError: string;
  confirmDeleteNote: string;
  confirmDeleteTest: string;
  confirmDeleteConversation: string;
  errPairFailed: string;
  errNetwork: string;
  sessionExpired: string;
  fileAttached: string;
  serverError: (status: number) => string;
  tryAgain: string;
  chatNoTokens: string;
  chatNoAccess: string;
  chatTooLarge: string;
  chatOnlyImages: string;
  chatTooMany: string;
  chatUpstream: string;
  chatReadFailed: string;
  convLoadFailed: string;
  convDeleteFailed: string;
  goBuyTokens: string;
  dismiss: string;
  imgProcessing: string;
  imgTooMany: (max: number) => string;
  imgDecodeFailed: (name: string) => string;
  imgTooLarge: (name: string) => string;
  returnTokensSuccess: string;
  returnTokensCancelled: string;
  loadFailed: string;
  retry: string;
  loadMore: string;
  licenseRedeemed: string;
  licenseTokensAdded: (n: string, balance: string) => string;
  enterLicenseCode: string;
  licenseRedeemFailed: string;
  licenseRedeemError: string;
  // orders
  ordersHeading: string;
  ordersSubtitle: string;
  ordersEmpty: string;
  ordersCta: string;
  orderNo: (n: string) => string;
  statusPaid: string;
  statusPending: string;
  statusCancelled: string;
  amount: string;
  pickupPoint: string;
  shipmentStatus: string;
  shipped: string;
  awaitingShipment: string;
  trackingNumber: string;
  // chat
  chatHistories: string;
  newConversation: string;
  deleteTitle: string;
  messagesCount: (n: number) => string;
  noConversations: string;
  hideHistory: string;
  showHistory: string;
  chatTitle: string;
  chatSubtitle: string;
  newChat: string;
  chatStart: string;
  chatStartDesc: string;
  subjMath: string;
  subjMathLevel: string;
  subjPhysics: string;
  subjExtended: string;
  subjChemistry: string;
  subjBiology: string;
  copyAnswer: string;
  copied: string;
  copy: string;
  thinking: string;
  removeFile: string;
  chatPlaceholder: string;
  attachFile: string;
  send: string;
  // kod z pudełka (licencja)
  unpinning: string;
  unpin: string;
  redeemHeading: string;
  redeemDesc: string;
  licenseCodePlaceholder: string;
  redeeming: string;
  redeem: string;
  // ai tab
  tokenUsage: string;
  effectiveTokens: string;
  remaining: string;
  aiLoadFailed: string;
  tasksLeftLabel: string;
  maturaTasks: string;
  perLicenseLabel: string;
  forModel: (m: string) => string;
  defaultModel: string;
  modelPerformance: string;
  tasksAbbr: string;
  tokenEstimateNote: string;
  buyTokens: string;
  buyTokensDesc: string;
  popular: string;
  packLabel: (tokens: number) => string;
  maturaTasksApprox: string;
  redirecting: string;
  buy: string;
  aiModelHeading: string;
  aiModelDesc: string;
  aiModeHeading: string;
  maturaCke: string;
  maturaCkeTitle: string;
  rawAi: string;
  rawAiTitle: string;
  rawModeDesc: string;
  maturaModeDesc: string;
  // calculator
  pairCalculator: string;
  addYourDevice: string;
  deviceWord: string;
  pairIntro1: string;
  pairIntro2: string;
  pairIntro3: string;
  pairWarning: string;
  deviceIdLabel: string;
  unlockCodeLabel: string;
  pairing: string;
  pairButton: string;
  errorLabel: string;
  paired: string;
  deviceAdded: string;
  yourDevice: string;
  license: string;
  firmware: string;
  requests: string;
  aiModeAndModel: string;
  aiModeSetInTab: (link: React.ReactNode) => React.ReactNode;
  photoGallery: string;
  photosCount: (n: string) => string;
  noPhotos: string;
  solutionHistory: string;
  recordsCount: (n: string) => string;
  noTasksSolved: string;
  photo: string;
  close: string;
  solution: string;
  task: string;
  // notes
  calcRequired: string;
  pairFirst: (link: React.ReactNode) => React.ReactNode;
  notesOffline: (n: number) => string;
  syncToDevice: string;
  editNote: string;
  newNote: string;
  noteTitlePlaceholder: string;
  noteContentPlaceholder: string;
  cancel: string;
  saving: string;
  save: string;
  add: string;
  noNotes: string;
  noTitle: string;
  empty: string;
  edit: string;
  delete: string;
  // tests
  testsHeading: (n: number) => string;
  markdownOk: string;
  editTest: string;
  newTest: string;
  testTitlePlaceholder: string;
  testContentPlaceholder: string;
  noTests: string;
  charsCount: (n: number) => string;
  // settings
  account: string;
  loggedInAs: string;
  changePassword: string;
  currentPassword: string;
  newPassword: string;
  repeatNewPassword: string;
  changePasswordBtn: string;
  changeEmail: string;
  newEmail: string;
  confirmWithPassword: string;
  changeEmailBtn: string;
  emailChangeNote: string;
  emailChangeLogout: string;
  newsletterLoadFailed: string;
  newsletterSaveFailed: string;
  dataHeading: string;
  exportData: string;
  exportDataDesc: string;
  exporting: string;
  exportFailed: string;
  deleteAccount: string;
  deleteAccountDesc: string;
  deletePasswordPlaceholder: string;
  deleteGoogleHint: (phrase: string) => string;
  deleteAccountBtn: string;
  deleting: string;
  deleteFailed: string;
  deleteNeedConfirm: (phrase: string) => string;
  featureUnavailable: string;
  session: string;
}> = {
  pl: {
    logout: "Wyloguj ↗",
    logoutLong: "Wyloguj się ↗",
    newsletterTitle: "/ Newsletter",
    newsletterDesc: "Informacje o nowościach, promocjach i kuponach KalkMate e-mailem. Zgodę możesz wycofać w każdej chwili — maile o zamówieniach i koncie przychodzą niezależnie.",
    newsletterOn: "Zapisany ✓ — kliknij, aby się wypisać",
    newsletterOff: "Zapisz mnie na newsletter",
    yourPanel: "[ 00 ] · Twój panel",
    greeting: (n) => <>Witaj, {n}.</>,
    sessionActive: "Sesja aktywna",
    loading: "Ładowanie...",
    tabsOrders: "Zamówienia",
    tabsChat: "AI Chat",
    tabsAi: "AI",
    tabsCalculator: "Kalkulator",
    tabsNotes: "Notatki",
    tabsTests: "Sprawdziany",
    tabsSettings: "Ustawienia konta",
    alertPaymentStart: "Nie udało się rozpocząć płatności",
    alertNetwork: "Błąd sieci",
    alertSaveFailed: "Nie udało się zapisać",
    errGeneric: "Błąd",
    pwTooShort: "Nowe hasło musi mieć min. 6 znaków",
    pwMismatch: "Hasła nie są takie same",
    pwChanged: "Hasło zostało zmienione.",
    emailChanged: "Wysłaliśmy link na nowy adres — zmiana nastąpi po jego kliknięciu.",
    alertNoDeviceUnpair: "Brak urządzenia do odpięcia.",
    confirmUnpair: (id) => `Odpiąć urządzenie ${id}? Będzie można je sparować ponownie.`,
    alertError: "Błąd",
    confirmDeleteNote: "Usunąć notatkę?",
    confirmDeleteTest: "Usunąć sprawdzian?",
    confirmDeleteConversation: "Czy na pewno chcesz usunąć tę konwersację?",
    errPairFailed: "Nie udało się sparować",
    errNetwork: "Błąd sieci — sprawdź połączenie z internetem.",
    sessionExpired: "Sesja wygasła — zaloguj się ponownie.",
    fileAttached: "(plik załączony)",
    serverError: (s) => `Błąd serwera (${s})`,
    tryAgain: "Spróbuj ponownie.",
    chatNoTokens: "Skończyły się tokeny AI. Dokup paczkę tokenów albo aktywuj kod z pudełka, aby kontynuować.",
    chatNoAccess: "Brak dostępu do AI na tym koncie. Sprawdź saldo tokenów — jeśli problem się powtarza, napisz do nas: kontakt@kalkmate.pl.",
    chatTooLarge: "Zdjęcie jest za duże. Usuń je lub dołącz mniejsze (maks. 4 zdjęcia).",
    chatOnlyImages: "Można dołączać tylko zdjęcia (JPG, PNG, WebP).",
    chatTooMany: "Za dużo zapytań. Poczekaj chwilę i spróbuj ponownie.",
    chatUpstream: "Serwer AI chwilowo nie odpowiada. Twoja wiadomość wróciła do pola — spróbuj ponownie za chwilę.",
    chatReadFailed: "Nie udało się odczytać załączonego zdjęcia.",
    convLoadFailed: "Nie udało się wczytać konwersacji.",
    convDeleteFailed: "Nie udało się usunąć konwersacji.",
    goBuyTokens: "Kup tokeny →",
    dismiss: "Zamknij",
    imgProcessing: "Zmniejszam zdjęcie…",
    imgTooMany: (m) => `Maks. ${m} zdjęcia na wiadomość.`,
    imgDecodeFailed: (n) => `Nie udało się odczytać zdjęcia „${n}”.`,
    imgTooLarge: (n) => `Zdjęcie „${n}” jest za duże nawet po zmniejszeniu.`,
    returnTokensSuccess: "Płatność przyjęta — tokeny pojawią się na koncie w ciągu kilku chwil.",
    returnTokensCancelled: "Płatność za tokeny została anulowana.",
    loadFailed: "Nie udało się wczytać danych.",
    retry: "Spróbuj ponownie",
    loadMore: "Pokaż więcej",
    licenseRedeemed: "Kod został aktywowany.",
    licenseTokensAdded: (n, b) => `Kod aktywowany — dodano ${n} tokenów. Saldo: ${b}.`,
    enterLicenseCode: "Wprowadź kod z pudełka",
    licenseRedeemFailed: "Nie udało się aktywować kodu",
    licenseRedeemError: "Wystąpił błąd podczas aktywacji kodu",
    ordersHeading: "Historia zamówień",
    ordersSubtitle: "Twoje zamówienia i status wysyłek",
    ordersEmpty: "Nie masz jeszcze żadnych zamówień",
    ordersCta: "Zamów KalkMate",
    orderNo: (n) => `Zamówienie #${n}`,
    statusPaid: "✓ Opłacone",
    statusPending: "⏳ Oczekuje",
    statusCancelled: "✗ Anulowane",
    amount: "Kwota",
    pickupPoint: "Punkt odbioru",
    shipmentStatus: "Status wysyłki",
    shipped: "📦 Wysłane",
    awaitingShipment: "⏰ Oczekuje",
    trackingNumber: "Numer przesyłki",
    chatHistories: "Historie",
    newConversation: "Nowa konwersacja",
    deleteTitle: "Usuń",
    messagesCount: (n) => `${n} wiadomości`,
    noConversations: "Brak konwersacji",
    hideHistory: "Ukryj historię",
    showHistory: "Pokaż historię",
    chatTitle: "AI Chat - KalkMate Pro",
    chatSubtitle: "Rozwiązuj zadania z matematyki, fizyki, chemii i biologii",
    newChat: "Nowy chat",
    chatStart: "Rozpocznij rozmowę z AI",
    chatStartDesc: "Wklej treść zadania z matematyki, fizyki, chemii lub biologii, a AI pomoże Ci je rozwiązać krok po kroku",
    subjMath: "Matematyka",
    subjMathLevel: "Podstawowy i rozszerzony",
    subjPhysics: "Fizyka",
    subjExtended: "Poziom rozszerzony",
    subjChemistry: "Chemia",
    subjBiology: "Biologia",
    copyAnswer: "Kopiuj odpowiedź",
    copied: "Skopiowano",
    copy: "Kopiuj",
    thinking: "Myślę...",
    removeFile: "Usuń",
    chatPlaceholder: "Wklej treść zadania lub dołącz zdjęcie (Ctrl+V działa też dla obrazów)...",
    attachFile: "Dołącz zdjęcie (maks. 4)",
    send: "Wyślij",
    unpinning: "Odpinanie...",
    unpin: "Odepnij",
    redeemHeading: "Aktywuj kod z pudełka (+2 mln tokenów)",
    redeemDesc: "Kod licencji znajdziesz w pudełku kalkulatora. Aktywacja jednorazowo dodaje 2 000 000 tokenów AI do Twojego salda.",
    licenseCodePlaceholder: "abcd123-+=%abcd",
    redeeming: "Aktywuję...",
    redeem: "Aktywuj",
    tokenUsage: "/ Saldo tokenów",
    effectiveTokens: "efektywnych tokenów na koncie",
    remaining: "POZOSTAŁO",
    aiLoadFailed: "Nie udało się wczytać ustawień AI i salda tokenów.",
    tasksLeftLabel: "Zadań zostało",
    maturaTasks: "zadań",
    perLicenseLabel: "Na 2 mln tokenów",
    forModel: (m) => `dla modelu ${m}`,
    defaultModel: "domyślnego",
    modelPerformance: "WYDAJNOŚĆ MODELI — ile zadań z 2 mln tokenów",
    tasksAbbr: "zad.",
    tokenEstimateNote: "Szacunek dla typowego zadania (~800 realnych tokenów wejście + odpowiedź). Bez abonamentu — gdy saldo się skończy, dokup paczkę poniżej.",
    buyTokens: "/ Kup tokeny",
    buyTokensDesc: "Doładuj saldo tokenów. Płatność jednorazowa (karta / BLIK / Przelewy24) — tokeny dodają się od razu po opłaceniu.",
    popular: "POPULARNY",
    packLabel: (t) => `${t / 1_000_000} mln tokenów`,
    maturaTasksApprox: "zadań",
    redirecting: "Przekierowanie...",
    buy: "Kup",
    aiModelHeading: "/ Model AI",
    aiModelDesc: "Wybierz model. Mnożnik (×) pokazuje ile efektywnych tokenów kosztuje jedno zapytanie w stosunku do najtańszego.",
    aiModeHeading: "/ Tryb AI",
    maturaCke: "Egzamin",
    maturaCkeTitle: "Tryb egzaminacyjny (matematyka, fizyka, chemia, biologia)",
    rawAi: "Czysty AI",
    rawAiTitle: "Tryb uniwersalny — dowolny przedmiot (elektronika, informatyka, języki...)",
    rawModeDesc: "Tryb uniwersalny — AI działa dla elektroniki, informatyki, języków i innych.",
    maturaModeDesc: "Tryb egzaminacyjny — AI odpowiada krok po kroku (matematyka/fizyka/chemia/biologia).",
    pairCalculator: "Sparuj kalkulator",
    addYourDevice: "Dodaj swoje",
    deviceWord: "urządzenie",
    pairIntro1: "Wpisz ",
    pairIntro2: " z kalkulatora (Ustawienia → WiFi i konto → Device ID + QR) oraz ",
    pairIntro3: " (Ustawienia → Bezpieczeństwo → Kod AI).",
    pairWarning: "⚠ Kalkulator musi być najpierw połączony z WiFi i zgłosić się do serwera.",
    deviceIdLabel: "Device ID (MAC)",
    unlockCodeLabel: "Kod odblokowania",
    pairing: "Parowanie...",
    pairButton: "Sparuj urządzenie",
    errorLabel: "/ ERROR",
    paired: "✓ Sparowano",
    deviceAdded: "Urządzenie dodane do konta.",
    yourDevice: "Twoje",
    license: "Licencja",
    firmware: "Firmware",
    requests: "Zapytań",
    aiModeAndModel: "/ Tryb AI i model",
    aiModeSetInTab: (link) => <>Model AI oraz tryb (Egzamin / Czysty AI) ustawisz w zakładce {link}.</>,
    photoGallery: "/ Galeria zdjęć",
    photosCount: (n) => `${n} ZDJĘĆ`,
    noPhotos: "Brak zdjęć. Zrób kamerą zdjęcie zadania w kalkulatorze.",
    solutionHistory: "/ Historia rozwiązań",
    recordsCount: (n) => `${n} REKORDÓW`,
    noTasksSolved: "Żadnych zadań jeszcze nie rozwiązano.",
    photo: "📷 Zdjęcie",
    close: "Zamknij ×",
    solution: "/ Rozwiązanie",
    task: "Zadanie",
    calcRequired: "/ wymagany kalkulator",
    pairFirst: (link) => <>Najpierw sparuj kalkulator w zakładce {link}.</>,
    notesOffline: (n) => `Notatki offline (${n}/50)`,
    syncToDevice: "Synchronizacja z urządzeniem przez WiFi",
    editNote: "Edytuj notatkę",
    newNote: "Nowa notatka",
    noteTitlePlaceholder: "Tytuł (maks. 60 znaków)",
    noteContentPlaceholder: "Treść (maks. 4000 znaków – wzory, definicje)",
    cancel: "Anuluj",
    saving: "Zapisuję...",
    save: "Zapisz",
    add: "Dodaj",
    noNotes: "Brak notatek.",
    noTitle: "(bez tytułu)",
    empty: "(pusta)",
    edit: "Edytuj",
    delete: "Usuń",
    testsHeading: (n) => `Sprawdziany (${n}/50)`,
    markdownOk: "Markdown/LaTeX OK",
    editTest: "Edytuj sprawdzian",
    newTest: "Nowy sprawdzian",
    testTitlePlaceholder: "Tytuł (np. Matma 2026 – próbna 1)",
    testContentPlaceholder: "Wklej tutaj rozwiązanie (markdown, LaTeX, $..$, **pogrubienie**...)",
    noTests: "Brak sprawdzianów.",
    charsCount: (n) => `${n} znaków`,
    account: "/ Konto",
    loggedInAs: "Zalogowany jako",
    changePassword: "/ Zmiana hasła",
    currentPassword: "Aktualne hasło",
    newPassword: "Nowe hasło (min. 6 znaków)",
    repeatNewPassword: "Powtórz nowe hasło",
    changePasswordBtn: "Zmień hasło",
    changeEmail: "/ Zmiana adresu email",
    newEmail: "Nowy adres email",
    confirmWithPassword: "Potwierdź hasłem",
    changeEmailBtn: "Zmień email",
    emailChangeNote: "Wyślemy link potwierdzający na nowy adres — zmiana nastąpi dopiero po jego kliknięciu.",
    emailChangeLogout: "Email zmieniony. Za chwilę nastąpi wylogowanie...",
    newsletterLoadFailed: "Nie udało się wczytać statusu newslettera.",
    newsletterSaveFailed: "Nie udało się zapisać zgody na newsletter.",
    dataHeading: "/ Twoje dane",
    exportData: "Pobierz moje dane",
    exportDataDesc: "Plik JSON ze wszystkimi danymi powiązanymi z Twoim kontem (RODO, art. 20).",
    exporting: "Przygotowuję…",
    exportFailed: "Nie udało się pobrać danych.",
    deleteAccount: "Usuń konto",
    deleteAccountDesc: "Trwale usuwa konto, historię czatów, notatki, sprawdziany i powiązanie z kalkulatorem. Tej operacji nie da się cofnąć.",
    deletePasswordPlaceholder: "Hasło do konta",
    deleteGoogleHint: (p) => `Logujesz się przez Google (bez hasła)? Zostaw hasło puste i wpisz poniżej: ${p}`,
    deleteAccountBtn: "Usuń konto na zawsze",
    deleting: "Usuwam…",
    deleteFailed: "Nie udało się usunąć konta.",
    deleteNeedConfirm: (p) => `Podaj hasło albo wpisz „${p}”, aby potwierdzić.`,
    featureUnavailable: "Ta funkcja nie jest jeszcze dostępna — spróbuj później lub napisz do nas.",
    session: "/ Sesja",
  },
  en: {
    logout: "Log out ↗",
    logoutLong: "Log out ↗",
    newsletterTitle: "/ Newsletter",
    newsletterDesc: "KalkMate news, promotions and coupons by email. You can withdraw at any time — order and account emails are sent regardless.",
    newsletterOn: "Subscribed ✓ — click to unsubscribe",
    newsletterOff: "Subscribe to the newsletter",
    yourPanel: "[ 00 ] · Your panel",
    greeting: (n) => <>Welcome, {n}.</>,
    sessionActive: "Session active",
    loading: "Loading...",
    tabsOrders: "Orders",
    tabsChat: "AI Chat",
    tabsAi: "AI",
    tabsCalculator: "Calculator",
    tabsNotes: "Notes",
    tabsTests: "Tests",
    tabsSettings: "Account settings",
    alertPaymentStart: "Could not start the payment",
    alertNetwork: "Network error",
    alertSaveFailed: "Could not save",
    errGeneric: "Error",
    pwTooShort: "New password must be at least 6 characters",
    pwMismatch: "Passwords do not match",
    pwChanged: "Password has been changed.",
    emailChanged: "We sent a link to the new address — the change takes effect once you click it.",
    alertNoDeviceUnpair: "No device to unpair.",
    confirmUnpair: (id) => `Unpair device ${id}? You will be able to pair it again.`,
    alertError: "Error",
    confirmDeleteNote: "Delete note?",
    confirmDeleteTest: "Delete test?",
    confirmDeleteConversation: "Are you sure you want to delete this conversation?",
    errPairFailed: "Could not pair",
    errNetwork: "Network error — check your internet connection.",
    sessionExpired: "Your session has expired — please sign in again.",
    fileAttached: "(file attached)",
    serverError: (s) => `Server error (${s})`,
    tryAgain: "Please try again.",
    chatNoTokens: "You've run out of AI tokens. Buy a token pack or activate the code from the box to continue.",
    chatNoAccess: "AI access is unavailable on this account. Check your token balance — if the problem persists, contact us at kontakt@kalkmate.pl.",
    chatTooLarge: "The image is too large. Remove it or attach a smaller one (max 4 images).",
    chatOnlyImages: "Only images can be attached (JPG, PNG, WebP).",
    chatTooMany: "Too many requests. Wait a moment and try again.",
    chatUpstream: "The AI server is not responding right now. Your message is back in the input — try again shortly.",
    chatReadFailed: "Could not read the attached image.",
    convLoadFailed: "Could not load the conversation.",
    convDeleteFailed: "Could not delete the conversation.",
    goBuyTokens: "Buy tokens →",
    dismiss: "Close",
    imgProcessing: "Resizing image…",
    imgTooMany: (m) => `Max ${m} images per message.`,
    imgDecodeFailed: (n) => `Could not read image "${n}".`,
    imgTooLarge: (n) => `Image "${n}" is too large even after resizing.`,
    returnTokensSuccess: "Payment received — tokens will appear in your account within a few moments.",
    returnTokensCancelled: "The token payment was cancelled.",
    loadFailed: "Could not load data.",
    retry: "Try again",
    loadMore: "Show more",
    licenseRedeemed: "The code has been activated.",
    licenseTokensAdded: (n, b) => `Code activated — ${n} tokens added. Balance: ${b}.`,
    enterLicenseCode: "Enter the code from the box",
    licenseRedeemFailed: "Could not activate the code",
    licenseRedeemError: "An error occurred while activating the code",
    ordersHeading: "Order history",
    ordersSubtitle: "Your orders and shipping status",
    ordersEmpty: "You don't have any orders yet",
    ordersCta: "Order KalkMate",
    orderNo: (n) => `Order #${n}`,
    statusPaid: "✓ Paid",
    statusPending: "⏳ Pending",
    statusCancelled: "✗ Cancelled",
    amount: "Amount",
    pickupPoint: "Pickup point",
    shipmentStatus: "Shipping status",
    shipped: "📦 Shipped",
    awaitingShipment: "⏰ Pending",
    trackingNumber: "Tracking number",
    chatHistories: "History",
    newConversation: "New conversation",
    deleteTitle: "Delete",
    messagesCount: (n) => `${n} messages`,
    noConversations: "No conversations",
    hideHistory: "Hide history",
    showHistory: "Show history",
    chatTitle: "AI Chat - KalkMate Pro",
    chatSubtitle: "Solve problems in math, physics, chemistry and biology",
    newChat: "New chat",
    chatStart: "Start a conversation with the AI",
    chatStartDesc: "Paste a math, physics, chemistry or biology problem and the AI will help you solve it step by step",
    subjMath: "Mathematics",
    subjMathLevel: "Basic and extended",
    subjPhysics: "Physics",
    subjExtended: "Extended level",
    subjChemistry: "Chemistry",
    subjBiology: "Biology",
    copyAnswer: "Copy answer",
    copied: "Copied",
    copy: "Copy",
    thinking: "Thinking...",
    removeFile: "Remove",
    chatPlaceholder: "Paste your problem or attach a photo (Ctrl+V works for images too)...",
    attachFile: "Attach image (max 4)",
    send: "Send",
    unpinning: "Unpinning...",
    unpin: "Unpin",
    redeemHeading: "Activate the code from the box (+2M tokens)",
    redeemDesc: "You'll find the license code in the calculator box. Activating it adds 2,000,000 AI tokens to your balance (one-time).",
    licenseCodePlaceholder: "abcd123-+=%abcd",
    redeeming: "Activating...",
    redeem: "Activate",
    tokenUsage: "/ Token balance",
    effectiveTokens: "effective tokens in your account",
    remaining: "REMAINING",
    aiLoadFailed: "Could not load AI settings and token balance.",
    tasksLeftLabel: "Tasks left",
    maturaTasks: "exam problems",
    perLicenseLabel: "Per 2M tokens",
    forModel: (m) => `for model ${m}`,
    defaultModel: "default",
    modelPerformance: "MODEL EFFICIENCY — tasks per 2M tokens",
    tasksAbbr: "tasks",
    tokenEstimateNote: "Estimate for a typical exam problem (~800 real tokens input + answer). No subscription — when your balance runs out, top up with a pack below.",
    buyTokens: "/ Buy tokens",
    buyTokensDesc: "Top up your token balance. One-time payment (card / BLIK / Przelewy24) — tokens are added immediately after payment.",
    popular: "POPULAR",
    packLabel: (t) => `${t / 1_000_000}M tokens`,
    maturaTasksApprox: "exam problems",
    redirecting: "Redirecting...",
    buy: "Buy",
    aiModelHeading: "/ AI Model",
    aiModelDesc: "Choose a model. The multiplier (×) shows how many effective tokens one query costs relative to the cheapest one.",
    aiModeHeading: "/ AI Mode",
    maturaCke: "Exam mode",
    maturaCkeTitle: "Specialized prompt for exam problems (math, physics, chemistry, biology)",
    rawAi: "Raw AI",
    rawAiTitle: "Universal mode — any subject (electronics, IT, languages...)",
    rawModeDesc: "Universal mode — the AI works for electronics, IT, languages and more.",
    maturaModeDesc: "Exam mode — the AI answers step by step (math/physics/chemistry/biology).",
    pairCalculator: "Pair calculator",
    addYourDevice: "Add your",
    deviceWord: "device",
    pairIntro1: "Enter the ",
    pairIntro2: " from the calculator (Settings → WiFi & account → Device ID + QR) and the ",
    pairIntro3: " (Settings → Security → AI code).",
    pairWarning: "⚠ The calculator must first be connected to WiFi and report to the server.",
    deviceIdLabel: "Device ID (MAC)",
    unlockCodeLabel: "Unlock code",
    pairing: "Pairing...",
    pairButton: "Pair device",
    errorLabel: "/ ERROR",
    paired: "✓ Paired",
    deviceAdded: "Device added to your account.",
    yourDevice: "Your",
    license: "License",
    firmware: "Firmware",
    requests: "Requests",
    aiModeAndModel: "/ AI mode and model",
    aiModeSetInTab: (link) => <>Set the AI model and mode (Exam / Raw AI) in the {link} tab.</>,
    photoGallery: "/ Photo gallery",
    photosCount: (n) => `${n} PHOTOS`,
    noPhotos: "No photos. Take a photo of a problem with the calculator's camera.",
    solutionHistory: "/ Solution history",
    recordsCount: (n) => `${n} RECORDS`,
    noTasksSolved: "No problems solved yet.",
    photo: "📷 Photo",
    close: "Close ×",
    solution: "/ Solution",
    task: "Problem",
    calcRequired: "/ calculator required",
    pairFirst: (link) => <>First pair the calculator in the {link} tab.</>,
    notesOffline: (n) => `Offline notes (${n}/50)`,
    syncToDevice: "Syncs to device over WiFi",
    editNote: "Edit note",
    newNote: "New note",
    noteTitlePlaceholder: "Title (max 60 chars)",
    noteContentPlaceholder: "Content (max 4000 chars - formulas, definitions)",
    cancel: "Cancel",
    saving: "Saving...",
    save: "Save",
    add: "Add",
    noNotes: "No notes.",
    noTitle: "(no title)",
    empty: "(empty)",
    edit: "Edit",
    delete: "Delete",
    testsHeading: (n) => `Tests (${n}/50)`,
    markdownOk: "Markdown/LaTeX OK",
    editTest: "Edit test",
    newTest: "New test",
    testTitlePlaceholder: "Title (e.g. Math 2026 - mock 1)",
    testContentPlaceholder: "Paste the solution here (markdown, LaTeX, $..$, **bold**...)",
    noTests: "No tests.",
    charsCount: (n) => `${n} chars`,
    account: "/ Account",
    loggedInAs: "Logged in as",
    changePassword: "/ Change password",
    currentPassword: "Current password",
    newPassword: "New password (min. 6 chars)",
    repeatNewPassword: "Repeat new password",
    changePasswordBtn: "Change password",
    changeEmail: "/ Change email address",
    newEmail: "New email address",
    confirmWithPassword: "Confirm with password",
    changeEmailBtn: "Change email",
    emailChangeNote: "We will send a confirmation link to the new address — the change only takes effect after you click it.",
    emailChangeLogout: "Email changed. You will be logged out shortly...",
    newsletterLoadFailed: "Could not load the newsletter status.",
    newsletterSaveFailed: "Could not save the newsletter consent.",
    dataHeading: "/ Your data",
    exportData: "Download my data",
    exportDataDesc: "A JSON file with all data linked to your account (GDPR, Art. 20).",
    exporting: "Preparing…",
    exportFailed: "Could not download your data.",
    deleteAccount: "Delete account",
    deleteAccountDesc: "Permanently deletes your account, chat history, notes, tests and the calculator link. This cannot be undone.",
    deletePasswordPlaceholder: "Account password",
    deleteGoogleHint: (p) => `Signing in with Google (no password)? Leave the password empty and type: ${p}`,
    deleteAccountBtn: "Delete account forever",
    deleting: "Deleting…",
    deleteFailed: "Could not delete the account.",
    deleteNeedConfirm: (p) => `Enter your password or type "${p}" to confirm.`,
    featureUnavailable: "This feature is not available yet — please try later or contact us.",
    session: "/ Session",
  },
  de: {
    logout: "Abmelden ↗",
    logoutLong: "Abmelden ↗",
    newsletterTitle: "/ Newsletter",
    newsletterDesc: "Neuigkeiten, Aktionen und Gutscheine von KalkMate per E-Mail. Widerruf jederzeit möglich — Bestell- und Kontomails kommen unabhängig davon.",
    newsletterOn: "Abonniert ✓ — klicken zum Abmelden",
    newsletterOff: "Newsletter abonnieren",
    yourPanel: "[ 00 ] · Dein Panel",
    greeting: (n) => <>Willkommen, {n}.</>,
    sessionActive: "Sitzung aktiv",
    loading: "Lädt...",
    tabsOrders: "Bestellungen",
    tabsChat: "AI Chat",
    tabsAi: "AI",
    tabsCalculator: "Rechner",
    tabsNotes: "Notizen",
    tabsTests: "Klassenarbeiten",
    tabsSettings: "Kontoeinstellungen",
    alertPaymentStart: "Zahlung konnte nicht gestartet werden",
    alertNetwork: "Netzwerkfehler",
    alertSaveFailed: "Speichern fehlgeschlagen",
    errGeneric: "Fehler",
    pwTooShort: "Das neue Passwort muss mindestens 6 Zeichen haben",
    pwMismatch: "Die Passwörter stimmen nicht überein",
    pwChanged: "Passwort wurde geändert.",
    emailChanged: "Wir haben einen Link an die neue Adresse gesendet — die Änderung gilt, sobald du ihn anklickst.",
    alertNoDeviceUnpair: "Kein Gerät zum Entkoppeln.",
    confirmUnpair: (id) => `Gerät ${id} entkoppeln? Du kannst es erneut koppeln.`,
    alertError: "Fehler",
    confirmDeleteNote: "Notiz löschen?",
    confirmDeleteTest: "Klassenarbeit löschen?",
    confirmDeleteConversation: "Möchtest du diese Unterhaltung wirklich löschen?",
    errPairFailed: "Koppeln fehlgeschlagen",
    errNetwork: "Netzwerkfehler — prüfe deine Internetverbindung.",
    sessionExpired: "Deine Sitzung ist abgelaufen — bitte melde dich erneut an.",
    fileAttached: "(Datei angehängt)",
    serverError: (s) => `Serverfehler (${s})`,
    tryAgain: "Bitte versuche es erneut.",
    chatNoTokens: "Deine KI-Tokens sind aufgebraucht. Kaufe ein Token-Paket oder aktiviere den Code aus der Verpackung, um fortzufahren.",
    chatNoAccess: "Für dieses Konto ist kein KI-Zugang verfügbar. Prüfe dein Token-Guthaben — wenn das Problem bleibt, schreib uns: kontakt@kalkmate.pl.",
    chatTooLarge: "Das Bild ist zu groß. Entferne es oder hänge ein kleineres an (max. 4 Bilder).",
    chatOnlyImages: "Es können nur Bilder angehängt werden (JPG, PNG, WebP).",
    chatTooMany: "Zu viele Anfragen. Warte kurz und versuche es erneut.",
    chatUpstream: "Der AI-Server antwortet gerade nicht. Deine Nachricht ist wieder im Eingabefeld — versuche es gleich erneut.",
    chatReadFailed: "Das angehängte Bild konnte nicht gelesen werden.",
    convLoadFailed: "Die Unterhaltung konnte nicht geladen werden.",
    convDeleteFailed: "Die Unterhaltung konnte nicht gelöscht werden.",
    goBuyTokens: "Tokens kaufen →",
    dismiss: "Schließen",
    imgProcessing: "Bild wird verkleinert…",
    imgTooMany: (m) => `Max. ${m} Bilder pro Nachricht.`,
    imgDecodeFailed: (n) => `Bild „${n}“ konnte nicht gelesen werden.`,
    imgTooLarge: (n) => `Bild „${n}“ ist auch nach dem Verkleinern zu groß.`,
    returnTokensSuccess: "Zahlung erhalten — die Tokens erscheinen in wenigen Augenblicken auf deinem Konto.",
    returnTokensCancelled: "Die Token-Zahlung wurde abgebrochen.",
    loadFailed: "Daten konnten nicht geladen werden.",
    retry: "Erneut versuchen",
    loadMore: "Mehr anzeigen",
    licenseRedeemed: "Der Code wurde aktiviert.",
    licenseTokensAdded: (n, b) => `Code aktiviert — ${n} Tokens hinzugefügt. Guthaben: ${b}.`,
    enterLicenseCode: "Code aus der Verpackung eingeben",
    licenseRedeemFailed: "Der Code konnte nicht aktiviert werden",
    licenseRedeemError: "Beim Aktivieren des Codes ist ein Fehler aufgetreten",
    ordersHeading: "Bestellverlauf",
    ordersSubtitle: "Deine Bestellungen und der Versandstatus",
    ordersEmpty: "Du hast noch keine Bestellungen",
    ordersCta: "KalkMate bestellen",
    orderNo: (n) => `Bestellung #${n}`,
    statusPaid: "✓ Bezahlt",
    statusPending: "⏳ Ausstehend",
    statusCancelled: "✗ Storniert",
    amount: "Betrag",
    pickupPoint: "Abholpunkt",
    shipmentStatus: "Versandstatus",
    shipped: "📦 Versandt",
    awaitingShipment: "⏰ Ausstehend",
    trackingNumber: "Sendungsnummer",
    chatHistories: "Verlauf",
    newConversation: "Neue Unterhaltung",
    deleteTitle: "Löschen",
    messagesCount: (n) => `${n} Nachrichten`,
    noConversations: "Keine Unterhaltungen",
    hideHistory: "Verlauf ausblenden",
    showHistory: "Verlauf anzeigen",
    chatTitle: "AI Chat - KalkMate Pro",
    chatSubtitle: "Löse Aufgaben in Mathe, Physik, Chemie und Biologie",
    newChat: "Neuer Chat",
    chatStart: "Starte ein Gespräch mit der KI",
    chatStartDesc: "Füge eine Mathe-, Physik-, Chemie- oder Biologieaufgabe ein, und die KI hilft dir, sie Schritt für Schritt zu lösen",
    subjMath: "Mathematik",
    subjMathLevel: "Grund- und Leistungskurs",
    subjPhysics: "Physik",
    subjExtended: "Leistungskurs",
    subjChemistry: "Chemie",
    subjBiology: "Biologie",
    copyAnswer: "Antwort kopieren",
    copied: "Kopiert",
    copy: "Kopieren",
    thinking: "Ich denke nach...",
    removeFile: "Entfernen",
    chatPlaceholder: "Aufgabe einfügen oder Foto anhängen (Strg+V funktioniert auch für Bilder)...",
    attachFile: "Bild anhängen (max. 4)",
    send: "Senden",
    unpinning: "Wird entkoppelt...",
    unpin: "Entkoppeln",
    redeemHeading: "Code aus der Verpackung aktivieren (+2 Mio. Tokens)",
    redeemDesc: "Den Lizenzcode findest du in der Verpackung des Rechners. Die Aktivierung fügt deinem Guthaben einmalig 2.000.000 KI-Tokens hinzu.",
    licenseCodePlaceholder: "abcd123-+=%abcd",
    redeeming: "Wird aktiviert...",
    redeem: "Aktivieren",
    tokenUsage: "/ Token-Guthaben",
    effectiveTokens: "effektive Tokens auf deinem Konto",
    remaining: "VERBLEIBEND",
    aiLoadFailed: "AI-Einstellungen und Token-Guthaben konnten nicht geladen werden.",
    tasksLeftLabel: "Aufgaben übrig",
    maturaTasks: "Prüfungsaufgaben",
    perLicenseLabel: "Pro 2 Mio. Tokens",
    forModel: (m) => `für Modell ${m}`,
    defaultModel: "Standard",
    modelPerformance: "MODELL-EFFIZIENZ — Aufgaben pro 2 Mio. Tokens",
    tasksAbbr: "Aufg.",
    tokenEstimateNote: "Schätzung für eine typische Prüfungsaufgabe (~800 echte Tokens Eingabe + Antwort). Kein Abo — wenn dein Guthaben aufgebraucht ist, lade unten ein Paket nach.",
    buyTokens: "/ Tokens kaufen",
    buyTokensDesc: "Lade dein Token-Guthaben auf. Einmalzahlung (Karte / BLIK / Przelewy24) — Tokens werden sofort nach der Zahlung gutgeschrieben.",
    popular: "BELIEBT",
    packLabel: (t) => `${t / 1_000_000} Mio. Tokens`,
    maturaTasksApprox: "Prüfungsaufgaben",
    redirecting: "Weiterleitung...",
    buy: "Kaufen",
    aiModelHeading: "/ AI-Modell",
    aiModelDesc: "Wähle ein Modell. Der Multiplikator (×) zeigt, wie viele effektive Tokens eine Anfrage im Vergleich zum günstigsten kostet.",
    aiModeHeading: "/ AI-Modus",
    maturaCke: "Prüfungsmodus",
    maturaCkeTitle: "Spezialisierter Prompt für Prüfungsaufgaben (Mathe, Physik, Chemie, Biologie)",
    rawAi: "Reines AI",
    rawAiTitle: "Universeller Modus — beliebiges Fach (Elektronik, Informatik, Sprachen...)",
    rawModeDesc: "Universeller Modus — die KI funktioniert für Elektronik, Informatik, Sprachen und mehr.",
    maturaModeDesc: "Prüfungsmodus — die KI antwortet Schritt für Schritt (Mathe/Physik/Chemie/Biologie).",
    pairCalculator: "Rechner koppeln",
    addYourDevice: "Füge dein",
    deviceWord: "Gerät",
    pairIntro1: "Gib die ",
    pairIntro2: " vom Rechner (Einstellungen → WLAN & Konto → Geräte-ID + QR) sowie den ",
    pairIntro3: " (Einstellungen → Sicherheit → KI-Code) ein.",
    pairWarning: "⚠ Der Rechner muss zuerst mit dem WLAN verbunden sein und sich beim Server melden.",
    deviceIdLabel: "Device ID (MAC)",
    unlockCodeLabel: "Entsperrcode",
    pairing: "Wird gekoppelt...",
    pairButton: "Gerät koppeln",
    errorLabel: "/ ERROR",
    paired: "✓ Gekoppelt",
    deviceAdded: "Gerät wurde dem Konto hinzugefügt.",
    yourDevice: "Dein",
    license: "Lizenz",
    firmware: "Firmware",
    requests: "Anfragen",
    aiModeAndModel: "/ AI-Modus und Modell",
    aiModeSetInTab: (link) => <>Das AI-Modell und den Modus (Prüfungsmodus / Reines AI) stellst du im Tab {link} ein.</>,
    photoGallery: "/ Fotogalerie",
    photosCount: (n) => `${n} FOTOS`,
    noPhotos: "Keine Fotos. Mach mit der Kamera des Rechners ein Foto einer Aufgabe.",
    solutionHistory: "/ Lösungsverlauf",
    recordsCount: (n) => `${n} EINTRÄGE`,
    noTasksSolved: "Noch keine Aufgaben gelöst.",
    photo: "📷 Foto",
    close: "Schließen ×",
    solution: "/ Lösung",
    task: "Aufgabe",
    calcRequired: "/ Rechner erforderlich",
    pairFirst: (link) => <>Koppel zuerst den Rechner im Tab {link}.</>,
    notesOffline: (n) => `Offline-Notizen (${n}/50)`,
    syncToDevice: "Synchronisiert per WLAN mit dem Gerät",
    editNote: "Notiz bearbeiten",
    newNote: "Neue Notiz",
    noteTitlePlaceholder: "Titel (max. 60 Zeichen)",
    noteContentPlaceholder: "Inhalt (max. 4000 Zeichen - Formeln, Definitionen)",
    cancel: "Abbrechen",
    saving: "Wird gespeichert...",
    save: "Speichern",
    add: "Hinzufügen",
    noNotes: "Keine Notizen.",
    noTitle: "(ohne Titel)",
    empty: "(leer)",
    edit: "Bearbeiten",
    delete: "Löschen",
    testsHeading: (n) => `Klassenarbeiten (${n}/50)`,
    markdownOk: "Markdown/LaTeX OK",
    editTest: "Klassenarbeit bearbeiten",
    newTest: "Neue Klassenarbeit",
    testTitlePlaceholder: "Titel (z. B. Mathe 2026 - Probe 1)",
    testContentPlaceholder: "Füge hier die Lösung ein (Markdown, LaTeX, $..$, **bold**...)",
    noTests: "Keine Klassenarbeiten.",
    charsCount: (n) => `${n} Zeichen`,
    account: "/ Konto",
    loggedInAs: "Angemeldet als",
    changePassword: "/ Passwort ändern",
    currentPassword: "Aktuelles Passwort",
    newPassword: "Neues Passwort (min. 6 Zeichen)",
    repeatNewPassword: "Neues Passwort wiederholen",
    changePasswordBtn: "Passwort ändern",
    changeEmail: "/ E-Mail-Adresse ändern",
    newEmail: "Neue E-Mail-Adresse",
    confirmWithPassword: "Mit Passwort bestätigen",
    changeEmailBtn: "E-Mail ändern",
    emailChangeNote: "Wir senden einen Bestätigungslink an die neue Adresse — die Änderung gilt erst, wenn du ihn anklickst.",
    emailChangeLogout: "E-Mail geändert. Du wirst gleich abgemeldet...",
    newsletterLoadFailed: "Newsletter-Status konnte nicht geladen werden.",
    newsletterSaveFailed: "Newsletter-Einwilligung konnte nicht gespeichert werden.",
    dataHeading: "/ Deine Daten",
    exportData: "Meine Daten herunterladen",
    exportDataDesc: "Eine JSON-Datei mit allen Daten zu deinem Konto (DSGVO, Art. 20).",
    exporting: "Wird vorbereitet…",
    exportFailed: "Deine Daten konnten nicht heruntergeladen werden.",
    deleteAccount: "Konto löschen",
    deleteAccountDesc: "Löscht dauerhaft dein Konto, den Chatverlauf, Notizen, Klassenarbeiten und die Rechner-Kopplung. Das kann nicht rückgängig gemacht werden.",
    deletePasswordPlaceholder: "Kontopasswort",
    deleteGoogleHint: (p) => `Anmeldung über Google (ohne Passwort)? Lass das Passwort leer und tippe: ${p}`,
    deleteAccountBtn: "Konto endgültig löschen",
    deleting: "Wird gelöscht…",
    deleteFailed: "Das Konto konnte nicht gelöscht werden.",
    deleteNeedConfirm: (p) => `Gib dein Passwort ein oder tippe „${p}“ zur Bestätigung.`,
    featureUnavailable: "Diese Funktion ist noch nicht verfügbar — bitte versuche es später oder kontaktiere uns.",
    session: "/ Sitzung",
  },
  cs: {
    logout: "Odhlásit ↗",
    logoutLong: "Odhlásit se ↗",
    newsletterTitle: "/ Newsletter",
    newsletterDesc: "Novinky, akce a slevové kupóny KalkMate e-mailem. Souhlas můžeš kdykoli odvolat — e-maily o objednávkách a účtu chodí nezávisle na tom.",
    newsletterOn: "Přihlášeno ✓ — kliknutím se odhlásíš",
    newsletterOff: "Přihlásit se k odběru newsletteru",
    yourPanel: "[ 00 ] · Tvůj panel",
    greeting: (n) => <>Ahoj, {n}.</>,
    sessionActive: "Relace aktivní",
    loading: "Načítání...",
    tabsOrders: "Objednávky",
    tabsChat: "AI Chat",
    tabsAi: "AI",
    tabsCalculator: "Kalkulačka",
    tabsNotes: "Poznámky",
    tabsTests: "Písemky",
    tabsSettings: "Nastavení účtu",
    alertPaymentStart: "Platbu se nepodařilo zahájit",
    alertNetwork: "Chyba sítě",
    alertSaveFailed: "Uložení se nezdařilo",
    errGeneric: "Chyba",
    pwTooShort: "Nové heslo musí mít alespoň 6 znaků",
    pwMismatch: "Hesla se neshodují",
    pwChanged: "Heslo bylo změněno.",
    emailChanged: "Na novou adresu jsme poslali odkaz — změna proběhne, jakmile na něj klikneš.",
    alertNoDeviceUnpair: "Žádné zařízení k odpojení.",
    confirmUnpair: (id) => `Odpojit zařízení ${id}? Později ho můžeš znovu spárovat.`,
    alertError: "Chyba",
    confirmDeleteNote: "Smazat poznámku?",
    confirmDeleteTest: "Smazat písemku?",
    confirmDeleteConversation: "Opravdu chceš smazat tuto konverzaci?",
    errPairFailed: "Spárování se nezdařilo",
    errNetwork: "Chyba sítě — zkontroluj připojení k internetu.",
    sessionExpired: "Relace vypršela — přihlas se prosím znovu.",
    fileAttached: "(soubor přiložen)",
    serverError: (s) => `Chyba serveru (${s})`,
    tryAgain: "Zkus to prosím znovu.",
    chatNoTokens: "Došly ti AI tokeny. Dokup balíček tokenů nebo aktivuj kód z krabičky, abys mohl(a) pokračovat.",
    chatNoAccess: "Tento účet nemá přístup k AI. Zkontroluj zůstatek tokenů — pokud problém přetrvává, napiš nám: kontakt@kalkmate.pl.",
    chatTooLarge: "Fotka je příliš velká. Odeber ji nebo přilož menší (max. 4 fotky).",
    chatOnlyImages: "Přikládat lze jen obrázky (JPG, PNG, WebP).",
    chatTooMany: "Příliš mnoho požadavků. Chvíli počkej a zkus to znovu.",
    chatUpstream: "AI server momentálně neodpovídá. Tvoje zpráva se vrátila do pole — zkus to za chvíli znovu.",
    chatReadFailed: "Přiloženou fotku se nepodařilo načíst.",
    convLoadFailed: "Konverzaci se nepodařilo načíst.",
    convDeleteFailed: "Konverzaci se nepodařilo smazat.",
    goBuyTokens: "Koupit tokeny →",
    dismiss: "Zavřít",
    imgProcessing: "Zmenšuji fotku…",
    imgTooMany: (m) => `Max. ${m} fotky na zprávu.`,
    imgDecodeFailed: (n) => `Fotku „${n}“ se nepodařilo načíst.`,
    imgTooLarge: (n) => `Fotka „${n}“ je příliš velká i po zmenšení.`,
    returnTokensSuccess: "Platba přijata — tokeny se na účtu objeví během několika okamžiků.",
    returnTokensCancelled: "Platba za tokeny byla zrušena.",
    loadFailed: "Data se nepodařilo načíst.",
    retry: "Zkusit znovu",
    loadMore: "Zobrazit více",
    licenseRedeemed: "Kód byl aktivován.",
    licenseTokensAdded: (n, b) => `Kód aktivován — přidáno ${n} tokenů. Zůstatek: ${b}.`,
    enterLicenseCode: "Zadej kód z krabičky",
    licenseRedeemFailed: "Kód se nepodařilo aktivovat",
    licenseRedeemError: "Při aktivaci kódu došlo k chybě",
    ordersHeading: "Historie objednávek",
    ordersSubtitle: "Tvoje objednávky a stav zásilek",
    ordersEmpty: "Zatím nemáš žádné objednávky",
    ordersCta: "Objednat KalkMate",
    orderNo: (n) => `Objednávka #${n}`,
    statusPaid: "✓ Zaplaceno",
    statusPending: "⏳ Čeká",
    statusCancelled: "✗ Zrušeno",
    amount: "Částka",
    pickupPoint: "Výdejní místo",
    shipmentStatus: "Stav zásilky",
    shipped: "📦 Odesláno",
    awaitingShipment: "⏰ Čeká",
    trackingNumber: "Číslo zásilky",
    chatHistories: "Historie",
    newConversation: "Nová konverzace",
    deleteTitle: "Smazat",
    messagesCount: (n) => `${n} zpráv`,
    noConversations: "Žádné konverzace",
    hideHistory: "Skrýt historii",
    showHistory: "Zobrazit historii",
    chatTitle: "AI Chat - KalkMate Pro",
    chatSubtitle: "Řeš úlohy z matematiky, fyziky, chemie a biologie",
    newChat: "Nový chat",
    chatStart: "Začni konverzaci s AI",
    chatStartDesc: "Vlož zadání úlohy z matematiky, fyziky, chemie nebo biologie a AI ti ji pomůže vyřešit krok za krokem",
    subjMath: "Matematika",
    subjMathLevel: "Základní a rozšířená úroveň",
    subjPhysics: "Fyzika",
    subjExtended: "Rozšířená úroveň",
    subjChemistry: "Chemie",
    subjBiology: "Biologie",
    copyAnswer: "Kopírovat odpověď",
    copied: "Zkopírováno",
    copy: "Kopírovat",
    thinking: "Přemýšlím...",
    removeFile: "Odebrat",
    chatPlaceholder: "Vlož zadání úlohy nebo přilož fotku (Ctrl+V funguje i pro obrázky)...",
    attachFile: "Přiložit fotku (max. 4)",
    send: "Odeslat",
    unpinning: "Odpojuji...",
    unpin: "Odpojit",
    redeemHeading: "Aktivuj kód z krabičky (+2 mil. tokenů)",
    redeemDesc: "Licenční kód najdeš v krabičce kalkulačky. Aktivace jednorázově přidá k tvému zůstatku 2 000 000 AI tokenů.",
    licenseCodePlaceholder: "abcd123-+=%abcd",
    redeeming: "Aktivuji...",
    redeem: "Aktivovat",
    tokenUsage: "/ Zůstatek tokenů",
    effectiveTokens: "efektivních tokenů na účtu",
    remaining: "ZBÝVÁ",
    aiLoadFailed: "Nastavení AI a zůstatek tokenů se nepodařilo načíst.",
    tasksLeftLabel: "Zbývá úloh",
    maturaTasks: "úloh",
    perLicenseLabel: "Na 2 mil. tokenů",
    forModel: (m) => `pro model ${m}`,
    defaultModel: "výchozí",
    modelPerformance: "VÝKON MODELŮ — kolik úloh za 2 mil. tokenů",
    tasksAbbr: "úl.",
    tokenEstimateNote: "Odhad pro typickou úlohu (~800 skutečných tokenů vstup + odpověď). Bez předplatného — když zůstatek dojde, dokup balíček níže.",
    buyTokens: "/ Koupit tokeny",
    buyTokensDesc: "Dobij si zůstatek tokenů. Jednorázová platba (karta / BLIK / Przelewy24) — tokeny se připíšou hned po zaplacení.",
    popular: "OBLÍBENÝ",
    packLabel: (t) => `${t / 1_000_000} mil. tokenů`,
    maturaTasksApprox: "úloh",
    redirecting: "Přesměrování...",
    buy: "Koupit",
    aiModelHeading: "/ Model AI",
    aiModelDesc: "Vyber model. Násobitel (×) ukazuje, kolik efektivních tokenů stojí jeden dotaz ve srovnání s nejlevnějším modelem.",
    aiModeHeading: "/ Režim AI",
    maturaCke: "Zkouška",
    maturaCkeTitle: "Zkouškový režim (matematika, fyzika, chemie, biologie)",
    rawAi: "Čisté AI",
    rawAiTitle: "Univerzální režim — libovolný předmět (elektronika, informatika, jazyky...)",
    rawModeDesc: "Univerzální režim — AI funguje pro elektroniku, informatiku, jazyky a další.",
    maturaModeDesc: "Zkouškový režim — AI odpovídá krok za krokem (matematika/fyzika/chemie/biologie).",
    pairCalculator: "Spárovat kalkulačku",
    addYourDevice: "Přidej své",
    deviceWord: "zařízení",
    pairIntro1: "Zadej ",
    pairIntro2: " z kalkulačky (Nastavení → WiFi a účet → ID zařízení + QR) a ",
    pairIntro3: " (Nastavení → Zabezpečení → Kód AI).",
    pairWarning: "⚠ Kalkulačka musí být nejdřív připojená k WiFi a ohlásit se serveru.",
    deviceIdLabel: "Device ID (MAC)",
    unlockCodeLabel: "Odemykací kód",
    pairing: "Párování...",
    pairButton: "Spárovat zařízení",
    errorLabel: "/ ERROR",
    paired: "✓ Spárováno",
    deviceAdded: "Zařízení bylo přidáno k účtu.",
    yourDevice: "Tvoje",
    license: "Licence",
    firmware: "Firmware",
    requests: "Dotazů",
    aiModeAndModel: "/ Režim AI a model",
    aiModeSetInTab: (link) => <>Model AI a režim (Zkouška / Čisté AI) nastavíš v záložce {link}.</>,
    photoGallery: "/ Galerie fotek",
    photosCount: (n) => `${n} FOTEK`,
    noPhotos: "Žádné fotky. Vyfoť zadání úlohy kamerou kalkulačky.",
    solutionHistory: "/ Historie řešení",
    recordsCount: (n) => `${n} ZÁZNAMŮ`,
    noTasksSolved: "Zatím nebyla vyřešena žádná úloha.",
    photo: "📷 Fotka",
    close: "Zavřít ×",
    solution: "/ Řešení",
    task: "Úloha",
    calcRequired: "/ vyžaduje kalkulačku",
    pairFirst: (link) => <>Nejdřív spáruj kalkulačku v záložce {link}.</>,
    notesOffline: (n) => `Offline poznámky (${n}/50)`,
    syncToDevice: "Synchronizace se zařízením přes WiFi",
    editNote: "Upravit poznámku",
    newNote: "Nová poznámka",
    noteTitlePlaceholder: "Název (max. 60 znaků)",
    noteContentPlaceholder: "Obsah (max. 4000 znaků – vzorce, definice)",
    cancel: "Zrušit",
    saving: "Ukládám...",
    save: "Uložit",
    add: "Přidat",
    noNotes: "Žádné poznámky.",
    noTitle: "(bez názvu)",
    empty: "(prázdná)",
    edit: "Upravit",
    delete: "Smazat",
    testsHeading: (n) => `Písemky (${n}/50)`,
    markdownOk: "Markdown/LaTeX OK",
    editTest: "Upravit písemku",
    newTest: "Nová písemka",
    testTitlePlaceholder: "Název (např. Matika 2026 – zkušební 1)",
    testContentPlaceholder: "Sem vlož řešení (markdown, LaTeX, $..$, **tučně**...)",
    noTests: "Žádné písemky.",
    charsCount: (n) => `${n} znaků`,
    account: "/ Účet",
    loggedInAs: "Přihlášen(a) jako",
    changePassword: "/ Změna hesla",
    currentPassword: "Současné heslo",
    newPassword: "Nové heslo (min. 6 znaků)",
    repeatNewPassword: "Zopakuj nové heslo",
    changePasswordBtn: "Změnit heslo",
    changeEmail: "/ Změna e-mailové adresy",
    newEmail: "Nová e-mailová adresa",
    confirmWithPassword: "Potvrď heslem",
    changeEmailBtn: "Změnit e-mail",
    emailChangeNote: "Na novou adresu pošleme potvrzovací odkaz — změna proběhne až po kliknutí na něj.",
    emailChangeLogout: "E-mail změněn. Za chvíli budeš odhlášen(a)...",
    newsletterLoadFailed: "Stav newsletteru se nepodařilo načíst.",
    newsletterSaveFailed: "Souhlas s newsletterem se nepodařilo uložit.",
    dataHeading: "/ Tvoje data",
    exportData: "Stáhnout moje data",
    exportDataDesc: "Soubor JSON se všemi daty spojenými s tvým účtem (GDPR, čl. 20).",
    exporting: "Připravuji…",
    exportFailed: "Data se nepodařilo stáhnout.",
    deleteAccount: "Smazat účet",
    deleteAccountDesc: "Trvale smaže účet, historii chatů, poznámky, písemky i propojení s kalkulačkou. Tuto akci nelze vrátit zpět.",
    deletePasswordPlaceholder: "Heslo k účtu",
    deleteGoogleHint: (p) => `Přihlašuješ se přes Google (bez hesla)? Nech heslo prázdné a níže napiš: ${p}`,
    deleteAccountBtn: "Smazat účet navždy",
    deleting: "Mažu…",
    deleteFailed: "Účet se nepodařilo smazat.",
    deleteNeedConfirm: (p) => `Zadej heslo nebo napiš „${p}“ pro potvrzení.`,
    featureUnavailable: "Tato funkce zatím není k dispozici — zkus to později nebo nám napiš.",
    session: "/ Relace",
  },
  sk: {
    logout: "Odhlásiť ↗",
    logoutLong: "Odhlásiť sa ↗",
    newsletterTitle: "/ Newsletter",
    newsletterDesc: "Novinky, akcie a kupóny KalkMate e-mailom. Súhlas môžeš kedykoľvek odvolať — e-maily o objednávkach a účte chodia nezávisle od toho.",
    newsletterOn: "Prihlásený ✓ — kliknutím sa odhlásiš",
    newsletterOff: "Prihlásiť sa na newsletter",
    yourPanel: "[ 00 ] · Tvoj panel",
    greeting: (n) => <>Ahoj, {n}.</>,
    sessionActive: "Relácia aktívna",
    loading: "Načítava sa...",
    tabsOrders: "Objednávky",
    tabsChat: "AI Chat",
    tabsAi: "AI",
    tabsCalculator: "Kalkulačka",
    tabsNotes: "Poznámky",
    tabsTests: "Písomky",
    tabsSettings: "Nastavenia účtu",
    alertPaymentStart: "Platbu sa nepodarilo spustiť",
    alertNetwork: "Chyba siete",
    alertSaveFailed: "Nepodarilo sa uložiť",
    errGeneric: "Chyba",
    pwTooShort: "Nové heslo musí mať aspoň 6 znakov",
    pwMismatch: "Heslá sa nezhodujú",
    pwChanged: "Heslo bolo zmenené.",
    emailChanged: "Poslali sme odkaz na novú adresu — zmena sa prejaví po jeho kliknutí.",
    alertNoDeviceUnpair: "Žiadne zariadenie na odpojenie.",
    confirmUnpair: (id) => `Odpojiť zariadenie ${id}? Neskôr ho môžeš znova spárovať.`,
    alertError: "Chyba",
    confirmDeleteNote: "Zmazať poznámku?",
    confirmDeleteTest: "Zmazať písomku?",
    confirmDeleteConversation: "Naozaj chceš zmazať túto konverzáciu?",
    errPairFailed: "Spárovanie zlyhalo",
    errNetwork: "Chyba siete — skontroluj pripojenie k internetu.",
    sessionExpired: "Relácia vypršala — prihlás sa znova.",
    fileAttached: "(priložený súbor)",
    serverError: (s) => `Chyba servera (${s})`,
    tryAgain: "Skús to znova.",
    chatNoTokens: "Minuli sa ti AI tokeny. Dokúp balík tokenov alebo aktivuj kód z krabičky a pokračuj.",
    chatNoAccess: "Tento účet nemá prístup k AI. Skontroluj zostatok tokenov — ak problém pretrváva, napíš nám: kontakt@kalkmate.pl.",
    chatTooLarge: "Fotka je príliš veľká. Odstráň ju alebo prilož menšiu (max. 4 fotky).",
    chatOnlyImages: "Prikladať sa dajú iba fotky (JPG, PNG, WebP).",
    chatTooMany: "Príliš veľa požiadaviek. Chvíľu počkaj a skús to znova.",
    chatUpstream: "AI server momentálne neodpovedá. Tvoja správa sa vrátila do poľa — skús to o chvíľu znova.",
    chatReadFailed: "Priloženú fotku sa nepodarilo načítať.",
    convLoadFailed: "Konverzáciu sa nepodarilo načítať.",
    convDeleteFailed: "Konverzáciu sa nepodarilo zmazať.",
    goBuyTokens: "Kúpiť tokeny →",
    dismiss: "Zavrieť",
    imgProcessing: "Zmenšujem fotku…",
    imgTooMany: (m) => `Max. ${m} fotky na správu.`,
    imgDecodeFailed: (n) => `Fotku „${n}“ sa nepodarilo načítať.`,
    imgTooLarge: (n) => `Fotka „${n}“ je príliš veľká aj po zmenšení.`,
    returnTokensSuccess: "Platba prijatá — tokeny sa na účte objavia o chvíľu.",
    returnTokensCancelled: "Platba za tokeny bola zrušená.",
    loadFailed: "Údaje sa nepodarilo načítať.",
    retry: "Skúsiť znova",
    loadMore: "Zobraziť viac",
    licenseRedeemed: "Kód bol aktivovaný.",
    licenseTokensAdded: (n, b) => `Kód aktivovaný — pridaných ${n} tokenov. Zostatok: ${b}.`,
    enterLicenseCode: "Zadaj kód z krabičky",
    licenseRedeemFailed: "Kód sa nepodarilo aktivovať",
    licenseRedeemError: "Pri aktivácii kódu nastala chyba",
    ordersHeading: "História objednávok",
    ordersSubtitle: "Tvoje objednávky a stav doručenia",
    ordersEmpty: "Zatiaľ nemáš žiadne objednávky",
    ordersCta: "Objednať KalkMate",
    orderNo: (n) => `Objednávka #${n}`,
    statusPaid: "✓ Zaplatené",
    statusPending: "⏳ Čaká",
    statusCancelled: "✗ Zrušené",
    amount: "Suma",
    pickupPoint: "Výdajné miesto",
    shipmentStatus: "Stav zásielky",
    shipped: "📦 Odoslané",
    awaitingShipment: "⏰ Čaká",
    trackingNumber: "Číslo zásielky",
    chatHistories: "História",
    newConversation: "Nová konverzácia",
    deleteTitle: "Zmazať",
    messagesCount: (n) => `${n} ${n === 1 ? "správa" : n >= 2 && n <= 4 ? "správy" : "správ"}`,
    noConversations: "Žiadne konverzácie",
    hideHistory: "Skryť históriu",
    showHistory: "Zobraziť históriu",
    chatTitle: "AI Chat - KalkMate Pro",
    chatSubtitle: "Rieš úlohy z matematiky, fyziky, chémie a biológie",
    newChat: "Nový chat",
    chatStart: "Začni rozhovor s AI",
    chatStartDesc: "Vlož zadanie z matematiky, fyziky, chémie alebo biológie a AI ti ho pomôže vyriešiť krok za krokom",
    subjMath: "Matematika",
    subjMathLevel: "Základná a rozšírená úroveň",
    subjPhysics: "Fyzika",
    subjExtended: "Rozšírená úroveň",
    subjChemistry: "Chémia",
    subjBiology: "Biológia",
    copyAnswer: "Kopírovať odpoveď",
    copied: "Skopírované",
    copy: "Kopírovať",
    thinking: "Premýšľam...",
    removeFile: "Odstrániť",
    chatPlaceholder: "Vlož zadanie alebo prilož fotku (Ctrl+V funguje aj pre obrázky)...",
    attachFile: "Priložiť fotku (max. 4)",
    send: "Odoslať",
    unpinning: "Odpájam...",
    unpin: "Odpojiť",
    redeemHeading: "Aktivuj kód z krabičky (+2 mil. tokenov)",
    redeemDesc: "Licenčný kód nájdeš v krabičke kalkulačky. Aktivácia jednorazovo pridá 2 000 000 AI tokenov k tvojmu zostatku.",
    licenseCodePlaceholder: "abcd123-+=%abcd",
    redeeming: "Aktivujem...",
    redeem: "Aktivovať",
    tokenUsage: "/ Zostatok tokenov",
    effectiveTokens: "efektívnych tokenov na účte",
    remaining: "ZOSTÁVA",
    aiLoadFailed: "Nepodarilo sa načítať nastavenia AI a zostatok tokenov.",
    tasksLeftLabel: "Zostáva úloh",
    maturaTasks: "úloh",
    perLicenseLabel: "Na 2 mil. tokenov",
    forModel: (m) => `pre model ${m}`,
    defaultModel: "predvolený",
    modelPerformance: "VÝKON MODELOV — koľko úloh za 2 mil. tokenov",
    tasksAbbr: "úl.",
    tokenEstimateNote: "Odhad pre typickú úlohu (~800 reálnych tokenov vstup + odpoveď). Bez predplatného — keď sa zostatok minie, dokúp balík nižšie.",
    buyTokens: "/ Kúpiť tokeny",
    buyTokensDesc: "Dobi zostatok tokenov. Jednorazová platba (karta / BLIK / Przelewy24) — tokeny sa pripíšu hneď po zaplatení.",
    popular: "OBĽÚBENÝ",
    packLabel: (t) => `${t / 1_000_000} mil. tokenov`,
    maturaTasksApprox: "úloh",
    redirecting: "Presmerúvam...",
    buy: "Kúpiť",
    aiModelHeading: "/ AI model",
    aiModelDesc: "Vyber model. Násobiteľ (×) ukazuje, koľko efektívnych tokenov stojí jedna požiadavka v porovnaní s najlacnejším.",
    aiModeHeading: "/ Režim AI",
    maturaCke: "Skúška",
    maturaCkeTitle: "Skúškový režim (matematika, fyzika, chémia, biológia)",
    rawAi: "Čisté AI",
    rawAiTitle: "Univerzálny režim — ľubovoľný predmet (elektronika, informatika, jazyky...)",
    rawModeDesc: "Univerzálny režim — AI funguje pre elektroniku, informatiku, jazyky a ďalšie.",
    maturaModeDesc: "Skúškový režim — AI odpovedá krok za krokom (matematika/fyzika/chémia/biológia).",
    pairCalculator: "Spárovať kalkulačku",
    addYourDevice: "Pridaj svoje",
    deviceWord: "zariadenie",
    pairIntro1: "Zadaj ",
    pairIntro2: " z kalkulačky (Nastavenia → WiFi a účet → ID zariad. + QR) a ",
    pairIntro3: " (Nastavenia → Zabezpečenie → Kód AI).",
    pairWarning: "⚠ Kalkulačka musí byť najprv pripojená k WiFi a ohlásiť sa serveru.",
    deviceIdLabel: "Device ID (MAC)",
    unlockCodeLabel: "Odomykací kód",
    pairing: "Párujem...",
    pairButton: "Spárovať zariadenie",
    errorLabel: "/ CHYBA",
    paired: "✓ Spárované",
    deviceAdded: "Zariadenie bolo pridané k účtu.",
    yourDevice: "Tvoje",
    license: "Licencia",
    firmware: "Firmvér",
    requests: "Požiadavky",
    aiModeAndModel: "/ Režim AI a model",
    aiModeSetInTab: (link) => <>AI model a režim (Skúška / Čisté AI) nastavíš na karte {link}.</>,
    photoGallery: "/ Galéria fotiek",
    photosCount: (n) => `${n} FOTIEK`,
    noPhotos: "Žiadne fotky. Odfoť zadanie kamerou kalkulačky.",
    solutionHistory: "/ História riešení",
    recordsCount: (n) => `${n} ZÁZNAMOV`,
    noTasksSolved: "Zatiaľ nebola vyriešená žiadna úloha.",
    photo: "📷 Fotka",
    close: "Zavrieť ×",
    solution: "/ Riešenie",
    task: "Úloha",
    calcRequired: "/ potrebná kalkulačka",
    pairFirst: (link) => <>Najprv spáruj kalkulačku na karte {link}.</>,
    notesOffline: (n) => `Offline poznámky (${n}/50)`,
    syncToDevice: "Synchronizácia so zariadením cez WiFi",
    editNote: "Upraviť poznámku",
    newNote: "Nová poznámka",
    noteTitlePlaceholder: "Názov (max. 60 znakov)",
    noteContentPlaceholder: "Obsah (max. 4000 znakov – vzorce, definície)",
    cancel: "Zrušiť",
    saving: "Ukladám...",
    save: "Uložiť",
    add: "Pridať",
    noNotes: "Žiadne poznámky.",
    noTitle: "(bez názvu)",
    empty: "(prázdna)",
    edit: "Upraviť",
    delete: "Zmazať",
    testsHeading: (n) => `Písomky (${n}/50)`,
    markdownOk: "Markdown/LaTeX OK",
    editTest: "Upraviť písomku",
    newTest: "Nová písomka",
    testTitlePlaceholder: "Názov (napr. Matika 2026 – skúšobná 1)",
    testContentPlaceholder: "Sem vlož riešenie (markdown, LaTeX, $..$, **tučné**...)",
    noTests: "Žiadne písomky.",
    charsCount: (n) => `${n} znakov`,
    account: "/ Účet",
    loggedInAs: "Prihlásený ako",
    changePassword: "/ Zmena hesla",
    currentPassword: "Aktuálne heslo",
    newPassword: "Nové heslo (min. 6 znakov)",
    repeatNewPassword: "Zopakuj nové heslo",
    changePasswordBtn: "Zmeniť heslo",
    changeEmail: "/ Zmena e-mailovej adresy",
    newEmail: "Nová e-mailová adresa",
    confirmWithPassword: "Potvrď heslom",
    changeEmailBtn: "Zmeniť e-mail",
    emailChangeNote: "Na novú adresu pošleme potvrdzovací odkaz — zmena sa prejaví až po jeho kliknutí.",
    emailChangeLogout: "E-mail zmenený. O chvíľu budeš odhlásený...",
    newsletterLoadFailed: "Stav newslettera sa nepodarilo načítať.",
    newsletterSaveFailed: "Súhlas s newsletterom sa nepodarilo uložiť.",
    dataHeading: "/ Tvoje údaje",
    exportData: "Stiahnuť moje údaje",
    exportDataDesc: "Súbor JSON so všetkými údajmi prepojenými s tvojím účtom (GDPR, čl. 20).",
    exporting: "Pripravujem…",
    exportFailed: "Údaje sa nepodarilo stiahnuť.",
    deleteAccount: "Zmazať účet",
    deleteAccountDesc: "Natrvalo zmaže účet, históriu chatov, poznámky, písomky aj prepojenie s kalkulačkou. Túto akciu nie je možné vrátiť späť.",
    deletePasswordPlaceholder: "Heslo k účtu",
    deleteGoogleHint: (p) => `Prihlasuješ sa cez Google (bez hesla)? Nechaj heslo prázdne a nižšie napíš: ${p}`,
    deleteAccountBtn: "Zmazať účet navždy",
    deleting: "Mažem…",
    deleteFailed: "Účet sa nepodarilo zmazať.",
    deleteNeedConfirm: (p) => `Zadaj heslo alebo napíš „${p}“ na potvrdenie.`,
    featureUnavailable: "Táto funkcia zatiaľ nie je dostupná — skús to neskôr alebo nám napíš.",
    session: "/ Relácia",
  },
  lt: {
    logout: "Atsijungti ↗",
    logoutLong: "Atsijungti ↗",
    newsletterTitle: "/ Naujienlaiškis",
    newsletterDesc: "KalkMate naujienos, akcijos ir kuponai el. paštu. Sutikimą gali atšaukti bet kada — laiškai apie užsakymus ir paskyrą siunčiami nepriklausomai.",
    newsletterOn: "Užsiprenumeruota ✓ — spausk, kad atsisakytum",
    newsletterOff: "Prenumeruoti naujienlaiškį",
    yourPanel: "[ 00 ] · Tavo skydelis",
    greeting: (n) => <>Labas, {n}.</>,
    sessionActive: "Sesija aktyvi",
    loading: "Įkeliama...",
    tabsOrders: "Užsakymai",
    tabsChat: "DI pokalbis",
    tabsAi: "DI",
    tabsCalculator: "Skaičiuotuvas",
    tabsNotes: "Užrašai",
    tabsTests: "Kontroliniai",
    tabsSettings: "Paskyros nustatymai",
    alertPaymentStart: "Nepavyko pradėti mokėjimo",
    alertNetwork: "Tinklo klaida",
    alertSaveFailed: "Nepavyko išsaugoti",
    errGeneric: "Klaida",
    pwTooShort: "Naujas slaptažodis turi būti bent 6 simbolių",
    pwMismatch: "Slaptažodžiai nesutampa",
    pwChanged: "Slaptažodis pakeistas.",
    emailChanged: "Išsiuntėme nuorodą į naują adresą — pakeitimas įsigalios ją paspaudus.",
    alertNoDeviceUnpair: "Nėra įrenginio, kurį būtų galima atsieti.",
    confirmUnpair: (id) => `Atsieti įrenginį ${id}? Vėliau galėsi jį vėl susieti.`,
    alertError: "Klaida",
    confirmDeleteNote: "Ištrinti užrašą?",
    confirmDeleteTest: "Ištrinti kontrolinį?",
    confirmDeleteConversation: "Ar tikrai nori ištrinti šį pokalbį?",
    errPairFailed: "Nepavyko susieti",
    errNetwork: "Tinklo klaida — patikrink interneto ryšį.",
    sessionExpired: "Sesija baigėsi — prisijunk iš naujo.",
    fileAttached: "(pridėtas failas)",
    serverError: (s) => `Serverio klaida (${s})`,
    tryAgain: "Bandyk dar kartą.",
    chatNoTokens: "Baigėsi DI žetonai. Nusipirk žetonų paketą arba aktyvuok kodą iš dėžutės, kad galėtum tęsti.",
    chatNoAccess: "Šioje paskyroje nėra prieigos prie DI. Patikrink žetonų likutį — jei problema kartojasi, parašyk mums: kontakt@kalkmate.pl.",
    chatTooLarge: "Nuotrauka per didelė. Pašalink ją arba pridėk mažesnę (daugiausia 4 nuotraukos).",
    chatOnlyImages: "Galima pridėti tik nuotraukas (JPG, PNG, WebP).",
    chatTooMany: "Per daug užklausų. Palauk akimirką ir bandyk dar kartą.",
    chatUpstream: "DI serveris šiuo metu neatsako. Tavo žinutė grąžinta į laukelį — bandyk dar kartą po akimirkos.",
    chatReadFailed: "Nepavyko nuskaityti pridėtos nuotraukos.",
    convLoadFailed: "Nepavyko įkelti pokalbio.",
    convDeleteFailed: "Nepavyko ištrinti pokalbio.",
    goBuyTokens: "Pirkti žetonų →",
    dismiss: "Uždaryti",
    imgProcessing: "Mažinama nuotrauka…",
    imgTooMany: (m) => `Daugiausia ${m} nuotraukos vienoje žinutėje.`,
    imgDecodeFailed: (n) => `Nepavyko nuskaityti nuotraukos „${n}“.`,
    imgTooLarge: (n) => `Nuotrauka „${n}“ per didelė net ir sumažinus.`,
    returnTokensSuccess: "Mokėjimas gautas — žetonai paskyroje atsiras per kelias akimirkas.",
    returnTokensCancelled: "Žetonų mokėjimas atšauktas.",
    loadFailed: "Nepavyko įkelti duomenų.",
    retry: "Bandyti dar kartą",
    loadMore: "Rodyti daugiau",
    licenseRedeemed: "Kodas aktyvuotas.",
    licenseTokensAdded: (n, b) => `Kodas aktyvuotas — pridėta ${n} žetonų. Likutis: ${b}.`,
    enterLicenseCode: "Įvesk kodą iš dėžutės",
    licenseRedeemFailed: "Nepavyko aktyvuoti kodo",
    licenseRedeemError: "Aktyvuojant kodą įvyko klaida",
    ordersHeading: "Užsakymų istorija",
    ordersSubtitle: "Tavo užsakymai ir siuntų būsena",
    ordersEmpty: "Dar neturi jokių užsakymų",
    ordersCta: "Užsakyti KalkMate",
    orderNo: (n) => `Užsakymas #${n}`,
    statusPaid: "✓ Apmokėta",
    statusPending: "⏳ Laukiama",
    statusCancelled: "✗ Atšaukta",
    amount: "Suma",
    pickupPoint: "Atsiėmimo vieta",
    shipmentStatus: "Siuntos būsena",
    shipped: "📦 Išsiųsta",
    awaitingShipment: "⏰ Laukiama",
    trackingNumber: "Siuntos numeris",
    chatHistories: "Istorija",
    newConversation: "Naujas pokalbis",
    deleteTitle: "Ištrinti",
    messagesCount: (n) => {
      const d = n % 10, h = n % 100;
      const w = d === 1 && h !== 11 ? "žinutė" : d >= 2 && (h < 11 || h > 19) ? "žinutės" : "žinučių";
      return `${n} ${w}`;
    },
    noConversations: "Pokalbių nėra",
    hideHistory: "Slėpti istoriją",
    showHistory: "Rodyti istoriją",
    chatTitle: "DI pokalbis - KalkMate Pro",
    chatSubtitle: "Spręsk matematikos, fizikos, chemijos ir biologijos uždavinius",
    newChat: "Naujas pokalbis",
    chatStart: "Pradėk pokalbį su DI",
    chatStartDesc: "Įklijuok matematikos, fizikos, chemijos ar biologijos uždavinį, o DI padės jį išspręsti žingsnis po žingsnio",
    subjMath: "Matematika",
    subjMathLevel: "Bendrasis ir išplėstinis kursas",
    subjPhysics: "Fizika",
    subjExtended: "Išplėstinis kursas",
    subjChemistry: "Chemija",
    subjBiology: "Biologija",
    copyAnswer: "Kopijuoti atsakymą",
    copied: "Nukopijuota",
    copy: "Kopijuoti",
    thinking: "Galvoju...",
    removeFile: "Pašalinti",
    chatPlaceholder: "Įklijuok uždavinį arba pridėk nuotrauką (Ctrl+V veikia ir paveikslėliams)...",
    attachFile: "Pridėti nuotrauką (daugiausia 4)",
    send: "Siųsti",
    unpinning: "Atsiejama...",
    unpin: "Atsieti",
    redeemHeading: "Aktyvuok kodą iš dėžutės (+2 mln. žetonų)",
    redeemDesc: "Licencijos kodą rasi skaičiuotuvo dėžutėje. Aktyvavus vieną kartą pridedama 2 000 000 DI žetonų prie tavo likučio.",
    licenseCodePlaceholder: "abcd123-+=%abcd",
    redeeming: "Aktyvuojama...",
    redeem: "Aktyvuoti",
    tokenUsage: "/ Žetonų likutis",
    effectiveTokens: "efektyvių žetonų paskyroje",
    remaining: "LIKO",
    aiLoadFailed: "Nepavyko įkelti DI nustatymų ir žetonų likučio.",
    tasksLeftLabel: "Liko uždavinių",
    maturaTasks: "uždavinių",
    perLicenseLabel: "Už 2 mln. žetonų",
    forModel: (m) => `modeliui ${m}`,
    defaultModel: "numatytajam",
    modelPerformance: "MODELIŲ EFEKTYVUMAS — kiek uždavinių už 2 mln. žetonų",
    tasksAbbr: "užd.",
    tokenEstimateNote: "Įvertis tipiniam uždaviniui (~800 realių žetonų įvestis + atsakymas). Be prenumeratos — kai likutis baigsis, nusipirk paketą žemiau.",
    buyTokens: "/ Pirkti žetonų",
    buyTokensDesc: "Papildyk žetonų likutį. Vienkartinis mokėjimas (kortelė / BLIK / Przelewy24) — žetonai pridedami iškart po apmokėjimo.",
    popular: "POPULIARUS",
    packLabel: (t) => `${t / 1_000_000} mln. žetonų`,
    maturaTasksApprox: "uždavinių",
    redirecting: "Nukreipiama...",
    buy: "Pirkti",
    aiModelHeading: "/ DI modelis",
    aiModelDesc: "Pasirink modelį. Daugiklis (×) rodo, kiek efektyvių žetonų kainuoja viena užklausa, palyginti su pigiausiu.",
    aiModeHeading: "/ DI režimas",
    maturaCke: "Egzaminas",
    maturaCkeTitle: "Egzamino režimas (matematika, fizika, chemija, biologija)",
    rawAi: "Grynas DI",
    rawAiTitle: "Universalus režimas — bet kuris dalykas (elektronika, informatika, kalbos...)",
    rawModeDesc: "Universalus režimas — DI veikia elektronikai, informatikai, kalboms ir kt.",
    maturaModeDesc: "Egzamino režimas — DI atsako žingsnis po žingsnio (matematika/fizika/chemija/biologija).",
    pairCalculator: "Susieti skaičiuotuvą",
    addYourDevice: "Naujas",
    deviceWord: "įrenginys",
    pairIntro1: "Įvesk ",
    pairIntro2: " iš skaičiuotuvo (Nustatymai → WiFi ir paskyra → Įrenginio ID + QR) ir ",
    pairIntro3: " (Nustatymai → Sauga → DI kodas).",
    pairWarning: "⚠ Skaičiuotuvas pirmiausia turi būti prijungtas prie WiFi ir užsiregistravęs serveryje.",
    deviceIdLabel: "Device ID (MAC)",
    unlockCodeLabel: "Atrakinimo kodas",
    pairing: "Susiejama...",
    pairButton: "Susieti įrenginį",
    errorLabel: "/ KLAIDA",
    paired: "✓ Susieta",
    deviceAdded: "Įrenginys pridėtas prie paskyros.",
    yourDevice: "Tavo",
    license: "Licencija",
    firmware: "Programinė įranga",
    requests: "Užklausų",
    aiModeAndModel: "/ DI režimas ir modelis",
    aiModeSetInTab: (link) => <>DI modelį ir režimą (Egzaminas / Grynas DI) nustatysi skiltyje {link}.</>,
    photoGallery: "/ Nuotraukų galerija",
    photosCount: (n) => `NUOTRAUKŲ: ${n}`,
    noPhotos: "Nuotraukų nėra. Nufotografuok uždavinį skaičiuotuvo kamera.",
    solutionHistory: "/ Sprendimų istorija",
    recordsCount: (n) => `ĮRAŠŲ: ${n}`,
    noTasksSolved: "Dar neišspręstas nė vienas uždavinys.",
    photo: "📷 Nuotrauka",
    close: "Uždaryti ×",
    solution: "/ Sprendimas",
    task: "Uždavinys",
    calcRequired: "/ reikia skaičiuotuvo",
    pairFirst: (link) => <>Pirmiausia susiek skaičiuotuvą skiltyje {link}.</>,
    notesOffline: (n) => `Užrašai neprisijungus (${n}/50)`,
    syncToDevice: "Sinchronizuojama su įrenginiu per WiFi",
    editNote: "Redaguoti užrašą",
    newNote: "Naujas užrašas",
    noteTitlePlaceholder: "Pavadinimas (daugiausia 60 simbolių)",
    noteContentPlaceholder: "Turinys (daugiausia 4000 simbolių – formulės, apibrėžimai)",
    cancel: "Atšaukti",
    saving: "Išsaugoma...",
    save: "Išsaugoti",
    add: "Pridėti",
    noNotes: "Užrašų nėra.",
    noTitle: "(be pavadinimo)",
    empty: "(tuščia)",
    edit: "Redaguoti",
    delete: "Ištrinti",
    testsHeading: (n) => `Kontroliniai (${n}/50)`,
    markdownOk: "Markdown/LaTeX OK",
    editTest: "Redaguoti kontrolinį",
    newTest: "Naujas kontrolinis",
    testTitlePlaceholder: "Pavadinimas (pvz. Matematika 2026 – bandomasis 1)",
    testContentPlaceholder: "Čia įklijuok sprendimą (markdown, LaTeX, $..$, **paryškinta**...)",
    noTests: "Kontrolinių nėra.",
    charsCount: (n) => `${n} simb.`,
    account: "/ Paskyra",
    loggedInAs: "Prisijungęs kaip",
    changePassword: "/ Slaptažodžio keitimas",
    currentPassword: "Dabartinis slaptažodis",
    newPassword: "Naujas slaptažodis (min. 6 simboliai)",
    repeatNewPassword: "Pakartok naują slaptažodį",
    changePasswordBtn: "Keisti slaptažodį",
    changeEmail: "/ El. pašto adreso keitimas",
    newEmail: "Naujas el. pašto adresas",
    confirmWithPassword: "Patvirtink slaptažodžiu",
    changeEmailBtn: "Keisti el. paštą",
    emailChangeNote: "Į naują adresą išsiųsime patvirtinimo nuorodą — pakeitimas įsigalios tik ją paspaudus.",
    emailChangeLogout: "El. paštas pakeistas. Netrukus būsi atjungtas...",
    newsletterLoadFailed: "Nepavyko įkelti naujienlaiškio būsenos.",
    newsletterSaveFailed: "Nepavyko išsaugoti sutikimo gauti naujienlaiškį.",
    dataHeading: "/ Tavo duomenys",
    exportData: "Atsisiųsti mano duomenis",
    exportDataDesc: "JSON failas su visais su tavo paskyra susijusiais duomenimis (BDAR, 20 str.).",
    exporting: "Ruošiama…",
    exportFailed: "Nepavyko atsisiųsti duomenų.",
    deleteAccount: "Ištrinti paskyrą",
    deleteAccountDesc: "Visam laikui ištrina paskyrą, pokalbių istoriją, užrašus, kontrolinius ir susiejimą su skaičiuotuvu. Šio veiksmo atšaukti negalima.",
    deletePasswordPlaceholder: "Paskyros slaptažodis",
    deleteGoogleHint: (p) => `Jungiesi per Google (be slaptažodžio)? Palik slaptažodį tuščią ir žemiau įrašyk: ${p}`,
    deleteAccountBtn: "Ištrinti paskyrą visam laikui",
    deleting: "Trinama…",
    deleteFailed: "Nepavyko ištrinti paskyros.",
    deleteNeedConfirm: (p) => `Įvesk slaptažodį arba įrašyk „${p}“, kad patvirtintum.`,
    featureUnavailable: "Ši funkcija dar neprieinama — bandyk vėliau arba parašyk mums.",
    session: "/ Sesija",
  },
  be: {
    logout: "Выйсці ↗",
    logoutLong: "Выйсці з акаўнта ↗",
    newsletterTitle: "/ Рассылка",
    newsletterDesc: "Навіны, акцыі і купоны KalkMate па email. Згоду можна адклікаць у любы момант — лісты пра заказы і акаўнт прыходзяць незалежна ад гэтага.",
    newsletterOn: "Падпісаны ✓ — націсні, каб адпісацца",
    newsletterOff: "Падпісацца на рассылку",
    yourPanel: "[ 00 ] · Твая панэль",
    greeting: (n) => <>Прывітанне, {n}.</>,
    sessionActive: "Сесія актыўная",
    loading: "Загрузка...",
    tabsOrders: "Заказы",
    tabsChat: "ШІ-чат",
    tabsAi: "ШІ",
    tabsCalculator: "Калькулятар",
    tabsNotes: "Нататкі",
    tabsTests: "Кантрольныя",
    tabsSettings: "Налады акаўнта",
    alertPaymentStart: "Не ўдалося пачаць аплату",
    alertNetwork: "Памылка сеткі",
    alertSaveFailed: "Не ўдалося захаваць",
    errGeneric: "Памылка",
    pwTooShort: "Новы пароль павінен мець мінімум 6 сімвалаў",
    pwMismatch: "Паролі не супадаюць",
    pwChanged: "Пароль зменены.",
    emailChanged: "Мы даслалі спасылку на новы адрас — змена адбудзецца пасля націску на яе.",
    alertNoDeviceUnpair: "Няма прылады для адвязкі.",
    confirmUnpair: (id) => `Адвязаць прыладу ${id}? Яе можна будзе спалучыць зноў.`,
    alertError: "Памылка",
    confirmDeleteNote: "Выдаліць нататку?",
    confirmDeleteTest: "Выдаліць кантрольную?",
    confirmDeleteConversation: "Ты сапраўды хочаш выдаліць гэтую размову?",
    errPairFailed: "Не ўдалося спалучыць",
    errNetwork: "Памылка сеткі — правер падключэнне да інтэрнэту.",
    sessionExpired: "Сесія скончылася — увайдзі зноў.",
    fileAttached: "(файл далучаны)",
    serverError: (s) => `Памылка сервера (${s})`,
    tryAgain: "Паспрабуй яшчэ раз.",
    chatNoTokens: "Токены ШІ скончыліся. Дакупі пакет токенаў або актывуй код з каробкі, каб працягнуць.",
    chatNoAccess: "На гэтым акаўнце няма доступу да ШІ. Правер баланс токенаў — калі праблема паўтараецца, напішы нам: kontakt@kalkmate.pl.",
    chatTooLarge: "Фота занадта вялікае. Выдалі яго або далучы меншае (макс. 4 фота).",
    chatOnlyImages: "Можна далучаць толькі фота (JPG, PNG, WebP).",
    chatTooMany: "Занадта шмат запытаў. Пачакай крыху і паспрабуй зноў.",
    chatUpstream: "Сервер ШІ часова не адказвае. Тваё паведамленне вярнулася ў поле — паспрабуй зноў праз хвіліну.",
    chatReadFailed: "Не ўдалося прачытаць далучанае фота.",
    convLoadFailed: "Не ўдалося загрузіць размову.",
    convDeleteFailed: "Не ўдалося выдаліць размову.",
    goBuyTokens: "Купіць токены →",
    dismiss: "Закрыць",
    imgProcessing: "Памяншаю фота…",
    imgTooMany: (m) => `Макс. ${m} фота ў адным паведамленні.`,
    imgDecodeFailed: (n) => `Не ўдалося прачытаць фота «${n}».`,
    imgTooLarge: (n) => `Фота «${n}» занадта вялікае нават пасля памяншэння.`,
    returnTokensSuccess: "Аплата прынята — токены з'явяцца на акаўнце праз некалькі імгненняў.",
    returnTokensCancelled: "Аплата токенаў была скасавана.",
    loadFailed: "Не ўдалося загрузіць даныя.",
    retry: "Паспрабаваць зноў",
    loadMore: "Паказаць больш",
    licenseRedeemed: "Код актываваны.",
    licenseTokensAdded: (n, b) => `Код актываваны — дададзена ${n} токенаў. Баланс: ${b}.`,
    enterLicenseCode: "Увядзі код з каробкі",
    licenseRedeemFailed: "Не ўдалося актываваць код",
    licenseRedeemError: "Падчас актывацыі кода адбылася памылка",
    ordersHeading: "Гісторыя заказаў",
    ordersSubtitle: "Твае заказы і статус дастаўкі",
    ordersEmpty: "У цябе пакуль няма заказаў",
    ordersCta: "Заказаць KalkMate",
    orderNo: (n) => `Заказ #${n}`,
    statusPaid: "✓ Аплачана",
    statusPending: "⏳ Чакае",
    statusCancelled: "✗ Скасавана",
    amount: "Сума",
    pickupPoint: "Пункт выдачы",
    shipmentStatus: "Статус дастаўкі",
    shipped: "📦 Адпраўлена",
    awaitingShipment: "⏰ Чакае",
    trackingNumber: "Нумар адпраўлення",
    chatHistories: "Гісторыя",
    newConversation: "Новая размова",
    deleteTitle: "Выдаліць",
    messagesCount: (n) => {
      const d = n % 10, h = n % 100;
      const w = d === 1 && h !== 11 ? "паведамленне" : d >= 2 && d <= 4 && (h < 12 || h > 14) ? "паведамленні" : "паведамленняў";
      return `${n} ${w}`;
    },
    noConversations: "Няма размоў",
    hideHistory: "Схаваць гісторыю",
    showHistory: "Паказаць гісторыю",
    chatTitle: "ШІ-чат - KalkMate Pro",
    chatSubtitle: "Рашай задачы па матэматыцы, фізіцы, хіміі і біялогіі",
    newChat: "Новы чат",
    chatStart: "Пачні размову з ШІ",
    chatStartDesc: "Устаў умову задачы па матэматыцы, фізіцы, хіміі ці біялогіі, і ШІ дапаможа рашыць яе крок за крокам",
    subjMath: "Матэматыка",
    subjMathLevel: "Базавы і павышаны ўзровень",
    subjPhysics: "Фізіка",
    subjExtended: "Павышаны ўзровень",
    subjChemistry: "Хімія",
    subjBiology: "Біялогія",
    copyAnswer: "Капіяваць адказ",
    copied: "Скапіявана",
    copy: "Капіяваць",
    thinking: "Думаю...",
    removeFile: "Выдаліць",
    chatPlaceholder: "Устаў умову задачы або далучы фота (Ctrl+V працуе і для выяў)...",
    attachFile: "Далучыць фота (макс. 4)",
    send: "Адправіць",
    unpinning: "Адвязваю...",
    unpin: "Адвязаць",
    redeemHeading: "Актывуй код з каробкі (+2 млн токенаў)",
    redeemDesc: "Ліцэнзійны код знойдзеш у каробцы калькулятара. Актывацыя аднаразова дадае 2 000 000 токенаў ШІ да твайго балансу.",
    licenseCodePlaceholder: "abcd123-+=%abcd",
    redeeming: "Актывую...",
    redeem: "Актываваць",
    tokenUsage: "/ Баланс токенаў",
    effectiveTokens: "эфектыўных токенаў на акаўнце",
    remaining: "ЗАСТАЛОСЯ",
    aiLoadFailed: "Не ўдалося загрузіць налады ШІ і баланс токенаў.",
    tasksLeftLabel: "Засталося задач",
    maturaTasks: "задач",
    perLicenseLabel: "На 2 млн токенаў",
    forModel: (m) => `для мадэлі ${m}`,
    defaultModel: "па змаўчанні",
    modelPerformance: "ЭФЕКТЫЎНАСЦЬ МАДЭЛЯЎ — колькі задач на 2 млн токенаў",
    tasksAbbr: "зад.",
    tokenEstimateNote: "Ацэнка для тыповай задачы (~800 рэальных токенаў: увод + адказ). Без падпіскі — калі баланс скончыцца, дакупі пакет ніжэй.",
    buyTokens: "/ Купіць токены",
    buyTokensDesc: "Папоўні баланс токенаў. Аднаразовая аплата (картка / BLIK / Przelewy24) — токены налічваюцца адразу пасля аплаты.",
    popular: "ПАПУЛЯРНЫ",
    packLabel: (t) => `${t / 1_000_000} млн токенаў`,
    maturaTasksApprox: "задач",
    redirecting: "Перанакіраванне...",
    buy: "Купіць",
    aiModelHeading: "/ Мадэль ШІ",
    aiModelDesc: "Выберы мадэль. Множнік (×) паказвае, колькі эфектыўных токенаў каштуе адзін запыт у параўнанні з самай таннай.",
    aiModeHeading: "/ Рэжым ШІ",
    maturaCke: "Экзамен",
    maturaCkeTitle: "Экзаменацыйны рэжым (матэматыка, фізіка, хімія, біялогія)",
    rawAi: "Чысты ШІ",
    rawAiTitle: "Універсальны рэжым — любы прадмет (электроніка, інфарматыка, мовы...)",
    rawModeDesc: "Універсальны рэжым — ШІ працуе для электронікі, інфарматыкі, моў і іншага.",
    maturaModeDesc: "Экзаменацыйны рэжым — ШІ адказвае крок за крокам (матэматыка/фізіка/хімія/біялогія).",
    pairCalculator: "Спалучыць калькулятар",
    addYourDevice: "Новая",
    deviceWord: "прылада",
    pairIntro1: "Увядзі ",
    pairIntro2: " з калькулятара (Налады → WiFi і акаўнт → ID прылады + QR) і ",
    pairIntro3: " (Налады → Бяспека → Код ШІ).",
    pairWarning: "⚠ Калькулятар спачатку павінен быць падключаны да WiFi і зарэгістравацца на серверы.",
    deviceIdLabel: "Device ID (MAC)",
    unlockCodeLabel: "Код разблакіроўкі",
    pairing: "Спалучаю...",
    pairButton: "Спалучыць прыладу",
    errorLabel: "/ ПАМЫЛКА",
    paired: "✓ Спалучана",
    deviceAdded: "Прылада дададзена да акаўнта.",
    yourDevice: "Твая",
    license: "Ліцэнзія",
    firmware: "Прашыўка",
    requests: "Запытаў",
    aiModeAndModel: "/ Рэжым і мадэль ШІ",
    aiModeSetInTab: (link) => <>Мадэль ШІ і рэжым (Экзамен / Чысты ШІ) можна задаць ва ўкладцы {link}.</>,
    photoGallery: "/ Галерэя фота",
    photosCount: (n) => `ФОТА: ${n}`,
    noPhotos: "Няма фота. Сфатаграфуй задачу камерай калькулятара.",
    solutionHistory: "/ Гісторыя рашэнняў",
    recordsCount: (n) => `ЗАПІСАЎ: ${n}`,
    noTasksSolved: "Пакуль не рашана ніводнай задачы.",
    photo: "📷 Фота",
    close: "Закрыць ×",
    solution: "/ Рашэнне",
    task: "Задача",
    calcRequired: "/ патрэбны калькулятар",
    pairFirst: (link) => <>Спачатку спалучы калькулятар ва ўкладцы {link}.</>,
    notesOffline: (n) => `Афлайн-нататкі (${n}/50)`,
    syncToDevice: "Сінхранізацыя з прыладай праз WiFi",
    editNote: "Рэдагаваць нататку",
    newNote: "Новая нататка",
    noteTitlePlaceholder: "Назва (макс. 60 сімвалаў)",
    noteContentPlaceholder: "Змест (макс. 4000 сімвалаў – формулы, азначэнні)",
    cancel: "Скасаваць",
    saving: "Захоўваю...",
    save: "Захаваць",
    add: "Дадаць",
    noNotes: "Няма нататак.",
    noTitle: "(без назвы)",
    empty: "(пуста)",
    edit: "Рэдагаваць",
    delete: "Выдаліць",
    testsHeading: (n) => `Кантрольныя (${n}/50)`,
    markdownOk: "Markdown/LaTeX OK",
    editTest: "Рэдагаваць кантрольную",
    newTest: "Новая кантрольная",
    testTitlePlaceholder: "Назва (напр. Матэматыка 2026 – прабная 1)",
    testContentPlaceholder: "Устаў сюды рашэнне (markdown, LaTeX, $..$, **тлусты**...)",
    noTests: "Няма кантрольных.",
    charsCount: (n) => `${n} сімв.`,
    account: "/ Акаўнт",
    loggedInAs: "Увайшоў як",
    changePassword: "/ Змена пароля",
    currentPassword: "Цяперашні пароль",
    newPassword: "Новы пароль (мін. 6 сімвалаў)",
    repeatNewPassword: "Паўтары новы пароль",
    changePasswordBtn: "Змяніць пароль",
    changeEmail: "/ Змена адраса email",
    newEmail: "Новы адрас email",
    confirmWithPassword: "Пацвердзі паролем",
    changeEmailBtn: "Змяніць email",
    emailChangeNote: "Мы дашлём спасылку для пацвярджэння на новы адрас — змена адбудзецца толькі пасля націску на яе.",
    emailChangeLogout: "Email зменены. Неўзабаве адбудзецца выхад з акаўнта...",
    newsletterLoadFailed: "Не ўдалося загрузіць статус рассылкі.",
    newsletterSaveFailed: "Не ўдалося захаваць згоду на рассылку.",
    dataHeading: "/ Твае даныя",
    exportData: "Спампаваць мае даныя",
    exportDataDesc: "Файл JSON з усімі данымі, звязанымі з тваім акаўнтам (GDPR, арт. 20).",
    exporting: "Рыхтую…",
    exportFailed: "Не ўдалося спампаваць даныя.",
    deleteAccount: "Выдаліць акаўнт",
    deleteAccountDesc: "Назаўсёды выдаляе акаўнт, гісторыю чатаў, нататкі, кантрольныя і сувязь з калькулятарам. Гэта дзеянне нельга адмяніць.",
    deletePasswordPlaceholder: "Пароль ад акаўнта",
    deleteGoogleHint: (p) => `Уваходзіш праз Google (без пароля)? Пакінь пароль пустым і ўпішы ніжэй: ${p}`,
    deleteAccountBtn: "Выдаліць акаўнт назаўсёды",
    deleting: "Выдаляю…",
    deleteFailed: "Не ўдалося выдаліць акаўнт.",
    deleteNeedConfirm: (p) => `Увядзі пароль або ўпішы «${p}», каб пацвердзіць.`,
    featureUnavailable: "Гэтая функцыя пакуль недаступная — паспрабуй пазней або напішы нам.",
    session: "/ Сесія",
  },
  es: {
    logout: "Cerrar sesión ↗",
    logoutLong: "Cerrar sesión ↗",
    newsletterTitle: "/ Newsletter",
    newsletterDesc: "Novedades, promociones y cupones de KalkMate por email. Puedes retirar el consentimiento cuando quieras — los emails sobre pedidos y tu cuenta llegan igualmente.",
    newsletterOn: "Suscrito ✓ — haz clic para darte de baja",
    newsletterOff: "Suscribirme a la newsletter",
    yourPanel: "[ 00 ] · Tu panel",
    greeting: (n) => <>Hola, {n}.</>,
    sessionActive: "Sesión activa",
    loading: "Cargando...",
    tabsOrders: "Pedidos",
    tabsChat: "Chat IA",
    tabsAi: "IA",
    tabsCalculator: "Calculadora",
    tabsNotes: "Notas",
    tabsTests: "Exámenes",
    tabsSettings: "Ajustes de la cuenta",
    alertPaymentStart: "No se ha podido iniciar el pago",
    alertNetwork: "Error de red",
    alertSaveFailed: "No se ha podido guardar",
    errGeneric: "Error",
    pwTooShort: "La nueva contraseña debe tener al menos 6 caracteres",
    pwMismatch: "Las contraseñas no coinciden",
    pwChanged: "La contraseña se ha cambiado.",
    emailChanged: "Hemos enviado un enlace a la nueva dirección — el cambio se aplicará cuando hagas clic en él.",
    alertNoDeviceUnpair: "No hay ningún dispositivo que desvincular.",
    confirmUnpair: (id) => `¿Desvincular el dispositivo ${id}? Podrás volver a vincularlo.`,
    alertError: "Error",
    confirmDeleteNote: "¿Eliminar la nota?",
    confirmDeleteTest: "¿Eliminar el examen?",
    confirmDeleteConversation: "¿Seguro que quieres eliminar esta conversación?",
    errPairFailed: "No se ha podido vincular",
    errNetwork: "Error de red — comprueba tu conexión a internet.",
    sessionExpired: "La sesión ha caducado — vuelve a iniciar sesión.",
    fileAttached: "(archivo adjunto)",
    serverError: (s) => `Error del servidor (${s})`,
    tryAgain: "Inténtalo de nuevo.",
    chatNoTokens: "Te has quedado sin tokens de IA. Compra un paquete de tokens o activa el código de la caja para continuar.",
    chatNoAccess: "Esta cuenta no tiene acceso a la IA. Revisa tu saldo de tokens — si el problema continúa, escríbenos a kontakt@kalkmate.pl.",
    chatTooLarge: "La foto es demasiado grande. Elimínala o adjunta una más pequeña (máx. 4 fotos).",
    chatOnlyImages: "Solo se pueden adjuntar fotos (JPG, PNG, WebP).",
    chatTooMany: "Demasiadas solicitudes. Espera un momento y vuelve a intentarlo.",
    chatUpstream: "El servidor de IA no responde ahora mismo. Tu mensaje ha vuelto al campo de texto — inténtalo de nuevo en un momento.",
    chatReadFailed: "No se ha podido leer la foto adjunta.",
    convLoadFailed: "No se ha podido cargar la conversación.",
    convDeleteFailed: "No se ha podido eliminar la conversación.",
    goBuyTokens: "Comprar tokens →",
    dismiss: "Cerrar",
    imgProcessing: "Reduciendo la foto…",
    imgTooMany: (m) => `Máx. ${m} fotos por mensaje.`,
    imgDecodeFailed: (n) => `No se ha podido leer la foto «${n}».`,
    imgTooLarge: (n) => `La foto «${n}» es demasiado grande incluso tras reducirla.`,
    returnTokensSuccess: "Pago recibido — los tokens aparecerán en tu cuenta en unos instantes.",
    returnTokensCancelled: "Se ha cancelado el pago de los tokens.",
    loadFailed: "No se han podido cargar los datos.",
    retry: "Intentar de nuevo",
    loadMore: "Mostrar más",
    licenseRedeemed: "El código se ha activado.",
    licenseTokensAdded: (n, b) => `Código activado — se han añadido ${n} tokens. Saldo: ${b}.`,
    enterLicenseCode: "Introduce el código de la caja",
    licenseRedeemFailed: "No se ha podido activar el código",
    licenseRedeemError: "Se ha producido un error al activar el código",
    ordersHeading: "Historial de pedidos",
    ordersSubtitle: "Tus pedidos y el estado del envío",
    ordersEmpty: "Todavía no tienes pedidos",
    ordersCta: "Pedir KalkMate",
    orderNo: (n) => `Pedido #${n}`,
    statusPaid: "✓ Pagado",
    statusPending: "⏳ Pendiente",
    statusCancelled: "✗ Cancelado",
    amount: "Importe",
    pickupPoint: "Punto de recogida",
    shipmentStatus: "Estado del envío",
    shipped: "📦 Enviado",
    awaitingShipment: "⏰ Pendiente",
    trackingNumber: "Número de seguimiento",
    chatHistories: "Historial",
    newConversation: "Nueva conversación",
    deleteTitle: "Eliminar",
    messagesCount: (n) => `${n} ${n === 1 ? "mensaje" : "mensajes"}`,
    noConversations: "No hay conversaciones",
    hideHistory: "Ocultar historial",
    showHistory: "Mostrar historial",
    chatTitle: "Chat IA - KalkMate Pro",
    chatSubtitle: "Resuelve problemas de matemáticas, física, química y biología",
    newChat: "Nuevo chat",
    chatStart: "Empieza una conversación con la IA",
    chatStartDesc: "Pega un problema de matemáticas, física, química o biología y la IA te ayudará a resolverlo paso a paso",
    subjMath: "Matemáticas",
    subjMathLevel: "Nivel básico y avanzado",
    subjPhysics: "Física",
    subjExtended: "Nivel avanzado",
    subjChemistry: "Química",
    subjBiology: "Biología",
    copyAnswer: "Copiar respuesta",
    copied: "Copiado",
    copy: "Copiar",
    thinking: "Pensando...",
    removeFile: "Quitar",
    chatPlaceholder: "Pega el enunciado o adjunta una foto (Ctrl+V también funciona con imágenes)...",
    attachFile: "Adjuntar foto (máx. 4)",
    send: "Enviar",
    unpinning: "Desvinculando...",
    unpin: "Desvincular",
    redeemHeading: "Activa el código de la caja (+2 millones de tokens)",
    redeemDesc: "Encontrarás el código de licencia en la caja de la calculadora. Al activarlo se añaden una sola vez 2 000 000 tokens de IA a tu saldo.",
    licenseCodePlaceholder: "abcd123-+=%abcd",
    redeeming: "Activando...",
    redeem: "Activar",
    tokenUsage: "/ Saldo de tokens",
    effectiveTokens: "tokens efectivos en tu cuenta",
    remaining: "RESTANTE",
    aiLoadFailed: "No se han podido cargar los ajustes de IA ni el saldo de tokens.",
    tasksLeftLabel: "Problemas restantes",
    maturaTasks: "problemas",
    perLicenseLabel: "Por 2 millones de tokens",
    forModel: (m) => `con el modelo ${m}`,
    defaultModel: "predeterminado",
    modelPerformance: "RENDIMIENTO DE LOS MODELOS — problemas por 2 millones de tokens",
    tasksAbbr: "probl.",
    tokenEstimateNote: "Estimación para un problema típico (~800 tokens reales de entrada + respuesta). Sin suscripción — cuando se acabe el saldo, compra un paquete abajo.",
    buyTokens: "/ Comprar tokens",
    buyTokensDesc: "Recarga tu saldo de tokens. Pago único (tarjeta / BLIK / Przelewy24) — los tokens se añaden en cuanto se completa el pago.",
    popular: "POPULAR",
    packLabel: (t) => `${t / 1_000_000} ${t === 1_000_000 ? "millón" : "millones"} de tokens`,
    maturaTasksApprox: "problemas",
    redirecting: "Redirigiendo...",
    buy: "Comprar",
    aiModelHeading: "/ Modelo de IA",
    aiModelDesc: "Elige un modelo. El multiplicador (×) indica cuántos tokens efectivos cuesta una consulta en comparación con el más barato.",
    aiModeHeading: "/ Modo de IA",
    maturaCke: "Examen",
    maturaCkeTitle: "Modo examen (matemáticas, física, química, biología)",
    rawAi: "IA pura",
    rawAiTitle: "Modo universal — cualquier asignatura (electrónica, informática, idiomas...)",
    rawModeDesc: "Modo universal — la IA sirve para electrónica, informática, idiomas y más.",
    maturaModeDesc: "Modo examen — la IA responde paso a paso (matemáticas/física/química/biología).",
    pairCalculator: "Vincular calculadora",
    addYourDevice: "Añade tu",
    deviceWord: "dispositivo",
    pairIntro1: "Introduce el ",
    pairIntro2: " de la calculadora (Ajustes → WiFi y cuenta → ID equipo + QR) y el ",
    pairIntro3: " (Ajustes → Seguridad → Código IA).",
    pairWarning: "⚠ Primero, la calculadora debe estar conectada al WiFi y haberse registrado en el servidor.",
    deviceIdLabel: "Device ID (MAC)",
    unlockCodeLabel: "Código de desbloqueo",
    pairing: "Vinculando...",
    pairButton: "Vincular dispositivo",
    errorLabel: "/ ERROR",
    paired: "✓ Vinculado",
    deviceAdded: "Dispositivo añadido a tu cuenta.",
    yourDevice: "Tu",
    license: "Licencia",
    firmware: "Firmware",
    requests: "Consultas",
    aiModeAndModel: "/ Modo y modelo de IA",
    aiModeSetInTab: (link) => <>El modelo de IA y el modo (Examen / IA pura) se configuran en la pestaña {link}.</>,
    photoGallery: "/ Galería de fotos",
    photosCount: (n) => `${n} FOTOS`,
    noPhotos: "No hay fotos. Fotografía un problema con la cámara de la calculadora.",
    solutionHistory: "/ Historial de soluciones",
    recordsCount: (n) => `${n} REGISTROS`,
    noTasksSolved: "Todavía no se ha resuelto ningún problema.",
    photo: "📷 Foto",
    close: "Cerrar ×",
    solution: "/ Solución",
    task: "Problema",
    calcRequired: "/ se necesita la calculadora",
    pairFirst: (link) => <>Primero vincula la calculadora en la pestaña {link}.</>,
    notesOffline: (n) => `Notas sin conexión (${n}/50)`,
    syncToDevice: "Se sincronizan con el dispositivo por WiFi",
    editNote: "Editar nota",
    newNote: "Nueva nota",
    noteTitlePlaceholder: "Título (máx. 60 caracteres)",
    noteContentPlaceholder: "Contenido (máx. 4000 caracteres – fórmulas, definiciones)",
    cancel: "Cancelar",
    saving: "Guardando...",
    save: "Guardar",
    add: "Añadir",
    noNotes: "No hay notas.",
    noTitle: "(sin título)",
    empty: "(vacía)",
    edit: "Editar",
    delete: "Eliminar",
    testsHeading: (n) => `Exámenes (${n}/50)`,
    markdownOk: "Markdown/LaTeX OK",
    editTest: "Editar examen",
    newTest: "Nuevo examen",
    testTitlePlaceholder: "Título (p. ej. Mates 2026 – simulacro 1)",
    testContentPlaceholder: "Pega aquí la solución (markdown, LaTeX, $..$, **negrita**...)",
    noTests: "No hay exámenes.",
    charsCount: (n) => `${n} caracteres`,
    account: "/ Cuenta",
    loggedInAs: "Sesión iniciada como",
    changePassword: "/ Cambiar contraseña",
    currentPassword: "Contraseña actual",
    newPassword: "Nueva contraseña (mín. 6 caracteres)",
    repeatNewPassword: "Repite la nueva contraseña",
    changePasswordBtn: "Cambiar contraseña",
    changeEmail: "/ Cambiar dirección de email",
    newEmail: "Nueva dirección de email",
    confirmWithPassword: "Confirma con tu contraseña",
    changeEmailBtn: "Cambiar email",
    emailChangeNote: "Enviaremos un enlace de confirmación a la nueva dirección — el cambio solo se aplicará cuando hagas clic en él.",
    emailChangeLogout: "Email cambiado. Se cerrará tu sesión en unos instantes...",
    newsletterLoadFailed: "No se ha podido cargar el estado de la newsletter.",
    newsletterSaveFailed: "No se ha podido guardar el consentimiento de la newsletter.",
    dataHeading: "/ Tus datos",
    exportData: "Descargar mis datos",
    exportDataDesc: "Un archivo JSON con todos los datos vinculados a tu cuenta (RGPD, art. 20).",
    exporting: "Preparando…",
    exportFailed: "No se han podido descargar los datos.",
    deleteAccount: "Eliminar cuenta",
    deleteAccountDesc: "Elimina de forma permanente la cuenta, el historial de chats, las notas, los exámenes y la vinculación con la calculadora. Esta acción no se puede deshacer.",
    deletePasswordPlaceholder: "Contraseña de la cuenta",
    deleteGoogleHint: (p) => `¿Inicias sesión con Google (sin contraseña)? Deja la contraseña vacía y escribe abajo: ${p}`,
    deleteAccountBtn: "Eliminar la cuenta para siempre",
    deleting: "Eliminando…",
    deleteFailed: "No se ha podido eliminar la cuenta.",
    deleteNeedConfirm: (p) => `Introduce tu contraseña o escribe «${p}» para confirmar.`,
    featureUnavailable: "Esta función aún no está disponible — inténtalo más tarde o escríbenos.",
    session: "/ Sesión",
  },
  pt: {
    logout: "Terminar sessão ↗",
    logoutLong: "Terminar sessão ↗",
    newsletterTitle: "/ Newsletter",
    newsletterDesc: "Novidades, promoções e cupões da KalkMate por email. Podes retirar o consentimento a qualquer momento — os emails sobre encomendas e conta são enviados de qualquer forma.",
    newsletterOn: "Subscrito ✓ — clica para cancelar",
    newsletterOff: "Subscrever a newsletter",
    yourPanel: "[ 00 ] · O teu painel",
    greeting: (n) => <>Olá, {n}.</>,
    sessionActive: "Sessão ativa",
    loading: "A carregar...",
    tabsOrders: "Encomendas",
    tabsChat: "Chat IA",
    tabsAi: "IA",
    tabsCalculator: "Calculadora",
    tabsNotes: "Notas",
    tabsTests: "Testes",
    tabsSettings: "Definições da conta",
    alertPaymentStart: "Não foi possível iniciar o pagamento",
    alertNetwork: "Erro de rede",
    alertSaveFailed: "Não foi possível guardar",
    errGeneric: "Erro",
    pwTooShort: "A nova palavra-passe deve ter pelo menos 6 caracteres",
    pwMismatch: "As palavras-passe não coincidem",
    pwChanged: "A palavra-passe foi alterada.",
    emailChanged: "Enviámos uma ligação para o novo endereço — a alteração tem efeito quando clicares nela.",
    alertNoDeviceUnpair: "Não há nenhum dispositivo para desassociar.",
    confirmUnpair: (id) => `Desassociar o dispositivo ${id}? Poderás voltar a emparelhá-lo.`,
    alertError: "Erro",
    confirmDeleteNote: "Eliminar a nota?",
    confirmDeleteTest: "Eliminar o teste?",
    confirmDeleteConversation: "Tens a certeza de que queres eliminar esta conversa?",
    errPairFailed: "Não foi possível emparelhar",
    errNetwork: "Erro de rede — verifica a ligação à internet.",
    sessionExpired: "A sessão expirou — inicia sessão novamente.",
    fileAttached: "(ficheiro anexado)",
    serverError: (s) => `Erro do servidor (${s})`,
    tryAgain: "Tenta novamente.",
    chatNoTokens: "Ficaste sem tokens de IA. Compra um pacote de tokens ou ativa o código da caixa para continuar.",
    chatNoAccess: "Esta conta não tem acesso à IA. Verifica o saldo de tokens — se o problema persistir, escreve-nos para kontakt@kalkmate.pl.",
    chatTooLarge: "A foto é demasiado grande. Remove-a ou anexa uma mais pequena (máx. 4 fotos).",
    chatOnlyImages: "Só é possível anexar fotos (JPG, PNG, WebP).",
    chatTooMany: "Demasiados pedidos. Aguarda um momento e tenta novamente.",
    chatUpstream: "O servidor de IA não está a responder neste momento. A tua mensagem voltou para o campo de texto — tenta novamente daqui a pouco.",
    chatReadFailed: "Não foi possível ler a foto anexada.",
    convLoadFailed: "Não foi possível carregar a conversa.",
    convDeleteFailed: "Não foi possível eliminar a conversa.",
    goBuyTokens: "Comprar tokens →",
    dismiss: "Fechar",
    imgProcessing: "A reduzir a foto…",
    imgTooMany: (m) => `Máx. ${m} fotos por mensagem.`,
    imgDecodeFailed: (n) => `Não foi possível ler a foto «${n}».`,
    imgTooLarge: (n) => `A foto «${n}» é demasiado grande mesmo depois de reduzida.`,
    returnTokensSuccess: "Pagamento recebido — os tokens aparecerão na tua conta dentro de instantes.",
    returnTokensCancelled: "O pagamento dos tokens foi cancelado.",
    loadFailed: "Não foi possível carregar os dados.",
    retry: "Tentar novamente",
    loadMore: "Mostrar mais",
    licenseRedeemed: "O código foi ativado.",
    licenseTokensAdded: (n, b) => `Código ativado — foram adicionados ${n} tokens. Saldo: ${b}.`,
    enterLicenseCode: "Introduz o código da caixa",
    licenseRedeemFailed: "Não foi possível ativar o código",
    licenseRedeemError: "Ocorreu um erro ao ativar o código",
    ordersHeading: "Histórico de encomendas",
    ordersSubtitle: "As tuas encomendas e o estado do envio",
    ordersEmpty: "Ainda não tens encomendas",
    ordersCta: "Encomendar KalkMate",
    orderNo: (n) => `Encomenda #${n}`,
    statusPaid: "✓ Paga",
    statusPending: "⏳ Pendente",
    statusCancelled: "✗ Cancelada",
    amount: "Valor",
    pickupPoint: "Ponto de recolha",
    shipmentStatus: "Estado do envio",
    shipped: "📦 Enviada",
    awaitingShipment: "⏰ Pendente",
    trackingNumber: "Número de seguimento",
    chatHistories: "Histórico",
    newConversation: "Nova conversa",
    deleteTitle: "Eliminar",
    messagesCount: (n) => `${n} ${n === 1 ? "mensagem" : "mensagens"}`,
    noConversations: "Sem conversas",
    hideHistory: "Ocultar histórico",
    showHistory: "Mostrar histórico",
    chatTitle: "Chat IA - KalkMate Pro",
    chatSubtitle: "Resolve exercícios de matemática, física, química e biologia",
    newChat: "Novo chat",
    chatStart: "Começa uma conversa com a IA",
    chatStartDesc: "Cola um exercício de matemática, física, química ou biologia e a IA ajuda-te a resolvê-lo passo a passo",
    subjMath: "Matemática",
    subjMathLevel: "Nível básico e avançado",
    subjPhysics: "Física",
    subjExtended: "Nível avançado",
    subjChemistry: "Química",
    subjBiology: "Biologia",
    copyAnswer: "Copiar resposta",
    copied: "Copiado",
    copy: "Copiar",
    thinking: "A pensar...",
    removeFile: "Remover",
    chatPlaceholder: "Cola o enunciado ou anexa uma foto (Ctrl+V também funciona com imagens)...",
    attachFile: "Anexar foto (máx. 4)",
    send: "Enviar",
    unpinning: "A desassociar...",
    unpin: "Desassociar",
    redeemHeading: "Ativa o código da caixa (+2 milhões de tokens)",
    redeemDesc: "Encontras o código de licença na caixa da calculadora. A ativação adiciona uma única vez 2 000 000 tokens de IA ao teu saldo.",
    licenseCodePlaceholder: "abcd123-+=%abcd",
    redeeming: "A ativar...",
    redeem: "Ativar",
    tokenUsage: "/ Saldo de tokens",
    effectiveTokens: "tokens efetivos na tua conta",
    remaining: "RESTANTE",
    aiLoadFailed: "Não foi possível carregar as definições de IA e o saldo de tokens.",
    tasksLeftLabel: "Exercícios restantes",
    maturaTasks: "exercícios",
    perLicenseLabel: "Por 2 milhões de tokens",
    forModel: (m) => `com o modelo ${m}`,
    defaultModel: "predefinido",
    modelPerformance: "DESEMPENHO DOS MODELOS — exercícios por 2 milhões de tokens",
    tasksAbbr: "exerc.",
    tokenEstimateNote: "Estimativa para um exercício típico (~800 tokens reais de entrada + resposta). Sem subscrição — quando o saldo acabar, compra um pacote abaixo.",
    buyTokens: "/ Comprar tokens",
    buyTokensDesc: "Carrega o teu saldo de tokens. Pagamento único (cartão / BLIK / Przelewy24) — os tokens são adicionados logo após o pagamento.",
    popular: "POPULAR",
    packLabel: (t) => `${t / 1_000_000} ${t === 1_000_000 ? "milhão" : "milhões"} de tokens`,
    maturaTasksApprox: "exercícios",
    redirecting: "A redirecionar...",
    buy: "Comprar",
    aiModelHeading: "/ Modelo de IA",
    aiModelDesc: "Escolhe um modelo. O multiplicador (×) mostra quantos tokens efetivos custa um pedido em comparação com o mais barato.",
    aiModeHeading: "/ Modo de IA",
    maturaCke: "Exame",
    maturaCkeTitle: "Modo exame (matemática, física, química, biologia)",
    rawAi: "IA pura",
    rawAiTitle: "Modo universal — qualquer disciplina (eletrónica, informática, línguas...)",
    rawModeDesc: "Modo universal — a IA funciona para eletrónica, informática, línguas e muito mais.",
    maturaModeDesc: "Modo exame — a IA responde passo a passo (matemática/física/química/biologia).",
    pairCalculator: "Emparelhar calculadora",
    addYourDevice: "Adiciona o teu",
    deviceWord: "dispositivo",
    pairIntro1: "Introduz o ",
    pairIntro2: " da calculadora (Definições → WiFi e conta → ID aparelho + QR) e o ",
    pairIntro3: " (Definições → Segurança → Código IA).",
    pairWarning: "⚠ Primeiro, a calculadora tem de estar ligada ao WiFi e registada no servidor.",
    deviceIdLabel: "Device ID (MAC)",
    unlockCodeLabel: "Código de desbloqueio",
    pairing: "A emparelhar...",
    pairButton: "Emparelhar dispositivo",
    errorLabel: "/ ERRO",
    paired: "✓ Emparelhado",
    deviceAdded: "Dispositivo adicionado à conta.",
    yourDevice: "O teu",
    license: "Licença",
    firmware: "Firmware",
    requests: "Pedidos",
    aiModeAndModel: "/ Modo e modelo de IA",
    aiModeSetInTab: (link) => <>O modelo de IA e o modo (Exame / IA pura) definem-se no separador {link}.</>,
    photoGallery: "/ Galeria de fotos",
    photosCount: (n) => `${n} FOTOS`,
    noPhotos: "Sem fotos. Fotografa um exercício com a câmara da calculadora.",
    solutionHistory: "/ Histórico de soluções",
    recordsCount: (n) => `${n} REGISTOS`,
    noTasksSolved: "Ainda não foi resolvido nenhum exercício.",
    photo: "📷 Foto",
    close: "Fechar ×",
    solution: "/ Solução",
    task: "Exercício",
    calcRequired: "/ é necessária a calculadora",
    pairFirst: (link) => <>Primeiro emparelha a calculadora no separador {link}.</>,
    notesOffline: (n) => `Notas offline (${n}/50)`,
    syncToDevice: "Sincronizadas com o dispositivo por WiFi",
    editNote: "Editar nota",
    newNote: "Nova nota",
    noteTitlePlaceholder: "Título (máx. 60 caracteres)",
    noteContentPlaceholder: "Conteúdo (máx. 4000 caracteres – fórmulas, definições)",
    cancel: "Cancelar",
    saving: "A guardar...",
    save: "Guardar",
    add: "Adicionar",
    noNotes: "Sem notas.",
    noTitle: "(sem título)",
    empty: "(vazia)",
    edit: "Editar",
    delete: "Eliminar",
    testsHeading: (n) => `Testes (${n}/50)`,
    markdownOk: "Markdown/LaTeX OK",
    editTest: "Editar teste",
    newTest: "Novo teste",
    testTitlePlaceholder: "Título (ex. Matemática 2026 – simulado 1)",
    testContentPlaceholder: "Cola aqui a solução (markdown, LaTeX, $..$, **negrito**...)",
    noTests: "Sem testes.",
    charsCount: (n) => `${n} caracteres`,
    account: "/ Conta",
    loggedInAs: "Sessão iniciada como",
    changePassword: "/ Alterar palavra-passe",
    currentPassword: "Palavra-passe atual",
    newPassword: "Nova palavra-passe (mín. 6 caracteres)",
    repeatNewPassword: "Repete a nova palavra-passe",
    changePasswordBtn: "Alterar palavra-passe",
    changeEmail: "/ Alterar endereço de email",
    newEmail: "Novo endereço de email",
    confirmWithPassword: "Confirma com a palavra-passe",
    changeEmailBtn: "Alterar email",
    emailChangeNote: "Vamos enviar uma ligação de confirmação para o novo endereço — a alteração só tem efeito depois de clicares nela.",
    emailChangeLogout: "Email alterado. A sessão vai terminar dentro de instantes...",
    newsletterLoadFailed: "Não foi possível carregar o estado da newsletter.",
    newsletterSaveFailed: "Não foi possível guardar o consentimento da newsletter.",
    dataHeading: "/ Os teus dados",
    exportData: "Descarregar os meus dados",
    exportDataDesc: "Um ficheiro JSON com todos os dados associados à tua conta (RGPD, art. 20.º).",
    exporting: "A preparar…",
    exportFailed: "Não foi possível descarregar os dados.",
    deleteAccount: "Eliminar conta",
    deleteAccountDesc: "Elimina permanentemente a conta, o histórico de chats, as notas, os testes e a associação à calculadora. Esta ação não pode ser anulada.",
    deletePasswordPlaceholder: "Palavra-passe da conta",
    deleteGoogleHint: (p) => `Inicias sessão com o Google (sem palavra-passe)? Deixa a palavra-passe vazia e escreve abaixo: ${p}`,
    deleteAccountBtn: "Eliminar a conta para sempre",
    deleting: "A eliminar…",
    deleteFailed: "Não foi possível eliminar a conta.",
    deleteNeedConfirm: (p) => `Introduz a palavra-passe ou escreve «${p}» para confirmar.`,
    featureUnavailable: "Esta funcionalidade ainda não está disponível — tenta mais tarde ou escreve-nos.",
    session: "/ Sessão",
  },
  fr: {
    logout: "Déconnexion ↗",
    logoutLong: "Se déconnecter ↗",
    newsletterTitle: "/ Newsletter",
    newsletterDesc: "Nouveautés, promotions et coupons KalkMate par email. Tu peux retirer ton consentement à tout moment — les emails liés aux commandes et au compte sont envoyés dans tous les cas.",
    newsletterOn: "Abonné ✓ — clique pour te désabonner",
    newsletterOff: "M'abonner à la newsletter",
    yourPanel: "[ 00 ] · Ton espace",
    greeting: (n) => <>Bonjour, {n}.</>,
    sessionActive: "Session active",
    loading: "Chargement...",
    tabsOrders: "Commandes",
    tabsChat: "Chat IA",
    tabsAi: "IA",
    tabsCalculator: "Calculatrice",
    tabsNotes: "Notes",
    tabsTests: "Contrôles",
    tabsSettings: "Paramètres du compte",
    alertPaymentStart: "Impossible de lancer le paiement",
    alertNetwork: "Erreur réseau",
    alertSaveFailed: "Échec de l'enregistrement",
    errGeneric: "Erreur",
    pwTooShort: "Le nouveau mot de passe doit contenir au moins 6 caractères",
    pwMismatch: "Les mots de passe ne correspondent pas",
    pwChanged: "Le mot de passe a été modifié.",
    emailChanged: "Nous avons envoyé un lien à la nouvelle adresse — la modification prendra effet dès que tu cliqueras dessus.",
    alertNoDeviceUnpair: "Aucun appareil à dissocier.",
    confirmUnpair: (id) => `Dissocier l'appareil ${id} ? Tu pourras l'associer à nouveau.`,
    alertError: "Erreur",
    confirmDeleteNote: "Supprimer la note ?",
    confirmDeleteTest: "Supprimer le contrôle ?",
    confirmDeleteConversation: "Veux-tu vraiment supprimer cette conversation ?",
    errPairFailed: "Échec de l'association",
    errNetwork: "Erreur réseau — vérifie ta connexion internet.",
    sessionExpired: "Ta session a expiré — reconnecte-toi.",
    fileAttached: "(fichier joint)",
    serverError: (s) => `Erreur du serveur (${s})`,
    tryAgain: "Réessaie.",
    chatNoTokens: "Tu n'as plus de jetons IA. Achète un pack de jetons ou active le code de la boîte pour continuer.",
    chatNoAccess: "Ce compte n'a pas accès à l'IA. Vérifie ton solde de jetons — si le problème persiste, écris-nous à kontakt@kalkmate.pl.",
    chatTooLarge: "La photo est trop volumineuse. Supprime-la ou joins-en une plus petite (4 photos max.).",
    chatOnlyImages: "Seules les photos peuvent être jointes (JPG, PNG, WebP).",
    chatTooMany: "Trop de requêtes. Patiente un instant et réessaie.",
    chatUpstream: "Le serveur IA ne répond pas pour le moment. Ton message a été remis dans le champ — réessaie dans un instant.",
    chatReadFailed: "Impossible de lire la photo jointe.",
    convLoadFailed: "Impossible de charger la conversation.",
    convDeleteFailed: "Impossible de supprimer la conversation.",
    goBuyTokens: "Acheter des jetons →",
    dismiss: "Fermer",
    imgProcessing: "Réduction de la photo…",
    imgTooMany: (m) => `${m} photos max. par message.`,
    imgDecodeFailed: (n) => `Impossible de lire la photo « ${n} ».`,
    imgTooLarge: (n) => `La photo « ${n} » est trop volumineuse, même après réduction.`,
    returnTokensSuccess: "Paiement reçu — les jetons apparaîtront sur ton compte dans quelques instants.",
    returnTokensCancelled: "Le paiement des jetons a été annulé.",
    loadFailed: "Impossible de charger les données.",
    retry: "Réessayer",
    loadMore: "Afficher plus",
    licenseRedeemed: "Le code a été activé.",
    licenseTokensAdded: (n, b) => `Code activé — ${n} jetons ajoutés. Solde : ${b}.`,
    enterLicenseCode: "Saisis le code de la boîte",
    licenseRedeemFailed: "Impossible d'activer le code",
    licenseRedeemError: "Une erreur s'est produite lors de l'activation du code",
    ordersHeading: "Historique des commandes",
    ordersSubtitle: "Tes commandes et le suivi des livraisons",
    ordersEmpty: "Tu n'as encore passé aucune commande",
    ordersCta: "Commander KalkMate",
    orderNo: (n) => `Commande n° ${n}`,
    statusPaid: "✓ Payée",
    statusPending: "⏳ En attente",
    statusCancelled: "✗ Annulée",
    amount: "Montant",
    pickupPoint: "Point de retrait",
    shipmentStatus: "Statut de la livraison",
    shipped: "📦 Expédiée",
    awaitingShipment: "⏰ En attente",
    trackingNumber: "Numéro de suivi",
    chatHistories: "Historique",
    newConversation: "Nouvelle conversation",
    deleteTitle: "Supprimer",
    messagesCount: (n) => `${n} message${n > 1 ? "s" : ""}`,
    noConversations: "Aucune conversation",
    hideHistory: "Masquer l'historique",
    showHistory: "Afficher l'historique",
    chatTitle: "Chat IA - KalkMate Pro",
    chatSubtitle: "Résous des exercices de maths, physique, chimie et biologie",
    newChat: "Nouveau chat",
    chatStart: "Commence une conversation avec l'IA",
    chatStartDesc: "Colle un exercice de maths, physique, chimie ou biologie et l'IA t'aidera à le résoudre étape par étape",
    subjMath: "Mathématiques",
    subjMathLevel: "Niveau standard et approfondi",
    subjPhysics: "Physique",
    subjExtended: "Niveau approfondi",
    subjChemistry: "Chimie",
    subjBiology: "Biologie",
    copyAnswer: "Copier la réponse",
    copied: "Copié",
    copy: "Copier",
    thinking: "Réflexion...",
    removeFile: "Retirer",
    chatPlaceholder: "Colle l'énoncé ou joins une photo (Ctrl+V fonctionne aussi pour les images)...",
    attachFile: "Joindre une photo (4 max.)",
    send: "Envoyer",
    unpinning: "Dissociation...",
    unpin: "Dissocier",
    redeemHeading: "Active le code de la boîte (+2 millions de jetons)",
    redeemDesc: "Le code de licence se trouve dans la boîte de la calculatrice. L'activation ajoute une seule fois 2 000 000 jetons IA à ton solde.",
    licenseCodePlaceholder: "abcd123-+=%abcd",
    redeeming: "Activation...",
    redeem: "Activer",
    tokenUsage: "/ Solde de jetons",
    effectiveTokens: "jetons effectifs sur ton compte",
    remaining: "RESTANT",
    aiLoadFailed: "Impossible de charger les paramètres IA et le solde de jetons.",
    tasksLeftLabel: "Exercices restants",
    maturaTasks: "exercices",
    perLicenseLabel: "Pour 2 millions de jetons",
    forModel: (m) => `avec le modèle ${m}`,
    defaultModel: "par défaut",
    modelPerformance: "EFFICACITÉ DES MODÈLES — exercices pour 2 millions de jetons",
    tasksAbbr: "ex.",
    tokenEstimateNote: "Estimation pour un exercice type (~800 jetons réels en entrée + réponse). Sans abonnement — quand ton solde est épuisé, achète un pack ci-dessous.",
    buyTokens: "/ Acheter des jetons",
    buyTokensDesc: "Recharge ton solde de jetons. Paiement unique (carte / BLIK / Przelewy24) — les jetons sont ajoutés dès le paiement effectué.",
    popular: "POPULAIRE",
    packLabel: (t) => `${t / 1_000_000} million${t > 1_000_000 ? "s" : ""} de jetons`,
    maturaTasksApprox: "exercices",
    redirecting: "Redirection...",
    buy: "Acheter",
    aiModelHeading: "/ Modèle IA",
    aiModelDesc: "Choisis un modèle. Le multiplicateur (×) indique combien de jetons effectifs coûte une requête par rapport au moins cher.",
    aiModeHeading: "/ Mode IA",
    maturaCke: "Examen",
    maturaCkeTitle: "Mode examen (maths, physique, chimie, biologie)",
    rawAi: "IA brute",
    rawAiTitle: "Mode universel — n'importe quelle matière (électronique, informatique, langues...)",
    rawModeDesc: "Mode universel — l'IA fonctionne pour l'électronique, l'informatique, les langues et plus encore.",
    maturaModeDesc: "Mode examen — l'IA répond étape par étape (maths/physique/chimie/biologie).",
    pairCalculator: "Associer la calculatrice",
    addYourDevice: "Ajoute ton",
    deviceWord: "appareil",
    pairIntro1: "Saisis le ",
    pairIntro2: " de la calculatrice (Paramètres → WiFi et compte → ID appareil + QR) et le ",
    pairIntro3: " (Paramètres → Sécurité → Code IA).",
    pairWarning: "⚠ La calculatrice doit d'abord être connectée au WiFi et s'être signalée au serveur.",
    deviceIdLabel: "Device ID (MAC)",
    unlockCodeLabel: "Code de déverrouillage",
    pairing: "Association...",
    pairButton: "Associer l'appareil",
    errorLabel: "/ ERREUR",
    paired: "✓ Associé",
    deviceAdded: "Appareil ajouté à ton compte.",
    yourDevice: "Ton",
    license: "Licence",
    firmware: "Firmware",
    requests: "Requêtes",
    aiModeAndModel: "/ Mode et modèle IA",
    aiModeSetInTab: (link) => <>Le modèle IA et le mode (Examen / IA brute) se règlent dans l'onglet {link}.</>,
    photoGallery: "/ Galerie photos",
    photosCount: (n) => `${n} PHOTOS`,
    noPhotos: "Aucune photo. Photographie un exercice avec la caméra de la calculatrice.",
    solutionHistory: "/ Historique des solutions",
    recordsCount: (n) => `${n} ENTRÉES`,
    noTasksSolved: "Aucun exercice résolu pour l'instant.",
    photo: "📷 Photo",
    close: "Fermer ×",
    solution: "/ Solution",
    task: "Exercice",
    calcRequired: "/ calculatrice requise",
    pairFirst: (link) => <>Associe d'abord la calculatrice dans l'onglet {link}.</>,
    notesOffline: (n) => `Notes hors ligne (${n}/50)`,
    syncToDevice: "Synchronisées avec l'appareil via WiFi",
    editNote: "Modifier la note",
    newNote: "Nouvelle note",
    noteTitlePlaceholder: "Titre (60 caractères max.)",
    noteContentPlaceholder: "Contenu (4000 caractères max. – formules, définitions)",
    cancel: "Annuler",
    saving: "Enregistrement...",
    save: "Enregistrer",
    add: "Ajouter",
    noNotes: "Aucune note.",
    noTitle: "(sans titre)",
    empty: "(vide)",
    edit: "Modifier",
    delete: "Supprimer",
    testsHeading: (n) => `Contrôles (${n}/50)`,
    markdownOk: "Markdown/LaTeX OK",
    editTest: "Modifier le contrôle",
    newTest: "Nouveau contrôle",
    testTitlePlaceholder: "Titre (ex. Maths 2026 – bac blanc 1)",
    testContentPlaceholder: "Colle ici la solution (markdown, LaTeX, $..$, **gras**...)",
    noTests: "Aucun contrôle.",
    charsCount: (n) => `${n} caractères`,
    account: "/ Compte",
    loggedInAs: "Connecté en tant que",
    changePassword: "/ Changer le mot de passe",
    currentPassword: "Mot de passe actuel",
    newPassword: "Nouveau mot de passe (6 caractères min.)",
    repeatNewPassword: "Répète le nouveau mot de passe",
    changePasswordBtn: "Changer le mot de passe",
    changeEmail: "/ Changer l'adresse email",
    newEmail: "Nouvelle adresse email",
    confirmWithPassword: "Confirme avec ton mot de passe",
    changeEmailBtn: "Changer l'email",
    emailChangeNote: "Nous enverrons un lien de confirmation à la nouvelle adresse — la modification ne prendra effet qu'après avoir cliqué dessus.",
    emailChangeLogout: "Email modifié. Tu vas être déconnecté dans un instant...",
    newsletterLoadFailed: "Impossible de charger le statut de la newsletter.",
    newsletterSaveFailed: "Impossible d'enregistrer le consentement à la newsletter.",
    dataHeading: "/ Tes données",
    exportData: "Télécharger mes données",
    exportDataDesc: "Un fichier JSON contenant toutes les données liées à ton compte (RGPD, art. 20).",
    exporting: "Préparation…",
    exportFailed: "Impossible de télécharger les données.",
    deleteAccount: "Supprimer le compte",
    deleteAccountDesc: "Supprime définitivement le compte, l'historique des chats, les notes, les contrôles et l'association avec la calculatrice. Cette action est irréversible.",
    deletePasswordPlaceholder: "Mot de passe du compte",
    deleteGoogleHint: (p) => `Tu te connectes avec Google (sans mot de passe) ? Laisse le mot de passe vide et saisis ci-dessous : ${p}`,
    deleteAccountBtn: "Supprimer le compte définitivement",
    deleting: "Suppression…",
    deleteFailed: "Impossible de supprimer le compte.",
    deleteNeedConfirm: (p) => `Saisis ton mot de passe ou tape « ${p} » pour confirmer.`,
    featureUnavailable: "Cette fonctionnalité n'est pas encore disponible — réessaie plus tard ou écris-nous.",
    session: "/ Session",
  },
  it: {
    logout: "Esci ↗",
    logoutLong: "Esci dall'account ↗",
    newsletterTitle: "/ Newsletter",
    newsletterDesc: "Novità, promozioni e coupon KalkMate via email. Puoi revocare il consenso in qualsiasi momento — le email su ordini e account arrivano comunque.",
    newsletterOn: "Iscritto ✓ — clicca per annullare l'iscrizione",
    newsletterOff: "Iscrivimi alla newsletter",
    yourPanel: "[ 00 ] · Il tuo pannello",
    greeting: (n) => <>Ciao, {n}.</>,
    sessionActive: "Sessione attiva",
    loading: "Caricamento...",
    tabsOrders: "Ordini",
    tabsChat: "Chat IA",
    tabsAi: "IA",
    tabsCalculator: "Calcolatrice",
    tabsNotes: "Note",
    tabsTests: "Verifiche",
    tabsSettings: "Impostazioni account",
    alertPaymentStart: "Impossibile avviare il pagamento",
    alertNetwork: "Errore di rete",
    alertSaveFailed: "Salvataggio non riuscito",
    errGeneric: "Errore",
    pwTooShort: "La nuova password deve avere almeno 6 caratteri",
    pwMismatch: "Le password non coincidono",
    pwChanged: "La password è stata modificata.",
    emailChanged: "Abbiamo inviato un link al nuovo indirizzo — la modifica avrà effetto quando lo cliccherai.",
    alertNoDeviceUnpair: "Nessun dispositivo da scollegare.",
    confirmUnpair: (id) => `Scollegare il dispositivo ${id}? Potrai abbinarlo di nuovo.`,
    alertError: "Errore",
    confirmDeleteNote: "Eliminare la nota?",
    confirmDeleteTest: "Eliminare la verifica?",
    confirmDeleteConversation: "Vuoi davvero eliminare questa conversazione?",
    errPairFailed: "Abbinamento non riuscito",
    errNetwork: "Errore di rete — controlla la connessione a internet.",
    sessionExpired: "La sessione è scaduta — accedi di nuovo.",
    fileAttached: "(file allegato)",
    serverError: (s) => `Errore del server (${s})`,
    tryAgain: "Riprova.",
    chatNoTokens: "Hai esaurito i token IA. Acquista un pacchetto di token o attiva il codice della confezione per continuare.",
    chatNoAccess: "Questo account non ha accesso all'IA. Controlla il saldo dei token — se il problema persiste, scrivici a kontakt@kalkmate.pl.",
    chatTooLarge: "La foto è troppo grande. Rimuovila o allegane una più piccola (max 4 foto).",
    chatOnlyImages: "Si possono allegare solo foto (JPG, PNG, WebP).",
    chatTooMany: "Troppe richieste. Attendi un momento e riprova.",
    chatUpstream: "Il server IA al momento non risponde. Il tuo messaggio è tornato nel campo di testo — riprova tra poco.",
    chatReadFailed: "Impossibile leggere la foto allegata.",
    convLoadFailed: "Impossibile caricare la conversazione.",
    convDeleteFailed: "Impossibile eliminare la conversazione.",
    goBuyTokens: "Acquista token →",
    dismiss: "Chiudi",
    imgProcessing: "Riduco la foto…",
    imgTooMany: (m) => `Max ${m} foto per messaggio.`,
    imgDecodeFailed: (n) => `Impossibile leggere la foto «${n}».`,
    imgTooLarge: (n) => `La foto «${n}» è troppo grande anche dopo la riduzione.`,
    returnTokensSuccess: "Pagamento ricevuto — i token compariranno sul tuo account tra pochi istanti.",
    returnTokensCancelled: "Il pagamento dei token è stato annullato.",
    loadFailed: "Impossibile caricare i dati.",
    retry: "Riprova",
    loadMore: "Mostra altro",
    licenseRedeemed: "Il codice è stato attivato.",
    licenseTokensAdded: (n, b) => `Codice attivato — aggiunti ${n} token. Saldo: ${b}.`,
    enterLicenseCode: "Inserisci il codice della confezione",
    licenseRedeemFailed: "Impossibile attivare il codice",
    licenseRedeemError: "Si è verificato un errore durante l'attivazione del codice",
    ordersHeading: "Storico ordini",
    ordersSubtitle: "I tuoi ordini e lo stato delle spedizioni",
    ordersEmpty: "Non hai ancora nessun ordine",
    ordersCta: "Ordina KalkMate",
    orderNo: (n) => `Ordine n. ${n}`,
    statusPaid: "✓ Pagato",
    statusPending: "⏳ In attesa",
    statusCancelled: "✗ Annullato",
    amount: "Importo",
    pickupPoint: "Punto di ritiro",
    shipmentStatus: "Stato della spedizione",
    shipped: "📦 Spedito",
    awaitingShipment: "⏰ In attesa",
    trackingNumber: "Numero di tracciamento",
    chatHistories: "Cronologia",
    newConversation: "Nuova conversazione",
    deleteTitle: "Elimina",
    messagesCount: (n) => `${n} ${n === 1 ? "messaggio" : "messaggi"}`,
    noConversations: "Nessuna conversazione",
    hideHistory: "Nascondi cronologia",
    showHistory: "Mostra cronologia",
    chatTitle: "Chat IA - KalkMate Pro",
    chatSubtitle: "Risolvi esercizi di matematica, fisica, chimica e biologia",
    newChat: "Nuova chat",
    chatStart: "Inizia una conversazione con l'IA",
    chatStartDesc: "Incolla un esercizio di matematica, fisica, chimica o biologia e l'IA ti aiuterà a risolverlo passo dopo passo",
    subjMath: "Matematica",
    subjMathLevel: "Livello base e avanzato",
    subjPhysics: "Fisica",
    subjExtended: "Livello avanzato",
    subjChemistry: "Chimica",
    subjBiology: "Biologia",
    copyAnswer: "Copia risposta",
    copied: "Copiato",
    copy: "Copia",
    thinking: "Sto pensando...",
    removeFile: "Rimuovi",
    chatPlaceholder: "Incolla il testo dell'esercizio o allega una foto (Ctrl+V funziona anche con le immagini)...",
    attachFile: "Allega foto (max 4)",
    send: "Invia",
    unpinning: "Scollegamento...",
    unpin: "Scollega",
    redeemHeading: "Attiva il codice della confezione (+2 milioni di token)",
    redeemDesc: "Trovi il codice di licenza nella confezione della calcolatrice. L'attivazione aggiunge una sola volta 2 000 000 token IA al tuo saldo.",
    licenseCodePlaceholder: "abcd123-+=%abcd",
    redeeming: "Attivazione...",
    redeem: "Attiva",
    tokenUsage: "/ Saldo token",
    effectiveTokens: "token effettivi sul tuo account",
    remaining: "RIMANENTI",
    aiLoadFailed: "Impossibile caricare le impostazioni IA e il saldo dei token.",
    tasksLeftLabel: "Esercizi rimasti",
    maturaTasks: "esercizi",
    perLicenseLabel: "Con 2 milioni di token",
    forModel: (m) => `con il modello ${m}`,
    defaultModel: "predefinito",
    modelPerformance: "RENDIMENTO DEI MODELLI — esercizi con 2 milioni di token",
    tasksAbbr: "es.",
    tokenEstimateNote: "Stima per un esercizio tipico (~800 token reali tra input e risposta). Nessun abbonamento — quando il saldo finisce, acquista un pacchetto qui sotto.",
    buyTokens: "/ Acquista token",
    buyTokensDesc: "Ricarica il saldo dei token. Pagamento una tantum (carta / BLIK / Przelewy24) — i token vengono aggiunti subito dopo il pagamento.",
    popular: "POPOLARE",
    packLabel: (t) => `${t / 1_000_000} ${t === 1_000_000 ? "milione" : "milioni"} di token`,
    maturaTasksApprox: "esercizi",
    redirecting: "Reindirizzamento...",
    buy: "Acquista",
    aiModelHeading: "/ Modello IA",
    aiModelDesc: "Scegli un modello. Il moltiplicatore (×) indica quanti token effettivi costa una richiesta rispetto al più economico.",
    aiModeHeading: "/ Modalità IA",
    maturaCke: "Esame",
    maturaCkeTitle: "Modalità esame (matematica, fisica, chimica, biologia)",
    rawAi: "IA pura",
    rawAiTitle: "Modalità universale — qualsiasi materia (elettronica, informatica, lingue...)",
    rawModeDesc: "Modalità universale — l'IA funziona per elettronica, informatica, lingue e altro.",
    maturaModeDesc: "Modalità esame — l'IA risponde passo dopo passo (matematica/fisica/chimica/biologia).",
    pairCalculator: "Abbina calcolatrice",
    addYourDevice: "Aggiungi il tuo",
    deviceWord: "dispositivo",
    pairIntro1: "Inserisci il ",
    pairIntro2: " della calcolatrice (Impostazioni → WiFi e account → ID disposit. + QR) e il ",
    pairIntro3: " (Impostazioni → Sicurezza → Codice IA).",
    pairWarning: "⚠ La calcolatrice deve prima essere connessa al WiFi e registrata sul server.",
    deviceIdLabel: "Device ID (MAC)",
    unlockCodeLabel: "Codice di sblocco",
    pairing: "Abbinamento...",
    pairButton: "Abbina dispositivo",
    errorLabel: "/ ERRORE",
    paired: "✓ Abbinato",
    deviceAdded: "Dispositivo aggiunto all'account.",
    yourDevice: "Il tuo",
    license: "Licenza",
    firmware: "Firmware",
    requests: "Richieste",
    aiModeAndModel: "/ Modalità e modello IA",
    aiModeSetInTab: (link) => <>Il modello IA e la modalità (Esame / IA pura) si impostano nella scheda {link}.</>,
    photoGallery: "/ Galleria foto",
    photosCount: (n) => `${n} FOTO`,
    noPhotos: "Nessuna foto. Fotografa un esercizio con la fotocamera della calcolatrice.",
    solutionHistory: "/ Storico soluzioni",
    recordsCount: (n) => `${n} VOCI`,
    noTasksSolved: "Nessun esercizio risolto finora.",
    photo: "📷 Foto",
    close: "Chiudi ×",
    solution: "/ Soluzione",
    task: "Esercizio",
    calcRequired: "/ serve la calcolatrice",
    pairFirst: (link) => <>Prima abbina la calcolatrice nella scheda {link}.</>,
    notesOffline: (n) => `Note offline (${n}/50)`,
    syncToDevice: "Sincronizzate con il dispositivo via WiFi",
    editNote: "Modifica nota",
    newNote: "Nuova nota",
    noteTitlePlaceholder: "Titolo (max 60 caratteri)",
    noteContentPlaceholder: "Contenuto (max 4000 caratteri – formule, definizioni)",
    cancel: "Annulla",
    saving: "Salvataggio...",
    save: "Salva",
    add: "Aggiungi",
    noNotes: "Nessuna nota.",
    noTitle: "(senza titolo)",
    empty: "(vuota)",
    edit: "Modifica",
    delete: "Elimina",
    testsHeading: (n) => `Verifiche (${n}/50)`,
    markdownOk: "Markdown/LaTeX OK",
    editTest: "Modifica verifica",
    newTest: "Nuova verifica",
    testTitlePlaceholder: "Titolo (es. Matematica 2026 – simulazione 1)",
    testContentPlaceholder: "Incolla qui la soluzione (markdown, LaTeX, $..$, **grassetto**...)",
    noTests: "Nessuna verifica.",
    charsCount: (n) => `${n} caratteri`,
    account: "/ Account",
    loggedInAs: "Accesso effettuato come",
    changePassword: "/ Cambia password",
    currentPassword: "Password attuale",
    newPassword: "Nuova password (min. 6 caratteri)",
    repeatNewPassword: "Ripeti la nuova password",
    changePasswordBtn: "Cambia password",
    changeEmail: "/ Cambia indirizzo email",
    newEmail: "Nuovo indirizzo email",
    confirmWithPassword: "Conferma con la password",
    changeEmailBtn: "Cambia email",
    emailChangeNote: "Invieremo un link di conferma al nuovo indirizzo — la modifica avrà effetto solo dopo averlo cliccato.",
    emailChangeLogout: "Email modificata. Tra poco verrai disconnesso...",
    newsletterLoadFailed: "Impossibile caricare lo stato della newsletter.",
    newsletterSaveFailed: "Impossibile salvare il consenso alla newsletter.",
    dataHeading: "/ I tuoi dati",
    exportData: "Scarica i miei dati",
    exportDataDesc: "Un file JSON con tutti i dati collegati al tuo account (GDPR, art. 20).",
    exporting: "Preparazione…",
    exportFailed: "Impossibile scaricare i dati.",
    deleteAccount: "Elimina account",
    deleteAccountDesc: "Elimina definitivamente l'account, lo storico delle chat, le note, le verifiche e il collegamento con la calcolatrice. Questa operazione è irreversibile.",
    deletePasswordPlaceholder: "Password dell'account",
    deleteGoogleHint: (p) => `Accedi con Google (senza password)? Lascia vuota la password e scrivi qui sotto: ${p}`,
    deleteAccountBtn: "Elimina l'account per sempre",
    deleting: "Eliminazione…",
    deleteFailed: "Impossibile eliminare l'account.",
    deleteNeedConfirm: (p) => `Inserisci la password oppure scrivi «${p}» per confermare.`,
    featureUnavailable: "Questa funzione non è ancora disponibile — riprova più tardi o scrivici.",
    session: "/ Sessione",
  },
};

export default function PanelPage() {
  const { lang, setLang } = usePanelLang();
  const t = PANEL_DICT[lang];
  const { data: session, status } = useSession();
  // Efekty zależą od tej wartości (a nie od obiektu session, który next-auth
  // podmienia np. przy powrocie do karty) — inaczej każdy focus = refetch wszystkiego.
  const authed = status === "authenticated";
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("orders");
  const [returnNotice, setReturnNotice] = useState<ReturnNotice | null>(null);

  // Kiedy ostatnio pobrano dane danej zakładki (cache FRESH_MS).
  const fetchedAtRef = useRef<Record<string, number>>({});
  const isFresh = (key: string) => Date.now() - (fetchedAtRef.current[key] ?? 0) < FRESH_MS;
  const markFetched = (key: string) => {
    fetchedAtRef.current[key] = Date.now();
  };

  // Komunikat błędu z wyniku fetchJson: 401 → sesja wygasła, 0 → sieć,
  // w pozostałych przypadkach komunikat serwera albo fallback.
  const errText = (r: FetchJsonResult, fallback: string) =>
    r.status === 401 ? t.sessionExpired : r.status === 0 ? t.errNetwork : r.error || fallback;

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const [isSending, setIsSending] = useState(false);
  const sendingRef = useRef(false);
  const [chatError, setChatError] = useState<{ text: string; action?: "ai" } | null>(null);
  const messagesBoxRef = useRef<HTMLDivElement>(null);
  // Szkic pola czatu (tekst + zdjęcia) — trzymany w ref, żeby pisanie nie
  // przerenderowywało panelu; draftEpoch remountuje ChatInput po przywróceniu.
  const chatDraftRef = useRef<ChatDraft>({ text: "", files: [] });
  const [draftEpoch, setDraftEpoch] = useState(0);

  // Conversation history state
  const [conversations, setConversations] = useState<any[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const currentConvRef = useRef<string | null>(null);
  // Zmienia się przy każdym przełączeniu rozmowy — odpowiedź z serwera dla
  // poprzedniej rozmowy nie może trafić do aktualnie otwartej.
  const chatEpochRef = useRef(0);
  const sendAbortRef = useRef<AbortController | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);
  const [loadingConvId, setLoadingConvId] = useState<string | null>(null);
  // Poniżej md sidebar jest szufladą i domyślnie zamknięty (patrz efekt niżej).
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (window.matchMedia?.("(min-width: 768px)").matches) setIsSidebarOpen(true);
  }, []);
  const closeSidebarOnMobile = () => {
    if (!window.matchMedia?.("(min-width: 768px)").matches) setIsSidebarOpen(false);
  };

  // Przerwij trwające żądania czatu przy opuszczeniu panelu.
  useEffect(
    () => () => {
      sendAbortRef.current?.abort();
      loadAbortRef.current?.abort();
    },
    []
  );

  // Kod z pudełka (licencja = jednorazowe 2 mln tokenów)
  const [licenseCode, setLicenseCode] = useState("");
  const [redeemingLicense, setRedeemingLicense] = useState(false);
  const [redeemResult, setRedeemResult] = useState<{ ok: boolean; text: string } | null>(null);

  // Orders state
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  // === Kalkulator: state ===
  const [calcInfo, setCalcInfo] = useState<any>(null);
  const [calcConvs, setCalcConvs] = useState<any[]>([]);
  const [calcNotes, setCalcNotes] = useState<any[]>([]);
  const [calcTests, setCalcTests] = useState<any[]>([]);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcLoadError, setCalcLoadError] = useState<string | null>(null);
  const [calcOpenedConv, setCalcOpenedConv] = useState<any>(null);
  const [unclaiming, setUnclaiming] = useState(false);
  const calcAbortRef = useRef<AbortController | null>(null);

  // Captures (galeria zdjęć)
  const [captures, setCaptures] = useState<Array<{ filename: string; deviceId: string; timestamp: string; sizeKB: number }>>([]);
  const [capturesTotal, setCapturesTotal] = useState(0);
  const [capturesLoading, setCapturesLoading] = useState(false);
  const [capturesVisible, setCapturesVisible] = useState(CAPTURES_PAGE);
  // Kursor stronicowania po stronie serwera (jeśli API go zwraca); null = brak kolejnych stron.
  const [capturesCursor, setCapturesCursor] = useState<string | null>(null);
  const [capturesMoreLoading, setCapturesMoreLoading] = useState(false);
  const [openedCapture, setOpenedCapture] = useState<string | null>(null);

  // === AI settings (sekcja AI): wybór modelu + tryb Matura/Czysty (per-user) ===
  const [aiModel, setAiModel] = useState<string>("default");
  const [aiMode, setAiMode] = useState<"matura" | "raw">("matura");
  const [aiModels, setAiModels] = useState<Array<{ id: string; label: string; provider: string; note?: string; costMultiplier: number }>>([]);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiLoadError, setAiLoadError] = useState(false);
  // null = jeszcze nie wczytane (nie pokazujemy fikcyjnego salda przed odpowiedzią API)
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [buyingPack, setBuyingPack] = useState<string | null>(null);
  const [buyCurrency, setBuyCurrency] = useState<"pln" | "eur">("pln");

  // Powrót przyciskiem "wstecz" z bramki płatności (bfcache) — odblokuj przyciski.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setBuyingPack(null);
      }
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  const buyTokens = async (packId: string) => {
    if (buyingPack) return;
    setBuyingPack(packId);
    const r = await sendJson("/api/tokens/checkout", "POST", { packId, currency: buyCurrency });
    const url = r.ok && typeof r.data?.url === "string" ? (r.data.url as string) : null;
    if (url) {
      // Bez resetu stanu — przycisk zostaje zablokowany aż do przekierowania.
      window.location.href = url;
      return;
    }
    alert(errText(r, t.alertPaymentStart));
    setBuyingPack(null);
  };

  const loadAiSettings = async (signal?: AbortSignal) => {
    const r = await fetchJson("/api/user/ai-settings", { cache: "no-store", signal });
    if (r.aborted) return;
    if (!r.ok) {
      setAiLoadError(true);
      return;
    }
    const j = r.data;
    setAiLoadError(false);
    setAiModel(j.aiModel || "default");
    setAiMode(j.aiMode === "raw" ? "raw" : "matura");
    setAiModels(Array.isArray(j.models) ? j.models : []);
    if (typeof j.tokenBalance === "number") setTokenBalance(j.tokenBalance);
    markFetched("ai");
  };

  const saveAiSettings = async (patch: { aiModel?: string; aiMode?: "matura" | "raw" }) => {
    if (aiSaving) return;
    setAiSaving(true);
    try {
      const r = await sendJson("/api/user/ai-settings", "PATCH", patch);
      if (!r.ok) {
        alert(errText(r, t.alertSaveFailed));
        return;
      }
      if (patch.aiModel !== undefined) setAiModel(patch.aiModel);
      if (patch.aiMode !== undefined) setAiMode(patch.aiMode);
    } finally {
      setAiSaving(false);
    }
  };

  // === Ustawienia konta: zmiana hasła + emaila ===
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwNew2, setPwNew2] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const changePassword = async () => {
    if (pwSaving) return;
    setPwMsg(null);
    if (pwNew.length < 6) { setPwMsg({ ok: false, text: t.pwTooShort }); return; }
    if (pwNew !== pwNew2) { setPwMsg({ ok: false, text: t.pwMismatch }); return; }
    setPwSaving(true);
    try {
      const r = await sendJson("/api/user/account/change-password", "POST", {
        currentPassword: pwCurrent,
        newPassword: pwNew,
      });
      if (!r.ok) { setPwMsg({ ok: false, text: errText(r, t.errGeneric) }); return; }
      setPwMsg({ ok: true, text: t.pwChanged });
      setPwCurrent(""); setPwNew(""); setPwNew2("");
    } finally { setPwSaving(false); }
  };

  const [emNew, setEmNew] = useState("");
  const [emPassword, setEmPassword] = useState("");
  const [emSaving, setEmSaving] = useState(false);
  // Zgoda marketingowa (newsletter) — /api/user/marketing-consent
  const [nlConsent, setNlConsent] = useState<boolean | null>(null);
  const [nlSaving, setNlSaving] = useState(false);
  const [nlLoading, setNlLoading] = useState(false);
  const [nlError, setNlError] = useState<string | null>(null);
  const loadNewsletter = async (signal?: AbortSignal) => {
    setNlLoading(true);
    setNlError(null);
    const r = await fetchJson("/api/user/marketing-consent", { cache: "no-store", signal });
    if (r.aborted) return;
    setNlLoading(false);
    if (!r.ok) { setNlError(errText(r, t.newsletterLoadFailed)); return; }
    setNlConsent(!!r.data?.consent);
  };
  useEffect(() => {
    if (!authed || activeTab !== "settings" || nlConsent !== null) return;
    const ac = new AbortController();
    void loadNewsletter(ac.signal);
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, activeTab, nlConsent]);
  const toggleNewsletter = async () => {
    if (nlSaving || nlConsent === null) return;
    setNlSaving(true);
    setNlError(null);
    try {
      const r = await sendJson("/api/user/marketing-consent", "POST", { consent: !nlConsent });
      if (!r.ok) { setNlError(errText(r, t.newsletterSaveFailed)); return; }
      setNlConsent(!!r.data?.consent);
    } finally {
      setNlSaving(false);
    }
  };
  const [emMsg, setEmMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const changeEmail = async () => {
    if (emSaving) return;
    setEmMsg(null);
    setEmSaving(true);
    try {
      const r = await sendJson("/api/user/account/change-email", "POST", { newEmail: emNew, password: emPassword });
      if (!r.ok) { setEmMsg({ ok: false, text: errText(r, t.errGeneric) }); return; }
      // Zmiana wymaga potwierdzenia linkiem na nowy adres — do tego czasu konto
      // działa na starym e-mailu, więc NIE wylogowujemy.
      const pending = r.data?.pendingVerification === true || r.data?.verificationSent === true;
      if (pending) {
        setEmMsg({ ok: true, text: t.emailChanged });
        setEmNew(""); setEmPassword("");
        return;
      }
      // Starsze API (zmiana natychmiastowa) — sesja ma stary e-mail, trzeba się przelogować.
      setEmMsg({ ok: true, text: t.emailChangeLogout });
      setTimeout(() => signOut({ callbackUrl: "/auth/signin" }), 1600);
    } finally { setEmSaving(false); }
  };

  // === Dane konta: eksport (RODO art. 20) i usunięcie konta ===
  const DELETE_PHRASE = "USUN KONTO";
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [delPassword, setDelPassword] = useState("");
  const [delPhrase, setDelPhrase] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [delMsg, setDelMsg] = useState<string | null>(null);

  const exportData = async () => {
    if (exporting) return;
    setExporting(true);
    setExportMsg(null);
    try {
      let res: Response;
      try {
        res = await fetch("/api/user/account/export", { cache: "no-store" });
      } catch {
        setExportMsg(t.errNetwork);
        return;
      }
      const ct = res.headers.get("content-type") || "";
      const isJson = ct.includes("application/json");
      if (!res.ok) {
        let msg = t.exportFailed;
        if (res.status === 401) msg = t.sessionExpired;
        else if ((res.status === 404 || res.status === 405) && !isJson) msg = t.featureUnavailable;
        else if (isJson) {
          try {
            const j = await res.json();
            if (typeof j?.error === "string" && j.error) msg = j.error;
          } catch { /* zostaje ogólny komunikat */ }
        }
        setExportMsg(msg);
        return;
      }
      if (ct.includes("text/html")) { setExportMsg(t.exportFailed); return; }
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") || "";
      const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
      let name = `kalkmate-dane-${new Date().toISOString().slice(0, 10)}.json`;
      if (m) {
        try { name = decodeURIComponent(m[1]); } catch { name = m[1]; }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally {
      setExporting(false);
    }
  };

  const normalizePhrase = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase().replace(/\s+/g, " ");

  const deleteAccount = async () => {
    if (deleting) return;
    const pw = delPassword;
    const phraseOk = normalizePhrase(delPhrase) === DELETE_PHRASE;
    if (!pw && !phraseOk) { setDelMsg(t.deleteNeedConfirm(DELETE_PHRASE)); return; }
    if (!confirm(t.deleteAccountDesc)) return;
    setDeleting(true);
    setDelMsg(null);
    try {
      const r = await sendJson("/api/user/account", "DELETE", pw ? { password: pw } : { confirm: DELETE_PHRASE });
      if (r.ok) {
        await signOut({ callbackUrl: "/" });
        return;
      }
      if ((r.status === 404 || r.status === 405) && r.notJson) { setDelMsg(t.featureUnavailable); return; }
      setDelMsg(errText(r, t.deleteFailed));
    } finally {
      setDeleting(false);
    }
  };

  // === Pair device (deviceId + unlockCode) ===
  const [pairDeviceId, setPairDeviceId] = useState("");
  const [pairUnlockCode, setPairUnlockCode] = useState("");
  const [pairing, setPairing] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [pairOk, setPairOk] = useState(false);

  // Notes
  const [editingNote, setEditingNote] = useState<any>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  // Tests
  const [editingTest, setEditingTest] = useState<any>(null);
  const [testTitle, setTestTitle] = useState("");
  const [testContent, setTestContent] = useState("");
  const [savingTest, setSavingTest] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  // Pierwsza strona galerii + kursor kolejnej (tolerancyjnie: API może zwracać
  // wszystko naraz albo nextBefore/nextCursor/hasMore).
  const capturesNextCursor = (data: any, items: Array<{ timestamp: string }>): string | null => {
    const explicit = data?.nextBefore ?? data?.nextCursor ?? data?.next ?? null;
    if (typeof explicit === "string" && explicit) return explicit;
    if (data?.hasMore === true && items.length > 0) return items[items.length - 1].timestamp;
    return null;
  };

  // Dane zakładek Kalkulator / Notatki / Sprawdziany.
  const loadCalcData = async (opts?: { force?: boolean }) => {
    if (!opts?.force && isFresh("calc")) return;
    calcAbortRef.current?.abort();
    const ac = new AbortController();
    calcAbortRef.current = ac;
    const isCurrent = () => calcAbortRef.current === ac;
    setCalcLoading(true);
    setCalcLoadError(null);
    try {
      const r1 = await fetchJson("/api/user/license/claim", { cache: "no-store", signal: ac.signal });
      if (!isCurrent() || r1.aborted) return;
      if (!r1.ok) { setCalcLoadError(errText(r1, t.loadFailed)); return; }
      setCalcInfo(r1.data);
      if (!r1.data?.claimed) {
        setCalcConvs([]); setCalcNotes([]); setCalcTests([]); setCaptures([]); setCapturesTotal(0);
        markFetched("calc");
        return;
      }
      setCapturesLoading(true);
      const [r2, r3, r4, r5] = await Promise.all([
        fetchJson("/api/user/conversations?limit=50", { cache: "no-store", signal: ac.signal }),
        fetchJson("/api/user/notes", { cache: "no-store", signal: ac.signal }),
        fetchJson("/api/user/tests", { cache: "no-store", signal: ac.signal }),
        fetchJson(`/api/user/captures?limit=${CAPTURES_PAGE}`, { cache: "no-store", signal: ac.signal }),
      ]);
      if (!isCurrent()) return;
      if (r2.ok) setCalcConvs(r2.data?.items || []);
      if (r3.ok) setCalcNotes(r3.data?.notes || []);
      if (r4.ok) setCalcTests(r4.data?.tests || []);
      if (r5.ok) {
        const items = Array.isArray(r5.data?.items) ? r5.data.items : [];
        setCaptures(items);
        setCapturesTotal(Number(r5.data?.stats?.total ?? r5.data?.total ?? items.length) || items.length);
        setCapturesCursor(capturesNextCursor(r5.data, items));
        setCapturesVisible(CAPTURES_PAGE);
      }
      const failed = [r2, r3, r4, r5].find((r) => !r.ok && !r.aborted);
      if (failed) setCalcLoadError(errText(failed, t.loadFailed));
      else if (![r2, r3, r4, r5].some((r) => r.aborted)) markFetched("calc");
    } finally {
      if (isCurrent()) {
        setCalcLoading(false);
        setCapturesLoading(false);
        calcAbortRef.current = null;
      }
    }
  };

  const loadMoreCaptures = async () => {
    if (capturesVisible < captures.length) {
      setCapturesVisible((v) => v + CAPTURES_PAGE);
      return;
    }
    if (!capturesCursor || capturesMoreLoading) return;
    setCapturesMoreLoading(true);
    try {
      const r = await fetchJson(
        `/api/user/captures?limit=${CAPTURES_PAGE}&before=${encodeURIComponent(capturesCursor)}`,
        { cache: "no-store" }
      );
      if (!r.ok) { setCalcLoadError(errText(r, t.loadFailed)); return; }
      const items: typeof captures = Array.isArray(r.data?.items) ? r.data.items : [];
      const known = new Set(captures.map((c) => c.filename));
      const fresh = items.filter((c) => !known.has(c.filename));
      setCaptures((prev) => [...prev, ...fresh]);
      // Brak nowych elementów = API zignorowało kursor — kończymy, żeby nie zapętlić.
      setCapturesCursor(fresh.length > 0 ? capturesNextCursor(r.data, items) : null);
      setCapturesVisible((v) => v + CAPTURES_PAGE);
    } finally {
      setCapturesMoreLoading(false);
    }
  };

  const pairDevice = async () => {
    if (pairing) return;
    setPairError(null);
    setPairOk(false);
    setPairing(true);
    try {
      const r = await sendJson("/api/user/devices", "POST", {
        deviceId: pairDeviceId.trim(),
        unlockCode: pairUnlockCode.trim(),
      });
      if (!r.ok) {
        setPairError(errText(r, t.errPairFailed));
        return;
      }
      setPairOk(true);
      setPairDeviceId("");
      setPairUnlockCode("");
      // Od razu pełne dane: urządzenie, galeria, historia, notatki, sprawdziany.
      await loadCalcData({ force: true });
    } finally {
      setPairing(false);
    }
  };

  // Load calculator data when one of the calculator-related tabs is active.
  // Zależność od wartości logicznej — przełączanie między tymi zakładkami nie
  // przerywa ani nie powtarza pobierania.
  const needsCalc = CALC_TABS.includes(activeTab);
  useEffect(() => {
    if (!authed || !needsCalc) return;
    void loadCalcData();
    return () => {
      calcAbortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, needsCalc]);

  const calcUnclaim = async () => {
    const deviceId = calcInfo?.device?.deviceId;
    if (!deviceId) {
      alert(t.alertNoDeviceUnpair);
      return;
    }
    if (unclaiming) return;
    if (!confirm(t.confirmUnpair(deviceId))) return;
    setUnclaiming(true);
    try {
      const r = await fetchJson(`/api/user/devices?deviceId=${encodeURIComponent(deviceId)}`, { method: "DELETE" });
      if (!r.ok) {
        alert(errText(r, t.alertError));
        return;
      }
      setPairOk(false);
      await loadCalcData({ force: true });
    } finally {
      setUnclaiming(false);
    }
  };

  const reloadNotes = async () => {
    const r = await fetchJson("/api/user/notes", { cache: "no-store" });
    if (r.ok) setCalcNotes(r.data?.notes || []);
  };
  const calcSaveNote = async () => {
    if (savingNote) return;
    if (!noteTitle.trim() && !noteContent.trim()) return;
    setSavingNote(true);
    setNoteError(null);
    try {
      const r = editingNote
        ? await sendJson("/api/user/notes", "PUT", { id: editingNote.id, title: noteTitle, content: noteContent })
        : await sendJson("/api/user/notes", "POST", { title: noteTitle, content: noteContent });
      // Przy błędzie formularz zostaje nietknięty — uczeń nie traci wpisanej treści.
      if (!r.ok) { setNoteError(errText(r, t.alertSaveFailed)); return; }
      const saved = r.data?.note;
      if (saved?.id) {
        setCalcNotes((prev) => (editingNote ? prev.map((n) => (n.id === saved.id ? saved : n)) : [...prev, saved]));
      }
      setEditingNote(null); setNoteTitle(""); setNoteContent("");
      await reloadNotes();
    } finally { setSavingNote(false); }
  };
  const calcDelNote = async (id: string) => {
    if (!confirm(t.confirmDeleteNote)) return;
    setNoteError(null);
    const r = await fetchJson(`/api/user/notes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!r.ok) { setNoteError(errText(r, t.alertError)); return; }
    setCalcNotes((prev) => prev.filter((n) => n.id !== id));
    if (editingNote?.id === id) { setEditingNote(null); setNoteTitle(""); setNoteContent(""); }
    void reloadNotes();
  };

  const reloadTests = async () => {
    const r = await fetchJson("/api/user/tests", { cache: "no-store" });
    if (r.ok) setCalcTests(r.data?.tests || []);
  };
  const calcSaveTest = async () => {
    if (savingTest) return;
    if (!testTitle.trim() && !testContent.trim()) return;
    setSavingTest(true);
    setTestError(null);
    try {
      const r = editingTest
        ? await sendJson("/api/user/tests", "PUT", { id: editingTest.id, title: testTitle, content: testContent })
        : await sendJson("/api/user/tests", "POST", { title: testTitle, content: testContent });
      if (!r.ok) { setTestError(errText(r, t.alertSaveFailed)); return; }
      const saved = r.data?.test;
      if (saved?.id) {
        setCalcTests((prev) => (editingTest ? prev.map((x) => (x.id === saved.id ? saved : x)) : [...prev, saved]));
      }
      setEditingTest(null); setTestTitle(""); setTestContent("");
      await reloadTests();
    } finally { setSavingTest(false); }
  };
  const calcDelTest = async (id: string) => {
    if (!confirm(t.confirmDeleteTest)) return;
    setTestError(null);
    const r = await fetchJson(`/api/user/tests?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!r.ok) { setTestError(errText(r, t.alertError)); return; }
    setCalcTests((prev) => prev.filter((x) => x.id !== id));
    if (editingTest?.id === id) { setEditingTest(null); setTestTitle(""); setTestContent(""); }
    void reloadTests();
  };


  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  // ?tab=<id> oraz powrót z płatności (?tokens=success…) → właściwa zakładka
  // + potwierdzenie; parametry usuwamy z paska adresu. Subskrypcje wycofane:
  // stare linki (?subscription=…, ?tab=subscription) kierują na zakładkę AI/tokenów.
  useEffect(() => {
    let sp: URLSearchParams;
    try {
      sp = new URLSearchParams(window.location.search);
    } catch {
      return;
    }
    const tok = sp.get("tokens");
    const sub = sp.get("subscription");
    const tabParam = sp.get("tab");
    let tab: TabId | null = null;
    let notice: ReturnNotice | null = null;
    if (tok === "success") { tab = "ai"; notice = "tokens_success"; }
    else if (tok === "cancelled") { tab = "ai"; notice = "tokens_cancelled"; }
    else if (sub !== null || tabParam === "subscription") tab = "ai";
    else if (tabParam && (TAB_IDS as readonly string[]).includes(tabParam)) tab = tabParam as TabId;
    if (tab) setActiveTab(tab);
    if (notice) setReturnNotice(notice);
    if (tok !== null || sub !== null || tabParam !== null) {
      sp.delete("tokens");
      sp.delete("subscription");
      sp.delete("tab");
      const qs = sp.toString();
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash
      );
    }
  }, []);

  // Webhook płatności dochodzi zwykle kilka sekund po powrocie — dociągnij
  // saldo jeszcze raz.
  useEffect(() => {
    if (!authed || returnNotice !== "tokens_success") return;
    const timers = [3000, 10000].map((ms) => setTimeout(() => void loadAiSettings(), ms));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, returnNotice]);

  // Ustawienia AI + saldo: raz po zalogowaniu, potem przy wejściu w zakładkę AI
  // (jeśli dane starsze niż FRESH_MS — saldo zmienia się po każdym zadaniu).
  const isAiTab = activeTab === "ai";
  useEffect(() => {
    if (!authed) return;
    if (fetchedAtRef.current.ai && (!isAiTab || isFresh("ai"))) return;
    const ac = new AbortController();
    void loadAiSettings(ac.signal);
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, isAiTab]);

  // Fetch orders when orders tab is active
  useEffect(() => {
    if (!authed || activeTab !== "orders" || isFresh("orders")) return;
    const ac = new AbortController();
    void fetchOrders(ac.signal);
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, activeTab]);

  // Fetch conversations when chat tab is active
  useEffect(() => {
    if (!authed || activeTab !== "chat" || isFresh("convs")) return;
    const ac = new AbortController();
    void fetchConversations(ac.signal);
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, activeTab]);

  const fetchConversations = async (signal?: AbortSignal) => {
    const r = await fetchJson("/api/conversations", { cache: "no-store", signal });
    if (!r.ok) return; // lista historii — błąd nie blokuje samego czatu
    setConversations(Array.isArray(r.data?.conversations) ? r.data.conversations : []);
    markFetched("convs");
  };

  const loadConversation = async (conversationId: string) => {
    if (sendingRef.current) return;
    loadAbortRef.current?.abort();
    const ac = new AbortController();
    loadAbortRef.current = ac;
    chatEpochRef.current++;
    setChatError(null);
    setLoadingConvId(conversationId);
    const r = await fetchJson(`/api/conversations/${encodeURIComponent(conversationId)}`, {
      cache: "no-store",
      signal: ac.signal,
    });
    if (loadAbortRef.current !== ac) return; // w międzyczasie kliknięto inną rozmowę
    loadAbortRef.current = null;
    setLoadingConvId(null);
    if (r.aborted) return;
    if (!r.ok) {
      setChatError({ text: errText(r, t.convLoadFailed) });
      return;
    }
    // Tolerancyjnie: nowy kształt (messages/attachments) i surowy Prisma (ChatMessage/Attachment).
    const conv = r.data?.conversation;
    const rawMessages: any[] = conv?.messages ?? conv?.ChatMessage ?? [];
    const mapped: ChatMessage[] = rawMessages.map((msg: any) => {
      const atts: any[] = msg.attachments ?? msg.Attachment ?? [];
      return {
        role: msg.role,
        content: msg.content ?? "",
        attachments: atts.length
          ? atts.map((att: any) => ({
              filename: att.filename,
              mimeType: att.mimeType || "",
              fileSize: att.fileSize,
              data: att.fileData ?? att.data ?? "",
            }))
          : undefined,
      };
    });
    currentConvRef.current = conversationId;
    setCurrentConversationId(conversationId);
    setMessages(mapped);
    closeSidebarOnMobile();
  };

  // "Nowy chat" = pusta rozmowa lokalnie; serwer tworzy konwersację przy
  // pierwszej wiadomości (z tytułem z treści). Bez POST-a nie ma też problemu
  // podwójnego kliknięcia i pustych "Nowa konwersacja" na liście.
  const startNewChat = () => {
    if (sendingRef.current) return;
    loadAbortRef.current?.abort();
    loadAbortRef.current = null;
    setLoadingConvId(null);
    chatEpochRef.current++;
    currentConvRef.current = null;
    setCurrentConversationId(null);
    setMessages([]);
    setChatError(null);
    closeSidebarOnMobile();
  };

  const deleteConversation = async (conversationId: string) => {
    if (sendingRef.current) return;
    if (!confirm(t.confirmDeleteConversation)) return;
    const r = await fetchJson(`/api/conversations/${encodeURIComponent(conversationId)}`, { method: "DELETE" });
    if (!r.ok) {
      alert(errText(r, t.convDeleteFailed));
      return;
    }
    if (currentConvRef.current === conversationId) startNewChat();
    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    void fetchConversations();
  };

  const fetchOrders = async (signal?: AbortSignal) => {
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const r = await fetchJson("/api/user/orders", { cache: "no-store", signal });
      if (r.aborted) return;
      if (!r.ok) {
        setOrdersError(errText(r, t.loadFailed));
        return;
      }
      setOrders(Array.isArray(r.data?.orders) ? r.data.orders : []);
      markFetched("orders");
    } finally {
      if (!signal?.aborted) setOrdersLoading(false);
    }
  };

  // Przewijamy tylko kontener wiadomości (nie całą stronę).
  useEffect(() => {
    if (activeTab !== "chat") return;
    const el = messagesBoxRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isSending, activeTab]);

  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const copyToClipboard = async (text: string, idx?: number) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
    }
    if (typeof idx === "number") {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((cur) => (cur === idx ? null : cur)), 1600);
    }
  };

  const chatErrorFrom = (r: FetchJsonResult): { text: string; action?: "ai" } => {
    switch (r.status) {
      case 0: return { text: t.errNetwork };
      case 401: return { text: t.sessionExpired };
      case 402: return { text: t.chatNoTokens, action: "ai" };
      case 403: return { text: t.chatNoAccess, action: "ai" };
      case 413: return { text: t.chatTooLarge };
      case 415: return { text: t.chatOnlyImages };
      case 429: return { text: t.chatTooMany };
      case 502:
      case 503:
      case 504: return { text: t.chatUpstream };
      default: return { text: (!r.notJson && r.error) || `${t.serverError(r.status)} ${t.tryAgain}` };
    }
  };

  const handleSend = async (text: string, files: File[]) => {
    if (sendingRef.current) return;
    if (!text.trim() && files.length === 0) return;
    sendingRef.current = true;
    setIsSending(true);
    setChatError(null);

    const epoch = chatEpochRef.current;
    const convIdAtSend = currentConvRef.current;
    const prevMessages = messagesRef.current;
    const ac = new AbortController();
    sendAbortRef.current = ac;
    let shownOptimistic = false;

    // Błąd: treść i zdjęcia wracają do pola (nic nie ginie), a z listy znika
    // niewysłana wiadomość — serwer jej nie zapisał.
    const fail = (err: { text: string; action?: "ai" }) => {
      chatDraftRef.current = { text, files };
      setDraftEpoch((e) => e + 1);
      if (chatEpochRef.current === epoch) {
        if (shownOptimistic) setMessages(prevMessages);
        setChatError(err);
      }
    };

    try {
      let attachments: ChatAttachment[] = [];
      try {
        attachments = await Promise.all(
          files.map(async (file) => ({
            filename: file.name,
            mimeType: file.type,
            fileSize: file.size,
            data: await fileToDataUrl(file),
          }))
        );
      } catch {
        fail({ text: t.chatReadFailed });
        return;
      }

      const newMessage: ChatMessage = {
        role: "user",
        content: text.trim() ? text : t.fileAttached,
        attachments: attachments.length > 0 ? attachments : undefined,
      };
      setMessages([...prevMessages, newMessage]);
      shownOptimistic = true;

      // Historia bez base64 starych zdjęć — serwer bierze historię z bazy po
      // conversationId, a stare obrazy tylko pompowały żądanie (413 z nginx).
      const history = prevMessages.map((m) => ({ role: m.role, content: m.content }));
      const r = await sendJson<{ response?: string; conversationId?: string; tokensLeft?: number }>(
        "/api/chat",
        "POST",
        { messages: [...history, newMessage], conversationId: convIdAtSend || undefined },
        { signal: ac.signal }
      );
      if (r.aborted) return;
      const reply = r.ok && typeof r.data?.response === "string" ? r.data.response : null;
      if (reply === null) {
        fail(r.ok ? { text: `${t.serverError(r.status)} ${t.tryAgain}` } : chatErrorFrom(r));
        // Przy 504 serwer mógł jednak dokończyć i zapisać rozmowę — odśwież listę.
        void fetchConversations();
        return;
      }
      if (typeof r.data?.tokensLeft === "number") setTokenBalance(r.data.tokensLeft);
      if (chatEpochRef.current !== epoch) {
        // Użytkownik przełączył rozmowę — odpowiedź należy do innej, nie mieszamy.
        void fetchConversations();
        return;
      }
      setMessages((cur) => [...cur, { role: "assistant", content: reply }]);
      const newConvId = r.data?.conversationId;
      if (newConvId && !convIdAtSend) {
        currentConvRef.current = newConvId;
        setCurrentConversationId(newConvId);
      }
      void fetchConversations();
    } finally {
      if (sendAbortRef.current === ac) sendAbortRef.current = null;
      sendingRef.current = false;
      setIsSending(false);
    }
  };

  // Stabilna referencja dla memo(ChatInput) — rodzic może się przerenderować,
  // pole tekstowe nie.
  const handleSendRef = useRef(handleSend);
  useEffect(() => {
    handleSendRef.current = handleSend;
  });
  const onChatSend = useCallback((text: string, files: File[]) => {
    void handleSendRef.current(text, files);
  }, []);
  const chatInputLabels = useMemo<ChatInputLabels>(
    () => ({
      placeholder: t.chatPlaceholder,
      attach: t.attachFile,
      send: t.send,
      remove: t.removeFile,
      processing: t.imgProcessing,
      tooMany: t.imgTooMany,
      onlyImages: t.chatOnlyImages,
      decodeFailed: t.imgDecodeFailed,
      tooLarge: t.imgTooLarge,
    }),
    [t]
  );

  const handleRedeemLicense = async () => {
    if (!licenseCode.trim()) {
      setRedeemResult({ ok: false, text: t.enterLicenseCode });
      return;
    }
    if (redeemingLicense) return;
    setRedeemingLicense(true);
    setRedeemResult(null);
    try {
      // { ok, tokensGranted, tokenBalance, message } — ponowna aktywacja: tokensGranted 0 + message.
      const r = await sendJson("/api/user/license/claim", "POST", { code: licenseCode.trim() });
      if (!r.ok) {
        setRedeemResult({
          ok: false,
          text: r.status === 0 || (r.notJson && r.status !== 401) ? t.licenseRedeemError : errText(r, t.licenseRedeemFailed),
        });
        return;
      }
      const granted = typeof r.data?.tokensGranted === "number" ? (r.data.tokensGranted as number) : 0;
      const balance = typeof r.data?.tokenBalance === "number" ? (r.data.tokenBalance as number) : null;
      const message = typeof r.data?.message === "string" && r.data.message ? (r.data.message as string) : null;
      if (balance !== null) setTokenBalance(balance);
      setRedeemResult({
        ok: true,
        text:
          granted > 0
            ? t.licenseTokensAdded(granted.toLocaleString(DATE_LOCALE[lang]), formatTokens(balance ?? granted))
            : message ?? t.licenseRedeemed,
      });
      setLicenseCode("");
      if (balance === null) void loadAiSettings();
      // Kod przypisuje się do konta — dane zakładki Kalkulator odśwież przy następnym wejściu.
      fetchedAtRef.current.calc = 0;
    } finally {
      setRedeemingLicense(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#D8FF3D] border-t-transparent rounded-full animate-spin" />
          <p className="km-mono-eyebrow text-[#F2EDE3]/55">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const tabs = [
    { id: "orders" as const, n: "01", label: t.tabsOrders },
    { id: "chat" as const, n: "02", label: t.tabsChat },
    { id: "ai" as const, n: "03", label: t.tabsAi },
    { id: "calculator" as const, n: "04", label: t.tabsCalculator },
    { id: "notes" as const, n: "05", label: t.tabsNotes },
    { id: "tests" as const, n: "06", label: t.tabsTests },
    { id: "settings" as const, n: "07", label: t.tabsSettings },
  ];

  return (
    // data-clarity-mask: nawet gdyby Clarity załadował się na /panel, nie nagrywa treści.
    <div className="min-h-screen bg-[#0B0B0B] text-[#F2EDE3]" data-clarity-mask="true">
      {/* Lekka animacja wejścia zakładki w CSS (zamiast framer-motion/AnimatePresence). */}
      <style>{`@keyframes kmPanelFade{from{opacity:0}to{opacity:1}}.km-panel-fade{animation:kmPanelFade .15s ease-out}@media (prefers-reduced-motion: reduce){.km-panel-fade{animation:none}}`}</style>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0B0B0B]/85 backdrop-blur-md border-b border-[rgba(242,237,227,0.10)]">
        <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-baseline gap-3">
              <span className="km-display text-[26px] tracking-tight leading-none text-[#F2EDE3]">
                Kalk<span className="italic text-[#D8FF3D]">Mate</span>
              </span>
              <span className="km-mono-eyebrow text-[#F2EDE3]/40 hidden sm:inline">
                /panel
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <span className="hidden md:inline-flex items-center gap-2 km-mono-eyebrow text-[#F2EDE3]/55">
                <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full km-blink" />
                {session.user?.email}
              </span>
              <PanelLangSwitcher lang={lang} setLang={setLang} />
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="km-mono-eyebrow text-[#F2EDE3]/70 hover:text-[#FF4D2E] px-3 py-1.5 border border-[rgba(242,237,227,0.18)] hover:border-[#FF4D2E] transition-colors"
              >
                {t.logout}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 sm:px-5 lg:px-10 py-6 md:py-10 lg:py-14">
        {/* Page heading */}
        <div className="mb-6 md:mb-10 lg:mb-14 grid lg:grid-cols-12 gap-4 md:gap-8 items-end">
          <div className="lg:col-span-8">
            <p className="km-mono-eyebrow text-[#D8FF3D]">{t.yourPanel}</p>
            <h1 className="km-display text-[clamp(40px,7vw,96px)] mt-3">
              {t.greeting(<span key="name" className="italic text-[#D8FF3D]">{(session.user?.name || session.user?.email?.split("@")[0] || "user").toString()}</span>)}
            </h1>
          </div>
          <div className="lg:col-span-4 km-mono-eyebrow text-[#F2EDE3]/45 lg:text-right">
            <p>PANEL{process.env.NEXT_PUBLIC_APP_VERSION ? ` · v${process.env.NEXT_PUBLIC_APP_VERSION}` : ""}</p>
            <p className="mt-1 text-[#F2EDE3]/30">{t.sessionActive}</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6 md:mb-10 border-y border-[rgba(242,237,227,0.10)]">
          <div className="flex overflow-x-auto km-no-scrollbar">
            {tabs.map((tab, i) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative group flex items-baseline gap-2.5 px-4 md:px-5 py-3 md:py-4 whitespace-nowrap transition-colors ${
                  i > 0 ? "border-l border-[rgba(242,237,227,0.10)]" : ""
                } ${
                  activeTab === tab.id
                    ? "bg-[#0E0E0E] text-[#F2EDE3]"
                    : "text-[#F2EDE3]/60 hover:text-[#F2EDE3] hover:bg-[#0E0E0E]/50"
                }`}
              >
                <span className={`km-mono-eyebrow ${activeTab === tab.id ? "text-[#D8FF3D]" : "text-[#F2EDE3]/35"}`}>
                  {tab.n}
                </span>
                <span className="text-[14.5px]">{tab.label}</span>
                {activeTab === tab.id && (
                  <span className="absolute left-0 right-0 -bottom-px h-px bg-[#D8FF3D]" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Powrót z płatności (Stripe / Przelewy24) */}
        {returnNotice && (
          <div
            role="status"
            className={`mb-6 flex items-start justify-between gap-3 border p-3 ${
              returnNotice.endsWith("success")
                ? "border-[#D8FF3D]/40 bg-[#D8FF3D]/[0.06]"
                : "border-[#FFB800]/40 bg-[#FFB800]/[0.06]"
            }`}
          >
            <p className={`text-sm ${returnNotice.endsWith("success") ? "text-[#D8FF3D]" : "text-[#FFB800]"}`}>
              {returnNotice === "tokens_success" ? t.returnTokensSuccess : t.returnTokensCancelled}
            </p>
            <button
              onClick={() => setReturnNotice(null)}
              className="km-mono-eyebrow text-[#F2EDE3]/60 hover:text-[#F2EDE3] shrink-0"
            >
              {t.dismiss} ×
            </button>
          </div>
        )}

        {/* Tab Content */}
        <>
          {activeTab === "orders" && (
            <div
              key="orders"
              className="km-panel-fade"
            >
              <div className="bg-[#0E0E0E] p-4 sm:p-8 border border-[rgba(242,237,227,0.10)]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12  bg-[#D8FF3D]/10 bg-[#D8FF3D]/10 flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#D8FF3D]">
                      <rect x="1" y="3" width="15" height="13" />
                      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                      <circle cx="5.5" cy="18.5" r="2.5" />
                      <circle cx="18.5" cy="18.5" r="2.5" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-[#F2EDE3]">
                      {t.ordersHeading}
                    </h2>
                    <p className="text-sm text-[#F2EDE3]/60">
                      {t.ordersSubtitle}
                    </p>
                  </div>
                </div>

                {ordersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-[#D8FF3D] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : ordersError ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-[#FF4D2E] mb-4">{ordersError}</p>
                    <button
                      onClick={() => void fetchOrders()}
                      className="km-mono-eyebrow px-4 py-2 border border-[rgba(242,237,227,0.20)] text-[#F2EDE3]/80 hover:border-[#D8FF3D] hover:text-[#D8FF3D] transition-colors"
                    >
                      {t.retry}
                    </button>
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#141414] flex items-center justify-center">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F2EDE3]/20">
                        <circle cx="9" cy="21" r="1" />
                        <circle cx="20" cy="21" r="1" />
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                      </svg>
                    </div>
                    <p className="text-[#F2EDE3]/60 mb-4">
                      {t.ordersEmpty}
                    </p>
                    <Link
                      href="/#kup-teraz"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-[#D8FF3D] text-[#0B0B0B] font-medium rounded-full hover:bg-[#F2EDE3] transition-colors"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      {t.ordersCta}
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        className="border border-[rgba(242,237,227,0.10)] p-4 sm:p-6"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                          <div>
                            <p className="text-lg font-bold text-[#F2EDE3]">
                              {t.orderNo(order.orderNumber)}
                              {/* Ilosc sztuk — starsze zamowienia nie maja pola (= 1) */}
                              {Number(order.quantity) > 1 && (
                                <span className="ml-2 km-mono-eyebrow text-sm text-[#D8FF3D]">
                                  KalkMate × {Math.floor(Number(order.quantity))}
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-[#F2EDE3]/60 mt-1 flex items-center gap-2">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                              </svg>
                              {new Date(order.createdAt).toLocaleDateString(DATE_LOCALE[lang], {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <span className={`px-4 py-2 rounded-full text-sm font-bold ${
                            order.status === "paid"
                              ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400"
                              : order.status === "pending"
                              ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400"
                              : "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400"
                          }`}>
                            {order.status === "paid" ? t.statusPaid : order.status === "pending" ? t.statusPending : t.statusCancelled}
                          </span>
                        </div>

                        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-[#141414]  p-4">
                            <p className="text-xs text-[#F2EDE3]/40 mb-1">{t.amount}</p>
                            <p className="text-lg font-bold text-[#F2EDE3]">
                              {(order.amount / 100).toFixed(2)} {order.currency.toUpperCase()}
                            </p>
                          </div>

                          {order.pickupPoint && (
                            <div className="bg-[#141414]  p-4">
                              <p className="text-xs text-[#F2EDE3]/40 mb-1">{t.pickupPoint}</p>
                              <p className="text-sm font-medium text-[#F2EDE3] truncate">
                                {order.pickupPoint}
                              </p>
                            </div>
                          )}

                          {order.fulfillmentStatus && (
                            <div className="bg-[#141414]  p-4">
                              <p className="text-xs text-[#F2EDE3]/40 mb-1">{t.shipmentStatus}</p>
                              <p className="text-sm font-medium text-[#F2EDE3]">
                                {order.fulfillmentStatus === "fulfilled" ? t.shipped : t.awaitingShipment}
                              </p>
                            </div>
                          )}

                          {order.trackingNumber && (
                            <div className="bg-[#141414]  p-4">
                              <p className="text-xs text-[#F2EDE3]/40 mb-1">{t.trackingNumber}</p>
                              <p className="text-sm font-medium text-[#D8FF3D] font-mono">
                                {order.trackingNumber}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "chat" && (
            <div
              key="chat"
              className="km-panel-fade relative bg-[#0E0E0E] border border-[rgba(242,237,227,0.10)] overflow-hidden flex h-[calc(100dvh-5rem)] md:h-[calc(100dvh-8rem)] min-h-[420px] max-h-[900px]"
            >
              {/* Telefon: tło pod otwartą szufladą historii */}
              {isSidebarOpen && (
                <div
                  className="md:hidden absolute inset-0 z-20 bg-black/60"
                  onClick={() => setIsSidebarOpen(false)}
                  aria-hidden="true"
                />
              )}
              {/* Sidebar with conversations — poniżej md szuflada nad czatem */}
              <div
                className={`absolute md:relative inset-y-0 left-0 z-30 md:z-auto w-64 max-w-[85%] shrink-0 bg-[#0E0E0E] border-r border-[rgba(242,237,227,0.10)] flex flex-col overflow-hidden transition-[transform,width,visibility] duration-200 ${
                  isSidebarOpen
                    ? "translate-x-0 md:w-64"
                    : "-translate-x-full invisible md:visible md:translate-x-0 md:w-0 md:border-r-0"
                }`}
              >
                {/* Sidebar header */}
                <div className="p-4 border-b border-[rgba(242,237,227,0.10)] flex items-center justify-between">
                  <h3 className="font-semibold text-[#F2EDE3] text-sm">{t.chatHistories}</h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={startNewChat}
                      disabled={isSending}
                      className="p-1.5  bg-[#D8FF3D] text-[#0B0B0B] hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                      title={t.newConversation}
                      aria-label={t.newConversation}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => setIsSidebarOpen(false)}
                      className="md:hidden p-1.5 text-[#F2EDE3]/60 hover:text-[#F2EDE3]"
                      title={t.hideHistory}
                      aria-label={t.hideHistory}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Conversations list — zablokowana w trakcie wysyłania, żeby odpowiedź nie trafiła do innej rozmowy */}
                <div
                  className={`flex-1 overflow-y-auto p-2 space-y-1 ${isSending ? "opacity-50 pointer-events-none" : ""}`}
                  aria-busy={isSending}
                >
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`group relative p-3  cursor-pointer transition-colors ${
                        currentConversationId === conv.id
                          ? 'bg-[#D8FF3D]/10'
                          : 'hover:bg-[#141414]'
                      }`}
                      onClick={() => loadConversation(conv.id)}
                    >
                      <p className="text-sm font-medium text-[#F2EDE3] truncate pr-6">
                        {conv.title}
                      </p>
                      <p className="text-xs text-[#F2EDE3]/60 mt-1">
                        {loadingConvId === conv.id
                          ? t.loading
                          : t.messagesCount(conv._count?.messages ?? conv._count?.ChatMessage ?? 0)}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(conv.id);
                        }}
                        className="absolute top-2 right-2 p-1 rounded bg-red-500/10 hover:bg-red-500/20 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity"
                        title={t.deleteTitle}
                        aria-label={t.deleteTitle}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600 dark:text-red-400">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                  {conversations.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-xs text-[#F2EDE3]/60">
                        {t.noConversations}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Main chat area */}
              <div className="flex-1 min-w-0 flex flex-col">
              {/* Chat header */}
              <div className="px-3 py-3 md:p-6 border-b border-[rgba(242,237,227,0.10)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    <button
                      onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                      className="p-2 shrink-0 hover:bg-[#141414]/50 transition-colors"
                      title={isSidebarOpen ? t.hideHistory : t.showHistory}
                      aria-label={isSidebarOpen ? t.hideHistory : t.showHistory}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="12" x2="21" y2="12"/>
                        <line x1="3" y1="6" x2="21" y2="6"/>
                        <line x1="3" y1="18" x2="21" y2="18"/>
                      </svg>
                    </button>
                    <div className="hidden md:flex w-12 h-12 shrink-0 items-center justify-center">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base md:text-xl font-bold text-[#F2EDE3] truncate">{t.chatTitle}</h2>
                      <p className="hidden sm:block text-sm text-[#F2EDE3]/60">
                        {t.chatSubtitle}
                      </p>
                    </div>
                  </div>
                  {(currentConversationId || messages.length > 0) && (
                    <button
                      onClick={startNewChat}
                      disabled={isSending}
                      className="shrink-0 px-3 md:px-4 py-2 bg-[#D8FF3D] text-[#0B0B0B] hover:opacity-80 transition-opacity text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {t.newChat}
                    </button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div ref={messagesBoxRef} className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4 bg-[#141414]">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center min-h-full py-4 text-center">
                    <div className="w-16 h-16 md:w-20 md:h-20 mb-4  bg-[#0E0E0E] flex items-center justify-center">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#D8FF3D]">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-[#F2EDE3] mb-2">
                      {t.chatStart}
                    </h3>
                    <p className="text-sm text-[#F2EDE3]/60 max-w-md mb-4">
                      {t.chatStartDesc}
                    </p>
                    <div className="grid grid-cols-2 gap-3 max-w-lg">
                      <div className="bg-[#0E0E0E] p-3  border border-[rgba(242,237,227,0.15)]">
                        <div className="text-2xl mb-1">📐</div>
                        <p className="text-xs font-semibold text-[#F2EDE3]">{t.subjMath}</p>
                        <p className="text-xs text-[#F2EDE3]/60">{t.subjMathLevel}</p>
                      </div>
                      <div className="bg-[#0E0E0E] p-3  border border-[rgba(242,237,227,0.15)]">
                        <div className="text-2xl mb-1">⚡</div>
                        <p className="text-xs font-semibold text-[#F2EDE3]">{t.subjPhysics}</p>
                        <p className="text-xs text-[#F2EDE3]/60">{t.subjExtended}</p>
                      </div>
                      <div className="bg-[#0E0E0E] p-3  border border-[rgba(242,237,227,0.15)]">
                        <div className="text-2xl mb-1">🧪</div>
                        <p className="text-xs font-semibold text-[#F2EDE3]">{t.subjChemistry}</p>
                        <p className="text-xs text-[#F2EDE3]/60">{t.subjExtended}</p>
                      </div>
                      <div className="bg-[#0E0E0E] p-3  border border-[rgba(242,237,227,0.15)]">
                        <div className="text-2xl mb-1">🧬</div>
                        <p className="text-xs font-semibold text-[#F2EDE3]">{t.subjBiology}</p>
                        <p className="text-xs text-[#F2EDE3]/60">{t.subjExtended}</p>
                      </div>
                    </div>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} group`}
                  >
                    <div
                      className={`max-w-[92%] md:max-w-[85%] min-w-0 flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                    >
                    <div
                      className={`w-full px-3 py-2.5 md:px-5 md:py-3.5 ${
                        msg.role === "user"
                          ? "bg-[#D8FF3D] text-[#0B0B0B] border border-[#D8FF3D]"
                          : "bg-[#0E0E0E] text-[#F2EDE3] border border-[rgba(242,237,227,0.10)] overflow-x-auto"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <>
                          {msg.content && <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {msg.attachments.map((att, j) => (
                                <div key={j}>
                                  {att.mimeType.startsWith("image/") && att.data ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={att.data.startsWith("data:") ? att.data : `data:${att.mimeType};base64,${att.data}`}
                                      alt={att.filename}
                                      loading="lazy"
                                      decoding="async"
                                      className="max-w-full sm:max-w-sm"
                                    />
                                  ) : (
                                    <div className="flex items-center gap-2 bg-white/20 px-3 py-2 rounded">
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                                        <polyline points="13 2 13 9 20 9"/>
                                      </svg>
                                      <span className="text-xs">{att.filename}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <MessageRenderer content={msg.content} isUser={false} />
                      )}
                    </div>
                    {msg.role === "assistant" && msg.content && (
                      <button
                        onClick={() => copyToClipboard(msg.content, i)}
                        className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 km-mono-eyebrow border border-[rgba(242,237,227,0.15)] text-[#F2EDE3]/55 hover:text-[#D8FF3D] hover:border-[#D8FF3D] transition-colors"
                        title={t.copyAnswer}
                      >
                        {copiedIdx === i ? (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            {t.copied}
                          </>
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            {t.copy}
                          </>
                        )}
                      </button>
                    )}
                    </div>
                  </div>
                ))}
                {isSending && (
                  <div className="flex justify-start">
                    <div className="bg-[#0E0E0E] border border-[rgba(242,237,227,0.10)]  px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-[#D8FF3D] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <div className="w-2 h-2 bg-[#D8FF3D] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <div className="w-2 h-2 bg-[#D8FF3D] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                        <span className="text-sm text-[#F2EDE3]/60">{t.thinking}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Błąd wysyłki / wczytywania — treść wiadomości wróciła do pola */}
              {chatError && (
                <div role="alert" className="border-t border-[#FF4D2E]/30 bg-[#FF4D2E]/[0.06] px-3 md:px-6 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-[#FF4D2E]">{chatError.text}</p>
                    {chatError.action && (
                      <button
                        onClick={() => setActiveTab("ai")}
                        className="mt-1.5 km-mono-eyebrow text-[#D8FF3D] hover:underline"
                      >
                        {t.goBuyTokens}
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setChatError(null)}
                    className="km-mono-eyebrow text-[#F2EDE3]/60 hover:text-[#F2EDE3] shrink-0 p-1"
                    title={t.dismiss}
                    aria-label={t.dismiss}
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Input — własny stan (memo), rodzic dostaje tekst dopiero przy wysyłce */}
              <ChatInput
                key={draftEpoch}
                draftRef={chatDraftRef}
                disabled={isSending}
                labels={chatInputLabels}
                onSend={onChatSend}
              />
              </div>
            </div>
          )}

          {activeTab === "ai" && (
            <div
              key="ai"
              className="km-panel-fade space-y-5 max-w-3xl"
            >
              {/* === LICZNIK TOKENÓW === */}
              {(() => {
                // Serwer nie zwraca puli startowej (rejestracja daje 200 tys., kod z
                // pudełka 2 mln, zakupy dowolnie dużo), więc pokazujemy SALDO, a pasek
                // liczymy względem max(saldo, 200 tys.) — bez fikcyjnego "zużyto X%".
                const loaded = tokenBalance !== null;
                const balance = tokenBalance ?? 0;
                const base = Math.max(balance, TOKEN_REFERENCE);
                const pctLeft = base > 0 ? Math.min(100, (balance / base) * 100) : 0;
                const currentModel = aiModels.find((m) => m.id === aiModel);
                const multiplier = currentModel?.costMultiplier ?? 4;
                // Szacowana liczba zadań maturalnych (typowe zadanie: ~800 realnych tokenów wejście+wyjście)
                const avgRealTokensPerTask = 800;
                const avgEffectiveTokensPerTask = Math.ceil(avgRealTokensPerTask * multiplier);
                const tasksLeft = Math.floor(balance / avgEffectiveTokensPerTask);
                const tasksTotal = Math.floor(LICENSE_TOKENS / avgEffectiveTokensPerTask);
                const barColor =
                  balance < TOKEN_REFERENCE * 0.1 ? "#FF4D2E" : balance < TOKEN_REFERENCE * 0.3 ? "#FFB800" : "#D8FF3D";
                return (
                  <div className="bg-[#0E0E0E] p-4 sm:p-6 border border-[rgba(242,237,227,0.10)]">
                    <div className="km-mono-eyebrow text-[#D8FF3D] mb-3">{t.tokenUsage}</div>

                    {aiLoadError && (
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <p className="text-sm text-[#FF4D2E]">{t.aiLoadFailed}</p>
                        <button
                          onClick={() => void loadAiSettings()}
                          className="km-mono-eyebrow px-3 py-1 border border-[rgba(242,237,227,0.20)] text-[#F2EDE3]/80 hover:border-[#D8FF3D] hover:text-[#D8FF3D] transition-colors"
                        >
                          {t.retry}
                        </button>
                      </div>
                    )}

                    {/* Saldo + pasek */}
                    <div className="mb-4">
                      <div className="flex items-end justify-between mb-1.5">
                        <div>
                          <span className="text-2xl font-bold" style={{ color: loaded ? barColor : undefined }}>
                            {loaded ? formatTokens(balance) : "…"}
                          </span>
                          <span className="text-sm text-[#F2EDE3]/40 ml-1.5">{t.effectiveTokens}</span>
                        </div>
                      </div>
                      <div className="w-full bg-[#1a1a1a] h-2 border border-[rgba(242,237,227,0.08)]">
                        <div
                          className="h-full transition-all duration-700"
                          style={{ width: `${loaded ? pctLeft : 0}%`, backgroundColor: barColor }}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="km-mono-eyebrow text-[#F2EDE3]/30">{t.remaining}</span>
                      </div>
                    </div>

                    {/* Szacunkowa liczba zadań */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-[#141414] border border-[rgba(242,237,227,0.08)] p-3">
                        <div className="km-mono-eyebrow text-[#F2EDE3]/40 mb-0.5">{t.tasksLeftLabel}</div>
                        <div className="text-xl font-bold text-[#D8FF3D]">
                          {loaded ? `~${tasksLeft.toLocaleString(DATE_LOCALE[lang])}` : "…"}
                        </div>
                        <div className="text-xs text-[#F2EDE3]/40 mt-0.5">{t.maturaTasks}</div>
                      </div>
                      <div className="bg-[#141414] border border-[rgba(242,237,227,0.08)] p-3">
                        <div className="km-mono-eyebrow text-[#F2EDE3]/40 mb-0.5">{t.perLicenseLabel}</div>
                        <div className="text-xl font-bold text-[#F2EDE3]">
                          ~{tasksTotal.toLocaleString(DATE_LOCALE[lang])}
                        </div>
                        <div className="text-xs text-[#F2EDE3]/40 mt-0.5">{t.forModel(currentModel?.label ?? t.defaultModel)}</div>
                      </div>
                    </div>

                    {/* Tabelka kosztów modeli */}
                    <div className="border border-[rgba(242,237,227,0.08)] mb-3">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-[rgba(242,237,227,0.08)] bg-[#141414]">
                        <span className="km-mono-eyebrow text-[#F2EDE3]/40 text-[10px]">{t.modelPerformance}</span>
                      </div>
                      <div className="divide-y divide-[rgba(242,237,227,0.05)]">
                        {aiModels.map((m) => {
                          const eff = Math.ceil(avgRealTokensPerTask * m.costMultiplier);
                          const tasks = Math.floor(LICENSE_TOKENS / eff);
                          const isCurrent = m.id === aiModel;
                          return (
                            <div
                              key={m.id}
                              className={`flex items-center justify-between px-3 py-2 ${isCurrent ? "bg-[#D8FF3D]/5" : ""}`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {isCurrent && <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full flex-shrink-0" />}
                                <span className={`text-xs truncate ${isCurrent ? "text-[#D8FF3D] font-medium" : "text-[#F2EDE3]/60"}`}>
                                  {m.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                <span className={`km-mono-eyebrow text-[10px] px-1.5 py-0.5 ${
                                  m.costMultiplier >= 6
                                    ? "bg-red-500/10 text-red-400"
                                    : m.costMultiplier >= 2
                                    ? "bg-yellow-500/10 text-yellow-400"
                                    : "bg-emerald-500/10 text-emerald-400"
                                }`}>
                                  ×{m.costMultiplier}
                                </span>
                                <span className={`text-xs font-bold w-24 text-right ${isCurrent ? "text-[#D8FF3D]" : "text-[#F2EDE3]/50"}`}>
                                  ~{tasks.toLocaleString(DATE_LOCALE[lang])} {t.tasksAbbr}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <p className="text-xs text-[#F2EDE3]/30">
                      {t.tokenEstimateNote}
                    </p>
                  </div>
                );
              })()}

              {/* === KOD Z PUDEŁKA: +2 MLN TOKENÓW === */}
              <div className="bg-[#0E0E0E] p-6 border border-[rgba(242,237,227,0.10)]">
                <div className="km-mono-eyebrow text-[#D8FF3D] mb-1">/ {t.redeemHeading}</div>
                <p className="text-sm text-[#F2EDE3]/55 mb-4">{t.redeemDesc}</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleRedeemLicense();
                  }}
                  className="flex flex-col sm:flex-row gap-3"
                >
                  <input
                    type="text"
                    value={licenseCode}
                    onChange={(e) => setLicenseCode(e.target.value)}
                    placeholder={t.licenseCodePlaceholder}
                    autoComplete="off"
                    className="flex-1 px-4 py-3 bg-[#0B0B0B] border border-[rgba(242,237,227,0.18)] focus:outline-none focus:border-[#D8FF3D] text-sm font-mono text-[#F2EDE3] placeholder:text-[#F2EDE3]/25 transition-colors"
                    disabled={redeemingLicense}
                  />
                  <button
                    type="submit"
                    disabled={!licenseCode.trim() || redeemingLicense}
                    className="px-6 py-3 km-mono-eyebrow bg-[#D8FF3D] hover:bg-[#F2EDE3] text-[#0B0B0B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {redeemingLicense ? t.redeeming : t.redeem}
                  </button>
                </form>
                {redeemResult && (
                  <p
                    role="status"
                    className={`mt-3 text-sm ${redeemResult.ok ? "text-[#D8FF3D]" : "text-[#FF4D2E]"}`}
                  >
                    {redeemResult.text}
                  </p>
                )}
              </div>

              {/* === SKLEP: KUP TOKENY === */}
              <div className="bg-[#0E0E0E] p-6 border border-[rgba(242,237,227,0.10)]">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <div className="km-mono-eyebrow text-[#D8FF3D]">{t.buyTokens}</div>
                  <div className="inline-flex items-center border border-[rgba(242,237,227,0.18)] shrink-0">
                    {(["pln", "eur"] as const).map((c) => (
                      <button
                        key={c}
                        onClick={() => setBuyCurrency(c)}
                        className={`km-mono-eyebrow text-[11px] px-2.5 py-1 transition-colors ${
                          buyCurrency === c ? "bg-[#D8FF3D] text-[#0B0B0B]" : "text-[#F2EDE3]/55 hover:text-[#F2EDE3]"
                        }`}
                      >
                        {c.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-[#F2EDE3]/55 mb-4">
                  {t.buyTokensDesc}
                </p>
                <div className="grid sm:grid-cols-3 gap-3">
                  {TOKEN_PACKS.map((p) => (
                    <div
                      key={p.id}
                      className={`relative border p-4 flex flex-col ${
                        p.popular ? "border-[#D8FF3D]" : "border-[rgba(242,237,227,0.18)]"
                      }`}
                    >
                      {p.popular && (
                        <span className="absolute -top-2 left-3 km-mono-eyebrow text-[10px] bg-[#D8FF3D] text-[#0B0B0B] px-1.5 py-0.5">
                          {t.popular}
                        </span>
                      )}
                      <div className="text-lg font-bold text-[#F2EDE3]">{t.packLabel(p.tokens)}</div>
                      <div className="text-3xl font-bold text-[#D8FF3D] mt-1">
                        {buyCurrency === "pln"
                          ? <>{(p.priceGrosze / 100).toFixed(0)}<span className="text-base text-[#F2EDE3]/50"> zł</span></>
                          : <>{(p.priceEurCents / 100).toFixed(0)}<span className="text-base text-[#F2EDE3]/50"> EUR</span></>}
                      </div>
                      <div className="text-xs text-[#F2EDE3]/40 mt-1 mb-3">
                        ~{Math.floor(p.tokens / 3200).toLocaleString(DATE_LOCALE[lang])} {t.maturaTasksApprox}
                      </div>
                      <button
                        onClick={() => buyTokens(p.id)}
                        disabled={buyingPack !== null}
                        className="mt-auto px-4 py-2 km-mono-eyebrow bg-[#D8FF3D] hover:bg-[#F2EDE3] text-[#0B0B0B] disabled:opacity-50 transition-colors"
                      >
                        {buyingPack === p.id ? t.redirecting : t.buy}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* === MODEL AI === */}
              <div className="bg-[#0E0E0E] p-6 border border-[rgba(242,237,227,0.10)]">
                <div className="km-mono-eyebrow text-[#D8FF3D] mb-1">{t.aiModelHeading}</div>
                <p className="text-sm text-[#F2EDE3]/55 mb-4">
                  {t.aiModelDesc}
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {aiModels.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => saveAiSettings({ aiModel: m.id })}
                      disabled={aiSaving}
                      className={`text-left px-4 py-3 border transition-colors disabled:opacity-50 ${
                        aiModel === m.id
                          ? "border-[#D8FF3D] bg-[#D8FF3D]/10"
                          : "border-[rgba(242,237,227,0.18)] hover:border-[rgba(242,237,227,0.40)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-medium text-sm ${aiModel === m.id ? "text-[#D8FF3D]" : "text-[#F2EDE3]"}`}>{m.label}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`km-mono-eyebrow text-[10px] px-1.5 py-0.5 ${
                            m.costMultiplier >= 6
                              ? "bg-red-500/10 text-red-400"
                              : m.costMultiplier >= 2
                              ? "bg-yellow-500/10 text-yellow-400"
                              : "bg-emerald-500/10 text-emerald-400"
                          }`}>
                            ×{m.costMultiplier}
                          </span>
                          <span className="km-mono-eyebrow text-[#F2EDE3]/40 text-[10px]">{m.provider}</span>
                        </div>
                      </div>
                      {m.note && <div className="text-xs text-[#F2EDE3]/45 mt-1">{m.note}</div>}
                    </button>
                  ))}
                </div>
              </div>

              {/* === TRYB AI === */}
              <div className="bg-[#0E0E0E] p-6 border border-[rgba(242,237,227,0.10)]">
                <div className="km-mono-eyebrow text-[#D8FF3D] mb-3">{t.aiModeHeading}</div>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => saveAiSettings({ aiMode: "matura" })}
                    disabled={aiSaving}
                    className={`km-mono-eyebrow px-4 py-2 border transition-colors disabled:opacity-50 ${
                      aiMode !== "raw"
                        ? "border-[#D8FF3D] bg-[#D8FF3D]/10 text-[#D8FF3D]"
                        : "border-[rgba(242,237,227,0.20)] text-[#F2EDE3]/60 hover:text-[#F2EDE3] hover:border-[rgba(242,237,227,0.40)]"
                    }`}
                    title={t.maturaCkeTitle}
                  >
                    {t.maturaCke}
                  </button>
                  <button
                    onClick={() => saveAiSettings({ aiMode: "raw" })}
                    disabled={aiSaving}
                    className={`km-mono-eyebrow px-4 py-2 border transition-colors disabled:opacity-50 ${
                      aiMode === "raw"
                        ? "border-[#D8FF3D] bg-[#D8FF3D]/10 text-[#D8FF3D]"
                        : "border-[rgba(242,237,227,0.20)] text-[#F2EDE3]/60 hover:text-[#F2EDE3] hover:border-[rgba(242,237,227,0.40)]"
                    }`}
                    title={t.rawAiTitle}
                  >
                    {t.rawAi}
                  </button>
                </div>
                <div className="text-xs text-[#F2EDE3]/45">
                  {aiMode === "raw" ? t.rawModeDesc : t.maturaModeDesc}
                </div>
              </div>
            </div>
          )}

          {activeTab === "calculator" && (
            <div
              key="calculator"
              className="km-panel-fade space-y-6"
            >
              {calcLoading && !calcInfo && (
                <div className="text-[#F2EDE3]/60">{t.loading}</div>
              )}
              {calcLoadError && (
                <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 border border-[#FF4D2E]/40 bg-[#FF4D2E]/[0.06] p-3">
                  <p className="text-sm text-[#FF4D2E]">{calcLoadError}</p>
                  <button
                    onClick={() => void loadCalcData({ force: true })}
                    className="km-mono-eyebrow px-3 py-1 border border-[rgba(242,237,227,0.20)] text-[#F2EDE3]/80 hover:border-[#D8FF3D] hover:text-[#D8FF3D] transition-colors"
                  >
                    {t.retry}
                  </button>
                </div>
              )}

              {calcInfo && !calcInfo.device && (
                <div className="relative bg-[#0E0E0E] border border-[rgba(242,237,227,0.18)]">
                  <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-l border-t border-[#D8FF3D]" />
                  <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-r border-t border-[#D8FF3D]" />
                  <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-l border-b border-[#D8FF3D]" />
                  <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-r border-b border-[#D8FF3D]" />

                  <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(242,237,227,0.10)]">
                    <span className="km-mono-eyebrow text-[#D8FF3D] flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full km-blink" />
                      {t.pairCalculator}
                    </span>
                    <span className="km-mono-eyebrow text-[#F2EDE3]/40">/PAIR</span>
                  </div>

                  <div className="p-6 lg:p-8">
                    <h2 className="km-display text-3xl text-[#F2EDE3]">
                      {t.addYourDevice} <span className="italic text-[#D8FF3D]">{t.deviceWord}</span>.
                    </h2>
                    <p className="mt-3 text-[14px] text-[#F2EDE3]/65 leading-[1.6]">
                      {t.pairIntro1}<strong className="text-[#F2EDE3]">Device ID</strong>{t.pairIntro2}<strong className="text-[#F2EDE3]">{t.unlockCodeLabel}</strong>{t.pairIntro3}
                    </p>
                    <p className="mt-2 km-mono-eyebrow text-[#F2EDE3]/40">
                      {t.pairWarning}
                    </p>

                    <div className="mt-6 space-y-4">
                      <div>
                        <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                          {t.deviceIdLabel}
                        </label>
                        <input
                          type="text"
                          value={pairDeviceId}
                          onChange={(e) => setPairDeviceId(e.target.value.toUpperCase())}
                          placeholder="68FE71E43B94"
                          className="w-full px-4 py-3 bg-[#0B0B0B] border border-[rgba(242,237,227,0.18)] focus:outline-none focus:border-[#D8FF3D] text-[15px] font-mono text-[#F2EDE3] placeholder:text-[#F2EDE3]/25 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                          {t.unlockCodeLabel}
                        </label>
                        <input
                          type="text"
                          value={pairUnlockCode}
                          onChange={(e) => setPairUnlockCode(e.target.value)}
                          placeholder="1111"
                          className="w-full px-4 py-3 bg-[#0B0B0B] border border-[rgba(242,237,227,0.18)] focus:outline-none focus:border-[#D8FF3D] text-[15px] font-mono text-[#F2EDE3] placeholder:text-[#F2EDE3]/25 transition-colors"
                        />
                      </div>
                      <button
                        onClick={pairDevice}
                        disabled={pairing || !pairDeviceId.trim() || !pairUnlockCode.trim()}
                        className="w-full inline-flex items-center justify-between px-5 py-3.5 bg-[#D8FF3D] text-[#0B0B0B] km-mono-eyebrow hover:bg-[#F2EDE3] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <span className="flex items-center gap-2">
                          {!pairing && <span className="w-1.5 h-1.5 bg-[#0B0B0B] rounded-full km-blink" />}
                          {pairing ? t.pairing : t.pairButton}
                        </span>
                        {!pairing && <span>→</span>}
                      </button>
                    </div>

                    {pairError && (
                      <div className="mt-4 border border-[#FF4D2E]/40 bg-[#FF4D2E]/[0.06] p-3">
                        <p className="km-mono-eyebrow text-[#FF4D2E]">{t.errorLabel}</p>
                        <p className="text-sm text-[#FF4D2E] mt-1">{pairError}</p>
                      </div>
                    )}
                    {pairOk && (
                      <div className="mt-4 border border-[#D8FF3D]/40 bg-[#D8FF3D]/[0.06] p-3">
                        <p className="km-mono-eyebrow text-[#D8FF3D]">{t.paired}</p>
                        <p className="text-sm text-[#F2EDE3]/80 mt-1">{t.deviceAdded}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {calcInfo && calcInfo.device && (
                <>
                  {/* Info o urzadzeniu */}
                  <div className="bg-[#0E0E0E] p-6 border border-[rgba(242,237,227,0.10)]">
                    <div className="flex justify-between items-start mb-3">
                      <h2 className="km-display text-2xl text-[#F2EDE3]">
                        {t.yourDevice} <span className="italic text-[#D8FF3D]">{t.deviceWord}</span>
                      </h2>
                      <button
                        onClick={calcUnclaim}
                        disabled={unclaiming}
                        className="km-mono-eyebrow px-3 py-1.5 border border-[#FF4D2E]/40 text-[#FF4D2E] hover:bg-[#FF4D2E]/10 disabled:opacity-50 transition-colors"
                      >
                        {unclaiming ? t.unpinning : t.unpin}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-[#F2EDE3]/60">{t.license}</div>
                        <div className="font-mono text-[#F2EDE3]">{calcInfo.license?.code}</div>
                      </div>
                      {calcInfo.device && (
                        <>
                          <div>
                            <div className="text-[#F2EDE3]/60">{t.deviceIdLabel}</div>
                            <div className="font-mono text-[#F2EDE3]">{calcInfo.device.deviceId}</div>
                          </div>
                          <div>
                            <div className="text-[#F2EDE3]/60">{t.firmware}</div>
                            <div className="font-mono text-[#F2EDE3]">{calcInfo.device.firmwareVersion || "—"}</div>
                          </div>
                          <div>
                            <div className="text-[#F2EDE3]/60">{t.requests}</div>
                            <div className="font-bold text-[#D8FF3D]">{calcInfo.device.requestCount}</div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Tryb AI + model — przeniesione do zakładki "AI" */}
                    <div className="mt-5 pt-5 border-t border-[rgba(242,237,227,0.10)]">
                      <div className="km-mono-eyebrow text-[#D8FF3D] mb-1">{t.aiModeAndModel}</div>
                      <div className="text-xs text-[#F2EDE3]/45">
                        {t.aiModeSetInTab(
                          <button onClick={() => setActiveTab("ai")} className="text-[#D8FF3D] underline hover:no-underline">AI</button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Galeria zdjec z kamery */}
                  <div className="bg-[#0E0E0E] border border-[rgba(242,237,227,0.10)]">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(242,237,227,0.10)]">
                      <span className="km-mono-eyebrow text-[#D8FF3D]">{t.photoGallery}</span>
                      <span className="km-mono-eyebrow text-[#F2EDE3]/45">
                        {t.photosCount(String(Math.max(capturesTotal, captures.length)).padStart(2, "0"))}
                      </span>
                    </div>
                    {capturesLoading && captures.length === 0 ? (
                      <div className="px-6 py-10 text-center km-mono-eyebrow text-[#F2EDE3]/45">
                        {t.loading}
                      </div>
                    ) : captures.length === 0 ? (
                      <div className="px-6 py-10 text-center km-mono-eyebrow text-[#F2EDE3]/45">
                        {t.noPhotos}
                      </div>
                    ) : (
                      <>
                      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {captures.slice(0, capturesVisible).map((c) => (
                          <button
                            key={c.filename}
                            onClick={() => setOpenedCapture(c.filename)}
                            className="group relative aspect-[4/3] bg-[#1A1A1A] overflow-hidden border border-[rgba(242,237,227,0.10)] hover:border-[#D8FF3D] transition-colors"
                            title={`${new Date(c.timestamp).toLocaleString(DATE_LOCALE[lang])} · ${c.sizeKB} kB`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/user/captures/${encodeURIComponent(c.filename)}`}
                              alt={c.filename}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                              <div className="km-mono-eyebrow text-[10px] text-[#F2EDE3]/80 truncate">
                                {new Date(c.timestamp).toLocaleString(DATE_LOCALE[lang], {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                      {(capturesVisible < captures.length || capturesCursor) && (
                        <div className="px-4 pb-4">
                          <button
                            onClick={() => void loadMoreCaptures()}
                            disabled={capturesMoreLoading}
                            className="w-full km-mono-eyebrow px-4 py-2.5 border border-[rgba(242,237,227,0.18)] text-[#F2EDE3]/80 hover:border-[#D8FF3D] hover:text-[#D8FF3D] disabled:opacity-50 transition-colors"
                          >
                            {capturesMoreLoading ? t.loading : t.loadMore}
                          </button>
                        </div>
                      )}
                      </>
                    )}
                  </div>

                  {/* Modal — pelnoekranowy podglad zdjecia */}
                  {openedCapture && (
                    <div
                      onClick={() => setOpenedCapture(null)}
                      className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 cursor-zoom-out"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/user/captures/${encodeURIComponent(openedCapture)}`}
                        alt={openedCapture}
                        decoding="async"
                        className="max-w-full max-h-full object-contain"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={() => setOpenedCapture(null)}
                        className="absolute top-4 right-4 km-mono-eyebrow text-[#F2EDE3]/80 hover:text-[#D8FF3D] border border-[rgba(242,237,227,0.20)] px-3 py-1.5"
                      >
                        {t.close}
                      </button>
                    </div>
                  )}

                  {/* Historia rozmów */}
                  <div className="bg-[#0E0E0E] border border-[rgba(242,237,227,0.10)]">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(242,237,227,0.10)]">
                      <span className="km-mono-eyebrow text-[#D8FF3D]">{t.solutionHistory}</span>
                      <span className="km-mono-eyebrow text-[#F2EDE3]/45">
                        {t.recordsCount(String(calcConvs.length).padStart(2, "0"))}
                      </span>
                    </div>
                    {calcConvs.length === 0 ? (
                      <div className="px-6 py-10 text-center km-mono-eyebrow text-[#F2EDE3]/45">
                        {t.noTasksSolved}
                      </div>
                    ) : (
                      <div className="divide-y divide-[rgba(242,237,227,0.08)]">
                        {calcConvs.map((it: any, idx: number) => (
                          <button
                            key={it.id}
                            onClick={() => setCalcOpenedConv(it)}
                            className="block w-full text-left px-6 py-4 hover:bg-[#141414] transition-colors group"
                          >
                            <div className="flex items-start gap-4">
                              <span className="km-mono-eyebrow text-[#F2EDE3]/30 pt-1 group-hover:text-[#D8FF3D] transition-colors">
                                {String(idx + 1).padStart(2, "0")}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="text-[15px] text-[#F2EDE3] truncate">
                                  {it.mode === "image" ? t.photo : it.question}
                                </div>
                                <div className="text-[13px] text-[#F2EDE3]/55 mt-1 line-clamp-1">
                                  {String(it.answer || "").slice(0, 140)}…
                                </div>
                              </div>
                              <span className="km-mono-eyebrow text-[#F2EDE3]/40 whitespace-nowrap tabular-nums">
                                {new Date(it.createdAt).toLocaleString(DATE_LOCALE[lang], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Modal pelnego widoku konwersacji */}
              {calcOpenedConv && (
                <div className="fixed inset-0 bg-[#0B0B0B]/80 backdrop-blur-md flex items-center justify-center p-4 z-50" onClick={() => setCalcOpenedConv(null)}>
                  <div className="relative bg-[#0B0B0B] max-w-2xl w-full max-h-[85vh] overflow-y-auto border border-[rgba(242,237,227,0.18)]" onClick={(e) => e.stopPropagation()}>
                    <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-l border-t border-[#D8FF3D]" />
                    <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-r border-t border-[#D8FF3D]" />
                    <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-l border-b border-[#D8FF3D]" />
                    <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-r border-b border-[#D8FF3D]" />

                    <div className="flex justify-between items-center px-6 py-4 border-b border-[rgba(242,237,227,0.10)] sticky top-0 bg-[#0B0B0B] z-10">
                      <div className="flex flex-col">
                        <span className="km-mono-eyebrow text-[#D8FF3D]">{t.solution}</span>
                        <span className="km-mono-eyebrow text-[#F2EDE3]/45 mt-1">
                          {new Date(calcOpenedConv.createdAt).toLocaleString(DATE_LOCALE[lang])} · {calcOpenedConv.deviceId}
                        </span>
                      </div>
                      <button
                        onClick={() => setCalcOpenedConv(null)}
                        className="w-8 h-8 border border-[rgba(242,237,227,0.20)] flex items-center justify-center text-[#F2EDE3] hover:bg-[#F2EDE3] hover:text-[#0B0B0B] transition-colors"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="p-6 lg:p-8 space-y-5">
                      <div>
                        <p className="km-mono-eyebrow text-[#F2EDE3]/55 mb-2">{t.task}</p>
                        <div className="bg-[#0E0E0E] border border-[rgba(242,237,227,0.10)] p-4 text-[14.5px] text-[#F2EDE3] whitespace-pre-wrap leading-relaxed">
                          {calcOpenedConv.question}
                        </div>
                      </div>
                      <div>
                        <p className="km-mono-eyebrow text-[#D8FF3D] mb-2">{t.solution}</p>
                        <div className="bg-[#0E0E0E] border border-[#D8FF3D]/30 border-l-2 p-4 text-[14px] text-[#F2EDE3] whitespace-pre-wrap font-mono leading-relaxed">
                          {calcOpenedConv.answer}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}


          {activeTab === "notes" && (
            <div
              key="notes"
              className="km-panel-fade"
            >
              {calcLoading && !calcInfo && (
                <div className="text-[#F2EDE3]/60">{t.loading}</div>
              )}
              {calcLoadError && (
                <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 border border-[#FF4D2E]/40 bg-[#FF4D2E]/[0.06] p-3">
                  <p className="text-sm text-[#FF4D2E]">{calcLoadError}</p>
                  <button
                    onClick={() => void loadCalcData({ force: true })}
                    className="km-mono-eyebrow px-3 py-1 border border-[rgba(242,237,227,0.20)] text-[#F2EDE3]/80 hover:border-[#D8FF3D] hover:text-[#D8FF3D] transition-colors"
                  >
                    {t.retry}
                  </button>
                </div>
              )}
              {calcInfo && !calcInfo.device && (
                <div className="bg-[#0E0E0E] p-6 border border-[rgba(242,237,227,0.10)]">
                  <p className="km-mono-eyebrow text-[#D8FF3D]">{t.calcRequired}</p>
                  <p className="text-sm text-[#F2EDE3]/70 mt-2">
                    {t.pairFirst(<strong className="text-[#F2EDE3]">{t.tabsCalculator}</strong>)}
                  </p>
                </div>
              )}
              {calcInfo && calcInfo.device && (<>{/* Notatki */}
                  <div className="bg-[#0E0E0E]  p-6 border border-[rgba(242,237,227,0.10)]">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-bold text-[#F2EDE3]">
                        {t.notesOffline(calcNotes.length)}
                      </h2>
                      <span className="text-xs text-[#F2EDE3]/60">
                        {t.syncToDevice}
                      </span>
                    </div>
                    <div className="bg-[#141414] p-5 mb-5 border border-[rgba(242,237,227,0.10)]">
                      <div className="km-mono-eyebrow text-[#D8FF3D] mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full km-blink" />
                        {editingNote ? t.editNote : t.newNote}
                      </div>
                      <input
                        type="text"
                        value={noteTitle}
                        onChange={(e) => setNoteTitle(e.target.value)}
                        placeholder={t.noteTitlePlaceholder}
                        maxLength={60}
                        className="w-full px-3 py-2.5 bg-[#0B0B0B] border border-[rgba(242,237,227,0.15)] focus:outline-none focus:border-[#D8FF3D] mb-2 text-sm text-[#F2EDE3] placeholder:text-[#F2EDE3]/30 transition-colors"
                      />
                      <textarea
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        placeholder={t.noteContentPlaceholder}
                        maxLength={4000}
                        rows={4}
                        className="w-full px-3 py-2.5 bg-[#0B0B0B] border border-[rgba(242,237,227,0.15)] focus:outline-none focus:border-[#D8FF3D] text-sm font-mono text-[#F2EDE3] placeholder:text-[#F2EDE3]/30 transition-colors resize-none"
                      />
                      <div className="flex justify-between items-center mt-2">
                        <div className="text-xs text-[#F2EDE3]/60">{noteContent.length}/4000</div>
                        <div className="flex gap-2">
                          {editingNote && (
                            <button
                              onClick={() => { setEditingNote(null); setNoteTitle(""); setNoteContent(""); setNoteError(null); }}
                              className="px-3 py-1.5 km-mono-eyebrow bg-[#1a1a1a] border border-[rgba(242,237,227,0.20)] hover:border-[#F2EDE3] text-[#F2EDE3]/80 hover:text-[#F2EDE3] transition-colors"
                            >{t.cancel}</button>
                          )}
                          <button
                            onClick={calcSaveNote}
                            disabled={savingNote || (!noteTitle.trim() && !noteContent.trim())}
                            className="px-4 py-1.5 km-mono-eyebrow bg-[#D8FF3D] hover:bg-[#F2EDE3] text-[#0B0B0B] disabled:opacity-30 transition-colors"
                          >{savingNote ? t.saving : editingNote ? t.save : t.add}</button>
                        </div>
                      </div>
                      {noteError && (
                        <p role="alert" className="mt-2 text-xs text-[#FF4D2E]">{noteError}</p>
                      )}
                    </div>
                    {calcNotes.length === 0 ? (
                      <div className="text-[#F2EDE3]/60 text-sm text-center py-4">
                        {t.noNotes}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {calcNotes.map((n: any) => (
                          <div key={n.id} className="border border-[rgba(242,237,227,0.10)] p-4 hover:bg-[#141414] hover:border-[rgba(242,237,227,0.20)] transition-colors">
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-[#F2EDE3]">{n.title || t.noTitle}</div>
                                <div className="text-xs text-[#F2EDE3]/60 mt-1 line-clamp-2 whitespace-pre-wrap">{n.content || t.empty}</div>
                              </div>
                              <div className="ml-2 flex gap-1">
                                <button onClick={() => { setEditingNote(n); setNoteTitle(n.title); setNoteContent(n.content); }}
                                  className="text-xs px-2 py-1 border border-[#D8FF3D]/40 text-[#D8FF3D] hover:bg-[#D8FF3D]/10 km-mono-eyebrow">{t.edit}</button>
                                <button onClick={() => calcDelNote(n.id)}
                                  className="text-xs px-2 py-1 border border-[#FF4D2E]/40 text-[#FF4D2E] hover:bg-[#FF4D2E]/10 km-mono-eyebrow">{t.delete}</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div></>)}
            </div>
          )}

          {activeTab === "tests" && (
            <div
              key="tests"
              className="km-panel-fade"
            >
              {calcLoading && !calcInfo && (
                <div className="text-[#F2EDE3]/60">{t.loading}</div>
              )}
              {calcLoadError && (
                <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 border border-[#FF4D2E]/40 bg-[#FF4D2E]/[0.06] p-3">
                  <p className="text-sm text-[#FF4D2E]">{calcLoadError}</p>
                  <button
                    onClick={() => void loadCalcData({ force: true })}
                    className="km-mono-eyebrow px-3 py-1 border border-[rgba(242,237,227,0.20)] text-[#F2EDE3]/80 hover:border-[#D8FF3D] hover:text-[#D8FF3D] transition-colors"
                  >
                    {t.retry}
                  </button>
                </div>
              )}
              {calcInfo && !calcInfo.device && (
                <div className="bg-[#0E0E0E] p-6 border border-[rgba(242,237,227,0.10)]">
                  <p className="km-mono-eyebrow text-[#D8FF3D]">{t.calcRequired}</p>
                  <p className="text-sm text-[#F2EDE3]/70 mt-2">
                    {t.pairFirst(<strong className="text-[#F2EDE3]">{t.tabsCalculator}</strong>)}
                  </p>
                </div>
              )}
              {calcInfo && calcInfo.device && (<>{/* Sprawdziany */}
                  <div className="bg-[#0E0E0E]  p-6 border border-[rgba(242,237,227,0.10)]">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-bold text-[#F2EDE3]">
                        {t.testsHeading(calcTests.length)}
                      </h2>
                      <span className="text-xs text-[#F2EDE3]/60">{t.markdownOk}</span>
                    </div>
                    <div className="bg-[#141414] p-5 mb-5 border border-[rgba(242,237,227,0.10)]">
                      <div className="km-mono-eyebrow text-[#D8FF3D] mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full km-blink" />
                        {editingTest ? t.editTest : t.newTest}
                      </div>
                      <input
                        type="text"
                        value={testTitle}
                        onChange={(e) => setTestTitle(e.target.value)}
                        placeholder={t.testTitlePlaceholder}
                        maxLength={100}
                        className="w-full px-3 py-2.5 bg-[#0B0B0B] border border-[rgba(242,237,227,0.15)] focus:outline-none focus:border-[#D8FF3D] mb-2 text-sm text-[#F2EDE3] placeholder:text-[#F2EDE3]/30 transition-colors"
                      />
                      <textarea
                        value={testContent}
                        onChange={(e) => setTestContent(e.target.value)}
                        placeholder={t.testContentPlaceholder}
                        maxLength={30000}
                        rows={8}
                        className="w-full px-3 py-2.5 bg-[#0B0B0B] border border-[rgba(242,237,227,0.15)] focus:outline-none focus:border-[#D8FF3D] text-sm font-mono text-[#F2EDE3] placeholder:text-[#F2EDE3]/30 transition-colors resize-none"
                      />
                      <div className="flex justify-between items-center mt-2">
                        <div className="text-xs text-[#F2EDE3]/60">{testContent.length}/30000</div>
                        <div className="flex gap-2">
                          {editingTest && (
                            <button
                              onClick={() => { setEditingTest(null); setTestTitle(""); setTestContent(""); setTestError(null); }}
                              className="px-3 py-1.5 km-mono-eyebrow bg-[#1a1a1a] border border-[rgba(242,237,227,0.20)] hover:border-[#F2EDE3] text-[#F2EDE3]/80 hover:text-[#F2EDE3] transition-colors"
                            >{t.cancel}</button>
                          )}
                          <button
                            onClick={calcSaveTest}
                            disabled={savingTest || (!testTitle.trim() && !testContent.trim())}
                            className="px-3 py-1 text-sm bg-[#D8FF3D] hover:bg-[#F2EDE3] text-[#0B0B0B] km-mono-eyebrow disabled:opacity-50"
                          >{savingTest ? t.saving : editingTest ? t.save : t.add}</button>
                        </div>
                      </div>
                      {testError && (
                        <p role="alert" className="mt-2 text-xs text-[#FF4D2E]">{testError}</p>
                      )}
                    </div>
                    {calcTests.length === 0 ? (
                      <div className="text-[#F2EDE3]/60 text-sm text-center py-4">
                        {t.noTests}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {calcTests.map((test: any) => (
                          <div key={test.id} className="border border-[rgba(242,237,227,0.10)] p-4 hover:bg-[#141414] hover:border-[rgba(242,237,227,0.20)] transition-colors">
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-[#F2EDE3]">{test.title || t.noTitle}</div>
                                <div className="text-xs text-[#F2EDE3]/60 mt-1">{t.charsCount(test.content.length)}</div>
                              </div>
                              <div className="ml-2 flex gap-1">
                                <button onClick={() => { setEditingTest(test); setTestTitle(test.title); setTestContent(test.content); }}
                                  className="text-xs px-2 py-1 border border-[#D8FF3D]/40 text-[#D8FF3D] hover:bg-[#D8FF3D]/10 km-mono-eyebrow">{t.edit}</button>
                                <button onClick={() => calcDelTest(test.id)}
                                  className="text-xs px-2 py-1 border border-[#FF4D2E]/40 text-[#FF4D2E] hover:bg-[#FF4D2E]/10 km-mono-eyebrow">{t.delete}</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div></>)}
            </div>
          )}

          {activeTab === "settings" && (
            <div
              key="settings"
              className="km-panel-fade"
            >
              <div className="max-w-2xl space-y-6">
                {/* Profil */}
                <div className="bg-[#0E0E0E] p-6 border border-[rgba(242,237,227,0.10)]">
                  <div className="km-mono-eyebrow text-[#D8FF3D] mb-3">{t.account}</div>
                  <div className="text-sm text-[#F2EDE3]/55">{t.loggedInAs}</div>
                  <div className="text-[#F2EDE3] font-medium break-all">{session.user?.email}</div>
                </div>

                {/* Zmiana hasła */}
                <div className="bg-[#0E0E0E] p-6 border border-[rgba(242,237,227,0.10)]">
                  <div className="km-mono-eyebrow text-[#D8FF3D] mb-4">{t.changePassword}</div>
                  <div className="space-y-2">
                    <input type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} placeholder={t.currentPassword} autoComplete="current-password" className="w-full px-3 py-2.5 bg-[#0B0B0B] border border-[rgba(242,237,227,0.15)] focus:outline-none focus:border-[#D8FF3D] text-sm text-[#F2EDE3] placeholder:text-[#F2EDE3]/30 transition-colors" />
                    <input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} placeholder={t.newPassword} autoComplete="new-password" className="w-full px-3 py-2.5 bg-[#0B0B0B] border border-[rgba(242,237,227,0.15)] focus:outline-none focus:border-[#D8FF3D] text-sm text-[#F2EDE3] placeholder:text-[#F2EDE3]/30 transition-colors" />
                    <input type="password" value={pwNew2} onChange={(e) => setPwNew2(e.target.value)} placeholder={t.repeatNewPassword} autoComplete="new-password" className="w-full px-3 py-2.5 bg-[#0B0B0B] border border-[rgba(242,237,227,0.15)] focus:outline-none focus:border-[#D8FF3D] text-sm text-[#F2EDE3] placeholder:text-[#F2EDE3]/30 transition-colors" />
                  </div>
                  {pwMsg && <div className={`text-xs mt-2 ${pwMsg.ok ? "text-[#D8FF3D]" : "text-[#FF4D2E]"}`}>{pwMsg.text}</div>}
                  <button onClick={changePassword} disabled={pwSaving} className="mt-3 px-4 py-2 bg-[#D8FF3D] hover:bg-[#F2EDE3] text-[#0B0B0B] km-mono-eyebrow disabled:opacity-50 transition-colors">{pwSaving ? t.saving : t.changePasswordBtn}</button>
                </div>

                {/* Zmiana emaila */}
                <div className="bg-[#0E0E0E] p-6 border border-[rgba(242,237,227,0.10)]">
                  <div className="km-mono-eyebrow text-[#D8FF3D] mb-4">{t.changeEmail}</div>
                  <div className="space-y-2">
                    <input type="email" value={emNew} onChange={(e) => setEmNew(e.target.value)} placeholder={t.newEmail} autoComplete="email" className="w-full px-3 py-2.5 bg-[#0B0B0B] border border-[rgba(242,237,227,0.15)] focus:outline-none focus:border-[#D8FF3D] text-sm text-[#F2EDE3] placeholder:text-[#F2EDE3]/30 transition-colors" />
                    <input type="password" value={emPassword} onChange={(e) => setEmPassword(e.target.value)} placeholder={t.confirmWithPassword} autoComplete="current-password" className="w-full px-3 py-2.5 bg-[#0B0B0B] border border-[rgba(242,237,227,0.15)] focus:outline-none focus:border-[#D8FF3D] text-sm text-[#F2EDE3] placeholder:text-[#F2EDE3]/30 transition-colors" />
                  </div>
                  {emMsg && <div className={`text-xs mt-2 ${emMsg.ok ? "text-[#D8FF3D]" : "text-[#FF4D2E]"}`}>{emMsg.text}</div>}
                  <button onClick={changeEmail} disabled={emSaving} className="mt-3 px-4 py-2 bg-[#D8FF3D] hover:bg-[#F2EDE3] text-[#0B0B0B] km-mono-eyebrow disabled:opacity-50 transition-colors">{emSaving ? t.saving : t.changeEmailBtn}</button>
                  <p className="text-xs text-[#F2EDE3]/40 mt-2">{t.emailChangeNote}</p>
                </div>

                {/* Newsletter / zgoda marketingowa */}
                <div className="bg-[#0E0E0E] p-6 border border-[rgba(242,237,227,0.10)]">
                  <div className="km-mono-eyebrow text-[#D8FF3D] mb-3">{t.newsletterTitle}</div>
                  <p className="text-sm text-[#F2EDE3]/55 mb-4 leading-relaxed">{t.newsletterDesc}</p>
                  {nlConsent === null && nlError && !nlLoading ? (
                    <button
                      onClick={() => void loadNewsletter()}
                      className="px-4 py-2 km-mono-eyebrow border border-[rgba(242,237,227,0.20)] text-[#F2EDE3]/80 hover:border-[#D8FF3D] hover:text-[#D8FF3D] transition-colors"
                    >
                      {t.retry}
                    </button>
                  ) : (
                    <button
                      onClick={toggleNewsletter}
                      disabled={nlSaving || nlConsent === null}
                      className={`px-4 py-2 km-mono-eyebrow transition-colors disabled:opacity-50 ${
                        nlConsent
                          ? "border border-[#D8FF3D]/50 text-[#D8FF3D] hover:border-[#FF4D2E] hover:text-[#FF4D2E]"
                          : "bg-[#D8FF3D] hover:bg-[#F2EDE3] text-[#0B0B0B]"
                      }`}
                    >
                      {nlConsent === null ? "…" : nlConsent ? t.newsletterOn : t.newsletterOff}
                    </button>
                  )}
                  {nlError && <div role="alert" className="text-xs mt-2 text-[#FF4D2E]">{nlError}</div>}
                </div>

                {/* Twoje dane: eksport (RODO art. 20) + usunięcie konta */}
                <div className="bg-[#0E0E0E] p-6 border border-[rgba(242,237,227,0.10)]">
                  <div className="km-mono-eyebrow text-[#D8FF3D] mb-3">{t.dataHeading}</div>
                  <p className="text-sm text-[#F2EDE3]/55 mb-3 leading-relaxed">{t.exportDataDesc}</p>
                  <button
                    onClick={exportData}
                    disabled={exporting}
                    className="px-4 py-2 border border-[rgba(242,237,227,0.20)] hover:border-[#D8FF3D] text-[#F2EDE3]/80 hover:text-[#D8FF3D] km-mono-eyebrow transition-colors disabled:opacity-50"
                  >
                    {exporting ? t.exporting : t.exportData}
                  </button>
                  {exportMsg && <div role="alert" className="text-xs mt-2 text-[#FF4D2E]">{exportMsg}</div>}

                  <div className="mt-6 pt-5 border-t border-[rgba(242,237,227,0.10)]">
                    {!showDelete ? (
                      <button
                        onClick={() => { setShowDelete(true); setDelMsg(null); }}
                        className="px-4 py-2 border border-[#FF4D2E]/40 text-[#FF4D2E] hover:bg-[#FF4D2E]/10 km-mono-eyebrow transition-colors"
                      >
                        {t.deleteAccount}
                      </button>
                    ) : (
                      <div className="border border-[#FF4D2E]/40 bg-[#FF4D2E]/[0.04] p-4">
                        <p className="km-mono-eyebrow text-[#FF4D2E] mb-2">{t.deleteAccount}</p>
                        <p className="text-sm text-[#F2EDE3]/70 mb-3 leading-relaxed">{t.deleteAccountDesc}</p>
                        <div className="space-y-2">
                          <input
                            type="password"
                            value={delPassword}
                            onChange={(e) => setDelPassword(e.target.value)}
                            placeholder={t.deletePasswordPlaceholder}
                            autoComplete="current-password"
                            className="w-full px-3 py-2.5 bg-[#0B0B0B] border border-[rgba(242,237,227,0.15)] focus:outline-none focus:border-[#FF4D2E] text-sm text-[#F2EDE3] placeholder:text-[#F2EDE3]/30 transition-colors"
                          />
                          <p className="text-xs text-[#F2EDE3]/45">{t.deleteGoogleHint(DELETE_PHRASE)}</p>
                          <input
                            type="text"
                            value={delPhrase}
                            onChange={(e) => setDelPhrase(e.target.value)}
                            placeholder={DELETE_PHRASE}
                            autoComplete="off"
                            className="w-full px-3 py-2.5 bg-[#0B0B0B] border border-[rgba(242,237,227,0.15)] focus:outline-none focus:border-[#FF4D2E] text-sm font-mono text-[#F2EDE3] placeholder:text-[#F2EDE3]/20 transition-colors"
                          />
                        </div>
                        {delMsg && <div role="alert" className="text-xs mt-2 text-[#FF4D2E]">{delMsg}</div>}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={deleteAccount}
                            disabled={deleting}
                            className="px-4 py-2 bg-[#FF4D2E] hover:bg-[#FF4D2E]/85 text-[#0B0B0B] km-mono-eyebrow disabled:opacity-50 transition-colors"
                          >
                            {deleting ? t.deleting : t.deleteAccountBtn}
                          </button>
                          <button
                            onClick={() => { setShowDelete(false); setDelPassword(""); setDelPhrase(""); setDelMsg(null); }}
                            disabled={deleting}
                            className="px-4 py-2 border border-[rgba(242,237,227,0.20)] text-[#F2EDE3]/80 hover:text-[#F2EDE3] km-mono-eyebrow transition-colors disabled:opacity-50"
                          >
                            {t.cancel}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Wyloguj */}
                <div className="bg-[#0E0E0E] p-6 border border-[rgba(242,237,227,0.10)]">
                  <div className="km-mono-eyebrow text-[#D8FF3D] mb-3">{t.session}</div>
                  <button onClick={() => signOut({ callbackUrl: "/" })} className="px-4 py-2 border border-[rgba(242,237,227,0.20)] hover:border-[#FF4D2E] text-[#F2EDE3]/80 hover:text-[#FF4D2E] km-mono-eyebrow transition-colors">{t.logoutLong}</button>
                </div>
              </div>
            </div>
          )}

        </>
      </div>
    </div>
  );
}
