import { useState, useMemo, useCallback, Dispatch, SetStateAction } from 'react'
import type { Transcription } from '@server/db/schema'
import type { TimeRange } from '@shared/index'

// Word type with timestamp and selection state
export interface Word {
  id: string
  text: string
  start: number
  end: number
  selected: boolean
  speaker: string | null
  confidence?: number
}

// Type for word-level transcription data (stored in transcriptions.segments)
// Deepgram provides per-word timestamps, speaker diarization, and confidence scores
type TranscriptWord = {
  start: number
  end: number
  text: string
  speaker: string | null
  confidence?: number
}

// Map word-level transcription data directly to Word array
// No interpolation needed - Deepgram provides accurate per-word timestamps
function mapTranscriptWords(transcriptWords: TranscriptWord[]): Word[] {
  return transcriptWords.map((word, index) => ({
    id: `word-${index}`,
    text: word.text,
    start: word.start,
    end: word.end,
    selected: true, // Default: all words selected
    speaker: word.speaker,
    confidence: word.confidence,
  }))
}

// Get selected time ranges from word selection
export function getSelectedRanges(words: Word[]): TimeRange[] {
  const ranges: TimeRange[] = []
  let currentRange: TimeRange | null = null

  words.forEach((word) => {
    if (word.selected) {
      if (currentRange && word.start - currentRange.end < 0.1) {
        // Extend current range
        currentRange.end = word.end
      } else {
        // Start new range
        if (currentRange) ranges.push(currentRange)
        currentRange = { start: word.start, end: word.end }
      }
    } else if (currentRange) {
      ranges.push(currentRange)
      currentRange = null
    }
  })

  if (currentRange) ranges.push(currentRange)
  return ranges
}

// Format duration as MM:SS
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export interface UseManualEditorReturn {
  words: Word[]
  setWords: Dispatch<SetStateAction<Word[]>>
  selectedRanges: TimeRange[]
  selectedDuration: number
  currentTime: number
  setCurrentTime: (time: number) => void
  currentWordId: string | null
  disableWords: (wordIds: string[]) => void
  enableWords: (wordIds: string[]) => void
  handleRangeChange: (start: number, end: number) => void
  getTranscriptionSlice: () => string
  resetWords: () => void
}

export function useManualEditor(transcription: Transcription | null): UseManualEditorReturn {
  // Initialize words from transcription
  const initialWords = useMemo(() => {
    if (!transcription?.segments) return []
    return mapTranscriptWords(transcription.segments as TranscriptWord[])
  }, [transcription])

  const [words, setWords] = useState<Word[]>(initialWords)
  const [currentTime, setCurrentTime] = useState(0)

  // Computed: selected time ranges
  const selectedRanges = useMemo(
    () => getSelectedRanges(words),
    [words]
  )

  // Computed: total selected duration
  const selectedDuration = useMemo(
    () => selectedRanges.reduce((sum, r) => sum + (r.end - r.start), 0),
    [selectedRanges]
  )

  // Highlight current word during playback
  const currentWordId = useMemo(() => {
    const current = words.find(w =>
      w.selected && currentTime >= w.start && currentTime < w.end
    )
    return current?.id ?? null
  }, [words, currentTime])

  // Disable (deselect) words by ID
  const disableWords = useCallback((wordIds: string[]) => {
    setWords(prev => prev.map(w =>
      wordIds.includes(w.id) ? { ...w, selected: false } : w
    ))
  }, [])

  // Enable (select) words by ID
  const enableWords = useCallback((wordIds: string[]) => {
    setWords(prev => prev.map(w =>
      wordIds.includes(w.id) ? { ...w, selected: true } : w
    ))
  }, [])

  // Handle timeline trim handle changes - select words within the time range
  const handleRangeChange = useCallback((start: number, end: number) => {
    setWords(prev => prev.map(word => ({
      ...word,
      selected: word.start >= start && word.end <= end
    })))
  }, [])

  // Get the text content of selected words
  const getTranscriptionSlice = useCallback(() => {
    return words
      .filter(w => w.selected)
      .map(w => w.text)
      .join(' ')
  }, [words])

  // Reset words to initial state (all selected)
  const resetWords = useCallback(() => {
    setWords(initialWords)
  }, [initialWords])

  return {
    words,
    setWords,
    selectedRanges,
    selectedDuration,
    currentTime,
    setCurrentTime,
    currentWordId,
    disableWords,
    enableWords,
    handleRangeChange,
    getTranscriptionSlice,
    resetWords,
  }
}
