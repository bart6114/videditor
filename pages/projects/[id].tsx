import { useEffect, useState } from 'react'
import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import { useAuth } from '@clerk/nextjs'
import { useApi } from '@/lib/api/client'
import { useOnboarding } from '@/contexts/OnboardingContext'
import { TOUR_IDS } from '@/components/onboarding/tour-ids'
import WorkspaceLayout from '@/components/layout/WorkspaceLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ShortsSidePanel } from '@/components/shorts-side-panel'
import { TranscriptionSidePanel } from '@/components/transcription-side-panel'
import { BulkScheduleDialog } from '@/components/bulk-schedule-dialog'
import {
  Sparkles,
  Download,
  Play,
  Clock,
  Loader2,
  FileText,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Trash2,
  Pencil,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Calendar,
} from 'lucide-react'
import type { Project, Short, Transcription } from '@server/db/schema'
import { SOCIAL_PLATFORMS, type SocialPlatform, type ShortTasks } from '@shared/index'
import { SiYoutube, SiInstagram, SiTiktok } from '@icons-pack/react-simple-icons'

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
}

// LinkedIn icon as inline SVG (not available in simple-icons)
const LinkedInIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
)

const PLATFORM_ICONS: Record<SocialPlatform, React.ComponentType<{ size?: number }>> = {
  youtube: SiYoutube,
  instagram: SiInstagram,
  tiktok: SiTiktok,
  linkedin: LinkedInIcon,
}

const ReactPlayer = dynamic(() => import('react-player'), { ssr: false })

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

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

