import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./db"
import bcrypt from "bcryptjs"
import { randomUUID } from "crypto"

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    // Custom Google OAuth2 provider — www.googleapis.com/oauth2/v3/certs is blocked on this VPS.
    // We manually exchange the code and strip id_token so openid-client never attempts JWKS fetch.
    {
      id: "google",
      name: "Google",
      type: "oauth",
      issuer: "https://accounts.google.com",
      authorization: {
        url: "https://accounts.google.com/o/oauth2/v2/auth",
        params: { scope: "email profile openid", response_type: "code" },
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
              redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/callback/google`,
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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email i hasło są wymagane")
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            email: true,
            name: true,
            password: true,
            emailVerified: true,
          },
        })

        if (!user || !user.password) {
          throw new Error("Nieprawidłowy email lub hasło")
        }

        const isValid = await bcrypt.compare(credentials.password, user.password)

        if (!isValid) {
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
        const email = user.email!

        let dbUser = await prisma.user.findUnique({ where: { email } })

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
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { emailVerified: new Date() },
          })
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
        token.email = user.email
      }
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
