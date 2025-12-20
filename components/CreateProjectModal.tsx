import { useState } from 'react'
import { useRouter } from 'next/router'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useApi } from '@/lib/api/client'

interface CreateProjectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface CreateProjectResponse {
  project: {
    id: string
    title: string
  }
}

export function CreateProjectModal({ open, onOpenChange }: CreateProjectModalProps) {
  const router = useRouter()
  const { call } = useApi()
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!title.trim()) {
      setError('Project name is required')
      return
    }

    setCreating(true)
    setError(null)

    try {
      const data = await call<CreateProjectResponse>('/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      })

      // Reset form and close modal
      setTitle('')
      onOpenChange(false)

      // Navigate to the new project
      router.push(`/projects/${data.project.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !creating) {
      e.preventDefault()
      handleCreate()
    }
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      // Reset form when closing
      setTitle('')
      setError(null)
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="font-sans sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Create New Project</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Give your project a name. You can add videos and other content after creating it.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Input
            placeholder="Project name"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={handleKeyDown}
            disabled={creating}
            autoFocus
          />
          {error && (
            <p className="mt-2 text-sm font-mono text-destructive">{'>'} {error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={creating || !title.trim()}
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Project'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
