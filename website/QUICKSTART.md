# KalkMate - Quick Start Guide

## Szybki start (rozwój lokalny)

### 1. Instalacja (5 minut)

```bash
# Sklonuj repozytorium
git clone <repo-url>
cd kalkulator/website

# Zainstaluj zależności
npm install

# Skopiuj template env
cp .env.local.example .env.local
```

### 2. Konfiguracja bazy danych

#### Opcja A: PostgreSQL lokalnie
```bash
# Zainstaluj PostgreSQL (jeśli nie masz)
# Windows: https://www.postgresql.org/download/windows/
# Mac: brew install postgresql
# Linux: sudo apt install postgresql

# Utwórz bazę
createdb kalkmate

# W .env.local ustaw:
DATABASE_URL="postgresql://user:password@localhost:5432/kalkmate"
```

#### Opcja B: PostgreSQL w chmurze (Neon, Supabase, Railway)
```bash
# Zarejestruj się na https://neon.tech (darmowy tier)
# Utwórz bazę i skopiuj connection string do DATABASE_URL
```

### 3. Inicjalizacja bazy
```bash
# Wygeneruj Prisma Client
npx prisma generate

# Utwórz tabele
npx prisma db push
```

### 4. Uzyskaj klucze API (minimum dla podstawowej funkcjonalności)

#### Stripe (wymagane)
1. https://dashboard.stripe.com/register
2. Developers → API keys
3. Skopiuj do `.env.local`:
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
```

#### Gemini (wymagane dla AI Chat)
1. https://ai.google.dev/
2. Get API key
3. Skopiuj do `.env.local`:
```
GEMINI_API_KEY=AIza...
```

#### Resend (wymagane dla email auth)
1. https://resend.com/signup
2. API Keys → Create
3. Skopiuj do `.env.local`:
```
RESEND_API_KEY=re_...
```

#### NextAuth Secret
```bash
# Wygeneruj secret
openssl rand -base64 32

# Dodaj do .env.local
NEXTAUTH_SECRET=<generated-secret>
NEXTAUTH_URL=http://localhost:3000
```

### 5. Uruchom aplikację
```bash
npm run dev
```

Otwórz http://localhost:3000

## Testowanie funkcjonalności

### Test płatności
1. Otwórz http://localhost:3000
2. Kliknij "Zamów teraz"
3. Użyj testowej karty: `4242 4242 4242 4242`
4. Data: dowolna przyszła, CVV: dowolny 3-cyfrowy

### Test logowania
1. Otwórz http://localhost:3000/auth/signin
2. Wpisz swój email
3. Sprawdź Resend Dashboard → Emails → zobaczysz wysłany email
4. Kliknij link (lub otwórz z dashboardu)

### Test AI Chat
1. Zaloguj się
2. Przejdź do /panel
3. Kliknij zakładkę "AI Chat"
4. Wpisz: "Rozwiąż równanie: 2x + 5 = 15"

### Test Prisma Studio (GUI bazy)
```bash
npx prisma studio
```
Otwórz http://localhost:5555 - zobaczysz wszystkie tabele

## Minimalna konfiguracja do działania

Tylko te zmienne są WYMAGANE dla podstawowej funkcjonalności:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/kalkmate

# Stripe (płatności)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# Gemini (AI)
GEMINI_API_KEY=AIza...

# Resend (email)
RESEND_API_KEY=re_...

# NextAuth
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
```

## Opcjonalne (można dodać później)

```env
# InPost (geowidget dla Paczkomatów)
NEXT_PUBLIC_INPOST_GEOWIDGET_TOKEN=...

# Stripe Webhooks (dla testowania płatności)
STRIPE_WEBHOOK_SECRET=whsec_...

# Calculator API (synchronizacja z urządzeniem)
CALCULATOR_API_KEY=...

# Production
NEXT_PUBLIC_APP_URL=https://kalkmate.pl
```

## Najczęstsze problemy

### "PrismaClient is unable to connect"
- Sprawdź czy PostgreSQL działa: `psql -U postgres`
- Popraw DATABASE_URL w .env.local

### "Gemini API key not configured"
- Sprawdź czy GEMINI_API_KEY jest w .env.local (bez cudzysłowów)
- Restart: `npm run dev`

### Email nie wysyła się
- Sprawdź Resend Dashboard → Logs
- W development, linki można skopiować z logów Resend
- Upewnij się że EMAIL_FROM używa zweryfikowanej domeny

### Błąd Stripe
- Używaj test keys (pk_test_, sk_test_)
- Testowa karta: 4242 4242 4242 4242

## Następne kroki

Po uruchomieniu lokalnie:
1. Przeczytaj [SETUP.md](./SETUP.md) dla pełnej konfiguracji
2. Skonfiguruj webhooks (patrz SETUP.md → Webhook Setup)
3. Deploy na VPS (patrz SETUP.md → Deployment na VPS)

## Szybkie komendy

```bash
# Development
npm run dev              # Uruchom dev server
npx prisma studio        # Otwórz GUI bazy

# Database
npx prisma generate      # Wygeneruj Prisma Client
npx prisma db push       # Synchronizuj schema z bazą
npx prisma db push --force-reset  # Reset bazy (usuwa dane!)

# Production build
npm run build            # Zbuduj
npm start                # Uruchom produkcyjną wersję

# Linting
npm run lint             # Sprawdź błędy
```

## Struktura projektu

```
website/
├── prisma/
│   └── schema.prisma           # Schema bazy danych
├── src/
│   ├── app/
│   │   ├── api/                # API routes
│   │   │   ├── chat/           # Gemini chat endpoint
│   │   │   ├── subscription/   # Zarządzanie subskrypcją
│   │   │   ├── sync/           # API dla kalkulatora
│   │   │   └── webhooks/       # Stripe webhooks
│   │   ├── auth/               # NextAuth pages
│   │   ├── panel/              # Panel klienta
│   │   └── page.tsx            # Strona główna
│   ├── components/             # React komponenty
│   └── lib/
│       ├── db.ts               # Prisma client
│       ├── auth.ts             # NextAuth config
│       └── stripe.ts           # Stripe client
├── .env.local.example          # Template zmiennych
├── SETUP.md                    # Pełna dokumentacja
└── QUICKSTART.md               # Ten plik
```

## Pomoc

- GitHub Issues: [link]
- Email: support@kalkmate.pl
- Dokumentacja Stripe: https://stripe.com/docs
- Dokumentacja Gemini: https://ai.google.dev/docs
- Dokumentacja Prisma: https://www.prisma.io/docs
