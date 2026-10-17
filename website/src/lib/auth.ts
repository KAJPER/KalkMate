import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { encode, getToken } from "next-auth/jwt"
import type { NextRequest, NextResponse } from "next/server"
import { prisma } from "./db"
import { deleteUserCaptures } from "./captures"
import bcrypt from "bcryptjs"
import { randomUUID } from "crypto"
import { rateLimit, clientIp } from "./rate-limit"

// ---------------------------------------------------------------------------
// Wspolne reguly kont
// ---------------------------------------------------------------------------
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const EMAIL_MAX_LENGTH = 254
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 200 // bcrypt i tak bierze 72 bajty; limit chroni przed DoS
export const NAME_MAX_LENGTH = 100

// Rejestracja zapisuje e-mail malymi literami — logowanie musi szukac tak samo
// (wczesniej "Jan@..." z autokorekty telefonu nie mogl sie zalogowac).
export function normalizeEmail(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase() : ""
}

// IP klienta z naglowkow NextAuth (authorize dostaje zwykly obiekt, nie
// NextRequest) — ta sama logika co clientIp() w lib/rate-limit.ts.
function ipFromHeaderRecord(h: Record<string, unknown> | undefined): string {
  const headers = new Headers()
  for (const name of ["x-real-ip", "x-forwarded-for"]) {
    const v = h?.[name]
    if (typeof v === "string") headers.set(name, v)
  }
  return clientIp({ headers } as unknown as NextRequest)
}

// Sztuczny hash do porownania, gdy konta nie ma albo nie ma hasla — czas
// odpowiedzi nie zdradza, czy e-mail jest zarejestrowany.
let _dummyHash: Promise<string> | null = null
function dummyHash(): Promise<string> {
  if (!_dummyHash) _dummyHash = bcrypt.hash(randomUUID(), 10)
  return _dummyHash
}

const LOGIN_WINDOW_MS = 15 * 60_000
const LOGIN_MAX_PER_EMAIL = 10
// Wiecej niz per e-mail: cala szkola potrafi wychodzic z jednego IP (NAT).
const LOGIN_MAX_PER_IP = 30

// ---------------------------------------------------------------------------
// Wersja sesji (User.sessionVersion) — odwolywanie sesji JWT
// ---------------------------------------------------------------------------
// JWT trzyma sub = User.id i sv = sessionVersion. Reset/zmiana hasla i
// usuniecie konta podbijaja sessionVersion -> wszystkie wczesniej wydane
// tokeny przestaja dzialac (callback jwt rzuca SESSION_REVOKED, NextAuth
// czysci cookie). Stare tokeny (sprzed tej zmiany) nie maja sv — traktujemy je
// jak sv=0 i szukamy uzytkownika po e-mailu. Kolumna poza Prisma (raw SQL,
// tworzona leniwie) jak User.tokenBalance.

const SESSION_REVOKED = "SESSION_REVOKED"
const SV_CACHE_MS = 60_000

let _svReady = false
async function ensureSessionVersionColumn(): Promise<void> {
  if (_svReady) return
  const cols = await prisma.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("User")`)
  if (!cols.some((c) => c.name === "sessionVersion")) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0`)
    } catch {
      /* rownolegle zadanie dodalo juz kolumne */
    }
  }
  _svReady = true
}

interface SessionState {
  id: string
  email: string
  sv: number
}

async function loadSessionState(by: { id?: string; email?: string }): Promise<SessionState | null> {
  await ensureSessionVersionColumn()
  type Row = { id: string; email: string; sessionVersion: number | bigint | null }
  let rows: Row[] = []
  if (by.id) {
    rows = await prisma.$queryRaw<Row[]>`SELECT "id", "email", "sessionVersion" FROM "User" WHERE "id" = ${by.id} LIMIT 1`
  } else if (by.email) {
    rows = await prisma.$queryRaw<Row[]>`SELECT "id", "email", "sessionVersion" FROM "User" WHERE "email" = ${by.email} LIMIT 1`
  }
  const r = rows[0]
  return r ? { id: r.id, email: r.email, sv: Number(r.sessionVersion ?? 0) } : null
}

