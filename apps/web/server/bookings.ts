// Bookings (F-06/F-08/F-09/F-21, S-02/S-03, UI-SPEC §4.7–§4.9, §4.12). The EXCLUDE constraint is the
// only thing that decides who gets a slot; this code maps its 23P01 to 409 machine_unavailable.
import { randomInt } from "node:crypto";
import { type BookingStatus, type PaymentMethod, type Slot } from "@/lib/domain";
import { getSql, one } from "./db";
import { ApiError } from "./http";
import { createPayment } from "./mocks/payments";
import { notify } from "./notifications";
import { bookingWindow, cancelDeadline, type PricedMachine, quote, REPLY_WINDOW_MS } from "./pricing";
import { limit } from "./rate-limit";
import type { SessionUser } from "./session";

const PAST_GRACE_MS = 3600_000; // F-21: "start < now() - 1 hour" is in the past
const MAX_AHEAD_DAYS = 180;

const pgCode = (e: unknown) => (e as { code?: string }).code;
const pgConstraint = (e: unknown) => (e as { constraint_name?: string }).constraint_name;

interface BookingRow {
  id: string;
  code: string;
  status: BookingStatus;
  machine_id: string;
  renter_id: string;
  owner_id: string;
  machine_name: string;
  village: string;
  start_date: string;
  end_date: string;
  slot: Slot;
  est_qty: string;
  unit: string;
  rate_paise: number;
  rent_paise: number;
  deposit_paise: number;
  diesel_included: boolean;
  total_paise: number;
  reply_by: Date;
  starts_at: Date;
  created_at: Date;
  confirmed_at: Date | null;
  closed_at: Date | null;
  decline_reason: string | null;
  cancel_reason: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  renter_name: string | null;
  renter_phone: string | null;
  lat: number;
  lng: number;
  pay_method: string | null;
  pay_status: string | null;
}

const SELECT = (sql: ReturnType<typeof getSql>) => sql`
  SELECT b.id, b.code, b.status, b.machine_id, b.renter_id, m.owner_id, m.make || ' ' || m.model AS machine_name,
    m.village, b.start_date::text, b.end_date::text, b.slot, b.est_qty::text, b.unit, b.rate_paise, b.rent_paise,
    b.deposit_paise, b.diesel_included, b.total_paise, b.reply_by, lower(b.during) AS starts_at, b.created_at,
    b.confirmed_at, b.closed_at, b.decline_reason, b.cancel_reason,
    o.name AS owner_name, o.phone AS owner_phone, r.name AS renter_name, r.phone AS renter_phone,
    ST_Y(m.location::geometry) AS lat, ST_X(m.location::geometry) AS lng,
    p.method AS pay_method, p.status AS pay_status
  FROM bookings b JOIN machines m ON m.id = b.machine_id JOIN users o ON o.id = m.owner_id JOIN users r ON r.id = b.renter_id
  LEFT JOIN LATERAL (SELECT method, status FROM payments WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1) p ON true`;

const CONTACT_STATUSES: BookingStatus[] = ["CONFIRMED", "IN_PROGRESS", "COMPLETED"];

/** What a viewer may see: phones and the exact place only after the owner accepts (UI-SPEC §4.8, S-07). */
function view(b: BookingRow, viewer: SessionUser) {
  const role = b.renter_id === viewer.id ? "renter" : "owner";
  const contact = CONTACT_STATUSES.includes(b.status);
  return {
    id: b.id,
    code: b.code,
    status: b.status,
    role,
    machine: { id: b.machine_id, name: b.machine_name, village: b.village },
    startDate: b.start_date,
    endDate: b.end_date,
    slot: b.slot,
    qty: Number(b.est_qty),
    unit: b.unit,
    ratePaise: b.rate_paise,
    rentPaise: b.rent_paise,
    depositPaise: b.deposit_paise,
    dieselIncluded: b.diesel_included,
    totalPaise: b.total_paise,
    replyBy: b.reply_by,
    cancelDeadline: cancelDeadline(new Date(b.starts_at)),
    createdAt: b.created_at,
    confirmedAt: b.confirmed_at,
    closedAt: b.closed_at,
    declineReason: b.decline_reason,
    cancelReason: b.cancel_reason,
    owner: { name: b.owner_name, phone: contact && role === "renter" ? b.owner_phone : null },
    renter: { name: b.renter_name, phone: contact && role === "owner" ? b.renter_phone : null },
    location: contact ? { lat: b.lat, lng: b.lng } : null,
    payment: b.pay_status ? { method: b.pay_method, status: b.pay_status } : null,
  };
}

async function load(id: string) {
  const sql = getSql();
  const b = one(await sql<BookingRow[]>`${SELECT(sql)} WHERE b.id = ${id}`);
  return b;
}

async function loaded(id: string) {
  const b = await load(id);
  if (!b) throw new ApiError(404, "not_found");
  return b;
}

