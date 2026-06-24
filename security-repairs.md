# KalkMate — Naprawy bezpieczeństwa (2026-06-24)

## Zgłoszone problemy i status

| ID | Severity | Komponent | Problem | Status |
|---|---|---|---|---|
| C3 | Critical | Firmware | TLS wyłączony wszędzie (`setInsecure()`) | ✅ Naprawione |
| C4 | Critical | Firmware | OTA akceptuje niepodpisany firmware domyślnie | ✅ Naprawione |
| C5 | Critical | Firmware | URL binarki OTA kontrolowany przez serwer, brak wymogu HTTPS | ✅ Naprawione |
| H1 | High | Device API | Brak tożsamości per-urządzenie (współdzielony klucz + spoofowalny MAC) | ✅ Naprawione |
| H2 | High | Device API | `/device/register` nadpisuje `unlockCode` dowolnego urządzenia | ✅ Naprawione |
| H3 | High | Device API | Endpointy `/device/*` przyjmują dowolny `x-device-id` (IDOR) | ✅ Naprawione |
| H2a | High | Device API | `/sync/subscription` i `/sync/messages` — IDOR przez `userId` z parametru | ✅ Naprawione |
| H4 | High | Backend | 7 tras admin bez własnego sprawdzenia auth | ✅ Naprawione |
| H6 | High | Backend | Brak rate-limit na `/chat` i `/device/solve` | ✅ Naprawione |
| H7 | High | Backend | Brak rate-limit na login/register/reset/2FA | ✅ Naprawione |
| H8 | High | Firmware | Klucz API tylko XOR-obfuskowany | ✅ Obsługiwane przez flasher (PROD_DEV/PROD_REL) |
| H9 | High | Firmware | Brak Flash Encryption / Secure Boot | ✅ Obsługiwane przez flasher (PROD_DEV/PROD_REL) |
| H10 | High | Backend | `shippingCents` od klienta nie walidowane | ✅ Naprawione |
| H11 | High | Backend | Single-use kupony podatne na TOCTOU | ✅ Naprawione |
| M1 | Medium | Backend | Statyczny token admina, porównanie nie-timing-safe | ✅ Naprawione |
| M2 | Medium | Backend | Niespójna nazwa cookie w routach admina | ✅ Naprawione |
| M3 | Medium | Backend | Webhook nie weryfikuje kwoty vs oczekiwanej ceny | ✅ Naprawione |
| M4 | Medium | Backend | `/api/cron/tracking` fail-open + PII w odpowiedzi | ✅ Naprawione |
| M5 | Medium | Backend | Plan `second_month` dostępny dla każdego | ✅ Naprawione |
| M6 | Medium | Backend | Realizacja licencji podatna na TOCTOU | ✅ Naprawione |
| M7 | Medium | Backend | Brak nagłówków bezpieczeństwa HTTP | ✅ Naprawione |
| M8a | Medium | Backend | Rola w `/chat` forgowalny z klienta | ✅ Naprawione |
| M8b | Medium | Backend | `change-email` zmienia email bez weryfikacji nowego adresu | ✅ Naprawione |
| M9 | Medium | Firmware | Sekrety w logach szeregowych | ✅ Naprawione |

---

## C3 — TLS wyłączony (`setInsecure()`)

**Ryzyko:** Atakujący w tej samej sieci (rogue AP, ARP spoofing) może wykonać MITM — przechwycić klucze API, klucze licencji, dane zadań, a przy połączeniu z C4/C5 wgrać złośliwy firmware.

**Naprawa:**
- Stworzono `src/kalkmate_certs.h` z certyfikatem root CA Let's Encrypt (ISRG Root X1, ważny do 2035-06-04)
- We wszystkich plikach firmware zastąpiono `client.setInsecure()` przez `client.setCACert(KALKMATE_CA_CERT)`

