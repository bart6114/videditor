import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Calendar, Check, Sparkles, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'
import { SiYoutube, SiInstagram, SiTiktok } from '@icons-pack/react-simple-icons'
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
import type { SocialContent, ShortFormMetadata } from '@shared/index'
import { toast } from 'sonner'
import { useYouTubeSchedulingEnabled, useInstagramSchedulingEnabled } from '@/hooks/useFeatureFlag'

interface SocialAccount {
  id: string
  platform: string
  channelId: string | null
  channelTitle: string | null
  channelThumbnail: string | null
  createdAt: string
}

interface ScheduleItem {
  shortId: string
  scheduledFor: string
}

type PlatformType = 'youtube' | 'instagram'

interface ShortPlatformContent {
  youtube?: { title: string; description: string }
  instagram?: { caption: string }
}

interface BulkScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shorts: Short[]
  organizationId: string
  onSuccess?: () => void
  defaultSchedulingPrompt?: string | null
}

// Format Date to local datetime-local input format (YYYY-MM-DDTHH:MM)
const formatLocalDateTime = (d: Date) => {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function BulkScheduleDialog({
  open,
  onOpenChange,
  shorts,
  organizationId,
  onSuccess,
  defaultSchedulingPrompt,
}: BulkScheduleDialogProps) {
  const { call } = useApi()
  const { enabled: youtubeSchedulingEnabled } = useYouTubeSchedulingEnabled()
  const { enabled: instagramSchedulingEnabled } = useInstagramSchedulingEnabled()
  const submittingRef = useRef(false)
  const wasOpenRef = useRef(false)

  // Step management
  const [step, setStep] = useState<'input' | 'preview'>('input')

  // Social accounts
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<PlatformType>>(new Set())

  // Input step state
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Preview step state
  const [schedule, setSchedule] = useState<ScheduleItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [perShortContent, setPerShortContent] = useState<Map<string, ShortPlatformContent>>(new Map())
  const [expandedShorts, setExpandedShorts] = useState<Set<string>>(new Set())

  // Reset state when dialog opens (only on open transition, not on dep changes)
  useEffect(() => {
    const justOpened = open && !wasOpenRef.current
    wasOpenRef.current = open

    if (justOpened) {
      setStep('input')
      setPrompt(defaultSchedulingPrompt || '')
      setSchedule([])
      setError(null)
      submittingRef.current = false
      setPerShortContent(new Map())
      setExpandedShorts(new Set())

      // Fetch social accounts
      if (organizationId) {
        setLoadingAccounts(true)
        call<{ accounts: SocialAccount[] }>(
          `/v1/organizations/${organizationId}/social-accounts`
        )
          .then((data) => {
            setSocialAccounts(data.accounts)
            // Auto-select connected platforms that have enabled flags
            const platforms = new Set<PlatformType>()
            if (youtubeSchedulingEnabled && data.accounts.some((a) => a.platform === 'youtube')) {
              platforms.add('youtube')
            }
            if (instagramSchedulingEnabled && data.accounts.some((a) => a.platform === 'instagram')) {
              platforms.add('instagram')
            }
            setSelectedPlatforms(platforms)
          })
          .catch((err) => {
            console.error('Error fetching social accounts:', err)
            setError('Failed to load connected accounts')
          })
          .finally(() => {
            setLoadingAccounts(false)
          })
      }
    }
  }, [open, organizationId, call, defaultSchedulingPrompt, youtubeSchedulingEnabled, instagramSchedulingEnabled])

  const handleClose = () => {
    onOpenChange(false)
  }

  const togglePlatform = useCallback((platform: PlatformType) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(platform)) {
        next.delete(platform)
      } else {
        next.add(platform)
      }
      return next
    })
  }, [])

  const toggleShortExpanded = useCallback((shortId: string) => {
    setExpandedShorts((prev) => {
      const next = new Set(prev)
      if (next.has(shortId)) {
        next.delete(shortId)
      } else {
        next.add(shortId)
      }
      return next
    })
  }, [])

  const getDefaultContent = useCallback((shortId: string): ShortPlatformContent => {
    const short = shorts.find((s) => s.id === shortId)
    const socialContent = short?.socialContent as SocialContent | null
    const metadata = short?.metadata as ShortFormMetadata | null
    const fallbackTitle = metadata?.transcriptionSlice?.slice(0, 100) || short?.title?.slice(0, 100) || `Short ${shortId.slice(0, 8)}`

    return {
      youtube: {
        title: socialContent?.youtube?.title || fallbackTitle,
        description: socialContent?.youtube?.description || '',
      },
      instagram: {
        caption: socialContent?.instagram?.caption || fallbackTitle,
      },
    }
  }, [shorts])

  const getShortContent = useCallback((shortId: string): ShortPlatformContent => {
    const existing = perShortContent.get(shortId)
    if (existing) return existing
    return getDefaultContent(shortId)
  }, [perShortContent, getDefaultContent])

  const updateShortContent = useCallback((
    shortId: string,
    platform: 'youtube' | 'instagram',
    field: string,
    value: string
  ) => {
    setPerShortContent((prev) => {
      const next = new Map(prev)
      const current = next.get(shortId) || getDefaultContent(shortId)

      if (platform === 'youtube') {
        next.set(shortId, {
          ...current,
          youtube: {
            ...current.youtube!,
            [field]: value,
          },
        })
      } else {
        next.set(shortId, {
          ...current,
          instagram: {
            ...current.instagram!,
            [field]: value,
          },
        })
      }
      return next
    })
  }, [getDefaultContent])

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please describe how you want to schedule the shorts')
      return
    }

    setGenerating(true)
    setError(null)

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const shortIds = shorts.map((s) => s.id)

      const data = await call<{ schedule: ScheduleItem[] }>(
        '/v1/schedule/ai-generate',
        {
          method: 'POST',
          body: JSON.stringify({
            shortIds,
            prompt: prompt.trim(),
            timezone,
          }),
        }
      )

      if (data.schedule.length === 0) {
        setError('No valid schedule was generated. Please try a different prompt.')
        return
      }

      setSchedule(data.schedule)
      setStep('preview')
    } catch (err) {
      console.error('Error generating schedule:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate schedule')
    } finally {
      setGenerating(false)
    }
  }

  const handleUpdateScheduleTime = (shortId: string, newDateTime: string) => {
    setSchedule((prev) =>
      prev.map((item) =>
        item.shortId === shortId ? { ...item, scheduledFor: newDateTime } : item
      )
    )
  }

  const handleConfirmSchedule = async () => {
    if (submittingRef.current) return
    submittingRef.current = true

    if (selectedPlatforms.size === 0) {
      setError('Please select at least one platform')
      submittingRef.current = false
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      // Build schedules for each platform
      const schedules: Array<{
        shortId: string
        socialAccountId: string
        scheduledFor: string
        title: string
        description?: string
      }> = []

      const youtubeAccount = socialAccounts.find((a) => a.platform === 'youtube')
      const instagramAccount = socialAccounts.find((a) => a.platform === 'instagram')

      for (const item of schedule) {
        const content = getShortContent(item.shortId)
        const scheduledFor = new Date(item.scheduledFor).toISOString()

        // Add YouTube schedule if selected
        if (selectedPlatforms.has('youtube') && youtubeAccount) {
          schedules.push({
            shortId: item.shortId,
            socialAccountId: youtubeAccount.id,
            scheduledFor,
            title: content.youtube?.title || '',
            description: content.youtube?.description,
          })
        }

        // Add Instagram schedule if selected
        if (selectedPlatforms.has('instagram') && instagramAccount) {
          schedules.push({
            shortId: item.shortId,
            socialAccountId: instagramAccount.id,
            scheduledFor,
            // For Instagram, use caption as title (title field stores caption prefix for display)
            title: content.instagram?.caption?.slice(0, 100) || '',
            description: content.instagram?.caption,
          })
        }
      }

      const data = await call<{
        created: { shortId: string; scheduledPostId: string }[]
        errors: { shortId: string; error: string }[]
      }>('/v1/schedule/bulk-create', {
        method: 'POST',
        body: JSON.stringify({ schedules }),
      })

      if (data.created.length > 0) {
        toast.success(`Scheduled ${data.created.length} short${data.created.length > 1 ? 's' : ''}`, {
          description: 'Check the calendar for status updates.',
        })
      }

      if (data.errors.length > 0) {
        toast.error(`${data.errors.length} short${data.errors.length > 1 ? 's' : ''} failed to schedule`, {
          description: data.errors[0].error,
        })
      }

      onSuccess?.()
      handleClose()
    } catch (err) {
      console.error('Error creating schedules:', err)
      setError(err instanceof Error ? err.message : 'Failed to create schedules')
    } finally {
      setSubmitting(false)
      submittingRef.current = false
    }
  }

  const getShortInfo = (shortId: string) => {
    const short = shorts.find((s) => s.id === shortId)
    if (!short) return { title: 'Unknown', thumbnail: null }

    const socialContent = short.socialContent as SocialContent | null
    const metadata = short.metadata as ShortFormMetadata | null
    const title =
      socialContent?.youtube && 'title' in socialContent.youtube
        ? socialContent.youtube.title
        : metadata?.transcriptionSlice?.slice(0, 50) || short.title?.slice(0, 50) || `Short ${shortId.slice(0, 8)}`

    return {
      title,
      thumbnail: short.thumbnailUrl,
    }
  }

  const hasYouTubeAccount = youtubeSchedulingEnabled && !loadingAccounts && socialAccounts.some((a) => a.platform === 'youtube')
  const hasInstagramAccount = instagramSchedulingEnabled && !loadingAccounts && socialAccounts.some((a) => a.platform === 'instagram')
  const youtubeEnabled = youtubeSchedulingEnabled
  const instagramEnabled = instagramSchedulingEnabled
  const hasAnyAccount = hasYouTubeAccount || hasInstagramAccount

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === 'input' ? 'Bulk Schedule Shorts' : 'Review Schedule'}
          </DialogTitle>
          <DialogDescription>
            {step === 'input'
              ? `Schedule ${shorts.length} short${shorts.length > 1 ? 's' : ''} using AI-assisted scheduling.`
              : 'Review and adjust the proposed schedule before confirming.'}
          </DialogDescription>
        </DialogHeader>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {step === 'input' ? (
          <div className="space-y-4 py-4">
            {/* Platform Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Platforms</label>
              <div className="flex flex-wrap gap-2">
                {/* YouTube Toggle */}
                {youtubeEnabled && (
                  <button
                    type="button"
                    onClick={() => hasYouTubeAccount && togglePlatform('youtube')}
                    disabled={loadingAccounts || !hasYouTubeAccount}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all duration-200 ${
                      loadingAccounts || !hasYouTubeAccount
                        ? 'border-border bg-muted/30 text-muted-foreground cursor-not-allowed opacity-50'
                        : selectedPlatforms.has('youtube')
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                    }`}
                  >
                    <SiYoutube size={16} />
                    <span className="text-sm">YouTube</span>
                    {loadingAccounts ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : !hasYouTubeAccount ? (
                      <Link
                        href="/settings/organization"
                        className="text-[10px] bg-muted text-foreground px-1 py-0.5 rounded hover:bg-muted/80"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Connect
                      </Link>
                    ) : selectedPlatforms.has('youtube') ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : null}
                  </button>
                )}

                {/* Instagram Toggle */}
                {instagramEnabled && (
                  <button
                    type="button"
                    onClick={() => hasInstagramAccount && togglePlatform('instagram')}
                    disabled={loadingAccounts || !hasInstagramAccount}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all duration-200 ${
                      loadingAccounts || !hasInstagramAccount
                        ? 'border-border bg-muted/30 text-muted-foreground cursor-not-allowed opacity-50'
                        : selectedPlatforms.has('instagram')
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                    }`}
                  >
                    <SiInstagram size={16} />
                    <span className="text-sm">Instagram</span>
                    {loadingAccounts ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : !hasInstagramAccount ? (
                      <Link
                        href="/settings/organization"
                        className="text-[10px] bg-muted text-foreground px-1 py-0.5 rounded hover:bg-muted/80"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Connect
                      </Link>
                    ) : selectedPlatforms.has('instagram') ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : null}
                  </button>
                )}

                {/* TikTok - Coming Soon */}
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-muted/30 text-muted-foreground cursor-not-allowed opacity-50"
                >
                  <SiTiktok size={16} />
                  <span className="text-sm">TikTok</span>
                  <span className="text-[10px] bg-muted px-1 py-0.5 rounded">Soon</span>
                </button>
              </div>
              {selectedPlatforms.size > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Publishing to: {Array.from(selectedPlatforms).map((p) => {
                    const account = socialAccounts.find((a) => a.platform === p)
                    return account?.channelTitle || p
                  }).join(', ')}
                </p>
              )}
              {!loadingAccounts && !hasAnyAccount && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mt-2">
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Connect a publishing platform in{' '}
                    <Link href="/settings/organization" className="underline font-medium hover:text-amber-700 dark:hover:text-amber-300">
                      Preferences
                    </Link>{' '}
                    to schedule shorts.
                  </p>
                </div>
              )}
            </div>

            {/* Scheduling Prompt */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                How would you like to schedule these shorts?
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Spread over the next 3 days, schedule in mornings around 9am"
                className="w-full min-h-[100px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-y"
                disabled={generating || selectedPlatforms.size === 0}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Examples: &quot;One per day for the next week&quot;, &quot;All tomorrow afternoon&quot;, &quot;Spread out evenly over 5 days, evenings preferred&quot;
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto py-4">
            {/* Schedule Preview Table */}
            <div className="space-y-3">
              {schedule.map((item) => {
                const info = getShortInfo(item.shortId)
                const date = new Date(item.scheduledFor)
                const content = getShortContent(item.shortId)
                const isExpanded = expandedShorts.has(item.shortId)

                return (
                  <div
                    key={item.shortId}
                    className="border border-border rounded-lg overflow-hidden"
                  >
                    {/* Header row */}
                    <div className="flex items-center gap-3 p-3">
                      {/* Thumbnail */}
                      <div className="w-16 h-9 bg-muted rounded overflow-hidden flex-shrink-0 relative">
                        {info.thumbnail ? (
                          <Image
                            src={info.thumbnail}
                            alt=""
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                            No thumb
                          </div>
                        )}
                      </div>

                      {/* Title & Expand */}
                      <div className="flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleShortExpanded(item.shortId)}
                          className="flex items-center gap-1 text-sm font-medium truncate hover:text-primary transition-colors text-left"
                        >
                          {info.title}
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 flex-shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 flex-shrink-0" />
                          )}
                        </button>
                        <div className="flex items-center gap-2 mt-0.5">
                          {selectedPlatforms.has('youtube') && (
                            <SiYoutube size={12} className="text-muted-foreground" />
                          )}
                          {selectedPlatforms.has('instagram') && (
                            <SiInstagram size={12} className="text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {/* Date/Time Picker */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Input
                          type="datetime-local"
                          value={formatLocalDateTime(date)}
                          onChange={(e) => {
                            handleUpdateScheduleTime(item.shortId, e.target.value)
                          }}
                          min={formatLocalDateTime(new Date())}
                          className="w-auto text-sm"
                        />
                      </div>
                    </div>

                    {/* Expandable content editing */}
                    {isExpanded && (
                      <div className="border-t border-border p-3 bg-muted/30 space-y-4">
                        {/* YouTube content */}
                        {selectedPlatforms.has('youtube') && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <SiYoutube size={14} className="text-red-500" />
                              <span className="text-sm font-medium">YouTube</span>
                            </div>
                            <Input
                              value={content.youtube?.title || ''}
                              onChange={(e) => updateShortContent(item.shortId, 'youtube', 'title', e.target.value)}
                              placeholder="Title"
                              maxLength={100}
                              className="text-sm"
                            />
                            <textarea
                              value={content.youtube?.description || ''}
                              onChange={(e) => updateShortContent(item.shortId, 'youtube', 'description', e.target.value)}
                              placeholder="Description"
                              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-y min-h-[60px]"
                              rows={2}
                            />
                          </div>
                        )}

                        {/* Instagram content */}
                        {selectedPlatforms.has('instagram') && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <SiInstagram size={14} className="text-pink-500" />
                              <span className="text-sm font-medium">Instagram</span>
                            </div>
                            <textarea
                              value={content.instagram?.caption || ''}
                              onChange={(e) => updateShortContent(item.shortId, 'instagram', 'caption', e.target.value)}
                              placeholder="Caption"
                              maxLength={2200}
                              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-y min-h-[80px]"
                              rows={3}
                            />
                            <p className="text-xs text-muted-foreground text-right">
                              {content.instagram?.caption?.length || 0}/2200
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <p className="text-xs text-muted-foreground mt-4">
              Times are in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ')})
            </p>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {step === 'preview' && (
            <Button
              variant="outline"
              onClick={() => setStep('input')}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}

          {step === 'input' ? (
            <Button
              onClick={handleGenerate}
              disabled={generating || !prompt.trim() || selectedPlatforms.size === 0}
              className="w-full sm:w-auto"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Schedule
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleConfirmSchedule}
              disabled={submitting || schedule.length === 0 || selectedPlatforms.size === 0}
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
                  Confirm & Schedule ({schedule.length * selectedPlatforms.size})
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
