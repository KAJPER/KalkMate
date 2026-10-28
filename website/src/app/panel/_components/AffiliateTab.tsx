"use client";

// Zakladka "Program partnerski" w panelu klienta. Dane: GET /api/user/affiliate,
// utworzenie kodu: POST /api/user/affiliate, odbior prowizji:
// POST /api/user/affiliate/redeem. Kwoty zawsze w groszach PLN.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { type Locale } from "@/lib/i18n";
import { fetchJson, sendJson, type FetchJsonResult } from "../_lib/fetchJson";

type TierKey = "start" | "bronze" | "silver" | "gold" | "diamond";
type Tier = { key: TierKey; minUnits: number; pct: number };
type Balance = { pendingCents: number; availableCents: number; earnedTotalCents: number; paidOutCents: number; units: number };
type CommissionStatus = "pending" | "available" | "reversed";
type Commission = {
  orderNumber: string | null;
  units: number;
  pct: number;
  amountCents: number;
  status: CommissionStatus;
  createdAt: number;
  availableAt: number;
};
type Payout = {
  kind: "tokens" | "cash" | string;
  amountCents: number;
  tokens: number | null;
  status: string;
  createdAt: number;
  processedAt: number | null;
  iban?: string | null;
};
type AffiliateData = {
  ok: boolean;
  code: string | null;
  active: boolean;
  tiers: Tier[];
  tier: Tier;
  next: Tier | null;
  units: number;
  balance: Balance;
  commissions: Commission[];
  payouts: Payout[];
  config: {
    buyerDiscountPct: number;
    holdDays: number;
    minCashCents: number;
    minTokenCents: number;
    tokensPerGrosz: number;
    productCents: number;
  };
  shareUrl: string | null;
};

const NUM_LOCALE: Record<Locale, string> = {
  pl: "pl-PL", en: "en-GB", de: "de-DE", cs: "cs-CZ", sk: "sk-SK", lt: "lt-LT",
  be: "be-BY", es: "es-ES", pt: "pt-PT", fr: "fr-FR", it: "it-IT",
};

type Dict = {
  eyebrow: string;
  pitchTitle: string;
  pitch: (pct: number) => string;
  howTitle: string;
  how: (p: { pct: number; days: number; minCash: string }) => string[];
  tiersTitle: string;
  tierNames: Record<TierKey, string>;
  colTier: string;
  colFrom: string;
  colPct: string;
  colPerUnit: string;
  fromUnits: (n: number) => string;
  perUnitNote: (price: string, pct: number) => string;
  chooseCode: string;
  codeHint: string;
  codePlaceholder: string;
  createBtn: string;
  creating: string;
  yourCode: string;
  copy: string;
  copied: string;
  shareLink: string;
  share: string;
  shareText: (code: string, pct: number) => string;
  inactive: string;
  yourTier: string;
  commission: (pct: number) => string;
  toNext: (n: number, name: string, pct: number) => string;
  maxTier: string;
  statUnits: string;
  statPending: string;
  statAvailable: string;
  statTotal: string;
  pendingHint: (days: number) => string;
  negative: string;
  redeemTitle: string;
  amountLabel: string;
  toTokens: string;
  tokensPreview: (s: string) => string;
  tokensBonus: string;
  confirmTokens: (amount: string, tokens: string) => string;
  toCash: string;
  ibanLabel: string;
  holderLabel: string;
  adultLabel: string;
  cashAdultOnly: string;
  cashNote: string;
  cashSubmit: string;
  sending: string;
  cancel: string;
  minTokens: (s: string) => string;
  minCash: (s: string) => string;
  tooMuch: string;
  cashPending: string;
  tokensDone: (s: string) => string;
  cashDone: string;
  historyCommissions: string;
  historyPayouts: string;
  colDate: string;
  colOrder: string;
  colUnits: string;
  colAmount: string;
  colStatus: string;
  colKind: string;
  cStatus: Record<CommissionStatus, string>;
  pStatus: Record<"done" | "requested" | "paid" | "rejected", string>;
  availableFrom: (d: string) => string;
  kindTokens: string;
  kindCash: string;
  noCommissions: string;
  noPayouts: string;
  showTiers: string;
  hideTiers: string;
  rulesTitle: string;
  rules: (p: { days: number }) => string[];
  regulamin: string;
  loading: string;
  loadError: string;
  retry: string;
  err: Record<"format" | "taken" | "exists" | "amount" | "balance" | "iban" | "holder" | "adult" | "pending", string>;
  errRate: string;
  errVerify: string;
  errGeneric: string;
};

