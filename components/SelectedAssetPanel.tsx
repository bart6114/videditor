import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TranscriptionStatus } from '@/components/TranscriptionStatus'
import { GenerateShortsForm } from '@/components/GenerateShortsForm'
import { InlineManualEditor } from '@/components/InlineManualEditor'
import { LazyVideoPlayer } from '@/components/LazyVideoPlayer'
import { Pencil, X, Sparkles } from 'lucide-react'
import type { MediaAsset } from '@/types/projects'
import type { Transcription, Short } from '@server/db/schema'
import type { UserSettings } from '@/hooks/useUserSettings'

type PanelMode = 'ai' | 'manual'

interface TranscriptionJob {
  status: string
  progress?: {
    phase?: string
    current?: number
    total?: number
  }
  errorMessage?: string | null
}

type AnalysisJob = {
  id: string
  status: string
  progress?: {
    phase: 'analyzing' | 'generating'
    current: number
    total: number
  }
}

interface SelectedAssetPanelProps {
  asset: MediaAsset
  projectId: string
  onClose: () => void
  // Transcription props
  transcription: Transcription | null
  transcriptionJob: TranscriptionJob | null
  isRetryingTranscription: boolean
  onOpenTranscriptionPanel: () => void
  onRetryTranscription: () => void
  // Generation props
  existingShorts: Short[]
  isGenerating: boolean
  hasActiveJob: boolean
  activeJob?: AnalysisJob | null
  lastAnalysisJobId?: string | null
  isProcessingShorts: boolean
  userCredits: number | null
  userSettings: UserSettings | null
  onGenerateStart: () => void
  onGenerateComplete: (jobId: string) => void
  onGenerateError: (error: Error) => void
  refreshCredits: () => void
  // Manual edit callback
  onShortCreated: () => void
}

export function SelectedAssetPanel({
  asset,
  projectId,
  onClose,
  transcription,
  transcriptionJob,
  isRetryingTranscription,
  onOpenTranscriptionPanel,
  onRetryTranscription,
  existingShorts,
  isGenerating,
  hasActiveJob,
  activeJob,
  lastAnalysisJobId,
  isProcessingShorts,
  userCredits,
  userSettings,
  onGenerateStart,
  onGenerateComplete,
  onGenerateError,
  refreshCredits,
  onShortCreated,
}: SelectedAssetPanelProps) {
  const [mode, setMode] = useState<PanelMode>('ai')
  const hasTranscription = !!transcription
  const isReady = asset.status === 'ready' || asset.status === 'completed'

  return (
    <Card className="bg-card border-border mt-6 animate-slide-up">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="text-primary truncate normal-case">{asset.title}</CardTitle>
            <CardDescription className="text-muted-foreground font-mono">
              {mode === 'ai' ? '> Generate shorts with AI' : '> Select words to create a short'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Mode Toggle */}
            {hasTranscription && isReady && (
              <div className="flex cyber-clip-sm border-2 border-border p-0.5 bg-muted/30">
                <Button
                  variant={mode === 'ai' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setMode('ai')}
                  className="h-7 px-2.5 text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  AI Generate
                </Button>
                <Button
                  variant={mode === 'manual' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setMode('manual')}
                  className="h-7 px-2.5 text-xs"
                >
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  Manual Edit
                </Button>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-muted-foreground hover:text-primary h-7 w-7 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {mode === 'ai' ? (
          /* AI Mode Content */
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left: Video Player */}
            <div className="space-y-4">
              <LazyVideoPlayer
                videoUrl={asset.videoUrl}
                thumbnailUrl={asset.thumbnailUrl}
                title={asset.title}
                className="cyber-clip border-2 border-border"
              />
            </div>

            {/* Right: Transcription + Generate Shorts */}
            <div className="space-y-4">
              {/* Transcription Status */}
              <TranscriptionStatus
                transcription={transcription}
                transcriptionJob={transcriptionJob}
                isRetrying={isRetryingTranscription}
                onOpenPanel={onOpenTranscriptionPanel}
                onRetry={onRetryTranscription}
                showRetranscribe={process.env.NODE_ENV === 'development'}
              />

              {/* Generate Shorts Form */}
              {hasTranscription && isReady && (
                <GenerateShortsForm
                  projectId={projectId}
                  assetId={asset.id}
                  hasTranscription={hasTranscription}
                  existingShortsCount={existingShorts.length}
                  isGenerating={isGenerating}
                  hasActiveJob={hasActiveJob}
                  activeJob={activeJob}
                  lastAnalysisJobId={lastAnalysisJobId}
                  shorts={existingShorts}
                  isProcessingShorts={isProcessingShorts}
                  userCredits={userCredits}
                  defaultSettings={userSettings}
                  onGenerateStart={onGenerateStart}
                  onGenerateComplete={(jobId) => {
                    onGenerateComplete(jobId)
                    refreshCredits()
                  }}
                  onGenerateError={(error) => {
                    onGenerateError(error)
                    refreshCredits()
                  }}
                />
              )}

              {/* Waiting for transcription message */}
              {!hasTranscription && isReady && (
                <div className="p-4 cyber-clip-sm border-2 border-border bg-muted/30">
                  <p className="text-sm text-muted-foreground font-mono">
                    {'>'} Waiting for transcription to complete before shorts can be generated.
                  </p>
                </div>
              )}

              {/* Asset not ready message */}
              {!isReady && (
                <div className="p-4 cyber-clip-sm border-2 border-border bg-muted/30">
                  <p className="text-sm text-muted-foreground font-mono">
                    {'>'} This video is still being processed. Generation will be available once processing completes.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Manual Edit Mode Content */
          <InlineManualEditor
            asset={asset}
            projectId={projectId}
            transcription={transcription!}
            onShortCreated={() => {
              setMode('ai')
              onShortCreated()
            }}
          />
        )}
      </CardContent>
    </Card>
  )
}
