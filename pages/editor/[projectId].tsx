import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useApi } from '@/lib/api/client'
import WorkspaceLayout from '@/components/layout/WorkspaceLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Loader2, Film } from 'lucide-react'
import { SiYoutube, SiInstagram, SiTiktok } from '@icons-pack/react-simple-icons'
import type { Project, Transcription } from '@server/db/schema'
import { SOCIAL_PLATFORMS, type SocialPlatform, type TimeRange } from '@shared/index'
import WordTranscription from '@/components/editor/WordTranscription'
import SegmentVideoPlayer, { type SegmentVideoPlayerRef } from '@/components/editor/SegmentVideoPlayer'

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

// LinkedIn icon as inline SVG (not available in simple-icons)
const LinkedInIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
)

// Platform icons and labels
const PLATFORM_ICONS: Record<SocialPlatform, React.ComponentType<{ size?: number }>> = {
  youtube: SiYoutube,
  instagram: SiInstagram,
  tiktok: SiTiktok,
  linkedin: LinkedInIcon,
}

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
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
  const [rendering, setRendering] = useState(false)
  const [socialPlatforms, setSocialPlatforms] = useState<SocialPlatform[]>([])
  const [usingDefaultPlatforms, setUsingDefaultPlatforms] = useState(false)
  const [defaultsLoaded, setDefaultsLoaded] = useState(false)

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

        // Use word-level timestamps directly from Deepgram transcription
        if (data.transcription?.segments) {
          const words = mapTranscriptWords(data.transcription.segments as TranscriptWord[])
          setWords(words)
        }
      } catch (error) {
        console.error('Failed to load project:', error)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [projectId, call])

  // Load user default settings for social platforms
  useEffect(() => {
    if (defaultsLoaded) return

    async function loadDefaults() {
      try {
        const data = await call<{
          settings: {
            defaultSocialPlatforms: SocialPlatform[]
          }
        }>('/v1/user/settings')

        if (data.settings.defaultSocialPlatforms?.length > 0) {
          setSocialPlatforms(data.settings.defaultSocialPlatforms)
          setUsingDefaultPlatforms(true)
        }
      } catch (error) {
        // Silently ignore - user just won't have defaults prefilled
      } finally {
        setDefaultsLoaded(true)
      }
    }

    loadDefaults()
  }, [call, defaultsLoaded])

  // Word click handler - seek video to word start
  const handleWordClick = useCallback((time: number) => {
    videoPlayerRef.current?.seekTo(time)
  }, [])

  const disableWords = useCallback((wordIds: string[]) => {
    setWords(prev => prev.map(w =>
      wordIds.includes(w.id) ? { ...w, selected: false } : w
    ))
  }, [])

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

  // Save and render the manual short
  const handleSaveAndRender = useCallback(async () => {
    if (selectedRanges.length === 0 || !projectId) return

    setRendering(true)
    try {
      const transcriptionSlice = words
        .filter(w => w.selected)
        .map(w => w.text)
        .join(' ')

      await call(`/v1/projects/${projectId}/shorts/manual`, {
        method: 'POST',
        body: JSON.stringify({
          ranges: selectedRanges,
          transcriptionSlice,
          socialPlatforms: socialPlatforms.length > 0 ? socialPlatforms : undefined,
        }),
      })

      // Redirect to project page to see the new short
      router.push(`/projects/${projectId}`)
    } catch (error) {
      console.error('Failed to create short:', error)
      // TODO: Show error toast
    } finally {
      setRendering(false)
    }
  }, [selectedRanges, words, projectId, socialPlatforms, call, router])

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
          {/* Header with back link and actions */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <Link href={`/projects/${projectId}`}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Project
                </Button>
              </Link>

              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {formatDuration(selectedDuration)}
                </span>
                <Button
                  onClick={handleSaveAndRender}
                  disabled={rendering || selectedRanges.length === 0}
                >
                  {rendering ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Film className="w-4 h-4 mr-2" />
                  )}
                  Save & Render
                </Button>
              </div>
            </div>

            {/* Platform selection for AI captions */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  Generate AI captions
                </span>
                {usingDefaultPlatforms && socialPlatforms.length > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                    using default
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {SOCIAL_PLATFORMS.map((platform) => {
                  const isSelected = socialPlatforms.includes(platform)
                  const Icon = PLATFORM_ICONS[platform]
                  return (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => {
                        setSocialPlatforms((prev) =>
                          prev.includes(platform)
                            ? prev.filter((p) => p !== platform)
                            : [...prev, platform]
                        )
                        setUsingDefaultPlatforms(false)
                      }}
                      disabled={rendering}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-sm transition-all duration-200 ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                      }`}
                      title={PLATFORM_LABELS[platform]}
                    >
                      <Icon size={16} />
                      <span className="font-medium">{PLATFORM_LABELS[platform]}</span>
                    </button>
                  )
                })}
              </div>
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
                    onRangeChange={handleRangeChange}
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
                <CardTitle className="text-base">Select Content</CardTitle>
              </CardHeader>
              <CardContent>
                <WordTranscription
                  words={words}
                  currentWordId={currentWordId}
                  onWordClick={handleWordClick}
                  onDisableWords={disableWords}
                  onEnableWords={enableWords}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </WorkspaceLayout>
    </>
  )
}
