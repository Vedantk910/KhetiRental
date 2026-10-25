// Booking maths: slot windows, quotes, deposits, ratings. Pure, integer paise (UI-SPEC §4.7, F-15, F-18).
import type { Category, PriceUnit, Slot } from "@/lib/domain";
import { hourlyRate, type HpTier } from "@/lib/pricing-engine";

const IST_OFFSET = "+05:30";
export const SLOT_HOURS: Record<Slot, { from: number; to: number }> = {
  morning: { from: 7, to: 13 },
  afternoon: { from: 13, to: 19 },
  full: { from: 7, to: 19 },
};
export const MAX_BOOKING_DAYS = 30;
export const HOURS_PER_ACRE = 0.75;
const MAX_ACRES = 500;
export const REPLY_WINDOW_MS = 2 * 3600_000;
const FREE_CANCEL_MS = 24 * 3600_000;

const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Parses YYYY-MM-DD strictly (no 30 Feb); returns UTC-midnight ms. */
export function parseDay(s: string): number {
  if (!ISO_DATE.test(s)) throw new RangeError(`bad date ${s}`);
  const t = Date.parse(`${s}T00:00:00Z`);
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== s)
    throw new RangeError(`bad date ${s}`);
  return t;
}

export const addDays = (day: string, n: number) =>
  new Date(parseDay(day) + n * DAY_MS).toISOString().slice(0, 10);

/** Today's date in India. */
export const todayIst = (now = new Date()) =>
  new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);

const at = (day: string, hour: number) =>
  new Date(`${day}T${String(hour).padStart(2, "0")}:00:00${IST_OFFSET}`);

/**
 * The time the machine is held: the slot start on the first day to the slot end on the last.
 * shortcut: a multi-day morning booking also holds the afternoons in between (one tstzrange per booking);
 * split into one range per day if owners ask for half-day sharing across a range.
 */
export function bookingWindow(startDate: string, endDate: string, slot: Slot) {
  const days = (parseDay(endDate) - parseDay(startDate)) / DAY_MS + 1;
  if (days < 1) throw new RangeError("endDate is before startDate");
  return { start: at(startDate, SLOT_HOURS[slot].from), end: at(endDate, SLOT_HOURS[slot].to), days };
}

export const cancelDeadline = (start: Date) => new Date(start.getTime() - FREE_CANCEL_MS);

export const slotLength = (slot: Slot) => SLOT_HOURS[slot].to - SLOT_HOURS[slot].from;

// Deposit floors in rupees: 0.5 % of a typical asset value per tier (showcase contract §5).
const TRACTOR_FLOORS: [maxHp: number, rupees: number][] = [
  [35, 1950],
  [45, 3200],
  [55, 4900],
];
const TOP_TRACTOR_FLOOR = 8600;
const CATEGORY_FLOOR: Record<Exclude<Category, "tractor">, number> = {
  rotavator: 1000,
  seed_drill: 1000,
  sprayer: 500,
  trolley: 1000,
  thresher: 1500,
  baler: 1500,
  combine_harvester: 12_500,
};

export function depositFloorPaise(m: { category: Category; hp: number | null }): number {
  if (m.category !== "tractor") return CATEGORY_FLOOR[m.category] * 100;
  const hp = m.hp ?? 35;
  return (TRACTOR_FLOORS.find(([max]) => hp <= max)?.[1] ?? TOP_TRACTOR_FLOOR) * 100;
}

// What a new tractor of each tier costs, for the engine's wear term; and a typical diesel price (INR/litre).
const TIER_COST_INR: Record<HpTier, number> = {
  "35": 550_000,
  "45": 700_000,
  "55": 850_000,
  "75_4wd": 1_400_000,
};
const DIESEL_INR = 90;
const hpTier = (hp: number): HpTier => (hp <= 35 ? "35" : hp <= 45 ? "45" : hp <= 55 ? "55" : "75_4wd");

/** An estimate, not a market rate: the pricing engine's hourly rate for a tractor, ±10 %, per hour, acre or day. */
export function estimateHintRupees(m: { hp: number; ageYears: number; unit: PriceUnit }) {
  const tier = hpTier(m.hp);
  const hourly = hourlyRate(
    {
      hp: tier,
      ageYears: Math.min(Math.max(m.ageYears, 0), 40),
      acquisitionCostInr: TIER_COST_INR[tier],
      soil: "loam",
      season: "off_season",
    },
    DIESEL_INR,
  ).total;
  const perUnit = hourly * { hour: 1, acre: HOURS_PER_ACRE, day: slotLength("full") }[m.unit];
  const tens = (x: number) => Math.max(10, Math.round(x / 10) * 10);
  return { minRupees: tens(perUnit * 0.9), maxRupees: tens(perUnit * 1.1) };
}

export interface PricedMachine {
  category: Category;
  hp: number | null;
  priceUnit: PriceUnit;
  pricePaise: number;
  dieselIncluded: boolean;
}

export interface Quote {
  qty: number;
  unit: PriceUnit;
  ratePaise: number;
  rentPaise: number;
  depositPaise: number;
  dieselIncluded: boolean;
  totalPaise: number;
}

const rupee = (paise: number) => Math.round(paise / 100) * 100;

/**
 * Server-side quote; never trust client maths (UI-SPEC §12.2).
 * qty: hours (per hour) or acres (per acre), in 0.5 steps; per day it is the day count (half-day slots count half).
 * Deposit (F-15): jobs under 8 h pay min(floor, 25 % of rent); longer jobs max(15 % of rent, floor).
 * The deposit is refundable and shown apart; the amount paid is the rent (UI-SPEC §4.7.2 total row).
 */
export function quote(m: PricedMachine, req: { days: number; slot: Slot; qty?: number }): Quote {
  const slotHours = slotLength(req.slot);
  let qty: number;
  let jobHours: number;
  if (m.priceUnit === "day") {
    qty = req.days * (req.slot === "full" ? 1 : 0.5);
    jobHours = req.days * slotHours;
  } else {
    const max = m.priceUnit === "hour" ? req.days * slotHours : MAX_ACRES;
    qty = req.qty ?? (m.priceUnit === "hour" ? Math.min(4 * req.days, max) : 1);
    if (!(qty > 0 && qty <= max && Number.isInteger(qty * 2)))
      throw new RangeError(`qty must be 0.5–${max} in 0.5 steps`);
    jobHours = m.priceUnit === "hour" ? qty : qty * HOURS_PER_ACRE;
  }
  const rentPaise = rupee(m.pricePaise * qty);
  const floor = depositFloorPaise(m);
  const depositPaise = rupee(
    jobHours < 8 ? Math.min(floor, rentPaise * 0.25) : Math.max(rentPaise * 0.15, floor),
  );
  return {
    qty,
    unit: m.priceUnit,
    ratePaise: m.pricePaise,
    rentPaise,
    depositPaise,
    dieselIncluded: m.dieselIncluded,
    totalPaise: rentPaise,
  };
}

const RATING_C = 5;
const RATING_M = 4.2;
/** F-18: (C·m + Σr) / (C + n). */
export const bayesianRating = (sum: number, n: number) => (RATING_C * RATING_M + sum) / (RATING_C + n);

/** S-07: never return exact distances. */
export const roundKm = (km: number) => Math.round(km * 2) / 2;
