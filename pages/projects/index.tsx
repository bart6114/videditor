import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { GetServerSideProps } from 'next'
import { createClient } from '@/lib/supabase/client'
import { requireAuth } from '@/lib/utils/auth'
import { VideoUpload } from '@/components/video-upload'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Scissors, Video, Clock, Loader2, CheckCircle, AlertCircle, LogOut } from 'lucide-react'
import { formatDuration, formatFileSize } from '@/lib/utils'
import type { Database } from '@/types/database'

type Project = Database['public']['Tables']['projects']['Row']

export const getServerSideProps: GetServerSideProps = requireAuth

export default function Projects() {
  const router = useRouter()
  const supabase = createClient()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProjects()

    // Subscribe to realtime updates
    const channel = supabase
      .channel('projects-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setProjects((prev) => [payload.new as Project, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setProjects((prev) =>
              prev.map((p) => (p.id === payload.new.id ? (payload.new as Project) : p))
            )
          } else if (payload.eventType === 'DELETE') {
            setProjects((prev) => prev.filter((p) => p.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadProjects() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setProjects(data || [])
    } catch (error) {
      console.error('Error loading projects:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  function getStatusBadge(status: Project['status']) {
    const statusConfig = {
      uploading: { icon: Loader2, color: 'text-blue-600 bg-blue-50', label: 'Uploading' },
      processing: { icon: Loader2, color: 'text-purple-600 bg-purple-50', label: 'Processing' },
      transcribing: { icon: Loader2, color: 'text-yellow-600 bg-yellow-50', label: 'Transcribing' },
      analyzing: { icon: Loader2, color: 'text-indigo-600 bg-indigo-50', label: 'Analyzing' },
      completed: { icon: CheckCircle, color: 'text-green-600 bg-green-50', label: 'Completed' },
      error: { icon: AlertCircle, color: 'text-red-600 bg-red-50', label: 'Error' },
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

      <main className="min-h-screen bg-gray-50">
        {/* Header */}
        <nav className="bg-white border-b">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <Link href="/" className="flex items-center gap-2">
              <Scissors className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold">VidEditor</h1>
            </Link>
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </nav>

        <div className="container mx-auto px-4 py-8">
          {/* Upload Section */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Upload New Video</CardTitle>
              <CardDescription>
                Upload your video and we&apos;ll transcribe it and suggest viral shorts automatically
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VideoUpload onUploadComplete={() => loadProjects()} />
            </CardContent>
          </Card>

          {/* Projects List */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Your Projects</h2>

            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
                <p className="text-gray-600">Loading projects...</p>
              </div>
            ) : projects.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Video className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600 mb-2">No projects yet</p>
                  <p className="text-sm text-gray-500">Upload your first video to get started</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {projects.map((project) => (
                  <Card
                    key={project.id}
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => {
                      if (project.status === 'completed') {
                        router.push(`/projects/${project.id}`)
                      }
                    }}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="w-24 h-16 bg-gray-200 rounded flex items-center justify-center">
                            <Video className="w-8 h-8 text-gray-400" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg mb-1">{project.title}</h3>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {formatDuration(project.duration)}
                              </span>
                              <span>{formatFileSize(project.file_size)}</span>
                              <span>{new Date(project.created_at).toLocaleDateString()}</span>
                            </div>
                            {project.error_message && (
                              <p className="text-sm text-red-600 mt-2">{project.error_message}</p>
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
        </div>
      </main>
    </>
  )
}
