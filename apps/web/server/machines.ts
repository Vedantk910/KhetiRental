// Machines: search (F-02/F-03/F-04/F-07/F-41, S-07), detail, and the owner's listing CRUD.
import { and, eq, sql as dsql } from "drizzle-orm";
import { ACTIVE_STATUSES, JOB_MACHINES, type Slot } from "@/lib/domain";
import { shortName } from "@/lib/format";
import { getDb, getSql, one } from "./db";
import { machines } from "./db/schema";
import { ApiError } from "./http";
import {
  addDays,
  bayesianRating,
  bookingWindow,
  HOURS_PER_ACRE,
  roundKm,
  SLOT_HOURS,
  slotLength,
  todayIst,
} from "./pricing";
import { requireRole, type SessionUser } from "./session";
import { saveImage } from "./uploads";
import type { MachineCreate, MachinePatch, SearchQuery } from "./validation";

const ACTIVE = [...ACTIVE_STATUSES];
const REVIEWS_PAGE = 10;
const NEXT_FREE_HORIZON_DAYS = 60;
const MAX_PHOTOS = 8;

const roundTo = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

export async function resolvePlace(q: Pick<SearchQuery, "lat" | "lng" | "pin" | "village">) {
  const sql = getSql();
  if (q.lat !== undefined && q.lng !== undefined)
    return { lat: q.lat, lng: q.lng, label: null, district: null };
  const rows = q.pin
    ? await sql<{ lat: number; lng: number; label: string; district: string }[]>`
        SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng, village AS label, district
        FROM pin_codes WHERE pin = ${q.pin} ORDER BY office LIMIT 1`
    : await sql<{ lat: number; lng: number; label: string; district: string }[]>`
        SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng, village AS label, district
        FROM pin_codes WHERE lower(village) = lower(${q.village ?? ""}) OR lower(office) = lower(${q.village ?? ""})
        ORDER BY pin, office LIMIT 1`;
  const place = one(rows);
  if (!place) throw new ApiError(404, "place_not_found", q.pin ? "pin" : "village");
  return place;
}

interface Row {
  id: string;
  category: string;
  make: string;
  model: string;
  hp: number | null;
  attachments: string[];
  price_unit: string;
  price_paise: number;
  operator_included: boolean;
  village: string;
  last_serviced: string | null;
  is_sample: boolean;
  owner_name: string | null;
  km: number;
  n: number;
  stars: number;
  busy: boolean;
  photo: string | null;
  next_free: string | null;
  total: number;
  free_total: number;
  map_lat: number | null;
  map_lng: number | null;
}

const card = (r: Row) => ({
  id: r.id,
  name: `${r.make} ${r.model}`,
  category: r.category,
  attachments: r.attachments,
  hp: r.hp,
  priceRupees: r.price_paise / 100,
  unit: r.price_unit,
  operatorIncluded: r.operator_included,
  distanceKm: roundKm(r.km),
  village: r.village,
  rating: r.n > 0 ? Math.round((r.stars / r.n) * 10) / 10 : null,
  reviewCount: r.n,
  ownerShortName: shortName(r.owner_name),
  servicedMonth: r.last_serviced?.slice(0, 7) ?? null,
  photoUrl: r.photo,
  available: !r.busy,
  nextFreeDate: r.busy ? r.next_free : null,
  isSample: r.is_sample,
});

/** SQL for "the first day from `from` on which the slot is free", or NULL within the horizon. */
const nextFree = (sql: ReturnType<typeof getSql>, from: string, slot: Slot) => sql`
  (SELECT d::date::text FROM generate_series(${from}::date, ${from}::date + ${NEXT_FREE_HORIZON_DAYS}::int, interval '1 day') d
   WHERE NOT EXISTS (SELECT 1 FROM machine_blocks k WHERE k.machine_id = c.id AND k.day = d::date)
     AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.machine_id = c.id AND b.status = ANY(${ACTIVE}::text[])
       AND b.during && tstzrange((d::date + make_time(${SLOT_HOURS[slot].from}, 0, 0)) AT TIME ZONE 'Asia/Kolkata',
                                 (d::date + make_time(${SLOT_HOURS[slot].to}, 0, 0)) AT TIME ZONE 'Asia/Kolkata', '[)'))
   ORDER BY d LIMIT 1)`;

