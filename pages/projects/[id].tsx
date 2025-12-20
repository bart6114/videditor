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
import { LongFormAssetCard } from '@/components/LongFormAssetCard'
import { UploadAssetModal } from '@/components/UploadAssetModal'
import { SelectedAssetPanel } from '@/components/SelectedAssetPanel'
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
  Upload,
  Video,
  Film,
  X,
} from 'lucide-react'
import type { MediaAsset } from '@/types/projects'
import type { Project, Short, Transcription } from '@server/db/schema'
import { SOCIAL_PLATFORMS, type SocialPlatform, type ShortTasks, type ShortFormMetadata } from '@shared/index'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useProjectData } from '@/hooks/useProjectData'
import { formatTimeAgoShort } from '@/lib/utils'
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

/** Extract ShortFormMetadata from a short's metadata field */
function getShortMeta(short: Short): ShortFormMetadata | null {
  return short.metadata as ShortFormMetadata | null
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
  // QUEUED (uploading or ready for processing)
  if (short.status === 'uploading' || short.status === 'ready') {
    return (
      <Badge variant="secondary" className="text-xs">
        <Clock className="w-3 h-3 mr-1" />
        {short.status === 'uploading' ? 'Uploading' : 'Queued'}
      </Badge>
    )
  }

  // PROCESSING - show granular task status
  if (short.status === 'processing') {
    let label = 'Processing'

    if (short.tasks) {
      if (short.tasks.clip_extraction === 'processing') {
        label = 'Extracting clip...'
      } else if (short.tasks.thumbnail_extraction === 'processing') {
        label = 'Generating thumbnail...'
      } else if (short.tasks.social_content === 'processing') {
        label = 'Generating social content...'
      }
    }

    return (
      <Badge variant="secondary" className="text-xs">
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        {label}
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
    const publishingPosts = scheduledPosts.filter(p => p.status === 'publishing')
    const scheduledPostsList = scheduledPosts.filter(p => p.status === 'scheduled')
    const publishedPosts = scheduledPosts.filter(p => p.status === 'published')
    const failedPosts = scheduledPosts.filter(p => p.status === 'failed')

    // Helper to render platform icons
    const renderPlatformIcons = (posts: ScheduledPost[]) => (
      <span className="inline-flex items-center gap-0.5 ml-1">
        {posts.map(p => {
          const Icon = PLATFORM_ICONS[p.platform as SocialPlatform]
          return Icon ? <Icon key={p.id} size={12} /> : null
        })}
      </span>
    )

    if (publishingPosts.length > 0) {
      return (
        <Badge variant="secondary" className="text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Publishing...
          {renderPlatformIcons(publishingPosts)}
        </Badge>
      )
    }

    if (scheduledPostsList.length > 0) {
      const earliestDate = scheduledPostsList.reduce((min, p) =>
        p.scheduledFor < min ? p.scheduledFor : min,
        scheduledPostsList[0].scheduledFor
      )
      return (
        <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
          <Clock className="w-3 h-3 mr-1" />
          Scheduled {earliestDate.toLocaleDateString([], { day: 'numeric', month: 'short' })}
          {renderPlatformIcons(scheduledPostsList)}
        </Badge>
      )
    }

    if (publishedPosts.length > 0) {
      return (
        <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
          Published
          <span className="inline-flex items-center gap-0.5 ml-1">
            {publishedPosts.map(p => {
              const Icon = PLATFORM_ICONS[p.platform as SocialPlatform]
              if (!Icon) return null
              if (p.platformUrl) {
                return (
                  <a
                    key={p.id}
                    href={p.platformUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="hover:opacity-70"
                  >
                    <Icon size={12} />
                  </a>
                )
              }
              return <Icon key={p.id} size={12} />
            })}
          </span>
        </Badge>
      )
    }

    if (failedPosts.length > 0) {
      return (
        <Badge variant="secondary" className="text-xs bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" title={failedPosts[0].errorMessage || 'Publishing failed'}>
          <AlertCircle className="w-3 h-3 mr-1" />
          Failed
          {renderPlatformIcons(failedPosts)}
        </Badge>
      )
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
  const { id, shortId } = router.query
  const { call } = useApi()
  const { getToken } = useAuth()
  const { shouldShowTour, startTour } = useOnboarding()
  const userSettings = useUserSettings()
  const projectData = useProjectData(id as string | undefined)

  // Destructure commonly used values from projectData
  const { project, shorts, transcription, transcriptions, longFormAssets, loading, activeJob, transcriptionJob, scheduledPostsByShort, lastAnalysisJobId } = projectData

  // Local UI state (not managed by hook)
  const [analyzing, setAnalyzing] = useState(false)
  const [shortsCount, setShortsCount] = useState(3)
  const [preferredLength, setPreferredLength] = useState(45)
  const [maxLength, setMaxLength] = useState(60)
  const [customPrompt, setCustomPrompt] = useState('')
  const [customSocialPrompt, setCustomSocialPrompt] = useState('')
  const [avoidExistingOverlap, setAvoidExistingOverlap] = useState(false)
  const [socialPlatforms, setSocialPlatforms] = useState<SocialPlatform[]>([])
  const [settingsApplied, setSettingsApplied] = useState(false) // Track if defaults have been applied to form
  const [showAnalysisPrompt, setShowAnalysisPrompt] = useState(false)
  const [showSocialPrompt, setShowSocialPrompt] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [selectedShort, setSelectedShort] = useState<Short | null>(null)
  const [transcriptionPanelOpen, setTranscriptionPanelOpen] = useState(false)
  // Consolidated download state
  type DownloadState =
    | { type: 'idle' }
    | { type: 'all' }
    | { type: 'metadata' }
    | { type: 'short'; shortId: string }
  const [downloadState, setDownloadState] = useState<DownloadState>({ type: 'idle' })
  const [videoPlayerLoaded, setVideoPlayerLoaded] = useState(false)
  // Consolidated dialog state
  type DialogState =
    | { type: 'none' }
    | { type: 'deleteShort'; short: Short; deleting: boolean }
    | { type: 'deleteAsset'; asset: MediaAsset; deleting: boolean }
    | { type: 'deleteProject'; deleting: boolean }
    | { type: 'bulkSchedule' }
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' })
  const [bulkDeleting, setBulkDeleting] = useState(false) // For bulk delete via window.confirm
  const [showInsufficientCredits, setShowInsufficientCredits] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [playingAsset, setPlayingAsset] = useState<MediaAsset | null>(null)

  // Derived state: the currently selected long-form asset
  const selectedAsset = longFormAssets.find(a => a.id === selectedAssetId) || null

  // Get the transcription for the selected asset (by mediaAssetId match)
  const selectedAssetTranscription = selectedAssetId
    ? transcriptions.find(t => t.mediaAssetId === selectedAssetId) || null
    : null

  // Local UI state for retry button feedback
  const [retryingTranscription, setRetryingTranscription] = useState(false)

  // Multi-select state for shorts
  const [selectedShortIds, setSelectedShortIds] = useState<Set<string>>(new Set())

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

  // Note: Initial load and polling are handled by useProjectData hook

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

  // Auto-select short from URL query parameter (e.g., from calendar navigation)
  useEffect(() => {
    if (!id || typeof id !== 'string') return
    if (shortId && typeof shortId === 'string' && shorts.length > 0) {
      const short = shorts.find(s => s.id === shortId)
      if (short && !selectedShort) {
        setSelectedShort(short)
        // Clear the query param to avoid re-selecting on refresh
        router.replace(`/projects/${id}`, undefined, { shallow: true })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, shortId, shorts])

  // Apply user's default settings to form inputs when loaded
  useEffect(() => {
    if (settingsApplied || !userSettings.settings) return

    const settings = userSettings.settings
    if (settings.defaultCustomPrompt) {
      setCustomPrompt(settings.defaultCustomPrompt)
      setShowAnalysisPrompt(true)
    }
    if (settings.defaultSocialPrompt) {
      setCustomSocialPrompt(settings.defaultSocialPrompt)
      setShowSocialPrompt(true)
    }
    if (settings.defaultSocialPlatforms?.length > 0) {
      setSocialPlatforms(settings.defaultSocialPlatforms)
    }
    if (settings.defaultAvoidOverlap !== undefined) {
      setAvoidExistingOverlap(settings.defaultAvoidOverlap)
    }
    if (settings.defaultPreferredLength) {
      setPreferredLength(settings.defaultPreferredLength)
    }
    if (settings.defaultMaxLength) {
      setMaxLength(settings.defaultMaxLength)
    }
    setSettingsApplied(true)
  }, [userSettings.settings, settingsApplied])

  async function handleAnalyze() {
    // Check credits before proceeding
    if (userSettings.credits !== null && userSettings.credits < shortsCount) {
      setShowInsufficientCredits(true)
      return
    }
    setShowInsufficientCredits(false)

    setAnalyzing(true)
    projectData.setIsGeneratingShorts(true)

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
      projectData.setActiveJob({ id: jobData.job.id, status: jobData.job.status })
      projectData.setLastAnalysisJobId(jobData.job.id)

      // Refresh credits after successful job creation
      userSettings.refreshCredits()
    } catch (error) {
      console.error('Error analyzing:', error)

      // Refresh credits to show current balance
      userSettings.refreshCredits()

      alert(error instanceof Error ? error.message : 'Failed to generate shorts')
      projectData.setIsGeneratingShorts(false)
      projectData.setActiveJob(null)
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleRetryTranscriptionForAsset(asset: MediaAsset) {
    setRetryingTranscription(true)

    try {
      await call(`/v1/projects/${id}/jobs`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'transcription',
          payload: {
            sourceObjectKey: asset.sourceObjectKey,
            sourceBucket: asset.sourceBucket,
            mediaAssetId: asset.id, // Link transcription to this asset
          },
        }),
      })

      // Reload project data to get fresh state (new job will be queued)
      await projectData.refresh()
    } catch (error) {
      console.error('Error retrying transcription:', error)
      alert(error instanceof Error ? error.message : 'Failed to retry transcription')
    } finally {
      setRetryingTranscription(false)
    }
  }

  async function handleDownloadShort(short: Short) {
    setDownloadState({ type: 'short', shortId: short.id })
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
      setDownloadState({ type: 'idle' })
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

    setDownloadState({ type: 'all' })
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
    } catch (error) {
      console.error('Error downloading shorts:', error)
      alert(error instanceof Error ? error.message : 'Failed to download shorts')
    } finally {
      setDownloadState({ type: 'idle' })
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

    setDownloadState({ type: 'metadata' })
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
    } catch (error) {
      console.error('Error downloading metadata:', error)
      alert(error instanceof Error ? error.message : 'Failed to download metadata')
    } finally {
      setDownloadState({ type: 'idle' })
    }
  }

  function seekToTime(time: number) {
    setCurrentTime(time)
  }

  async function handleDeleteShort() {
    if (dialog.type !== 'deleteShort') return

    setDialog({ ...dialog, deleting: true })
    try {
      await call(`/v1/projects/${id}/shorts/${dialog.short.id}`, {
        method: 'DELETE',
      })

      // Close dialog and refresh project data
      setDialog({ type: 'none' })
      await projectData.refresh()
    } catch (error) {
      console.error('Error deleting short:', error)
      setDialog({ ...dialog, deleting: false })
    }
  }

  function openDeleteShortDialog(short: Short, e: React.MouseEvent) {
    e.stopPropagation() // Prevent card click
    setDialog({ type: 'deleteShort', short, deleting: false })
  }

  async function handleDeleteAsset() {
    if (dialog.type !== 'deleteAsset') return

    setDialog({ ...dialog, deleting: true })
    try {
      await call(`/v1/projects/${id}/assets/${dialog.asset.id}`, {
        method: 'DELETE',
      })

      // Close dialog, clear selection, and refresh project data
      setDialog({ type: 'none' })
      if (selectedAssetId === dialog.asset.id) {
        setSelectedAssetId(null)
      }
      await projectData.refresh()
    } catch (error) {
      console.error('Error deleting asset:', error)
      setDialog({ ...dialog, deleting: false })
    }
  }

  function openDeleteAssetDialog(asset: MediaAsset) {
    setDialog({ type: 'deleteAsset', asset, deleting: false })
  }

  async function handleDeleteSelected() {
    if (selectedShortIds.size === 0) return

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedShortIds.size} selected short${selectedShortIds.size > 1 ? 's' : ''}? This action cannot be undone.`
    )

    if (!confirmed) return

    setBulkDeleting(true)
    try {
      await call(`/v1/projects/${id}/shorts/bulk-delete`, {
        method: 'DELETE',
        body: JSON.stringify({ shortIds: Array.from(selectedShortIds) }),
      })

      // Clear selection and refresh project data
      clearSelection()
      await projectData.refresh()
    } catch (error) {
      console.error('Error deleting shorts:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete shorts')
    } finally {
      setBulkDeleting(false)
    }
  }

  // Save project title (used by WorkspaceLayout inline editing)
  async function handleTitleSave(newTitle: string): Promise<void> {
    if (!project) return

    await call(`/v1/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: newTitle }),
    })

    await projectData.refresh()
  }

  async function handleDeleteProject() {
    if (dialog.type !== 'deleteProject') return

    setDialog({ ...dialog, deleting: true })
    try {
      await call(`/v1/projects/${id}`, {
        method: 'DELETE',
      })
      router.push('/projects')
    } catch (error) {
      console.error('Error deleting project:', error)
      setDialog({ ...dialog, deleting: false })
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
  const isProcessingShorts = shorts.some(s => s.status === 'uploading' || s.status === 'ready' || s.status === 'processing')

  return (
    <>
      <Head>
        <title>{project.title} - VidEditor.ai</title>
        <meta name="description" content={`Edit and create shorts from "${project.title}" using AI`} />

        {/* Open Graph - Dynamic project image */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={`${project.title} - VidEditor.ai`} />
        <meta property="og:description" content={`Edit and create shorts from "${project.title}" using AI`} />
        <meta property="og:image" content={`${process.env.NEXT_PUBLIC_APP_URL || 'https://videditor.ai'}/api/og/project?title=${encodeURIComponent(project.title)}&shorts=${shorts.length}&duration=${longFormAssets[0]?.durationSeconds ? formatDuration(longFormAssets[0].durationSeconds) : '0:00'}`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="VidEditor.ai" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${project.title} - VidEditor.ai`} />
        <meta name="twitter:description" content={`Edit and create shorts from "${project.title}" using AI`} />
        <meta name="twitter:image" content={`${process.env.NEXT_PUBLIC_APP_URL || 'https://videditor.ai'}/api/og/project?title=${encodeURIComponent(project.title)}&shorts=${shorts.length}&duration=${longFormAssets[0]?.durationSeconds ? formatDuration(longFormAssets[0].durationSeconds) : '0:00'}`} />
      </Head>

      <WorkspaceLayout title={project.title} onTitleSave={handleTitleSave}>
        <div className="space-y-6">
          {/* Header with Upload Button */}
          <div className="flex items-center justify-end">
            <Button onClick={() => setUploadModalOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Upload Asset
            </Button>
          </div>

          {/* Long-Form Assets Section */}
          {longFormAssets.length > 0 && (
            <>
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Video className="w-5 h-5 text-primary" />
                  Long-form Videos ({longFormAssets.length})
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {longFormAssets.map((asset) => (
                    <LongFormAssetCard
                      key={asset.id}
                      asset={asset}
                      isSelected={selectedAssetId === asset.id}
                      onSelect={() => setSelectedAssetId(selectedAssetId === asset.id ? null : asset.id)}
                      onPlayVideo={() => setPlayingAsset(asset)}
                      onDelete={() => openDeleteAssetDialog(asset)}
                    />
                  ))}
                </div>
              </div>

              {/* Selected Asset Panel - shows when an asset is selected */}
              {selectedAsset && (
                <SelectedAssetPanel
                  asset={selectedAsset}
                  projectId={id as string}
                  onClose={() => setSelectedAssetId(null)}
                  transcription={selectedAssetTranscription}
                  transcriptionJob={transcriptionJob}
                  isRetryingTranscription={retryingTranscription}
                  onOpenTranscriptionPanel={() => setTranscriptionPanelOpen(true)}
                  onRetryTranscription={() => selectedAsset && handleRetryTranscriptionForAsset(selectedAsset)}
                  existingShorts={shorts}
                  isGenerating={analyzing}
                  hasActiveJob={!!activeJob}
                  activeJob={activeJob}
                  lastAnalysisJobId={lastAnalysisJobId}
                  isProcessingShorts={isProcessingShorts}
                  userCredits={userSettings.credits}
                  userSettings={userSettings.settings}
                  onGenerateStart={() => {
                    setAnalyzing(true)
                    projectData.setIsGeneratingShorts(true)
                  }}
                  onGenerateComplete={(jobId) => {
                    setAnalyzing(false)
                    projectData.setActiveJob({ id: jobId, status: 'running' })
                    projectData.setLastAnalysisJobId(jobId)
                  }}
                  onGenerateError={(error) => {
                    setAnalyzing(false)
                    projectData.setIsGeneratingShorts(false)
                    projectData.setActiveJob(null)
                    alert(error.message || 'Failed to generate shorts')
                  }}
                  refreshCredits={userSettings.refreshCredits}
                  onShortCreated={() => projectData.refresh()}
                />
              )}
            </>
          )}

          {/* Empty State for No Assets */}
          {longFormAssets.length === 0 && shorts.length === 0 && !loading && (
            <Card className="bg-card border-border border-dashed">
              <CardContent className="py-16 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <Video className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No content yet</h3>
                <p className="text-muted-foreground max-w-sm mx-auto mb-4">
                  Upload a video to get started. You can upload long-form videos to generate shorts, or upload existing short-form clips.
                </p>
                <Button onClick={() => setUploadModalOpen(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Your First Video
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Bottom Row: Shorts Table (Full Width) */}
          {shorts.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Film className="w-5 h-5 text-primary" />
                Short-form Videos ({shorts.length})
              </h2>
              <Card className="bg-card border-border" data-tour="shorts-table">
                <CardHeader className="py-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
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
                        disabled={bulkDeleting}
                        variant="destructive"
                        title="Delete Selected Shorts"
                        className="min-h-[44px] sm:min-h-0"
                      >
                        {bulkDeleting ? (
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
                      onClick={() => setDialog({ type: 'bulkSchedule' })}
                      variant="outline"
                      disabled={hasSelections ? selectedShortIds.size === 0 : shorts.filter((s) => s.status === 'completed' && s.sourceObjectKey).length === 0}
                      title={hasSelections ? "Schedule Selected Shorts" : "Schedule All Shorts"}
                      className="min-h-[44px] sm:min-h-0"
                      data-tour="schedule-button"
                    >
                      <Calendar className="w-4 h-4 sm:mr-2" />
                      <span className="hidden sm:inline">
                        {hasSelections
                          ? `Schedule (${selectedShortIds.size})`
                          : `Schedule All (${shorts.filter((s) => s.status === 'completed' && s.sourceObjectKey).length})`
                        }
                      </span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleDownloadMetadata}
                      disabled={downloadState.type === 'metadata' || (hasSelections ? selectedShortIds.size === 0 : shorts.filter((s) => s.status === 'completed').length === 0)}
                      variant="outline"
                      title={hasSelections ? "Download Selected Metadata" : "Download All Metadata"}
                      className="min-h-[44px] sm:min-h-0"
                    >
                      {downloadState.type === 'metadata' ? (
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
                      disabled={downloadState.type === 'all' || (hasSelections ? selectedShortIds.size === 0 : shorts.some((s) => s.status !== 'completed'))}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial"
                    >
                      {downloadState.type === 'all' ? (
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
                        <th className="pb-3 pr-4 text-sm font-medium text-muted-foreground hidden lg:table-cell">Created</th>
                        <th className="pb-3 text-sm font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shorts.map((short) => (
                        <tr
                          key={short.id}
                          className={`border-b border-border last:border-0 hover:bg-secondary/50 cursor-pointer transition-colors duration-200 group ${
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
                                  sizes="80px"
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
                              {getShortMeta(short)?.transcriptionSlice || short.title}
                            </span>
                          </td>
                          {/* Duration - hidden on mobile */}
                          <td className="py-3 pr-4 hidden md:table-cell">
                            <div className="flex items-center gap-1 text-sm text-foreground">
                              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                              {formatDuration(
                                getShortMeta(short)?.totalDuration
                                ?? ((getShortMeta(short)?.endTime ?? 0) - (getShortMeta(short)?.startTime ?? 0))
                              )}
                            </div>
                          </td>
                          {/* Timestamps - hidden on tablet and below */}
                          <td className="py-3 pr-4 hidden lg:table-cell">
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                              {formatDuration(getShortMeta(short)?.startTime ?? 0)} - {formatDuration(getShortMeta(short)?.endTime ?? 0)}
                            </span>
                          </td>
                          {/* Status */}
                          <td className="py-3 pr-4">
                            {renderShortStatusBadge(
                              short as Short & { tasks?: ShortTasks },
                              scheduledPostsByShort[short.id]
                            )}
                          </td>
                          {/* Created */}
                          <td className="py-3 pr-4 hidden lg:table-cell">
                            <span className="text-sm text-muted-foreground">
                              {formatTimeAgoShort(short.createdAt)}
                            </span>
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
                                  disabled={downloadState.type === 'short' && downloadState.shortId === short.id}
                                  className="min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 p-2 md:px-3"
                                >
                                  {downloadState.type === 'short' && downloadState.shortId === short.id ? (
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
            </div>
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
            projectData.updateShorts(shorts.map(s => s.id === updated.id ? updated : s))
            setSelectedShort(updated)
          }}
        />

        {/* Side Panel for viewing transcription */}
        <TranscriptionSidePanel
          transcription={selectedAssetTranscription}
          isOpen={transcriptionPanelOpen}
          onClose={() => setTranscriptionPanelOpen(false)}
        />

        {/* Delete Short Confirmation Dialog */}
        <Dialog open={dialog.type === 'deleteShort'} onOpenChange={(open) => !open && setDialog({ type: 'none' })}>
          <DialogContent className="font-sans">
            <DialogHeader>
              <DialogTitle className="text-foreground">Delete Short</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                <span className="block mb-3">Are you sure you want to delete this short?</span>
                <div className="p-3 bg-muted rounded-md border border-border">
                  <p className="text-sm text-foreground line-clamp-3">{dialog.type === 'deleteShort' ? (getShortMeta(dialog.short)?.transcriptionSlice || dialog.short.title) : ''}</p>
                </div>
                <span className="block mt-3 font-semibold text-destructive">
                  This action cannot be undone.
                </span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialog({ type: 'none' })}
                disabled={dialog.type === 'deleteShort' && dialog.deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteShort}
                disabled={dialog.type === 'deleteShort' && dialog.deleting}
              >
                {dialog.type === 'deleteShort' && dialog.deleting ? (
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

        {/* Delete Asset Confirmation Dialog */}
        <Dialog open={dialog.type === 'deleteAsset'} onOpenChange={(open) => !open && setDialog({ type: 'none' })}>
          <DialogContent className="font-sans">
            <DialogHeader>
              <DialogTitle className="text-foreground">Delete Video</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                <span className="block mb-3">Are you sure you want to delete this video?</span>
                <div className="p-3 bg-muted rounded-md border border-border">
                  <p className="text-sm text-foreground line-clamp-3">{dialog.type === 'deleteAsset' ? dialog.asset.title : ''}</p>
                </div>
                <span className="block mt-3 font-semibold text-destructive">
                  This will also delete all associated transcriptions and shorts. This action cannot be undone.
                </span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialog({ type: 'none' })}
                disabled={dialog.type === 'deleteAsset' && dialog.deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAsset}
                disabled={dialog.type === 'deleteAsset' && dialog.deleting}
              >
                {dialog.type === 'deleteAsset' && dialog.deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Video
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Project Confirmation Dialog */}
        <Dialog open={dialog.type === 'deleteProject'} onOpenChange={(open) => !open && setDialog({ type: 'none' })}>
          <DialogContent className="font-sans">
            <DialogHeader>
              <DialogTitle className="text-foreground">Delete Project</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                <span className="block mb-2">Are you sure you want to delete <span className="font-semibold text-foreground">&quot;{project?.title}&quot;</span>?</span>
                <span className="block mb-2">This will permanently delete:</span>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Long-form videos ({longFormAssets.length})</li>
                  <li>Generated shorts ({shorts.length})</li>
                  <li>Transcription data</li>
                </ul>
                <span className="block mt-3 font-semibold text-destructive">
                  This action cannot be undone.
                </span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialog({ type: 'none' })}
                disabled={dialog.type === 'deleteProject' && dialog.deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteProject}
                disabled={dialog.type === 'deleteProject' && dialog.deleting}
              >
                {dialog.type === 'deleteProject' && dialog.deleting ? (
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
          open={dialog.type === 'bulkSchedule'}
          onOpenChange={(open) => !open && setDialog({ type: 'none' })}
          shorts={shorts.filter((s) => (hasSelections ? selectedShortIds.has(s.id) : true) && s.status === 'completed' && s.sourceObjectKey)}
          organizationId={project?.organizationId || ''}
          onSuccess={() => {
            clearSelection()
            projectData.refresh()
          }}
          defaultSchedulingPrompt={userSettings.settings?.defaultSchedulingPrompt || null}
        />

        {/* Upload Asset Modal */}
        <UploadAssetModal
          open={uploadModalOpen}
          onOpenChange={setUploadModalOpen}
          projectId={id as string}
          onUploadComplete={() => projectData.refresh()}
        />

        {/* Video Lightbox for Long-Form Assets */}
        <Dialog open={!!playingAsset} onOpenChange={(open) => !open && setPlayingAsset(null)}>
          <DialogContent className="font-sans max-w-4xl p-0 overflow-hidden">
            <div className="relative">
              {/* Close button */}
              <button
                onClick={() => setPlayingAsset(null)}
                className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              {/* Video player */}
              <div className="aspect-video bg-black">
                {playingAsset?.videoUrl ? (
                  <ReactPlayer
                    url={playingAsset.videoUrl}
                    controls
                    width="100%"
                    height="100%"
                    playing={true}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                )}
              </div>
              {/* Title bar */}
              <div className="p-4 bg-card border-t border-border">
                <h3 className="font-medium text-foreground">{playingAsset?.title}</h3>
                {playingAsset?.durationSeconds && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Duration: {formatDuration(playingAsset.durationSeconds)}
                  </p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </WorkspaceLayout>
    </>
  )
}
