# VidEditor - AI-Powered Video Shorts Generator

Transform your long-form videos into viral shorts automatically using AI. Built entirely on Cloudflare's edge platform for global performance and scalability.

## Features

- 🎥 **Video Upload** - Drag & drop video upload with direct R2 storage (up to 1GB)
- 🎤 **AI Transcription** - Automatic transcription using Workers AI (Whisper)
- ✨ **Smart Analysis** - AI-powered analysis (Llama) to find viral-worthy moments
- ✂️ **Video Clipping** - Create short clips via Cloudflare Stream API
- 🔄 **Real-time Updates** - Live job progress tracking with Durable Objects
- 🔐 **Secure Auth** - User authentication via Clerk
- 💳 **Payments** - Stripe integration for subscriptions

## Tech Stack

### Frontend
- **Framework**: Next.js 15 (Pages Router), React 19, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Authentication**: Clerk Next.js SDK

### Backend (Cloudflare Workers)
- **Runtime**: Cloudflare Workers (edge compute)
- **Database**: D1 (SQLite-based edge database)
- **Storage**: R2 (S3-compatible object storage for videos)
- **Video Processing**: Cloudflare Stream API
- **AI Models**: Workers AI (Whisper for transcription, Llama for analysis)
- **Background Jobs**: Cloudflare Queues
- **Real-time State**: Durable Objects (JobTracker)
- **Payments**: Stripe

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Cloudflare account
- Clerk account (for authentication)
- Stripe account (for payments)
- wrangler CLI: `npm install -g wrangler`

### 1. Clone and Install

```bash
git clone <your-repo>
cd videditor
npm install
```

### 2. Configure Cloudflare

#### Login to Cloudflare
```bash
wrangler login
```

#### Create D1 Database
```bash
wrangler d1 create videditor-db
```

Copy the output database ID and update `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "videditor-db"
database_id = "YOUR_DATABASE_ID_HERE"
```

#### Apply D1 Migrations
```bash
npm run d1:migrate:local   # For local development
npm run d1:migrate:prod    # For production
```

#### Create R2 Buckets
```bash
wrangler r2 bucket create videditor-videos
wrangler r2 bucket create videditor-shorts
```

#### Create Queue
```bash
wrangler queues create video-processing-queue
```

#### Get Cloudflare Account ID
```bash
wrangler whoami
```

Update `wrangler.toml` with your account ID:
```toml
account_id = "your-cloudflare-account-id"
```

#### Generate R2 API Tokens
1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Create API token with R2 permissions
3. Note down access key ID and secret access key

### 3. Setup Clerk Authentication

1. Create account at https://clerk.com
2. Create a new application
3. Go to **API Keys** and copy:
   - Publishable Key (starts with `pk_`)
   - Secret Key (starts with `sk_`)
4. In Clerk dashboard, configure:
   - **Paths**: `/sign-in`, `/sign-up`
   - **After sign in URL**: `/projects`
   - **After sign up URL**: `/projects`

### 4. Setup Cloudflare Stream

1. Go to https://dash.cloudflare.com
2. Navigate to **Stream**
3. Enable Stream for your account
4. Create API token with Stream permissions
5. Note down the API key and customer code

### 5. Setup Stripe

1. Go to https://dashboard.stripe.com
2. Get your **Secret Key** (test mode)
3. Get your **Publishable Key** (test mode)
4. Create a **Subscription Price**:
   - Products → Create product → Add pricing
   - Copy the Price ID (starts with `price_`)
5. Setup webhook endpoint for local testing:
   ```bash
   stripe listen --forward-to localhost:8787/api/webhooks/stripe
   ```
   Copy the webhook secret (starts with `whsec_`)

### 6. Configure Environment Variables

Create `.env.local` in the root directory:

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
NEXT_PUBLIC_WORKER_URL=http://localhost:8787
```

Create `.dev.vars` for Workers (see `.dev.vars.example`):

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
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 7. Run Development Servers

Run both frontend and workers concurrently:
```bash
npm run dev
```

Or run separately:
```bash
npm run dev:next    # Frontend only (port 3000)
npm run dev:worker  # Workers only (port 8787)
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## How It Works

### 1. Video Upload Flow

1. User uploads video via frontend
2. Frontend requests presigned R2 URL from Worker
3. Video uploads directly to R2 (client → R2, bypassing server)
4. Worker creates project record in D1
5. Worker queues job to upload R2 video to Stream
6. Stream processes video and sends webhook when ready
7. Webhook updates project status to "completed"

