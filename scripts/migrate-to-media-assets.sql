-- Data Migration Script: Migrate to Unified Media Assets
-- Run this after applying the schema migration (0017_clear_mysterio.sql)
--
-- This script:
-- 1. Creates long_form media_assets from existing projects
-- 2. Creates short_form media_assets from existing shorts
-- 3. Links transcriptions to long_form media_assets
-- 4. Links scheduled_posts to short_form media_assets
-- 5. Links processing_jobs to media_assets

BEGIN;

-- ============================================================================
-- Step 1: Create long_form media_assets from existing projects
-- ============================================================================

INSERT INTO media_assets (
    id,
    project_id,
    organization_id,
    created_by_id,
    asset_type,
    title,
    source_object_key,
    source_bucket,
    thumbnail_url,
    duration_seconds,
    file_size_bytes,
    status,
    metadata,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid()::text,
    p.id,
    p.organization_id,
    p.created_by_id,
    'long_form'::asset_type,
    p.title,
    p.source_object_key,
    p.source_bucket,
    p.thumbnail_url,
    p.duration_seconds,
    p.file_size_bytes,
    CASE p.status
        WHEN 'completed' THEN 'completed'::asset_status
        WHEN 'error' THEN 'error'::asset_status
        WHEN 'uploading' THEN 'uploading'::asset_status
        ELSE 'processing'::asset_status
    END,
    p.metadata,
    p.created_at,
    p.updated_at
FROM projects p
WHERE p.source_object_key IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM media_assets ma
      WHERE ma.project_id = p.id AND ma.asset_type = 'long_form'
  );

-- Report how many long_form assets were created
DO $$
DECLARE
    count_created INTEGER;
BEGIN
    SELECT COUNT(*) INTO count_created FROM media_assets WHERE asset_type = 'long_form';
    RAISE NOTICE 'Created % long_form media_assets from projects', count_created;
END $$;

-- ============================================================================
-- Step 2: Create short_form media_assets from existing shorts
-- ============================================================================

-- We preserve the short ID as the media_asset ID to maintain scheduled_posts references
INSERT INTO media_assets (
    id,
    project_id,
    organization_id,
    created_by_id,
    asset_type,
    title,
    source_object_key,
    source_bucket,
    thumbnail_url,
    duration_seconds,
    status,
    source_asset_id,
    social_content,
    metadata,
    created_at,
    updated_at
)
SELECT
    s.id,  -- Keep same ID to preserve scheduled_posts references
    s.project_id,
    p.organization_id,
    p.created_by_id,
    'short_form'::asset_type,
    COALESCE(
        s.social_content->'youtube'->>'title',
        LEFT(s.transcription_slice, 50)
    ),
    COALESCE(s.output_object_key, ''),  -- May be empty if not yet processed
    COALESCE(p.source_bucket, 'videditor-output'),
    s.thumbnail_url,
    s.end_time - s.start_time,  -- Duration in seconds
    CASE s.status
        WHEN 'completed' THEN 'completed'::asset_status
        WHEN 'error' THEN 'error'::asset_status
        WHEN 'processing' THEN 'processing'::asset_status
        ELSE 'uploading'::asset_status
    END,
    ma_source.id,  -- Link to source long_form asset
    s.social_content,
    jsonb_build_object(
        'startTime', s.start_time,
        'endTime', s.end_time,
        'transcriptionSlice', s.transcription_slice,
        'analysisJobId', s.analysis_job_id,
        'tasks', s.tasks,
        'legacyShortId', s.id
    ),
    s.created_at,
    s.updated_at
FROM shorts s
JOIN projects p ON p.id = s.project_id
LEFT JOIN media_assets ma_source ON ma_source.project_id = s.project_id AND ma_source.asset_type = 'long_form'
WHERE NOT EXISTS (
    SELECT 1 FROM media_assets ma
    WHERE ma.id = s.id
);

-- Report how many short_form assets were created
DO $$
DECLARE
    count_created INTEGER;
