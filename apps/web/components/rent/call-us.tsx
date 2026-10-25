import { helplineHref } from "@/lib/contact";
import { cn } from "@/lib/utils";

/** "Call us" as a tel: link to the helpline. */
export function CallUs({ label, className }: { label: string; className?: string }) {
  return (
    <a href={helplineHref()} className={cn("inline-flex min-h-tap min-w-tap items-center", className)}>
      {label}
    </a>
  );
}
