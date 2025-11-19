import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import { useApi } from '@/lib/api/client'
import WorkspaceLayout from '@/components/layout/WorkspaceLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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

  const [project, setProject] = useState<Project | null>(null)
  const [shorts, setShorts] = useState<Short[]>([])
  const [transcription, setTranscription] = useState<Transcription | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [shortsCount, setShortsCount] = useState(3)
  const [customPrompt, setCustomPrompt] = useState('')
  const [currentTime, setCurrentTime] = useState(0)
  const [selectedShort, setSelectedShort] = useState<Short | null>(null)
  const [transcriptionExpanded, setTranscriptionExpanded] = useState(false) // Collapsed by default
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [downloadingShortId, setDownloadingShortId] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      loadProjectData()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadProjectData() {
    if (!id || typeof id !== 'string') return

    try {
      const data = await call<{
        project: Project
        transcription: Transcription | null
        shorts: Short[]
      }>(`/v1/projects/${id}`)

      setProject(data.project)
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

    try {
      await call(`/v1/projects/${id}/jobs`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'analysis',
          payload: {
            shortsCount,
            customPrompt: customPrompt.trim() || undefined,
          },
        }),
      })

      await loadProjectData()
    } catch (error) {
      console.error('Error analyzing:', error)
      alert(error instanceof Error ? error.message : 'Failed to generate shorts')
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
      const response = await fetch(`/api/v1/projects/${id}/download-shorts`, {
        headers: {
          'Content-Type': 'application/json',
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
        <title>{project.title} - VidEditor</title>
      </Head>

      <WorkspaceLayout title={project.title}>
        <div className="space-y-6">
          {/* Top Row: 2-Column Grid */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left Column: Video Player */}
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-foreground">{project.title}</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Duration: {project.durationSeconds ? formatDuration(project.durationSeconds) : '—'} • Status:{' '}
                      <Badge variant={project.status === 'completed' ? 'default' : 'secondary'}>{project.status}</Badge>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  {playbackUrl ? (
                    <ReactPlayer
                      url={playbackUrl}
                      controls
                      width="100%"
                      height="100%"
                      onProgress={({ playedSeconds }) => setCurrentTime(playedSeconds)}
                    />
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
                      max={10}
                      value={shortsCount}
                      onChange={(e) => setShortsCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                      disabled={analyzing}
                      className="bg-background border-input text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block text-foreground">
                      Custom Prompt (optional)
                    </label>
                    <textarea
                      placeholder="e.g., Focus on educational content and actionable tips..."
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      disabled={analyzing}
                      rows={4}
                      className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Leave empty to use the default prompt
                    </p>
                  </div>
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

            {/* No Transcription Placeholder */}
            {!transcription && (
              <Card className="bg-card border-border">
                <CardContent className="py-8 text-center">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-foreground mb-1">No transcription yet</p>
                  <p className="text-sm text-muted-foreground">
                    Upload this video to generate a transcription
                  </p>
                </CardContent>
              </Card>
            )}
            </div>
          </div>

          {/* Bottom Row: Shorts Grid (Full Width) */}
          {shorts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-foreground">
                  Generated Shorts ({shorts.filter((s) => s.status === 'completed').length}/{shorts.length})
                </h2>
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {shorts.map((short) => (
                  <Card
                    key={short.id}
                    className="bg-card border-border cursor-pointer hover:border-primary transition-all overflow-hidden group"
                    onClick={() => setSelectedShort(short)}
                  >
                    <div className="aspect-video bg-black relative overflow-hidden">
                      {short.thumbnailUrl ? (
                        <img
                          src={short.thumbnailUrl}
                          alt={short.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <Play className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-xs text-white flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(short.endTime - short.startTime)}
                      </div>
                    </div>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground line-clamp-3 mb-2">{short.description}</p>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={short.status === 'completed' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {short.status}
                        </Badge>
                        {short.status === 'completed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDownloadShort(short)
                            }}
                            disabled={downloadingShortId === short.id}
                            className="flex-1"
                          >
                            {downloadingShortId === short.id ? (
                              <>
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                Downloading...
                              </>
                            ) : (
                              <>
                                <Download className="w-3 h-3 mr-1" />
                                Download
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
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
      </WorkspaceLayout>
    </>
  )
}
