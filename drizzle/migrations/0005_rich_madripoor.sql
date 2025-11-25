ALTER TABLE "credit_transactions" DROP CONSTRAINT "credit_transactions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT "projects_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "idx_credit_transactions_user_id";--> statement-breakpoint
DROP INDEX "idx_projects_user_id";--> statement-breakpoint
DROP INDEX "idx_subscriptions_user_id";--> statement-breakpoint
ALTER TABLE "credit_transactions" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "credits";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "stripe_customer_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "auto_top_up_enabled";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "auto_top_up_threshold";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "auto_top_up_amount";