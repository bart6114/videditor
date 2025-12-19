import type { AssetType, AssetStatus, SocialContent, ShortFormMetadata, LongFormMetadata } from '@shared/index';

export type ProjectSummary = {
  id: string;
  userId: string;
  title: string;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
  shortsCount?: number;
  longFormCount?: number;
  shortFormCount?: number;
  hasTranscription?: boolean;
};

export type MediaAsset = {
  id: string;
  projectId: string;
  organizationId: string;
  createdById: string | null;
  assetType: AssetType;
  title: string;
  sourceObjectKey: string;
  sourceBucket: string;
  thumbnailUrl: string | null;
  videoUrl?: string | null;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  status: AssetStatus;
  errorMessage: string | null;
  sourceAssetId: string | null;
  socialContent: SocialContent | null;
  metadata: ShortFormMetadata | LongFormMetadata | null;
  createdAt: string;
  updatedAt: string;
};
