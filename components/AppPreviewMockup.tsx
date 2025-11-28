import { Play, Clock, FileText, Sparkles, ChevronRight } from 'lucide-react'
import { SiYoutube, SiInstagram, SiTiktok } from '@icons-pack/react-simple-icons'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// LinkedIn icon (not available in simple-icons)
const LinkedInIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
)

interface AppPreviewMockupProps {
  className?: string
}

export function AppPreviewMockup({ className }: AppPreviewMockupProps) {
  return (
    <div className={cn("relative", className)}>
      {/* Background glow */}
      <div className="absolute inset-0 glow-accent opacity-30" />

      {/* Main container */}
      <div className="relative gradient-border rounded-2xl overflow-hidden bg-card/80 backdrop-blur-sm">

        {/* Window Chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 bg-background/50">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
          </div>
          <span className="text-[10px] text-muted-foreground/70 ml-2 font-medium">VidEditor.ai</span>
        </div>

        {/* Content Area */}
        <div className="p-4 md:p-6">
          {/* Two-Column Layout */}
          <div className="grid md:grid-cols-2 gap-4 md:gap-6">
            <MockVideoPlayer />
            <MockControls />
          </div>
        </div>
      </div>
    </div>
  )
}

function MockVideoPlayer() {
  return (
    <div className="space-y-3">
      {/* Video Thumbnail */}
      <div className="aspect-video bg-gradient-to-br from-muted/80 to-muted/40 rounded-lg relative overflow-hidden border border-border/30">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 dot-grid-dense opacity-30" />

        {/* Play Button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <Play className="w-5 h-5 text-background fill-background ml-0.5" />
          </div>
        </div>
      </div>

      {/* Project Info */}
      <div>
        <h4 className="font-medium text-sm text-foreground truncate">Marketing Interview - Q3 2024</h4>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            32:14
          </div>
          <Badge variant="default" className="text-[10px] px-1.5 py-0">completed</Badge>
        </div>
      </div>
    </div>
  )
}

function MockControls() {
  const platforms = [
    { icon: SiYoutube, selected: true, label: 'YouTube' },
    { icon: SiInstagram, selected: false, label: 'Instagram' },
    { icon: SiTiktok, selected: true, label: 'TikTok' },
    { icon: LinkedInIcon, selected: false, label: 'LinkedIn' },
  ]

  return (
    <div className="space-y-3">
      {/* Transcription Card */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Transcription</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="default" className="text-[10px] px-1.5 py-0">Ready</Badge>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      </div>

      {/* Generate Shorts Card */}
      <div className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Generate Shorts</span>
        </div>

        {/* Number Input */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Number:</span>
          <div className="w-12 h-7 rounded bg-background border border-border flex items-center justify-center">
            <span className="text-sm text-foreground">3</span>
          </div>
        </div>

        {/* Length Indicators */}
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>45s preferred</span>
          <span className="text-border">|</span>
          <span>60s max</span>
        </div>

        {/* Platform Buttons */}
        <div className="flex gap-1.5">
          {platforms.map((platform, i) => (
            <div
              key={i}
              className={cn(
                "w-8 h-8 rounded-md flex items-center justify-center border transition-colors",
                platform.selected
                  ? "bg-primary/20 border-primary/40 text-primary"
                  : "bg-muted/50 border-border/50 text-muted-foreground/50"
              )}
              title={platform.label}
            >
              <platform.icon size={14} />
            </div>
          ))}
        </div>

        {/* Generate Button with Shimmer */}
        <div className="relative overflow-hidden rounded-lg">
          <div className="h-9 bg-primary flex items-center justify-center gap-2 text-primary-foreground text-sm font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            Generate 3 Shorts
          </div>
          <div className="shimmer-overlay" />
        </div>

        {/* Credits */}
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Cost: 3 credits</span>
          <span>Balance: 47 credits</span>
        </div>
      </div>
    </div>
  )
}

export default AppPreviewMockup
