import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { getShortsByIds } from '@server/db/queries/shorts';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';

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

  // Fetch shorts (verifies ownership via organization)
  const shorts = await getShortsByIds(db, shortIds, authResult.organizationId);

  if (shorts.length === 0) {
    return failure(res, 404, 'No shorts found');
  }

  // Filter to only completed shorts with videos
  const validShorts = shorts.filter((s) => s.status === 'completed' && s.outputObjectKey);

  if (validShorts.length === 0) {
    return failure(res, 400, 'No completed shorts with videos found');
  }

  // Prepare shorts info for AI
  const shortsInfo = validShorts.map((s) => {
    const duration = s.endTime && s.startTime ? Math.round(s.endTime - s.startTime) : 60;
    const socialContent = s.socialContent as { youtube?: { title?: string } } | null;
    const title = socialContent?.youtube?.title || s.transcriptionSlice?.slice(0, 50) || `Short ${s.id.slice(0, 8)}`;

    return {
      id: s.id,
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

  // Build rich time context for the AI
  const now = new Date();
  const currentTimeISO = now.toISOString();

  // Format current time in user's timezone for better context
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
- Current time (ISO): ${currentTimeISO}
- Current time (local): ${currentTimeFormatted}
- Today is: ${currentDayOfWeek}
- Tomorrow is: ${tomorrowFormatted}
- User's timezone: ${timezone}

## Task
Generate a schedule that assigns each short to a specific date and time based on the user's preferences.

## Rules
- All scheduled times must be in the future (after the current time shown above)
- Return times in ISO 8601 format (e.g., "2025-12-04T09:00:00Z")
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
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: responseFormat,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);
      return failure(res, 502, 'AI service error');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

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

    // Validate all shortIds are from our valid shorts
    const validShortIds = new Set(validShorts.map((s) => s.id));
    const schedule = parsed.schedule.filter((item) => validShortIds.has(item.shortId));

    // Validate all dates are parseable and in the future
    const now = new Date();
    const validSchedule = schedule.filter((item) => {
      const date = new Date(item.scheduledFor);
      return !isNaN(date.getTime()) && date > now;
    });

    if (validSchedule.length === 0) {
      return failure(res, 400, 'AI generated no valid schedule items. Please try a different prompt.');
    }

    return success<AiGenerateResponse>(res, {
      schedule: validSchedule,
    });
  } catch (error) {
    console.error('OpenRouter request failed:', error);
    return failure(res, 502, 'Failed to connect to AI service');
  }
}
