import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Calendar, Check, Sparkles, ArrowLeft } from 'lucide-react'
import { SiYoutube } from '@icons-pack/react-simple-icons'
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
import type { SocialContent } from '@shared/index'
import { toast } from 'sonner'

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

interface BulkScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shorts: Short[]
  organizationId: string
  onSuccess?: () => void
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
}: BulkScheduleDialogProps) {
  const { call } = useApi()
  const submittingRef = useRef(false)

  // Step management
  const [step, setStep] = useState<'input' | 'preview'>('input')

  // Social accounts
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')

  // Input step state
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Preview step state
  const [schedule, setSchedule] = useState<ScheduleItem[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStep('input')
      setPrompt('')
      setSchedule([])
      setError(null)
      submittingRef.current = false

      // Fetch social accounts
      if (organizationId) {
        setLoadingAccounts(true)
        call<{ accounts: SocialAccount[] }>(
          `/v1/organizations/${organizationId}/social-accounts`
        )
          .then((data) => {
            setSocialAccounts(data.accounts)
            const youtubeAccount = data.accounts.find((a) => a.platform === 'youtube')
            if (youtubeAccount) {
              setSelectedAccountId(youtubeAccount.id)
            }
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
  }, [open, organizationId, call])

  const handleClose = () => {
    onOpenChange(false)
  }

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

    if (!selectedAccountId) {
      setError('Please select a social account')
      submittingRef.current = false
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      // Build schedules with title/description from social content
      const schedules = schedule.map((item) => {
        const short = shorts.find((s) => s.id === item.shortId)
        const socialContent = short?.socialContent as SocialContent | null
        const title =
          socialContent?.youtube && 'title' in socialContent.youtube
            ? socialContent.youtube.title
            : short?.transcriptionSlice?.slice(0, 100) || `Short ${item.shortId.slice(0, 8)}`
        const description =
          socialContent?.youtube && 'description' in socialContent.youtube
            ? socialContent.youtube.description
            : undefined

        return {
          shortId: item.shortId,
          socialAccountId: selectedAccountId,
          // Convert local time string to UTC ISO format for storage
          scheduledFor: new Date(item.scheduledFor).toISOString(),
          title,
          description,
        }
      })

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
    const title =
      socialContent?.youtube && 'title' in socialContent.youtube
        ? socialContent.youtube.title
        : short.transcriptionSlice?.slice(0, 50) || `Short ${shortId.slice(0, 8)}`

    return {
      title,
      thumbnail: short.thumbnailUrl,
    }
  }

  const hasYouTubeAccount = !loadingAccounts && socialAccounts.some((a) => a.platform === 'youtube')

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
              <label className="text-sm font-medium mb-2 block">Platform</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loadingAccounts || !hasYouTubeAccount}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all duration-200 ${
                    loadingAccounts || !hasYouTubeAccount
                      ? 'border-border bg-muted/30 text-muted-foreground cursor-not-allowed opacity-50'
                      : 'bg-primary text-primary-foreground border-primary'
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
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              {hasYouTubeAccount && (
                <p className="text-xs text-muted-foreground mt-2">
                  Publishing to: {socialAccounts.find((a) => a.id === selectedAccountId)?.channelTitle || 'YouTube'}
                </p>
              )}
              {!loadingAccounts && !hasYouTubeAccount && (
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
                disabled={generating || !hasYouTubeAccount}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Examples: &quot;One per day for the next week&quot;, &quot;All tomorrow afternoon&quot;, &quot;Spread out evenly over 5 days, evenings preferred&quot;
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto py-4">
            {/* Schedule Preview Table */}
            <div className="space-y-2">
              {schedule.map((item) => {
                const info = getShortInfo(item.shortId)
                const date = new Date(item.scheduledFor)

                return (
                  <div
                    key={item.shortId}
                    className="flex items-center gap-3 p-3 border border-border rounded-lg"
                  >
                    {/* Thumbnail */}
                    <div className="w-16 h-9 bg-muted rounded overflow-hidden flex-shrink-0 relative">
                      {info.thumbnail ? (
                        <Image
                          src={info.thumbnail}
                          alt=""
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                          No thumb
                        </div>
                      )}
                    </div>

                    {/* Title */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{info.title}</p>
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
              disabled={generating || !prompt.trim() || !hasYouTubeAccount}
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
              disabled={submitting || schedule.length === 0}
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
                  Confirm & Schedule ({schedule.length})
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