function renderShortStatusBadge(
  short: Short & { tasks?: ShortTasks },
  scheduledPosts?: ScheduledPost[]
): React.ReactNode {
  // PENDING
  if (short.status === 'pending') {
    return (
      <Badge variant="secondary" className="text-xs">
        <Clock className="w-3 h-3 mr-1" />
        Queued
      </Badge>
    )
  }

  // PROCESSING
  if (short.status === 'processing') {
    return (
      <Badge variant="secondary" className="text-xs">
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        Processing
      </Badge>
    )
  }

  // ERROR
  if (short.status === 'error') {
    return (
      <Badge variant="destructive" className="text-xs">
        <AlertCircle className="w-3 h-3 mr-1" />
        Error
      </Badge>
    )
  }

  // COMPLETED - check scheduled post status first
  if (short.status === 'completed' && scheduledPosts && scheduledPosts.length > 0) {
    const publishing = scheduledPosts.find(p => p.status === 'publishing')
    const scheduled = scheduledPosts.find(p => p.status === 'scheduled')
    const published = scheduledPosts.find(p => p.status === 'published')
    const failed = scheduledPosts.find(p => p.status === 'failed')
    const post = publishing || scheduled || published || failed

    if (post) {
      if (post.status === 'publishing') {
        return (
          <Badge variant="secondary" className="text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Publishing...
          </Badge>
        )
      }
      if (post.status === 'scheduled') {
        return (
          <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
            <Clock className="w-3 h-3 mr-1" />
            {post.scheduledFor.toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </Badge>
        )
      }
      if (post.status === 'published' && post.platformUrl) {
        return (
          <a
            href={post.platformUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex"
          >
            <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 hover:bg-green-500/20 cursor-pointer">
              <SiYoutube size={12} className="mr-1" />
              Published
            </Badge>
          </a>
        )
      }
      if (post.status === 'failed') {
        return (
          <Badge variant="secondary" className="text-xs bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" title={post.errorMessage || 'Publishing failed'}>
            <AlertCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        )
      }
    }
  }

  // DEFAULT COMPLETED (no scheduled posts)
  if (short.status === 'completed') {
    return (
      <Badge variant="default" className="text-xs">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Ready
      </Badge>
    )
  }

  // Fallback
  return (
    <Badge variant="secondary" className="text-xs">
      {short.status}
    </Badge>
  )
}

export default function ProjectDetail() {
  const router = useRouter()
  const { id } = router.query
  const { call } = useApi()
  const { getToken } = useAuth()
  const { shouldShowTour, startTour } = useOnboarding()

  const [project, setProject] = useState<Project | null>(null)
  const [shorts, setShorts] = useState<Short[]>([])
  const [transcription, setTranscription] = useState<Transcription | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [isGeneratingShorts, setIsGeneratingShorts] = useState(false)
  const [activeJob, setActiveJob] = useState<{ id: string; status: string; progress?: { phase: 'analyzing' | 'generating'; current: number; total: number } } | null>(null)
  const [lastAnalysisJobId, setLastAnalysisJobId] = useState<string | null>(null)
  const [shortsCount, setShortsCount] = useState(3)
  const [preferredLength, setPreferredLength] = useState(45)
  const [maxLength, setMaxLength] = useState(60)
  const [customPrompt, setCustomPrompt] = useState('')
  const [customSocialPrompt, setCustomSocialPrompt] = useState('')
  const [avoidExistingOverlap, setAvoidExistingOverlap] = useState(false)
  const [socialPlatforms, setSocialPlatforms] = useState<SocialPlatform[]>([])
  const [defaultPromptLoaded, setDefaultPromptLoaded] = useState(false)
  const [usingDefaultPrompt, setUsingDefaultPrompt] = useState(false)
  const [usingDefaultSocialPrompt, setUsingDefaultSocialPrompt] = useState(false)
  const [usingDefaultPlatforms, setUsingDefaultPlatforms] = useState(false)
  const [showAnalysisPrompt, setShowAnalysisPrompt] = useState(false)
  const [showSocialPrompt, setShowSocialPrompt] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [selectedShort, setSelectedShort] = useState<Short | null>(null)
  const [transcriptionPanelOpen, setTranscriptionPanelOpen] = useState(false)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [downloadingMetadata, setDownloadingMetadata] = useState(false)
  const [downloadingShortId, setDownloadingShortId] = useState<string | null>(null)
  const [videoPlayerLoaded, setVideoPlayerLoaded] = useState(false)
  const [deleteShortDialogOpen, setDeleteShortDialogOpen] = useState(false)
  const [shortToDelete, setShortToDelete] = useState<Short | null>(null)
  const [deletingShort, setDeletingShort] = useState(false)
  const [deleteProjectDialogOpen, setDeleteProjectDialogOpen] = useState(false)
  const [deletingProject, setDeletingProject] = useState(false)
  const [bulkScheduleDialogOpen, setBulkScheduleDialogOpen] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [savingTitle, setSavingTitle] = useState(false)
  const [userCredits, setUserCredits] = useState<number | null>(null)
  const [showInsufficientCredits, setShowInsufficientCredits] = useState(false)

  // Transcription job tracking for error/retry handling
  const [transcriptionJob, setTranscriptionJob] = useState<{
    id: string;
    status: string;
    errorMessage?: string | null;
  } | null>(null)
  const [retryingTranscription, setRetryingTranscription] = useState(false)

  // Multi-select state for shorts
  const [selectedShortIds, setSelectedShortIds] = useState<Set<string>>(new Set())

  // Scheduled posts state for displaying publishing status on shorts
  const [scheduledPostsByShort, setScheduledPostsByShort] = useState<Record<string, {
    id: string
    status: string
    scheduledFor: Date
    title: string
    platformPostId: string | null
    platformUrl: string | null
    errorMessage: string | null
    platform: string
    channelTitle: string | null
  }[]>>({})

  // Helper functions for selection
  const toggleShortSelection = (shortId: string) => {
    setSelectedShortIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(shortId)) {
        newSet.delete(shortId)
      } else {
        newSet.add(shortId)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedShortIds.size === shorts.length) {
      // Deselect all
      setSelectedShortIds(new Set())
    } else {
      // Select all shorts
      setSelectedShortIds(new Set(shorts.map((s) => s.id)))
    }
  }

  const clearSelection = () => {
    setSelectedShortIds(new Set())
  }

  const isAllSelected = () => {
    return shorts.length > 0 && selectedShortIds.size === shorts.length
  }

  const isSomeSelected = () => {
    return selectedShortIds.size > 0 && !isAllSelected()
  }

  const hasSelections = selectedShortIds.size > 0

  // Start project detail tour if user hasn't completed it
  useEffect(() => {
    if (shouldShowTour(TOUR_IDS.PROJECT_DETAIL)) {
      startTour(TOUR_IDS.PROJECT_DETAIL)
    }
  }, [shouldShowTour, startTour])

  // Initial load
  useEffect(() => {
    if (id) {
      loadProjectData()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Poll for updates while generating shorts OR while shorts are pending/processing OR while transcription is in progress
  useEffect(() => {
    // Check if there are pending/processing shorts
    const hasPendingShorts = shorts.some(s => s.status === 'pending' || s.status === 'processing')
    // Check if transcription is in progress
    const isTranscribing = transcriptionJob && ['queued', 'running'].includes(transcriptionJob.status)

    if (!isGeneratingShorts && !hasPendingShorts && !isTranscribing) return
    if (!id) return

    const interval = setInterval(async () => {
      // Fetch both project data and jobs in parallel
      try {
        const [projectData, jobsData] = await Promise.all([
          call<{
            project: Project
            transcription: Transcription | null
            shorts: Short[]
          }>(`/v1/projects/${id}`),
          call<{ jobs: Array<{ id: string; type: string; status: string; errorMessage?: string | null; createdAt?: string; progress?: { phase: 'analyzing' | 'generating'; current: number; total: number } }> }>(`/v1/projects/${id}/jobs`),
        ])

        // Update project/shorts data (preserve URLs)
        setProject((prev) => {
          const newProject = projectData.project as Project & { videoUrl?: string; thumbnailUrl?: string }
          if (prev) {
            if ((prev as any).videoUrl) {
              ;(newProject as any).videoUrl = (prev as any).videoUrl
            }
            if ((prev as any).thumbnailUrl) {
              ;(newProject as any).thumbnailUrl = (prev as any).thumbnailUrl
            }
          }
          return newProject
        })
        setTranscription(projectData.transcription)
        setShorts(projectData.shorts || [])

        // Update transcription job status
        const transcriptionJobs = jobsData.jobs.filter(j => j.type === 'transcription')
        if (transcriptionJobs.length > 0) {
          const sortedJobs = [...transcriptionJobs].sort((a, b) =>
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          )
          const latestJob = sortedJobs[0]
          setTranscriptionJob({
            id: latestJob.id,
            status: latestJob.status,
            errorMessage: latestJob.errorMessage,
          })
        }

        // Find active analysis job
        const analysisJob = jobsData.jobs.find(
          (j) => j.type === 'analysis' && ['queued', 'running'].includes(j.status)
        )
        setActiveJob(analysisJob || null)

        // Stop polling when job completes AND no pending shorts in current batch
        const currentBatchShorts = lastAnalysisJobId
          ? (projectData.shorts || []).filter(s => s.analysisJobId === lastAnalysisJobId)
          : (projectData.shorts || [])
        const stillHasPendingShorts = currentBatchShorts.some(
          s => s.status === 'pending' || s.status === 'processing'
        )
        if (!analysisJob && !stillHasPendingShorts) {
          setIsGeneratingShorts(false)
          setLastAnalysisJobId(null)
        }
      } catch (error) {
        console.error('Error polling for updates:', error)
      }
    }, 3000)

    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGeneratingShorts, id, call, shorts, transcriptionJob, lastAnalysisJobId])

  // Keyboard shortcut for select all (Ctrl/Cmd+A)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if Ctrl+A (Windows/Linux) or Cmd+A (Mac) is pressed
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && shorts.length > 0) {
        // Only intercept if we're not in an input field
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault()
          toggleSelectAll()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shorts.length, selectedShortIds.size])

  // Load user's default settings and credits
  useEffect(() => {
    if (defaultPromptLoaded) return

    async function loadDefaultSettings() {
      try {
        const [settingsData, creditsData] = await Promise.all([
          call<{ settings: { defaultCustomPrompt: string | null; defaultSocialPrompt: string | null; defaultSocialPlatforms: SocialPlatform[]; defaultAvoidOverlap: boolean; defaultPreferredLength: number; defaultMaxLength: number } }>('/v1/user/settings'),
          call<{ credits: number }>('/v1/billing/credits'),
        ])

        if (settingsData.settings.defaultCustomPrompt) {
          setCustomPrompt(settingsData.settings.defaultCustomPrompt)
          setUsingDefaultPrompt(true)
          setShowAnalysisPrompt(true) // Auto-expand if user has a default
        }
        if (settingsData.settings.defaultSocialPrompt) {
          setCustomSocialPrompt(settingsData.settings.defaultSocialPrompt)
          setUsingDefaultSocialPrompt(true)
          setShowSocialPrompt(true) // Auto-expand if user has a default
        }
        if (settingsData.settings.defaultSocialPlatforms?.length > 0) {
          setSocialPlatforms(settingsData.settings.defaultSocialPlatforms)
          setUsingDefaultPlatforms(true)
        }
        if (settingsData.settings.defaultAvoidOverlap !== undefined) {
          setAvoidExistingOverlap(settingsData.settings.defaultAvoidOverlap)
        }
        if (settingsData.settings.defaultPreferredLength) {
          setPreferredLength(settingsData.settings.defaultPreferredLength)
        }
        if (settingsData.settings.defaultMaxLength) {
          setMaxLength(settingsData.settings.defaultMaxLength)
        }

        setUserCredits(creditsData.credits)
      } catch (error) {
        // Silently ignore - user just won't have defaults prefilled
      } finally {
        setDefaultPromptLoaded(true)
      }
    }
    loadDefaultSettings()
  }, [call, defaultPromptLoaded])

  async function loadProjectData() {
    if (!id || typeof id !== 'string') return

    try {
      // Fetch project data and jobs in parallel
      const [data, jobsData] = await Promise.all([
        call<{
          project: Project
          transcription: Transcription | null
          shorts: Short[]
        }>(`/v1/projects/${id}`),
        call<{ jobs: Array<{ id: string; type: string; status: string; errorMessage?: string | null; createdAt?: string; progress?: { phase: 'analyzing' | 'generating'; current: number; total: number } }> }>(`/v1/projects/${id}/jobs`),
      ])

      // Preserve existing URLs to prevent video player restart during polling
      setProject((prev) => {
        const newProject = data.project as Project & { videoUrl?: string; thumbnailUrl?: string }
        if (prev) {
          // Keep existing URLs if already loaded
          if ((prev as any).videoUrl) {
            ;(newProject as any).videoUrl = (prev as any).videoUrl
          }
          if ((prev as any).thumbnailUrl) {
            ;(newProject as any).thumbnailUrl = (prev as any).thumbnailUrl
          }
        }
        return newProject
      })
      setTranscription(data.transcription)
      setShorts(data.shorts || [])

      // Find the most recent transcription job
      const transcriptionJobs = jobsData.jobs.filter(j => j.type === 'transcription')
      if (transcriptionJobs.length > 0) {
        // Sort by createdAt descending to get the most recent
        const sortedJobs = [...transcriptionJobs].sort((a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        )
        const latestJob = sortedJobs[0]
        setTranscriptionJob({
          id: latestJob.id,
          status: latestJob.status,
          errorMessage: latestJob.errorMessage,
        })
      } else {
        setTranscriptionJob(null)
      }

      // Check for active analysis job (e.g., user refreshed page mid-generation)
      const activeAnalysisJob = jobsData.jobs.find(
        (j) => j.type === 'analysis' && ['queued', 'running'].includes(j.status)
      )
      if (activeAnalysisJob) {
        setActiveJob(activeAnalysisJob)
        setIsGeneratingShorts(true) // Resume showing progress
      } else {
        setActiveJob(null)
      }
      // Fetch scheduled posts for all shorts in the project
      try {
        const scheduledData = await call<{ posts: Record<string, {
          id: string
          status: string
          scheduledFor: string
          title: string
          platformPostId: string | null
          platformUrl: string | null
          errorMessage: string | null
          platform: string
          channelTitle: string | null
        }[]> }>(`/v1/projects/${id}/scheduled-posts`)
        // Convert scheduledFor strings to Dates
        const postsWithDates: Record<string, typeof scheduledPostsByShort[string]> = {}
        for (const [shortId, posts] of Object.entries(scheduledData.posts)) {
          postsWithDates[shortId] = posts.map(p => ({
            ...p,
            scheduledFor: new Date(p.scheduledFor)
          }))
        }
        setScheduledPostsByShort(postsWithDates)
      } catch (err) {
        // Non-critical - don't block project loading
        console.error('Error loading scheduled posts:', err)
      }
    } catch (error) {
      console.error('Error loading project:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAnalyze() {
    // Check credits before proceeding
    if (userCredits !== null && userCredits < shortsCount) {
      setShowInsufficientCredits(true)
      return
    }
    setShowInsufficientCredits(false)

    setAnalyzing(true)
    setIsGeneratingShorts(true)

    try {
      const jobData = await call<{ job: { id: string; status: string } }>(`/v1/projects/${id}/jobs`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'analysis',
          payload: {
            shortsCount,
            preferredLength,
            maxLength,
            customPrompt: customPrompt.trim() || undefined,
            customSocialPrompt: customSocialPrompt.trim() || undefined,
            avoidExistingOverlap: avoidExistingOverlap || undefined,
            socialPlatforms: socialPlatforms.length > 0 ? socialPlatforms : undefined,
          },
        }),
      })

      // Set the active job immediately and track its ID for progress display
      setActiveJob({ id: jobData.job.id, status: jobData.job.status })
      setLastAnalysisJobId(jobData.job.id)

      // Refresh credits after successful job creation
      try {
        const creditsData = await call<{ credits: number }>('/v1/billing/credits')
        setUserCredits(creditsData.credits)
      } catch {
        // Silently ignore credit refresh errors
      }
    } catch (error) {
      console.error('Error analyzing:', error)

      // Refresh credits to show current balance
      try {
        const creditsData = await call<{ credits: number }>('/v1/billing/credits')
        setUserCredits(creditsData.credits)
      } catch {
        // Silently ignore credit refresh errors
      }

      alert(error instanceof Error ? error.message : 'Failed to generate shorts')
      setIsGeneratingShorts(false)
      setActiveJob(null)
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleRetryTranscription() {
    if (!project) return

    setRetryingTranscription(true)

    try {
      await call(`/v1/projects/${id}/jobs`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'transcription',
          payload: {
            sourceObjectKey: project.sourceObjectKey,
            sourceBucket: project.sourceBucket,
          },
        }),
      })

      // Reload project data to get fresh state (new job will be queued)
      await loadProjectData()
    } catch (error) {
      console.error('Error retrying transcription:', error)
      alert(error instanceof Error ? error.message : 'Failed to retry transcription')
    } finally {
      setRetryingTranscription(false)
    }
  }

  async function handleDownloadShort(short: Short) {
    setDownloadingShortId(short.id)
    try {
      const data = await call<{ downloadUrl: string; filename: string }>(
        `/v1/projects/${id}/shorts/${short.id}/download`
      )

      // Trigger browser download
      const a = document.createElement('a')
      a.href = data.downloadUrl
      a.download = `${data.filename}.mp4`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading short:', error)
      alert(error instanceof Error ? error.message : 'Failed to download short')
    } finally {
      setDownloadingShortId(null)
    }
  }

  async function handleDownloadAll() {
    if (shorts.length === 0) return

    // Get shorts to download (either selected or all)
    const shortsToDownload = hasSelections
      ? shorts.filter((short) => selectedShortIds.has(short.id))
      : shorts

    // Check if all shorts to download are completed
    const incompleteShorts = shortsToDownload.filter(
      (short) => short.status !== 'completed'
    )

    if (incompleteShorts.length > 0) {
      const completedCount = shortsToDownload.length - incompleteShorts.length
      alert(
        `Cannot download: ${incompleteShorts.length} short(s) are still processing. ${completedCount} of ${shortsToDownload.length} shorts are ready.`
      )
      return
    }

    setDownloadingAll(true)
    try {
      const token = await getToken()
      const url = hasSelections
        ? `/api/v1/projects/${id}/download-shorts?shortIds=${Array.from(selectedShortIds).join(',')}`
        : `/api/v1/projects/${id}/download-shorts`

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to download shorts')
      }

      // Download the zip file
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      const filename = hasSelections
        ? `${project?.title || 'Project'} - Selected Shorts.zip`
        : `${project?.title || 'Project'} - Shorts.zip`
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(blobUrl)

      // Clear selection after successful download
      if (hasSelections) {
        clearSelection()
      }
    } catch (error) {
      console.error('Error downloading shorts:', error)
      alert(error instanceof Error ? error.message : 'Failed to download shorts')
    } finally {
      setDownloadingAll(false)
    }
  }

  async function handleDownloadMetadata() {
    if (shorts.length === 0) return

    // Get shorts to download metadata for (either selected or all)
    const shortsForMetadata = hasSelections
      ? shorts.filter((short) => selectedShortIds.has(short.id))
      : shorts

    // Filter completed shorts
    const completedShorts = shortsForMetadata.filter((short) => short.status === 'completed')

    if (completedShorts.length === 0) {
      alert('No completed shorts available to download metadata.')
      return
    }

    setDownloadingMetadata(true)
    try {
      const url = hasSelections
        ? `/v1/projects/${id}/metadata?shortIds=${Array.from(selectedShortIds).join(',')}`
        : `/v1/projects/${id}/metadata`

      const data = await call<{ shorts: any[] }>(url)

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(data.shorts, null, 2)], {
        type: 'application/json',
      })
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      const filename = hasSelections
        ? `${project?.title || 'Project'} - Selected Metadata.json`
        : `${project?.title || 'Project'} - Metadata.json`
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(blobUrl)

      // Clear selection after successful download
      if (hasSelections) {
        clearSelection()
      }
    } catch (error) {
      console.error('Error downloading metadata:', error)
      alert(error instanceof Error ? error.message : 'Failed to download metadata')
    } finally {
      setDownloadingMetadata(false)
    }
  }

  function seekToTime(time: number) {
    setCurrentTime(time)
  }

  async function handleDeleteShort() {
    if (!shortToDelete) return

    setDeletingShort(true)
    try {
      await call(`/v1/projects/${id}/shorts/${shortToDelete.id}`, {
        method: 'DELETE',
      })

      // Close dialog and refresh project data
      setDeleteShortDialogOpen(false)
      setShortToDelete(null)
      await loadProjectData()
    } catch (error) {
      console.error('Error deleting short:', error)
    } finally {
      setDeletingShort(false)
    }
  }

  function openDeleteShortDialog(short: Short, e: React.MouseEvent) {
    e.stopPropagation() // Prevent card click
    setShortToDelete(short)
    setDeleteShortDialogOpen(true)
  }

  async function handleDeleteSelected() {
    if (selectedShortIds.size === 0) return

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedShortIds.size} selected short${selectedShortIds.size > 1 ? 's' : ''}? This action cannot be undone.`
    )

    if (!confirmed) return

    setDeletingShort(true)
    try {
      await call(`/v1/projects/${id}/shorts/bulk-delete`, {
        method: 'DELETE',
        body: JSON.stringify({ shortIds: Array.from(selectedShortIds) }),
      })

      // Clear selection and refresh project data
      clearSelection()
      await loadProjectData()
    } catch (error) {
      console.error('Error deleting shorts:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete shorts')
    } finally {
      setDeletingShort(false)
    }
  }

  function startEditingTitle() {
    setNewTitle(project?.title || '')
    setEditingTitle(true)
  }

  async function handleSaveTitle() {
    if (!project || !newTitle.trim()) return

    setSavingTitle(true)
    try {
      await call(`/v1/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: newTitle.trim() }),
      })

      await loadProjectData()
      setEditingTitle(false)
    } catch (error) {
      console.error('Error updating title:', error)
    } finally {
      setSavingTitle(false)
    }
  }

  function cancelEditingTitle() {
    setEditingTitle(false)
    setNewTitle('')
  }

  async function handleDeleteProject() {
    setDeletingProject(true)
    try {
      await call(`/v1/projects/${id}`, {
        method: 'DELETE',
      })
      router.push('/projects')
    } catch (error) {
      console.error('Error deleting project:', error)
      setDeletingProject(false)
    }
  }

  if (loading) {
    return (
      <WorkspaceLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </WorkspaceLayout>
    )
  }

  if (!project) {
    return (
      <WorkspaceLayout>
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Project not found</p>
        </div>
      </WorkspaceLayout>
    )
  }

  const metadata =
    (project.metadata && typeof project.metadata === 'object'
      ? (project.metadata as Record<string, unknown>)
      : {}) ?? {}
  const playbackUrl = (project as any).videoUrl || null

  return (
    <>
      <Head>
        <title>{project.title} - VidEditor.ai</title>
        <meta name="description" content={`Edit and create shorts from "${project.title}" using AI`} />

        {/* Open Graph - Dynamic project image */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={`${project.title} - VidEditor.ai`} />
        <meta property="og:description" content={`Edit and create shorts from "${project.title}" using AI`} />
        <meta property="og:image" content={`${process.env.NEXT_PUBLIC_APP_URL || 'https://videditor.ai'}/api/og/project?title=${encodeURIComponent(project.title)}&shorts=${shorts.length}&duration=${project.durationSeconds ? formatDuration(project.durationSeconds) : '0:00'}`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="VidEditor.ai" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${project.title} - VidEditor.ai`} />
        <meta name="twitter:description" content={`Edit and create shorts from "${project.title}" using AI`} />
        <meta name="twitter:image" content={`${process.env.NEXT_PUBLIC_APP_URL || 'https://videditor.ai'}/api/og/project?title=${encodeURIComponent(project.title)}&shorts=${shorts.length}&duration=${project.durationSeconds ? formatDuration(project.durationSeconds) : '0:00'}`} />
      </Head>

      <WorkspaceLayout title={project.title}>
        <div className="space-y-6">
          {/* Top Row: 2-Column Grid */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left Column: Video Player */}
            <Card className="bg-card border-border h-full flex flex-col" data-tour="video-player">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {editingTitle ? (
                      <div className="flex items-center gap-2 mb-2">
                        <Input
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveTitle()
                            if (e.key === 'Escape') cancelEditingTitle()
                          }}
                          className="flex-1"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          onClick={handleSaveTitle}
                          disabled={savingTitle || !newTitle.trim()}
                        >
                          {savingTitle ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEditingTitle}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-foreground">{project.title}</CardTitle>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={startEditingTitle}
                          className="h-8 w-8 p-0"
                          title="Edit title"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteProjectDialogOpen(true)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Delete project"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    <CardDescription className="text-muted-foreground">
                      Duration: {project.durationSeconds ? formatDuration(project.durationSeconds) : '—'} • Status:{' '}
                      <Badge variant={project.status === 'completed' ? 'default' : 'secondary'}>{project.status}</Badge>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="flex-1 min-h-[300px] bg-black rounded-lg overflow-hidden relative flex items-center justify-center">
                  {playbackUrl ? (
                    <>
                      {!videoPlayerLoaded ? (
                        <div
                          className="absolute inset-0 cursor-pointer group flex items-center justify-center"
                          onClick={() => setVideoPlayerLoaded(true)}
                        >
                          {project.thumbnailUrl ? (
                            <Image
                              src={project.thumbnailUrl}
                              alt={project.title}
                              fill
                              className="object-contain"
                            />
                          ) : (
                            <div className="w-full h-full bg-muted" />
                          )}

                          {/* Play button overlay */}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                            <div className="w-20 h-20 rounded-full bg-white/90 group-hover:bg-white group-hover:scale-110 transition-all flex items-center justify-center shadow-xl">
                              <Play className="w-10 h-10 text-black fill-black ml-1" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="absolute inset-0">
                          <ReactPlayer
                            url={playbackUrl}
                            controls
                            width="100%"
                            height="100%"
                            playing={true}
                            onProgress={({ playedSeconds }) => setCurrentTime(playedSeconds)}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Playback preview is not available yet for this project.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Right Column: Transcription + Shorts Generation */}
            <div className="space-y-6">
            {/* Transcription Section - Success State */}
            {transcription && (
              <Card className="bg-card border-border" data-tour="transcription-status">
                <CardHeader
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setTranscriptionPanelOpen(true)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      <CardTitle className="text-foreground">Transcription</CardTitle>
                      <Badge>Ready</Badge>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </CardHeader>
              </Card>
            )}

            {/* Transcription Section - In Progress State */}
            {!transcription && (retryingTranscription || (transcriptionJob && ['queued', 'running'].includes(transcriptionJob.status))) && (
              <Card className="bg-primary/5 border-primary/30">
                <CardContent className="py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground mb-1">
                        Transcribing video...
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {retryingTranscription || transcriptionJob?.status === 'queued'
                          ? 'Waiting in queue...'
                          : 'Processing audio and generating transcript'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Transcription Section - Failed State */}
            {!transcription && !retryingTranscription && transcriptionJob && transcriptionJob.status === 'failed' && (
              <Card className="bg-destructive/5 border-destructive/30">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-destructive" />
                    <CardTitle className="text-foreground">Transcription Failed</CardTitle>
                    <Badge variant="destructive">Error</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {transcriptionJob.errorMessage && (
                    <p className="text-sm text-muted-foreground mb-4">
                      {transcriptionJob.errorMessage}
                    </p>
                  )}
                  <Button
                    onClick={handleRetryTranscription}
                    disabled={retryingTranscription}
                    variant="outline"
                    className="border-destructive/30 hover:bg-destructive/10"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry Transcription
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Shorts Generation Section */}
            {transcription && (
              <Card className="bg-card border-border" data-tour="generate-shorts">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Generate Shorts
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Use AI to find the most engaging moments from your video
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block text-foreground">
                      Number of Shorts
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={15}
                      value={shortsCount || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setShowInsufficientCredits(false);
                        if (val === '') {
                          setShortsCount(0);
                        } else {
                          const parsed = parseInt(val, 10);
                          if (!isNaN(parsed)) {
                            setShortsCount(parsed);
                          }
                        }
                      }}
                      onBlur={() => {
                        const clamped = Math.max(1, Math.min(15, shortsCount || 1));
                        setShortsCount(clamped);
                      }}
                      disabled={analyzing}
                      className="bg-background border-input text-foreground"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block text-foreground">
                        Preferred Length (seconds)
                      </label>
                      <Input
                        type="number"
                        min={15}
                        max={120}
                        value={preferredLength}
                        onChange={(e) => {
                          const parsed = parseInt(e.target.value);
                          setPreferredLength(isNaN(parsed) ? 0 : parsed);
                        }}
                        onBlur={() => {
                          const clamped = Math.max(15, Math.min(120, preferredLength || 15));
                          setPreferredLength(clamped);
                          if (maxLength < clamped) setMaxLength(clamped);
                        }}
                        disabled={analyzing}
                        className="bg-background border-input text-foreground"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Target length for shorts
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block text-foreground">
                        Max Length (seconds)
                      </label>
                      <Input
                        type="number"
                        min={15}
                        max={120}
                        value={maxLength}
                        onChange={(e) => {
                          const parsed = parseInt(e.target.value);
                          setMaxLength(isNaN(parsed) ? 0 : parsed);
                        }}
                        onBlur={() => {
                          const clamped = Math.max(15, Math.min(120, maxLength || 15));
                          setMaxLength(Math.max(clamped, preferredLength));
                        }}
                        disabled={analyzing}
                        className="bg-background border-input text-foreground"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Maximum allowed length
                      </p>
                    </div>
                  </div>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowAnalysisPrompt(!showAnalysisPrompt)}
                      disabled={analyzing}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          Custom Analysis Instructions
                        </span>
                        {usingDefaultPrompt && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            using default
                          </span>
                        )}
                        {customPrompt && !usingDefaultPrompt && (
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                            custom
                          </span>
                        )}
                      </div>
                      {showAnalysisPrompt ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                    {showAnalysisPrompt && (
                      <div className="p-3 border-t border-border">
                        <textarea
                          placeholder="e.g., Focus on educational content, prefer clips with strong hooks..."
                          value={customPrompt}
                          onChange={(e) => {
                            setCustomPrompt(e.target.value)
                            setUsingDefaultPrompt(false)
                          }}
                          disabled={analyzing}
                          rows={3}
                          className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                          Guide the AI when identifying the best moments for shorts. For example, ensure a short about a specific topic you discussed.
                          Set defaults in <Link href="/settings" className="text-primary hover:underline">Preferences</Link>.
                        </p>
                      </div>
                    )}
                  </div>
                  {shorts.length > 0 && (
                    <div className="flex items-center gap-3">
                      <Switch
                        id="avoidOverlap"
                        checked={avoidExistingOverlap}
                        onCheckedChange={setAvoidExistingOverlap}
                        disabled={analyzing}
                      />
                      <label htmlFor="avoidOverlap" className="text-sm text-foreground cursor-pointer">
                        Avoid overlap with existing shorts
                      </label>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-sm font-medium text-foreground">
                        Generate Social Content
                      </label>
                      {usingDefaultPlatforms && socialPlatforms.length > 0 && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          using default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Choose platforms to generate titles and descriptions for.
                      Set defaults in <Link href="/settings" className="text-primary hover:underline">Preferences</Link>.
                    </p>
                    <div className="flex flex-wrap gap-2" data-tour="social-platforms">
                      {SOCIAL_PLATFORMS.map((platform) => {
                        const isSelected = socialPlatforms.includes(platform)
                        const Icon = PLATFORM_ICONS[platform]
                        return (
                          <button
                            key={platform}
                            type="button"
                            onClick={() => {
                              setSocialPlatforms((prev) =>
                                prev.includes(platform)
                                  ? prev.filter((p) => p !== platform)
                                  : [...prev, platform]
                              )
                              setUsingDefaultPlatforms(false)
                            }}
                            disabled={analyzing}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 ${
                              isSelected
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                            } ${analyzing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            title={PLATFORM_LABELS[platform]}
                          >
                            <Icon size={18} />
                            <span className="text-sm font-medium">{PLATFORM_LABELS[platform]}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {socialPlatforms.length > 0 && (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowSocialPrompt(!showSocialPrompt)}
                        disabled={analyzing}
                        className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors disabled:opacity-50"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            Custom Social Content Instructions
                          </span>
                          {usingDefaultSocialPrompt && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                              using default
                            </span>
                          )}
                          {customSocialPrompt && !usingDefaultSocialPrompt && (
                            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                              custom
                            </span>
                          )}
                        </div>
                        {showSocialPrompt ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>
                      {showSocialPrompt && (
                        <div className="p-3 border-t border-border">
                          <textarea
                            placeholder="e.g., Use a casual and friendly tone, include relevant emojis, always end with a CTA like 'Follow for more tips!'..."
                            value={customSocialPrompt}
                            onChange={(e) => {
                              setCustomSocialPrompt(e.target.value)
                              setUsingDefaultSocialPrompt(false)
                            }}
                            disabled={analyzing}
                            rows={3}
                            className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                          />
                          <p className="text-xs text-muted-foreground mt-2">
                            Guide the AI when generating titles and captions for social media
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Button
                      onClick={handleAnalyze}
                      disabled={analyzing || !!activeJob || !transcription || userCredits === null}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      {analyzing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating {shortsCount} shorts...
                        </>
                      ) : activeJob ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generation in progress...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate {shortsCount} Shorts with AI
                        </>
                      )}
                    </Button>

                    {/* Credit cost indicator */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Cost: {shortsCount} credit{shortsCount !== 1 ? 's' : ''}
                      </span>
                      {userCredits !== null && (
                        <span className={userCredits < shortsCount ? 'text-destructive' : 'text-muted-foreground'}>
                          Balance: {userCredits} credit{userCredits !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Insufficient credits warning - shown after failed generation attempt */}
                    {showInsufficientCredits && userCredits !== null && (
                      <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <p className="text-sm text-destructive">
                          Insufficient credits. You need {shortsCount - userCredits} more credit{shortsCount - userCredits !== 1 ? 's' : ''}.{' '}
                          <Link href="/settings/billing" className="underline font-medium hover:text-destructive/80">
                            Add credits
                          </Link>
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Generation Progress Indicator */}
            {activeJob && (
              <Card className="bg-primary/5 border-primary/30 shadow-glow">
                <CardContent className="py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                    <div className="flex-1">
                      {activeJob.progress?.phase === 'analyzing' ? (
                        <>
                          <p className="font-medium text-foreground mb-1">
                            Analyzing transcript...
                          </p>
                          <p className="text-sm text-muted-foreground">
                            AI is finding the best moments for shorts
                          </p>
                        </>
                      ) : activeJob.progress?.phase === 'generating' ? (
                        <>
                          <p className="font-medium text-foreground mb-1">
                            Creating short containers...
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Queueing {activeJob.progress.total} shorts for processing
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-foreground mb-1">
                            Starting generation...
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Preparing to analyze your video
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Shorts Processing Progress (after analysis completes) */}
            {(() => {
              // Filter to only show progress for the current batch
              const batchShorts = lastAnalysisJobId
                ? shorts.filter(s => s.analysisJobId === lastAnalysisJobId)
                : shorts.filter(s => s.status === 'pending' || s.status === 'processing')
              const completed = batchShorts.filter(s => s.status === 'completed').length
              const total = batchShorts.length
              const hasPending = batchShorts.some(s => s.status === 'pending' || s.status === 'processing')

              if (!activeJob && total > 0 && hasPending) {
                return (
                  <Card className="bg-primary/5 border-primary/30">
                    <CardContent className="py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-foreground mb-1">
                            Processing shorts...
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {completed} of {total} completed
                          </p>
                          <div className="mt-2 h-2 bg-primary/20 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all duration-300"
                              style={{ width: `${(completed / total) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              }
              return null
            })()}

            {/* No Transcription Placeholder - Only when no job exists */}
            {!transcription && !transcriptionJob && !retryingTranscription && (
              <Card className="bg-card border-border border-dashed">
                <CardContent className="py-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
                    <FileText className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">No transcription yet</h3>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    The transcription will start processing shortly.
                  </p>
                </CardContent>
              </Card>
            )}
            </div>
          </div>

          {/* Bottom Row: Shorts Table (Full Width) */}
          {shorts.length > 0 && (
            <Card className="bg-card border-border" data-tour="shorts-table">
              <CardHeader className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-foreground text-base sm:text-lg">
                      Generated Shorts ({shorts.filter((s) => s.status === 'completed').length}/{shorts.length})
                    </CardTitle>
                    {hasSelections && (
                      <Badge variant="secondary" className="text-xs">
                        {selectedShortIds.size} selected
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hasSelections && (
                      <Button
                        size="sm"
                        onClick={handleDeleteSelected}
                        disabled={deletingShort}
                        variant="destructive"
                        title="Delete Selected Shorts"
                        className="min-h-[44px] sm:min-h-0"
                      >
                        {deletingShort ? (
                          <>
                            <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
                            <span className="hidden sm:inline">Deleting...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4 sm:mr-2" />
                            <span className="hidden sm:inline">Delete ({selectedShortIds.size})</span>
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => setBulkScheduleDialogOpen(true)}
                      variant="outline"
                      disabled={hasSelections ? selectedShortIds.size === 0 : shorts.filter((s) => s.status === 'completed' && s.outputObjectKey).length === 0}
                      title={hasSelections ? "Schedule Selected Shorts" : "Schedule All Shorts"}
                      className="min-h-[44px] sm:min-h-0"
                      data-tour="schedule-button"
                    >
                      <Calendar className="w-4 h-4 sm:mr-2" />
                      <span className="hidden sm:inline">
                        {hasSelections
                          ? `Schedule (${selectedShortIds.size})`
                          : `Schedule All (${shorts.filter((s) => s.status === 'completed' && s.outputObjectKey).length})`
                        }
                      </span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleDownloadMetadata}
                      disabled={downloadingMetadata || (hasSelections ? selectedShortIds.size === 0 : shorts.filter((s) => s.status === 'completed').length === 0)}
                      variant="outline"
                      title={hasSelections ? "Download Selected Metadata" : "Download All Metadata"}
                      className="min-h-[44px] sm:min-h-0"
                    >
                      {downloadingMetadata ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <FileText className="w-4 h-4 sm:mr-2" />
                          <span className="hidden sm:inline">
                            {hasSelections
                              ? `Metadata (${selectedShortIds.size})`
                              : `All Metadata (${shorts.filter((s) => s.status === 'completed').length})`
                            }
                          </span>
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleDownloadAll}
                      disabled={downloadingAll || (hasSelections ? selectedShortIds.size === 0 : shorts.some((s) => s.status !== 'completed'))}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial"
                    >
                      {downloadingAll ? (
                        <>
                          <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
                          <span className="hidden sm:inline">Downloading...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 sm:mr-2" />
                          <span className="sm:hidden">Download</span>
                          <span className="hidden sm:inline">
                            {hasSelections
                              ? `Download (${selectedShortIds.size})`
                              : `Download All (${shorts.filter((s) => s.status === 'completed').length})`
                            }
                          </span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="pb-3 pr-4 pl-4 w-10 hidden md:table-cell">
                          <Checkbox
                            checked={isAllSelected() ? true : isSomeSelected() ? 'indeterminate' : false}
                            onCheckedChange={toggleSelectAll}
                            disabled={shorts.length === 0}
                          />
                        </th>
                        <th className="pb-3 pr-4 pl-4 md:pl-0 text-sm font-medium text-muted-foreground">Thumbnail</th>
                        <th className="pb-3 pr-4 text-sm font-medium text-muted-foreground">Transcript</th>
                        <th className="pb-3 pr-4 text-sm font-medium text-muted-foreground hidden md:table-cell">Duration</th>
                        <th className="pb-3 pr-4 text-sm font-medium text-muted-foreground hidden lg:table-cell">Timestamps</th>
                        <th className="pb-3 pr-4 text-sm font-medium text-muted-foreground">Status</th>
                        <th className="pb-3 text-sm font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shorts.map((short) => (
                        <tr
                          key={short.id}
                          className={`border-b border-border last:border-0 hover:bg-secondary/50 cursor-pointer transition-all duration-200 group ${
                            selectedShort?.id === short.id && !hasSelections ? 'bg-primary/10 hover:bg-primary/15' : ''
                          } ${
                            selectedShortIds.has(short.id) ? 'bg-primary/20 hover:bg-primary/25' : ''
                          }`}
                          onClick={() => {
                            if (hasSelections) {
                              // When in selection mode, clicking row toggles selection
                              toggleShortSelection(short.id)
                            } else {
                              // When not in selection mode, clicking row opens side panel
                              setSelectedShort(short)
                            }
                          }}
                        >
                          {/* Checkbox - hidden on mobile */}
                          <td className="py-3 pr-4 pl-4 hidden md:table-cell">
                            <Checkbox
                              checked={selectedShortIds.has(short.id)}
                              onCheckedChange={() => toggleShortSelection(short.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          {/* Thumbnail */}
                          <td className="py-3 pr-4 pl-4 md:pl-0">
                            <div className="w-20 aspect-[9/16] bg-black rounded overflow-hidden relative flex-shrink-0">
                              {short.thumbnailUrl ? (
                                <Image
                                  src={short.thumbnailUrl}
                                  alt="Short thumbnail"
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-muted">
                                  <Play className="w-5 h-5 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                          </td>
                          {/* Transcript */}
                          <td className="py-3 pr-4">
                            <span className="text-sm text-foreground line-clamp-2 max-w-[300px]">
                              {short.transcriptionSlice}
                            </span>
                          </td>
                          {/* Duration - hidden on mobile */}
                          <td className="py-3 pr-4 hidden md:table-cell">
                            <div className="flex items-center gap-1 text-sm text-foreground">
                              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                              {formatDuration(short.endTime - short.startTime)}
                            </div>
                          </td>
                          {/* Timestamps - hidden on tablet and below */}
                          <td className="py-3 pr-4 hidden lg:table-cell">
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                              {formatDuration(short.startTime)} - {formatDuration(short.endTime)}
                            </span>
                          </td>
                          {/* Status */}
                          <td className="py-3 pr-4">
                            {renderShortStatusBadge(
                              short as Short & { tasks?: ShortTasks },
                              scheduledPostsByShort[short.id]
                            )}
                          </td>
                          {/* Actions */}
                          <td className="py-3">
                            <div className="flex items-center gap-1 md:gap-2">
                              {short.status === 'completed' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDownloadShort(short)
                                  }}
                                  disabled={downloadingShortId === short.id}
                                  className="min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 p-2 md:px-3"
                                >
                                  {downloadingShortId === short.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Download className="w-4 h-4 md:mr-2" />
                                      <span className="hidden md:inline">Download</span>
                                    </>
                                  )}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 p-2"
                                onClick={(e) => openDeleteShortDialog(short, e)}
                                title="Delete short"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Side Panel for playing shorts */}
        <ShortsSidePanel
          selectedShort={selectedShort}
          shorts={shorts}
          projectId={id as string}
          projectTitle={project.title}
          organizationId={project.organizationId || ''}
          onClose={() => setSelectedShort(null)}
          onNavigate={(short) => setSelectedShort(short)}
          onShortUpdate={(updated) => {
            setShorts(prev => prev.map(s => s.id === updated.id ? updated : s))
            setSelectedShort(updated)
          }}
        />

        {/* Side Panel for viewing transcription */}
        <TranscriptionSidePanel
          transcription={transcription}
          isOpen={transcriptionPanelOpen}
          onClose={() => setTranscriptionPanelOpen(false)}
        />

        {/* Delete Short Confirmation Dialog */}
        <Dialog open={deleteShortDialogOpen} onOpenChange={setDeleteShortDialogOpen}>
          <DialogContent className="font-sans">
            <DialogHeader>
              <DialogTitle className="text-foreground">Delete Short</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                <span className="block mb-3">Are you sure you want to delete this short?</span>
                <div className="p-3 bg-muted rounded-md border border-border">
                  <p className="text-sm text-foreground line-clamp-3">{shortToDelete?.transcriptionSlice}</p>
                </div>
                <span className="block mt-3 font-semibold text-destructive">
                  This action cannot be undone.
                </span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteShortDialogOpen(false)}
                disabled={deletingShort}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteShort}
                disabled={deletingShort}
              >
                {deletingShort ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Short
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Project Confirmation Dialog */}
        <Dialog open={deleteProjectDialogOpen} onOpenChange={setDeleteProjectDialogOpen}>
          <DialogContent className="font-sans">
            <DialogHeader>
              <DialogTitle className="text-foreground">Delete Project</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                <span className="block mb-2">Are you sure you want to delete <span className="font-semibold text-foreground">&quot;{project?.title}&quot;</span>?</span>
                <span className="block mb-2">This will permanently delete:</span>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>The original video file</li>
                  <li>All generated shorts ({shorts.length})</li>
                  <li>Transcription data</li>
                  <li>All associated media assets</li>
                </ul>
                <span className="block mt-3 font-semibold text-destructive">
                  This action cannot be undone.
                </span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteProjectDialogOpen(false)}
                disabled={deletingProject}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteProject}
                disabled={deletingProject}
              >
                {deletingProject ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Project
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Schedule Dialog */}
        <BulkScheduleDialog
          open={bulkScheduleDialogOpen}
          onOpenChange={setBulkScheduleDialogOpen}
          shorts={shorts.filter((s) => (hasSelections ? selectedShortIds.has(s.id) : true) && s.status === 'completed' && s.outputObjectKey)}
          organizationId={project?.organizationId || ''}
          onSuccess={() => {
            clearSelection()
            loadProjectData()
          }}
        />
      </WorkspaceLayout>
    </>
  )
}