export async function searchMachines(q: SearchQuery) {
  const sql = getSql();
  const place = await resolvePlace(q);
  const offset = Number(q.cursor ?? 0);
  const job = q.job ? JOB_MACHINES[q.job] : null;
  const win = q.from && q.to ? bookingWindow(q.from, q.to, q.slot) : null;
  const order = {
    nearest: sql`c.location <-> o.g`,
    // Units differ, so compare a per-hour equivalent (acre ≈ 0.75 h, day = one slot).
    cheapest: sql`CASE c.price_unit WHEN 'hour' THEN c.price_paise::float8
                  WHEN 'acre' THEN c.price_paise / ${HOURS_PER_ACRE}::float8
                  ELSE c.price_paise / ${slotLength(q.slot)}::float8 END`,
    top_rated: sql`(${5 * 4.2}::float8 + c.stars) / (5 + c.n) DESC`,
  }[q.sort];
  // shortcut: offset paging (cursor = offset) keeps exact distances out of the cursor (S-07); keyset if lists grow past a few hundred.
  const rows = await sql<Row[]>`
    WITH o AS (SELECT ST_SetSRID(ST_MakePoint(${place.lng}, ${place.lat}), 4326)::geography AS g),
    c AS (
      SELECT m.*, u.name AS owner_name, ST_Distance(m.location, o.g) / 1000 AS km,
        coalesce(rv.n, 0)::int AS n, coalesce(rv.stars, 0)::int AS stars,
        ${
          win
            ? sql`(EXISTS (SELECT 1 FROM bookings b WHERE b.machine_id = m.id AND b.status = ANY(${ACTIVE}::text[])
                     AND b.during && tstzrange(${win.start.toISOString()}::timestamptz, ${win.end.toISOString()}::timestamptz, '[)'))
                   OR EXISTS (SELECT 1 FROM machine_blocks k WHERE k.machine_id = m.id
                     AND k.day BETWEEN ${q.from ?? ""}::date AND ${q.to ?? ""}::date))`
            : sql`false`
        } AS busy
      FROM machines m JOIN users u ON u.id = m.owner_id, o
      LEFT JOIN LATERAL (
        SELECT count(*) AS n, sum(r.stars) AS stars FROM reviews r JOIN bookings b ON b.id = r.booking_id
        WHERE b.machine_id = m.id AND r.target_user_id = m.owner_id) rv ON true
      WHERE m.active AND ST_DWithin(m.location, o.g, ${q.radiusKm * 1000})
        ${q.driver ? sql`AND m.operator_included` : sql``}
        ${
          job
            ? sql`AND (m.category = ANY(${job.categories}::text[])
                   OR (m.category = 'tractor' AND m.attachments && ${job.attachments}::text[]))`
            : sql``
        }
    )
    SELECT c.id, c.category, c.make, c.model, c.hp, c.attachments, c.price_unit, c.price_paise, c.operator_included,
      c.village, c.last_serviced::text,
      ${q.map ? sql`round(ST_Y(c.location::geometry)::numeric, 2)::float8` : sql`NULL::float8`} AS map_lat,
      ${q.map ? sql`round(ST_X(c.location::geometry)::numeric, 2)::float8` : sql`NULL::float8`} AS map_lng, c.is_sample, c.owner_name, c.km, c.n, c.stars, c.busy,
      (SELECT p.url FROM machine_photos p WHERE p.machine_id = c.id AND p.kind <> 'rc' ORDER BY p.sort, p.created_at LIMIT 1) AS photo,
      ${win && q.from ? sql`CASE WHEN c.busy THEN ${nextFree(sql, q.from, q.slot)} END` : sql`NULL`} AS next_free,
      count(*) OVER ()::int AS total, (count(*) FILTER (WHERE NOT c.busy) OVER ())::int AS free_total
    FROM c, o
    ORDER BY c.busy, ${order}, c.id
    LIMIT ${q.limit} OFFSET ${offset}`;
  const first = one(rows);
  const counts = first
    ? { total: first.total, freeTotal: first.free_total }
    : offset > 0
      ? await countOnly(q, place)
      : { total: 0, freeTotal: 0 };
  const { total, freeTotal } = counts;
  return {
    applied: {
      radiusKm: q.radiusKm,
      sort: q.sort,
      slot: q.slot,
      from: q.from ?? null,
      to: q.to ?? null,
      job: q.job ?? null,
      limit: q.limit,
      driver: q.driver ?? false,
    },
    place: {
      label: place.label,
      district: place.district,
      ...(q.map ? { center: { lat: roundTo(place.lat, 3), lng: roundTo(place.lng, 3) } } : {}),
    },
    total,
    freeTotal,
    items: rows.map((r) => ({
      ...card(r),
      ...(q.map ? { mapLat: r.map_lat, mapLng: r.map_lng } : {}),
    })),
    nextCursor: offset + rows.length < total ? String(offset + rows.length) : null,
  };
}

