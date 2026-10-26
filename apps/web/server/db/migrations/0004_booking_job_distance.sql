ALTER TABLE "bookings" ADD COLUMN "job" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "renter_distance_km" numeric(6, 1);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_job_check" CHECK ("job" IS NULL OR "job" IN
	('plough', 'rotavate', 'sow', 'spray', 'harvest', 'transport'));
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_renter_distance_check" CHECK ("renter_distance_km" IS NULL OR
	("renter_distance_km" >= 0 AND "renter_distance_km" <= 20100));
