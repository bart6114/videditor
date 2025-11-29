CREATE TYPE "public"."scheduled_post_status" AS ENUM('scheduled', 'publishing', 'published', 'failed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."social_platform" AS ENUM('youtube', 'tiktok', 'instagram');--> statement-breakpoint
ALTER TYPE "public"."job_type" ADD VALUE 'youtube_publish';--> statement-breakpoint
CREATE TABLE "scheduled_posts" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"short_id" varchar(255) NOT NULL,
	"social_account_id" varchar(255) NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" "scheduled_post_status" DEFAULT 'scheduled' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"platform_post_id" varchar(255),
	"platform_url" text,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"scheduled_by_id" varchar(255),
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"platform" "social_platform" NOT NULL,
	"channel_id" varchar(255),
	"channel_title" varchar(255),
	"channel_thumbnail" text,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb,
	"connected_by_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_org_platform" UNIQUE("organization_id","platform")
);
--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_short_id_shorts_id_fk" FOREIGN KEY ("short_id") REFERENCES "public"."shorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_social_account_id_social_accounts_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_scheduled_by_id_users_id_fk" FOREIGN KEY ("scheduled_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_connected_by_id_users_id_fk" FOREIGN KEY ("connected_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_scheduled_posts_org_id" ON "scheduled_posts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_scheduled_posts_short_id" ON "scheduled_posts" USING btree ("short_id");--> statement-breakpoint
CREATE INDEX "idx_scheduled_posts_status_scheduled" ON "scheduled_posts" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "idx_scheduled_posts_scheduled_for" ON "scheduled_posts" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "idx_social_accounts_org_platform" ON "social_accounts" USING btree ("organization_id","platform");