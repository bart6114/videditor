ALTER TABLE "processing_jobs" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."job_type";--> statement-breakpoint
CREATE TYPE "public"."job_type" AS ENUM('transcription', 'analysis', 'cutting', 'delivery');--> statement-breakpoint
ALTER TABLE "processing_jobs" ALTER COLUMN "type" SET DATA TYPE "public"."job_type" USING "type"::"public"."job_type";