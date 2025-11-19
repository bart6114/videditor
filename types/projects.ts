import type { ProjectStatus } from '@shared/index';

export type ProjectSummary = {
  id: string;
  userId: string;
  title: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  status: ProjectStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  shortsCount?: number;
  hasTranscription?: boolean;
};
