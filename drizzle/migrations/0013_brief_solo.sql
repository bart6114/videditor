-- Step 1: Drop the old foreign key constraint
ALTER TABLE "scheduled_posts" DROP CONSTRAINT "scheduled_posts_social_account_id_social_accounts_id_fk";
--> statement-breakpoint

-- Step 2: Add platform column as nullable first
ALTER TABLE "scheduled_posts" ADD COLUMN "platform" "social_platform";
--> statement-breakpoint

-- Step 3: Backfill platform from linked social accounts
UPDATE scheduled_posts sp
SET platform = sa.platform
FROM social_accounts sa
WHERE sp.social_account_id = sa.id;
--> statement-breakpoint

-- Step 4: Make platform NOT NULL after backfill
ALTER TABLE "scheduled_posts" ALTER COLUMN "platform" SET NOT NULL;
--> statement-breakpoint

-- Step 5: Make social_account_id nullable
ALTER TABLE "scheduled_posts" ALTER COLUMN "social_account_id" DROP NOT NULL;
--> statement-breakpoint

-- Step 6: Add new foreign key with SET NULL on delete
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_social_account_id_social_accounts_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE set null ON UPDATE no action;