**Pliki zmienione:**
- `src/kalkmate_certs.h` — **NOWY** (cert ISRG Root X1)
- `src/device_account.h` — linie 66, 106
- `src/ota_update.h` — linie 102, 317
- `src/solve_screen.h` — linie 567, 667
- `src/notes.h` — linia 216
- `src/tests.h` — linia 229

**Weryfikacja po wdrożeniu:**
```bash
# Sprawdź czy kalkmate.pl używa Let's Encrypt (ISRG Root X1)
openssl s_client -connect kalkmate.pl:443 -showcerts 2>/dev/null | grep "ISRG Root X1"
```
Jeśli serwer używa innego CA (np. Cloudflare), podmień cert w `src/kalkmate_certs.h`.

---

## C4 — OTA akceptuje niepodpisany firmware

**Ryzyko:** Bez flagi `KALK_REQUIRE_SIGNED_OTA` firmware instaluje się nawet bez podpisu ECDSA. Atakujący (przez C3 MITM) usuwa pole `sig` z odpowiedzi serwera → urządzenie instaluje dowolny kod → trwały RCE.

**Naprawa:**
- Dodano `-DKALK_REQUIRE_SIGNED_OTA=1` do `build_flags` w obu środowiskach w `platformio.ini`
- Od teraz `otaInstall()` odrzuca firmware bez podpisu z komunikatem na OLED

**Plik zmieniony:** `platformio.ini` — sekcje `[env:esp32s3]` i `[env:esp32wrover_legacy]`

**Mechanizm (już istniał w kodzie, teraz wymuszony):**
```cpp
#ifdef KALK_REQUIRE_SIGNED_OTA
    if (sigB64.isEmpty()) {
        // ODRZUCONO — wyświetla błąd na OLED, nie instaluje
        return false;
    }
#endif
// Weryfikacja ECDSA P-256 SHA-256(firmware) przez mbedtls
```

---

## C5 — URL binarki OTA bez walidacji domeny

**Ryzyko:** URL do `.bin` pochodzi z odpowiedzi serwera. Przy MITM atakujący podmienia URL na własny serwer → urządzenie pobiera złośliwy firmware (nawet gdy C4 jest zablokowane, bo podpis można sfałszować na własnym serwerze jeśli klucz prywatny wycieknie).

**Naprawa:**
- Przed pobraniem sprawdzenie: `binUrl` musi zaczynać się od `https://kalkmate.pl/`
- Brak tego prefiksu → instalacja odrzucona z logiem i komunikatem na OLED

**Plik zmieniony:** `src/ota_update.h` — dodano walidację przed `http.begin(client, binUrl)`

```cpp
if (!binUrl.startsWith("https://kalkmate.pl/")) {
    Serial.printf("[OTA] ODRZUCONO: zly URL firmware: %s\n", binUrl.c_str());
    _otaDrawProgress(d, "BLAD: zly URL!", 0);
    delay(3000);
    return false;
}
```

---

## H1 — Brak tożsamości per-urządzenie

**Ryzyko:** Każde urządzenie autoryzuje się tylko współdzielonym `CALCULATOR_API_KEY` + adresem MAC wysłanym przez siebie (nagłówek `x-device-id`). Ktokolwiek wyciągnie klucz API z firmware (XOR obfuskacja, dekodowalne w ~5 min) może podszywać się pod dowolne urządzenie.

**Naprawa — per-device secret token:**

Przy pierwszej rejestracji serwer generuje unikalny `deviceToken` (32 bajty losowe = 64 znaki hex) i zapisuje go w bazie. Token jest zwracany w odpowiedzi i zapisywany przez urządzenie w NVS.

Każde kolejne żądanie do API urządzenia musi zawierać `x-device-token`. Serwer weryfikuje czy token pasuje do `deviceId` w bazie.

