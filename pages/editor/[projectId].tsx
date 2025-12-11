import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useApi } from '@/lib/api/client'
import WorkspaceLayout from '@/components/layout/WorkspaceLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Loader2, Film } from 'lucide-react'
import type { Project, Transcription } from '@server/db/schema'
import WordTranscription from '@/components/editor/WordTranscription'
import SegmentVideoPlayer, { type SegmentVideoPlayerRef } from '@/components/editor/SegmentVideoPlayer'

// Word type with timestamp and selection state
export interface Word {
  id: string
  text: string
  start: number
  end: number
  segmentIndex: number
  wordIndex: number
  selected: boolean
  speaker: string | null
}

export interface TimeRange {
  start: number
  end: number
}

type TranscriptionSegment = {
  start: number
  end: number
  text: string
  speaker: string | null
}

// Interpolate word timestamps from segment-level timestamps
function interpolateWordTimestamps(segments: TranscriptionSegment[]): Word[] {
  const words: Word[] = []

  segments.forEach((segment, segmentIndex) => {
    const segmentWords = segment.text.trim().split(/\s+/).filter(w => w.length > 0)
    if (segmentWords.length === 0) return

    const segmentDuration = segment.end - segment.start
    const totalChars = segmentWords.reduce((sum, w) => sum + w.length, 0)

    let currentTime = segment.start

    segmentWords.forEach((word, wordIndex) => {
      // Character-weighted duration for more accurate timing
      const wordDuration = totalChars > 0
        ? (word.length / totalChars) * segmentDuration
        : segmentDuration / segmentWords.length

      words.push({
        id: `${segmentIndex}-${wordIndex}`,
        text: word,
        start: currentTime,
        end: currentTime + wordDuration,
        segmentIndex,
        wordIndex,
        selected: true, // Default: all words selected
        speaker: segment.speaker,
      })

      currentTime += wordDuration
    })
  })

  return words
}

// Get selected time ranges from word selection
function getSelectedRanges(words: Word[]): TimeRange[] {
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
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function ManualEditor() {
  const router = useRouter()
  const { projectId } = router.query
  const { call } = useApi()
  const videoPlayerRef = useRef<SegmentVideoPlayerRef>(null)

  // State
  const [project, setProject] = useState<Project | null>(null)
  const [transcription, setTranscription] = useState<Transcription | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [words, setWords] = useState<Word[]>([])
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

  // Load project data
  useEffect(() => {
    if (!projectId || typeof projectId !== 'string') return

    async function load() {
      try {
        const data = await call<{
          project: Project & { videoUrl?: string }
          transcription: Transcription | null
        }>(`/v1/projects/${projectId}`)

        setProject(data.project)
        setVideoUrl(data.project.videoUrl || null)
        setTranscription(data.transcription)

        // Interpolate word timestamps
        if (data.transcription?.segments) {
          const interpolated = interpolateWordTimestamps(data.transcription.segments)
          setWords(interpolated)
        }
      } catch (error) {
        console.error('Failed to load project:', error)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [projectId, call])

  // Word click handler - seek video to word start
  const handleWordClick = useCallback((time: number) => {
    videoPlayerRef.current?.seekTo(time)
  }, [])

  const disableWords = useCallback((wordIds: string[]) => {
    setWords(prev => prev.map(w =>
      wordIds.includes(w.id) ? { ...w, selected: false } : w
    ))
  }, [])

  const selectAll = useCallback(() => {
    setWords(prev => prev.map(w => ({ ...w, selected: true })))
  }, [])

  const deselectAll = useCallback(() => {
    setWords(prev => prev.map(w => ({ ...w, selected: false })))
  }, [])

  // Highlight current word during playback
  const currentWordId = useMemo(() => {
    const current = words.find(w =>
      w.selected && currentTime >= w.start && currentTime < w.end
    )
    return current?.id ?? null
  }, [words, currentTime])

  // Space key to toggle play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, [contenteditable]')) return

      if (e.code === 'Space') {
        e.preventDefault()
        videoPlayerRef.current?.togglePlayPause()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (loading) {
    return (
      <WorkspaceLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </WorkspaceLayout>
    )
  }

  if (!project || !transcription) {
    return (
      <WorkspaceLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Project not found or transcription not available.
          </p>
          <Link href="/projects">
            <Button className="mt-4">Back to Projects</Button>
          </Link>
        </div>
      </WorkspaceLayout>
    )
  }

  return (
    <>
      <Head>
        <title>Edit Short - {project.title} - VidEditor.ai</title>
      </Head>

      <WorkspaceLayout title="Manual Short Editor">
        <div className="space-y-6">
          {/* Header with back link */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <Link href={`/projects/${projectId}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Project
              </Button>
            </Link>

            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Selected: {formatDuration(selectedDuration)}
              </span>
              <Button disabled>
                <Film className="w-4 h-4 mr-2" />
                Render (Coming Soon)
              </Button>
            </div>
          </div>

          {/* Two-column layout */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left: Video Player */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Preview</CardTitle>
              </CardHeader>
              <CardContent>
                {videoUrl ? (
                  <SegmentVideoPlayer
                    ref={videoPlayerRef}
                    videoUrl={videoUrl}
                    selectedRanges={selectedRanges}
                    onTimeUpdate={setCurrentTime}
                  />
                ) : (
                  <div className="aspect-video bg-muted flex items-center justify-center rounded-lg">
                    <p className="text-muted-foreground">Video not available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right: Word Selection */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Select Content</CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={selectAll}>
                      Select All
                    </Button>
                    <Button size="sm" variant="outline" onClick={deselectAll}>
                      Clear
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <WordTranscription
                  words={words}
                  currentWordId={currentWordId}
                  onWordClick={handleWordClick}
                  onDisableWords={disableWords}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </WorkspaceLayout>
    </>
  )
}
