import { useState, useCallback, useMemo, useEffect } from 'react'
import type { ScheduleAccordionItem } from './schedule-accordion'
import { parseLocalDateTime, type ScheduleItemContent } from './schedule-item-editor'
import {
  validateAllPlatformContent,
  type PlatformType,
} from './platform-content-editor'
import type { YouTubeSocialContent, InstagramSocialContent, TikTokSocialContent, SocialContent } from '@shared/index'

// ============================================================================
// Types
// ============================================================================

export interface ScheduleFormShort {
  id: string
  title: string | null
  thumbnailUrl: string | null
  socialContent?: SocialContent | null
  metadata?: {
    transcriptionSlice?: string
  } | null
}

export interface ScheduleFormState {
  step: 'input' | 'preview'
  platforms: Set<PlatformType>
  expandedId: string | null
  items: ScheduleAccordionItem[]
  isValid: boolean
  hasChanges: boolean
}

export interface UseScheduleFormOptions {
  shorts: ScheduleFormShort[]
  initialPlatforms?: PlatformType[]
  draftKey?: string // For localStorage persistence
}

export interface UseScheduleFormReturn {
  // State
  state: ScheduleFormState

  // Platform actions
  togglePlatform: (platform: PlatformType) => void
  setPlatforms: (platforms: Set<PlatformType>) => void

  // Step actions
  setStep: (step: 'input' | 'preview') => void
  goBack: () => void

  // Item actions
  setExpandedId: (id: string | null) => void
  updateItemSchedule: (id: string, scheduledFor: Date) => void
  updateItemContent: (id: string, content: ScheduleItemContent) => void

  // Schedule initialization
  initializeSchedule: (scheduleData: { shortId: string; scheduledFor: string }[]) => void

  // Validation
  validate: () => { valid: boolean; invalidIds: string[] }

  // Reset
  reset: () => void

  // Get submission data
  getSubmissionData: () => {
    schedules: {
      shortId: string
      scheduledFor: string
      content: ScheduleItemContent
    }[]
  }
}

// ============================================================================
// Local Storage Draft Helpers
// ============================================================================

const DRAFT_EXPIRY_MS = 30 * 60 * 1000 // 30 minutes

interface DraftData {
  platforms: PlatformType[]
  items: {
    id: string
    scheduledFor: string
    content: ScheduleItemContent
  }[]
  timestamp: number
}

function saveDraft(key: string, platforms: Set<PlatformType>, items: ScheduleAccordionItem[]) {
  try {
    const data: DraftData = {
      platforms: Array.from(platforms),
      items: items.map((item) => ({
        id: item.id,
        scheduledFor: item.scheduledFor.toISOString(),
        content: item.content,
      })),
      timestamp: Date.now(),
    }
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // Ignore storage errors
  }
}

function loadDraft(key: string): DraftData | null {
  try {
    const stored = localStorage.getItem(key)
    if (!stored) return null

    const data: DraftData = JSON.parse(stored)

    // Check expiry
    if (Date.now() - data.timestamp > DRAFT_EXPIRY_MS) {
      localStorage.removeItem(key)
      return null
    }

    return data
  } catch {
    return null
  }
}

function clearDraft(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignore
  }
}

// ============================================================================
// Main Hook
// ============================================================================