**Przepływ:**
```
1. Pierwsze włączenie → POST /device/register (bez tokenu)
   ← { ok: true, deviceToken: "a3f9...64 znaki hex..." }
2. Token zapisany w NVS (wifi_persist.h → "dev_token")
3. Każde kolejne żądanie:
   → x-device-id: AA:BB:CC:DD:EE:FF
   → x-device-token: a3f9...
4. Serwer: SELECT deviceToken FROM Device WHERE deviceId=?
   Jeśli token w DB ≠ token w nagłówku → 401
```

**Zachowanie przejściowe:** Urządzenia bez tokenu w bazie (stare rejestracje) nadal działają. Po pierwszym połączeniu z nowym firmware automatycznie dostają i zapisują token.

**Pliki zmienione:**
- `website/prisma/schema.prisma` — dodano `deviceToken String? @unique`
- `website/prisma/migrations/20260624000001_add_device_token/migration.sql` — `ALTER TABLE`
- `website/src/lib/device-auth.ts` — **NOWY** helper
- `website/src/app/api/device/register/route.ts` — generowanie tokenu
- `src/wifi_persist.h` — `wifiSaveDeviceToken()` / `wifiLoadDeviceToken()`
- `src/device_account.h` — wysyłanie/odbieranie/zapisywanie tokenu

---

## H2 — `/device/register` nadpisuje `unlockCode` sparowanego urządzenia

**Ryzyko:** `POST /device/register` z dowolnym MAC + nowym `unlockCode` nadpisywał istniejący rekord w bazie bez sprawdzenia czy urządzenie jest już sparowane. Atakujący mógł:
1. Wywołać `/device/register` z MAC ofiary + własny `unlockCode` (np. `1234`)
2. Wejść na stronę `/claim?d=<MAC>&c=1234`
3. Sparować urządzenie ofiary ze swoim kontem

**Naprawa:**
- Gdy urządzenie ma `userId` (sparowane) → `unlockCode` **nie jest** aktualizowany
- Aktualizowane są tylko: `lastSeen`, `firmwareVersion`, `lastIp`, `deviceToken`
- `unlockCode` można zmienić tylko gdy urządzenie jest **niesparowane** (brak `userId`)

**Plik zmieniony:** `website/src/app/api/device/register/route.ts`

```typescript
if (userId) {
    // Sparowane urządzenie: nie nadpisuj unlockCode (H2)
    await prisma.$executeRaw`
        UPDATE "Device"
        SET "lastSeen" = CURRENT_TIMESTAMP, "firmwareVersion" = ..., "deviceToken" = ...
        WHERE "deviceId" = ${deviceId}
    `;
} else {
    // Niesparowane: może aktualizować swój kod odblokowujący
    await prisma.$executeRaw`
        UPDATE "Device"
        SET "unlockCode" = ${unlockCode}, ...
        WHERE "deviceId" = ${deviceId}
    `;
}
```

---

## H3 — IDOR na endpointach `/device/*`

**Ryzyko:** Endpointy `/device/account-status`, `/device/conversations`, `/device/notes`, `/device/tests` akceptowały dowolny `x-device-id`. Ktokolwiek znał MAC urządzenia (np. z ruchu WiFi) + miał klucz API (C4) mógł czytać email, historię zadań, notatki i sprawdziany innego użytkownika.

**Naprawa:**
- Stworzono `website/src/lib/device-auth.ts` — centralny helper weryfikujący tożsamość
- Wszystkie endpointy używają `verifyDeviceAuth()` zamiast własnej weryfikacji tylko `x-api-key`
- Gdy urządzenie ma token w DB: żądanie bez prawidłowego `x-device-token` → `401`

**Helper `verifyDeviceAuth()`:**
```typescript
// Zwraca { ok: true, deviceId } lub { ok: false, status, error }
export async function verifyDeviceAuth(request: NextRequest): Promise<DeviceAuthResult> {
    // 1. Sprawdź x-api-key
    // 2. Sprawdź x-device-id
    // 3. Pobierz deviceToken z DB dla tego deviceId
    // 4. Jeśli token w DB istnieje i nie pasuje do x-device-token → 401
}
```

