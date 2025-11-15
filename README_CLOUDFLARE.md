# VidEditor - Cloudflare-Native Architecture

AI-powered video editor that automatically transcribes videos and generates engaging short-form content, built entirely on Cloudflare's edge platform.

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 15 with TypeScript
- **API**: Cloudflare Workers
- **Database**: D1 (SQLite)
- **Auth**: Clerk
- **Storage**: R2 (videos)
- **Video Processing**: Cloudflare Stream API
- **AI**: Workers AI (Whisper for transcription, Llama for analysis)
- **Background Jobs**: Cloudflare Queues
- **State Management**: Durable Objects
- **Payments**: Stripe

### Key Features
- Upload videos (up to 500MB)
- Automatic transcription using Workers AI (Whisper)
- AI-powered analysis to suggest viral short clips
- Video clipping via Cloudflare Stream
- Real-time job progress tracking
- Subscription-based payments via Stripe

---

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- Cloudflare account
- Clerk account (for authentication)
- Stripe account (for payments)
- wrangler CLI: `npm install -g wrangler`

### 1. Clone and Install Dependencies

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

#### Generate R2 API Tokens
1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Create API token with R2 permissions
3. Note down access key ID and secret access key

### 3. Setup Clerk

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
5. Note down the API key

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

Create `.env.local` from `.env.example`:
```bash
cp .env.example .env.local
```

Fill in all values:
- `NEXT_PUBLIC_CLERK_*`: From Clerk dashboard
- `CLERK_SECRET_KEY`: From Clerk dashboard
- `CLOUDFLARE_*`: From Cloudflare dashboard
- `R2_*`: From R2 API tokens
- `STRIPE_*`: From Stripe dashboard

Also create `.dev.vars` for Workers development:
```bash
cp .env.example .dev.vars
```

### 7. Update wrangler.toml

Update `wrangler.toml` with your account ID:
```toml
account_id = "your-cloudflare-account-id"
```

---

## Development

### Run Next.js Frontend
```bash
npm run dev
```
Runs on http://localhost:3000

### Run Cloudflare Worker API
```bash
npm run worker:dev
```
Runs on http://localhost:8787

### Run Both Concurrently
You can run both in separate terminals, or use a tool like `concurrently`:
```bash
npx concurrently "npm run dev" "npm run worker:dev"
```

---

## Deployment

### Deploy Workers
```bash
npm run worker:deploy
```

### Deploy Frontend to Cloudflare Pages
```bash
npm run build
npm run pages:build
npm run pages:deploy
```

Or connect your Git repository to Cloudflare Pages:
1. Go to https://dash.cloudflare.com
2. Pages → Create a project
3. Connect your Git repository
4. Build settings:
   - Build command: `npm run build && npm run pages:build`
   - Build output directory: `.open-next/worker`
   - Environment variables: Add all `NEXT_PUBLIC_*` and `CLERK_*` vars

### Setup Production Environment Variables

For Workers:
```bash
wrangler secret put CLERK_SECRET_KEY
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put CLOUDFLARE_STREAM_API_KEY
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
```

For Pages (set in Cloudflare Dashboard):
- All `NEXT_PUBLIC_*` variables
- Clerk keys

### Production Database Migration
```bash
npm run d1:migrate:prod
```

---

## Project Structure

```
/
├── components/          # React components
│   ├── layout/         # Layout components (Sidebar, etc.)
│   └── ui/             # shadcn/ui components
├── lib/
│   ├── r2/             # R2 storage utilities
│   ├── stream/         # Cloudflare Stream utilities
│   └── stripe/         # Stripe integration
├── migrations/         # D1 database migrations
├── pages/              # Next.js pages
│   ├── api/            # Old API routes (to be removed)
│   ├── projects/       # Projects dashboard
│   ├── sign-in/        # Clerk sign-in
│   └── sign-up/        # Clerk sign-up
├── types/              # TypeScript types
│   └── d1.ts           # D1 database types
├── workers/            # Cloudflare Workers
│   ├── durable-objects/
│   │   └── JobTracker.ts
│   ├── queue/
│   │   ├── consumer.ts
│   │   └── processors/
│   ├── routes/         # API route handlers
│   ├── utils/          # Worker utilities
│   ├── env.ts          # Environment types
│   └── index.ts        # Worker entry point
└── wrangler.toml       # Cloudflare configuration
```

---

## How It Works

### 1. Video Upload Flow

1. User uploads video via frontend
2. Frontend requests presigned R2 URL from Worker
3. Video uploads directly to R2 (client → R2)
4. Worker creates project record in D1
5. Worker queues job to upload R2 video to Stream
6. Stream processes video and sends webhook when ready
7. Webhook updates project status to "completed"

