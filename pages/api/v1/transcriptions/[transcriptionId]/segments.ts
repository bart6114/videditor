import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { getTranscriptionSegments } from '@server/db/queries/transcriptions';
import { getProjectById } from '@server/db/queries/projects';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const transcriptionId = req.query.transcriptionId as string;
  const db = getDb();

  // Get the transcription with segments
  const result = await getTranscriptionSegments(db, transcriptionId);

  if (!result) {
    return failure(res, 404, 'Transcription not found');
  }

  // Verify user has access to the project that owns this transcription
  const project = await getProjectById(db, result.projectId, authResult.organizationId);

  if (!project) {
    return failure(res, 404, 'Transcription not found');
  }

  return success(res, {
    id: result.id,
    segments: result.segments,
  });
}