**Pliki zmienione:**
- `website/src/lib/device-auth.ts` — **NOWY**
- `website/src/app/api/device/account-status/route.ts`
- `website/src/app/api/device/conversations/route.ts`
- `website/src/app/api/device/notes/route.ts`
- `website/src/app/api/device/tests/route.ts`

---

## H4 — Trasy admina bez własnego sprawdzenia auth

**Ryzyko:** Middleware Next.js to jedyna linia obrony — wyłączenie lub obejście (np. atak na `/api/admin/orders` przez CDN z pominiętym middleware) daje pełny dostęp do danych zamówień, urządzeń i użytkowników bez autoryzacji.

**Naprawa:**
- Stworzono `website/src/lib/admin-auth.ts` → `requireAdminAuth(request)` — stałoczasowe porównanie tokenu sesji (defense-in-depth, nawet gdy middleware jest wyłączony)
- Dodano wywołanie jako **pierwsza linia** w każdym handlerze 6 tras, które nie miały własnej autoryzacji:
  - `admin/analytics/route.ts` — GET
  - `admin/visits/route.ts` — GET (POST pozostaje publiczne — zliczanie odwiedzin)
  - `admin/orders/route.ts` — GET
  - `admin/orders/[id]/route.ts` — GET, PATCH
  - `admin/orders/[id]/furgonetka/route.ts` — POST, GET
  - `admin/orders/[id]/invoice/route.ts` — POST

```typescript
// Wzorzec w każdym handlerze:
const authErr = requireAdminAuth(request);
if (authErr) return authErr;
```

---

## H6 — Brak rate-limit na `/chat` i `/device/solve`

**Ryzyko:** Bez limitu żądań każdy zalogowany użytkownik lub właściciel licencji może wysyłać nieograniczone zapytania do AI — koszt tokenów rośnie liniowo z liczbą nadużyć, brak ochrony przed automatycznymi botami.

**Naprawa:**
- `/api/chat` — limit 20 req/min per `session.user.email`
- `/api/device/solve` — limit 30 req/min per klucz licencji

```typescript
// W /api/chat/route.ts:
const rl = rateLimit(`chat:${session.user.email}`, 20, 60_000);
if (!rl.ok) return NextResponse.json({ error: "Za dużo zapytań." }, { status: 429 });

// W /api/device/solve/route.ts:
const rl = rateLimit(`solve:${license.code}`, 30, 60_000);
if (!rl.ok) return NextResponse.json({ ok: false, error: "Za dużo zadań. Poczekaj chwilę." }, { status: 429 });
```

---

## H7 — Brak rate-limit na login/register/reset/2FA

**Ryzyko:** Endpointy auth bez limitu podatne na brute-force haseł i enumerację kont.

**Naprawa** (sliding window in-memory, per IP):
- `POST /api/admin/auth` — 5 req / 5 min
- `POST /api/auth/register` — 5 req / 15 min
- `POST /api/auth/forgot-password` — 3 req / 15 min
- `POST /api/auth/reset-password` — 5 req / 15 min

```typescript
const ip = clientIp(request);
const rl = rateLimit(`register:${ip}`, 5, 15 * 60_000);
if (!rl.ok) return NextResponse.json({ error: `Za dużo prób. Spróbuj za ${Math.ceil(rl.resetMs/1000)}s.` }, { status: 429 });
```

---

## H8 + H9 — XOR obfuskacja klucza API / Brak Flash Encryption

**Ryzyko:** Klucz API zapisany w firmware może być wyekstrahowany z binarki w ~5 min. Flash Encryption ESP32 chroni przed fizycznym odczytem pamięci Flash i NVS (SSID, hasło, licencja, device token).

**Status: już zaimplementowane w `tools/flasher/flasher.py`.**

