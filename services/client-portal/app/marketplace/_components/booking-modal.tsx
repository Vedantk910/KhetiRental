"use client";

import { Loader2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { FleetMachine } from "@/lib/marketplace-fleet";
import { HP_LABEL } from "@/lib/marketplace-fleet";
import { DEPOSIT_FLOOR_RATE, DIESEL_PRICE_INR, MAX_HOURS, formatInr, quoteRental, type Activity } from "@/lib/marketplace-quote";

type Status = { kind: "idle" } | { kind: "submitting" } | { kind: "done"; bookingId: string } | { kind: "error"; message: string };

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function BookingModal(props: { machine: FleetMachine; activity: Activity; hours: number; startDate: string; onClose: () => void }) {
  const { machine, activity, startDate, onClose } = props;
  const uid = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const hoursInput = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  // One key per modal: a retry after a dropped connection can never create a second booking.
  const [key] = useState(() => crypto.randomUUID());
  const [renterId] = useState(() => `renter-${crypto.randomUUID().slice(0, 8)}`);
  const [hoursText, setHoursText] = useState(String(props.hours));
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const hours = Number(hoursText);
  const hoursOk = hoursText.trim() !== "" && Number.isInteger(hours) && hours >= 1 && hours <= MAX_HOURS;
  const quote = hoursOk ? quoteRental(machine, activity, hours) : null;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    // Document-level: a disabled or unmounted button drops focus to <body>, and the trap must still hold.
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCloseRef.current();
      } else if (e.key === "Tab") {
        const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
        if (items.length === 0) { e.preventDefault(); dialog.current?.focus(); return; }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        const inside = !!dialog.current?.contains(active);
        if (e.shiftKey && (active === first || !inside)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (active === last || !inside)) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    const opener = document.activeElement as HTMLElement | null;
    hoursInput.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
      opener?.focus?.();
    };
  }, []);

  async function authorise() {
    if (busy.current || !hoursOk) return;
    busy.current = true;
    setStatus({ kind: "submitting" });
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({
          machine_id: machine.id, renter_id: renterId, hours, activity,
          start_at: `${startDate}T06:00:00+05:30`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 202 && typeof data.booking_id === "string") {
        setStatus({ kind: "done", bookingId: data.booking_id });
        return; // stays locked: the booking exists
      }
      const message =
        res.status === 409 && data.code === "machine_unavailable"
          ? "Someone has already booked this tractor for that time. Pick other dates or another tractor."
          : res.status === 400
            ? `We could not accept this booking. ${data.message ?? "Check the hours and dates."}`
            : res.status === 409
              ? String(data.message ?? "This booking conflicts with an earlier request.")
              : "Something went wrong on our side. Try again in a moment.";
      setStatus({ kind: "error", message });
    } catch {
      setStatus({ kind: "error", message: "Could not reach the server. Check your connection and try again. Retrying cannot book twice." });
    }
    busy.current = false;
  }

  const rateText = `${formatInr(Math.round(quote ? quote.hourlyRateInr * 100 : 0))}`;
  const done = status.kind === "done";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        aria-describedby={`${uid}-note`}
        tabIndex={-1}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 shadow-xl sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={`${uid}-title`} className="text-xl font-bold">Book {machine.label}</h2>
            <p className="text-sm text-muted">{HP_LABEL[machine.hp]}, owned by {machine.owner} in {machine.village}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md border border-line p-1.5">
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4">
          <label htmlFor={`${uid}-hours`} className="block text-sm font-medium">{activity} hours</label>
          <input
            id={`${uid}-hours`} ref={hoursInput} inputMode="numeric" value={hoursText} disabled={done || status.kind === "submitting"}
            onChange={(e) => setHoursText(e.target.value)}
            aria-invalid={!hoursOk} aria-describedby={`${uid}-hours-help`}
            className="mt-1 w-28 rounded-md border border-line bg-bg px-3 py-2 tabular-nums"
          />
          <p id={`${uid}-hours-help`} className={hoursOk ? "mt-1 text-xs text-muted" : "mt-1 text-xs font-medium text-red-700 dark:text-red-400"}>
            {hoursOk ? `Starts ${startDate} at 6 am. The estimate is our assumption; change it if the owner agrees a different time.` : `Enter a whole number from 1 to ${MAX_HOURS}.`}
          </p>
        </div>

        {quote && (
          <dl className="mt-4 space-y-2 rounded-lg border border-dashed border-line p-4 text-sm tabular-nums" aria-label="Price breakdown">
            <Row dt={`Rental, ${quote.hours} h × ${rateText}/h`} dd={formatInr(quote.rentalPaise)} />
            <Row
              dt={quote.depositRule === "tier floor" ? `Refundable deposit (tier floor, ${DEPOSIT_FLOOR_RATE * 100} % of tractor value)` : "Refundable deposit (15 % of rental)"}
              dd={formatInr(quote.depositPaise)}
            />
            <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
              <dt>Held in escrow</dt>
              <dd>{formatInr(quote.totalPaise)}</dd>
            </div>
          </dl>
        )}
        <p id={`${uid}-note`} className="mt-3 text-xs text-muted">
          Demo prices from the pricing model, with diesel at ₹{DIESEL_PRICE_INR} a litre (an assumption). The deposit comes back after a clean return. No real money moves.
        </p>

        <div role="alert" aria-live="assertive" className="mt-3 min-h-0 text-sm font-medium text-red-700 dark:text-red-400">
          {status.kind === "error" && status.message}
        </div>
        {done && (
          <p role="status" className="mt-3 rounded-md bg-primary/10 p-3 text-sm font-medium text-primary">
            Escrow authorised. Booking {status.bookingId}.
          </p>
        )}

        <div className="mt-4 flex gap-2">
          {done ? (
            <button type="button" autoFocus onClick={onClose} className="rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-fg">Done</button>
          ) : (
            <>
              <button
                type="button" onClick={authorise} disabled={!hoursOk || status.kind === "submitting"}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-fg disabled:opacity-50"
              >
                {status.kind === "submitting" && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
                Authorise escrow
              </button>
              <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2.5 font-medium">Cancel</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ dt, dd }: { dt: string; dd: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{dt}</dt>
      <dd className="font-semibold">{dd}</dd>
    </div>
  );
}
