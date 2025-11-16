# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VidEditor is an AI-powered video shorts generator built on Cloudflare's edge platform. The application has been **recently migrated from Supabase to Cloudflare Stack** (D1, R2, Workers, Stream, Workers AI, Queues, Durable Objects) with Clerk authentication.

## Development Commands

### Local Development

Run both frontend and workers concurrently:
```bash
npm run dev
```

Or run separately:
```bash
npm run dev:next    # Frontend only (port 3000)
npm run dev:worker  # Workers only (port 8787)
```

### Database Management (Drizzle ORM)

**Schema Changes:**
```bash
npm run db:generate      # Generate SQL migration from schema.ts changes
npm run db:migrate:local # Apply migrations to local D1
npm run db:migrate:prod  # Apply migrations to production D1
npm run db:studio        # Launch Drizzle Studio (visual DB browser)
```

**Migration Workflow:**
1. Edit `db/schema.ts` to modify database schema
2. Run `npm run db:generate` to auto-generate SQL migration
3. Review the generated SQL in `drizzle/migrations/`
4. Apply locally with `npm run db:migrate:local`
5. Test thoroughly before deploying to production

### Deployment

```bash
npm run worker:deploy      # Deploy Cloudflare Workers
npm run pages:build        # Build Next.js for Cloudflare Pages
npm run pages:deploy       # Deploy to Cloudflare Pages
```

### Cloudflare Authentication

```bash
npm run cf:login           # Login to Cloudflare
npm run cf:whoami          # Check current Cloudflare user
```

## Architecture

### Hybrid Frontend + Workers Architecture

```
Frontend (Next.js)  →  Cloudflare Workers API  →  D1/R2/Stream/AI/Queues
  Port 3000              Port 8787 (dev)
```

- **Frontend**: Next.js 15 (Pages Router) with React 19, Tailwind CSS, shadcn/ui
- **Workers**: Cloudflare Workers handling all backend logic
- **Database**: D1 (SQLite-based edge database) + **Drizzle ORM** for type-safe queries
- **Storage**: R2 (videos and shorts)
- **Video Processing**: Cloudflare Stream API
- **AI**: Workers AI (Whisper for transcription, Llama for analysis)
- **Background Jobs**: Cloudflare Queues
- **Real-time State**: Durable Objects (JobTracker)
- **Authentication**: Clerk (JWT verification)

### Key Data Flows

#### Video Upload Flow
1. User uploads video → Frontend requests presigned R2 URL from Worker
2. Worker creates project record in D1 → Returns presigned upload URL
3. Frontend uploads directly to R2 (client-side)
4. Worker queues "upload_to_stream" job → Queue processor uploads to Stream API
5. Stream webhook updates project status when ready

#### Transcription Flow
1. POST `/api/transcribe` → Worker creates processing job in D1
2. Worker queues "transcribe" message → Queue processor fetches video from Stream
3. Queue runs Workers AI (Whisper model) → Saves transcription to D1
4. Project status updated to show transcription complete

#### Analysis Flow
1. POST `/api/analyze` → Worker retrieves transcription from D1
2. Worker queues "analyze" message → Queue processor sends transcript to Workers AI (Llama)
3. AI suggests 3-5 viral clip moments → Saves shorts suggestions to D1
4. User can create actual clips via Stream API

### Authentication Pattern

**Clerk-based Authentication:**
- Frontend: Clerk React components + middleware protect routes (everything except `/`, `/sign-in`, `/sign-up`, `/api/webhooks/*`)
- Workers: JWT verification using `@clerk/backend` on all routes (except webhooks)
- API calls include Bearer token from Clerk's `getToken()` hook
- User records synced to D1 via `ensureUserExists()` utility

### Background Job Processing

**Cloudflare Queues** handle async processing with automatic retries (max 3):

Queue Consumer (`workers/queue/consumer.ts`) routes messages to processors:
- `stream-upload.ts` - Upload R2 video to Cloudflare Stream
- `transcription.ts` - Whisper AI transcription with chunking
- `analysis.ts` - AI-powered viral clip suggestions
- `video-cut.ts` - Create actual short clips via Stream API

**Durable Objects (JobTracker)** provide real-time job progress tracking with in-memory state synced to D1.

### Database Schema (D1)

Core tables:
- `users` - Clerk user data synced from authentication
- `subscriptions` - Stripe subscription status
- `projects` - Video metadata, R2/Stream references, processing status
- `transcriptions` - Full text + timestamped segments (JSON)
- `shorts` - AI-suggested clips with start/end times
- `processing_jobs` - Job tracking with progress percentages

