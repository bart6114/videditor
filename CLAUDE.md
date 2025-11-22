# CLAUDE.md

Guidance for coding agents working on the Fly.io-based VidEditor stack.

## Top-Level Architecture

- **Next.js app** (pages router) – Frontend + API routes (port 3000)
- **Job runner** (`apps/jobs`) – Python 3.13 worker using FastAPI, faster-whisper, and FFmpeg
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
- `apps/jobs/utils/transcription.py` – faster-whisper integration
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

**Python Jobs Worker:**
- `DATABASE_URL` – same Neon Postgres connection (automatically converts to asyncpg format)
- `TIGRIS_*` – credentials for downloading/uploading processed media
- `JOB_CONCURRENCY` – number of jobs to process simultaneously (default: 1, max: 20)
- `POLL_INTERVAL_MS` – queue polling interval in ms (default: 1000, min: 100)
- `FFMPEG_BINARY` – path to FFmpeg binary (optional, uses system FFmpeg by default)
- `NODE_ENV` – environment mode (development/production, default: development)

## Flow Notes

1. **Upload** – `POST /api/v1/uploads` → presigned Tigris PUT → `POST /api/v1/uploads/complete` to insert job in queue
2. **Project view** – `GET /api/v1/projects` and `GET /api/v1/projects/:id` return enriched project data (`shortsCount`, `hasTranscription`, etc.)
3. **Job creation** – `POST /api/v1/projects/:projectId/jobs { type }` inserts into `processing_jobs` table
4. **Job runner** – Python worker polls `processing_jobs` using `SELECT ... FOR UPDATE SKIP LOCKED`, processes jobs concurrently, and updates status directly in DB. Transcription fully implemented with faster-whisper.

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

- Use the provided Dockerfiles (`Dockerfile.frontend`, `Dockerfile.jobs`) when running `fly deploy --config fly.<service>.toml`
- Store secrets via `fly secrets set` (DATABASE_URL, Tigris creds, Clerk keys, Stripe keys, job config)
- Both services share the same DATABASE_URL (Neon Postgres) and communicate via the `processing_jobs` table

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
- **faster-whisper** – Optimized Whisper implementation (~4x faster than openai-whisper)
  - Uses "small" model (~460MB) by default
  - Auto-downloads to `~/.cache/huggingface/hub/`
  - Runs on CPU with int8 quantization for efficiency

**Configuration & Logging:**
- **Pydantic** – Type-safe settings and data validation
- **pydantic-settings** – Environment variable loading with validation
- **structlog** – Structured JSON logging (production) with pretty console (development)

**Package Management:**
- **uv** – Fast Python package installer and resolver

## TODOs / Follow-ups

- Rename projects to videos
- Add concept of organisation so it can have multiple team members
- Set up Stripe
- Check for remaining stubs
- Clean up job types
- Scheduling system for YT/TikTok/Instagram

---

**Architecture Notes:**
- This is a 2-process architecture (Next.js + Python Jobs Worker)
- Jobs are queued via Postgres `processing_jobs` table
- Python worker uses `SELECT FOR UPDATE SKIP LOCKED` for safe concurrent job processing
- No HTTP communication between services – all coordination via shared database
- Jobs worker was migrated from TypeScript/Node.js to Python 3.13 for better AI/ML tooling
- Previous Cloudflare-specific code has been removed
- System has been migrated from CloudFlare to Fly, if you encounter any remnants ask if OK to delete 'em
- todo: allow to set specific models via env vars