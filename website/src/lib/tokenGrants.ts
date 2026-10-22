// Model tokenowy (od 2026-10): koniec subskrypcji/triali/licencji czasowych.
// Dostep do AI (czat w panelu + kalkulator) wylacznie na saldzie
// User.tokenBalance. Wspolne stale dla serwera i frontendu.

// Saldo startowe nowego konta (rejestracja e-mail / pierwsze logowanie Google).
export const SIGNUP_TOKENS = 200_000;

// Jednorazowe doladowanie za aktywacje licencji (kod z pudelka kalkulatora).
export const LICENSE_TOKENS = 2_000_000;

// Minimalne saldo, przy ktorym konto ma dostep do AI ("active" w
// /api/device/account-status). Faktyczne zapytanie i tak wymaga atomowej
// rezerwacji szacunku kosztu (lib/aiCost.ts reserveTokens).
export const MIN_TOKENS_FOR_AI = 1000;
