export const PROJECT_STATUSES = [
  'uploading',
  'ready',
  'queued',
  'processing',
  'transcribing',
  'analyzing',
  'completed',
  'error',
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const JOB_TYPES = ['thumbnail', 'transcription', 'analysis', 'short_processing'] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = ['queued', 'running', 'succeeded', 'failed', 'canceled'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const SHORT_STATUSES = ['pending', 'processing', 'completed', 'error'] as const;
export type ShortStatus = (typeof SHORT_STATUSES)[number];

// Task tracking for short processing
export const SHORT_TASK_TYPES = ['clip_extraction', 'thumbnail_extraction', 'social_content'] as const;
export type ShortTaskType = (typeof SHORT_TASK_TYPES)[number];

export const SHORT_TASK_STATUSES = ['pending', 'processing', 'done', 'error', 'skipped'] as const;
export type ShortTaskStatus = (typeof SHORT_TASK_STATUSES)[number];

export type ShortTasks = {
  clip_extraction: Exclude<ShortTaskStatus, 'skipped'>;
  thumbnail_extraction: Exclude<ShortTaskStatus, 'skipped'>;
  social_content: ShortTaskStatus;
};

// Payload for short_processing job
export type ShortProcessingPayload = {
  shortId: string;
  projectId: string;
  sourceObjectKey: string;
  sourceBucket: string;
  organizationId: string;
  startTime: number;
  endTime: number;
  transcriptionSlice: string;
  socialPlatforms?: SocialPlatform[];
  contextBefore?: string;
  contextAfter?: string;
};

export const SOCIAL_PLATFORMS = ['youtube', 'instagram', 'tiktok', 'linkedin'] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export type YouTubeSocialContent = {
  title: string;
  description: string;
};

export type InstagramSocialContent = {
  caption: string;
};

export type TikTokSocialContent = {
  caption: string;
};

export type LinkedInSocialContent = {
  caption: string;
};

export type SocialContent = {
  youtube?: YouTubeSocialContent;
  instagram?: InstagramSocialContent;
  tiktok?: TikTokSocialContent;
  linkedin?: LinkedInSocialContent;
};

export const ASSET_KINDS = ['source', 'transcript', 'clip', 'thumbnail', 'analysis'] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export type ShortsSettings = {
  preferredLength: number; // Target length in seconds (e.g., 30, 45, 60)
  maxLength: number;       // Maximum allowed length in seconds (e.g., 60, 90, 120)
};

export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
};

export type ApiErrorResponse = {
  success: false;
  error: string;
  details?: unknown;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export type UploadRequestResponse = {
  projectId: string;
  objectKey: string;
  uploadUrl: string;
  bucket: string;
};

export type UploadCompletePayload = {
  projectId: string;
  durationSeconds?: number;
  fileSizeBytes?: number;
  metadata?: Record<string, unknown>;
};
