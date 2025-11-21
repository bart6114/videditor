export const PROJECT_STATUSES = [
  'uploading',
  'ready',
  'queued',
  'processing',
  'transcribing',
  'analyzing',
  'rendering',
  'delivering',
  'completed',
  'error',
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const JOB_TYPES = ['thumbnail', 'transcription', 'analysis', 'cutting', 'delivery'] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = ['queued', 'running', 'succeeded', 'failed', 'canceled'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const SHORT_STATUSES = ['pending', 'processing', 'completed', 'error'] as const;
export type ShortStatus = (typeof SHORT_STATUSES)[number];

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
