-- KhetiRental core schema (UI-SPEC §12.1, REVIEW F-09). Hand-written: Drizzle can't express
-- EXCLUDE, CHECK or partial indexes. Money is integer paise. Times are timestamptz.
CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text CHECK (char_length("name") BETWEEN 1 AND 80),
	"email" text UNIQUE CHECK ("email" = lower("email")),
	"email_verified" timestamp with time zone,
	"image" text,
	"phone" text UNIQUE CHECK ("phone" ~ '^\+91[6-9][0-9]{9}$'),
	"phone_verified_at" timestamp with time zone,
	"password_hash" text,
	"locale" text DEFAULT 'en' NOT NULL CHECK ("locale" IN ('mr', 'hi', 'en')),
	"roles" text[] DEFAULT '{renter}' NOT NULL
		CHECK (cardinality("roles") >= 1 AND "roles" <@ ARRAY['renter', 'owner', 'admin']),
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider", "provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" ("user_id");
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier", "token")
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"phone" text PRIMARY KEY NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL CHECK ("attempts" >= 0),
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "machines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL REFERENCES "users"("id"),
	"category" text NOT NULL CHECK ("category" IN
		('tractor', 'rotavator', 'seed_drill', 'sprayer', 'combine_harvester', 'thresher', 'trolley')),
	"make" text NOT NULL CHECK (char_length("make") BETWEEN 1 AND 40),
	"model" text NOT NULL CHECK (char_length("model") BETWEEN 1 AND 40),
	"hp" integer CHECK ("hp" BETWEEN 10 AND 200),
	"year" integer NOT NULL CHECK ("year" BETWEEN 1970 AND 2100),
	"hour_meter" integer CHECK ("hour_meter" >= 0),
	"last_serviced" date,
	"attachments" text[] DEFAULT '{}' NOT NULL CHECK ("attachments" <@
		ARRAY['plough', 'cultivator', 'rotavator', 'seed_drill', 'sprayer', 'harvester', 'trolley']),
	"location" geography(Point, 4326) NOT NULL,
	"village" text NOT NULL CHECK (char_length("village") BETWEEN 2 AND 60),
	"pin" text NOT NULL CHECK ("pin" ~ '^[1-9][0-9]{5}$'),
	"price_unit" text NOT NULL CHECK ("price_unit" IN ('hour', 'acre', 'day')),
	"price_paise" integer NOT NULL CHECK ("price_paise" > 0 AND "price_paise" % 100 = 0),
	"alt_price_unit" text CHECK ("alt_price_unit" IN ('hour', 'acre', 'day')),
	"alt_price_paise" integer CHECK ("alt_price_paise" > 0),
	"operator_included" boolean DEFAULT true NOT NULL,
	"diesel_included" boolean DEFAULT true NOT NULL,
	"rc_status" text DEFAULT 'none' NOT NULL CHECK ("rc_status" IN ('none', 'pending', 'checked', 'rejected')),
	"active" boolean DEFAULT true NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "machines_location_gix" ON "machines" USING gist ("location");
