CREATE TYPE "public"."credit_transaction_type" AS ENUM('purchase', 'auto_topup', 'usage', 'refund', 'adjustment');--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"type" "credit_transaction_type" NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"description" text,
	"stripe_payment_intent_id" varchar(255),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "credits" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auto_top_up_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auto_top_up_threshold" integer DEFAULT 5;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auto_top_up_amount" integer DEFAULT 10;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_credit_transactions_user_id" ON "credit_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_credit_transactions_type" ON "credit_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_credit_transactions_created_at" ON "credit_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_users_stripe_customer_id" ON "users" USING btree ("stripe_customer_id");