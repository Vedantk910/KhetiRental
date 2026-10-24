/** AUTH_SECRET keys the OTP and reset-token hashes. Required in production. */
export function authSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is not set");
  return "dev-only-secret-not-for-production";
}