**Project Status Flow:**
```
uploading → processing → transcribing → analyzing → completed
                                                    ↓
                                                  error
```

## API Routes (Workers)

All routes require authentication (Bearer token) except webhooks:

- `POST /api/upload` - Generate presigned R2 URL for video upload
- `GET /api/projects` - List user's projects
- `GET /api/projects/:id` - Get project details + transcription + shorts
- `PATCH /api/projects/:id` - Update project metadata
- `DELETE /api/projects/:id` - Delete project (cascades to R2/Stream)
- `POST /api/transcribe` - Queue transcription job
- `POST /api/analyze` - Queue analysis job
- `POST /api/shorts` - Create short clip from timestamp
- `GET /api/shorts/:id` - Get short details
- `DELETE /api/shorts/:id` - Delete short
- `POST /api/shorts/:id/download` - Get temporary download URL

**Public Webhooks:**
- `POST /api/webhooks/stripe` - Stripe payment events (signature verification)
- `POST /api/webhooks/stream` - Stream video processing events

## Environment Variables

### Frontend (.env.local)

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Clerk URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/projects
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/projects

# API
NEXT_PUBLIC_WORKER_URL=http://localhost:8787  # or production URL
```

### Workers (.dev.vars)

Create `.dev.vars` for local development (see `.dev.vars.example`):

```bash
# Clerk Authentication
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_STREAM_CUSTOMER_CODE=...
CLOUDFLARE_API_TOKEN=...

# R2 Access
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_ENDPOINT=https://...
R2_BUCKET_NAME=videditor-videos

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Production Secrets** (use `wrangler secret put`):
```bash
wrangler secret put CLERK_SECRET_KEY
wrangler secret put STRIPE_SECRET_KEY
```

## Key Files & Utilities

### Drizzle ORM Database Layer

**Schema Definition (`/db/schema.ts`):**
- TypeScript-first schema definitions for all 6 tables
- Auto-generated TypeScript types (`User`, `Project`, `Short`, etc.)
- Foreign key relationships, indexes, and CHECK constraints
- Single source of truth for database structure

**Query Helpers (`/db/queries/*.ts`):**
- `users.ts` - User operations (ensureUserExists, getUserById)
- `projects.ts` - Project CRUD with ownership verification
- `transcriptions.ts` - Transcription management
- `shorts.ts` - Shorts with JOIN queries for ownership checks
- `jobs.ts` - Processing job tracking

**Database Instance (`/db/index.ts`):**
```typescript
import { createDb } from '../../db';
const db = createDb(env.DB);
const projects = await listUserProjects(db, userId);
```

**Migration Files:**
- Auto-generated SQL in `drizzle/migrations/`
- Applied via `npm run db:migrate:local` or `npm run db:migrate:prod`

### Frontend API Client (`/lib/api/client.ts`)

Three API call methods:
1. `apiCall()` - Basic fetch wrapper
2. `useApi()` - React hook with automatic Clerk token
3. `apiCallServer()` - Server-side with explicit token

Always use these instead of raw fetch for Workers API calls.

### CORS Handling (`/workers/utils/cors.ts`)

Handles preflight OPTIONS requests and adds CORS headers. Environment-aware origins (dev vs production).

### R2 Storage (`/lib/r2/index.ts`)

Utilities for S3-compatible R2 operations:
- S3 client creation with credentials
- Presigned URL generation for uploads
- Consistent object key naming

### Stream API (`/lib/stream/index.ts`)

Cloudflare Stream integration:
- Upload videos from R2 to Stream
- Create clips with precise timestamps
- Generate download URLs for processing
- Webhook signature verification

### User Management (`/workers/utils/auth.ts`)

- `verifyClerkAuth()` - JWT verification and user data extraction
- `ensureUserExists()` - Syncs Clerk users to D1 via Drizzle ORM
- Called automatically on every authenticated request in main worker handler

## Important Patterns

### Direct Client → R2 Uploads

Videos upload directly from browser to R2 using presigned URLs, bypassing the server. This prevents bottlenecks and leverages edge performance.

### Queue Message Structure

All queue messages follow this pattern:
```typescript
{
  type: 'transcribe' | 'analyze' | 'upload_to_stream' | 'cut_video',
  projectId: string,
  userId: string,
  // ... type-specific fields
}
```

### Error Handling

- All Workers routes use try-catch with consistent error responses
- Queue processors update job status to 'error' on failure
- Automatic retry (max 3 attempts) for queue messages
- Frontend polls project status every 5 seconds

### CORS Configuration