### 2. Transcription Flow

1. User triggers transcription via UI
2. Worker creates processing job in D1
3. Job queued to background queue (Cloudflare Queues)
4. Queue consumer downloads audio from Stream
5. Audio processed through Workers AI (Whisper model)
6. Transcription saved to D1 with timestamped segments

### 3. Analysis Flow

1. User triggers analysis
2. Worker fetches transcription from D1
3. Job queued to background queue
4. Queue consumer sends transcript to Workers AI (Llama)
5. AI suggests 3-5 viral short clips with timestamps
6. Suggestions saved as "shorts" in D1

### 4. Clip Creation Flow

1. User selects a suggested short (or creates custom)
2. Worker creates short record in D1
3. Job queued to background queue
4. Queue consumer calls Stream clip API with timestamps
5. Stream creates clip from original video
6. Clip URL saved to short record

## API Routes (Workers)

All routes require Clerk authentication (Bearer token) except webhooks.

### Upload
- `POST /api/upload` - Generate presigned R2 URL for video upload

### Projects
- `GET /api/projects` - List user's projects
- `GET /api/projects/:id` - Get project details + transcription + shorts
- `PATCH /api/projects/:id` - Update project metadata
- `DELETE /api/projects/:id` - Delete project (cascades to R2/Stream)

### Processing
- `POST /api/transcribe` - Queue transcription job
- `POST /api/analyze` - Queue analysis job

### Shorts
- `POST /api/shorts` - Create short clip from timestamp
- `GET /api/shorts/:id` - Get short details
- `DELETE /api/shorts/:id` - Delete short
- `POST /api/shorts/:id/download` - Get temporary download URL

### Webhooks
- `POST /api/webhooks/stripe` - Stripe payment events (signature verified)
- `POST /api/webhooks/stream` - Cloudflare Stream processing events

## Database Schema (D1)

### users
- Synced from Clerk authentication
- Stores: user_id, email, full_name, image_url

### subscriptions
- Stripe subscription status
- Links user to Stripe customer ID

### projects
- Video metadata (title, duration, file_size)
- R2 object key reference
- Cloudflare Stream video ID
- Processing status: `uploading` → `processing` → `transcribing` → `analyzing` → `completed`/`error`

### transcriptions
- Full transcript text
- Timestamped segments stored as JSON
- Language detection

### shorts
- AI-suggested or user-created clips
- Start/end timestamps
- Cloudflare Stream clip ID
- Processing status

### processing_jobs
- Job tracking with type and status
- Progress percentage (0-100)
- Error messages if failed

## Project Structure

```
videditor/
├── components/          # React components
│   ├── layout/         # Layout components (Sidebar, etc.)
│   └── ui/             # shadcn/ui components
├── lib/
│   ├── api/            # API client utilities
│   ├── r2/             # R2 storage utilities
│   ├── stream/         # Cloudflare Stream utilities
│   └── stripe/         # Stripe integration
├── migrations/         # D1 database migrations
│   ├── 0001_initial_schema.sql
│   └── README.md       # Migration instructions
├── pages/              # Next.js pages
│   ├── projects/       # Projects dashboard
│   ├── sign-in/        # Clerk sign-in
│   ├── sign-up/        # Clerk sign-up
│   └── index.tsx       # Landing page
├── types/              # TypeScript types
│   └── d1.ts           # D1 database types
├── workers/            # Cloudflare Workers
│   ├── durable-objects/
│   │   └── JobTracker.ts  # Real-time job tracking
│   ├── queue/
│   │   ├── consumer.ts    # Queue message consumer
│   │   └── processors/    # Job processors
│   ├── routes/         # API route handlers
│   ├── utils/          # Worker utilities
│   └── index.ts        # Worker entry point
├── wrangler.toml       # Cloudflare configuration
└── CLAUDE.md          # Development guide for Claude Code
```

## Development Commands

```bash
# Development
npm run dev              # Run both Next.js + Workers
npm run dev:next         # Frontend only (port 3000)
npm run dev:worker       # Workers only (port 8787)

# Database
npm run d1:migrate:local # Local D1 migration
npm run d1:migrate:prod  # Production D1 migration

# Building
npm run build            # Build Next.js
npm run pages:build      # Build for Cloudflare Pages

# Deployment
npm run pages:deploy     # Deploy frontend to Cloudflare Pages
npm run worker:deploy    # Deploy workers

# Cloudflare Auth
npm run cf:login         # Login to Cloudflare
npm run cf:whoami        # Check current user
```

