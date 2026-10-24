import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant = "free" | "busy" | "waiting" | "confirmed" | "info" | "neutral" | "sample";

const LOOK: Record<BadgeVariant, string> = {
  free: "bg-success-bg text-success",
  busy: "bg-surface-muted text-text-subtle",
  waiting: "bg-warning-bg text-warning",
  confirmed: "bg-success-bg text-success",
  info: "bg-info-bg text-info",
  neutral: "bg-surface-muted text-text",
  sample: "bg-warning-bg text-warning",
};

/** Non-interactive status pill (UI-SPEC §5.9). `sample` defaults to "Sample" in the current language. */
export function Badge({
  variant,
  children,
  className,
}: {
  variant: BadgeVariant;
  children?: ReactNode;
  className?: string;
}) {
  const t = useTranslations("common");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-[10px] py-1 text-caption font-bold",
        LOOK[variant],
        className,
      )}
    >
      {children ?? (variant === "sample" ? t("sample") : null)}
    </span>
  );
}
