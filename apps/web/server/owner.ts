// Owner dashboard data (UI-SPEC §4.12): earnings ledger, the month calendar, the price hint, owner mode,
// and one machine in the shape the edit wizard needs.
import { ACTIVE_STATUSES, keepPaise } from "@/lib/domain";
import { getSql, one } from "./db";
import { expireStale } from "./bookings";
import { ApiError } from "./http";
import { todayIst } from "./pricing";
import { requireRole, type SessionUser } from "./session";

const ACTIVE = [...ACTIVE_STATUSES];

/**
 * This month's money for the owner, net of our fee. "Paid" is a ledger in this demo (no payouts):
 * a finished job (done, or confirmed with its last day gone). "Coming" is a confirmed job still ahead.
 */
export async function ownerEarnings(u: SessionUser, now = new Date()) {
  requireRole(u, "owner");
  const today = todayIst(now);
  const first = `${today.slice(0, 7)}-01`;
  const rows = await getSql()<{ status: string; rent_paise: number; end_date: string }[]>`
    SELECT b.status, b.rent_paise, b.end_date::text
    FROM bookings b JOIN machines m ON m.id = b.machine_id
    WHERE m.owner_id = ${u.id} AND b.status IN ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED')
      AND b.start_date >= ${first}::date AND b.start_date < (${first}::date + interval '1 month')`;
  let paidPaise = 0;
  let comingPaise = 0;
  for (const r of rows) {
    if (r.status === "COMPLETED" || r.end_date < today) paidPaise += keepPaise(r.rent_paise);
    else comingPaise += keepPaise(r.rent_paise);
  }
  return { monthPaise: paidPaise + comingPaise, paidPaise, comingPaise };
}

async function ownMachine(u: SessionUser, id: string) {
  const m = one(
    await getSql()<{ id: string }[]>`SELECT id FROM machines WHERE id = ${id} AND owner_id = ${u.id}`,
  );
  if (!m) throw new ApiError(404, "not_found");
}

export interface CalendarDay {
  date: string;
  state: "free" | "busy" | "blocked";
  code: string | null;
  status: string | null;
}

/** Every day of `month` (YYYY-MM): booked (with the booking's code), blocked, or free. */
export async function ownerCalendar(u: SessionUser, id: string, month: string): Promise<CalendarDay[]> {
  requireRole(u, "owner");
  await ownMachine(u, id);
  await expireStale(id);
  const first = `${month}-01`;
  return getSql()<CalendarDay[]>`
    SELECT d::date::text AS date,
      CASE WHEN b.code IS NOT NULL THEN 'busy' WHEN k.day IS NOT NULL THEN 'blocked' ELSE 'free' END AS state,
      b.code, b.status
    FROM generate_series(${first}::date, ${first}::date + interval '1 month' - interval '1 day', interval '1 day') d
    LEFT JOIN machine_blocks k ON k.machine_id = ${id} AND k.day = d::date
    LEFT JOIN LATERAL (
      SELECT x.code, x.status FROM bookings x
      WHERE x.machine_id = ${id} AND x.status = ANY(${ACTIVE}::text[])
        AND x.during && tstzrange((d::date + time '00:00') AT TIME ZONE 'Asia/Kolkata',
                                  (d::date + 1 + time '00:00') AT TIME ZONE 'Asia/Kolkata', '[)')
      ORDER BY lower(x.during) LIMIT 1) b ON true
    ORDER BY d`;
}

const HINT_MIN = 3;
const HINT_KM = 25;

/** "Similar machines near you charge …": the 25th–75th percentile; hidden with fewer than 3 to compare. */
export async function priceHint(
  u: SessionUser,
  q: { category: string; unit: string; lat: number; lng: number },
): Promise<{ n: 0 } | { n: number; minRupees: number; maxRupees: number }> {
  requireRole(u, "owner");
  const r = one(
    await getSql()<{ n: number; lo: number | null; hi: number | null }[]>`
    SELECT count(*)::int AS n,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY price_paise)::float8 AS lo,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY price_paise)::float8 AS hi
    FROM machines
    WHERE active AND category = ${q.category} AND price_unit = ${q.unit}
      AND ST_DWithin(location, ST_SetSRID(ST_MakePoint(${q.lng}, ${q.lat}), 4326)::geography, ${HINT_KM * 1000})`,
  );
  if (!r || r.n < HINT_MIN || r.lo === null || r.hi === null) return { n: 0 };
  const tens = (paise: number) => Math.round(paise / 1000) * 10;
  return { n: r.n, minRupees: tens(r.lo), maxRupees: tens(r.hi) };
}

/** Owner mode for a renter (UI-SPEC §3.1). Admin is never self-service. */
export async function enableOwner(u: SessionUser) {
  const r = one(
    await getSql()<{ roles: string[] }[]>`
    UPDATE users SET roles = CASE WHEN roles @> ARRAY['owner'] THEN roles ELSE array_append(roles, 'owner') END
    WHERE id = ${u.id} RETURNING roles`,
  );
  if (!r) throw new ApiError(401, "unauthorized");
  return { roles: r.roles };
}

/** One machine for the edit wizard, with its photos and the days blocked from today on. */
export async function getMyMachine(u: SessionUser, id: string) {
  requireRole(u, "owner");
  const sql = getSql();
  const m = one(
    await sql<
      {
        id: string;
        category: string;
        make: string;
        model: string;
        hp: number | null;
        year: number;
        hour_meter: number | null;
        last_serviced: string | null;
        attachments: string[];
        lat: number;
        lng: number;
        village: string;
        pin: string;
        price_unit: string;
        price_rupees: number;
        operator_included: boolean;
        diesel_included: boolean;
        active: boolean;
        rc_status: string;
      }[]
    >`
    SELECT id, category, make, model, hp, year, hour_meter, last_serviced::text, attachments,
      ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng, village, pin, price_unit,
      price_paise / 100 AS price_rupees, operator_included, diesel_included, active, rc_status
    FROM machines WHERE id = ${id} AND owner_id = ${u.id}`,
  );
  if (!m) throw new ApiError(404, "not_found");
  const photos = await sql<{ id: string; url: string; kind: string }[]>`
    SELECT id, url, kind FROM machine_photos WHERE machine_id = ${id} ORDER BY sort, created_at`;
  const blocked = await sql<{ day: string }[]>`
    SELECT day::text FROM machine_blocks WHERE machine_id = ${id} AND day >= ${todayIst()}::date ORDER BY day`;
  return {
    id: m.id,
    category: m.category,
    make: m.make,
    model: m.model,
    hp: m.hp,
    year: m.year,
    hourMeter: m.hour_meter,
    lastServiced: m.last_serviced,
    attachments: m.attachments,
    lat: m.lat,
    lng: m.lng,
    village: m.village,
    pin: m.pin,
    priceUnit: m.price_unit,
    priceRupees: m.price_rupees,
    operatorIncluded: m.operator_included,
    dieselIncluded: m.diesel_included,
    active: m.active,
    rcStatus: m.rc_status,
    photos,
    blockedDays: blocked.map((b) => b.day),
  };
}
