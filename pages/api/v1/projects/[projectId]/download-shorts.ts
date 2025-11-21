import type { NextApiRequest, NextApiResponse } from 'next';
import archiver from 'archiver';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { getDb } from '@server/db';
import { shorts } from '@server/db/schema';
import { eq, and } from 'drizzle-orm';
import { authenticate } from '@/lib/api/auth';
import { failure } from '@/lib/api/responses';
import { createTigrisClient } from '@/lib/tigris';

// Disable body parsing for streaming
export const config = {
  api: {
    responseLimit: false,
  },
};

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // Remove invalid chars
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .slice(0, 200); // Limit length
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const projectId = req.query.projectId as string;
  const db = getDb();

  // Fetch the project to verify ownership
  const { projects } = await import('@server/db/schema');
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

  if (!project || project.userId !== authResult.userId) {
    return failure(res, 404, 'Project not found');
  }

  // Fetch all shorts for this project
  const projectShorts = await db.select().from(shorts).where(eq(shorts.projectId, projectId));

  if (projectShorts.length === 0) {
    return failure(res, 404, 'No shorts found for this project');
  }

  // Check if all shorts are completed
  const incompleteShorts = projectShorts.filter(
    (short) => short.status !== 'completed' || !short.outputObjectKey
  );

  if (incompleteShorts.length > 0) {
    const completedCount = projectShorts.length - incompleteShorts.length;
    return failure(
      res,
      400,
      `Cannot download: ${incompleteShorts.length} short(s) are still processing. ${completedCount} of ${projectShorts.length} shorts are ready.`
    );
  }

  // Create Tigris client
  const tigrisClient = createTigrisClient();

  // Set response headers for zip download
  const sanitizedProjectTitle = sanitizeFilename(project.title || 'Project');
  const filename = `${sanitizedProjectTitle} - Shorts.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-cache');

  // Create archiver instance
  const archive = archiver('zip', {
    zlib: { level: 0 }, // No compression for faster streaming (videos are already compressed)
  });

  // Handle archiver errors
  archive.on('error', (err) => {
    console.error('Archive error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to create archive' });
    }
  });

  // Pipe archive to response
  archive.pipe(res);

  // Add each short to the archive
  for (const short of projectShorts) {
    if (!short.outputObjectKey) continue;

    try {
      // Get S3 object as stream
      const command = new GetObjectCommand({
        Bucket: process.env.TIGRIS_BUCKET!,
        Key: short.outputObjectKey,
      });

      const s3Response = await tigrisClient.send(command);

      if (!s3Response.Body) {
        console.error(`No body for short ${short.id}`);
        continue;
      }

      // Convert the AWS SDK stream to a Node.js Readable stream
      const readableStream = s3Response.Body instanceof Readable
        ? s3Response.Body
        : Readable.from(s3Response.Body as any);

      // Sanitize the filename using truncated transcription slice
      const shortName = short.transcriptionSlice
        ? short.transcriptionSlice.slice(0, 50).trim()
        : `Short ${short.id}`;
      const sanitizedTitle = sanitizeFilename(shortName);
      const extension = short.outputObjectKey.split('.').pop() || 'mp4';
      const entryName = `${sanitizedTitle}.${extension}`;

      // Append stream to archive
      archive.append(readableStream, { name: entryName });
    } catch (error) {
      console.error(`Failed to fetch short ${short.id}:`, error);
      // Continue with other shorts
    }
  }

  // Finalize the archive
  await archive.finalize();
}
