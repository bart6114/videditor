import type { MediaAsset } from '@server/db/schema';
import type { ShortFormMetadata } from '@shared/index';

/**
 * Sanitize a filename by removing invalid characters and limiting length
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // Remove invalid chars
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .slice(0, 200); // Limit length
}

/**
 * Generate a user-friendly filename for a media asset based on its metadata
 */
export function getAssetFilename(asset: Pick<MediaAsset, 'id' | 'title' | 'sourceObjectKey' | 'metadata'>): string {
  const metadata = asset.metadata as ShortFormMetadata | null;
  const shortName = metadata?.transcriptionSlice
    ? metadata.transcriptionSlice.slice(0, 50).trim()
    : asset.title?.slice(0, 50).trim() || `Short ${asset.id}`;
  const sanitizedTitle = sanitizeFilename(shortName);
  const extension = asset.sourceObjectKey?.split('.').pop() || 'mp4';
  return `${sanitizedTitle}.${extension}`;
}