const DICT: Record<Locale, Dict> = {
  pl: {
    eyebrow: "Program partnerski",
    pitchTitle: "Poleć KalkMate i zarabiaj",
    pitch: (pct) => `Znajomi dostają −${pct}% na KalkMate, a Ty prowizję od każdej sprzedanej sztuki. Im więcej poleceń, tym wyższy procent.`,
    howTitle: "Jak to działa",
    how: ({ pct, days, minCash }) => [
      "Tworzysz własny kod i wysyłasz go znajomym — sam kod albo link polecający.",
      `Kupujący wpisuje kod w polu „Kod rabatowy” i płaci ${pct}% mniej.`,
      `Po opłaceniu zamówienia dostajesz prowizję. Przez ${days} dni jest „w drodze” (czas na zwroty), potem możesz ją odebrać.`,
      `Odbierasz ją jako tokeny AI (ok. 30% więcej niż przy zakupie pakietu) albo przelewem na konto od ${minCash} — przelew tylko dla pełnoletnich.`,
    ],
    tiersTitle: "Poziomy prowizji",
    tierNames: { start: "Start", bronze: "Brąz", silver: "Srebro", gold: "Złoto", diamond: "Diament" },
    colTier: "Poziom",
    colFrom: "Od",
    colPct: "Prowizja",
    colPerUnit: "Za sztukę",
    fromUnits: (n) => (n === 0 ? "od startu" : `od ${n} szt.`),
    perUnitNote: (price, pct) => `„Za sztukę” to szacunek dla ceny ${price} po rabacie kupującego −${pct}%.`,
    chooseCode: "Wybierz swój kod",
    codeHint: "4–16 znaków: litery A–Z i cyfry, bez spacji. Kodu nie da się później zmienić.",
    codePlaceholder: "np. KASIA2026",
    createBtn: "Utwórz kod",
    creating: "Tworzę…",
    yourCode: "Twój kod",
    copy: "Kopiuj",
    copied: "Skopiowano ✓",
    shareLink: "Link polecający",
    share: "Udostępnij",
    shareText: (code, pct) => `KalkMate — kalkulator z AI do matury. Z moim kodem ${code} masz −${pct}%:`,
    inactive: "Twój kod jest teraz wyłączony — kupujący nie dostaną rabatu. Napisz do nas, jeśli to pomyłka.",
    yourTier: "Twój poziom",
    commission: (pct) => `${pct}% prowizji`,
    toNext: (n, name, pct) => `Jeszcze ${n} szt. do poziomu ${name} (${pct}%)`,
    maxTier: "Masz najwyższy poziom — dzięki!",
    statUnits: "Sprzedane sztuki",
    statPending: "W drodze",
    statAvailable: "Dostępne",
    statTotal: "Łącznie zarobione",
    pendingHint: (days) => `odblokowuje się po ${days} dniach`,
    negative: "Saldo jest ujemne, bo cofnięto prowizję, którą już odebrałeś. Kolejne prowizje to wyrównają.",
    redeemTitle: "Odbierz prowizję",
    amountLabel: "Kwota (zł)",
    toTokens: "Wymień na tokeny",
    tokensPreview: (s) => `= ${s} tokenów AI`,
    tokensBonus: "Ok. 30% więcej tokenów niż przy zakupie pakietu. Trafiają na konto od razu.",
    confirmTokens: (a, s) => `Wymienić ${a} na ${s} tokenów AI? Tej operacji nie da się cofnąć.`,
    toCash: "Wypłać na konto",
    ibanLabel: "Numer konta (IBAN)",
    holderLabel: "Imię i nazwisko właściciela konta",
    adultLabel: "Mam ukończone 18 lat",
    cashAdultOnly: "Przelew tylko dla osób pełnoletnich — jeśli masz mniej niż 18 lat, wymień prowizję na tokeny.",
    cashNote: "Wypłacamy przelewem zwykle w ciągu 7 dni roboczych.",
    cashSubmit: "Zleć wypłatę",
    sending: "Wysyłam…",
    cancel: "Anuluj",
    minTokens: (s) => `Minimum na tokeny: ${s}`,
    minCash: (s) => `Minimum przelewu: ${s}`,
    tooMuch: "Kwota jest większa niż dostępne środki.",
    cashPending: "Masz zleconą wypłatę w trakcie realizacji — kolejną zlecisz po jej realizacji.",
    tokensDone: (s) => `Gotowe — ${s} tokenów jest już na Twoim koncie.`,
    cashDone: "Zlecenie przyjęte. Przelew zwykle w ciągu 7 dni roboczych.",
    historyCommissions: "Prowizje",
    historyPayouts: "Wypłaty i wymiany",
    colDate: "Data",
    colOrder: "Zamówienie",
    colUnits: "Szt.",
    colAmount: "Kwota",
    colStatus: "Status",
    colKind: "Rodzaj",
    cStatus: { pending: "W drodze", available: "Dostępna", reversed: "Cofnięta" },
    pStatus: { done: "Zrealizowana", requested: "Zlecona", paid: "Wypłacona", rejected: "Odrzucona" },
    availableFrom: (d) => `od ${d}`,
    kindTokens: "Tokeny",
    kindCash: "Przelew",
    noCommissions: "Jeszcze nic tu nie ma — podeślij kod znajomym!",
    noPayouts: "Brak wypłat.",
    showTiers: "Pokaż poziomy prowizji",
    hideTiers: "Ukryj poziomy prowizji",
    rulesTitle: "Zasady",
    rules: ({ days }) => [
      "Własnego kodu nie możesz użyć przy swoich zakupach.",
      "Prowizja liczy się od opłaconej kwoty za produkty (po rabacie kupującego), bez kosztów wysyłki.",
      "Poziom zależy od łącznej liczby sprzedanych sztuk — wyższy procent działa od kolejnego zamówienia.",
      `Prowizja czeka ${days} dni. Jeśli zamówienie zostanie anulowane albo zwrócone, prowizja jest cofana.`,
    ],
    regulamin: "Pełne zasady w regulaminie →",
    loading: "Wczytuję…",
    loadError: "Nie udało się wczytać programu partnerskiego.",
    retry: "Spróbuj ponownie",
    err: {
      format: "Kod: 4–16 znaków, same litery A–Z i cyfry.",
      taken: "Ten kod jest zajęty — wybierz inny.",
      exists: "Masz już kod partnerski.",
      amount: "Kwota jest poniżej minimum.",
      balance: "Za mało dostępnych środków.",
      iban: "Nieprawidłowy numer konta (IBAN).",
      holder: "Podaj imię i nazwisko właściciela konta.",
      adult: "Wypłata na konto tylko dla osób pełnoletnich.",
      pending: "Masz już zleconą wypłatę w trakcie realizacji.",
    },
    errRate: "Za dużo prób — spróbuj za chwilę.",
    errVerify: "Najpierw potwierdź adres e-mail.",
    errGeneric: "Coś poszło nie tak. Spróbuj ponownie.",
  },
  en: {
    eyebrow: "Referral program",
    pitchTitle: "Recommend KalkMate and earn",
    pitch: (pct) => `Your friends get ${pct}% off KalkMate, and you earn a commission on every unit sold. The more referrals, the higher your rate.`,
    howTitle: "How it works",
    how: ({ pct, days, minCash }) => [
      "Create your own code and send it to friends — the code itself or your referral link.",
      `The buyer enters it in the “Discount code” field and pays ${pct}% less.`,
      `Once the order is paid, you get a commission. For ${days} days it's “on the way” (time for returns), then you can collect it.`,
      `Collect it as AI tokens (about 30% more than buying a pack) or as a bank transfer from ${minCash} — transfers for adults only.`,
    ],
    tiersTitle: "Commission tiers",
    tierNames: { start: "Start", bronze: "Bronze", silver: "Silver", gold: "Gold", diamond: "Diamond" },
    colTier: "Tier",
    colFrom: "From",
    colPct: "Commission",
    colPerUnit: "Per unit",
    fromUnits: (n) => (n === 0 ? "from the start" : `from ${n} units`),
    perUnitNote: (price, pct) => `“Per unit” is an estimate for a ${price} price after the buyer's −${pct}% discount.`,
    chooseCode: "Choose your code",
    codeHint: "4–16 characters: letters A–Z and digits, no spaces. You can't change the code later.",
    codePlaceholder: "e.g. KATE2026",
    createBtn: "Create code",
    creating: "Creating…",
    yourCode: "Your code",
    copy: "Copy",
    copied: "Copied ✓",
    shareLink: "Referral link",
    share: "Share",
    shareText: (code, pct) => `KalkMate — an AI calculator for exams. With my code ${code} you get ${pct}% off:`,
    inactive: "Your code is currently disabled — buyers won't get a discount. Contact us if this is a mistake.",
    yourTier: "Your tier",
    commission: (pct) => `${pct}% commission`,
    toNext: (n, name, pct) => `${n} more units to ${name} (${pct}%)`,
    maxTier: "You're at the top tier — thank you!",
    statUnits: "Units sold",
    statPending: "On the way",
    statAvailable: "Available",
    statTotal: "Total earned",
    pendingHint: (days) => `unlocks after ${days} days`,
    negative: "Your balance is negative because a commission you already collected was reversed. Future commissions will even it out.",
    redeemTitle: "Collect your commission",
    amountLabel: "Amount (PLN)",
    toTokens: "Exchange for tokens",
    tokensPreview: (s) => `= ${s} AI tokens`,
    tokensBonus: "About 30% more tokens than buying a pack. Added to your account instantly.",
    confirmTokens: (a, s) => `Exchange ${a} for ${s} AI tokens? This can't be undone.`,
    toCash: "Withdraw to bank",
    ibanLabel: "Account number (IBAN)",
    holderLabel: "Account holder's full name",
    adultLabel: "I am 18 or older",
    cashAdultOnly: "Bank transfers for adults only — if you're under 18, exchange your commission for tokens.",
    cashNote: "We usually pay out by bank transfer within 7 business days.",
    cashSubmit: "Request payout",
    sending: "Sending…",
    cancel: "Cancel",
    minTokens: (s) => `Minimum for tokens: ${s}`,
    minCash: (s) => `Minimum transfer: ${s}`,
    tooMuch: "The amount is higher than your available balance.",
    cashPending: "You have a payout in progress — you can request another once it's done.",
    tokensDone: (s) => `Done — ${s} tokens are now in your account.`,
    cashDone: "Request received. The transfer usually arrives within 7 business days.",
    historyCommissions: "Commissions",
    historyPayouts: "Payouts and exchanges",
    colDate: "Date",
    colOrder: "Order",
    colUnits: "Units",
    colAmount: "Amount",
    colStatus: "Status",
    colKind: "Type",
    cStatus: { pending: "On the way", available: "Available", reversed: "Reversed" },
    pStatus: { done: "Completed", requested: "Requested", paid: "Paid", rejected: "Rejected" },
    availableFrom: (d) => `from ${d}`,
    kindTokens: "Tokens",
    kindCash: "Transfer",
    noCommissions: "Nothing here yet — send your code to friends!",
    noPayouts: "No payouts yet.",
    showTiers: "Show commission tiers",
    hideTiers: "Hide commission tiers",
    rulesTitle: "Rules",
    rules: ({ days }) => [
      "You can't use your own code for your own purchases.",
      "Commission is calculated on the paid product amount (after the buyer's discount), excluding shipping.",
      "Your tier depends on the total number of units sold — a higher rate applies from the next order.",
      `Commission is held for ${days} days. If the order is cancelled or refunded, the commission is reversed.`,
    ],
    regulamin: "Full rules in the terms →",
    loading: "Loading…",
    loadError: "Couldn't load the referral program.",
    retry: "Try again",
    err: {
      format: "Code: 4–16 characters, letters A–Z and digits only.",
      taken: "This code is taken — pick another one.",
      exists: "You already have a referral code.",
      amount: "The amount is below the minimum.",
      balance: "Not enough available balance.",
      iban: "Invalid account number (IBAN).",
      holder: "Enter the account holder's full name.",
      adult: "Bank payouts are for adults only.",
      pending: "You already have a payout in progress.",
    },
    errRate: "Too many attempts — try again in a moment.",
    errVerify: "Please verify your email address first.",
    errGeneric: "Something went wrong. Please try again.",
  },
  de: {
    eyebrow: "Partnerprogramm",
    pitchTitle: "Empfiehl KalkMate und verdiene mit",
    pitch: (pct) => `Deine Freunde bekommen −${pct}% auf KalkMate, und du erhältst eine Provision für jedes verkaufte Gerät. Je mehr Empfehlungen, desto höher dein Satz.`,
    howTitle: "So funktioniert's",
    how: ({ pct, days, minCash }) => [
      "Du erstellst deinen eigenen Code und schickst ihn Freunden — den Code oder deinen Empfehlungslink.",
      `Der Käufer gibt ihn im Feld „Rabattcode“ ein und zahlt ${pct}% weniger.`,
      `Nach Bezahlung der Bestellung bekommst du die Provision. ${days} Tage ist sie „unterwegs“ (Zeit für Rücksendungen), danach kannst du sie abholen.`,
      `Du nimmst sie als KI-Tokens (ca. 30% mehr als beim Paketkauf) oder per Überweisung ab ${minCash} — Überweisung nur für Volljährige.`,
    ],
    tiersTitle: "Provisionsstufen",
    tierNames: { start: "Start", bronze: "Bronze", silver: "Silber", gold: "Gold", diamond: "Diamant" },
    colTier: "Stufe",
    colFrom: "Ab",
    colPct: "Provision",
    colPerUnit: "Pro Stück",
    fromUnits: (n) => (n === 0 ? "ab Start" : `ab ${n} Stück`),
    perUnitNote: (price, pct) => `„Pro Stück“ ist eine Schätzung für einen Preis von ${price} nach dem Käuferrabatt von −${pct}%.`,
    chooseCode: "Wähle deinen Code",
    codeHint: "4–16 Zeichen: Buchstaben A–Z und Ziffern, keine Leerzeichen. Der Code kann später nicht geändert werden.",
    codePlaceholder: "z. B. LENA2026",
    createBtn: "Code erstellen",
    creating: "Wird erstellt…",
    yourCode: "Dein Code",
    copy: "Kopieren",
    copied: "Kopiert ✓",
    shareLink: "Empfehlungslink",
    share: "Teilen",
    shareText: (code, pct) => `KalkMate — KI-Rechner für Prüfungen. Mit meinem Code ${code} bekommst du −${pct}%:`,
    inactive: "Dein Code ist derzeit deaktiviert — Käufer bekommen keinen Rabatt. Schreib uns, falls das ein Fehler ist.",
    yourTier: "Deine Stufe",
    commission: (pct) => `${pct}% Provision`,
    toNext: (n, name, pct) => `Noch ${n} Stück bis zur Stufe ${name} (${pct}%)`,
    maxTier: "Du hast die höchste Stufe — danke!",
    statUnits: "Verkaufte Stück",
    statPending: "Unterwegs",
    statAvailable: "Verfügbar",
    statTotal: "Insgesamt verdient",
    pendingHint: (days) => `wird nach ${days} Tagen freigegeben`,
    negative: "Dein Saldo ist negativ, weil eine bereits abgeholte Provision storniert wurde. Künftige Provisionen gleichen das aus.",
    redeemTitle: "Provision abholen",
    amountLabel: "Betrag (PLN)",
    toTokens: "In Tokens tauschen",
    tokensPreview: (s) => `= ${s} KI-Tokens`,
    tokensBonus: "Ca. 30% mehr Tokens als beim Paketkauf. Sofort auf deinem Konto.",
    confirmTokens: (a, s) => `${a} gegen ${s} KI-Tokens tauschen? Das kann nicht rückgängig gemacht werden.`,
    toCash: "Aufs Konto auszahlen",
    ibanLabel: "Kontonummer (IBAN)",
    holderLabel: "Vor- und Nachname des Kontoinhabers",
    adultLabel: "Ich bin mindestens 18 Jahre alt",
    cashAdultOnly: "Überweisung nur für Volljährige — wenn du unter 18 bist, tausche die Provision in Tokens.",
    cashNote: "Wir zahlen per Überweisung meist innerhalb von 7 Werktagen aus.",
    cashSubmit: "Auszahlung beantragen",
    sending: "Wird gesendet…",
    cancel: "Abbrechen",
    minTokens: (s) => `Minimum für Tokens: ${s}`,
    minCash: (s) => `Mindestauszahlung: ${s}`,
    tooMuch: "Der Betrag ist höher als dein verfügbares Guthaben.",
    cashPending: "Du hast bereits eine Auszahlung in Bearbeitung — die nächste kannst du danach beantragen.",
    tokensDone: (s) => `Fertig — ${s} Tokens sind jetzt auf deinem Konto.`,
    cashDone: "Antrag erhalten. Die Überweisung kommt meist innerhalb von 7 Werktagen.",
    historyCommissions: "Provisionen",
    historyPayouts: "Auszahlungen und Tausch",
    colDate: "Datum",
    colOrder: "Bestellung",
    colUnits: "Stk.",
    colAmount: "Betrag",
    colStatus: "Status",
    colKind: "Art",
    cStatus: { pending: "Unterwegs", available: "Verfügbar", reversed: "Storniert" },
    pStatus: { done: "Erledigt", requested: "Beantragt", paid: "Ausgezahlt", rejected: "Abgelehnt" },
    availableFrom: (d) => `ab ${d}`,
    kindTokens: "Tokens",
    kindCash: "Überweisung",
    noCommissions: "Noch nichts hier — schick deinen Code an Freunde!",
    noPayouts: "Keine Auszahlungen.",
    showTiers: "Provisionsstufen anzeigen",
    hideTiers: "Provisionsstufen ausblenden",
    rulesTitle: "Regeln",
    rules: ({ days }) => [
      "Deinen eigenen Code kannst du nicht für eigene Käufe nutzen.",
      "Die Provision wird vom bezahlten Produktbetrag (nach Käuferrabatt) berechnet, ohne Versand.",
      "Die Stufe hängt von der Gesamtzahl verkaufter Stück ab — der höhere Satz gilt ab der nächsten Bestellung.",
      `Die Provision wird ${days} Tage zurückgehalten. Wird die Bestellung storniert oder erstattet, wird sie zurückgebucht.`,
    ],
    regulamin: "Alle Regeln in den AGB →",
    loading: "Wird geladen…",
    loadError: "Das Partnerprogramm konnte nicht geladen werden.",
    retry: "Erneut versuchen",
    err: {
      format: "Code: 4–16 Zeichen, nur Buchstaben A–Z und Ziffern.",
      taken: "Dieser Code ist vergeben — wähle einen anderen.",
      exists: "Du hast bereits einen Partnercode.",
      amount: "Der Betrag liegt unter dem Minimum.",
      balance: "Nicht genug verfügbares Guthaben.",
      iban: "Ungültige Kontonummer (IBAN).",
      holder: "Gib Vor- und Nachnamen des Kontoinhabers an.",
      adult: "Auszahlung aufs Konto nur für Volljährige.",
      pending: "Du hast bereits eine Auszahlung in Bearbeitung.",
    },
    errRate: "Zu viele Versuche — versuch es gleich noch einmal.",
    errVerify: "Bestätige zuerst deine E-Mail-Adresse.",
    errGeneric: "Etwas ist schiefgelaufen. Versuch es erneut.",
  },
  cs: {
    eyebrow: "Partnerský program",
    pitchTitle: "Doporuč KalkMate a vydělávej",
    pitch: (pct) => `Kamarádi dostanou −${pct}% na KalkMate a ty provizi z každého prodaného kusu. Čím víc doporučení, tím vyšší procento.`,
    howTitle: "Jak to funguje",
    how: ({ pct, days, minCash }) => [
      "Vytvoříš si vlastní kód a pošleš ho kamarádům — samotný kód nebo odkaz.",
      `Kupující ho zadá do pole „Slevový kód“ a zaplatí o ${pct}% méně.`,
      `Po zaplacení objednávky dostaneš provizi. ${days} dní je „na cestě“ (čas na vrácení), pak si ji můžeš vybrat.`,
      `Vybereš si ji jako AI tokeny (asi o 30% víc než při nákupu balíčku) nebo převodem na účet od ${minCash} — převod jen pro plnoleté.`,
    ],
    tiersTitle: "Úrovně provize",
    tierNames: { start: "Start", bronze: "Bronz", silver: "Stříbro", gold: "Zlato", diamond: "Diamant" },
    colTier: "Úroveň",
    colFrom: "Od",
    colPct: "Provize",
    colPerUnit: "Za kus",
    fromUnits: (n) => (n === 0 ? "od začátku" : `od ${n} ks`),
    perUnitNote: (price, pct) => `„Za kus“ je odhad pro cenu ${price} po slevě kupujícího −${pct}%.`,
    chooseCode: "Vyber si svůj kód",
    codeHint: "4–16 znaků: písmena A–Z a číslice, bez mezer. Kód později nejde změnit.",
    codePlaceholder: "např. JANA2026",
    createBtn: "Vytvořit kód",
    creating: "Vytvářím…",
    yourCode: "Tvůj kód",
    copy: "Kopírovat",
    copied: "Zkopírováno ✓",
    shareLink: "Doporučující odkaz",
    share: "Sdílet",
    shareText: (code, pct) => `KalkMate — kalkulačka s AI k maturitě. S mým kódem ${code} máš −${pct}%:`,
    inactive: "Tvůj kód je teď vypnutý — kupující nedostanou slevu. Napiš nám, pokud jde o omyl.",
    yourTier: "Tvoje úroveň",
    commission: (pct) => `${pct}% provize`,
    toNext: (n, name, pct) => `Ještě ${n} ks do úrovně ${name} (${pct}%)`,
    maxTier: "Máš nejvyšší úroveň — díky!",
    statUnits: "Prodané kusy",
    statPending: "Na cestě",
    statAvailable: "K dispozici",
    statTotal: "Celkem vyděláno",
    pendingHint: (days) => `odemkne se po ${days} dnech`,
    negative: "Zůstatek je záporný, protože byla zrušena provize, kterou už sis vybral. Další provize to vyrovnají.",
    redeemTitle: "Vyber si provizi",
    amountLabel: "Částka (PLN)",
    toTokens: "Vyměnit za tokeny",
    tokensPreview: (s) => `= ${s} AI tokenů`,
    tokensBonus: "Asi o 30% víc tokenů než při nákupu balíčku. Na účtu hned.",
    confirmTokens: (a, s) => `Vyměnit ${a} za ${s} AI tokenů? Tuto operaci nejde vrátit.`,
    toCash: "Vyplatit na účet",
    ibanLabel: "Číslo účtu (IBAN)",
    holderLabel: "Jméno a příjmení majitele účtu",
    adultLabel: "Je mi alespoň 18 let",
    cashAdultOnly: "Převod jen pro plnoleté — pokud ti ještě není 18, vyměň provizi za tokeny.",
    cashNote: "Vyplácíme převodem obvykle do 7 pracovních dnů.",
    cashSubmit: "Požádat o výplatu",
    sending: "Odesílám…",
    cancel: "Zrušit",
    minTokens: (s) => `Minimum na tokeny: ${s}`,
    minCash: (s) => `Minimální převod: ${s}`,
    tooMuch: "Částka je vyšší než dostupný zůstatek.",
    cashPending: "Máš výplatu ve zpracování — další si zadáš, až bude vyřízená.",
    tokensDone: (s) => `Hotovo — ${s} tokenů už máš na účtu.`,
    cashDone: "Žádost přijata. Převod obvykle do 7 pracovních dnů.",
    historyCommissions: "Provize",
    historyPayouts: "Výplaty a výměny",
    colDate: "Datum",
    colOrder: "Objednávka",
    colUnits: "Ks",
    colAmount: "Částka",
    colStatus: "Stav",
    colKind: "Druh",
    cStatus: { pending: "Na cestě", available: "K dispozici", reversed: "Zrušená" },
    pStatus: { done: "Vyřízená", requested: "Zadaná", paid: "Vyplacená", rejected: "Zamítnutá" },
    availableFrom: (d) => `od ${d}`,
    kindTokens: "Tokeny",
    kindCash: "Převod",
    noCommissions: "Zatím nic — pošli kód kamarádům!",
    noPayouts: "Žádné výplaty.",
    showTiers: "Zobrazit úrovně provize",
    hideTiers: "Skrýt úrovně provize",
    rulesTitle: "Pravidla",
    rules: ({ days }) => [
      "Vlastní kód nemůžeš použít při svých nákupech.",
      "Provize se počítá ze zaplacené částky za produkty (po slevě kupujícího), bez dopravy.",
      "Úroveň závisí na celkovém počtu prodaných kusů — vyšší procento platí od další objednávky.",
      `Provize čeká ${days} dní. Pokud je objednávka zrušena nebo vrácena, provize se ruší.`,
    ],
    regulamin: "Úplná pravidla v obchodních podmínkách →",
    loading: "Načítám…",
    loadError: "Partnerský program se nepodařilo načíst.",
    retry: "Zkusit znovu",
    err: {
      format: "Kód: 4–16 znaků, jen písmena A–Z a číslice.",
      taken: "Tento kód je obsazený — vyber jiný.",
      exists: "Partnerský kód už máš.",
      amount: "Částka je pod minimem.",
      balance: "Nedostatek dostupných prostředků.",
      iban: "Neplatné číslo účtu (IBAN).",
      holder: "Zadej jméno a příjmení majitele účtu.",
      adult: "Výplata na účet jen pro plnoleté.",
      pending: "Už máš výplatu ve zpracování.",
    },
    errRate: "Příliš mnoho pokusů — zkus to za chvíli.",
    errVerify: "Nejdřív potvrď svou e-mailovou adresu.",
    errGeneric: "Něco se pokazilo. Zkus to znovu.",
  },
  sk: {
    eyebrow: "Partnerský program",
    pitchTitle: "Odporuč KalkMate a zarábaj",
    pitch: (pct) => `Kamaráti dostanú −${pct}% na KalkMate a ty províziu z každého predaného kusu. Čím viac odporúčaní, tým vyššie percento.`,
    howTitle: "Ako to funguje",
    how: ({ pct, days, minCash }) => [
      "Vytvoríš si vlastný kód a pošleš ho kamarátom — samotný kód alebo odkaz.",
      `Kupujúci ho zadá do poľa „Zľavový kód“ a zaplatí o ${pct}% menej.`,
      `Po zaplatení objednávky dostaneš províziu. ${days} dní je „na ceste“ (čas na vrátenie), potom si ju môžeš vybrať.`,
      `Vyberieš si ju ako AI tokeny (asi o 30% viac než pri kúpe balíčka) alebo prevodom na účet od ${minCash} — prevod len pre plnoletých.`,
    ],
    tiersTitle: "Úrovne provízie",
    tierNames: { start: "Štart", bronze: "Bronz", silver: "Striebro", gold: "Zlato", diamond: "Diamant" },
    colTier: "Úroveň",
    colFrom: "Od",
    colPct: "Provízia",
    colPerUnit: "Za kus",
    fromUnits: (n) => (n === 0 ? "od začiatku" : `od ${n} ks`),
    perUnitNote: (price, pct) => `„Za kus“ je odhad pre cenu ${price} po zľave kupujúceho −${pct}%.`,
    chooseCode: "Vyber si svoj kód",
    codeHint: "4–16 znakov: písmená A–Z a číslice, bez medzier. Kód neskôr nejde zmeniť.",
    codePlaceholder: "napr. ZUZKA2026",
    createBtn: "Vytvoriť kód",
    creating: "Vytváram…",
    yourCode: "Tvoj kód",
    copy: "Kopírovať",
    copied: "Skopírované ✓",
    shareLink: "Odporúčací odkaz",
    share: "Zdieľať",
    shareText: (code, pct) => `KalkMate — kalkulačka s AI na maturitu. S mojím kódom ${code} máš −${pct}%:`,
    inactive: "Tvoj kód je teraz vypnutý — kupujúci nedostanú zľavu. Napíš nám, ak ide o omyl.",
    yourTier: "Tvoja úroveň",
    commission: (pct) => `${pct}% provízia`,
    toNext: (n, name, pct) => `Ešte ${n} ks do úrovne ${name} (${pct}%)`,
    maxTier: "Máš najvyššiu úroveň — vďaka!",
    statUnits: "Predané kusy",
    statPending: "Na ceste",
    statAvailable: "K dispozícii",
    statTotal: "Spolu zarobené",
    pendingHint: (days) => `odomkne sa po ${days} dňoch`,
    negative: "Zostatok je záporný, lebo bola zrušená provízia, ktorú si už vybral. Ďalšie provízie to vyrovnajú.",
    redeemTitle: "Vyber si províziu",
    amountLabel: "Suma (PLN)",
    toTokens: "Vymeniť za tokeny",
    tokensPreview: (s) => `= ${s} AI tokenov`,
    tokensBonus: "Asi o 30% viac tokenov než pri kúpe balíčka. Na účte hneď.",
    confirmTokens: (a, s) => `Vymeniť ${a} za ${s} AI tokenov? Túto operáciu nejde vrátiť.`,
    toCash: "Vyplatiť na účet",
    ibanLabel: "Číslo účtu (IBAN)",
    holderLabel: "Meno a priezvisko majiteľa účtu",
    adultLabel: "Mám aspoň 18 rokov",
    cashAdultOnly: "Prevod len pre plnoletých — ak ešte nemáš 18, vymeň províziu za tokeny.",
    cashNote: "Vyplácame prevodom zvyčajne do 7 pracovných dní.",
    cashSubmit: "Požiadať o výplatu",
    sending: "Odosielam…",
    cancel: "Zrušiť",
    minTokens: (s) => `Minimum na tokeny: ${s}`,
    minCash: (s) => `Minimálny prevod: ${s}`,
    tooMuch: "Suma je vyššia ako dostupný zostatok.",
    cashPending: "Máš výplatu v spracovaní — ďalšiu zadáš, keď bude vybavená.",
    tokensDone: (s) => `Hotovo — ${s} tokenov už máš na účte.`,
    cashDone: "Žiadosť prijatá. Prevod zvyčajne do 7 pracovných dní.",
    historyCommissions: "Provízie",
    historyPayouts: "Výplaty a výmeny",
    colDate: "Dátum",
    colOrder: "Objednávka",
    colUnits: "Ks",
    colAmount: "Suma",
    colStatus: "Stav",
    colKind: "Druh",
    cStatus: { pending: "Na ceste", available: "K dispozícii", reversed: "Zrušená" },
    pStatus: { done: "Vybavená", requested: "Zadaná", paid: "Vyplatená", rejected: "Zamietnutá" },
    availableFrom: (d) => `od ${d}`,
    kindTokens: "Tokeny",
    kindCash: "Prevod",
    noCommissions: "Zatiaľ nič — pošli kód kamarátom!",
    noPayouts: "Žiadne výplaty.",
    showTiers: "Zobraziť úrovne provízie",
    hideTiers: "Skryť úrovne provízie",
    rulesTitle: "Pravidlá",
    rules: ({ days }) => [
      "Vlastný kód nemôžeš použiť pri svojich nákupoch.",
      "Provízia sa počíta zo zaplatenej sumy za produkty (po zľave kupujúceho), bez dopravy.",
      "Úroveň závisí od celkového počtu predaných kusov — vyššie percento platí od ďalšej objednávky.",
      `Provízia čaká ${days} dní. Ak je objednávka zrušená alebo vrátená, provízia sa ruší.`,
    ],
    regulamin: "Úplné pravidlá v obchodných podmienkach →",
    loading: "Načítavam…",
    loadError: "Partnerský program sa nepodarilo načítať.",
    retry: "Skúsiť znova",
    err: {
      format: "Kód: 4–16 znakov, len písmená A–Z a číslice.",
      taken: "Tento kód je obsadený — vyber iný.",
      exists: "Partnerský kód už máš.",
      amount: "Suma je pod minimom.",
      balance: "Nedostatok dostupných prostriedkov.",
      iban: "Neplatné číslo účtu (IBAN).",
      holder: "Zadaj meno a priezvisko majiteľa účtu.",
      adult: "Výplata na účet len pre plnoletých.",
      pending: "Už máš výplatu v spracovaní.",
    },
    errRate: "Príliš veľa pokusov — skús to o chvíľu.",
    errVerify: "Najprv potvrď svoju e-mailovú adresu.",
    errGeneric: "Niečo sa pokazilo. Skús to znova.",
  },
  lt: {
    eyebrow: "Partnerių programa",
    pitchTitle: "Rekomenduok KalkMate ir uždirbk",
    pitch: (pct) => `Tavo draugai gauna −${pct}% nuolaidą KalkMate, o tu — komisinį už kiekvieną parduotą vienetą. Kuo daugiau rekomendacijų, tuo didesnis procentas.`,
    howTitle: "Kaip tai veikia",
    how: ({ pct, days, minCash }) => [
      "Susikuri savo kodą ir išsiunti jį draugams — patį kodą arba rekomendacijos nuorodą.",
      `Pirkėjas įveda jį laukelyje „Nuolaidos kodas“ ir moka ${pct}% mažiau.`,
      `Apmokėjus užsakymą gauni komisinį. ${days} d. jis yra „kelyje“ (laikas grąžinimams), vėliau gali jį atsiimti.`,
      `Atsiimi kaip DI žetonus (apie 30% daugiau nei perkant paketą) arba pavedimu į sąskaitą nuo ${minCash} — pavedimas tik pilnamečiams.`,
    ],
    tiersTitle: "Komisinių lygiai",
    tierNames: { start: "Startas", bronze: "Bronza", silver: "Sidabras", gold: "Auksas", diamond: "Deimantas" },
    colTier: "Lygis",
    colFrom: "Nuo",
    colPct: "Komisinis",
    colPerUnit: "Už vnt.",
    fromUnits: (n) => (n === 0 ? "nuo pradžių" : `nuo ${n} vnt.`),
    perUnitNote: (price, pct) => `„Už vnt.“ — apytikslė suma ${price} kainai po pirkėjo −${pct}% nuolaidos.`,
    chooseCode: "Pasirink savo kodą",
    codeHint: "4–16 simbolių: raidės A–Z ir skaitmenys, be tarpų. Vėliau kodo pakeisti negalėsi.",
    codePlaceholder: "pvz. RUTA2026",
    createBtn: "Sukurti kodą",
    creating: "Kuriama…",
    yourCode: "Tavo kodas",
    copy: "Kopijuoti",
    copied: "Nukopijuota ✓",
    shareLink: "Rekomendacijos nuoroda",
    share: "Dalintis",
    shareText: (code, pct) => `KalkMate — skaičiuotuvas su DI egzaminams. Su mano kodu ${code} gausi −${pct}%:`,
    inactive: "Tavo kodas šiuo metu išjungtas — pirkėjai negaus nuolaidos. Parašyk mums, jei tai klaida.",
    yourTier: "Tavo lygis",
    commission: (pct) => `${pct}% komisinis`,
    toNext: (n, name, pct) => `Dar ${n} vnt. iki lygio ${name} (${pct}%)`,
    maxTier: "Pasiekei aukščiausią lygį — ačiū!",
    statUnits: "Parduota vnt.",
    statPending: "Kelyje",
    statAvailable: "Prieinama",
    statTotal: "Iš viso uždirbta",
    pendingHint: (days) => `atsirakina po ${days} d.`,
    negative: "Balansas neigiamas, nes buvo atšauktas jau atsiimtas komisinis. Būsimi komisiniai tai išlygins.",
    redeemTitle: "Atsiimk komisinį",
    amountLabel: "Suma (PLN)",
    toTokens: "Keisti į žetonus",
    tokensPreview: (s) => `= ${s} DI žetonų`,
    tokensBonus: "Apie 30% daugiau žetonų nei perkant paketą. Iškart tavo paskyroje.",
    confirmTokens: (a, s) => `Keisti ${a} į ${s} DI žetonų? Šio veiksmo atšaukti negalima.`,
    toCash: "Išmokėti į sąskaitą",
    ibanLabel: "Sąskaitos numeris (IBAN)",
    holderLabel: "Sąskaitos savininko vardas ir pavardė",
    adultLabel: "Man jau yra 18 metų",
    cashAdultOnly: "Pavedimas tik pilnamečiams — jei tau dar nėra 18, keisk komisinį į žetonus.",
    cashNote: "Išmokame pavedimu paprastai per 7 darbo dienas.",
    cashSubmit: "Užsakyti išmoką",
    sending: "Siunčiama…",
    cancel: "Atšaukti",
    minTokens: (s) => `Minimumas žetonams: ${s}`,
    minCash: (s) => `Minimalus pavedimas: ${s}`,
    tooMuch: "Suma didesnė nei prieinamas balansas.",
    cashPending: "Turi vykdomą išmoką — kitą galėsi užsakyti, kai ji bus įvykdyta.",
    tokensDone: (s) => `Atlikta — ${s} žetonų jau tavo paskyroje.`,
    cashDone: "Užsakymas priimtas. Pavedimas paprastai per 7 darbo dienas.",
    historyCommissions: "Komisiniai",
    historyPayouts: "Išmokos ir keitimai",
    colDate: "Data",
    colOrder: "Užsakymas",
    colUnits: "Vnt.",
    colAmount: "Suma",
    colStatus: "Būsena",
    colKind: "Tipas",
    cStatus: { pending: "Kelyje", available: "Prieinama", reversed: "Atšaukta" },
    pStatus: { done: "Įvykdyta", requested: "Užsakyta", paid: "Išmokėta", rejected: "Atmesta" },
    availableFrom: (d) => `nuo ${d}`,
    kindTokens: "Žetonai",
    kindCash: "Pavedimas",
    noCommissions: "Kol kas nieko — nusiųsk kodą draugams!",
    noPayouts: "Išmokų nėra.",
    showTiers: "Rodyti komisinių lygius",
    hideTiers: "Slėpti komisinių lygius",
    rulesTitle: "Taisyklės",
    rules: ({ days }) => [
      "Savo kodo negali naudoti savo pirkiniams.",
      "Komisinis skaičiuojamas nuo apmokėtos prekių sumos (po pirkėjo nuolaidos), be pristatymo.",
      "Lygis priklauso nuo bendro parduotų vienetų skaičiaus — didesnis procentas galioja nuo kito užsakymo.",
      `Komisinis laukia ${days} d. Jei užsakymas atšaukiamas ar grąžinamas, komisinis atšaukiamas.`,
    ],
    regulamin: "Visos taisyklės — taisyklėse →",
    loading: "Įkeliama…",
    loadError: "Nepavyko įkelti partnerių programos.",
    retry: "Bandyti dar kartą",
    err: {
      format: "Kodas: 4–16 simbolių, tik raidės A–Z ir skaitmenys.",
      taken: "Šis kodas užimtas — pasirink kitą.",
      exists: "Jau turi partnerio kodą.",
      amount: "Suma mažesnė už minimumą.",
      balance: "Nepakanka prieinamų lėšų.",
      iban: "Neteisingas sąskaitos numeris (IBAN).",
      holder: "Įvesk sąskaitos savininko vardą ir pavardę.",
      adult: "Išmoka į sąskaitą tik pilnamečiams.",
      pending: "Jau turi vykdomą išmoką.",
    },
    errRate: "Per daug bandymų — pabandyk po akimirkos.",
    errVerify: "Pirmiausia patvirtink el. pašto adresą.",
    errGeneric: "Kažkas nepavyko. Bandyk dar kartą.",
  },
  be: {
    eyebrow: "Партнёрская праграма",
    pitchTitle: "Рэкамендуй KalkMate і зарабляй",
    pitch: (pct) => `Сябры атрымліваюць −${pct}% на KalkMate, а ты — камісію з кожнай прададзенай штукі. Чым больш рэкамендацый, тым вышэйшы працэнт.`,
    howTitle: "Як гэта працуе",
    how: ({ pct, days, minCash }) => [
      "Ствараеш свой код і адпраўляеш яго сябрам — сам код або спасылку.",
      `Пакупнік уводзіць яго ў поле «Код зніжкі» і плаціць на ${pct}% менш.`,
      `Пасля аплаты заказа атрымліваеш камісію. ${days} дзён яна «у дарозе» (час на вяртанні), потым можаш яе забраць.`,
      `Забіраеш яе як AI-токены (прыкладна на 30% больш, чым пры куплі пакета) або пераводам на рахунак ад ${minCash} — пераклад толькі для паўналетніх.`,
    ],
    tiersTitle: "Узроўні камісіі",
    tierNames: { start: "Старт", bronze: "Бронза", silver: "Срэбра", gold: "Золата", diamond: "Дыямент" },
    colTier: "Узровень",
    colFrom: "Ад",
    colPct: "Камісія",
    colPerUnit: "За штуку",
    fromUnits: (n) => (n === 0 ? "з пачатку" : `ад ${n} шт.`),
    perUnitNote: (price, pct) => `«За штуку» — ацэнка для цаны ${price} пасля зніжкі пакупніка −${pct}%.`,
    chooseCode: "Выберы свой код",
    codeHint: "4–16 знакаў: літары A–Z і лічбы, без прабелаў. Код потым змяніць нельга.",
    codePlaceholder: "напр. ALESIA2026",
    createBtn: "Стварыць код",
    creating: "Ствараю…",
    yourCode: "Твой код",
    copy: "Капіяваць",
    copied: "Скапіявана ✓",
    shareLink: "Спасылка-рэкамендацыя",
    share: "Падзяліцца",
    shareText: (code, pct) => `KalkMate — калькулятар з AI для экзаменаў. З маім кодам ${code} у цябе −${pct}%:`,
    inactive: "Твой код зараз адключаны — пакупнікі не атрымаюць зніжку. Напішы нам, калі гэта памылка.",
    yourTier: "Твой узровень",
    commission: (pct) => `${pct}% камісіі`,
    toNext: (n, name, pct) => `Яшчэ ${n} шт. да ўзроўню ${name} (${pct}%)`,
    maxTier: "У цябе найвышэйшы ўзровень — дзякуй!",
    statUnits: "Прададзена штук",
    statPending: "У дарозе",
    statAvailable: "Даступна",
    statTotal: "Усяго зароблена",
    pendingHint: (days) => `разблакуецца праз ${days} дзён`,
    negative: "Баланс адмоўны, бо адменена камісія, якую ты ўжо забраў. Наступныя камісіі гэта выраўнуюць.",
    redeemTitle: "Забяры камісію",
    amountLabel: "Сума (PLN)",
    toTokens: "Абмяняць на токены",
    tokensPreview: (s) => `= ${s} AI-токенаў`,
    tokensBonus: "Прыкладна на 30% больш токенаў, чым пры куплі пакета. Адразу на рахунку.",
    confirmTokens: (a, s) => `Абмяняць ${a} на ${s} AI-токенаў? Гэту аперацыю нельга адмяніць.`,
    toCash: "Вывесці на рахунак",
    ibanLabel: "Нумар рахунку (IBAN)",
    holderLabel: "Імя і прозвішча ўладальніка рахунку",
    adultLabel: "Мне ўжо ёсць 18 гадоў",
    cashAdultOnly: "Пераклад толькі для паўналетніх — калі табе яшчэ няма 18, абмяняй камісію на токены.",
    cashNote: "Выплачваем пераводам звычайна на працягу 7 працоўных дзён.",
    cashSubmit: "Замовіць выплату",
    sending: "Адпраўляю…",
    cancel: "Скасаваць",
    minTokens: (s) => `Мінімум на токены: ${s}`,
    minCash: (s) => `Мінімальны пераклад: ${s}`,
    tooMuch: "Сума большая за даступны баланс.",
    cashPending: "У цябе ёсць выплата ў апрацоўцы — наступную замовіш, калі яна будзе выканана.",
    tokensDone: (s) => `Гатова — ${s} токенаў ужо на тваім рахунку.`,
    cashDone: "Заяўка прынята. Пераклад звычайна на працягу 7 працоўных дзён.",
    historyCommissions: "Камісіі",
    historyPayouts: "Выплаты і абмены",
    colDate: "Дата",
    colOrder: "Заказ",
    colUnits: "Шт.",
    colAmount: "Сума",
    colStatus: "Статус",
    colKind: "Тып",
    cStatus: { pending: "У дарозе", available: "Даступна", reversed: "Адменена" },
    pStatus: { done: "Выканана", requested: "Замоўлена", paid: "Выплачана", rejected: "Адхілена" },
    availableFrom: (d) => `з ${d}`,
    kindTokens: "Токены",
    kindCash: "Пераклад",
    noCommissions: "Пакуль нічога — адпраў код сябрам!",
    noPayouts: "Выплат няма.",
    showTiers: "Паказаць узроўні камісіі",
    hideTiers: "Схаваць узроўні камісіі",
    rulesTitle: "Правілы",
    rules: ({ days }) => [
      "Свой код нельга выкарыстаць для ўласных пакупак.",
      "Камісія лічыцца ад аплачанай сумы за тавары (пасля зніжкі пакупніка), без дастаўкі.",
      "Узровень залежыць ад агульнай колькасці прададзеных штук — вышэйшы працэнт дзейнічае з наступнага заказа.",
      `Камісія чакае ${days} дзён. Калі заказ скасаваны або вернуты, камісія адмяняецца.`,
    ],
    regulamin: "Поўныя правілы ў рэгламенце →",
    loading: "Загрузка…",
    loadError: "Не ўдалося загрузіць партнёрскую праграму.",
    retry: "Паспрабаваць зноў",
    err: {
      format: "Код: 4–16 знакаў, толькі літары A–Z і лічбы.",
      taken: "Гэты код заняты — выберы іншы.",
      exists: "У цябе ўжо ёсць партнёрскі код.",
      amount: "Сума меншая за мінімум.",
      balance: "Недастаткова даступных сродкаў.",
      iban: "Няправільны нумар рахунку (IBAN).",
      holder: "Увядзі імя і прозвішча ўладальніка рахунку.",
      adult: "Выплата на рахунак толькі для паўналетніх.",
      pending: "У цябе ўжо ёсць выплата ў апрацоўцы.",
    },
    errRate: "Занадта шмат спроб — паспрабуй крыху пазней.",
    errVerify: "Спачатку пацвердзі свой адрас e-mail.",
    errGeneric: "Нешта пайшло не так. Паспрабуй зноў.",
  },
  es: {
    eyebrow: "Programa de socios",
    pitchTitle: "Recomienda KalkMate y gana",
    pitch: (pct) => `Tus amigos obtienen un −${pct}% en KalkMate y tú una comisión por cada unidad vendida. Cuantas más recomendaciones, mayor porcentaje.`,
    howTitle: "Cómo funciona",
    how: ({ pct, days, minCash }) => [
      "Creas tu propio código y se lo envías a tus amigos — el código o tu enlace de recomendación.",
      `El comprador lo introduce en el campo «Código de descuento» y paga un ${pct}% menos.`,
      `Cuando se paga el pedido, recibes la comisión. Durante ${days} días está «en camino» (plazo de devoluciones) y después puedes cobrarla.`,
      `La cobras en tokens de IA (aprox. un 30% más que comprando un paquete) o por transferencia desde ${minCash} — transferencia solo para mayores de edad.`,
    ],
    tiersTitle: "Niveles de comisión",
    tierNames: { start: "Inicio", bronze: "Bronce", silver: "Plata", gold: "Oro", diamond: "Diamante" },
    colTier: "Nivel",
    colFrom: "Desde",
    colPct: "Comisión",
    colPerUnit: "Por unidad",
    fromUnits: (n) => (n === 0 ? "desde el inicio" : `desde ${n} uds.`),
    perUnitNote: (price, pct) => `«Por unidad» es una estimación para un precio de ${price} tras el descuento del comprador (−${pct}%).`,
    chooseCode: "Elige tu código",
    codeHint: "4–16 caracteres: letras A–Z y números, sin espacios. No podrás cambiar el código después.",
    codePlaceholder: "p. ej. LUCIA2026",
    createBtn: "Crear código",
    creating: "Creando…",
    yourCode: "Tu código",
    copy: "Copiar",
    copied: "Copiado ✓",
    shareLink: "Enlace de recomendación",
    share: "Compartir",
    shareText: (code, pct) => `KalkMate — calculadora con IA para exámenes. Con mi código ${code} tienes un −${pct}%:`,
    inactive: "Tu código está desactivado ahora mismo — los compradores no obtendrán descuento. Escríbenos si es un error.",
    yourTier: "Tu nivel",
    commission: (pct) => `${pct}% de comisión`,
    toNext: (n, name, pct) => `Te faltan ${n} uds. para el nivel ${name} (${pct}%)`,
    maxTier: "Tienes el nivel más alto — ¡gracias!",
    statUnits: "Unidades vendidas",
    statPending: "En camino",
    statAvailable: "Disponible",
    statTotal: "Total ganado",
    pendingHint: (days) => `se desbloquea tras ${days} días`,
    negative: "Tu saldo es negativo porque se anuló una comisión que ya habías cobrado. Las próximas comisiones lo compensarán.",
    redeemTitle: "Cobra tu comisión",
    amountLabel: "Importe (PLN)",
    toTokens: "Cambiar por tokens",
    tokensPreview: (s) => `= ${s} tokens de IA`,
    tokensBonus: "Aprox. un 30% más de tokens que comprando un paquete. Llegan a tu cuenta al instante.",
    confirmTokens: (a, s) => `¿Cambiar ${a} por ${s} tokens de IA? No se puede deshacer.`,
    toCash: "Retirar a mi cuenta",
    ibanLabel: "Número de cuenta (IBAN)",
    holderLabel: "Nombre y apellidos del titular",
    adultLabel: "Tengo 18 años o más",
    cashAdultOnly: "Transferencias solo para mayores de edad — si tienes menos de 18, cambia la comisión por tokens.",
    cashNote: "Normalmente pagamos por transferencia en un plazo de 7 días hábiles.",
    cashSubmit: "Solicitar pago",
    sending: "Enviando…",
    cancel: "Cancelar",
    minTokens: (s) => `Mínimo para tokens: ${s}`,
    minCash: (s) => `Transferencia mínima: ${s}`,
    tooMuch: "El importe supera tu saldo disponible.",
    cashPending: "Tienes un pago en curso — podrás pedir otro cuando se complete.",
    tokensDone: (s) => `Listo — ya tienes ${s} tokens en tu cuenta.`,
    cashDone: "Solicitud recibida. La transferencia suele llegar en 7 días hábiles.",
    historyCommissions: "Comisiones",
    historyPayouts: "Pagos y canjes",
    colDate: "Fecha",
    colOrder: "Pedido",
    colUnits: "Uds.",
    colAmount: "Importe",
    colStatus: "Estado",
    colKind: "Tipo",
    cStatus: { pending: "En camino", available: "Disponible", reversed: "Anulada" },
    pStatus: { done: "Completado", requested: "Solicitado", paid: "Pagado", rejected: "Rechazado" },
    availableFrom: (d) => `desde ${d}`,
    kindTokens: "Tokens",
    kindCash: "Transferencia",
    noCommissions: "Aún no hay nada — ¡envía tu código a tus amigos!",
    noPayouts: "Sin pagos.",
    showTiers: "Mostrar niveles de comisión",
    hideTiers: "Ocultar niveles de comisión",
    rulesTitle: "Reglas",
    rules: ({ days }) => [
      "No puedes usar tu propio código en tus compras.",
      "La comisión se calcula sobre el importe pagado por los productos (tras el descuento del comprador), sin envío.",
      "El nivel depende del total de unidades vendidas — el porcentaje mayor se aplica desde el siguiente pedido.",
      `La comisión se retiene ${days} días. Si el pedido se cancela o se reembolsa, la comisión se anula.`,
    ],
    regulamin: "Reglas completas en las condiciones →",
    loading: "Cargando…",
    loadError: "No se pudo cargar el programa de socios.",
    retry: "Reintentar",
    err: {
      format: "Código: 4–16 caracteres, solo letras A–Z y números.",
      taken: "Este código está ocupado — elige otro.",
      exists: "Ya tienes un código de socio.",
      amount: "El importe está por debajo del mínimo.",
      balance: "No tienes suficiente saldo disponible.",
      iban: "Número de cuenta (IBAN) no válido.",
      holder: "Indica el nombre y apellidos del titular.",
      adult: "Los pagos a cuenta son solo para mayores de edad.",
      pending: "Ya tienes un pago en curso.",
    },
    errRate: "Demasiados intentos — prueba de nuevo en un momento.",
    errVerify: "Primero confirma tu dirección de correo.",
    errGeneric: "Algo salió mal. Inténtalo de nuevo.",
  },
  pt: {
    eyebrow: "Programa de parceiros",
    pitchTitle: "Recomenda o KalkMate e ganha",
    pitch: (pct) => `Os teus amigos têm −${pct}% no KalkMate e tu recebes comissão por cada unidade vendida. Quanto mais recomendações, maior a percentagem.`,
    howTitle: "Como funciona",
    how: ({ pct, days, minCash }) => [
      "Crias o teu próprio código e envias aos amigos — o código ou o teu link de recomendação.",
      `O comprador insere-o no campo «Código de desconto» e paga menos ${pct}%.`,
      `Depois de a encomenda ser paga, recebes a comissão. Durante ${days} dias fica «a caminho» (prazo de devoluções) e depois podes levantá-la.`,
      `Levantas em tokens de IA (cerca de 30% mais do que comprando um pacote) ou por transferência a partir de ${minCash} — transferência só para maiores de idade.`,
    ],
    tiersTitle: "Níveis de comissão",
    tierNames: { start: "Início", bronze: "Bronze", silver: "Prata", gold: "Ouro", diamond: "Diamante" },
    colTier: "Nível",
    colFrom: "A partir de",
    colPct: "Comissão",
    colPerUnit: "Por unidade",
    fromUnits: (n) => (n === 0 ? "desde o início" : `a partir de ${n} un.`),
    perUnitNote: (price, pct) => `«Por unidade» é uma estimativa para o preço de ${price} após o desconto do comprador (−${pct}%).`,
    chooseCode: "Escolhe o teu código",
    codeHint: "4–16 caracteres: letras A–Z e números, sem espaços. Não podes alterar o código depois.",
    codePlaceholder: "ex. RITA2026",
    createBtn: "Criar código",
    creating: "A criar…",
    yourCode: "O teu código",
    copy: "Copiar",
    copied: "Copiado ✓",
    shareLink: "Link de recomendação",
    share: "Partilhar",
    shareText: (code, pct) => `KalkMate — calculadora com IA para exames. Com o meu código ${code} tens −${pct}%:`,
    inactive: "O teu código está desativado de momento — os compradores não terão desconto. Escreve-nos se for engano.",
    yourTier: "O teu nível",
    commission: (pct) => `${pct}% de comissão`,
    toNext: (n, name, pct) => `Faltam ${n} un. para o nível ${name} (${pct}%)`,
    maxTier: "Estás no nível mais alto — obrigado!",
    statUnits: "Unidades vendidas",
    statPending: "A caminho",
    statAvailable: "Disponível",
    statTotal: "Total ganho",
    pendingHint: (days) => `desbloqueia após ${days} dias`,
    negative: "O teu saldo está negativo porque foi anulada uma comissão que já levantaste. As próximas comissões vão compensar.",
    redeemTitle: "Levanta a tua comissão",
    amountLabel: "Valor (PLN)",
    toTokens: "Trocar por tokens",
    tokensPreview: (s) => `= ${s} tokens de IA`,
    tokensBonus: "Cerca de 30% mais tokens do que comprando um pacote. Chegam à conta de imediato.",
    confirmTokens: (a, s) => `Trocar ${a} por ${s} tokens de IA? Não é possível anular.`,
    toCash: "Transferir para a conta",
    ibanLabel: "Número de conta (IBAN)",
    holderLabel: "Nome completo do titular da conta",
    adultLabel: "Tenho 18 anos ou mais",
    cashAdultOnly: "Transferência só para maiores de idade — se tens menos de 18, troca a comissão por tokens.",
    cashNote: "Normalmente pagamos por transferência em até 7 dias úteis.",
    cashSubmit: "Pedir pagamento",
    sending: "A enviar…",
    cancel: "Cancelar",
    minTokens: (s) => `Mínimo para tokens: ${s}`,
    minCash: (s) => `Transferência mínima: ${s}`,
    tooMuch: "O valor é superior ao saldo disponível.",
    cashPending: "Tens um pagamento em curso — podes pedir outro quando estiver concluído.",
    tokensDone: (s) => `Feito — ${s} tokens já estão na tua conta.`,
    cashDone: "Pedido recebido. A transferência chega normalmente em até 7 dias úteis.",
    historyCommissions: "Comissões",
    historyPayouts: "Pagamentos e trocas",
    colDate: "Data",
    colOrder: "Encomenda",
    colUnits: "Un.",
    colAmount: "Valor",
    colStatus: "Estado",
    colKind: "Tipo",
    cStatus: { pending: "A caminho", available: "Disponível", reversed: "Anulada" },
    pStatus: { done: "Concluído", requested: "Pedido", paid: "Pago", rejected: "Rejeitado" },
    availableFrom: (d) => `a partir de ${d}`,
    kindTokens: "Tokens",
    kindCash: "Transferência",
    noCommissions: "Ainda nada — envia o teu código aos amigos!",
    noPayouts: "Sem pagamentos.",
    showTiers: "Mostrar níveis de comissão",
    hideTiers: "Ocultar níveis de comissão",
    rulesTitle: "Regras",
    rules: ({ days }) => [
      "Não podes usar o teu próprio código nas tuas compras.",
      "A comissão é calculada sobre o valor pago pelos produtos (após o desconto do comprador), sem portes.",
      "O nível depende do total de unidades vendidas — a percentagem maior aplica-se a partir da encomenda seguinte.",
      `A comissão fica retida ${days} dias. Se a encomenda for cancelada ou reembolsada, a comissão é anulada.`,
    ],
    regulamin: "Regras completas nos termos →",
    loading: "A carregar…",
    loadError: "Não foi possível carregar o programa de parceiros.",
    retry: "Tentar de novo",
    err: {
      format: "Código: 4–16 caracteres, só letras A–Z e números.",
      taken: "Este código está ocupado — escolhe outro.",
      exists: "Já tens um código de parceiro.",
      amount: "O valor está abaixo do mínimo.",
      balance: "Saldo disponível insuficiente.",
      iban: "Número de conta (IBAN) inválido.",
      holder: "Indica o nome completo do titular da conta.",
      adult: "Pagamentos para conta só para maiores de idade.",
      pending: "Já tens um pagamento em curso.",
    },
    errRate: "Demasiadas tentativas — tenta daqui a pouco.",
    errVerify: "Primeiro confirma o teu endereço de e-mail.",
    errGeneric: "Algo correu mal. Tenta de novo.",
  },
  fr: {
    eyebrow: "Programme de parrainage",
    pitchTitle: "Recommande KalkMate et gagne",
    pitch: (pct) => `Tes amis ont −${pct}% sur KalkMate, et toi une commission sur chaque unité vendue. Plus tu parraines, plus ton taux augmente.`,
    howTitle: "Comment ça marche",
    how: ({ pct, days, minCash }) => [
      "Tu crées ton propre code et l'envoies à tes amis — le code ou ton lien de parrainage.",
      `L'acheteur le saisit dans le champ « Code promo » et paie ${pct}% de moins.`,
      `Une fois la commande payée, tu reçois ta commission. Pendant ${days} jours elle est « en route » (délai de retour), ensuite tu peux la récupérer.`,
      `Tu la récupères en tokens IA (environ 30% de plus qu'en achetant un pack) ou par virement à partir de ${minCash} — virement réservé aux majeurs.`,
    ],
    tiersTitle: "Niveaux de commission",
    tierNames: { start: "Départ", bronze: "Bronze", silver: "Argent", gold: "Or", diamond: "Diamant" },
    colTier: "Niveau",
    colFrom: "Dès",
    colPct: "Commission",
    colPerUnit: "Par unité",
    fromUnits: (n) => (n === 0 ? "dès le départ" : `dès ${n} unités`),
    perUnitNote: (price, pct) => `« Par unité » est une estimation pour un prix de ${price} après la remise acheteur de −${pct}%.`,
    chooseCode: "Choisis ton code",
    codeHint: "4 à 16 caractères : lettres A–Z et chiffres, sans espaces. Le code ne pourra pas être modifié ensuite.",
    codePlaceholder: "ex. CHLOE2026",
    createBtn: "Créer le code",
    creating: "Création…",
    yourCode: "Ton code",
    copy: "Copier",
    copied: "Copié ✓",
    shareLink: "Lien de parrainage",
    share: "Partager",
    shareText: (code, pct) => `KalkMate — calculatrice avec IA pour les examens. Avec mon code ${code} tu as −${pct}% :`,
    inactive: "Ton code est actuellement désactivé — les acheteurs n'auront pas de remise. Écris-nous si c'est une erreur.",
    yourTier: "Ton niveau",
    commission: (pct) => `${pct}% de commission`,
    toNext: (n, name, pct) => `Encore ${n} unités pour le niveau ${name} (${pct}%)`,
    maxTier: "Tu es au niveau le plus élevé — merci !",
    statUnits: "Unités vendues",
    statPending: "En route",
    statAvailable: "Disponible",
    statTotal: "Total gagné",
    pendingHint: (days) => `débloqué après ${days} jours`,
    negative: "Ton solde est négatif car une commission déjà récupérée a été annulée. Les prochaines commissions compenseront.",
    redeemTitle: "Récupère ta commission",
    amountLabel: "Montant (PLN)",
    toTokens: "Échanger contre des tokens",
    tokensPreview: (s) => `= ${s} tokens IA`,
    tokensBonus: "Environ 30% de tokens en plus qu'en achetant un pack. Crédités immédiatement.",
    confirmTokens: (a, s) => `Échanger ${a} contre ${s} tokens IA ? Cette opération est irréversible.`,
    toCash: "Virer sur mon compte",
    ibanLabel: "Numéro de compte (IBAN)",
    holderLabel: "Nom et prénom du titulaire",
    adultLabel: "J'ai 18 ans ou plus",
    cashAdultOnly: "Virement réservé aux majeurs — si tu as moins de 18 ans, échange ta commission contre des tokens.",
    cashNote: "Nous payons par virement généralement sous 7 jours ouvrés.",
    cashSubmit: "Demander le virement",
    sending: "Envoi…",
    cancel: "Annuler",
    minTokens: (s) => `Minimum pour les tokens : ${s}`,
    minCash: (s) => `Virement minimum : ${s}`,
    tooMuch: "Le montant dépasse ton solde disponible.",
    cashPending: "Tu as un virement en cours — tu pourras en demander un autre une fois traité.",
    tokensDone: (s) => `C'est fait — ${s} tokens sont sur ton compte.`,
    cashDone: "Demande reçue. Le virement arrive généralement sous 7 jours ouvrés.",
    historyCommissions: "Commissions",
    historyPayouts: "Virements et échanges",
    colDate: "Date",
    colOrder: "Commande",
    colUnits: "Unités",
    colAmount: "Montant",
    colStatus: "Statut",
    colKind: "Type",
    cStatus: { pending: "En route", available: "Disponible", reversed: "Annulée" },
    pStatus: { done: "Effectué", requested: "Demandé", paid: "Versé", rejected: "Refusé" },
    availableFrom: (d) => `dès le ${d}`,
    kindTokens: "Tokens",
    kindCash: "Virement",
    noCommissions: "Rien pour l'instant — envoie ton code à tes amis !",
    noPayouts: "Aucun virement.",
    showTiers: "Afficher les niveaux de commission",
    hideTiers: "Masquer les niveaux de commission",
    rulesTitle: "Règles",
    rules: ({ days }) => [
      "Tu ne peux pas utiliser ton propre code pour tes achats.",
      "La commission est calculée sur le montant payé pour les produits (après la remise acheteur), hors livraison.",
      "Le niveau dépend du nombre total d'unités vendues — le taux supérieur s'applique dès la commande suivante.",
      `La commission est bloquée ${days} jours. Si la commande est annulée ou remboursée, la commission est annulée.`,
    ],
    regulamin: "Règles complètes dans les CGV →",
    loading: "Chargement…",
    loadError: "Impossible de charger le programme de parrainage.",
    retry: "Réessayer",
    err: {
      format: "Code : 4 à 16 caractères, lettres A–Z et chiffres uniquement.",
      taken: "Ce code est déjà pris — choisis-en un autre.",
      exists: "Tu as déjà un code de parrainage.",
      amount: "Le montant est inférieur au minimum.",
      balance: "Solde disponible insuffisant.",
      iban: "Numéro de compte (IBAN) invalide.",
      holder: "Indique le nom et prénom du titulaire.",
      adult: "Virement réservé aux majeurs.",
      pending: "Tu as déjà un virement en cours.",
    },
    errRate: "Trop de tentatives — réessaie dans un instant.",
    errVerify: "Confirme d'abord ton adresse e-mail.",
    errGeneric: "Un problème est survenu. Réessaie.",
  },
  it: {
    eyebrow: "Programma partner",
    pitchTitle: "Consiglia KalkMate e guadagna",
    pitch: (pct) => `I tuoi amici hanno il −${pct}% su KalkMate e tu una commissione su ogni unità venduta. Più consigli, più alta la percentuale.`,
    howTitle: "Come funziona",
    how: ({ pct, days, minCash }) => [
      "Crei il tuo codice e lo mandi agli amici — il codice o il tuo link di invito.",
      `L'acquirente lo inserisce nel campo «Codice sconto» e paga il ${pct}% in meno.`,
      `Quando l'ordine è pagato ricevi la commissione. Per ${days} giorni è «in arrivo» (tempo per i resi), poi puoi riscuoterla.`,
      `La riscuoti in token IA (circa il 30% in più rispetto all'acquisto di un pacchetto) o con bonifico da ${minCash} — bonifico solo per maggiorenni.`,
    ],
    tiersTitle: "Livelli di commissione",
    tierNames: { start: "Start", bronze: "Bronzo", silver: "Argento", gold: "Oro", diamond: "Diamante" },
    colTier: "Livello",
    colFrom: "Da",
    colPct: "Commissione",
    colPerUnit: "Per unità",
    fromUnits: (n) => (n === 0 ? "dall'inizio" : `da ${n} unità`),
    perUnitNote: (price, pct) => `«Per unità» è una stima per un prezzo di ${price} dopo lo sconto acquirente del −${pct}%.`,
    chooseCode: "Scegli il tuo codice",
    codeHint: "4–16 caratteri: lettere A–Z e cifre, senza spazi. Il codice non potrà essere cambiato.",
    codePlaceholder: "es. GIULIA2026",
    createBtn: "Crea codice",
    creating: "Creazione…",
    yourCode: "Il tuo codice",
    copy: "Copia",
    copied: "Copiato ✓",
    shareLink: "Link di invito",
    share: "Condividi",
    shareText: (code, pct) => `KalkMate — calcolatrice con IA per gli esami. Con il mio codice ${code} hai il −${pct}%:`,
    inactive: "Il tuo codice è disattivato al momento — gli acquirenti non avranno lo sconto. Scrivici se è un errore.",
    yourTier: "Il tuo livello",
    commission: (pct) => `${pct}% di commissione`,
    toNext: (n, name, pct) => `Ancora ${n} unità per il livello ${name} (${pct}%)`,
    maxTier: "Sei al livello più alto — grazie!",
    statUnits: "Unità vendute",
    statPending: "In arrivo",
    statAvailable: "Disponibile",
    statTotal: "Totale guadagnato",
    pendingHint: (days) => `si sblocca dopo ${days} giorni`,
    negative: "Il saldo è negativo perché è stata annullata una commissione che avevi già riscosso. Le prossime commissioni lo compenseranno.",
    redeemTitle: "Riscuoti la commissione",
    amountLabel: "Importo (PLN)",
    toTokens: "Cambia in token",
    tokensPreview: (s) => `= ${s} token IA`,
    tokensBonus: "Circa il 30% di token in più rispetto all'acquisto di un pacchetto. Accreditati subito.",
    confirmTokens: (a, s) => `Cambiare ${a} in ${s} token IA? L'operazione non è reversibile.`,
    toCash: "Preleva sul conto",
    ibanLabel: "Numero di conto (IBAN)",
    holderLabel: "Nome e cognome dell'intestatario",
    adultLabel: "Ho almeno 18 anni",
    cashAdultOnly: "Bonifico solo per maggiorenni — se hai meno di 18 anni, cambia la commissione in token.",
    cashNote: "Paghiamo con bonifico di solito entro 7 giorni lavorativi.",
    cashSubmit: "Richiedi pagamento",
    sending: "Invio…",
    cancel: "Annulla",
    minTokens: (s) => `Minimo per i token: ${s}`,
    minCash: (s) => `Bonifico minimo: ${s}`,
    tooMuch: "L'importo supera il saldo disponibile.",
    cashPending: "Hai un pagamento in corso — potrai richiederne un altro quando sarà completato.",
    tokensDone: (s) => `Fatto — ${s} token sono già sul tuo account.`,
    cashDone: "Richiesta ricevuta. Il bonifico arriva di solito entro 7 giorni lavorativi.",
    historyCommissions: "Commissioni",
    historyPayouts: "Pagamenti e cambi",
    colDate: "Data",
    colOrder: "Ordine",
    colUnits: "Unità",
    colAmount: "Importo",
    colStatus: "Stato",
    colKind: "Tipo",
    cStatus: { pending: "In arrivo", available: "Disponibile", reversed: "Annullata" },
    pStatus: { done: "Completato", requested: "Richiesto", paid: "Pagato", rejected: "Rifiutato" },
    availableFrom: (d) => `dal ${d}`,
    kindTokens: "Token",
    kindCash: "Bonifico",
    noCommissions: "Ancora niente — manda il tuo codice agli amici!",
    noPayouts: "Nessun pagamento.",
    showTiers: "Mostra livelli di commissione",
    hideTiers: "Nascondi livelli di commissione",
    rulesTitle: "Regole",
    rules: ({ days }) => [
      "Non puoi usare il tuo codice per i tuoi acquisti.",
      "La commissione si calcola sull'importo pagato per i prodotti (dopo lo sconto acquirente), spedizione esclusa.",
      "Il livello dipende dal totale delle unità vendute — la percentuale più alta vale dall'ordine successivo.",
      `La commissione resta in attesa ${days} giorni. Se l'ordine viene annullato o rimborsato, la commissione viene stornata.`,
    ],
    regulamin: "Regole complete nei termini →",
    loading: "Caricamento…",
    loadError: "Impossibile caricare il programma partner.",
    retry: "Riprova",
    err: {
      format: "Codice: 4–16 caratteri, solo lettere A–Z e cifre.",
      taken: "Questo codice è già preso — scegline un altro.",
      exists: "Hai già un codice partner.",
      amount: "L'importo è sotto il minimo.",
      balance: "Saldo disponibile insufficiente.",
      iban: "Numero di conto (IBAN) non valido.",
      holder: "Inserisci nome e cognome dell'intestatario.",
      adult: "Il pagamento su conto è solo per maggiorenni.",
      pending: "Hai già un pagamento in corso.",
    },
    errRate: "Troppi tentativi — riprova tra poco.",
    errVerify: "Prima conferma il tuo indirizzo e-mail.",
    errGeneric: "Qualcosa è andato storto. Riprova.",
  },
};

