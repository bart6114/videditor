-- D1 Migration: Initial Schema
-- SQLite database for VidEditor

-- Users table (synced from Clerk)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, -- Clerk user ID
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  image_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Subscriptions table (for Stripe)
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete')),
  current_period_start TEXT,
  current_period_end TEXT,
  cancel_at_period_end INTEGER DEFAULT 0, -- Boolean: 0 = false, 1 = true
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  video_url TEXT NOT NULL, -- R2 object key
  stream_id TEXT, -- Cloudflare Stream ID
  thumbnail_url TEXT,
  duration REAL NOT NULL, -- seconds as decimal
  file_size INTEGER NOT NULL, -- bytes
  status TEXT NOT NULL CHECK (status IN ('uploading', 'processing', 'transcribing', 'analyzing', 'completed', 'error')),
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Transcriptions table
CREATE TABLE IF NOT EXISTS transcriptions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  segments TEXT NOT NULL, -- JSON array as text
  language TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Shorts table
CREATE TABLE IF NOT EXISTS shorts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  start_time REAL NOT NULL, -- seconds
  end_time REAL NOT NULL, -- seconds
  video_url TEXT, -- Cloudflare Stream clip URL
  stream_clip_id TEXT, -- Cloudflare Stream clip ID
  thumbnail_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Processing jobs table
CREATE TABLE IF NOT EXISTS processing_jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('transcription', 'analysis', 'video_cut', 'stream_upload')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  progress REAL DEFAULT 0.0, -- 0.0 to 100.0
  error_message TEXT,
  metadata TEXT, -- JSON metadata as text
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transcriptions_project_id ON transcriptions(project_id);

CREATE INDEX IF NOT EXISTS idx_shorts_project_id ON shorts(project_id);
CREATE INDEX IF NOT EXISTS idx_shorts_status ON shorts(status);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_project_id ON processing_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_type ON processing_jobs(type);
