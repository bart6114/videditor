CREATE TABLE "project_machine_affinity" (
	"project_id" varchar(255) PRIMARY KEY NOT NULL,
	"machine_id" varchar(255) NOT NULL,
	"last_processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"job_count" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD COLUMN "preferred_machine_id" varchar(255);--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD COLUMN "claimed_by_machine_id" varchar(255);--> statement-breakpoint
ALTER TABLE "project_machine_affinity" ADD CONSTRAINT "project_machine_affinity_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_project_machine_affinity_machine_id" ON "project_machine_affinity" USING btree ("machine_id");--> statement-breakpoint
CREATE INDEX "idx_project_machine_affinity_last_processed_at" ON "project_machine_affinity" USING btree ("last_processed_at");--> statement-breakpoint
CREATE INDEX "idx_processing_jobs_preferred_machine_id" ON "processing_jobs" USING btree ("preferred_machine_id");