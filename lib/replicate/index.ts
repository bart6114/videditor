const API_BASE_URL = 'https://api.replicate.com/v1';

export type ReplicateStatus =
  | 'starting'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'queued';

export interface ReplicatePrediction<T = unknown> {
  id: string;
  status: ReplicateStatus;
  output: T;
  logs?: string;
  error?: string;
  metrics?: Record<string, unknown>;
}

export interface ReplicateRunOptions {
  token: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
  webhook?: string;
}

interface CreatePredictionRequest {
  version: string;
  input: Record<string, unknown>;
  webhook?: string;
}

async function createPrediction<T>(
  token: string,
  payload: CreatePredictionRequest
): Promise<ReplicatePrediction<T>> {
  const response = await fetch(`${API_BASE_URL}/predictions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Replicate prediction creation failed: ${response.status} ${errorBody}`);
  }

  return response.json() as Promise<ReplicatePrediction<T>>;
}

async function getPrediction<T>(
  token: string,
  id: string
): Promise<ReplicatePrediction<T>> {
  const response = await fetch(`${API_BASE_URL}/predictions/${id}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to fetch prediction ${id}: ${response.status} ${errorBody}`);
  }

  return response.json() as Promise<ReplicatePrediction<T>>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeInput(input: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    sanitized[key] = value;
  }

  return sanitized;
}

/**
 * Run a Replicate prediction and wait for completion
 */
export async function runReplicatePrediction<T = unknown>(
  version: string,
  input: Record<string, unknown>,
  options: ReplicateRunOptions
): Promise<ReplicatePrediction<T>> {
  const pollInterval = options.pollIntervalMs ?? 5000;
  const timeout = options.timeoutMs ?? 15 * 60 * 1000; // 15 minutes

  const payload: CreatePredictionRequest = {
    version,
    input: sanitizeInput(input),
    ...(options.webhook ? { webhook: options.webhook } : {}),
  };

  let prediction = await createPrediction<T>(options.token, payload);
  const startTime = Date.now();

  while (prediction.status === 'starting' || prediction.status === 'processing' || prediction.status === 'queued') {
    if (Date.now() - startTime > timeout) {
      throw new Error(`Replicate prediction ${prediction.id} timed out after ${timeout / 1000}s`);
    }

    await sleep(pollInterval);
    prediction = await getPrediction<T>(options.token, prediction.id);
  }

  if (prediction.status !== 'succeeded') {
    throw new Error(
      `Replicate prediction ${prediction.id} failed with status ${prediction.status}: ${
        prediction.error || 'unknown error'
      }`
    );
  }

  return prediction;
}
