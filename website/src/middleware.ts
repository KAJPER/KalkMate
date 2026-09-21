import { withAuth } from "next-auth/middleware";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCookie } from "@/lib/admin-session";

// Middleware (Edge runtime — bez Prisma/node:crypto). Dla /admin i /api/admin
// sprawdza PODPIS i DATE WYGASNIECIA cookie sesji admina (WebCrypto HMAC).
// Odwolanie sesji (wylogowanie z innego urzadzenia) sprawdzaja dodatkowo
// route'y przez requireAdminAuth() w bazie — patrz lib/admin-auth.ts.
// Panel admina ma dzialac WYLACZNIE na kalkmate.pl — kalkmate.eu serwuje ten
// sam kod (wspolny backend/baza), wiec bez tego /admin bylby tak samo
// dostepny pod .eu. Przekierowanie (nie 404), zeby link do konkretnego
// zamowienia/strony admina zawsze dowiozl tam gdzie trzeba, niezaleznie z
// ktorej domeny ktos go otworzyl.
const ADMIN_HOSTS = new Set(["kalkmate.pl", "www.kalkmate.pl", "localhost:3000", "127.0.0.1:3000"]);

export default withAuth(
  async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const isAdminPage = pathname.startsWith("/admin") && !pathname.startsWith("/admin/login");
    const isAdminApi =
      pathname.startsWith("/api/admin") &&
      !pathname.startsWith("/api/admin/auth") &&
      !pathname.startsWith("/api/admin/visits");
    // /api/track jest całkowicie publiczne — poza tym blokiem

    if ((pathname.startsWith("/admin") || isAdminApi) && !ADMIN_HOSTS.has(request.headers.get("host") || "")) {
      const target = new URL(request.nextUrl.pathname + request.nextUrl.search, "https://kalkmate.pl");
      return NextResponse.redirect(target);
    }

    if (isAdminPage || isAdminApi) {
      const session = await verifyAdminCookie(
        request.cookies.get("admin_session")?.value,
        process.env.ADMIN_SESSION_TOKEN
      );
      if (!session) {
        if (isAdminPage) {
          return NextResponse.redirect(new URL("/admin/login", request.url));
        }
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        const { pathname } = req.nextUrl;

        // Admin routes use separate auth
        if (pathname.startsWith("/admin")) {
          return true;
        }

        // /panel requires NextAuth session
        if (pathname.startsWith("/panel")) {
          return !!token;
        }

        return true;
      },
    },
    pages: {
      signIn: "/auth/signin",
    },
  }
);

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/panel/:path*"],
  // Note: /api/webhooks/stripe is NOT matched here - it's public for Stripe
};
