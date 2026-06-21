import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./db"
import bcrypt from "bcryptjs"
import { randomUUID } from "crypto"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: "jwt" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
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

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  events: {
    async createUser({ user }) {
      // Fires only for OAuth-created users (Google etc.) — not for CredentialsProvider
      if (!user.id) return
      try {
        await prisma.subscription.create({
          data: {
            id: randomUUID(),
            userId: user.id,
            status: "trial",
            trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            trialDays: 30,
            updatedAt: new Date(),
          },
        })
      } catch {}
      try {
        await prisma.$executeRaw`UPDATE "User" SET "tokenBalance" = 1000000 WHERE "id" = ${user.id}`
      } catch {}
    },
  },
  callbacks: {
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
