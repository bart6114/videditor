CREATE TYPE "public"."asset_status" AS ENUM('uploading', 'ready', 'processing', 'completed', 'error');--> statement-breakpoint
CREATE TYPE "public"."asset_type" AS ENUM('long_form', 'short_form');--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"created_by_id" varchar(255),
	"asset_type" "asset_type" NOT NULL,
	"title" text NOT NULL,
	"source_object_key" text NOT NULL,
	"source_bucket" text NOT NULL,
	"thumbnail_url" text,
	"duration_seconds" double precision,
	"file_size_bytes" bigint,
	"status" "asset_status" DEFAULT 'uploading' NOT NULL,
	"error_message" text,
	"source_asset_id" varchar(255),
	"social_content" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "source_object_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "source_bucket" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD COLUMN "media_asset_id" varchar(255);--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD COLUMN "media_asset_id" varchar(255);--> statement-breakpoint
ALTER TABLE "transcriptions" ADD COLUMN "media_asset_id" varchar(255);--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_source_asset_id_media_assets_id_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_media_assets_project_id" ON "media_assets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_media_assets_organization_id" ON "media_assets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_media_assets_asset_type" ON "media_assets" USING btree ("asset_type");--> statement-breakpoint
CREATE INDEX "idx_media_assets_status" ON "media_assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_media_assets_source_asset_id" ON "media_assets" USING btree ("source_asset_id");--> statement-breakpoint
CREATE INDEX "idx_media_assets_created_at" ON "media_assets" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcriptions" ADD CONSTRAINT "transcriptions_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_processing_jobs_media_asset_id" ON "processing_jobs" USING btree ("media_asset_id");--> statement-breakpoint
CREATE INDEX "idx_scheduled_posts_media_asset_id" ON "scheduled_posts" USING btree ("media_asset_id");--> statement-breakpoint
CREATE INDEX "idx_transcriptions_media_asset_id" ON "transcriptions" USING btree ("media_asset_id");