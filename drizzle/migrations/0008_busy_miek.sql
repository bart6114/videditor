ALTER TABLE "users" ADD COLUMN "completed_tours" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
UPDATE "users" SET "completed_tours" = '{"projects_overview": true}'::jsonb WHERE "onboarding_completed_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "onboarding_completed_at";