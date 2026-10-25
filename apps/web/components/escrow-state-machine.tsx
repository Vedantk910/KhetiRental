"use client";

import { useReducer, useState } from "react";
import { cn } from "@/lib/utils";
import {
  createEscrow,
  escrowReducer,
  totalPaise,
  type EscrowEvent,
  type EscrowState,
  type Stage,
} from "@/lib/escrow-machine";

// Demo booking: M-101 (45 HP, harvest surge) at its model rate, 10 contracted hours.
const TERMS = { hourlyRateInr: 1053, contractedHours: 10, takeRate: 0.135 };
const H0 = 500;

const STAGES: { id: Stage; label: string }[] = [
  { id: "PRE_AUTH", label: "Money held" },
  { id: "HANDOVER", label: "Stage 1: handover" },
  { id: "ACTIVE", label: "Stage 2: telematics window" },
  { id: "RETURN_AUDIT", label: "Stage 3: return audit" },
  { id: "SETTLED", label: "Settled" },
];
const STAGE_LABEL: Record<Stage, string> = {
  ...(Object.fromEntries(STAGES.map((s) => [s.id, s.label])) as Record<Stage, string>),
  DISPUTE_OPEN: "Dispute open",
  CANCELLED: "Cancelled",
};

const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Log = { state: EscrowState; log: string[] };
function reducer(s: Log, a: { event: EscrowEvent; label: string } | { reset: true }): Log {
  if ("reset" in a) return { state: createEscrow(TERMS), log: [] };
  const next = escrowReducer(s.state, a.event);
  const line = next.error
    ? `${a.label}: rejected (${next.error})`
    : `${a.label} → ${STAGE_LABEL[next.stage]}${next.ruleFired && next.ruleFired !== s.state.ruleFired ? ` [${next.ruleFired}]` : ""}`;
  return { state: next, log: [line, ...s.log].slice(0, 12) };
}

