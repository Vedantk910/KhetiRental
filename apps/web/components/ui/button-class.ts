// Class names for buttons and button-looking links; plain module so server components can use them.
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
export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "lg", className?: string) {
  return cn(
    "relative inline-flex min-w-tap items-center justify-center gap-2 text-center transition-colors duration-100 active:translate-y-px",
    SIZES[size],
    VARIANTS[variant],
    variant.startsWith("pill") && "min-h-tap text-label",
    className,
  );
}
