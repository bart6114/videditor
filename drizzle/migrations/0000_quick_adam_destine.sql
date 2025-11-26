CREATE TYPE "public"."credit_transaction_type" AS ENUM('purchase', 'auto_topup', 'usage', 'refund', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."job_type" AS ENUM('thumbnail', 'transcription', 'analysis', 'short_processing');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('uploading', 'ready', 'queued', 'processing', 'transcribing', 'analyzing', 'completed', 'error');--> statement-breakpoint
CREATE TYPE "public"."short_status" AS ENUM('pending', 'processing', 'completed', 'error');--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255),
	"performed_by_id" varchar(255),
	"type" "credit_transaction_type" NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"description" text,
	"stripe_payment_intent_id" varchar(255),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_invites" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"code" varchar(32) NOT NULL,
	"created_by_id" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_invites_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_org_member" UNIQUE("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255),
	"credits" integer DEFAULT 50 NOT NULL,
	"stripe_customer_id" varchar(255),
	"auto_top_up_enabled" boolean DEFAULT false NOT NULL,
	"auto_top_up_threshold" integer DEFAULT 5,
	"auto_top_up_amount" integer DEFAULT 10,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "processing_jobs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"project_id" varchar(255),
	"short_id" varchar(255),
	"type" "job_type" NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"payload" jsonb,
	"result" jsonb,
	"progress" jsonb,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255),
	"created_by_id" varchar(255),
	"title" text NOT NULL,
	"source_object_key" text NOT NULL,
	"source_bucket" text NOT NULL,
	"thumbnail_url" text,
	"duration_seconds" double precision,
	"file_size_bytes" bigint,
	"status" "project_status" DEFAULT 'uploading' NOT NULL,
	"priority" real DEFAULT 0,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "shorts" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"analysis_job_id" varchar(255),
	"transcription_slice" text NOT NULL,
	"start_time" double precision NOT NULL,
	"end_time" double precision NOT NULL,
	"output_object_key" text,
	"thumbnail_url" text,
	"status" "short_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"metadata" jsonb,
	"social_content" jsonb,
	"tasks" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcriptions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"text" text NOT NULL,
	"segments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"language" varchar(16),
	"duration_seconds" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"email" varchar(255),
	"full_name" varchar(255),
	"image_url" text,
	"default_custom_prompt" text,
	"default_social_platforms" jsonb DEFAULT '[]'::jsonb,
	"default_avoid_overlap" boolean DEFAULT false,
	"default_preferred_length" integer DEFAULT 45,
	"default_max_length" integer DEFAULT 60,
	"default_organization_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_performed_by_id_users_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_short_id_shorts_id_fk" FOREIGN KEY ("short_id") REFERENCES "public"."shorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shorts" ADD CONSTRAINT "shorts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shorts" ADD CONSTRAINT "shorts_analysis_job_id_processing_jobs_id_fk" FOREIGN KEY ("analysis_job_id") REFERENCES "public"."processing_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcriptions" ADD CONSTRAINT "transcriptions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_default_organization_id_organizations_id_fk" FOREIGN KEY ("default_organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_credit_transactions_organization_id" ON "credit_transactions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_credit_transactions_type" ON "credit_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_credit_transactions_created_at" ON "credit_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_organization_invites_code" ON "organization_invites" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_organization_invites_org_id" ON "organization_invites" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_organization_invites_expires_at" ON "organization_invites" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_organization_members_org_id" ON "organization_members" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_organization_members_user_id" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_organizations_slug" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_organizations_stripe_customer_id" ON "organizations" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "idx_processing_jobs_project_id" ON "processing_jobs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_processing_jobs_status" ON "processing_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_processing_jobs_type" ON "processing_jobs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_projects_organization_id" ON "projects" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_projects_status" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_projects_created_at" ON "projects" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_shorts_project_id" ON "shorts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_shorts_status" ON "shorts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_transcriptions_project_id" ON "transcriptions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_default_organization_id" ON "users" USING btree ("default_organization_id");