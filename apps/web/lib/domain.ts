// Shared vocabulary for machines, bookings and jobs (UI-SPEC §12). Pure; safe on client and server.

export type Role = "renter" | "owner" | "admin";

export const CATEGORIES = [
  "tractor",
  "rotavator",
  "seed_drill",
  "sprayer",
  "combine_harvester",
  "thresher",
  "trolley",
  "baler",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const ATTACHMENTS = [
  "plough",
  "cultivator",
  "rotavator",
  "seed_drill",
  "sprayer",
  "harvester",
  "trolley",
] as const;
export type Attachment = (typeof ATTACHMENTS)[number];

export const PRICE_UNITS = ["hour", "acre", "day"] as const;
export type PriceUnit = (typeof PRICE_UNITS)[number];

export const SLOTS = ["morning", "afternoon", "full"] as const;
export type Slot = (typeof SLOTS)[number];

export type BookingStatus =
  "REQUESTED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "DECLINED" | "EXPIRED";
/** Statuses that hold the machine; the DB EXCLUDE constraint uses the same list. */
export const ACTIVE_STATUSES = ["REQUESTED", "CONFIRMED", "IN_PROGRESS"] as const;

export const PAYMENT_METHODS = ["upi", "card", "net", "cash"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PHOTO_KINDS = ["front", "side", "meter", "extra", "rc"] as const;

/** The listing wizard's photo places; the three extras all become kind "extra". */
export const PHOTO_KEYS = ["front", "side", "meter", "extra1", "extra2", "extra3", "rc"] as const;
export type PhotoKey = (typeof PHOTO_KEYS)[number];

export const DECLINE_REASONS = ["busy", "too_far", "not_ready", "other"] as const;

export const PROBLEM_TYPES = {
  renter: ["no_show", "broke_down", "damage", "overcharged", "other"],
  owner: ["renter_no_show", "damage", "late_return", "not_paid", "other"],
} as const;

export const JOBS = ["plough", "rotavate", "sow", "spray", "harvest", "transport"] as const;
export type Job = (typeof JOBS)[number];

/** UI-SPEC §12.3: categories that do the job, and the attachments that qualify a tractor. */
export const JOB_MACHINES: Record<Job, { categories: Category[]; attachments: Attachment[] }> = {
  plough: { categories: [], attachments: ["plough", "cultivator"] },
  rotavate: { categories: ["rotavator"], attachments: ["rotavator"] },
  sow: { categories: ["seed_drill"], attachments: ["seed_drill"] },
  spray: { categories: ["sprayer"], attachments: ["sprayer"] },
  harvest: { categories: ["combine_harvester", "thresher", "baler"], attachments: ["harvester"] },
  transport: { categories: ["trolley"], attachments: ["trolley"] },
};

export const RADII_KM = [5, 10, 25] as const;
export const SORTS = ["nearest", "cheapest", "top_rated"] as const;

/** Our fee on the rent (UI-SPEC §4.11); the owner keeps the rest. */
const TAKE_RATE = 0.135;
/** What the owner keeps of a rent, in whole rupees (paise, a multiple of 100). */
export const keepPaise = (rentPaise: number) => Math.round((rentPaise * (1 - TAKE_RATE)) / 100) * 100;
