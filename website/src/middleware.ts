import { withAuth } from "next-auth/middleware";
import { NextRequest, NextResponse } from "next/server";

export default withAuth(
  function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Protect /admin pages (except login)
    if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
      const session = request.cookies.get("admin_session");
      if (!session || session.value !== process.env.ADMIN_SESSION_TOKEN) {
        return NextResponse.redirect(new URL("/admin/login", request.url));
      }
    }

    // Protect admin API routes (except auth and visits POST)
    if (
      pathname.startsWith("/api/admin") &&
      !pathname.startsWith("/api/admin/auth") &&
      !pathname.startsWith("/api/admin/visits")
    ) {
      const session = request.cookies.get("admin_session");
      if (!session || session.value !== process.env.ADMIN_SESSION_TOKEN) {
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
