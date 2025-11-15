# VidEditor - AI-Powered Video Shorts Generator

Transform your long-form videos into viral shorts automatically using AI. Upload your video, get automatic transcription via Whisper AI, and let GPT-5 suggest the most engaging short clips.

## Features

- 🎥 **Video Upload** - Drag & drop video upload with progress tracking
- 🎤 **AI Transcription** - Automatic transcription using OpenRouter's Whisper
- ✨ **Smart Analysis** - GPT-5 powered analysis to find viral-worthy moments
- 👀 **Preview & Download** - Preview suggested shorts and download individually or in bulk
- 🔄 **Real-time Updates** - Live status updates as your video processes
- 🔐 **Secure Auth** - User authentication via Supabase
- 💳 **Payment Ready** - Stripe integration foundation (currently free beta)

## Tech Stack

- **Frontend**: Next.js 15 (Pages Router), React 19, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Backend**: Supabase (Auth, Database, Storage, Edge Functions)
- **AI**: OpenRouter (Whisper for transcription, GPT-4 for analysis)
- **Payments**: Stripe (infrastructure ready, billing disabled)

## Prerequisites

Before you begin, ensure you have:

- Node.js 18+ installed
- A Supabase account ([supabase.com](https://supabase.com))
- An OpenRouter API key ([openrouter.ai](https://openrouter.ai))
- (Optional) A Stripe account for payment integration

## Getting Started

### 1. Clone the repository

```bash
cd videditor
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings > API
3. Copy your project URL and anon/public key

#### Run Database Migrations

In your Supabase project:

1. Go to the SQL Editor
2. Run the migration files in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_storage_buckets.sql`

### 3. Set up OpenRouter

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Get your API key from the dashboard
3. Add credits to your account

### 4. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenRouter
OPENROUTER_API_KEY=your_openrouter_api_key

# Stripe (optional - for future use)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
videditor/
├── pages/
│   ├── _app.tsx              # App wrapper
│   ├── _document.tsx         # HTML document
│   ├── index.tsx             # Landing page
│   ├── auth/
│   │   ├── login.tsx         # Login page
│   │   ├── signup.tsx        # Sign up page
│   │   └── callback.tsx      # Auth callback handler
│   ├── projects/
│   │   ├── index.tsx         # Projects dashboard
│   │   └── [id].tsx          # Project detail page
│   └── api/
│       ├── transcribe.ts     # Transcription API
│       └── analyze.ts        # AI analysis API
├── components/
│   ├── ui/                   # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   └── progress.tsx
│   └── video-upload.tsx      # Video upload component
├── lib/
│   ├── supabase/            # Supabase clients
│   │   ├── client.ts        # Browser client
│   │   └── server.ts        # Server client
│   ├── openrouter/          # OpenRouter integration
│   │   └── index.ts
│   ├── stripe/              # Stripe integration
│   │   └── index.ts
│   └── utils/               # Utility functions
│       ├── cn.ts            # Class name utility
│       ├── index.ts         # Helper functions
│       └── auth.ts          # Auth middleware
├── types/
│   ├── database.ts          # Database types
│   └── shorts.ts            # Shorts types
├── styles/
│   └── globals.css          # Global styles
├── supabase/
│   └── migrations/          # Database migrations
│       ├── 001_initial_schema.sql
│       └── 002_storage_buckets.sql
└── public/                  # Static assets
```

## Key Features Explained

### Video Upload

The video upload component (`components/video-upload.tsx`) handles:
- Drag & drop file upload
- File validation (type, size)
- Progress tracking during upload
- Automatic metadata extraction (duration, size)
- Supabase Storage integration

### Transcription Pipeline

When a video is uploaded:
1. Video is stored in Supabase Storage
2. Project record is created in the database
3. `/api/transcribe` endpoint is called
4. OpenRouter Whisper API transcribes the audio
5. Transcription is saved with timestamps
6. Real-time updates notify the frontend

### AI Analysis

The analysis system:
1. Retrieves the transcript
2. Sends it to GPT-5 via OpenRouter
3. AI suggests 3-8 viral-worthy short clips
4. Shorts are saved with titles, descriptions, and timestamps
5. User can preview and download shorts

### Real-time Updates

Supabase Realtime subscriptions keep the UI in sync:
- Project status changes
- Transcription completion
- Shorts generation
- Processing errors

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import your repository on [vercel.com](https://vercel.com)
3. Add environment variables
4. Deploy!

### Deploy to Netlify

1. Build command: `npm run build`
2. Publish directory: `.next`
3. Add environment variables
4. Deploy!

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) | Yes |
| `OPENROUTER_API_KEY` | OpenRouter API key | Yes |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | No |
| `STRIPE_SECRET_KEY` | Stripe secret key | No |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | No |
| `NEXT_PUBLIC_APP_URL` | Your app URL | Yes |

## Database Schema

### projects
- `id` - UUID primary key
- `user_id` - User who created the project
- `title` - Project title
- `video_url` - URL to uploaded video
- `duration` - Video duration in seconds
- `file_size` - File size in bytes
- `status` - Processing status
- `created_at` - Creation timestamp

### transcriptions
- `id` - UUID primary key
- `project_id` - Related project
- `text` - Full transcription text
- `segments` - Timestamped segments (JSONB)
- `language` - Detected language

### shorts
- `id` - UUID primary key
- `project_id` - Related project
- `title` - Short title
- `description` - Why this clip is engaging
- `start_time` - Start time in seconds
- `end_time` - End time in seconds
- `status` - Processing status

## Payment Integration (Future)

The app includes Stripe integration foundation. To enable payments:

1. Set up Stripe account
2. Configure webhook endpoints
3. Update `lib/stripe/index.ts` to set `PAYMENT_ENABLED = true`
4. Uncomment payment UI in relevant components

Current pricing model: $0.01 per second of video duration

## API Routes

### POST /api/transcribe
Transcribe a video's audio

**Body:**
```json
{
  "projectId": "uuid"
}
```

### POST /api/analyze
Analyze transcript and generate short suggestions

**Body:**
```json
{
  "projectId": "uuid",
  "customPrompt": "Optional custom instructions"
}
```

## Troubleshooting

### Videos not uploading
- Check Supabase Storage is configured correctly
- Verify storage policies in `002_storage_buckets.sql`
- Check file size limits (500MB max)

### Transcription failing
- Verify OpenRouter API key is valid
- Check API credits in OpenRouter dashboard
- Review server logs for detailed errors

### Real-time updates not working
- Ensure Supabase Realtime is enabled
- Check browser console for connection errors
- Verify RLS policies allow subscriptions

## Future Enhancements

- [ ] Actual FFmpeg integration for video cutting
- [ ] Thumbnail generation for shorts
- [ ] Batch processing for multiple videos
- [ ] Social media platform integrations
- [ ] Custom branding/watermarks
- [ ] Advanced editing features
- [ ] Analytics and performance tracking

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
- Open an issue on GitHub
- Check existing issues for solutions
- Review Supabase/OpenRouter documentation

---

Built with ❤️ using Next.js, Supabase, and AI
