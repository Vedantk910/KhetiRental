"use client";

import { useLocale } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { COUNTER_MS, COUNTER_VISIBLE } from "@/config/welcome";
import { formatCount, progressAt } from "@/lib/counter";

export interface CounterItem {
  value: number;
  decimals: number;
  suffix: string;
  label: string;
  /** The final sentence for screen readers. */
  sr: string;
}

/**
 * Three numbers that count up once, when 35 % of the row is on screen (UI-SPEC §4.1.3). One rAF loop drives one
 * progress value. Reduced motion or no IntersectionObserver: final values straight away.
 */
export function Counters({
  items,
  label,
  source,
}: {
  items: CounterItem[];
  label: string;
  source: ReactNode;
}) {
  const locale = useLocale();
  const [p, setP] = useState(0);
  const row = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    if (
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof IntersectionObserver === "undefined"
    ) {
      setP(1);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const t0 = performance.now();
        const tick = (now: number) => {
          const x = progressAt(now - t0, COUNTER_MS);
          setP(x);
          if (x < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: COUNTER_VISIBLE },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section aria-label={label} className="mx-auto w-full max-w-[720px] px-4 text-[#13100D]">
      <ul className="sr-only">
        {items.map((c) => (
          <li key={c.label}>{c.sr}</li>
        ))}
      </ul>
      <div ref={row} aria-hidden="true" className="grid grid-cols-3 gap-2 text-center">
        {items.map((c) => (
          <div key={c.label}>
            <div className="font-display text-[34px] font-bold tabular-nums leading-[40px] sm:text-[44px] sm:leading-[52px] lg:text-[56px] lg:leading-[60px]">
              {formatCount(c.value, p, c.decimals, c.suffix, locale)}
            </div>
            <div className="text-[14px] font-bold leading-[18px]">{c.label}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-[13px] leading-[18px] text-[#332C26]">{source}</p>
    </section>
  );
}
