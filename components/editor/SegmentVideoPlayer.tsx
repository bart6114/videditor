import { useRef, useState, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react'
import { Button } from '@/components/ui/button'
import { Play, Pause, RotateCcw } from 'lucide-react'
import type { TimeRange } from '@/pages/editor/[projectId]'

export interface SegmentVideoPlayerRef {
  seekTo: (time: number) => void
  togglePlayPause: () => void
}

interface SegmentVideoPlayerProps {
  videoUrl: string
  selectedRanges: TimeRange[]
  onTimeUpdate?: (time: number) => void
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
  function SegmentVideoPlayer({ videoUrl, selectedRanges, onTimeUpdate }, ref) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentRangeIndex, setCurrentRangeIndex] = useState(0)

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
      setDuration(video.duration)
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    return () => video.removeEventListener('loadedmetadata', handleLoadedMetadata)
  }, [])

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

        {/* Progress indicator */}
        <div className="flex-1">
          <SegmentedProgressBar
            ranges={mergedRanges}
            currentTime={currentTime}
            totalDuration={duration}
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

// Visual progress bar showing selected segments
function SegmentedProgressBar({
  ranges,
  currentTime,
  totalDuration,
}: {
  ranges: TimeRange[]
  currentTime: number
  totalDuration: number
}) {
  if (totalDuration === 0) return <div className="h-2 bg-muted rounded-full" />

  return (
    <div className="relative h-2 bg-muted rounded-full overflow-hidden">
      {/* Segment markers */}
      {ranges.map((range, i) => (
        <div
          key={i}
          className="absolute h-full bg-primary/30"
          style={{
            left: `${(range.start / totalDuration) * 100}%`,
            width: `${((range.end - range.start) / totalDuration) * 100}%`,
          }}
        />
      ))}

      {/* Current time indicator */}
      <div
        className="absolute h-full w-1 bg-primary rounded-full transition-all"
        style={{
          left: `${Math.min((currentTime / totalDuration) * 100, 100)}%`,
        }}
      />
    </div>
  )
}
