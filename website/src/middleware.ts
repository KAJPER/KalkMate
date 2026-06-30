import { withAuth } from "next-auth/middleware";
import { NextRequest, NextResponse } from "next/server";

// Edge-runtime safe constant-time string comparison (no Node.js crypto)
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function isValidAdminSession(value: string | undefined): boolean {
  const expected = process.env.ADMIN_SESSION_TOKEN;
  if (!expected || !value) return false;
  return timingSafeCompare(value, expected);
}

export default withAuth(
  function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Protect /admin pages (except login)
    if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
      const session = request.cookies.get("admin_session");
      if (!session || !isValidAdminSession(session?.value)) {
        return NextResponse.redirect(new URL("/admin/login", request.url));
      }
    }

    // Protect admin API routes (except auth and visits POST)
    if (
      pathname.startsWith("/api/admin") &&
      !pathname.startsWith("/api/admin/auth") &&
      !pathname.startsWith("/api/admin/visits")
      // /api/track jest całkowicie publiczne — obsługiwane poza tym blokiem
    ) {
      const session = request.cookies.get("admin_session");
      if (!session || !isValidAdminSession(session?.value)) {
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
