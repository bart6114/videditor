ALTER TABLE "credit_transactions" ADD COLUMN "currency" varchar(3);--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD COLUMN "amount_cents" integer;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD COLUMN "exchange_rate" double precision;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "preferred_currency" varchar(3) DEFAULT 'USD';