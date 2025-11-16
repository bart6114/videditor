// D1 Database Types for VidEditor

export interface User {
  id: string; // Clerk user ID
  email: string;
  full_name: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  video_url: string; // R2 object key
  stream_id: string | null; // Cloudflare Stream ID
  thumbnail_url: string | null;
  duration: number; // seconds
  file_size: number; // bytes
  status: 'uploading' | 'processing' | 'transcribing' | 'analyzing' | 'completed' | 'error';
  error_message: string | null;
  created_at: string;
  updated_at: string;
  // Enriched fields from API (not in DB)
  shortsCount?: number;
  hasTranscription?: boolean;
}

export interface TranscriptSegment {
  start: number; // seconds
  end: number; // seconds
  text: string;
}

export interface Transcription {
  id: string;
  project_id: string;
  text: string;
  segments: TranscriptSegment[]; // Stored as JSON string in DB
  language: string | null;
  created_at: string;
}

export interface Short {
  id: string;
  project_id: string;
  title: string;
  description: string;
  start_time: number; // seconds
  end_time: number; // seconds
  video_url: string | null; // Cloudflare Stream clip URL
  stream_clip_id: string | null; // Cloudflare Stream clip ID
  thumbnail_url: string | null;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessingJob {
  id: string;
  project_id: string;
  type: 'transcription' | 'analysis' | 'video_cut' | 'stream_upload';
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number; // 0.0 to 100.0
  error_message: string | null;
  metadata: Record<string, unknown> | null; // Stored as JSON string in DB
  created_at: string;
  updated_at: string;
}

// Helper type for database row results
export type DbRow<T> = T;

// Helper to parse JSON fields from D1
export function parseJsonField<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

// Helper to serialize JSON fields for D1
export function serializeJsonField<T>(value: T | null): string | null {
  if (!value) return null;
  return JSON.stringify(value);
}
