// Cloudflare Workers Environment Types

export interface Env {
  // D1 Database
  DB: D1Database;

  // R2 Buckets
  VIDEOS_BUCKET: R2Bucket;
  SHORTS_BUCKET: R2Bucket;

  // Cloudflare AI
  AI: Ai;

  // Queue
  VIDEO_QUEUE: Queue;

  // Durable Objects
  JOB_TRACKER: DurableObjectNamespace;

  // Environment variables
  ENVIRONMENT: string;
  CLERK_PUBLISHABLE_KEY: string;
  CLERK_SECRET_KEY: string;
  CLERK_JWT_KEY?: string; // Optional: for networkless verification (faster)
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  CLOUDFLARE_STREAM_API_KEY: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_ACCOUNT_ID: string;
  R2_BUCKET_NAME?: string; // Optional: defaults to 'videditor-videos' if not set
}

// Queue message types
export interface VideoProcessingMessage {
  type: 'upload_to_stream' | 'transcribe' | 'analyze' | 'cut_video';
  projectId: string;
  userId: string;
  metadata?: Record<string, unknown>;
}

export interface ShortCutMessage {
  type: 'cut_video';
  projectId: string;
  shortId: string;
  startTime: number;
  endTime: number;
}
