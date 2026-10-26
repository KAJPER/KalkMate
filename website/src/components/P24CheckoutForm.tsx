"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import type { InPostPoint } from "@/components/InPostGeowidget";
import { readClientAttribution } from "@/lib/clientAttribution";
import { type Locale } from "@/lib/i18n";
import { formatMoney } from "@/lib/content/shop";

// P24 = tylko dostawa do Polski, ale formularz moze otworzyc klient z /en lub
// /de (wybral Polske jako kraj dostawy) — teksty w jezyku strony.
const content: Record<Locale, {
  payment: string; back: string; shipping: string; free: string; coupon: string; total: string;
  chooseMethod: string; blikSub: string; p24Sub: string;
  serverError: string; connectionError: string;
  perUnit: string; shippingPerOrder: string;
}> = {
  pl: {
    payment: "Płatność", back: "← Wstecz", shipping: "Wysyłka", free: "GRATIS", coupon: "Kupon", total: "RAZEM",
    chooseMethod: "Wybierz metodę płatności",
    blikSub: "Kod z aplikacji bankowej · Przelewy24",
    p24Sub: "Karta, Apple Pay, Google Pay, PayPo, raty",
    serverError: "Błąd serwera.", connectionError: "Błąd połączenia.",
    perUnit: "/ szt.", shippingPerOrder: "jedna paczka",
  },
  en: {
    payment: "Payment", back: "← Back", shipping: "Shipping", free: "FREE", coupon: "Coupon", total: "TOTAL",
    chooseMethod: "Choose a payment method",
    blikSub: "Code from your Polish banking app · Przelewy24",
    p24Sub: "Card, Apple Pay, Google Pay, PayPo, instalments",
    serverError: "Server error.", connectionError: "Connection error.",
    perUnit: "/ ea.", shippingPerOrder: "one parcel",
  },
  de: {
    payment: "Zahlung", back: "← Zurück", shipping: "Versand", free: "GRATIS", coupon: "Gutschein", total: "GESAMT",
    chooseMethod: "Zahlungsmethode wählen",
    blikSub: "Code aus deiner polnischen Banking-App · Przelewy24",
    p24Sub: "Karte, Apple Pay, Google Pay, PayPo, Ratenzahlung",
    serverError: "Serverfehler.", connectionError: "Verbindungsfehler.",
    perUnit: "/ Stk.", shippingPerOrder: "ein Paket",
  },
  cs: {
    payment: "Platba", back: "← Zpět", shipping: "Doprava", free: "ZDARMA", coupon: "Kupon", total: "CELKEM",
    chooseMethod: "Vyberte způsob platby",
    blikSub: "Kód z polské bankovní aplikace · Przelewy24",
    p24Sub: "Karta, Apple Pay, Google Pay, PayPo, splátky",
    serverError: "Chyba serveru.", connectionError: "Chyba připojení.",
    perUnit: "/ ks", shippingPerOrder: "jeden balík",
  },
  sk: {
    payment: "Platba", back: "← Späť", shipping: "Doprava", free: "ZADARMO", coupon: "Kupón", total: "SPOLU",
    chooseMethod: "Vyberte spôsob platby",
    blikSub: "Kód z poľskej bankovej aplikácie · Przelewy24",
    p24Sub: "Karta, Apple Pay, Google Pay, PayPo, splátky",
    serverError: "Chyba servera.", connectionError: "Chyba pripojenia.",
    perUnit: "/ ks", shippingPerOrder: "jeden balík",
  },
  lt: {
    payment: "Mokėjimas", back: "← Atgal", shipping: "Pristatymas", free: "NEMOKAMAI", coupon: "Kuponas", total: "IŠ VISO",
    chooseMethod: "Pasirinkite mokėjimo būdą",
    blikSub: "Kodas iš lenkiškos banko programėlės · Przelewy24",
    p24Sub: "Kortelė, Apple Pay, Google Pay, PayPo, išsimokėtinai",
    serverError: "Serverio klaida.", connectionError: "Ryšio klaida.",
    perUnit: "/ vnt.", shippingPerOrder: "viena siunta",
  },
  be: {
    payment: "Аплата", back: "← Назад", shipping: "Дастаўка", free: "БЯСПЛАТНА", coupon: "Купон", total: "РАЗАМ",
    chooseMethod: "Выберыце спосаб аплаты",
    blikSub: "Код з польскай банкаўскай праграмы · Przelewy24",
    p24Sub: "Картка, Apple Pay, Google Pay, PayPo, растэрміноўка",
    serverError: "Памылка сервера.", connectionError: "Памылка злучэння.",
    perUnit: "/ шт.", shippingPerOrder: "адна пасылка",
  },
  es: {
    payment: "Pago", back: "← Atrás", shipping: "Envío", free: "GRATIS", coupon: "Cupón", total: "TOTAL",
    chooseMethod: "Elige un método de pago",
    blikSub: "Código de tu app bancaria polaca · Przelewy24",
    p24Sub: "Tarjeta, Apple Pay, Google Pay, PayPo, pago a plazos",
    serverError: "Error del servidor.", connectionError: "Error de conexión.",
    perUnit: "/ ud.", shippingPerOrder: "un paquete",
  },
  pt: {
    payment: "Pagamento", back: "← Voltar", shipping: "Envio", free: "GRÁTIS", coupon: "Cupão", total: "TOTAL",
    chooseMethod: "Escolha um método de pagamento",
    blikSub: "Código da sua app bancária polaca · Przelewy24",
    p24Sub: "Cartão, Apple Pay, Google Pay, PayPo, prestações",
    serverError: "Erro do servidor.", connectionError: "Erro de ligação.",
    perUnit: "/ un.", shippingPerOrder: "uma encomenda",
  },
  fr: {
    payment: "Paiement", back: "← Retour", shipping: "Livraison", free: "GRATUIT", coupon: "Code promo", total: "TOTAL",
    chooseMethod: "Choisissez un moyen de paiement",
    blikSub: "Code de votre appli bancaire polonaise · Przelewy24",
    p24Sub: "Carte, Apple Pay, Google Pay, PayPo, paiement échelonné",
    serverError: "Erreur du serveur.", connectionError: "Erreur de connexion.",
    perUnit: "/ pce", shippingPerOrder: "un colis",
  },
  it: {
    payment: "Pagamento", back: "← Indietro", shipping: "Spedizione", free: "GRATIS", coupon: "Coupon", total: "TOTALE",
    chooseMethod: "Scegli un metodo di pagamento",
    blikSub: "Codice dalla tua app bancaria polacca · Przelewy24",
    p24Sub: "Carta, Apple Pay, Google Pay, PayPo, rate",
    serverError: "Errore del server.", connectionError: "Errore di connessione.",
    perUnit: "/ pz.", shippingPerOrder: "un pacco",
  },
};

