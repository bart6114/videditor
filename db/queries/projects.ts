import { eq, and, desc, sql } from 'drizzle-orm';
import type { DB } from '../index';
import { projects, transcriptions, processingJobs, mediaAssets, type NewProject, type Project } from '../schema';

/**
 * List all projects for an organization with asset counts, transcription status, and job progress
 */
export async function listOrganizationProjects(db: DB, organizationId: string, limit: number = 100) {
  // Get projects with aggregated data
  const results = await db
    .select({
      project: projects,
      longFormCount: sql<number>`(SELECT COUNT(*) FROM media_assets ma WHERE ma.project_id = ${projects.id} AND ma.asset_type = 'long_form')`,
      shortFormCount: sql<number>`(SELECT COUNT(*) FROM media_assets ma WHERE ma.project_id = ${projects.id} AND ma.asset_type = 'short_form')`,
      hasTranscription: sql<boolean>`EXISTS (SELECT 1 FROM transcriptions t WHERE t.project_id = ${projects.id})`,
      // Get thumbnail from first long-form asset (replaces deprecated project.thumbnailUrl)
      assetThumbnailUrl: sql<string | null>`(SELECT ma.thumbnail_url FROM media_assets ma WHERE ma.project_id = ${projects.id} AND ma.asset_type = 'long_form' ORDER BY ma.created_at ASC LIMIT 1)`,
    })
    .from(projects)
    .where(eq(projects.organizationId, organizationId))
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
    // Get thumbnailUrl from first long-form asset
    thumbnailUrl: row.assetThumbnailUrl,
    shortsCount: Number(row.shortFormCount) || 0, // Use shortFormCount from media_assets
    longFormCount: Number(row.longFormCount) || 0,
    shortFormCount: Number(row.shortFormCount) || 0,
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
 * Get project with related transcription, shorts, and media assets
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

  // Get media assets
  const assets = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.projectId, projectId))
    .orderBy(desc(mediaAssets.createdAt));

  const longFormAssets = assets.filter(a => a.assetType === 'long_form');
  const shortFormAssets = assets.filter(a => a.assetType === 'short_form');

  // Get transcription (first one, for backward compat)
  const [transcription] = await db
    .select()
    .from(transcriptions)
    .where(eq(transcriptions.projectId, projectId))
    .limit(1);

  // Get all transcriptions
  const allTranscriptions = await db
    .select()
    .from(transcriptions)
    .where(eq(transcriptions.projectId, projectId))
    .orderBy(desc(transcriptions.createdAt));

  return {
    project,
    mediaAssets: assets,
    longFormAssets,
    shortFormAssets,
    transcription,
    transcriptions: allTranscriptions,
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

