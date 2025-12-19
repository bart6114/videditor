import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@server/db';
import { mediaAssets, processingJobs } from '@server/db/schema';
import { getProjectById } from '@server/db/queries/projects';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { SOCIAL_PLATFORMS, type TimeRange } from '@shared/index';

const timeRangeSchema = z.object({
  start: z.number().nonnegative(),
  end: z.number().positive(),
}).refine((data) => data.end > data.start, {
  message: 'End time must be greater than start time',
});

const manualShortSchema = z.object({
  sourceAssetId: z.string().uuid('Source asset ID is required'),
  ranges: z.array(timeRangeSchema).min(1, 'At least one time range is required'),
  transcriptionSlice: z.string().min(1, 'Transcription slice is required'),
  socialPlatforms: z.array(z.enum(SOCIAL_PLATFORMS)).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const projectId = req.query.projectId as string;
  const db = getDb();

  // Verify project ownership
  const project = await getProjectById(db, projectId, authResult.organizationId);
  if (!project) {
    return failure(res, 404, 'Project not found');
  }

  // Parse and validate request body
  const parsed = manualShortSchema.safeParse(req.body);
  if (!parsed.success) {
    return failure(res, 400, 'Invalid request body', parsed.error.flatten());
  }

  const { sourceAssetId, ranges, transcriptionSlice, socialPlatforms } = parsed.data;

  // Fetch source long-form asset
  const [sourceAsset] = await db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.id, sourceAssetId),
        eq(mediaAssets.projectId, projectId),
        eq(mediaAssets.assetType, 'long_form')
      )
    )
    .limit(1);

  if (!sourceAsset) {
    return failure(res, 404, 'Source asset not found');
  }

  // Sort ranges by start time
  const sortedRanges = [...ranges].sort((a, b) => a.start - b.start);

  // Calculate overall start/end times
  const overallStartTime = sortedRanges[0].start;
  const overallEndTime = sortedRanges[sortedRanges.length - 1].end;

  // Generate IDs
  const shortAssetId = crypto.randomUUID();
  const jobId = crypto.randomUUID();

  // Determine if social content generation is requested
  const generateSocialContent = socialPlatforms && socialPlatforms.length > 0;

  // Calculate total duration from all ranges
  const totalDuration = sortedRanges.reduce(
    (sum, r) => sum + (r.end - r.start),
    0
  );

  // Create short_form media asset
  const [newShortAsset] = await db.insert(mediaAssets).values({
    id: shortAssetId,
    projectId,
    organizationId: authResult.organizationId,
    createdById: authResult.userId,
    assetType: 'short_form',
    title: transcriptionSlice.substring(0, 50),
    sourceObjectKey: '', // Will be populated by processing job
    sourceBucket: sourceAsset.sourceBucket,
    status: 'processing',
    sourceAssetId: sourceAssetId,
    metadata: {
      startTime: overallStartTime,
      endTime: overallEndTime,
      transcriptionSlice,
      ranges: sortedRanges,
      isManual: true,
      rangeCount: sortedRanges.length,
      totalDuration,
      tasks: {
        clip_extraction: 'pending',
        thumbnail_extraction: 'pending',
        social_content: generateSocialContent ? 'pending' : 'skipped',
      },
    },
  }).returning();

  // Create processing job
  const [newJob] = await db.insert(processingJobs).values({
    id: jobId,
    projectId,
    mediaAssetId: shortAssetId,
    type: 'short_processing',
    status: 'queued',
    payload: {
      mediaAssetId: shortAssetId,
      projectId,
      sourceObjectKey: sourceAsset.sourceObjectKey,
      sourceBucket: sourceAsset.sourceBucket,
      organizationId: authResult.organizationId,
      ranges: sortedRanges as TimeRange[],
      transcriptionSlice,
      socialPlatforms: generateSocialContent ? socialPlatforms : undefined,
    },
  }).returning();

  return success(res, {
    asset: newShortAsset,
    job: newJob,
  });
}
