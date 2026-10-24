import { asciiDigits } from "./login-input";

export const OTP_LENGTH = 6;

/** Typing or pasting `typed` into box `index`: the new code and the box to focus next. */
export function applyOtpInput(code: string, index: number, typed: string): { code: string; focus: number } {
  const digits = asciiDigits(typed);
  const cells = Array.from({ length: OTP_LENGTH }, (_, i) => code[i] ?? " ");
  if (digits === "") {
    cells[index] = " ";
    return { code: cells.join("").trimEnd(), focus: index };
  }
  let i = index;
  for (const d of digits) {
    if (i >= OTP_LENGTH) break;
    cells[i++] = d;
  }
  return { code: cells.join("").trimEnd(), focus: Math.min(i, OTP_LENGTH - 1) };
}

/** `m:ss` for the resend countdown. */
export const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
