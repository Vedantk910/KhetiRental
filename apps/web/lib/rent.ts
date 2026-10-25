// The renter's search state, as it lives in the URL (F-37). Pure: pages, forms and tests share one reader and writer.
// Everything in a URL is hostile, so parseFilters never throws and only returns values the API accepts.
import { JOBS, RADII_KM, SLOTS, SORTS, type Job, type PriceUnit, type Slot } from "./domain";
import { toAsciiNumber } from "./format";
import type { Locale } from "@/i18n/routing";
import { addDays, HOURS_PER_ACRE, MAX_BOOKING_DAYS, parseDay, slotLength, todayIst } from "@/server/pricing";

type Sort = (typeof SORTS)[number];
type Radius = (typeof RADII_KM)[number];
export type Raw = Record<string, string | string[] | undefined>;

export interface Filters {
  job: Job | null;
  place: string;
  lat: number | null;
  lng: number | null;
  from: string | null;
  to: string | null;
  slot: Slot;
  acres: number | null;
  radius: Radius;
  sort: Sort;
  driver: boolean;
  view: "list" | "map";
}

export const MAX_ACRES = 100;
const PLACE_MAX = 60;
const DAY_MS = 86_400_000;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const oneOf = <T extends string>(list: readonly T[], v: string | undefined): T | null =>
  list.find((x) => x === v) ?? null;
const safeDay = (s: string | undefined) => {
  try {
    return s ? parseDay(s) : NaN;
  } catch {
    return NaN;
  }
};
/** Strips control characters (NUL, newlines) from text that will be echoed back or sent on. */

const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, "").trim();

export function parseFilters(raw: Raw, today = todayIst()): Filters {
  const g = (k: string) => first(raw[k]);
  const radius = Number(g("r"));
  let from: string | null = null;
  let to: string | null = null;
  const a = safeDay(g("from"));
  const b = safeDay(g("to"));
  if (!Number.isNaN(a) && !Number.isNaN(b)) {
    const t = parseDay(today);
    // A stale link starts today; a link that ends before today has nothing left to show.
    if (b >= t) {
      const start = Math.max(a, t);
      const end = Math.min(Math.max(b, start), start + (MAX_BOOKING_DAYS - 1) * DAY_MS);
      from = new Date(start).toISOString().slice(0, 10);
      to = new Date(end).toISOString().slice(0, 10);
    }
  }
  const lat = g("lat") === undefined ? NaN : toAsciiNumber(g("lat") ?? "");
  const lng = g("lng") === undefined ? NaN : toAsciiNumber(g("lng") ?? "");
  const gps = Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const acres = toAsciiNumber(g("acres") ?? "");
  return {
    job: oneOf(JOBS, g("job")),
    place: clean((g("place") ?? "").slice(0, PLACE_MAX * 2))
      .slice(0, PLACE_MAX)
      .trim(),
    lat: gps ? lat : null,
    lng: gps ? lng : null,
    from,
    to,
    slot: oneOf(SLOTS, g("slot")) ?? "full",
    acres: Number.isFinite(acres) && acres > 0 ? clampAcres(acres) : null,
    radius: RADII_KM.find((x) => x === radius) ?? 10,
    sort: oneOf(SORTS, g("sort")) ?? "nearest",
    driver: g("driver") === "1",
    view: g("view") === "map" ? "map" : "list",
  };
}

export const clampAcres = (n: number) => Math.min(MAX_ACRES, Math.max(0.5, Math.round(n * 2) / 2));

/** The page URL's query string: every value, in a stable order. */
export function filtersToQuery(f: Filters): URLSearchParams {
  const q = new URLSearchParams();
  const put = (k: string, v: string | number | null) => {
    if (v !== null && v !== "") q.set(k, String(v));
  };
  put("job", f.job);
  put("place", f.place);
  put("lat", f.lat);
  put("lng", f.lng);
  put("from", f.from);
  put("to", f.to);
  put("slot", f.slot);
  put("acres", f.acres);
  put("r", f.radius);
  put("sort", f.sort);
  if (f.driver) q.set("driver", "1");
  if (f.view === "map") q.set("view", "map");
  return q;
}

const isPin = (s: string) => /^[1-9]\d{5}$/.test(s);

