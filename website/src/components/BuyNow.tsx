"use client";

import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { InPostPoint } from "@/components/InPostGeowidget";
import type { ConfirmedPayment } from "@/components/CheckoutForm";
import { useCart } from "@/components/CartContext";
import { CONSENT_EVENT, hasAnalyticsConsent } from "@/components/consent";
import { rememberCallback } from "@/app/auth/callback";
import { type Locale } from "@/lib/i18n";
import {
  ALL_COUNTRY_CODES, countryName, flagEmoji, dialCode, regionsFor, showsOptionalRegion, cityWithRegion, postcodeHint,
} from "@/lib/countries";
import { readClientAttribution } from "@/lib/clientAttribution";
import {
  EU_COUNTRIES, MAX_ORDER_QUANTITY, PRODUCT_CENTS, PRODUCT_ID, PRODUCT_NAME,
  clampQuantity, currencyForCountry, formatMoney, shippingCentsFor, type ShopCurrency,
} from "@/lib/content/shop";

const InPostGeowidget = lazy(() => import("@/components/InPostGeowidget"));

// Stripe.js (js.stripe.com) i formularze platnosci laduja sie dopiero, gdy sa
// potrzebne (otwarty modal / etap platnosci) — nie na kazdym wejsciu na landing.
const PaymentLoading = () => (
  <div className="flex items-center justify-center py-10">
    <svg className="animate-spin h-6 w-6 text-[#D8FF3D]" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  </div>
);
const StripeProvider = dynamic(() => import("@/components/StripeProvider"), { ssr: false, loading: PaymentLoading });
const CheckoutForm = dynamic(() => import("@/components/CheckoutForm"), { ssr: false, loading: PaymentLoading });
const P24CheckoutForm = dynamic(() => import("@/components/P24CheckoutForm"), { ssr: false, loading: PaymentLoading });
const KlarnaMessaging = dynamic(() => import("@/components/KlarnaMessaging"), { ssr: false });

const INPOST_TOKEN = process.env.NEXT_PUBLIC_INPOST_GEOWIDGET_TOKEN || "";

const COUNTRIES = [
  { code: "PL", name: "🇵🇱 Polska — darmowa wysyłka InPost" },
  { code: "DE", name: "🇩🇪 Deutschland" },
  { code: "FR", name: "🇫🇷 France" },
  { code: "AT", name: "🇦🇹 Österreich" },
  { code: "CZ", name: "🇨🇿 Česká republika" },
  { code: "SK", name: "🇸🇰 Slovensko" },
  { code: "HU", name: "🇭🇺 Magyarország" },
  { code: "NL", name: "🇳🇱 Nederland" },
  { code: "BE", name: "🇧🇪 België / Belgique" },
  { code: "IT", name: "🇮🇹 Italia" },
  { code: "ES", name: "🇪🇸 España" },
  { code: "SE", name: "🇸🇪 Sverige" },
  { code: "DK", name: "🇩🇰 Danmark" },
  { code: "FI", name: "🇫🇮 Suomi" },
  { code: "PT", name: "🇵🇹 Portugal" },
  { code: "RO", name: "🇷🇴 România" },
  { code: "BG", name: "🇧🇬 България" },
  { code: "GR", name: "🇬🇷 Ελλάδα" },
  { code: "HR", name: "🇭🇷 Hrvatska" },
  { code: "GB", name: "🇬🇧 United Kingdom" },
  { code: "US", name: "🇺🇸 United States" },
  { code: "CA", name: "🇨🇦 Canada" },
  { code: "AU", name: "🇦🇺 Australia" },
  { code: "CH", name: "🇨🇭 Schweiz / Suisse" },
  { code: "NO", name: "🇳🇴 Norge" },
  { code: "IL", name: "🇮🇱 Israel" },
];
const FEATURED_CODES = new Set(COUNTRIES.map((c) => c.code));

// Reszta swiata pod wyroznionymi krajami — nazwy w jezyku strony, alfabetycznie.
function otherCountries(lang: Locale) {
  return ALL_COUNTRY_CODES.filter((c) => !FEATURED_CODES.has(c))
    .map((code) => ({ code, name: `${flagEmoji(code)} ${countryName(code, lang)}` }))
    .sort((a, b) => a.name.slice(a.name.indexOf(" ") + 1).localeCompare(b.name.slice(b.name.indexOf(" ") + 1), lang));
}

type Stage = "form" | "map" | "payment" | "error" | "success" | "processing" | "pending";

