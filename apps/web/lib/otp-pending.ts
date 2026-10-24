// The code request that /login/otp is waiting on. Lives in sessionStorage so a language switch or reload keeps it.
export interface PendingOtp {
  /** +91XXXXXXXXXX */
  phone: string;
  mode: "login" | "signup";
  name?: string;
  roles?: ("renter" | "owner")[];
  /** Date.now() of the last send, for the resend countdown. */
  sentAt: number;
}

const KEY = "kr:otp-pending";

export function readPending(): PendingOtp | null {
  try {
    const p = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as PendingOtp | null;
    return p && /^\+91[6-9]\d{9}$/.test(p.phone) ? p : null;
  } catch {
    return null;
  }
}

export function writePending(p: PendingOtp | null) {
  try {
    if (p) sessionStorage.setItem(KEY, JSON.stringify(p));
    else sessionStorage.removeItem(KEY);
  } catch {
    // storage blocked: the OTP page will send the person back to /login
  }
}

/** Whole seconds until a new code may be requested (30 s after the last send). */
export const resendLeft = (sentAt: number, now: number, waitS = 30) =>
  Math.max(0, Math.ceil((sentAt + waitS * 1000 - now) / 1000));
