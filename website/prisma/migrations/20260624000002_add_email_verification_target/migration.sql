-- M8: Dodaj kolumnę targetEmail do EmailVerification
-- Używana przy zmianie adresu email (change-email flow).
-- Gdy targetEmail != NULL, weryfikacja tokenu zaktualizuje email użytkownika
-- zamiast tylko ustawiać emailVerified.
ALTER TABLE "EmailVerification" ADD COLUMN "targetEmail" TEXT;
