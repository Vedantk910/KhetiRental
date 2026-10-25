// zod schemas for every API input (C-06). Strict objects: unknown keys (e.g. renterId) are rejected.
import { z } from "zod";
import {
  ATTACHMENTS,
  CATEGORIES,
  DECLINE_REASONS,
  JOBS,
  PAYMENT_METHODS,
  PHOTO_KINDS,
  PRICE_UNITS,
  RADII_KM,
  SLOTS,
  SORTS,
} from "@/lib/domain";
import { toAsciiNumber } from "@/lib/format";
import { MAX_BOOKING_DAYS, parseDay } from "./pricing";

const DEVA = /[०-९]/g;
/** Devanagari digits → ASCII; drops spaces and dashes people type into numbers. */
const digits = (s: string) => s.replace(DEVA, (d) => String(d.charCodeAt(0) - 0x0966)).replace(/[\s-]/g, "");

export const phoneSchema = z
  .string()
  .max(20)
  .transform((s) => digits(s).replace(/^(\+91|0)(?=\d{10}$)/, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "phone"))
  .transform((s) => `+91${s}`);

export const emailSchema = z
  .string()
  .max(254)
  .transform((s) => s.trim().toLowerCase())
  .pipe(z.email());
export const passwordSchema = z.string().min(8).max(128);
export const nameSchema = z
  .string()
  .max(200)
  .transform((s) => s.trim())
  .pipe(z.string().min(2).max(80));
export const otpCodeSchema = z
  .string()
  .max(12)
  .transform(digits)
  .pipe(z.string().regex(/^\d{6}$/));
export const signupRolesSchema = z
  .array(z.enum(["renter", "owner"]))
  .min(1)
  .max(2);

const safeDay = (s: string) => {
  try {
    return parseDay(s);
  } catch {
    return NaN;
  }
};
const day = z.string().refine((s) => !Number.isNaN(safeDay(s)), "date");
// Object refinements still run after a field fails, so this must not throw; NaN fails every comparison.
const daySpan = (a: string, b: string) => (safeDay(b) - safeDay(a)) / 86_400_000;

/** A number from a query string or JSON, Devanagari digits allowed; NaN/Infinity rejected. */
const num = z.union([z.number(), z.string().max(32).transform(toAsciiNumber)]).pipe(z.number());
const pin = z
  .string()
  .max(12)
  .transform(digits)
  .pipe(z.string().regex(/^[1-9]\d{5}$/, "pin"));

export const searchSchema = z
  .object({
    pin: pin.optional(),
    village: z.string().trim().min(2).max(60).optional(),
    lat: num.pipe(z.number().min(-90).max(90)).optional(),
    lng: num.pipe(z.number().min(-180).max(180)).optional(),
    radius: num
      .pipe(
        z.union(RADII_KM.map((r) => z.literal(r)) as [z.ZodLiteral<5>, z.ZodLiteral<10>, z.ZodLiteral<25>]),
      )
      .optional(),
    job: z.enum(JOBS).optional(),
    driver: z
      .enum(["1", "true"])
      .transform(() => true as const)
      .optional(),
    map: z
      .literal("1")
      .transform(() => true as const)
      .optional(),
    from: day.optional(),
    to: day.optional(),
    slot: z.enum(SLOTS).default("full"),
    sort: z.enum(SORTS).default("nearest"),
    cursor: z
      .string()
      .regex(/^\d{1,5}$/)
      .optional(),
    limit: num.pipe(z.number().int().min(1).max(50)).default(20),
  })
  .strict()
  .refine((q) => q.pin ?? q.village ?? (q.lat !== undefined && q.lng !== undefined), {
    message: "place",
    path: ["pin"],
  })
  .refine((q) => (q.from === undefined) === (q.to === undefined), { message: "dates", path: ["to"] })
  .refine(
    (q) => !q.from || !q.to || (daySpan(q.from, q.to) >= 0 && daySpan(q.from, q.to) < MAX_BOOKING_DAYS),
    {
      message: "dates",
      path: ["to"],
    },
  )
  .transform(({ radius, ...q }) => ({ ...q, radiusKm: radius ?? 10 }));
export type SearchQuery = z.infer<typeof searchSchema>;

/** Autocomplete text, or a GPS fix for "Near you". Never both. */
export const placesSchema = z.union([
  z
    .object({
      q: z
        .string()
        .min(1)
        .max(60)

        .transform((s) =>
          s.replace(DEVA, (d) => String(d.charCodeAt(0) - 0x0966)).replace(/[\u0000-\u001f]/g, ""),
        ),
    })
    .strict(),
  z
    .object({ lat: num.pipe(z.number().min(-90).max(90)), lng: num.pipe(z.number().min(-180).max(180)) })
    .strict(),
]);
export const cursorSchema = z.object({
  cursor: z
    .string()
    .regex(/^\d{1,5}$/)
    .optional(),
});
/** "KR-4821", any case. */
export const bookingCodeSchema = z
  .string()
  .regex(/^KR-\d{4}$/i)
  .transform((s) => s.toUpperCase());

export const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9_-]{8,100}$/);