Flasher produkcyjny ma 3 tryby — wybiera się radiobutton w GUI:

| Tryb | Kiedy używać | Co robi |
|---|---|---|
| `DEV` | Prototypy, debug | Tylko firmware, bez Flash Encryption |
| `PROD_DEV` | QC test przed wysyłką | FE Development — można jeszcze reflashować (do ~4×) |
| `PROD_REL` | Tuż przed włożeniem do pudełka | FE Release — **permanentnie zablokowane** |

**Szczegóły procesu `PROD_DEV` / `PROD_REL`:**
1. Jeśli `tools/flasher/keys/flash_encryption_key.bin` nie istnieje — generuje nowy 64-bajtowy klucz AES-XTS-256
2. `espsecure encrypt-flash-data` — pre-szyfruje bootloader, partitions i firmware przed wgraniem
3. `esptool write-flash` — wgrywa zaszyfrowane pliki
4. `espefuse burn-key BLOCK_KEY0` — wypala klucz do eFuse
5. `espefuse burn-efuse SPI_BOOT_CRYPT_CNT 1` — włącza Flash Encryption
6. (tylko `PROD_REL`) `espefuse burn-efuse DIS_DOWNLOAD_MANUAL_ENCRYPT 1` — blokuje na zawsze

**Workflow produkcyjny** (patrz `tools/flasher/SHIPPING_CHECKLIST.md`):
```
1. pio run -e esp32s3          ← build
2. .\deploy.ps1 X.Y.Z "..."   ← upload + podpis ECDSA na serwerze
3. python flasher.py           ← GUI flasher
   → PROD_DEV → FLASH → QC test
   → PROD_REL → FLASH → pudełko → wysyłka
```

**Klucz FE:** `tools/flasher/keys/flash_encryption_key.bin` — gitignored (`.gitignore` zawiera `tools/flasher/keys/`). Backup obowiązkowo na osobnym nośniku offline — bez niego żadna płytka tej serii nie da się reflashować przez USB.

**Uwaga C2:** Plik `tools/flasher/Klucze kalkmate/flash_encryption_key.bin` jest innym, starszym kluczem który trafił do historii gita (commit `495122d`). Traktować jako skompromitowany — nie używać do produkcji. Klucz produkcyjny to tylko ten z `tools/flasher/keys/`.

---

## H10 — `shippingCents` od klienta nie walidowane

**Ryzyko:** Frontend wysyłał `shippingCents` jako liczbę. Jeśli ktoś zmodyfikował żądanie (np. Burp Suite) i ustawił `shippingCents = -5000`, obniżał całkowitą kwotę PaymentIntent o 50 zł.

**Naprawa** — walidacja przed utworzeniem PaymentIntent:
```typescript
const MAX_SHIPPING = 5000; // 50 zł
if (shippingCents !== undefined && shippingCents !== null && (
  typeof shippingCents !== "number" || !Number.isInteger(shippingCents) ||
  shippingCents < 0 || shippingCents > MAX_SHIPPING
)) {
  return NextResponse.json({ error: "Nieprawidłowa kwota wysyłki." }, { status: 400 });
}
```

**Plik zmieniony:** `website/src/app/api/create-payment-intent/route.ts`

---

## H11 — Single-use kupony podatne na TOCTOU

**Ryzyko:** Przy równoczesnych żądaniach kupon `maxUses=1` mógł być użyty wielokrotnie (race condition CHECK → webhook → obydwa żądania widzą `usedCount < maxUses`).

**Naprawa** — atomowe `UPDATE ... WHERE usedCount < maxUses`:
```typescript
await prisma.$executeRaw`
  UPDATE Coupon
  SET usedCount = usedCount + 1
  WHERE code = ${norm}
    AND (maxUses IS NULL OR usedCount < maxUses)
`;
```

**Plik zmieniony:** `website/src/lib/coupons.ts` → `incrementCouponUsage()`

