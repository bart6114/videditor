import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface TranscriptionSegment {
  start: number
  end: number
  text: string
  speaker: string | null
}

interface TranscriptionSidePanelProps {
  transcription: {
    text: string
    segments?: TranscriptionSegment[]
  } | null
  isOpen: boolean
  onClose: () => void
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

interface MergedSegment {
  start: number
  end: number
  text: string
  speaker: string | null
}

function mergeConsecutiveSpeakerSegments(segments: TranscriptionSegment[]): MergedSegment[] {
  if (segments.length === 0) return []

  const merged: MergedSegment[] = []
  let current: MergedSegment = { ...segments[0] }

  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i]
    if (segment.speaker === current.speaker) {
      // Same speaker - merge text and extend end time
      current.text = current.text + ' ' + segment.text
      current.end = segment.end
    } else {
      // Different speaker - push current and start new
      merged.push(current)
      current = { ...segment }
    }
  }
  merged.push(current)

  return merged
}

export function TranscriptionSidePanel({
  transcription,
  isOpen,
  onClose,
}: TranscriptionSidePanelProps) {
  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!transcription) return null

  const hasSegments = transcription.segments && transcription.segments.length > 0
  const mergedSegments = hasSegments
    ? mergeConsecutiveSpeakerSegments(transcription.segments!)
    : []

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Side Panel */}
      <div
        className={`fixed inset-0 md:inset-auto md:top-0 md:right-0 md:h-full md:w-[55%] lg:w-[50%] xl:w-[45%] bg-background md:border-l border-border shadow-2xl z-50 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-border">
            <h2 className="text-base md:text-lg font-semibold text-foreground">
              Transcription
            </h2>
            <Button size="icon" variant="ghost" onClick={onClose} className="min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0">
              <X className="w-5 h-5" />
              <span className="sr-only">Close</span>
            </Button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 md:p-6">
              {hasSegments ? (
                <div className="space-y-0">
                  {mergedSegments.map((segment, idx) => (
                    <div
                      key={idx}
                      className="flex gap-3 py-2 border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      {/* Timestamp */}
                      <span className="text-xs text-muted-foreground font-mono w-12 shrink-0 pt-0.5">
                        {formatTimestamp(segment.start)}
                      </span>

                      {/* Speaker label (if present) */}
                      {segment.speaker && (
                        <span className="text-xs font-medium text-primary w-6 shrink-0 pt-0.5">
                          {segment.speaker}
                        </span>
                      )}

                      {/* Text */}
                      <p className="text-sm text-foreground/80 leading-relaxed flex-1">
                        {segment.text}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                  {transcription.text}
                </p>
              )}
            </div>
          </div>

          {/* Footer hint - hidden on mobile */}
          <div className="p-4 border-t border-border hidden md:block">
            <p className="text-xs text-muted-foreground text-center">
              Press ESC to close
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