--> statement-breakpoint
CREATE INDEX "machines_owner_idx" ON "machines" ("owner_id");
--> statement-breakpoint
CREATE TABLE "machine_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"machine_id" uuid NOT NULL REFERENCES "machines"("id") ON DELETE CASCADE,
	"url" text NOT NULL,
	"kind" text NOT NULL CHECK ("kind" IN ('front', 'side', 'meter', 'extra', 'rc')),
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "machine_photos_machine_idx" ON "machine_photos" ("machine_id");
--> statement-breakpoint
CREATE TABLE "machine_blocks" (
	"machine_id" uuid NOT NULL REFERENCES "machines"("id") ON DELETE CASCADE,
	"day" date NOT NULL,
	CONSTRAINT "machine_blocks_machine_id_day_pk" PRIMARY KEY("machine_id", "day")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL CHECK ("code" ~ '^KR-[0-9]{4}$'),
	"machine_id" uuid NOT NULL REFERENCES "machines"("id"),
	"renter_id" uuid NOT NULL REFERENCES "users"("id"),
	"during" tstzrange NOT NULL CHECK (NOT isempty("during") AND NOT lower_inf("during") AND NOT upper_inf("during")),
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"slot" text NOT NULL CHECK ("slot" IN ('morning', 'afternoon', 'full')),
	"est_qty" numeric(8, 1) NOT NULL CHECK ("est_qty" > 0),
	"unit" text NOT NULL CHECK ("unit" IN ('hour', 'acre', 'day')),
	"rate_paise" integer NOT NULL CHECK ("rate_paise" > 0),
	"rent_paise" integer NOT NULL CHECK ("rent_paise" >= 0),
	"deposit_paise" integer NOT NULL CHECK ("deposit_paise" >= 0),
	"diesel_included" boolean NOT NULL,
	"total_paise" integer NOT NULL CHECK ("total_paise" >= 0),
	"status" text DEFAULT 'REQUESTED' NOT NULL CHECK ("status" IN
		('REQUESTED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DECLINED', 'EXPIRED')),
	"reply_by" timestamp with time zone NOT NULL,
	"idempotency_key" text NOT NULL UNIQUE,
	"decline_reason" text,
	"cancelled_by" uuid REFERENCES "users"("id"),
	"cancel_reason" text,
	"confirmed_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CHECK ("end_date" >= "start_date"),
	-- F-09: the database, not application code, makes double booking impossible.
	CONSTRAINT "bookings_no_overlap" EXCLUDE USING gist ("machine_id" WITH =, "during" WITH &&)
		WHERE ("status" IN ('REQUESTED', 'CONFIRMED', 'IN_PROGRESS'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_active_code_uq" ON "bookings" ("code")
	WHERE "status" IN ('REQUESTED', 'CONFIRMED', 'IN_PROGRESS');
--> statement-breakpoint
CREATE INDEX "bookings_renter_idx" ON "bookings" ("renter_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX "bookings_machine_idx" ON "bookings" ("machine_id");
--> statement-breakpoint
CREATE INDEX "bookings_reply_by_idx" ON "bookings" ("reply_by") WHERE "status" = 'REQUESTED';
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
	"method" text NOT NULL CHECK ("method" IN ('upi', 'card', 'net', 'cash')),
	"status" text NOT NULL CHECK ("status" IN ('paid_demo', 'pay_later', 'failed')),
	"amount_paise" integer NOT NULL CHECK ("amount_paise" > 0),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "payments_one_settled_uq" ON "payments" ("booking_id") WHERE "status" IN ('paid_demo', 'pay_later');
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
	"author_id" uuid NOT NULL REFERENCES "users"("id"),
	"target_user_id" uuid NOT NULL REFERENCES "users"("id"),
	"stars" smallint NOT NULL CHECK ("stars" BETWEEN 1 AND 5),
	"text" text CHECK (char_length("text") <= 1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	UNIQUE ("booking_id", "author_id")
);
--> statement-breakpoint
CREATE INDEX "reviews_target_idx" ON "reviews" ("target_user_id");
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"type" text NOT NULL,
	"booking_id" uuid REFERENCES "bookings"("id") ON DELETE SET NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" ("user_id", "created_at" DESC);
--> statement-breakpoint
CREATE TABLE "problem_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
	"reporter_id" uuid NOT NULL REFERENCES "users"("id"),
	"type" text NOT NULL,
	"text" text CHECK (char_length("text") <= 1000),
	"photos" text[] DEFAULT '{}' NOT NULL CHECK (cardinality("photos") <= 3),
	"status" text DEFAULT 'open' NOT NULL CHECK ("status" IN ('open', 'resolved')),
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pin_codes" (
	"pin" text NOT NULL CHECK ("pin" ~ '^[1-9][0-9]{5}$'),
	"office" text NOT NULL,
	"village" text NOT NULL,
	"district" text NOT NULL,
	"state" text NOT NULL,
	"location" geography(Point, 4326) NOT NULL,
	"is_sample" boolean DEFAULT true NOT NULL,
	CONSTRAINT "pin_codes_pin_office_pk" PRIMARY KEY("pin", "office")
);
--> statement-breakpoint
CREATE INDEX "pin_codes_village_idx" ON "pin_codes" (lower("village"));
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
