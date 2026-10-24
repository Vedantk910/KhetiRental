// Pure helpers for the login forms: what farmers type → what the API wants (UI-SPEC §4.2).
const DEVA_ZERO = 0x0966;

/** Devanagari digits → ASCII, everything else that is not a digit dropped. */
export const asciiDigits = (s: string) =>
  s.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - DEVA_ZERO)).replace(/\D/g, "");

/** Up to 10 national digits from whatever was typed or pasted (+91, 0 and spaces are dropped). */
export function mobileDigits(s: string): string {
  let d = asciiDigits(s);
  if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
  else if (d.length > 10 && d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 10);
}

/** "98765 43210" */
export const groupMobile = (d: string) => (d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d);

export const isValidMobile = (d: string) => /^[6-9]\d{9}$/.test(d);

export type Field = "name" | "mobile" | "email" | "password";
export type ErrorKey = "mobile" | "name" | "email" | "passwordShort";
export type Errors = Partial<Record<Field, ErrorKey>>;

export interface LoginValues {
  mode: "login" | "signup";
  method: "mobile" | "email";
  name: string;
  mobile: string;
  email: string;
  password: string;
}

export const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim()) && s.length <= 254;
export const passwordStrength = (pw: string): "short" | "ok" | "strong" =>
  pw.length < 8 ? "short" : pw.length >= 12 && /\d/.test(pw) && /\D/.test(pw) ? "strong" : "ok";

export function validateLogin(v: LoginValues): Errors {
  const e: Errors = {};
  const name = v.name.trim();
  if (v.mode === "signup" && (name.length < 2 || name.length > 80)) e.name = "name";
  if (v.method === "mobile") {
    if (!isValidMobile(mobileDigits(v.mobile))) e.mobile = "mobile";
  } else {
    if (!isValidEmail(v.email)) e.email = "email";
    // Logging in never reveals the length rule: a short password is just a wrong one.
    if (v.mode === "signup" ? v.password.length < 8 : v.password.length === 0) e.password = "passwordShort";
  }
  return e;
}

/** "+91 98765 43210" */
export const displayPhone = (e164: string) => {
  const d = e164.replace(/^\+91/, "");
  return `+91 ${groupMobile(d)}`;
};
