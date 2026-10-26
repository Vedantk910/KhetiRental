CREATE TABLE "listing_drafts" (
	"owner_id" uuid PRIMARY KEY NOT NULL,
	"step" smallint DEFAULT 1 NOT NULL,
	"data" jsonb DEFAULT '{}' NOT NULL,
	"photos" jsonb DEFAULT '{}' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listing_drafts" ADD CONSTRAINT "listing_drafts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "listing_drafts" ADD CONSTRAINT "listing_drafts_step_check" CHECK ("step" BETWEEN 1 AND 4);
