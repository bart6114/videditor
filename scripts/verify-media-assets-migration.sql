-- Verification Script: Check Media Assets Migration Status
-- Run this before and after migrate-to-media-assets.sql to verify migration completeness
--
-- This script is SAFE to run at any time - it only reads data.

-- ============================================================================
-- 1. Check projects that need migration (have source_object_key but no long_form asset)
-- ============================================================================

SELECT
    'Projects needing migration' as check_type,
    COUNT(*) as count
FROM projects p
WHERE p.source_object_key IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM media_assets ma
      WHERE ma.project_id = p.id AND ma.asset_type = 'long_form'
  );

-- List the specific projects if any exist
SELECT
    p.id as project_id,
    p.title,
    p.source_object_key,
    p.created_at
FROM projects p
WHERE p.source_object_key IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM media_assets ma
      WHERE ma.project_id = p.id AND ma.asset_type = 'long_form'
  )
LIMIT 10;

-- ============================================================================
-- 2. Check shorts that need migration (no corresponding short_form asset)
-- ============================================================================

SELECT
    'Shorts needing migration' as check_type,
    COUNT(*) as count
FROM shorts s
WHERE NOT EXISTS (
    SELECT 1 FROM media_assets ma
    WHERE ma.id = s.id AND ma.asset_type = 'short_form'
);

-- ============================================================================
-- 3. Check transcriptions without media_asset_id link
-- ============================================================================

SELECT
    'Transcriptions without media_asset_id' as check_type,
    COUNT(*) as count
FROM transcriptions t
WHERE t.media_asset_id IS NULL;

-- ============================================================================
-- 4. Check scheduled_posts without media_asset_id link
-- ============================================================================

SELECT
    'Scheduled posts without media_asset_id' as check_type,
    COUNT(*) as count
FROM scheduled_posts sp
WHERE sp.media_asset_id IS NULL;

-- ============================================================================
-- 5. Check processing_jobs without media_asset_id link
-- ============================================================================

SELECT
    'Processing jobs without media_asset_id' as check_type,
    COUNT(*) as count
FROM processing_jobs pj
WHERE pj.media_asset_id IS NULL;

-- ============================================================================
-- 6. Summary stats
-- ============================================================================

SELECT
    'Total projects' as metric,
    COUNT(*) as count
FROM projects
UNION ALL
SELECT
    'Projects with source_object_key' as metric,
    COUNT(*) as count
FROM projects WHERE source_object_key IS NOT NULL
UNION ALL
SELECT
    'Long-form media assets' as metric,
    COUNT(*) as count
FROM media_assets WHERE asset_type = 'long_form'
UNION ALL
SELECT
    'Short-form media assets' as metric,
    COUNT(*) as count
FROM media_assets WHERE asset_type = 'short_form'
UNION ALL
SELECT
    'Legacy shorts table entries' as metric,
    COUNT(*) as count
FROM shorts;

-- ============================================================================
-- 7. Migration readiness check
-- ============================================================================

DO $$
DECLARE
    unmigrated_projects INTEGER;
    unmigrated_shorts INTEGER;
    unlinked_transcriptions INTEGER;
BEGIN
    SELECT COUNT(*) INTO unmigrated_projects
    FROM projects p
    WHERE p.source_object_key IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM media_assets ma WHERE ma.project_id = p.id AND ma.asset_type = 'long_form');

    SELECT COUNT(*) INTO unmigrated_shorts
    FROM shorts s
    WHERE NOT EXISTS (SELECT 1 FROM media_assets ma WHERE ma.id = s.id);

    SELECT COUNT(*) INTO unlinked_transcriptions
    FROM transcriptions t WHERE t.media_asset_id IS NULL;

    RAISE NOTICE '';
    RAISE NOTICE '=== MIGRATION READINESS ===';
    IF unmigrated_projects = 0 AND unmigrated_shorts = 0 THEN
        RAISE NOTICE 'STATUS: READY - All data has been migrated to media_assets';
        RAISE NOTICE 'You can now safely remove deprecated columns from projects table';
    ELSE
        RAISE NOTICE 'STATUS: PENDING - Migration needed';
        RAISE NOTICE 'Unmigrated projects: %', unmigrated_projects;
        RAISE NOTICE 'Unmigrated shorts: %', unmigrated_shorts;
        RAISE NOTICE 'Run migrate-to-media-assets.sql to complete migration';
    END IF;
    RAISE NOTICE 'Unlinked transcriptions: % (will be linked during migration)', unlinked_transcriptions;
    RAISE NOTICE '===========================';
END $$;
