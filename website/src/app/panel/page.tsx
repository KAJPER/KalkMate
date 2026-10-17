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

const DATE_LOCALE: Record<Locale, string> = { pl: "pl-PL", en: "en-GB", de: "de-DE" };

const TAB_IDS = ["orders", "chat", "subscription", "ai", "calculator", "notes", "tests", "settings"] as const;
type TabId = (typeof TAB_IDS)[number];
const CALC_TABS: readonly TabId[] = ["calculator", "notes", "tests", "subscription"];

// Dane zakładki uznajemy za świeże przez 60 s — powrót do zakładki nie odpala
// ponownie wszystkich zapytań (słabe telefony / mobilny internet).
const FRESH_MS = 60_000;
// Pakiet startowy przy rejestracji — tylko punkt odniesienia dla paska salda.
const TOKEN_REFERENCE = 1_000_000;
const CAPTURES_PAGE = 24;

type ChatAttachment = { filename: string; mimeType: string; fileSize: number; data: string };
type ChatMessage = { role: string; content: string; attachments?: ChatAttachment[] };
type ReturnNotice = "tokens_success" | "tokens_cancelled" | "sub_success" | "sub_cancelled";

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
  tabsSubscription: string;
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
  chatNoSubscription: string;
  chatTooLarge: string;
  chatOnlyImages: string;
  chatTooMany: string;
  chatUpstream: string;
  chatReadFailed: string;
  convLoadFailed: string;
  convDeleteFailed: string;
  goBuyTokens: string;
  goSubscription: string;
  dismiss: string;
  imgProcessing: string;
  imgTooMany: (max: number) => string;
  imgDecodeFailed: (name: string) => string;
  imgTooLarge: (name: string) => string;
  returnTokensSuccess: string;
  returnTokensCancelled: string;
  returnSubSuccess: string;
  returnSubCancelled: string;
  loadFailed: string;
  retry: string;
  loadMore: string;
  licenseRedeemed: string;
  subCreateFailed: string;
  enterLicenseCode: string;
  licenseRedeemFailed: string;
  licenseRedeemError: string;
  confirmCancelSub: string;
  subCancelled: string;
  subCancelFailed: string;
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
  // subscription
  subHeading: string;
  subSubtitle: string;
  status: string;
  statusTrial: string;
  statusActive: string;
  statusInactive: string;
  assignedLicense: string;
  daysWord: (n: number) => string;
  activatedOn: (d: string) => string;
  notActivated: string;
  unpinning: string;
  unpin: string;
  haveLicenseCode: string;
  enterCodeToExtend: string;
  licenseCodePlaceholder: string;
  redeeming: string;
  redeem: string;
  trialPeriod: (n: number) => string;
  extraTrialDays: string;
  trialEnds: (d: string) => string;
  trialExpiredOwner: string;
  trialExpired: string;
  choosePlan: string;
  promo98: string;
  secondMonth: string;
  loadingBtn: string;
  choose1zl: string;
  fixedPrice: string;
  nextMonths: string;
  choose15zl: string;
  securePayment: string;
  ownerCanUseChat: string;
  paidSubActive: string;
  feeLine: string;
  perMonthFee: string;
  savesYou: string;
  renewsOn: (d: string) => string;
  cancelSub: string;
  // ai tab
  tokenUsage: string;
  effectiveTokens: string;
  remaining: string;
  aiLoadFailed: string;
  tasksLeftLabel: string;
  maturaTasks: string;
  monthlyLimit: string;
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
    tabsSubscription: "Subskrypcja",
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
    chatNoTokens: "Skończyły się tokeny AI. Doładuj saldo, aby kontynuować.",
    chatNoSubscription: "Brak aktywnej subskrypcji AI Chat.",
    chatTooLarge: "Zdjęcie jest za duże. Usuń je lub dołącz mniejsze (maks. 4 zdjęcia).",
    chatOnlyImages: "Można dołączać tylko zdjęcia (JPG, PNG, WebP).",
    chatTooMany: "Za dużo zapytań. Poczekaj chwilę i spróbuj ponownie.",
    chatUpstream: "Serwer AI chwilowo nie odpowiada. Twoja wiadomość wróciła do pola — spróbuj ponownie za chwilę.",
    chatReadFailed: "Nie udało się odczytać załączonego zdjęcia.",
    convLoadFailed: "Nie udało się wczytać konwersacji.",
    convDeleteFailed: "Nie udało się usunąć konwersacji.",
    goBuyTokens: "Kup tokeny →",
    goSubscription: "Subskrypcja →",
    dismiss: "Zamknij",
    imgProcessing: "Zmniejszam zdjęcie…",
    imgTooMany: (m) => `Maks. ${m} zdjęcia na wiadomość.`,
    imgDecodeFailed: (n) => `Nie udało się odczytać zdjęcia „${n}”.`,
    imgTooLarge: (n) => `Zdjęcie „${n}” jest za duże nawet po zmniejszeniu.`,
    returnTokensSuccess: "Płatność przyjęta — tokeny pojawią się na koncie w ciągu kilku chwil.",
    returnTokensCancelled: "Płatność za tokeny została anulowana.",
    returnSubSuccess: "Płatność przyjęta — subskrypcja zostanie aktywowana w ciągu kilku chwil.",
    returnSubCancelled: "Płatność za subskrypcję została anulowana.",
    loadFailed: "Nie udało się wczytać danych.",
    retry: "Spróbuj ponownie",
    loadMore: "Pokaż więcej",
    licenseRedeemed: "Licencja została zrealizowana.",
    subCreateFailed: "Nie udało się utworzyć subskrypcji. Spróbuj ponownie.",
    enterLicenseCode: "Wprowadź kod licencji",
    licenseRedeemFailed: "Nie udało się zrealizować licencji",
    licenseRedeemError: "Wystąpił błąd podczas realizacji licencji",
    confirmCancelSub: "Czy na pewno chcesz anulować subskrypcję?",
    subCancelled: "Subskrypcja została anulowana.",
    subCancelFailed: "Nie udało się anulować subskrypcji.",
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
    subHeading: "Subskrypcja AI Chat",
    subSubtitle: "Zarządzaj dostępem do AI Chat",
    status: "Status",
    statusTrial: "🎁 Okres próbny",
    statusActive: "✓ Aktywna",
    statusInactive: "✗ Nieaktywna",
    assignedLicense: "Przypisana licencja",
    daysWord: (n) => `${n} dni`,
    activatedOn: (d) => ` · aktywowana ${d}`,
    notActivated: " · nieaktywowana",
    unpinning: "Odpinanie...",
    unpin: "Odepnij",
    haveLicenseCode: "Masz kod licencji?",
    enterCodeToExtend: "Wprowadź kod, aby przedłużyć dostęp do AI Chat",
    licenseCodePlaceholder: "abcd123-+=%abcd",
    redeeming: "Realizuję...",
    redeem: "Realizuj",
    trialPeriod: (n) => `Okres próbny: ${n} dni pozostało`,
    extraTrialDays: "✨ Dodatkowe 30 dni za zakup kalkulatora!",
    trialEnds: (d) => `Kończy się: ${d}`,
    trialExpiredOwner: "Twój okres próbny wygasł. Możesz kontynuować korzystanie z AI Chat aktywując subskrypcję.",
    trialExpired: "Twój okres próbny wygasł. Aktywuj subskrypcję, aby kontynuować korzystanie z AI Chat.",
    choosePlan: "Wybierz plan subskrypcji",
    promo98: "🔥 Promocja -98%",
    secondMonth: "Drugi miesiąc",
    loadingBtn: "Ładowanie...",
    choose1zl: "Wybierz 1 zł",
    fixedPrice: "💎 Stała cena",
    nextMonths: "Kolejne miesiące",
    choose15zl: "Wybierz 15 zł",
    securePayment: "💳 Bezpieczna płatność przez Stripe • Anuluj w każdej chwili",
    ownerCanUseChat: "💡 Jako właściciel kalkulatora możesz korzystać z AI Chat przez subskrypcję. To opcjonalne - kalkulator działa niezależnie.",
    paidSubActive: "✓ Płatna subskrypcja aktywna",
    feeLine: "Opłata:",
    perMonthFee: "15 zł/miesiąc",
    savesYou: "(oszczędzasz 67%)",
    renewsOn: (d) => `Odnawia się: ${d}`,
    cancelSub: "Anuluj subskrypcję",
    tokenUsage: "/ Saldo tokenów",
    effectiveTokens: "efektywnych tokenów na koncie",
    remaining: "POZOSTAŁO",
    aiLoadFailed: "Nie udało się wczytać ustawień AI i salda tokenów.",
    tasksLeftLabel: "Zadań zostało",
    maturaTasks: "zadań",
    monthlyLimit: "Na 1 mln tokenów",
    forModel: (m) => `dla modelu ${m}`,
    defaultModel: "domyślnego",
    modelPerformance: "WYDAJNOŚĆ MODELI — ile zadań z 1 mln tokenów",
    tasksAbbr: "zad.",
    tokenEstimateNote: "Szacunek dla typowego zadania (~800 realnych tokenów wejście + odpowiedź). Tokeny odnawiają się razem z subskrypcją.",
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
    pairIntro2: " z kalkulatora (Settings → Device ID + QR) oraz ",
    pairIntro3: " (Settings → Kod AI).",
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
    tabsSubscription: "Subscription",
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
    chatNoTokens: "You are out of AI tokens. Top up your balance to continue.",
    chatNoSubscription: "No active AI Chat subscription.",
    chatTooLarge: "The image is too large. Remove it or attach a smaller one (max 4 images).",
    chatOnlyImages: "Only images can be attached (JPG, PNG, WebP).",
    chatTooMany: "Too many requests. Wait a moment and try again.",
    chatUpstream: "The AI server is not responding right now. Your message is back in the input — try again shortly.",
    chatReadFailed: "Could not read the attached image.",
    convLoadFailed: "Could not load the conversation.",
    convDeleteFailed: "Could not delete the conversation.",
    goBuyTokens: "Buy tokens →",
    goSubscription: "Subscription →",
    dismiss: "Close",
    imgProcessing: "Resizing image…",
    imgTooMany: (m) => `Max ${m} images per message.`,
    imgDecodeFailed: (n) => `Could not read image "${n}".`,
    imgTooLarge: (n) => `Image "${n}" is too large even after resizing.`,
    returnTokensSuccess: "Payment received — tokens will appear in your account within a few moments.",
    returnTokensCancelled: "The token payment was cancelled.",
    returnSubSuccess: "Payment received — your subscription will be activated within a few moments.",
    returnSubCancelled: "The subscription payment was cancelled.",
    loadFailed: "Could not load data.",
    retry: "Try again",
    loadMore: "Show more",
    licenseRedeemed: "The license has been redeemed.",
    subCreateFailed: "Could not create subscription. Please try again.",
    enterLicenseCode: "Enter a license code",
    licenseRedeemFailed: "Could not redeem the license",
    licenseRedeemError: "An error occurred while redeeming the license",
    confirmCancelSub: "Are you sure you want to cancel the subscription?",
    subCancelled: "Subscription has been cancelled.",
    subCancelFailed: "Could not cancel the subscription.",
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
    subHeading: "AI Chat subscription",
    subSubtitle: "Manage access to AI Chat",
    status: "Status",
    statusTrial: "🎁 Trial period",
    statusActive: "✓ Active",
    statusInactive: "✗ Inactive",
    assignedLicense: "Assigned license",
    daysWord: (n) => `${n} days`,
    activatedOn: (d) => ` · activated ${d}`,
    notActivated: " · not activated",
    unpinning: "Unpinning...",
    unpin: "Unpin",
    haveLicenseCode: "Have a license code?",
    enterCodeToExtend: "Enter a code to extend your AI Chat access",
    licenseCodePlaceholder: "abcd123-+=%abcd",
    redeeming: "Redeeming...",
    redeem: "Redeem",
    trialPeriod: (n) => `Trial period: ${n} days remaining`,
    extraTrialDays: "✨ Extra 30 days for purchasing the calculator!",
    trialEnds: (d) => `Ends on: ${d}`,
    trialExpiredOwner: "Your trial period has expired. You can keep using AI Chat by activating a subscription.",
    trialExpired: "Your trial period has expired. Activate a subscription to keep using AI Chat.",
    choosePlan: "Choose a subscription plan",
    promo98: "🔥 Promo -98%",
    secondMonth: "Second month",
    loadingBtn: "Loading...",
    choose1zl: "Choose 1 zł",
    fixedPrice: "💎 Fixed price",
    nextMonths: "Following months",
    choose15zl: "Choose 15 zł",
    securePayment: "💳 Secure payment via Stripe • Cancel anytime",
    ownerCanUseChat: "💡 As a calculator owner you can use AI Chat via subscription. It's optional - the calculator works independently.",
    paidSubActive: "✓ Paid subscription active",
    feeLine: "Fee:",
    perMonthFee: "15 zł/month",
    savesYou: "(you save 67%)",
    renewsOn: (d) => `Renews on: ${d}`,
    cancelSub: "Cancel subscription",
    tokenUsage: "/ Token balance",
    effectiveTokens: "effective tokens in your account",
    remaining: "REMAINING",
    aiLoadFailed: "Could not load AI settings and token balance.",
    tasksLeftLabel: "Tasks left",
    maturaTasks: "exam problems",
    monthlyLimit: "Per 1M tokens",
    forModel: (m) => `for model ${m}`,
    defaultModel: "default",
    modelPerformance: "MODEL EFFICIENCY — tasks per 1M tokens",
    tasksAbbr: "tasks",
    tokenEstimateNote: "Estimate for a typical exam problem (~800 real tokens input + answer). Tokens renew with your subscription.",
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
    pairIntro2: " from the calculator (Settings → Device ID + QR) and the ",
    pairIntro3: " (Settings → AI code).",
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
    tabsSubscription: "Abonnement",
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
    chatNoTokens: "Deine AI-Tokens sind aufgebraucht. Lade dein Guthaben auf, um fortzufahren.",
    chatNoSubscription: "Kein aktives AI-Chat-Abonnement.",
    chatTooLarge: "Das Bild ist zu groß. Entferne es oder hänge ein kleineres an (max. 4 Bilder).",
    chatOnlyImages: "Es können nur Bilder angehängt werden (JPG, PNG, WebP).",
    chatTooMany: "Zu viele Anfragen. Warte kurz und versuche es erneut.",
    chatUpstream: "Der AI-Server antwortet gerade nicht. Deine Nachricht ist wieder im Eingabefeld — versuche es gleich erneut.",
    chatReadFailed: "Das angehängte Bild konnte nicht gelesen werden.",
    convLoadFailed: "Die Unterhaltung konnte nicht geladen werden.",
    convDeleteFailed: "Die Unterhaltung konnte nicht gelöscht werden.",
    goBuyTokens: "Tokens kaufen →",
    goSubscription: "Abonnement →",
    dismiss: "Schließen",
    imgProcessing: "Bild wird verkleinert…",
    imgTooMany: (m) => `Max. ${m} Bilder pro Nachricht.`,
    imgDecodeFailed: (n) => `Bild „${n}“ konnte nicht gelesen werden.`,
    imgTooLarge: (n) => `Bild „${n}“ ist auch nach dem Verkleinern zu groß.`,
    returnTokensSuccess: "Zahlung erhalten — die Tokens erscheinen in wenigen Augenblicken auf deinem Konto.",
    returnTokensCancelled: "Die Token-Zahlung wurde abgebrochen.",
    returnSubSuccess: "Zahlung erhalten — dein Abonnement wird in wenigen Augenblicken aktiviert.",
    returnSubCancelled: "Die Abonnement-Zahlung wurde abgebrochen.",
    loadFailed: "Daten konnten nicht geladen werden.",
    retry: "Erneut versuchen",
    loadMore: "Mehr anzeigen",
    licenseRedeemed: "Die Lizenz wurde eingelöst.",
    subCreateFailed: "Abonnement konnte nicht erstellt werden. Bitte versuche es erneut.",
    enterLicenseCode: "Lizenzcode eingeben",
    licenseRedeemFailed: "Lizenz konnte nicht eingelöst werden",
    licenseRedeemError: "Beim Einlösen der Lizenz ist ein Fehler aufgetreten",
    confirmCancelSub: "Möchtest du das Abonnement wirklich kündigen?",
    subCancelled: "Abonnement wurde gekündigt.",
    subCancelFailed: "Abonnement konnte nicht gekündigt werden.",
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
    subHeading: "AI-Chat-Abonnement",
    subSubtitle: "Zugang zum AI Chat verwalten",
    status: "Status",
    statusTrial: "🎁 Testzeitraum",
    statusActive: "✓ Aktiv",
    statusInactive: "✗ Inaktiv",
    assignedLicense: "Zugewiesene Lizenz",
    daysWord: (n) => `${n} Tage`,
    activatedOn: (d) => ` · aktiviert ${d}`,
    notActivated: " · nicht aktiviert",
    unpinning: "Wird entkoppelt...",
    unpin: "Entkoppeln",
    haveLicenseCode: "Hast du einen Lizenzcode?",
    enterCodeToExtend: "Gib einen Code ein, um deinen AI-Chat-Zugang zu verlängern",
    licenseCodePlaceholder: "abcd123-+=%abcd",
    redeeming: "Wird eingelöst...",
    redeem: "Einlösen",
    trialPeriod: (n) => `Testzeitraum: ${n} Tage übrig`,
    extraTrialDays: "✨ Zusätzliche 30 Tage für den Kauf des Rechners!",
    trialEnds: (d) => `Endet am: ${d}`,
    trialExpiredOwner: "Dein Testzeitraum ist abgelaufen. Du kannst den AI Chat durch Aktivieren eines Abonnements weiter nutzen.",
    trialExpired: "Dein Testzeitraum ist abgelaufen. Aktiviere ein Abonnement, um den AI Chat weiter zu nutzen.",
    choosePlan: "Wähle einen Abonnementplan",
    promo98: "🔥 Aktion -98%",
    secondMonth: "Zweiter Monat",
    loadingBtn: "Lädt...",
    choose1zl: "1 zł wählen",
    fixedPrice: "💎 Festpreis",
    nextMonths: "Folgende Monate",
    choose15zl: "15 zł wählen",
    securePayment: "💳 Sichere Zahlung über Stripe • Jederzeit kündbar",
    ownerCanUseChat: "💡 Als Rechnerbesitzer kannst du den AI Chat per Abonnement nutzen. Das ist optional - der Rechner funktioniert unabhängig.",
    paidSubActive: "✓ Bezahltes Abonnement aktiv",
    feeLine: "Gebühr:",
    perMonthFee: "15 zł/Monat",
    savesYou: "(du sparst 67%)",
    renewsOn: (d) => `Verlängert sich am: ${d}`,
    cancelSub: "Abonnement kündigen",
    tokenUsage: "/ Token-Guthaben",
    effectiveTokens: "effektive Tokens auf deinem Konto",
    remaining: "VERBLEIBEND",
    aiLoadFailed: "AI-Einstellungen und Token-Guthaben konnten nicht geladen werden.",
    tasksLeftLabel: "Aufgaben übrig",
    maturaTasks: "Prüfungsaufgaben",
    monthlyLimit: "Pro 1 Mio. Tokens",
    forModel: (m) => `für Modell ${m}`,
    defaultModel: "Standard",
    modelPerformance: "MODELLEFFIZIENZ — Aufgaben pro 1 Mio. Tokens",
    tasksAbbr: "Aufg.",
    tokenEstimateNote: "Schätzung für eine typische Prüfungsaufgabe (~800 echte Tokens Eingabe + Antwort). Tokens werden mit dem Abonnement erneuert.",
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
    pairIntro2: " vom Rechner (Settings → Device ID + QR) sowie den ",
    pairIntro3: " (Settings → AI-Code) ein.",
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
  const [isLoading, setIsLoading] = useState(false);
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
  const [chatError, setChatError] = useState<{ text: string; action?: "ai" | "subscription" } | null>(null);
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

  // Subscription state
  const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null);
  const [subLoadError, setSubLoadError] = useState<string | null>(null);

  // License state
  const [licenseCode, setLicenseCode] = useState("");
  const [redeemingLicense, setRedeemingLicense] = useState(false);

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
  // null = jeszcze nie wczytane (nie pokazujemy fikcyjnego 1M przed odpowiedzią API)
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [buyingPack, setBuyingPack] = useState<string | null>(null);
  const [buyCurrency, setBuyCurrency] = useState<"pln" | "eur">("pln");

  // Powrót przyciskiem "wstecz" z bramki płatności (bfcache) — odblokuj przyciski.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setBuyingPack(null);
        setIsLoading(false);
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

  // Dane zakładek Kalkulator / Notatki / Sprawdziany / Subskrypcja (licencja).
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

  // ?tab=<id> oraz powrót z płatności (?tokens=success, ?subscription=success…)
  // → właściwa zakładka + potwierdzenie; parametry usuwamy z paska adresu.
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
    else if (sub === "success") { tab = "subscription"; notice = "sub_success"; }
    else if (sub === "cancelled") { tab = "subscription"; notice = "sub_cancelled"; }
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
  // saldo / status subskrypcji jeszcze raz.
  useEffect(() => {
    if (!authed || (returnNotice !== "tokens_success" && returnNotice !== "sub_success")) return;
    const timers = [3000, 10000].map((ms) =>
      setTimeout(() => {
        if (returnNotice === "tokens_success") void loadAiSettings();
        else void fetchSubscriptionStatus();
      }, ms)
    );
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

  // Fetch subscription status
  useEffect(() => {
    if (!authed || activeTab !== "subscription" || isFresh("sub")) return;
    const ac = new AbortController();
    void fetchSubscriptionStatus(ac.signal);
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, activeTab]);

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

  const fetchSubscriptionStatus = async (signal?: AbortSignal) => {
    const r = await fetchJson("/api/subscription/status", { cache: "no-store", signal });
    if (r.aborted) return;
    if (!r.ok) {
      setSubLoadError(errText(r, t.loadFailed));
      return;
    }
    setSubLoadError(null);
    setSubscriptionStatus(r.data);
    markFetched("sub");
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

  const chatErrorFrom = (r: FetchJsonResult): { text: string; action?: "ai" | "subscription" } => {
    switch (r.status) {
      case 0: return { text: t.errNetwork };
      case 401: return { text: t.sessionExpired };
      case 402: return { text: t.chatNoTokens, action: "ai" };
      case 403: return { text: t.chatNoSubscription, action: "subscription" };
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
    const fail = (err: { text: string; action?: "ai" | "subscription" }) => {
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

  const handleSubscribe = async (plan: "second_month" | "regular") => {
    if (isLoading) return;
    setIsLoading(true);
    const r = await sendJson("/api/subscription/purchase", "POST", { plan });
    const url = r.ok && typeof r.data?.url === "string" ? (r.data.url as string) : null;
    if (url) {
      // Bez resetu isLoading — przyciski zostają zablokowane do przekierowania.
      window.location.href = url;
      return;
    }
    alert(errText(r, t.subCreateFailed));
    setIsLoading(false);
  };

  const handleRedeemLicense = async () => {
    if (!licenseCode.trim()) {
      alert(t.enterLicenseCode);
      return;
    }
    if (redeemingLicense) return;
    setRedeemingLicense(true);
    try {
      const r = await sendJson("/api/subscription/redeem", "POST", { licenseCode: licenseCode.trim() });
      if (!r.ok) {
        alert(r.status === 0 || (r.notJson && r.status !== 401) ? t.licenseRedeemError : errText(r, t.licenseRedeemFailed));
        return;
      }
      alert(typeof r.data?.message === "string" && r.data.message ? r.data.message : t.licenseRedeemed);
      setLicenseCode("");
      void fetchSubscriptionStatus();
      void loadCalcData({ force: true });
    } finally {
      setRedeemingLicense(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (isLoading) return;
    if (!confirm(t.confirmCancelSub)) return;

    setIsLoading(true);
    try {
      const r = await fetchJson("/api/subscription/cancel", { method: "POST" });
      if (!r.ok) {
        alert(errText(r, t.subCancelFailed));
        return;
      }
      alert(t.subCancelled);
      void fetchSubscriptionStatus();
    } finally {
      setIsLoading(false);
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
    { id: "subscription" as const, n: "03", label: t.tabsSubscription },
    { id: "ai" as const, n: "04", label: t.tabsAi },
    { id: "calculator" as const, n: "05", label: t.tabsCalculator },
    { id: "notes" as const, n: "06", label: t.tabsNotes },
    { id: "tests" as const, n: "07", label: t.tabsTests },
    { id: "settings" as const, n: "08", label: t.tabsSettings },
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
              {returnNotice === "tokens_success"
                ? t.returnTokensSuccess
                : returnNotice === "tokens_cancelled"
                ? t.returnTokensCancelled
                : returnNotice === "sub_success"
                ? t.returnSubSuccess
                : t.returnSubCancelled}
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
                        onClick={() => setActiveTab(chatError.action === "ai" ? "ai" : "subscription")}
                        className="mt-1.5 km-mono-eyebrow text-[#D8FF3D] hover:underline"
                      >
                        {chatError.action === "ai" ? t.goBuyTokens : t.goSubscription}
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

          {activeTab === "subscription" && (
            <div
              key="subscription"
              className="km-panel-fade"
            >
              <div className="bg-[#0E0E0E] p-4 sm:p-8 border border-[rgba(242,237,227,0.10)]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12  bg-[#D8FF3D]/10 bg-[#D8FF3D]/10 flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#D8FF3D]">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-[#F2EDE3]">
                      {t.subHeading}
                    </h2>
                    <p className="text-sm text-[#F2EDE3]/60">
                      {t.subSubtitle}
                    </p>
                  </div>
                </div>

                {subscriptionStatus ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 p-4 bg-[#141414] ">
                      <div className={`w-4 h-4 rounded-full ${subscriptionStatus.canUseChat ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
                      <span className="text-lg font-bold text-[#F2EDE3]">
                        {t.status}: {subscriptionStatus.status === "trial" ? t.statusTrial : subscriptionStatus.status === "active" ? t.statusActive : t.statusInactive}
                      </span>
                    </div>

                    {/* Aktualnie przypisana licencja */}
                    {calcInfo?.claimed && calcInfo?.license?.code && (
                      <div className="flex items-center justify-between p-4 bg-[#141414] ">
                        <div>
                          <div className="text-xs text-[#F2EDE3]/60 mb-1">
                            {t.assignedLicense}
                          </div>
                          <div className="font-mono text-sm text-[#F2EDE3]">
                            {calcInfo.license.code}
                          </div>
                          <div className="text-xs text-[#F2EDE3]/60 mt-1">
                            {t.daysWord(calcInfo.license.durationDays)}
                            {calcInfo.license.activatedAt
                              ? t.activatedOn(new Date(calcInfo.license.activatedAt).toLocaleDateString(DATE_LOCALE[lang]))
                              : t.notActivated}
                          </div>
                        </div>
                        <button
                          onClick={calcUnclaim}
                          disabled={unclaiming}
                          className="text-xs px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400  disabled:opacity-50"
                        >
                          {unclaiming ? t.unpinning : t.unpin}
                        </button>
                      </div>
                    )}

                    {/* License Redemption */}
                    <div className=" from-purple-50 to-blue-50 dark:from-purple-500/10 dark:to-blue-500/10 border border-purple-200 dark:border-purple-500/20  p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10   from-purple-500 to-blue-500 flex items-center justify-center">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-bold text-[#F2EDE3]">
                            {t.haveLicenseCode}
                          </h3>
                          <p className="text-xs text-[#F2EDE3]/60">
                            {t.enterCodeToExtend}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="text"
                          value={licenseCode}
                          onChange={(e) => setLicenseCode(e.target.value)}
                          placeholder={t.licenseCodePlaceholder}
                          className="flex-1 bg-[#0E0E0E] border border-purple-200 dark:border-purple-500/20  px-4 py-3 text-sm text-[#F2EDE3] placeholder:text-[#F2EDE3]/40 placeholder:text-[#F2EDE3]/40 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                          disabled={redeemingLicense}
                        />
                        <button
                          onClick={handleRedeemLicense}
                          disabled={!licenseCode.trim() || redeemingLicense}
                          className="px-6 py-3  from-purple-500 to-blue-500 text-white font-medium   transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {redeemingLicense ? t.redeeming : t.redeem}
                        </button>
                      </div>
                    </div>

                    {subscriptionStatus.isTrialActive && (
                      <div className=" from-blue-50 to-blue-100 dark:from-blue-500/10 dark:to-blue-600/10 border border-blue-200 dark:border-blue-500/20  p-6">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12  bg-blue-500 flex items-center justify-center shrink-0">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6M12 2v10M16 7l-4-4-4 4" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <p className="text-lg font-bold text-blue-900 dark:text-blue-200 mb-2">
                              {t.trialPeriod(subscriptionStatus.daysRemaining)}
                            </p>
                            {subscriptionStatus.hasPurchasedCalculator && subscriptionStatus.trialDays === 30 && (
                              <p className="text-sm text-blue-700 dark:text-blue-300">
                                {t.extraTrialDays}
                              </p>
                            )}
                            <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
                              {t.trialEnds(new Date(subscriptionStatus.trialEndsAt).toLocaleDateString(DATE_LOCALE[lang], {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              }))}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {!subscriptionStatus.hasActiveSubscription && !subscriptionStatus.isTrialActive && (
                      <div>
                        <p className="text-sm text-[#F2EDE3]/60 mb-6">
                          {subscriptionStatus.hasPurchasedCalculator ? (
                            <>{t.trialExpiredOwner}</>
                          ) : (
                            <>{t.trialExpired}</>
                          )}
                        </p>

                        {/* Pricing Plans */}
                        <div className=" from-[#D8FF3D]/5 to-[#D8FF3D]/5 dark:from-[#D8FF3D]/10 dark:to-[#D8FF3D]/10  p-6 mb-6">
                          <h3 className="text-lg font-bold text-[#F2EDE3] mb-4 text-center">
                            {t.choosePlan}
                          </h3>

                          <div className="grid md:grid-cols-2 gap-4 mb-4">
                            {/* Second Month Plan - 1 zł */}
                            <div className="bg-[#0E0E0E]  p-5 border-2 border-[#D8FF3D] relative">
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1  from-[#D8FF3D] to-[#D8FF3D] text-[#0B0B0B] text-xs font-bold rounded-full">
                                {t.promo98}
                              </div>
                              <div className="text-center mt-2 mb-4">
                                <div className="text-3xl font-bold text-[#D8FF3D] mb-1">
                                  1 zł
                                </div>
                                <div className="text-xs text-[#F2EDE3]/40 line-through">
                                  44,99 zł
                                </div>
                                <div className="text-sm text-[#F2EDE3]/60 mt-1">
                                  {t.secondMonth}
                                </div>
                              </div>
                              <button
                                onClick={() => handleSubscribe("second_month")}
                                disabled={isLoading}
                                className="w-full  from-[#D8FF3D] to-[#D8FF3D] text-[#0B0B0B] px-4 py-3   transition-all duration-300 disabled:opacity-50 font-bold text-sm"
                              >
                                {isLoading ? t.loadingBtn : t.choose1zl}
                              </button>
                            </div>

                            {/* Regular Plan - 15 zł */}
                            <div className="relative bg-[#0E0E0E]  p-5 border-2 border-[rgba(242,237,227,0.15)]">
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#D8FF3D] text-[#0B0B0B] km-mono-eyebrow">
                                {t.fixedPrice}
                              </div>
                              <div className="text-center mt-2 mb-4">
                                <div className="text-3xl font-bold text-[#F2EDE3] mb-1">
                                  15 zł
                                </div>
                                <div className="text-xs text-[#F2EDE3]/40 line-through">
                                  44,99 zł
                                </div>
                                <div className="text-sm text-[#F2EDE3]/60 mt-1">
                                  {t.nextMonths}
                                </div>
                              </div>
                              <button
                                onClick={() => handleSubscribe("regular")}
                                disabled={isLoading}
                                className="w-full bg-[#0E0E0E] bg-[#141414] text-[#F2EDE3] px-4 py-3  hover:bg-[#141414] hover:bg-[#1a1a1a] transition-all duration-300 disabled:opacity-50 font-bold text-sm border border-[rgba(242,237,227,0.15)]"
                              >
                                {isLoading ? t.loadingBtn : t.choose15zl}
                              </button>
                            </div>
                          </div>

                          <div className="text-center text-xs text-[#F2EDE3]/60">
                            {t.securePayment}
                          </div>
                        </div>

                        {subscriptionStatus.hasPurchasedCalculator && (
                          <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20  p-4">
                            <p className="text-sm text-green-800 dark:text-green-200">
                              {t.ownerCanUseChat}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {subscriptionStatus.hasActiveSubscription && (
                      <div>
                        <div className=" from-green-50 to-emerald-100 dark:from-green-500/10 dark:to-emerald-600/10 border border-green-200 dark:border-green-500/20  p-6 mb-4">
                          <p className="text-lg font-bold text-green-900 dark:text-green-200 mb-2">
                            {t.paidSubActive}
                          </p>
                          <p className="text-sm text-green-700 dark:text-green-300">
                            {t.feeLine} <strong>{t.perMonthFee}</strong> <span className="text-xs">{t.savesYou}</span>
                          </p>
                          {subscriptionStatus.subscriptionEndsAt && (
                            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                              {t.renewsOn(new Date(subscriptionStatus.subscriptionEndsAt).toLocaleDateString(DATE_LOCALE[lang]))}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={handleCancelSubscription}
                          disabled={isLoading}
                          className="text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                        >
                          {t.cancelSub}
                        </button>
                      </div>
                    )}
                  </div>
                ) : subLoadError ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-[#FF4D2E] mb-4">{subLoadError}</p>
                    <button
                      onClick={() => void fetchSubscriptionStatus()}
                      className="km-mono-eyebrow px-4 py-2 border border-[rgba(242,237,227,0.20)] text-[#F2EDE3]/80 hover:border-[#D8FF3D] hover:text-[#D8FF3D] transition-colors"
                    >
                      {t.retry}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-[#D8FF3D] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
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
                // Serwer nie zwraca puli startowej (rejestracja daje 1M, zakupy
                // dokładają dowolnie dużo), więc pokazujemy SALDO, a pasek liczymy
                // względem max(saldo, 1M) — bez fikcyjnego "zużyto X%".
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
                const tasksTotal = Math.floor(TOKEN_REFERENCE / avgEffectiveTokensPerTask);
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
                        <div className="km-mono-eyebrow text-[#F2EDE3]/40 mb-0.5">{t.monthlyLimit}</div>
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
                          const tasks = Math.floor(TOKEN_REFERENCE / eff);
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