### 2. Transcription Flow

1. User triggers transcription
2. Worker creates processing job in D1
3. Job queued to background queue
4. Queue consumer downloads audio from Stream
5. Audio processed through Workers AI (Whisper)
6. Transcription saved to D1 in chunks with timestamps

### 3. Analysis Flow

1. User triggers analysis
2. Worker fetches transcription from D1
3. Job queued to background queue
4. Queue consumer sends transcript to Workers AI (Llama)
5. AI suggests 3-5 viral short clips
6. Suggestions saved as "shorts" in D1

### 4. Clip Creation Flow

1. User selects a suggested short (or creates custom)
2. Worker creates short record in D1
3. Job queued to background queue
4. Queue consumer calls Stream clip API
5. Stream creates clip from original video
6. Clip URL saved to short record

---

## API Routes (Workers)

All routes require Clerk authentication (except webhooks).

### Upload
- `POST /api/upload` - Generate presigned R2 URL

### Projects
- `GET /api/projects` - List all projects
- `GET /api/projects/:id` - Get project details
- `PATCH /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Processing
- `POST /api/transcribe` - Queue transcription job
- `POST /api/analyze` - Queue analysis job

### Shorts
- `POST /api/shorts` - Create new short
- `GET /api/shorts/:id` - Get short details
- `DELETE /api/shorts/:id` - Delete short
- `POST /api/shorts/:id/download` - Get download URL

### Webhooks
- `POST /api/webhooks/stripe` - Stripe payment events
- `POST /api/webhooks/stream` - Cloudflare Stream events

---

## Database Schema (D1)

### users
- Synced from Clerk
- Stores user ID, email, name, avatar

### subscriptions
- Stripe subscription status
- Links user to Stripe customer

### projects
- Video metadata
- R2 object key
- Stream video ID
- Processing status

### transcriptions
- Full transcript text
- Timestamped segments (JSON)
- Language detection

### shorts
- Clip metadata
- Start/end timestamps
- Stream clip ID
- Processing status

### processing_jobs
- Job tracking
- Progress percentage
- Error handling

---

## Costs (Approximate)

### Cloudflare Free Tier
- Workers: 100k requests/day
- D1: 5GB storage, 5M row reads/day
- R2: 10GB storage, 1M Class A operations
- Queues: 1M operations/month
- Workers AI: Generous free tier

### Paid Usage (after free tier)
- Workers: $0.50 per million requests
- D1: $0.75/GB storage, $1/billion row reads
- R2: $0.015/GB storage, zero egress
- Stream: $1 per 1,000 minutes stored, $1 per 1,000 minutes delivered
- Workers AI: Usage-based pricing

### Typical Monthly Cost
- Low traffic (< 100 videos): $0-10
- Medium traffic (< 1,000 videos): $20-50
- High traffic (10,000+ videos): $100-500

**Note**: Stream is the most expensive part at scale. Consider implementing quotas or usage-based pricing.

---

## Troubleshooting

### Workers Not Connecting to D1
- Ensure database ID in `wrangler.toml` matches created database
- Run migrations: `npm run d1:migrate:local`

### Clerk Authentication Failing
- Check `NEXT_PUBLIC_CLERK_*` keys in `.env.local`
- Verify `CLERK_SECRET_KEY` in `.dev.vars`
- Ensure paths match in Clerk dashboard

### Stream Upload Failing
- Verify `CLOUDFLARE_STREAM_API_KEY` is correct
- Check account has Stream enabled
- R2 bucket must be accessible (CORS configured)

### Transcription Not Working
- Workers AI has rate limits on free tier
- Check Worker logs: `wrangler tail`
- Verify Stream video is in "ready" state

---

## Next Steps

1. **Frontend Migration**: Update React components to call Worker APIs instead of old Supabase APIs
2. **Remove Old Code**: Delete `pages/api/*` routes and old Supabase utilities
3. **Add WebSockets**: Use Durable Objects for real-time progress updates
4. **Implement Quotas**: Add subscription-based limits (e.g., 10 videos/month on free tier)
5. **Add Analytics**: Track usage metrics in D1
6. **Social Sharing**: Add one-click sharing to TikTok, Instagram, YouTube Shorts

---

## Support

For issues or questions:
1. Check Cloudflare Workers logs: `wrangler tail`
2. Check D1 data: `wrangler d1 execute videditor-db --local --command="SELECT * FROM projects"`
3. Review Clerk dashboard for auth issues
4. Check Stripe dashboard for payment issues

---

## License

MIT
