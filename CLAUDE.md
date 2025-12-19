# CLAUDE.md

Guidance for coding agents working on the Fly.io-based VidEditor stack.

## Top-Level Architecture

- **Next.js app** (pages router) – Frontend + API routes (port 3000)
- **Job runner** (`apps/jobs`) – Python 3.13 worker using FastAPI, Deepgram, and FFmpeg
- **Storage** – [Tigris](https://www.tigrisdata.com/) (S3-compatible) for raw + processed videos
- **Database** – Neon Postgres (managed) via Drizzle ORM (Next.js) and SQLAlchemy (Jobs)
- **Auth** – Clerk JWT verification in API routes
- **Payments** – Stripe (publishable/secret/webhook keys in `.env`)

```
Browser
  ↓ REST /api/v1/*
Next.js App (Fly Machine)
  ↔ Neon Postgres (drizzle)
  ↔ Tigris (presign uploads)
  ↔ processing_jobs table (queue)
       ↑ (poll)
Job Runner (Fly Machine, Python 3.13)
  ↔ Tigris (download/upload)
  ↔ Neon (job status updates)
```

## Development Commands

**Next.js App:**
- `npm run dev` – starts Next.js (port 3000)
- `npm run build` – compile Next.js production build
- `npm run start` – run Next.js in production mode
- `npm run test:upload` – scripted end-to-end upload hitting `/api/v1/uploads`

**Python Jobs Worker:**
- `cd apps/jobs && uv run python main.py` – run jobs worker locally (port 8081)
- `uv pip install` – install Python dependencies from pyproject.toml
- `uv sync` – sync dependencies with lockfile

**Database (Drizzle):**
- `npm run db:generate` – create SQL migrations after updating `db/schema.ts`
- `npm run db:migrate` – apply migrations to `DATABASE_URL`
- `npm run db:studio` – inspect Neon DB via Drizzle

**IMPORTANT: Drizzle Migration Workflow**
1. **Make schema changes** in `db/schema.ts` (never touch migration files directly)
2. **Generate migration**: `npm run db:generate` (creates SQL + snapshot files)
3. **Review the generated SQL** in `drizzle/migrations/XXXX_name.sql`
4. **Apply migration**: `npm run db:migrate`

**NEVER manually create or edit migration SQL files.** Drizzle tracks schema state via snapshot files in `drizzle/migrations/meta/`. If you manually create migrations, these snapshots become out of sync and drizzle-kit will malfunction. If migrations get corrupted, the correct fix is to regenerate all migrations from scratch (delete `drizzle/migrations/*`, recreate `meta/_journal.json` with empty entries array, then `npm run db:generate`).

## Key Files

**Next.js App:**
- `pages/api/v1/*` – Next.js API routes (uploads, projects, jobs)
- `lib/tigris/` – S3 client for Tigris presigned uploads
- `lib/api/auth.ts` – Clerk JWT verification utilities
- `lib/api/responses.ts` – API response helpers
- `lib/jobs/` – Job enqueue utilities (inserts to `processing_jobs` table)
- `components/video-upload.tsx` & `pages/projects/*` – UI using `/api/v1` endpoints

**Python Jobs Worker:**
- `apps/jobs/main.py` – Entry point with FastAPI server and worker orchestration
- `apps/jobs/config.py` – Pydantic settings for environment validation
- `apps/jobs/processor.py` – Job execution logic (transcription, analysis, cutting, delivery)
- `apps/jobs/worker.py` – Queue polling with `SELECT FOR UPDATE SKIP LOCKED`
- `apps/jobs/server.py` – FastAPI health check endpoint
- `apps/jobs/database.py` – SQLAlchemy async engine and session management
- `apps/jobs/models.py` – SQLAlchemy ORM models and Pydantic schemas
- `apps/jobs/utils/storage.py` – Tigris S3 operations with aioboto3
- `apps/jobs/utils/transcription.py` – Deepgram transcription with diarization and word-level timestamps
- `apps/jobs/pyproject.toml` – Python dependencies managed by uv

**Shared:**
- `db/schema.ts` – Postgres schema (projects, transcriptions, shorts, processing_jobs, media_assets, etc.)
- `packages/shared/src/index.ts` – shared enums + API payload types
- `Dockerfile.*` + `fly.*.toml` – Fly deployment scaffolding (frontend + jobs)

## Environment Expectations

**Next.js App:**
- `DATABASE_URL` – Neon Postgres connection string
- `TIGRIS_*` – credentials + `TIGRIS_BUCKET` for presigned uploads
- `CLERK_SECRET_KEY` – for JWT verification
- `CLERK_PUBLISHABLE_KEY` – for frontend auth
- `STRIPE_*` – Stripe keys for payments
- `POSTHOG_API_KEY` – PostHog project API key (optional, enables LLM analytics)
- `POSTHOG_HOST` – PostHog host (default: `https://eu.i.posthog.com`)

**Python Jobs Worker:**
- `DATABASE_URL` – same Neon Postgres connection (automatically converts to asyncpg format)
- `TIGRIS_*` – credentials for downloading/uploading processed media
- `TIGRIS_DOWNLOAD_CHUNK_SIZE` – chunk size for streaming downloads (default: 1MB)
- `TIGRIS_CONNECT_TIMEOUT` – connection timeout in seconds (default: 10)
- `TIGRIS_READ_TIMEOUT` – read timeout for large files (default: 300s / 5min)
- `TIGRIS_MAX_RETRIES` – max retry attempts for downloads/uploads (default: 3)
- `TIGRIS_RETRY_BASE_DELAY` – base delay for exponential backoff (default: 1.0s)
- `DEEPGRAM_API_KEY` – Deepgram API key for transcription
- `DEEPGRAM_MODEL` – Deepgram model (default: "nova-3")
- `DEEPGRAM_CHUNK_DURATION_SECONDS` – Max chunk duration (default: 360, 6 minutes)
- `DEEPGRAM_MAX_CONCURRENT` – Max concurrent transcription calls (default: 5)
- `OPENROUTER_API_KEY` – OpenRouter API key for AI analysis
- `JOB_CONCURRENCY` – number of jobs to process simultaneously (default: 1, max: 20)
- `POLL_INTERVAL_MS` – queue polling interval in ms (default: 1000, min: 100)
- `FFMPEG_BINARY` – path to FFmpeg binary (optional, uses system FFmpeg by default)
- `NODE_ENV` – environment mode (development/production, default: development)
- `POSTHOG_API_KEY` – PostHog project API key (optional, enables analytics)
- `POSTHOG_HOST` – PostHog host (default: `https://eu.i.posthog.com`)

## Flow Notes

1. **Upload** – `POST /api/v1/uploads` → presigned Tigris PUT → `POST /api/v1/uploads/complete` to insert job in queue
2. **Project view** – `GET /api/v1/projects` and `GET /api/v1/projects/:id` return enriched project data (`shortsCount`, `hasTranscription`, etc.)
3. **Job creation** – `POST /api/v1/projects/:projectId/jobs { type }` inserts into `processing_jobs` table
4. **Job runner** – Python worker polls `processing_jobs` using `SELECT ... FOR UPDATE SKIP LOCKED`, processes jobs concurrently, and updates status directly in DB. Transcription uses Deepgram with speaker diarization and per-word timestamps.

## When Adding Features

**General:**
- Update `packages/shared/src` when introducing new enums/payloads so frontend + backend stay in sync
- Job types are defined in `packages/shared/src/index.ts` (`JobType` enum) and mirrored in `apps/jobs/models.py`
- Coordinate job state transitions via `processing_jobs` and update parent project status when appropriate

**Next.js App:**
- Use the Drizzle helpers (`db/index.ts`) to get a singleton Postgres connection instead of creating pools manually
- New API endpoints go in `pages/api/v1/*` following Next.js API route conventions
- All storage-related operations should go through `lib/tigris/` to keep credential handling consistent

**Python Jobs Worker:**
- Job processor logic is in `apps/jobs/processor.py` – add new job type handlers in the `process_job` method
- Add new SQLAlchemy models to `apps/jobs/models.py` as needed
- Storage operations go through `apps/jobs/utils/storage.py` (aioboto3 client)
- Database operations use SQLAlchemy async sessions via `database.get_session_factory()`

## Fly Deployment Tips

- Use the provided Dockerfiles (`Dockerfile.app`, `Dockerfile.jobs`) when running `fly deploy --config fly.<service>.toml`
- Store secrets via `fly secrets set` (DATABASE_URL, Tigris creds, Clerk keys, Stripe keys, job config)
- Both services share the same DATABASE_URL (Neon Postgres) and communicate via the `processing_jobs` table

## Build Args for NEXT_PUBLIC_* Variables

Next.js inlines `NEXT_PUBLIC_*` environment variables into the JavaScript bundle **at build time**, not runtime. This means:

1. **They must be available during `npm run build`** - not just at container start
2. **They are safe to expose in `fly.app.toml`** - these are public/publishable keys that end up in the browser anyway
3. **Secrets should NEVER use NEXT_PUBLIC_ prefix** - anything with this prefix becomes public

The `fly.app.toml` file contains `[build.args]` that pass these values to the Dockerfile during the Fly.io build process. The Dockerfile declares matching `ARG` statements to receive them.

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | Base URL for the app (e.g., https://videditor.ai) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk's public key for auth (pk_live_*) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe's public key for payments (pk_live_*) |

## Python Stack Details

**Core Framework:**
- **Python 3.13** – Latest Python with performance improvements
- **FastAPI** – Modern async web framework for health checks
- **uvicorn** – ASGI server running the FastAPI app

**Database:**
- **SQLAlchemy 2.0** – Async ORM with `FOR UPDATE SKIP LOCKED` support
- **asyncpg** – High-performance async Postgres driver
- **psycopg[binary]** – Fallback Postgres driver

**Storage & Transcription:**
- **aioboto3** – Async AWS SDK for Tigris S3 operations
- **deepgram-sdk** – Deepgram Speech-to-Text API
  - Uses "nova-3" model by default (configurable via `DEEPGRAM_MODEL`)
  - Speaker diarization enabled (`diarize=True`)
  - Word-level timestamps with confidence scores
  - Supports time-based chunking for long videos

**Configuration & Logging:**
- **Pydantic** – Type-safe settings and data validation
- **pydantic-settings** – Environment variable loading with validation
- **structlog** – Structured JSON logging (production) with pretty console (development)

**Package Management:**
- **uv** – Fast Python package installer and resolver

## PostHog LLM Analytics

All OpenAI and OpenRouter API calls are instrumented with PostHog LLM analytics when `POSTHOG_API_KEY` is set.

**What's captured:**
- Token usage (input/output)
- Latency metrics
- Full prompts and responses
- Cost estimates
- Error tracking

**Integration Points:**
- `apps/jobs/utils/analytics.py` – Python PostHog client wrapper for OpenRouter and Deepgram
- `apps/jobs/utils/transcription.py` – Deepgram transcription with manual PostHog tracking
- `apps/jobs/utils/ai.py` – OpenRouter calls for analysis and social content (uses OpenAI SDK)
- `lib/posthog/index.ts` – Node.js PostHog client for API routes
- `pages/api/v1/schedule/ai-generate.ts` – OpenRouter scheduling calls

**Deployment:**
```bash
fly secrets set -a videditor-jobs POSTHOG_API_KEY="phc_..." POSTHOG_HOST="https://eu.i.posthog.com"
fly secrets set -a videditor-app POSTHOG_API_KEY="phc_..." POSTHOG_HOST="https://eu.i.posthog.com"
```

## TODOs / Follow-ups

- Look at YouTube tags for publishing (very low prio)
- Support for MOV format

## Recent Refactors (Reference for Debugging)

### Removed `project.status` (Dec 2024)
Project-level status was removed because it was legacy from when 1 project = 1 video. Now each `media_asset` has its own `status` field.

**What was removed:**
- `projects.status` and `projects.error_message` columns (migration `0019_worried_stellaris.sql`)
- `projectStatusEnum` from schema
- `ProjectStatus` enum from Python models and shared types
- Processing spinner from projects overview page
- All `update(Project).values(status=...)` calls from processor.py

**If you see errors about:**
- `project.status` not existing → The column was removed, use `media_assets.status` instead
- `ProjectStatus` import failing → The type was removed from `@shared/index` and `apps/jobs/models.py`
- UI showing stale processing state → Status is now tracked per-asset, not per-project

### Removed `shorts` table (Dec 2024)
The legacy `shorts` table has been removed. All shorts are now stored as `media_assets` with `assetType = 'short_form'`.

**Key changes:**
- `shorts` table removed from `db/schema.ts`
- `Short` and `NewShort` types are now aliases for `MediaAsset` and `NewMediaAsset`
- All shorts-related queries now use `media_assets` table with `assetType = 'short_form'` filter
- `db/queries/shorts.ts` file deleted
- `lib/transforms/mediaAssetToShort.ts` file deleted

**Field mappings (legacy → current):**
- `short.outputObjectKey` → `asset.sourceObjectKey`
- `short.transcriptionSlice` → `asset.metadata.transcriptionSlice` (cast to `ShortFormMetadata`)
- `short.startTime` → `asset.metadata.startTime`
- `short.endTime` → `asset.metadata.endTime`
- `short.analysisJobId` → `asset.metadata.analysisJobId`

**Status value changes:**
- `'pending'` → `'ready'` or `'uploading'` (depending on context)
- `'processing'` → `'processing'` (unchanged)
- `'completed'` → `'completed'` (unchanged)
- `'error'` → `'error'` (unchanged)

**If you see errors about:**
- `shorts` table not existing → Use `media_assets` table with `assetType = 'short_form'`
- `short.transcriptionSlice` not existing → Extract from `metadata as ShortFormMetadata`
- `short.outputObjectKey` not existing → Use `asset.sourceObjectKey`
- `getShortFilename` not found → Use `getAssetFilename` from `lib/api/shorts.ts`

### Before Production Deployment: Unified Media Assets Migration

The codebase has been refactored to use `media_assets` table instead of project-level source fields and the legacy `shorts` table. Before deploying to production:

1. **Verify current state** (read-only, safe to run anytime):
   ```bash
   psql $DATABASE_URL -f scripts/verify-media-assets-migration.sql
   ```

2. **Run data migration** (if verification shows pending items):
   ```bash
   psql $DATABASE_URL -f scripts/migrate-to-media-assets.sql
   ```
   This script is idempotent - safe to run multiple times. It:
   - Creates `long_form` media_assets from `projects.source_object_key`
   - Creates `short_form` media_assets from the `shorts` table
   - Links transcriptions, scheduled_posts, and processing_jobs to media_assets

3. **Verify again** to confirm migration completed:
   ```bash
   psql $DATABASE_URL -f scripts/verify-media-assets-migration.sql
   ```

4. **Deploy code** - The schema migration `0018_groovy_husk.sql` will drop deprecated columns:
   - `projects.source_object_key`
   - `projects.source_bucket`
   - `projects.thumbnail_url`
   - `projects.duration_seconds`
   - `projects.file_size_bytes`

**Important:** Run steps 1-3 BEFORE deploying, as the new code no longer writes to these deprecated columns.

## First-Time Fly.io Deployment

### 1. Create Fly Apps
```bash
fly auth login
fly apps create videditor-app --org personal
fly apps create videditor-jobs --org personal
```

### 2. Set Secrets on Frontend
```bash
fly secrets set -a videditor-app \
  DATABASE_URL="<your-neon-url>" \
  CLERK_SECRET_KEY="<your-clerk-secret>" \
  STRIPE_SECRET_KEY="<your-stripe-secret>" \
  STRIPE_WEBHOOK_SECRET="<your-stripe-webhook-secret>" \
  TIGRIS_ACCESS_KEY_ID="<your-tigris-key>" \
  TIGRIS_SECRET_ACCESS_KEY="<your-tigris-secret>" \
  TIGRIS_ENDPOINT="https://fly.storage.tigris.dev" \
  TIGRIS_REGION="auto" \
  TIGRIS_BUCKET="<your-bucket>" \
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="<your-clerk-pub-key>" \
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="<your-stripe-pub-key>" \
  NEXT_PUBLIC_APP_URL="https://videditor-app.fly.dev"
```

### 3. Set Secrets on Jobs Worker
```bash
fly secrets set -a videditor-jobs \
  DATABASE_URL="<your-neon-url>" \
  DEEPGRAM_API_KEY="<your-deepgram-key>" \
  OPENROUTER_API_KEY="<your-openrouter-key>" \
  TIGRIS_ACCESS_KEY_ID="<your-tigris-key>" \
  TIGRIS_SECRET_ACCESS_KEY="<your-tigris-secret>" \
  TIGRIS_ENDPOINT="https://fly.storage.tigris.dev" \
  TIGRIS_REGION="auto" \
  TIGRIS_BUCKET="<your-bucket>" \
  JOB_CONCURRENCY="2" \
  POLL_INTERVAL_MS="1000"
```

### 4. Add GitHub Secrets for CI/CD
```bash
# Get Fly API token
fly tokens create deploy -x 999999h
```
Then in GitHub repo → Settings → Secrets and variables → Actions:
- Add `DATABASE_URL` (Neon connection string)
- Add `FLY_API_TOKEN` (from command above)

### 5. Run Initial Migration
```bash
DATABASE_URL="<prod-url>" npm run db:migrate
```

### 6. First Deploy
```bash
npm run deploy:app
npm run deploy:jobs
```

### 7. Configure Stripe Webhook
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://videditor-app.fly.dev/api/v1/webhooks/stripe`
3. Select events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.*`
4. Update webhook secret if needed:
   ```bash
   fly secrets set -a videditor-app STRIPE_WEBHOOK_SECRET="whsec_new_..."
   ```

After initial setup, every push to `main` triggers automatic migrations and deployment via GitHub Actions.

---

**Architecture Notes:**
- This is a 2-process architecture (Next.js + Python Jobs Worker)
- Jobs are queued via Postgres `processing_jobs` table
- Python worker uses `SELECT FOR UPDATE SKIP LOCKED` for safe concurrent job processing
- No HTTP communication between services – all coordination via shared database
- Jobs worker was migrated from TypeScript/Node.js to Python 3.13 for better AI/ML tooling
- Previous Cloudflare-specific code has been removed
- System has been migrated from CloudFlare to Fly, if you encounter any remnants ask if OK to delete 'em