export interface ShortSuggestion {
  transcriptionSlice: string
  startTime: number
  endTime: number
  reason: string
}

export interface TranscriptionSegment {
  start: number
  end: number
  text: string
}

export interface VideoMetadata {
  duration: number
  width: number
  height: number
  fps: number
  codec: string
}