/** The query for GET /api/machines. */
export function apiParams(f: Filters, extra: Record<string, string> = {}): URLSearchParams {
  const q = new URLSearchParams();
  if (isPin(f.place)) q.set("pin", f.place);
  else if (f.lat !== null && f.lng !== null) {
    q.set("lat", String(f.lat));
    q.set("lng", String(f.lng));
  } else if (f.place) q.set("village", f.place);
  q.set("radius", String(f.radius));
  q.set("sort", f.sort);
  q.set("slot", f.slot);
  if (f.job) q.set("job", f.job);
  if (f.from && f.to) {
    q.set("from", f.from);
    q.set("to", f.to);
  }
  if (f.driver) q.set("driver", "1");
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  return q;
}

export const hasPlace = (f: Filters) => f.place !== "" || (f.lat !== null && f.lng !== null);

export type Range = { from: string; to: string };

export function presetRange(preset: "tomorrow" | "week", today = todayIst()): Range {
  const from = addDays(today, 1);
  return { from, to: preset === "tomorrow" ? from : addDays(today, 7) };
}

export const dayCount = (from: string, to: string) => (parseDay(to) - parseDay(from)) / DAY_MS + 1;

const tag = (l: Locale) => `${l}-IN`;
/** A calendar day as a Date that formats to the same day in India. */
export const dayDate = (s: string) => new Date(`${s}T12:00:00+05:30`);

/** "Mon 2 Nov – Wed 4 Nov" or "Mon 2 Nov". */
export function fmtDays(from: string, to: string, locale: Locale): string {
  const f = new Intl.DateTimeFormat(tag(locale), {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
  const one = (s: string) =>
    f
      .formatToParts(dayDate(s))
      .map((p) => (p.type === "literal" ? p.value.replace(",", "") : p.value))
      .join("");
  return from === to ? one(from) : `${one(from)} – ${one(to)}`;
}

/** "2 Nov" or "2–4 Nov", for chips and buttons. */
export function fmtShort(from: string, to: string, locale: Locale): string {
  const d = (s: string, o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(tag(locale), { ...o, timeZone: "Asia/Kolkata" }).format(dayDate(s));
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  if (from === to) return d(from, { day: "numeric", month: "short" });
  return sameMonth
    ? `${d(from, { day: "numeric" })}–${d(to, { day: "numeric", month: "short" })}`
    : `${d(from, { day: "numeric", month: "short" })} – ${d(to, { day: "numeric", month: "short" })}`;
}

/**
 * One tap on a calendar. `endNext` is true after the first tap. A tap before the start, a range that grows past
 * the booking limit, or one that crosses a day the caller marks unavailable restarts at the tapped day.
 */
export function pickDay(
  current: Range | null,
  day: string,
  endNext: boolean,
  unavailable: (day: string) => boolean,
): { range: Range; endNext: boolean } {
  const restart = { range: { from: day, to: day }, endNext: true };
  if (!endNext || !current || day < current.from) return restart;
  if (dayCount(current.from, day) > MAX_BOOKING_DAYS) return restart;
  for (let d = current.from; d <= day; d = addDays(d, 1)) if (unavailable(d)) return restart;
  return { range: { from: current.from, to: day }, endNext: false };
}

/** Cells of a month (YYYY-MM), Sunday first; null pads the first week and the last. */
export function monthGrid(month: string): (string | null)[] {
  const first = parseDay(`${month}-01`);
  const lead = new Date(first).getUTCDay();
  const dim = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= dim; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export const shiftMonth = (month: string, by: number) => {
  const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + by, 1));
  return d.toISOString().slice(0, 7);
};

/** The starting quantity for a booking (UI-SPEC §4.7.1); the server prices it again. */
export function estimateQty(unit: PriceUnit, acres: number | null, days: number, slot: Slot): number {
  if (unit === "day") return days * (slot === "full" ? 1 : 0.5);
  if (unit === "acre") return acres ?? 1;
  const cap = days * slotLength(slot);
  const wanted = acres === null ? 4 * days : Math.round((acres * HOURS_PER_ACRE) / 0.5) * 0.5;
  return Math.min(cap, Math.max(0.5, wanted));
}

/** wa.me link: digits only (no +), message encoded. */
export function whatsappLink(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
