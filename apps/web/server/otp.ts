// Phone OTP (UI-SPEC §4.3): 6 digits, 5-minute expiry, 5 attempts, resend after 30 s, hashed at rest.
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { Role } from "@/lib/domain";
import { getSql, one } from "./db";
import { ApiError, parse } from "./http";
import { mocksMayLog } from "./mocks/flags";
import { phoneLoginAvailable, sendSms, smsIsMock } from "./mocks/sms";
import { limit } from "./rate-limit";
import { authSecret } from "./secret";
import type { SessionUser } from "./session";
import { nameSchema, otpCodeSchema, phoneSchema, signupRolesSchema } from "./validation";

const OTP_TTL_S = 5 * 60;
export const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_S = 30;

const hashCode = (phone: string, code: string) =>
  createHmac("sha256", authSecret()).update(`${phone}:${code}`).digest("hex");

/** `devCode` is only present where the SMS mock may print codes (dev and e2e), never in a real deployment. */
export async function sendOtp(
  rawPhone: string,
  ip: string,
): Promise<{ resendAfterS: number; devCode?: string }> {
  const phone = parse(phoneSchema, rawPhone);
  if (!phoneLoginAvailable()) throw new ApiError(503, "phone_login_unavailable");
  // Limits count every request, before the code is touched: going over can't rotate the code or reset attempts.
  await limit("otpSendIp", ip);
  await limit("otpSendPhone", phone);
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  // The upsert only replaces a code older than 30 s, so resend spam can't reset attempts.
  const rows = await getSql()`
    INSERT INTO otp_codes AS o (phone, code_hash, expires_at, attempts, sent_at)
    VALUES (${phone}, ${hashCode(phone, code)}, now() + make_interval(secs => ${OTP_TTL_S}), 0, now())
    ON CONFLICT (phone) DO UPDATE
      SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0, sent_at = now()
      WHERE o.sent_at <= now() - make_interval(secs => ${OTP_RESEND_S})
    RETURNING phone`;
  if (rows.length === 0)
    throw new ApiError(429, "otp_resend_wait", "phone", { "Retry-After": String(OTP_RESEND_S) });
  await sendSms(phone, `${code} is your KhetiRental code. It expires in 5 minutes. Don't share it.`);
  return { resendAfterS: OTP_RESEND_S, ...(mocksMayLog() && smsIsMock() ? { devCode: code } : {}) };
}

/** Throws otp_wrong (with triesLeft), otp_expired or otp_locked; consumes the code on success. */
export async function verifyOtp(rawPhone: string, rawCode: string): Promise<string> {
  const phone = parse(phoneSchema, rawPhone);
  const code = parse(otpCodeSchema, rawCode);
  const sql = getSql();
  // Atomic increment: parallel guesses each burn one attempt, whichever client sends them.
  const row = one(
    await sql<{ code_hash: string; attempts: number; expired: boolean }[]>`
    UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = ${phone}
    RETURNING code_hash, attempts, expires_at <= now() AS expired`,
  );
  if (!row || row.expired) throw new ApiError(400, "otp_expired", "code");
  if (row.attempts > OTP_MAX_ATTEMPTS) throw new ApiError(429, "otp_locked", "code");
  const ok = timingSafeEqual(Buffer.from(row.code_hash, "hex"), Buffer.from(hashCode(phone, code), "hex"));
  if (ok) {
    await sql`DELETE FROM otp_codes WHERE phone = ${phone}`;
    return phone;
  }
  if (row.attempts === OTP_MAX_ATTEMPTS) throw new ApiError(429, "otp_locked", "code");
  throw new ApiError(400, "otp_wrong", "code", undefined, { triesLeft: OTP_MAX_ATTEMPTS - row.attempts });
}

/** Verifies the code, then logs in the user with that phone or signs them up (name + roles required). */
export async function signInWithOtp(input: {
  phone: string;
  code: string;
  name?: string;
  roles?: Role[];
}): Promise<SessionUser> {
  const phone = await verifyOtp(input.phone, input.code);
  const sql = getSql();
  const existing = one(
    await sql<SessionUser[]>`
    UPDATE users SET phone_verified_at = coalesce(phone_verified_at, now()) WHERE phone = ${phone}
    RETURNING id, name, email, phone, roles`,
  );
  if (existing) return existing;
  const name = parse(nameSchema, input.name);
  const roles = parse(signupRolesSchema, input.roles ?? ["renter"]);
  const [u] = await sql<SessionUser[]>`
    INSERT INTO users (name, phone, phone_verified_at, roles) VALUES (${name}, ${phone}, now(), ${roles})
    ON CONFLICT (phone) DO UPDATE SET phone_verified_at = coalesce(users.phone_verified_at, now())
    RETURNING id, name, email, phone, roles`;
  return u;
}
