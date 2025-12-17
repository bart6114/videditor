/**
 * Client-side helpers for parsing job data from API responses.
 */

export type JobProgress = {
  phase: 'transcribing' | 'analyzing' | 'generating'
  current: number
  total: number
}

export type ApiJob = {
  id: string
  type: string
  status: string
  errorMessage?: string | null
  createdAt?: string
  progress?: JobProgress
}

export type TranscriptionJob = {
  id: string
  status: string
  errorMessage?: string | null
  progress?: JobProgress
}

export type AnalysisJob = {
  id: string
  status: string
  progress?: {
    phase: 'analyzing' | 'generating'
    current: number
    total: number
  }
}

/**
 * Extract the most recent transcription job from a list of jobs.
 * Sorts by createdAt descending to find the latest.
 */
export function extractTranscriptionJob(jobs: ApiJob[]): TranscriptionJob | null {
  const transcriptionJobs = jobs.filter((j) => j.type === 'transcription')
  if (transcriptionJobs.length === 0) return null

  const sorted = [...transcriptionJobs].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  )
  const latest = sorted[0]

  return {
    id: latest.id,
    status: latest.status,
    errorMessage: latest.errorMessage,
    progress: latest.progress,
  }
}

/**
 * Extract the currently active analysis job (queued or running).
 * Returns null if no analysis job is in progress.
 */
export function extractActiveAnalysisJob(jobs: ApiJob[]): AnalysisJob | null {
  const job = jobs.find(
    (j) => j.type === 'analysis' && ['queued', 'running'].includes(j.status)
  )
  if (!job) return null

  return {
    id: job.id,
    status: job.status,
    // Only include progress if it's not in transcribing phase (that's handled separately)
    progress:
      job.progress?.phase !== 'transcribing'
        ? (job.progress as AnalysisJob['progress'])
        : undefined,
  }
}
