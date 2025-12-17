import { useRef, useState, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react'
import { Button } from '@/components/ui/button'
import { Play, Pause, RotateCcw } from 'lucide-react'
import type { TimeRange } from '@shared/index'

export interface SegmentVideoPlayerRef {
  seekTo: (time: number) => void
  togglePlayPause: () => void
}

interface SegmentVideoPlayerProps {
  videoUrl: string
  selectedRanges: TimeRange[]
  onTimeUpdate?: (time: number) => void
  onRangeChange?: (start: number, end: number) => void
}

// Merge adjacent ranges (within threshold) for smoother playback
function mergeAdjacentRanges(ranges: TimeRange[], threshold = 0.1): TimeRange[] {
  if (ranges.length === 0) return []

  // Sort by start time
  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  const merged: TimeRange[] = [{ ...sorted[0] }]

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]
    const last = merged[merged.length - 1]

    // Merge if gap is smaller than threshold
    if (current.start - last.end <= threshold) {
      last.end = Math.max(last.end, current.end)
    } else {
      merged.push({ ...current })
    }
  }

  return merged
}

// Format duration as MM:SS
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const SegmentVideoPlayer = forwardRef<SegmentVideoPlayerRef, SegmentVideoPlayerProps>(
  function SegmentVideoPlayer({ videoUrl, selectedRanges, onTimeUpdate, onRangeChange }, ref) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentRangeIndex, setCurrentRangeIndex] = useState(0)

  // Trim handle positions (in seconds)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)
  const [trimInitialized, setTrimInitialized] = useState(false)

  // Merge adjacent ranges
  const mergedRanges = useMemo(
    () => mergeAdjacentRanges(selectedRanges),
    [selectedRanges]
  )

  // Total selected duration
  const totalSelectedDuration = useMemo(
    () => mergedRanges.reduce((sum, r) => sum + (r.end - r.start), 0),
    [mergedRanges]
  )

  // Handle video metadata loaded
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleLoadedMetadata = () => {
      const dur = video.duration
      setDuration(dur)
      // Initialize trim handles to full video length
      if (!trimInitialized && dur > 0) {
        setTrimStart(0)
        setTrimEnd(dur)
        setTrimInitialized(true)
      }
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    return () => video.removeEventListener('loadedmetadata', handleLoadedMetadata)
  }, [trimInitialized])

  // Handle trim handle changes
  const handleTrimChange = useCallback((start: number, end: number) => {
    setTrimStart(start)
    setTrimEnd(end)
    onRangeChange?.(start, end)
  }, [onRangeChange])

  // Handle time update and range jumping
  useEffect(() => {
    const video = videoRef.current
    if (!video || mergedRanges.length === 0 || !isPlaying) return

    const handleTimeUpdate = () => {
      const time = video.currentTime
      setCurrentTime(time)
      onTimeUpdate?.(time)

      const currentRange = mergedRanges[currentRangeIndex]
      if (!currentRange) return

      // Check if we've reached the end of current range
      if (time >= currentRange.end - 0.05) {
        const nextIndex = currentRangeIndex + 1

        if (nextIndex < mergedRanges.length) {
          // Jump to next range
          video.currentTime = mergedRanges[nextIndex].start
          setCurrentRangeIndex(nextIndex)
        } else {
          // End of all ranges
          video.pause()
          setIsPlaying(false)
        }
      }
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    return () => video.removeEventListener('timeupdate', handleTimeUpdate)
  }, [mergedRanges, currentRangeIndex, onTimeUpdate, isPlaying])

  // Handle video ended event
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleEnded = () => {
      setIsPlaying(false)
    }

    video.addEventListener('ended', handleEnded)
    return () => video.removeEventListener('ended', handleEnded)
  }, [])

  // Handle play/pause state changes from video element
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handlePause = () => setIsPlaying(false)
    const handlePlay = () => setIsPlaying(true)

    video.addEventListener('pause', handlePause)
    video.addEventListener('play', handlePlay)
    return () => {
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('play', handlePlay)
    }
  }, [])

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current
    if (!video || mergedRanges.length === 0) return

    if (isPlaying) {
      video.pause()
      setIsPlaying(false)
    } else {
      // If at end or outside ranges, start from beginning
      const currentRange = mergedRanges[currentRangeIndex]
      if (!currentRange ||
          currentTime < currentRange.start ||
          currentTime >= currentRange.end) {
        video.currentTime = mergedRanges[0].start
        setCurrentRangeIndex(0)
      }
      video.play()
      setIsPlaying(true)
    }
  }, [isPlaying, mergedRanges, currentRangeIndex, currentTime])

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    seekTo: (time: number) => {
      const video = videoRef.current
      if (video) {
        video.currentTime = time
        setCurrentTime(time)
        onTimeUpdate?.(time)

        // Find the range that contains this time and update index
        const rangeIndex = mergedRanges.findIndex(r => time >= r.start && time < r.end)
        if (rangeIndex !== -1) {
          setCurrentRangeIndex(rangeIndex)
        }
      }
    },
    togglePlayPause: handlePlayPause,
  }), [onTimeUpdate, mergedRanges, handlePlayPause])

  const handleRestart = useCallback(() => {
    const video = videoRef.current
    if (!video || mergedRanges.length === 0) return

    video.currentTime = mergedRanges[0].start
    setCurrentRangeIndex(0)
    video.play()
    setIsPlaying(true)
  }, [mergedRanges])

  return (
    <div className="space-y-4">
      {/* Video element */}
      <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-contain"
          playsInline
        />

        {mergedRanges.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <p className="text-white">Select words to preview</p>
          </div>
        )}
      </div>

      {/* Custom controls */}
      <div className="flex items-center gap-4">
        <Button
          size="icon"
          variant="outline"
          onClick={handlePlayPause}
          disabled={mergedRanges.length === 0}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={handleRestart}
          disabled={mergedRanges.length === 0}
        >
          <RotateCcw className="w-4 h-4" />
        </Button>

        {/* Timeline with drag handles */}
        <div className="flex-1">
          <TimelineWithHandles
            ranges={mergedRanges}
            currentTime={currentTime}
            totalDuration={duration}
            trimStart={trimStart}
            trimEnd={trimEnd}
            onTrimChange={handleTrimChange}
          />
        </div>

        <span className="text-sm text-muted-foreground min-w-[80px] text-right">
          {formatDuration(totalSelectedDuration)}
        </span>
      </div>
    </div>
  )
})

