ALTER TABLE "organizations" ALTER COLUMN "preferred_currency" DROP DEFAULT;--> statement-breakpoint
UPDATE "organizations" SET "preferred_currency" = NULL WHERE "preferred_currency" = 'USD';