// Cache per proces (PM2 fork, 1 instancja — jak lib/rate-limit.ts). Bump
// czysci wpis, wiec w tym samym procesie odwolanie dziala od razu.
const _svCache = new Map<string, { state: SessionState; at: number }>()

function cacheSet(key: string, state: SessionState) {
  _svCache.set(key, { state, at: Date.now() })
  if (_svCache.size > 5000) {
    const cutoff = Date.now() - SV_CACHE_MS
    for (const [k, v] of _svCache) if (v.at < cutoff) _svCache.delete(k)
  }
}

function forgetUser(userId: string, email?: string | null) {
  _svCache.delete(`id:${userId}`)
  if (email) _svCache.delete(`e:${email}`)
}

// Wylogowuje WSZYSTKIE sesje uzytkownika (reset/zmiana hasla, usuniecie konta).
export async function bumpSessionVersion(userId: string): Promise<number> {
  await ensureSessionVersionColumn()
  await prisma.$executeRaw`UPDATE "User" SET "sessionVersion" = COALESCE("sessionVersion", 0) + 1 WHERE "id" = ${userId}`
  const state = await loadSessionState({ id: userId })
  forgetUser(userId, state?.email)
  return state?.sv ?? 0
}

// Po zmianie hasla: bumpSessionVersion wylogowuje wszystkie sesje, a ta
// funkcja wystawia BIEZACEJ sesji nowe cookie z aktualnym sv — uzytkownik,
// ktory zmienil haslo, zostaje zalogowany, reszta urzadzen nie.
export async function reissueSessionCookie(req: NextRequest, res: NextResponse, userId: string): Promise<void> {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) return
  const name = ["__Secure-next-auth.session-token", "next-auth.session-token"].find((n) => req.cookies.get(n))
  if (!name) return
  try {
    const token = await getToken({ req, secret, cookieName: name })
    if (!token) return
    const state = await loadSessionState({ id: userId })
    if (!state) return
    const maxAge = 30 * 24 * 60 * 60 // domyslne session.maxAge NextAuth
    const value = await encode({ token: { ...token, sub: state.id, email: state.email, sv: state.sv }, secret, maxAge })
    res.cookies.set(name, value, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: name.startsWith("__Secure-"),
      maxAge,
    })
  } catch (e) {
    console.error("[auth] reissueSessionCookie failed:", e)
  }
}

