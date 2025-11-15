import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useApi } from '@/lib/api/client'
import { VideoUpload } from '@/components/video-upload'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import WorkspaceLayout from '@/components/layout/WorkspaceLayout'
import { Video, Clock, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
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
      setProjects(data.projects || [])
    } catch (error) {
      console.error('Error loading projects:', error)
    } finally {
      setLoading(false)
    }
  }

  function getStatusBadge(status: Project['status']) {
    const statusConfig = {
      uploading: { icon: Loader2, color: 'text-blue-400 bg-blue-500/10', label: 'Uploading' },
      processing: { icon: Loader2, color: 'text-purple-400 bg-purple-500/10', label: 'Processing' },
      transcribing: { icon: Loader2, color: 'text-yellow-400 bg-yellow-500/10', label: 'Transcribing' },
      analyzing: { icon: Loader2, color: 'text-indigo-400 bg-indigo-500/10', label: 'Analyzing' },
      completed: { icon: CheckCircle, color: 'text-[#37b680] bg-[#37b680]/10', label: 'Completed' },
      error: { icon: AlertCircle, color: 'text-red-400 bg-red-500/10', label: 'Error' },
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
        <Card className="mb-8 bg-[#0f1419] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Upload New Video</CardTitle>
            <CardDescription className="text-gray-400">
              Upload your video and we&apos;ll transcribe it and suggest viral shorts automatically
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VideoUpload onUploadComplete={() => loadProjects()} />
          </CardContent>
        </Card>

        {/* Projects List */}
        <div>
          <h2 className="text-2xl font-bold mb-4 text-white">Your Projects</h2>

          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-[#37b680]" />
              <p className="text-gray-400">Loading projects...</p>
            </div>
          ) : projects.length === 0 ? (
            <Card className="bg-[#0f1419] border-gray-800">
              <CardContent className="py-12 text-center">
                <Video className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400 mb-2">No projects yet</p>
                <p className="text-sm text-gray-500">Upload your first video to get started</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="bg-[#0f1419] border-gray-800 hover:border-gray-700 transition-all cursor-pointer"
                  onClick={() => {
                    if (project.status === 'completed') {
                      router.push(`/projects/${project.id}`)
                    }
                  }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-24 h-16 bg-gray-800 rounded flex items-center justify-center">
                          <Video className="w-8 h-8 text-gray-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-1 text-white">{project.title}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-400">
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {formatDuration(project.duration)}
                            </span>
                            <span>{formatFileSize(project.file_size)}</span>
                            <span>{new Date(project.created_at).toLocaleDateString()}</span>
                          </div>
                          {project.error_message && (
                            <p className="text-sm text-red-400 mt-2">{project.error_message}</p>
                          )}
                        </div>
                      </div>
                      {getStatusBadge(project.status)}
                    </div>
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
