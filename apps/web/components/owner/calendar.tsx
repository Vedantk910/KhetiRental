"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { shiftMonth } from "@/lib/rent";
import { UserError, userMessage } from "@/lib/user-error";
import { MonthGrid } from "./month-grid";

export interface CalDay {
  date: string;
  state: "free" | "busy" | "blocked";
  code: string | null;
}

/** The day-blocking calendar: tap a free day to block it, a blocked day to unblock it, a booked day to open it. */
export function OwnerCalendar({
  machines,
  today,
  initialDays,
}: {
  machines: { id: string; name: string }[];
  today: string;
  initialDays: CalDay[];
}) {
  const t = useTranslations("owner");
  const te = useTranslations("errors.api");
  const toast = useToast();
  const router = useRouter();
  const [machine, setMachine] = useState(machines[0].id);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [days, setDays] = useState(new Map(initialDays.map((d) => [d.date, d])));
  const first = useRef(true);

  const load = useCallback(async (id: string, m: string) => {
    const r = await fetch(`/api/owner/machines/${id}/calendar?month=${m}`);
    if (!r.ok) return;
    const j = (await r.json()) as { days: CalDay[] };
    setDays(new Map(j.days.map((d) => [d.date, d])));
  }, []);

  useEffect(() => {
    // The server already rendered the first month of the first machine.
    if (first.current) {
      first.current = false;
      return;
    }
    void load(machine, month);
  }, [machine, month, load]);

  const toggle = async (date: string, blocked: boolean) => {
    const was = days.get(date);
    setDays((m) => new Map(m).set(date, { date, state: blocked ? "blocked" : "free", code: null }));
    try {
      const r = await fetch(`/api/owner/machines/${machine}/blocks`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ days: [date], blocked }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { code?: string };
        throw new UserError(j.code === "day_booked" ? te("day_booked") : t("blockFailed"));
      }
    } catch (e) {
      if (was) setDays((m) => new Map(m).set(date, was));
      toast({ tone: "error", message: userMessage(e, t("blockFailed")) });
      void load(machine, month);
    }
  };

  return (
    <section aria-labelledby="cal-h" className="flex flex-col gap-3">
      <p id="cal-h" className="sr-only">
        {t("calendarFor")}
      </p>
      {machines.length > 1 && (
        <Select
          label={t("machineSelect")}
          value={machine}
          onChange={(e) => {
            setMachine(e.target.value);
          }}
        >
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      )}
      <MonthGrid
        month={month}
        onMonth={setMonth}
        canPrev={month > today.slice(0, 7)}
        canNext={month < shiftMonth(today.slice(0, 7), 12)}
        state={(d) => (d < today ? "past" : (days.get(d)?.state ?? "free"))}
        onPick={(d, s) => {
          if (s === "busy") {
            const code = days.get(d)?.code;
            if (code) router.push(`/owner/requests/${code}`);
          } else void toggle(d, s === "free");
        }}
      />
      <p className="text-caption text-text-muted">{t("blockHint")}</p>
      <ul className="flex flex-wrap gap-4 text-caption text-text-muted">
        <li>
          <span aria-hidden className="mr-1 inline-block h-3 w-3 rounded-[2px] bg-action" />
          {t("legendBooked")}
        </li>
        <li>
          <span aria-hidden className="mr-1 inline-block h-3 w-3 rounded-[2px] bg-success" />
          {t("legendFree")}
        </li>
        <li>
          <span aria-hidden className="mr-1 inline-block h-3 w-3 rounded-[2px] bg-chip" />
          {t("legendBlocked")}
        </li>
      </ul>
    </section>
  );
}
