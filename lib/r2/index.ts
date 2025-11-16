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
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
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
export function generateVideoKey(
  userId: string,
  projectId: string,
  filename: string,
  environment: string
): string {
  const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const envPrefix = environment === 'production' ? 'videditor-prod' : 'videditor-dev';
  return `${envPrefix}/${userId}/videos/${projectId}/${sanitized}`;
}

/**
 * Generate R2 object key for short video
 */
export function generateShortKey(
  userId: string,
  projectId: string,
  shortId: string,
  environment: string
): string {
  const envPrefix = environment === 'production' ? 'videditor-prod' : 'videditor-dev';
  return `${envPrefix}/${userId}/videos/${projectId}/shorts/${shortId}.mp4`;
}
