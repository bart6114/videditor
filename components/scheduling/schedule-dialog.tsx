'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Loader2,
  Calendar,
  Sparkles,
  ArrowLeft,
  Check,
  AlertCircle,
} from 'lucide-react'
import { SiYoutube, SiInstagram, SiTiktok } from '@icons-pack/react-simple-icons'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useApi } from '@/lib/api/client'
import { useYouTubeSchedulingEnabled, useInstagramSchedulingEnabled } from '@/hooks/useFeatureFlag'

import {
  ScheduleAccordion,
  validateAccordionItems,
  findScheduleConflicts,
} from './schedule-accordion'
import { ScheduleTimeline, CompactTimeline } from './schedule-timeline'
import { useScheduleForm, type ScheduleFormShort } from './use-schedule-form'
import type { PlatformType } from './platform-content-editor'
import type { ScheduleItemContent } from './schedule-item-editor'

// ============================================================================
// Types
// ============================================================================

interface SocialAccount {
  id: string
  platform: string
  channelId: string | null
  channelTitle: string | null
  channelThumbnail: string | null
  createdAt: string
}

interface ScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shorts: ScheduleFormShort[]
  organizationId: string
  onSuccess?: () => void
  defaultSchedulingPrompt?: string | null
  // Single mode simplifies the UI for scheduling just one short
  singleMode?: boolean
}

// ============================================================================
// Platform Toggle Button
// ============================================================================

interface PlatformToggleProps {
  platform: PlatformType
  icon: React.ComponentType<{ size: number; className?: string }>
  label: string
  isSelected: boolean
  isConnected: boolean
  isLoading: boolean
  isEnabled: boolean
  onToggle: () => void
}

function PlatformToggle({
  platform,
  icon: Icon,
  label,
  isSelected,
  isConnected,
  isLoading,
  isEnabled,
  onToggle,
}: PlatformToggleProps) {
  if (!isEnabled) return null

  const isDisabled = isLoading || !isConnected

  return (
    <button
      type="button"
      onClick={() => !isDisabled && onToggle()}
      disabled={isDisabled}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all duration-200",
        isDisabled
          ? "border-border bg-muted/30 text-muted-foreground cursor-not-allowed opacity-50"
          : isSelected
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
      )}
    >
      <Icon size={16} />
      <span className="text-sm">{label}</span>
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : !isConnected ? (
        <Link
          href="/settings/organization"
          className="text-[10px] bg-muted text-foreground px-1 py-0.5 rounded hover:bg-muted/80"
          onClick={(e) => e.stopPropagation()}
        >
          Connect
        </Link>
      ) : isSelected ? (
        <Check className="w-3.5 h-3.5" />
      ) : null}
    </button>
  )
}

// ============================================================================
// Main Dialog
// ============================================================================

