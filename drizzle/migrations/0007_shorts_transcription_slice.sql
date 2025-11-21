-- Replace title and description columns with transcription_slice in shorts table
ALTER TABLE "shorts" ADD COLUMN "transcription_slice" text;

-- Migrate existing data: combine title and description into transcription_slice
UPDATE "shorts" SET "transcription_slice" = COALESCE("description", "title", '');

-- Make the column not null after populating data
ALTER TABLE "shorts" ALTER COLUMN "transcription_slice" SET NOT NULL;

-- Drop the old columns
ALTER TABLE "shorts" DROP COLUMN "title";
ALTER TABLE "shorts" DROP COLUMN "description";
