import * as OTPAuth from "otpauth";

export const COOKIE_NAME = "admin_session";
export const MAX_AGE = 60 * 60 * 24; // 24 hours

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

