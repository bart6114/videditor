import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'node:crypto';

type CreateUploadOptions = {
  filename: string;
  contentType: string;
  userId: string;
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
  const objectKey = buildSourceObjectKey(options.userId, options.filename);
  const command = new PutObjectCommand({
    Bucket: process.env.TIGRIS_BUCKET!,
    Key: objectKey,
    ContentType: options.contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 * 15 });

  return { objectKey, uploadUrl, bucket: process.env.TIGRIS_BUCKET! };
}

export function buildSourceObjectKey(userId: string, filename: string) {
  const safeFilename = filename
    .replace(/[^a-zA-Z0-9.\-_]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();

  return `projects/${userId}/${Date.now()}-${crypto.randomUUID()}-${safeFilename}`;
}
