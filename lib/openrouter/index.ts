import axios from 'axios'

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1'

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenRouterChatResponse {
  id: string
  choices: Array<{
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export async function transcribeAudio(
  audioUrl: string,
  apiKey: string
): Promise<{ text: string; segments: any[] }> {
  try {
    const response = await axios.post(
      `${OPENROUTER_API_URL}/audio/transcriptions`,
      {
        file: audioUrl,
        model: 'openai/whisper-large-v3',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'VidEditor',
        },
      }
    )

    return {
      text: response.data.text,
      segments: response.data.segments || [],
    }
  } catch (error: any) {
    console.error('Transcription error:', error.response?.data || error.message)
    throw new Error('Failed to transcribe audio')
  }
}

export async function analyzeTranscript(
  transcript: string,
  userPrompt: string,
  apiKey: string
): Promise<any> {
  const systemPrompt = `You are an expert video editor analyzing transcripts to find the most engaging and viral-worthy short clips.

Your task is to analyze the provided transcript and suggest 3-8 short video clips that would perform well on social media platforms like TikTok, Instagram Reels, and YouTube Shorts.

For each suggested clip, provide:
1. A catchy title (max 60 characters)
2. A brief description explaining why this moment is engaging
3. Start time in seconds
4. End time in seconds (clips should be 15-90 seconds long)
5. The reason this clip would be engaging (hook, value, entertainment, etc.)

Return your response as a JSON array of objects with this structure:
[
  {
    "title": "Catchy Title Here",
    "description": "Why this clip is engaging",
    "startTime": 120.5,
    "endTime": 165.0,
    "reason": "Strong hook with surprising revelation"
  }
]

User's specific requirements: ${userPrompt || 'Find the most engaging and shareable moments.'}`

  try {
    const response = await axios.post<OpenRouterChatResponse>(
      `${OPENROUTER_API_URL}/chat/completions`,
      {
        model: 'openai/gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript },
        ] as OpenRouterMessage[],
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'VidEditor',
          'Content-Type': 'application/json',
        },
      }
    )

    const content = response.data.choices[0].message.content
    const parsed = JSON.parse(content)

    // Handle both array and object responses
    return Array.isArray(parsed) ? parsed : parsed.clips || parsed.suggestions || []
  } catch (error: any) {
    console.error('Analysis error:', error.response?.data || error.message)
    throw new Error('Failed to analyze transcript')
  }
}

export async function chat(
  messages: OpenRouterMessage[],
  apiKey: string,
  model: string = 'openai/gpt-4o'
): Promise<string> {
  try {
    const response = await axios.post<OpenRouterChatResponse>(
      `${OPENROUTER_API_URL}/chat/completions`,
      {
        model,
        messages,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'VidEditor',
          'Content-Type': 'application/json',
        },
      }
    )

    return response.data.choices[0].message.content
  } catch (error: any) {
    console.error('Chat error:', error.response?.data || error.message)
    throw new Error('Failed to get chat response')
  }
}
