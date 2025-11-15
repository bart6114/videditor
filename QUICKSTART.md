# Quick Start Guide

Welcome to VidEditor! Follow these steps to get your AI-powered video shorts generator up and running.

## 1. Install Dependencies

You've already done this, but for reference:
```bash
npm install
```

## 2. Set Up Supabase

### Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for your project to be ready (takes ~2 minutes)

### Run Database Migrations
1. In your Supabase dashboard, go to the **SQL Editor**
2. Click **"New Query"**
3. Copy and paste the contents of `supabase/migrations/001_initial_schema.sql`
4. Click **"Run"**
5. Repeat for `supabase/migrations/002_storage_buckets.sql`

### Get Your API Keys
1. In Supabase dashboard, go to **Settings** > **API**
2. Copy:
   - Project URL
   - `anon` / `public` key
   - `service_role` key (keep this secret!)

## 3. Set Up OpenRouter

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Go to **API Keys**
3. Create a new API key
4. Add some credits to your account ($5 minimum recommended)

## 4. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# OpenRouter
OPENROUTER_API_KEY=your-openrouter-api-key-here

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Stripe (Optional - leave empty for now)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

## 5. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser!

## 6. Test the Application

1. Click **"Sign Up"** to create an account
2. Verify your email (check Supabase Auth settings if emails aren't working)
3. Upload a test video
4. Wait for transcription to complete
5. Click **"Analyze with AI"** to generate shorts
6. Preview and download your shorts!

## Common Issues

### Supabase Connection Error
- Double-check your environment variables are correct
- Make sure you copied the URL and keys correctly (no extra spaces!)
- Restart the dev server after changing `.env.local`

### Transcription Not Working
- Check that your OpenRouter API key is valid
- Verify you have credits in your OpenRouter account
- Check the browser console and terminal for error messages

### Videos Not Uploading
- Ensure Supabase Storage buckets were created correctly
- Check that you ran `002_storage_buckets.sql` migration
- Verify RLS policies are set up correctly

### Build Errors
The app successfully builds! If you make changes and encounter build errors:
- Run `npm run lint` to check for code issues
- Make sure all imports are correct
- Check that TypeScript types are properly defined

## Production Deployment

### Deploy to Vercel
1. Push your code to GitHub
2. Import the repository in Vercel
3. Add all environment variables (use production Supabase URL)
4. Deploy!

### Enable Payments (Future)
When you're ready to enable the $0.01/second payment model:
1. Create a Stripe account
2. Add Stripe environment variables
3. Update `lib/stripe/index.ts` to set `PAYMENT_ENABLED = true`
4. Set up Stripe webhooks

## What's Next?

### Recommended Enhancements
1. **Real Transcription**: Integrate actual Whisper API calls (currently using mock data)
2. **Video Cutting**: Add FFmpeg integration to actually cut videos
3. **Thumbnail Generation**: Create thumbnails for shorts
4. **Social Media**: Add direct sharing to TikTok, Instagram, YouTube
5. **Analytics**: Track which shorts perform best

### Project Structure
```
pages/          - All your routes
components/     - Reusable UI components
lib/            - Helper functions and integrations
types/          - TypeScript type definitions
supabase/       - Database migrations
public/         - Static assets
```

## Support

- Check the main [README.md](./README.md) for detailed documentation
- Review code comments for implementation details
- Supabase docs: [supabase.com/docs](https://supabase.com/docs)
- OpenRouter docs: [openrouter.ai/docs](https://openrouter.ai/docs)

Happy coding! 🎥✨