CORS utility handles both preflight and actual requests. All Worker responses must use `withCors()` wrapper:

```typescript
return withCors(new Response(JSON.stringify(data), {
  headers: { 'Content-Type': 'application/json' }
}), request);
```

## Migration Notes

**Recently migrated from Supabase → Cloudflare:**
- README.md still references old Supabase architecture (outdated)
- Actual implementation uses Cloudflare Stack (D1, R2, Workers, Stream, Workers AI)
- Authentication migrated from Supabase Auth → Clerk
- All database operations now use D1 SQL queries
- Storage migrated from Supabase Storage → R2

When making changes, follow the **implemented Cloudflare patterns**, not the outdated README.

## Configuration Files

### wrangler.toml

Defines Worker bindings:
- D1 database: `videditor-db`
- R2 buckets: `VIDEOS_BUCKET`, `SHORTS_BUCKET`
- Workers AI binding
- Queue bindings: `VIDEO_QUEUE`
- Durable Objects: `JOB_TRACKER`

### next.config.js

- Configures image domains for Clerk + Cloudflare
- Exposes environment variables to browser
- Standalone output for Cloudflare Pages compatibility

### tailwind.config.ts

- Custom HSL color system with CSS variables
- JetBrains Mono font (monospace aesthetic)
- shadcn/ui plugin integration

## Design System & Color Scheme

### Color Palette

The application uses a **dark-first** design with a consistent **green accent** color scheme defined via CSS variables in `styles/globals.css`:

**Primary Color (Green):**
- `--primary: 154 54% 46%` (HSL: Green at ~46% lightness)
- Used for: buttons, hover states, active borders, file icons, drag-and-drop highlights
- Foreground: `--primary-foreground: 0 0% 100%` (white text on primary backgrounds)

**Dark Theme Palette:**
- Background: `222 47% 11%` (dark blue-gray)
- Card/Popover: `217 33% 9%` (slightly darker)
- Border/Input: `217 33% 17%` (subtle borders)
- Muted: `217 33% 17%` (muted backgrounds)
- Accent: `154 54% 15%` (dark green for subtle accents)

**Semantic Colors:**
- Destructive (errors): `0 63% 31%` (dark red)
- Success/Active states: Use primary green

### Component Guidelines

**Always use CSS variables instead of hardcoded colors:**
- ✅ `text-primary` or `border-primary` (uses theme variables)
- ❌ `text-[#37b680]` or `border-green-500` (hardcoded, breaks theming)

**Common patterns:**
```tsx
// Hover states
hover:border-primary hover:bg-primary/10

// Active/selected states
border-primary bg-primary/10 text-primary

// Error states
bg-destructive/10 border-destructive/30 text-destructive

// Icons and accents
text-primary (use primary for all accent icons, not blue/red/etc)
```

**Consistency Rules:**
1. All accent colors (icons, borders, highlights) should use `primary` (green)
2. Error states use `destructive` variable (not hardcoded red)
3. Dark mode compatible opacity levels: `/10` for backgrounds, `/30` for borders
4. Never mix hardcoded hex colors with variable-based theming

## Testing & Debugging

### Local Testing Workflow

1. Start both servers: `npm run dev`
2. Frontend: http://localhost:3000
3. Workers API: http://localhost:8787
4. D1 database uses local `.wrangler/state/v3/d1/`
5. R2 uses local `.wrangler/state/v3/r2/`

### Queue Testing

Queue messages can be manually triggered by making API calls:
- Upload video → Triggers `upload_to_stream` job
- POST `/api/transcribe` → Triggers `transcribe` job
- POST `/api/analyze` → Triggers `analyze` job

### Common Issues

**CORS Errors**: Ensure `NEXT_PUBLIC_WORKER_URL` matches the actual Worker URL (check for trailing slashes, http vs https).

**JWT Verification Fails**: Check `CLERK_SECRET_KEY` is set in both frontend and workers. Ensure token is passed in `Authorization: Bearer <token>` header.

**D1 Migrations**: Always run migrations locally first (`npm run d1:migrate:local`) before deploying to production.

**R2 Access**: Verify R2 credentials in `.dev.vars` match your Cloudflare account. Use `wrangler r2 bucket list` to verify access.

## Security Considerations

- JWT tokens verified on every protected Workers route
- User ID extracted from JWT and enforced in database queries (row-level security at app level)
- Presigned R2 URLs expire after 1 hour
- Webhook endpoints verify signatures (Stripe, Stream)
- Secrets managed via `wrangler secret` for production
- CORS strictly enforces allowed origins based on environment
- add todo to adjust s3 storage dir pattern