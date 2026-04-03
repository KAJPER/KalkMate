# Jak działa logowanie w KalkMate

## 🔐 System autentykacji

KalkMate używa **NextAuth.js** z **magic link email authentication** (bez haseł).

## 📧 Proces logowania (krok po kroku)

### 1. Użytkownik wchodzi na `/auth/signin`
- Wpisuje swój email
- Klika "Wyślij link logowania"

### 2. System wysyła email (przez Resend)
```
Od: KalkMate <noreply@kalkmate.pl>
Do: user@example.com
Temat: Zaloguj się do KalkMate

[Piękny email z przyciskiem "Zaloguj się"]
```

### 3. Link w emailu
```
https://kalkmate.pl/api/auth/callback/email?token=xyz&email=user@example.com
```

### 4. Użytkownik klika link
- NextAuth weryfikuje token
- Tworzy sesję (cookie: `next-auth.session-token`)
- Przekierowuje do `/panel`

### 5. Użytkownik zalogowany! ✅
- Sesja ważna przez 30 dni
- Cookie `httpOnly` + `secure` (bezpieczne)

## 🛡️ Zabezpieczenia

### Middleware NextAuth (`src/middleware.ts`)
```typescript
// Chroni /panel - wymaga logowania
if (pathname.startsWith("/panel")) {
  return !!token; // Musi być zalogowany
}
```

### API routes z autentykacją
```typescript
// src/app/api/chat/route.ts
const session = await getServerSession(authOptions);

if (!session?.user?.id) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

## 🔄 Przepływ sesji

```
Niezalogowany użytkownik
  ↓
Wchodzi na /panel
  ↓
Middleware sprawdza sesję → ❌ Brak sesji
  ↓
Przekierowanie → /auth/signin
  ↓
Wpisuje email → System wysyła magic link
  ↓
Klika link w emailu
  ↓
NextAuth tworzy sesję (cookie)
  ↓
Przekierowanie → /panel ✅
  ↓
Middleware sprawdza sesję → ✅ Sesja OK
  ↓
