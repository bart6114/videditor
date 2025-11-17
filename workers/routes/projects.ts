import { Env } from '../env';
import { Project } from '../../types/d1';
import { corsResponse, corsError } from '../utils/cors';
import { createDb } from '../../db';
import {
  listUserProjects,
  getProjectWithRelations,
  getProjectById,
  deleteProject as deleteProjectQuery,
  updateProject as updateProjectQuery,
} from '../../db/queries/projects';

/**
 * Handle projects-related requests
 */
export async function handleProjectsRequest(
  request: Request,
  env: Env,
  userId: string,
  pathname: string
): Promise<Response> {
  // GET /api/projects - List all projects for user
  if (pathname === '/api/projects' && request.method === 'GET') {
    return listProjects(env, userId);
  }

  // GET /api/projects/:id - Get single project
  const projectIdMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (projectIdMatch && request.method === 'GET') {
    return getProject(env, userId, projectIdMatch[1]);
  }

  // DELETE /api/projects/:id - Delete project
  if (projectIdMatch && request.method === 'DELETE') {
    return deleteProject(env, userId, projectIdMatch[1]);
  }

  // PATCH /api/projects/:id - Update project
  if (projectIdMatch && request.method === 'PATCH') {
    return updateProject(env, userId, projectIdMatch[1], request);
  }

  return corsError('Not found', { status: 404, env });
}

async function listProjects(env: Env, userId: string): Promise<Response> {
  try {
    const db = createDb(env.DB);
    const projects = await listUserProjects(db, userId);
    return corsResponse({ projects }, { env });
  } catch (error) {
    console.error('List projects error:', error);
    return corsError('Failed to list projects', { status: 500, env });
  }
}

async function getProject(env: Env, userId: string, projectId: string): Promise<Response> {
  try {
    const db = createDb(env.DB);
    const result = await getProjectWithRelations(db, projectId, userId);

    if (!result) {
      return corsError('Project not found', { status: 404, env });
    }

    return corsResponse(result, { env });
  } catch (error) {
    console.error('Get project error:', error);
    return corsError('Failed to get project', { status: 500, env });
  }
}

async function deleteProject(env: Env, userId: string, projectId: string): Promise<Response> {
  try {
    const db = createDb(env.DB);

    // Verify ownership
    const project = await getProjectById(db, projectId, userId);
    if (!project) {
      return corsError('Project not found', { status: 404, env });
    }

    // Delete from Stream
    if (project.videoUid) {
      try {
        const { deleteStreamVideo } = await import('../../lib/stream');
        await deleteStreamVideo(
          env.CLOUDFLARE_ACCOUNT_ID,
          env.CLOUDFLARE_API_TOKEN,
          project.videoUid
        );
      } catch (error) {
        console.error('Failed to delete from Stream:', error);
      }
    }

    // Delete from database (cascade will handle related records)
    await deleteProjectQuery(db, projectId, userId);

    return corsResponse({ success: true }, { env });
  } catch (error) {
    console.error('Delete project error:', error);
    return corsError('Failed to delete project', { status: 500, env });
  }
}

async function updateProject(
  env: Env,
  userId: string,
  projectId: string,
  request: Request
): Promise<Response> {
  try {
    const db = createDb(env.DB);
    const updates = await request.json() as Partial<Project>;

    // Verify ownership
    const existing = await getProjectById(db, projectId, userId);
    if (!existing) {
      return corsError('Project not found', { status: 404, env });
    }

    // Filter allowed fields
    const allowedFields: (keyof Project)[] = [
      'title',
      'status',
      'streamId',
      'thumbnailUrl',
      'duration',
      'errorMessage',
    ];

    const filteredUpdates: Partial<Project> = {};
    for (const field of allowedFields) {
      if (field in updates) {
        filteredUpdates[field] = updates[field];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return corsError('No valid fields to update', { status: 400, env });
    }

    // Update project
    await updateProjectQuery(db, projectId, userId, filteredUpdates);

    // Fetch updated project
    const updated = await getProjectById(db, projectId, userId);
    return corsResponse({ project: updated }, { env });
  } catch (error) {
    console.error('Update project error:', error);
    return corsError('Failed to update project', { status: 500, env });
  }
}
