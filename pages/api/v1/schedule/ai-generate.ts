import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { getAssetsByIds } from '@server/db/queries/assets';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { captureAiGeneration } from '@/lib/posthog';
import type { ShortFormMetadata, SocialContent } from '@shared/index';

interface AiGenerateRequest {
  shortIds: string[];
  prompt: string;
  timezone: string;
}

interface ScheduleItem {
  shortId: string;
  scheduledFor: string;
}

interface AiGenerateResponse {
  schedule: ScheduleItem[];
}

/**
 * POST /api/v1/schedule/ai-generate
 *
 * Use AI to generate a bulk scheduling plan based on natural language input.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  // Parse request body
  let body: AiGenerateRequest;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return failure(res, 400, 'Invalid request body');
  }

  const { shortIds, prompt, timezone } = body;

  // Validate required fields
  if (!shortIds || !Array.isArray(shortIds) || shortIds.length === 0) {
    return failure(res, 400, 'shortIds array is required');
  }
  if (shortIds.length > 50) {
    return failure(res, 400, 'Maximum 50 shorts can be scheduled at once');
  }
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return failure(res, 400, 'Scheduling prompt is required');
  }
  if (!timezone || typeof timezone !== 'string') {
    return failure(res, 400, 'Timezone is required');
  }

  const db = getDb();

  // Fetch assets (verifies ownership via organization)
  const assets = await getAssetsByIds(db, shortIds, authResult.organizationId);

  // Filter to only short_form assets
  const shortFormAssets = assets.filter(a => a.assetType === 'short_form');

  if (shortFormAssets.length === 0) {
    return failure(res, 404, 'No shorts found');
  }

  // Filter to only completed assets with videos
  const validAssets = shortFormAssets.filter((a) => a.status === 'completed' && a.sourceObjectKey);

  if (validAssets.length === 0) {
    return failure(res, 400, 'No completed shorts with videos found');
  }

  // Prepare shorts info for AI
  const shortsInfo = validAssets.map((a) => {
    const metadata = a.metadata as ShortFormMetadata | null;
    const socialContent = a.socialContent as SocialContent | null;
    const duration = metadata?.endTime && metadata?.startTime
      ? Math.round(metadata.endTime - metadata.startTime)
      : (a.durationSeconds ? Math.round(a.durationSeconds) : 60);
    const title = socialContent?.youtube?.title
      || metadata?.transcriptionSlice?.slice(0, 50)
      || a.title
      || `Short ${a.id.slice(0, 8)}`;

    return {
      id: a.id,
      title,
      duration,
    };
  });

  // Call OpenRouter
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return failure(res, 500, 'OpenRouter API key not configured');
  }

  const model = process.env.OPENROUTER_SOCIAL_MODEL || 'openai/gpt-5-mini';

  // Build time context for the AI (local time only, no UTC)
  const now = new Date();

  // Format current time in user's timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const currentTimeFormatted = formatter.format(now);

  // Get day of week and date parts for relative date understanding
  const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long' });
  const currentDayOfWeek = dayFormatter.format(now);

  // Calculate tomorrow's date
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowFormatted = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(tomorrow);

  const systemPrompt = `You are a social media scheduling assistant. The user wants to schedule ${shortsInfo.length} video shorts for publishing.

## Current Time Context
- Current time: ${currentTimeFormatted}
- Today is: ${currentDayOfWeek}
- Tomorrow is: ${tomorrowFormatted}
- User's timezone: ${timezone}

## Task
Generate a schedule that assigns each short to a specific date and time based on the user's preferences.

## Rules
- All scheduled times must be in the future (after the current time shown above)
- Return times in ISO 8601 format WITHOUT timezone suffix (e.g., "2025-12-04T09:00:00")
- All times are in the user's local timezone - do NOT convert to UTC
- When user says "tomorrow", that means ${tomorrowFormatted}
- When user says "next week", start from 7 days after today
- If the user says "mornings", schedule between 7am-11am in their timezone
- If the user says "afternoons", schedule between 12pm-5pm in their timezone
- If the user says "evenings", schedule between 6pm-10pm in their timezone
- Space out posts reasonably (at least 1 hour apart on the same day by default)
- Keep the original order of shorts unless the user specifies otherwise
- If no specific time preference given, default to 9am, 12pm, 3pm, 6pm slots`;

  const userPrompt = `Shorts to schedule:
${shortsInfo.map((s, i) => `${i + 1}. ID: ${s.id} | Title: "${s.title}" | Duration: ${s.duration}s`).join('\n')}

User's scheduling preferences: "${prompt.trim()}"

Generate a schedule for these shorts.`;

  const responseFormat = {
    type: 'json_schema',
    json_schema: {
      name: 'bulk_schedule',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          schedule: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                shortId: { type: 'string' },
                scheduledFor: { type: 'string' },
              },
              required: ['shortId', 'scheduledFor'],
              additionalProperties: false,
            },
          },
        },
        required: ['schedule'],
        additionalProperties: false,
      },
    },
  };

  const startTime = Date.now();
  const traceId = `bulk_schedule:org=${authResult.organizationId}:count=${shortsInfo.length}`;
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://videditor.app',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 4000,
        response_format: responseFormat,
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);

      // Capture failed AI generation
      captureAiGeneration(authResult.userId, {
        model,
        provider: 'openrouter',
        input: messages,
        output: errorText,
        latencyMs,
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        traceId,
        spanName: 'bulk_schedule',
      });

      return failure(res, 502, 'AI service error');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    // Capture successful AI generation
    captureAiGeneration(authResult.userId, {
      model,
      provider: 'openrouter',
      input: messages,
      output: content || '',
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
      latencyMs,
      success: true,
      traceId,
      spanName: 'bulk_schedule',
    });

    if (!content) {
      return failure(res, 502, 'AI returned empty response');
    }

    // Parse the structured response
    let parsed: { schedule: ScheduleItem[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error('Failed to parse AI response:', content);
      return failure(res, 502, 'AI returned invalid JSON');
    }

    // Validate all shortIds are from our valid assets
    const validAssetIds = new Set(validAssets.map((a) => a.id));
    const schedule = parsed.schedule.filter((item) => validAssetIds.has(item.shortId));

    // Validate all dates are parseable and in the future
    const nowTime = new Date();
    const validSchedule = schedule.filter((item) => {
      const date = new Date(item.scheduledFor);
      return !isNaN(date.getTime()) && date > nowTime;
    });

    if (validSchedule.length === 0) {
      return failure(res, 400, 'AI generated no valid schedule items. Please try a different prompt.');
    }

    return success<AiGenerateResponse>(res, {
      schedule: validSchedule,
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error('OpenRouter request failed:', error);

    // Capture failed AI generation
    captureAiGeneration(authResult.userId, {
      model,
      provider: 'openrouter',
      input: messages,
      output: '',
      latencyMs,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      traceId,
      spanName: 'bulk_schedule',
    });

    return failure(res, 502, 'Failed to connect to AI service');
  }
}