/** Past the last page: still report the total. */
async function countOnly(
  q: SearchQuery,
  place: { lat: number; lng: number },
): Promise<{ total: number; freeTotal: number }> {
  const r: { total: number; freeTotal: number } = await searchMachines({
    ...q,
    cursor: undefined,
    limit: 1,
    lat: place.lat,
    lng: place.lng,
    pin: undefined,
    village: undefined,
  });
  return { total: r.total, freeTotal: r.freeTotal };
}

/** Free, booked or blocked for each of the next `count` days (a day is "booked" when the 7 am–7 pm slot is taken). */
export async function machineDays(id: string, count: number) {
  const sql = getSql();
  const today = todayIst();
  const last = addDays(today, count - 1);
  return sql<{ date: string; state: "free" | "busy" | "blocked" }[]>`
    SELECT d::date::text AS date,
      CASE WHEN EXISTS (SELECT 1 FROM machine_blocks k WHERE k.machine_id = ${id} AND k.day = d::date) THEN 'blocked'
           WHEN EXISTS (SELECT 1 FROM bookings b WHERE b.machine_id = ${id} AND b.status = ANY(${ACTIVE}::text[])
             AND b.during && tstzrange((d::date + time '07:00') AT TIME ZONE 'Asia/Kolkata',
                                       (d::date + time '19:00') AT TIME ZONE 'Asia/Kolkata', '[)')) THEN 'busy'
           ELSE 'free' END AS state
    FROM generate_series(${today}::date, ${last}::date, interval '1 day') d ORDER BY d`;
}

export async function machineDetail(
  viewer: SessionUser,
  id: string,
  /** The renter's farm, for "3.5 km" on the owner row (rounded like the cards, S-07). */
  origin?: { lat: number; lng: number },
) {
  const sql = getSql();
  const m = one(
    await sql<
      (Row & {
        owner_id: string;
        year: number;
        hour_meter: number | null;
        rc_status: string;
        alt_price_unit: string | null;
        alt_price_paise: number | null;
        diesel_included: boolean;
        active: boolean;
        owner_since: Date;
      })[]
    >`
    SELECT m.*, m.last_serviced::text, u.name AS owner_name, u.created_at AS owner_since,
      ${origin ? sql`ST_Distance(m.location, ST_SetSRID(ST_MakePoint(${origin.lng}, ${origin.lat}), 4326)::geography) / 1000` : sql`0`}::float8 AS km,
      coalesce(rv.n, 0)::int AS n, coalesce(rv.stars, 0)::int AS stars, false AS busy, NULL AS next_free,
      (SELECT p.url FROM machine_photos p WHERE p.machine_id = m.id AND p.kind <> 'rc' ORDER BY p.sort, p.created_at LIMIT 1) AS photo
    FROM machines m JOIN users u ON u.id = m.owner_id
    LEFT JOIN LATERAL (
      SELECT count(*) AS n, sum(r.stars) AS stars FROM reviews r JOIN bookings b ON b.id = r.booking_id
      WHERE b.machine_id = m.id AND r.target_user_id = m.owner_id) rv ON true
    WHERE m.id = ${id}`,
  );
  const isOwner = m?.owner_id === viewer.id;
  if (!m || (!m.active && !isOwner)) throw new ApiError(404, "not_found");
  const days = await machineDays(id, 14);
  const photos = await sql<{ id: string; url: string; kind: string }[]>`
    SELECT id, url, kind FROM machine_photos WHERE machine_id = ${id} AND (kind <> 'rc' OR ${isOwner})
    ORDER BY sort, created_at`;
  const reviews = await sql<{ stars: number; text: string | null; author: string | null; createdAt: Date }[]>`
    SELECT r.stars, r.text, a.name AS author, r.created_at AS "createdAt"
    FROM reviews r JOIN bookings b ON b.id = r.booking_id JOIN users a ON a.id = r.author_id
    WHERE b.machine_id = ${id} AND r.target_user_id = ${m.owner_id} ORDER BY r.created_at DESC LIMIT 3`;
  const reply = one(
    await sql<{ minutes: number | null }[]>`
    SELECT round(avg(extract(epoch FROM b.confirmed_at - b.created_at)) / 60)::int AS minutes
    FROM bookings b JOIN machines mm ON mm.id = b.machine_id WHERE mm.owner_id = ${m.owner_id} AND b.confirmed_at IS NOT NULL`,
  );
  const { distanceKm, ...base } = card(m);
  return {
    ...base,
    ...(origin ? { distanceKm } : {}),
    bayesianRating: Math.round(bayesianRating(m.stars, m.n) * 100) / 100,
    year: m.year,
    hourMeter: m.hour_meter,
    rcStatus: m.rc_status,
    altPrice:
      m.alt_price_unit && m.alt_price_paise
        ? { unit: m.alt_price_unit, rupees: m.alt_price_paise / 100 }
        : null,
    dieselIncluded: m.diesel_included,
    active: m.active,
    photos,
    days14: days,
    owner: {
      shortName: shortName(m.owner_name),
      village: m.village,
      yearsOnPlatform: Math.floor((Date.now() - new Date(m.owner_since).getTime()) / (365.25 * 86_400_000)),
      replyMinutes: reply?.minutes ?? null,
    },
    reviewsPreview: reviews.map((r) => ({
      stars: r.stars,
      text: r.text,
      authorShortName: shortName(r.author),
      createdAt: r.createdAt,
    })),
    isMine: isOwner,
  };
}