## Deployment

### Deploy Workers to Production

```bash
npm run worker:deploy
```

### Setup Production Secrets

```bash
wrangler secret put CLERK_SECRET_KEY
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put CLOUDFLARE_STREAM_API_KEY
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
```

### Deploy Frontend to Cloudflare Pages

**Option 1: Manual Deployment**
```bash
npm run build
npm run pages:build
npm run pages:deploy
```

**Option 2: Git Integration**
1. Go to https://dash.cloudflare.com → Pages
2. Create a project and connect your Git repository
3. Build settings:
   - Build command: `npm run build && npm run pages:build`
   - Build output directory: `.open-next/worker`
   - Environment variables: Add all `NEXT_PUBLIC_*` and `CLERK_*` vars

### Production Database Migration
```bash
npm run d1:migrate:prod
```

## Database Management

### Query D1 Database

**Local:**
```bash
wrangler d1 execute videditor-db --local --command="SELECT * FROM projects"
```

**Production:**
```bash
wrangler d1 execute videditor-db --remote --command="SELECT * FROM projects"
```

### View D1 Database Schema
```bash
wrangler d1 execute videditor-db --local --command="SELECT sql FROM sqlite_master WHERE type='table'"
```

## Cost Estimates (Approximate)

### Cloudflare Free Tier
- **Workers**: 100k requests/day
- **D1**: 5GB storage, 5M row reads/day
- **R2**: 10GB storage, 1M Class A operations
- **Queues**: 1M operations/month
- **Workers AI**: Generous free tier

### Paid Usage (after free tier)
- **Workers**: $0.50 per million requests
- **D1**: $0.75/GB storage, $1/billion row reads
- **R2**: $0.015/GB storage, zero egress fees
- **Stream**: $1 per 1,000 minutes stored, $1 per 1,000 minutes delivered
- **Workers AI**: Usage-based pricing

### Typical Monthly Cost
- **Low traffic** (< 100 videos): $0-10
- **Medium traffic** (< 1,000 videos): $20-50
- **High traffic** (10,000+ videos): $100-500

**Note**: Cloudflare Stream is the most expensive component at scale. Consider implementing usage quotas or tier-based pricing.

## Troubleshooting

### Workers Not Connecting to D1
- Ensure database ID in `wrangler.toml` matches created database
- Run migrations: `npm run d1:migrate:local`
- Check Worker logs: `wrangler tail`

### Clerk Authentication Failing
- Verify `NEXT_PUBLIC_CLERK_*` keys in `.env.local`
- Check `CLERK_SECRET_KEY` in `.dev.vars`
- Ensure paths match in Clerk dashboard settings
- Check middleware.ts is properly configured

### Stream Upload Failing
- Verify `CLOUDFLARE_STREAM_API_KEY` is correct
- Ensure Stream is enabled in your Cloudflare account
- Check R2 bucket is accessible and CORS is configured
- Verify `CLOUDFLARE_STREAM_CUSTOMER_CODE` is set

### Transcription Not Working
- Workers AI has rate limits on free tier
- Check Worker logs: `wrangler tail`
- Verify Stream video is in "ready" state
- Ensure video audio is accessible from Stream

### CORS Errors
- Check `NEXT_PUBLIC_WORKER_URL` matches actual Worker URL
- Verify no trailing slashes in URLs
- Ensure CORS headers are set in `workers/utils/cors.ts`

### Queue Jobs Not Processing
- Verify queue binding in `wrangler.toml`
- Check queue consumer is configured correctly
- View queue metrics in Cloudflare dashboard
- Check Worker logs during job processing

## Architecture Notes

This project uses a **hybrid architecture** with Next.js frontend and Cloudflare Workers backend:

- **Direct R2 Uploads**: Videos upload directly from browser to R2 using presigned URLs, avoiding server bottlenecks
- **Queue-Based Processing**: All heavy operations (transcription, analysis, clipping) run asynchronously via Queues
- **Edge Compute**: Workers run globally close to users for low latency
- **Durable Objects**: Real-time job tracking with in-memory state synced to D1
- **JWT Authentication**: Clerk tokens verified on every protected Worker route

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Support

For issues or questions:
1. Check Cloudflare Workers logs: `wrangler tail`
2. Query D1 database: `wrangler d1 execute videditor-db --local --command="SELECT * FROM projects"`
3. Review Clerk dashboard for auth issues
4. Check Stripe dashboard for payment issues
5. Open an issue on GitHub

---

Built with Next.js, Cloudflare Workers, and AI
