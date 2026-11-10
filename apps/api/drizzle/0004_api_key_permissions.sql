ALTER TABLE "api_keys" ADD COLUMN "prefix" varchar(32) DEFAULT 'rl_live_' NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "permissions" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "last_used_at" timestamp with time zone;