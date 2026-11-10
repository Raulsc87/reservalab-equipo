ALTER TABLE "spaces" ADD COLUMN "opens_at" time DEFAULT '07:00:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "spaces" ADD COLUMN "closes_at" time DEFAULT '22:00:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_valid_schedule" CHECK ("spaces"."closes_at" > "spaces"."opens_at");