import { useState, useEffect, useCallback, useRef } from 'react'
import { useApi } from '@/lib/api/client'
import { extractTranscriptionJob, extractActiveAnalysisJob, extractActiveProcessingJob, type ApiJob, type TranscriptionJob, type AnalysisJob, type ProcessingJob } from '@/lib/jobs/parsing'
import type { Project, Short, Transcription } from '@server/db/schema'
import type { MediaAsset } from '@/types/projects'

type ScheduledPost = {
  id: string
  status: string
  scheduledFor: Date
  title: string
  platformPostId: string | null
  platformUrl: string | null
  errorMessage: string | null
  platform: string
  channelTitle: string | null
}

type ProjectDataState = {
  project: (Project & { videoUrl?: string; thumbnailUrl?: string }) | null
  shorts: Short[]
  mediaAssets: MediaAsset[]
  longFormAssets: MediaAsset[]
  shortFormAssets: MediaAsset[]
  transcription: Transcription | null
  transcriptions: Transcription[]
  scheduledPostsByShort: Record<string, ScheduledPost[]>
  loading: boolean
  error: string | null
}

type JobState = {
  activeJob: AnalysisJob | null
  transcriptionJob: TranscriptionJob | null
  processingJob: ProcessingJob | null
  lastAnalysisJobId: string | null
  isGeneratingShorts: boolean
}

type UseProjectDataReturn = ProjectDataState & JobState & {
  setIsGeneratingShorts: (value: boolean) => void
  setLastAnalysisJobId: (value: string | null) => void
  setActiveJob: (value: AnalysisJob | null) => void
  setTranscriptionJob: (value: TranscriptionJob | null) => void
  setProcessingJob: (value: ProcessingJob | null) => void
  refresh: () => Promise<void>
  updateShorts: (shorts: Short[]) => void
}

const POLL_INTERVAL = 3000

// Preserve video/thumbnail URLs for unchanged assets to prevent video player restart during polling
function preserveAssetUrls<T extends { id: string; sourceObjectKey?: string | null; videoUrl?: string | null; thumbnailUrl?: string | null }>(
  newAssets: T[],
  prevAssets: T[]
): T[] {
  return newAssets.map(newAsset => {
    const prevAsset = prevAssets.find(a => a.id === newAsset.id)
    if (prevAsset && prevAsset.sourceObjectKey === newAsset.sourceObjectKey) {
      return {
        ...newAsset,
        videoUrl: prevAsset.videoUrl ?? newAsset.videoUrl,
        thumbnailUrl: prevAsset.thumbnailUrl ?? newAsset.thumbnailUrl,
      }
    }
    return newAsset
  })
}

