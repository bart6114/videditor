ALTER TABLE "scheduled_posts" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "scheduled_posts" ALTER COLUMN "status" SET DEFAULT 'scheduled'::text;--> statement-breakpoint
DROP TYPE "public"."scheduled_post_status";--> statement-breakpoint
CREATE TYPE "public"."scheduled_post_status" AS ENUM('scheduled', 'publishing', 'published', 'failed');--> statement-breakpoint
ALTER TABLE "scheduled_posts" ALTER COLUMN "status" SET DEFAULT 'scheduled'::"public"."scheduled_post_status";--> statement-breakpoint
ALTER TABLE "scheduled_posts" ALTER COLUMN "status" SET DATA TYPE "public"."scheduled_post_status" USING "status"::"public"."scheduled_post_status";