export default SegmentVideoPlayer

// Timeline with draggable trim handles
function TimelineWithHandles({
  ranges,
  currentTime,
  totalDuration,
  trimStart,
  trimEnd,
  onTrimChange,
}: {
  ranges: TimeRange[]
  currentTime: number
  totalDuration: number
  trimStart: number
  trimEnd: number
  onTrimChange: (start: number, end: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null)

  // Convert mouse position to time
  const mouseToTime = useCallback((clientX: number) => {
    if (!containerRef.current || totalDuration === 0) return 0
    const rect = containerRef.current.getBoundingClientRect()
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return percent * totalDuration
  }, [totalDuration])

  // Handle mouse events for dragging
  useEffect(() => {
    if (!dragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const time = mouseToTime(e.clientX)
      if (dragging === 'start') {
        // Don't let start go past end - 1 second
        const newStart = Math.min(time, trimEnd - 1)
        onTrimChange(Math.max(0, newStart), trimEnd)
      } else {
        // Don't let end go before start + 1 second
        const newEnd = Math.max(time, trimStart + 1)
        onTrimChange(trimStart, Math.min(totalDuration, newEnd))
      }
    }

    const handleMouseUp = () => {
      setDragging(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging, trimStart, trimEnd, totalDuration, mouseToTime, onTrimChange])

  if (totalDuration === 0) return <div className="h-6 bg-muted rounded-full" />

  const startPercent = (trimStart / totalDuration) * 100
  const endPercent = (trimEnd / totalDuration) * 100
  const currentPercent = (currentTime / totalDuration) * 100

  return (
    <div
      ref={containerRef}
      className="relative h-6 bg-muted rounded-md select-none"
    >
      {/* Dimmed areas outside trim range */}
      <div
        className="absolute h-full bg-black/30 rounded-l-md"
        style={{ left: 0, width: `${startPercent}%` }}
      />
      <div
        className="absolute h-full bg-black/30 rounded-r-md"
        style={{ left: `${endPercent}%`, right: 0 }}
      />

      {/* Selected range highlight */}
      <div
        className="absolute h-full bg-primary/20"
        style={{
          left: `${startPercent}%`,
          width: `${endPercent - startPercent}%`,
        }}
      />

      {/* Segment markers (word-level selections) */}
      {ranges.map((range, i) => (
        <div
          key={i}
          className="absolute h-full bg-primary/40"
          style={{
            left: `${(range.start / totalDuration) * 100}%`,
            width: `${((range.end - range.start) / totalDuration) * 100}%`,
          }}
        />
      ))}

      {/* Start handle */}
      <div
        className="absolute -top-1 -bottom-1 w-4 cursor-ew-resize group"
        style={{ left: `calc(${startPercent}% - 8px)` }}
        onMouseDown={(e) => {
          e.preventDefault()
          setDragging('start')
        }}
      >
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-2.5 bg-primary rounded-sm flex flex-col items-center justify-center gap-0.5 group-hover:bg-primary/80 transition-colors shadow-md">
          <div className="w-1 h-px bg-primary-foreground/60" />
          <div className="w-1 h-px bg-primary-foreground/60" />
          <div className="w-1 h-px bg-primary-foreground/60" />
        </div>
      </div>

      {/* End handle */}
      <div
        className="absolute -top-1 -bottom-1 w-4 cursor-ew-resize group"
        style={{ left: `calc(${endPercent}% - 8px)` }}
        onMouseDown={(e) => {
          e.preventDefault()
          setDragging('end')
        }}
      >
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-2.5 bg-primary rounded-sm flex flex-col items-center justify-center gap-0.5 group-hover:bg-primary/80 transition-colors shadow-md">
          <div className="w-1 h-px bg-primary-foreground/60" />
          <div className="w-1 h-px bg-primary-foreground/60" />
          <div className="w-1 h-px bg-primary-foreground/60" />
        </div>
      </div>

      {/* Current time indicator */}
      <div
        className="absolute top-0 h-full w-0.5 bg-white shadow-sm pointer-events-none"
        style={{ left: `${Math.min(currentPercent, 100)}%` }}
      />
    </div>
  )
}