---

## M1 — Statyczny token admina, porównanie nie-timing-safe

**Ryzyko:** `token !== process.env.ADMIN_SESSION_TOKEN` — porównanie łańcuchów JS jest podatne na timing attack (różny czas dla różnych prefixów).

**Naprawa** — `crypto.timingSafeEqual` w middleware i helper:
```typescript
function isValidAdminSession(value: string | undefined): boolean {
  const expected = process.env.ADMIN_SESSION_TOKEN;
  if (!expected || !value) return false;
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

**Pliki zmienione:**
- `website/src/middleware.ts` — middleware używa `isValidAdminSession()`
- `website/src/lib/admin-auth.ts` — helper `requireAdminAuth()` z `timingSafeEqual`

---

## M2 — Niespójna nazwa cookie w routach admina

**Ryzyko:** Dwa routy (`users/[id]`, `licenses/list`) definiowały lokalnie `COOKIE_NAME = "__Secure-admin_session"` w produkcji. Tymczasem `auth/route.ts` ustawia cookie jako `"admin_session"` (bez prefiksu `__Secure-`). Wynik: w produkcji te routy zawsze zwracały `401` — użyteczna funkcja była zepsuta.

**Naprawa:**
```typescript
// Przed (błędne — inne pliki, inne definicje):
const COOKIE_NAME = process.env.NODE_ENV === "production"
  ? "__Secure-admin_session" : "admin_session";

// Po (poprawne — jeden eksport z admin-auth.ts):
import { COOKIE_NAME } from "@/lib/admin-auth"; // zawsze "admin_session"
```

**Pliki zmienione:**
- `website/src/app/api/admin/users/[id]/route.ts`
- `website/src/app/api/admin/licenses/list/route.ts`

---

## M3 — Webhook nie weryfikuje kwoty vs oczekiwanej ceny

**Ryzyko:** `handlePaymentIntentSucceeded` rejestrował zamówienie na podstawie `pi.id`, nie sprawdzając czy `pi.amount` (faktycznie zapłacona kwota) zgadza się z oczekiwanym totalem produktu. Przy manipulacji PaymentIntent w niestandardowym przepływie atakujący mógłby zapłacić mniej niż wymagane.

**Naprawa:**
```typescript
const currency = (meta.currency || pi.currency || "pln").toLowerCase();
const productAmount = currency === "eur" ? 16900 : 69900;
const discountAmount = parseInt(meta.discount_amount || "0", 10);
const shippingAmount = parseInt(meta.shipping_amount || "0", 10);
const expectedTotal = (productAmount - discountAmount) + shippingAmount;
if (pi.amount !== expectedTotal) {
  console.error(`[WEBHOOK] ❌ KWOTA NIESPÓJNA: zapłacono ${pi.amount}, oczekiwano ${expectedTotal} (PI: ${pi.id})`);
  return; // nie rejestruj zamówienia
}
```

**Plik zmieniony:** `website/src/app/api/webhooks/stripe/route.ts`

---

## M4 — `/api/cron/tracking` fail-open + PII w odpowiedzi

**Ryzyko:**
1. Warunek `if (CRON_SECRET && secret !== CRON_SECRET)` → gdy `CRON_SECRET` nie ustawiony, każdy mógł wywołać cron
2. `secret` odczytywane z URL param `?secret=` (logi serwera mogły zapisać sekret)
3. Wynik zawierał adresy email klientów (`[PICKUP] ${pi.id} → ${email}`)

**Naprawa:**
```typescript
// Fail-secure:
if (!CRON_SECRET || secret !== CRON_SECRET) return 401;

// Sekret tylko z nagłówka (nie z URL):
const secret = request.headers.get("x-cron-secret");

