import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Loader2, Copy, Check } from 'lucide-react'
import { useApi } from '@/lib/api/client'
import type { Short } from '@server/db/schema'
import type { SocialContent, SocialPlatform } from '@shared/index'

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
}

const ReactPlayer = dynamic(() => import('react-player'), { ssr: false })

interface VideoLightboxProps {
  selectedShort: Short | null
  shorts: Short[]
  projectId: string
  onClose: () => void
  onNavigate: (short: Short) => void
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-6 px-2"
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="w-3 h-3 text-green-500" />
      ) : (
        <Copy className="w-3 h-3" />
      )}
    </Button>
  )
}

export function VideoLightbox({
  selectedShort,
  shorts,
  projectId,
  onClose,
  onNavigate,
}: VideoLightboxProps) {
  const { call } = useApi()
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get current index and check if navigation is available
  const currentIndex = selectedShort
    ? shorts.findIndex((s) => s.id === selectedShort.id)
    : -1
  const hasPrevious = currentIndex > 0
  const hasNext = currentIndex < shorts.length - 1

  // Fetch presigned URL when selected short changes
  useEffect(() => {
    if (!selectedShort) {
      setVideoUrl(null)
      setError(null)
      return
    }

    async function fetchVideoUrl() {
      if (!selectedShort?.id) return

      setLoading(true)
      setError(null)
      setVideoUrl(null)

      try {
        // Check if short is completed and has an output
        if (selectedShort.status !== 'completed' || !selectedShort.outputObjectKey) {
          throw new Error('Short video is not ready yet')
        }

        // Fetch presigned URL from download endpoint
        const data = await call<{ downloadUrl: string; filename: string }>(
          `/v1/projects/${projectId}/shorts/${selectedShort.id}/download`
        )

        setVideoUrl(data.downloadUrl)
      } catch (err) {
        console.error('Error fetching video URL:', err)
        setError(err instanceof Error ? err.message : 'Failed to load video')
      } finally {
        setLoading(false)
      }
    }

    fetchVideoUrl()
  }, [selectedShort, projectId, call])

  const handlePrevious = () => {
    if (hasPrevious) {
      const prevShort = shorts[currentIndex - 1]
      onNavigate(prevShort)
    }
  }

  const handleNext = () => {
    if (hasNext) {
      const nextShort = shorts[currentIndex + 1]
      onNavigate(nextShort)
    }
  }

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedShort) return

      if (e.key === 'ArrowLeft' && hasPrevious) {
        handlePrevious()
      } else if (e.key === 'ArrowRight' && hasNext) {
        handleNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShort, hasPrevious, hasNext, currentIndex])

  const duration = selectedShort
    ? selectedShort.endTime - selectedShort.startTime
    : 0

  return (
    <Dialog open={!!selectedShort} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        {selectedShort && (
          <>
            <DialogHeader className="p-6 pb-4">
              <DialogTitle className="line-clamp-1">
                {selectedShort.transcriptionSlice.length > 60
                  ? selectedShort.transcriptionSlice.slice(0, 60) + '...'
                  : selectedShort.transcriptionSlice}
              </DialogTitle>
            </DialogHeader>

            <div className="relative bg-black aspect-video">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-12 w-12 text-white animate-spin" />
                </div>
              )}

              {error && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center px-4">
                    <p className="text-red-400 mb-2">Failed to load video</p>
                    <p className="text-sm text-gray-400">{error}</p>
                  </div>
                </div>
              )}

              {videoUrl && !error && (
                <ReactPlayer
                  url={videoUrl}
                  controls
                  playing
                  width="100%"
                  height="100%"
                  config={{
                    file: {
                      attributes: {
                        controlsList: 'nodownload',
                      },
                    },
                  }}
                />
              )}

              {/* Navigation arrows */}
              {!loading && !error && (
                <>
                  {hasPrevious && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                      onClick={handlePrevious}
                    >
                      <ChevronLeft className="h-8 w-8" />
                      <span className="sr-only">Previous short</span>
                    </Button>
                  )}

                  {hasNext && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                      onClick={handleNext}
                    >
                      <ChevronRight className="h-8 w-8" />
                      <span className="sr-only">Next short</span>
                    </Button>
                  )}
                </>
              )}
            </div>

            <div className="p-6 pt-4 space-y-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div>
                  Duration: {Math.floor(duration)}s
                  {currentIndex >= 0 && (
                    <span className="ml-4">
                      {currentIndex + 1} of {shorts.length}
                    </span>
                  )}
                </div>
                <div className="text-xs">
                  Use ← → arrow keys to navigate
                </div>
              </div>

              {/* Social Content Display */}
              {(() => {
                const socialContent = selectedShort.socialContent as SocialContent | null;
                if (!socialContent || Object.keys(socialContent).length === 0) return null;
                return (
                  <div className="border-t border-border pt-4 max-h-60 overflow-y-auto">
                    <h4 className="text-sm font-medium mb-3">Social Media Content</h4>
                    <div className="space-y-4">
                      {Object.entries(socialContent).map(([platform, content]) => (
                      <div key={platform} className="border border-border rounded-lg p-3">
                        <h5 className="text-xs font-semibold mb-2 text-primary">{PLATFORM_LABELS[platform as SocialPlatform] || platform}</h5>
                        {platform === 'youtube' && content && 'title' in content && (
                          <div className="space-y-2">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs text-muted-foreground">Title</label>
                                <CopyButton text={(content as { title: string }).title} />
                              </div>
                              <p className="text-sm bg-muted p-2 rounded">{(content as { title: string }).title}</p>
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs text-muted-foreground">Description</label>
                                <CopyButton text={(content as { description: string }).description} />
                              </div>
                              <p className="text-sm bg-muted p-2 rounded whitespace-pre-wrap max-h-24 overflow-y-auto">{(content as { description: string }).description}</p>
                            </div>
                          </div>
                        )}
                        {(platform === 'instagram' || platform === 'tiktok' || platform === 'linkedin') && content && 'caption' in content && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs text-muted-foreground">Caption</label>
                              <CopyButton text={(content as { caption: string }).caption} />
                            </div>
                            <p className="text-sm bg-muted p-2 rounded whitespace-pre-wrap max-h-24 overflow-y-auto">{(content as { caption: string }).caption}</p>
                          </div>
                        )}
                      </div>
                    ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
