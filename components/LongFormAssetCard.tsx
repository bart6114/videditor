import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Video,
  Clock,
  Loader2,
  AlertCircle,
  Play,
  Trash2,
} from 'lucide-react'
import type { MediaAsset } from '@/types/projects'

interface LongFormAssetCardProps {
  asset: MediaAsset
  isSelected: boolean
  onSelect: () => void
  onPlayVideo: () => void
  onDelete?: () => void
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

function getStatusBadge(status: MediaAsset['status']) {
  switch (status) {
    case 'uploading':
      return (
        <Badge variant="secondary" className="text-xs">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Uploading
        </Badge>
      )
    case 'processing':
      return (
        <Badge variant="secondary" className="text-xs">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Processing
        </Badge>
      )
    case 'ready':
    case 'completed':
      return (
        <Badge variant="default" className="text-xs">
          Transcribed
        </Badge>
      )
    case 'error':
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertCircle className="w-3 h-3 mr-1" />
          Error
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary" className="text-xs">
          {status}
        </Badge>
      )
  }
}

export function LongFormAssetCard({
  asset,
  isSelected,
  onSelect,
  onPlayVideo,
  onDelete,
}: LongFormAssetCardProps) {
  return (
    <Card
      className={`bg-card border-border transition-all duration-200 cursor-pointer group/card ${
        isSelected
          ? 'ring-2 ring-primary border-primary shadow-neon'
          : 'hover:border-primary/40 hover:shadow-neon-subtle'
      }`}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex gap-4 relative">
          {/* Thumbnail */}
          <div
            className="relative w-24 h-16 flex-shrink-0 cyber-clip-sm bg-muted overflow-hidden group border border-border"
            onClick={(e) => {
              e.stopPropagation()
              onPlayVideo()
            }}
          >
            {asset.thumbnailUrl ? (
              <Image
                src={asset.thumbnailUrl}
                alt={asset.title}
                fill
                className="object-cover transition-all duration-200 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <Video className="w-6 h-6 text-primary/50" />
              </div>
            )}
            {/* Play overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-8 h-8 cyber-clip-sm bg-primary flex items-center justify-center">
                <Play className="w-4 h-4 text-primary-foreground fill-primary-foreground ml-0.5" />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h4 className="font-mono text-sm text-foreground truncate normal-case">
                  {asset.title}
                </h4>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-mono">
                  {asset.durationSeconds && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-primary" />
                      {formatDuration(asset.durationSeconds)}
                    </span>
                  )}
                </div>
              </div>
              {getStatusBadge(asset.status)}
            </div>

            {/* Error message */}
            {asset.errorMessage && (
              <p className="text-xs text-destructive mt-2 line-clamp-1 font-mono">
                {asset.errorMessage}
              </p>
            )}
          </div>

          {/* Delete button */}
          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="absolute bottom-0 right-0 opacity-0 group-hover/card:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 p-2"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              title="Delete video"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