const content: Record<Locale, {
  eyebrow: string;
  h2a: string; h2italic: string; h2b: string; h2line2: string;
  intro: string;
  included: string[];
  badges: string[];
  stockAvailable: (n: number) => string;
  preSalePrice: string;
  discountPln: string;
  shippingEur: string;
  lowestPrice30d: string;
  production: string;
  productionNote1: string; productionNoteHand: string; productionNote2: string; productionNoteWeeks: string;
  orderNowPln: string; orderNowEur: string;
  addToCart: string;
  closeAria: string;
  shippingDetails: string;
  inpostParcel: string; euCourier: string; intlCourier: string;
  deliveryCountry: string;
  fullName: string;
  email: string;
  phone: string;
  invoiceAddress: string;
  street: string; streetPlaceholder: string;
  postcode: string; postcodePlaceholder: string;
  city: string; cityPlaceholder: string;
  region: string; regionUS: string; regionCA: string; regionAU: string; regionOptional: string; regionChoose: string;
  popularCountries: string; allCountries: string;
  phoneHint: string;
  pickupPoint: string;
  changePoint: string;
  selectParcel: string;
  intlDeliveryTitle: string; intlDeliveryNote1: string; intlDeliveryNote2: string;
  consent1: string; consentTerms: string; consent2: string;
  newsletterConsent: string;
  personalizeTitle: string;
  personalizeCodeLabel: string; personalizeCodePlaceholder: string; personalizeCodeHint: string;
  personalizeNameLabel: string; personalizeNamePlaceholder: string; personalizeNameHint: string;
  personalizeNotice: string;
  personalizeConsent: string;
  errPickupPoint: string; errFullAddress: string; errDeliveryAddress: string; errRegion: string;
  errPersonalizeCode: string; errPersonalizeName: string; errPersonalizeConsent: string;
  serverError: string; unexpectedError: string;
  loading: string; continueToPayment: string;
  selectParcelTitle: string; back: string; loadingMap: string;
  payment: string; shipping: string;
  paymentComplete: string; thankYou1: string; thankYou2: string;
  close: string;
  couponLabel: string; couponApply: string; couponRemove: string; couponTag: string; couponPlaceholder: string;
  couponInvalid: string; couponRejected: (reason?: string) => string; connectionError: string;
  total: string; free: string; or: string;
  emailFromAccount: string;
  klarnaTitle: string; klarnaSub: string;
  processingTitle: string; processingBody: string;
  pendingTitle: string; pendingBody1: string; pendingBody2: string; pendingBody3: string; pendingRetry: string;
  paymentFailed: string;
  quantityLabel: string; decrease: string; increase: string;
  quantityLimit: (max: number) => string; quantityStockLimit: (n: number) => string;
  perUnit: string; subtotal: string; shippingPerOrder: string;
  personalizeTitleMulti: (n: number) => string;
  sameCodeLabel: string;
  personalizeCodeLabelAll: string; personalizeCodeHintMulti: string; personalizeCodeHintEach: string;
  personalizeNameHintMulti: string;
  unitLabel: (i: number) => string; unitCode: string; unitName: string;
  personalizeConsentMulti: string;
  errPersonalizeCodeUnit: (i: number) => string; errPersonalizeNameUnit: (i: number) => string;
}> = {
  pl: {
    eyebrow: "[ 07 ] · Order",
    h2a: "Weź ", h2italic: "jeden", h2b: ".", h2line2: "Reszta to formalność.",
    intro: "KalkMate v3.0 — ręcznie składany w Polsce. Każda sztuka z indywidualnym numerem seryjnym i 24-miesięczną gwarancją. Dostawa darmowa do Paczkomatu InPost.",
    included: [
      "Urządzenie KalkMate v3.0",
      "6 naklejek znamionowych",
      "2 mln tokenów AI w zestawie (kod w pudełku)",
      "Instrukcja obsługi",
    ],
    badges: ["Bezpieczna płatność", "Personalizowany dla Ciebie", "Gwarancja 24 mc", "Wysyłka międzynarodowa"],
    stockAvailable: (n) => `${n} szt. dostępnych`,
    preSalePrice: "Cena przedsprzedażowa",
    discountPln: "Przedsprzedaż · darmowa wysyłka InPost",
    shippingEur: "InPost PL free · EU 20€ · World 35€",
    lowestPrice30d: "Najniższa cena z ostatnich 30 dni",
    production: "/ produkcja",
    productionNote1: "Urządzenia są ", productionNoteHand: "ręcznie składane", productionNote2: ". Czas realizacji do ", productionNoteWeeks: "4 tygodni",
    orderNowPln: "Zamów teraz · 699 zł", orderNowEur: "Zamów teraz · 169 EUR",
    addToCart: "Dodaj do koszyka",
    closeAria: "Zamknij",
    shippingDetails: "Dane do wysyłki",
    inpostParcel: "Paczkomat InPost", euCourier: "EU courier", intlCourier: "International courier",
    deliveryCountry: "Kraj dostawy",
    fullName: "Imię i nazwisko",
    email: "Email",
    phone: "Telefon",
    invoiceAddress: "/ Adres do faktury VAT",
    street: "Ulica i numer domu", streetPlaceholder: "np. Marszałkowska 1/2",
    postcode: "Kod pocztowy", postcodePlaceholder: "00-000",
    city: "Miasto", cityPlaceholder: "Warszawa",
    region: "Region", regionUS: "Stan", regionCA: "Prowincja", regionAU: "Stan / terytorium", regionOptional: "Województwo / region (opcjonalnie)", regionChoose: "— wybierz —",
    popularCountries: "Najczęściej wybierane", allCountries: "Wszystkie kraje",
    phoneHint: "Z numerem kierunkowym kraju — kurier zagraniczny dzwoni lub wysyła SMS.",
    pickupPoint: "Punkt odbioru",
    changePoint: "Zmień",
    selectParcel: "Wybierz Paczkomat InPost →",
    intlDeliveryTitle: "/ International delivery", intlDeliveryNote1: "Courier delivery to your address.", intlDeliveryNote2: "shipping fee · approx. 2–4 weeks",
    consent1: "Akceptuję ", consentTerms: "Regulamin Sklepu", consent2: " i wyrażam zgodę na przetwarzanie danych osobowych w celu realizacji zamówienia.",
    newsletterConsent: "Chcę dostawać e-mailem informacje o nowościach, promocjach i kuponach KalkMate (newsletter). Zgodę mogę wycofać w każdej chwili. (opcjonalnie)",
    personalizeTitle: "/ Personalizacja Twojego egzemplarza",
    personalizeCodeLabel: "Twój kod odblokowania AI (4 cyfry)", personalizeCodePlaceholder: "np. 4271",
    personalizeCodeHint: "Wgramy ten kod do Twojego egzemplarza przed wysyłką.",
    personalizeNameLabel: "Imię/nick na etykiecie urządzenia", personalizeNamePlaceholder: "np. Kacper",
    personalizeNameHint: "Wydrukujemy je na etykiecie Twojej sztuki.",
    personalizeNotice: "Każdy KalkMate jest personalizowany indywidualnie pod zamówienie (wybrany przez Ciebie kod AI wgrywany do tej konkretnej sztuki + imię na etykiecie). Zgodnie z art. 38 pkt 3 ustawy o prawach konsumenta, produkty personalizowane nie podlegają zwrotowi w ramach 14-dniowego prawa odstąpienia od umowy. Gwarancja 24 miesiące na wady nadal obowiązuje na standardowych zasadach.",
    personalizeConsent: "Rozumiem, że ten egzemplarz będzie personalizowany na moje życzenie i w związku z tym nie przysługuje mi prawo odstąpienia od umowy (zwrotu w ciągu 14 dni). Prawo do reklamacji z tytułu gwarancji i rękojmi pozostaje bez zmian.",
    errPickupPoint: "Wybierz punkt odbioru.", errFullAddress: "Podaj pełny adres (ulica, kod pocztowy, miasto) — wymagany do wystawienia faktury.", errDeliveryAddress: "Podaj pełny adres dostawy.", errRegion: "Wybierz stan / prowincję — kurier wymaga go do nadania paczki.",
    errPersonalizeCode: "Podaj 4-cyfrowy kod odblokowania AI.", errPersonalizeName: "Podaj imię/nick do etykiety.", errPersonalizeConsent: "Musisz potwierdzić zgodę na personalizację (wpływa na prawo zwrotu).",
    serverError: "Błąd serwera", unexpectedError: "Nieoczekiwany błąd.",
    loading: "Ładowanie...", continueToPayment: "Przejdź do płatności →",
    selectParcelTitle: "Wybierz Paczkomat", back: "← Wstecz", loadingMap: "Ładowanie mapy...",
    payment: "Płatność", shipping: "Wysyłka",
    paymentComplete: "Płatność zakończona.", thankYou1: "Dziękujemy za zamówienie. Potwierdzenie wysłaliśmy na", thankYou2: ". Wysyłka w ciągu 4 tygodni.",
    close: "Zamknij",
    couponLabel: "Kod rabatowy", couponApply: "Zastosuj", couponRemove: "Usuń", couponTag: "Kupon", couponPlaceholder: "np. MATURA2026",
    couponInvalid: "Nieprawidłowy kupon.",
    couponRejected: (r) => `Kupon nie jest już ważny${r ? ` (${r})` : ""} i został usunięty z zamówienia — sprawdź kwotę i spróbuj ponownie.`,
    connectionError: "Błąd połączenia.",
    total: "RAZEM", free: "GRATIS", or: "LUB",
    emailFromAccount: "Adres z Twojego konta — na niego wyślemy potwierdzenie zamówienia.",
    klarnaTitle: "Klarna — zapłać później lub w ratach", klarnaSub: "Odroczona płatność · przez Stripe",
    processingTitle: "Sprawdzamy płatność…", processingBody: "Poczekaj chwilę — weryfikujemy potwierdzenie płatności.",
    pendingTitle: "Płatność nie potwierdzona", pendingBody1: "Nie otrzymaliśmy jeszcze potwierdzenia płatności.",
    pendingBody2: "Jeśli płatność przeszła, wyślemy email z potwierdzeniem na", pendingBody3: " w ciągu kilku minut.",
    pendingRetry: "Jeśli płatność została anulowana, możesz spróbować ponownie.",
    paymentFailed: "Płatność nie powiodła się lub została anulowana. Spróbuj ponownie.",
    quantityLabel: "Ilość", decrease: "Zmniejsz ilość", increase: "Zwiększ ilość",
    quantityLimit: (m) => `max ${m} szt. na zamówienie`, quantityStockLimit: (n) => `dostępne: ${n} szt.`,
    perUnit: "/ szt.", subtotal: "Produkty", shippingPerOrder: "jedna paczka — wysyłka nie zależy od ilości",
    personalizeTitleMulti: (n) => `/ Personalizacja egzemplarzy (${n} szt.)`,
    sameCodeLabel: "Ten sam kod AI dla wszystkich sztuk",
    personalizeCodeLabelAll: "Kod odblokowania AI dla wszystkich sztuk (4 cyfry)",
    personalizeCodeHintMulti: "Wgramy ten kod do każdej zamówionej sztuki przed wysyłką.",
    personalizeCodeHintEach: "Każda sztuka dostanie własny kod — wpisz 4 cyfry przy każdej.",
    personalizeNameHintMulti: "Imię/nick wydrukujemy na etykiecie danej sztuki.",
    unitLabel: (i) => `Sztuka ${i}`, unitCode: "Kod AI", unitName: "Imię/nick na etykiecie",
    personalizeConsentMulti: "Rozumiem, że te egzemplarze będą personalizowane na moje życzenie i w związku z tym nie przysługuje mi prawo odstąpienia od umowy (zwrotu w ciągu 14 dni). Prawo do reklamacji z tytułu gwarancji i rękojmi pozostaje bez zmian.",
    errPersonalizeCodeUnit: (i) => `Podaj 4-cyfrowy kod odblokowania AI dla sztuki ${i}.`,
    errPersonalizeNameUnit: (i) => `Podaj imię/nick do etykiety dla sztuki ${i}.`,
  },
  en: {
    eyebrow: "[ 07 ] · Order",
    h2a: "Get ", h2italic: "one", h2b: ".", h2line2: "The rest is a formality.",
    intro: "KalkMate v3.0 — hand-assembled in Poland. Each unit has an individual serial number and a 24-month warranty. Free delivery to InPost Parcel Locker.",
    included: [
      "KalkMate v3.0 device",
      "6 rating-plate stickers",
      "2M AI tokens included (code in the box)",
      "User manual",
    ],
    badges: ["Secure payment", "Personalized for you", "24-month warranty", "International shipping"],
    stockAvailable: (n) => `${n} in stock`,
    preSalePrice: "Pre-sale price",
    discountPln: "Pre-sale · free InPost shipping",
    shippingEur: "InPost PL free · EU 20€ · World 35€",
    lowestPrice30d: "Lowest price in the last 30 days",
    production: "/ production",
    productionNote1: "Devices are ", productionNoteHand: "hand-assembled", productionNote2: ". Lead time up to ", productionNoteWeeks: "4 weeks",
    orderNowPln: "Order now · 699 zł", orderNowEur: "Order now · 169 EUR",
    addToCart: "Add to cart",
    closeAria: "Close",
    shippingDetails: "Shipping details",
    inpostParcel: "InPost Parcel Locker", euCourier: "EU courier", intlCourier: "International courier",
    deliveryCountry: "Delivery country",
    fullName: "Full name",
    email: "Email",
    phone: "Phone",
    invoiceAddress: "/ Delivery & invoice address",
    street: "Street address", streetPlaceholder: "e.g. Berliner Str. 12",
    postcode: "Postcode / ZIP", postcodePlaceholder: "12345",
    city: "City", cityPlaceholder: "Berlin",
    region: "Region", regionUS: "State", regionCA: "Province / territory", regionAU: "State / territory", regionOptional: "State / province / region (optional)", regionChoose: "— select —",
    popularCountries: "Popular", allCountries: "All countries",
    phoneHint: "Include the country code — the courier may call or text you.",
    pickupPoint: "Pickup point",
    changePoint: "Change",
    selectParcel: "Choose InPost Parcel Locker →",
    intlDeliveryTitle: "/ International delivery", intlDeliveryNote1: "Courier delivery to your address.", intlDeliveryNote2: "shipping fee · approx. 2–4 weeks",
    consent1: "I accept the ", consentTerms: "Terms and Conditions", consent2: " and consent to the processing of my personal data for order fulfillment.",
    newsletterConsent: "Send me KalkMate news, promotions and coupons by email (newsletter). I can withdraw this at any time. (optional)",
    personalizeTitle: "/ Personalize your unit",
    personalizeCodeLabel: "Your AI unlock code (4 digits)", personalizeCodePlaceholder: "e.g. 4271",
    personalizeCodeHint: "We'll flash this code onto your specific unit before shipping.",
    personalizeNameLabel: "Name/nickname for the device label", personalizeNamePlaceholder: "e.g. Alex",
    personalizeNameHint: "We'll print it on your unit's label.",
    personalizeNotice: "Each KalkMate is individually personalized for your order (the AI code you choose is flashed onto this specific unit + your name is printed on its label). Under EU consumer law (custom-made goods), personalized products are excluded from the standard 14-day right of withdrawal. The 24-month warranty for defects remains unaffected.",
    personalizeConsent: "I understand this unit will be personalized at my request and therefore I do not have the right to withdraw from the contract (14-day return). My statutory warranty rights remain unaffected.",
    errPickupPoint: "Choose a pickup point.", errFullAddress: "Please provide your full address (street, postcode, city) — required for the invoice.", errDeliveryAddress: "Please provide your full delivery address.", errRegion: "Please select your state / province — the courier requires it.",
    errPersonalizeCode: "Please provide a 4-digit AI unlock code.", errPersonalizeName: "Please provide a name/nickname for the label.", errPersonalizeConsent: "You must confirm the personalization consent (it affects your return rights).",
    serverError: "Server error", unexpectedError: "Unexpected error.",
    loading: "Loading...", continueToPayment: "Continue to payment →",
    selectParcelTitle: "Choose Parcel Locker", back: "← Back", loadingMap: "Loading map...",
    payment: "Payment", shipping: "Shipping",
    paymentComplete: "Payment complete.", thankYou1: "Thank you for your order. Confirmation sent to", thankYou2: ". Shipping within 4 weeks.",
    close: "Close",
    couponLabel: "Discount code", couponApply: "Apply", couponRemove: "Remove", couponTag: "Coupon", couponPlaceholder: "e.g. MATURA2026",
    couponInvalid: "Invalid coupon code.",
    couponRejected: () => "This coupon is no longer valid and has been removed from your order — please check the total and try again.",
    connectionError: "Connection error.",
    total: "TOTAL", free: "FREE", or: "OR",
    emailFromAccount: "Your account email — we'll send the order confirmation here.",
    klarnaTitle: "Klarna — pay later or in instalments", klarnaSub: "Deferred payment · via Stripe",
    processingTitle: "Checking your payment…", processingBody: "One moment — we're verifying the payment confirmation.",
    pendingTitle: "Payment not confirmed yet", pendingBody1: "We haven't received the payment confirmation yet.",
    pendingBody2: "If the payment went through, we'll email a confirmation to", pendingBody3: " within a few minutes.",
    pendingRetry: "If the payment was cancelled, you can try again.",
    paymentFailed: "The payment failed or was cancelled. Please try again.",
    quantityLabel: "Quantity", decrease: "Decrease quantity", increase: "Increase quantity",
    quantityLimit: (m) => `max ${m} units per order`, quantityStockLimit: (n) => `${n} available`,
    perUnit: "/ ea.", subtotal: "Products", shippingPerOrder: "one parcel — shipping doesn't depend on quantity",
    personalizeTitleMulti: (n) => `/ Personalize your units (${n})`,
    sameCodeLabel: "Same AI code for all units",
    personalizeCodeLabelAll: "AI unlock code for all units (4 digits)",
    personalizeCodeHintMulti: "We'll flash this code onto every unit in your order before shipping.",
    personalizeCodeHintEach: "Each unit gets its own code — enter 4 digits for each one.",
    personalizeNameHintMulti: "We'll print the name/nickname on that unit's label.",
    unitLabel: (i) => `Unit ${i}`, unitCode: "AI code", unitName: "Name/nickname on label",
    personalizeConsentMulti: "I understand these units will be personalized at my request and therefore I do not have the right to withdraw from the contract (14-day return). My statutory warranty rights remain unaffected.",
    errPersonalizeCodeUnit: (i) => `Please provide a 4-digit AI unlock code for unit ${i}.`,
    errPersonalizeNameUnit: (i) => `Please provide a name/nickname for the label of unit ${i}.`,
  },
  de: {
    eyebrow: "[ 07 ] · Order",
    h2a: "Nimm ", h2italic: "eins", h2b: ".", h2line2: "Der Rest ist Formsache.",
    intro: "KalkMate v3.0 — handmontiert in Polen. Jedes Gerät mit individueller Seriennummer und 24 Monaten Garantie. Kostenlose Lieferung an InPost-Paketstation.",
    included: [
      "KalkMate v3.0 Gerät",
      "6 Typenschild-Aufkleber",
      "2 Mio. KI-Tokens inklusive (Code in der Verpackung)",
      "Bedienungsanleitung",
    ],
    badges: ["Sichere Zahlung", "Für dich personalisiert", "24 Monate Garantie", "Internationaler Versand"],
    stockAvailable: (n) => `${n} auf Lager`,
    preSalePrice: "Vorverkaufspreis",
    discountPln: "Vorverkauf · kostenloser InPost-Versand",
    shippingEur: "InPost PL gratis · EU 20€ · Welt 35€",
    lowestPrice30d: "Niedrigster Preis der letzten 30 Tage",
    production: "/ Produktion",
    productionNote1: "Die Geräte werden ", productionNoteHand: "handmontiert", productionNote2: ". Lieferzeit bis zu ", productionNoteWeeks: "4 Wochen",
    orderNowPln: "Jetzt bestellen · 699 zł", orderNowEur: "Jetzt bestellen · 169 EUR",
    addToCart: "In den Warenkorb",
    closeAria: "Schließen",
    shippingDetails: "Versanddetails",
    inpostParcel: "InPost-Paketstation", euCourier: "EU-Kurier", intlCourier: "Internationaler Kurier",
    deliveryCountry: "Lieferland",
    fullName: "Vollständiger Name",
    email: "E-Mail",
    phone: "Telefon",
    invoiceAddress: "/ Liefer- & Rechnungsadresse",
    street: "Straße und Hausnummer", streetPlaceholder: "z. B. Berliner Str. 12",
    postcode: "Postleitzahl", postcodePlaceholder: "12345",
    city: "Stadt", cityPlaceholder: "Berlin",
    region: "Region", regionUS: "Bundesstaat", regionCA: "Provinz / Territorium", regionAU: "Bundesstaat / Territorium", regionOptional: "Bundesland / Region (optional)", regionChoose: "— auswählen —",
    popularCountries: "Häufig gewählt", allCountries: "Alle Länder",
    phoneHint: "Mit Ländervorwahl — der Kurier ruft ggf. an oder schickt eine SMS.",
    pickupPoint: "Abholpunkt",
    changePoint: "Ändern",
    selectParcel: "InPost-Paketstation wählen →",
    intlDeliveryTitle: "/ Internationale Lieferung", intlDeliveryNote1: "Kurierlieferung an Ihre Adresse.", intlDeliveryNote2: "Versandkosten · ca. 2–4 Wochen",
    consent1: "Ich akzeptiere die ", consentTerms: "AGB", consent2: " und willige in die Verarbeitung meiner personenbezogenen Daten zur Auftragsabwicklung ein.",
    newsletterConsent: "Ich möchte Neuigkeiten, Aktionen und Gutscheine von KalkMate per E-Mail erhalten (Newsletter). Widerruf jederzeit möglich. (optional)",
    personalizeTitle: "/ Personalisiere dein Gerät",
    personalizeCodeLabel: "Dein KI-Freischaltcode (4 Ziffern)", personalizeCodePlaceholder: "z. B. 4271",
    personalizeCodeHint: "Wir spielen diesen Code vor dem Versand auf dein Gerät auf.",
    personalizeNameLabel: "Name/Spitzname für das Geräteetikett", personalizeNamePlaceholder: "z. B. Alex",
    personalizeNameHint: "Wir drucken ihn auf das Etikett deines Geräts.",
    personalizeNotice: "Jedes KalkMate wird individuell für deine Bestellung personalisiert (der von dir gewählte KI-Code wird auf dieses Gerät aufgespielt + dein Name wird auf dem Etikett gedruckt). Gemäß EU-Verbraucherrecht sind personalisierte/nach Kundenspezifikation angefertigte Waren vom 14-tägigen Widerrufsrecht ausgeschlossen. Die 24-monatige Gewährleistung für Mängel bleibt davon unberührt.",
    personalizeConsent: "Ich verstehe, dass dieses Gerät auf meinen Wunsch personalisiert wird und mir daher kein Widerrufsrecht (14-tägige Rückgabe) zusteht. Meine gesetzlichen Gewährleistungsrechte bleiben unberührt.",
    errPickupPoint: "Bitte einen Abholpunkt wählen.", errFullAddress: "Bitte vollständige Adresse angeben (Straße, Postleitzahl, Stadt) — für die Rechnung erforderlich.", errDeliveryAddress: "Bitte geben Sie Ihre vollständige Lieferadresse an.", errRegion: "Bitte Bundesstaat / Provinz wählen — der Kurier benötigt sie.",
    errPersonalizeCode: "Bitte einen 4-stelligen KI-Freischaltcode angeben.", errPersonalizeName: "Bitte einen Namen/Spitznamen für das Etikett angeben.", errPersonalizeConsent: "Du musst der Personalisierung zustimmen (betrifft dein Rückgaberecht).",
    serverError: "Serverfehler", unexpectedError: "Unerwarteter Fehler.",
    loading: "Wird geladen...", continueToPayment: "Zur Zahlung →",
    selectParcelTitle: "Paketstation wählen", back: "← Zurück", loadingMap: "Karte wird geladen...",
    payment: "Zahlung", shipping: "Versand",
    paymentComplete: "Zahlung abgeschlossen.", thankYou1: "Vielen Dank für Ihre Bestellung. Bestätigung gesendet an", thankYou2: ". Versand innerhalb von 4 Wochen.",
    close: "Schließen",
    couponLabel: "Rabattcode", couponApply: "Anwenden", couponRemove: "Entfernen", couponTag: "Gutschein", couponPlaceholder: "z. B. MATURA2026",
    couponInvalid: "Ungültiger Gutscheincode.",
    couponRejected: () => "Dieser Gutschein ist nicht mehr gültig und wurde aus der Bestellung entfernt — bitte Betrag prüfen und erneut versuchen.",
    connectionError: "Verbindungsfehler.",
    total: "GESAMT", free: "GRATIS", or: "ODER",
    emailFromAccount: "E-Mail aus deinem Konto — hierhin senden wir die Bestellbestätigung.",
    klarnaTitle: "Klarna — später oder in Raten bezahlen", klarnaSub: "Spätere Zahlung · über Stripe",
    processingTitle: "Zahlung wird geprüft…", processingBody: "Einen Moment — wir prüfen die Zahlungsbestätigung.",
    pendingTitle: "Zahlung noch nicht bestätigt", pendingBody1: "Wir haben noch keine Zahlungsbestätigung erhalten.",
    pendingBody2: "Falls die Zahlung erfolgreich war, senden wir in wenigen Minuten eine Bestätigung an", pendingBody3: ".",
    pendingRetry: "Falls die Zahlung abgebrochen wurde, kannst du es erneut versuchen.",
    paymentFailed: "Die Zahlung ist fehlgeschlagen oder wurde abgebrochen. Bitte versuche es erneut.",
    quantityLabel: "Menge", decrease: "Menge verringern", increase: "Menge erhöhen",
    quantityLimit: (m) => `max. ${m} Stück pro Bestellung`, quantityStockLimit: (n) => `verfügbar: ${n} Stück`,
    perUnit: "/ Stk.", subtotal: "Produkte", shippingPerOrder: "ein Paket — Versandkosten unabhängig von der Menge",
    personalizeTitleMulti: (n) => `/ Personalisiere deine Geräte (${n} Stk.)`,
    sameCodeLabel: "Gleicher KI-Code für alle Geräte",
    personalizeCodeLabelAll: "KI-Freischaltcode für alle Geräte (4 Ziffern)",
    personalizeCodeHintMulti: "Wir spielen diesen Code vor dem Versand auf jedes bestellte Gerät auf.",
    personalizeCodeHintEach: "Jedes Gerät bekommt einen eigenen Code — gib bei jedem 4 Ziffern ein.",
    personalizeNameHintMulti: "Den Namen/Spitznamen drucken wir auf das Etikett des jeweiligen Geräts.",
    unitLabel: (i) => `Gerät ${i}`, unitCode: "KI-Code", unitName: "Name/Spitzname auf dem Etikett",
    personalizeConsentMulti: "Ich verstehe, dass diese Geräte auf meinen Wunsch personalisiert werden und mir daher kein Widerrufsrecht (14-tägige Rückgabe) zusteht. Meine gesetzlichen Gewährleistungsrechte bleiben unberührt.",
    errPersonalizeCodeUnit: (i) => `Bitte einen 4-stelligen KI-Freischaltcode für Gerät ${i} angeben.`,
    errPersonalizeNameUnit: (i) => `Bitte einen Namen/Spitznamen für das Etikett von Gerät ${i} angeben.`,
  },
  cs: {
    eyebrow: "[ 07 ] · Order",
    h2a: "Vezmi si ", h2italic: "jednu", h2b: ".", h2line2: "Zbytek je formalita.",
    intro: "KalkMate v3.0 — ručně sestavovaný v Polsku. Každý kus má vlastní sériové číslo a záruku 24 měsíců. Doručení kurýrem až k vám domů.",
    included: [
      "Zařízení KalkMate v3.0",
      "6 typových štítků (samolepek)",
      "2 mil. AI tokenů v balení (kód v krabičce)",
      "Návod k obsluze",
    ],
    badges: ["Bezpečná platba", "Personalizováno pro tebe", "Záruka 24 měsíců", "Mezinárodní doprava"],
    stockAvailable: (n) => `${n} ks skladem`,
    preSalePrice: "Předprodejní cena",
    discountPln: "Předprodej · doprava InPost zdarma",
    shippingEur: "InPost PL zdarma · EU 20€ · svět 35€",
    lowestPrice30d: "Nejnižší cena za posledních 30 dní",
    production: "/ výroba",
    productionNote1: "Zařízení jsou ", productionNoteHand: "ručně sestavována", productionNote2: ". Dodací lhůta až ", productionNoteWeeks: "4 týdny",
    orderNowPln: "Objednat · 699 zł", orderNowEur: "Objednat · 169 EUR",
    addToCart: "Přidat do košíku",
    closeAria: "Zavřít",
    shippingDetails: "Doručovací údaje",
    inpostParcel: "Výdejní box InPost", euCourier: "Kurýr EU", intlCourier: "Mezinárodní kurýr",
    deliveryCountry: "Země doručení",
    fullName: "Jméno a příjmení",
    email: "E-mail",
    phone: "Telefon",
    invoiceAddress: "/ Doručovací a fakturační adresa",
    street: "Ulice a číslo popisné", streetPlaceholder: "např. Vodičkova 12",
    postcode: "PSČ", postcodePlaceholder: "110 00",
    city: "Město", cityPlaceholder: "Praha",
    region: "Region", regionUS: "Stát", regionCA: "Provincie / teritorium", regionAU: "Stát / teritorium", regionOptional: "Kraj / region (nepovinné)", regionChoose: "— vyberte —",
    popularCountries: "Nejčastěji vybírané", allCountries: "Všechny země",
    phoneHint: "S mezinárodní předvolbou — kurýr vám může zavolat nebo poslat SMS.",
    pickupPoint: "Výdejní místo",
    changePoint: "Změnit",
    selectParcel: "Vybrat výdejní box InPost →",
    intlDeliveryTitle: "/ Mezinárodní doručení", intlDeliveryNote1: "Doručení kurýrem na vaši adresu.", intlDeliveryNote2: "poštovné · cca 2–4 týdny",
    consent1: "Souhlasím s ", consentTerms: "obchodními podmínkami", consent2: " a se zpracováním osobních údajů za účelem vyřízení objednávky.",
    newsletterConsent: "Chci e-mailem dostávat novinky, akce a slevové kupóny KalkMate (newsletter). Souhlas mohu kdykoli odvolat. (nepovinné)",
    personalizeTitle: "/ Personalizace tvého kusu",
    personalizeCodeLabel: "Tvůj kód pro odemčení AI (4 číslice)", personalizeCodePlaceholder: "např. 4271",
    personalizeCodeHint: "Tento kód nahrajeme do tvého kusu ještě před odesláním.",
    personalizeNameLabel: "Jméno/přezdívka na štítek zařízení", personalizeNamePlaceholder: "např. Tomáš",
    personalizeNameHint: "Vytiskneme ji na štítek tvého kusu.",
    personalizeNotice: "Každý KalkMate je personalizován individuálně na objednávku (zvolený AI kód je nahrán do tohoto konkrétního kusu + jméno je vytištěno na štítku). Podle spotřebitelského práva EU (§ 1837 písm. d) občanského zákoníku — zboží upravené podle přání spotřebitele) se na personalizované výrobky nevztahuje 14denní lhůta pro odstoupení od smlouvy. Záruka 24 měsíců na vady platí za standardních podmínek.",
    personalizeConsent: "Beru na vědomí, že tento kus bude personalizován na mé přání, a proto nemám právo odstoupit od smlouvy (vrácení do 14 dnů). Moje zákonná práva z vadného plnění a záruky zůstávají nedotčena.",
    errPickupPoint: "Vyberte výdejní místo.", errFullAddress: "Zadejte úplnou adresu (ulice, PSČ, město) — je nutná pro vystavení faktury.", errDeliveryAddress: "Zadejte úplnou doručovací adresu.", errRegion: "Vyberte stát / provincii — kurýr ji vyžaduje k odeslání zásilky.",
    errPersonalizeCode: "Zadejte 4místný kód pro odemčení AI.", errPersonalizeName: "Zadejte jméno/přezdívku na štítek.", errPersonalizeConsent: "Musíte potvrdit souhlas s personalizací (ovlivňuje právo na vrácení).",
    serverError: "Chyba serveru", unexpectedError: "Neočekávaná chyba.",
    loading: "Načítání...", continueToPayment: "Pokračovat k platbě →",
    selectParcelTitle: "Vyberte výdejní box", back: "← Zpět", loadingMap: "Načítání mapy...",
    payment: "Platba", shipping: "Doprava",
    paymentComplete: "Platba dokončena.", thankYou1: "Děkujeme za objednávku. Potvrzení jsme poslali na", thankYou2: ". Odeslání do 4 týdnů.",
    close: "Zavřít",
    couponLabel: "Slevový kód", couponApply: "Použít", couponRemove: "Odebrat", couponTag: "Kupón", couponPlaceholder: "např. MATURA2026",
    couponInvalid: "Neplatný slevový kód.",
    couponRejected: () => "Tento kupón už neplatí a byl z objednávky odebrán — zkontrolujte prosím částku a zkuste to znovu.",
    connectionError: "Chyba připojení.",
    total: "CELKEM", free: "ZDARMA", or: "NEBO",
    emailFromAccount: "E-mail z vašeho účtu — sem pošleme potvrzení objednávky.",
    klarnaTitle: "Klarna — zaplaťte později nebo na splátky", klarnaSub: "Odložená platba · přes Stripe",
    processingTitle: "Ověřujeme platbu…", processingBody: "Chvilku strpení — ověřujeme potvrzení platby.",
    pendingTitle: "Platba zatím nebyla potvrzena", pendingBody1: "Potvrzení platby jsme zatím neobdrželi.",
    pendingBody2: "Pokud platba proběhla, během několika minut pošleme potvrzení na", pendingBody3: ".",
    pendingRetry: "Pokud byla platba zrušena, můžete to zkusit znovu.",
    paymentFailed: "Platba se nezdařila nebo byla zrušena. Zkuste to prosím znovu.",
    quantityLabel: "Množství", decrease: "Snížit množství", increase: "Zvýšit množství",
    quantityLimit: (m) => `max. ${m} ks na objednávku`, quantityStockLimit: (n) => `k dispozici: ${n} ks`,
    perUnit: "/ ks", subtotal: "Produkty", shippingPerOrder: "jeden balík — doprava nezávisí na množství",
    personalizeTitleMulti: (n) => `/ Personalizace kusů (${n} ks)`,
    sameCodeLabel: "Stejný AI kód pro všechny kusy",
    personalizeCodeLabelAll: "Kód pro odemčení AI pro všechny kusy (4 číslice)",
    personalizeCodeHintMulti: "Tento kód nahrajeme před odesláním do každého objednaného kusu.",
    personalizeCodeHintEach: "Každý kus dostane vlastní kód — u každého zadejte 4 číslice.",
    personalizeNameHintMulti: "Jméno/přezdívku vytiskneme na štítek daného kusu.",
    unitLabel: (i) => `Kus ${i}`, unitCode: "AI kód", unitName: "Jméno/přezdívka na štítku",
    personalizeConsentMulti: "Beru na vědomí, že tyto kusy budou personalizovány na mé přání, a proto nemám právo odstoupit od smlouvy (vrácení do 14 dnů). Moje zákonná práva z vadného plnění a záruky zůstávají nedotčena.",
    errPersonalizeCodeUnit: (i) => `Zadejte 4místný kód pro odemčení AI pro kus ${i}.`,
    errPersonalizeNameUnit: (i) => `Zadejte jméno/přezdívku na štítek pro kus ${i}.`,
  },
  // Klauzule personalizacji ponizej (sk/lt/be/es/pt/fr/it) celowo ogolne —
  // wyjatek od prawa odstapienia dla towarow wyprodukowanych wg specyfikacji
  // konsumenta / wyraznie spersonalizowanych (art. 16 lit. c dyrektywy
  // 2011/83/UE), bez powolywania sie na konkretne przepisy krajowe.
  sk: {
    eyebrow: "[ 07 ] · Order",
    h2a: "Zober si ", h2italic: "jednu", h2b: ".", h2line2: "Zvyšok je formalita.",
    intro: "KalkMate v3.0 — ručne zostavovaný v Poľsku. Každý kus má vlastné sériové číslo a záruku 24 mesiacov. Doručenie kuriérom až k vám domov.",
    included: [
      "Zariadenie KalkMate v3.0",
      "6 typových štítkov (nálepiek)",
      "2 mil. AI tokenov v balení (kód v krabičke)",
      "Návod na obsluhu",
    ],
    badges: ["Bezpečná platba", "Personalizované pre teba", "Záruka 24 mesiacov", "Medzinárodná doprava"],
    stockAvailable: (n) => `${n} ks na sklade`,
    preSalePrice: "Predpredajová cena",
    discountPln: "Predpredaj · doprava InPost zadarmo",
    shippingEur: "InPost PL zadarmo · EÚ 20€ · svet 35€",
    lowestPrice30d: "Najnižšia cena za posledných 30 dní",
    production: "/ výroba",
    productionNote1: "Zariadenia sú ", productionNoteHand: "ručne zostavované", productionNote2: ". Dodacia lehota až ", productionNoteWeeks: "4 týždne",
    orderNowPln: "Objednať · 699 zł", orderNowEur: "Objednať · 169 EUR",
    addToCart: "Pridať do košíka",
    closeAria: "Zavrieť",
    shippingDetails: "Doručovacie údaje",
    inpostParcel: "Výdajný box InPost", euCourier: "Kuriér EÚ", intlCourier: "Medzinárodný kuriér",
    deliveryCountry: "Krajina doručenia",
    fullName: "Meno a priezvisko",
    email: "E-mail",
    phone: "Telefón",
    invoiceAddress: "/ Doručovacia a fakturačná adresa",
    street: "Ulica a číslo domu", streetPlaceholder: "napr. Obchodná 12",
    postcode: "PSČ", postcodePlaceholder: "811 06",
    city: "Mesto", cityPlaceholder: "Bratislava",
    region: "Región", regionUS: "Štát", regionCA: "Provincia / teritórium", regionAU: "Štát / teritórium", regionOptional: "Kraj / región (nepovinné)", regionChoose: "— vyberte —",
    popularCountries: "Najčastejšie vyberané", allCountries: "Všetky krajiny",
    phoneHint: "S medzinárodnou predvoľbou — kuriér vám môže zavolať alebo poslať SMS.",
    pickupPoint: "Výdajné miesto",
    changePoint: "Zmeniť",
    selectParcel: "Vybrať výdajný box InPost →",
    intlDeliveryTitle: "/ Medzinárodné doručenie", intlDeliveryNote1: "Doručenie kuriérom na vašu adresu.", intlDeliveryNote2: "poštovné · cca 2–4 týždne",
    consent1: "Súhlasím s ", consentTerms: "obchodnými podmienkami", consent2: " a so spracovaním osobných údajov na účely vybavenia objednávky.",
    newsletterConsent: "Chcem e-mailom dostávať novinky, akcie a zľavové kupóny KalkMate (newsletter). Súhlas môžem kedykoľvek odvolať. (nepovinné)",
    personalizeTitle: "/ Personalizácia tvojho kusu",
    personalizeCodeLabel: "Tvoj kód na odomknutie AI (4 číslice)", personalizeCodePlaceholder: "napr. 4271",
    personalizeCodeHint: "Tento kód nahráme do tvojho kusu ešte pred odoslaním.",
    personalizeNameLabel: "Meno/prezývka na štítok zariadenia", personalizeNamePlaceholder: "napr. Martin",
    personalizeNameHint: "Vytlačíme ju na štítok tvojho kusu.",
    personalizeNotice: "Každý KalkMate je personalizovaný individuálne na objednávku (zvolený AI kód sa nahrá do tohto konkrétneho kusu + meno sa vytlačí na štítok). Podľa spotrebiteľského práva EÚ sa na tovar vyrobený podľa špecifikácie spotrebiteľa alebo jednoznačne prispôsobený jeho osobným potrebám nevzťahuje 14-dňové právo na odstúpenie od zmluvy. Záruka 24 mesiacov na vady platí za štandardných podmienok.",
    personalizeConsent: "Beriem na vedomie, že tento kus bude personalizovaný na moje želanie, a preto nemám právo odstúpiť od zmluvy (vrátenie do 14 dní). Moje zákonné práva zo zodpovednosti za vady a zo záruky zostávajú nedotknuté.",
    errPickupPoint: "Vyberte výdajné miesto.", errFullAddress: "Zadajte úplnú adresu (ulica, PSČ, mesto) — je potrebná na vystavenie faktúry.", errDeliveryAddress: "Zadajte úplnú doručovaciu adresu.", errRegion: "Vyberte štát / provinciu — kuriér ju vyžaduje na odoslanie zásielky.",
    errPersonalizeCode: "Zadajte 4-miestny kód na odomknutie AI.", errPersonalizeName: "Zadajte meno/prezývku na štítok.", errPersonalizeConsent: "Musíte potvrdiť súhlas s personalizáciou (ovplyvňuje právo na vrátenie).",
    serverError: "Chyba servera", unexpectedError: "Neočakávaná chyba.",
    loading: "Načítava sa...", continueToPayment: "Pokračovať na platbu →",
    selectParcelTitle: "Vyberte výdajný box", back: "← Späť", loadingMap: "Načítava sa mapa...",
    payment: "Platba", shipping: "Doprava",
    paymentComplete: "Platba dokončená.", thankYou1: "Ďakujeme za objednávku. Potvrdenie sme poslali na", thankYou2: ". Odoslanie do 4 týždňov.",
    close: "Zavrieť",
    couponLabel: "Zľavový kód", couponApply: "Použiť", couponRemove: "Odstrániť", couponTag: "Kupón", couponPlaceholder: "napr. MATURA2026",
    couponInvalid: "Neplatný zľavový kód.",
    couponRejected: () => "Tento kupón už neplatí a bol z objednávky odstránený — skontrolujte prosím sumu a skúste to znova.",
    connectionError: "Chyba pripojenia.",
    total: "SPOLU", free: "ZADARMO", or: "ALEBO",
    emailFromAccount: "E-mail z vášho účtu — sem pošleme potvrdenie objednávky.",
    klarnaTitle: "Klarna — zaplaťte neskôr alebo na splátky", klarnaSub: "Odložená platba · cez Stripe",
    processingTitle: "Overujeme platbu…", processingBody: "Chvíľku strpenia — overujeme potvrdenie platby.",
    pendingTitle: "Platba zatiaľ nebola potvrdená", pendingBody1: "Potvrdenie platby sme zatiaľ nedostali.",
    pendingBody2: "Ak platba prebehla, do niekoľkých minút pošleme potvrdenie na", pendingBody3: ".",
    pendingRetry: "Ak bola platba zrušená, môžete to skúsiť znova.",
    paymentFailed: "Platba zlyhala alebo bola zrušená. Skúste to prosím znova.",
    quantityLabel: "Množstvo", decrease: "Znížiť množstvo", increase: "Zvýšiť množstvo",
    quantityLimit: (m) => `max. ${m} ks na objednávku`, quantityStockLimit: (n) => `k dispozícii: ${n} ks`,
    perUnit: "/ ks", subtotal: "Produkty", shippingPerOrder: "jeden balík — doprava nezávisí od množstva",
    personalizeTitleMulti: (n) => `/ Personalizácia kusov (${n} ks)`,
    sameCodeLabel: "Rovnaký AI kód pre všetky kusy",
    personalizeCodeLabelAll: "Kód na odomknutie AI pre všetky kusy (4 číslice)",
    personalizeCodeHintMulti: "Tento kód nahráme pred odoslaním do každého objednaného kusu.",
    personalizeCodeHintEach: "Každý kus dostane vlastný kód — pri každom zadajte 4 číslice.",
    personalizeNameHintMulti: "Meno/prezývku vytlačíme na štítok daného kusu.",
    unitLabel: (i) => `Kus ${i}`, unitCode: "AI kód", unitName: "Meno/prezývka na štítku",
    personalizeConsentMulti: "Beriem na vedomie, že tieto kusy budú personalizované na moje želanie, a preto nemám právo odstúpiť od zmluvy (vrátenie do 14 dní). Moje zákonné práva zo zodpovednosti za vady a zo záruky zostávajú nedotknuté.",
    errPersonalizeCodeUnit: (i) => `Zadajte 4-miestny kód na odomknutie AI pre kus ${i}.`,
    errPersonalizeNameUnit: (i) => `Zadajte meno/prezývku na štítok pre kus ${i}.`,
  },
  lt: {
    eyebrow: "[ 07 ] · Order",
    h2a: "Pasiimk ", h2italic: "vieną", h2b: ".", h2line2: "Visa kita — formalumas.",
    intro: "KalkMate v3.0 — rankomis surinktas Lenkijoje. Kiekvienas egzempliorius turi individualų serijos numerį ir 24 mėnesių garantiją. Pristatymas kurjeriu iki jūsų durų.",
    included: [
      "KalkMate v3.0 įrenginys",
      "6 vardinės plokštelės lipdukai",
      "2 mln. DI žetonų komplekte (kodas dėžutėje)",
      "Naudojimo instrukcija",
    ],
    badges: ["Saugus mokėjimas", "Personalizuotas jums", "24 mėn. garantija", "Tarptautinis pristatymas"],
    stockAvailable: (n) => `Sandėlyje: ${n} vnt.`,
    preSalePrice: "Išankstinio pardavimo kaina",
    discountPln: "Išankstinis pardavimas · nemokamas InPost pristatymas",
    shippingEur: "InPost PL nemokamai · ES 20€ · pasaulis 35€",
    lowestPrice30d: "Mažiausia kaina per pastarąsias 30 dienų",
    production: "/ gamyba",
    productionNote1: "Įrenginiai ", productionNoteHand: "surenkami rankomis", productionNote2: ". Įvykdymo laikas iki ", productionNoteWeeks: "4 savaičių",
    orderNowPln: "Užsakyti · 699 zł", orderNowEur: "Užsakyti · 169 EUR",
    addToCart: "Į krepšelį",
    closeAria: "Uždaryti",
    shippingDetails: "Pristatymo duomenys",
    inpostParcel: "InPost paštomatas", euCourier: "ES kurjeris", intlCourier: "Tarptautinis kurjeris",
    deliveryCountry: "Pristatymo šalis",
    fullName: "Vardas ir pavardė",
    email: "El. paštas",
    phone: "Telefonas",
    invoiceAddress: "/ Pristatymo ir sąskaitos adresas",
    street: "Gatvė ir namo numeris", streetPlaceholder: "pvz. Gedimino pr. 12",
    postcode: "Pašto kodas", postcodePlaceholder: "LT-01103",
    city: "Miestas", cityPlaceholder: "Vilnius",
    region: "Regionas", regionUS: "Valstija", regionCA: "Provincija / teritorija", regionAU: "Valstija / teritorija", regionOptional: "Apskritis / regionas (neprivaloma)", regionChoose: "— pasirinkite —",
    popularCountries: "Dažniausiai pasirenkamos", allCountries: "Visos šalys",
    phoneHint: "Su šalies kodu — kurjeris gali paskambinti arba atsiųsti SMS.",
    pickupPoint: "Atsiėmimo vieta",
    changePoint: "Keisti",
    selectParcel: "Pasirinkti InPost paštomatą →",
    intlDeliveryTitle: "/ Tarptautinis pristatymas", intlDeliveryNote1: "Pristatymas kurjeriu jūsų adresu.", intlDeliveryNote2: "pristatymo mokestis · apie 2–4 savaites",
    consent1: "Sutinku su ", consentTerms: "parduotuvės taisyklėmis", consent2: " ir su asmens duomenų tvarkymu užsakymui įvykdyti.",
    newsletterConsent: "Noriu el. paštu gauti KalkMate naujienas, akcijas ir nuolaidų kuponus (naujienlaiškis). Sutikimą galiu bet kada atšaukti. (neprivaloma)",
    personalizeTitle: "/ Jūsų egzemplioriaus personalizavimas",
    personalizeCodeLabel: "Jūsų DI atrakinimo kodas (4 skaitmenys)", personalizeCodePlaceholder: "pvz. 4271",
    personalizeCodeHint: "Šį kodą įrašysime į jūsų egzempliorių prieš išsiuntimą.",
    personalizeNameLabel: "Vardas / slapyvardis įrenginio etiketei", personalizeNamePlaceholder: "pvz. Lukas",
    personalizeNameHint: "Atspausdinsime jį ant jūsų egzemplioriaus etiketės.",
    personalizeNotice: "Kiekvienas KalkMate individualiai personalizuojamas pagal užsakymą (jūsų pasirinktas DI kodas įrašomas į šį konkretų egzempliorių + vardas atspausdinamas ant etiketės). Pagal ES vartotojų teisę 14 dienų teisė atsisakyti sutarties netaikoma prekėms, pagamintoms pagal vartotojo nurodymus arba aiškiai pritaikytoms jo asmeniniams poreikiams. 24 mėnesių garantija dėl defektų galioja įprastomis sąlygomis.",
    personalizeConsent: "Suprantu, kad šis egzempliorius bus personalizuotas mano prašymu, todėl neturiu teisės atsisakyti sutarties (grąžinti per 14 dienų). Mano įstatyminės teisės dėl prekės defektų ir garantijos lieka nepakitusios.",
    errPickupPoint: "Pasirinkite atsiėmimo vietą.", errFullAddress: "Nurodykite visą adresą (gatvė, pašto kodas, miestas) — jis reikalingas sąskaitai išrašyti.", errDeliveryAddress: "Nurodykite visą pristatymo adresą.", errRegion: "Pasirinkite valstiją / provinciją — jos reikia kurjeriui.",
    errPersonalizeCode: "Nurodykite 4 skaitmenų DI atrakinimo kodą.", errPersonalizeName: "Nurodykite vardą / slapyvardį etiketei.", errPersonalizeConsent: "Turite patvirtinti sutikimą dėl personalizavimo (tai turi įtakos grąžinimo teisei).",
    serverError: "Serverio klaida", unexpectedError: "Netikėta klaida.",
    loading: "Įkeliama...", continueToPayment: "Pereiti prie mokėjimo →",
    selectParcelTitle: "Pasirinkite paštomatą", back: "← Atgal", loadingMap: "Įkeliamas žemėlapis...",
    payment: "Mokėjimas", shipping: "Pristatymas",
    paymentComplete: "Mokėjimas atliktas.", thankYou1: "Dėkojame už užsakymą. Patvirtinimą išsiuntėme adresu", thankYou2: ". Išsiuntimas per 4 savaites.",
    close: "Uždaryti",
    couponLabel: "Nuolaidos kodas", couponApply: "Taikyti", couponRemove: "Pašalinti", couponTag: "Kuponas", couponPlaceholder: "pvz. MATURA2026",
    couponInvalid: "Neteisingas nuolaidos kodas.",
    couponRejected: () => "Šis kuponas nebegalioja ir buvo pašalintas iš užsakymo — patikrinkite sumą ir bandykite dar kartą.",
    connectionError: "Ryšio klaida.",
    total: "IŠ VISO", free: "NEMOKAMAI", or: "ARBA",
    emailFromAccount: "Jūsų paskyros el. paštas — čia išsiųsime užsakymo patvirtinimą.",
    klarnaTitle: "Klarna — mokėkite vėliau arba dalimis", klarnaSub: "Atidėtas mokėjimas · per Stripe",
    processingTitle: "Tikriname mokėjimą…", processingBody: "Akimirką — tikriname mokėjimo patvirtinimą.",
    pendingTitle: "Mokėjimas dar nepatvirtintas", pendingBody1: "Dar negavome mokėjimo patvirtinimo.",
    pendingBody2: "Jei mokėjimas pavyko, per kelias minutes išsiųsime patvirtinimą adresu", pendingBody3: ".",
    pendingRetry: "Jei mokėjimas buvo atšauktas, galite bandyti dar kartą.",
    paymentFailed: "Mokėjimas nepavyko arba buvo atšauktas. Bandykite dar kartą.",
    quantityLabel: "Kiekis", decrease: "Sumažinti kiekį", increase: "Padidinti kiekį",
    quantityLimit: (m) => `daugiausia ${m} vnt. užsakyme`, quantityStockLimit: (n) => `turima: ${n} vnt.`,
    perUnit: "/ vnt.", subtotal: "Prekės", shippingPerOrder: "viena siunta — pristatymo kaina nepriklauso nuo kiekio",
    personalizeTitleMulti: (n) => `/ Egzempliorių personalizavimas (${n} vnt.)`,
    sameCodeLabel: "Tas pats DI kodas visiems egzemplioriams",
    personalizeCodeLabelAll: "DI atrakinimo kodas visiems egzemplioriams (4 skaitmenys)",
    personalizeCodeHintMulti: "Šį kodą prieš išsiuntimą įrašysime į kiekvieną užsakytą egzempliorių.",
    personalizeCodeHintEach: "Kiekvienas egzempliorius gaus savo kodą — prie kiekvieno įveskite 4 skaitmenis.",
    personalizeNameHintMulti: "Vardą / slapyvardį atspausdinsime ant atitinkamo egzemplioriaus etiketės.",
    unitLabel: (i) => `Egzempliorius ${i}`, unitCode: "DI kodas", unitName: "Vardas / slapyvardis etiketėje",
    personalizeConsentMulti: "Suprantu, kad šie egzemplioriai bus personalizuoti mano prašymu, todėl neturiu teisės atsisakyti sutarties (grąžinti per 14 dienų). Mano įstatyminės teisės dėl prekės defektų ir garantijos lieka nepakitusios.",
    errPersonalizeCodeUnit: (i) => `Nurodykite 4 skaitmenų DI atrakinimo kodą egzemplioriui Nr. ${i}.`,
    errPersonalizeNameUnit: (i) => `Nurodykite vardą / slapyvardį egzemplioriaus Nr. ${i} etiketei.`,
  },
  be: {
    eyebrow: "[ 07 ] · Order",
    h2a: "Вазьмі ", h2italic: "адзін", h2b: ".", h2line2: "Астатняе — фармальнасць.",
    intro: "KalkMate v3.0 — ручная зборка ў Польшчы. Кожны экзэмпляр мае індывідуальны серыйны нумар і гарантыю 24 месяцы. Дастаўка кур'ерам да дзвярэй.",
    included: [
      "Прылада KalkMate v3.0",
      "6 наклеек-шыльдаў",
      "2 млн AI-токенаў у камплекце (код у скрынцы)",
      "Інструкцыя карыстальніка",
    ],
    badges: ["Бяспечная аплата", "Персаналізаваны для цябе", "Гарантыя 24 месяцы", "Міжнародная дастаўка"],
    stockAvailable: (n) => `У наяўнасці: ${n} шт.`,
    preSalePrice: "Цана перадпродажу",
    discountPln: "Перадпродаж · бясплатная дастаўка InPost",
    shippingEur: "InPost PL бясплатна · ЕС 20€ · свет 35€",
    lowestPrice30d: "Найніжэйшая цана за апошнія 30 дзён",
    production: "/ вытворчасць",
    productionNote1: "Прылады ", productionNoteHand: "збіраюцца ўручную", productionNote2: ". Тэрмін выканання — да ", productionNoteWeeks: "4 тыдняў",
    orderNowPln: "Замовіць · 699 zł", orderNowEur: "Замовіць · 169 EUR",
    addToCart: "Дадаць у кошык",
    closeAria: "Закрыць",
    shippingDetails: "Даныя для дастаўкі",
    inpostParcel: "Паштамат InPost", euCourier: "Кур'ер ЕС", intlCourier: "Міжнародны кур'ер",
    deliveryCountry: "Краіна дастаўкі",
    fullName: "Імя і прозвішча",
    email: "Email",
    phone: "Тэлефон",
    invoiceAddress: "/ Адрас дастаўкі і рахунку",
    street: "Вуліца і нумар дома", streetPlaceholder: "напр. Berliner Str. 12",
    postcode: "Паштовы індэкс", postcodePlaceholder: "12345",
    city: "Горад", cityPlaceholder: "Berlin",
    region: "Рэгіён", regionUS: "Штат", regionCA: "Правінцыя / тэрыторыя", regionAU: "Штат / тэрыторыя", regionOptional: "Вобласць / рэгіён (неабавязкова)", regionChoose: "— выберыце —",
    popularCountries: "Папулярныя", allCountries: "Усе краіны",
    phoneHint: "З кодам краіны — кур'ер можа патэлефанаваць або даслаць SMS.",
    pickupPoint: "Пункт атрымання",
    changePoint: "Змяніць",
    selectParcel: "Выбраць паштамат InPost →",
    intlDeliveryTitle: "/ Міжнародная дастаўка", intlDeliveryNote1: "Дастаўка кур'ерам на ваш адрас.", intlDeliveryNote2: "кошт дастаўкі · каля 2–4 тыдняў",
    consent1: "Я прымаю ", consentTerms: "Правілы крамы", consent2: " і даю згоду на апрацоўку персанальных даных для выканання замовы.",
    newsletterConsent: "Хачу атрымліваць па email навіны, акцыі і купоны KalkMate (рассылка). Згоду можна адклікаць у любы момант. (неабавязкова)",
    personalizeTitle: "/ Персаналізацыя вашага экзэмпляра",
    personalizeCodeLabel: "Ваш код разблакіроўкі AI (4 лічбы)", personalizeCodePlaceholder: "напр. 4271",
    personalizeCodeHint: "Мы запішам гэты код у ваш экзэмпляр перад адпраўкай.",
    personalizeNameLabel: "Імя/нік на этыкетцы прылады", personalizeNamePlaceholder: "напр. Алесь",
    personalizeNameHint: "Мы надрукуем яго на этыкетцы вашага экзэмпляра.",
    personalizeNotice: "Кожны KalkMate персаналізуецца індывідуальна пад замову (выбраны вамі AI-код запісваецца ў гэты канкрэтны экзэмпляр + імя друкуецца на этыкетцы). Згодна з правам ЕС аб абароне спажыўцоў, 14-дзённае права на адмову ад дагавора не распаўсюджваецца на тавары, вырабленыя паводле спецыфікацыі спажыўца або відавочна персаналізаваныя. Гарантыя 24 месяцы на дэфекты дзейнічае на звычайных умовах.",
    personalizeConsent: "Я разумею, што гэты экзэмпляр будзе персаналізаваны па маім жаданні, і таму ў мяне няма права на адмову ад дагавора (вяртанне на працягу 14 дзён). Мае законныя правы ў выпадку дэфектаў і па гарантыі застаюцца без змен.",
    errPickupPoint: "Выберыце пункт атрымання.", errFullAddress: "Пазначце поўны адрас (вуліца, індэкс, горад) — ён патрэбны для рахунку.", errDeliveryAddress: "Пазначце поўны адрас дастаўкі.", errRegion: "Выберыце штат / правінцыю — гэта патрабуе кур'ер.",
    errPersonalizeCode: "Пазначце 4-значны код разблакіроўкі AI.", errPersonalizeName: "Пазначце імя/нік для этыкеткі.", errPersonalizeConsent: "Неабходна пацвердзіць згоду на персаналізацыю (яна ўплывае на права вяртання).",
    serverError: "Памылка сервера", unexpectedError: "Нечаканая памылка.",
    loading: "Загрузка...", continueToPayment: "Перайсці да аплаты →",
    selectParcelTitle: "Выберыце паштамат", back: "← Назад", loadingMap: "Загрузка карты...",
    payment: "Аплата", shipping: "Дастаўка",
    paymentComplete: "Аплата завершана.", thankYou1: "Дзякуй за замову. Пацвярджэнне адпраўлена на", thankYou2: ". Адпраўка на працягу 4 тыдняў.",
    close: "Закрыць",
    couponLabel: "Код зніжкі", couponApply: "Ужыць", couponRemove: "Выдаліць", couponTag: "Купон", couponPlaceholder: "напр. MATURA2026",
    couponInvalid: "Няправільны код зніжкі.",
    couponRejected: () => "Гэты купон больш не дзейнічае і быў выдалены з замовы — праверце суму і паспрабуйце яшчэ раз.",
    connectionError: "Памылка злучэння.",
    total: "РАЗАМ", free: "БЯСПЛАТНА", or: "АБО",
    emailFromAccount: "Email з вашага ўліковага запісу — сюды мы адправім пацвярджэнне замовы.",
    klarnaTitle: "Klarna — аплаціце пазней або ў растэрміноўку", klarnaSub: "Адкладзеная аплата · праз Stripe",
    processingTitle: "Правяраем аплату…", processingBody: "Хвілінку — правяраем пацвярджэнне аплаты.",
    pendingTitle: "Аплата яшчэ не пацверджана", pendingBody1: "Мы яшчэ не атрымалі пацвярджэння аплаты.",
    pendingBody2: "Калі аплата прайшла, на працягу некалькіх хвілін мы адправім пацвярджэнне на", pendingBody3: ".",
    pendingRetry: "Калі аплата была адменена, можна паспрабаваць яшчэ раз.",
    paymentFailed: "Аплата не прайшла або была адменена. Паспрабуйце яшчэ раз.",
    quantityLabel: "Колькасць", decrease: "Паменшыць колькасць", increase: "Павялічыць колькасць",
    quantityLimit: (m) => `макс. ${m} шт. на замову`, quantityStockLimit: (n) => `даступна: ${n} шт.`,
    perUnit: "/ шт.", subtotal: "Тавары", shippingPerOrder: "адна пасылка — кошт дастаўкі не залежыць ад колькасці",
    personalizeTitleMulti: (n) => `/ Персаналізацыя экзэмпляраў (${n} шт.)`,
    sameCodeLabel: "Адзін AI-код для ўсіх экзэмпляраў",
    personalizeCodeLabelAll: "Код разблакіроўкі AI для ўсіх экзэмпляраў (4 лічбы)",
    personalizeCodeHintMulti: "Перад адпраўкай мы запішам гэты код у кожны замоўлены экзэмпляр.",
    personalizeCodeHintEach: "Кожны экзэмпляр атрымае свой код — увядзіце 4 лічбы для кожнага.",
    personalizeNameHintMulti: "Імя/нік мы надрукуем на этыкетцы адпаведнага экзэмпляра.",
    unitLabel: (i) => `Экзэмпляр ${i}`, unitCode: "AI-код", unitName: "Імя/нік на этыкетцы",
    personalizeConsentMulti: "Я разумею, што гэтыя экзэмпляры будуць персаналізаваны па маім жаданні, і таму ў мяне няма права на адмову ад дагавора (вяртанне на працягу 14 дзён). Мае законныя правы ў выпадку дэфектаў і па гарантыі застаюцца без змен.",
    errPersonalizeCodeUnit: (i) => `Пазначце 4-значны код разблакіроўкі AI для экзэмпляра ${i}.`,
    errPersonalizeNameUnit: (i) => `Пазначце імя/нік для этыкеткі экзэмпляра ${i}.`,
  },
  es: {
    eyebrow: "[ 07 ] · Order",
    h2a: "Hazte con ", h2italic: "uno", h2b: ".", h2line2: "El resto es pura formalidad.",
    intro: "KalkMate v3.0 — montado a mano en Polonia. Cada unidad tiene su propio número de serie y 24 meses de garantía. Entrega por mensajería hasta tu puerta.",
    included: [
      "Dispositivo KalkMate v3.0",
      "6 pegatinas de placa de características",
      "2 millones de tokens de IA incluidos (código en la caja)",
      "Manual de usuario",
    ],
    badges: ["Pago seguro", "Personalizado para ti", "Garantía de 24 meses", "Envío internacional"],
    stockAvailable: (n) => `${n} uds. disponibles`,
    preSalePrice: "Precio de preventa",
    discountPln: "Preventa · envío InPost gratis",
    shippingEur: "InPost PL gratis · UE 20€ · Mundo 35€",
    lowestPrice30d: "Precio más bajo de los últimos 30 días",
    production: "/ producción",
    productionNote1: "Los dispositivos se ", productionNoteHand: "montan a mano", productionNote2: ". Plazo de entrega de hasta ", productionNoteWeeks: "4 semanas",
    orderNowPln: "Pedir ahora · 699 zł", orderNowEur: "Pedir ahora · 169 EUR",
    addToCart: "Añadir al carrito",
    closeAria: "Cerrar",
    shippingDetails: "Datos de envío",
    inpostParcel: "Taquilla InPost", euCourier: "Mensajería UE", intlCourier: "Mensajería internacional",
    deliveryCountry: "País de entrega",
    fullName: "Nombre y apellidos",
    email: "Email",
    phone: "Teléfono",
    invoiceAddress: "/ Dirección de entrega y facturación",
    street: "Calle y número", streetPlaceholder: "p. ej. Calle Mayor 12",
    postcode: "Código postal", postcodePlaceholder: "28013",
    city: "Ciudad", cityPlaceholder: "Madrid",
    region: "Región", regionUS: "Estado", regionCA: "Provincia / territorio", regionAU: "Estado / territorio", regionOptional: "Provincia / región (opcional)", regionChoose: "— seleccionar —",
    popularCountries: "Más elegidos", allCountries: "Todos los países",
    phoneHint: "Con el prefijo del país — el mensajero puede llamarte o enviarte un SMS.",
    pickupPoint: "Punto de recogida",
    changePoint: "Cambiar",
    selectParcel: "Elegir taquilla InPost →",
    intlDeliveryTitle: "/ Envío internacional", intlDeliveryNote1: "Entrega por mensajería en tu dirección.", intlDeliveryNote2: "gastos de envío · aprox. 2–4 semanas",
    consent1: "Acepto las ", consentTerms: "Condiciones generales", consent2: " y consiento el tratamiento de mis datos personales para la gestión del pedido.",
    newsletterConsent: "Quiero recibir por email novedades, promociones y cupones de KalkMate (newsletter). Puedo retirar mi consentimiento en cualquier momento. (opcional)",
    personalizeTitle: "/ Personaliza tu unidad",
    personalizeCodeLabel: "Tu código de desbloqueo de IA (4 dígitos)", personalizeCodePlaceholder: "p. ej. 4271",
    personalizeCodeHint: "Grabaremos este código en tu unidad antes del envío.",
    personalizeNameLabel: "Nombre/apodo para la etiqueta del dispositivo", personalizeNamePlaceholder: "p. ej. Lucía",
    personalizeNameHint: "Lo imprimiremos en la etiqueta de tu unidad.",
    personalizeNotice: "Cada KalkMate se personaliza individualmente para tu pedido (el código de IA que elijas se graba en esta unidad concreta + tu nombre se imprime en su etiqueta). Según la normativa de consumo de la UE, el derecho de desistimiento de 14 días no se aplica a los bienes confeccionados conforme a las especificaciones del consumidor o claramente personalizados. La garantía de 24 meses por defectos sigue aplicándose en las condiciones habituales.",
    personalizeConsent: "Entiendo que esta unidad se personalizará a petición mía y que, por tanto, no tengo derecho de desistimiento del contrato (devolución en 14 días). Mis derechos legales de garantía no se ven afectados.",
    errPickupPoint: "Elige un punto de recogida.", errFullAddress: "Indica la dirección completa (calle, código postal, ciudad) — es necesaria para la factura.", errDeliveryAddress: "Indica la dirección de entrega completa.", errRegion: "Selecciona el estado / provincia — la mensajería lo necesita.",
    errPersonalizeCode: "Indica un código de desbloqueo de IA de 4 dígitos.", errPersonalizeName: "Indica un nombre/apodo para la etiqueta.", errPersonalizeConsent: "Debes confirmar el consentimiento de personalización (afecta a tu derecho de devolución).",
    serverError: "Error del servidor", unexpectedError: "Error inesperado.",
    loading: "Cargando...", continueToPayment: "Continuar al pago →",
    selectParcelTitle: "Elige una taquilla", back: "← Atrás", loadingMap: "Cargando mapa...",
    payment: "Pago", shipping: "Envío",
    paymentComplete: "Pago completado.", thankYou1: "Gracias por tu pedido. Hemos enviado la confirmación a", thankYou2: ". Envío en un plazo de 4 semanas.",
    close: "Cerrar",
    couponLabel: "Código de descuento", couponApply: "Aplicar", couponRemove: "Quitar", couponTag: "Cupón", couponPlaceholder: "p. ej. MATURA2026",
    couponInvalid: "Código de descuento no válido.",
    couponRejected: () => "Este cupón ya no es válido y se ha eliminado del pedido — revisa el importe e inténtalo de nuevo.",
    connectionError: "Error de conexión.",
    total: "TOTAL", free: "GRATIS", or: "O",
    emailFromAccount: "Email de tu cuenta — te enviaremos aquí la confirmación del pedido.",
    klarnaTitle: "Klarna — paga más tarde o a plazos", klarnaSub: "Pago aplazado · a través de Stripe",
    processingTitle: "Comprobando el pago…", processingBody: "Un momento — estamos verificando la confirmación del pago.",
    pendingTitle: "Pago aún no confirmado", pendingBody1: "Todavía no hemos recibido la confirmación del pago.",
    pendingBody2: "Si el pago se ha realizado, en unos minutos enviaremos una confirmación a", pendingBody3: ".",
    pendingRetry: "Si el pago se ha cancelado, puedes intentarlo de nuevo.",
    paymentFailed: "El pago ha fallado o se ha cancelado. Inténtalo de nuevo.",
    quantityLabel: "Cantidad", decrease: "Reducir cantidad", increase: "Aumentar cantidad",
    quantityLimit: (m) => `máx. ${m} uds. por pedido`, quantityStockLimit: (n) => `disponibles: ${n} uds.`,
    perUnit: "/ ud.", subtotal: "Productos", shippingPerOrder: "un paquete — el envío no depende de la cantidad",
    personalizeTitleMulti: (n) => `/ Personaliza tus unidades (${n} uds.)`,
    sameCodeLabel: "Mismo código de IA para todas las unidades",
    personalizeCodeLabelAll: "Código de desbloqueo de IA para todas las unidades (4 dígitos)",
    personalizeCodeHintMulti: "Grabaremos este código en cada unidad del pedido antes del envío.",
    personalizeCodeHintEach: "Cada unidad tendrá su propio código — introduce 4 dígitos en cada una.",
    personalizeNameHintMulti: "Imprimiremos el nombre/apodo en la etiqueta de la unidad correspondiente.",
    unitLabel: (i) => `Unidad ${i}`, unitCode: "Código de IA", unitName: "Nombre/apodo en la etiqueta",
    personalizeConsentMulti: "Entiendo que estas unidades se personalizarán a petición mía y que, por tanto, no tengo derecho de desistimiento del contrato (devolución en 14 días). Mis derechos legales de garantía no se ven afectados.",
    errPersonalizeCodeUnit: (i) => `Indica un código de desbloqueo de IA de 4 dígitos para la unidad ${i}.`,
    errPersonalizeNameUnit: (i) => `Indica un nombre/apodo para la etiqueta de la unidad ${i}.`,
  },
  pt: {
    eyebrow: "[ 07 ] · Order",
    h2a: "Leve ", h2italic: "um", h2b: ".", h2line2: "O resto é formalidade.",
    intro: "KalkMate v3.0 — montado à mão na Polónia. Cada unidade tem número de série próprio e 24 meses de garantia. Entrega por estafeta à sua porta.",
    included: [
      "Dispositivo KalkMate v3.0",
      "6 autocolantes de placa de identificação",
      "2 milhões de tokens de IA incluídos (código na caixa)",
      "Manual de utilização",
    ],
    badges: ["Pagamento seguro", "Personalizado para si", "Garantia de 24 meses", "Envio internacional"],
    stockAvailable: (n) => `${n} un. disponíveis`,
    preSalePrice: "Preço de pré-venda",
    discountPln: "Pré-venda · envio InPost grátis",
    shippingEur: "InPost PL grátis · UE 20€ · Mundo 35€",
    lowestPrice30d: "Preço mais baixo dos últimos 30 dias",
    production: "/ produção",
    productionNote1: "Os dispositivos são ", productionNoteHand: "montados à mão", productionNote2: ". Prazo de entrega até ", productionNoteWeeks: "4 semanas",
    orderNowPln: "Encomendar · 699 zł", orderNowEur: "Encomendar · 169 EUR",
    addToCart: "Adicionar ao carrinho",
    closeAria: "Fechar",
    shippingDetails: "Dados de envio",
    inpostParcel: "Cacifo InPost", euCourier: "Estafeta UE", intlCourier: "Estafeta internacional",
    deliveryCountry: "País de entrega",
    fullName: "Nome completo",
    email: "Email",
    phone: "Telefone",
    invoiceAddress: "/ Morada de entrega e faturação",
    street: "Rua e número", streetPlaceholder: "p. ex. Rua Augusta 12",
    postcode: "Código postal", postcodePlaceholder: "1100-053",
    city: "Cidade", cityPlaceholder: "Lisboa",
    region: "Região", regionUS: "Estado", regionCA: "Província / território", regionAU: "Estado / território", regionOptional: "Distrito / região (opcional)", regionChoose: "— selecionar —",
    popularCountries: "Mais escolhidos", allCountries: "Todos os países",
    phoneHint: "Com o indicativo do país — o estafeta pode ligar ou enviar SMS.",
    pickupPoint: "Ponto de recolha",
    changePoint: "Alterar",
    selectParcel: "Escolher cacifo InPost →",
    intlDeliveryTitle: "/ Envio internacional", intlDeliveryNote1: "Entrega por estafeta na sua morada.", intlDeliveryNote2: "portes de envio · aprox. 2–4 semanas",
    consent1: "Aceito os ", consentTerms: "Termos e Condições", consent2: " e consinto o tratamento dos meus dados pessoais para processamento da encomenda.",
    newsletterConsent: "Quero receber por email novidades, promoções e cupões KalkMate (newsletter). Posso retirar o consentimento a qualquer momento. (opcional)",
    personalizeTitle: "/ Personalize a sua unidade",
    personalizeCodeLabel: "O seu código de desbloqueio de IA (4 dígitos)", personalizeCodePlaceholder: "p. ex. 4271",
    personalizeCodeHint: "Vamos gravar este código na sua unidade antes do envio.",
    personalizeNameLabel: "Nome/alcunha para a etiqueta do dispositivo", personalizeNamePlaceholder: "p. ex. Inês",
    personalizeNameHint: "Vamos imprimi-lo na etiqueta da sua unidade.",
    personalizeNotice: "Cada KalkMate é personalizado individualmente para a sua encomenda (o código de IA que escolher é gravado nesta unidade específica + o seu nome é impresso na etiqueta). Nos termos do direito do consumidor da UE, o direito de livre resolução de 14 dias não se aplica a bens fabricados segundo as especificações do consumidor ou claramente personalizados. A garantia de 24 meses para defeitos mantém-se nas condições habituais.",
    personalizeConsent: "Compreendo que esta unidade será personalizada a meu pedido e que, por isso, não tenho direito de livre resolução do contrato (devolução em 14 dias). Os meus direitos legais de garantia não são afetados.",
    errPickupPoint: "Escolha um ponto de recolha.", errFullAddress: "Indique a morada completa (rua, código postal, cidade) — necessária para a fatura.", errDeliveryAddress: "Indique a morada de entrega completa.", errRegion: "Selecione o estado / província — a transportadora exige-o.",
    errPersonalizeCode: "Indique um código de desbloqueio de IA com 4 dígitos.", errPersonalizeName: "Indique um nome/alcunha para a etiqueta.", errPersonalizeConsent: "Tem de confirmar o consentimento de personalização (afeta o direito de devolução).",
    serverError: "Erro do servidor", unexpectedError: "Erro inesperado.",
    loading: "A carregar...", continueToPayment: "Continuar para o pagamento →",
    selectParcelTitle: "Escolha um cacifo", back: "← Voltar", loadingMap: "A carregar o mapa...",
    payment: "Pagamento", shipping: "Envio",
    paymentComplete: "Pagamento concluído.", thankYou1: "Obrigado pela sua encomenda. Enviámos a confirmação para", thankYou2: ". Envio no prazo de 4 semanas.",
    close: "Fechar",
    couponLabel: "Código de desconto", couponApply: "Aplicar", couponRemove: "Remover", couponTag: "Cupão", couponPlaceholder: "p. ex. MATURA2026",
    couponInvalid: "Código de desconto inválido.",
    couponRejected: () => "Este cupão já não é válido e foi removido da encomenda — verifique o valor e tente novamente.",
    connectionError: "Erro de ligação.",
    total: "TOTAL", free: "GRÁTIS", or: "OU",
    emailFromAccount: "Email da sua conta — enviaremos para aqui a confirmação da encomenda.",
    klarnaTitle: "Klarna — pague mais tarde ou em prestações", klarnaSub: "Pagamento diferido · via Stripe",
    processingTitle: "A verificar o pagamento…", processingBody: "Um momento — estamos a verificar a confirmação do pagamento.",
    pendingTitle: "Pagamento ainda não confirmado", pendingBody1: "Ainda não recebemos a confirmação do pagamento.",
    pendingBody2: "Se o pagamento foi efetuado, enviaremos dentro de minutos uma confirmação para", pendingBody3: ".",
    pendingRetry: "Se o pagamento foi cancelado, pode tentar novamente.",
    paymentFailed: "O pagamento falhou ou foi cancelado. Tente novamente.",
    quantityLabel: "Quantidade", decrease: "Diminuir quantidade", increase: "Aumentar quantidade",
    quantityLimit: (m) => `máx. ${m} un. por encomenda`, quantityStockLimit: (n) => `disponíveis: ${n} un.`,
    perUnit: "/ un.", subtotal: "Produtos", shippingPerOrder: "uma encomenda — o envio não depende da quantidade",
    personalizeTitleMulti: (n) => `/ Personalize as suas unidades (${n} un.)`,
    sameCodeLabel: "Mesmo código de IA para todas as unidades",
    personalizeCodeLabelAll: "Código de desbloqueio de IA para todas as unidades (4 dígitos)",
    personalizeCodeHintMulti: "Vamos gravar este código em cada unidade encomendada antes do envio.",
    personalizeCodeHintEach: "Cada unidade terá o seu próprio código — introduza 4 dígitos em cada uma.",
    personalizeNameHintMulti: "Vamos imprimir o nome/alcunha na etiqueta da respetiva unidade.",
    unitLabel: (i) => `Unidade ${i}`, unitCode: "Código de IA", unitName: "Nome/alcunha na etiqueta",
    personalizeConsentMulti: "Compreendo que estas unidades serão personalizadas a meu pedido e que, por isso, não tenho direito de livre resolução do contrato (devolução em 14 dias). Os meus direitos legais de garantia não são afetados.",
    errPersonalizeCodeUnit: (i) => `Indique um código de desbloqueio de IA com 4 dígitos para a unidade ${i}.`,
    errPersonalizeNameUnit: (i) => `Indique um nome/alcunha para a etiqueta da unidade ${i}.`,
  },
  fr: {
    eyebrow: "[ 07 ] · Order",
    h2a: "Prenez-en ", h2italic: "un", h2b: ".", h2line2: "Le reste n'est que formalité.",
    intro: "KalkMate v3.0 — assemblé à la main en Pologne. Chaque exemplaire possède son propre numéro de série et une garantie de 24 mois. Livraison par coursier jusqu'à votre porte.",
    included: [
      "Appareil KalkMate v3.0",
      "6 autocollants de plaque signalétique",
      "2 millions de tokens IA inclus (code dans la boîte)",
      "Mode d'emploi",
    ],
    badges: ["Paiement sécurisé", "Personnalisé pour vous", "Garantie 24 mois", "Livraison internationale"],
    stockAvailable: (n) => `${n} en stock`,
    preSalePrice: "Prix de prévente",
    discountPln: "Prévente · livraison InPost gratuite",
    shippingEur: "InPost PL gratuit · UE 20€ · Monde 35€",
    lowestPrice30d: "Prix le plus bas des 30 derniers jours",
    production: "/ production",
    productionNote1: "Les appareils sont ", productionNoteHand: "assemblés à la main", productionNote2: ". Délai de réalisation jusqu'à ", productionNoteWeeks: "4 semaines",
    orderNowPln: "Commander · 699 zł", orderNowEur: "Commander · 169 EUR",
    addToCart: "Ajouter au panier",
    closeAria: "Fermer",
    shippingDetails: "Informations de livraison",
    inpostParcel: "Consigne InPost", euCourier: "Coursier UE", intlCourier: "Coursier international",
    deliveryCountry: "Pays de livraison",
    fullName: "Nom complet",
    email: "E-mail",
    phone: "Téléphone",
    invoiceAddress: "/ Adresse de livraison et de facturation",
    street: "Numéro et rue", streetPlaceholder: "p. ex. 12 rue de Rivoli",
    postcode: "Code postal", postcodePlaceholder: "75001",
    city: "Ville", cityPlaceholder: "Paris",
    region: "Région", regionUS: "État", regionCA: "Province / territoire", regionAU: "État / territoire", regionOptional: "Département / région (facultatif)", regionChoose: "— choisir —",
    popularCountries: "Les plus choisis", allCountries: "Tous les pays",
    phoneHint: "Avec l'indicatif du pays — le coursier peut vous appeler ou envoyer un SMS.",
    pickupPoint: "Point de retrait",
    changePoint: "Modifier",
    selectParcel: "Choisir une consigne InPost →",
    intlDeliveryTitle: "/ Livraison internationale", intlDeliveryNote1: "Livraison par coursier à votre adresse.", intlDeliveryNote2: "frais de port · env. 2–4 semaines",
    consent1: "J'accepte les ", consentTerms: "Conditions générales de vente", consent2: " et consens au traitement de mes données personnelles pour l'exécution de la commande.",
    newsletterConsent: "Je souhaite recevoir par e-mail les nouveautés, promotions et codes promo KalkMate (newsletter). Je peux retirer mon consentement à tout moment. (facultatif)",
    personalizeTitle: "/ Personnalisez votre exemplaire",
    personalizeCodeLabel: "Votre code de déverrouillage IA (4 chiffres)", personalizeCodePlaceholder: "p. ex. 4271",
    personalizeCodeHint: "Nous enregistrerons ce code dans votre exemplaire avant l'expédition.",
    personalizeNameLabel: "Prénom/pseudo pour l'étiquette de l'appareil", personalizeNamePlaceholder: "p. ex. Léa",
    personalizeNameHint: "Nous l'imprimerons sur l'étiquette de votre exemplaire.",
    personalizeNotice: "Chaque KalkMate est personnalisé individuellement pour votre commande (le code IA choisi est enregistré dans cet exemplaire précis + votre prénom est imprimé sur son étiquette). Conformément au droit de la consommation de l'UE, le droit de rétractation de 14 jours ne s'applique pas aux biens confectionnés selon les spécifications du consommateur ou nettement personnalisés. La garantie de 24 mois contre les défauts reste applicable dans les conditions habituelles.",
    personalizeConsent: "Je comprends que cet exemplaire sera personnalisé à ma demande et que, par conséquent, je ne bénéficie pas du droit de rétractation (retour sous 14 jours). Mes droits légaux de garantie restent inchangés.",
    errPickupPoint: "Choisissez un point de retrait.", errFullAddress: "Indiquez votre adresse complète (rue, code postal, ville) — nécessaire pour la facture.", errDeliveryAddress: "Indiquez votre adresse de livraison complète.", errRegion: "Choisissez l'État / la province — le transporteur l'exige.",
    errPersonalizeCode: "Indiquez un code de déverrouillage IA à 4 chiffres.", errPersonalizeName: "Indiquez un prénom/pseudo pour l'étiquette.", errPersonalizeConsent: "Vous devez confirmer votre accord pour la personnalisation (il affecte votre droit de retour).",
    serverError: "Erreur du serveur", unexpectedError: "Erreur inattendue.",
    loading: "Chargement...", continueToPayment: "Passer au paiement →",
    selectParcelTitle: "Choisir une consigne", back: "← Retour", loadingMap: "Chargement de la carte...",
    payment: "Paiement", shipping: "Livraison",
    paymentComplete: "Paiement effectué.", thankYou1: "Merci pour votre commande. Confirmation envoyée à", thankYou2: ". Expédition sous 4 semaines.",
    close: "Fermer",
    couponLabel: "Code promo", couponApply: "Appliquer", couponRemove: "Retirer", couponTag: "Code promo", couponPlaceholder: "p. ex. MATURA2026",
    couponInvalid: "Code promo invalide.",
    couponRejected: () => "Ce code promo n'est plus valable et a été retiré de la commande — vérifiez le montant et réessayez.",
    connectionError: "Erreur de connexion.",
    total: "TOTAL", free: "GRATUIT", or: "OU",
    emailFromAccount: "E-mail de votre compte — nous y enverrons la confirmation de commande.",
    klarnaTitle: "Klarna — payez plus tard ou en plusieurs fois", klarnaSub: "Paiement différé · via Stripe",
    processingTitle: "Vérification du paiement…", processingBody: "Un instant — nous vérifions la confirmation du paiement.",
    pendingTitle: "Paiement pas encore confirmé", pendingBody1: "Nous n'avons pas encore reçu la confirmation du paiement.",
    pendingBody2: "Si le paiement a abouti, nous enverrons une confirmation d'ici quelques minutes à", pendingBody3: ".",
    pendingRetry: "Si le paiement a été annulé, vous pouvez réessayer.",
    paymentFailed: "Le paiement a échoué ou a été annulé. Veuillez réessayer.",
    quantityLabel: "Quantité", decrease: "Diminuer la quantité", increase: "Augmenter la quantité",
    quantityLimit: (m) => `max. ${m} unités par commande`, quantityStockLimit: (n) => `disponibles : ${n}`,
    perUnit: "/ pce", subtotal: "Produits", shippingPerOrder: "un colis — les frais de port ne dépendent pas de la quantité",
    personalizeTitleMulti: (n) => `/ Personnalisez vos exemplaires (${n})`,
    sameCodeLabel: "Même code IA pour tous les exemplaires",
    personalizeCodeLabelAll: "Code de déverrouillage IA pour tous les exemplaires (4 chiffres)",
    personalizeCodeHintMulti: "Nous enregistrerons ce code dans chaque exemplaire commandé avant l'expédition.",
    personalizeCodeHintEach: "Chaque exemplaire aura son propre code — saisissez 4 chiffres pour chacun.",
    personalizeNameHintMulti: "Nous imprimerons le prénom/pseudo sur l'étiquette de l'exemplaire concerné.",
    unitLabel: (i) => `Exemplaire ${i}`, unitCode: "Code IA", unitName: "Prénom/pseudo sur l'étiquette",
    personalizeConsentMulti: "Je comprends que ces exemplaires seront personnalisés à ma demande et que, par conséquent, je ne bénéficie pas du droit de rétractation (retour sous 14 jours). Mes droits légaux de garantie restent inchangés.",
    errPersonalizeCodeUnit: (i) => `Indiquez un code de déverrouillage IA à 4 chiffres pour l'exemplaire ${i}.`,
    errPersonalizeNameUnit: (i) => `Indiquez un prénom/pseudo pour l'étiquette de l'exemplaire ${i}.`,
  },
  it: {
    eyebrow: "[ 07 ] · Order",
    h2a: "Prendine ", h2italic: "uno", h2b: ".", h2line2: "Il resto è una formalità.",
    intro: "KalkMate v3.0 — assemblato a mano in Polonia. Ogni esemplare ha un numero di serie individuale e 24 mesi di garanzia. Consegna tramite corriere fino alla tua porta.",
    included: [
      "Dispositivo KalkMate v3.0",
      "6 adesivi targhetta dati",
      "2 milioni di token IA inclusi (codice nella confezione)",
      "Manuale d'uso",
    ],
    badges: ["Pagamento sicuro", "Personalizzato per te", "Garanzia 24 mesi", "Spedizione internazionale"],
    stockAvailable: (n) => `${n} pz. disponibili`,
    preSalePrice: "Prezzo di prevendita",
    discountPln: "Prevendita · spedizione InPost gratuita",
    shippingEur: "InPost PL gratis · UE 20€ · Mondo 35€",
    lowestPrice30d: "Prezzo più basso degli ultimi 30 giorni",
    production: "/ produzione",
    productionNote1: "I dispositivi sono ", productionNoteHand: "assemblati a mano", productionNote2: ". Tempi di realizzazione fino a ", productionNoteWeeks: "4 settimane",
    orderNowPln: "Ordina ora · 699 zł", orderNowEur: "Ordina ora · 169 EUR",
    addToCart: "Aggiungi al carrello",
    closeAria: "Chiudi",
    shippingDetails: "Dati di spedizione",
    inpostParcel: "Locker InPost", euCourier: "Corriere UE", intlCourier: "Corriere internazionale",
    deliveryCountry: "Paese di consegna",
    fullName: "Nome e cognome",
    email: "Email",
    phone: "Telefono",
    invoiceAddress: "/ Indirizzo di consegna e fatturazione",
    street: "Via e numero civico", streetPlaceholder: "es. Via Roma 12",
    postcode: "CAP", postcodePlaceholder: "00184",
    city: "Città", cityPlaceholder: "Roma",
    region: "Regione", regionUS: "Stato", regionCA: "Provincia / territorio", regionAU: "Stato / territorio", regionOptional: "Provincia / regione (facoltativo)", regionChoose: "— seleziona —",
    popularCountries: "Più scelti", allCountries: "Tutti i paesi",
    phoneHint: "Con il prefisso internazionale — il corriere potrebbe chiamarti o inviarti un SMS.",
    pickupPoint: "Punto di ritiro",
    changePoint: "Cambia",
    selectParcel: "Scegli un locker InPost →",
    intlDeliveryTitle: "/ Spedizione internazionale", intlDeliveryNote1: "Consegna con corriere al tuo indirizzo.", intlDeliveryNote2: "costo di spedizione · circa 2–4 settimane",
    consent1: "Accetto i ", consentTerms: "Termini e condizioni", consent2: " e acconsento al trattamento dei miei dati personali per l'evasione dell'ordine.",
    newsletterConsent: "Voglio ricevere via email novità, promozioni e coupon KalkMate (newsletter). Posso revocare il consenso in qualsiasi momento. (facoltativo)",
    personalizeTitle: "/ Personalizza il tuo esemplare",
    personalizeCodeLabel: "Il tuo codice di sblocco IA (4 cifre)", personalizeCodePlaceholder: "es. 4271",
    personalizeCodeHint: "Caricheremo questo codice sul tuo esemplare prima della spedizione.",
    personalizeNameLabel: "Nome/nickname per l'etichetta del dispositivo", personalizeNamePlaceholder: "es. Giulia",
    personalizeNameHint: "Lo stamperemo sull'etichetta del tuo esemplare.",
    personalizeNotice: "Ogni KalkMate viene personalizzato individualmente per il tuo ordine (il codice IA scelto viene caricato su questo specifico esemplare + il tuo nome viene stampato sull'etichetta). Secondo la normativa UE a tutela dei consumatori, il diritto di recesso di 14 giorni non si applica ai beni confezionati su misura o chiaramente personalizzati. La garanzia di 24 mesi per i difetti resta valida alle condizioni consuete.",
    personalizeConsent: "Comprendo che questo esemplare sarà personalizzato su mia richiesta e che, pertanto, non ho diritto di recesso dal contratto (reso entro 14 giorni). I miei diritti di garanzia previsti dalla legge restano invariati.",
    errPickupPoint: "Scegli un punto di ritiro.", errFullAddress: "Inserisci l'indirizzo completo (via, CAP, città) — necessario per la fattura.", errDeliveryAddress: "Inserisci l'indirizzo di consegna completo.", errRegion: "Seleziona lo stato / la provincia — il corriere lo richiede.",
    errPersonalizeCode: "Inserisci un codice di sblocco IA di 4 cifre.", errPersonalizeName: "Inserisci un nome/nickname per l'etichetta.", errPersonalizeConsent: "Devi confermare il consenso alla personalizzazione (incide sul diritto di reso).",
    serverError: "Errore del server", unexpectedError: "Errore imprevisto.",
    loading: "Caricamento...", continueToPayment: "Procedi al pagamento →",
    selectParcelTitle: "Scegli un locker", back: "← Indietro", loadingMap: "Caricamento mappa...",
    payment: "Pagamento", shipping: "Spedizione",
    paymentComplete: "Pagamento completato.", thankYou1: "Grazie per il tuo ordine. Abbiamo inviato la conferma a", thankYou2: ". Spedizione entro 4 settimane.",
    close: "Chiudi",
    couponLabel: "Codice sconto", couponApply: "Applica", couponRemove: "Rimuovi", couponTag: "Coupon", couponPlaceholder: "es. MATURA2026",
    couponInvalid: "Codice sconto non valido.",
    couponRejected: () => "Questo coupon non è più valido ed è stato rimosso dall'ordine — controlla l'importo e riprova.",
    connectionError: "Errore di connessione.",
    total: "TOTALE", free: "GRATIS", or: "OPPURE",
    emailFromAccount: "Email del tuo account — invieremo qui la conferma dell'ordine.",
    klarnaTitle: "Klarna — paga dopo o a rate", klarnaSub: "Pagamento posticipato · tramite Stripe",
    processingTitle: "Verifica del pagamento…", processingBody: "Un attimo — stiamo verificando la conferma del pagamento.",
    pendingTitle: "Pagamento non ancora confermato", pendingBody1: "Non abbiamo ancora ricevuto la conferma del pagamento.",
    pendingBody2: "Se il pagamento è andato a buon fine, entro pochi minuti invieremo una conferma a", pendingBody3: ".",
    pendingRetry: "Se il pagamento è stato annullato, puoi riprovare.",
    paymentFailed: "Il pagamento non è riuscito o è stato annullato. Riprova.",
    quantityLabel: "Quantità", decrease: "Diminuisci quantità", increase: "Aumenta quantità",
    quantityLimit: (m) => `max ${m} pz. per ordine`, quantityStockLimit: (n) => `disponibili: ${n} pz.`,
    perUnit: "/ pz.", subtotal: "Prodotti", shippingPerOrder: "un pacco — la spedizione non dipende dalla quantità",
    personalizeTitleMulti: (n) => `/ Personalizza i tuoi esemplari (${n} pz.)`,
    sameCodeLabel: "Stesso codice IA per tutti gli esemplari",
    personalizeCodeLabelAll: "Codice di sblocco IA per tutti gli esemplari (4 cifre)",
    personalizeCodeHintMulti: "Caricheremo questo codice su ogni esemplare ordinato prima della spedizione.",
    personalizeCodeHintEach: "Ogni esemplare avrà il proprio codice — inserisci 4 cifre per ciascuno.",
    personalizeNameHintMulti: "Stamperemo il nome/nickname sull'etichetta dell'esemplare corrispondente.",
    unitLabel: (i) => `Esemplare ${i}`, unitCode: "Codice IA", unitName: "Nome/nickname sull'etichetta",
    personalizeConsentMulti: "Comprendo che questi esemplari saranno personalizzati su mia richiesta e che, pertanto, non ho diritto di recesso dal contratto (reso entro 14 giorni). I miei diritti di garanzia previsti dalla legge restano invariati.",
    errPersonalizeCodeUnit: (i) => `Inserisci un codice di sblocco IA di 4 cifre per l'esemplare ${i}.`,
    errPersonalizeNameUnit: (i) => `Inserisci un nome/nickname per l'etichetta dell'esemplare ${i}.`,
  },
};

