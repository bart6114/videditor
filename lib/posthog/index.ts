import { PostHog } from 'posthog-node';

// PostHog configuration - same as _app.tsx client-side setup
const POSTHOG_API_KEY = 'phc_412S1ZR39vYp1ARVh4EsD76iwaE1axtqmN0gojYNW2G';
const POSTHOG_HOST = 'https://eu.i.posthog.com';

// Singleton PostHog client
let posthogClient: PostHog | null = null;

/**
 * Get the PostHog client singleton for server-side LLM analytics.
 */
export function getPostHogClient(): PostHog {
  if (!posthogClient) {
    posthogClient = new PostHog(POSTHOG_API_KEY, { host: POSTHOG_HOST });
  }
  return posthogClient;
}

/**
 * Properties for an AI generation event.
 */
export interface AiGenerationProperties {
  /** The AI model used (e.g., 'openai/gpt-5-mini') */
  model: string;
  /** Provider name (e.g., 'openrouter', 'openai') */
  provider: string;
  /** Input prompt or messages */
  input: string | object;
  /** Output response */
  output: string | object;
  /** Input token count (if available) */
  inputTokens?: number;
  /** Output token count (if available) */
  outputTokens?: number;
  /** Latency in milliseconds */
  latencyMs: number;
  /** Whether the request succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Trace ID for grouping related calls */
  traceId?: string;
}

/**
 * Capture an AI generation event for LLM analytics.
 *
 * @param distinctId - User or organization ID for attribution
 * @param properties - AI generation properties
 */
export function captureAiGeneration(
  distinctId: string,
  properties: AiGenerationProperties
): void {
  const client = getPostHogClient();

  client.capture({
    distinctId,
    event: '$ai_generation',
    properties: {
      $ai_model: properties.model,
      $ai_provider: properties.provider,
      $ai_input: properties.input,
      $ai_output: properties.output,
      $ai_input_tokens: properties.inputTokens,
      $ai_output_tokens: properties.outputTokens,
      $ai_latency_ms: properties.latencyMs,
      $ai_is_error: !properties.success,
      $ai_error: properties.error,
      $ai_trace_id: properties.traceId,
    },
  });
}

/**
 * Shutdown PostHog client and flush pending events.
 * Call this before process exit.
 */
export async function shutdownPostHog(): Promise<void> {
  if (posthogClient) {
    await posthogClient.shutdown();
    posthogClient = null;
  }
}