interface FormData {
  name: string;
  email: string;
  phone: string;
  street: string;
  postcode: string;
  city: string;
  country: string;
}

export interface UnitPersonalization {
  unlockCode: string;
  name: string;
}

interface P24CheckoutFormProps {
  formData: FormData;
  selectedPoint: InPostPoint | null;
  isPoland: boolean;
  currency: string;
  /** Cena jednostkowa. */
  productCents: number;
  /** Liczba sztuk (1..MAX_ORDER_QUANTITY) — wysylka stala na zamowienie. */
  quantity?: number;
  /** Cena jednostkowa × ilosc; brak = productCents × quantity. */
  subtotalCents?: number;
  /** Personalizacja kazdej sztuki (dlugosc == quantity). */
  personalizations?: UnitPersonalization[];
  shippingCents: number;
  discountCents: number;
  totalCents: number;
  appliedCoupon: { code: string; discountCents: number } | null;
  couponCode: string | null;
  onSuccess: () => void;
  onError: (msg: string) => void;
  onBack: () => void;
  footer?: React.ReactNode;
  lang?: Locale;
  /** Checkbox personalizacji = swiadoma utrata prawa odstapienia (art. 38 pkt 3 u.p.k.). */
  personalizeConsent?: boolean;
  /** Serwer odrzucil kupon (409, K1) — BuyNow usuwa go z formularza; zwraca komunikat. */
  onCouponRejected?: (data: { error?: string; reason?: string }) => string;
}