const inputClass =
  "w-full px-4 py-3 bg-[#0B0B0B] border border-[rgba(242,237,227,0.18)] text-[#F2EDE3] text-sm focus:outline-none focus:border-[#D8FF3D] placeholder:text-[#F2EDE3]/30 transition-colors";

// Fallback kraju dostawy, gdy strona nie podaje go wprost, a przegladarka nie
// zdradza regionu — kraj "glowny" dla jezyka (be/en -> brak, zostaje DE).
const LANG_DEFAULT_COUNTRY: Partial<Record<Locale, string>> = {
  de: "DE", cs: "CZ", sk: "SK", lt: "LT", es: "ES", pt: "PT", fr: "FR", it: "IT",
};

// Kraj dostawy, gdy strona nie podaje go wprost (/en): region z jezyka
// przegladarki (en-GB -> GB, en-US -> US, de-AT -> AT, pl-PL -> PL).
function detectCountry(): string | null {
  try {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const l of langs) {
      const region = (l || "").split("-")[1]?.toUpperCase();
      if (region && (ALL_COUNTRY_CODES as readonly string[]).includes(region)) return region;
    }
  } catch {
    /* brak navigator — zostaje fallback */
  }
  return null;
}

// Kwota wyliczona przez serwer (K1: amount/currency/shippingCents/discountCents
// w odpowiedzi create-payment-intent / p24 create-transaction). Gdy serwer
// (jeszcze) tych pol nie zwraca — fallback na lokalne wyliczenie.
// quantity/unitCents/subtotalCents — zamowienie wielu sztuk (wysylka stala
// na zamowienie, rabat procentowy od subtotalu).
type Quote = {
  amount: number; currency: string; shippingCents: number; discountCents: number;
  quantity: number; unitCents: number; subtotalCents: number;
};

