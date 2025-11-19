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
      hasTranscription: sql<boolean>`CASE WHEN ${transcriptions.id} IS NOT NULL THEN true ELSE false END`,
    })
    .from(projects)
    .leftJoin(shorts, eq(projects.id, shorts.projectId))
    .leftJoin(transcriptions, eq(projects.id, transcriptions.projectId))
    .where(eq(projects.userId, userId))
    .groupBy(projects.id, transcriptions.id)
    .orderBy(desc(projects.createdAt))
    .limit(limit);

  // Map to enriched project objects
  return results.map((row) => ({
    ...row.project,
    shortsCount: row.shortsCount,
    hasTranscription: row.hasTranscription,
  }));
}

/**
 * Get project by ID (with ownership verification)
 */
export async function getProjectById(db: DB, projectId: string, userId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  return project ?? null;
}

/**
 * Get project with related transcription and shorts
 */
export async function getProjectWithRelations(db: DB, projectId: string, userId: string) {
  // Get project
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!project) {
    return null;
  }

  // Get transcription
  const [transcription] = await db
    .select()
    .from(transcriptions)
    .where(eq(transcriptions.projectId, projectId))
    .limit(1);

  // Get shorts
  const projectShorts = await db
    .select()
    .from(shorts)
    .where(eq(shorts.projectId, projectId))
    .orderBy(desc(shorts.createdAt));

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
  const [created] = await db.insert(projects).values(project).returning();
  return created;
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
  const [updated] = await db
    .update(projects)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .returning();
  return updated ?? null;
}

/**
 * Delete project (with ownership verification)
 */
export async function deleteProject(db: DB, projectId: string, userId: string) {
  const [deleted] = await db
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .returning({ id: projects.id });
  return deleted ?? null;
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
  const [updated] = await db
    .update(projects)
    .set({
      status,
      errorMessage: errorMessage ?? null,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId))
    .returning();
  return updated ?? null;
}
