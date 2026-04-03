# KalkMate - Setup Guide

## Wymagania
- Node.js 18+
- npm lub yarn
- PostgreSQL 14+ (baza danych)
- Konta w: Stripe, Google AI (Gemini), Resend, InPost

## Instalacja

### 1. Zainstaluj zależności
```bash
npm install
```

### 2. Skonfiguruj zmienne środowiskowe
Skopiuj `.env.local.example` do `.env.local`:
```bash
cp .env.local.example .env.local
```

### 3. Uzyskaj API keys

#### Stripe (płatności)
1. Zarejestruj się na https://stripe.com
2. Dashboard → Developers → API keys
3. Skopiuj Publishable key i Secret key do `.env.local`

#### Gemini API (AI Chat)
1. Przejdź na https://ai.google.dev/
2. Kliknij "Get API key"
3. Utwórz nowy projekt w Google Cloud
4. Wygeneruj API key
5. Skopiuj do `.env.local` jako `GEMINI_API_KEY`

#### Resend (email)
1. Zarejestruj się na https://resend.com
2. Dashboard → API Keys
3. Utwórz nowy klucz
4. Skopiuj do `.env.local`

#### InPost Geowidget
1. Zarejestruj się w InPost Developer Portal
2. Uzyskaj token dla Geowidget
3. Skopiuj do `.env.local`

### 4. Skonfiguruj bazę danych
```bash
# Zainstaluj zależności (jeśli jeszcze nie)
npm install

# Wygeneruj klienta Prisma
npx prisma generate

# Uruchom migracje
npx prisma db push

# (Opcjonalnie) Otwórz Prisma Studio do zarządzania bazą
npx prisma studio
```

### 5. Wygeneruj NEXTAUTH_SECRET
```bash
openssl rand -base64 32
```
Skopiuj wynik do `.env.local` jako `NEXTAUTH_SECRET`

### 6. Uruchom dev server
```bash
npm run dev
```

Strona będzie dostępna na `http://localhost:3000`

## Panel klienta
Dostępny pod `/panel` - pokazuje:
- **Zamówienia**: Historia zakupów z trackingiem
- **AI Chat**: Chatbot Gemini Pro do rozwiązywania zadań
- **Subskrypcja**: Zarządzanie planem i płatnościami

### Logowanie
- Zaloguj się pod `/auth/signin`
- Wymagane: email + hasło (minimum 6 znaków)
- Możliwość rejestracji nowego konta
- System autentykacji NextAuth z credentials provider

## Subskrypcja AI Chat
- Zakup kalkulatora = 30 dni darmowego AI Chat
- Nowe konto = 1 dzień darmowego testu
- Po okresie próbnym: 29 zł/miesiąc

## Deployment na VPS

### Wymagania VPS
- Ubuntu 22.04+
- 2GB RAM minimum
- Node.js 18+
- Nginx

### Kroki deployment

1. **Zainstaluj Node.js**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

2. **Sklonuj repo**
```bash
git clone https://github.com/your-repo/kalkmate.git
cd kalkmate/website
```

3. **Zainstaluj zależności i zbuduj**
```bash
npm install

# Wygeneruj Prisma Client
npx prisma generate

# Uruchom migracje bazy danych
npx prisma db push

# Zbuduj produkcyjną wersję
npm run build
```

4. **Skonfiguruj PM2**
```bash
npm install -g pm2
pm2 start npm --name "kalkmate" -- start
pm2 save
pm2 startup
```

5. **Skonfiguruj Nginx**
```nginx
server {
    listen 80;
    server_name kalkmate.pl www.kalkmate.pl;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

6. **Certyfikat SSL (Let's Encrypt)**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d kalkmate.pl -d www.kalkmate.pl
```

## API Endpoints

### Publiczne API

#### POST /api/chat
Gemini AI Chat endpoint (wymaga autentykacji NextAuth)
```json
{
  "messages": [
    { "role": "user", "content": "Rozwiąż: 2x + 5 = 15" }
  ]
}
```

#### POST /api/create-payment-intent
Tworzenie płatności Stripe za kalkulator
```json
{
  "name": "Jan Kowalski",
  "email": "jan@example.com",
  "phone": "123456789",
  "pickupPoint": "KRA01M",
  "pickupPointAddress": "Kraków, ul. Przykładowa 1"
}
```

#### POST /api/subscription/create
Tworzenie subskrypcji (wymaga autentykacji)
```json
Response: { "url": "https://checkout.stripe.com/..." }
```

#### POST /api/subscription/cancel
Anulowanie subskrypcji (wymaga autentykacji)

#### GET /api/subscription/status
Status subskrypcji użytkownika (wymaga autentykacji)

### API dla kalkulatora (wymaga x-api-key header)

#### POST /api/sync/messages
Synchronizacja wiadomości z kalkulatora
```json
{
  "userId": "user_id_here",
  "messages": [
    { "role": "user", "content": "treść" },
    { "role": "assistant", "content": "odpowiedź" }
  ]
}
```

#### GET /api/sync/messages?userId=xxx&limit=50
Pobieranie historii wiadomości

#### GET /api/sync/subscription?userId=xxx
Sprawdzanie statusu subskrypcji (czy użytkownik może używać AI)

## Webhook Setup (Stripe)

### Development (lokalne testowanie)
1. Zainstaluj Stripe CLI:
```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

2. Skopiuj webhook secret z outputu do `.env.local`

### Production
1. W Stripe Dashboard → Developers → Webhooks
2. Dodaj endpoint: `https://kalkmate.pl/api/webhooks/stripe`
3. Wybierz events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Skopiuj webhook secret do zmiennych środowiskowych na VPS

## Database Management

### Prisma Studio (GUI do bazy)
```bash
npx prisma studio
```

### Migracje
```bash
# Po zmianach w schema.prisma
npx prisma db push

# Generowanie klienta po zmianach
npx prisma generate
```

### Reset bazy (dev only!)
```bash
npx prisma db push --force-reset
```

## Troubleshooting

### Błąd: "Gemini API key not configured"
- Sprawdź czy `GEMINI_API_KEY` jest w `.env.local`
- Zrestartuj dev server

### Błąd Stripe
- Sprawdź czy klucze są prawidłowe
- W trybie dev używaj test keys
- Sprawdź czy webhook secret jest poprawny

### Problem z Dark Mode
- Wyczyść cache przeglądarki
- Sprawdź system preferences

### Błąd: "PrismaClient is unable to connect to database"
- Sprawdź `DATABASE_URL` w `.env.local`
- Upewnij się że PostgreSQL działa
- Sprawdź dane logowania do bazy

### Błąd NextAuth
- Wygeneruj nowy `NEXTAUTH_SECRET` jeśli go nie masz
- Sprawdź `NEXTAUTH_URL` (musi się zgadzać z domeną)
- Sprawdź konfigurację Resend (email provider)