/** Loads a booking the viewer is part of; everyone else (except admins) gets 404. */
async function visible(viewer: SessionUser, id: string) {
  const b = await load(id);
  if (!b || (b.renter_id !== viewer.id && b.owner_id !== viewer.id && !viewer.roles.includes("admin")))
    throw new ApiError(404, "not_found");
  return b;
}

/** Requests the owner didn't answer in 2 hours become EXPIRED (and free the slot). */
async function expireStale(machineId?: string) {
  const rows = await getSql()<{ id: string; renter_id: string }[]>`
    UPDATE bookings SET status = 'EXPIRED', closed_at = now()
    WHERE status = 'REQUESTED' AND reply_by <= now() ${machineId ? getSql()`AND machine_id = ${machineId}` : getSql()``}
    RETURNING id, renter_id`;
  for (const r of rows) await notify(r.renter_id, "booking_expired", r.id);
}

interface CreateBookingInput {
  machineId: string;
  startDate: string;
  endDate: string;
  slot: Slot;
  qty?: number;
}

export async function createBooking(
  u: SessionUser,
  input: CreateBookingInput,
  idempotencyKey: string,
  now = new Date(),
) {
  const sql = getSql();
  const replay = async () => {
    const prev = one(
      await sql<{ id: string; renter_id: string }[]>`
      SELECT id, renter_id FROM bookings WHERE idempotency_key = ${idempotencyKey}`,
    );
    if (!prev) return null;
    if (prev.renter_id !== u.id) throw new ApiError(409, "idempotency_conflict");
    return { booking: view(await loaded(prev.id), u), replayed: true };
  };
  const earlier = await replay();
  if (earlier) return earlier;
  await limit("bookingCreate", u.id);

  const m = one(
    await sql<(PricedMachine & { id: string; owner_id: string; active: boolean })[]>`
    SELECT id, owner_id, active, category, hp, price_unit AS "priceUnit", price_paise AS "pricePaise",
      diesel_included AS "dieselIncluded" FROM machines WHERE id = ${input.machineId}`,
  );
  if (!m?.active) throw new ApiError(404, "not_found", "machineId");
  if (m.owner_id === u.id) throw new ApiError(403, "own_machine");

  const w = bookingWindow(input.startDate, input.endDate, input.slot);
  if (w.start.getTime() < now.getTime() - PAST_GRACE_MS) throw new ApiError(400, "past_date", "startDate");
  if (w.start.getTime() > now.getTime() + MAX_AHEAD_DAYS * 86_400_000)
    throw new ApiError(400, "invalid_request", "startDate");
  let q;
  try {
    q = quote(m, { days: w.days, slot: input.slot, qty: input.qty });
  } catch {
    throw new ApiError(400, "invalid_request", "qty");
  }

  await expireStale(m.id);
  // shortcut: blocks are checked outside the insert; an owner blocking a day at the same instant can lose that race.
  const blocked = one(
    await sql`
    SELECT 1 FROM machine_blocks WHERE machine_id = ${m.id} AND day BETWEEN ${input.startDate}::date AND ${input.endDate}::date LIMIT 1`,
  );
  if (blocked) throw new ApiError(409, "machine_unavailable");

  for (let attempt = 0; attempt < 20; attempt++) {
    const code = `KR-${String(randomInt(0, 10_000)).padStart(4, "0")}`;
    try {
      // Same-machine inserts queue on a short advisory lock instead of deadlocking inside the EXCLUDE
      // check (each deadlock costs deadlock_timeout, 1 s). The constraint still decides who wins.
      const [row] = await sql.begin(async (tx) => {
        await tx`SELECT pg_advisory_xact_lock(hashtextextended(${m.id}, 0))`;
        return tx<{ id: string }[]>`
        INSERT INTO bookings (code, machine_id, renter_id, during, start_date, end_date, slot, est_qty, unit, rate_paise,
          rent_paise, deposit_paise, diesel_included, total_paise, reply_by, idempotency_key)
        VALUES (${code}, ${m.id}, ${u.id}, tstzrange(${w.start.toISOString()}::timestamptz, ${w.end.toISOString()}::timestamptz, '[)'),
          ${input.startDate}, ${input.endDate}, ${input.slot}, ${q.qty}, ${q.unit}, ${q.ratePaise}, ${q.rentPaise},
          ${q.depositPaise}, ${q.dieselIncluded}, ${q.totalPaise}, ${new Date(now.getTime() + REPLY_WINDOW_MS).toISOString()}::timestamptz,
          ${idempotencyKey})
        RETURNING id`;
      });
      await notify(m.owner_id, "booking_requested", row.id);
      return { booking: view(await loaded(row.id), u), replayed: false };
    } catch (e) {
      if (pgCode(e) === "23P01") throw new ApiError(409, "machine_unavailable");
      if (pgCode(e) === "23505" && pgConstraint(e) === "bookings_active_code_uq") continue;
      // Belt and braces: a deadlock victim retries and either wins or meets 23P01 like the rest.
      if (pgCode(e) === "40P01") continue;
      if (pgCode(e) === "23505") {
        const again = await replay();
        if (again) return again;
      }
      throw e;
    }
  }
  throw new Error("could not allocate a booking code");
}