export function EscrowStateMachine() {
  const [{ state, log }, dispatch] = useReducer(reducer, undefined, () => ({
    state: createEscrow(TERMS),
    log: [],
  }));
  const [deltaH, setDeltaH] = useState(8);
  const at = (...stages: Stage[]) => stages.includes(state.stage);
  const send = (label: string, event: EscrowEvent) => {
    dispatch({ label, event });
  };
  // In a dispute, show how far the booking got and mark the step that is disputed.
  const disputed = state.stage === "DISPUTE_OPEN";
  const idx = disputed ? (state.hFinal !== null ? 3 : 2) : STAGES.findIndex((s) => s.id === state.stage);
  const balanced = totalPaise(state.ledger) === state.renterPaidPaise;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,22rem)]">
      <div className="space-y-[20px]">
        <ol className="grid gap-2 sm:grid-cols-5" aria-label="Escrow stages">
          {STAGES.map((s, i) => (
            <li
              key={s.id}
              aria-current={s.id === state.stage ? "step" : undefined}
              className={cn(
                "rounded-card border px-3 py-2 text-caption",
                disputed && i === idx
                  ? "border-warning text-warning"
                  : s.id === state.stage
                    ? "border-action bg-action text-action-on"
                    : i < idx
                      ? "border-action text-link"
                      : "border-border-subtle text-text-muted",
              )}
            >
              {s.label}
              {disputed && i === idx && " (disputed)"}
            </li>
          ))}
        </ol>

        <div className="rounded-card border border-border-subtle bg-surface p-[20px]">
          <p className="text-caption text-text-muted">Current stage</p>
          <p
            data-testid="escrow-stage"
            className={cn("text-h2 font-bold", state.stage === "DISPUTE_OPEN" && "text-warning")}
          >
            {STAGE_LABEL[state.stage]}
          </p>
          <p className="mt-1 text-caption">
            Problem detected:{" "}
            <span data-testid="rule-fired" className="font-bold">
              {state.ruleFired ?? "none"}
            </span>
            {state.depositFrozen && <span className="ml-2 font-bold text-warning">Deposit frozen</span>}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Action
              onClick={() => {
                send("Authorise escrow", { type: "AUTHORIZE" });
              }}
              disabled={!at("PRE_AUTH")}
            >
              Authorise escrow
            </Action>
            <Action
              disabled={!at("HANDOVER")}
              onClick={() => {
                send("Handover", {
                  type: "HANDOVER",
                  photos: 3,
                  photosWithinM: 120,
                  h0: H0,
                  ownerOtp: true,
                  renterOtp: true,
                  kycOk: true,
                });
              }}
            >
              Hand over the machine
            </Action>
            <Action
              tone="warn"
              disabled={!at("HANDOVER")}
              onClick={() => {
                send("No-show after 24 h", { type: "NO_SHOW" });
              }}
            >
              Simulate no-show
            </Action>
            <Action
              tone="warn"
              disabled={!at("ACTIVE")}
              onClick={() => {
                send("Geofence breach 650 m for 90 s", {
                  type: "TELEMETRY",
                  distanceOutsideM: 650,
                  secondsOutside: 90,
                  ecuHours: 4,
                  gpsHours: 4,
                });
              }}
            >
              Machine taken too far from the field
            </Action>
            <Action
              tone="warn"
              disabled={!at("ACTIVE")}
              onClick={() => {
                send("ECU 11.5 h vs GPS 10 h", {
                  type: "TELEMETRY",
                  distanceOutsideM: 0,
                  secondsOutside: 0,
                  ecuHours: 11.5,
                  gpsHours: 10,
                });
              }}
            >
              Hour meter doesn&apos;t match GPS
            </Action>
          </div>

          <p className="mt-3 text-caption text-text-muted">
            Handover needs the one-time codes from both sides, 3 photos near the field, and the hour meter
            locked.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-caption font-bold">
              Hours used: {deltaH} of {TERMS.contractedHours} booked
              <input
                type="range"
                min={0}
                max={14}
                value={deltaH}
                onChange={(e) => {
                  setDeltaH(Number(e.target.value));
                }}
                className="mt-2 block w-[224px] accent-[rgb(var(--action))]"
              />
            </label>
            <Action
              disabled={!at("ACTIVE")}
              onClick={() => {
                send(`Return with ΔH ${deltaH} h`, {
                  type: "RETURN",
                  hFinal: H0 + deltaH,
                  fuelOk: true,
                  damageOk: true,
                });
              }}
            >
              Return machine
            </Action>
            <Action
              disabled={!at("RETURN_AUDIT")}
              onClick={() => {
                send("Settlement", { type: "SETTLE" });
              }}
            >
              Settle
            </Action>
          </div>

          {at("DISPUTE_OPEN") && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Action
                onClick={() => {
                  send("Ruling: renter at fault", { type: "RESOLVE", ruling: "renter_at_fault" });
                }}
              >
                Ruling: renter at fault
              </Action>
              <Action
                onClick={() => {
                  send("Ruling: owner at fault", { type: "RESOLVE", ruling: "owner_at_fault" });
                }}
              >
                Ruling: owner at fault
              </Action>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              dispatch({ reset: true });
            }}
            className="mt-4 text-caption font-bold text-text-muted underline"
          >
            Reset
          </button>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-card border border-border-subtle bg-surface p-[20px]">
          <h2 className="font-bold">Ledger</h2>
          <dl className="mt-2 space-y-1 text-caption">
            {(
              [
                ["Held in escrow", state.ledger.escrow],
                ["Owner payout", state.ledger.owner],
                ["Platform take (13.5%)", state.ledger.platform],
                ["Refund to renter", state.ledger.renterRefund],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <dt className="text-text-muted">{k}</dt>
                <dd className="tabular-nums">{rupees(v)}</dd>
              </div>
            ))}
          </dl>
          <p
            data-testid="ledger-check"
            className={cn("mt-3 text-caption font-bold", balanced ? "text-link" : "text-warning")}
          >
            {balanced ? "Balanced" : "Unbalanced"}: {rupees(totalPaise(state.ledger))} of{" "}
            {rupees(state.renterPaidPaise)} pre-authorised (rental {rupees(state.basePaise)} + 15% deposit{" "}
            {rupees(state.depositPaise)})
          </p>
        </div>
        <div className="rounded-card border border-border-subtle bg-surface p-[20px]">
          <h2 className="font-bold">Event log</h2>
          <ol aria-live="polite" className="mt-2 space-y-1 text-caption text-text-muted">
            {log.length === 0 ? (
              <li>No events yet.</li>
            ) : (
              log.map((l, i) => <li key={log.length - i}>{l}</li>)
            )}
          </ol>
        </div>
      </aside>
    </div>
  );
}

function Action({
  tone,
  className,
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "warn" }) {
  return (
    <button
      type="button"
      {...p}
      className={cn(
        "min-h-tap rounded-card px-3 py-2 text-caption font-bold disabled:cursor-not-allowed disabled:opacity-40",
        tone === "warn" ? "border border-warning text-warning" : "bg-action text-action-on",
        className,
      )}
    />
  );
}