const qty = z.number().positive().max(10_000);

export const bookingCreateSchema = z
  .object({
    machineId: z.uuid(),
    startDate: day,
    endDate: day,
    slot: z.enum(SLOTS),
    qty: qty.optional(),
  })
  .strict()
  .refine((b) => daySpan(b.startDate, b.endDate) >= 0, { message: "dates", path: ["endDate"] })
  .refine((b) => daySpan(b.startDate, b.endDate) < MAX_BOOKING_DAYS, { message: "dates", path: ["endDate"] });

const note = (max: number) =>
  // NUL breaks Postgres text; other control characters have no place in a note.
  z
    .string()
    .max(max)
    .transform((v) => v.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim());
export const cancelSchema = z.object({ reason: note(200).optional() }).strict();
export const declineSchema = z.object({ reason: z.enum(DECLINE_REASONS) }).strict();
export const paySchema = z
  .object({ method: z.enum(PAYMENT_METHODS), amountPaise: z.number().int().positive().max(1e10) })
  .strict();

const rupees = z.number().int().min(1).max(100_000);
const machineFields = {
  category: z.enum(CATEGORIES),
  make: z.string().trim().min(1).max(40),
  model: z.string().trim().min(1).max(40),
  hp: z.number().int().min(10).max(200).nullable().optional(),
  year: z.number().int().min(1970).max(2100),
  hourMeter: z.number().int().min(0).max(100_000).nullable().optional(),
  lastServiced: day.nullable().optional(),
  attachments: z.array(z.enum(ATTACHMENTS)).max(ATTACHMENTS.length).default([]),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  village: z.string().trim().min(2).max(60),
  pin,
  priceUnit: z.enum(PRICE_UNITS),
  priceRupees: rupees,
  operatorIncluded: z.boolean().default(true),
  dieselIncluded: z.boolean().default(true),
  active: z.boolean().optional(),
};
const toPaise = <T extends { priceRupees?: number }>({ priceRupees, ...m }: T) => ({
  ...m,
  ...(priceRupees === undefined ? {} : { pricePaise: priceRupees * 100 }),
});
export const machineCreateSchema = z
  .object(machineFields)
  .strict()
  .transform(({ priceRupees, ...m }) => ({ ...m, pricePaise: priceRupees * 100 }));
export const machinePatchSchema = z
  .object(machineFields)
  .partial()
  .strict()
  .refine((p) => (p.lat === undefined) === (p.lng === undefined), {
    message: "lat and lng go together",
    path: ["lng"],
  })
  .transform(toPaise);
export type MachineCreate = z.infer<typeof machineCreateSchema>;
export type MachinePatch = z.infer<typeof machinePatchSchema>;

export const blocksSchema = z.object({ days: z.array(day).min(1).max(62), blocked: z.boolean() }).strict();
export const photoKindSchema = z.enum(PHOTO_KINDS);
export const markReadSchema = z
  .object({ ids: z.array(z.uuid()).max(200).optional(), all: z.literal(true).optional() })
  .strict()
  .refine((b) => b.ids ?? b.all, { message: "ids or all", path: ["ids"] });
export const problemFieldsSchema = z.object({
  type: z.string().max(40),
  text: note(1000).optional(),
});

export const otpSendSchema = z.object({ phone: phoneSchema }).strict();
export const signupSchema = z
  .object({ name: nameSchema, email: emailSchema, password: passwordSchema, roles: signupRolesSchema })
  .strict();
export const forgotSchema = z.object({ email: emailSchema }).strict();
export const resetSchema = z
  .object({ token: z.string().regex(/^[A-Za-z0-9_-]{20,100}$/), password: passwordSchema })
  .strict();

export const monthSchema = z.string().regex(/^20[2-5]\d-(0[1-9]|1[0-2])$/);
export const priceHintSchema = z
  .object({
    category: z.enum(CATEGORIES),
    unit: z.enum(PRICE_UNITS),
    lat: num.pipe(z.number().min(-90).max(90)),
    lng: num.pipe(z.number().min(-180).max(180)),
  })
  .strict();
export const emptySchema = z.object({}).strict();
export const rcDecisionSchema = z.object({ decision: z.enum(["checked", "rejected"]) }).strict();
export const problemReviewSchema = z
  .object({ status: z.enum(["open", "resolved"]), note: note(1000).optional() })
  .strict();
export const userSearchSchema = z.object({ q: z.string().trim().max(60).default("") }).strict();
export const userRolesSchema = z
  .object({
    roles: z
      .array(z.enum(["renter", "owner", "admin"]))
      .min(1)
      .max(6)
      .transform((r) => [...new Set(r)]),
  })
  .strict();

/** Settings (UI-SPEC §4.15). Strict: no user id in any body, the cookie decides who is changed. */
export const deleteAccountSchema = z.object({ confirm: z.literal("DELETE") }).strict();
export const profileSchema = z.object({ name: nameSchema }).strict();
export const phoneChangeSchema = z.object({ phone: phoneSchema, code: z.string().max(12) }).strict();
export const rolesSchema = z.object({ renter: z.boolean(), owner: z.boolean() }).strict();
