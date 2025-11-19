import { Hash } from '@smithy/hash-node';
import { HttpRequest } from '@smithy/protocol-http';
import { S3RequestPresigner } from '@aws-sdk/s3-request-presigner';
import { formatUrl } from '@aws-sdk/util-format-url';

export interface PresignedUrlOptions {
  endpoint: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  objectKey: string;
  method: 'GET' | 'PUT';
  expiresIn?: number;
  contentType?: string;
}

const STORAGE_ROOT = 'videditor';

function encodeKey(key: string): string {
  return key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function createPresigner(accessKeyId: string, secretAccessKey: string): S3RequestPresigner {
  return new S3RequestPresigner({
    region: 'auto',
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    sha256: Hash.bind(null, 'sha256'),
  });
}

/**
 * Generate a presigned URL for accessing an R2 object
 */
export async function createPresignedUrl(options: PresignedUrlOptions): Promise<string> {
  const { endpoint, bucketName, objectKey, method, expiresIn = 3600, contentType } = options;
  const presigner = createPresigner(options.accessKeyId, options.secretAccessKey);
  const url = new URL(endpoint);
  const encodedKey = encodeKey(objectKey);

  const request = new HttpRequest({
    protocol: url.protocol,
    hostname: url.hostname,
    path: `/${bucketName}/${encodedKey}`,
    method,
    headers: {
      host: url.hostname,
      ...(contentType ? { 'content-type': contentType } : {}),
    },
  });

  const presigned = await presigner.presign(request, { expiresIn });
  return formatUrl(presigned);
}

/**
 * Sanitize filename for storage
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

/**
 * Build a deterministic object key for a user's project
 */
export function buildVideoObjectKey(
  userId: string,
  projectId: string,
  filename: string,
): string {
  const sanitized = sanitizeFilename(filename || 'video');
  const lastDot = sanitized.lastIndexOf('.');
  const baseName = lastDot === -1 ? sanitized : sanitized.slice(0, lastDot);
  const extension = lastDot === -1 ? '' : sanitized.slice(lastDot);
  const safeBase = baseName || 'video';
  const folder = `${STORAGE_ROOT}/${userId}/video/${safeBase}-${projectId}`;
  return `${folder}/${safeBase}${extension}`;
}

/**
 * Build an object key for generated shorts
 */
export function buildShortObjectKey(
  videoObjectKey: string,
  shortId: string,
  extension: string = 'mp4'
): string {
  const normalizedKey = videoObjectKey || '';
  const lastSlash = normalizedKey.lastIndexOf('/');
  const baseFolder =
    lastSlash === -1 ? `${STORAGE_ROOT}/unknown/video` : normalizedKey.slice(0, lastSlash);
  const ext = extension.replace(/^\./, '');
  return `${baseFolder}/shorts/${shortId}.${ext}`;
}

/**
 * Create presigned URL from env (convenience wrapper)
 */
export async function createPresignedUrlFromEnv(
  env: { R2_ENDPOINT: string; R2_BUCKET_NAME: string; R2_ACCESS_KEY_ID: string; R2_SECRET_ACCESS_KEY: string },
  objectKey: string,
  method: 'GET' | 'PUT' = 'GET',
  contentType?: string
): Promise<string> {
  return createPresignedUrl({
    endpoint: env.R2_ENDPOINT,
    bucketName: env.R2_BUCKET_NAME,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    objectKey,
    method,
    expiresIn: 3600,
    contentType,
  });
}