export function ScheduleDialog({
  open,
  onOpenChange,
  shorts,
  organizationId,
  onSuccess,
  defaultSchedulingPrompt,
  singleMode = false,
}: ScheduleDialogProps) {
  const { call } = useApi()
  const { enabled: youtubeSchedulingEnabled } = useYouTubeSchedulingEnabled()
  const { enabled: instagramSchedulingEnabled } = useInstagramSchedulingEnabled()

  // Submission guard
  const submittingRef = useRef(false)
  const wasOpenRef = useRef(false)

  // Social accounts state
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)

  // Input step state
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state using the hook
  const draftKey = organizationId ? `schedule-draft-${organizationId}` : undefined
  const form = useScheduleForm({
    shorts,
    draftKey: singleMode ? undefined : draftKey, // No draft for single mode
  })

  // Derived state
  const hasYouTubeAccount = youtubeSchedulingEnabled && !loadingAccounts && socialAccounts.some((a) => a.platform === 'youtube')
  const hasInstagramAccount = instagramSchedulingEnabled && !loadingAccounts && socialAccounts.some((a) => a.platform === 'instagram')
  const hasAnyAccount = hasYouTubeAccount || hasInstagramAccount

  // Validation state
  const validation = validateAccordionItems(form.state.items)
  const conflicts = findScheduleConflicts(form.state.items)

  // Reset state when dialog opens
  useEffect(() => {
    const justOpened = open && !wasOpenRef.current
    wasOpenRef.current = open

    if (justOpened) {
      form.reset()
      setPrompt(defaultSchedulingPrompt || '')
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
            // Auto-select connected platforms
            const platforms = new Set<PlatformType>()
            if (youtubeSchedulingEnabled && data.accounts.some((a) => a.platform === 'youtube')) {
              platforms.add('youtube')
            }
            if (instagramSchedulingEnabled && data.accounts.some((a) => a.platform === 'instagram')) {
              platforms.add('instagram')
            }
            form.setPlatforms(platforms)
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
  }, [open, organizationId, call, defaultSchedulingPrompt, youtubeSchedulingEnabled, instagramSchedulingEnabled, form])

  // Handle dialog close
  const handleClose = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  // Generate schedule with AI
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

      const data = await call<{ schedule: { shortId: string; scheduledFor: string }[] }>(
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

      form.initializeSchedule(data.schedule)
    } catch (err) {
      console.error('Error generating schedule:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate schedule')
    } finally {
      setGenerating(false)
    }
  }

  // Confirm and submit schedule
  const handleConfirmSchedule = async () => {
    if (submittingRef.current) return
    submittingRef.current = true

    if (form.state.platforms.size === 0) {
      setError('Please select at least one platform')
      submittingRef.current = false
      return
    }

    // Validate before submission
    const validationResult = form.validate()
    if (!validationResult.valid) {
      setError(`Please fix errors in ${validationResult.invalidIds.length} item(s) before scheduling`)
      submittingRef.current = false
      // Expand first invalid item
      if (validationResult.invalidIds[0]) {
        form.setExpandedId(validationResult.invalidIds[0])
      }
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

      const submissionData = form.getSubmissionData()

      for (const item of submissionData.schedules) {
        const content = item.content

        // Add YouTube schedule if selected
        if (form.state.platforms.has('youtube') && youtubeAccount && content.youtube) {
          schedules.push({
            shortId: item.shortId,
            socialAccountId: youtubeAccount.id,
            scheduledFor: item.scheduledFor,
            title: content.youtube.title,
            description: content.youtube.description || undefined,
          })
        }

        // Add Instagram schedule if selected
        if (form.state.platforms.has('instagram') && instagramAccount && content.instagram) {
          schedules.push({
            shortId: item.shortId,
            socialAccountId: instagramAccount.id,
            scheduledFor: item.scheduledFor,
            title: content.instagram.caption.slice(0, 100),
            description: content.instagram.caption,
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
        toast.success(
          `Scheduled ${data.created.length} post${data.created.length > 1 ? 's' : ''}`,
          { description: 'Check the calendar for status updates.' }
        )
      }

      if (data.errors.length > 0) {
        toast.error(
          `${data.errors.length} post${data.errors.length > 1 ? 's' : ''} failed to schedule`,
          { description: data.errors[0].error }
        )
      }

      form.reset()
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

  // Render content based on step
  const renderInputStep = () => (
    <div className="space-y-4 py-4">
      {/* Platform Selection */}
      <div>
        <label className="text-sm font-medium mb-2 block">Platforms</label>
        <div className="flex flex-wrap gap-2">
          <PlatformToggle
            platform="youtube"
            icon={SiYoutube}
            label="YouTube"
            isSelected={form.state.platforms.has('youtube')}
            isConnected={hasYouTubeAccount}
            isLoading={loadingAccounts}
            isEnabled={youtubeSchedulingEnabled}
            onToggle={() => form.togglePlatform('youtube')}
          />
          <PlatformToggle
            platform="instagram"
            icon={SiInstagram}
            label="Instagram"
            isSelected={form.state.platforms.has('instagram')}
            isConnected={hasInstagramAccount}
            isLoading={loadingAccounts}
            isEnabled={instagramSchedulingEnabled}
            onToggle={() => form.togglePlatform('instagram')}
          />
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

        {form.state.platforms.size > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            Publishing to: {Array.from(form.state.platforms).map((p) => {
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

      {/* Scheduling Prompt (only for bulk mode) */}
      {!singleMode && (
        <div>
          <label className="text-sm font-medium mb-2 block">
            How would you like to schedule these shorts?
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., Spread over the next 3 days, schedule in mornings around 9am"
            className={cn(
              "w-full min-h-[100px] px-3 py-2 border-2 border-border bg-background text-sm font-mono resize-y",
              "cyber-clip-sm",
              "placeholder:text-muted-foreground",
              "focus:outline-none focus:border-primary focus:shadow-neon-subtle",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
            disabled={generating || form.state.platforms.size === 0}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Examples: &quot;One per day for the next week&quot;, &quot;All tomorrow afternoon&quot;, &quot;Spread out evenly over 5 days, evenings preferred&quot;
          </p>
        </div>
      )}
    </div>
  )

  const renderPreviewStep = () => (
    <div className="flex-1 overflow-hidden flex flex-col py-4">
      {/* Timeline visualization */}
      {!singleMode && form.state.items.length > 1 && (
        <div className="mb-4 flex-shrink-0">
          <ScheduleTimeline
            items={form.state.items}
            conflicts={conflicts}
            onItemClick={(id) => form.setExpandedId(id)}
            highlightedId={form.state.expandedId}
          />
        </div>
      )}

      {/* Validation summary */}
      {!validation.valid && (
        <div className="flex items-center gap-2 p-2 mb-4 bg-red-500/10 border border-red-500/20 cyber-clip-sm flex-shrink-0">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-xs text-red-600 dark:text-red-400">
            {validation.invalidCount} item{validation.invalidCount !== 1 ? 's' : ''} need attention before scheduling
          </span>
        </div>
      )}

      {/* Accordion list */}
      <div className="flex-1 overflow-y-auto pr-2">
        <ScheduleAccordion
          items={form.state.items}
          expandedId={form.state.expandedId}
          onExpandedChange={form.setExpandedId}
          onItemScheduleChange={form.updateItemSchedule}
          onItemContentChange={form.updateItemContent}
          disabled={submitting}
          showValidation={true}
        />
      </div>

      {/* Timezone info */}
      <p className="text-xs text-muted-foreground mt-4 flex-shrink-0">
        Times are in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ')})
      </p>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {form.state.step === 'input'
              ? singleMode
                ? 'Schedule Short'
                : 'Bulk Schedule Shorts'
              : 'Review Schedule'}
          </DialogTitle>
          <DialogDescription>
            {form.state.step === 'input'
              ? singleMode
                ? 'Choose platforms and schedule time.'
                : `Schedule ${shorts.length} short${shorts.length > 1 ? 's' : ''} using AI-assisted scheduling.`
              : 'Review and adjust the proposed schedule before confirming.'}
          </DialogDescription>
        </DialogHeader>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Content based on step */}
        {form.state.step === 'input' ? renderInputStep() : renderPreviewStep()}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {/* Compact timeline in footer */}
          {form.state.step === 'preview' && !singleMode && form.state.items.length > 1 && (
            <div className="flex-1 hidden sm:block">
              <CompactTimeline items={form.state.items} />
            </div>
          )}

          {form.state.step === 'preview' && (
            <Button
              variant="outline"
              onClick={form.goBack}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}

          {form.state.step === 'input' ? (
            <Button
              onClick={handleGenerate}
              disabled={generating || !prompt.trim() || form.state.platforms.size === 0}
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
              disabled={submitting || form.state.items.length === 0 || form.state.platforms.size === 0 || !validation.valid}
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
                  Confirm & Schedule ({form.state.items.length * form.state.platforms.size})
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
