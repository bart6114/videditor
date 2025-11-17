import { withCors } from '../utils/cors';
import { verifyClerkAuth, ensureUserExists } from '../utils/auth';
import { createDirectUploadUrl } from '../../lib/stream';
import { createDb } from '../../db';
import { projects } from '../../db/schema';
import type { Env } from '../env';

/**
 * POST /api/upload/init
 * Initialize a new video upload by creating a Direct Creator Upload URL
 */
export async function handleStreamUploadInit(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    // Verify authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return withCors(
        new Response(JSON.stringify({ error: 'Missing authorization header' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
        request
      );
    }

    const { userId, email } = await verifyClerkAuth(authHeader, env.CLERK_SECRET_KEY);

    // Ensure user exists in database
    const db = createDb(env.DB);
    await ensureUserExists(db, userId, email);

    // Parse request body
    const body = await request.json() as { title?: string };
    const title = body.title || 'Untitled Video';

    // Create Direct Creator Upload URL
    const uploadResponse = await createDirectUploadUrl(
      env.CLOUDFLARE_ACCOUNT_ID,
      env.CLOUDFLARE_API_TOKEN,
      {
        name: title,
        creator: userId,
      }
    );

    // Create project record in database
    const projectId = crypto.randomUUID();
    await db.insert(projects).values({
      id: projectId,
      userId,
      title,
      videoUid: uploadResponse.uid,
      status: 'uploading',
      duration: null,
      fileSize: null,
    });

    // Return upload URL and video UID
    return withCors(
      new Response(
        JSON.stringify({
          uploadUrl: uploadResponse.uploadURL,
          videoUid: uploadResponse.uid,
          projectId,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
      request
    );
  } catch (error) {
    console.error('Stream upload init error:', error);
    return withCors(
      new Response(
        JSON.stringify({
          error: 'Failed to initialize upload',
          details: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
      request
    );
  }
}