function quoteFromServer(data: Record<string, unknown> | null | undefined, fallback: Quote): Quote {
  const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);
  const cur = typeof data?.currency === "string" && /^[a-z]{3}$/i.test(data.currency)
    ? data.currency.toUpperCase()
    : null;
  const amount = int(data?.amount) ?? fallback.amount;
  const shippingCents = int(data?.shippingCents) ?? fallback.shippingCents;
  const discountCents = int(data?.discountCents) ?? fallback.discountCents;
  const qty = int(data?.quantity);
  const quantity = qty && qty >= 1 ? qty : fallback.quantity;
  // Starszy serwer nie zwraca subtotalu — wyliczamy go z jego kwoty.
  const subtotalCents = int(data?.subtotalCents) ?? Math.max(0, amount - shippingCents + discountCents);
  const unitCents = int(data?.unitCents) ?? Math.round(subtotalCents / quantity);
  return { amount, currency: cur ?? fallback.currency, shippingCents, discountCents, quantity, unitCents, subtotalCents };
}

// Personalizacja jednej sztuki: 4-cyfrowy kod AI + imie/nick na etykiete.
type UnitPersonalization = { unlockCode: string; name: string };
const EMPTY_UNIT: UnitPersonalization = { unlockCode: "", name: "" };

// Google Customer Reviews (apis.google.com/js/platform.js) — globalne API gapi.
type GcrWindow = Window & {
  renderOptIn?: () => void;
  gapi?: {
    load: (module: string, cb: () => void) => void;
    surveyoptin: { render: (opts: Record<string, unknown>) => void };
  };
};

