/**
 * BulkScheduleDialog - Thin wrapper around the unified ScheduleDialog
 *
 * This component maintains backward compatibility with existing imports
 * while using the new unified scheduling components internally.
 *
 * @deprecated Prefer importing ScheduleDialog directly from '@/components/scheduling'
 */
import type { Short } from '@server/db/schema'
import type { SocialContent, ShortFormMetadata } from '@shared/index'
import { ScheduleDialog, type ScheduleFormShort } from '@/components/scheduling'

// ============================================================================
// Types (maintained for backward compatibility)
// ============================================================================

interface BulkScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shorts: Short[]
  organizationId: string
  onSuccess?: () => void
  defaultSchedulingPrompt?: string | null
}

// ============================================================================
// Transform Short to ScheduleFormShort
// ============================================================================

function transformShort(short: Short): ScheduleFormShort {
  const socialContent = short.socialContent as SocialContent | null
  const metadata = short.metadata as ShortFormMetadata | null

  return {
    id: short.id,
    title: short.title || null,
    thumbnailUrl: short.thumbnailUrl || null,
    socialContent: socialContent || null,
    metadata: metadata
      ? { transcriptionSlice: metadata.transcriptionSlice }
      : null,
  }
}

// ============================================================================
// Component
// ============================================================================

export function BulkScheduleDialog({
  open,
  onOpenChange,
  shorts,
  organizationId,
  onSuccess,
  defaultSchedulingPrompt,
}: BulkScheduleDialogProps) {
  // Transform shorts to ScheduleFormShort format
  const transformedShorts = shorts.map(transformShort)

  return (
    <ScheduleDialog
      open={open}
      onOpenChange={onOpenChange}
      shorts={transformedShorts}
      organizationId={organizationId}
      onSuccess={onSuccess}
      defaultSchedulingPrompt={defaultSchedulingPrompt}
      singleMode={false}
    />
  )
}