export function useProjectData(projectId: string | undefined): UseProjectDataReturn {
  const { call } = useApi()
  const isMountedRef = useRef(true)

  // Data state
  const [state, setState] = useState<ProjectDataState>({
    project: null,
    shorts: [],
    mediaAssets: [],
    longFormAssets: [],
    shortFormAssets: [],
    transcription: null,
    transcriptions: [],
    scheduledPostsByShort: {},
    loading: true,
    error: null,
  })

  // Job state
  const [jobState, setJobState] = useState<JobState>({
    activeJob: null,
    transcriptionJob: null,
    processingJob: null,
    lastAnalysisJobId: null,
    isGeneratingShorts: false,
  })

  const setIsGeneratingShorts = useCallback((value: boolean) => {
    setJobState((prev) => ({ ...prev, isGeneratingShorts: value }))
  }, [])

  const setLastAnalysisJobId = useCallback((value: string | null) => {
    setJobState((prev) => ({ ...prev, lastAnalysisJobId: value }))
  }, [])

  const setActiveJob = useCallback((value: AnalysisJob | null) => {
    setJobState((prev) => ({ ...prev, activeJob: value }))
  }, [])

  const setTranscriptionJob = useCallback((value: TranscriptionJob | null) => {
    setJobState((prev) => ({ ...prev, transcriptionJob: value }))
  }, [])

  const setProcessingJob = useCallback((value: ProcessingJob | null) => {
    setJobState((prev) => ({ ...prev, processingJob: value }))
  }, [])

  const updateShorts = useCallback((shorts: Short[]) => {
    setState((prev) => ({ ...prev, shorts }))
  }, [])

  const loadProjectData = useCallback(async () => {
    if (!projectId) return

    try {
      const [projectData, jobsData] = await Promise.all([
        call<{
          project: Project
          transcription: Transcription | null
          transcriptions: Transcription[]
          shorts: Short[]
          mediaAssets: MediaAsset[]
          longFormAssets: MediaAsset[]
          shortFormAssets: MediaAsset[]
        }>(`/v1/projects/${projectId}`),
        call<{ jobs: ApiJob[] }>(`/v1/projects/${projectId}/jobs`),
      ])

      if (!isMountedRef.current) return

      // Preserve existing URLs to prevent video player restart
      setState((prev) => {
        const newProject = projectData.project as Project & { videoUrl?: string; thumbnailUrl?: string }
        if (prev.project) {
          if ((prev.project as any).videoUrl) {
            (newProject as any).videoUrl = (prev.project as any).videoUrl
          }
          if ((prev.project as any).thumbnailUrl) {
            (newProject as any).thumbnailUrl = (prev.project as any).thumbnailUrl
          }
        }
        return {
          ...prev,
          project: newProject,
          transcription: projectData.transcription,
          transcriptions: projectData.transcriptions || [],
          shorts: projectData.shorts || [],
          mediaAssets: preserveAssetUrls(projectData.mediaAssets || [], prev.mediaAssets),
          longFormAssets: preserveAssetUrls(projectData.longFormAssets || [], prev.longFormAssets),
          shortFormAssets: preserveAssetUrls(projectData.shortFormAssets || [], prev.shortFormAssets),
          loading: false,
          error: null,
        }
      })

      // Update job states
      const latestTranscriptionJob = extractTranscriptionJob(jobsData.jobs)
      setTranscriptionJob(latestTranscriptionJob)

      const activeProcessingJob = extractActiveProcessingJob(jobsData.jobs)
      setProcessingJob(activeProcessingJob)

      const activeAnalysisJob = extractActiveAnalysisJob(jobsData.jobs)
      if (activeAnalysisJob) {
        setActiveJob(activeAnalysisJob)
        setLastAnalysisJobId(activeAnalysisJob.id)
        setIsGeneratingShorts(true)
      } else {
        setActiveJob(null)
      }

      // Fetch scheduled posts
      try {
        type ApiScheduledPost = {
          id: string
          status: string
          scheduledFor: string
          title: string
          platformPostId: string | null
          platformUrl: string | null
          errorMessage: string | null
          platform: string
          channelTitle: string | null
        }
        const scheduledData = await call<{
          posts: Record<string, ApiScheduledPost[]>
        }>(`/v1/projects/${projectId}/scheduled-posts`)
        if (isMountedRef.current) {
          // Convert scheduledFor strings to Dates
          const postsWithDates: Record<string, ScheduledPost[]> = {}
          for (const [shortId, posts] of Object.entries(scheduledData.posts)) {
            postsWithDates[shortId] = posts.map((p): ScheduledPost => ({
              ...p,
              scheduledFor: new Date(p.scheduledFor),
            }))
          }
          setState((prev) => ({
            ...prev,
            scheduledPostsByShort: postsWithDates,
          }))
        }
      } catch {
        // Silently ignore - scheduled posts are optional
      }
    } catch (err) {
      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load project',
        }))
      }
    }
  }, [projectId, call, setTranscriptionJob, setProcessingJob, setActiveJob, setLastAnalysisJobId, setIsGeneratingShorts])

  // Initial load
  useEffect(() => {
    isMountedRef.current = true
    if (projectId) {
      loadProjectData()
    }
    return () => {
      isMountedRef.current = false
    }
  }, [projectId, loadProjectData])

  // Polling when there's active work
  useEffect(() => {
    const { transcriptionJob, processingJob, isGeneratingShorts } = jobState
    const { shorts, transcription } = state

    // Determine if we should poll
    const hasActiveProcessing = processingJob?.status === 'queued' || processingJob?.status === 'running'
    const hasPendingShorts = shorts.some(
      (s) => s.status === 'uploading' || s.status === 'ready' || s.status === 'processing'
    )
    // Keep polling if transcription job succeeded but transcription data not yet available
    const transcriptionJobDone = transcriptionJob?.status === 'succeeded'
    const waitingForTranscription = transcriptionJobDone && !transcription
    const shouldPoll = isGeneratingShorts || hasPendingShorts || hasActiveProcessing || waitingForTranscription

    if (!shouldPoll || !projectId) return

    const interval = setInterval(async () => {
      try {
        const [projectData, jobsData] = await Promise.all([
          call<{
            project: Project
            transcription: Transcription | null
            transcriptions: Transcription[]
            shorts: Short[]
            mediaAssets: MediaAsset[]
            longFormAssets: MediaAsset[]
            shortFormAssets: MediaAsset[]
          }>(`/v1/projects/${projectId}`),
          call<{ jobs: ApiJob[] }>(`/v1/projects/${projectId}/jobs`),
        ])

        if (!isMountedRef.current) return

        // Preserve existing URLs
        setState((prev) => {
          const newProject = projectData.project as Project & { videoUrl?: string; thumbnailUrl?: string }
          if (prev.project) {
            if ((prev.project as any).videoUrl) {
              (newProject as any).videoUrl = (prev.project as any).videoUrl
            }
            if ((prev.project as any).thumbnailUrl) {
              (newProject as any).thumbnailUrl = (prev.project as any).thumbnailUrl
            }
          }
          return {
            ...prev,
            project: newProject,
            transcription: projectData.transcription,
            transcriptions: projectData.transcriptions || [],
            shorts: projectData.shorts || [],
            mediaAssets: preserveAssetUrls(projectData.mediaAssets || [], prev.mediaAssets),
            longFormAssets: preserveAssetUrls(projectData.longFormAssets || [], prev.longFormAssets),
            shortFormAssets: preserveAssetUrls(projectData.shortFormAssets || [], prev.shortFormAssets),
          }
        })

        // Update job states
        const latestTranscriptionJob = extractTranscriptionJob(jobsData.jobs)
        if (latestTranscriptionJob) {
          setTranscriptionJob(latestTranscriptionJob)
        }

        const activeProcessingJob = extractActiveProcessingJob(jobsData.jobs)
        setProcessingJob(activeProcessingJob)

        const analysisJob = extractActiveAnalysisJob(jobsData.jobs)
        setActiveJob(analysisJob)

        // Stop polling when job completes AND no pending shorts
        const allShorts = projectData.shorts || []
        const stillHasPendingShorts = allShorts.some(
          (s) => s.status === 'uploading' || s.status === 'ready' || s.status === 'processing'
        )

        if (!analysisJob && !stillHasPendingShorts) {
          setIsGeneratingShorts(false)
          setLastAnalysisJobId(null)
        }
      } catch (err) {
        console.error('Error polling project data:', err)
      }
    }, POLL_INTERVAL)

    return () => clearInterval(interval)
  }, [
    projectId,
    call,
    jobState.isGeneratingShorts,
    jobState.transcriptionJob,
    jobState.processingJob,
    state.shorts,
    state.transcription,
    setTranscriptionJob,
    setProcessingJob,
    setActiveJob,
    setIsGeneratingShorts,
    setLastAnalysisJobId,
  ])

  return {
    ...state,
    ...jobState,
    setIsGeneratingShorts,
    setLastAnalysisJobId,
    setActiveJob,
    setTranscriptionJob,
    setProcessingJob,
    refresh: loadProjectData,
    updateShorts,
  }
}
