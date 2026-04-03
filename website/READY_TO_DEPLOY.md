# ✅ Checklist przed deployment na VPS

## 📋 Przed wysłaniem na VPS - sprawdź:

### 1. Zmienne środowiskowe

Skopiuj `.env.local` na VPS i wypełnij:

```env
# ✅ Stripe - masz już
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ✅ Email - masz już
RESEND_API_KEY=re_...

# ✅ InPost - masz już
NEXT_PUBLIC_INPOST_GEOWIDGET_TOKEN=...

# ⚠️ Gemini AI - DODAJ!
GEMINI_API_KEY=AIza...   # Potrzebujesz klucza z https://ai.google.dev/

# ✅ NextAuth - wygeneruj nowy na VPS
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=https://kalkmate.pl

# ⚠️ PostgreSQL - zainstaluj na VPS
DATABASE_URL=postgresql://kalkmate_user:password@localhost:5432/kalkmate

# ✅ App URL - zmień na produkcyjny
NEXT_PUBLIC_APP_URL=https://kalkmate.pl

# ⚠️ Calculator API - ustaw bezpieczny klucz
CALCULATOR_API_KEY=<wygeneruj bezpieczny klucz>

# ✅ Admin - masz już
ADMIN_PASSWORD=<twoje_haslo_admina>
ADMIN_SESSION_TOKEN=km_sess_...
```

### 2. Baza danych - przełącz na PostgreSQL

**Na VPS:**

```bash
# Zainstaluj PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Utwórz bazę i użytkownika
sudo -u postgres psql
CREATE DATABASE kalkmate;
CREATE USER kalkmate_user WITH PASSWORD 'twoje_bezpieczne_haslo';
GRANT ALL PRIVILEGES ON DATABASE kalkmate TO kalkmate_user;
\q
```

**W kodzie - zmień `prisma/schema.prisma`:**

```prisma
datasource db {
  provider = "postgresql"  // ← Zmień z "sqlite"
  url      = env("DATABASE_URL")
}

// Dodaj z powrotem @db.Text:
model Account {
  refresh_token String? @db.Text
  access_token  String? @db.Text
  id_token      String? @db.Text
  // ...
}

model ChatMessage {
  content String @db.Text
  // ...
}
```

### 3. Stripe Webhooks - skonfiguruj produkcyjny endpoint

1. Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://kalkmate.pl/api/webhooks/stripe`
3. Wybierz events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Skopiuj **Signing secret** → `STRIPE_WEBHOOK_SECRET` w `.env.local`

### 4. Resend - dodaj domenę

1. Resend Dashboard → Domains
2. Add Domain: `kalkmate.pl`
3. Dodaj DNS records (SPF, DKIM, DMARC)
4. Zweryfikuj domenę
5. Zmień w kodzie:
   ```typescript
   // src/lib/resend.ts
   export const FROM_EMAIL = "KalkMate <noreply@kalkmate.pl>";
   ```

## 🚀 Deployment - krok po kroku

### 1. Na lokalnym komputerze

```bash
# Commituj wszystko
git add .
git commit -m "feat: complete authentication and subscription system"
git push origin main
```

### 2. Na VPS

```bash
# Sklonuj repo
git clone https://github.com/twoje-repo/kalkmate.git
cd kalkmate/website

# Zainstaluj zależności
npm install

# Skopiuj .env.local
nano .env.local
# Wklej wszystkie zmienne środowiskowe (patrz punkt 1)

# WAŻNE: Zmień schema.prisma na PostgreSQL (patrz punkt 2)
nano prisma/schema.prisma

# Wygeneruj Prisma Client
npx prisma generate

# Uruchom migracje bazy
npx prisma db push

# Zbuduj produkcyjną wersję
npm run build

# Zainstaluj PM2
npm install -g pm2

# Uruchom aplikację
pm2 start npm --name "kalkmate" -- start

# Zapisz konfigurację PM2
pm2 save
pm2 startup
# Wykonaj komendę którą pokaże PM2
```

### 3. Nginx - konfiguracja

