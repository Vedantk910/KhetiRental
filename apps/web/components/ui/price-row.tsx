import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PriceRow({
  label,
  value,
  total = false,
}: {
  label: ReactNode;
  value: ReactNode;
  total?: boolean;
}) {
  return (
    <div
      data-total={total || undefined}
      className={cn(
        "flex items-baseline justify-between gap-4 text-body",
        total && "mt-2 border-t-2 border-text pt-[10px] text-[1.375rem] font-bold leading-8",
      )}
    >
      <span>{label}</span>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  );
}
