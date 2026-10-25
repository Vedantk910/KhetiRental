"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { dayDate, fmtDays, monthGrid, pickDay, shiftMonth, type Range } from "@/lib/rent";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  value: Range | null;
  onApply: (r: Range) => void;
  /** Earliest day that can be picked (today). */
  minDay: string;
  /** Days nobody can pick, e.g. this machine's booked days. */
  unavailable?: (day: string) => boolean;
  /** Last month that can be shown (YYYY-MM). */
  maxMonth?: string;
};

const nav =
  "flex h-tap w-tap items-center justify-center rounded-pill border-2 border-chip text-text hover:bg-surface-muted aria-disabled:text-text-subtle aria-disabled:opacity-50";

/** Month calendar with 48 px day cells; first tap sets the start, second the end (UI-SPEC §4.4). */
export function DateRangeSheet({ open, onClose, value, onApply, minDay, unavailable, maxMonth }: Props) {
  const t = useTranslations("search");
  const locale = useLocale();
  const [draft, setDraft] = useState<Range | null>(value);
  const [endNext, setEndNext] = useState(false);
  const [month, setMonth] = useState((value?.from ?? minDay).slice(0, 7));
  const tag = `${locale}-IN`;
  const monthLabel = new Intl.DateTimeFormat(tag, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(tag, { weekday: "narrow", timeZone: "UTC" }).format(
      new Date(Date.UTC(2026, 10, 1 + i)),
    ),
  );
  const dayLabel = (d: string) =>
    new Intl.DateTimeFormat(tag, {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "Asia/Kolkata",
    }).format(dayDate(d));
  const off = (d: string) => d < minDay || Boolean(unavailable?.(d));
  const atMin = month <= minDay.slice(0, 7);
  const atMax = maxMonth !== undefined && month >= maxMonth;

  const tap = (d: string) => {
    const r = pickDay(draft, d, endNext, off);
    setDraft(r.range);
    setEndNext(r.endNext);
  };

  return (
    <Sheet open={open} onClose={onClose} title={t("datesTitle")}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label={t("prevMonth")}
            aria-disabled={atMin || undefined}
            className={nav}
            onClick={() => {
              if (!atMin) setMonth(shiftMonth(month, -1));
            }}
          >
            <ChevronLeft aria-hidden className="h-6 w-6" />
          </button>
          <p aria-live="polite" className="text-h4">
            {monthLabel}
          </p>
          <button
            type="button"
            aria-label={t("nextMonth")}
            aria-disabled={atMax || undefined}
            className={nav}
            onClick={() => {
              if (!atMax) setMonth(shiftMonth(month, 1));
            }}
          >
            <ChevronRight aria-hidden className="h-6 w-6" />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-caption font-bold text-text-subtle" aria-hidden>
          {weekdays.map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {monthGrid(month).map((d, i) => {
            if (!d) return <span key={`pad${i}`} />;
            const isEnd = d === draft?.from || d === draft?.to;
            const inside = draft !== null && d > draft.from && d < draft.to;
            return (
              <button
                key={d}
                type="button"
                disabled={off(d)}
                aria-label={dayLabel(d)}
                aria-pressed={isEnd || inside}
                onClick={() => {
                  tap(d);
                }}
                className={cn(
                  "h-tap text-label tabular-nums disabled:cursor-not-allowed disabled:text-text-subtle disabled:line-through disabled:opacity-60",
                  isEnd
                    ? "rounded-control border-2 border-selected-border bg-selected text-selected-on"
                    : inside
                      ? "bg-selected/30 text-text"
                      : "rounded-control text-text hover:bg-surface-muted",
                )}
              >
                {Number(d.slice(8))}
              </button>
            );
          })}
        </div>
        {draft && <p className="text-small text-text-muted">{fmtDays(draft.from, draft.to, locale)}</p>}
        <Button
          disabled={!draft}
          onClick={() => {
            if (draft) onApply(draft);
          }}
        >
          {t("done")}
        </Button>
      </div>
    </Sheet>
  );
}
