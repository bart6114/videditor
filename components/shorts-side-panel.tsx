import { useEffect, useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Loader2, ChevronLeft, ChevronRight, Download, FileText, Calendar, Send } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useApi } from '@/lib/api/client'
import type { Short } from '@server/db/schema'
import type { SocialContent, SocialPlatform } from '@shared/index'
import { getShortFilename } from '@/lib/api/shorts'
import { useYouTubeSchedulingEnabled } from '@/hooks/useFeatureFlag'
import { toast } from 'sonner'

interface SocialAccount {
  id: string
  platform: string
  channelId: string | null
  channelTitle: string | null
  channelThumbnail: string | null
  createdAt: string
}

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
  organizationId: string
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
  organizationId,
  onClose,
  onNavigate,
}: ShortsSidePanelProps) {
  const { call } = useApi()
  const { enabled: schedulingEnabled } = useYouTubeSchedulingEnabled()
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  // Schedule modal state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [scheduleTitle, setScheduleTitle] = useState('')
  const [scheduleDescription, setScheduleDescription] = useState('')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [confirmingPublishNow, setConfirmingPublishNow] = useState(false)
  const submittingRef = useRef(false)

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

  // Open schedule modal and fetch social accounts
  const handleOpenScheduleModal = async () => {
    setScheduleModalOpen(true)
    setScheduleError(null)

    // Prefill title/description from YouTube social content if available
    const socialContent = selectedShort?.socialContent as SocialContent | null
    if (socialContent?.youtube && 'title' in socialContent.youtube) {
      setScheduleTitle(socialContent.youtube.title || '')
      setScheduleDescription(socialContent.youtube.description || '')
    } else {
      // Fall back to transcription slice as title
      setScheduleTitle(selectedShort?.transcriptionSlice?.slice(0, 100) || '')
      setScheduleDescription('')
    }

    // Set default date/time to 1 hour from now
    const defaultDate = new Date()
    defaultDate.setHours(defaultDate.getHours() + 1)
    defaultDate.setMinutes(0, 0, 0)
    setScheduleDate(defaultDate.toISOString().split('T')[0])
    setScheduleTime(defaultDate.toTimeString().slice(0, 5))

    // Fetch social accounts
    if (organizationId) {
      setLoadingAccounts(true)
      try {
        const data = await call<{ accounts: SocialAccount[] }>(
          `/v1/organizations/${organizationId}/social-accounts`
        )
        setSocialAccounts(data.accounts)
        // Auto-select first YouTube account
        const youtubeAccount = data.accounts.find((a) => a.platform === 'youtube')
        if (youtubeAccount) {
          setSelectedAccountId(youtubeAccount.id)
        }
      } catch (err) {
        console.error('Error fetching social accounts:', err)
        setScheduleError('Failed to load connected accounts')
      } finally {
        setLoadingAccounts(false)
      }
    }
  }

  const handleCloseScheduleModal = () => {
    setScheduleModalOpen(false)
    setScheduleError(null)
    setSelectedAccountId('')
    setScheduleTitle('')
    setScheduleDescription('')
    setScheduleDate('')
    setScheduleTime('')
    setConfirmingPublishNow(false)
    submittingRef.current = false
  }

  const handleSchedule = async () => {
    // Synchronous guard to prevent double-clicks
    if (submittingRef.current) return
    submittingRef.current = true

    if (!selectedShort || !selectedAccountId || !scheduleTitle.trim() || !scheduleDate || !scheduleTime) {
      setScheduleError('Please fill in all required fields')
      submittingRef.current = false
      return
    }

    // Combine date and time
    const scheduledFor = new Date(`${scheduleDate}T${scheduleTime}`)
    if (scheduledFor <= new Date()) {
      setScheduleError('Scheduled time must be in the future')
      submittingRef.current = false
      return
    }

    setSubmitting(true)
    setScheduleError(null)

    try {
      await call(
        `/v1/projects/${projectId}/shorts/${selectedShort.id}/schedule`,
        {
          method: 'POST',
          body: JSON.stringify({
            socialAccountId: selectedAccountId,
            scheduledFor: scheduledFor.toISOString(),
            title: scheduleTitle.trim(),
            description: scheduleDescription.trim() || undefined,
          }),
        }
      )
      handleCloseScheduleModal()
      toast.success('Short scheduled successfully!', {
        description: `Scheduled for ${scheduledFor.toLocaleString()}`,
      })
    } catch (err) {
      console.error('Error scheduling short:', err)
      setScheduleError(err instanceof Error ? err.message : 'Failed to schedule short')
    } finally {
      setSubmitting(false)
      submittingRef.current = false
    }
  }

  const handlePublishNow = async () => {
    // Synchronous guard to prevent double-clicks
    if (submittingRef.current) return
    submittingRef.current = true

    if (!selectedShort || !selectedAccountId || !scheduleTitle.trim()) {
      setScheduleError('Please select an account and enter a title')
      submittingRef.current = false
      return
    }

    setSubmitting(true)
    setScheduleError(null)

    try {
      await call(
        `/v1/projects/${projectId}/shorts/${selectedShort.id}/publish-now`,
        {
          method: 'POST',
          body: JSON.stringify({
            socialAccountId: selectedAccountId,
            title: scheduleTitle.trim(),
            description: scheduleDescription.trim() || undefined,
          }),
        }
      )
      handleCloseScheduleModal()
      toast.success('Publishing started!', {
        description: 'Check the calendar for status updates.',
      })
    } catch (err) {
      console.error('Error publishing short:', err)
      setScheduleError(err instanceof Error ? err.message : 'Failed to publish short')
    } finally {
      setSubmitting(false)
      submittingRef.current = false
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
        className={`fixed inset-0 md:inset-auto md:top-0 md:right-0 md:h-full md:w-[55%] lg:w-[50%] xl:w-[45%] bg-background md:border-l border-border shadow-2xl z-50 transition-transform duration-300 ease-in-out ${
          selectedShort ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between p-4 md:p-6 border-b border-border">
            <div className="flex-1 pr-2 md:pr-4">
              <h2 className="text-base md:text-lg font-semibold text-foreground line-clamp-2">
                {selectedShort.transcriptionSlice}
              </h2>
              <div className="flex items-center gap-3 md:gap-4 mt-2 text-xs md:text-sm text-muted-foreground">
                <span>Duration: {Math.floor(duration)}s</span>
                {currentIndex >= 0 && (
                  <span>
                    {currentIndex + 1} of {shorts.length}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 md:gap-2 shrink-0">
              {selectedShort.status === 'completed' && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDownloadMetadata}
                    title="Download metadata JSON"
                    className="min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 p-2 md:px-3"
                  >
                    <FileText className="w-4 h-4" />
                    <span className="sr-only">Download metadata</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDownload}
                    disabled={downloading}
                    title="Download video"
                    className="min-h-[44px] md:min-h-0 p-2 md:px-3"
                  >
                    {downloading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Download className="w-4 h-4 md:mr-2" />
                        <span className="hidden md:inline">Download</span>
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant={schedulingEnabled ? 'default' : 'outline'}
                    onClick={schedulingEnabled ? handleOpenScheduleModal : undefined}
                    disabled={!schedulingEnabled}
                    title={schedulingEnabled ? 'Schedule or publish to YouTube' : 'Coming Soon'}
                    className="min-h-[44px] md:min-h-0 p-2 md:px-3"
                  >
                    <Calendar className="w-4 h-4 md:mr-2" />
                    <span className="hidden md:inline">{schedulingEnabled ? 'Schedule' : 'Soon'}</span>
                  </Button>
                </>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={onClose}
                className="min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0"
              >
                <X className="w-5 h-5" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 md:p-6 space-y-4 md:space-y-6">
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

                {/* Keyboard hint - hidden on mobile */}
                <div className="mt-2 text-center hidden md:block">
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

      {/* Schedule Modal */}
      <Dialog open={scheduleModalOpen} onOpenChange={(open) => !open && handleCloseScheduleModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule or Publish</DialogTitle>
            <DialogDescription>
              Publish this short to YouTube now or schedule it for later.
            </DialogDescription>
          </DialogHeader>

          {/* Error message */}
          {scheduleError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{scheduleError}</p>
            </div>
          )}

          <fieldset disabled={submitting} className="space-y-4 py-4 disabled:opacity-60">
            {/* YouTube Account Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">YouTube Account</label>
              {loadingAccounts ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading accounts...
                </div>
              ) : socialAccounts.filter((a) => a.platform === 'youtube').length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No YouTube accounts connected.{' '}
                  <Link href="/settings/organization" className="text-primary underline">
                    Connect one in settings
                  </Link>
                </div>
              ) : (
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Select an account</option>
                  {socialAccounts
                    .filter((a) => a.platform === 'youtube')
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.channelTitle || account.channelId || 'YouTube Channel'}
                      </option>
                    ))}
                </select>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="text-sm font-medium mb-2 block">Title *</label>
              <Input
                value={scheduleTitle}
                onChange={(e) => setScheduleTitle(e.target.value)}
                placeholder="Enter video title"
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground mt-1">{scheduleTitle.length}/100</p>
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <textarea
                value={scheduleDescription}
                onChange={(e) => setScheduleDescription(e.target.value)}
                placeholder="Enter video description"
                className="w-full min-h-[100px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-y"
                maxLength={5000}
              />
            </div>

            {/* Schedule Date/Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-2 block">Date</label>
                <Input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Time</label>
                <Input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Times are in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ')})
            </p>
          </fieldset>

          {confirmingPublishNow ? (
            <div className="space-y-3">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  This will publish immediately to{' '}
                  <span className="font-medium">
                    {socialAccounts.find((a) => a.id === selectedAccountId)?.channelTitle || 'YouTube'}
                  </span>
                </p>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => setConfirmingPublishNow(false)}
                  disabled={submitting}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePublishNow}
                  disabled={submitting}
                  className="w-full sm:w-auto"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Confirm Publish
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmingPublishNow(true)}
                disabled={submitting || !selectedAccountId || !scheduleTitle.trim()}
                className="w-full sm:w-auto"
              >
                <Send className="w-4 h-4 mr-2" />
                Publish Now
              </Button>
              <Button
                onClick={handleSchedule}
                disabled={submitting || !selectedAccountId || !scheduleTitle.trim() || !scheduleDate || !scheduleTime}
                className="w-full sm:w-auto"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4 mr-2" />
                    Schedule
                  </>
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
