import { useMemo } from 'react'
import { Progress } from '@/components/ui/progress'
import { Search, Zap, Film, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import type { Short } from '@server/db/schema'
import type { ShortFormMetadata } from '@shared/index'

type AnalysisJob = {
  id: string
  status: string
  progress?: {
    phase: 'analyzing' | 'generating'
    current: number
    total: number
  }
}

type GenerationPhase =
  | { stage: 'starting' }
  | { stage: 'analyzing' }
  | { stage: 'queuing'; current: number; total: number }
  | { stage: 'processing'; completed: number; failed: number; total: number }
  | { stage: 'complete'; successful: number; failed: number; total: number }

interface GenerationProgressProps {
  activeJob: AnalysisJob | null
  lastAnalysisJobId: string | null
  shorts: Short[]
  isStarting?: boolean
}

function calculateProgress(
  activeJob: AnalysisJob | null,
  lastAnalysisJobId: string | null,
  shorts: Short[],
  isStarting?: boolean
): { phase: GenerationPhase; percentage: number } | null {
  // Phase 0: Just clicked button, waiting for job to be created
  if (isStarting && !activeJob) {
    return {
      phase: { stage: 'starting' },
      percentage: 3,
    }
  }
  // Filter shorts to only those from the current generation job
  const jobShorts = shorts.filter((s) => {
    const meta = s.metadata as ShortFormMetadata | null
    return meta?.analysisJobId === lastAnalysisJobId
  })

  // Phase 1: Analysis job is running with 'analyzing' phase
  if (activeJob?.progress?.phase === 'analyzing') {
    return {
      phase: { stage: 'analyzing' },
      percentage: 10,
    }
  }

  // Phase 2: Analysis job is running with 'generating' phase (creating shorts)
  if (activeJob?.progress?.phase === 'generating') {
    const { current, total } = activeJob.progress
    const progressInPhase = total > 0 ? (current / total) * 10 : 0
    return {
      phase: { stage: 'queuing', current, total },
      percentage: 20 + progressInPhase,
    }
  }

  // Phase 3 & 4: Analysis job complete, track short processing
  if (lastAnalysisJobId && jobShorts.length > 0) {
    const completed = jobShorts.filter((s) => s.status === 'completed').length
    const failed = jobShorts.filter((s) => s.status === 'error').length
    const total = jobShorts.length
    const done = completed + failed

    // All done - complete phase
    if (done === total) {
      return {
        phase: { stage: 'complete', successful: completed, failed, total },
        percentage: 100,
      }
    }

    // Still processing
    const progressInPhase = total > 0 ? (done / total) * 65 : 0
    return {
      phase: { stage: 'processing', completed, failed, total },
      percentage: 30 + progressInPhase,
    }
  }

  // No active generation
  return null
}

export function GenerationProgress({
  activeJob,
  lastAnalysisJobId,
  shorts,
  isStarting,
}: GenerationProgressProps) {
  const progress = useMemo(
    () => calculateProgress(activeJob, lastAnalysisJobId, shorts, isStarting),
    [activeJob, lastAnalysisJobId, shorts, isStarting]
  )

  if (!progress) return null

  const { phase, percentage } = progress

  // Determine icon and text based on phase
  let icon: React.ReactNode
  let text: string
  let textColor = 'text-muted-foreground'

  switch (phase.stage) {
    case 'starting':
      icon = <Loader2 className="w-4 h-4 animate-spin text-primary" />
      text = '> Initializing generation...'
      break
    case 'analyzing':
      icon = <Search className="w-4 h-4 animate-pulse text-primary" />
      text = '> Analyzing transcript...'
      break
    case 'queuing':
      icon = <Zap className="w-4 h-4 animate-pulse text-primary" />
      text = `> Creating ${phase.total} short${phase.total !== 1 ? 's' : ''}...`
      break
    case 'processing':
      icon = <Film className="w-4 h-4 animate-pulse text-primary" />
      const done = phase.completed + phase.failed
      text = `> Processing: [${done}/${phase.total}]`
      break
    case 'complete':
      if (phase.failed > 0) {
        icon = <AlertCircle className="w-4 h-4 text-amber-500" />
        text = `> DONE: ${phase.successful} OK, ${phase.failed} FAIL`
        textColor = 'text-amber-500'
      } else {
        icon = <CheckCircle2 className="w-4 h-4 text-primary" />
        text = `> COMPLETE: ${phase.successful} short${phase.successful !== 1 ? 's' : ''} generated`
        textColor = 'text-primary'
      }
      break
  }

  return (
    <div className="space-y-2">
      {/* Progress bar with percentage */}
      <div className="flex items-center gap-3">
        <Progress value={percentage} className="flex-1 h-2" />
        <span className="text-xs font-mono text-primary w-12 text-right">
          [{Math.round(percentage)}%]
        </span>
      </div>

      {/* Phase indicator */}
      <div className={`flex items-center justify-center gap-2 text-sm font-mono ${textColor}`}>
        {icon}
        <span>{text}</span>
      </div>
    </div>
  )
}
