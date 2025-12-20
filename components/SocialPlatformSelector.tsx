import { useState } from 'react'
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@shared/index'
import { SiYoutube, SiInstagram, SiTiktok } from '@icons-pack/react-simple-icons'
import { ChevronDown, ChevronUp } from 'lucide-react'

// LinkedIn icon as inline SVG (not available in simple-icons)
const LinkedInIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
)

export const PLATFORM_ICONS: Record<SocialPlatform, React.ComponentType<{ size?: number }>> = {
  youtube: SiYoutube,
  instagram: SiInstagram,
  tiktok: SiTiktok,
  linkedin: LinkedInIcon,
}

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
}

interface SocialPlatformSelectorProps {
  value: SocialPlatform[]
  onChange: (platforms: SocialPlatform[]) => void
  disabled?: boolean
  label?: string
  size?: 'sm' | 'default'
  // Optional social instructions
  socialPrompt?: string
  onSocialPromptChange?: (prompt: string) => void
  socialPromptExpanded?: boolean
  onSocialPromptExpandedChange?: (expanded: boolean) => void
}

export function SocialPlatformSelector({
  value,
  onChange,
  disabled = false,
  label = 'Generate Social Content',
  size = 'default',
  socialPrompt,
  onSocialPromptChange,
  socialPromptExpanded,
  onSocialPromptExpandedChange,
}: SocialPlatformSelectorProps) {
  // Internal state for expansion if not controlled
  const [internalExpanded, setInternalExpanded] = useState(false)

  const isExpanded = socialPromptExpanded ?? internalExpanded
  const setExpanded = onSocialPromptExpandedChange ?? setInternalExpanded

  const hasSocialPromptSupport = onSocialPromptChange !== undefined
  const showSocialPromptSection = hasSocialPromptSupport && value.length > 0

  const togglePlatform = (platform: SocialPlatform) => {
    onChange(
      value.includes(platform)
        ? value.filter((p) => p !== platform)
        : [...value, platform]
    )
  }

  const buttonClasses = size === 'sm'
    ? 'px-2 py-1 text-xs cyber-clip-sm'
    : 'px-2.5 py-1.5 text-xs cyber-clip-sm'

  return (
    <div className="space-y-3">
      <div>
        {label && (
          <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-2">
            {label}
          </label>
        )}
        <div className="flex flex-wrap gap-2">
          {SOCIAL_PLATFORMS.map((platform) => {
            const isSelected = value.includes(platform)
            const Icon = PLATFORM_ICONS[platform]
            return (
              <button
                key={platform}
                type="button"
                onClick={() => togglePlatform(platform)}
                disabled={disabled}
                className={`flex items-center gap-1.5 ${buttonClasses} border-2 transition-all duration-200 ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary shadow-neon-subtle'
                    : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                title={PLATFORM_LABELS[platform]}
              >
                <Icon size={14} />
                <span className="font-mono uppercase tracking-wider">{PLATFORM_LABELS[platform]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Collapsible social instructions */}
      {showSocialPromptSection && (
        <div className="border-2 border-border cyber-clip-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setExpanded(!isExpanded)}
            disabled={disabled}
            className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-primary/5 transition-colors disabled:opacity-50"
          >
            <span className="text-xs font-mono uppercase tracking-wider text-foreground">
              Custom Social Instructions
            </span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-primary" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          {isExpanded && (
            <div className="p-3 border-t-2 border-border">
              <textarea
                placeholder="> Use casual tone, include emojis..."
                value={socialPrompt ?? ''}
                onChange={(e) => onSocialPromptChange?.(e.target.value)}
                disabled={disabled}
                rows={2}
                className="w-full px-3 py-2 text-sm font-mono bg-background border-2 border-border cyber-clip-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