// Bez PII w odpowiedzi:
results.push(`[PICKUP] ${pi.id}`); // nie: `→ ${email}`
```

**Plik zmieniony:** `website/src/app/api/cron/tracking/route.ts`

---

## M5 — Plan `second_month` dostępny dla każdego

**Ryzyko:** Plan ze zniżką -98% (`second_month`) był dostępny dla każdego zalogowanego użytkownika przez API, nawet bez zakupu kalkulatora.

**Naprawa:**
```typescript
if (plan === "second_month") {
  const order = await prisma.order.findFirst({ where: { userId: user.id } });
  if (!order) {
    return NextResponse.json({ error: "Plan dostępny wyłącznie dla klientów KalkMate." }, { status: 403 });
  }
}
```

**Plik zmieniony:** `website/src/app/api/subscription/purchase/route.ts`

---

## M6 — Realizacja licencji podatna na TOCTOU

**Ryzyko:** Sekwencja: `findUnique(isUsed=false)` → `update(isUsed=true)` — przy równoczesnych żądaniach dwa wątki mogły przejść walidację przed ustawieniem flagi i oba aktywować tę samą licencję.

**Naprawa** — atomowy `UPDATE ... WHERE isUsed = 0`:
```typescript
const marked = await prisma.$executeRaw`
  UPDATE "License"
  SET "isUsed" = 1, "usedBy" = ${user.id}, "usedAt" = ${now.toISOString()}
  WHERE "id" = ${license.id} AND "isUsed" = 0
`;
if (Number(marked) === 0) return 400; // już użyta
```

**Plik zmieniony:** `website/src/app/api/subscription/redeem/route.ts`

---

## M7 — Brak nagłówków bezpieczeństwa HTTP

**Ryzyko:** Brak CSP, HSTS, X-Frame-Options itp. ułatwia clickjacking, XSS, sniffing MIME.

**Naprawa** — nagłówki w `next.config.ts`:
```typescript
headers: [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: "default-src 'self'; ..." },
]
```

**Plik zmieniony:** `website/next.config.ts`

---

## M8 — Rola w `/chat` forgowalny z klienta

**Ryzyko:** `/api/chat` przyjmował `messages` z klienta bez walidacji pola `role`. Ktoś mógł wstrzyknąć wiadomość z `role: "system"` (przed właściwym system promptem), nadpisując instrukcje AI.

**Naprawa:**
```typescript
const ALLOWED_ROLES = new Set(["user", "assistant"]);
messages.forEach((msg: any) => {
  if (!ALLOWED_ROLES.has(msg.role)) return; // odfiltruj role: "system"
  filtered.push({ role: msg.role, content: msg.content });
});
```

**Plik zmieniony:** `website/src/app/api/chat/route.ts`

---

## M9 — Sekrety w logach szeregowych

**Ryzyko:** `Serial.printf` wypisywało SSID sieci WiFi i klucz licencji w konsoli. Ktoś z fizycznym dostępem do portu USB lub przechwytujący UART mógł odczytać dane wrażliwe.

**Naprawa** — usunięto wartości sekretów z komunikatów logów:
```cpp
// Przed:
Serial.printf("[account] licencja zapisana w NVS: %s\n", out.licenseCode.c_str());
Serial.printf("[WiFi-auto] lacze: %s\n", ssid);
Serial.printf("[POWER] wake -> WiFi reconnect: %s\n", ssid);

// Po:
Serial.println("[account] licencja zapisana w NVS");
Serial.println("[WiFi-auto] lacze z zapisanymi danymi");
Serial.println("[POWER] wake -> WiFi reconnect");
```

**Pliki zmienione:**
- `src/device_account.h` — linia 200
- `src/main.cpp` — linia 1077
- `src/power.h` — linia 116

---

## Instrukcja wdrożenia

### 1. Serwer (najpierw!)

```bash
cd /home/ubuntu/kalkulator/website

# Zastosuj migracje bazy danych (dwie nowe: deviceToken + targetEmail)
npx prisma migrate deploy

