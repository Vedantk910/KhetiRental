"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { dayDate, monthGrid, shiftMonth } from "@/lib/rent";
import { cn } from "@/lib/utils";

export type CellState = "free" | "busy" | "blocked" | "past";

const LOOK: Record<CellState, string> = {
  busy: "bg-action text-action-on",
  free: "bg-success-bg text-success",
  blocked: "bg-chip text-text",
  past: "bg-surface-muted text-text-subtle",
};

/** A month of 48 px day buttons with ‹ › arrows (UI-SPEC §4.12). Colour is never the only sign: states have names. */
export function MonthGrid({
  month,
  onMonth,
  state,
  onPick,
  canPrev = true,
  canNext = true,
  title,
}: {
  month: string;
  onMonth: (m: string) => void;
  state: (date: string) => CellState;
  onPick: (date: string, s: CellState) => void;
  canPrev?: boolean;
  canNext?: boolean;
  title?: string;
}) {
  const t = useTranslations("owner");
  const locale = useLocale();
  const tag = `${locale}-IN`;
  const monthName = new Intl.DateTimeFormat(tag, {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const num = new Intl.DateTimeFormat(tag, { day: "numeric", timeZone: "Asia/Kolkata" });
  const full = new Intl.DateTimeFormat(tag, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  });
  const wd = new Intl.DateTimeFormat(tag, { weekday: "narrow", timeZone: "Asia/Kolkata" });
  const heads = Array.from({ length: 7 }, (_, i) =>
    wd.format(dayDate(`2031-11-${String(2 + i).padStart(2, "0")}`)),
  );
  const arrow =
    "flex h-tap w-tap items-center justify-center rounded-pill border-2 border-chip text-text hover:bg-surface-muted aria-disabled:text-text-subtle";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-h2">{title ?? monthName.format(dayDate(`${month}-15`))}</h2>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label={t("prevMonth")}
            aria-disabled={!canPrev || undefined}
            className={arrow}
            onClick={() => {
              if (canPrev) onMonth(shiftMonth(month, -1));
            }}
          >
            <ChevronLeft aria-hidden className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label={t("nextMonth")}
            aria-disabled={!canNext || undefined}
            className={arrow}
            onClick={() => {
              if (canNext) onMonth(shiftMonth(month, 1));
            }}
          >
            <ChevronRight aria-hidden className="h-6 w-6" />
          </button>
        </div>
      </div>
      <div aria-hidden className="grid grid-cols-7 gap-1 text-center text-caption text-text-subtle">
        {heads.map((h, i) => (
          <span key={i}>{h}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {monthGrid(month).map((d, i) => {
          if (!d) return <span key={`pad${i}`} />;
          const s = state(d);
          const label = full.format(dayDate(d));
          return (
            <button
              key={d}
              type="button"
              data-date={d}
              data-state={s}
              aria-disabled={s === "past" || undefined}
              aria-label={t(
                s === "busy"
                  ? "dayBooked"
                  : s === "blocked"
                    ? "dayBlocked"
                    : s === "past"
                      ? "dayPast"
                      : "dayFree",
                { date: label },
              )}
              onClick={() => {
                if (s !== "past") onPick(d, s);
              }}
              className={cn(
                "flex h-tap items-center justify-center rounded-control text-label tabular-nums",
                LOOK[s],
                s === "past" && "cursor-not-allowed",
                s === "blocked" && "line-through",
              )}
            >
              {num.format(dayDate(d))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
