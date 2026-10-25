// Drizzle schema (UI-SPEC §12.1, REVIEW F-09). The SQL in ./migrations is the source of truth for
// constraints Drizzle can't express (EXCLUDE, CHECKs, partial indexes); keep the two in step.
import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** PostGIS point; read it back with ST_X/ST_Y in SQL. */
const geography = customType<{ data: string; driverData: string }>({
  dataType: () => "geography(Point,4326)",
});
/** tstzrange as Postgres prints it, e.g. ["2026-11-02 07:00:00+05:30","2026-11-02 19:00:00+05:30"). */
const tstzrange = customType<{ data: string }>({ dataType: () => "tstzrange" });

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: ts("email_verified"),
  image: text("image"),
  phone: text("phone").unique(),
  phoneVerifiedAt: ts("phone_verified_at"),
  passwordHash: text("password_hash"),
  locale: text("locale").notNull().default("en"),
  roles: text("roles")
    .array()
    .notNull()
    .default(sql`'{renter}'`),
  isSample: boolean("is_sample").notNull().default(false),
  /** Set when the person deleted their account: the row stays (bookings point at it) with no personal data. */
  deletedAt: ts("deleted_at"),
  createdAt: createdAt(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

/** sessionToken holds sha256(cookie value), never the cookie itself. */
export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: ts("expires").notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: ts("expires").notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const otpCodes = pgTable("otp_codes", {
  phone: text("phone").primaryKey(),
  codeHash: text("code_hash").notNull(),
  expiresAt: ts("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  sentAt: ts("sent_at").notNull().defaultNow(),
});

export const machines = pgTable(
  "machines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id),
    category: text("category").notNull(),
    make: text("make").notNull(),
    model: text("model").notNull(),
    hp: integer("hp"),
    year: integer("year").notNull(),
    hourMeter: integer("hour_meter"),
    lastServiced: date("last_serviced"),
    attachments: text("attachments")
      .array()
      .notNull()
      .default(sql`'{}'`),
    location: geography("location").notNull(),
    village: text("village").notNull(),
    pin: text("pin").notNull(),
    priceUnit: text("price_unit").notNull(),
    pricePaise: integer("price_paise").notNull(),
    altPriceUnit: text("alt_price_unit"),
    altPricePaise: integer("alt_price_paise"),
    operatorIncluded: boolean("operator_included").notNull().default(true),
    dieselIncluded: boolean("diesel_included").notNull().default(true),
    rcStatus: text("rc_status").notNull().default("none"),
    active: boolean("active").notNull().default(true),
    isSample: boolean("is_sample").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("machines_location_gix").using("gist", t.location),
    index("machines_owner_idx").on(t.ownerId),
  ],
);

export const machinePhotos = pgTable("machine_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  machineId: uuid("machine_id")
    .notNull()
    .references(() => machines.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  kind: text("kind").notNull(),
  sort: integer("sort").notNull().default(0),
  createdAt: createdAt(),
});

export const machineBlocks = pgTable(
  "machine_blocks",
  {
    machineId: uuid("machine_id")
      .notNull()
      .references(() => machines.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
  },
  (t) => [primaryKey({ columns: [t.machineId, t.day] })],
);

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull(),
  machineId: uuid("machine_id")
    .notNull()
    .references(() => machines.id),
  renterId: uuid("renter_id")
    .notNull()
    .references(() => users.id),
  during: tstzrange("during").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  slot: text("slot").notNull(),
  estQty: numeric("est_qty", { precision: 8, scale: 1 }).notNull(),
  unit: text("unit").notNull(),
  ratePaise: integer("rate_paise").notNull(),
  rentPaise: integer("rent_paise").notNull(),
  depositPaise: integer("deposit_paise").notNull(),
  dieselIncluded: boolean("diesel_included").notNull(),
  totalPaise: integer("total_paise").notNull(),
  status: text("status").notNull().default("REQUESTED"),
  replyBy: ts("reply_by").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  declineReason: text("decline_reason"),
  cancelledBy: uuid("cancelled_by").references(() => users.id),
  cancelReason: text("cancel_reason"),
  confirmedAt: ts("confirmed_at"),
  closedAt: ts("closed_at"),
  isSample: boolean("is_sample").notNull().default(false),
  createdAt: createdAt(),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  method: text("method").notNull(),
  status: text("status").notNull(),
  amountPaise: integer("amount_paise").notNull(),
  createdAt: createdAt(),
});

export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id),
  targetUserId: uuid("target_user_id")
    .notNull()
    .references(() => users.id),
  stars: smallint("stars").notNull(),
  text: text("text"),
  createdAt: createdAt(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
  readAt: ts("read_at"),
  createdAt: createdAt(),
});

export const problemReports = pgTable("problem_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  reporterId: uuid("reporter_id")
    .notNull()
    .references(() => users.id),
  type: text("type").notNull(),
  text: text("text"),
  photos: text("photos")
    .array()
    .notNull()
    .default(sql`'{}'`),
  status: text("status").notNull().default("open"),
  note: text("note"),
  createdAt: createdAt(),
});

export const pinCodes = pgTable(
  "pin_codes",
  {
    pin: text("pin").notNull(),
    office: text("office").notNull(),
    village: text("village").notNull(),
    district: text("district").notNull(),
    state: text("state").notNull(),
    location: geography("location").notNull(),
    isSample: boolean("is_sample").notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.pin, t.office] })],
);

/** Fixed-window counters shared by every server instance (S-08). */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: ts("window_start").notNull(),
  count: integer("count").notNull(),
});
