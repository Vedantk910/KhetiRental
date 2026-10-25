"use client";

import { Loader2 } from "lucide-react";
import { useId, type ButtonHTMLAttributes, type ComponentProps, type MouseEvent } from "react";
import { Link } from "@/i18n/navigation";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./button-class";
import { cn } from "@/lib/utils";

// Unavailable look (UI-SPEC §5.1): muted fill, subtle text, no hover change.
const UNAVAILABLE =
  "!border-transparent !bg-surface-muted !text-text-subtle cursor-not-allowed active:translate-y-0";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Submitting: spinner, same width, busy, clicks ignored, stays focusable. */
  loading?: boolean;
  /** Why the action is unavailable; shown next to the button. Implies disabled. */
  disabledReason?: string;
};

export function Button({
  variant = "primary",
  size = "lg",
  loading = false,
  disabledReason,
  className,
  children,
  onClick,
  type = "button",
  ...rest
}: Props) {
  const reasonId = useId();
  // aria-disabled, not `disabled`: a disabled button drops keyboard focus to <body>.
  const inert = loading || disabledReason !== undefined;
  const handle = (e: MouseEvent<HTMLButtonElement>) => {
    if (inert) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };
  const button = (
    <button
      {...rest}

      type={type}
      data-variant={variant}
      aria-busy={loading || undefined}
      aria-disabled={inert || undefined}
      aria-describedby={disabledReason ? reasonId : rest["aria-describedby"]}
      onClick={handle}
      className={buttonClass(variant, size, cn(disabledReason !== undefined && UNAVAILABLE, className))}
    >
      <span className={cn("inline-flex items-center gap-2", loading && "opacity-0")}>{children}</span>
      {loading && <Loader2 aria-hidden className="absolute h-6 w-6 animate-spin" />}
    </button>
  );
  if (disabledReason === undefined) return button;
  return (
    <div className="flex flex-col items-start gap-1">
      {button}
      <p id={reasonId} className="text-caption text-text-subtle">
        {disabledReason}
      </p>
    </div>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "lg",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link data-variant={variant} className={buttonClass(variant, size, className)} {...rest} />;
}
