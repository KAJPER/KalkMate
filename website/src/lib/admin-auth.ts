import * as OTPAuth from "otpauth";
import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const COOKIE_NAME = "admin_session";
export const MAX_AGE = 60 * 60 * 24; // 24 hours

// Defense-in-depth: każdy admin route wywołuje to jako pierwszą linię,
// niezależnie od middleware. Chroni gdy middleware jest wyłączony/ominięty.
export function requireAdminAuth(request: NextRequest): NextResponse | null {
  const expected = process.env.ADMIN_SESSION_TOKEN;
  const value = request.cookies.get(COOKIE_NAME)?.value;
  if (!expected || !value) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null; // OK
}

export function validateTOTP(token: string): boolean {
  const secret = process.env.ADMIN_2FA_SECRET;
  if (!secret) {
    console.error("ADMIN_2FA_SECRET is not configured");
    return false;
  }
  
  try {
    let totp = new OTPAuth.TOTP({
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    
    const delta = totp.validate({ token, window: 1 });
    return delta !== null;
  } catch (err) {
    console.error("TOTP validation error", err);
    return false;
  }
}

