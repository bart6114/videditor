import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'node:crypto';

type CreateUploadOptions = {
  filename: string;
  contentType: string;
  userId: string;
  projectId: string;
};

export type PresignedUpload = {
  objectKey: string;
  uploadUrl: string;
  bucket: string;
};

export function createTigrisClient() {
  return new S3Client({
    region: process.env.TIGRIS_REGION!,
    endpoint: process.env.TIGRIS_ENDPOINT!,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.TIGRIS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.TIGRIS_SECRET_ACCESS_KEY!,
    },
  });
}

export async function createPresignedUpload(
  client: S3Client,
  options: CreateUploadOptions
): Promise<PresignedUpload> {
  const objectKey = buildSourceObjectKey(options.userId, options.projectId);
  const command = new PutObjectCommand({
    Bucket: process.env.TIGRIS_BUCKET!,
    Key: objectKey,
    ContentType: options.contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 * 15 });

  return { objectKey, uploadUrl, bucket: process.env.TIGRIS_BUCKET! };
}

export async function createPresignedDownload(
  client: S3Client,
  objectKey: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.TIGRIS_BUCKET!,
    Key: objectKey,
  });

  return await getSignedUrl(client, command, { expiresIn });
}

export function buildSourceObjectKey(userId: string, projectId: string) {
  const timestamp = Date.now();
  return `${userId}/projects/${projectId}/${timestamp}-video.mp4`;
}

export function buildThumbnailObjectKey(userId: string, projectId: string) {
  const timestamp = Date.now();
  return `${userId}/projects/${projectId}/${timestamp}-thumbnail.jpg`;
}