// --- style (jak karty w zakladce Ustawienia) ---
const CARD = "bg-[#0E0E0E] p-6 border border-[rgba(242,237,227,0.10)]";
const EYEBROW = "km-mono-eyebrow text-[#D8FF3D]";
const BTN_PRIMARY = "px-4 py-2 bg-[#D8FF3D] hover:bg-[#F2EDE3] text-[#0B0B0B] km-mono-eyebrow disabled:opacity-50 disabled:hover:bg-[#D8FF3D] transition-colors";
const BTN_GHOST = "px-4 py-2 border border-[rgba(242,237,227,0.20)] hover:border-[#D8FF3D] text-[#F2EDE3]/80 hover:text-[#D8FF3D] km-mono-eyebrow transition-colors disabled:opacity-50 disabled:hover:border-[rgba(242,237,227,0.20)] disabled:hover:text-[#F2EDE3]/80";
const INPUT = "w-full px-3 py-2.5 bg-[#0B0B0B] border border-[rgba(242,237,227,0.15)] focus:outline-none focus:border-[#D8FF3D] text-sm text-[#F2EDE3] placeholder:text-[#F2EDE3]/30 transition-colors";

const TONE: Record<"ok" | "warn" | "bad" | "muted", string> = {
  ok: "border-[#D8FF3D]/40 text-[#D8FF3D]",
  warn: "border-[#FFB800]/40 text-[#FFB800]",
  bad: "border-[#FF4D2E]/40 text-[#FF4D2E]",
  muted: "border-[rgba(242,237,227,0.20)] text-[#F2EDE3]/60",
};

