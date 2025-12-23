import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  FileText,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Image,
} from 'lucide-react'
import type { Transcription } from '@server/db/schema'

interface TranscriptionJob {
  status: string
  progress?: {
    phase?: string
    current?: number
    total?: number
  }
  errorMessage?: string | null
}

interface ProcessingJob {
  type: 'thumbnail' | 'transcription'
  status: string
  progress?: {
    phase?: string
    current?: number
    total?: number
  }
  errorMessage?: string | null
}

interface TranscriptionStatusProps {
  transcription: Transcription | null
  transcriptionJob: TranscriptionJob | null
  processingJob?: ProcessingJob | null
  isRetrying: boolean
  onOpenPanel: () => void
  onRetry: () => void
  compact?: boolean
  showRetranscribe?: boolean
}

export function TranscriptionStatus({
  transcription,
  transcriptionJob,
  processingJob,
  isRetrying,
  onOpenPanel,
  onRetry,
  compact = false,
  showRetranscribe = false,
}: TranscriptionStatusProps) {
  // Check for thumbnail processing FIRST (before transcription starts)
  const isThumbnailProcessing = processingJob?.type === 'thumbnail' && ['queued', 'running'].includes(processingJob.status)

  // Check for transcription processing (retrying or queued/running job)
  const isTranscribing = isRetrying || (transcriptionJob && ['queued', 'running'].includes(transcriptionJob.status))

  // Also check processingJob if it's a transcription type
  const isTranscribingFromProcessingJob = processingJob?.type === 'transcription' && ['queued', 'running'].includes(processingJob.status)
  const isProcessing = isTranscribing || isTranscribingFromProcessingJob

  // Thumbnail generation state - show before transcription starts
  if (isThumbnailProcessing) {
    return (
      <div className="flex items-center gap-3 p-3 cyber-clip-sm border-2 border-primary/30 bg-primary/5">
        <div className="w-8 h-8 cyber-clip-sm bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono uppercase tracking-wider text-foreground">
            {'>'} Generating thumbnail...
          </p>
          <p className="text-xs text-muted-foreground font-mono truncate">
            {'>'} Extracting frame from video
          </p>
        </div>
      </div>
    )
  }

  // Transcription processing state - job is running (takes priority over existing transcription)
  if (isProcessing) {
    const progress = transcriptionJob?.progress || processingJob?.progress
    const isQueued = isRetrying || transcriptionJob?.status === 'queued' || processingJob?.status === 'queued'
    const hasProgress = progress?.phase === 'transcribing' && typeof progress.current === 'number' && typeof progress.total === 'number' && progress.total > 0

    return (
      <div className="flex items-center gap-3 p-3 cyber-clip-sm border-2 border-primary/30 bg-primary/5">
        <div className="w-8 h-8 cyber-clip-sm bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono uppercase tracking-wider text-foreground">
            {'>'} Transcribing...
            {!isQueued && hasProgress && (
              <span className="ml-2 text-primary">
                [{Math.round((progress.current! / progress.total!) * 100)}%]
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground font-mono truncate">
            {isQueued
              ? '> Waiting in queue...'
              : hasProgress && progress.total! > 1
                ? `> Processing segment ${progress.current}/${progress.total}`
                : '> Processing audio'}
          </p>
        </div>
      </div>
    )
  }

  // Ready state - has transcription (and no active processing)
  if (transcription) {
    return (
      <div className="space-y-2">
        <button
          onClick={onOpenPanel}
          className="w-full flex items-center justify-between p-3 cyber-clip-sm border-2 border-border bg-card hover:bg-primary/5 hover:border-primary/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-sm font-mono uppercase tracking-wider text-foreground">Transcription</span>
            <Badge variant="default" className="text-xs">Ready</Badge>
          </div>
          <ChevronRight className="w-4 h-4 text-primary" />
        </button>

        {/* Re-transcribe button (dev mode) */}
        {showRetranscribe && (
          <Button
            onClick={onRetry}
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground font-mono uppercase tracking-wider text-xs"
            disabled={isRetrying}
          >
            <RefreshCw className={`w-3 h-3 mr-1.5 ${isRetrying ? 'animate-spin' : ''}`} />
            Re-transcribe
          </Button>
        )}
      </div>
    )
  }

  // Failed state - job failed
  if (transcriptionJob && transcriptionJob.status === 'failed') {
    return (
      <div className="p-3 cyber-clip-sm border-2 border-destructive/30 bg-destructive/5">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-4 h-4 text-destructive" />
          <span className="text-sm font-mono uppercase tracking-wider text-foreground">{'>'} ERROR: Transcription Failed</span>
        </div>
        {transcriptionJob.errorMessage && (
          <p className="text-xs text-muted-foreground font-mono mb-2 line-clamp-2">
            {transcriptionJob.errorMessage}
          </p>
        )}
        <Button
          onClick={onRetry}
          disabled={isRetrying}
          variant="outline"
          size="sm"
          className="border-destructive/30 hover:bg-destructive/10"
        >
          <RefreshCw className={`w-3 h-3 mr-1.5 ${isRetrying ? 'animate-spin' : ''}`} />
          Retry
        </Button>
      </div>
    )
  }

  // Not available state - no transcription and no job
  return (
    <div className="flex items-center gap-2 p-3 cyber-clip-sm border-2 border-border bg-muted/30">
      <FileText className="w-4 h-4 text-muted-foreground" />
      <span className="text-sm font-mono text-muted-foreground">{'>'} No transcription available</span>
    </div>
  )
}
