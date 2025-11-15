import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { transcribeAudio } from '@/lib/openrouter'
import type { Database } from '@/types/database'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { projectId } = req.body

  if (!projectId) {
    return res.status(400).json({ error: 'Project ID is required' })
  }

  try {
    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    // Update status to transcribing
    await (supabase as any)
      .from('projects')
      .update({ status: 'transcribing' })
      .eq('id', projectId)

    // Create processing job
    await (supabase as any).from('processing_jobs').insert({
      project_id: projectId,
      type: 'transcription',
      status: 'processing',
    })

    // Note: In a real implementation, you would:
    // 1. Extract audio from video
    // 2. Upload audio to a temporary location
    // 3. Pass the audio URL to Whisper

    // For now, we'll simulate transcription with a placeholder
    const apiKey = process.env.OPENROUTER_API_KEY!

    // Simulate transcription (in production, use actual video audio)
    // const { text, segments } = await transcribeAudio(project.video_url, apiKey)

    // Placeholder for development
    const mockTranscript = {
      text: "This is a sample transcript of your video. In production, this would be the actual transcription from Whisper AI. You can analyze this text to find interesting moments for shorts.",
      segments: [
        { start: 0, end: 5, text: "This is a sample transcript of your video." },
        { start: 5, end: 12, text: "In production, this would be the actual transcription from Whisper AI." },
        { start: 12, end: 18, text: "You can analyze this text to find interesting moments for shorts." }
      ]
    }

    // Save transcription
    await (supabase as any).from('transcriptions').insert({
      project_id: projectId,
      text: mockTranscript.text,
      segments: mockTranscript.segments as any,
    })

    // Update project status
    await (supabase as any)
      .from('projects')
      .update({ status: 'completed' })
      .eq('id', projectId)

    // Complete processing job
    await (supabase as any)
      .from('processing_jobs')
      .update({ status: 'completed', progress: 100 })
      .eq('project_id', projectId)
      .eq('type', 'transcription')

    res.status(200).json({ success: true })
  } catch (error: any) {
    console.error('Transcription error:', error)

    // Update project with error
    await (supabase as any)
      .from('projects')
      .update({
        status: 'error',
        error_message: error.message || 'Transcription failed',
      })
      .eq('id', projectId)

    res.status(500).json({ error: error.message || 'Transcription failed' })
  }
}
