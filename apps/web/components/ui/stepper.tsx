"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { toAsciiNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  /** Accessible name of the value. */
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  decLabel: string;
  incLabel: string;
  className?: string;
};

const HOLD_MS = 400;
const REPEAT_MS = 100;
const btn =
  "flex h-tap w-tap shrink-0 items-center justify-center rounded-control border-2 border-border-control bg-surface text-text hover:bg-surface-muted aria-disabled:cursor-not-allowed aria-disabled:bg-surface-muted aria-disabled:text-text-subtle";

export function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  decLabel,
  incLabel,
  className,
}: Props) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n / step) * step));
  const [draft, setDraft] = useState<string | null>(null);
  const live = useRef(value);
  live.current = value;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const stopRepeat = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
  };
  useEffect(() => stopRepeat, []);

  const bump = (dir: 1 | -1) => {
    const next = clamp(live.current + dir * step);
    if (next === live.current) return false;
    live.current = next;
    onChange(next);
    return true;
  };

  const press = (dir: 1 | -1) => ({
    onPointerDown: (e: { button: number }) => {
      if (e.button !== 0) return;
      stopRepeat();
      if (!bump(dir)) return;
      const repeat = () => {
        timer.current = bump(dir) ? setTimeout(repeat, REPEAT_MS) : undefined;
      };
      timer.current = setTimeout(repeat, HOLD_MS);
    },
    onPointerUp: stopRepeat,
    onPointerLeave: stopRepeat,
    onPointerCancel: stopRepeat,
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault(); // long-press on Android opens a menu otherwise
    },
    // Pointer presses step on pointerdown; detail 0 means keyboard (Enter/Space).
    onClick: (e: MouseEvent) => {
      if (e.detail === 0) bump(dir);
    },
  });

  const commit = () => {
    if (draft === null) return;
    const n = toAsciiNumber(draft);
    if (!Number.isNaN(n) && clamp(n) !== value) onChange(clamp(n));
    setDraft(null);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button
        type="button"
        aria-label={decLabel}
        aria-disabled={value <= min || undefined}
        className={btn}
        {...press(-1)}
      >
        <Minus aria-hidden className="h-6 w-6" />
      </button>
      <input
        role="spinbutton"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        inputMode="decimal"
        autoComplete="off"
        value={draft ?? String(value)}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            setDraft(null);
            bump(e.key === "ArrowUp" ? 1 : -1);
          }
        }}
        className="h-tap w-[76px] min-w-[76px] rounded-control border-2 border-transparent bg-transparent text-center text-body font-bold tabular-nums text-text hover:border-border-control"
      />
      <button
        type="button"
        aria-label={incLabel}
        aria-disabled={value >= max || undefined}
        className={btn}
        {...press(1)}
      >
        <Plus aria-hidden className="h-6 w-6" />
      </button>
    </div>
  );
}
