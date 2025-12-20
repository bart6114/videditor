import { memo, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TranscriptionStatus } from '@/components/TranscriptionStatus'
import { GenerateShortsForm } from '@/components/GenerateShortsForm'
import { InlineManualEditor } from '@/components/InlineManualEditor'
import { Play, Pencil, Loader2, X, Sparkles } from 'lucide-react'
import type { MediaAsset } from '@/types/projects'
import type { Transcription, Short } from '@server/db/schema'
import type { UserSettings } from '@/hooks/useUserSettings'

const ReactPlayer = dynamic(() => import('react-player'), { ssr: false })

type PanelMode = 'ai' | 'manual'

// Memoized video player to prevent re-renders during generation status updates
interface VideoPlayerProps {
  videoUrl?: string | null
  thumbnailUrl?: string | null
  title: string
}

const VideoPlayer = memo(function VideoPlayer({ videoUrl, thumbnailUrl, title }: VideoPlayerProps) {
  if (videoUrl) {
    return (
      <ReactPlayer
        url={videoUrl}
        controls
        width="100%"
        height="100%"
      />
    )
  }

  if (thumbnailUrl) {
    return (
      <div className="relative w-full h-full">
        <Image
          src={thumbnailUrl}
          alt={title}
          fill
          className="object-contain"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="text-center text-white">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
            <p className="text-sm">Video loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
      <Play className="w-12 h-12" />
    </div>
  )
})

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
    <Card className="bg-card border-border mt-6">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="text-foreground truncate">{asset.title}</CardTitle>
            <CardDescription className="text-muted-foreground">
              {mode === 'ai' ? 'Generate shorts with AI' : 'Select words to create a short'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Mode Toggle */}
            {hasTranscription && isReady && (
              <div className="flex rounded-lg border border-border p-0.5 bg-muted/30">
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
              className="text-muted-foreground hover:text-foreground h-7 w-7 p-0"
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
              <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                <VideoPlayer
                  videoUrl={asset.videoUrl}
                  thumbnailUrl={asset.thumbnailUrl}
                  title={asset.title}
                />
              </div>
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
                <div className="p-4 rounded-lg border border-border bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    Waiting for transcription to complete before shorts can be generated.
                  </p>
                </div>
              )}

              {/* Asset not ready message */}
              {!isReady && (
                <div className="p-4 rounded-lg border border-border bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    This video is still being processed. Generation will be available once processing completes.
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
