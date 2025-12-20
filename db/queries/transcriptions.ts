import { eq } from 'drizzle-orm';
import type { DB } from '../index';
import { transcriptions, type NewTranscription } from '../schema';

/**
 * Get transcription by project ID
 */
export async function getTranscriptionByProjectId(db: DB, projectId: string) {
  const [transcription] = await db
    .select()
    .from(transcriptions)
    .where(eq(transcriptions.projectId, projectId))
    .limit(1);
  return transcription ?? null;
}

/**
 * Create transcription
 */
export async function createTranscription(db: DB, transcription: NewTranscription) {
  const [created] = await db.insert(transcriptions).values(transcription).returning();
  return created;
}

/**
 * Delete transcription
 */
export async function deleteTranscription(db: DB, transcriptionId: string) {
  const [deleted] = await db
    .delete(transcriptions)
    .where(eq(transcriptions.id, transcriptionId))
    .returning({ id: transcriptions.id });
  return deleted ?? null;
}

/**
 * Get transcription segments by ID (for lazy loading)
 * Returns only the segments array to reduce payload size
 */
export async function getTranscriptionSegments(db: DB, transcriptionId: string) {
  const [result] = await db
    .select({
      id: transcriptions.id,
      projectId: transcriptions.projectId,
      segments: transcriptions.segments,
    })
    .from(transcriptions)
    .where(eq(transcriptions.id, transcriptionId))
    .limit(1);
  return result ?? null;
}
