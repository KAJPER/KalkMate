// Paczki tokenów do kupienia w sklepie (panel → zakładka AI → "Kup tokeny").
// Jedno źródło prawdy: używane przez /api/tokens/checkout (walidacja + cena)
// oraz UI w panelu. Cena w groszach PLN. 1 mln efektywnych tokenów ≈ koszt API
// ~5-6 PLN, sprzedaż z marżą.
// priceEurCents: cena dla walut innych niz PLN (platnosc kartą przez Stripe).
// Przeliczone tym samym stosunkiem co flagowy produkt (699 zł / 169 EUR).
export type TokenPack = {
  id: string;
  tokens: number;
  priceGrosze: number;
  priceEurCents: number;
  label: string;
  popular?: boolean;
};

export const TOKEN_PACKS: TokenPack[] = [
  { id: "tok_1m", tokens: 1_000_000, priceGrosze: 2900, priceEurCents: 700, label: "1 mln tokenów" },
  { id: "tok_5m", tokens: 5_000_000, priceGrosze: 11900, priceEurCents: 2900, label: "5 mln tokenów", popular: true },
  { id: "tok_10m", tokens: 10_000_000, priceGrosze: 19900, priceEurCents: 4900, label: "10 mln tokenów" },
];

export const getTokenPack = (id: string) => TOKEN_PACKS.find((p) => p.id === id);