export default function P24CheckoutForm({
  formData, selectedPoint, isPoland,
  currency, productCents, quantity = 1, subtotalCents, personalizations = [],
  shippingCents, discountCents, totalCents,
  appliedCoupon, couponCode,
  onBack, footer,
  lang = "pl", personalizeConsent = false, onCouponRejected,
}: P24CheckoutFormProps) {
  const t = content[lang];
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMethod, setLoadingMethod] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  // Blokada podwojnego klikniecia — drugie zapytanie stworzyloby druga transakcje.
  const payingRef = useRef(false);
  const subtotal = subtotalCents ?? productCents * quantity;

  const fmtMoney = (cents: number) => formatMoney(cents, currency, lang);

  async function pay(blikMode: boolean) {
    if (payingRef.current) return;
    payingRef.current = true;
    setIsLoading(true);
    setLoadingMethod(blikMode ? "blik" : "other");
    setErrorMsg("");
    try {
      const res = await fetch("/api/p24/create-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          // Ilosc + personalizacja kazdej sztuki; unlockCode/personalizeName =
          // sztuka 1 (zgodnosc ze starszym serwerem).
          quantity,
          personalizations,
          unlockCode: personalizations[0]?.unlockCode ?? "",
          personalizeName: personalizations[0]?.name ?? "",
          currency,
          shippingCents,
          couponCode: couponCode || null,
          pickupPoint: isPoland && selectedPoint ? selectedPoint.name : null,
          pickupPointAddress:
            isPoland && selectedPoint
              ? `${selectedPoint.address.line1}, ${selectedPoint.address.line2}`
              : null,
          blikMode,
          attribution: readClientAttribution(),
          // Zgody z formularza — do zapisania przy zamowieniu (dowod zgody
          // na personalizacje / utrate prawa odstapienia).
          personalizeConsent,
          withdrawalConsent: personalizeConsent,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && onCouponRejected) {
        throw new Error(onCouponRejected(data));
      }
      if (!res.ok) throw new Error(data.error || t.serverError);
      // Przekierowanie tylko na https (bramka P24) — nigdy javascript:/wzgledne.
      if (typeof data.redirectUrl !== "string" || !/^https:\/\//i.test(data.redirectUrl)) {
        throw new Error(t.serverError);
      }
      window.location.href = data.redirectUrl;
    } catch (err: unknown) {
      // TypeError = fetch nie doszedl do serwera (siec) — komunikat w jezyku strony.
      const msg = err instanceof Error && err.name !== "TypeError" ? err.message : t.connectionError;
      setErrorMsg(msg);
      payingRef.current = false;
      setIsLoading(false);
      setLoadingMethod(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="km-display text-3xl text-[#F2EDE3]">{t.payment}</h3>
        <button onClick={onBack} disabled={isLoading} className="km-mono-eyebrow text-[#D8FF3D] disabled:opacity-40">
          {t.back}
        </button>
      </div>

      {/* Order summary */}
      <div className="mb-6 border border-[rgba(242,237,227,0.10)] p-4 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-[#F2EDE3]/65">
            KalkMate v3.0{quantity > 1 ? ` × ${quantity}` : ""}
            {quantity > 1 && (
              <span className="block text-xs text-[#F2EDE3]/40">{fmtMoney(productCents)} {t.perUnit}</span>
            )}
          </span>
          <span className="text-[#F2EDE3]">{fmtMoney(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#F2EDE3]/65">
            {t.shipping}{quantity > 1 && <span className="text-xs text-[#F2EDE3]/40"> · {t.shippingPerOrder}</span>}
          </span>
          {shippingCents === 0
            ? <span className="km-mono-eyebrow text-[#D8FF3D]">{t.free}</span>
            : <span className="text-[#F2EDE3]">{fmtMoney(shippingCents)}</span>}
        </div>
        {appliedCoupon && (
          <div className="flex justify-between">
            <span className="text-[#D8FF3D]">{t.coupon} {appliedCoupon.code}</span>
            <span className="text-[#D8FF3D]">−{fmtMoney(discountCents)}</span>
          </div>
        )}
        <div className="flex justify-between pt-3 border-t border-[rgba(242,237,227,0.10)] mt-2">
          <span className="km-mono-eyebrow text-[#F2EDE3]">{t.total}</span>
          <span className="km-display text-2xl text-[#F2EDE3]">{fmtMoney(totalCents)}</span>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 border border-[#FF4D2E]/40 bg-[#FF4D2E]/[0.06] p-3">
          <p className="text-sm text-[#FF4D2E]">{errorMsg}</p>
        </div>
      )}

      <div className="space-y-3">
        <p className="km-mono-eyebrow text-[#F2EDE3]/55 mb-4">{t.chooseMethod}</p>

        {/* BLIK via P24 */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => pay(true)}
          disabled={isLoading}
          className="w-full flex items-center gap-4 p-4 border border-[rgba(242,237,227,0.18)] hover:border-[#D8FF3D] transition-colors disabled:opacity-50"
        >
          <div className="w-10 h-10 bg-[#D8FF3D] flex items-center justify-center flex-shrink-0">
            {loadingMethod === "blik"
              ? <svg className="animate-spin h-4 w-4 text-[#0B0B0B]" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              : <span className="km-mono-eyebrow text-[#0B0B0B] text-xs font-bold">BLIK</span>}
          </div>
          <div className="text-left">
            <p className="text-sm text-[#F2EDE3] font-medium">BLIK</p>
            <p className="text-xs text-[#F2EDE3]/45 mt-0.5">{t.blikSub}</p>
          </div>
          <span className="ml-auto text-[#F2EDE3]/30">→</span>
        </motion.button>

        {/* All other P24-enabled methods: cards, Apple Pay, Google Pay, PayPo, raty */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => pay(false)}
          disabled={isLoading}
          className="w-full flex items-center gap-4 p-4 border border-[rgba(242,237,227,0.18)] hover:border-[#D8FF3D] transition-colors disabled:opacity-50"
        >
          <div className="w-10 h-10 border border-[rgba(242,237,227,0.25)] flex items-center justify-center flex-shrink-0">
            {loadingMethod === "other"
              ? <svg className="animate-spin h-4 w-4 text-[#F2EDE3]/60" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              : <svg width="20" height="14" viewBox="0 0 24 17" fill="none"><rect x="0.5" y="0.5" width="23" height="16" rx="1.5" stroke="#F2EDE3" strokeOpacity="0.6"/><rect y="4" width="24" height="3" fill="#F2EDE3" fillOpacity="0.15"/><rect x="2" y="10" width="6" height="2" rx="0.5" fill="#F2EDE3" fillOpacity="0.6"/></svg>}
          </div>
          <div className="text-left">
            <p className="text-sm text-[#F2EDE3] font-medium">Przelewy24</p>
            <p className="text-xs text-[#F2EDE3]/45 mt-0.5">{t.p24Sub}</p>
          </div>
          <span className="ml-auto text-[#F2EDE3]/30">→</span>
        </motion.button>

        {footer}
      </div>
    </div>
  );
}
