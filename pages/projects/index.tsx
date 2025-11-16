import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useApi } from '@/lib/api/client'
import { VideoUpload } from '@/components/video-upload'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import WorkspaceLayout from '@/components/layout/WorkspaceLayout'
import { Video, Clock, Loader2, CheckCircle, AlertCircle, FileText, Film } from 'lucide-react'
import { formatFileSize } from '@/lib/utils'
import type { Project } from '@/types/d1'

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
  const { call } = useApi()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

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
    try {
      const data = await call<{ projects: Project[] }>('/api/projects')
      // Filter out uploading projects - only show after upload completes
      const completedUploads = (data.projects || []).filter(p => p.status !== 'uploading')
      setProjects(completedUploads)
    } catch (error) {
      console.error('Error loading projects:', error)
    } finally {
      setLoading(false)
    }
  }

  function getStatusBadge(status: Project['status']) {
    const statusConfig = {
      uploading: { icon: Loader2, color: 'text-muted-foreground bg-muted', label: 'Uploading' },
      processing: { icon: Loader2, color: 'text-muted-foreground bg-muted', label: 'Processing' },
      transcribing: { icon: Loader2, color: 'text-muted-foreground bg-muted', label: 'Transcribing' },
      analyzing: { icon: Loader2, color: 'text-muted-foreground bg-muted', label: 'Analyzing' },
      completed: { icon: CheckCircle, color: 'text-primary bg-primary/10', label: 'Completed' },
      error: { icon: AlertCircle, color: 'text-destructive bg-destructive/10', label: 'Error' },
    }

    const config = statusConfig[status]
    const Icon = config.icon

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className={`w-3 h-3 ${status !== 'completed' && status !== 'error' ? 'animate-spin' : ''}`} />
        {config.label}
      </span>
    )
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
                    {project.thumbnail_url ? (
                      <img
                        src={project.thumbnail_url}
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
                        {formatDuration(project.duration)}
                      </span>
                      <span>{formatFileSize(project.file_size)}</span>
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
                    {project.error_message && (
                      <p className="text-xs text-destructive mt-2 line-clamp-2">{project.error_message}</p>
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
