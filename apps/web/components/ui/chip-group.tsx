"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ChipOption = { value: string; label: ReactNode; icon?: ReactNode };

type Common = {
  /** Accessible name of the group. */
  label: string;
  options: ChipOption[];
  variant?: "chip" | "tile";
  className?: string;
};
type Single = Common & { multiple?: false; value: string; onChange: (v: string) => void };
type Multi = Common & { multiple: true; value: string[]; onChange: (v: string[]) => void };

const LOOK = {
  chip: "min-h-tap rounded-pill px-4 text-label",
  tile: "flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-control px-2 py-3 text-label",
};

/** Single select = radiogroup (arrows move focus and selection); multi = toggle buttons (arrows move focus). */
export function ChipGroup(props: Single | Multi) {
  const { label, options, variant = "chip", className } = props;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const isOn = (v: string) => (props.multiple ? props.value.includes(v) : props.value === v);
  const firstOn = options.findIndex((o) => isOn(o.value));
  // The roving tab stop: the selected chip, else the last focused, else the first.
  const focused = useRef(firstOn < 0 ? 0 : firstOn);
  const stop = props.multiple ? Math.min(focused.current, options.length - 1) : firstOn < 0 ? 0 : firstOn;

  const pick = (v: string) => {
    if (props.multiple) props.onChange(isOn(v) ? props.value.filter((x) => x !== v) : [...props.value, v]);
    else props.onChange(v);
  };

  const onKey = (e: KeyboardEvent, i: number) => {
    const n = options.length;
    const next = {
      ArrowRight: i + 1,
      ArrowDown: i + 1,
      ArrowLeft: i - 1,
      ArrowUp: i - 1,
      Home: 0,
      End: n - 1,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const j = (next + n) % n;
    focused.current = j;
    refs.current[j]?.focus();
    if (!props.multiple) props.onChange(options[j].value);
    else refs.current.forEach((el, k) => el?.setAttribute("tabindex", k === j ? "0" : "-1"));
  };

  return (
    <div
      role={props.multiple ? "group" : "radiogroup"}
      aria-label={label}
      className={cn(variant === "tile" ? "grid grid-cols-3 gap-2" : "flex flex-wrap gap-2", className)}
    >
      {options.map((o, i) => {
        const on = isOn(o.value);
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role={props.multiple ? undefined : "radio"}
            aria-checked={props.multiple ? undefined : on}
            aria-pressed={props.multiple ? on : undefined}
            tabIndex={i === stop ? 0 : -1}
            onClick={() => {
              focused.current = i;
              pick(o.value);
            }}
            onFocus={() => {
              focused.current = i;
            }}
            onKeyDown={(e) => {
              onKey(e, i);
            }}
            className={cn(
              "min-w-tap border-2 text-text transition-colors duration-[120ms]",
              LOOK[variant],
              on
                ? "border-action bg-selected text-selected-on"
                : "border-chip bg-surface hover:bg-surface-muted",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
