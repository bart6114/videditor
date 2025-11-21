-- Add social content generation fields

-- Add default social platforms to users table
ALTER TABLE "users" ADD COLUMN "default_social_platforms" jsonb DEFAULT '[]'::jsonb;

-- Add social content field to shorts table
ALTER TABLE "shorts" ADD COLUMN "social_content" jsonb;