# Zregeneruj klienta Prisma
npx prisma generate

# Zbuduj i zrestartuj
npm run build
sudo systemctl restart kalkulator
```

**Co robią migracje:**
- `20260624000001_add_device_token` — dodaje kolumnę `deviceToken TEXT UNIQUE` do tabeli `Device`
- `20260624000002_add_email_verification_target` — dodaje kolumnę `targetEmail TEXT` do tabeli `EmailVerification` (potrzebne dla M8b — change-email z weryfikacją)

### 2. Firmware

Zbuduj i wgraj nowy firmware przez PlatformIO (env: `esp32s3`).

Po pierwszym połączeniu urządzenia z WiFi:
- `accountRegister()` wywoła `POST /device/register`
- Serwer wygeneruje i zwróci `deviceToken`
- Urządzenie zapisze go w NVS pod kluczem `dev_token`
- Kolejne żądania będą już autoryzowane tokenem

### 3. Weryfikacja po wdrożeniu

```bash
# Sprawdź czy kolumny istnieją w bazie
sqlite3 /home/ubuntu/kalkulator/website/prisma/dev.db \
  "SELECT deviceId, deviceToken FROM Device LIMIT 5;"

sqlite3 /home/ubuntu/kalkulator/website/prisma/dev.db \
  "PRAGMA table_info(EmailVerification);"
# Powinna być widoczna kolumna targetEmail

# Sprawdź logi serwera po połączeniu urządzenia
journalctl -u kalkulator -f | grep "device/register"

# Sprawdź nagłówki bezpieczeństwa HTTP (M7)
curl -sI https://kalkmate.pl | grep -E "X-Frame|Content-Security|Strict-Transport|X-Content-Type"

# Sprawdź rate-limiting na logowaniu (H7)
for i in {1..6}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://kalkmate.pl/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"test"}';
done
# Szóste żądanie powinno zwrócić 429
```

### 4. Weryfikacja zmiany emaila (M8b)

Nowy flow dla użytkownika:
1. Użytkownik wchodzi w ustawienia → zmiana emaila → podaje nowy adres + hasło
2. Backend wysyła email weryfikacyjny **na nowy adres** (nie zmienia od razu)
3. Użytkownik klika link `/auth/verify?token=...`
4. Dopiero wtedy email zostaje zmieniony + `emailVerified` ustawiony
5. Użytkownik musi się zalogować ponownie (sesja trzyma stary email)

Jeśli frontend wyświetlał po `change-email` komunikat „zaloguj się ponownie" (`relogin: true`) — teraz odpowiedź to `{ ok: true, verificationSent: true }`. **Sprawdź czy UI obsługuje nową odpowiedź.**

---

## Pozostałe kwestie

| ID | Problem | Status | Rekomendacja |
|---|---|---|---|
| H8/H9 | Flash Encryption | ✅ Zaimplementowane w flasher | Używać trybu `PROD_DEV` → QC → `PROD_REL` → wysyłka. Klucz backupować offline. |
| C1/C2 | Klucze kryptograficzne w historii gita | ⚠️ Nie usunięto | `git filter-repo --path "tools/flasher/Klucze kalkmate" --invert-paths`. Traktować klucz z gita jako skompromitowany — nie używać do produkcji. |
| H5 | `dev.db` z PII w repozytorium | ⚠️ Nie usunięto | `git rm --cached website/prisma/dev.db website/prisma/prisma/dev.db`, dodać `*.db` do `.gitignore`, scrub historii. |
| — | WiFi hasło i licencja w NVS | ✅ Covered przez Flash Encryption | Po wdrożeniu PROD_DEV/PROD_REL NVS jest szyfrowany sprzętowo. |
| — | Licencja jako fallback auth | Przejściowe | Usunąć fallback licencji w `/device/notes` i `/device/tests` po pełnym wdrożeniu nowego firmware z device token. |