// Kontekst zamowienia na czas przekierowania do Stripe/P24 (ta sama karta) —
// po powrocie formularz jest pusty, a GCR potrzebuje kraju dostawy.
const CHECKOUT_CTX_KEY = "km_checkout_ctx";

// Parametry powrotu z platnosci + flaga checkoutu — czyszczone z URL po obsludze
// (refresh nie odpala ponownie formularza, sekrety nie zostaja w historii/analityce).
const RETURN_PARAMS = [
  "checkout", "qty", "redirect_status", "payment_intent", "payment_intent_client_secret",
  "p24_return", "p24_session",
];

function cleanCheckoutQuery() {
  try {
    const url = new URL(window.location.href);
    let changed = false;
    RETURN_PARAMS.forEach((k) => {
      if (url.searchParams.has(k)) { url.searchParams.delete(k); changed = true; }
    });
    if (changed) window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  } catch {
    /* ignore */
  }
}

export default function BuyNow({ defaultCountry, lang = "pl" }: { defaultCountry?: string; lang?: Locale }) {
  const t = content[lang];
  const { data: session, status } = useSession();
  const router = useRouter();
  const { addItem, clearCart, items: cartItems } = useCart();

  // /en nie podaje kraju — zamiast PLN/Polski bierzemy region z przegladarki,
  // a bez regionu DE (UE, EUR — glowny rynek kalkmate.eu). / = PL, /de = DE.
  const initialCountry = useMemo(() => {
    if (defaultCountry) return defaultCountry;
    if (lang === "pl") return "PL";
    return detectCountry() ?? LANG_DEFAULT_COUNTRY[lang] ?? "DE";
  }, [defaultCountry, lang]);
  // Kraj, na ktory przelacza "EUR" na karcie, gdy aktualnie wybrana jest Polska.
  const intlDefault = useMemo(() => {
    if (initialCountry !== "PL") return initialCountry;
    const d = detectCountry();
    return d && d !== "PL" ? d : "DE";
  }, [initialCountry]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("form");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);
  const [polandStripeSecret, setPolandStripeSecret] = useState<string | null>(null);
  const [polandQuote, setPolandQuote] = useState<Quote | null>(null);
  const [isPolandStripeLoading, setIsPolandStripeLoading] = useState(false);
  const [polandStripeError, setPolandStripeError] = useState("");
  const [formData, setFormData] = useState({
    name: "", email: "", phone: "",
    street: "", postcode: "", city: "", region: "",
    country: initialCountry,
    consent: false,
    marketingConsent: false,
  });
  const [personalizeConsent, setPersonalizeConsent] = useState(false);
  // Ilosc w zamowieniu (1..MAX_ORDER_QUANTITY, dodatkowo ograniczona stanem).
  const [quantity, setQuantity] = useState(1);
  // Personalizacja per sztuka — tablica moze byc dluzsza niz ilosc (po
  // zmniejszeniu ilosci dane kolejnych sztuk zostaja, gdyby klient wrocil).
  const [units, setUnits] = useState<UnitPersonalization[]>([EMPTY_UNIT]);
  // "Ten sam kod dla wszystkich" — wtedy kod sztuki 1 idzie do kazdej sztuki.
  const [sameCode, setSameCode] = useState(true);
  // Blokada podwojnego klikniecia (stan React aktualizuje sie z opoznieniem).
  const submittingRef = useRef(false);
  const [selectedPoint, setSelectedPoint] = useState<InPostPoint | null>(null);
  // null = nie wiemy (API nie odpowiedzialo) -> licznika nie pokazujemy.
  const [stockLeft, setStockLeft] = useState<number | null>(null);
  // ID zamowienia/platnosci POTWIERDZONEJ przez API (Stripe PI succeeded /
  // P24 status paid) — dopiero wtedy opt-in Google Customer Reviews.
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);

  // Coupon / discount
  const [couponInput, setCouponInput] = useState("");
  // quantity — rabat procentowy zalezy od subtotalu, wiec kupon jest wazny
  // tylko dla ilosci, przy ktorej go sprawdzono (zmiana ilosci = ponowna walidacja).
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountCents: number; currency: ShopCurrency; quantity: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  // Licznik zapytan o kupon — odpowiedz, ktora przyszla po zmianie kraju/waluty
  // albo po usunieciu kuponu, jest ignorowana (inaczej ustawialaby rabat w starej walucie).
  const couponReqRef = useRef(0);

  // Derived pricing based on country (serwer liczy autorytatywnie — K1)
  const isPoland = formData.country === "PL";
  const isEU = EU_COUNTRIES.has(formData.country);
  // Przelacznik PLN/EUR na karcie = kraj dostawy w formularzu (jedno zrodlo prawdy).
  const showEUR = !isPoland;
  const regionOptions = regionsFor(formData.country);
  const worldCountries = useMemo(() => otherCountries(lang), [lang]);
  const regionLabel =
    formData.country === "US" ? t.regionUS : formData.country === "CA" ? t.regionCA : formData.country === "AU" ? t.regionAU : t.region;
  const currency: ShopCurrency = currencyForCountry(formData.country);
  const productCents = PRODUCT_CENTS[currency];
  // Limit ilosci: MAX_ORDER_QUANTITY, a gdy API stanu podaje liczbe — nie wiecej
  // niz stan (przy 0 szt. zostaje 1, jak dotad: zamowienie z czasem realizacji).
  const maxQty = stockLeft !== null && stockLeft >= 1 ? Math.min(MAX_ORDER_QUANTITY, stockLeft) : stockLeft === 0 ? 1 : MAX_ORDER_QUANTITY;
  const orderQty = clampQuantity(quantity, maxQty);
  const subtotalCents = productCents * orderQty;
  // Wysylka STALA na zamowienie (jedna paczka) — nie rosnie z iloscia.
  const shippingCents = shippingCentsFor(formData.country);
  const couponCurrent = !!appliedCoupon && appliedCoupon.currency === currency && appliedCoupon.quantity === orderQty;
  const discountCents = couponCurrent && appliedCoupon ? appliedCoupon.discountCents : 0;
  const totalCents = subtotalCents + shippingCents - discountCents;
  const localQuote: Quote = {
    amount: totalCents, currency, shippingCents, discountCents,
    quantity: orderQty, unitCents: productCents, subtotalCents,
  };
  const unitAt = (i: number): UnitPersonalization => units[i] ?? EMPTY_UNIT;
  // Personalizacje wysylane do API (dlugosc == ilosc).
  const personalizations = Array.from({ length: orderQty }, (_, i) => ({
    unlockCode: sameCode ? unitAt(0).unlockCode : unitAt(i).unlockCode,
    name: unitAt(i).name.trim(),
  }));
  const setUnit = (i: number, patch: Partial<UnitPersonalization>) => {
    setUnits((prev) => {
      const next = [...prev];
      while (next.length <= i) next.push(EMPTY_UNIT);
      next[i] = { ...next[i], ...patch };
      return next;
    });
  };

  // Format kwoty w aktualnej walucie, wg jezyka strony (Intl)
  const fmtMoney = (cents: number, cur: string = currency) => formatMoney(cents, cur, lang);

  const sessionEmail = session?.user?.email || "";
  const sessionName = session?.user?.name || "";

  const invalidateCoupon = () => {
    couponReqRef.current++;
    setAppliedCoupon(null);
    setCouponMsg("");
    setCouponLoading(false);
  };

  // Walidacja kuponu dla danej ilosci (rabat procentowy liczony od subtotalu).
  // Kazde nowe zapytanie uniewaznia poprzednie (couponReqRef) — spoznione
  // odpowiedzi (stara ilosc/waluta) sa ignorowane.
  const validateCoupon = async (code: string, reqQty: number) => {
    if (!code) return;
    const reqId = ++couponReqRef.current;
    const reqCurrency = currency;
    setCouponLoading(true);
    setCouponMsg("");
    try {
      const r = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, currency: reqCurrency, quantity: reqQty }),
      });
      const d = await r.json().catch(() => ({}));
      if (reqId !== couponReqRef.current) return; // nieaktualna odpowiedz
      if (d.ok && typeof d.discountCents === "number") {
        setAppliedCoupon({ code: d.code, discountCents: d.discountCents, currency: reqCurrency, quantity: reqQty });
        setCouponMsg("");
      } else {
        setAppliedCoupon(null);
        // Serwer odpowiada po polsku — w EN/DE pokazujemy ogolny komunikat.
        setCouponMsg(lang === "pl" && d.error ? d.error : t.couponInvalid);
      }
    } catch {
      if (reqId !== couponReqRef.current) return;
      setAppliedCoupon(null);
      setCouponMsg(t.connectionError);
    } finally {
      if (reqId === couponReqRef.current) setCouponLoading(false);
    }
  };

  const applyCoupon = () => validateCoupon(couponInput.trim(), orderQty);

  // Zmiana ilosci: rabat zalezy od subtotalu -> ponowna walidacja kuponu
  // (zastosowanego albo wlasnie sprawdzanego).
  const changeQuantity = (next: number) => {
    const q = clampQuantity(next, maxQty);
    if (q === orderQty) return;
    setQuantity(q);
    const code = appliedCoupon?.code || (couponLoading ? couponInput.trim() : "");
    if (code) void validateCoupon(code, q);
  };

  const removeCoupon = () => {
    invalidateCoupon();
    setCouponInput("");
  };

  // K1: serwer odrzucil kupon przy tworzeniu platnosci (409 {error, reason}) —
  // usuwamy go z formularza i pokazujemy komunikat; klient ponawia bez kuponu.
  const handleCouponRejected = (data: { error?: string; reason?: string } | null | undefined): string => {
    couponReqRef.current++;
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponLoading(false);
    const msg = t.couponRejected(lang === "pl" ? data?.reason || data?.error : undefined);
    setCouponMsg(msg);
    return msg;
  };

  const changeCountry = (country: string) => {
    if (country === formData.country) return;
    // Prefiks telefonu podmieniamy tylko, gdy klient nie wpisal jeszcze numeru.
    const oldPrefix = dialCode(formData.country);
    const phone = !formData.phone.trim() || formData.phone.trim() === oldPrefix
      ? (dialCode(country) ? `${dialCode(country)} ` : "")
      : formData.phone;
    setFormData({ ...formData, country, region: "", phone });
    setSelectedPoint(null);
    // Zmiana waluty uniewaznia zastosowany kupon (np. kwotowy tylko PLN)
    // i kazda trwajaca walidacje kuponu.
    invalidateCoupon();
  };

  // E-mail zamowienia = e-mail konta (serwer i tak bierze go z sesji) — pole readOnly.
  useEffect(() => {
    if (!sessionEmail) return;
    setFormData((d) => (d.email === sessionEmail ? d : { ...d, email: sessionEmail, name: d.name || sessionName }));
  }, [sessionEmail, sessionName]);

  useEffect(() => {
    fetch("/api/stock")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.stock === "number" && Number.isFinite(d.stock) && d.stock >= 0) {
          setStockLeft(d.stock);
          setQuantity((q) => clampQuantity(q, d.stock >= 1 ? Math.min(MAX_ORDER_QUANTITY, d.stock) : 1));
        }
      })
      .catch(() => { /* bez licznika */ });
  }, []);

  // Powrot ze Stripe (redirect_status + payment_intent_client_secret) lub P24
  // (p24_return + p24_session). Parametry czytamy raz do refa — StrictMode
  // w dev odpala efekt dwa razy, a pierwszy przebieg juz czysci URL.
  const returnParamsRef = useRef<URLSearchParams | null>(null);
  const returnHandledRef = useRef(false);

  useEffect(() => {
    if (!returnParamsRef.current) returnParamsRef.current = new URLSearchParams(window.location.search);
    const params = returnParamsRef.current;
    const redirectStatus = params.get("redirect_status");
    const piSecret = params.get("payment_intent_client_secret");
    const isP24Return = params.get("p24_return") === "true";
    const p24Session = params.get("p24_session");
    if (!redirectStatus && !isP24Return) return;

    returnHandledRef.current = true;
    cleanCheckoutQuery();
    try {
      const ctx = JSON.parse(sessionStorage.getItem(CHECKOUT_CTX_KEY) || "null") as { country?: unknown } | null;
      if (typeof ctx?.country === "string" && ctx.country) {
        const country = ctx.country;
        setFormData((d) => ({ ...d, country }));
      }
    } catch { /* ignore */ }
    setIsModalOpen(true);
    let cancelled = false;

    if (redirectStatus) {
      if (redirectStatus === "failed") {
        setStage("form");
        setErrorMessage(t.paymentFailed);
        return;
      }
      if (!piSecret) {
        setStage("pending");
        return;
      }
      // Status z API Stripe, nie z samego query (redirect_status da sie wpisac recznie).
      setStage("processing");
      (async () => {
        try {
          const { default: getStripe } = await import("@/lib/getStripe");
          const stripe = await getStripe();
          const res = stripe ? await stripe.retrievePaymentIntent(piSecret) : null;
          if (cancelled) return;
          const pi = res?.paymentIntent;
          if (pi?.status === "succeeded") {
            setConfirmedOrderId(pi.id);
            setStage("success");
          } else if (pi && (pi.status === "requires_payment_method" || pi.status === "canceled")) {
            setStage("form");
            setErrorMessage(t.paymentFailed);
          } else {
            setStage("pending");
          }
        } catch {
          if (!cancelled) setStage("pending");
        }
      })();
      return () => { cancelled = true; };
    }

    if (!p24Session) {
      setStage("pending");
      return;
    }
    setStage("processing");
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      try {
        const r = await fetch(`/api/p24/status?sessionId=${encodeURIComponent(p24Session)}`);
        const d = await r.json();
        if (cancelled) return;
        if (d.status === "paid") {
          clearInterval(poll);
          setConfirmedOrderId(typeof d.orderNumber === "string" && d.orderNumber ? d.orderNumber : p24Session);
          setStage("success");
          return;
        }
      } catch { /* kolejna proba */ }
      if (attempts >= 12) {
        clearInterval(poll);
        if (!cancelled) setStage("pending");
      }
    }, 2500);
    return () => { cancelled = true; clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ?checkout=true (powrot z logowania / z koszyka) — otworz formularz, ale
  // NIGDY przy powrocie z platnosci (nadpisalby ekran sukcesu -> podwojna platnosc).
  const checkoutHandledRef = useRef(false);
  useEffect(() => {
    if (status !== "authenticated" || checkoutHandledRef.current || returnHandledRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "true" || params.get("redirect_status") || params.get("p24_return")) return;
    checkoutHandledRef.current = true;
    cleanCheckoutQuery();
    // Ilosc z koszyka: ?qty= (z /koszyk, takze po logowaniu), inaczej z kontekstu koszyka.
    const qtyParam = params.get("qty");
    const cartQty = cartItems.find((i) => i.id === PRODUCT_ID)?.quantity;
    if (qtyParam || cartQty) setQuantity(clampQuantity(qtyParam ?? cartQty, maxQty));
    // Waluta z koszyka (np. dodano w EUR na /, a landing domyslnie PLN).
    const cartCurrency = cartItems.find((i) => i.id === PRODUCT_ID)?.currency;
    if (cartCurrency === "PLN") changeCountry("PL");
    else if (cartCurrency === "EUR" && isPoland) changeCountry(intlDefault);
    setIsModalOpen(true);
    setStage("form");
    setErrorMessage("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Kontekst na czas przekierowania do bramki (patrz CHECKOUT_CTX_KEY).
  useEffect(() => {
    if (stage !== "payment") return;
    try { sessionStorage.setItem(CHECKOUT_CTX_KEY, JSON.stringify({ country: formData.country })); } catch { /* ignore */ }
  }, [stage, formData.country]);

  // Udana platnosc -> pusty koszyk (koszyk trzyma tylko KalkMate, ktory wlasnie kupiono).
  useEffect(() => {
    if (stage !== "success") return;
    clearCart();
    try { sessionStorage.removeItem(CHECKOUT_CTX_KEY); } catch { /* ignore */ }
  }, [stage, clearCart]);

  const gcsSurveyRendered = useRef(false);
  const stripeMessagingRef = useRef<HTMLDivElement>(null);
  const [stripeInView, setStripeInView] = useState(false);
  // Komunikat Klarny (Stripe.js) tylko po zgodzie analitycznej albo po
  // otwarciu modala zamowienia — bez tego landing nie laduje js.stripe.com.
  const [messagingAllowed, setMessagingAllowed] = useState(false);

  useEffect(() => {
    const check = () => { if (hasAnalyticsConsent()) setMessagingAllowed(true); };
    check();
    window.addEventListener(CONSENT_EVENT, check);
    return () => window.removeEventListener(CONSENT_EVENT, check);
  }, []);

  useEffect(() => {
    if (isModalOpen) setMessagingAllowed(true);
  }, [isModalOpen]);

  useEffect(() => {
    const el = stripeMessagingRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStripeInView(true); observer.disconnect(); } },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Google Customer Reviews — tylko dla platnosci potwierdzonej przez API
  // (nie z samego ?redirect_status=succeeded w URL).
  useEffect(() => {
    if (!confirmedOrderId || gcsSurveyRendered.current) return;
    const customerEmail = sessionEmail || formData.email;
    if (!customerEmail) return; // sesja jeszcze sie laduje — efekt odpali sie ponownie
    gcsSurveyRendered.current = true;
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 28);
    const estimatedDelivery = deliveryDate.toISOString().slice(0, 10);
    const orderId = confirmedOrderId;
    const w = window as GcrWindow;
    w.renderOptIn = function () {
      w.gapi?.load("surveyoptin", function () {
        w.gapi?.surveyoptin.render({
          merchant_id: 5808165395,
          order_id: orderId,
          email: customerEmail,
          delivery_country: formData.country === "OTHER" ? "US" : formData.country,
          estimated_delivery_date: estimatedDelivery,
          products: [{ gtin: "5904224900012" }],
        });
      });
    };
    if (!w.gapi) {
      const script = document.createElement("script");
      script.src = "https://apis.google.com/js/platform.js?onload=renderOptIn";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    } else {
      w.renderOptIn();
    }
  }, [confirmedOrderId, sessionEmail, formData.email, formData.country]);

  useEffect(() => {
    document.body.style.overflow = isModalOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isModalOpen]);

  const openModal = useCallback(() => {
    if (status === "loading") return;
    if (status !== "authenticated") {
      // Po zalogowaniu (albo rejestracji + weryfikacji maila) wracamy prosto
      // do formularza zamowienia na tym samym landingu.
      const cb = `${window.location.pathname}?checkout=true#kup-teraz`;
      rememberCallback(cb);
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(cb)}`);
      return;
    }
    setIsModalOpen(true);
    setStage("form");
    setErrorMessage("");
  }, [status, router]);

  const closeModal = useCallback(() => setIsModalOpen(false), []);
  const handlePointSelect = useCallback((point: InPostPoint) => {
    setSelectedPoint(point);
    setStage("form");
  }, []);

  // Zgody z formularza do API platnosci (dowod zgody przy zamowieniu). Checkbox
  // personalizacji jest jednoczesnie swiadoma rezygnacja z prawa odstapienia.
  const consentFields = { personalizeConsent, withdrawalConsent: personalizeConsent };
  // Ilosc + personalizacja kazdej sztuki; stare pola unlockCode/personalizeName
  // = sztuka 1 (zgodnosc ze starszym serwerem).
  const orderFields = {
    quantity: orderQty,
    personalizations,
    unlockCode: personalizations[0]?.unlockCode ?? "",
    personalizeName: personalizations[0]?.name ?? "",
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || couponLoading) return;
    if (isPoland && !selectedPoint) {
      setErrorMessage(t.errPickupPoint);
      return;
    }
    if (isPoland && (!formData.street || !formData.postcode || !formData.city)) {
      setErrorMessage(t.errFullAddress);
      return;
    }
    if (!isPoland && (!formData.street || !formData.city)) {
      setErrorMessage(t.errDeliveryAddress);
      return;
    }
    if (regionOptions && !regionOptions.some((r) => r.code === formData.region)) {
      setErrorMessage(t.errRegion);
      return;
    }
    // Kazda sztuka: 4-cyfrowy kod + imie/nick.
    for (let i = 0; i < personalizations.length; i++) {
      const p = personalizations[i];
      if (!/^\d{4}$/.test(p.unlockCode)) {
        setErrorMessage(orderQty > 1 && !sameCode ? t.errPersonalizeCodeUnit(i + 1) : t.errPersonalizeCode);
        return;
      }
      if (!p.name) {
        setErrorMessage(orderQty > 1 ? t.errPersonalizeNameUnit(i + 1) : t.errPersonalizeName);
        return;
      }
    }
    if (!personalizeConsent) {
      setErrorMessage(t.errPersonalizeConsent);
      return;
    }
    setErrorMessage("");

    // Polish customers → P24 (no Stripe PaymentIntent needed yet)
    if (isPoland) {
      setStage("payment");
      return;
    }

    // EU / international customers → Stripe (Klarna + cards)
    submittingRef.current = true;
    setIsCreatingIntent(true);
    try {
      const res = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          // Order nie ma kolumny na stan — "Austin, TX" (patrz lib/countries.ts).
          city: cityWithRegion(formData.city, formData.region),
          attribution: readClientAttribution(),
          currency,
          shippingCents,
          couponCode: appliedCoupon?.code || null,
          pickupPoint: null,
          pickupPointAddress: null,
          ...consentFields,
          ...orderFields,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setErrorMessage(handleCouponRejected(data));
        return;
      }
      if (!res.ok) throw new Error(data.error || t.serverError);
      setClientSecret(data.clientSecret);
      setQuote(quoteFromServer(data, localQuote));
      setStage("payment");
    } catch (err) {
      setErrorMessage(err instanceof Error && err.name !== "TypeError" ? err.message : t.connectionError);
    } finally {
      submittingRef.current = false;
      setIsCreatingIntent(false);
    }
  };

  const initPolandStripe = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsPolandStripeLoading(true);
    setPolandStripeError("");
    setErrorMessage("");
    try {
      const res = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          // Order nie ma kolumny na stan — "Austin, TX" (patrz lib/countries.ts).
          city: cityWithRegion(formData.city, formData.region),
          attribution: readClientAttribution(),
          currency,
          shippingCents,
          couponCode: appliedCoupon?.code || null,
          pickupPoint: selectedPoint?.name || null,
          pickupPointAddress: selectedPoint
            ? `${selectedPoint.address.line1}, ${selectedPoint.address.line2}`
            : null,
          ...consentFields,
          ...orderFields,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) throw new Error(handleCouponRejected(data));
      if (!res.ok) throw new Error(data.error || t.serverError);
      setPolandStripeSecret(data.clientSecret);
      setPolandQuote(quoteFromServer(data, localQuote));
    } catch (err) {
      setPolandStripeError(err instanceof Error && err.name !== "TypeError" ? err.message : t.connectionError);
    } finally {
      submittingRef.current = false;
      setIsPolandStripeLoading(false);
    }
  };

  const handlePaymentSuccess = (payment?: ConfirmedPayment) => {
    // Np. przelew/SEPA: Stripe przyjal platnosc, ale jeszcze jej nie potwierdzil.
    if (payment && payment.status !== "succeeded") {
      setStage("pending");
      return;
    }
    if (payment) setConfirmedOrderId(payment.id);
    setStage("success");
  };
  const handlePaymentError = (m: string) => { setErrorMessage(m); setStage("error"); };

  return (
    <>
      <section id="kup-teraz" className="relative py-24 lg:py-36 bg-[#0E0E0E] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[720px] rounded-full bg-[#D8FF3D] opacity-[0.05] blur-[180px]" />
        </div>

        <div className="mx-auto max-w-[1400px] px-5 lg:px-10 relative z-10">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-16 items-start">
            {/* Left: copy */}
            <div className="lg:col-span-7">
              <p className="km-mono-eyebrow text-[#D8FF3D]">{t.eyebrow}</p>
              <h2 className="km-display text-[clamp(48px,8vw,128px)] text-[#F2EDE3] mt-4">
                {t.h2a}<span className="italic text-[#D8FF3D]">{t.h2italic}</span>{t.h2b}<br />
                {t.h2line2}
              </h2>
              <p className="mt-8 text-[15px] leading-[1.65] text-[#F2EDE3]/65 max-w-md">
                {t.intro}
              </p>
              <ul className="mt-10 space-y-3">
                {t.included.map((item, i) => (
                  <li key={i} className="flex items-baseline gap-4 text-[15px] text-[#F2EDE3]/80">
                    <span className="km-mono-eyebrow text-[#D8FF3D] w-6">{String(i + 1).padStart(2, "0")}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3">
                {t.badges.map((badge) => (
                  <span key={badge} className="km-mono-eyebrow text-[#F2EDE3]/55 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full" />
                    {badge}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: order card */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="lg:col-span-5 lg:col-start-8 relative lg:max-w-[460px] lg:ml-auto w-full"
            >
              <div className="relative bg-[#0B0B0B] border border-[rgba(242,237,227,0.18)]">
                <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-l border-t border-[#D8FF3D]" />
                <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-r border-t border-[#D8FF3D]" />
                <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-l border-b border-[#D8FF3D]" />
                <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-r border-b border-[#D8FF3D]" />

                <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(242,237,227,0.10)]">
                  <span className="km-mono-eyebrow text-[#F2EDE3]/55">/ KM-v3.0 · ORDER</span>
                  {stockLeft !== null && (
                    <span className="km-mono-eyebrow text-[#D8FF3D] flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-[#D8FF3D] rounded-full km-blink" />
                      {t.stockAvailable(stockLeft)}
                    </span>
                  )}
                </div>

                {/* Currency toggle */}
                <div className="flex border-b border-[rgba(242,237,227,0.10)]">
                  <button
                    onClick={() => changeCountry("PL")}
                    className={`flex-1 py-2.5 km-mono-eyebrow text-xs transition-colors ${!showEUR ? "bg-[#D8FF3D] text-[#0B0B0B]" : "text-[#F2EDE3]/55 hover:text-[#F2EDE3]"}`}
                  >
                    PLN · 🇵🇱
                  </button>
                  <button
                    onClick={() => { if (isPoland) changeCountry(intlDefault); }}
                    className={`flex-1 py-2.5 km-mono-eyebrow text-xs transition-colors ${showEUR ? "bg-[#D8FF3D] text-[#0B0B0B]" : "text-[#F2EDE3]/55 hover:text-[#F2EDE3]"}`}
                  >
                    EUR · 🌍
                  </button>
                </div>

                {/* Price */}
                <div className="px-6 lg:px-8 py-10">
                  <p className="km-mono-eyebrow text-[#F2EDE3]/55">
                    {t.preSalePrice}
                  </p>
                  <div className="mt-3 flex items-baseline gap-4">
                    <span className="km-display text-[100px] leading-[0.9] text-[#F2EDE3]">
                      {showEUR ? "169" : "699"}
                    </span>
                    <span className="km-display text-3xl text-[#F2EDE3]/45">
                      {showEUR ? "€" : "zł"}
                    </span>
                  </div>
                  <p className="mt-3 km-mono-eyebrow text-[#D8FF3D]">
                    {showEUR ? t.shippingEur : t.discountPln}
                  </p>
                  <p className="mt-2 km-mono-eyebrow text-[#F2EDE3]/55 text-[11px]">
                    {t.lowestPrice30d}: {fmtMoney(productCents)}
                  </p>

                  <div ref={stripeMessagingRef} className="mt-6 [&_iframe]:!min-h-0 opacity-80">
                    {stripeInView && messagingAllowed && (
                      <KlarnaMessaging
                        amount={subtotalCents}
                        currency={currency}
                        countryCode={showEUR ? "DE" : "PL"}
                        lang={lang}
                      />
                    )}
                  </div>
                </div>

                <div className="mx-6 lg:mx-8 mb-6 border border-[rgba(242,237,227,0.10)] p-4">
                  <p className="km-mono-eyebrow text-[#D8FF3D]">{t.production}</p>
                  <p className="mt-2 text-[13.5px] leading-[1.55] text-[#F2EDE3]/65">
                    {t.productionNote1}<span className="text-[#F2EDE3]">{t.productionNoteHand}</span>{t.productionNote2}<span className="text-[#F2EDE3]">{t.productionNoteWeeks}</span>.
                  </p>
                </div>

                <button
                  onClick={openModal}
                  className="group w-full px-6 py-5 bg-[#D8FF3D] text-[#0B0B0B] km-mono-eyebrow text-[13px] hover:bg-[#F2EDE3] transition-colors flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#0B0B0B] rounded-full km-blink" />
                    {showEUR ? t.orderNowEur : t.orderNowPln}
                  </span>
                  <span>→</span>
                </button>
                <button
                  onClick={() => addItem({ id: PRODUCT_ID, name: PRODUCT_NAME, price: productCents, currency, lang })}
                  className="w-full px-6 py-4 border border-[rgba(242,237,227,0.18)] text-[#F2EDE3]/70 km-mono-eyebrow text-[13px] hover:border-[#D8FF3D] hover:text-[#F2EDE3] transition-colors flex items-center justify-between"
                >
                  <span>{t.addToCart}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <path d="M16 10a4 4 0 01-8 0" />
                  </svg>
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={closeModal}
          >
            <div className="absolute inset-0 bg-[#0B0B0B]/80 backdrop-blur-md" />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className={`relative w-full max-h-[90vh] overflow-y-auto bg-[#0B0B0B] border border-[rgba(242,237,227,0.18)] ${
                stage === "map" ? "max-w-3xl" : "max-w-lg"
              }`}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(242,237,227,0.10)] sticky top-0 bg-[#0B0B0B] z-10">
                <span className="km-mono-eyebrow text-[#D8FF3D]">/ KM-v3.0 · {stage.toUpperCase()}</span>
                <button
                  onClick={closeModal}
                  className="w-8 h-8 border border-[rgba(242,237,227,0.20)] flex items-center justify-center text-[#F2EDE3] hover:bg-[#F2EDE3] hover:text-[#0B0B0B] transition-colors"
                  aria-label={t.closeAria}
                >
                  ✕
                </button>
              </div>

              <div className="p-6 lg:p-8">
                {stage === "form" && (
                  <form onSubmit={handleFormSubmit} className="space-y-5">
                    <h3 className="km-display text-3xl text-[#F2EDE3]">
                      {t.shippingDetails}
                    </h3>

                    {/* Ilosc — 1..maxQty (MAX_ORDER_QUANTITY / stan magazynu) */}
                    <div className="flex items-center justify-between gap-4 border border-[rgba(242,237,227,0.10)] p-4">
                      <div className="min-w-0">
                        <p className="km-mono-eyebrow text-[#F2EDE3]/55">{t.quantityLabel}</p>
                        <p className="km-mono-eyebrow text-[#F2EDE3]/55 text-[10px] mt-1">
                          {maxQty < MAX_ORDER_QUANTITY ? t.quantityStockLimit(maxQty) : t.quantityLimit(MAX_ORDER_QUANTITY)}
                        </p>
                      </div>
                      <div className="flex items-center border border-[rgba(242,237,227,0.20)] flex-shrink-0">
                        <button type="button" onClick={() => changeQuantity(orderQty - 1)} disabled={orderQty <= 1}
                          aria-label={t.decrease} className="w-10 h-10 flex items-center justify-center text-[#F2EDE3] text-lg hover:bg-[#F2EDE3] hover:text-[#0B0B0B] transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#F2EDE3]">−</button>
                        <span className="w-10 text-center km-display text-xl text-[#F2EDE3]" aria-live="polite">{orderQty}</span>
                        <button type="button" onClick={() => changeQuantity(orderQty + 1)} disabled={orderQty >= maxQty}
                          aria-label={t.increase} className="w-10 h-10 flex items-center justify-center text-[#F2EDE3] text-lg hover:bg-[#F2EDE3] hover:text-[#0B0B0B] transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#F2EDE3]">+</button>
                      </div>
                    </div>

                    {/* Order summary — wysylka stala na zamowienie, rabat od subtotalu */}
                    <div className="border border-[rgba(242,237,227,0.10)] p-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
                      <span className="text-[#F2EDE3]/65">
                        KalkMate v3.0{orderQty > 1 ? ` × ${orderQty}` : ""}
                        {orderQty > 1 && (
                          <span className="block text-xs text-[#F2EDE3]/55">{fmtMoney(productCents)} {t.perUnit}</span>
                        )}
                      </span>
                      <span className="text-right text-[#F2EDE3]">
                        {fmtMoney(subtotalCents)}
                      </span>
                      <span className="text-[#F2EDE3]/55 text-xs">
                        {isPoland ? t.inpostParcel : isEU ? t.euCourier : t.intlCourier}
                        {orderQty > 1 && <span className="block text-[#F2EDE3]/55">{t.shippingPerOrder}</span>}
                      </span>
                      {shippingCents === 0 ? (
                        <span className="text-right text-[#D8FF3D] km-mono-eyebrow">{t.free}</span>
                      ) : (
                        <span className="text-right text-[#F2EDE3]">{fmtMoney(shippingCents)}</span>
                      )}
                      {appliedCoupon && (
                        <>
                          <span className="text-[#D8FF3D] text-xs">{t.couponTag} {appliedCoupon.code}</span>
                          <span className="text-right text-[#D8FF3D]">{couponCurrent ? `−${fmtMoney(discountCents)}` : "…"}</span>
                        </>
                      )}
                      {(appliedCoupon || orderQty > 1 || shippingCents > 0) && (
                        <>
                          <span className="km-mono-eyebrow text-[#F2EDE3] pt-2 border-t border-[rgba(242,237,227,0.10)] mt-1">{t.total}</span>
                          <span className="text-right km-display text-xl text-[#F2EDE3] pt-2 border-t border-[rgba(242,237,227,0.10)] mt-1">
                            {appliedCoupon && !couponCurrent && couponLoading ? "…" : fmtMoney(totalCents)}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Coupon code */}
                    <div>
                      <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                        {t.couponLabel}
                      </label>
                      {appliedCoupon ? (
                        <div className="flex items-center justify-between p-3 border border-[#D8FF3D]/50 bg-[#D8FF3D]/[0.05]">
                          <span className="text-sm text-[#F2EDE3]">
                            <span className="km-mono-eyebrow text-[#D8FF3D]">{appliedCoupon.code}</span>
                            {" · "}{couponCurrent ? `−${fmtMoney(discountCents)}` : "…"}
                          </span>
                          <button type="button" onClick={removeCoupon} className="km-mono-eyebrow text-[#F2EDE3]/55 hover:text-[#FF4D2E] ml-3">
                            {t.couponRemove}
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={couponInput}
                            onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCoupon(); } }}
                            placeholder={t.couponPlaceholder}
                            className={inputClass + " uppercase flex-1"}
                          />
                          <button
                            type="button"
                            onClick={applyCoupon}
                            disabled={couponLoading || !couponInput.trim()}
                            className="px-4 km-mono-eyebrow border border-[#D8FF3D]/50 text-[#D8FF3D] hover:bg-[#D8FF3D] hover:text-[#0B0B0B] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {couponLoading ? "..." : t.couponApply}
                          </button>
                        </div>
                      )}
                      {couponMsg && <p className="text-xs text-[#FF4D2E] mt-2">{couponMsg}</p>}
                    </div>

                    {/* Country selector */}
                    <div>
                      <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                        {t.deliveryCountry}
                      </label>
                      <select
                        value={formData.country}
                        onChange={(e) => changeCountry(e.target.value)}
                        className={inputClass + " cursor-pointer"}
                      >
                        <optgroup label={t.popularCountries}>
                          {COUNTRIES.map((c) => (
                            <option key={c.code} value={c.code}>{c.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label={t.allCountries}>
                          {worldCountries.map((c) => (
                            <option key={c.code} value={c.code}>{c.name}</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    <div>
                      <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                        {t.fullName}
                      </label>
                      <input type="text" required value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={inputClass} />
                    </div>
                    <div>
                      <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">{t.email}</label>
                      <input type="email" required value={formData.email}
                        readOnly={!!sessionEmail}
                        aria-readonly={!!sessionEmail}
                        onChange={(e) => { if (!sessionEmail) setFormData({ ...formData, email: e.target.value }); }}
                        className={inputClass + (sessionEmail ? " opacity-60 cursor-not-allowed focus:border-[rgba(242,237,227,0.18)]" : "")} />
                      {sessionEmail && <p className="text-xs text-[#F2EDE3]/55 mt-1.5">{t.emailFromAccount}</p>}
                    </div>
                    <div>
                      <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                        {t.phone}
                      </label>
                      <input type="tel" required autoComplete="tel" value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        onFocus={() => {
                          if (!formData.phone.trim() && dialCode(formData.country)) {
                            setFormData({ ...formData, phone: `${dialCode(formData.country)} ` });
                          }
                        }}
                        placeholder={dialCode(formData.country) ? `${dialCode(formData.country)} …` : undefined}
                        className={inputClass} />
                      {!isPoland && <p className="text-xs text-[#F2EDE3]/55 mt-1.5">{t.phoneHint}</p>}
                    </div>

                    {/* Address */}
                    <div className="border border-[rgba(242,237,227,0.10)] p-4 space-y-3">
                      <p className="km-mono-eyebrow text-[#D8FF3D] text-xs">
                        {t.invoiceAddress}
                      </p>
                      <div>
                        <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                          {t.street}
                        </label>
                        <input type="text" required value={formData.street}
                          onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                          className={inputClass}
                          placeholder={t.streetPlaceholder} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                            {t.postcode}
                          </label>
                          <input type="text" required value={formData.postcode}
                            onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                            className={inputClass}
                            placeholder={postcodeHint(formData.country) || t.postcodePlaceholder}
                            pattern={isPoland ? "\\d{2}-\\d{3}" : undefined} />
                        </div>
                        <div>
                          <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                            {t.city}
                          </label>
                          <input type="text" required value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            className={inputClass}
                            placeholder={t.cityPlaceholder} />
                        </div>
                      </div>
                      {regionOptions ? (
                        <div>
                          <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">{regionLabel}</label>
                          <select required value={formData.region}
                            onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                            className={inputClass + " cursor-pointer"}>
                            <option value="">{t.regionChoose}</option>
                            {regionOptions.map((r) => (
                              <option key={r.code} value={r.code}>{r.name}</option>
                            ))}
                          </select>
                        </div>
                      ) : showsOptionalRegion(formData.country) ? (
                        <div>
                          <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">{t.regionOptional}</label>
                          <input type="text" value={formData.region} maxLength={60}
                            onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                            className={inputClass} />
                        </div>
                      ) : null}
                    </div>

                    {/* InPost picker — only Poland */}
                    {isPoland && (
                      <div>
                        <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">{t.pickupPoint}</label>
                        {selectedPoint ? (
                          <div className="flex items-center justify-between p-3 border border-[#D8FF3D]/50 bg-[#D8FF3D]/[0.05]">
                            <div className="min-w-0">
                              <p className="text-sm text-[#F2EDE3] truncate">{selectedPoint.name}</p>
                              <p className="text-xs text-[#F2EDE3]/50 truncate">
                                {selectedPoint.address.line1}, {selectedPoint.address.line2}
                              </p>
                            </div>
                            <button type="button" onClick={() => setStage("map")} className="km-mono-eyebrow text-[#D8FF3D] ml-3">
                              {t.changePoint}
                            </button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setStage("map")}
                            className="w-full px-4 py-3 border border-dashed border-[rgba(242,237,227,0.25)] text-[#F2EDE3]/60 hover:border-[#D8FF3D] hover:text-[#F2EDE3] km-mono-eyebrow transition-colors">
                            {t.selectParcel}
                          </button>
                        )}
                      </div>
                    )}

                    {/* International shipping note */}
                    {!isPoland && (
                      <div className="border border-[rgba(242,237,227,0.10)] p-4 bg-[#D8FF3D]/[0.03]">
                        <p className="km-mono-eyebrow text-[#D8FF3D] text-xs mb-1">{t.intlDeliveryTitle}</p>
                        <p className="text-xs text-[#F2EDE3]/60 leading-relaxed">
                          {t.intlDeliveryNote1}{" "}
                          <strong className="text-[#F2EDE3]">{fmtMoney(shippingCents)}</strong>{" "}
                          {t.intlDeliveryNote2}
                        </p>
                      </div>
                    )}

                    {/* Personalizacja — kod AI wgrywany do TEJ sztuki + imie na etykiete.
                        Wymagane dla kazdego zamowienia: to podstawa wylaczenia prawa
                        odstapienia (art. 38 pkt 3 ustawy o prawach konsumenta) —
                        patrz lib/orderPersonalization.ts i regulamin/page.tsx §5. */}
                    <div className="border border-[#D8FF3D]/30 bg-[#D8FF3D]/[0.03] p-4 space-y-4">
                      <p className="km-mono-eyebrow text-[#D8FF3D] text-xs">
                        {orderQty > 1 ? t.personalizeTitleMulti(orderQty) : t.personalizeTitle}
                      </p>
                      {orderQty === 1 ? (
                        <>
                          <div>
                            <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                              {t.personalizeCodeLabel}
                            </label>
                            <input type="text" inputMode="numeric" pattern="\d{4}" maxLength={4} required
                              value={unitAt(0).unlockCode}
                              onChange={(e) => setUnit(0, { unlockCode: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                              className={inputClass}
                              placeholder={t.personalizeCodePlaceholder} />
                            <p className="text-xs text-[#F2EDE3]/55 mt-1.5 leading-relaxed">{t.personalizeCodeHint}</p>
                          </div>
                          <div>
                            <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                              {t.personalizeNameLabel}
                            </label>
                            <input type="text" required maxLength={40}
                              value={unitAt(0).name}
                              onChange={(e) => setUnit(0, { name: e.target.value })}
                              className={inputClass}
                              placeholder={t.personalizeNamePlaceholder} />
                            <p className="text-xs text-[#F2EDE3]/55 mt-1.5 leading-relaxed">{t.personalizeNameHint}</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input type="checkbox" checked={sameCode}
                              onChange={(e) => setSameCode(e.target.checked)}
                              className="mt-0.5 accent-[#D8FF3D]" />
                            <span className="text-xs text-[#F2EDE3]/80 leading-relaxed">{t.sameCodeLabel}</span>
                          </label>
                          {sameCode && (
                            <div>
                              <label className="km-mono-eyebrow text-[#F2EDE3]/55 block mb-2">
                                {t.personalizeCodeLabelAll}
                              </label>
                              <input type="text" inputMode="numeric" pattern="\d{4}" maxLength={4} required
                                value={unitAt(0).unlockCode}
                                onChange={(e) => setUnit(0, { unlockCode: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                                className={inputClass}
                                placeholder={t.personalizeCodePlaceholder} />
                              <p className="text-xs text-[#F2EDE3]/55 mt-1.5 leading-relaxed">{t.personalizeCodeHintMulti}</p>
                            </div>
                          )}
                          <div className="space-y-3">
                            {Array.from({ length: orderQty }, (_, i) => (
                              <div key={i} className="border-t border-[#D8FF3D]/15 pt-3">
                                <p className="km-mono-eyebrow text-[#F2EDE3]/70 text-[11px] mb-2">
                                  {t.unitLabel(i + 1)} / {orderQty}
                                </p>
                                <div className={sameCode ? "" : "grid grid-cols-[84px_1fr] gap-2"}>
                                  {!sameCode && (
                                    <input type="text" inputMode="numeric" pattern="\d{4}" maxLength={4} required
                                      aria-label={`${t.unitCode} — ${t.unitLabel(i + 1)}`}
                                      value={unitAt(i).unlockCode}
                                      onChange={(e) => setUnit(i, { unlockCode: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                                      className={inputClass + " px-3 text-center tracking-[0.2em]"}
                                      placeholder="0000" />
                                  )}
                                  <input type="text" required maxLength={40}
                                    aria-label={`${t.unitName} — ${t.unitLabel(i + 1)}`}
                                    value={unitAt(i).name}
                                    onChange={(e) => setUnit(i, { name: e.target.value })}
                                    className={inputClass + " min-w-0"}
                                    placeholder={`${t.unitName}`} />
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-[#F2EDE3]/55 leading-relaxed">
                            {sameCode ? t.personalizeNameHintMulti : `${t.personalizeCodeHintEach} ${t.personalizeNameHintMulti}`}
                          </p>
                        </>
                      )}
                      <p className="text-xs text-[#F2EDE3]/55 leading-relaxed border-t border-[#D8FF3D]/20 pt-3">
                        {t.personalizeNotice}
                      </p>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" required checked={personalizeConsent}
                          onChange={(e) => setPersonalizeConsent(e.target.checked)}
                          className="mt-1 accent-[#D8FF3D]" />
                        <span className="text-xs text-[#F2EDE3]/70 leading-relaxed">
                          {orderQty > 1 ? t.personalizeConsentMulti : t.personalizeConsent}
                        </span>
                      </label>
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" required checked={formData.consent}
                        onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                        className="mt-1 accent-[#D8FF3D]" />
                      <span className="text-xs text-[#F2EDE3]/55 leading-relaxed">
                        {t.consent1}<a href="/regulamin" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#D8FF3D]">{t.consentTerms}</a>{t.consent2}
                      </span>
                    </label>

                    {/* Zgoda marketingowa — osobny, NIEobowiazkowy, domyslnie odznaczony
                        checkbox (RODO: zgoda nie moze byc warunkiem zakupu). */}
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" checked={formData.marketingConsent}
                        onChange={(e) => setFormData({ ...formData, marketingConsent: e.target.checked })}
                        className="mt-1 accent-[#D8FF3D]" />
                      <span className="text-xs text-[#F2EDE3]/55 leading-relaxed">{t.newsletterConsent}</span>
                    </label>

                    {errorMessage && <p className="text-sm text-[#FF4D2E]">{errorMessage}</p>}

                    <button
                      type="submit"
                      disabled={isCreatingIntent || couponLoading || (isPoland && !selectedPoint)}
                      className={`w-full py-4 km-mono-eyebrow transition-colors ${
                        isCreatingIntent || couponLoading || (isPoland && !selectedPoint)
                          ? "bg-[#D8FF3D]/30 text-[#0B0B0B]/50 cursor-not-allowed"
                          : "bg-[#D8FF3D] text-[#0B0B0B] hover:bg-[#F2EDE3]"
                      }`}
                    >
                      {isCreatingIntent ? t.loading : t.continueToPayment}
                    </button>
                  </form>
                )}

                {stage === "map" && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="km-display text-3xl text-[#F2EDE3]">{t.selectParcelTitle}</h3>
                      <button onClick={() => setStage("form")} className="km-mono-eyebrow text-[#D8FF3D]">{t.back}</button>
                    </div>
                    <div className="border border-[rgba(242,237,227,0.10)] overflow-hidden">
                      <Suspense fallback={
                        <div className="flex items-center justify-center h-[440px] bg-[#0E0E0E]">
                          <span className="km-mono-eyebrow text-[#F2EDE3]/55">{t.loadingMap}</span>
                        </div>
                      }>
                        <InPostGeowidget token={INPOST_TOKEN} onPointSelect={handlePointSelect} height="440px" />
                      </Suspense>
                    </div>
                  </div>
                )}

                {(stage === "payment" || stage === "error") && isPoland && (
                  <P24CheckoutForm
                    formData={formData}
                    selectedPoint={selectedPoint}
                    isPoland={isPoland}
                    currency={currency}
                    productCents={productCents}
                    quantity={orderQty}
                    subtotalCents={subtotalCents}
                    personalizations={personalizations}
                    shippingCents={shippingCents}
                    discountCents={discountCents}
                    totalCents={totalCents}
                    appliedCoupon={appliedCoupon}
                    couponCode={appliedCoupon?.code || null}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                    onBack={() => { setStage("form"); setErrorMessage(""); setPolandStripeSecret(null); setPolandQuote(null); setPolandStripeError(""); }}
                    lang={lang}
                    personalizeConsent={personalizeConsent}
                    onCouponRejected={handleCouponRejected}
                    footer={
                      <div className="mt-1">
                        <div className="my-4 flex items-center gap-3">
                          <div className="flex-1 h-px bg-[rgba(242,237,227,0.10)]" />
                          <span className="text-xs text-[#F2EDE3]/55 km-mono-eyebrow">{t.or}</span>
                          <div className="flex-1 h-px bg-[rgba(242,237,227,0.10)]" />
                        </div>
                        {polandStripeError && (
                          <div className="mb-3 border border-[#FF4D2E]/40 bg-[#FF4D2E]/[0.06] p-3">
                            <p className="text-sm text-[#FF4D2E]">{polandStripeError}</p>
                          </div>
                        )}
                        {/* Blad platnosci Klarna (onError -> stage "error") — wczesniej nie byl nigdzie pokazywany */}
                        {errorMessage && (
                          <div className="mb-3 border border-[#FF4D2E]/40 bg-[#FF4D2E]/[0.06] p-3">
                            <p className="text-sm text-[#FF4D2E]">{errorMessage}</p>
                          </div>
                        )}
                        {!polandStripeSecret ? (
                          <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={initPolandStripe}
                            disabled={isPolandStripeLoading}
                            className="w-full flex items-center gap-4 p-4 border border-[rgba(242,237,227,0.18)] hover:border-[#D8FF3D] transition-colors disabled:opacity-50"
                          >
                            <div className="w-10 h-10 border border-[rgba(242,237,227,0.25)] flex items-center justify-center flex-shrink-0">
                              {isPolandStripeLoading
                                ? <svg className="animate-spin h-4 w-4 text-[#F2EDE3]/60" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                : <svg width="20" height="14" viewBox="0 0 24 17" fill="none"><rect x="0.5" y="0.5" width="23" height="16" rx="1.5" stroke="#F2EDE3" strokeOpacity="0.6"/><rect y="4" width="24" height="3" fill="#F2EDE3" fillOpacity="0.15"/><rect x="2" y="10" width="6" height="2" rx="0.5" fill="#F2EDE3" fillOpacity="0.6"/></svg>}
                            </div>
                            <div className="text-left">
                              <p className="text-sm text-[#F2EDE3] font-medium">{t.klarnaTitle}</p>
                              <p className="text-xs text-[#F2EDE3]/55 mt-0.5">{t.klarnaSub}</p>
                            </div>
                            <span className="ml-auto text-[#F2EDE3]/55">→</span>
                          </motion.button>
                        ) : (
                          <StripeProvider clientSecret={polandStripeSecret} lang={lang}>
                            <CheckoutForm
                              onSuccess={handlePaymentSuccess}
                              onError={handlePaymentError}
                              lang={lang}
                              amountCents={(polandQuote ?? localQuote).amount}
                              currency={(polandQuote ?? localQuote).currency}
                            />
                          </StripeProvider>
                        )}
                      </div>
                    }
                  />
                )}

                {(stage === "payment" || stage === "error") && !isPoland && clientSecret && (() => {
                  // Kwoty z odpowiedzi serwera (K1) — to on wylicza, ile pobierze Stripe.
                  const q = quote ?? localQuote;
                  return (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="km-display text-3xl text-[#F2EDE3]">
                        {t.payment}
                      </h3>
                      <button onClick={() => { setStage("form"); setErrorMessage(""); }} className="km-mono-eyebrow text-[#D8FF3D]">
                        {t.back}
                      </button>
                    </div>

                    <div className="mb-6 border border-[rgba(242,237,227,0.10)] p-4 space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#F2EDE3]/65">
                          {PRODUCT_NAME}{q.quantity > 1 ? ` × ${q.quantity}` : ""}
                          {q.quantity > 1 && (
                            <span className="block text-xs text-[#F2EDE3]/55">{fmtMoney(q.unitCents, q.currency)} {t.perUnit}</span>
                          )}
                        </span>
                        <span className="text-[#F2EDE3]">{fmtMoney(q.subtotalCents, q.currency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#F2EDE3]/65">{t.shipping}</span>
                        {q.shippingCents === 0
                          ? <span className="km-mono-eyebrow text-[#D8FF3D]">{t.free}</span>
                          : <span className="text-[#F2EDE3]">{fmtMoney(q.shippingCents, q.currency)}</span>}
                      </div>
                      {formData.city && (
                        <div className="text-xs text-[#F2EDE3]/55 pt-1">
                          ↳ {formData.street}, {cityWithRegion(formData.city, formData.region)} · {formData.country}
                        </div>
                      )}
                      {q.discountCents > 0 && (
                        <div className="flex justify-between">
                          <span className="text-[#D8FF3D]">{t.couponTag}{appliedCoupon ? ` ${appliedCoupon.code}` : ""}</span>
                          <span className="text-[#D8FF3D]">−{fmtMoney(q.discountCents, q.currency)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-3 border-t border-[rgba(242,237,227,0.10)] mt-2">
                        <span className="km-mono-eyebrow text-[#F2EDE3]">{t.total}</span>
                        <span className="km-display text-2xl text-[#F2EDE3]">
                          {fmtMoney(q.amount, q.currency)}
                        </span>
                      </div>
                    </div>

                    {errorMessage && (
                      <div className="mb-4 border border-[#FF4D2E]/40 bg-[#FF4D2E]/[0.06] p-3">
                        <p className="text-sm text-[#FF4D2E]">{errorMessage}</p>
                      </div>
                    )}

                    <StripeProvider clientSecret={clientSecret} lang={lang}>
                      <CheckoutForm
                        onSuccess={handlePaymentSuccess}
                        onError={handlePaymentError}
                        lang={lang}
                        amountCents={q.amount}
                        currency={q.currency}
                      />
                    </StripeProvider>
                  </div>
                  );
                })()}

                {stage === "processing" && (
                  <div className="text-center py-10 space-y-5">
                    <div className="mx-auto w-16 h-16 border border-[#D8FF3D] flex items-center justify-center">
                      <svg className="animate-spin h-8 w-8 text-[#D8FF3D]" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="km-display text-2xl text-[#F2EDE3]">{t.processingTitle}</p>
                      <p className="mt-2 text-sm text-[#F2EDE3]/60">
                        {t.processingBody}
                      </p>
                    </div>
                  </div>
                )}

                {stage === "pending" && (
                  <div className="text-center py-6 space-y-5">
                    <div className="mx-auto w-16 h-16 border border-[#F2EDE3]/30 flex items-center justify-center">
                      <span className="km-display text-3xl text-[#F2EDE3]/60">?</span>
                    </div>
                    <div>
                      <p className="km-display text-2xl text-[#F2EDE3]">{t.pendingTitle}</p>
                      <p className="mt-3 text-sm text-[#F2EDE3]/60 max-w-sm mx-auto leading-relaxed">
                        {t.pendingBody1}
                        {(sessionEmail || formData.email) && (
                          <>
                            {" "}{t.pendingBody2}{" "}
                            <span className="text-[#F2EDE3]">{sessionEmail || formData.email}</span>{t.pendingBody3}
                          </>
                        )}
                      </p>
                      <p className="mt-3 text-xs text-[#F2EDE3]/55">
                        {t.pendingRetry}
                      </p>
                    </div>
                    <button
                      onClick={closeModal}
                      className="mt-2 px-8 py-3 border border-[rgba(242,237,227,0.18)] text-[#F2EDE3]/70 km-mono-eyebrow hover:border-[#D8FF3D] hover:text-[#F2EDE3] transition-colors"
                    >
                      {t.close}
                    </button>
                  </div>
                )}

                {stage === "success" && (
                  <div className="text-center py-6">
                    <div className="mx-auto w-16 h-16 border border-[#D8FF3D] flex items-center justify-center">
                      <span className="km-display text-4xl text-[#D8FF3D]">✓</span>
                    </div>
                    <h3 className="mt-6 km-display text-3xl text-[#F2EDE3]">
                      {t.paymentComplete}
                    </h3>
                    <p className="mt-3 text-sm text-[#F2EDE3]/60 max-w-sm mx-auto leading-relaxed">
                      {t.thankYou1}{" "}
                      <span className="text-[#F2EDE3]">{sessionEmail || formData.email}</span>{t.thankYou2}
                    </p>
                    <button onClick={closeModal} className="mt-8 px-8 py-3 bg-[#D8FF3D] text-[#0B0B0B] km-mono-eyebrow hover:bg-[#F2EDE3] transition-colors">
                      {t.close}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