export async function getBooking(u: SessionUser, id: string) {
  await expireStale();
  return view(await visible(u, id), u);
}

export async function listBookings(u: SessionUser) {
  await expireStale();
  const sql = getSql();
  const rows = await sql<BookingRow[]>`${SELECT(sql)}
    WHERE b.renter_id = ${u.id} OR m.owner_id = ${u.id} ORDER BY lower(b.during) DESC, b.id LIMIT 200`;
  return rows.map((b) => view(b, u));
}

/** Renter or owner; free until 24 h before the start, after that the deposit may be kept (UI-SPEC §4.8). */
export async function cancelBooking(u: SessionUser, id: string, reason?: string, now = new Date()) {
  const b = await visible(u, id);
  const isRenter = b.renter_id === u.id;
  const allowed: BookingStatus[] = isRenter ? ["REQUESTED", "CONFIRMED"] : ["CONFIRMED"];
  const rows = await getSql()`
    UPDATE bookings SET status = 'CANCELLED', cancelled_by = ${u.id}, cancel_reason = ${reason ?? null}, closed_at = now()
    WHERE id = ${id} AND status = ANY(${allowed}::text[]) RETURNING id`;
  if (rows.length === 0) throw new ApiError(409, "invalid_state");
  await notify(isRenter ? b.owner_id : b.renter_id, "booking_cancelled", id);
  const free = now.getTime() <= cancelDeadline(new Date(b.starts_at)).getTime();
  return {
    booking: view(await loaded(id), u),
    refund: free ? ("full" as const) : ("deposit_at_risk" as const),
  };
}

/** Owner of the machine only. The renter gets 403, strangers 404. */
async function asOwner(u: SessionUser, id: string) {
  const b = await visible(u, id);
  if (b.owner_id !== u.id) throw new ApiError(403, "forbidden");
  return b;
}

async function decide(u: SessionUser, id: string, to: "CONFIRMED" | "DECLINED", reason?: string) {
  const b = await asOwner(u, id);
  const rows = await getSql()`
    UPDATE bookings SET status = ${to}, decline_reason = ${reason ?? null},
      confirmed_at = CASE WHEN ${to} = 'CONFIRMED' THEN now() END,
      closed_at = CASE WHEN ${to} = 'DECLINED' THEN now() END
    WHERE id = ${id} AND status = 'REQUESTED' AND reply_by > now() RETURNING id`;
  if (rows.length === 0) {
    await expireStale(b.machine_id);
    const latest = await loaded(id);
    throw new ApiError(409, latest.status === "EXPIRED" ? "reply_window_closed" : "invalid_state");
  }
  await notify(b.renter_id, to === "CONFIRMED" ? "booking_accepted" : "booking_declined", id);
  return view(await loaded(id), u);
}

export const acceptBooking = (u: SessionUser, id: string) => decide(u, id, "CONFIRMED");
export const declineBooking = (u: SessionUser, id: string, reason: string) =>
  decide(u, id, "DECLINED", reason);

/** Demo payment (D-08): only {method, amountPaise} ever reaches the server. */
export async function payBooking(
  u: SessionUser,
  id: string,
  p: { method: PaymentMethod; amountPaise: number },
) {
  const b = await visible(u, id);
  if (b.renter_id !== u.id) throw new ApiError(403, "forbidden");
  if (!(["REQUESTED", "CONFIRMED"] as BookingStatus[]).includes(b.status))
    throw new ApiError(409, "invalid_state");
  if (p.amountPaise !== b.total_paise) throw new ApiError(400, "amount_mismatch", "amountPaise");
  const sql = getSql();
  const paid = one(
    await sql`SELECT 1 FROM payments WHERE booking_id = ${id} AND status IN ('paid_demo', 'pay_later')`,
  );
  if (paid) throw new ApiError(409, "already_paid");
  const status =
    p.method === "cash"
      ? "pay_later"
      : (await createPayment({ method: p.method, amountPaise: p.amountPaise })).status;
  try {
    await sql`INSERT INTO payments (booking_id, method, status, amount_paise) VALUES (${id}, ${p.method}, ${status}, ${p.amountPaise})`;
  } catch (e) {
    if (pgCode(e) === "23505") throw new ApiError(409, "already_paid");
    throw e;
  }
  if (status === "failed") throw new ApiError(402, "payment_failed");
  await notify(u.id, "payment_recorded", id);
  return { status, method: p.method, amountPaise: p.amountPaise };
}

/** Problem reports (UI-SPEC §4.10): renter or owner of the booking. */
export async function bookingParty(u: SessionUser, id: string) {
  const b = await visible(u, id);
  return { role: b.renter_id === u.id ? ("renter" as const) : ("owner" as const), booking: b };
}
