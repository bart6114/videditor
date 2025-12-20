import { useEffect, useState, useCallback } from 'react'
import Head from 'next/head'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useUser } from '@clerk/nextjs'
import { useApi } from '@/lib/api/client'
import { useOnboarding } from '@/contexts/OnboardingContext'
import { TOUR_IDS } from '@/components/onboarding/tour-ids'
import { CreateProjectModal } from '@/components/CreateProjectModal'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import WorkspaceLayout from '@/components/layout/WorkspaceLayout'
import { Video, Loader2, AlertCircle, Film, Trash2, Plus } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import type { ProjectSummary } from '@/types/projects'

export default function Projects() {
  const router = useRouter()
  const { isSignedIn, isLoaded } = useUser()
  const { call } = useApi()
  const { shouldShowTour, startTour } = useOnboarding()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<ProjectSummary | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)

  // Start onboarding tour if user hasn't completed it
  useEffect(() => {
    if (shouldShowTour(TOUR_IDS.PROJECTS_OVERVIEW)) {
      startTour(TOUR_IDS.PROJECTS_OVERVIEW)
    }
  }, [shouldShowTour, startTour])

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in')
    }
  }, [isLoaded, isSignedIn, router])

  // Stable loadProjects function
  const loadProjects = useCallback(async () => {
    const controller = new AbortController()
    const timeoutError = new Error('Request timed out while loading projects')
    const timeout = setTimeout(() => controller.abort(timeoutError), 10000)

    try {
      const data = await call<{ projects: ProjectSummary[] }>('/v1/projects', {
        signal: controller.signal
      })
      // Sort by createdAt descending (newest first) to ensure correct order
      const sorted = (data.projects || []).sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      setProjects(sorted)
      setError(null)
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
  }, [call])

  // Initial load
  useEffect(() => {
    loadProjects()
  }, [loadProjects])


  async function handleDeleteProject() {
    if (!projectToDelete) return

    setDeleting(true)
    try {
      await call(`/v1/projects/${projectToDelete.id}`, {
        method: 'DELETE',
      })

      // Close dialog and refresh projects list
      setDeleteDialogOpen(false)
      setProjectToDelete(null)
      await loadProjects()
    } catch (error) {
      console.error('Error deleting project:', error)
      // Error is already handled by useApi
    } finally {
      setDeleting(false)
    }
  }

  function openDeleteDialog(project: ProjectSummary, e: React.MouseEvent) {
    e.stopPropagation() // Prevent card click navigation
    setProjectToDelete(project)
    setDeleteDialogOpen(true)
  }

  // Show loading state while checking authentication
  if (!isLoaded) {
    return (
      <>
        <Head>
          <title>My Projects - VidEditor.ai</title>
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
        {/* Header with New Project button */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-display uppercase tracking-widest text-primary">Your Projects</h2>
          <Button onClick={() => setCreateModalOpen(true)} data-tour="new-project-button">
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>

        {/* Projects Grid */}
        <div data-tour="projects-list">

          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-muted-foreground font-mono">{'>'} Loading projects...</p>
            </div>
          ) : error ? (
            <Card className="bg-card border-destructive/30">
              <CardContent className="py-12 text-center">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
                <p className="text-foreground mb-2 font-display uppercase tracking-wider">{'>'} Error: Failed to load projects</p>
                <p className="text-sm text-muted-foreground font-mono mb-4">{error}</p>
                <Button
                  onClick={() => {
                    setLoading(true)
                    setError(null)
                    loadProjects()
                  }}
                >
                  Try Again
                </Button>
              </CardContent>
            </Card>
          ) : projects.length === 0 ? (
            <Card className="bg-card border-border border-dashed">
              <CardContent className="py-16 text-center">
                <div className="w-20 h-20 mx-auto mb-6 cyber-clip bg-primary/10 flex items-center justify-center border border-primary/30">
                  <Video className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-lg font-display uppercase tracking-wider text-foreground mb-2">No Projects Yet</h3>
                <p className="text-muted-foreground font-mono max-w-sm mx-auto mb-4">
                  {'>'} Create your first project to start organizing your videos.
                </p>
                <Button onClick={() => setCreateModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Project
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="bg-card border-border hover:border-primary/50 hover:shadow-neon-subtle transition-all duration-200 cursor-pointer group overflow-hidden"
                  onClick={() => router.push(`/projects/${project.id}`)}
                >
                  <div className="flex gap-3 p-3">
                    {/* Compact Thumbnail */}
                    <div className="relative w-16 h-16 flex-shrink-0 cyber-clip-sm bg-muted overflow-hidden border border-border">
                      {project.thumbnailUrl ? (
                        <Image
                          src={project.thumbnailUrl}
                          alt={project.title}
                          fill
                          sizes="64px"
                          className="object-cover transition-all duration-200"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <Video className="w-6 h-6 text-primary/50" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <h3 className="font-mono text-sm text-foreground truncate group-hover:text-primary transition-colors normal-case">
                        {project.title}
                      </h3>

                      {/* Asset Counts */}
                      <div className="flex items-center gap-3 mt-1.5 text-xs font-mono text-muted-foreground">
                        <span className="flex items-center gap-1" title="Long-form videos">
                          <Video className="w-3 h-3 text-primary" />
                          {project.longFormCount || 0}
                        </span>
                        <span className="flex items-center gap-1" title="Short-form clips">
                          <Film className="w-3 h-3 text-primary" />
                          {project.shortFormCount || 0}
                        </span>
                      </div>

                      {/* Last Updated */}
                      <p className="text-xs font-mono text-muted-foreground mt-1">
                        {formatRelativeTime(project.updatedAt)}
                      </p>
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={(e) => openDeleteDialog(project, e)}
                      className="self-start opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1.5 cyber-clip-sm hover:bg-destructive hover:text-white text-muted-foreground"
                      aria-label="Delete project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="font-sans">
            <DialogHeader>
              <DialogTitle className="text-foreground">Delete Project</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                <span className="block mb-2">Are you sure you want to delete <span className="font-semibold text-foreground">&quot;{projectToDelete?.title}&quot;</span>?</span>
                <span className="block mb-2">This will permanently delete:</span>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Long-form videos ({projectToDelete?.longFormCount || 0})</li>
                  <li>Generated shorts ({projectToDelete?.shortsCount || 0})</li>
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
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteProject}
                disabled={deleting}
              >
                {deleting ? (
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

        {/* Create Project Modal */}
        <CreateProjectModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
        />
      </WorkspaceLayout>
    </>
  )
}
