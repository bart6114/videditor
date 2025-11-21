import type { Short } from '@server/db/schema';

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
 * Generate a user-friendly filename for a short based on its transcription slice
 * This ensures consistent naming across download-shorts and metadata endpoints
 */
export function getShortFilename(short: Pick<Short, 'id' | 'transcriptionSlice' | 'outputObjectKey'>): string {
  const shortName = short.transcriptionSlice
    ? short.transcriptionSlice.slice(0, 50).trim()
    : `Short ${short.id}`;
  const sanitizedTitle = sanitizeFilename(shortName);
  const extension = short.outputObjectKey?.split('.').pop() || 'mp4';
  return `${sanitizedTitle}.${extension}`;
}
