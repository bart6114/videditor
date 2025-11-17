// Cloudflare Workers Environment Types

export interface Env {
  // D1 Database
  DB: D1Database;

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
  CLOUDFLARE_API_TOKEN: string; // Cloudflare API token for Stream operations
  CLOUDFLARE_ACCOUNT_ID: string;
  STREAM_WEBHOOK_SECRET?: string; // Optional: for verifying Stream webhook signatures
}

// Queue message types
export interface VideoProcessingMessage {
  type: 'transcribe' | 'analyze' | 'cut_video';
  projectId: string;
  userId: string;
  videoUid?: string; // Stream video UID
  metadata?: Record<string, unknown>;
}

export interface ShortCutMessage {
  type: 'cut_video';
  projectId: string;
  shortId: string;
  startTime: number;
  endTime: number;
}