Panel się wyświetla
```

## 📝 Kluczowe pliki

### 1. **Konfiguracja NextAuth**
**Plik**: `src/lib/auth.ts`
```typescript
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    EmailProvider({
      // Wysyła email przez Resend
      sendVerificationRequest: async ({ identifier, url }) => {
        await resend.emails.send({
          to: identifier,
          subject: "Zaloguj się do KalkMate",
          html: "...", // Piękny template
        });
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify",
    error: "/auth/error",
  },
  events: {
    // Gdy nowy użytkownik się rejestruje
    async createUser({ user }) {
      // Auto-tworzy subskrypcję z 1-dniowym trialem
      await prisma.subscription.create({
        data: {
          userId: user.id,
          trialDays: 1,
          trialEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    },
  },
};
```

### 2. **API route NextAuth**
**Plik**: `src/app/api/auth/[...nextauth]/route.ts`
```typescript
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

### 3. **Middleware (ochrona routes)**
**Plik**: `src/middleware.ts`
```typescript
export default withAuth(
  function middleware(request) {
    // Custom logic dla /admin (inne auth)
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // /panel wymaga sesji NextAuth
        if (req.nextUrl.pathname.startsWith("/panel")) {
          return !!token;
        }
        return true;
      },
    },
    pages: { signIn: "/auth/signin" },
  }
);
```

### 4. **Strona logowania**
**Plik**: `src/app/auth/signin/page.tsx`
```typescript
"use client";

import { signIn } from "next-auth/react";

// Formularz z inputem email
const handleSubmit = async (e) => {
  await signIn("email", {
    email,
    callbackUrl: "/panel",
  });
};
```

### 5. **Panel klienta (chroniony)**
**Plik**: `src/app/panel/page.tsx`
```typescript
"use client";

import { useSession, signOut } from "next-auth/react";

export default function PanelPage() {
  const { data: session, status } = useSession();

  if (status === "loading") return <div>Ładowanie...</div>;
  if (status === "unauthenticated") {
    router.push("/auth/signin"); // Redirect
    return null;
  }

  return (
    <div>
      <p>Zalogowany jako: {session.user.email}</p>
      <button onClick={() => signOut()}>Wyloguj</button>
    </div>
  );
}
```

### 6. **SessionProvider (wraper)**
**Plik**: `src/components/SessionProvider.tsx`
```typescript
"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

export default function SessionProvider({ children }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
```

**Layout panelu**:
```typescript
// src/app/panel/layout.tsx
import SessionProvider from "@/components/SessionProvider";

export default function PanelLayout({ children }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

## 🗄️ Baza danych (Prisma)

NextAuth przechowuje dane w PostgreSQL:

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  emailVerified DateTime?

  accounts      Account[]
  sessions      Session[]
  orders        Order[]
  subscription  Subscription?
}

model Account {
  // OAuth accounts (nie używane, tylko dla Email provider)
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique  // Cookie value
  userId       String
  expires      DateTime
  user         User     @relation(...)
}

model VerificationToken {
  identifier String  // Email
  token      String  @unique  // Magic link token
  expires    DateTime
}
```

## 🔑 Zmienne środowiskowe

```env
# NextAuth
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000

# Email (Resend)
RESEND_API_KEY=re_...

# Database
DATABASE_URL=postgresql://...
```

## 🧪 Testowanie lokalnie

### 1. Zainstaluj wszystko
```bash
npm install
npx prisma generate
npx prisma db push
```

### 2. Skonfiguruj `.env.local`
```bash
cp .env.local.example .env.local
# Edytuj i dodaj klucze
```

### 3. Uruchom dev server
```bash
npm run dev
```

### 4. Zaloguj się
1. Otwórz http://localhost:3000/auth/signin
2. Wpisz email (dowolny)
3. Sprawdź **Resend Dashboard** → Emails
4. Kliknij email → Zobacz treść
5. Kliknij link w emailu
6. ✅ Zalogowany!

### 5. Sprawdź sesję
```bash
# Otwórz Chrome DevTools → Application → Cookies
# Zobacz: next-auth.session-token
```

## 🚨 Najczęstsze problemy

### "Zawsze jestem zalogowany na jakieś konto"
**Przyczyna**: Sesja w cookie nie wygasła.

**Rozwiązanie**:
```typescript
// Kliknij "Wyloguj" w panelu
<button onClick={() => signOut({ callbackUrl: "/" })}>
  Wyloguj
</button>

// LUB wyczyść cookies ręcznie:
// Chrome → DevTools → Application → Cookies → Usuń next-auth.session-token
```

### Email nie wysyła się
**Sprawdź**:
1. `RESEND_API_KEY` w `.env.local`
2. Resend Dashboard → Logs
3. Console error logs

### "Unauthorized" na `/panel`
**Przyczyna**: Middleware blokuje, bo brak sesji.

**Rozwiązanie**:
1. Zaloguj się ponownie przez `/auth/signin`
2. Sprawdź czy middleware działa: `console.log(token)`

### Middleware nie działa
**Sprawdź**:
```typescript
// src/middleware.ts
export const config = {
  matcher: ["/panel/:path*"], // Musi zawierać /panel
};
```

## 📚 Dodatkowe zasoby

- **NextAuth.js docs**: https://next-auth.js.org/
- **Email provider**: https://next-auth.js.org/providers/email
- **Resend docs**: https://resend.com/docs
- **Prisma adapter**: https://authjs.dev/reference/adapter/prisma

## 💡 Tips

### Wylogowanie wszystkich sesji
```bash
# Zmień NEXTAUTH_SECRET w .env.local
openssl rand -base64 32
# Restart dev server
# Wszyscy użytkownicy zostaną wylogowani
```

### Debug sesji
```typescript
// src/app/panel/page.tsx
const { data: session } = useSession();
console.log("Session:", session);
// Zobacz: user.id, user.email, expires
```

### Sprawdź czy zalogowany (server-side)
```typescript
// W API route
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const session = await getServerSession(authOptions);
if (!session) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### Sprawdź czy zalogowany (client-side)
```typescript
"use client";

import { useSession } from "next-auth/react";

const { data: session, status } = useSession();

if (status === "loading") return <div>Ładowanie...</div>;
if (status === "unauthenticated") return <div>Zaloguj się!</div>;

return <div>Cześć {session.user.email}!</div>;
```
