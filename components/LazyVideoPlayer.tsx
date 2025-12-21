import { memo, useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { Play, Video, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const ReactPlayer = dynamic(() => import('react-player'), { ssr: false })

type PlayerState = 'idle' | 'loading' | 'playing'

interface LazyVideoPlayerProps {
  videoUrl?: string | null
  thumbnailUrl?: string | null
  title: string
  /** Called when user clicks play - use this to trigger async URL fetching */
  onRequestPlay?: () => void
  /** Show loading state externally (e.g., while fetching presigned URL) */
  isLoading?: boolean
  /** Error message to display */
  error?: string | null
  className?: string
}

export const LazyVideoPlayer = memo(function LazyVideoPlayer({
  videoUrl,
  thumbnailUrl,
  title,
  onRequestPlay,
  isLoading = false,
  error = null,
  className,
}: LazyVideoPlayerProps) {
  const [playerState, setPlayerState] = useState<PlayerState>('idle')

  // When videoUrl becomes available and we're in loading state, transition to playing
  useEffect(() => {
    if (videoUrl && playerState === 'loading') {
      setPlayerState('playing')
    }
  }, [videoUrl, playerState])

  // Reset to idle when component receives a new video (e.g., navigating between shorts)
  useEffect(() => {
    setPlayerState('idle')
  }, [title]) // Use title as a proxy for "new video"

  const handlePlay = () => {
    if (onRequestPlay) {
      // External URL fetching - transition to loading and call callback
      setPlayerState('loading')
      onRequestPlay()
    } else if (videoUrl) {
      // URL already available - go straight to playing
      setPlayerState('playing')
    }
  }

  // Show loading overlay
  const showLoading = isLoading || playerState === 'loading'

  return (
    <div className={cn('aspect-video bg-black overflow-hidden relative', className)}>
      {playerState === 'playing' && videoUrl ? (
        <ReactPlayer
          url={videoUrl}
          controls
          width="100%"
          height="100%"
          playing
          config={{
            file: {
              attributes: { controlsList: 'nodownload' },
            },
          }}
        />
      ) : (
        <div className="relative w-full h-full">
          {/* Thumbnail or fallback */}
          {thumbnailUrl ? (
            <Image
              src={thumbnailUrl}
              alt={title}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <Video className="w-12 h-12 text-primary/50" />
            </div>
          )}

          {/* Error overlay */}
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <div className="text-center p-4">
                <p className="text-sm text-destructive font-mono">{error}</p>
              </div>
            </div>
          ) : showLoading ? (
            /* Loading overlay */
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
                <p className="text-sm text-white/80 font-mono mt-2">Loading video...</p>
              </div>
            </div>
          ) : (
            /* Play button overlay */
            <button
              onClick={handlePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors group"
              aria-label={`Play ${title}`}
            >
              <div className="w-16 h-16 cyber-clip bg-primary/90 group-hover:bg-primary flex items-center justify-center transition-colors shadow-neon">
                <Play className="w-8 h-8 text-primary-foreground fill-primary-foreground ml-1" />
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  )
})
