# KalkMate — strona, sklep i backend

Aplikacja Next.js pod [kalkmate.pl](https://kalkmate.pl). Zawiera:

- sklep i stronę produktu (PL `/`, EN `/en`, DE `/de`);
- panel klienta (`/panel`) i przypisywanie licencji (`/claim`);
- panel admina (`/admin`);
- API kalkulatorów (`/api/device/*`) i dystrybucję OTA.

Opis całego projektu: [README w katalogu głównym](../README.md).

**Stack:** Next.js 16 (App Router) · React 19 · Prisma 6 + SQLite · Tailwind CSS 4 · NextAuth 4 · Stripe · Przelewy24 · OpenRouter · nodemailer (SMTP/IMAP)

## Uruchomienie lokalne

Wymagany Node.js 20+.

```bash
npm install
# utwórz .env według tabeli „Zmienne środowiskowe” niżej
npx prisma generate
npx prisma db push              # tworzy lokalną bazę SQLite ze schematu
npm run dev                     # http://localhost:3000
```

Do samego uruchomienia strony wystarczą `DATABASE_URL`, `NEXTAUTH_SECRET` i `NEXTAUTH_URL`. Płatności, AI, poczta i wysyłka działają dopiero z kluczami do tych usług.

Panel admina wymaga `ADMIN_SESSION_TOKEN` i `ADMIN_2FA_SECRET`. Sekret TOTP wygeneruje skrypt `tools/generate_2fa.js` (wymaga pakietów `otpauth` i `qrcode`); kod QR dodajesz do Google Authenticator.

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Baza danych

SQLite przez Prisma (`prisma/schema.prisma`). Część nowszych tabel i kolumn nie jest w schemacie Prismy — dotyczy to m.in. kuponów, zgód marketingowych, atrybucji, sesji admina i kopii zapasowych. Tworzy je przy pierwszym użyciu kod w `src/lib/*` (`CREATE TABLE IF NOT EXISTS` / `ALTER TABLE`) i obsługuje surowym SQL. Dzięki temu wdrożenie nie wymaga migracji. Daty w SQLite są przechowywane jako INTEGER (ms); starsze wiersze mogą mieć tekst ISO.

Kopie zapasowe: codziennie z crona oraz ręcznie w `/admin/backups` (`src/lib/dbBackup.ts`).

## Struktura

```
src/
├── app/
│   ├── page.tsx, en/, de/          # strona produktu i sklep
│   ├── koszyk/                     # koszyk i checkout
│   ├── panel/, claim/              # panel klienta, przypisanie licencji
│   ├── admin/                      # panel admina (zamówienia, poczta, newsletter, kupony, licencje, …)
│   ├── pomoc/, regulamin/, polityka-prywatnosci/, reklamacja/
│   └── api/
│       ├── device/                 # API kalkulatora: register, account-status, solve, notes, tests, conversations, firmware, remote
│       ├── admin/                  # API panelu admina (każda trasa: requireAdminAuth)
│       ├── create-payment-intent/, p24/, webhooks/   # Stripe i Przelewy24
│       ├── cron/tracking/          # zadania cykliczne (co godzinę)
│       └── auth/, user/, tokens/, subscription/, chat/, track/, newsletter/, …
├── components/                     # komponenty strony i panelu admina
└── lib/                            # logika: płatności, wysyłka, maile, AI, kupony, atrybucja, kopie, …
```

## Zadania cykliczne

Jeden endpoint, wołany co godzinę (np. z crona systemowego):

```bash
curl -fsS -H "x-cron-secret: $CRON_SECRET" https://kalkmate.pl/api/cron/tracking
```

Zadania:
- statusy przesyłek InPost i Base Courier;
- przypomnienia o nieopłaconych zamówieniach P24;
- anulowanie porzuconych zamówień;
- codzienna kopia bazy.

## Zmienne środowiskowe

| Obszar | Zmienne |
|---|---|
| **Podstawowe** | `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| **Admin** | `ADMIN_SESSION_TOKEN`, `ADMIN_2FA_SECRET` |
| **Kalkulatory / OTA** | `CALCULATOR_API_KEY`, `CALCULATOR_FIRMWARE_DIR`, `CALCULATOR_CAPTURES_DIR`, `FIRMWARE_LATEST_VERSION`, `FIRMWARE_LATEST_NOTES` |
| **AI** | `OPENROUTER_API_KEY`, `OPENROUTER_DEFAULT_MODEL` (domyślnie `google/gemini-2.5-pro`), `MAILBOX_REPLY_MODEL`, `MAILBOX_TRANSLATE_MODEL` |
| **Stripe** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| **Przelewy24** | `P24_MERCHANT_ID`, `P24_POS_ID`, `P24_CRC`, `P24_API_KEY`, `P24_SANDBOX` |
| **Waluty** | `EUR_PLN_RATE`, `USD_PLN_RATE` |
| **Poczta wychodząca** | `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM_NAME`, `MAIL_FROM_ADDRESS` |
| **Skrzynka w panelu** | `MAILBOX_USER`, `MAILBOX_PASS`, `MAILBOX_IMAP_HOST`, `MAILBOX_IMAP_PORT`, `MAILBOX_SMTP_HOST`, `MAILBOX_SMTP_PORT` |
| **Newsletter** | `NEWSLETTER_SECRET`, `NEWSLETTER_DELAY_MS` |
| **Wysyłka — Base Courier** | `BASECOURIER_LOGIN`, `BASECOURIER_API_KEY`, `BASECOURIER_PAYMENT`, `BASECOURIER_PRINTER` |
| **Wysyłka — Furgonetka** | `FURGONETKA_API_URL`, `FURGONETKA_CLIENT_ID`, `FURGONETKA_CLIENT_SECRET`, `FURGONETKA_USERNAME`, `FURGONETKA_PASSWORD`, `FURGONETKA_INPOST_SERVICE_ID`, `FURGONETKA_SENDER_*` |
| **Wysyłka — InPost** | `NEXT_PUBLIC_INPOST_GEOWIDGET_TOKEN` |
| **Cło** | `OWNER_PESEL` (upoważnienie celne) |
| **Cron i automaty** | `CRON_SECRET`, `PAYMENT_REMINDER_AFTER_HOURS` |
| **Fiskalizacja** | `FISCAL_AGENT_TOKEN` (token agenta w sieci drukarki), `FISCAL_AUTO_ENQUEUE` (`1` = paragon do kolejki po opłaceniu), `FISCAL_PRODUCT_NAME`, `FISCAL_VAT_RATE` — patrz [docs/fiskalizacja](../docs/fiskalizacja/README.md) |
| **Kopie zapasowe** | `BACKUP_DIR`, `BACKUP_KEEP_DAYS`, `BACKUP_RCLONE_REMOTE` |
| **Analityka / SEO** | `ANALYTICS_SALT`, `GOOGLE_SITE_VERIFICATION` |
| **Pozostałe** | `RESEND_API_KEY` (stara wysyłka maili, zastąpiona przez SMTP) |

Pełną listę zawsze aktualnie pokaże:

```bash
grep -rhoE "process\.env\.[A-Z0-9_]+" src | sort -u
```

## Wdrożenie

Serwer: Ubuntu VPS, nginx jako reverse proxy, `next start` jako usługa systemowa.

```bash
git pull
npm ci
npx prisma generate
npm run build
# restart usługi Node (systemd / pm2 — zależnie od konfiguracji serwera)
```

Po wdrożeniu zmian w API urządzeń sprawdź, czy kalkulator wciąż łączy się z serwerem: wejdź w Ustawienia → Status konta albo rozwiąż zadanie testowe.

Starsze pliki `SETUP.md`, `READY_TO_DEPLOY.md`, `FINAL_STATUS.md` i `INSTALLATION_COMPLETE.md` opisują pierwszą wersję projektu (Gemini bezpośrednio, Resend) i są nieaktualne. To README jest aktualne.
