import { useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { Word } from '@/pages/editor/[projectId]'

interface WordTranscriptionProps {
  words: Word[]
  currentWordId: string | null
  onWordClick: (time: number) => void
  onDisableWords: (wordIds: string[]) => void
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function getSelectedWordIds(selection: Selection, container: HTMLElement | null): string[] {
  if (!container || selection.rangeCount === 0) return []

  const range = selection.getRangeAt(0)
  const wordSpans = container.querySelectorAll('[data-word-id]')
  const selectedIds: string[] = []

  wordSpans.forEach(span => {
    if (range.intersectsNode(span)) {
      const wordId = span.getAttribute('data-word-id')
      if (wordId) selectedIds.push(wordId)
    }
  })

  return selectedIds
}

export default function WordTranscription({
  words,
  currentWordId,
  onWordClick,
  onDisableWords,
}: WordTranscriptionProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Listen for backspace to disable selected words
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, [contenteditable]')) return

      if (e.key === 'Backspace') {
        const selection = window.getSelection()
        if (selection && selection.toString().trim()) {
          e.preventDefault()
          const selectedWordIds = getSelectedWordIds(selection, containerRef.current)
          if (selectedWordIds.length > 0) {
            onDisableWords(selectedWordIds)
            selection.removeAllRanges()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onDisableWords])

  const handleWordClick = useCallback((time: number) => {
    onWordClick(time)
  }, [onWordClick])

  return (
    <div
      ref={containerRef}
      className="max-h-[500px] overflow-y-auto overflow-x-hidden p-4 bg-muted/30 rounded-lg select-text custom-scrollbar"
    >
      <div className="leading-relaxed">
        {words.map((word, index) => {
          const isNewSpeaker = index === 0 || word.speaker !== words[index - 1].speaker

          return (
            <span key={word.id}>
              {/* Line break before new speaker (except first) */}
              {isNewSpeaker && index > 0 && (
                <>
                  <br />
                  <br />
                </>
              )}

              {/* Speaker label at start of speaker block */}
              {isNewSpeaker && (
                <span className="text-xs text-muted-foreground font-mono mr-2">
                  [{formatTimestamp(word.start)}]
                  {word.speaker && (
                    <span className="ml-1 font-medium text-primary">{word.speaker}:</span>
                  )}
                </span>
              )}

              {/* Word span with tooltip */}
              <span
                data-word-id={word.id}
                onClick={() => handleWordClick(word.start)}
                className={cn(
                  "relative cursor-pointer inline-block",
                  // Tooltip styles
                  "after:absolute after:bottom-full after:left-1/2",
                  "after:-translate-x-1/2 after:mb-1 after:px-2 after:py-1 after:text-xs",
                  "after:bg-popover after:text-popover-foreground after:rounded after:shadow-md",
                  "after:opacity-0 after:invisible hover:after:opacity-100 hover:after:visible",
                  "after:transition-opacity after:whitespace-nowrap after:z-10",
                  // Tooltip content based on state
                  word.selected
                    ? "after:content-['Remove']"
                    : "after:content-['Recover']",
                  // Word state styles
                  word.selected
                    ? "text-foreground hover:bg-primary/10 rounded"
                    : "line-through text-muted-foreground opacity-60 hover:bg-destructive/10 rounded",
                  // Current playing word highlight
                  currentWordId === word.id && "bg-yellow-400/30 rounded"
                )}
              >
                {word.text}
              </span>

              {/* Space after word */}
              {' '}
            </span>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-4 text-center border-t border-border/50 pt-4">
        Click words to seek. Select text + Backspace to remove.
      </p>
    </div>
  )
}
