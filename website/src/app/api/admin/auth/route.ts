import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, MAX_AGE, validatePassword } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  if (!validatePassword(password)) {
    return NextResponse.json(
      { error: "Nieprawidłowe hasło" },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, process.env.ADMIN_SESSION_TOKEN!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
