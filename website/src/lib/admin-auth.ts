import { authenticator } from "otplib";

export const COOKIE_NAME = "admin_session";
export const MAX_AGE = 60 * 60 * 24; // 24 hours

export function validateTOTP(token: string): boolean {
  const secret = process.env.ADMIN_2FA_SECRET;
  if (!secret) {
    console.error("ADMIN_2FA_SECRET is not configured");
    return false;
  }
  
  try {
    return authenticator.verify({ token, secret });
  } catch (err) {
    return false;
  }
}
