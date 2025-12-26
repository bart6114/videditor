import { useCallback, useMemo, useRef, useEffect } from 'react'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { SiYoutube, SiInstagram, SiTiktok } from '@icons-pack/react-simple-icons'
import {
  PlatformContentEditor,
  validateAllPlatformContent,
  type PlatformType,
} from './platform-content-editor'
import type { YouTubeSocialContent, InstagramSocialContent, TikTokSocialContent } from '@shared/index'

// ============================================================================
// Types
// ============================================================================

export interface ScheduleItemContent {
  youtube?: YouTubeSocialContent
  instagram?: InstagramSocialContent
  tiktok?: TikTokSocialContent
}

export interface ScheduleItemData {
  id: string
  title: string
  thumbnailUrl: string | null
  scheduledFor: Date
  platforms: Set<PlatformType>
  content: ScheduleItemContent
}

export interface ScheduleItemEditorProps {
  item: ScheduleItemData
  isExpanded: boolean
  onToggleExpand: () => void
  onScheduleChange: (scheduledFor: Date) => void
  onContentChange: (content: ScheduleItemContent) => void
  disabled?: boolean
  showValidation?: boolean
  className?: string
}

// ============================================================================
// Helpers
// ============================================================================

// Format Date to local datetime-local input format (YYYY-MM-DDTHH:MM)
const formatLocalDateTime = (d: Date) => {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Get preview text for collapsed state
const getContentPreview = (content: ScheduleItemContent, platforms: Set<PlatformType>): string => {
  if (platforms.has('youtube') && content.youtube?.title) {
    return content.youtube.title
  }
  if (platforms.has('instagram') && content.instagram?.caption) {
    return content.instagram.caption.slice(0, 50)
  }
  if (platforms.has('tiktok') && content.tiktok?.caption) {
    return content.tiktok.caption.slice(0, 50)
  }
  return ''
}

// Platform badge component
const PlatformBadge = ({ platform }: { platform: PlatformType }) => {
  const config = {
    youtube: { icon: SiYoutube, color: 'text-red-500' },
    instagram: { icon: SiInstagram, color: 'text-pink-500' },
    tiktok: { icon: SiTiktok, color: 'text-foreground' },
  }[platform]

  const Icon = config.icon
  return <Icon size={14} className={config.color} />
}

// ============================================================================
// Main Component
// ============================================================================

export function ScheduleItemEditor({
  item,
  isExpanded,
  onToggleExpand,
  onScheduleChange,
  onContentChange,
  disabled = false,
  showValidation = true,
  className,
}: ScheduleItemEditorProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const platformArray = Array.from(item.platforms)

  // Check for validation errors
  const validation = useMemo(() => {
    if (!showValidation) return { valid: true, errors: {} }
    return validateAllPlatformContent(item.platforms, item.content)
  }, [item.platforms, item.content, showValidation])

  const hasErrors = !validation.valid
  const contentPreview = getContentPreview(item.content, item.platforms)

  // Handle datetime change - explicitly parse as local time to avoid timezone shifts
  const handleDateTimeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value // Format: "2025-04-01T10:00"
      if (!value) return

      const [dateStr, timeStr] = value.split('T')
      if (!dateStr || !timeStr) return

      const [year, month, day] = dateStr.split('-').map(Number)
      const [hours, minutes] = timeStr.split(':').map(Number)

      // Construct Date explicitly in local timezone
      const newDate = new Date(year, month - 1, day, hours, minutes)
      if (!isNaN(newDate.getTime())) {
        onScheduleChange(newDate)
      }
    },
    [onScheduleChange]
  )

  // Handle content change for a specific platform
  const handlePlatformContentChange = useCallback(
    (platform: PlatformType, newContent: YouTubeSocialContent | InstagramSocialContent | TikTokSocialContent) => {
      onContentChange({
        ...item.content,
        [platform]: newContent,
      })
    },
    [item.content, onContentChange]
  )

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onToggleExpand()
      }
    },
    [onToggleExpand]
  )

  // Scroll expanded content into view
  useEffect(() => {
    if (isExpanded && contentRef.current) {
      // Small delay to allow animation to start
      const timer = setTimeout(() => {
        contentRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        })
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isExpanded])

  return (
    <div
      className={cn(
        "border-2 cyber-clip-sm overflow-hidden transition-all duration-200",
        isExpanded ? "border-primary shadow-neon-subtle" : "border-border",
        hasErrors && "border-red-500/50",
        className
      )}
    >
      {/* Collapsed Header Row */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleExpand}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex items-center gap-3 p-3 cursor-pointer select-none",
          "transition-colors duration-200",
          isExpanded ? "bg-primary/5" : "bg-background hover:bg-muted/30",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        {/* Thumbnail */}
        <div className="w-16 h-9 bg-muted cyber-clip-sm overflow-hidden flex-shrink-0 relative">
          {item.thumbnailUrl ? (
            <Image
              src={item.thumbnailUrl}
              alt=""
              fill
              sizes="64px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[10px] font-mono">
              NO THUMB
            </div>
          )}
        </div>

        {/* Title & Preview */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">
              {item.title}
            </span>
            {hasErrors && (
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            )}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-primary flex-shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            )}
          </div>
          {!isExpanded && contentPreview && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {contentPreview}
            </p>
          )}
        </div>

        {/* Platform Badges */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {platformArray.map((platform) => (
            <PlatformBadge key={platform} platform={platform} />
          ))}
        </div>

        {/* DateTime Picker */}
        <div
          className="flex-shrink-0"
          onClick={(e) => e.stopPropagation()} // Don't toggle expand when clicking datetime
        >
          <Input
            type="datetime-local"
            value={formatLocalDateTime(item.scheduledFor)}
            onChange={handleDateTimeChange}
            min={formatLocalDateTime(new Date())}
            disabled={disabled}
            className="w-auto text-xs h-8"
            showPrefix={false}
          />
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div
          ref={contentRef}
          className="border-t-2 border-border p-4 bg-muted/20 space-y-4 animate-in slide-in-from-top-2 duration-200"
        >
          {platformArray.map((platform) => {
            const platformContent = item.content[platform]
            if (!platformContent) return null

            return (
              <div
                key={platform}
                className="border-2 border-border cyber-clip-sm p-3 bg-background/50"
              >
                <PlatformContentEditor
                  platform={platform}
                  content={platformContent}
                  onChange={(newContent) => handlePlatformContentChange(platform, newContent)}
                  showHeader={true}
                  showValidation={showValidation}
                  disabled={disabled}
                />
              </div>
            )
          })}

          {platformArray.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No platforms selected
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Utility: Create item data from a short
// ============================================================================

export function createScheduleItemData(
  short: {
    id: string
    title: string | null
    thumbnailUrl: string | null
    socialContent?: {
      youtube?: YouTubeSocialContent
      instagram?: InstagramSocialContent
      tiktok?: TikTokSocialContent
    } | null
    metadata?: {
      transcriptionSlice?: string
    } | null
  },
  scheduledFor: Date,
  platforms: Set<PlatformType>
): ScheduleItemData {
  const socialContent = short.socialContent || {}
  const fallbackText = short.metadata?.transcriptionSlice?.slice(0, 100) || short.title || `Short ${short.id.slice(0, 8)}`

  // Create content with fallbacks for each platform
  const content: ScheduleItemContent = {}

  if (platforms.has('youtube')) {
    content.youtube = socialContent.youtube || {
      title: fallbackText.slice(0, 100),
      description: '',
    }
  }
  if (platforms.has('instagram')) {
    content.instagram = socialContent.instagram || {
      caption: fallbackText,
    }
  }
  if (platforms.has('tiktok')) {
    content.tiktok = socialContent.tiktok || {
      caption: fallbackText,
    }
  }

  return {
    id: short.id,
    title: short.title || `Short ${short.id.slice(0, 8)}`,
    thumbnailUrl: short.thumbnailUrl,
    scheduledFor,
    platforms,
    content,
  }
}
