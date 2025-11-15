import { Env } from '../env';

export interface JobState {
  projectId: string;
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export class JobTracker implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (request.method) {
        case 'GET':
          if (path === '/status') {
            return this.getStatus();
          }
          break;

        case 'POST':
          if (path === '/update') {
            return this.updateStatus(request);
          }
          if (path === '/complete') {
            return this.completeJob(request);
          }
          if (path === '/error') {
            return this.errorJob(request);
          }
          break;

        case 'DELETE':
          if (path === '/clear') {
            return this.clearStatus();
          }
          break;
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  private async getStatus(): Promise<Response> {
    const jobState = await this.state.storage.get<JobState>('job');
    return new Response(JSON.stringify(jobState || null), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async updateStatus(request: Request): Promise<Response> {
    const update = await request.json() as Partial<JobState>;
    const currentState = await this.state.storage.get<JobState>('job') || {
      projectId: update.projectId!,
      userId: update.userId!,
      status: 'pending',
      progress: 0
    };

    const newState: JobState = {
      ...currentState,
      ...update,
      startedAt: currentState.startedAt || new Date().toISOString()
    };

    await this.state.storage.put('job', newState);

    // Also update the D1 database
    if (update.status || update.progress !== undefined) {
      await this.updateDatabase(newState);
    }

    return new Response(JSON.stringify(newState), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async completeJob(request: Request): Promise<Response> {
    const { result } = await request.json() as { result?: unknown };
    const currentState = await this.state.storage.get<JobState>('job');

    if (!currentState) {
      return new Response(JSON.stringify({ error: 'No job found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const newState: JobState = {
      ...currentState,
      status: 'completed',
      progress: 100,
      completedAt: new Date().toISOString()
    };

    await this.state.storage.put('job', newState);
    await this.updateDatabase(newState);

    return new Response(JSON.stringify(newState), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async errorJob(request: Request): Promise<Response> {
    const { error } = await request.json() as { error: string };
    const currentState = await this.state.storage.get<JobState>('job');

    if (!currentState) {
      return new Response(JSON.stringify({ error: 'No job found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const newState: JobState = {
      ...currentState,
      status: 'error',
      error,
      completedAt: new Date().toISOString()
    };

    await this.state.storage.put('job', newState);
    await this.updateDatabase(newState);

    return new Response(JSON.stringify(newState), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async clearStatus(): Promise<Response> {
    await this.state.storage.deleteAll();
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async updateDatabase(jobState: JobState): Promise<void> {
    // Update the project status in D1
    try {
      await this.env.DB.prepare(
        'UPDATE projects SET status = ?, updated_at = datetime(\'now\') WHERE id = ?'
      )
        .bind(jobState.status, jobState.projectId)
        .run();

      // Update processing_jobs if exists
      await this.env.DB.prepare(
        `UPDATE processing_jobs
         SET status = ?, progress = ?, error_message = ?, updated_at = datetime('now')
         WHERE project_id = ? AND status != 'completed'`
      )
        .bind(jobState.status, jobState.progress, jobState.error || null, jobState.projectId)
        .run();
    } catch (error) {
      console.error('Failed to update database:', error);
    }
  }
}
