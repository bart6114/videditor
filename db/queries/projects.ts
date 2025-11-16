import { eq, and, desc, count, sql } from 'drizzle-orm';
import type { DB } from '../index';
import { projects, transcriptions, shorts, type NewProject, type Project } from '../schema';

/**
 * List all projects for a user with shorts count and transcription status
 */
export async function listUserProjects(db: DB, userId: string, limit: number = 100) {
  // Get projects with aggregated data
  const results = await db
    .select({
      project: projects,
      shortsCount: count(shorts.id),
      hasTranscription: sql<number>`CASE WHEN ${transcriptions.id} IS NOT NULL THEN 1 ELSE 0 END`,
    })
    .from(projects)
    .leftJoin(shorts, eq(projects.id, shorts.projectId))
    .leftJoin(transcriptions, eq(projects.id, transcriptions.projectId))
    .where(eq(projects.userId, userId))
    .groupBy(projects.id, transcriptions.id)
    .orderBy(desc(projects.createdAt))
    .limit(limit)
    .all();

  // Map to enriched project objects
  return results.map((row) => ({
    ...row.project,
    shortsCount: row.shortsCount,
    hasTranscription: row.hasTranscription === 1,
  }));
}

/**
 * Get project by ID (with ownership verification)
 */
export async function getProjectById(db: DB, projectId: string, userId: string) {
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .get();
}

/**
 * Get project with related transcription and shorts
 */
export async function getProjectWithRelations(db: DB, projectId: string, userId: string) {
  // Get project
  const project = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .get();

  if (!project) {
    return null;
  }

  // Get transcription
  const transcription = await db
    .select()
    .from(transcriptions)
    .where(eq(transcriptions.projectId, projectId))
    .get();

  // Get shorts
  const projectShorts = await db
    .select()
    .from(shorts)
    .where(eq(shorts.projectId, projectId))
    .orderBy(desc(shorts.createdAt))
    .all();

  return {
    project,
    transcription,
    shorts: projectShorts,
  };
}

/**
 * Create new project
 */
export async function createProject(db: DB, project: NewProject) {
  return db.insert(projects).values(project).run();
}

/**
 * Update project
 */
export async function updateProject(
  db: DB,
  projectId: string,
  userId: string,
  updates: Partial<Project>
) {
  return db
    .update(projects)
    .set({
      ...updates,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .run();
}

/**
 * Delete project (with ownership verification)
 */
export async function deleteProject(db: DB, projectId: string, userId: string) {
  return db
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .run();
}

/**
 * Update project status
 */
export async function updateProjectStatus(
  db: DB,
  projectId: string,
  status: Project['status'],
  errorMessage?: string
) {
  return db
    .update(projects)
    .set({
      status,
      errorMessage: errorMessage ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(projects.id, projectId))
    .run();
}
