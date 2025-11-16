import { eq } from 'drizzle-orm';
import type { DB } from '../index';
import { transcriptions, type NewTranscription } from '../schema';

/**
 * Get transcription by project ID
 */
export async function getTranscriptionByProjectId(db: DB, projectId: string) {
  return db.select().from(transcriptions).where(eq(transcriptions.projectId, projectId)).get();
}

/**
 * Create transcription
 */
export async function createTranscription(db: DB, transcription: NewTranscription) {
  return db.insert(transcriptions).values(transcription).run();
}

/**
 * Delete transcription
 */
export async function deleteTranscription(db: DB, transcriptionId: string) {
  return db.delete(transcriptions).where(eq(transcriptions.id, transcriptionId)).run();
}
