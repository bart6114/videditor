// ============================================================================
// Unified Scheduling Components
// ============================================================================

// Main dialog entry point
export { ScheduleDialog } from './schedule-dialog'

// Accordion for managing multiple schedule items
export {
  ScheduleAccordion,
  validateAccordionItems,
  findScheduleConflicts,
  type ScheduleAccordionItem,
  type ScheduleAccordionProps,
  type AccordionValidationResult,
  type ScheduleConflict,
} from './schedule-accordion'

// Individual item editor
export {
  ScheduleItemEditor,
  createScheduleItemData,
  type ScheduleItemData,
  type ScheduleItemContent,
  type ScheduleItemEditorProps,
} from './schedule-item-editor'

// Platform content editor
export {
  PlatformContentEditor,
  MultiPlatformContentEditor,
  validatePlatformContent,
  validateAllPlatformContent,
  hasValidationErrors,
  createDefaultContent,
  createDefaultMultiPlatformContent,
  PLATFORM_LIMITS,
  type PlatformType,
  type PlatformContent,
  type PlatformFieldErrors,
} from './platform-content-editor'

// Timeline visualization
export {
  ScheduleTimeline,
  CompactTimeline,
} from './schedule-timeline'

// Form state hook
export {
  useScheduleForm,
  mergeContent,
  createEmptyContent,
  type ScheduleFormShort,
  type ScheduleFormState,
  type UseScheduleFormOptions,
  type UseScheduleFormReturn,
} from './use-schedule-form'
