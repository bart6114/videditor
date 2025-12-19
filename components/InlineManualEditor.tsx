import { useRef, useState, useEffect, useCallback } from 'react'
import { useApi } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { SocialPlatformSelector } from '@/components/SocialPlatformSelector'
import { Loader2, Scissors } from 'lucide-react'
import type { SocialPlatform } from '@shared/index'
import { useManualEditor, formatDuration } from '@/hooks/useManualEditor'
import SegmentVideoPlayer, { type SegmentVideoPlayerRef } from '@/components/editor/SegmentVideoPlayer'
import WordTranscription from '@/components/editor/WordTranscription'
import type { MediaAsset } from '@/types/projects'
import type { Transcription } from '@server/db/schema'

interface InlineManualEditorProps {
  asset: MediaAsset
  projectId: string
  transcription: Transcription
  onShortCreated: () => void
}

export function InlineManualEditor({
  asset,
  projectId,
  transcription,
  onShortCreated,
}: InlineManualEditorProps) {
  const { call } = useApi()
  const playerRef = useRef<SegmentVideoPlayerRef>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const editor = useManualEditor(transcription)
  const [socialPlatforms, setSocialPlatforms] = useState<SocialPlatform[]>([])
  const [customSocialPrompt, setCustomSocialPrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const [defaultsLoaded, setDefaultsLoaded] = useState(false)

  // Load user default settings for social platforms and prompt
  useEffect(() => {
    if (defaultsLoaded) return

    async function loadDefaults() {
      try {
        const data = await call<{
          settings: {
            defaultSocialPlatforms: SocialPlatform[]
            defaultSocialPrompt?: string
          }
        }>('/v1/user/settings')

        if (data.settings.defaultSocialPlatforms?.length > 0) {
          setSocialPlatforms(data.settings.defaultSocialPlatforms)
        }
        if (data.settings.defaultSocialPrompt) {
          setCustomSocialPrompt(data.settings.defaultSocialPrompt)
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
    playerRef.current?.seekTo(time)
  }, [])

  // Space key to toggle play/pause (scoped to this component)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if this component or its children are focused
      if (!containerRef.current?.contains(document.activeElement) &&
          document.activeElement !== document.body) {
        return
      }

      // Don't intercept if user is typing in an input
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, [contenteditable]')) return

      if (e.code === 'Space') {
        e.preventDefault()
        playerRef.current?.togglePlayPause()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Save and render the manual short
  const handleSaveAndRender = useCallback(async () => {
    if (editor.selectedRanges.length === 0) return

    setSaving(true)
    try {
      const transcriptionSlice = editor.getTranscriptionSlice()

      await call(`/v1/projects/${projectId}/shorts/manual`, {
        method: 'POST',
        body: JSON.stringify({
          ranges: editor.selectedRanges,
          transcriptionSlice,
          socialPlatforms: socialPlatforms.length > 0 ? socialPlatforms : undefined,
          customSocialPrompt: customSocialPrompt.trim() || undefined,
        }),
      })

      // Notify parent to refresh shorts list and switch back to AI mode
      onShortCreated()
    } catch (error) {
      console.error('Failed to create short:', error)
      // TODO: Show error toast
    } finally {
      setSaving(false)
    }
  }, [editor, projectId, socialPlatforms, customSocialPrompt, call, onShortCreated])

  return (
    <div ref={containerRef} className="grid lg:grid-cols-2 gap-6">
      {/* Left: Video with timeline */}
      <div className="space-y-4">
        {asset.videoUrl ? (
          <SegmentVideoPlayer
            ref={playerRef}
            videoUrl={asset.videoUrl}
            selectedRanges={editor.selectedRanges}
            onTimeUpdate={editor.setCurrentTime}
            onRangeChange={editor.handleRangeChange}
          />
        ) : (
          <div className="aspect-video bg-muted flex items-center justify-center rounded-lg">
            <p className="text-muted-foreground">Video not available</p>
          </div>
        )}
      </div>

      {/* Right: Word editor + actions */}
      <div className="flex flex-col">
        {/* Scrollable word transcription */}
        <div className="flex-1 min-h-0 max-h-[350px] overflow-y-auto">
          <WordTranscription
            words={editor.words}
            currentWordId={editor.currentWordId}
            onWordClick={handleWordClick}
            onDisableWords={editor.disableWords}
            onEnableWords={editor.enableWords}
          />
        </div>

        {/* Actions footer */}
        <div className="pt-4 mt-4 border-t border-border space-y-3">
          {/* Platform selection with optional instructions - wait for defaults to prevent flicker */}
          {defaultsLoaded && (
            <SocialPlatformSelector
              value={socialPlatforms}
              onChange={setSocialPlatforms}
              disabled={saving}
              label=""
              size="sm"
              socialPrompt={customSocialPrompt}
              onSocialPromptChange={setCustomSocialPrompt}
            />
          )}

          {/* Save button */}
          <Button
            onClick={handleSaveAndRender}
            disabled={saving || editor.selectedRanges.length === 0}
            className="w-full"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Scissors className="w-4 h-4 mr-2" />
            )}
            Save & Render ({formatDuration(editor.selectedDuration)})
          </Button>
        </div>
      </div>
    </div>
  )
}
