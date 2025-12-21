import { useCallback, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import {
  ScheduleItemEditor,
  type ScheduleItemData,
  type ScheduleItemContent,
} from './schedule-item-editor'
import { validateAllPlatformContent, type PlatformType } from './platform-content-editor'

// ============================================================================
// Types
// ============================================================================

export interface ScheduleAccordionItem extends ScheduleItemData {
  // Additional fields can be added here
}

export interface ScheduleAccordionProps {
  items: ScheduleAccordionItem[]
  expandedId: string | null
  onExpandedChange: (id: string | null) => void
  onItemScheduleChange: (id: string, scheduledFor: Date) => void
  onItemContentChange: (id: string, content: ScheduleItemContent) => void
  disabled?: boolean
  showValidation?: boolean
  className?: string
}

// ============================================================================
// Main Component
// ============================================================================

export function ScheduleAccordion({
  items,
  expandedId,
  onExpandedChange,
  onItemScheduleChange,
  onItemContentChange,
  disabled = false,
  showValidation = true,
  className,
}: ScheduleAccordionProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const focusedIndexRef = useRef<number>(-1)

  // Handle toggle expand (exclusive mode - only one can be expanded)
  const handleToggleExpand = useCallback(
    (id: string) => {
      if (disabled) return

      if (expandedId === id) {
        // Collapse current item
        onExpandedChange(null)
      } else {
        // Expand new item (auto-collapses previous)
        onExpandedChange(id)
      }
    },
    [expandedId, onExpandedChange, disabled]
  )

  // Handle outside click to collapse
  useEffect(() => {
    if (!expandedId) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (containerRef.current && !containerRef.current.contains(target)) {
        onExpandedChange(null)
      }
    }

    // Add listener with a small delay to avoid immediate collapse on expand click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [expandedId, onExpandedChange])

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled || items.length === 0) return

      const currentIndex = focusedIndexRef.current
      let newIndex = currentIndex

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0
          break
        case 'ArrowUp':
          e.preventDefault()
          newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1
          break
        case 'Home':
          e.preventDefault()
          newIndex = 0
          break
        case 'End':
          e.preventDefault()
          newIndex = items.length - 1
          break
        case 'Escape':
          e.preventDefault()
          onExpandedChange(null)
          return
        default:
          return
      }

      if (newIndex !== currentIndex) {
        focusedIndexRef.current = newIndex
        // Focus the item button
        const itemElements = containerRef.current?.querySelectorAll('[role="button"]')
        if (itemElements?.[newIndex]) {
          (itemElements[newIndex] as HTMLElement).focus()
        }
      }
    },
    [items.length, onExpandedChange, disabled]
  )

  // Track focused index when item gains focus
  const handleItemFocus = useCallback((index: number) => {
    focusedIndexRef.current = index
  }, [])

  if (items.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        <p className="text-sm font-mono">NO ITEMS TO SCHEDULE</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn("space-y-2", className)}
      onKeyDown={handleKeyDown}
      role="list"
      aria-label="Schedule items"
    >
      {items.map((item, index) => (
        <div
          key={item.id}
          role="listitem"
          onFocus={() => handleItemFocus(index)}
        >
          <ScheduleItemEditor
            item={item}
            isExpanded={expandedId === item.id}
            onToggleExpand={() => handleToggleExpand(item.id)}
            onScheduleChange={(scheduledFor) => onItemScheduleChange(item.id, scheduledFor)}
            onContentChange={(content) => onItemContentChange(item.id, content)}
            disabled={disabled}
            showValidation={showValidation}
          />
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Utility: Get validation summary for all items
// ============================================================================

export interface AccordionValidationResult {
  valid: boolean
  invalidCount: number
  invalidIds: string[]
  itemErrors: Record<string, Record<PlatformType, Record<string, string>>>
}

export function validateAccordionItems(items: ScheduleAccordionItem[]): AccordionValidationResult {
  const invalidIds: string[] = []
  const itemErrors: Record<string, Record<PlatformType, Record<string, string>>> = {}

  for (const item of items) {
    const result = validateAllPlatformContent(item.platforms, item.content)
    if (!result.valid) {
      invalidIds.push(item.id)
      itemErrors[item.id] = result.errors
    }
  }

  return {
    valid: invalidIds.length === 0,
    invalidCount: invalidIds.length,
    invalidIds,
    itemErrors,
  }
}

// ============================================================================
// Utility: Check for schedule conflicts
// ============================================================================

export interface ScheduleConflict {
  time: Date
  itemIds: string[]
}

export function findScheduleConflicts(
  items: ScheduleAccordionItem[],
  toleranceMinutes: number = 5
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = []
  const sorted = [...items].sort(
    (a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime()
  )

  for (let i = 0; i < sorted.length; i++) {
    const conflictGroup: string[] = [sorted[i].id]
    let j = i + 1

    while (j < sorted.length) {
      const timeDiff = Math.abs(
        sorted[j].scheduledFor.getTime() - sorted[i].scheduledFor.getTime()
      )
      if (timeDiff <= toleranceMinutes * 60 * 1000) {
        conflictGroup.push(sorted[j].id)
        j++
      } else {
        break
      }
    }

    if (conflictGroup.length > 1) {
      // Check if we already have a conflict containing these items
      const existingConflict = conflicts.find((c) =>
        conflictGroup.some((id) => c.itemIds.includes(id))
      )

      if (existingConflict) {
        // Merge with existing conflict
        for (const id of conflictGroup) {
          if (!existingConflict.itemIds.includes(id)) {
            existingConflict.itemIds.push(id)
          }
        }
      } else {
        conflicts.push({
          time: sorted[i].scheduledFor,
          itemIds: conflictGroup,
        })
      }
    }
  }

  return conflicts
}
