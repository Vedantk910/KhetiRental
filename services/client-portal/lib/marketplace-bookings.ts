// DEMO STORE. shortcut: in-process memory, unbounded, lost on restart; replace with the booking-orchestrator API.
import { createEscrow, escrowReducer } from "./escrow-machine";
import { fleetMachine } from "./marketplace-fleet";
import { ACTIVITIES, MAX_HOURS, depositFloorInr, quoteRental, type Activity } from "./marketplace-quote";
import { DEFAULT_TAKE_RATE } from "./pricing-engine";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ID = 64;

export interface Result { status: number; body: object }
const err = (status: number, code: string, message: string): Result => ({ status, body: { code, message } });

export interface BookingCreate {
  machine_id: string;
  renter_id: string;
  hours: number;
  start_at?: string;
  activity?: Activity;
}

export function validateBookingCreate(b: unknown): { ok: true; value: BookingCreate } | { ok: false; message: string } {
  if (typeof b !== "object" || b === null || Array.isArray(b)) return { ok: false, message: "Body must be a JSON object." };
  const o = b as Record<string, unknown>;
  for (const f of ["machine_id", "renter_id"] as const) {
    if (typeof o[f] !== "string" || !o[f] || (o[f] as string).length > MAX_ID) {
      return { ok: false, message: `${f} must be a non-empty string of at most ${MAX_ID} characters.` };
    }
  }
  if (!Number.isInteger(o.hours) || (o.hours as number) < 1 || (o.hours as number) > MAX_HOURS) {
    return { ok: false, message: `hours must be a whole number from 1 to ${MAX_HOURS}.` };
  }
  if (o.start_at !== undefined && (typeof o.start_at !== "string" || o.start_at.length > 40 || !Number.isFinite(Date.parse(o.start_at)))) {
    return { ok: false, message: "start_at must be an ISO date-time." };
  }
  if (o.activity !== undefined && !ACTIVITIES.includes(o.activity as Activity)) {
    return { ok: false, message: `activity must be one of ${ACTIVITIES.join(", ")}.` };
  }
  return { ok: true, value: o as unknown as BookingCreate };
}

interface Rec {
  booking_id: string;
  state: string;
  machine_id: string;
  startMs: number;
  endMs: number;
  hours: number;
  hourlyRateInr: number;
  depositPaise: number;
  settlement?: object;
}
interface Store { bookings: Map<string, Rec>; creates: Map<string, { fp: string; res: Result }>; settles: Map<string, { id: string; res: Result }> }

// globalThis: route modules may be bundled separately and must share one store.
const G = globalThis as unknown as { __kheti_market?: Store };
const store = (): Store => (G.__kheti_market ??= { bookings: new Map(), creates: new Map(), settles: new Map() });
export const resetStore = () => { G.__kheti_market = undefined; };
/** Test hook: the orchestrator drives these states in production. */
export function setBookingState(id: string, state: string) {
  const r = store().bookings.get(id);
  if (r) r.state = state;
}

const badKey = () => err(400, "invalid_idempotency_key", "Idempotency-Key header must be a UUID.");

export function createBooking(key: string | null, raw: unknown): Result {
  if (!key || !UUID.test(key)) return badKey();
  const v = validateBookingCreate(raw);
  if (!v.ok) return err(400, "invalid_request", v.message);
  const b = v.value;
  const s = store();
  const fp = JSON.stringify([b.machine_id, b.renter_id, b.hours, b.start_at ?? null, b.activity ?? null]);
  const prior = s.creates.get(key);
  if (prior) {
    return prior.fp === fp ? prior.res : err(409, "idempotency_key_reuse", "This Idempotency-Key was already used with a different request.");
  }
  const startMs = b.start_at ? Date.parse(b.start_at) : Date.now();
  const endMs = startMs + b.hours * 3_600_000;
  for (const r of s.bookings.values()) {
    if (r.machine_id === b.machine_id && r.state !== "FAILED_PAYMENT_RELEASED" && r.startMs < endMs && startMs < r.endMs) {
      return err(409, "machine_unavailable", "This machine is already booked for part of that time.");
    }
  }
  const m = fleetMachine(b.machine_id);
  if (!m) return err(409, "machine_not_available", "That machine isn't listed or can't be booked.");
  const q = quoteRental(m, b.activity ?? "Sowing", b.hours);
  const rec: Rec = {
    booking_id: `bk_${crypto.randomUUID()}`, state: "ESCROW_AUTHORIZED", machine_id: b.machine_id,
    startMs, endMs, hours: b.hours, hourlyRateInr: q.hourlyRateInr, depositPaise: q.depositPaise,
  };
  s.bookings.set(rec.booking_id, rec);
  const res: Result = { status: 202, body: { booking_id: rec.booking_id, state: rec.state } };
  s.creates.set(key, { fp, res });
  return res;
}

export function settleBooking(id: string, key: string | null): Result {
  if (!key || !UUID.test(key)) return badKey();
  const s = store();
  const prior = s.settles.get(key);
  if (prior) return prior.id === id ? prior.res : err(409, "idempotency_key_reuse", "This Idempotency-Key was already used for another booking.");
  const r = s.bookings.get(id);
  if (!r) return err(404, "booking_not_found", "No booking with that id.");
  if (r.state !== "POST_RETURN_AUDIT") return err(409, "not_settleable", `A booking in state ${r.state} cannot be settled.`);

  const m = fleetMachine(r.machine_id);
  let e = createEscrow({
    hourlyRateInr: r.hourlyRateInr,
    contractedHours: r.hours,
    takeRate: DEFAULT_TAKE_RATE,
    depositFloorInr: m ? depositFloorInr(m) : 0,
  });
  for (const ev of [
    { type: "AUTHORIZE" }, { type: "HANDOVER", photos: 3, photosWithinM: 0, h0: 0, ownerOtp: true, renterOtp: true, kycOk: true },
    { type: "RETURN", hFinal: r.hours, fuelOk: true, damageOk: true }, { type: "SETTLE" },
  ] as const) e = escrowReducer(e, ev);
  if (e.stage !== "SETTLED") return err(409, "not_settleable", e.error ?? "Escrow could not settle.");

  r.state = "SETTLED";
  const res: Result = {
    status: 200,
    body: {
      booking_id: id,
      owner_share: e.ledger.owner / 100,
      renter_refund: e.ledger.renterRefund / 100,
      platform_take_rate: e.takeRate,
    },
  };
  s.settles.set(key, { id, res });
  return res;
}
