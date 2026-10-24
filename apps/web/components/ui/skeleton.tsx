import { cn } from "@/lib/utils";

/** A placeholder block; shimmers only when motion is allowed (globals.css .kr-shimmer). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("kr-shimmer rounded-control bg-surface-muted", className)} />;
}
