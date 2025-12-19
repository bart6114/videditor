import type { MediaAsset, Short } from '@server/db/schema';
import type { ShortFormMetadata, ShortTasks, AssetStatus, ShortStatus } from '@shared/index';

/**
 * Maps AssetStatus to ShortStatus for backward compatibility
 * - 'uploading' -> 'pending' (file being uploaded, not ready)
 * - 'ready' -> 'completed' (upload done, no processing needed)
 * - 'processing' -> 'processing'
 * - 'completed' -> 'completed'
 * - 'error' -> 'error'
 */
function mapAssetStatusToShortStatus(assetStatus: AssetStatus): ShortStatus {
  switch (assetStatus) {
    case 'uploading':
      return 'pending';
    case 'ready':
      return 'completed';
    case 'processing':
      return 'processing';
    case 'completed':
      return 'completed';
    case 'error':
      return 'error';
    default:
      return 'pending';
  }
}

/**
 * Transforms a MediaAsset (with assetType='short_form') into the legacy Short format.
 * This allows frontend components to continue using the Short type during migration.
 */
export function mediaAssetToShort(asset: MediaAsset): Short {
  const metadata = asset.metadata as ShortFormMetadata | null;

  // Map task status from media asset metadata to short tasks format
  // The tasks in MediaAsset use 'done' while Short uses the same format
  const tasks = metadata?.tasks ? {
    clip_extraction: metadata.tasks.clip_extraction,
    thumbnail_extraction: metadata.tasks.thumbnail_extraction,
    social_content: metadata.tasks.social_content,
  } as ShortTasks : null;

  return {
    id: asset.id,
    projectId: asset.projectId,
    analysisJobId: metadata?.analysisJobId ?? null,
    transcriptionSlice: metadata?.transcriptionSlice ?? asset.title,
    startTime: metadata?.startTime ?? 0,
    endTime: metadata?.endTime ?? (asset.durationSeconds ?? 0),
    outputObjectKey: asset.sourceObjectKey,
    thumbnailUrl: asset.thumbnailUrl,
    status: mapAssetStatusToShortStatus(asset.status),
    errorMessage: asset.errorMessage,
    metadata: asset.metadata,
    socialContent: asset.socialContent,
    tasks,
    createdAt: new Date(asset.createdAt),
    updatedAt: new Date(asset.updatedAt),
  };
}

/**
 * Transforms an array of short_form MediaAssets to Short format
 */
export function mediaAssetsToShorts(assets: MediaAsset[]): Short[] {
  return assets
    .filter(a => a.assetType === 'short_form')
    .map(mediaAssetToShort);
}
