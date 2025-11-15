// R2 Storage Utilities for VidEditor

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Create R2 client for server-side operations
 */
export function createR2Client(accountId: string, accessKeyId: string, secretAccessKey: string) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * Generate presigned URL for direct client upload to R2
 */
export async function generatePresignedUploadUrl(
  client: S3Client,
  bucket: string,
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: 'video/*',
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Generate presigned URL for download from R2
 */
export async function generatePresignedDownloadUrl(
  client: S3Client,
  bucket: string,
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Generate R2 object key for video upload
 */
export function generateVideoKey(userId: string, filename: string): string {
  const timestamp = Date.now();
  const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `videos/${userId}/${timestamp}-${sanitized}`;
}

/**
 * Generate R2 object key for short video
 */
export function generateShortKey(userId: string, projectId: string, shortId: string): string {
  return `shorts/${userId}/${projectId}/${shortId}.mp4`;
}