function Badge({ tone, children }: { tone: keyof typeof TONE; children: React.ReactNode }) {
  return <span className={`inline-block px-2 py-0.5 border km-mono-eyebrow whitespace-nowrap ${TONE[tone]}`}>{children}</span>;
}

// "12,50" / "12.50" -> 1250 groszy (NaN gdy puste/zle)
function parseZl(v: string): number {
  const s = v.replace(/\s+/g, "").replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return NaN;
  return Math.round(parseFloat(s) * 100);
}

function fetchData(signal?: AbortSignal) {
  return fetchJson<AffiliateData>("/api/user/affiliate", { signal, cache: "no-store" });
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Starsze przegladarki / brak uprawnien
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export default function AffiliateTab({ lang }: { lang: Locale }) {
  const t = DICT[lang] ?? DICT.pl;
  const loc = NUM_LOCALE[lang] ?? "pl-PL";

  const [data, setData] = useState<AffiliateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(false);

  const [codeInput, setCodeInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [cashOpen, setCashOpen] = useState(false);
  const [iban, setIban] = useState("");
  const [holder, setHolder] = useState("");
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState<"tokens" | "cash" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [showTiers, setShowTiers] = useState(false);
  const [canShare] = useState(() => typeof navigator !== "undefined" && typeof navigator.share === "function");

  const money = useMemo(() => {
    const f = new Intl.NumberFormat(loc, { style: "currency", currency: "PLN" });
    return (cents: number) => f.format(cents / 100);
  }, [loc]);
  const compact = useMemo(() => {
    const f = new Intl.NumberFormat(loc, { notation: "compact", maximumFractionDigits: 1 });
    return (n: number) => f.format(n);
  }, [loc]);
  const fmtDate = useCallback((ms: number) => new Date(ms).toLocaleDateString(loc), [loc]);
  // Domyslna kwota w polu = cale dostepne saldo, z separatorem dziesietnym jezyka.
  const zlInput = useCallback(
    (cents: number) => {
      if (cents <= 0) return "";
      const dec = (1.5).toLocaleString(loc).replace(/\d/g, "") || ".";
      return (cents / 100).toFixed(2).replace(".", dec);
    },
    [loc]
  );

  const errText = useCallback(
    (r: FetchJsonResult) => {
      const reason = r.data?.reason as keyof Dict["err"] | undefined;
      if (reason && t.err[reason]) return t.err[reason];
      if (r.status === 429) return t.errRate;
      if (r.status === 403) return t.errVerify;
      return t.errGeneric;
    },
    [t]
  );

  const applyLoad = useCallback(
    (r: FetchJsonResult<AffiliateData>) => {
      if (r.aborted) return;
      if (r.ok && r.data) {
        setData(r.data);
        setAmount(zlInput(r.data.balance.availableCents));
        setLoadErr(false);
      } else {
        setLoadErr(true);
      }
      setLoading(false);
    },
    [zlInput]
  );
  const load = async () => applyLoad(await fetchData());

  useEffect(() => {
    const ac = new AbortController();
    fetchData(ac.signal).then(applyLoad);
    return () => ac.abort();
  }, [applyLoad]);

  async function createCode() {
    const code = codeInput.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,16}$/.test(code)) {
      setCreateErr(t.err.format);
      return;
    }
    setCreating(true);
    setCreateErr(null);
    const r = await sendJson("/api/user/affiliate", "POST", { code });
    if (r.ok) await load();
    else setCreateErr(errText(r));
    setCreating(false);
  }

  async function doCopy(text: string, which: "code" | "link") {
    if (await copyText(text)) {
      setCopied(which);
      setTimeout(() => setCopied((c) => (c === which ? null : c)), 1800);
    }
  }

  async function doShare() {
    if (!data?.code || !data.shareUrl) return;
    try {
      await navigator.share({ title: "KalkMate", text: t.shareText(data.code, data.config.buyerDiscountPct), url: data.shareUrl });
    } catch {
      /* anulowane przez uzytkownika */
    }
  }

  async function redeemTokens() {
    if (!data) return;
    const cents = parseZl(amount);
    const tokens = cents * data.config.tokensPerGrosz;
    if (!window.confirm(t.confirmTokens(money(cents), compact(tokens)))) return;
    setBusy("tokens");
    setMsg(null);
    const r = await sendJson("/api/user/affiliate/redeem", "POST", { kind: "tokens", amountCents: cents });
    if (r.ok) {
      setMsg({ ok: true, text: t.tokensDone(compact(Number(r.data?.tokens) || tokens)) });
      await load();
    } else setMsg({ ok: false, text: errText(r) });
    setBusy(null);
  }

  async function redeemCash() {
    if (!data) return;
    setBusy("cash");
    setMsg(null);
    const r = await sendJson("/api/user/affiliate/redeem", "POST", {
      kind: "cash",
      amountCents: parseZl(amount),
      iban,
      holder,
      adult,
    });
    if (r.ok) {
      setMsg({ ok: true, text: t.cashDone });
      setCashOpen(false);
      setIban("");
      setHolder("");
      setAdult(false);
      await load();
    } else setMsg({ ok: false, text: errText(r) });
    setBusy(null);
  }

  if (loading && !data) {
    return <p className="km-mono-eyebrow text-[#F2EDE3]/55">{t.loading}</p>;
  }
  if (!data) {
    return (
      <div className={`${CARD} max-w-2xl`}>
        <p className="text-sm text-[#FF4D2E] mb-3">{t.loadError}</p>
        {loadErr && (
          <button
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className={BTN_GHOST}
          >
            {t.retry}
          </button>
        )}
      </div>
    );
  }

  const cfg = data.config;
  const minCashStr = money(cfg.minCashCents);
  const perUnit = (pct: number) => Math.round((cfg.productCents * (100 - cfg.buyerDiscountPct) * pct) / 10000);

  const tierTable = (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left km-mono-eyebrow text-[#F2EDE3]/45">
              <th className="py-2 pr-4 font-normal">{t.colTier}</th>
              <th className="py-2 pr-4 font-normal">{t.colFrom}</th>
              <th className="py-2 pr-4 font-normal text-right">{t.colPct}</th>
              <th className="py-2 font-normal text-right">{t.colPerUnit}</th>
            </tr>
          </thead>
          <tbody>
            {data.tiers.map((tier) => {
              const current = !!data.code && tier.key === data.tier.key;
              return (
                <tr key={tier.key} className={`border-t border-[rgba(242,237,227,0.08)] ${current ? "text-[#D8FF3D]" : "text-[#F2EDE3]/85"}`}>
                  <td className="py-2.5 pr-4 whitespace-nowrap">
                    {t.tierNames[tier.key]}
                    {current && <span className="ml-2">●</span>}
                  </td>
                  <td className="py-2.5 pr-4 whitespace-nowrap text-[#F2EDE3]/60">{t.fromUnits(tier.minUnits)}</td>
                  <td className="py-2.5 pr-4 text-right font-mono">{tier.pct}%</td>
                  <td className="py-2.5 text-right font-mono whitespace-nowrap">≈ {money(perUnit(tier.pct))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[#F2EDE3]/40 mt-3">{t.perUnitNote(money(cfg.productCents), cfg.buyerDiscountPct)}</p>
    </div>
  );

  const rulesCard = (
    <div className={CARD}>
      <div className={`${EYEBROW} mb-3`}>{t.rulesTitle}</div>
      <ul className="space-y-2 text-sm text-[#F2EDE3]/70 leading-relaxed">
        {t.rules({ days: cfg.holdDays }).map((r, i) => (
          <li key={i} className="flex gap-3">
            <span className="text-[#D8FF3D]/70 shrink-0">—</span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
      <Link href="/regulamin#program-partnerski" className="inline-block mt-4 km-mono-eyebrow text-[#D8FF3D] hover:text-[#F2EDE3] transition-colors">
        {t.regulamin}
      </Link>
    </div>
  );

  // ===== Brak kodu: opis programu + utworzenie kodu =====
  if (!data.code) {
    return (
      <div className="max-w-3xl space-y-6">
        <div className={CARD}>
          <div className={`${EYEBROW} mb-3`}>{t.eyebrow}</div>
          <h2 className="km-display text-[clamp(30px,4.5vw,48px)] leading-[1.05]">{t.pitchTitle}</h2>
          <p className="text-[15px] text-[#F2EDE3]/70 mt-4 leading-relaxed max-w-xl">{t.pitch(cfg.buyerDiscountPct)}</p>
        </div>

        <div className={CARD}>
          <div className={`${EYEBROW} mb-4`}>{t.howTitle}</div>
          <ol className="space-y-3">
            {t.how({ pct: cfg.buyerDiscountPct, days: cfg.holdDays, minCash: minCashStr }).map((line, i) => (
              <li key={i} className="flex gap-4 text-sm text-[#F2EDE3]/75 leading-relaxed">
                <span className="km-mono-eyebrow text-[#D8FF3D] shrink-0 pt-0.5">{String(i + 1).padStart(2, "0")}</span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className={CARD}>
          <div className={`${EYEBROW} mb-2`}>{t.tiersTitle}</div>
          {tierTable}
        </div>

        <div className={CARD}>
          <div className={`${EYEBROW} mb-3`}>{t.chooseCode}</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={codeInput}
              onChange={(e) => {
                setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16));
                setCreateErr(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !creating) void createCode();
              }}
              placeholder={t.codePlaceholder}
              maxLength={16}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-label={t.chooseCode}
              className={`${INPUT} font-mono tracking-[0.12em] uppercase sm:flex-1`}
            />
            <button onClick={() => void createCode()} disabled={creating || codeInput.length < 4} className={`${BTN_PRIMARY} py-2.5 shrink-0`}>
              {creating ? t.creating : t.createBtn}
            </button>
          </div>
          <p className="text-xs text-[#F2EDE3]/40 mt-2">{t.codeHint}</p>
          {createErr && <div role="alert" className="text-xs mt-2 text-[#FF4D2E]">{createErr}</div>}
        </div>

        {rulesCard}
      </div>
    );
  }

  // ===== Ma kod: kod, poziom, saldo, odbior, historia =====
  const b = data.balance;
  const tier = data.tier;
  const next = data.next;
  const progress = next ? Math.min(1, Math.max(0, (data.units - tier.minUnits) / Math.max(1, next.minUnits - tier.minUnits))) : 1;

  const cents = parseZl(amount);
  const amountValid = Number.isFinite(cents) && cents > 0;
  const overBalance = amountValid && cents > b.availableCents;
  const cashPending = data.payouts.some((p) => p.kind === "cash" && p.status === "requested");
  const canTokens = amountValid && !overBalance && cents >= cfg.minTokenCents && busy === null;
  const canCashOpen = b.availableCents >= cfg.minCashCents && !cashPending;
  const canCashSubmit =
    amountValid && !overBalance && cents >= cfg.minCashCents && adult && iban.replace(/\s+/g, "").length >= 15 && holder.trim().length >= 3 && busy === null;

  const pStatusTone = (s: string): keyof typeof TONE =>
    s === "done" || s === "paid" ? "ok" : s === "requested" ? "warn" : s === "rejected" ? "bad" : "muted";
  const cStatusTone: Record<CommissionStatus, keyof typeof TONE> = { pending: "warn", available: "ok", reversed: "bad" };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Kod + link */}
      <div className={CARD}>
        <div className={`${EYEBROW} mb-3`}>{t.yourCode}</div>
        <div className="flex flex-wrap items-center gap-4">
          <span className="km-display text-[clamp(40px,7vw,72px)] leading-none tracking-wide text-[#F2EDE3] break-all">{data.code}</span>
          <button onClick={() => void doCopy(data.code!, "code")} className={BTN_GHOST}>
            {copied === "code" ? t.copied : t.copy}
          </button>
        </div>
        {!data.active && (
          <div role="status" className="mt-4 border border-[#FFB800]/40 bg-[#FFB800]/[0.06] p-3 text-sm text-[#FFB800]">
            {t.inactive}
          </div>
        )}
        {data.shareUrl && (
          <div className="mt-6 pt-5 border-t border-[rgba(242,237,227,0.10)]">
            <div className="km-mono-eyebrow text-[#F2EDE3]/45 mb-2">{t.shareLink}</div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input readOnly value={data.shareUrl} onFocus={(e) => e.currentTarget.select()} aria-label={t.shareLink} className={`${INPUT} font-mono sm:flex-1`} />
              <div className="flex gap-2 shrink-0">
                <button onClick={() => void doCopy(data.shareUrl!, "link")} className={BTN_PRIMARY}>
                  {copied === "link" ? t.copied : t.copy}
                </button>
                {canShare && (
                  <button onClick={() => void doShare()} className={BTN_GHOST}>
                    {t.share}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Poziom */}
      <div className={CARD}>
        <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
          <div>
            <div className="km-mono-eyebrow text-[#F2EDE3]/45 mb-1">{t.yourTier}</div>
            <div className="flex items-baseline gap-3">
              <span className="km-display text-[32px] leading-none text-[#D8FF3D]">{t.tierNames[tier.key]}</span>
              <Badge tone="ok">{t.commission(tier.pct)}</Badge>
            </div>
          </div>
          <div className="km-mono-eyebrow text-[#F2EDE3]/45">
            {data.units}
            {next ? ` / ${next.minUnits}` : ""}
          </div>
        </div>
        <div className="h-1.5 bg-[#F2EDE3]/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <div className="h-full bg-[#D8FF3D] transition-[width] duration-500" style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="text-sm text-[#F2EDE3]/60 mt-3">
          {next ? t.toNext(next.minUnits - data.units, t.tierNames[next.key], next.pct) : t.maxTier}
        </p>
      </div>

      {/* Statystyki */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[rgba(242,237,227,0.10)] border border-[rgba(242,237,227,0.10)]">
        {[
          { label: t.statUnits, value: String(data.units), hint: null as string | null, hl: false },
          { label: t.statPending, value: money(b.pendingCents), hint: t.pendingHint(cfg.holdDays), hl: false },
          { label: t.statAvailable, value: money(b.availableCents), hint: null, hl: true },
          { label: t.statTotal, value: money(b.earnedTotalCents), hint: null, hl: false },
        ].map((s) => (
          <div key={s.label} className="bg-[#0E0E0E] p-5">
            <div className="km-mono-eyebrow text-[#F2EDE3]/45 mb-2">{s.label}</div>
            <div className={`km-display text-[26px] md:text-[30px] leading-none ${s.hl ? "text-[#D8FF3D]" : "text-[#F2EDE3]"}`}>{s.value}</div>
            {s.hint && <div className="text-[11px] text-[#F2EDE3]/40 mt-2">{s.hint}</div>}
          </div>
        ))}
      </div>

      {/* Odbior prowizji */}
      <div className={CARD}>
        <div className={`${EYEBROW} mb-4`}>{t.redeemTitle}</div>
        {b.availableCents < 0 && (
          <div role="status" className="mb-4 border border-[#FFB800]/40 bg-[#FFB800]/[0.06] p-3 text-sm text-[#FFB800]">
            {t.negative}
          </div>
        )}
        <label className="block km-mono-eyebrow text-[#F2EDE3]/45 mb-2" htmlFor="aff-amount">
          {t.amountLabel}
        </label>
        <input
          id="aff-amount"
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setMsg(null);
          }}
          placeholder="0"
          autoComplete="off"
          className={`${INPUT} font-mono max-w-[220px]`}
        />
        {overBalance && <div className="text-xs mt-2 text-[#FF4D2E]">{t.tooMuch}</div>}

        <div className="grid md:grid-cols-2 gap-4 mt-5">
          {/* Tokeny */}
          <div className="border border-[rgba(242,237,227,0.10)] p-4 flex flex-col">
            <div className="km-display text-[22px] leading-tight text-[#F2EDE3]">
              {amountValid ? t.tokensPreview(compact(cents * cfg.tokensPerGrosz)) : t.tokensPreview("—")}
            </div>
            <p className="text-xs text-[#F2EDE3]/50 mt-2 leading-relaxed flex-1">{t.tokensBonus}</p>
            <p className="text-[11px] text-[#F2EDE3]/35 mt-2">{t.minTokens(money(cfg.minTokenCents))}</p>
            <button onClick={() => void redeemTokens()} disabled={!canTokens} className={`${BTN_PRIMARY} mt-3 self-start`}>
              {busy === "tokens" ? t.sending : t.toTokens}
            </button>
          </div>

          {/* Przelew */}
          <div className="border border-[rgba(242,237,227,0.10)] p-4 flex flex-col">
            <div className="km-display text-[22px] leading-tight text-[#F2EDE3]">{t.toCash}</div>
            <p className="text-xs text-[#F2EDE3]/50 mt-2 leading-relaxed flex-1">{t.cashAdultOnly}</p>
            <p className="text-[11px] text-[#F2EDE3]/35 mt-2">{t.minCash(minCashStr)}</p>
            {cashPending && <p className="text-xs text-[#FFB800] mt-2">{t.cashPending}</p>}
            {!cashOpen && (
              <button
                onClick={() => {
                  setCashOpen(true);
                  setMsg(null);
                }}
                disabled={!canCashOpen || busy !== null}
                className={`${BTN_GHOST} mt-3 self-start`}
              >
                {t.toCash}
              </button>
            )}
          </div>
        </div>

        {cashOpen && (
          <div className="mt-4 border border-[#D8FF3D]/30 bg-[#D8FF3D]/[0.03] p-4">
            <div className="space-y-2">
              <input
                type="text"
                value={iban}
                onChange={(e) => setIban(e.target.value.toUpperCase())}
                placeholder={t.ibanLabel}
                aria-label={t.ibanLabel}
                autoComplete="off"
                spellCheck={false}
                className={`${INPUT} font-mono`}
              />
              <input
                type="text"
                value={holder}
                onChange={(e) => setHolder(e.target.value)}
                placeholder={t.holderLabel}
                aria-label={t.holderLabel}
                autoComplete="name"
                maxLength={120}
                className={INPUT}
              />
            </div>
            <label className="flex items-center gap-2.5 mt-3 text-sm text-[#F2EDE3]/80 cursor-pointer select-none">
              <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="accent-[#D8FF3D] w-4 h-4" />
              {t.adultLabel}
            </label>
            <p className="text-xs text-[#F2EDE3]/45 mt-3">{t.cashNote}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => void redeemCash()} disabled={!canCashSubmit} className={BTN_PRIMARY}>
                {busy === "cash" ? t.sending : t.cashSubmit}
              </button>
              <button onClick={() => setCashOpen(false)} disabled={busy !== null} className={BTN_GHOST}>
                {t.cancel}
              </button>
            </div>
          </div>
        )}

        {msg && (
          <div role={msg.ok ? "status" : "alert"} className={`text-sm mt-4 ${msg.ok ? "text-[#D8FF3D]" : "text-[#FF4D2E]"}`}>
            {msg.text}
          </div>
        )}
      </div>

      {/* Historia prowizji */}
      <div className={CARD}>
        <div className={`${EYEBROW} mb-3`}>{t.historyCommissions}</div>
        {data.commissions.length === 0 ? (
          <p className="text-sm text-[#F2EDE3]/50">{t.noCommissions}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left km-mono-eyebrow text-[#F2EDE3]/45">
                  <th className="py-2 pr-4 font-normal">{t.colDate}</th>
                  <th className="py-2 pr-4 font-normal">{t.colOrder}</th>
                  <th className="py-2 pr-4 font-normal text-right">{t.colUnits}</th>
                  <th className="py-2 pr-4 font-normal text-right">{t.colAmount}</th>
                  <th className="py-2 font-normal">{t.colStatus}</th>
                </tr>
              </thead>
              <tbody>
                {data.commissions.map((c, i) => (
                  <tr key={`${c.orderNumber ?? ""}-${c.createdAt}-${i}`} className="border-t border-[rgba(242,237,227,0.08)] text-[#F2EDE3]/85">
                    <td className="py-2.5 pr-4 whitespace-nowrap text-[#F2EDE3]/60">{fmtDate(c.createdAt)}</td>
                    <td className="py-2.5 pr-4 whitespace-nowrap font-mono text-xs">{c.orderNumber ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-right font-mono">{c.units}</td>
                    <td className={`py-2.5 pr-4 text-right font-mono whitespace-nowrap ${c.status === "reversed" ? "line-through text-[#F2EDE3]/40" : ""}`}>
                      {money(c.amountCents)}
                      <span className="text-[#F2EDE3]/35 ml-1.5 text-xs">{c.pct}%</span>
                    </td>
                    <td className="py-2.5 whitespace-nowrap">
                      <Badge tone={cStatusTone[c.status] ?? "muted"}>{t.cStatus[c.status] ?? c.status}</Badge>
                      {c.status === "pending" && <span className="ml-2 text-xs text-[#F2EDE3]/40">{t.availableFrom(fmtDate(c.availableAt))}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Historia wyplat */}
      <div className={CARD}>
        <div className={`${EYEBROW} mb-3`}>{t.historyPayouts}</div>
        {data.payouts.length === 0 ? (
          <p className="text-sm text-[#F2EDE3]/50">{t.noPayouts}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left km-mono-eyebrow text-[#F2EDE3]/45">
                  <th className="py-2 pr-4 font-normal">{t.colDate}</th>
                  <th className="py-2 pr-4 font-normal">{t.colKind}</th>
                  <th className="py-2 pr-4 font-normal text-right">{t.colAmount}</th>
                  <th className="py-2 font-normal">{t.colStatus}</th>
                </tr>
              </thead>
              <tbody>
                {data.payouts.map((p, i) => (
                  <tr key={`${p.createdAt}-${i}`} className="border-t border-[rgba(242,237,227,0.08)] text-[#F2EDE3]/85">
                    <td className="py-2.5 pr-4 whitespace-nowrap text-[#F2EDE3]/60">{fmtDate(p.createdAt)}</td>
                    <td className="py-2.5 pr-4 whitespace-nowrap">
                      {p.kind === "tokens" ? t.kindTokens : t.kindCash}
                      <span className="ml-2 text-xs text-[#F2EDE3]/40 font-mono">
                        {p.kind === "tokens" && p.tokens ? compact(p.tokens) : p.iban ?? ""}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono whitespace-nowrap">{money(p.amountCents)}</td>
                    <td className="py-2.5 whitespace-nowrap">
                      <Badge tone={pStatusTone(p.status)}>{t.pStatus[p.status as keyof Dict["pStatus"]] ?? p.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Poziomy (zwiniete) */}
      <div className={CARD}>
        <button onClick={() => setShowTiers((v) => !v)} aria-expanded={showTiers} className={`${EYEBROW} hover:text-[#F2EDE3] transition-colors`}>
          {showTiers ? "−" : "+"} {showTiers ? t.hideTiers : t.showTiers}
        </button>
        {showTiers && <div className="mt-4">{tierTable}</div>}
      </div>

      {rulesCard}
    </div>
  );
}
