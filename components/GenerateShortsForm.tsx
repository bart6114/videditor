import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useApi } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { SocialPlatformSelector } from '@/components/SocialPlatformSelector'
import { GenerationProgress } from '@/components/GenerationProgress'
import {
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type { SocialPlatform, ShortFormMetadata } from '@shared/index'
import type { UserSettings } from '@/hooks/useUserSettings'
import type { Short } from '@server/db/schema'

type AnalysisJob = {
  id: string
  status: string
  progress?: {
    phase: 'analyzing' | 'generating'
    current: number
    total: number
  }
}

interface GenerateShortsFormProps {
  projectId: string
  assetId: string
  hasTranscription: boolean
  existingShortsCount: number
  isGenerating: boolean
  hasActiveJob: boolean
  isProcessingShorts: boolean
  userCredits: number | null
  defaultSettings: UserSettings | null
  activeJob?: AnalysisJob | null
  lastAnalysisJobId?: string | null
  shorts?: Short[]
  onGenerateStart: () => void
  onGenerateComplete: (jobId: string) => void
  onGenerateError: (error: Error) => void
  compact?: boolean
}

export function GenerateShortsForm({
  projectId,
  assetId,
  hasTranscription,
  existingShortsCount,
  isGenerating,
  hasActiveJob,
  isProcessingShorts,
  userCredits,
  defaultSettings,
  activeJob,
  lastAnalysisJobId,
  shorts = [],
  onGenerateStart,
  onGenerateComplete,
  onGenerateError,
  compact = false,
}: GenerateShortsFormProps) {
  const { call } = useApi()

  // Form state
  const [shortsCount, setShortsCount] = useState(3)
  const [preferredLength, setPreferredLength] = useState<number | ''>(45)
  const [maxLength, setMaxLength] = useState<number | ''>(60)
  const [customPrompt, setCustomPrompt] = useState('')
  const [customSocialPrompt, setCustomSocialPrompt] = useState('')
  const [avoidExistingOverlap, setAvoidExistingOverlap] = useState(false)
  const [socialPlatforms, setSocialPlatforms] = useState<SocialPlatform[]>([])
  const [settingsApplied, setSettingsApplied] = useState(false)
  const [showAnalysisPrompt, setShowAnalysisPrompt] = useState(false)
  const [showSocialPrompt, setShowSocialPrompt] = useState(false)
  const [showInsufficientCredits, setShowInsufficientCredits] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)

  // Apply user's default settings to form inputs when loaded
  useEffect(() => {
    if (settingsApplied || !defaultSettings) return

    if (defaultSettings.defaultCustomPrompt) {
      setCustomPrompt(defaultSettings.defaultCustomPrompt)
      setShowAnalysisPrompt(true)
    }
    if (defaultSettings.defaultSocialPrompt) {
      setCustomSocialPrompt(defaultSettings.defaultSocialPrompt)
      setShowSocialPrompt(true)
    }
    if (defaultSettings.defaultSocialPlatforms.length > 0) {
      setSocialPlatforms(defaultSettings.defaultSocialPlatforms)
    }
    setAvoidExistingOverlap(defaultSettings.defaultAvoidOverlap)
    if (defaultSettings.defaultPreferredLength) {
      setPreferredLength(defaultSettings.defaultPreferredLength)
    }
    if (defaultSettings.defaultMaxLength) {
      setMaxLength(defaultSettings.defaultMaxLength)
    }
    setSettingsApplied(true)
  }, [defaultSettings, settingsApplied])

  async function handleAnalyze() {
    // Check credits before proceeding
    if (userCredits !== null && userCredits < shortsCount) {
      setShowInsufficientCredits(true)
      return
    }
    setShowInsufficientCredits(false)

    setAnalyzing(true)
    onGenerateStart()

    try {
      const jobData = await call<{ job: { id: string; status: string } }>(`/v1/projects/${projectId}/jobs`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'analysis',
          payload: {
            mediaAssetId: assetId,
            shortsCount,
            preferredLength: preferredLength || 45,
            maxLength: maxLength || 60,
            customPrompt: customPrompt.trim() || undefined,
            customSocialPrompt: customSocialPrompt.trim() || undefined,
            avoidExistingOverlap: avoidExistingOverlap || undefined,
            socialPlatforms: socialPlatforms.length > 0 ? socialPlatforms : undefined,
          },
        }),
      })

      onGenerateComplete(jobData.job.id)
    } catch (error) {
      console.error('Error analyzing:', error)
      onGenerateError(error instanceof Error ? error : new Error('Failed to generate shorts'))
    } finally {
      setAnalyzing(false)
    }
  }

  // Check if there are shorts from the current job still being processed
  const hasProcessingShortsFromCurrentJob = useMemo(() => {
    if (!lastAnalysisJobId) return false
    return shorts.some((s) => {
      const meta = s.metadata as ShortFormMetadata | null
      return (
        meta?.analysisJobId === lastAnalysisJobId &&
        (s.status === 'uploading' || s.status === 'ready' || s.status === 'processing')
      )
    })
  }, [shorts, lastAnalysisJobId])

  // Show progress when generating, there's an active job, OR shorts from current job are processing
  const showProgress = isGenerating || hasActiveJob || hasProcessingShortsFromCurrentJob

  const isDisabled = analyzing || isGenerating || hasActiveJob || !hasTranscription || userCredits === null || isProcessingShorts

  return (
    <div className="space-y-4">
      {/* Number of shorts */}
      <div>
        <label className="text-xs font-mono uppercase tracking-wider mb-2 block text-muted-foreground">
          Number of Shorts
        </label>
        <Input
          type="number"
          min={1}
          max={15}
          value={shortsCount || ''}
          onChange={(e) => {
            const val = e.target.value
            setShowInsufficientCredits(false)
            if (val === '') {
              setShortsCount(0)
            } else {
              const parsed = parseInt(val, 10)
              if (!isNaN(parsed)) {
                setShortsCount(parsed)
              }
            }
          }}
          onBlur={() => {
            const clamped = Math.max(1, Math.min(15, shortsCount || 1))
            setShortsCount(clamped)
          }}
          disabled={isDisabled}
          className="bg-background border-input text-foreground"
        />
      </div>

      {/* Length inputs */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-mono uppercase tracking-wider mb-2 block text-muted-foreground">
            Preferred Length (s)
          </label>
          <Input
            type="number"
            min={15}
            max={120}
            value={preferredLength}
            onChange={(e) => {
              const val = e.target.value
              if (val === '') {
                setPreferredLength('')
              } else {
                const parsed = parseInt(val)
                if (!isNaN(parsed)) setPreferredLength(parsed)
              }
            }}
            onBlur={() => {
              const clamped = Math.max(15, Math.min(120, preferredLength || 15))
              setPreferredLength(clamped)
              const maxVal = typeof maxLength === 'number' ? maxLength : 60
              if (maxVal < clamped) setMaxLength(clamped)
            }}
            disabled={isDisabled}
            className="bg-background border-input text-foreground"
          />
        </div>
        <div>
          <label className="text-xs font-mono uppercase tracking-wider mb-2 block text-muted-foreground">
            Max Length (s)
          </label>
          <Input
            type="number"
            min={15}
            max={120}
            value={maxLength}
            onChange={(e) => {
              const val = e.target.value
              if (val === '') {
                setMaxLength('')
              } else {
                const parsed = parseInt(val)
                if (!isNaN(parsed)) setMaxLength(parsed)
              }
            }}
            onBlur={() => {
              const prefVal = typeof preferredLength === 'number' ? preferredLength : 45
              const clamped = Math.max(15, Math.min(120, maxLength || 15))
              setMaxLength(Math.max(clamped, prefVal))
            }}
            disabled={isDisabled}
            className="bg-background border-input text-foreground"
          />
        </div>
      </div>

      {/* Custom analysis instructions (collapsible) */}
      <div className="border-2 border-border cyber-clip-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAnalysisPrompt(!showAnalysisPrompt)}
          disabled={isDisabled}
          className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-primary/5 transition-colors disabled:opacity-50"
        >
          <span className="text-xs font-mono uppercase tracking-wider text-foreground">
            Custom Analysis Instructions
          </span>
          {showAnalysisPrompt ? (
            <ChevronUp className="w-4 h-4 text-primary" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        {showAnalysisPrompt && (
          <div className="p-3 border-t-2 border-border">
            <textarea
              placeholder="> Focus on educational content, prefer clips with strong hooks..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              disabled={isDisabled}
              rows={2}
              className="w-full px-3 py-2 text-sm font-mono bg-background border-2 border-border cyber-clip-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none"
            />
          </div>
        )}
      </div>

      {/* Avoid overlap toggle */}
      {existingShortsCount > 0 && (
        <div className="flex items-center gap-3">
          <Switch
            id={`avoidOverlap-${assetId}`}
            checked={avoidExistingOverlap}
            onCheckedChange={setAvoidExistingOverlap}
            disabled={isDisabled}
          />
          <label htmlFor={`avoidOverlap-${assetId}`} className="text-xs font-mono uppercase tracking-wider text-foreground cursor-pointer">
            Avoid overlap with existing shorts
          </label>
        </div>
      )}

      {/* Social platform selection with optional instructions */}
      <SocialPlatformSelector
        value={socialPlatforms}
        onChange={setSocialPlatforms}
        disabled={isDisabled}
        socialPrompt={customSocialPrompt}
        onSocialPromptChange={setCustomSocialPrompt}
        socialPromptExpanded={showSocialPrompt}
        onSocialPromptExpandedChange={setShowSocialPrompt}
      />

      {/* Action buttons and credit indicator */}
      <div className="space-y-2">
        <Button
          onClick={handleAnalyze}
          disabled={isDisabled}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          size={compact ? 'sm' : 'default'}
        >
          {analyzing || isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : showProgress ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              In progress...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate {shortsCount} Shorts
            </>
          )}
        </Button>

        {/* Generation Progress */}
        {showProgress && (
          <GenerationProgress
            activeJob={activeJob ?? null}
            lastAnalysisJobId={lastAnalysisJobId ?? null}
            shorts={shorts}
            isStarting={isGenerating && !activeJob}
          />
        )}

        {/* Credit cost indicator - hide when generation is in progress */}
        {!showProgress && (
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-muted-foreground">
              {'>'} Cost: {shortsCount} credit{shortsCount !== 1 ? 's' : ''}
            </span>
            {userCredits !== null && (
              <span className={userCredits < shortsCount ? 'text-destructive' : 'text-primary'}>
                [{userCredits}]
              </span>
            )}
          </div>
        )}

        {/* Insufficient credits warning */}
        {showInsufficientCredits && userCredits !== null && (
          <div className="p-2 bg-destructive/10 border-2 border-destructive/30 cyber-clip-sm">
            <p className="text-xs font-mono text-destructive">
              {'>'} ERROR: Insufficient credits. Need {shortsCount - userCredits} more.{' '}
              <Link href="/settings/billing" className="underline font-medium hover:text-destructive/80">
                Add credits
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
