-- Rename video_url to video_uid and remove stream_id
ALTER TABLE projects RENAME COLUMN video_url TO video_uid;
ALTER TABLE projects DROP COLUMN stream_id;

-- Make duration and fileSize nullable (will be populated after Stream processing)
-- SQLite doesn't support ALTER COLUMN, so this is handled at application level
