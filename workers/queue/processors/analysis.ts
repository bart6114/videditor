import { Env, VideoProcessingMessage } from '../../env';
import { Transcription, TranscriptSegment } from '../../../types/d1';
import { parseJsonField } from '../../../types/d1';

interface ShortSuggestion {
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  reasoning: string;
}

/**
 * Process analysis job
 * Uses AI to analyze transcript and suggest short clips
 */
export async function processAnalysis(
  env: Env,
  message: VideoProcessingMessage
): Promise<void> {
  const { projectId, metadata } = message;
  const shortsCount = (metadata?.shortsCount as number) ?? 3;
  const customPrompt = metadata?.customPrompt as string | undefined;

  try {
    // Get transcription
    const transcription = await env.DB.prepare(
      'SELECT * FROM transcriptions WHERE project_id = ?'
    )
      .bind(projectId)
      .first<Transcription>();

    if (!transcription) {
      throw new Error('Transcription not found');
    }

    // Parse segments
    const segments = parseJsonField<TranscriptSegment[]>(transcription.segments as unknown as string) || [];

    // Update status
    await env.DB.prepare(
      `UPDATE projects SET status = 'analyzing', updated_at = datetime('now') WHERE id = ?`
    )
      .bind(projectId)
      .run();

    await env.DB.prepare(
      `UPDATE processing_jobs
       SET status = 'processing', progress = 20, updated_at = datetime('now')
       WHERE project_id = ? AND type = 'analysis' AND status = 'pending'`
    )
      .bind(projectId)
      .run();

    // Create prompt for AI
    const defaultPrompt = `You are a video editor AI. Analyze this video transcript and suggest ${shortsCount} compelling short clips (15-60 seconds each) that would work well on social media.

Transcript:
${transcription.text}

Segment timestamps:
${segments.map((s, i) => `[${i}] ${s.start.toFixed(1)}s - ${s.end.toFixed(1)}s: ${s.text}`).join('\n')}

Return your suggestions as JSON array with this exact format:
[
  {
    "title": "Catchy title for the clip",
    "description": "Brief description of what makes this clip engaging",
    "startTime": 10.5,
    "endTime": 35.2,
    "reasoning": "Why this segment would make a good short"
  }
]

Focus on:
- Self-contained moments with clear context
- High energy or emotional peaks
- Valuable insights or tips
- Surprising or controversial statements
- Clips between 15-60 seconds

Return ONLY the JSON array, no other text.`;

    // Use custom prompt if provided, otherwise use default
    const prompt = customPrompt
      ? `${customPrompt}

Transcript:
${transcription.text}

Segment timestamps:
${segments.map((s, i) => `[${i}] ${s.start.toFixed(1)}s - ${s.end.toFixed(1)}s: ${s.text}`).join('\n')}

Return your suggestions as JSON array with this exact format:
[
  {
    "title": "Catchy title for the clip",
    "description": "Brief description of what makes this clip engaging",
    "startTime": 10.5,
    "endTime": 35.2,
    "reasoning": "Why this segment would make a good short"
  }
]

Return ONLY the JSON array, no other text.`
      : defaultPrompt;

    // Use Workers AI for text generation
    const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }) as { response: string };

    // Parse AI response
    let suggestions: ShortSuggestion[];
    try {
      // Extract JSON from response
      const jsonMatch = result.response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in AI response');
      }
      suggestions = JSON.parse(jsonMatch[0]) as ShortSuggestion[];
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      // Fallback to simple suggestions based on segments
      suggestions = generateFallbackSuggestions(segments);
    }

    // Update progress
    await env.DB.prepare(
      `UPDATE processing_jobs
       SET progress = 60, updated_at = datetime('now')
       WHERE project_id = ? AND type = 'analysis'`
    )
      .bind(projectId)
      .run();

    // Save suggestions as shorts
    for (const suggestion of suggestions.slice(0, shortsCount)) {
      // Limit to requested count
      const shortId = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO shorts (id, project_id, title, description, start_time, end_time, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))`
      )
        .bind(
          shortId,
          projectId,
          suggestion.title,
          suggestion.description,
          suggestion.startTime,
          suggestion.endTime
        )
        .run();
    }

    // Update project and job status
    await env.DB.prepare(
      `UPDATE projects SET status = 'completed', updated_at = datetime('now') WHERE id = ?`
    )
      .bind(projectId)
      .run();

    await env.DB.prepare(
      `UPDATE processing_jobs
       SET status = 'completed', progress = 100, updated_at = datetime('now')
       WHERE project_id = ? AND type = 'analysis'`
    )
      .bind(projectId)
      .run();

    console.log('Analysis completed for project:', projectId, 'with', suggestions.length, 'suggestions');
  } catch (error) {
    console.error('Analysis failed:', error);

    // Update status to error
    await env.DB.prepare(
      `UPDATE projects
       SET status = 'error',
           error_message = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    )
      .bind(error instanceof Error ? error.message : 'Analysis failed', projectId)
      .run();

    await env.DB.prepare(
      `UPDATE processing_jobs
       SET status = 'error',
           error_message = ?,
           updated_at = datetime('now')
       WHERE project_id = ? AND type = 'analysis'`
    )
      .bind(error instanceof Error ? error.message : 'Analysis failed', projectId)
      .run();

    throw error;
  }
}

/**
 * Generate fallback suggestions if AI fails
 */
function generateFallbackSuggestions(segments: TranscriptSegment[]): ShortSuggestion[] {
  const suggestions: ShortSuggestion[] = [];

  // Simple heuristic: take first, middle, and last 30-second segments
  if (segments.length === 0) return suggestions;

  // Beginning
  if (segments.length > 0) {
    suggestions.push({
      title: 'Opening Moment',
      description: 'The beginning of the video',
      startTime: Math.max(0, segments[0].start),
      endTime: Math.min(segments[0].start + 30, segments[segments.length - 1].end),
      reasoning: 'First 30 seconds of content',
    });
  }

  // Middle
  if (segments.length > 2) {
    const midIndex = Math.floor(segments.length / 2);
    const midSegment = segments[midIndex];
    suggestions.push({
      title: 'Key Insight',
      description: 'A moment from the middle of the video',
      startTime: midSegment.start,
      endTime: Math.min(midSegment.start + 30, midSegment.end),
      reasoning: 'Content from the middle section',
    });
  }

  // End
  if (segments.length > 1) {
    const lastSegment = segments[segments.length - 1];
    suggestions.push({
      title: 'Closing Thought',
      description: 'The conclusion of the video',
      startTime: Math.max(0, lastSegment.end - 30),
      endTime: lastSegment.end,
      reasoning: 'Final 30 seconds of content',
    });
  }

  return suggestions;
}
