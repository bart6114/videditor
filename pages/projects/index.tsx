import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useUser } from '@clerk/nextjs'
import { useApi } from '@/lib/api/client'
import { VideoUpload } from '@/components/video-upload'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import WorkspaceLayout from '@/components/layout/WorkspaceLayout'
import { Video, Clock, Loader2, CheckCircle, AlertCircle, FileText, Film } from 'lucide-react'
import { formatFileSize } from '@/lib/utils'
import type { ProjectSummary } from '@/types/projects'

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

export default function Projects() {
  const router = useRouter()
  const { isSignedIn, isLoaded } = useUser()
  const { call } = useApi()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in')
    }
  }, [isLoaded, isSignedIn, router])

  useEffect(() => {
    loadProjects()

    // Poll for updates every 5 seconds
    const interval = setInterval(loadProjects, 5000)

    return () => {
      clearInterval(interval)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadProjects() {
    // Add timeout to prevent infinite loading
    const controller = new AbortController()
    const timeoutError = new Error('Request timed out while loading projects')
    const timeout = setTimeout(() => controller.abort(timeoutError), 10000) // 10 second timeout

    try {
      const data = await call<{ projects: ProjectSummary[] }>('/v1/projects', {
        signal: controller.signal
      })

      setProjects(data.projects || [])
      setError(null) // Clear any previous errors
    } catch (error) {
      if (error === timeoutError || (error instanceof DOMException && error.name === 'AbortError')) {
        console.warn('Project load request timed out')
        setError('Loading projects timed out. Please try again.')
      } else {
        console.error('Error loading projects:', error)
        const errorMessage = error instanceof Error
          ? error.message
          : 'Failed to load projects. Please check your connection and try again.'
        setError(errorMessage)
      }
    } finally {
      clearTimeout(timeout)
      setLoading(false)
    }
  }

  function getStatusBadge(status: ProjectSummary['status']) {
    const statusConfig = {
      uploading: { icon: Loader2, color: 'text-muted-foreground bg-muted', label: 'Uploading' },
      ready: { icon: Loader2, color: 'text-muted-foreground bg-muted', label: 'Ready' },
      queued: { icon: Loader2, color: 'text-muted-foreground bg-muted', label: 'Queued' },
      processing: { icon: Loader2, color: 'text-muted-foreground bg-muted', label: 'Processing' },
      transcribing: { icon: Loader2, color: 'text-muted-foreground bg-muted', label: 'Transcribing' },
      analyzing: { icon: Loader2, color: 'text-muted-foreground bg-muted', label: 'Analyzing' },
      rendering: { icon: Loader2, color: 'text-muted-foreground bg-muted', label: 'Rendering' },
      delivering: { icon: Loader2, color: 'text-muted-foreground bg-muted', label: 'Delivering' },
      completed: { icon: CheckCircle, color: 'text-primary bg-primary/10', label: 'Completed' },
      error: { icon: AlertCircle, color: 'text-destructive bg-destructive/10', label: 'Error' },
    } as const

    const config = statusConfig[status] ?? statusConfig.processing
    const Icon = config.icon

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className={`w-3 h-3 ${status !== 'completed' && status !== 'error' ? 'animate-spin' : ''}`} />
        {config.label}
      </span>
    )
  }

  // Show loading state while checking authentication
  if (!isLoaded) {
    return (
      <>
        <Head>
          <title>My Projects - VidEditor</title>
        </Head>
        <WorkspaceLayout title="Projects">
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </WorkspaceLayout>
      </>
    )
  }

  // Don't render content if not signed in (will redirect)
  if (!isSignedIn) {
    return null
  }

  return (
    <>
      <Head>
        <title>My Projects - VidEditor</title>
      </Head>

      <WorkspaceLayout title="Projects">
        {/* Upload Section */}
        <div className="mb-8">
          <VideoUpload onUploadComplete={() => loadProjects()} />
        </div>

        {/* Projects Grid */}
        <div>
          <h2 className="text-2xl font-bold mb-4 text-foreground">Your Projects</h2>

          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-muted-foreground">Loading projects...</p>
            </div>
          ) : error ? (
            <Card className="bg-card border-destructive/30">
              <CardContent className="py-12 text-center">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
                <p className="text-foreground mb-2 font-semibold">Failed to load projects</p>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <button
                  onClick={() => {
                    setLoading(true)
                    setError(null)
                    loadProjects()
                  }}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  Try Again
                </button>
              </CardContent>
            </Card>
          ) : projects.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center">
                <Video className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-foreground mb-2">No projects yet</p>
                <p className="text-sm text-muted-foreground">Upload a video to get started. Projects appear here after upload completes.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="bg-card border-border hover:border-primary transition-all cursor-pointer group overflow-hidden"
                  onClick={() => router.push(`/projects/${project.id}`)}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-muted">
                    {project.thumbnailUrl ? (
                      <img
                        src={project.thumbnailUrl}
                        alt={project.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="w-12 h-12 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    )}
                    {/* Status Badge Overlay */}
                    <div className="absolute top-2 right-2">
                      {getStatusBadge(project.status)}
                    </div>
                  </div>

                  <CardContent className="p-4">
                    {/* Title */}
                    <h3 className="font-semibold text-base mb-2 text-foreground truncate group-hover:text-primary transition-colors">
                      {project.title}
                    </h3>

                    {/* Metadata Row */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {project.durationSeconds ? formatDuration(project.durationSeconds) : '—'}
                      </span>
                      <span>{project.fileSizeBytes ? formatFileSize(project.fileSizeBytes) : '—'}</span>
                    </div>

                    {/* Transcription & Shorts Status */}
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={project.hasTranscription ? "default" : "secondary"}
                        className="text-xs"
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        {project.hasTranscription ? 'Transcribed' : 'No transcript'}
                      </Badge>
                      <Badge
                        variant={project.shortsCount && project.shortsCount > 0 ? "default" : "secondary"}
                        className="text-xs"
                      >
                        <Film className="w-3 h-3 mr-1" />
                        {project.shortsCount || 0} shorts
                      </Badge>
                    </div>

                    {/* Error Message */}
                    {project.errorMessage && (
                      <p className="text-xs text-destructive mt-2 line-clamp-2">{project.errorMessage}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </WorkspaceLayout>
    </>
  )
}
