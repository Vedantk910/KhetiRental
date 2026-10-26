// Fixed-window rate limits in Postgres, so every server instance shares one count (S-02, S-08).
import { getSql } from "./db";
import { ApiError } from "./http";

/** limit per windowSec. */
export const LIMITS = {
  otpSendPhone: [5, 3600],
  otpSendIp: [30, 3600],
  otpVerifyIp: [60, 600],
  passwordAccount: [5, 600],
  passwordIp: [50, 600],
  signupIp: [20, 3600],
  resetEmail: [5, 3600],
  emailChangeUser: [5, 3600],
  emailChangeTarget: [3, 3600],
  emailChangeIp: [20, 3600],
  emailConfirmIp: [30, 600],
  bookingCreate: [5, 3600],
  upload: [60, 3600],
  draftSave: [600, 3600],
  problemReport: [10, 3600],
} as const satisfies Record<string, readonly [number, number]>;

export async function hit(key: string, limit: number, windowSec: number) {
  const [r] = await getSql()<{ count: number; retry: number }[]>`
    INSERT INTO rate_limits AS r (key, window_start, count) VALUES (${key}, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN r.window_start <= now() - make_interval(secs => ${windowSec}) THEN 1 ELSE r.count + 1 END,
      window_start = CASE WHEN r.window_start <= now() - make_interval(secs => ${windowSec}) THEN now() ELSE r.window_start END
    RETURNING count, ceil(extract(epoch FROM window_start + make_interval(secs => ${windowSec}) - now()))::int AS retry`;
  return { ok: r.count <= limit, retryAfterS: Math.max(1, r.retry) };
}

export async function limit(name: keyof typeof LIMITS, subject: string) {
  const [max, windowSec] = LIMITS[name];
  const r = await hit(`${name}:${subject}`, max, windowSec);
  if (!r.ok) throw new ApiError(429, "rate_limited", undefined, { "Retry-After": String(r.retryAfterS) });
}

/** Client address for per-IP limits; behind a proxy the first X-Forwarded-For hop. */
export const clientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 64) ??
  req.headers.get("x-real-ip") ??
  "local";