const point = (lat: number, lng: number) => dsql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;

export async function createMachine(u: SessionUser, input: MachineCreate) {
  requireRole(u, "owner");
  const { lat, lng, pricePaise, hp, hourMeter, lastServiced, ...rest } = input;
  const [row] = await getDb()
    .insert(machines)
    .values({
      ...rest,
      hp: hp ?? null,
      hourMeter: hourMeter ?? null,
      lastServiced: lastServiced ?? null,
      pricePaise,
      ownerId: u.id,
      location: point(lat, lng),
    })
    .returning({ id: machines.id });
  return row;
}

/** Owner-only; anyone else gets 404 so ids can't be probed. */
async function ownMachine(u: SessionUser, id: string) {
  const m = one(
    await getSql()<{ id: string }[]>`SELECT id FROM machines WHERE id = ${id} AND owner_id = ${u.id}`,
  );
  if (!m) throw new ApiError(404, "not_found");
}

export async function updateMachine(u: SessionUser, id: string, patch: MachinePatch) {
  requireRole(u, "owner");
  const { lat, lng, ...rest } = patch;
  const set = { ...rest, ...(lat !== undefined && lng !== undefined ? { location: point(lat, lng) } : {}) };
  if (Object.keys(set).length === 0) throw new ApiError(400, "invalid_request");
  const rows = await getDb()
    .update(machines)
    .set(set)
    .where(and(eq(machines.id, id), eq(machines.ownerId, u.id)))
    .returning({ id: machines.id, active: machines.active });
  const row = one(rows);
  if (!row) throw new ApiError(404, "not_found");
  return row;
}

export async function deleteMachine(u: SessionUser, id: string) {
  requireRole(u, "owner");
  try {
    const rows = await getSql()`DELETE FROM machines WHERE id = ${id} AND owner_id = ${u.id} RETURNING id`;
    if (rows.length === 0) throw new ApiError(404, "not_found");
  } catch (e) {
    // Bookings keep their machine; pause it instead.
    if ((e as { code?: string }).code === "23503") throw new ApiError(409, "has_bookings");
    throw e;
  }
}

export async function listMyMachines(u: SessionUser) {
  requireRole(u, "owner");
  return getSql()`
    SELECT id, category, make, model, hp, village, price_unit AS "priceUnit", price_paise / 100 AS "priceRupees",
      active, is_sample AS "isSample", rc_status AS "rcStatus"
    FROM machines WHERE owner_id = ${u.id} ORDER BY created_at DESC`;
}

