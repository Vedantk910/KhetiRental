import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const LOOK = {
  machine: "border border-border-subtle bg-surface",
  booking: "border border-border-subtle bg-surface",
  request: "border-2 border-[rgb(var(--sarson-400))] bg-surface",
  busy: "bg-surface-muted",
};

export function Card({
  variant = "machine",
  as: Tag = "div",
  className,
  ...rest
}: { variant?: keyof typeof LOOK; as?: "div" | "article" | "section" | "li" } & HTMLAttributes<HTMLElement>) {
  return <Tag className={cn("rounded-card p-4 text-text", LOOK[variant], className)} {...rest} />;
}