// ---------------------------------------------------------------------------
// Usuniecie konta (panel admina i samodzielne usuniecie przez uzytkownika)
// ---------------------------------------------------------------------------
// Zamowienia ZOSTAJA (dane ksiegowe — obowiazek przechowywania), tylko
// odpinamy je od konta: Order.userId ma w bazie ON DELETE CASCADE, wiec samo
// prisma.user.delete kasowalo oplacone zamowienia. TokenPurchase (zakupy
// tokenow) tez zostaje — tabela nie ma klucza obcego.
// Zdjecia z kalkulatora (lib/captures) NIE sa tu usuwane.
export async function deleteUserAccount(userId: string): Promise<{ ok: boolean; email?: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } })
  if (!user) return { ok: false }
  const email = user.email.toLowerCase()

  const bestEffort = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn()
    } catch (e) {
      console.warn(`[auth] deleteUserAccount: ${label} cleanup failed:`, e instanceof Error ? e.message : e)
    }
  }
  // Tabele poza Prisma (moga nie istniec na swiezej bazie) — best effort.
  await bestEffort("EmailVerification", () => prisma.$executeRaw`DELETE FROM "EmailVerification" WHERE "userId" = ${userId}`)
  await bestEffort("PasswordReset", () => prisma.$executeRaw`DELETE FROM "PasswordReset" WHERE "userId" = ${userId}`)
  await bestEffort("MarketingConsent", () => prisma.$executeRaw`DELETE FROM "MarketingConsent" WHERE "email" = ${email}`)
  await bestEffort("UserLanguage", () => prisma.$executeRaw`DELETE FROM "UserLanguage" WHERE "email" = ${email}`)
  // Historia pytan/odpowiedzi z kalkulatora (DeviceSolve ma onDelete SetNull —
  // bez tego tresci zostalyby w bazie po usunieciu konta).
  await bestEffort("DeviceSolve", () => prisma.deviceSolve.deleteMany({ where: { userId } }))
  // Zdjecia zadan z kalkulatora (pliki na dysku + indeks Capture).
  await bestEffort("Capture", async () => { await deleteUserCaptures(userId) })

  await prisma.$transaction([
    prisma.$executeRaw`UPDATE "Order" SET "userId" = NULL WHERE "userId" = ${userId}`,
    prisma.device.updateMany({ where: { userId }, data: { userId: null } }),
    // Licencja wraca do puli (inaczej zostaje "zajeta" przez nieistniejace konto).
    prisma.license.updateMany({ where: { claimedByUserId: userId }, data: { claimedByUserId: null } }),
    // Konto + kaskadowo: Account, Session, Subscription, Conversation (z
    // ChatMessage/Attachment), Note, Test.
    prisma.user.delete({ where: { id: userId } }),
  ])
  forgetUser(userId, user.email)
  return { ok: true, email }
}

