export const COOKIE_NAME = "admin_session";
export const MAX_AGE = 60 * 60 * 24; // 24 hours

export function validatePassword(password: string): boolean {
  return password === process.env.ADMIN_PASSWORD;
}