```bash
sudo nano /etc/nginx/sites-available/kalkmate
```

Wklej:

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
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Aktywuj:

```bash
sudo ln -s /etc/nginx/sites-available/kalkmate /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. SSL - Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d kalkmate.pl -d www.kalkmate.pl
```

Wybierz opcję 2 (redirect HTTP → HTTPS)

### 5. Test!

Otwórz: **https://kalkmate.pl**

## ✅ Final Checklist

- [ ] PostgreSQL zainstalowany i skonfigurowany
- [ ] `.env.local` wypełniony (wszystkie klucze)
- [ ] `GEMINI_API_KEY` dodany
- [ ] `NEXTAUTH_SECRET` wygenerowany (nowy dla VPS)
- [ ] `NEXTAUTH_URL=https://kalkmate.pl`
- [ ] `DATABASE_URL` wskazuje na PostgreSQL
- [ ] `prisma/schema.prisma` zmieniony na `provider = "postgresql"`
- [ ] `@db.Text` dodane z powrotem do schema
- [ ] `npx prisma db push` wykonany
- [ ] `npm run build` działa bez błędów
- [ ] PM2 uruchomiony i zapisany
- [ ] Nginx skonfigurowany
- [ ] SSL certyfikat zainstalowany
- [ ] Stripe webhook endpoint skonfigurowany (https://kalkmate.pl/api/webhooks/stripe)
- [ ] Resend domena zweryfikowana
- [ ] Logowanie działa (test: /auth/signin)
- [ ] Panel działa (test: /panel)
- [ ] AI Chat działa (wymaga GEMINI_API_KEY)
- [ ] Płatności działają (test checkout)

## 🔒 Bezpieczeństwo - po deployment

1. **Zmień wszystkie secrets:**
   ```bash
   # Nowy NEXTAUTH_SECRET
   openssl rand -base64 32

   # Nowy CALCULATOR_API_KEY
   openssl rand -base64 32
   ```

2. **Firewall:**
   ```bash
   sudo ufw allow 22    # SSH
   sudo ufw allow 80    # HTTP
   sudo ufw allow 443   # HTTPS
   sudo ufw enable
   ```

3. **Fail2ban:**
   ```bash
   sudo apt install fail2ban
   sudo systemctl enable fail2ban
   sudo systemctl start fail2ban
   ```

4. **Backup bazy:**
   ```bash
   # Dodaj do crontab
   0 3 * * * pg_dump kalkmate > /backup/kalkmate_$(date +\%Y\%m\%d).sql
   ```

## 📊 Monitoring

```bash
# Logi aplikacji
pm2 logs kalkmate

# Status
pm2 status

# Restart
pm2 restart kalkmate

# Auto-restart przy zmianach
pm2 reload kalkmate
```

## 🐛 Troubleshooting produkcyjny

### "PrismaClient unable to connect"
```bash
# Sprawdź czy PostgreSQL działa
sudo systemctl status postgresql

# Sprawdź connection string
echo $DATABASE_URL

# Test połączenia
psql $DATABASE_URL
```

### "NextAuth callback error"
```bash
# Sprawdź NEXTAUTH_URL
echo $NEXTAUTH_URL
# Musi być: https://kalkmate.pl (bez trailing slash)

# Sprawdź NEXTAUTH_SECRET
echo $NEXTAUTH_SECRET | wc -c
# Powinno być ~44 znaki
```

### "Stripe webhook nie działa"
```bash
# Sprawdź logi
pm2 logs kalkmate | grep webhook

# Test endpoint
curl -X POST https://kalkmate.pl/api/webhooks/stripe \
  -H "stripe-signature: test" \
  -d '{}'
# Powinien zwrócić 400 (Invalid signature) - to jest OK!
```

---

**Wszystko gotowe! Deployment powinien przebiec sprawnie.** 🚀

Jeśli masz problemy, sprawdź:
- [SETUP.md](./SETUP.md) - szczegółowa instrukcja
- [AUTH_GUIDE.md](./AUTH_GUIDE.md) - jak działa logowanie
- PM2 logs: `pm2 logs kalkmate`
