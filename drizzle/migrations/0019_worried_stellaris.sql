DROP INDEX "idx_projects_status";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "error_message";--> statement-breakpoint
DROP TYPE "public"."project_status";