export function useScheduleForm({
  shorts,
  initialPlatforms = [],
  draftKey,
}: UseScheduleFormOptions): UseScheduleFormReturn {
  // Core state
  const [step, setStepState] = useState<'input' | 'preview'>('input')
  const [platforms, setPlatformsState] = useState<Set<PlatformType>>(
    () => new Set(initialPlatforms)
  )
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [items, setItems] = useState<ScheduleAccordionItem[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  // Create default content for a short based on selected platforms
  const createDefaultContent = useCallback(
    (short: ScheduleFormShort, platformsToUse: Set<PlatformType>): ScheduleItemContent => {
      const socialContent = short.socialContent || {}
      const fallbackText =
        short.metadata?.transcriptionSlice?.slice(0, 100) ||
        short.title ||
        `Short ${short.id.slice(0, 8)}`

      const content: ScheduleItemContent = {}

      if (platformsToUse.has('youtube')) {
        content.youtube = socialContent.youtube || {
          title: fallbackText.slice(0, 100),
          description: '',
        }
      }
      if (platformsToUse.has('instagram')) {
        content.instagram = socialContent.instagram || {
          caption: fallbackText,
        }
      }
      if (platformsToUse.has('tiktok')) {
        content.tiktok = socialContent.tiktok || {
          caption: fallbackText,
        }
      }

      return content
    },
    []
  )

  // Load draft on mount
  useEffect(() => {
    if (!draftKey) return

    const draft = loadDraft(draftKey)
    if (draft && draft.items.length > 0) {
      // Restore platforms
      setPlatformsState(new Set(draft.platforms as PlatformType[]))

      // Restore items (match by ID)
      const restoredItems: ScheduleAccordionItem[] = []
      for (const draftItem of draft.items) {
        const short = shorts.find((s) => s.id === draftItem.id)
        if (short) {
          restoredItems.push({
            id: short.id,
            title: short.title || `Short ${short.id.slice(0, 8)}`,
            thumbnailUrl: short.thumbnailUrl,
            scheduledFor: parseLocalDateTime(draftItem.scheduledFor),
            platforms: new Set(draft.platforms as PlatformType[]),
            content: draftItem.content,
          })
        }
      }

      if (restoredItems.length > 0) {
        setItems(restoredItems)
        setStepState('preview')
        setHasChanges(true)
      }
    }
  }, [draftKey, shorts])

  // Save draft when items change
  useEffect(() => {
    if (!draftKey || items.length === 0) return
    saveDraft(draftKey, platforms, items)
  }, [draftKey, platforms, items])

  // Validate all items
  const validate = useCallback(() => {
    const invalidIds: string[] = []

    for (const item of items) {
      const result = validateAllPlatformContent(item.platforms, item.content)
      if (!result.valid) {
        invalidIds.push(item.id)
      }
    }

    return {
      valid: invalidIds.length === 0,
      invalidIds,
    }
  }, [items])

  // Check if form is valid
  const isValid = useMemo(() => {
    if (items.length === 0) return false
    if (platforms.size === 0) return false
    return validate().valid
  }, [items, platforms, validate])

  // Toggle a platform
  const togglePlatform = useCallback((platform: PlatformType) => {
    setPlatformsState((prev) => {
      const next = new Set(prev)
      if (next.has(platform)) {
        next.delete(platform)
      } else {
        next.add(platform)
      }
      return next
    })
  }, [])

  // Set platforms directly
  const setPlatforms = useCallback((newPlatforms: Set<PlatformType>) => {
    setPlatformsState(newPlatforms)
  }, [])

  // Set step
  const setStep = useCallback((newStep: 'input' | 'preview') => {
    setStepState(newStep)
  }, [])

  // Go back to input step
  const goBack = useCallback(() => {
    setStepState('input')
  }, [])

  // Update item schedule
  const updateItemSchedule = useCallback((id: string, scheduledFor: Date) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, scheduledFor } : item
      )
    )
    setHasChanges(true)
  }, [])

  // Update item content
  const updateItemContent = useCallback((id: string, content: ScheduleItemContent) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, content } : item
      )
    )
    setHasChanges(true)
  }, [])

  // Initialize schedule from AI-generated data
  const initializeSchedule = useCallback(
    (scheduleData: { shortId: string; scheduledFor: string }[]) => {
      const newItems: ScheduleAccordionItem[] = []

      for (const schedule of scheduleData) {
        const short = shorts.find((s) => s.id === schedule.shortId)
        if (!short) continue

        // Check if item already exists (preserve edits)
        const existing = items.find((i) => i.id === short.id)

        newItems.push({
          id: short.id,
          title: short.title || `Short ${short.id.slice(0, 8)}`,
          thumbnailUrl: short.thumbnailUrl,
          scheduledFor: parseLocalDateTime(schedule.scheduledFor),
          platforms,
          content: existing?.content || createDefaultContent(short, platforms),
        })
      }

      setItems(newItems)
      setStepState('preview')
    },
    [shorts, platforms, items, createDefaultContent]
  )

  // Reset form
  const reset = useCallback(() => {
    setStepState('input')
    setExpandedId(null)
    setItems([])
    setHasChanges(false)

    if (draftKey) {
      clearDraft(draftKey)
    }
  }, [draftKey])

  // Get submission data
  const getSubmissionData = useCallback(() => {
    return {
      schedules: items.map((item) => ({
        shortId: item.id,
        scheduledFor: item.scheduledFor.toISOString(),
        content: item.content,
      })),
    }
  }, [items])

  // Build state object
  const state: ScheduleFormState = useMemo(
    () => ({
      step,
      platforms,
      expandedId,
      items,
      isValid,
      hasChanges,
    }),
    [step, platforms, expandedId, items, isValid, hasChanges]
  )

  return {
    state,
    togglePlatform,
    setPlatforms,
    setStep,
    goBack,
    setExpandedId,
    updateItemSchedule,
    updateItemContent,
    initializeSchedule,
    validate,
    reset,
    getSubmissionData,
  }
}

// ============================================================================
// Utility: Merge content updates with existing content
// ============================================================================

export function mergeContent(
  existing: ScheduleItemContent,
  updates: Partial<ScheduleItemContent>
): ScheduleItemContent {
  return {
    youtube: updates.youtube ?? existing.youtube,
    instagram: updates.instagram ?? existing.instagram,
    tiktok: updates.tiktok ?? existing.tiktok,
  }
}

// ============================================================================
// Utility: Create empty content for platforms
// ============================================================================

export function createEmptyContent(platforms: Set<PlatformType>): ScheduleItemContent {
  const content: ScheduleItemContent = {}

  if (platforms.has('youtube')) {
    content.youtube = { title: '', description: '' }
  }
  if (platforms.has('instagram')) {
    content.instagram = { caption: '' }
  }
  if (platforms.has('tiktok')) {
    content.tiktok = { caption: '' }
  }

  return content
}
