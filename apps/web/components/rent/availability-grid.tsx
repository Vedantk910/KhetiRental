"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { dayDate, pickDay } from "@/lib/rent";
import { cn } from "@/lib/utils";
import { useChoice } from "./booking-choice";

export type DayState = { date: string; state: "free" | "busy" | "blocked" };

/** 14 day cells: green free, grey booked, yellow your dates (UI-SPEC §4.6). Colour is never the only sign. */
export function AvailabilityGrid({ days }: { days: DayState[] }) {
  const t = useTranslations("detail");
  const locale = useLocale();
  const { range, setRange } = useChoice();
  const [endNext, setEndNext] = useState(false);
  const tag = `${locale}-IN`;
  const state = new Map(days.map((d) => [d.date, d.state]));
  const unavailable = (d: string) => state.get(d) !== "free";
  const num = new Intl.DateTimeFormat(tag, { day: "numeric", timeZone: "Asia/Kolkata" });
  const wd = new Intl.DateTimeFormat(tag, { weekday: "short", timeZone: "Asia/Kolkata" });
  const month = new Intl.DateTimeFormat(tag, { month: "long", timeZone: "Asia/Kolkata" });

  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((d, i) => {
        const mine = d.date >= range.from && d.date <= range.to;
        const when = dayDate(d.date);
        const free = d.state === "free";
        return (
          <button
            key={d.date}
            type="button"
            disabled={!free}
            aria-pressed={free ? mine : undefined}
            onClick={() => {
              const r = pickDay(range, d.date, endNext, unavailable);
              setRange(r.range);
              setEndNext(r.endNext);
            }}
            data-state={mine ? "yours" : d.state}
            className={cn(
              "flex h-tap flex-col items-center justify-center rounded-control leading-tight",
              mine
                ? "border-2 border-selected-border bg-selected text-selected-on"
                : free
                  ? "bg-success-bg text-success"
                  : "cursor-not-allowed bg-border-subtle text-text-subtle line-through",
              i === 0 && "col-start-1",
            )}
          >
            <span className="text-label tabular-nums">{num.format(when)}</span>
            <span className="text-[0.6875rem]">{wd.format(when)}</span>
            {/* The name starts with the visible text, then adds the month and the state. */}
            <span className="sr-only">
              {" "}
              {t(mine ? "dayYours" : free ? "dayFree" : "dayBusy", { date: month.format(when) })}
            </span>
          </button>
        );
      })}
    </div>
  );
}
