// Wspólna konfiguracja cennika dla subskrypcji AI Chat
// Używana zarówno na stronie głównej jak i w panelu użytkownika

export const SUBSCRIPTION_PRICING = {
  // Ceny w groszach (PLN)
  FIRST_MONTH: 0, // GRATIS przy zakupie kalkulatora
  SECOND_MONTH: 100, // 1 zł
  REGULAR_MONTH: 1500, // 15 zł
  NORMAL_PRICE: 4499, // 44,99 zł (normalna cena bez KalkMate)
} as const;

export const PRICING_PLANS = [
  {
    period: "Pierwszy miesiąc",
    price: "GRATIS",
    priceInGrosze: SUBSCRIPTION_PRICING.FIRST_MONTH,
    originalPrice: null,
    highlight: "W zestawie",
    features: [
      "Pełny dostęp do AI Chat",
      "Nieograniczona liczba zadań",
      "Wszystkie aktualizacje modelu",
      "Wsparcie techniczne",
    ],
    badge: "🎁 Przy zakupie",
  },
  {
    period: "Drugi miesiąc",
    price: "1 zł",
    priceInGrosze: SUBSCRIPTION_PRICING.SECOND_MONTH,
    originalPrice: "44,99 zł",
    highlight: "-98% taniej",
    features: [
      "Kontynuacja dostępu",
      "Wszystkie funkcje premium",
      "Aktualizacje w czasie rzeczywistym",
      "Priorytetowe wsparcie",
    ],
    badge: "🔥 Promocja",
  },
  {
    period: "Kolejne miesiące",
    price: "15 zł",
    priceInGrosze: SUBSCRIPTION_PRICING.REGULAR_MONTH,
    originalPrice: "44,99 zł",
    highlight: "-67% taniej",
    features: [
      "Bez ukrytych opłat",
      "Możliwość anulowania w każdej chwili",
      "Dostęp do nowych funkcji",
      "Gwarancja najlepszej ceny",
    ],
    badge: "💎 Stała cena",
  },
] as const;

// Formatowanie cen
export function formatPrice(priceInGrosze: number): string {
  return `${(priceInGrosze / 100).toFixed(2)} zł`;
}

// Obliczanie oszczędności
export function calculateSavings(
  priceInGrosze: number,
  normalPriceInGrosze: number = SUBSCRIPTION_PRICING.NORMAL_PRICE
): {
  savingsInGrosze: number;
  savingsPercentage: number;
  savingsText: string;
} {
  const savingsInGrosze = normalPriceInGrosze - priceInGrosze;
  const savingsPercentage = Math.round((savingsInGrosze / normalPriceInGrosze) * 100);
  const savingsText = `${savingsPercentage}% taniej`;

  return {
    savingsInGrosze,
    savingsPercentage,
    savingsText,
  };
}
