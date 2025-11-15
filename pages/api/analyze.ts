import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { analyzeTranscript } from '@/lib/openrouter'
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

  const { projectId, customPrompt } = req.body

  if (!projectId) {
    return res.status(400).json({ error: 'Project ID is required' })
  }

  try {
    // Get transcription
    const { data: transcription, error: transcriptionError } = await supabase
      .from('transcriptions')
      .select('*')
      .eq('project_id', projectId)
      .single()

    if (transcriptionError || !transcription) {
      return res.status(404).json({ error: 'Transcription not found' })
    }

    // Update project status
    await (supabase as any)
      .from('projects')
      .update({ status: 'analyzing' })
      .eq('id', projectId)

    // Create processing job
    await (supabase as any).from('processing_jobs').insert({
      project_id: projectId,
      type: 'analysis',
      status: 'processing',
    })

    const apiKey = process.env.OPENROUTER_API_KEY!

    // Analyze transcript with GPT-5
    // const suggestions = await analyzeTranscript(
    //   transcription.text,
    //   customPrompt || '',
    //   apiKey
    // )

    // Mock suggestions for development
    const suggestions = [
      {
        title: "Amazing Opening Hook",
        description: "The first 10 seconds grab attention perfectly",
        startTime: 0,
        endTime: 15,
        reason: "Strong hook that creates curiosity"
      },
      {
        title: "Key Insight Revealed",
        description: "Main value proposition delivered clearly",
        startTime: 30,
        endTime: 60,
        reason: "High-value content that educates viewers"
      },
      {
        title: "Call to Action",
        description: "Compelling ending with clear next steps",
        startTime: 90,
        endTime: 120,
        reason: "Strong CTA that drives engagement"
      }
    ]

    // Save shorts suggestions
    const shortsToInsert = suggestions.map((s) => ({
      project_id: projectId,
      title: s.title,
      description: s.description,
      start_time: s.startTime,
      end_time: s.endTime,
      status: 'pending' as const,
    }))

    await (supabase as any).from('shorts').insert(shortsToInsert)

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
      .eq('type', 'analysis')

    res.status(200).json({ success: true, suggestions })
  } catch (error: any) {
    console.error('Analysis error:', error)

    // Update project with error
    await (supabase as any)
      .from('projects')
      .update({
        status: 'error',
        error_message: error.message || 'Analysis failed',
      })
      .eq('id', projectId)

    res.status(500).json({ error: error.message || 'Analysis failed' })
  }
}
