import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import { useAuth } from '@clerk/nextjs'
import { useApi } from '@/lib/api/client'
import WorkspaceLayout from '@/components/layout/WorkspaceLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { VideoLightbox } from '@/components/video-lightbox'
import {
  Sparkles,
  Download,
  Play,
  Clock,
  Loader2,
  FileText,
  ChevronDown,
  ChevronUp,
  Trash2,
  Pencil,
} from 'lucide-react'
import type { Project, Short, Transcription } from '@server/db/schema'

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

export default function ProjectDetail() {
  const router = useRouter()
  const { id } = router.query
  const { call } = useApi()
  const { getToken } = useAuth()

  const [project, setProject] = useState<Project | null>(null)
  const [shorts, setShorts] = useState<Short[]>([])
  const [transcription, setTranscription] = useState<Transcription | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [isGeneratingShorts, setIsGeneratingShorts] = useState(false)
  const [shortsCountBeforeGenerate, setShortsCountBeforeGenerate] = useState<number | null>(null)
  const [shortsCount, setShortsCount] = useState(3)
  const [preferredLength, setPreferredLength] = useState(45)
  const [maxLength, setMaxLength] = useState(60)
  const [customPrompt, setCustomPrompt] = useState('')
  const [avoidExistingOverlap, setAvoidExistingOverlap] = useState(false)
  const [defaultPromptLoaded, setDefaultPromptLoaded] = useState(false)
  const [usingDefaultPrompt, setUsingDefaultPrompt] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [selectedShort, setSelectedShort] = useState<Short | null>(null)
  const [transcriptionExpanded, setTranscriptionExpanded] = useState(false) // Collapsed by default
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [downloadingShortId, setDownloadingShortId] = useState<string | null>(null)
  const [videoPlayerLoaded, setVideoPlayerLoaded] = useState(false)
  const [deleteShortDialogOpen, setDeleteShortDialogOpen] = useState(false)
  const [shortToDelete, setShortToDelete] = useState<Short | null>(null)
  const [deletingShort, setDeletingShort] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [savingTitle, setSavingTitle] = useState(false)

  // Initial load
  useEffect(() => {
    if (id) {
      loadProjectData()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Poll for updates while generating shorts
  useEffect(() => {
    if (!isGeneratingShorts || !id) return

    const interval = setInterval(() => {
      loadProjectData()
    }, 3000)

    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGeneratingShorts, id])

  // Detect when new shorts arrive to hide progress indicator
  useEffect(() => {
    if (shortsCountBeforeGenerate !== null && shorts.length > shortsCountBeforeGenerate) {
      setIsGeneratingShorts(false)
      setShortsCountBeforeGenerate(null)
    }
  }, [shorts.length, shortsCountBeforeGenerate])

  // Load user's default custom prompt
  useEffect(() => {
    if (defaultPromptLoaded) return

    async function loadDefaultPrompt() {
      try {
        const data = await call<{ settings: { defaultCustomPrompt: string | null } }>('/v1/user/settings')
        if (data.settings.defaultCustomPrompt) {
          setCustomPrompt(data.settings.defaultCustomPrompt)
          setUsingDefaultPrompt(true)
        }
      } catch (error) {
        // Silently ignore - user just won't have a default prefilled
      } finally {
        setDefaultPromptLoaded(true)
      }
    }
    loadDefaultPrompt()
  }, [call, defaultPromptLoaded])

  async function loadProjectData() {
    if (!id || typeof id !== 'string') return

    try {
      const data = await call<{
        project: Project
        transcription: Transcription | null
        shorts: Short[]
      }>(`/v1/projects/${id}`)

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
    } catch (error) {
      console.error('Error loading project:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAnalyze() {
    setAnalyzing(true)
    setShortsCountBeforeGenerate(shorts.length)
    setIsGeneratingShorts(true)

    try {
      await call(`/v1/projects/${id}/jobs`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'analysis',
          payload: {
            shortsCount,
            preferredLength,
            maxLength,
            customPrompt: customPrompt.trim() || undefined,
            avoidExistingOverlap: avoidExistingOverlap || undefined,
          },
        }),
      })
    } catch (error) {
      console.error('Error analyzing:', error)
      alert(error instanceof Error ? error.message : 'Failed to generate shorts')
      setIsGeneratingShorts(false)
      setShortsCountBeforeGenerate(null)
    } finally {
      setAnalyzing(false)
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
      a.download = `${project?.title || 'Project'} - ${data.filename}.mp4`
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

    // Check if all shorts are completed
    const incompleteShorts = shorts.filter(
      (short) => short.status !== 'completed'
    )

    if (incompleteShorts.length > 0) {
      const completedCount = shorts.length - incompleteShorts.length
      alert(
        `Cannot download: ${incompleteShorts.length} short(s) are still processing. ${completedCount} of ${shorts.length} shorts are ready.`
      )
      return
    }

    setDownloadingAll(true)
    try {
      const token = await getToken()
      const response = await fetch(`/api/v1/projects/${id}/download-shorts`, {
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
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project?.title || 'Project'} - Shorts.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading shorts:', error)
      alert(error instanceof Error ? error.message : 'Failed to download shorts')
    } finally {
      setDownloadingAll(false)
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
      </Head>

      <WorkspaceLayout title={project.title}>
        <div className="space-y-6">
          {/* Top Row: 2-Column Grid */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left Column: Video Player */}
            <Card className="bg-card border-border">
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
                        >
                          <Pencil className="w-4 h-4" />
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
              <CardContent>
                <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                  {playbackUrl ? (
                    <>
                      {!videoPlayerLoaded ? (
                        <div
                          className="w-full h-full cursor-pointer group relative"
                          onClick={() => setVideoPlayerLoaded(true)}
                        >
                          {project.thumbnailUrl ? (
                            <img
                              src={project.thumbnailUrl}
                              alt={project.title}
                              className="w-full h-full object-cover"
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
                        <ReactPlayer
                          url={playbackUrl}
                          controls
                          width="100%"
                          height="100%"
                          playing={true}
                          onProgress={({ playedSeconds }) => setCurrentTime(playedSeconds)}
                        />
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
            {/* Transcription Section */}
            {transcription && (
              <Card className="bg-card border-border">
                <CardHeader
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setTranscriptionExpanded(!transcriptionExpanded)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      <CardTitle className="text-foreground">Transcription</CardTitle>
                      <Badge>Ready</Badge>
                    </div>
                    {transcriptionExpanded ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
                {transcriptionExpanded && (
                  <CardContent className="pt-0">
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                      {transcription.text}
                    </p>
                  </CardContent>
                )}
              </Card>
            )}

            {/* Shorts Generation Section */}
            {transcription && (
              <Card className="bg-card border-border">
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
                      value={shortsCount}
                      onChange={(e) => setShortsCount(Math.min(15, Math.max(1, parseInt(e.target.value) || 1)))}
                      disabled={analyzing}
                      className="bg-background border-input text-foreground"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
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
                          const value = Math.min(120, Math.max(15, parseInt(e.target.value) || 45))
                          setPreferredLength(value)
                          // Ensure max is at least as large as preferred
                          if (maxLength < value) setMaxLength(value)
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
                          const value = Math.min(120, Math.max(15, parseInt(e.target.value) || 60))
                          setMaxLength(value)
                          // Ensure preferred doesn't exceed max
                          if (preferredLength > value) setPreferredLength(value)
                        }}
                        disabled={analyzing}
                        className="bg-background border-input text-foreground"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Maximum allowed length
                      </p>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-sm font-medium text-foreground">
                        Custom Prompt (optional)
                      </label>
                      {usingDefaultPrompt && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          using default
                        </span>
                      )}
                    </div>
                    <textarea
                      placeholder="e.g., Focus on educational content and actionable tips..."
                      value={customPrompt}
                      onChange={(e) => {
                        setCustomPrompt(e.target.value)
                        setUsingDefaultPrompt(false)
                      }}
                      disabled={analyzing}
                      rows={4}
                      className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {usingDefaultPrompt
                        ? 'Edit above to override your default, or configure in Settings'
                        : 'Leave empty to use AI defaults, or set your own default in Settings'}
                    </p>
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
                  <Button
                    onClick={handleAnalyze}
                    disabled={analyzing || !transcription}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating {shortsCount} shorts...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate {shortsCount} Shorts with AI
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Generation Progress Indicator */}
            {(analyzing || isGeneratingShorts) && (
              <Card className="bg-primary/5 border-primary/30 shadow-glow">
                <CardContent className="py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground mb-1">
                        Generating shorts...
                      </p>
                      <p className="text-sm text-muted-foreground">
                        AI is analyzing your video to find the best moments
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* No Transcription Placeholder */}
            {!transcription && (
              <Card className="bg-card border-border border-dashed">
                <CardContent className="py-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
                    <FileText className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">No transcription yet</h3>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    The transcription is being processed. It will appear here when ready.
                  </p>
                </CardContent>
              </Card>
            )}
            </div>
          </div>

          {/* Bottom Row: Shorts Table (Full Width) */}
          {shorts.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground">
                    Generated Shorts ({shorts.filter((s) => s.status === 'completed').length}/{shorts.length})
                  </CardTitle>
                  <Button
                    size="sm"
                    onClick={handleDownloadAll}
                    disabled={downloadingAll || shorts.some((s) => s.status !== 'completed')}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {downloadingAll ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Download All ({shorts.filter((s) => s.status === 'completed').length})
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="pb-3 pr-4 text-sm font-medium text-muted-foreground">Thumbnail</th>
                        <th className="pb-3 pr-4 text-sm font-medium text-muted-foreground">Transcript</th>
                        <th className="pb-3 pr-4 text-sm font-medium text-muted-foreground">Duration</th>
                        <th className="pb-3 pr-4 text-sm font-medium text-muted-foreground hidden sm:table-cell">Timestamps</th>
                        <th className="pb-3 pr-4 text-sm font-medium text-muted-foreground">Status</th>
                        <th className="pb-3 text-sm font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shorts.map((short) => (
                        <tr
                          key={short.id}
                          className="border-b border-border last:border-0 hover:bg-secondary/50 cursor-pointer transition-all duration-200 group"
                          onClick={() => setSelectedShort(short)}
                        >
                          {/* Thumbnail */}
                          <td className="py-3 pr-4">
                            <div className="w-20 aspect-[9/16] bg-black rounded overflow-hidden relative flex-shrink-0">
                              {short.thumbnailUrl ? (
                                <img
                                  src={short.thumbnailUrl}
                                  alt="Short thumbnail"
                                  className="w-full h-full object-cover"
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
                          {/* Duration */}
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-1 text-sm text-foreground">
                              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                              {formatDuration(short.endTime - short.startTime)}
                            </div>
                          </td>
                          {/* Timestamps */}
                          <td className="py-3 pr-4 hidden sm:table-cell">
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                              {formatDuration(short.startTime)} - {formatDuration(short.endTime)}
                            </span>
                          </td>
                          {/* Status */}
                          <td className="py-3 pr-4">
                            <Badge
                              variant={
                                short.status === 'completed' ? 'default' :
                                short.status === 'error' ? 'destructive' : 'secondary'
                              }
                              className="text-xs"
                            >
                              {short.status}
                            </Badge>
                          </td>
                          {/* Actions */}
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              {short.status === 'completed' && (
                                <Button
                                  size="default"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDownloadShort(short)
                                  }}
                                  disabled={downloadingShortId === short.id}
                                >
                                  {downloadingShortId === short.id ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      Downloading
                                    </>
                                  ) : (
                                    <>
                                      <Download className="w-4 h-4 mr-2" />
                                      Download
                                    </>
                                  )}
                                </Button>
                              )}
                              <Button
                                size="default"
                                variant="ghost"
                                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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

        {/* Video Lightbox for playing shorts */}
        <VideoLightbox
          selectedShort={selectedShort}
          shorts={shorts}
          projectId={id as string}
          onClose={() => setSelectedShort(null)}
          onNavigate={(short) => setSelectedShort(short)}
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
      </WorkspaceLayout>
    </>
  )
}