// ---------------------------------------------------------------------------
// Sprzatanie wygaslych tokenow z linkow (reset hasla, weryfikacja e-maila)
// ---------------------------------------------------------------------------
let _lastTokenPurge = 0
export async function purgeExpiredAuthTokens(): Promise<void> {
  if (Date.now() - _lastTokenPurge < 6 * 60 * 60_000) return
  _lastTokenPurge = Date.now()
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString()
  try {
    await prisma.$executeRaw`DELETE FROM "PasswordReset" WHERE "expiresAt" < ${cutoff}`
  } catch {}
  try {
    await prisma.$executeRaw`DELETE FROM "EmailVerification" WHERE "expiresAt" < ${cutoff}`
  } catch {}
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  // Odwolana sesja (SESSION_REVOKED z callbacku jwt) to normalny przypadek, nie blad.
  logger: {
    error(code, metadata) {
      const m = metadata as unknown as { message?: string; error?: { message?: string } }
      const msg = metadata instanceof Error ? metadata.message : m?.message ?? m?.error?.message
      if (code === "JWT_SESSION_ERROR" && msg === SESSION_REVOKED) return
      console.error(`[next-auth][error][${code}]`, `\nhttps://next-auth.js.org/errors#${code.toLowerCase()}`, msg, metadata)
    },
  },
  providers: [
    // Custom Google OAuth2 provider — www.googleapis.com/oauth2/v3/certs is blocked on this VPS.
    // We manually exchange the code and strip id_token so openid-client never attempts JWKS fetch.
    {
      id: "google",
      name: "Google",
      type: "oauth",
      // Czysty OAuth2 (NIE OIDC): bez `issuer` i bez scope `openid`, oraz
      // idToken:false — dzieki temu openid-client uzywa oauthCallback() i NIE
      // probuje walidowac id_token przez JWKS (https://www.googleapis.com/oauth2/v3/certs
      // jest zablokowany na tym VPS). Tozsamosc bierzemy z endpointu userinfo.
      idToken: false,
      authorization: {
        url: "https://accounts.google.com/o/oauth2/v2/auth",
        params: { scope: "email profile", response_type: "code" },
      },
      token: {
        url: "https://oauth2.googleapis.com/token",
        async request(context: any) {
          const { params, provider } = context
          const res = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "authorization_code",
              code: params.code,
              // provider.callbackUrl (nie process.env.NEXTAUTH_URL) — musi byc
              // IDENTYCZNY z redirect_uri uzytym w kroku autoryzacji (Google
              // tego wymaga). Dzieki AUTH_TRUST_HOST oba sa liczone z hosta
              // requestu, wiec kalkmate.pl i kalkmate.eu dzialaja poprawnie.
              redirect_uri: provider.callbackUrl,
              client_id: provider.clientId,
              client_secret: provider.clientSecret,
            }),
          })
          const tokens = await res.json()
          delete tokens.id_token  // Strip id_token — www.googleapis.com/oauth2/v3/certs blocked on VPS
          return { tokens }
        },
      },
      userinfo: {
        url: "https://openidconnect.googleapis.com/v1/userinfo",
        async request({ tokens }: any) {
          // Raw fetch — bypasses openid-client's client.userinfo() which calls TokenSet.claims()
          const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          })
          if (!res.ok) throw new Error(`Google userinfo failed: ${res.status}`)
          return res.json()
        },
      },
      profile(profile: Record<string, string>) {
        return {
          id: profile.sub || profile.email,
          name: profile.name || profile.given_name || null,
          email: profile.email,
          image: profile.picture || null,
        }
      },
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    } as any,
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const rawEmail = typeof credentials?.email === "string" ? credentials.email.trim() : ""
        const email = normalizeEmail(rawEmail)
        const password = typeof credentials?.password === "string" ? credentials.password : ""
        if (!email || !password) {
          throw new Error("Email i hasło są wymagane")
        }

        // Limit prob (audyt 2026-10-16: wczesniej brak — brute force hasel).
        const ip = ipFromHeaderRecord(req?.headers as Record<string, unknown> | undefined)
        const rlIp = rateLimit(`login-ip:${ip}`, LOGIN_MAX_PER_IP, LOGIN_WINDOW_MS)
        const rlEmail = rateLimit(`login-email:${email}`, LOGIN_MAX_PER_EMAIL, LOGIN_WINDOW_MS)
        if (!rlIp.ok || !rlEmail.ok) {
          const waitMs = Math.max(rlIp.ok ? 0 : rlIp.resetMs, rlEmail.ok ? 0 : rlEmail.resetMs)
          throw new Error(`Za dużo prób logowania. Spróbuj za ${Math.max(1, Math.ceil(waitMs / 60000))} min.`)
        }

        const select = { id: true, email: true, name: true, password: true, emailVerified: true } as const
        let user = await prisma.user.findUnique({ where: { email }, select })
        // Konta zapisane kiedys z wielkimi literami (np. recznie w panelu admina).
        if (!user && rawEmail !== email) {
          user = await prisma.user.findUnique({ where: { email: rawEmail }, select })
        }

        // Zawsze jedno porownanie bcrypt — brak konta / konto bez hasla nie
        // odpowiada szybciej niz zle haslo (oracle czasowy).
        const isValid = await bcrypt.compare(password.slice(0, PASSWORD_MAX_LENGTH), user?.password || (await dummyHash()))

        if (!user || !user.password || !isValid) {
          throw new Error("Nieprawidłowy email lub hasło")
        }

        if (!user.emailVerified) {
          throw new Error("Email niezweryfikowany. Sprawdź skrzynkę lub poproś o nowy link.")
        }

        return { id: user.id, email: user.email, name: user.name }
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        const p = (profile || {}) as Record<string, unknown>
        // Google musi potwierdzic, ze adres nalezy do tej osoby — inaczej konto
        // Google z niezweryfikowanym adresem przejeloby nasze konto o tym e-mailu.
        if (p.email_verified !== true && p.email_verified !== "true") {
          console.warn("[auth] Google sign-in rejected: email_verified missing/false")
          return false
        }
        const rawEmail = String(user.email || p.email || "").trim()
        const email = rawEmail.toLowerCase()
        if (!EMAIL_RE.test(email)) return false

        let dbUser = await prisma.user.findUnique({ where: { email } })
        if (!dbUser && rawEmail !== email) {
          dbUser = await prisma.user.findUnique({ where: { email: rawEmail } })
        }

        if (!dbUser) {
          dbUser = await prisma.user.create({
            data: {
              email,
              name: (profile as any)?.name || user.name || null,
              image: (profile as any)?.picture || user.image || null,
              emailVerified: new Date(),
            },
          })

          try {
            await prisma.subscription.create({
              data: {
                id: randomUUID(),
                userId: dbUser.id,
                status: "trial",
                trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                trialDays: 30,
                updatedAt: new Date(),
              },
            })
          } catch {}

          try {
            await prisma.$executeRaw`UPDATE "User" SET "tokenBalance" = 1000000 WHERE "id" = ${dbUser.id}`
          } catch {}
        } else if (!dbUser.emailVerified) {
          // Konto z haslem, ktorego wlasciciel adresu NIGDY nie potwierdzil —
          // haslo mogl ustawic ktos obcy (rejestracja na cudzy adres). Google
          // wlasnie potwierdzil wlasciciela adresu, wiec niepotwierdzone haslo
          // kasujemy ZANIM oznaczymy e-mail jako zweryfikowany (audyt 2026-10-16).
          const hadPassword = !!dbUser.password
          dbUser = await prisma.user.update({
            where: { id: dbUser.id },
            data: { emailVerified: new Date(), ...(hadPassword ? { password: null } : {}) },
          })
          if (hadPassword) await bumpSessionVersion(dbUser.id).catch(() => {})
        }

        const existingAccount = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: "google",
              providerAccountId: account.providerAccountId,
            },
          },
        })

        if (!existingAccount) {
          await prisma.account.create({
            data: {
              id: randomUUID(),
              userId: dbUser.id,
              type: account.type || "oauth",
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              access_token: account.access_token,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token,
              expires_at: account.expires_at,
            },
          })
        }

        user.id = dbUser.id
        user.email = dbUser.email
        return true
      }

      return true
    },

    async jwt({ token, user }) {
      if (user) {
        // Logowanie: tozsamosc = id z bazy (nie e-mail) + wersja sesji.
        try {
          const state =
            (user.id ? await loadSessionState({ id: String(user.id) }) : null) ||
            (user.email ? await loadSessionState({ email: user.email }) : null)
          if (state) {
            token.sub = state.id
            token.email = state.email
            token.sv = state.sv
            cacheSet(`id:${state.id}`, state)
            return token
          }
        } catch (e) {
          console.error("[auth] jwt sign-in state lookup failed:", e)
        }
        token.email = user.email
        return token
      }

      // Kazde uzycie sesji: czy nie zostala odwolana (sessionVersion) i jaki
      // jest AKTUALNY e-mail konta (po zmianie adresu token mial stary).
      const legacy = typeof token.sv !== "number"
      if (legacy && !token.email) return token
      const key = legacy ? `e:${token.email}` : `id:${token.sub}`
      let state: SessionState | null = null
      const cached = _svCache.get(key)
      if (cached && Date.now() - cached.at < SV_CACHE_MS) {
        state = cached.state
      } else {
        try {
          state = legacy
            ? await loadSessionState({ email: String(token.email) })
            : await loadSessionState({ id: String(token.sub) })
        } catch (e) {
          // Chwilowy blad bazy nie wylogowuje uzytkownika.
          console.error("[auth] jwt session check failed:", e)
          return token
        }
        if (state) cacheSet(key, state)
      }

      const tokenSv = legacy ? 0 : (token.sv as number)
      if (!state || state.sv !== tokenSv) {
        // NextAuth zlapie wyjatek, wyczysci cookie sesji i zwroci pusta sesje.
        throw new Error(SESSION_REVOKED)
      }
      token.sub = state.id
      token.email = state.email
      token.sv = state.sv
      return token
    },

    async session({ session, token }) {
      if (session.user && token.email) {
        session.user.email = token.email as string
      }
      return session
    },
  },
}
