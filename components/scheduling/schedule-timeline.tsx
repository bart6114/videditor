import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

interface TimelineItem {
  id: string
  scheduledFor: Date
  title?: string
}

interface ScheduleTimelineProps {
  items: TimelineItem[]
  conflicts?: { time: Date; itemIds: string[] }[]
  onItemClick?: (id: string) => void
  highlightedId?: string | null
  daysToShow?: number
  className?: string
}

// ============================================================================
// Helpers
// ============================================================================

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatDayLabel(date: Date): string {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === today.toDateString()) {
    return 'Today'
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow'
  }

  return DAY_NAMES[date.getDay()]
}

function formatDateShort(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function getTimelineRange(items: TimelineItem[], daysToShow: number) {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // Find the latest scheduled item
  let latestDate = startOfToday
  for (const item of items) {
    if (item.scheduledFor > latestDate) {
      latestDate = item.scheduledFor
    }
  }

  // Calculate end date (minimum daysToShow days, or extend to fit all items)
  const minEndDate = new Date(startOfToday)
  minEndDate.setDate(minEndDate.getDate() + daysToShow)

  // Clone to avoid mutating the original item's Date object
  const endDate = new Date(latestDate > minEndDate ? latestDate : minEndDate)

  // Add buffer of 1 day after latest item
  endDate.setDate(endDate.getDate() + 1)

  return {
    start: startOfToday,
    end: endDate,
  }
}

function getPositionPercentage(date: Date, start: Date, end: Date): number {
  const total = end.getTime() - start.getTime()
  const position = date.getTime() - start.getTime()
  return Math.max(0, Math.min(100, (position / total) * 100))
}

function getDayMarkers(start: Date, end: Date) {
  const markers: { date: Date; position: number }[] = []
  const current = new Date(start)

  while (current <= end) {
    markers.push({
      date: new Date(current),
      position: getPositionPercentage(current, start, end),
    })
    current.setDate(current.getDate() + 1)
  }

  return markers
}

// ============================================================================
// Main Component
// ============================================================================

export function ScheduleTimeline({
  items,
  conflicts = [],
  onItemClick,
  highlightedId,
  daysToShow = 7,
  className,
}: ScheduleTimelineProps) {
  // Calculate timeline range
  const range = useMemo(
    () => getTimelineRange(items, daysToShow),
    [items, daysToShow]
  )

  // Get day markers
  const dayMarkers = useMemo(
    () => getDayMarkers(range.start, range.end),
    [range]
  )

  // Calculate item positions
  const itemPositions = useMemo(() => {
    return items.map((item) => ({
      ...item,
      position: getPositionPercentage(item.scheduledFor, range.start, range.end),
    }))
  }, [items, range])

  // Get conflict item IDs for quick lookup
  const conflictItemIds = useMemo(() => {
    const ids = new Set<string>()
    for (const conflict of conflicts) {
      for (const id of conflict.itemIds) {
        ids.add(id)
      }
    }
    return ids
  }, [conflicts])

  if (items.length === 0) {
    return null
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header with date range */}
      <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
        <span>Schedule Distribution</span>
        <span>
          {formatDateShort(range.start)} - {formatDateShort(range.end)}
        </span>
      </div>

      {/* Timeline bar */}
      <div className="relative h-10 bg-muted/30 border-2 border-border cyber-clip-sm">
        {/* Day dividers */}
        {dayMarkers.slice(1).map((marker, index) => (
          <div
            key={index}
            className="absolute top-0 bottom-0 w-px bg-border/50"
            style={{ left: `${marker.position}%` }}
          />
        ))}

        {/* Item markers */}
        {itemPositions.map((item) => {
          const isHighlighted = highlightedId === item.id
          const isConflict = conflictItemIds.has(item.id)

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onItemClick?.(item.id)}
              className={cn(
                "absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full",
                "transition-all duration-200 cursor-pointer",
                "hover:scale-150 hover:z-10",
                isHighlighted
                  ? "bg-primary ring-2 ring-primary/30 scale-125 z-10"
                  : isConflict
                    ? "bg-amber-500 ring-2 ring-amber-500/30"
                    : "bg-primary/70 hover:bg-primary"
              )}
              style={{
                left: `${item.position}%`,
                transform: `translateX(-50%) translateY(-50%)`,
              }}
              title={item.title || `Scheduled for ${item.scheduledFor.toLocaleString()}`}
            />
          )
        })}
      </div>

      {/* Day labels */}
      <div className="relative h-5">
        {dayMarkers.map((marker, index) => (
          <div
            key={index}
            className="absolute text-[10px] font-mono text-muted-foreground -translate-x-1/2"
            style={{ left: `${marker.position}%` }}
          >
            {formatDayLabel(marker.date)}
          </div>
        ))}
      </div>

      {/* Conflict warnings */}
      {conflicts.length > 0 && (
        <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 cyber-clip-sm">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <span className="text-xs text-amber-600 dark:text-amber-400">
            {conflicts.length === 1
              ? `${conflicts[0].itemIds.length} items scheduled at same time`
              : `${conflicts.length} scheduling conflicts detected`}
          </span>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Compact Timeline (for dialog footer)
// ============================================================================

interface CompactTimelineProps {
  items: TimelineItem[]
  className?: string
}

export function CompactTimeline({ items, className }: CompactTimelineProps) {
  // Hooks must be called unconditionally
  const range = useMemo(() => getTimelineRange(items, 7), [items])

  const itemPositions = useMemo(() => {
    if (items.length === 0) return []
    return items.map((item) => ({
      id: item.id,
      position: getPositionPercentage(item.scheduledFor, range.start, range.end),
    }))
  }, [items, range])

  // Early return after hooks
  if (items.length === 0) {
    return null
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-[10px] text-muted-foreground font-mono uppercase">
        Distribution:
      </span>
      <div className="flex-1 h-2 bg-muted/30 border border-border rounded relative overflow-hidden">
        {itemPositions.map((item) => (
          <div
            key={item.id}
            className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary"
            style={{
              left: `${item.position}%`,
              transform: 'translateX(-50%) translateY(-50%)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
