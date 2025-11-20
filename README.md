# VidEditor.ai – Fly.io Native AI Video Pipeline

VidEditor.ai ingests long-form videos, stores the assets in [Tigris Object Storage](https://www.tigrisdata.com/), transcribes/analyzes the content with background workers, and renders social-ready clips – all running on **Fly.io Machines** with **Neon Postgres** as the system of record.

## What's Inside

- **Next.js frontend** (pages router) served from Fly – `npm run dev:next`
- **API service** (`apps/api`) built with Fastify + Drizzle ORM, exposes `/v1/*` endpoints, signs Tigris uploads, manages Neon migrations, and queues jobs
- **Job runner** (`apps/jobs`) – minimal Node service that receives job triggers, runs FFmpeg/AI steps (placeholder in this commit), and updates Postgres
- **Shared packages** (`packages/shared`) for enums + API payload contracts
- **Postgres schema** in `db/` (Drizzle + Neon)

```
apps/
  api/     Fastify API (Fly Machine)
  jobs/    Job runner + FFmpeg coordinator (Fly Machine)
components/ Next.js UI pieces
packages/shared/ Typed contracts used in frontend + backend
db/        Drizzle schema + helpers for Neon
```

## Quick Start (Local Dev)

1. **Install deps**
   ```bash
   npm install
   ```
2. **Configure env**
   ```bash
   cp .env.example .env.local
   # Fill in Clerk, Stripe, Neon DATABASE_URL, Tigris credentials, INTERNAL_API_TOKEN, JOB_RUNNER_TOKEN, etc.
   ```
3. **Run everything**
   ```bash
   npm run dev
   ```
   This launches Next.js on port `3000`, the API on `4000`, and the job runner on `4100` (see `package.json` scripts).
4. **Seed Postgres** (optional) using Drizzle:
   ```bash
   npm run db:generate   # generate migrations after schema changes
   npm run db:migrate    # run migrations against DATABASE_URL
   ```

### Key Environment Variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Frontend -> API base URL (http://localhost:4000 for dev) |
| `DATABASE_URL` | Neon Postgres connection string used by both services |
| `TIGRIS_*` | Endpoint/region/bucket/access keys for S3-compatible storage |
| `INTERNAL_API_TOKEN` | Shared secret so the API can notify the job runner |
| `JOB_RUNNER_TOKEN` | Secret required to hit `apps/jobs` `/internal/jobs` endpoint |
| `JOB_SERVICE_URL` | Base URL for the job runner (API uses this to trigger work) |
| `NEXT_PUBLIC_CLERK_*`, `CLERK_SECRET_KEY` | Clerk authentication |
| `STRIPE_*` | Subscription billing |

## Architecture

1. **Upload** – The frontend hits `POST /v1/uploads`, which creates a project row in Neon and returns a Tigris presigned URL. The browser uploads directly to Tigris and then calls `/v1/uploads/complete`.
2. **Queue jobs** – When uploads complete, the API inserts rows into `processing_jobs` and (optionally) notifies the job runner over HTTP.
3. **Process** – `apps/jobs` pulls each job, marks it `running`, performs the FFmpeg/AI work (stubbed right now), writes results back to Postgres, and updates project status.
4. **Frontend** – React UI polls `/v1/projects` + `/v1/projects/:id` for status, progress, transcripts, and shorts.

## Deploying to Fly.io

Each service has its own Fly config:

- `fly.frontend.toml` – Next.js
- `fly.api.toml` – API service (Dockerfile build or `fly launch`)
- `fly.jobs.toml` – Job runner

Recommended deployment flow:

1. Provision Neon + Tigris buckets and fill the env secrets.
2. `fly deploy --config fly.api.toml`
3. `fly deploy --config fly.jobs.toml`
4. `fly deploy --config fly.frontend.toml`

Make sure all three apps share the same Fly organization network so they can communicate privately.

## Testing the Upload Flow

`npm run test:upload` executes the upload flow end-to-end. It now targets the `/v1` routes, signs a Tigris upload, and polls `/v1/projects/:id`. Set `NEXT_PUBLIC_API_URL`, `CLERK_SECRET_KEY`, and `TEST_USER_ID` before running it.

## Next Steps

- Flesh out real FFmpeg + Replicate integrations inside `apps/jobs/src/processor.ts`
- Emit WebSocket / SSE updates from the API for realtime dashboards
- Harden security (use Clerk JWT verification instead of `X-User-Id`, rotate secrets, etc.)
- Replace placeholder download/analyze actions with Fly-native implementations