/** Block or unblock whole days (owner calendar, UI-SPEC §4.12). A day with an active booking can't be blocked. */
export async function setBlocks(u: SessionUser, id: string, days: string[], blocked: boolean) {
  requireRole(u, "owner");
  await ownMachine(u, id);
  const sql = getSql();
  const unique = [...new Set(days)];
  if (!blocked) {
    await sql`DELETE FROM machine_blocks WHERE machine_id = ${id} AND day = ANY(${unique}::text[]::date[])`;
    return { days: unique, blocked };
  }
  // Same lock as createBooking, so a booking and a block for one day can't both land.
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`;
    const clash = await tx<{ day: string }[]>`
      SELECT d::text AS day FROM unnest(${unique}::text[]::date[]) d
      WHERE EXISTS (SELECT 1 FROM bookings b WHERE b.machine_id = ${id} AND b.status = ANY(${ACTIVE}::text[])
        AND b.during && tstzrange((d + time '00:00') AT TIME ZONE 'Asia/Kolkata', (d + 1 + time '00:00') AT TIME ZONE 'Asia/Kolkata', '[)'))`;
    if (clash.length > 0) throw new ApiError(409, "day_booked", "days", undefined, { day: clash[0].day });
    await tx`INSERT INTO machine_blocks (machine_id, day) SELECT ${id}, d FROM unnest(${unique}::text[]::date[]) d ON CONFLICT DO NOTHING`;
  });
  return { days: unique, blocked };
}

export async function addPhoto(u: SessionUser, id: string, file: unknown, kind: string) {
  requireRole(u, "owner");
  await ownMachine(u, id);
  const sql = getSql();
  const [{ n }] = await sql<
    { n: number }[]
  >`SELECT count(*)::int AS n FROM machine_photos WHERE machine_id = ${id}`;
  if (n >= MAX_PHOTOS) throw new ApiError(409, "too_many_photos");
  const url = await saveImage(file);
  // One RC at a time: a new one replaces the old and goes back to review.
  if (kind === "rc") await sql`DELETE FROM machine_photos WHERE machine_id = ${id} AND kind = 'rc'`;
  const [p] = await sql<{ id: string; url: string; kind: string }[]>`
    INSERT INTO machine_photos (machine_id, url, kind, sort) VALUES (${id}, ${url}, ${kind}, ${n}) RETURNING id, url, kind`;
  if (kind === "rc") await sql`UPDATE machines SET rc_status = 'pending' WHERE id = ${id}`;
  return p;
}

export async function deletePhoto(u: SessionUser, id: string, photoId: string) {
  requireRole(u, "owner");
  await ownMachine(u, id);
  const sql = getSql();
  const rows = await sql<
    { kind: string }[]
  >`DELETE FROM machine_photos WHERE id = ${photoId} AND machine_id = ${id} RETURNING kind`;
  if (rows.length === 0) throw new ApiError(404, "not_found");
  // No RC photo, nothing to review.
  if (rows[0].kind === "rc") await sql`UPDATE machines SET rc_status = 'none' WHERE id = ${id}`;
}

/** The owner's reviews for a machine's page, newest first, 10 a page (UI-SPEC §4.6). Paused machines: owner only. */
export async function machineReviews(viewer: SessionUser, id: string, offset: number) {
  const sql = getSql();
  const m = one(
    await sql<
      { owner_id: string; active: boolean }[]
    >`SELECT owner_id, active FROM machines WHERE id = ${id}`,
  );
  if (!m || (!m.active && m.owner_id !== viewer.id)) throw new ApiError(404, "not_found");
  const rows = await sql<{ stars: number; text: string | null; author: string | null; createdAt: Date }[]>`
    SELECT r.stars, r.text, a.name AS author, r.created_at AS "createdAt"
    FROM reviews r JOIN bookings b ON b.id = r.booking_id JOIN users a ON a.id = r.author_id
    WHERE b.machine_id = ${id} AND r.target_user_id = ${m.owner_id}
    ORDER BY r.created_at DESC, r.id LIMIT ${REVIEWS_PAGE + 1} OFFSET ${offset}`;
  return {
    items: rows.slice(0, REVIEWS_PAGE).map((r) => ({
      stars: r.stars,
      text: r.text,
      authorShortName: shortName(r.author),
      createdAt: r.createdAt,
    })),
    nextCursor: rows.length > REVIEWS_PAGE ? String(offset + REVIEWS_PAGE) : null,
  };
}

/** Average minutes the machine owner took to accept requests (for "usually replies in …"); null with no history. */
export async function ownerReplyMinutes(machineId: string): Promise<number | null> {
  const r = one(
    await getSql()<{ minutes: number | null }[]>`
    SELECT round(avg(extract(epoch FROM b.confirmed_at - b.created_at)) / 60)::int AS minutes
    FROM bookings b JOIN machines mm ON mm.id = b.machine_id
    WHERE mm.owner_id = (SELECT owner_id FROM machines WHERE id = ${machineId}) AND b.confirmed_at IS NOT NULL`,
  );
  return r?.minutes ?? null;
}
