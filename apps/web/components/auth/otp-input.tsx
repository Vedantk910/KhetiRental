"use client";

import { useTranslations } from "next-intl";
import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { asciiDigits } from "@/lib/login-input";
import { applyOtpInput, OTP_LENGTH } from "@/lib/otp-input";
import { cn } from "@/lib/utils";

/** Six single-digit boxes (UI-SPEC §4.3): paste fills all, typing advances, backspace steps back. */
export function OtpInput({
  value,
  onChange,
  invalid = false,
  describedBy,
}: {
  value: string;
  onChange: (code: string) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const t = useTranslations("otp");
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focus = (i: number) => {
    refs.current[i]?.focus();
    refs.current[i]?.select();
  };

  const enter = (i: number, raw: string) => {
    const d = asciiDigits(raw);
    // A whole code arriving in one box (SMS autofill) fills from the start; typing over a digit keeps the new one.
    const r = d.length >= OTP_LENGTH ? applyOtpInput(value, 0, d) : applyOtpInput(value, i, d.slice(-1));
    onChange(r.code);
    focus(r.focus);
  };
  const paste = (i: number, e: ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text");
    const r = applyOtpInput(value, asciiDigits(text).length >= OTP_LENGTH ? 0 : i, text);
    onChange(r.code);
    focus(r.focus);
  };
  const key = (i: number, e: KeyboardEvent) => {
    if (e.key === "Backspace" && (value[i] ?? " ") === " " && i > 0) {
      e.preventDefault();
      onChange(applyOtpInput(value, i - 1, "").code);
      focus(i - 1);
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      focus(i - 1);
    } else if (e.key === "ArrowRight" && i < OTP_LENGTH - 1) {
      e.preventDefault();
      focus(i + 1);
    }
  };

  return (
    <div role="group" aria-label={t("group")} className="flex justify-center gap-1 sm:gap-2">
      {Array.from({ length: OTP_LENGTH }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={(value[i] ?? " ").trim()}
          onChange={(e) => {
            enter(i, e.target.value);
          }}
          onPaste={(e) => {
            paste(i, e);
          }}
          onKeyDown={(e) => {
            key(i, e);
          }}
          onFocus={(e) => {
            e.target.select();
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label={t("digit", { n: i + 1 })}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-14 min-w-0 flex-1 rounded-control border-2 border-border-control bg-surface text-center text-[24px] font-bold text-text aria-[invalid=true]:border-danger sm:max-w-[52px]",
          )}
        />
      ))}
    </div>
  );
}
