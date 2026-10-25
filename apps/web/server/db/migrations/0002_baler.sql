ALTER TABLE "machines" DROP CONSTRAINT "machines_category_check";
--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_category_check" CHECK ("category" IN
	('tractor', 'rotavator', 'seed_drill', 'sprayer', 'combine_harvester', 'thresher', 'trolley', 'baler'));
