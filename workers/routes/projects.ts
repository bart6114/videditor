import { Env } from '../env';
import { Project } from '../../types/d1';

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

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function listProjects(env: Env, userId: string): Promise<Response> {
  try {
    const { results } = await env.DB.prepare(
      `SELECT * FROM projects
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 100`
    )
      .bind(userId)
      .all<Project>();

    return new Response(JSON.stringify({ projects: results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('List projects error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to list projects' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

async function getProject(env: Env, userId: string, projectId: string): Promise<Response> {
  try {
    const project = await env.DB.prepare(
      'SELECT * FROM projects WHERE id = ? AND user_id = ?'
    )
      .bind(projectId, userId)
      .first<Project>();

    if (!project) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Also get transcription if exists
    const transcription = await env.DB.prepare(
      'SELECT * FROM transcriptions WHERE project_id = ?'
    )
      .bind(projectId)
      .first();

    // Get shorts if exist
    const { results: shorts } = await env.DB.prepare(
      'SELECT * FROM shorts WHERE project_id = ? ORDER BY created_at DESC'
    )
      .bind(projectId)
      .all();

    return new Response(
      JSON.stringify({
        project,
        transcription,
        shorts,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Get project error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get project' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

async function deleteProject(env: Env, userId: string, projectId: string): Promise<Response> {
  try {
    // Verify ownership
    const project = await env.DB.prepare(
      'SELECT * FROM projects WHERE id = ? AND user_id = ?'
    )
      .bind(projectId, userId)
      .first<Project>();

    if (!project) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Delete from R2
    try {
      await env.VIDEOS_BUCKET.delete(project.video_url);
    } catch (error) {
      console.error('Failed to delete from R2:', error);
    }

    // Delete from Stream if exists
    if (project.stream_id) {
      try {
        const { deleteStreamVideo } = await import('../../lib/stream');
        await deleteStreamVideo(
          env.CLOUDFLARE_ACCOUNT_ID,
          env.CLOUDFLARE_STREAM_API_KEY,
          project.stream_id
        );
      } catch (error) {
        console.error('Failed to delete from Stream:', error);
      }
    }

    // Delete from database (cascade will handle related records)
    await env.DB.prepare('DELETE FROM projects WHERE id = ?')
      .bind(projectId)
      .run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Delete project error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete project' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

async function updateProject(
  env: Env,
  userId: string,
  projectId: string,
  request: Request
): Promise<Response> {
  try {
    const updates = await request.json() as Partial<Project>;

    // Verify ownership
    const existing = await env.DB.prepare(
      'SELECT * FROM projects WHERE id = ? AND user_id = ?'
    )
      .bind(projectId, userId)
      .first();

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build update query dynamically
    const allowedFields = ['title', 'status', 'stream_id', 'thumbnail_url', 'duration', 'error_message'];
    const updateFields: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updateFields.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid fields to update' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Add updated_at
    updateFields.push(`updated_at = datetime('now')`);
    values.push(projectId);

    await env.DB.prepare(
      `UPDATE projects SET ${updateFields.join(', ')} WHERE id = ?`
    )
      .bind(...values)
      .run();

    // Fetch updated project
    const updated = await env.DB.prepare(
      'SELECT * FROM projects WHERE id = ?'
    )
      .bind(projectId)
      .first<Project>();

    return new Response(JSON.stringify({ project: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Update project error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update project' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
