import { useRef, useEffect, useCallback, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Minus, Plus } from 'lucide-react'
import type { Word } from '@/hooks/useManualEditor'

interface WordTranscriptionProps {
  words: Word[]
  currentWordId: string | null
  onWordClick: (time: number) => void
  onDisableWords: (wordIds: string[]) => void
  onEnableWords: (wordIds: string[]) => void
  className?: string
}

interface ToolbarState {
  visible: boolean
  x: number
  y: number
  selectedWordIds: string[]
  hasSelected: boolean    // Has words that can be removed
  hasDeselected: boolean  // Has words that can be recovered
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
  onEnableWords,
  className,
}: WordTranscriptionProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [toolbar, setToolbar] = useState<ToolbarState>({
    visible: false,
    x: 0,
    y: 0,
    selectedWordIds: [],
    hasSelected: false,
    hasDeselected: false,
  })

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
            setToolbar(prev => ({ ...prev, visible: false }))
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onDisableWords])

  // Listen for selection changes to show/hide floating toolbar
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection()
      if (!selection || !selection.toString().trim() || !containerRef.current) {
        setToolbar(prev => ({ ...prev, visible: false }))
        return
      }

      // Check if selection is within our container
      const range = selection.getRangeAt(0)
      if (!containerRef.current.contains(range.commonAncestorContainer)) {
        setToolbar(prev => ({ ...prev, visible: false }))
        return
      }

      const selectedWordIds = getSelectedWordIds(selection, containerRef.current)
      if (selectedWordIds.length === 0) {
        setToolbar(prev => ({ ...prev, visible: false }))
        return
      }

      // Check which types of words are in the selection
      const hasSelected = selectedWordIds.some(id => {
        const word = words.find(w => w.id === id)
        return word?.selected === true
      })
      const hasDeselected = selectedWordIds.some(id => {
        const word = words.find(w => w.id === id)
        return word?.selected === false
      })

      // Position toolbar above the selection (using viewport coordinates for fixed positioning)
      const rect = range.getBoundingClientRect()

      setToolbar({
        visible: true,
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
        selectedWordIds,
        hasSelected,
        hasDeselected,
      })
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [words])

  const handleRemove = useCallback(() => {
    if (toolbar.selectedWordIds.length > 0) {
      onDisableWords(toolbar.selectedWordIds)
      window.getSelection()?.removeAllRanges()
      setToolbar(prev => ({ ...prev, visible: false }))
    }
  }, [toolbar.selectedWordIds, onDisableWords])

  const handleRecover = useCallback(() => {
    if (toolbar.selectedWordIds.length > 0) {
      onEnableWords(toolbar.selectedWordIds)
      window.getSelection()?.removeAllRanges()
      setToolbar(prev => ({ ...prev, visible: false }))
    }
  }, [toolbar.selectedWordIds, onEnableWords])

  const handleWordClick = useCallback((time: number) => {
    onWordClick(time)
  }, [onWordClick])

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-y-auto overflow-x-hidden p-4 bg-muted/30 rounded-lg select-text custom-scrollbar",
        className
      )}
    >
      {/* Floating toolbar - fixed position relative to viewport */}
      {toolbar.visible && (toolbar.hasSelected || toolbar.hasDeselected) && (
        <div
          className="fixed z-50 flex gap-1 bg-popover border border-border rounded-lg shadow-lg p-1"
          style={{
            left: toolbar.x,
            top: toolbar.y,
            transform: 'translate(-50%, -100%)',
          }}
          onMouseDown={(e) => e.preventDefault()} // Prevent losing selection
        >
          {toolbar.hasSelected && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={handleRemove}
            >
              <Minus className="w-3 h-3 mr-1" />
              Remove
            </Button>
          )}
          {toolbar.hasDeselected && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={handleRecover}
            >
              <Plus className="w-3 h-3 mr-1" />
              Recover
            </Button>
          )}
        </div>
      )}

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

              {/* Word span */}
              <span
                data-word-id={word.id}
                onClick={() => handleWordClick(word.start)}
                className={cn(
                  "cursor-pointer inline-block rounded px-0.5",
                  // Word state styles
                  word.selected
                    ? "text-foreground hover:bg-primary/10"
                    : "line-through text-muted-foreground opacity-60 hover:bg-destructive/10",
                  // Current playing word highlight
                  currentWordId === word.id && "bg-yellow-400/30"
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
    </div>
  )
}
