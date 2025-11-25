CREATE TYPE "public"."member_role" AS ENUM('owner', 'member');--> statement-breakpoint
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
DROP INDEX "idx_users_stripe_customer_id";--> statement-breakpoint
ALTER TABLE "credit_transactions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD COLUMN "organization_id" varchar(255);--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD COLUMN "performed_by_id" varchar(255);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "organization_id" varchar(255);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "created_by_id" varchar(255);--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "organization_id" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "default_organization_id" varchar(255);--> statement-breakpoint
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_organization_invites_code" ON "organization_invites" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_organization_invites_org_id" ON "organization_invites" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_organization_invites_expires_at" ON "organization_invites" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_organization_members_org_id" ON "organization_members" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_organization_members_user_id" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_organizations_slug" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_organizations_stripe_customer_id" ON "organizations" USING btree ("stripe_customer_id");--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_performed_by_id_users_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_default_organization_id_organizations_id_fk" FOREIGN KEY ("default_organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_credit_transactions_organization_id" ON "credit_transactions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_projects_organization_id" ON "projects" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_organization_id" ON "subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_users_default_organization_id" ON "users" USING btree ("default_organization_id");