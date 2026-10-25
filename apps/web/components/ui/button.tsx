"use client";

import { Loader2 } from "lucide-react";
import { useId, type ButtonHTMLAttributes, type ComponentProps, type MouseEvent } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline-dark"
  | "danger-outline"
  | "ghost"
  | "pill-primary"
  | "pill-accent"
  | "pill-light";
export type ButtonSize = "lg" | "md";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "rounded-control bg-action text-action-on hover:bg-action-hover active:bg-action-pressed",
  secondary: "rounded-control border-2 border-border-control bg-surface text-text hover:bg-surface-muted",
  "outline-dark": "rounded-control border-2 border-text bg-transparent text-text hover:bg-surface-muted",
  "danger-outline": "rounded-control border-2 border-danger bg-surface text-danger hover:bg-danger-bg",
  ghost: "rounded-control text-link underline-offset-4 hover:underline",
  "pill-primary": "rounded-pill bg-action px-4 text-action-on hover:bg-action-hover sm:px-6",
  "pill-accent": "rounded-pill bg-[rgb(var(--sarson-300))] px-4 text-[rgb(var(--n-950))] sm:px-6",
  "pill-light": "rounded-pill bg-white/90 px-4 text-[rgb(var(--n-950))] sm:px-6",
};
const SIZES: Record<ButtonSize, string> = {
  lg: "min-h-tap-lg px-6 text-body font-bold md:min-h-[52px]",
  md: "min-h-tap px-4 text-label",
};
// Unavailable look (UI-SPEC §5.1): muted fill, subtle text, no hover change.
const UNAVAILABLE =
  "!border-transparent !bg-surface-muted !text-text-subtle cursor-not-allowed active:translate-y-0";

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "lg", className?: string) {
  return cn(
    "relative inline-flex min-w-tap items-center justify-center gap-2 text-center transition-colors duration-100 active:translate-y-px",
    SIZES[size],
    VARIANTS[variant],
    variant.startsWith("pill") && "min-h-tap text-label",
    className,
  );
}

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
