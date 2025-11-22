import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { X, Loader2, ChevronLeft, ChevronRight, Download, FileText } from 'lucide-react'
import { useApi } from '@/lib/api/client'
import type { Short } from '@server/db/schema'
import type { SocialContent, SocialPlatform } from '@shared/index'
import { getShortFilename } from '@/lib/api/shorts'

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
}

const ReactPlayer = dynamic(() => import('react-player'), { ssr: false })

interface ShortsSidePanelProps {
  selectedShort: Short | null
  shorts: Short[]
  projectId: string
  projectTitle: string
  onClose: () => void
  onNavigate: (short: Short) => void
}

function ClickToCopyField({ text, multiline = false }: { text: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false)

  const handleClick = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      onClick={handleClick}
      className={`relative text-sm bg-muted p-3 rounded-md cursor-pointer hover:bg-muted/80 transition-colors ${
        multiline ? 'whitespace-pre-wrap' : ''
      }`}
    >
      {text}
      {copied && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/90 rounded-md animate-in fade-in duration-150">
          <span className="text-xs font-medium text-primary-foreground">Copied!</span>
        </div>
      )}
    </div>
  )
}

export function ShortsSidePanel({
  selectedShort,
  shorts,
  projectId,
  projectTitle,
  onClose,
  onNavigate,
}: ShortsSidePanelProps) {
  const { call } = useApi()
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

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

  const handleDownload = async () => {
    if (!selectedShort || !videoUrl) return

    setDownloading(true)
    try {
      // Generate filename using utility function
      const filename = getShortFilename(selectedShort)

      // Trigger browser download
      const a = document.createElement('a')
      a.href = videoUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err) {
      console.error('Error downloading short:', err)
      alert(err instanceof Error ? err.message : 'Failed to download short')
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadMetadata = () => {
    if (!selectedShort) return

    try {
      // Generate filename using utility function
      const videoFilename = getShortFilename(selectedShort)
      // Replace extension with .json
      const metadataFilename = videoFilename.replace(/\.[^/.]+$/, '.json')

      // Create metadata object with relevant short information
      const metadata = {
        id: selectedShort.id,
        transcriptionSlice: selectedShort.transcriptionSlice,
        startTime: selectedShort.startTime,
        endTime: selectedShort.endTime,
        duration: selectedShort.endTime - selectedShort.startTime,
        socialContent: selectedShort.socialContent,
        status: selectedShort.status,
        createdAt: selectedShort.createdAt,
        updatedAt: selectedShort.updatedAt,
      }

      // Create and download JSON file using same basename as video
      const blob = new Blob([JSON.stringify(metadata, null, 2)], {
        type: 'application/json',
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = metadataFilename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error downloading metadata:', err)
      alert(err instanceof Error ? err.message : 'Failed to download metadata')
    }
  }

  // Handle keyboard navigation (up/down arrows)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedShort) return

      if (e.key === 'ArrowUp' && hasPrevious) {
        e.preventDefault()
        handlePrevious()
      } else if (e.key === 'ArrowDown' && hasNext) {
        e.preventDefault()
        handleNext()
      } else if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShort, hasPrevious, hasNext, currentIndex])

  const duration = selectedShort
    ? selectedShort.endTime - selectedShort.startTime
    : 0

  // Don't render anything if no short is selected
  if (!selectedShort) return null

  return (
    <>
      {/* Backdrop (subtle, allows table to be visible) */}
      <div
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          selectedShort ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Side Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full lg:w-[55%] xl:w-[50%] bg-background border-l border-border shadow-2xl z-50 transition-transform duration-300 ease-in-out ${
          selectedShort ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-border">
            <div className="flex-1 pr-4">
              <h2 className="text-lg font-semibold text-foreground line-clamp-2">
                {selectedShort.transcriptionSlice}
              </h2>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span>Duration: {Math.floor(duration)}s</span>
                {currentIndex >= 0 && (
                  <span>
                    {currentIndex + 1} of {shorts.length}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {selectedShort.status === 'completed' && (
                <>
                  <Button
                    size="default"
                    variant="outline"
                    onClick={handleDownloadMetadata}
                    title="Download metadata JSON"
                  >
                    <FileText className="w-4 h-4" />
                    <span className="sr-only">Download metadata</span>
                  </Button>
                  <Button
                    size="default"
                    variant="outline"
                    onClick={handleDownload}
                    disabled={downloading}
                    title="Download video"
                  >
                    {downloading ? (
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
                </>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={onClose}
              >
                <X className="w-5 h-5" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Video Player */}
              <div className="relative">
                <div className="relative bg-black aspect-video rounded-lg overflow-hidden">
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

                  {/* Navigation arrows overlaid on video */}
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

                {/* Keyboard hint */}
                <div className="mt-2 text-center">
                  <p className="text-xs text-muted-foreground">
                    Use ↑ ↓ arrow keys to navigate • ESC to close
                  </p>
                </div>
              </div>

              {/* Social Content Display */}
              {(() => {
                const socialContent = selectedShort.socialContent as SocialContent | null
                if (!socialContent || Object.keys(socialContent).length === 0) return null
                return (
                  <div>
                    <h3 className="text-sm font-semibold mb-4 text-foreground">Social Media Content</h3>
                    <div className="space-y-4">
                      {Object.entries(socialContent).map(([platform, content]) => (
                        <div key={platform} className="border border-border rounded-lg p-4">
                          <h4 className="text-sm font-semibold mb-3 text-primary">
                            {PLATFORM_LABELS[platform as SocialPlatform] || platform}
                          </h4>
                          {platform === 'youtube' && content && 'title' in content && (
                            <div className="space-y-3">
                              <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Title</label>
                                <ClickToCopyField text={(content as { title: string }).title} />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description</label>
                                <ClickToCopyField text={(content as { description: string }).description} multiline />
                              </div>
                            </div>
                          )}
                          {(platform === 'instagram' || platform === 'tiktok' || platform === 'linkedin') && content && 'caption' in content && (
                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Caption</label>
                              <ClickToCopyField text={(content as { caption: string }).caption} multiline />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