BEGIN
    SELECT COUNT(*) INTO count_created FROM media_assets WHERE asset_type = 'short_form';
    RAISE NOTICE 'Created % short_form media_assets from shorts', count_created;
END $$;

-- ============================================================================
-- Step 3: Link transcriptions to long_form media_assets
-- ============================================================================

UPDATE transcriptions t
SET media_asset_id = ma.id
FROM media_assets ma
WHERE ma.project_id = t.project_id
  AND ma.asset_type = 'long_form'
  AND t.media_asset_id IS NULL;

-- Report how many transcriptions were linked
DO $$
DECLARE
    count_linked INTEGER;
BEGIN
    SELECT COUNT(*) INTO count_linked FROM transcriptions WHERE media_asset_id IS NOT NULL;
    RAISE NOTICE 'Linked % transcriptions to media_assets', count_linked;
END $$;

-- ============================================================================
-- Step 4: Link scheduled_posts to short_form media_assets
-- ============================================================================

-- Since we preserved the short ID as the media_asset ID, we can directly use it
UPDATE scheduled_posts sp
SET media_asset_id = sp.short_id
WHERE sp.media_asset_id IS NULL
  AND EXISTS (SELECT 1 FROM media_assets ma WHERE ma.id = sp.short_id);

-- Report how many scheduled_posts were linked
DO $$
DECLARE
    count_linked INTEGER;
BEGIN
    SELECT COUNT(*) INTO count_linked FROM scheduled_posts WHERE media_asset_id IS NOT NULL;
    RAISE NOTICE 'Linked % scheduled_posts to media_assets', count_linked;
END $$;

-- ============================================================================
-- Step 5: Link processing_jobs to media_assets
-- ============================================================================

-- Link project-level jobs (thumbnail, transcription, analysis) to long_form assets
UPDATE processing_jobs pj
SET media_asset_id = ma.id
FROM media_assets ma
WHERE ma.project_id = pj.project_id
  AND ma.asset_type = 'long_form'
  AND pj.short_id IS NULL
  AND pj.media_asset_id IS NULL;

-- Link short-level jobs to short_form assets (using preserved ID)
UPDATE processing_jobs pj
SET media_asset_id = pj.short_id
WHERE pj.short_id IS NOT NULL
  AND pj.media_asset_id IS NULL
  AND EXISTS (SELECT 1 FROM media_assets ma WHERE ma.id = pj.short_id);

-- Report how many processing_jobs were linked
DO $$
DECLARE
    count_linked INTEGER;
BEGIN
    SELECT COUNT(*) INTO count_linked FROM processing_jobs WHERE media_asset_id IS NOT NULL;
    RAISE NOTICE 'Linked % processing_jobs to media_assets', count_linked;
END $$;

-- ============================================================================
-- Final Summary
-- ============================================================================

DO $$
DECLARE
    total_long_form INTEGER;
    total_short_form INTEGER;
    total_transcriptions INTEGER;
    total_scheduled_posts INTEGER;
    total_processing_jobs INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_long_form FROM media_assets WHERE asset_type = 'long_form';
    SELECT COUNT(*) INTO total_short_form FROM media_assets WHERE asset_type = 'short_form';
    SELECT COUNT(*) INTO total_transcriptions FROM transcriptions WHERE media_asset_id IS NOT NULL;
    SELECT COUNT(*) INTO total_scheduled_posts FROM scheduled_posts WHERE media_asset_id IS NOT NULL;
    SELECT COUNT(*) INTO total_processing_jobs FROM processing_jobs WHERE media_asset_id IS NOT NULL;

    RAISE NOTICE '';
    RAISE NOTICE '=== Migration Summary ===';
    RAISE NOTICE 'Long-form media assets: %', total_long_form;
    RAISE NOTICE 'Short-form media assets: %', total_short_form;
    RAISE NOTICE 'Transcriptions linked: %', total_transcriptions;
    RAISE NOTICE 'Scheduled posts linked: %', total_scheduled_posts;
    RAISE NOTICE 'Processing jobs linked: %', total_processing_jobs;
    RAISE NOTICE '=========================';
END $$;

COMMIT;
