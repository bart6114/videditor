import { eq, and, desc, count, sql } from 'drizzle-orm';
import type { DB } from '../index';
import { projects, transcriptions, shorts, processingJobs, type NewProject, type Project } from '../schema';

/**
 * List all projects for an organization with shorts count, transcription status, and job progress
 */
export async function listOrganizationProjects(db: DB, organizationId: string, limit: number = 100) {
  // Get projects with aggregated data
  const results = await db
    .select({
      project: projects,
      shortsCount: count(shorts.id),
      hasTranscription: sql<boolean>`EXISTS (SELECT 1 FROM transcriptions t WHERE t.project_id = ${projects.id})`,
    })
    .from(projects)
    .leftJoin(shorts, eq(projects.id, shorts.projectId))
    .where(eq(projects.organizationId, organizationId))
    .groupBy(projects.id)
    .orderBy(desc(projects.createdAt))
    .limit(limit);

  // Get transcription job progress for projects that are still processing
  const projectIds = results.map(r => r.project.id);
  const transcriptionJobs = projectIds.length > 0
    ? await db
        .select({
          projectId: processingJobs.projectId,
          progress: processingJobs.progress,
        })
        .from(processingJobs)
        .where(
          and(
            sql`${processingJobs.projectId} IN (${sql.join(projectIds.map(id => sql`${id}`), sql`, `)})`,
            eq(processingJobs.type, 'transcription'),
            eq(processingJobs.status, 'running')
          )
        )
    : [];

  // Create a map of project ID to transcription progress
  const progressByProject = new Map(
    transcriptionJobs
      .filter(j => j.projectId && j.progress?.phase === 'transcribing')
      .map(j => [j.projectId, { current: j.progress!.current, total: j.progress!.total }])
  );

  // Map to enriched project objects
  return results.map((row) => ({
    ...row.project,
    shortsCount: row.shortsCount,
    hasTranscription: row.hasTranscription,
    transcriptionProgress: progressByProject.get(row.project.id) ?? null,
  }));
}

/**
 * @deprecated Use listOrganizationProjects instead
 */
export const listUserProjects = listOrganizationProjects;

/**
 * Get project by ID (with organization ownership verification)
 */
export async function getProjectById(db: DB, projectId: string, organizationId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
    .limit(1);
  return project ?? null;
}

/**
 * Get project with related transcription and shorts
 */
export async function getProjectWithRelations(db: DB, projectId: string, organizationId: string) {
  // Get project
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
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
  organizationId: string,
  updates: Partial<Project>
) {
  const [updated] = await db
    .update(projects)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
    .returning();
  return updated ?? null;
}

/**
 * Delete project (with organization ownership verification)
 */
export async function deleteProject(db: DB, projectId: string, organizationId: string) {
  const [deleted] = await db
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
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
