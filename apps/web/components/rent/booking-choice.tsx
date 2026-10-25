"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Slot } from "@/lib/domain";
import type { Range } from "@/lib/rent";

interface Choice {
  range: Range;
  slot: Slot;
  setRange: (r: Range) => void;
  setSlot: (s: Slot) => void;
  /** The booking page URL (step 1) for the current choice. */
  bookHref: string;
}
const Ctx = createContext<Choice | null>(null);

export function useChoice() {
  const c = useContext(Ctx);
  if (!c) throw new Error("BookingChoice is missing");
  return c;
}

/** The dates and slot a renter is looking at; every change also rewrites the URL (F-37) without a reload. */
export function BookingChoice({
  machineId,
  baseQs,
  initial,
  children,
}: {
  machineId: string;
  /** The rest of the search (place, job, acres …), carried to the booking page. */
  baseQs: string;
  initial: { range: Range; slot: Slot };
  children: ReactNode;
}) {
  const [range, setRangeState] = useState(initial.range);
  const [slot, setSlotState] = useState(initial.slot);

  const sync = (r: Range, s: Slot) => {
    const u = new URL(window.location.href);
    u.searchParams.set("from", r.from);
    u.searchParams.set("to", r.to);
    u.searchParams.set("slot", s);
    window.history.replaceState(window.history.state, "", u);
  };
  const setRange = useCallback(
    (r: Range) => {
      setRangeState(r);
      sync(r, slot);
    },
    [slot],
  );
  const setSlot = useCallback(
    (s: Slot) => {
      setSlotState(s);
      sync(range, s);
    },
    [range],
  );

  const value = useMemo(() => {
    const q = new URLSearchParams(baseQs);
    q.set("from", range.from);
    q.set("to", range.to);
    q.set("slot", slot);
    q.set("step", "1");
    return { range, slot, setRange, setSlot, bookHref: `/rent/m/${machineId}/book?${q.toString()}` };
  }, [range, slot, setRange, setSlot, baseQs, machineId]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
