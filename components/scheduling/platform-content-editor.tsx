import { useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { SiYoutube, SiInstagram, SiTiktok } from '@icons-pack/react-simple-icons'
import type { YouTubeSocialContent, InstagramSocialContent, TikTokSocialContent } from '@shared/index'

// ============================================================================
// Platform Content Types
// ============================================================================

export type PlatformType = 'youtube' | 'instagram' | 'tiktok'

export type PlatformContent =
  | { platform: 'youtube'; content: YouTubeSocialContent }
  | { platform: 'instagram'; content: InstagramSocialContent }
  | { platform: 'tiktok'; content: TikTokSocialContent }

// Field-level validation errors
export type PlatformFieldErrors = {
  title?: string
  description?: string
  caption?: string
}

// Platform requirements and limits
export const PLATFORM_LIMITS = {
  youtube: {
    title: { max: 100, required: true },
    description: { max: 5000, required: false },
  },
  instagram: {
    caption: { max: 2200, required: true },
  },
  tiktok: {
    caption: { max: 2200, required: true },
  },
} as const

// Platform display config
const PLATFORM_CONFIG = {
  youtube: {
    icon: SiYoutube,
    label: 'YouTube',
    iconColor: 'text-red-500',
  },
  instagram: {
    icon: SiInstagram,
    label: 'Instagram',
    iconColor: 'text-pink-500',
  },
  tiktok: {
    icon: SiTiktok,
    label: 'TikTok',
    iconColor: 'text-foreground',
  },
} as const

// ============================================================================
// Validation Helpers
// ============================================================================

export function validatePlatformContent(
  platform: PlatformType,
  content: YouTubeSocialContent | InstagramSocialContent | TikTokSocialContent
): PlatformFieldErrors {
  const errors: PlatformFieldErrors = {}

  if (platform === 'youtube') {
    const ytContent = content as YouTubeSocialContent
    const limits = PLATFORM_LIMITS.youtube

    if (limits.title.required && (!ytContent.title || ytContent.title.trim() === '')) {
      errors.title = 'Title is required'
    } else if (ytContent.title && ytContent.title.length > limits.title.max) {
      errors.title = `Title must be ${limits.title.max} characters or less`
    }

    if (ytContent.description && ytContent.description.length > limits.description.max) {
      errors.description = `Description must be ${limits.description.max} characters or less`
    }
  }

  if (platform === 'instagram') {
    const igContent = content as InstagramSocialContent
    const limits = PLATFORM_LIMITS.instagram

    if (limits.caption.required && (!igContent.caption || igContent.caption.trim() === '')) {
      errors.caption = 'Caption is required'
    } else if (igContent.caption && igContent.caption.length > limits.caption.max) {
      errors.caption = `Caption must be ${limits.caption.max} characters or less`
    }
  }

  if (platform === 'tiktok') {
    const ttContent = content as TikTokSocialContent
    const limits = PLATFORM_LIMITS.tiktok

    if (limits.caption.required && (!ttContent.caption || ttContent.caption.trim() === '')) {
      errors.caption = 'Caption is required'
    } else if (ttContent.caption && ttContent.caption.length > limits.caption.max) {
      errors.caption = `Caption must be ${limits.caption.max} characters or less`
    }
  }

  return errors
}

export function hasValidationErrors(errors: PlatformFieldErrors): boolean {
  return Object.keys(errors).length > 0
}

// ============================================================================
// YouTube Content Editor
// ============================================================================

interface YouTubeContentEditorProps {
  content: YouTubeSocialContent
  onChange: (content: YouTubeSocialContent) => void
  errors?: PlatformFieldErrors
  disabled?: boolean
}

function YouTubeContentEditor({
  content,
  onChange,
  errors,
  disabled,
}: YouTubeContentEditorProps) {
  const limits = PLATFORM_LIMITS.youtube

  return (
    <div className="space-y-3">
      {/* Title */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Title <span className="text-red-500">*</span>
          </label>
          <span className={cn(
            "text-xs font-mono",
            content.title.length > limits.title.max ? "text-red-500" : "text-muted-foreground"
          )}>
            {content.title.length}/{limits.title.max}
          </span>
        </div>
        <Input
          value={content.title}
          onChange={(e) => onChange({ ...content, title: e.target.value })}
          placeholder="Enter video title..."
          maxLength={limits.title.max + 10} // Allow slight overflow to show error
          disabled={disabled}
          className={cn(
            "text-sm",
            errors?.title && "border-red-500 focus:border-red-500"
          )}
          showPrefix={false}
        />
        {errors?.title && (
          <p className="text-xs text-red-500">{errors.title}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Description
          </label>
          <span className={cn(
            "text-xs font-mono",
            content.description.length > limits.description.max ? "text-red-500" : "text-muted-foreground"
          )}>
            {content.description.length}/{limits.description.max}
          </span>
        </div>
        <textarea
          value={content.description}
          onChange={(e) => onChange({ ...content, description: e.target.value })}
          placeholder="Enter video description..."
          disabled={disabled}
          rows={3}
          className={cn(
            "w-full px-3 py-2 border-2 border-border bg-background text-sm font-mono",
            "cyber-clip-sm resize-y min-h-[80px]",
            "placeholder:text-muted-foreground",
            "focus:outline-none focus:border-primary focus:shadow-neon-subtle",
            "disabled:cursor-not-allowed disabled:opacity-50",
            errors?.description && "border-red-500 focus:border-red-500"
          )}
        />
        {errors?.description && (
          <p className="text-xs text-red-500">{errors.description}</p>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Instagram Content Editor
// ============================================================================

interface InstagramContentEditorProps {
  content: InstagramSocialContent
  onChange: (content: InstagramSocialContent) => void
  errors?: PlatformFieldErrors
  disabled?: boolean
}

function InstagramContentEditor({
  content,
  onChange,
  errors,
  disabled,
}: InstagramContentEditorProps) {
  const limits = PLATFORM_LIMITS.instagram

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Caption <span className="text-red-500">*</span>
        </label>
        <span className={cn(
          "text-xs font-mono",
          content.caption.length > limits.caption.max ? "text-red-500" : "text-muted-foreground"
        )}>
          {content.caption.length}/{limits.caption.max}
        </span>
      </div>
      <textarea
        value={content.caption}
        onChange={(e) => onChange({ caption: e.target.value })}
        placeholder="Enter caption with hashtags..."
        disabled={disabled}
        rows={4}
        className={cn(
          "w-full px-3 py-2 border-2 border-border bg-background text-sm font-mono",
          "cyber-clip-sm resize-y min-h-[100px]",
          "placeholder:text-muted-foreground",
          "focus:outline-none focus:border-primary focus:shadow-neon-subtle",
          "disabled:cursor-not-allowed disabled:opacity-50",
          errors?.caption && "border-red-500 focus:border-red-500"
        )}
      />
      {errors?.caption && (
        <p className="text-xs text-red-500">{errors.caption}</p>
      )}
    </div>
  )
}

// ============================================================================
// TikTok Content Editor
// ============================================================================

interface TikTokContentEditorProps {
  content: TikTokSocialContent
  onChange: (content: TikTokSocialContent) => void
  errors?: PlatformFieldErrors
  disabled?: boolean
}

function TikTokContentEditor({
  content,
  onChange,
  errors,
  disabled,
}: TikTokContentEditorProps) {
  const limits = PLATFORM_LIMITS.tiktok

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Caption <span className="text-red-500">*</span>
        </label>
        <span className={cn(
          "text-xs font-mono",
          content.caption.length > limits.caption.max ? "text-red-500" : "text-muted-foreground"
        )}>
          {content.caption.length}/{limits.caption.max}
        </span>
      </div>
      <textarea
        value={content.caption}
        onChange={(e) => onChange({ caption: e.target.value })}
        placeholder="Enter caption with hashtags..."
        disabled={disabled}
        rows={4}
        className={cn(
          "w-full px-3 py-2 border-2 border-border bg-background text-sm font-mono",
          "cyber-clip-sm resize-y min-h-[100px]",
          "placeholder:text-muted-foreground",
          "focus:outline-none focus:border-primary focus:shadow-neon-subtle",
          "disabled:cursor-not-allowed disabled:opacity-50",
          errors?.caption && "border-red-500 focus:border-red-500"
        )}
      />
      {errors?.caption && (
        <p className="text-xs text-red-500">{errors.caption}</p>
      )}
    </div>
  )
}

// ============================================================================
// Main Platform Content Editor
// ============================================================================

interface PlatformContentEditorProps {
  platform: PlatformType
  content: YouTubeSocialContent | InstagramSocialContent | TikTokSocialContent
  onChange: (content: YouTubeSocialContent | InstagramSocialContent | TikTokSocialContent) => void
  showHeader?: boolean
  showValidation?: boolean
  disabled?: boolean
  className?: string
}

export function PlatformContentEditor({
  platform,
  content,
  onChange,
  showHeader = true,
  showValidation = true,
  disabled = false,
  className,
}: PlatformContentEditorProps) {
  const config = PLATFORM_CONFIG[platform]
  const Icon = config.icon

  // Validate on render if showValidation is true
  const errors = useMemo(() => {
    if (!showValidation) return {}
    return validatePlatformContent(platform, content)
  }, [platform, content, showValidation])

  return (
    <div className={cn("space-y-3", className)}>
      {showHeader && (
        <div className="flex items-center gap-2">
          <Icon size={16} className={config.iconColor} />
          <span className="text-sm font-medium">{config.label}</span>
        </div>
      )}

      {platform === 'youtube' && (
        <YouTubeContentEditor
          content={content as YouTubeSocialContent}
          onChange={onChange as (content: YouTubeSocialContent) => void}
          errors={errors}
          disabled={disabled}
        />
      )}

      {platform === 'instagram' && (
        <InstagramContentEditor
          content={content as InstagramSocialContent}
          onChange={onChange as (content: InstagramSocialContent) => void}
          errors={errors}
          disabled={disabled}
        />
      )}

      {platform === 'tiktok' && (
        <TikTokContentEditor
          content={content as TikTokSocialContent}
          onChange={onChange as (content: TikTokSocialContent) => void}
          errors={errors}
          disabled={disabled}
        />
      )}
    </div>
  )
}

// ============================================================================
// Multi-Platform Content Editor (for editing multiple platforms at once)
// ============================================================================

interface MultiPlatformContent {
  youtube?: YouTubeSocialContent
  instagram?: InstagramSocialContent
  tiktok?: TikTokSocialContent
}

interface MultiPlatformContentEditorProps {
  platforms: Set<PlatformType>
  content: MultiPlatformContent
  onChange: (content: MultiPlatformContent) => void
  showValidation?: boolean
  disabled?: boolean
  className?: string
}

export function MultiPlatformContentEditor({
  platforms,
  content,
  onChange,
  showValidation = true,
  disabled = false,
  className,
}: MultiPlatformContentEditorProps) {
  const platformArray = Array.from(platforms)

  // Get all validation errors across platforms
  const allErrors = useMemo(() => {
    if (!showValidation) return {}
    const errors: Record<PlatformType, PlatformFieldErrors> = {
      youtube: {},
      instagram: {},
      tiktok: {},
    }

    if (platforms.has('youtube') && content.youtube) {
      errors.youtube = validatePlatformContent('youtube', content.youtube)
    }
    if (platforms.has('instagram') && content.instagram) {
      errors.instagram = validatePlatformContent('instagram', content.instagram)
    }
    if (platforms.has('tiktok') && content.tiktok) {
      errors.tiktok = validatePlatformContent('tiktok', content.tiktok)
    }

    return errors
  }, [platforms, content, showValidation])

  if (platformArray.length === 0) {
    return null
  }

  return (
    <div className={cn("space-y-4", className)}>
      {platformArray.map((platform) => {
        const platformContent = content[platform]
        if (!platformContent) return null

        return (
          <div
            key={platform}
            className="border-2 border-border cyber-clip-sm p-3 bg-muted/20"
          >
            <PlatformContentEditor
              platform={platform}
              content={platformContent}
              onChange={(newContent) => {
                onChange({
                  ...content,
                  [platform]: newContent,
                })
              }}
              showHeader={true}
              showValidation={showValidation}
              disabled={disabled}
            />
          </div>
        )
      })}
    </div>
  )
}

// ============================================================================
// Utility: Check if all platform content is valid
// ============================================================================

export function validateAllPlatformContent(
  platforms: Set<PlatformType>,
  content: MultiPlatformContent
): { valid: boolean; errors: Record<PlatformType, PlatformFieldErrors> } {
  const errors: Record<PlatformType, PlatformFieldErrors> = {
    youtube: {},
    instagram: {},
    tiktok: {},
  }

  let valid = true

  for (const platform of platforms) {
    const platformContent = content[platform]
    if (!platformContent) {
      // Missing required content
      if (platform === 'youtube') {
        errors.youtube = { title: 'Content required' }
      } else {
        errors[platform] = { caption: 'Content required' }
      }
      valid = false
      continue
    }

    const platformErrors = validatePlatformContent(platform, platformContent)
    errors[platform] = platformErrors
    if (hasValidationErrors(platformErrors)) {
      valid = false
    }
  }

  return { valid, errors }
}

// ============================================================================
// Utility: Create default content for a platform
// ============================================================================

export function createDefaultContent(
  platform: PlatformType,
  fallbackText: string = ''
): YouTubeSocialContent | InstagramSocialContent | TikTokSocialContent {
  if (platform === 'youtube') {
    return {
      title: fallbackText.slice(0, 100),
      description: '',
    }
  }
  return {
    caption: fallbackText,
  }
}

export function createDefaultMultiPlatformContent(
  platforms: Set<PlatformType>,
  fallbackText: string = ''
): MultiPlatformContent {
  const content: MultiPlatformContent = {}

  if (platforms.has('youtube')) {
    content.youtube = {
      title: fallbackText.slice(0, 100),
      description: '',
    }
  }
  if (platforms.has('instagram')) {
    content.instagram = {
      caption: fallbackText,
    }
  }
  if (platforms.has('tiktok')) {
    content.tiktok = {
      caption: fallbackText,
    }
  }

  return content
}
