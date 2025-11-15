export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          user_id: string
          title: string
          video_url: string
          thumbnail_url: string | null
          duration: number
          file_size: number
          status: 'uploading' | 'processing' | 'transcribing' | 'analyzing' | 'completed' | 'error'
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          video_url: string
          thumbnail_url?: string | null
          duration: number
          file_size: number
          status?: 'uploading' | 'processing' | 'transcribing' | 'analyzing' | 'completed' | 'error'
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          video_url?: string
          thumbnail_url?: string | null
          duration?: number
          file_size?: number
          status?: 'uploading' | 'processing' | 'transcribing' | 'analyzing' | 'completed' | 'error'
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      transcriptions: {
        Row: {
          id: string
          project_id: string
          text: string
          segments: Json
          language: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          text: string
          segments: Json
          language?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          text?: string
          segments?: Json
          language?: string | null
          created_at?: string
        }
      }
      shorts: {
        Row: {
          id: string
          project_id: string
          title: string
          description: string
          start_time: number
          end_time: number
          video_url: string | null
          thumbnail_url: string | null
          status: 'pending' | 'processing' | 'completed' | 'error'
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          title: string
          description: string
          start_time: number
          end_time: number
          video_url?: string | null
          thumbnail_url?: string | null
          status?: 'pending' | 'processing' | 'completed' | 'error'
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          title?: string
          description?: string
          start_time?: number
          end_time?: number
          video_url?: string | null
          thumbnail_url?: string | null
          status?: 'pending' | 'processing' | 'completed' | 'error'
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      processing_jobs: {
        Row: {
          id: string
          project_id: string
          type: 'transcription' | 'analysis' | 'video_cut'
          status: 'pending' | 'processing' | 'completed' | 'error'
          progress: number
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          type: 'transcription' | 'analysis' | 'video_cut'
          status?: 'pending' | 'processing' | 'completed' | 'error'
          progress?: number
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          type?: 'transcription' | 'analysis' | 'video_cut'
          status?: 'pending' | 'processing' | 'completed' | 'error'
          progress?: number
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
