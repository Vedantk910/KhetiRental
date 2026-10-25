// Maps what the sign-in and OTP APIs say to the message we show (UI-SPEC §4.2–§4.3). Pure, so it is unit-tested.
export type AuthMessage =
  | {
      key:
        | "login.err.creds"
        | "login.err.google"
        | "login.err.rate"
        | "otp.expired"
        | "errors.api.otp_locked"
        | "errors.api.invalid_request"
        | "errors.network"
        | "errors.api.otp_resend_wait"
        | "errors.api.phone_login_unavailable"
        | "otp.noAccount";
    }
  | { key: "otp.wrong"; n: number };

/** `code` is what Auth.js puts in the sign-in result (`otp_wrong_3`, `rate_limited`, `credentials`…). */
export function messageForSignIn(
  code: string | null | undefined,
  mode: "login" | "signup" = "login",
): AuthMessage {
  const wrong = /^otp_wrong_(\d+)$/.exec(code ?? "");
  if (wrong) return { key: "otp.wrong", n: Number(wrong[1]) };
  switch (code) {
    case "rate_limited":
      return { key: "login.err.rate" };
    case "otp_expired":
      return { key: "otp.expired" };
    case "otp_locked":
      return { key: "errors.api.otp_locked" };
    case "invalid_request":
      // Only a new number reaches here with no name: logging in with a number that has no account.
      return mode === "login" ? { key: "otp.noAccount" } : { key: "errors.api.invalid_request" };
    default:
      return { key: "login.err.creds" };
  }
}

/** Error codes of our own JSON API (`{ code }`). */
export function messageForApi(code: string | undefined): AuthMessage {
  switch (code) {
    case "rate_limited":
      return { key: "login.err.rate" };
    case "otp_resend_wait":
      return { key: "errors.api.otp_resend_wait" };
    case "invalid_request":
      return { key: "errors.api.invalid_request" };
    case "phone_login_unavailable":
      return { key: "errors.api.phone_login_unavailable" };
    default:
      return { key: "errors.network" };
  }
}
